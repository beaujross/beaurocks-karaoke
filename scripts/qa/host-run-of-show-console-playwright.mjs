import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildQaHostFixture,
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
} from "./shared/playwrightQa.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");
const DEFAULT_PORT = 0;
const DEFAULT_TIMEOUT_MS = 90000;

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const port = Math.max(0, Number(process.env.QA_PORT || DEFAULT_PORT));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();

  const server = await startStaticDistServer({ distDir: DIST_DIR, port });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  await context.addInitScript((firebaseConfig, fixedNowMs) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    const originalDateNow = Date.now.bind(Date);
    const frozenNow = Number(fixedNowMs || 0);
    Date.now = () => (Number.isFinite(frozenNow) && frozenNow > 0 ? frozenNow : originalDateNow());
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
      await page.locator('[data-host-qa-ready="true"]').waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("SHOW CONVEYOR").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("CONVEYOR STATUS").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "show conveyor surface visible";
    });

    await runCheck(checks, "host_event_profile_branding_loaded", async () => {
      const root = page.locator('[data-host-qa-ready="true"]').first();
      const eventProfile = await root.getAttribute("data-host-qa-event-profile");
      const title = await root.getAttribute("data-host-qa-brand-title");
      const primary = await root.getAttribute("data-host-qa-brand-primary");
      const secondary = await root.getAttribute("data-host-qa-brand-secondary");
      const accent = await root.getAttribute("data-host-qa-brand-accent");
      if (eventProfile !== QA_AAHF_EVENT_PROFILE_ID) throw new Error(`Unexpected event profile: ${eventProfile}`);
      if (title !== QA_AAHF_AUDIENCE_BRAND_THEME.appTitle) throw new Error(`Unexpected audience brand title: ${title}`);
      if (
        primary !== QA_AAHF_AUDIENCE_BRAND_THEME.primaryColor
        || secondary !== QA_AAHF_AUDIENCE_BRAND_THEME.secondaryColor
        || accent !== QA_AAHF_AUDIENCE_BRAND_THEME.accentColor
      ) {
        throw new Error(`Unexpected brand colors: ${primary}, ${secondary}, ${accent}`);
      }
      return "AAHF event profile and audience branding loaded";
    });

    await runCheck(checks, "host_timeline_strip_opens", async () => {
      await page.getByRole("button", { name: /OPEN BOARD/i }).click({ force: true });
      await page.getByRole("button", { name: /COLLAPSE BOARD/i }).waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("CONVEYOR ACTIONS").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("FEATURE SLOT 1").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("AUDIENCE SPOTLIGHT").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "conveyor strip expands with live and on-deck scenes";
    });

    await runCheck(checks, "host_live_adjustments_extend_and_toggle_audio", async () => {
      await page.getByRole("button", { name: /more controls/i }).click({ force: true });
      const panel = page.locator('[data-live-adjustment-panel="true"]').first();
      await panel.waitFor({ state: "visible", timeout: timeoutMs });
      await panel.getByText(/1:30 window/i).waitFor({ state: "visible", timeout: timeoutMs });
      await panel.getByRole("button", { name: /\+30 sec/i }).waitFor({ state: "visible", timeout: timeoutMs });
      await panel.getByRole("button", { name: /pause audio|resume audio/i }).waitFor({ state: "visible", timeout: timeoutMs });
      return "more controls reveals the live adjustment panel";
    });

    await runCheck(checks, "host_compact_timeline_drag_reorders", async () => {
      const dragged = page.locator('[data-compact-timeline-item-id="open_slot"]').first();
      const target = page.locator('[data-compact-timeline-item-id="perf_next"]').first();
      await dragged.dragTo(target, {
        force: true,
        targetPosition: { x: 4, y: 28 },
      });
      await page.waitForFunction(() => {
        const ids = Array.from(document.querySelectorAll('[data-compact-timeline-item-id]'))
          .map((node) => node.getAttribute('data-compact-timeline-item-id'))
          .filter(Boolean)
          .slice(0, 4);
        return ids.join(',') === 'intro_live,open_slot,perf_next,audience_vote';
      }, null, { timeout: timeoutMs });
      return "compact timeline supports drag reorder from the board";
    });

    await runCheck(checks, "host_issue_summary_visible", async () => {
      await page.getByText("OPEN ISSUES").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("1 NEED PERFORMER").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("1 NEED BACKING").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("1 PENDING APPROVALS").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "issue rail reflects current show blockers";
    });

    await runCheck(checks, "host_assignment_rail_fills_empty_slot", async () => {
      await page.getByRole("button", { name: /STOP SHOW/i }).click({ force: true });
      await page.getByRole("button", { name: /^PREFLIGHT$/i }).click({ force: true });
      await page.getByText("Slot Assignment").first().waitFor({ state: "visible", timeout: timeoutMs });
      const fillButton = page.getByRole("button", { name: /Fill Empty Slots/i }).first();
      await fillButton.waitFor({ state: "visible", timeout: timeoutMs });
      await fillButton.click({ force: true });
      return "slot assignment controls are available from preflight";
    });

    await runCheck(checks, "host_no_runtime_page_errors", async () => {
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
  console.log("Host run-of-show console QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
