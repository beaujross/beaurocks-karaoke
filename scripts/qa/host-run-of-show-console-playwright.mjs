import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildQaHostFixture, FIXED_QA_HOST_NOW_MS } from "../../src/apps/Host/qaHostFixtures.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");
const DEFAULT_PORT = 0;
const DEFAULT_TIMEOUT_MS = 90000;
const FIREBASE_RUNTIME_CONFIG = {
  apiKey: "AIzaSyBmX0XXpGE0wGcR9YXw3oKOqnJE9GT6_Jc",
  authDomain: "beaurocks-karaoke-v2.firebaseapp.com",
  projectId: "beaurocks-karaoke-v2",
  storageBucket: "beaurocks-karaoke-v2.firebasestorage.app",
  messagingSenderId: "426849563936",
  appId: "1:426849563936:web:03c1d7eefd0c66e4649345",
  measurementId: "G-KRHWBTB7V7",
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(`Playwright is not installed (${message}). Run: npm install && npm run qa:admin:prod:install`);
  }
};

const resolveDistFilePath = async (requestPath = "/") => {
  const normalized = decodeURIComponent(String(requestPath || "/")).split("?")[0];
  const trimmed = normalized.replace(/^\/+/, "");
  const joined = path.resolve(DIST_DIR, trimmed || "index.html");
  if (!joined.startsWith(DIST_DIR)) return path.join(DIST_DIR, "index.html");
  try {
    const stats = await fs.stat(joined);
    if (stats.isDirectory()) return path.join(joined, "index.html");
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

const runCheck = async (checks, name, fn) => {
  try {
    const detail = await fn();
    checks.push({ name, pass: true, detail: detail || "" });
    return true;
  } catch (error) {
    checks.push({ name, pass: false, detail: String(error?.message || error) });
    return false;
  }
};

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const port = Math.max(0, Number(process.env.QA_PORT || DEFAULT_PORT));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();

  const server = await startLocalServer({ port });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  await context.addInitScript((firebaseConfig, fixedNowMs) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    const originalDateNow = Date.now.bind(Date);
    const frozenNow = Number(fixedNowMs || 0);
    Date.now = () => (Number.isFinite(frozenNow) && frozenNow > 0 ? frozenNow : originalDateNow());
  }, FIREBASE_RUNTIME_CONFIG, FIXED_QA_HOST_NOW_MS);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });

  const checks = [];
  let failure = null;

  try {
    if (!buildQaHostFixture("run-of-show-console", {
      roomCode: "DEMOAAHF",
      nowMs: FIXED_QA_HOST_NOW_MS,
    })) {
      throw new Error("Could not build host QA fixture.");
    }

    await page.goto(`${server.baseUrl}/?room=DEMOAAHF&qaHostFixture=run-of-show-console`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await delay(1500);

    await runCheck(checks, "host_run_of_show_panel_visible", async () => {
      await page.locator('[aria-label="Run of Show Director"]').waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Run Of Show Director").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "panel visible";
    });

    await runCheck(checks, "host_next_focus_opens_details", async () => {
      const nextItem = page.locator('[data-run-of-show-item-id="perf_next"]').first();
      await nextItem.getByRole("button", { name: /Details/i }).click({ force: true });
      await page.getByLabel("Run of show details for Feature Slot 1").waitFor({ state: "visible", timeout: timeoutMs });
      return "focused next performance";
    });

    await runCheck(checks, "host_media_picker_selects_local_backing", async () => {
      const nextItem = page.locator('[data-run-of-show-item-id="perf_next"]').first();
      const localSourceButton = nextItem.getByRole("button", { name: /Select Local File backing source/i });
      await localSourceButton.waitFor({ state: "visible", timeout: timeoutMs });
      await localSourceButton.click({ force: true });
      await nextItem.locator('[data-run-of-show-open-picker="perf_next"]').click({ force: true });
      await page.locator('[data-run-of-show-media-option-id="local:local_dreams_master"]').waitFor({ state: "visible", timeout: timeoutMs });
      await page.locator('[data-run-of-show-media-option-id="local:local_dreams_master"]').click({ force: true });
      await page.locator('input[value="Dreams (Local Master) - Fleetwood Mac"]').waitFor({ state: "visible", timeout: timeoutMs });
      return "local backing selected through picker";
    });

    await runCheck(checks, "host_pending_submission_controls_visible", async () => {
      await page.locator('[data-run-of-show-item-id="open_slot"]').getByRole("button", { name: /Details/i }).click({ force: true });
      await page.getByText("Pending Submissions").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByRole("button", { name: /^Approve$/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "pending submission controls visible";
    });
  } catch (error) {
    failure = error;
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }

  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }
  if (failure || checks.some((entry) => !entry.pass)) {
    if (failure) console.error(String(failure?.stack || failure?.message || failure));
    process.exitCode = 1;
    return;
  }
  console.log("Host run-of-show console QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
