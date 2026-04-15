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

    await page.goto(`${server.baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=run-of-show-console`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await delay(2500);
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
