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

const openQueueFixture = async (page, baseUrl, timeoutMs) => {
  await page.goto(
    `${baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=queue-overview-density&hostUiVersion=v2&view=stage&tab=stage`,
    { waitUntil: "domcontentloaded", timeout: timeoutMs },
  );
  await page.waitForLoadState("networkidle", { timeout: Math.min(5000, timeoutMs) }).catch(() => {});
  await page.locator('[data-feature-id="host-queue-horizon"]').first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  const queueTab = page.locator('[data-host-tab="stage"]:visible').first();
  if (await queueTab.count()) await queueTab.click({ force: true });
  const liveQueueTab = page.locator(
    '[data-feature-id="queue-surface-tab-queue-desktop"]:visible, [data-feature-id="queue-surface-tab-queue"]:visible',
  ).first();
  await liveQueueTab.waitFor({ state: "visible", timeout: timeoutMs });
  await liveQueueTab.click({ force: true });
  await page.locator('[data-lineup-plan-item-id^="queue_density_ready_"]').first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  await delay(300);
};

const openUnifiedLineupFixture = async (page, baseUrl, timeoutMs) => {
  await page.goto(
    `${baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=run-of-show-console&hostUiVersion=v2&view=stage&tab=stage`,
    { waitUntil: "domcontentloaded", timeout: timeoutMs },
  );
  await page.waitForLoadState("networkidle", { timeout: Math.min(5000, timeoutMs) }).catch(() => {});
  await page.locator('[data-feature-id="host-queue-horizon"]').first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  const queueTab = page.locator('[data-host-tab="stage"]:visible').first();
  if (await queueTab.count()) await queueTab.click({ force: true });
  const liveQueueTab = page.locator(
    '[data-feature-id="queue-surface-tab-queue-desktop"]:visible, [data-feature-id="queue-surface-tab-queue"]:visible',
  ).first();
  await liveQueueTab.waitFor({ state: "visible", timeout: timeoutMs });
  await liveQueueTab.click({ force: true });
  await page.locator('[data-feature-id="unified-tonights-lineup-plan"]').first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  await delay(300);
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
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript((firebaseConfig) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
    await context.addInitScript((fixedNowMs) => {
      const originalDateNow = Date.now.bind(Date);
      Date.now = () => fixedNowMs || originalDateNow();
    }, FIXED_QA_HOST_NOW_MS);
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openQueueFixture(page, server.baseUrl, timeoutMs);

    const readyRows = page.locator('[data-lineup-plan-item-id^="queue_density_ready_"]');

    await runCheck(checks, "queue_opens_as_overview", async () => {
      const count = await readyRows.count();
      const selectedCount = await page.locator('[data-lineup-plan-item-id^="queue_density_ready_"][data-lineup-plan-item-expanded="true"]').count();
      if (count !== 12) throw new Error(`Expected 12 ready singers, found ${count}.`);
      if (selectedCount !== 0) throw new Error(`Queue auto-expanded ${selectedCount} singer row(s).`);
      return `${count} ready singers, no default detail expansion`;
    });

    await runCheck(checks, "queue_rows_are_scan_dense", async () => {
      const allLineupRows = page.locator('[data-lineup-plan-item-id]');
      await allLineupRows.first().evaluate((row) => row.scrollIntoView({ block: "start", behavior: "instant" }));
      await delay(100);
      const metrics = await allLineupRows.evaluateAll((rows) => rows.map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          id: row.getAttribute("data-lineup-plan-item-id"),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          fullyInViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
        };
      }));
      const maxHeight = Math.max(...metrics.map((entry) => entry.height));
      const fullyVisible = metrics.filter((entry) => entry.fullyInViewport).length;
      if (maxHeight > 80) throw new Error(`Collapsed queue row exceeds 80px: ${JSON.stringify(metrics)}`);
      if (fullyVisible < 7) {
        throw new Error(`Only ${fullyVisible} queue rows are fully visible at 1366x768: ${JSON.stringify(metrics)}`);
      }
      return `${fullyVisible} fully visible rows; ${maxHeight}px maximum collapsed height`;
    });

    await runCheck(checks, "queue_uses_progressive_disclosure", async () => {
      const rowTexts = await readyRows.evaluateAll((rows) => rows.map((row) => (
        String(row.innerText || "").replace(/\s+/g, " ").trim()
      )));
      if (!rowTexts.every((text) => /Ready|Protected/i.test(text))) {
        throw new Error(`Collapsed performance rows are missing their overview state: ${JSON.stringify(rowTexts)}`);
      }
      if (rowTexts.some((text) => /Earlier|Later|Performance details|Remove/i.test(text))) {
        throw new Error(`A collapsed performance row exposes secondary actions: ${JSON.stringify(rowTexts)}`);
      }
      return "collapsed rows show one state and defer secondary actions";
    });

    await runCheck(checks, "queue_details_open_in_inspector", async () => {
      const targetRow = readyRows.nth(2);
      const beforeHeight = Math.round((await targetRow.boundingBox())?.height || 0);
      await targetRow.getByRole("button", { name: /^Open Performance:/i }).click({ force: true });
      if ((await targetRow.getAttribute("data-lineup-plan-item-expanded")) !== "true") {
        throw new Error("Selecting a performance did not expand its secondary actions.");
      }
      await targetRow.getByRole("button", { name: /Performance details/i }).click({ force: true });
      const inspector = page.locator('[data-feature-id="queue-song-inspector"]').first();
      await inspector.waitFor({ state: "visible", timeout: timeoutMs });
      const afterHeight = Math.round((await targetRow.boundingBox())?.height || 0);
      if (afterHeight <= beforeHeight) {
        throw new Error(`Selected row did not reveal its detail controls: ${beforeHeight}px → ${afterHeight}px.`);
      }
      const otherExpandedRows = await page.locator(
        '[data-lineup-plan-item-expanded="true"]',
      ).count();
      if (otherExpandedRows !== 1) {
        throw new Error(`Expected one expanded lineup row, found ${otherExpandedRows}.`);
      }
      const inspectorText = String(await inspector.innerText()).replace(/\s+/g, " ").trim();
      const normalizedInspectorText = inspectorText.toLowerCase();
      for (const requiredLabel of ["Performance Details", "Start", "Edit", "Hold", "Remove"]) {
        if (!normalizedInspectorText.includes(requiredLabel.toLowerCase())) {
          throw new Error(`Inspector is missing ${requiredLabel}: ${inspectorText}`);
        }
      }
      await page.keyboard.press("Escape");
      await inspector.waitFor({ state: "hidden", timeout: timeoutMs });
      return `one row expanded from ${beforeHeight}px to ${afterHeight}px; inspector opens and Escape closes`;
    });

    await runCheck(checks, "queue_secondary_trays_are_collapsed", async () => {
      const traySelectors = [
        '[data-feature-id="queue-section-pending-toggle"]',
        '[data-feature-id="queue-section-held-toggle"]',
      ];
      for (const selector of traySelectors) {
        const tray = page.locator(selector).first();
        await tray.waitFor({ state: "visible", timeout: timeoutMs });
        if ((await tray.getAttribute("aria-expanded")) !== "false") {
          throw new Error(`${selector} did not start collapsed.`);
        }
      }
      if (await page.locator('[data-feature-id="queue-section-assigned-toggle"]').count()) {
        throw new Error("A linked performance was duplicated into the separate assigned tray.");
      }
      await page.locator(traySelectors[0]).click({ force: true });
      await page.locator('[data-queue-id="density_pending"]').waitFor({ state: "visible", timeout: timeoutMs });
      return "Awaiting Approval and Held stay collapsed; linked performances are not duplicated";
    });

    await runCheck(checks, "unified_queue_keeps_reorder_affordances", async () => {
      const draggableCount = await readyRows.evaluateAll((rows) => rows.filter((row) => row.parentElement?.draggable).length);
      const dragHandleCount = await readyRows.locator('[data-lineup-drag-handle="true"]').count();
      if (draggableCount !== 12 || dragHandleCount !== 12) {
        throw new Error(`Expected 12 draggable performance rows and handles, found ${draggableCount}/${dragHandleCount}.`);
      }
      return `${draggableCount} performance rows retain visible drag affordances`;
    });

    await runCheck(checks, "queue_controls_keep_accessible_targets", async () => {
      const undersized = await page.locator(
        '[data-lineup-plan-item-id^="queue_density_ready_"]:visible button:visible, [data-feature-id^="queue-section-"]:visible',
      ).evaluateAll((controls) => controls.map((control) => {
        const rect = control.getBoundingClientRect();
        return {
          label: String(control.getAttribute("aria-label") || control.textContent || "").replace(/\s+/g, " ").trim(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }).filter((entry) => entry.height < 44));
      if (undersized.length) throw new Error(`Undersized queue controls: ${JSON.stringify(undersized)}`);
      return "all visible queue controls are at least 44px tall";
    });

    await openUnifiedLineupFixture(page, server.baseUrl, timeoutMs);
    const unifiedRows = page.locator('[data-lineup-plan-item-id]');

    await runCheck(checks, "unified_lineup_rows_restore_scan_density", async () => {
      const rowCount = await unifiedRows.count();
      if (rowCount < 3) throw new Error(`Expected at least 3 mixed lineup rows, found ${rowCount}.`);
      const metrics = await unifiedRows.evaluateAll((rows) => rows.map((row) => ({
        id: row.getAttribute("data-lineup-plan-item-id"),
        expanded: row.getAttribute("data-lineup-plan-item-expanded"),
        height: Math.round(row.getBoundingClientRect().height),
      })));
      const maxHeight = Math.max(...metrics.map((entry) => entry.height));
      if (metrics.some((entry) => entry.expanded !== "false")) {
        throw new Error(`A unified lineup row opened by default: ${JSON.stringify(metrics)}`);
      }
      if (maxHeight > 72) {
        throw new Error(`Collapsed unified lineup row exceeds 72px: ${JSON.stringify(metrics)}`);
      }
      if (await page.locator('[data-feature-id="lineup-item-expanded-actions"]:visible').count()) {
        throw new Error("Secondary lineup actions are visible before a row is selected.");
      }
      return `${rowCount} mixed rows; ${maxHeight}px maximum collapsed height`;
    });

    await runCheck(checks, "unified_lineup_allows_only_one_expanded_row", async () => {
      const firstRow = unifiedRows.nth(0);
      const secondRow = unifiedRows.nth(1);
      await firstRow.getByRole("button", { name: /^Open /i }).click({ force: true });
      if (await page.locator('[data-lineup-plan-item-expanded="true"]').count() !== 1) {
        throw new Error("Opening the first mixed lineup row did not produce exactly one expanded row.");
      }
      await secondRow.getByRole("button", { name: /^Open /i }).click({ force: true });
      const expandedRows = page.locator('[data-lineup-plan-item-expanded="true"]');
      if (await expandedRows.count() !== 1) {
        throw new Error("Opening a second mixed lineup row left multiple rows expanded.");
      }
      const expandedItemId = await expandedRows.first().getAttribute("data-lineup-plan-item-id");
      const selectedItemId = await secondRow.getAttribute("data-lineup-plan-item-id");
      if (expandedItemId !== selectedItemId) {
        throw new Error("The newly selected mixed lineup row did not replace the previous expansion.");
      }
      return "selection moves one shared detail expansion between lineup rows";
    });

    await runCheck(checks, "unified_lineup_is_responsive_without_horizontal_overflow", async () => {
      const viewportResults = [];
      for (const viewport of [
        { width: 1024, height: 768 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        await delay(150);
        const metrics = await page.locator('[data-feature-id="unified-tonights-lineup-plan"]').first().evaluate((element) => ({
          viewportWidth: window.innerWidth,
          clientWidth: Math.round(element.clientWidth),
          scrollWidth: Math.round(element.scrollWidth),
        }));
        if (metrics.scrollWidth > metrics.clientWidth + 2) {
          throw new Error(`Unified lineup overflows at ${viewport.width}px: ${JSON.stringify(metrics)}`);
        }
        viewportResults.push(`${viewport.width}px:${metrics.scrollWidth}/${metrics.clientWidth}`);
      }
      await page.setViewportSize({ width: 1366, height: 768 });
      return viewportResults.join(", ");
    });

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await mobileContext.addInitScript((firebaseConfig) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
    await mobileContext.addInitScript((fixedNowMs) => {
      const originalDateNow = Date.now.bind(Date);
      Date.now = () => fixedNowMs || originalDateNow();
    }, FIXED_QA_HOST_NOW_MS);
    const mobilePage = await mobileContext.newPage();
    mobilePage.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    await mobilePage.emulateMedia({ reducedMotion: "reduce" });
    await openQueueFixture(mobilePage, server.baseUrl, timeoutMs);

    await runCheck(checks, "queue_inspector_is_mobile_safe", async () => {
      const mobileRows = mobilePage.locator('[data-lineup-plan-item-id^="queue_density_ready_"]');
      const targetRow = mobileRows.nth(2);
      const openButton = targetRow.getByRole("button", { name: /^Open Performance:/i });
      await openButton.scrollIntoViewIfNeeded();
      await openButton.click();
      await targetRow.getByRole("button", { name: /Performance details/i }).click();
      const inspector = mobilePage.locator('[data-feature-id="queue-song-inspector"]').first();
      await inspector.waitFor({ state: "visible", timeout: timeoutMs });
      const metrics = await inspector.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          clientWidth: Math.round(element.clientWidth),
          scrollWidth: Math.round(element.scrollWidth),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      });
      if (metrics.left < 0 || metrics.right > metrics.viewportWidth || metrics.bottom > metrics.viewportHeight) {
        throw new Error(`Mobile inspector escaped the viewport: ${JSON.stringify(metrics)}`);
      }
      if (metrics.scrollWidth > metrics.clientWidth + 2) {
        throw new Error(`Mobile inspector overflows horizontally: ${JSON.stringify(metrics)}`);
      }
      const undersized = await inspector.locator("button:visible").evaluateAll((buttons) => (
        buttons.map((button) => Math.round(button.getBoundingClientRect().height)).filter((height) => height < 48)
      ));
      if (undersized.length) throw new Error(`Mobile inspector has undersized controls: ${JSON.stringify(undersized)}`);
      return JSON.stringify(metrics);
    });
    await mobileContext.close();

    await runCheck(checks, "queue_overview_has_no_page_errors", async () => {
      const unexpected = pageErrors.filter((entry) => !EXPECTED_FIXTURE_AUTH_ERROR.test(entry));
      if (unexpected.length) throw new Error(unexpected[0]);
      return pageErrors.length
        ? `no unexpected runtime errors (${pageErrors.length} fixture auth write error(s) ignored)`
        : "no client-side runtime errors";
    });

    await context.close();
  } catch (error) {
    failure = error;
    console.error(`Host Queue Overview QA failed before teardown: ${String(error?.stack || error?.message || error)}`);
  } finally {
    await Promise.race([browser.close().catch(() => {}), delay(5000)]);
    await Promise.race([server.stop().catch(() => {}), delay(5000)]);
  }

  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }
  if (failure || checks.some((entry) => !entry.pass)) process.exitCode = 1;
  else console.log("Host Queue Overview QA passed.");
};

await main();
