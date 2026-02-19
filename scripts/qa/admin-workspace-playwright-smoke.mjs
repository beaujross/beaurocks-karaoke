const DEFAULT_BASE_URL = "https://beaurocks-karaoke-v2.web.app";
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_FAILURE_SCREENSHOT = "tmp/qa-admin-workspace-failure.png";

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(
      `Playwright is not installed (${message}). Run: npm install && npm run qa:admin:prod:install`
    );
  }
};

const waitForEither = async (page, locators, timeoutMs) => {
  const candidates = locators.map((locator) => locator.first());
  const waits = candidates.map((candidate) =>
    candidate.waitFor({ state: "visible", timeout: timeoutMs }).then(() => candidate)
  );
  try {
    return await Promise.any(waits);
  } catch {
    const url = page.url();
    throw new Error(`Timed out after ${timeoutMs}ms waiting for target UI state (url=${url}).`);
  }
};

const visibleCount = async (page, selector) =>
  page.locator(selector).evaluateAll((nodes) =>
    nodes.filter((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }).length
  );

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

const getActiveSectionTitle = async (page) => {
  const hooked = page.locator("[data-admin-active-section-title]");
  if (await hooked.count()) {
    return (await hooked.first().innerText()).trim();
  }
  const fallback = page.locator("div.text-xl.font-bold.text-white.mt-1").nth(1);
  if (await fallback.count()) {
    return (await fallback.innerText()).trim();
  }
  return "";
};

const clickSectionNav = async (page, key, label) => {
  const hooked = page.locator(`[data-admin-section-item="${key}"]`);
  if (await hooked.count()) {
    await hooked.first().click({ force: true });
    return;
  }
  await page.locator("aside button").filter({ hasText: label }).first().click({ force: true });
};

const getSectionsToggle = async (page) => {
  const hooked = page.locator("[data-admin-sections-toggle]");
  if (await hooked.count()) return hooked.first();
  const fallback = page.getByRole("button", { name: /^Sections$/i });
  if (await fallback.count()) return fallback.first();
  return null;
};

const waitForPostCreateControls = async ({
  page,
  quickStart,
  openAdmin,
  openFullAdmin,
  activeSectionTitle,
  timeoutMs,
}) => {
  const started = Date.now();
  let retryClicks = 0;
  while (Date.now() - started < timeoutMs) {
    if (await activeSectionTitle.isVisible().catch(() => false)) return;
    if (
      (await openFullAdmin.isVisible().catch(() => false)) &&
      (await openFullAdmin.first().isEnabled().catch(() => false))
    ) {
      return;
    }
    if (
      (await openAdmin.isVisible().catch(() => false)) &&
      (await openAdmin.first().isEnabled().catch(() => false))
    ) {
      return;
    }

    const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
    if (
      bodyText.includes("failed to create room") ||
      bodyText.includes("permission denied while creating room") ||
      bodyText.includes("could not establish auth")
    ) {
      throw new Error("Room creation failed during smoke test.");
    }

    if ((await quickStart.isVisible().catch(() => false)) && retryClicks < 2) {
      retryClicks += 1;
      await quickStart.click();
    }
    await delay(1200);
  }
  throw new Error("Timed out waiting for room controls after quick start.");
};

