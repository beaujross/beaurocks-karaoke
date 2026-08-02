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
const EXPECTED_DEMO_FIXTURE_AUTH_ERROR = /(?:FirebaseError:\s*)?Sign in required\.?/i;

const isExpectedDemoFixturePageError = (errorText = "") => (
  EXPECTED_DEMO_FIXTURE_AUTH_ERROR.test(String(errorText || ""))
);

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
  const button = page.locator(`[data-host-tab="${tabKey}"]:visible`).first();
  await button.waitFor({ state: "visible", timeout: timeoutMs });
  await button.click({ timeout: timeoutMs });
};

const ensureShowWorkspace = async (page, timeoutMs) => {
  const onStage = await waitForHostState(page, {
    tab: "stage",
    timeoutMs: Math.min(5000, timeoutMs),
  }).then(() => true).catch(() => false);
  if (!onStage) {
    await clickHostTab(page, "stage", timeoutMs);
    await waitForHostState(page, { tab: "stage", timeoutMs });
  }
  const momentPrepTab = page.locator(
    '[data-feature-id="queue-surface-tab-show-desktop"]:visible, [data-feature-id="queue-surface-tab-show"]:visible',
  ).first();
  await momentPrepTab.waitFor({ state: "visible", timeout: timeoutMs });
  await momentPrepTab.click({ force: true, timeout: timeoutMs });
  await page.locator('[data-feature-id="host-moment-prep-workbench"]').first().waitFor({ state: "visible", timeout: timeoutMs });
  const detailedPlanner = page.locator('[data-feature-id="moment-prep-full-director"]').first();
  await detailedPlanner.waitFor({ state: "visible", timeout: timeoutMs });
  const detailsOpen = await detailedPlanner.evaluate((node) => node.open === true).catch(() => false);
  if (!detailsOpen) {
    await detailedPlanner.locator('summary').first().click({ force: true, timeout: timeoutMs });
  }
  await page.locator('[data-run-of-show-director-surface="true"]').first().waitFor({ state: "visible", timeout: timeoutMs });
};

const ensureStageWorkspace = async (page, timeoutMs) => {
  const currentTab = await page.locator(".host-app").first().getAttribute("data-host-active-tab");
  if (String(currentTab || "").trim() === "admin") {
    const openQueueWorkspace = page.getByRole("button", { name: /Open Queue Workspace/i }).first();
    await openQueueWorkspace.waitFor({ state: "visible", timeout: timeoutMs });
    await openQueueWorkspace.click({ timeout: timeoutMs });
  } else {
    await clickHostTab(page, "stage", timeoutMs);
  }
  try {
    await waitForHostState(page, { tab: "stage", timeoutMs });
  } catch (error) {
    const state = await page.evaluate(() => {
      const root = document.querySelector(".host-app");
      return {
        tab: String(root?.getAttribute("data-host-active-tab") || ""),
        section: String(root?.getAttribute("data-host-active-workspace-section") || ""),
        visibleStageButtons: Array.from(document.querySelectorAll('[data-host-tab="stage"]'))
          .filter((node) => {
            const style = window.getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden";
          })
          .map((node) => String(node.textContent || "").replace(/\s+/g, " ").trim()),
      };
    }).catch(() => ({}));
    throw new Error(`Stage navigation did not settle: ${JSON.stringify(state)}; ${String(error?.message || error)}`);
  }
  try {
    await waitForAnyVisible([
      page.locator('[data-feature-id="queue-workspace-top-chrome"]').first(),
      page.locator('[data-feature-id="queue-surface-tab-queue-desktop"]').first(),
      page.getByText("Tonight's Lineup", { exact: true }).first(),
    ], timeoutMs);
  } catch (error) {
    const state = await page.evaluate(() => {
      const root = document.querySelector(".host-app");
      const runtime = document.querySelector('[data-host-queue-runtime="mounted"]');
      return {
        tab: String(root?.getAttribute("data-host-active-tab") || ""),
        section: String(root?.getAttribute("data-host-active-workspace-section") || ""),
        runtimeClass: String(runtime?.getAttribute("class") || ""),
        runtimeHidden: String(runtime?.getAttribute("aria-hidden") || ""),
        visibleText: String(runtime?.innerText || "").replace(/\s+/g, " ").slice(0, 700),
      };
    }).catch(() => ({}));
    throw new Error(`Stage workspace controls missing: ${JSON.stringify(state)}; ${String(error?.message || error)}`);
  }
};

