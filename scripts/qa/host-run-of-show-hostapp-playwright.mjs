import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIXED_QA_HOST_NOW_MS,
  QA_AAHF_AUDIENCE_BRAND_THEME,
  QA_AAHF_EVENT_PROFILE_ID,
} from "../../src/apps/Host/qaHostFixtures.js";
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  runCheck,
  startStaticDistServer,
  waitForAnyVisible,
} from "./shared/playwrightQa.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");
const DEFAULT_TIMEOUT_MS = 120000;

const waitForHostState = async (page, { tab, section, timeoutMs }) => {
  await page.waitForFunction(({ tabValue, sectionValue }) => {
    const root = document.querySelector(".host-app");
    if (!root) return false;
    const activeTab = String(root.getAttribute("data-host-active-tab") || "").trim();
    const activeSection = String(root.getAttribute("data-host-active-workspace-section") || "").trim();
    if (tabValue && activeTab !== tabValue) return false;
    if (sectionValue && activeSection !== sectionValue) return false;
    return true;
  }, { tabValue: tab || "", sectionValue: section || "" }, { timeout: timeoutMs });
};

const clickHostTab = async (page, tabKey, timeoutMs) => {
  const button = page.locator(`[data-host-tab="${tabKey}"]`).first();
  await button.waitFor({ state: "visible", timeout: timeoutMs });
  await button.click({ force: true });
};

const ensureShowWorkspace = async (page, timeoutMs) => {
  await clickHostTab(page, "run_of_show", timeoutMs);
  await waitForHostState(page, { tab: "run_of_show", timeoutMs });
  await page.getByText("Run Of Show Board").first().waitFor({ state: "visible", timeout: timeoutMs });
};

const ensureStageWorkspace = async (page, timeoutMs) => {
  await clickHostTab(page, "stage", timeoutMs);
  await waitForHostState(page, { tab: "stage", timeoutMs });
  await page.getByText("Live Stage").first().waitFor({ state: "visible", timeout: timeoutMs });
};

