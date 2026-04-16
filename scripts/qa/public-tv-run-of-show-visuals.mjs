import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { FIXED_QA_TV_NOW_MS, QA_TV_VISUAL_SCENARIOS, buildQaTvFixture } from "../../src/apps/TV/qaTvFixtures.js";
import {
  delay,
  ensurePlaywright,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";

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
const EXPECTED_SCENES = Object.freeze({
  "preview-intro": "intro",
  "preview-wyr": "would_you_rather_break",
  "live-announcement": "announcement",
  "live-closing": "closing",
});

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
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

const freezeMotion = async (page) => {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
};

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

const verifyTakeoverSemantics = async ({ page, scenario, timeoutMs, expectedBrandLogoFragment }) => {
  const overlay = page.locator(".public-tv").first();
  await overlay.waitFor({ state: "visible", timeout: timeoutMs });

  const scene = await overlay.getAttribute("data-tv-takeover-scene");
  const roomCode = await overlay.getAttribute("data-tv-room-code");
  const brandLogo = await overlay.getAttribute("data-tv-brand-logo");
  const headline = page.locator("[data-tv-takeover-headline]").first();
  const headlineFontSize = await headline.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize || "0"));

  if (scene !== EXPECTED_SCENES[scenario.id]) {
    throw new Error(`Unexpected takeover scene for ${scenario.id}: ${scene}`);
  }
  if (roomCode !== scenario.roomCode) {
    throw new Error(`Unexpected room code for ${scenario.id}: ${roomCode}`);
  }
  const expectedBrandLogo = String(expectedBrandLogoFragment || "").trim() || "karaoke-kickoff-logo-simple.png";
  if (!String(brandLogo || "").includes(expectedBrandLogo)) {
    throw new Error(`Unexpected takeover brand logo for ${scenario.id}: ${brandLogo}`);
  }
  if (!(headlineFontSize >= 150)) {
    throw new Error(`Headline font too small for ${scenario.id}: ${headlineFontSize}px`);
  }
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

  const server = await startStaticDistServer({ distDir: DIST_DIR, port });
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
      const scenarioFixture = buildQaTvFixture(scenario.id, {
        roomCode: scenario.roomCode,
        nowMs: FIXED_QA_TV_NOW_MS,
      });
      const expectedBrandLogoFragment = String(scenarioFixture?.room?.logoUrl || "")
        .split("/")
        .filter(Boolean)
        .pop();
      await page.setViewportSize(scenario.viewport);
      await page.goto(buildTvUrl(server.baseUrl, scenario.roomCode, scenario.id), {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      await freezeMotion(page);
      await delay(2500);
      await waitForBodyTexts({ page, expectedTexts: scenario.expectedTexts, timeoutMs });
      const overlay = page.locator(".public-tv").first();
      await overlay.waitFor({ state: "visible", timeout: timeoutMs });
      await verifyTakeoverSemantics({ page, scenario, timeoutMs, expectedBrandLogoFragment });
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