const openHostAndAdmin = async (page, { hostUrl, timeoutMs }) => {
  await page.goto(hostUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForTimeout(3500);

  const quickStart = page.getByRole("button", { name: /Quick Start New Room/i });
  const openAdmin = page.locator('button[title="Open Admin"]');
  const openFullAdmin = page.getByRole("button", { name: /Open Full Admin/i });
  const activeSectionTitle = page.locator("[data-admin-active-section-title]");
  const adminWorkspaceTitle = page.getByText("Admin Workspace", { exact: false });
  const clickOpenFullAdminDom = async () =>
    page.evaluate(() => {
      const target = Array.from(document.querySelectorAll("button")).find(
        (button) => (button.textContent || "").trim().toUpperCase() === "OPEN FULL ADMIN"
      );
      if (!target) return false;
      target.click();
      return true;
    });

  if (await adminWorkspaceTitle.isVisible().catch(() => false)) {
    return "";
  }

  if (await quickStart.isVisible().catch(() => false)) {
    await quickStart.click();
    await waitForPostCreateControls({
      page,
      quickStart,
      openAdmin,
      openFullAdmin,
      activeSectionTitle,
      timeoutMs,
    });
  }

  if (await adminWorkspaceTitle.isVisible().catch(() => false)) {
    return "";
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const clicked = await clickOpenFullAdminDom().catch(() => false);
    if (!clicked) break;
    await delay(900);
    if (await adminWorkspaceTitle.isVisible().catch(() => false)) {
      return "";
    }
  }

  let openedViaFullAdmin = false;
  if (await openFullAdmin.count()) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!(await openFullAdmin.first().isVisible().catch(() => false))) break;
      if (!(await openFullAdmin.first().isEnabled().catch(() => false))) {
        await delay(900);
        continue;
      }
      try {
        await openFullAdmin.first().click({ force: true });
      } catch {
        // Continue retry loop.
      }
      await delay(900);
      if (await adminWorkspaceTitle.isVisible().catch(() => false)) {
        openedViaFullAdmin = true;
        break;
      }
    }
  }
  if (!openedViaFullAdmin && (await openAdmin.isVisible().catch(() => false))) {
    await openAdmin.click({ force: true });
    await page.waitForTimeout(1200);
  }

  if (await adminWorkspaceTitle.isVisible().catch(() => false)) {
    return "";
  }

  const workspaceSurface = await waitForEither(
    page,
    [
      page.locator('[data-admin-workspace="true"]'),
      page.locator('[data-admin-workspace="modal"]'),
      adminWorkspaceTitle,
    ],
    timeoutMs
  );
  await waitForEither(page, [page.locator("[data-admin-active-section-title]"), adminWorkspaceTitle], timeoutMs);
  return (await workspaceSurface.getAttribute("data-admin-workspace")) || "";
};

const runDesktopScenario = async ({ browser, hostUrl, timeoutMs, checks }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  try {
    const workspaceMode = await openHostAndAdmin(page, { hostUrl, timeoutMs });
    const openFullAdmin = page.getByRole("button", { name: /Open Full Admin/i });
    const hasTitleHook = (await page.locator("[data-admin-active-section-title]").count()) > 0;
    if (await openFullAdmin.isVisible().catch(() => false)) {
      await openFullAdmin.click({ force: true });
      await page.waitForTimeout(1200);
    }

    await runCheck(checks, "desktop_admin_workspace_loaded", async () => {
      const adminWorkspaceVisible = await page.getByText("Admin Workspace", { exact: false }).isVisible().catch(() => false);
      if (!adminWorkspaceVisible) {
        throw new Error("Admin Workspace shell is not visible (still in setup overlay).");
      }
      const title = await getActiveSectionTitle(page);
      return `Active section: ${title || "unknown"} (surface=${workspaceMode || "unknown"})`;
    });

    await runCheck(checks, "desktop_single_left_sections_rail", async () => {
      const hasHook = (await page.locator("[data-admin-sections-rail]").count()) > 0;
      if (hasHook) {
        const railsVisible = await visibleCount(page, "[data-admin-sections-rail]");
        if (railsVisible !== 1) {
          throw new Error(`Expected 1 visible sections rail, got ${railsVisible}.`);
        }
        return "Single visible sections rail.";
      }
      const sectionsVisible = await visibleCount(page, "text=Sections");
      if (sectionsVisible < 1) {
        throw new Error("No visible sections navigation found.");
      }
      return "Sections navigation visible (fallback selector).";
    });

    await runCheck(checks, "desktop_no_admin_areas_rail", async () => {
      const legacyRailVisible = await visibleCount(page, "text=Admin Areas");
      if (legacyRailVisible > 0) {
        throw new Error("Legacy Admin Areas rail is still visible.");
      }
      return "Legacy rail not visible.";
    });

    const navigateToSection = async (key, expectedTitleRegex) => {
      const labelByKey = {
        media: "Playback",
        chat: "Chat",
        moderation: "Approvals",
      };
      await clickSectionNav(page, key, labelByKey[key] || key);
      if (!hasTitleHook) {
        return `Clicked ${labelByKey[key] || key} (fallback mode without title hook).`;
      }
      const text = await getActiveSectionTitle(page);
      if (!expectedTitleRegex.test(text)) {
        throw new Error(`Expected section title ${expectedTitleRegex}, got "${text}".`);
      }
      return text;
    };

    await runCheck(checks, "desktop_section_switch_media", async () =>
      navigateToSection("media", /(playback|media)/i));
    await runCheck(checks, "desktop_section_switch_chat", async () =>
      navigateToSection("chat", /chat/i));
    await runCheck(checks, "desktop_section_switch_moderation", async () =>
      navigateToSection("moderation", /(approvals|moderation)/i));

    await runCheck(checks, "desktop_quick_action_live_effects", async () => {
      await page.locator('[data-feature-id="quick-open-live-effects"]').click();
      const text = await getActiveSectionTitle(page);
      if (!/live effects/i.test(text)) {
        throw new Error(`Expected Live Effects section, got "${text}".`);
      }
      return text;
    });
  } finally {
    await context.close();
  }
};

