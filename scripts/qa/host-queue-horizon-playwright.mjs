import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIXED_QA_HOST_NOW_MS } from "../../src/apps/Host/qaHostFixtures.js";
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
const EXPECTED_FIXTURE_AUTH_ERROR = /(?:FirebaseError:\s*)?Sign in required\.?/i;

const gotoFixture = async (page, baseUrl, timeoutMs, fixtureId = "run-of-show-console") => {
  await page.goto(
    `${baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=${encodeURIComponent(fixtureId)}&hostUiVersion=v2&view=show&section=show.timeline&tab=run_of_show`,
    { waitUntil: "domcontentloaded", timeout: timeoutMs },
  );
  await page.waitForLoadState("networkidle", { timeout: Math.min(5000, timeoutMs) }).catch(() => {});
  await page.locator('[data-feature-id="host-queue-horizon"]').first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  await delay(500);
};

const expectHorizonVisible = async (page, label) => {
  const horizon = page.locator('[data-feature-id="host-queue-horizon"]').first();
  if (!(await horizon.isVisible().catch(() => false))) {
    throw new Error(`Horizon Queue disappeared in ${label}.`);
  }
  const box = await horizon.boundingBox();
  if (!box || box.height < 52 || box.height > 100) {
    throw new Error(`Unexpected Horizon Queue height in ${label}: ${JSON.stringify(box)}`);
  }
  return box;
};

const openHostTab = async (page, tabKey, timeoutMs) => {
  const currentTab = await page.locator(".host-app").first().getAttribute("data-host-active-tab").catch(() => "");
  let button;
  if (tabKey === "stage" && currentTab === "admin") {
    button = page.getByRole("button", { name: /Open Queue Workspace/i }).first();
  } else if (tabKey === "stage") {
    button = page.getByRole("button", { name: /Open Live Queue/i }).first();
  } else {
    button = page.locator(`[data-host-tab="${tabKey}"]:visible`).first();
  }
  await button.waitFor({ state: "visible", timeout: timeoutMs });
  await button.click({ force: true, timeout: timeoutMs });
  if (tabKey === "stage") await delay(250);
  try {
    await page.waitForFunction((expectedTab) => {
      const root = document.querySelector(".host-app");
      return String(root?.getAttribute("data-host-active-tab") || "") === expectedTab;
    }, tabKey, { timeout: Math.min(10000, timeoutMs) });
  } catch (error) {
    const actualTab = await page.locator(".host-app").first().getAttribute("data-host-active-tab").catch(() => "");
    throw new Error(
      `Host tab did not settle on ${tabKey}; actual tab was ${actualTab || "unknown"}. ${String(error?.message || error)}`,
    );
  }
};