const gotoHostFixture = async (page, server, fixtureId, timeoutMs) => {
  await page.goto(`${server.baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=${encodeURIComponent(fixtureId)}`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await delay(2500);
};

const ensureDetailsSectionOpen = async (page, label) => {
  const details = page.locator("details").filter({
    has: page.getByText(label, { exact: false }),
  }).first();
  if (!(await details.count())) return false;
  await details.evaluate((node) => {
    node.open = true;
  }).catch(() => {});
  const summary = details.locator("summary").first();
  if (await summary.isVisible().catch(() => false)) {
    await summary.scrollIntoViewIfNeeded().catch(() => {});
  }
  return true;
};

const ensureAdminRoomSetup = async (page, timeoutMs) => {
  await clickHostTab(page, "admin", timeoutMs);
  await waitForHostState(page, { tab: "admin", section: "ops.room_setup", timeoutMs });
  await ensureDetailsSectionOpen(page, "Night Profiles");
  await ensureDetailsSectionOpen(page, "Guest Flow + Audience Settings");
  await waitForAnyVisible([
    page.getByText("Event profiles").first(),
    page.locator(`[data-host-event-profile="${QA_AAHF_EVENT_PROFILE_ID}"]`).first(),
    page.locator('[data-host-audience-brand-title]').first(),
  ], timeoutMs);
};

const main = async () => {
  const timeoutMs = Math.max(45000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  await context.addInitScript((firebaseConfig, fixedNowMs) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    const originalDateNow = Date.now.bind(Date);
    Date.now = () => (Number.isFinite(fixedNowMs) && fixedNowMs > 0 ? fixedNowMs : originalDateNow());
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG, FIXED_QA_HOST_NOW_MS);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });

  const checks = [];
  let failure = null;
  const pageErrors = [];

  try {
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });

    await gotoHostFixture(page, server, "run-of-show-console", timeoutMs);
    await ensureShowWorkspace(page, timeoutMs);

    await runCheck(checks, "host_app_fixture_loaded", async () => {
      await page.getByText("Run Of Show Board").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Show Status").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Feature Slot 1").first().waitFor({ state: "visible", timeout: timeoutMs });
      await waitForAnyVisible([
        page.getByText("Open Issues").first(),
        page.getByText("Fix Issue").first(),
        page.getByText("Issue Rail").first(),
      ], timeoutMs);
      return "run-of-show show workspace loaded";
    });

    await runCheck(checks, "host_app_run_of_show_board_visible", async () => {
      await ensureShowWorkspace(page, timeoutMs);
      const boardToggle = await waitForAnyVisible([
        page.getByRole("button", { name: /Open Board/i }).first(),
        page.getByRole("button", { name: /Collapse Board/i }).first(),
      ], timeoutMs);
      const toggleName = await boardToggle.textContent();
      if (/open board/i.test(String(toggleName || ""))) {
        await boardToggle.click({ force: true });
      }
      await page.getByText("Timeline Actions").first().waitFor({ state: "visible", timeout: timeoutMs });
      await waitForAnyVisible([
        page.getByText("Issue Rail").first(),
        page.getByText("Open Issues").first(),
      ], timeoutMs);
      await page.getByText("Audience Spotlight").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "board controls and issue rail rendered";
    });

    await runCheck(checks, "host_app_sequence_tools_tray_visible", async () => {
      await ensureShowWorkspace(page, timeoutMs);
      const buildButton = page.getByRole("button", { name: /^BUILD$/i }).first();
      await buildButton.waitFor({ state: "visible", timeout: timeoutMs });
      await buildButton.click({ force: true });
      await page.getByText("Sequence Tools").first().waitFor({ state: "visible", timeout: timeoutMs });
      const trayToggle = page.getByRole("button", { name: /Hide Sequence Tools|Open Sequence Tools/i }).first();
      await trayToggle.waitFor({ state: "visible", timeout: timeoutMs });
      return "build workspace exposes the collapsible sequence tools tray";
    });

    await runCheck(checks, "host_app_audio_dropdown_and_quick_volume_controls_visible", async () => {
      await ensureStageWorkspace(page, timeoutMs);
      const audioToggle = page.locator('[data-feature-id="deck-audio-menu-toggle"]').first();
      await audioToggle.waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText(/^Stage$/).first().waitFor({ state: "visible", timeout: timeoutMs });
      await audioToggle.click({ force: true });
      await page.getByText("Audio + Mix").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText(/Keep stage backing, room music, and the blend in one place\./i).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "audio quick controls stay visible and the dropdown reveals the full mix panel";
    });

    await runCheck(checks, "host_app_default_bg_track_is_lantern_circuit", async () => {
      await ensureStageWorkspace(page, timeoutMs);
      const audioToggle = page.locator('[data-feature-id="deck-audio-menu-toggle"]').first();
      await audioToggle.waitFor({ state: "visible", timeout: timeoutMs });
      if (!(await page.getByText("Audio + Mix").first().isVisible().catch(() => false))) {
        await audioToggle.click({ force: true });
      }
      await page.getByText("Lantern Circuit").first().waitFor({ state: "visible", timeout: timeoutMs });
      const assetStatus = await page.evaluate(async () => {
        const response = await fetch("/audio/Lantern%20Circuit.mp3", { method: "HEAD" });
        return {
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get("content-type") || "",
        };
      });
      if (!assetStatus.ok) {
        throw new Error(`Lantern Circuit audio asset was not fetchable: ${assetStatus.status}`);
      }
      if (!/audio|mpeg|octet-stream/i.test(assetStatus.contentType)) {
        throw new Error(`Unexpected Lantern Circuit content type: ${assetStatus.contentType}`);
      }
      return "Lantern Circuit is the first host background track and its audio asset is served";
    });

    await runCheck(checks, "host_app_launch_catalogue_routes_to_queue_catalog", async () => {
      await ensureStageWorkspace(page, timeoutMs);
      const launchToggle = page.locator('button').filter({ has: page.locator('.fa-rocket') }).first();
      await launchToggle.waitFor({ state: "visible", timeout: timeoutMs });
      await page.evaluate(() => {
        window.__qaLastLaunchTarget = "";
        window.open = ((url) => {
          window.__qaLastLaunchTarget = String(url || "");
          return null;
        });
      });
      await launchToggle.click({ force: true });
      const launchCatalogueButton = page.getByRole("button", { name: /Launch Catalogue/i }).first();
      await launchCatalogueButton.waitFor({ state: "visible", timeout: timeoutMs });
      await launchCatalogueButton.click({ force: true });
      const launchTarget = await page.evaluate(() => String(window.__qaLastLaunchTarget || ""));
      if (!launchTarget) throw new Error("Launch Catalogue did not call window.open.");
      const parsed = new URL(launchTarget, page.url());
      if (parsed.searchParams.get("mode") !== "host") throw new Error(`Unexpected launch mode: ${parsed.toString()}`);
      if (parsed.searchParams.get("view") !== "queue") throw new Error(`Unexpected launch view: ${parsed.toString()}`);
      if (parsed.searchParams.get("section") !== "queue.catalog") throw new Error(`Unexpected launch section: ${parsed.toString()}`);
      return "launch menu opens the queue catalog workspace";
    });

    await runCheck(checks, "host_app_stage_timing_uses_pace_slider_with_advanced_toggle", async () => {
      await gotoHostFixture(page, server, "run-of-show-stage-live", timeoutMs);
      await ensureStageWorkspace(page, timeoutMs);
      await page.getByText("Post-Performance Timing").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Post-song Timing").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.locator(".post-performance-timing-slider").first().waitFor({ state: "visible", timeout: timeoutMs });
      const customizeButton = page.getByRole("button", { name: /Customize Timing/i }).first();
      await customizeButton.waitFor({ state: "visible", timeout: timeoutMs });
      await customizeButton.click({ force: true });
      await page.getByText("Leaderboard beat").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "stage timing exposes the pace slider with optional advanced controls";
    });

    await gotoHostFixture(page, server, "run-of-show-console", timeoutMs);
    await ensureAdminRoomSetup(page, timeoutMs);

    await runCheck(checks, "host_app_event_profile_active", async () => {
      await ensureAdminRoomSetup(page, timeoutMs);
      const activeProfile = page.locator(`[data-host-event-profile="${QA_AAHF_EVENT_PROFILE_ID}"][data-host-event-profile-active="true"]`).first();
      await activeProfile.waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Event profiles").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "AAHF event profile is active in room setup";
    });

    await runCheck(checks, "host_app_audience_branding_controls_loaded", async () => {
      await ensureAdminRoomSetup(page, timeoutMs);
      await page.locator('[data-host-audience-brand-title]').waitFor({ state: "visible", timeout: timeoutMs });
      const title = await page.locator('[data-host-audience-brand-title]').inputValue();
      const primary = await page.locator('[data-host-audience-brand-hex="primaryColor"]').inputValue();
      const secondary = await page.locator('[data-host-audience-brand-hex="secondaryColor"]').inputValue();
      const accent = await page.locator('[data-host-audience-brand-hex="accentColor"]').inputValue();
      if (title !== QA_AAHF_AUDIENCE_BRAND_THEME.appTitle) throw new Error(`Unexpected audience brand title: ${title}`);
      if (
        primary !== QA_AAHF_AUDIENCE_BRAND_THEME.primaryColor
        || secondary !== QA_AAHF_AUDIENCE_BRAND_THEME.secondaryColor
        || accent !== QA_AAHF_AUDIENCE_BRAND_THEME.accentColor
      ) {
        throw new Error(`Unexpected audience brand colors: ${primary}, ${secondary}, ${accent}`);
      }
      return "audience branding fields show AAHF room colors";
    });

    await runCheck(checks, "host_app_no_page_errors", async () => {
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
  console.log("Host run-of-show HostApp QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