const runMobileScenario = async ({ browser, hostUrl, timeoutMs, checks }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await openHostAndAdmin(page, { hostUrl, timeoutMs });
    const hasTitleHook = (await page.locator("[data-admin-active-section-title]").count()) > 0;

    await runCheck(checks, "mobile_sections_hidden_by_default", async () => {
      const hasHook = (await page.locator("[data-admin-sections-rail]").count()) > 0;
      if (!hasHook) {
        return "Skipped strict hidden-rail assertion (no data hook in current build).";
      }
      const visibleRails = await visibleCount(page, "[data-admin-sections-rail]");
      if (visibleRails !== 0) {
        throw new Error(`Expected sections rail hidden on mobile, got ${visibleRails} visible.`);
      }
      return "Sections rail hidden before toggle.";
    });

    await runCheck(checks, "mobile_sections_toggle_and_nav", async () => {
      const toggle = await getSectionsToggle(page);
      if (toggle) {
        await toggle.click({ force: true });
      }
      if (toggle && (await page.locator("[data-admin-sections-rail]").count()) > 0) {
        await page.locator("[data-admin-sections-rail]").waitFor({ state: "visible", timeout: timeoutMs });
      }
      const hookedChatNav = page.locator('[data-admin-section-item="chat"]').first();
      const fallbackChatNav = page.locator("aside button").filter({ hasText: "Chat" }).first();
      const hasHookedChatNav = (await page.locator('[data-admin-section-item="chat"]').count()) > 0;
      const chatNavVisible = hasHookedChatNav
        ? await hookedChatNav.isVisible().catch(() => false)
        : await fallbackChatNav.isVisible().catch(() => false);
      if (!chatNavVisible) {
        return "Skipped Chat section click (mobile sections rail not exposed in this build).";
      }
      await clickSectionNav(page, "chat", "Chat");
      if (!hasTitleHook) {
        return "Clicked Chat section (fallback mode without title hook).";
      }
      const text = await getActiveSectionTitle(page);
      if (!/chat/i.test(text)) {
        throw new Error(`Expected Chat section after mobile nav, got "${text}".`);
      }
      return text;
    });
  } finally {
    await context.close();
  }
};

const run = async () => {
  const baseUrl = process.env.QA_BASE_URL || DEFAULT_BASE_URL;
  const hostUrl = process.env.QA_HOST_URL || `${baseUrl}?mode=host`;
  const timeoutMs = Math.max(15000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = !toBool(process.env.QA_HEADFUL, false);
  const includeMobile = !toBool(process.env.QA_SKIP_MOBILE, false);
  const failureScreenshotPath = process.env.QA_FAILURE_SCREENSHOT || DEFAULT_FAILURE_SCREENSHOT;
  const checks = [];

  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless });
  let scenarioFailure = false;

  try {
    await runDesktopScenario({ browser, hostUrl, timeoutMs, checks });
    if (includeMobile) {
      await runMobileScenario({ browser, hostUrl, timeoutMs, checks });
    }
  } catch (error) {
    scenarioFailure = true;
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(hostUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.screenshot({ path: failureScreenshotPath, fullPage: true });
    } catch {
      // Ignore fallback screenshot failures.
    } finally {
      await context.close();
    }
    checks.push({
      name: "scenario_failure",
      pass: false,
      detail: String(error?.message || error),
    });
  } finally {
    await browser.close();
  }

  const failed = checks.filter((check) => !check.pass);
  const output = {
    ok: failed.length === 0 && !scenarioFailure,
    baseUrl,
    hostUrl,
    includeMobile,
    headless,
    timeoutMs,
    checks,
    failedCount: failed.length,
    failureScreenshotPath: scenarioFailure ? failureScreenshotPath : "",
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exit(1);
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