const main = async () => {
  const timeoutMs = Math.max(45000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const checks = [];
  const pageErrors = [];
  let failure = null;

  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await desktop.addInitScript((firebaseConfig) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
    await desktop.addInitScript((fixedNowMs) => {
      const originalDateNow = Date.now.bind(Date);
      Date.now = () => fixedNowMs || originalDateNow();
    }, FIXED_QA_HOST_NOW_MS);
    const page = await desktop.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoFixture(page, server.baseUrl, timeoutMs);

    await runCheck(checks, "horizon_uses_runtime_contract", async () => {
      const text = String(await page.locator('[data-feature-id="host-queue-horizon"]').innerText()).replace(/\s+/g, " ").trim();
      if (!/(On Deck|Next|Start)/i.test(text)) {
        throw new Error(`Horizon does not expose the immediate runtime sequence: ${text}`);
      }
      if (!/(Manual|Auto-DJ)/i.test(text)) {
        throw new Error(`Horizon does not expose queue pacing: ${text}`);
      }
      return text.slice(0, 220);
    });

    await runCheck(checks, "horizon_persists_across_host_workspaces", async () => {
      const tabs = [
        ["stage", "Queue"],
        ["run_of_show", "Show/Planner"],
        ["games", "Games"],
        ["lobby", "Audience"],
        ["admin", "Admin"],
      ];
      for (const [tabKey, label] of tabs) {
        await openHostTab(page, tabKey, timeoutMs);
        await expectHorizonVisible(page, label);
      }
      return "visible in Queue, Show/Planner, Games, Audience, and Admin";
    });

    await runCheck(checks, "horizon_planner_object_opens_planner", async () => {
      await gotoFixture(page, server.baseUrl, timeoutMs);
      await openHostTab(page, "games", timeoutMs);
      const plannedPerformance = page.locator(
        '[data-feature-id="host-queue-horizon"] button[aria-label*="Alex Rivers"]:visible',
      ).first();
      await plannedPerformance.waitFor({ state: "visible", timeout: timeoutMs });
      await plannedPerformance.click({ force: true });
      await page.waitForFunction(() => (
        document.querySelector(".host-app")?.getAttribute("data-host-active-tab") === "run_of_show"
      ), null, { timeout: timeoutMs });
      return "planned performance returns to the focused Show/Planner workspace";
    });

    await runCheck(checks, "horizon_singer_opens_selected_queue_entry", async () => {
      await gotoFixture(page, server.baseUrl, timeoutMs, "cohost-queue-faceoff");
      const singerButton = page.locator(
        '[data-feature-id="host-queue-horizon"] button[aria-label*="Jordan"]',
      ).first();
      await singerButton.waitFor({ state: "visible", timeout: timeoutMs });
      await singerButton.click({ force: true });
      const selectedRow = page.locator('[data-queue-id="queue_1"][data-queue-selected="true"]').first();
      await selectedRow.waitFor({ state: "visible", timeout: timeoutMs });
      return "Jordan opens in Live Queue as the selected performance";
    });

    await runCheck(checks, "horizon_on_stage_focuses_transport", async () => {
      const onStage = page.locator(
        '[data-feature-id="host-queue-horizon"] button[aria-label^="On Stage:"]',
      ).first();
      await onStage.waitFor({ state: "visible", timeout: timeoutMs });
      await onStage.click({ force: true });
      await page.locator('[data-feature-id="host-unified-stage-transport"]').first().waitFor({
        state: "visible",
        timeout: timeoutMs,
      });
      return "On Stage opens the current-performance transport";
    });

    await runCheck(checks, "horizon_attention_opens_inbox", async () => {
      const attention = page.locator(
        '[data-feature-id="host-queue-horizon"] button[aria-label*="need attention" i]',
      ).first();
      await attention.waitFor({ state: "visible", timeout: timeoutMs });
      await attention.click({ force: true });
      await page.locator('[data-feature-id="panel-inbox"]').first().waitFor({
        state: "visible",
        timeout: timeoutMs,
      });
      return "attention opens the Host Inbox workspace";
    });

    await runCheck(checks, "horizon_automation_toggle_is_direct", async () => {
      const automation = page.locator(
        '[data-feature-id="host-queue-horizon"] button[aria-label^="Turn Auto-DJ"]',
      ).first();
      await automation.waitFor({ state: "visible", timeout: timeoutMs });
      const before = await automation.getAttribute("aria-label");
      await automation.click({ force: true });
      await page.waitForFunction((previousLabel) => {
        const control = document.querySelector('[data-feature-id="host-queue-horizon"] button[aria-label^="Turn Auto-DJ"]');
        return control && control.getAttribute("aria-label") !== previousLabel;
      }, before, { timeout: timeoutMs });
      const after = await automation.getAttribute("aria-label");
      return `${before} → ${after}`;
    });

    await runCheck(checks, "horizon_controls_keep_accessible_targets", async () => {
      const undersized = await page.locator('[data-feature-id="host-queue-horizon"] button:visible').evaluateAll((buttons) => (
        buttons
          .map((button) => {
            const rect = button.getBoundingClientRect();
            return {
              label: String(button.getAttribute("aria-label") || button.textContent || "").replace(/\s+/g, " ").trim(),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          })
          .filter((entry) => entry.height < 44)
      ));
      if (undersized.length) {
        throw new Error(`Undersized Horizon controls: ${JSON.stringify(undersized)}`);
      }
      return "all visible Horizon controls are at least 44px tall";
    });

    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await mobile.addInitScript((firebaseConfig) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
    await mobile.addInitScript((fixedNowMs) => {
      const originalDateNow = Date.now.bind(Date);
      Date.now = () => fixedNowMs || originalDateNow();
    }, FIXED_QA_HOST_NOW_MS);
    const mobilePage = await mobile.newPage();
    mobilePage.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    await mobilePage.emulateMedia({ reducedMotion: "reduce" });
    await gotoFixture(mobilePage, server.baseUrl, timeoutMs);

    await runCheck(checks, "horizon_mobile_stays_single_row", async () => {
      const metrics = await mobilePage.locator('[data-feature-id="host-queue-horizon"]').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          clientWidth: Math.round(element.clientWidth),
          scrollWidth: Math.round(element.scrollWidth),
          viewportWidth: window.innerWidth,
        };
      });
      if (metrics.height > 100) {
        throw new Error(`Mobile Horizon wrapped beyond its compact band: ${JSON.stringify(metrics)}`);
      }
      if (metrics.scrollWidth > metrics.clientWidth + 2) {
        throw new Error(`Mobile Horizon overflows horizontally: ${JSON.stringify(metrics)}`);
      }
      return JSON.stringify(metrics);
    });

    await mobile.close();

    await runCheck(checks, "horizon_has_no_unexpected_page_errors", async () => {
      const unexpected = pageErrors.filter((entry) => !EXPECTED_FIXTURE_AUTH_ERROR.test(entry));
      if (unexpected.length) throw new Error(unexpected[0]);
      return pageErrors.length
        ? `no unexpected runtime errors (${pageErrors.length} fixture auth write error(s) ignored)`
        : "no client-side runtime errors";
    });
  } catch (error) {
    failure = error;
    console.error(`Horizon Queue QA failed before teardown: ${String(error?.stack || error?.message || error)}`);
  } finally {
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
  console.log("Host Horizon Queue QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
