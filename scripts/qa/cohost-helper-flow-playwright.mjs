import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  runCheck,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");
const DEFAULT_TIMEOUT_MS = 120000;

const waitForHelperShell = async (page, timeoutMs) => {
  await page.locator('[data-host-helper-shell="true"]').first().waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByText("Co-Host Helper Catalog", { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs });
};

const openHelperCatalogFromLaunchMenu = async (page, timeoutMs) => {
  const launchButton = page
    .locator('[data-host-top-chrome="true"] button')
    .filter({ has: page.locator("i.fa-solid.fa-rocket") })
    .first();
  await launchButton.waitFor({ state: "visible", timeout: timeoutMs });
  await launchButton.click({ force: true });
  const helperButton = page.getByRole("button", { name: /open helper catalog/i }).first();
  await helperButton.waitFor({ state: "visible", timeout: timeoutMs });
  await helperButton.click({ force: true });
  await waitForHelperShell(page, timeoutMs);
};

const main = async () => {
  const timeoutMs = Math.max(45000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });

  const checks = [];
  let failure = null;

  try {
    await page.goto(`${server.baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=run-of-show-console`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});
    await delay(1200);

    await runCheck(checks, "helper_launch_opens_trimmed_shell", async () => {
      await openHelperCatalogFromLaunchMenu(page, timeoutMs);
      const hostChromeVisible = await page.locator('[data-host-top-chrome="true"]').first().isVisible().catch(() => false);
      if (hostChromeVisible) {
        throw new Error("Full host top chrome stayed visible inside helper mode.");
      }
      return "helper launch swaps into the constrained helper shell";
    });

    await runCheck(checks, "helper_search_add_captures_queue_payload", async () => {
      await page.evaluate(() => {
        window.__qaHelperQueueEvents = [];
        window.__qaLastHelperQueuePayload = null;
      });
      const singerSelect = page.locator('[data-host-helper-shell="true"] select').first();
      await singerSelect.waitFor({ state: "visible", timeout: timeoutMs });
      await singerSelect.selectOption({ index: 1 });
      await page.getByText("Adding for Taylor", { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs });

      const searchInput = page.getByPlaceholder("Search song or artist...").first();
      await searchInput.fill("Valerie");
      const resultButton = page.getByRole("button", { name: /Valerie/i }).first();
      await resultButton.waitFor({ state: "visible", timeout: timeoutMs });
      await resultButton.click({ force: true });
      await delay(300);

      const qaPayload = await page.evaluate(() => window.__qaLastHelperQueuePayload || null);
      if (!qaPayload || qaPayload.type !== "helper_queue_add") {
        throw new Error("Helper queue payload was not captured.");
      }
      if (!qaPayload.payload || !qaPayload.payload.songTitle || !/valerie/i.test(String(qaPayload.payload.songTitle))) {
        throw new Error(`Unexpected helper song payload: ${JSON.stringify(qaPayload)}`);
      }
      if (!qaPayload.payload.singerName || qaPayload.payload.singerName !== "Taylor") {
        throw new Error(`Unexpected helper singer payload: ${JSON.stringify(qaPayload)}`);
      }
      if (!qaPayload.payload.singerUid) {
        throw new Error(`Expected helper payload to preserve singerUid: ${JSON.stringify(qaPayload)}`);
      }
      if (!["browse_catalog", "custom", "youtube"].includes(String(qaPayload.payload.trackSource || "").trim())) {
        throw new Error(`Unexpected helper track source: ${JSON.stringify(qaPayload)}`);
      }
      const eventCount = await page.evaluate(() => Array.isArray(window.__qaHelperQueueEvents) ? window.__qaHelperQueueEvents.length : 0);
      if (eventCount !== 1) {
        throw new Error(`Expected exactly one helper queue event, received ${eventCount}.`);
      }
      return `captured ${qaPayload.payload.songTitle} for ${qaPayload.payload.singerName}`;
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
  console.log("Co-host helper flow QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
