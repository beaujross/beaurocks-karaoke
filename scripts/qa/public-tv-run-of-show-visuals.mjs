import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { FIXED_QA_TV_NOW_MS, QA_TV_VISUAL_SCENARIOS } from "../../src/apps/TV/qaTvFixtures.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const DEFAULT_PORT = 0;
const DEFAULT_TIMEOUT_MS = 90000;
const BASELINE_DIR = path.join(repoRoot, "tests", "visual-baselines", "public-tv-run-of-show");
const ARTIFACT_DIR = path.join(repoRoot, "tmp", "qa-public-tv-run-of-show");
const DIST_DIR = path.join(repoRoot, "dist");
const FIREBASE_FALLBACK_CONFIG = {
  apiKey: "demo-api-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456",
};

const FIXTURES = QA_TV_VISUAL_SCENARIOS.map((scenario) => ({
  ...scenario,
  viewport: { width: 1600, height: 900 },
}));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(
      `Playwright is not installed (${message}). Run: npm install && npm run qa:admin:prod:install`
    );
  }
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

const resolveDistFilePath = async (requestPath = "/") => {
  const normalized = decodeURIComponent(String(requestPath || "/")).split("?")[0];
  const trimmed = normalized.replace(/^\/+/, "");
  const joined = path.resolve(DIST_DIR, trimmed || "index.html");
  if (!joined.startsWith(DIST_DIR)) {
    return path.join(DIST_DIR, "index.html");
  }
  try {
    const stats = await fs.stat(joined);
    if (stats.isDirectory()) {
      return path.join(joined, "index.html");
    }
    return joined;
  } catch {
    return path.join(DIST_DIR, "index.html");
  }
};

const startLocalServer = async ({ port }) => {
  await fs.access(path.join(DIST_DIR, "index.html"));
  const server = http.createServer(async (req, res) => {
    try {
      const filePath = await resolveDistFilePath(req?.url || "/");
      const body = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Server error: ${String(error?.message || error)}`);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    baseUrl: `http://127.0.0.1:${actualPort}`,
    stop: async () => {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
};

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const comparePngFiles = async (actualPath, baselinePath) => {
  const actual = await sharp(actualPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const baseline = await sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (
    actual.info.width !== baseline.info.width
    || actual.info.height !== baseline.info.height
    || actual.info.channels !== baseline.info.channels
  ) {
    throw new Error(
      `Baseline dimensions changed: actual ${actual.info.width}x${actual.info.height} vs baseline ${baseline.info.width}x${baseline.info.height}.`
    );
  }

  let diffPixels = 0;
  const totalPixels = actual.info.width * actual.info.height;
  for (let index = 0; index < actual.data.length; index += 4) {
    const rDiff = Math.abs(actual.data[index] - baseline.data[index]);
    const gDiff = Math.abs(actual.data[index + 1] - baseline.data[index + 1]);
    const bDiff = Math.abs(actual.data[index + 2] - baseline.data[index + 2]);
    const aDiff = Math.abs(actual.data[index + 3] - baseline.data[index + 3]);
    if (rDiff > 10 || gDiff > 10 || bDiff > 10 || aDiff > 10) diffPixels += 1;
  }

  const mismatchPct = (diffPixels / totalPixels) * 100;
  if (mismatchPct > 0.15) {
    throw new Error(`Visual mismatch ${mismatchPct.toFixed(3)}% exceeded 0.15% threshold.`);
  }
  return mismatchPct;
};

const buildTvUrl = (baseUrl, roomCode, fixtureId) =>
  `${baseUrl}/?mode=tv&room=${encodeURIComponent(roomCode)}&mkDemoEmbed=1&qaTvFixture=${encodeURIComponent(fixtureId)}`;

const waitForBodyTexts = async ({ page, expectedTexts, timeoutMs }) => {
  const startedAt = Date.now();
  let lastBodyText = "";
  while ((Date.now() - startedAt) < timeoutMs) {
    lastBodyText = String(await page.locator("body").innerText().catch(() => "")).slice(0, 1200);
    const lowered = lastBodyText.toLowerCase();
    if (expectedTexts.every((text) => lowered.includes(String(text || "").toLowerCase()))) {
      return;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for expected takeover copy: ${expectedTexts.join(", ")} :: ${lastBodyText}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const updateBaselines = args.includes("--update-baselines");
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const requestedPort = process.env.QA_PORT;
  const port = requestedPort === undefined
    ? DEFAULT_PORT
    : Math.max(3000, Number(requestedPort || DEFAULT_PORT));
  const headless = !toBool(process.env.QA_HEADFUL, false);
  const { chromium } = await ensurePlaywright();

  await ensureDir(BASELINE_DIR);
  await ensureDir(ARTIFACT_DIR);

  const server = await startLocalServer({ port, timeoutMs });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addInitScript((firebaseConfig, fixedNowMs) => {
    if (!window.__firebase_config) {
      window.__firebase_config = firebaseConfig;
    }
    const frozenNow = Number(fixedNowMs || Date.now());
    Date.now = () => frozenNow;
  }, FIREBASE_FALLBACK_CONFIG, FIXED_QA_TV_NOW_MS);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });

  const checks = [];
  let failure = null;

  try {
    for (const scenario of FIXTURES) {
      await page.setViewportSize(scenario.viewport);
      await page.goto(buildTvUrl(server.baseUrl, scenario.roomCode, scenario.id), {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      await delay(2500);
      await waitForBodyTexts({ page, expectedTexts: scenario.expectedTexts, timeoutMs });
      const overlay = page.locator(".public-tv").first();
      await overlay.waitFor({ state: "visible", timeout: timeoutMs });
      await delay(150);

      const artifactPath = path.join(ARTIFACT_DIR, `${scenario.id}.png`);
      const baselinePath = path.join(BASELINE_DIR, `${scenario.id}.png`);
      await overlay.screenshot({ path: artifactPath });

      if (updateBaselines) {
        await fs.copyFile(artifactPath, baselinePath);
        checks.push({ name: scenario.id, pass: true, detail: "baseline updated" });
        continue;
      }

      await fs.access(baselinePath);
      const mismatchPct = await comparePngFiles(artifactPath, baselinePath);
      checks.push({
        name: scenario.id,
        pass: true,
        detail: `matched baseline (${mismatchPct.toFixed(3)}% mismatch)`,
      });
    }
  } catch (error) {
    failure = error;
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "failure-full-page.png"), fullPage: true });
    } catch {
      // ignore screenshot failures
    }
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }

  const summary = checks.map((entry) => `${entry.pass ? "PASS" : "FAIL"} ${entry.name}: ${entry.detail}`).join("\n");
  if (summary) console.log(summary);
  if (failure) {
    console.error(`Run-of-show TV visual QA failed: ${String(failure?.message || failure)}`);
    process.exitCode = 1;
    return;
  }
  console.log(updateBaselines ? "Baselines updated." : "Run-of-show TV visual QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
