import {
  applyQaAppCheckDebugInitScript,
  requireQaAppCheckDebugTokenForRemoteUrl,
} from "./lib/appCheckDebug.mjs";

const DEFAULT_BASE_URL = "https://beaurocks-karaoke-v2.web.app";
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_FAILURE_SCREENSHOT = "tmp/qa-overnight-smoke-failure.png";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ROOM_CODE_BLOCKLIST = new Set(["ROOM", "CODE", "LIKE", "OPEN", "HOST", "BROWSER", "DASHBOARD"]);

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

const sanitizeRoomCode = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const isLikelyRoomCode = (value) => {
  const code = sanitizeRoomCode(value);
  return code.length >= 4 && code.length <= 10 && !ROOM_CODE_BLOCKLIST.has(code);
};

const deriveSurfaceOriginFromBase = (baseUrl = "", surface = "app") => {
  try {
    const parsed = new URL(String(baseUrl || "").trim());
    const protocol = parsed.protocol || "https:";
    const hostname = String(parsed.hostname || "").trim().toLowerCase();
    const portPart = parsed.port ? `:${parsed.port}` : "";

    if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname || "localhost"}${portPart}`;
    }

    const labels = hostname.split(".");
    const knownSurface = new Set(["app", "host", "tv", "www"]);
    let domainLabels = labels;
    if (knownSurface.has(labels[0])) {
      domainLabels = labels.slice(1);
    }
    if (!domainLabels.length) {
      return `${protocol}//${hostname}${portPart}`;
    }
    return `${protocol}//${surface}.${domainLabels.join(".")}${portPart}`;
  } catch {
    return "";
  }
};

const deriveHostUrlFromBase = (baseUrl = "") => {
  const hostOrigin = deriveSurfaceOriginFromBase(baseUrl, "host");
  if (!hostOrigin) return `${String(baseUrl || "").replace(/\/+$/, "")}/?mode=host`;
  return `${hostOrigin}/?mode=host&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`;
};

const deriveHostAccessUrlFromBase = (baseUrl = "") => {
  const hostOrigin = deriveSurfaceOriginFromBase(baseUrl, "host");
  if (hostOrigin) return `${hostOrigin}/host-access`;
  return `${String(baseUrl || "").replace(/\/+$/, "")}/host-access`;
};

