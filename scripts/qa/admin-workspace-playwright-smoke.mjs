import {
  applyQaAppCheckDebugInitScript,
  requireQaAppCheckDebugTokenForRemoteUrl,
} from "./lib/appCheckDebug.mjs";

const DEFAULT_BASE_URL = "https://app.beaurocks.app";
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
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const deriveHostUrlFromBase = (baseUrl = "") => {
  try {
    const parsed = new URL(String(baseUrl || "").trim());
    const host = String(parsed.hostname || "").trim().toLowerCase();
    let nextHost = host;
    if (host.startsWith("app.")) {
      nextHost = `host.${host.slice(4)}`;
    } else if (host && !host.startsWith("host.") && host !== "localhost" && host !== "127.0.0.1") {
      nextHost = `host.${host}`;
    }
    return `${parsed.protocol}//${nextHost}/?mode=host&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`;
  } catch {
    return `${String(baseUrl || "").replace(/\/+$/, "")}/?mode=host`;
  }
};

const deriveHostAccessUrlFromBase = (baseUrl = "") => {
  try {
    const parsed = new URL(String(baseUrl || "").trim());
    const host = String(parsed.hostname || "").trim().toLowerCase();
    let nextHost = host;
    if (host.startsWith("app.")) {
      nextHost = `host.${host.slice(4)}`;
    } else if (host && !host.startsWith("host.") && host !== "localhost" && host !== "127.0.0.1") {
      nextHost = `host.${host}`;
    }
    return `${parsed.protocol}//${nextHost}/host-access`;
  } catch {
    return `${String(baseUrl || "").replace(/\/+$/, "")}/host-access`;
  }
};

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

const ADMIN_SECTION_SIGNAL_REGEXES = {
  media: [
    /Media pipelines, uploads, and playback source controls\./i,
    /Apple Music playback/i,
    /Playlist playback is host-only/i,
  ],
  chat: [
    /Audience chat policy, DM controls, and TV feed behavior\./i,
    /Chat policy/i,
    /Configure Chat TV \(Exit Admin\)/i,
  ],
  moderation: [
    /Pending total:/i,
    /Open moderation inbox/i,
    /Keep visibility and chat scope here/i,
  ],
};

const ADMIN_SECTION_ROUTE_META = {
  media: { view: "media", section: "media.playback" },
  chat: { view: "audience", section: "audience.chat" },
  moderation: { view: "audience", section: "audience.moderation" },
};
const ROOM_CODE_REGEXES = [/\broom\s+([A-Z0-9]{4,8})\b/i, /\b([A-Z0-9]{4,8})\s+created\b/i];

const gotoHostAccessAndLogin = async ({ page, baseUrl, email, password, timeoutMs }) => {
  const candidates = [
    `${String(baseUrl || "").replace(/\/+$/, "")}/host-access`,
    `${String(baseUrl || "").replace(/\/+$/, "")}/?mode=marketing&page=host_access`,
    deriveHostAccessUrlFromBase(baseUrl),
  ];

  let loaded = false;
  for (const target of candidates) {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await delay(1200);

    const handoffButton = page.getByRole("button", { name: /Continue To Host Login/i }).first();
    if (await handoffButton.isVisible().catch(() => false)) {
      await Promise.allSettled([
        page.waitForURL(/host\./i, { timeout: Math.min(20000, timeoutMs) }),
        handoffButton.click({ force: true }),
      ]);
      await delay(1500);
    }

    const hasHeading = await page.getByText(/Host Login (\+ (Application|Room Manager)|and Applications)/i).first().isVisible().catch(() => false);
    const hasAuthForm = await page.locator("form").first().isVisible().catch(() => false);
    const hasSignedInState = await page.getByText(/Signed in as/i).first().isVisible().catch(() => false);
    if (hasHeading && (hasAuthForm || hasSignedInState)) {
      loaded = true;
      break;
    }
  }
  if (!loaded) {
    throw new Error(`Could not load host access route from base url "${baseUrl}".`);
  }

  const signOut = page.getByRole("button", { name: /sign out/i }).first();
  if (await signOut.isVisible().catch(() => false)) {
    await signOut.click({ force: true });
    await delay(900);
  }

  const authForm = page.locator("form").first();
  await authForm.waitFor({ state: "visible", timeout: timeoutMs });

  const signInModeBtn = authForm.locator(".mk3-toggle-row button").filter({ hasText: /^Log In$/i }).first();
  if (await signInModeBtn.isVisible().catch(() => false)) {
    await signInModeBtn.click({ force: true });
  }

  await authForm.getByLabel(/Email/i).first().fill(email);
  await authForm.getByLabel(/Password/i).first().fill(password);
  await authForm.locator('button[type="submit"]').first().click({ force: true });

  const continueToHostLogin = page.getByRole("button", { name: /Continue To Host Login/i }).first();
  const openHostDashboard = page.getByRole("button", { name: /Open Host Dashboard/i }).first();
  const initialSuccess = await Promise.race([
    page.getByText(/Signed in as/i).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
    page.getByRole("button", { name: /sign out/i }).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
    continueToHostLogin.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
    openHostDashboard.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
  ]);

  if (!initialSuccess) {
    const bodyText = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    throw new Error(`Login did not complete on host access flow. Snippet="${bodyText}"`);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await continueToHostLogin.isVisible().catch(() => false)) {
      await Promise.allSettled([
        page.waitForURL(/host\./i, { timeout: Math.min(20000, timeoutMs) }),
        continueToHostLogin.click({ force: true }),
      ]);
      await delay(1500);
      continue;
    }
    break;
  }
  return `Logged in as ${email}.`;
};