const ensureStageQueueWorkspace = async (page, timeoutMs) => {
  await ensureStageWorkspace(page, timeoutMs);
  const queueSurfaceTab = page.locator('[data-feature-id="queue-surface-tab-queue-desktop"]').first();
  if (await queueSurfaceTab.isVisible().catch(() => false)) {
    await queueSurfaceTab.click({ force: true, timeout: timeoutMs });
  }
};

const ensureLobbyWorkspace = async (page, timeoutMs) => {
  await clickHostTab(page, "lobby", timeoutMs);
  await waitForHostState(page, { tab: "lobby", timeoutMs });
  await page.getByText("Lobby Lineup").first().waitFor({ state: "visible", timeout: timeoutMs });
};

const gotoHostFixture = async (page, server, fixtureId, timeoutMs) => {
  const params = new URLSearchParams({
    mode: "host",
    room: "DEMOAAHF",
    mkDemoEmbed: "1",
    qaHostFixture: fixtureId,
    hostUiVersion: "v2",
    view: "queue",
    section: "queue.live_run",
    tab: "stage",
  });
  await page.goto(`${server.baseUrl}/?${params.toString()}`, {
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
  const alreadyInRoomSetup = await waitForHostState(page, {
    tab: "admin",
    section: "ops.room_setup",
    timeoutMs: Math.min(3000, timeoutMs),
  }).then(() => true).catch(() => false);
  if (!alreadyInRoomSetup) {
    await clickHostTab(page, "admin", timeoutMs);
    await waitForHostState(page, { tab: "admin", section: "ops.room_setup", timeoutMs });
  }
  await ensureDetailsSectionOpen(page, "Night Profiles");
  await ensureDetailsSectionOpen(page, "Guest Flow + Audience Settings");
  await waitForAnyVisible([
    page.getByText("Event profiles").first(),
    page.locator(`[data-host-event-profile="${QA_AAHF_EVENT_PROFILE_ID}"]`).first(),
    page.locator('[data-host-audience-brand-title]').first(),
  ], timeoutMs);
};

const ensureAdminMediaWorkspace = async (page, timeoutMs) => {
  await ensureAdminRoomSetup(page, timeoutMs);
  const settingsSearch = page.locator('[data-admin-settings-search="true"] input:visible').first();
  await settingsSearch.waitFor({ state: "visible", timeout: timeoutMs });
  await settingsSearch.fill("Screens");
  const mediaButton = page.getByRole("button", { name: /Screens \+ Playback/i }).first();
  await mediaButton.waitFor({ state: "visible", timeout: timeoutMs });
  await mediaButton.click({ force: true, timeout: timeoutMs });
  await page.locator('[data-admin-active-section-title]').filter({ hasText: "Screens + Playback" }).first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  await page.getByText("Room Uploads").last().waitFor({ state: "visible", timeout: timeoutMs });
};

const getTrackedAnalyticsEvents = async (page) => page.evaluate(() => (
  Array.isArray(window.__beaurocksTrackedEvents)
    ? window.__beaurocksTrackedEvents.map((entry) => ({
      name: String(entry?.name || ""),
      params: entry?.params && typeof entry.params === "object" ? { ...entry.params } : {},
    }))
    : []
));

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
  page.setDefaultTimeout(timeoutMs);
  await page.emulateMedia({ reducedMotion: "reduce" });

  const checks = [];
  let failure = null;
  const pageErrors = [];

  try {
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });

    await gotoHostFixture(page, server, "run-of-show-console", timeoutMs);
    const initialRouteState = await page.evaluate(() => {
      const root = document.querySelector(".host-app");
      return {
        tab: String(root?.getAttribute("data-host-active-tab") || ""),
        section: String(root?.getAttribute("data-host-active-workspace-section") || ""),
      };
    });
    console.log(`Host QA initial route: tab=${initialRouteState.tab || "missing"}, section=${initialRouteState.section || "missing"}`);
    await ensureShowWorkspace(page, timeoutMs);

    await runCheck(checks, "host_app_fixture_loaded", async () => {
      await page.locator('[data-run-of-show-director-surface="true"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.locator('[data-feature-id="moment-prep-timeline"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.locator('[data-feature-id="moment-prep-builder"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      return "Moment Prep workspace loaded with Timeline and Quick Moment Builder";
    });

    await runCheck(checks, "host_app_run_of_show_board_visible", async () => {
      await ensureShowWorkspace(page, timeoutMs);
      await page.locator('[data-feature-id="moment-prep-live-handoff"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.locator('[data-feature-id="moment-prep-full-director"][open]').first().waitFor({ state: "visible", timeout: timeoutMs });
      return "Moment Prep exposes the live handoff and detailed Show Plan in one workspace";
    });

    await runCheck(checks, "host_app_sequence_tools_tray_visible", async () => {
      await ensureShowWorkspace(page, timeoutMs);
      await page.locator('[data-feature-id="moment-prep-builder"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.locator('[data-moment-prep-template]').first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.locator('[data-feature-id="moment-prep-prepared-hopper"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      return "Quick Moment Builder and Prepared Moments are visible without a separate Build tray";
    });

    await runCheck(checks, "host_app_audio_dropdown_and_quick_volume_controls_visible", async () => {
      await ensureStageWorkspace(page, timeoutMs);
      const audioToggle = page.locator('[data-feature-id="deck-audio-menu-toggle"]').first();
      await audioToggle.waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText(/^Stage$/).first().waitFor({ state: "visible", timeout: timeoutMs });
      await audioToggle.click({ force: true, timeout: timeoutMs });
      await page.getByText("Audio + Mix").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText(/Keep stage backing, room music, and the blend in one place\./i).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "audio quick controls stay visible and the dropdown reveals the full mix panel";
    });

    await runCheck(checks, "host_app_default_bg_track_is_lantern_circuit", async () => {
      await ensureStageWorkspace(page, timeoutMs);
      const audioToggle = page.locator('[data-feature-id="deck-audio-menu-toggle"]').first();
      await audioToggle.waitFor({ state: "visible", timeout: timeoutMs });
      if (!(await page.getByText("Audio + Mix").first().isVisible().catch(() => false))) {
        await audioToggle.click({ force: true, timeout: timeoutMs });
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

    await runCheck(checks, "host_app_stage_workspace_core_controls_visible", async () => {
      await ensureStageWorkspace(page, timeoutMs);
      await page.locator('[data-feature-id="queue-surface-tab-queue-desktop"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.locator('[data-feature-id="queue-surface-tab-add-desktop"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.locator('[data-feature-id="queue-surface-tab-catalog-desktop"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      return "stage workspace exposes the live queue, add, and catalog rails";
    });

    await runCheck(checks, "host_app_stage_timing_controls_visible", async () => {
      await gotoHostFixture(page, server, "run-of-show-stage-live", timeoutMs);
      await ensureStageWorkspace(page, timeoutMs);
      await page.getByText("Now Performing").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Current Performance").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Applause").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "stage workspace exposes the current performance and applause controls during a live performance";
    });

    await runCheck(checks, "host_app_lobby_can_promote_and_remove_cohost", async () => {
      await gotoHostFixture(page, server, "run-of-show-console", timeoutMs);
      await ensureLobbyWorkspace(page, timeoutMs);
      const lineupButton = page.getByRole("button", { name: /Taylor/i }).first();
      await lineupButton.waitFor({ state: "visible", timeout: timeoutMs });
      await lineupButton.click({ force: true, timeout: timeoutMs });

      const selectedStrip = page.locator("div").filter({
        has: page.getByText(/Selected:\s*Taylor/i).first(),
      }).first();
      await selectedStrip.waitFor({ state: "visible", timeout: timeoutMs });

      const makeCoHostButton = selectedStrip.getByRole("button", { name: /Make Co-Host/i }).first();
      await makeCoHostButton.waitFor({ state: "visible", timeout: timeoutMs });
      await makeCoHostButton.click({ force: true, timeout: timeoutMs });

      const removeCoHostButton = selectedStrip.getByRole("button", { name: /Remove Co-Host/i }).first();
      await removeCoHostButton.waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("CO-HOST", { exact: true }).first().waitFor({ state: "visible", timeout: timeoutMs });

      await removeCoHostButton.click({ force: true, timeout: timeoutMs });
      await selectedStrip.getByRole("button", { name: /Make Co-Host/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "lobby audience selection can promote and remove a co-host";
    });

    await runCheck(checks, "host_app_lobby_can_add_and_remove_commentator", async () => {
      await gotoHostFixture(page, server, "run-of-show-console", timeoutMs);
      await ensureLobbyWorkspace(page, timeoutMs);
      const lineupButton = page.getByRole("button", { name: /Taylor/i }).first();
      await lineupButton.waitFor({ state: "visible", timeout: timeoutMs });
      await lineupButton.click({ force: true, timeout: timeoutMs });

      const selectedStrip = page.locator("div").filter({
        has: page.getByText(/Selected:\s*Taylor/i).first(),
      }).first();
      await selectedStrip.waitFor({ state: "visible", timeout: timeoutMs });

      const addToRowButton = selectedStrip.getByRole("button", { name: /ADD TO COMMENTATOR ROW/i }).first();
      await addToRowButton.waitFor({ state: "visible", timeout: timeoutMs });
      await addToRowButton.click({ force: true, timeout: timeoutMs });

      const removeFromRowButton = selectedStrip.getByRole("button", { name: /REMOVE FROM COMMENTATOR ROW/i }).first();
      await removeFromRowButton.waitFor({ state: "visible", timeout: timeoutMs });
      await removeFromRowButton.click({ force: true, timeout: timeoutMs });
      await selectedStrip.getByRole("button", { name: /ADD TO COMMENTATOR ROW/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "lobby audience selection can add and remove a commentator-row guest";
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

    await runCheck(checks, "host_app_room_setup_save_action_visible", async () => {
      await ensureAdminRoomSetup(page, timeoutMs);
      await page.getByRole("button", { name: /Save Room Settings/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "admin room setup exposes the save action";
    });

    await runCheck(checks, "host_app_room_closeout_control_reachable", async () => {
      await ensureAdminRoomSetup(page, timeoutMs);
      const closeButton = page.locator("[data-host-close-room-recap]").first();
      const containingDisclosure = page.locator("details").filter({ has: closeButton }).first();
      await containingDisclosure.evaluate((node) => {
        node.open = true;
      });
      await page.locator("[data-host-close-room-recap]:visible").first().waitFor({
        state: "visible",
        timeout: timeoutMs,
      });
      return "admin room setup exposes room closeout after opening its disclosure";
    });

    await runCheck(checks, "host_app_room_upload_handoff_controls_visible", async () => {
      await ensureAdminMediaWorkspace(page, timeoutMs);
      const uploadRow = page.locator("div").filter({
        hasText: "Festival Break Card",
      }).filter({
        has: page.getByRole("button", { name: /Use In Show Plan/i }).first(),
      }).first();
      await uploadRow.waitFor({ state: "visible", timeout: timeoutMs });
      await uploadRow.getByRole("button", { name: /TV Library/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
      await uploadRow.getByRole("button", { name: /Use In Show Plan/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "room uploads expose the TV library and run-of-show handoff controls for shared visual media";
    });

    await runCheck(checks, "host_app_stage_tv_library_modal_opens", async () => {
      await ensureStageQueueWorkspace(page, timeoutMs);
      const scenesToggle = page.locator('[data-feature-id="deck-scenes-menu-toggle"]').first();
      await scenesToggle.waitFor({ state: "visible", timeout: timeoutMs });
      await scenesToggle.click({ force: true, timeout: timeoutMs });
      const openLibrary = page.getByRole("button", { name: /Open Media Library/i }).first();
      await openLibrary.waitFor({ state: "visible", timeout: timeoutMs });
      await openLibrary.click({ force: true, timeout: timeoutMs });
      await page.locator('[data-feature-id="tv-moments-library-modal"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Festival Break Card").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "stage workspace opens the TV media library and renders saved scene labels";
    });

    await runCheck(checks, "host_app_reload_restores_host_workspace", async () => {
      await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(2500);
      await ensureShowWorkspace(page, timeoutMs);
      await page.locator('[data-run-of-show-director-surface="true"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      return "fixture reload restores the host workspace without a runtime crash";
    });

    await runCheck(checks, "host_app_operator_analytics_emitted", async () => {
      const events = await getTrackedAnalyticsEvents(page);
      const names = new Set(events.map((entry) => entry.name));
      if (!names.has("host_workspace_viewed")) {
        throw new Error("Missing analytics event: host_workspace_viewed");
      }
      const workspaceViews = events.filter((entry) => entry.name === "host_workspace_viewed");
      if (!workspaceViews.length) {
        throw new Error("No host workspace analytics payloads were captured.");
      }
      return "host operator analytics fired for the host workspace surface";
    });

    await runCheck(checks, "host_app_no_page_errors", async () => {
      const unexpectedPageErrors = pageErrors.filter((errorText) => !isExpectedDemoFixturePageError(errorText));
      if (unexpectedPageErrors.length) throw new Error(unexpectedPageErrors[0]);
      return pageErrors.length
        ? `no unexpected client-side runtime errors (${pageErrors.length} fixture auth write error(s) ignored)`
        : "no client-side runtime errors";
    });
  } catch (error) {
    failure = error;
    console.error(`Host QA failed before teardown: ${String(error?.stack || error?.message || error)}`);
  } finally {
    await Promise.race([context.close().catch(() => {}), delay(5000)]);
    await Promise.race([browser.close().catch(() => {}), delay(5000)]);
    await Promise.race([server.stop().catch(() => {}), delay(5000)]);
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
