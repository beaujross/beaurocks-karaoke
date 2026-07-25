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
const DEFAULT_TIMEOUT_MS = 90000;

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  const checks = [];
  const pageErrors = [];
  let failure = null;

  try {
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });
    await page.goto(
      `${server.baseUrl}/?room=DEMOAUD&qaAudienceFixture=streamlined-browse`,
      { waitUntil: "domcontentloaded", timeout: timeoutMs },
    );
    const singerRoot = page.locator('[data-singer-view="main"]').first();
    const singerReady = await singerRoot
      .waitFor({ state: "visible", timeout: Math.min(timeoutMs, 15000) })
      .then(() => true)
      .catch(() => false);
    if (!singerReady) {
      const bodyText = String(await page.locator("body").innerText().catch(() => ""))
        .replace(/\s+/g, " ")
        .slice(0, 500);
      throw new Error(
        `Real SingerApp fixture did not reach joined main state. url=${page.url()} body=${bodyText || "(empty)"} pageError=${pageErrors[0] || "(none)"}`,
      );
    }
    await delay(500);

    await runCheck(checks, "singer_app_streamlined_shell_confirmed", async () => {
      const shellVariant = await singerRoot.getAttribute("data-singer-shell-variant");
      if (shellVariant !== "streamlined") {
        throw new Error(`Expected real SingerApp streamlined shell, got ${shellVariant || "(empty)"}.`);
      }
      return "real SingerApp fixture reports streamlined shell";
    });

    await runCheck(checks, "singer_app_streamlined_manual_request_reachable", async () => {
      const songsNav = page.locator('[data-feature-id="singer-nav-songs"]:visible').first();
      await songsNav.waitFor({ state: "visible", timeout: timeoutMs });
      const songsSelected = await songsNav.getAttribute("aria-selected");
      if (songsSelected !== "true") {
        throw new Error(`Expected streamlined SONGS/Browse state to be selected; got ${songsSelected || "(empty)"}.`);
      }

      const manualEntry = page.locator('[data-feature-id="singer-manual-request-open"]:visible').first();
      const manualEntryReady = await manualEntry
        .waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) })
        .then(() => true)
        .catch(() => false);
      if (!manualEntryReady) {
        const allManualEntryCount = await page
          .locator('[data-feature-id="singer-manual-request-open"]')
          .count()
          .catch(() => 0);
        const bodyText = String(await page.locator("body").innerText().catch(() => ""))
          .replace(/\s+/g, " ")
          .slice(0, 900);
        throw new Error(
          `Streamlined SONGS did not expose visible Manual entry. allHookCount=${allManualEntryCount} body=${bodyText || "(empty)"}`,
        );
      }
      const manualEntryEnabled = await manualEntry.isEnabled().catch(() => false);
      if (!manualEntryEnabled) {
        throw new Error("Streamlined Manual entry action is visible but disabled in the joined Browse fixture.");
      }
      await manualEntry.click({ force: true });

      const songTitleInput = page
        .locator('[data-feature-id="singer-request-song-title"]:visible')
        .first();
      const composerReady = await songTitleInput
        .waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) })
        .then(() => true)
        .catch(() => false);
      if (!composerReady) {
        const bodyText = String(await page.locator("body").innerText().catch(() => ""))
          .replace(/\s+/g, " ")
          .slice(0, 1200);
        throw new Error(
          `Manual entry action clicked but composer did not open. body=${bodyText || "(empty)"}`,
        );
      }
      await songTitleInput.fill("QA Streamlined Manual Song");
      const value = await songTitleInput.inputValue();
      if (value !== "QA Streamlined Manual Song") {
        throw new Error(`Manual request composer did not retain input; got "${value}".`);
      }
      return "streamlined SONGS opens a writable manual request composer";
    });

    await runCheck(checks, "singer_app_streamlined_tight15_reachable", async () => {
      await page.goto(
        `${server.baseUrl}/?room=DEMOAUD&qaAudienceFixture=streamlined-browse`,
        { waitUntil: "domcontentloaded", timeout: timeoutMs },
      );
      await singerRoot.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 15000) });
      await delay(250);

      const tight15Discovery = page
        .locator('[data-feature-id="audience-tight15-discovery"]:visible')
        .first();
      await tight15Discovery.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) });

      const tight15Nav = page
        .locator('[data-feature-id="audience-tight15-nav"]:visible')
        .first();
      await tight15Nav.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) });
      await tight15Nav.click({ force: true });

      const tight15Library = page
        .locator('[data-feature-id="audience-tight15-library"]:visible')
        .first();
      await tight15Library.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) });

      const accountGate = page
        .locator('[data-feature-id="audience-tight15-account-gate"]:visible')
        .first();
      await accountGate.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) });
      const gateText = String(await accountGate.innerText()).replace(/\s+/g, " ");
      if (!gateText.includes("5,000 PTS")) {
        throw new Error(`Tight 15 account gate did not disclose its reward. text=${gateText}`);
      }
      return "streamlined SONGS reveals Tight 15 and its account-backed save path";
    });

    await runCheck(checks, "singer_app_streamlined_no_page_errors", async () => {
      if (pageErrors.length) throw new Error(pageErrors[0]);
      return "no client-side runtime errors";
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
  console.log("SingerApp streamlined manual-request QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