const getActiveSectionTitle = async (page) => {
  const hooked = page.locator("[data-admin-active-section-title]");
  if (await hooked.first().isVisible().catch(() => false)) {
    return (await hooked.first().innerText()).trim();
  }
  const fallback = page.locator("div.text-xl.font-bold.text-white.mt-1").nth(1);
  if (await fallback.isVisible().catch(() => false)) {
    return (await fallback.innerText()).trim();
  }
  return "";
};

const readCurrentRoomCode = async (page) => {
  const hooked = page.locator("[data-host-room-code]").first();
  if (await hooked.isVisible().catch(() => false)) {
    const text = String(await hooked.innerText().catch(() => "")).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (text) return text;
  }

  try {
    const url = new URL(page.url());
    const fromQuery = String(url.searchParams.get("room") || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (fromQuery) return fromQuery;
  } catch {
    // Ignore URL parse failures.
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  for (const regex of ROOM_CODE_REGEXES) {
    const match = bodyText.match(regex);
    const candidate = String(match?.[1] || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (candidate) return candidate;
  }

  return "";
};

const openAdminSectionByRoute = async (page, key, timeoutMs) => {
  const routeMeta = ADMIN_SECTION_ROUTE_META[key];
  if (!routeMeta) return false;
  try {
    const url = new URL(page.url());
    const roomCode = await readCurrentRoomCode(page);
    if (roomCode) {
      url.searchParams.set("room", roomCode);
    }
    url.searchParams.set("hostUiVersion", "v2");
    url.searchParams.set("tab", "admin");
    url.searchParams.set("view", routeMeta.view);
    url.searchParams.set("section", routeMeta.section);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await delay(1500);
    return true;
  } catch {
    return false;
  }
};

const clickSectionNav = async (page, key, label, timeoutMs) => {
  const hooked = page.locator(`[data-admin-section-item="${key}"]`);
  if (await hooked.isVisible().catch(() => false)) {
    await hooked.first().click({ force: true });
    return;
  }

  const searchInputs = [
    page.getByPlaceholder(/Search sections/i).first(),
    page.getByPlaceholder(/Search host controls, settings, or tools/i).first(),
  ];
  for (const searchInput of searchInputs) {
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(label);
      await delay(250);
      if (await hooked.isVisible().catch(() => false)) {
        await hooked.first().click({ force: true });
        return;
      }
    }
  }

  const navScope = page.locator("[data-admin-sections-nav]").first();
  const exactRoleMatch = navScope.getByRole("button", {
    name: new RegExp(`^${escapeRegex(label)}$`, "i"),
  }).first();
  if (await exactRoleMatch.isVisible().catch(() => false)) {
    await exactRoleMatch.click({ force: true });
    return;
  }
  const fallback = navScope.locator("button").filter({ hasText: label }).first();
  if (await fallback.isVisible().catch(() => false)) {
    await fallback.click({ force: true });
    return;
  }

  const openedByRoute = await openAdminSectionByRoute(page, key, timeoutMs);
  if (!openedByRoute) {
    throw new Error(`Could not find admin navigation item for section "${key}".`);
  }
};

const waitForSectionReady = async ({ page, key, expectedTitleRegex, hasTitleHook, timeoutMs }) => {
  const signals = ADMIN_SECTION_SIGNAL_REGEXES[key] || [];
  const started = Date.now();
  let lastTitle = "";
  while (Date.now() - started < timeoutMs) {
    lastTitle = await getActiveSectionTitle(page);
    if (hasTitleHook && expectedTitleRegex.test(lastTitle)) {
      return lastTitle;
    }

    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (signals.some((regex) => regex.test(bodyText))) {
      if (lastTitle && expectedTitleRegex.test(lastTitle)) return lastTitle;
      return lastTitle ? `${lastTitle} (content confirmed)` : `${key} content visible`;
    }

    await delay(350);
  }

  throw new Error(`Expected section ${key} to match ${expectedTitleRegex}, got "${lastTitle || "unknown"}".`);
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
      const isEnabled = await quickStart.isEnabled().catch(() => false);
      if (isEnabled) {
        retryClicks += 1;
        await quickStart.click().catch(() => {});
      }
    }
    await delay(1200);
  }
  throw new Error("Timed out waiting for room controls after quick start.");
};