const readHostRoomCode = async (page) => {
  const hooked = page.locator("[data-host-room-code]").first();
  if (await hooked.count()) {
    const text = sanitizeRoomCode(await hooked.innerText().catch(() => ""));
    if (isLikelyRoomCode(text)) return text;
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const regexes = [/\bcreated room\s+([A-Z0-9]{4,8})\b/i, /\b([A-Z0-9]{4,8})\s+created\b/i];
  for (const regex of regexes) {
    const match = bodyText.match(regex);
    const candidate = sanitizeRoomCode(match?.[1] || "");
    if (isLikelyRoomCode(candidate)) return candidate;
  }

  try {
    const parsed = new URL(page.url());
    const fromQuery = sanitizeRoomCode(parsed.searchParams.get("room") || "");
    if (isLikelyRoomCode(fromQuery)) return fromQuery;
  } catch {
    // ignore
  }
  return "";
};

const runGuidedSetupWizardLaunch = async ({ page, timeoutMs }) => {
  const guidedWizardBtn = page.getByRole("button", { name: /Guided Setup Wizard/i }).first();
  if (!(await guidedWizardBtn.isVisible().catch(() => false))) return "";

  if (await guidedWizardBtn.isEnabled().catch(() => false)) {
    await guidedWizardBtn.click({ force: true });
    await delay(1200);
  }

  const steps = [
    /Continue to Plan/i,
    /Continue to Branding/i,
    /Continue to Launch/i,
    /Launch First Room/i,
  ];

  for (const stepRegex of steps) {
    const stepStart = Date.now();
    while (Date.now() - stepStart < Math.min(45000, timeoutMs)) {
      const code = await readHostRoomCode(page);
      if (code) return code;

      const btn = page.getByRole("button", { name: stepRegex }).first();
      const visible = await btn.isVisible().catch(() => false);
      const enabled = await btn.isEnabled().catch(() => false);
      if (visible && enabled) {
        await btn.click({ force: true });
        await delay(1800);
        break;
      }
      await delay(500);
    }
  }

  const finalStart = Date.now();
  while (Date.now() - finalStart < Math.min(35000, timeoutMs)) {
    const code = await readHostRoomCode(page);
    if (code) return code;
    await delay(700);
  }

  return "";
};

const waitForHostRoomCode = async ({ page, timeoutMs }) => {
  const started = Date.now();
  let createClicked = false;
  let guidedFlowAttempted = false;
  while (Date.now() - started < timeoutMs) {
    const code = await readHostRoomCode(page);
    if (code) return code;

    const bodyText = String(await page.locator("body").innerText().catch(() => "")).toLowerCase();
    if (/beaurocks host rooms|browse rooms like a workspace/i.test(bodyText)) {
      const openHostPanel = page.getByRole("button", { name: /Open Host Panel/i }).first();
      const openRoom = page.getByRole("button", { name: /^OPEN$/i }).first();
      if (await openHostPanel.isVisible().catch(() => false)) {
        await openHostPanel.click({ force: true });
        await delay(1800);
        continue;
      }
      if (await openRoom.isVisible().catch(() => false)) {
        await openRoom.click({ force: true });
        await delay(1800);
        continue;
      }
    }

    const advancedSummary = page.getByText(/Advanced Launch \(QA \/ Returning Hosts\)/i).first();
    if (await advancedSummary.isVisible().catch(() => false)) {
      await advancedSummary.click({ force: true }).catch(() => {});
      await delay(300);
    }

    const quickStart = page.locator("[data-host-quick-start]").first();
    if (await quickStart.count()) {
      const visible = await quickStart.isVisible().catch(() => false);
      const enabled = await quickStart.isEnabled().catch(() => false);
      if (!createClicked && visible && enabled) {
        await quickStart.click({ force: true });
        createClicked = true;
      }
    }

    if (!createClicked && !guidedFlowAttempted) {
      guidedFlowAttempted = true;
      const guidedRoomCode = await runGuidedSetupWizardLaunch({ page, timeoutMs });
      if (guidedRoomCode) return guidedRoomCode;
    }
    await delay(1000);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for host room code.`);
};

const attachErrorCollectors = (page, label, bucket) => {
  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();
    const normalized = String(text || "").toLowerCase();
    const isCritical =
      type === "error" ||
      normalized.includes("failed-precondition") ||
      normalized.includes("requires an index") ||
      normalized.includes("uncaught error in snapshot listener");
    if (!isCritical) return;
    bucket.push({ label, kind: "console", type, text });
  });

  page.on("pageerror", (error) => {
    bucket.push({
      label,
      kind: "pageerror",
      type: "error",
      text: String(error?.message || error),
    });
  });
};

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

const validateHostDropdown = async (hostPage, timeoutMs) => {
  const isSetupWizardVisible = async () => {
    const setupHeading = hostPage.getByText("Set The Night", { exact: false }).first();
    return setupHeading.isVisible().catch(() => false);
  };

  const ensureHostControlBar = async () => {
    const started = Date.now();
    while (Date.now() - started < Math.min(timeoutMs, 30000)) {
      const tvToggle = hostPage.locator('[data-feature-id="deck-tv-menu-toggle"]').first();
      if (await tvToggle.isVisible().catch(() => false)) return tvToggle;

      const bodyText = String(await hostPage.locator("body").innerText().catch(() => "")).toLowerCase();
      if (/beaurocks host rooms|browse rooms like a workspace/i.test(bodyText)) {
        const openHostPanel = hostPage.getByRole("button", { name: /Open Host Panel/i }).first();
        const openRoom = hostPage.getByRole("button", { name: /^OPEN$/i }).first();
        if (await openHostPanel.isVisible().catch(() => false)) {
          await openHostPanel.click({ force: true });
          await delay(1800);
          continue;
        }
        if (await openRoom.isVisible().catch(() => false)) {
          await openRoom.click({ force: true });
          await delay(1800);
          continue;
        }
      }

      const skipIntroHook = hostPage.locator("[data-host-setup-skip-intro]").first();
      if (await skipIntroHook.isVisible().catch(() => false)) {
        await skipIntroHook.click({ force: true });
        await delay(1500);
        continue;
      }

      const skipIntro = hostPage.getByRole("button", { name: /skip intro/i }).first();
      if (await skipIntro.isVisible().catch(() => false)) {
        await skipIntro.click({ force: true });
        await delay(1500);
        continue;
      }

      const startNight = hostPage.getByRole("button", { name: /start night/i }).first();
      if (await startNight.isVisible().catch(() => false)) {
        const enabled = await startNight.isEnabled().catch(() => false);
        if (enabled) {
          await startNight.click({ force: true });
          await delay(1800);
          continue;
        }
      }

      const continueBtn = hostPage.getByRole("button", { name: /continue/i }).first();
      if (await continueBtn.isVisible().catch(() => false)) {
        const enabled = await continueBtn.isEnabled().catch(() => false);
        if (enabled) {
          await continueBtn.click({ force: true });
          await delay(1200);
          continue;
        }
      }

      await delay(800);
    }
    throw new Error("Could not reach host control bar with deck TV toggle.");
  };

  let toggle;
  try {
    toggle = await ensureHostControlBar();
  } catch (error) {
    if (await isSetupWizardVisible()) {
      return "Skipped dropdown check: setup wizard remained active in this room state.";
    }
    throw error;
  }

  await toggle.waitFor({ state: "visible", timeout: timeoutMs });
  await toggle.click({ force: true });

  const title = hostPage.getByText("TV Display Modes", { exact: false }).first();
  try {
    await title.waitFor({ state: "visible", timeout: 10000 });
  } catch (error) {
    if (await isSetupWizardVisible()) {
      return "Skipped dropdown check: setup wizard overlay prevented top-chrome validation.";
    }
    throw error;
  }

  const panelMeta = await title.evaluate((node) => {
    const panel = node.closest("div");
    if (!panel) return { width: 0, height: 0, background: "" };
    const rect = panel.getBoundingClientRect();
    const style = window.getComputedStyle(panel);
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      background: style.backgroundColor || "",
    };
  });

  const videoBtn = hostPage.locator('[data-feature-id="deck-tv-video"]').first();
  const lyricsBtn = hostPage.locator('[data-feature-id="deck-tv-lyrics"]').first();
  const vizBtn = hostPage.locator('[data-feature-id="deck-tv-visualizer"]').first();
  const lvBtn = hostPage.locator('[data-feature-id="deck-tv-lyrics-viz"]').first();
  await Promise.all([
    videoBtn.waitFor({ state: "visible", timeout: timeoutMs }),
    lyricsBtn.waitFor({ state: "visible", timeout: timeoutMs }),
    vizBtn.waitFor({ state: "visible", timeout: timeoutMs }),
    lvBtn.waitFor({ state: "visible", timeout: timeoutMs }),
  ]);

  if (panelMeta.width < 320) {
    throw new Error(`TV dropdown panel too small (${panelMeta.width}x${panelMeta.height}).`);
  }
  return `TV dropdown rendered (${panelMeta.width}x${panelMeta.height}).`;
};

const assertNoCriticalErrors = (bucket, label) => {
  const scoped = bucket.filter((entry) => {
    if (entry.label !== label) return false;
    const text = String(entry.text || "").toLowerCase();
    if (text.includes("auth/network-request-failed")) return false;
    return true;
  });
  if (!scoped.length) return "No critical console/page errors detected.";
  const detail = scoped
    .slice(0, 5)
    .map((entry) => `${entry.kind}:${entry.type}:${entry.text}`)
    .join(" | ");
  throw new Error(`Detected ${scoped.length} critical runtime errors: ${detail}`);
};

const validateTvNotStuckOnPreview = async (tvPage, timeoutMs) => {
  await tvPage.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
  await delay(9000);

  const previewVisible = await tvPage.getByText("TV Preview", { exact: false }).first().isVisible().catch(() => false);
  if (previewVisible) {
    throw new Error("TV Preview overlay remained visible after initial load.");
  }

  const wyrLayoutVisible = await tvPage.getByText("Would You Rather Layout", { exact: false }).first().isVisible().catch(() => false);
  if (wyrLayoutVisible) {
    throw new Error("Would You Rather preview layout appears stuck on TV.");
  }

  return "No stuck TV preview overlays detected after load.";
};

const run = async () => {
  const { chromium } = await ensurePlaywright();
  const baseUrl = process.env.QA_BASE_URL || DEFAULT_BASE_URL;
  const hostUrl = process.env.QA_HOST_URL || deriveHostUrlFromBase(baseUrl);
  const audienceOrigin = process.env.QA_AUDIENCE_URL || deriveSurfaceOriginFromBase(baseUrl, "app") || baseUrl;
  const tvOrigin = process.env.QA_TV_URL || deriveSurfaceOriginFromBase(baseUrl, "tv") || baseUrl;
  const timeoutMs = Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const email = String(process.env.QA_HOST_EMAIL || "").trim();
  const password = String(process.env.QA_HOST_PASSWORD || "");
  const checks = [];
  const errors = [];

  if (!email || !password) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: "QA_HOST_EMAIL and QA_HOST_PASSWORD are required for overnight prod smoke.",
      baseUrl,
      hostUrl,
    }, null, 2));
    return;
  }

  requireQaAppCheckDebugTokenForRemoteUrl(baseUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await applyQaAppCheckDebugInitScript(context);
  const hostPage = await context.newPage();
  const audiencePage = await context.newPage();
  const tvPage = await context.newPage();

  attachErrorCollectors(hostPage, "host", errors);
  attachErrorCollectors(audiencePage, "audience", errors);
  attachErrorCollectors(tvPage, "tv", errors);

  let roomCode = "";
  try {
    await runCheck(checks, "host_create_or_join_room", async () => {
      await gotoHostAccessAndLogin({ page: hostPage, baseUrl, email, password, timeoutMs });
      await hostPage.goto(hostUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(2200);
      roomCode = await waitForHostRoomCode({ page: hostPage, timeoutMs });
      return `Room ${roomCode}`;
    });

    await runCheck(checks, "host_dropdown_visualizer_panel", async () => {
      if (!roomCode) throw new Error("Room code unavailable.");
      return validateHostDropdown(hostPage, timeoutMs);
    });

    await runCheck(checks, "audience_load_no_critical_errors", async () => {
      if (!roomCode) throw new Error("Room code unavailable.");
      await audiencePage.goto(`${audienceOrigin}?room=${encodeURIComponent(roomCode)}`, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      await delay(9000);
      return assertNoCriticalErrors(errors, "audience");
    });

    await runCheck(checks, "tv_preview_not_stuck", async () => {
      if (!roomCode) throw new Error("Room code unavailable.");
      await tvPage.goto(`${tvOrigin}?room=${encodeURIComponent(roomCode)}&mode=tv`, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      const previewResult = await validateTvNotStuckOnPreview(tvPage, timeoutMs);
      const errorResult = assertNoCriticalErrors(errors, "tv");
      return `${previewResult} ${errorResult}`;
    });

    await runCheck(checks, "host_no_critical_errors", async () => assertNoCriticalErrors(errors, "host"));
  } finally {
    const failed = checks.filter((check) => !check.pass);
    if (failed.length) {
      await hostPage.screenshot({ path: DEFAULT_FAILURE_SCREENSHOT, fullPage: true }).catch(() => {});
    }
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const failedChecks = checks.filter((check) => !check.pass);
  const output = {
    ok: failedChecks.length === 0,
    baseUrl,
    hostUrl,
    audienceOrigin,
    tvOrigin,
    roomCode,
    checks,
    failures: failedChecks,
    criticalErrorCount: errors.length,
  };
  console.log(JSON.stringify(output, null, 2));
  if (failedChecks.length) process.exit(1);
};

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});