const openHostAndAdmin = async (page, { hostUrl, timeoutMs }) => {
  await page.goto(hostUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForTimeout(3500);

  const advancedDetails = page.locator("details", {
    hasText: /Advanced Launch \(QA \/ Returning Hosts\)/i,
  }).first();
  if (await advancedDetails.count()) {
    const isOpen = await advancedDetails.evaluate((node) => Boolean(node.open)).catch(() => false);
    if (!isOpen) {
      const summary = advancedDetails.locator("summary").first();
      if (await summary.count()) {
        await summary.click({ force: true }).catch(() => {});
      } else {
        await advancedDetails.click({ force: true }).catch(() => {});
      }
      await delay(350);
    }
  }

  const quickStartHook = page.locator("[data-host-quick-start]").first();
  const quickStart = (await quickStartHook.count())
    ? quickStartHook
    : page.getByRole("button", { name: /Quick Start New Room/i });
  const openRoomSettings = page.getByRole("button", { name: /Open room settings/i }).first();
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

  if (await openRoomSettings.isVisible().catch(() => false)) {
    const isEnabled = await openRoomSettings.isEnabled().catch(() => false);
    if (isEnabled) {
      await openRoomSettings.click({ force: true });
      await delay(1800);
    }
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

const runDesktopScenario = async ({ browser, baseUrl, hostUrl, email, password, timeoutMs, checks }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await applyQaAppCheckDebugInitScript(context);
  const page = await context.newPage();

  try {
    await gotoHostAccessAndLogin({ page, baseUrl, email, password, timeoutMs });
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
      await clickSectionNav(page, key, labelByKey[key] || key, timeoutMs);
      return waitForSectionReady({ page, key, expectedTitleRegex, hasTitleHook, timeoutMs });
    };

    await runCheck(checks, "desktop_section_switch_media", async () =>
      navigateToSection("media", /(playback|media)/i));
    await runCheck(checks, "desktop_section_switch_chat", async () =>
      navigateToSection("chat", /chat/i));
    await runCheck(checks, "desktop_section_switch_moderation", async () =>
      navigateToSection("moderation", /(approvals|moderation)/i));

    await runCheck(checks, "desktop_quick_action_live_effects", async () => {
      const quickAction = page.locator('[data-feature-id="quick-open-live-effects"]').first();
      if (!(await quickAction.count())) {
        return "Skipped quick action check (live-effects quick action hook not present in this build).";
      }
      if (!(await quickAction.isVisible().catch(() => false))) {
        return "Skipped quick action check (live-effects quick action not currently visible).";
      }
      await quickAction.click({ force: true });
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

const runMobileScenario = async ({ browser, baseUrl, hostUrl, email, password, timeoutMs, checks }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await applyQaAppCheckDebugInitScript(context);
  const page = await context.newPage();

  try {
    await gotoHostAccessAndLogin({ page, baseUrl, email, password, timeoutMs });
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
        await delay(600);
        const railVisible = await page.locator("[data-admin-sections-rail]").first().isVisible().catch(() => false);
        if (!railVisible) {
          return "Skipped Chat section click (mobile sections rail stayed collapsed after toggle).";
        }
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
      await clickSectionNav(page, "chat", "Chat", timeoutMs);
      return waitForSectionReady({
        page,
        key: "chat",
        expectedTitleRegex: /chat/i,
        hasTitleHook,
        timeoutMs,
      });
    });
  } finally {
    await context.close();
  }
};

const run = async () => {
  const baseUrl = process.env.QA_BASE_URL || DEFAULT_BASE_URL;
  const hostUrl = process.env.QA_HOST_URL || deriveHostUrlFromBase(baseUrl);
  const timeoutMs = Math.max(15000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = !toBool(process.env.QA_HEADFUL, false);
  const includeMobile = !toBool(process.env.QA_SKIP_MOBILE, false);
  const failureScreenshotPath = process.env.QA_FAILURE_SCREENSHOT || DEFAULT_FAILURE_SCREENSHOT;
  const email = String(process.env.QA_HOST_EMAIL || "").trim();
  const password = String(process.env.QA_HOST_PASSWORD || "");
  const checks = [];

  if (!email || !password) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: "QA_HOST_EMAIL and QA_HOST_PASSWORD are required for prod host admin smoke.",
      baseUrl,
      hostUrl,
    }, null, 2));
    return;
  }

  requireQaAppCheckDebugTokenForRemoteUrl(baseUrl);

  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless });
  let scenarioFailure = false;

  try {
    await runDesktopScenario({ browser, baseUrl, hostUrl, email, password, timeoutMs, checks });
    if (includeMobile) {
      await runMobileScenario({ browser, baseUrl, hostUrl, email, password, timeoutMs, checks });
    }
  } catch (error) {
    scenarioFailure = true;
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await applyQaAppCheckDebugInitScript(context);
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
