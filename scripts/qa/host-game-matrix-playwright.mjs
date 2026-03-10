import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  extractRoomCodeFromUrl,
  isLikelyRoomCode,
  sanitizeRoomCode,
} from "./lib/roomCode.js";
import {
  applyQaAppCheckDebugInitScript,
  requireQaAppCheckDebugTokenForRemoteUrl,
} from "./lib/appCheckDebug.mjs";
import { HOST_GAME_MATRIX } from "./lib/hostGameMatrix.mjs";

const DEFAULT_ROOT_URL = "https://beaurocks.app";
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_FAILURE_SCREENSHOT = "tmp/qa-host-game-matrix-failure.png";
const FIRESTORE_PROJECT_ID = "beaurocks-karaoke-v2";
const FIRESTORE_APP_ID = "bross-app";
const QA_SELFIE_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sot8i0AAAAASUVORK5CYII=";
const execFileAsync = promisify(execFile);
let cachedGoogleAccessToken = "";

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_PAGE_DIAGNOSTICS = 8;
const escapeRegex = (value = "") => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toFirestoreValue = (value) => {
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((entry) => toFirestoreValue(entry)) } };
  }
  if (value && typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, entryValue]) => [key, toFirestoreValue(entryValue)])
        ),
      },
    };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isFinite(value) && Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: Number.isFinite(value) ? value : 0 };
  }
  if (value === null || value === undefined) return { nullValue: null };
  return { stringValue: String(value) };
};

const getGoogleAccessToken = async () => {
  if (cachedGoogleAccessToken) return cachedGoogleAccessToken;
  const { stdout } = await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    "gcloud auth print-access-token",
  ]);
  const token = String(stdout || "").trim();
  if (!token) {
    throw new Error("Could not resolve Google access token from gcloud.");
  }
  cachedGoogleAccessToken = token;
  return token;
};

const patchFirestoreDocument = async ({ documentPath, fields = {}, updateMask = [] }) => {
  const token = await getGoogleAccessToken();
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${documentPath}`
  );
  const maskEntries = Array.isArray(updateMask) ? updateMask.filter(Boolean) : [];
  maskEntries.forEach((fieldPath) => url.searchParams.append("updateMask.fieldPaths", fieldPath));
  const response = await fetch(
    url,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [key, toFirestoreValue(value)])
        ),
      }),
    }
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Firestore patch failed (${response.status}): ${body.slice(0, 280)}`);
  }
  return response.json().catch(() => ({}));
};

const getFirestoreDocument = async ({ documentPath }) => {
  const token = await getGoogleAccessToken();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${documentPath}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Firestore get failed (${response.status}): ${body.slice(0, 280)}`);
  }
  return response.json();
};

const buildTight15FixtureEntries = (searchTerms = []) =>
  searchTerms.map((term, index) => ({
    id: `qa-tight15-${index + 1}-${String(term || "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    songTitle: String(term || "").trim(),
    artist: "QA Fixture",
    addedAt: Date.now() + index,
  }));

const fromFirestoreValue = (value = null) => {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return !!value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue || 0);
  if ("doubleValue" in value) return Number(value.doubleValue || 0);
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return Array.isArray(value.arrayValue?.values) ? value.arrayValue.values.map((entry) => fromFirestoreValue(entry)) : [];
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue?.fields || {}).map(([key, entry]) => [key, fromFirestoreValue(entry)])
    );
  }
  if ("nullValue" in value) return null;
  return null;
};

const createPageDiagnosticsBucket = () => [];

const recordPageDiagnostic = (bucket, kind, text) => {
  if (!Array.isArray(bucket)) return;
  const message = String(text || "").replace(/\s+/g, " ").trim();
  if (!message) return;
  bucket.push(`${kind}: ${message}`);
  if (bucket.length > MAX_PAGE_DIAGNOSTICS) {
    bucket.splice(0, bucket.length - MAX_PAGE_DIAGNOSTICS);
  }
};

const attachPageDiagnostics = (page, bucket) => {
  if (!page || !Array.isArray(bucket)) return;
  const isHostUpdateRequest = (url = "") => String(url || "").includes("updateRoomAsHost");
  page.on("pageerror", (error) => {
    recordPageDiagnostic(bucket, "pageerror", error?.stack || error?.message || error);
  });
  page.on("console", (msg) => {
    const type = String(msg?.type?.() || "").trim().toLowerCase();
    if (!["error", "warning"].includes(type)) return;
    recordPageDiagnostic(bucket, type, msg.text?.() || "");
  });
  page.on("requestfailed", (request) => {
    if (!isHostUpdateRequest(request?.url?.())) return;
    recordPageDiagnostic(bucket, "requestfailed", `${request.url()} ${request.failure()?.errorText || ""}`);
  });
  page.on("response", async (response) => {
    if (!isHostUpdateRequest(response?.url?.())) return;
    const status = Number(response?.status?.() || 0);
    const body = await response.text().catch(() => "");
    recordPageDiagnostic(
      bucket,
      "updateRoomAsHost",
      `${status} ${response.url()} ${String(body || "").slice(0, 240)}`
    );
  });
};

const formatRecentDiagnostics = (bucket) => {
  if (!Array.isArray(bucket) || !bucket.length) return "";
  return ` Diagnostics="${bucket.join(" | ").slice(0, 500)}"`;
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

const deriveSurfaceOriginFromRoot = (rootUrl = "", surface = "app") => {
  try {
    const parsed = new URL(String(rootUrl || "").trim());
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

const deriveHostUrlFromRoot = (rootUrl = "") => {
  const hostOrigin = deriveSurfaceOriginFromRoot(rootUrl, "host");
  if (!hostOrigin) return `${String(rootUrl || "").replace(/\/+$/, "")}/?mode=host`;
  return `${hostOrigin}/?mode=host&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`;
};

const deriveHostAccessUrl = (rootUrl = "") => {
  const hostOrigin = deriveSurfaceOriginFromRoot(rootUrl, "host");
  if (hostOrigin) return `${hostOrigin}/host-access`;
  return `${String(rootUrl || "").replace(/\/+$/, "")}/host-access`;
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

const advanceHostLaunchUi = async (page) => {
  const actions = [
    { locator: page.locator("[data-host-setup-skip-intro]").first(), delayMs: 1500 },
    { locator: page.getByRole("button", { name: /skip intro/i }).first(), delayMs: 1500 },
    { locator: page.getByRole("button", { name: /start night/i }).first(), delayMs: 1800 },
    { locator: page.getByRole("button", { name: /continue/i }).first(), delayMs: 1200 },
  ];

  for (const action of actions) {
    const visible = await action.locator.isVisible().catch(() => false);
    if (!visible) continue;
    const enabled = await action.locator.isEnabled().catch(() => false);
    if (!enabled) continue;
    await action.locator.click({ force: true });
    await delay(action.delayMs);
    return true;
  }

  return false;
};

const readHostRoomCode = async (page) => {
  const hooked = page.locator("[data-host-room-code]").first();
  if (await hooked.count()) {
    const text = sanitizeRoomCode(await hooked.innerText().catch(() => ""));
    if (isLikelyRoomCode(text)) return text;
  }
  return extractRoomCodeFromUrl(page.url());
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
  let lastCreateAttemptAt = 0;
  let guidedFlowAttempted = false;

  while (Date.now() - started < timeoutMs) {
    const code = await readHostRoomCode(page);
    if (code) return code;

    const createPrimary = page.locator("[data-host-create-room-primary]").first();
    if (await createPrimary.count()) {
      const visible = await createPrimary.isVisible().catch(() => false);
      const enabled = await createPrimary.isEnabled().catch(() => false);
      if (visible && enabled && (Date.now() - lastCreateAttemptAt) > 5000) {
        await createPrimary.click({ force: true });
        lastCreateAttemptAt = Date.now();
        await delay(900);
      }
    }

    const quickStart = page.locator("[data-host-quick-start]").first();
    if (await quickStart.count()) {
      const visible = await quickStart.isVisible().catch(() => false);
      const enabled = await quickStart.isEnabled().catch(() => false);
      if (visible && enabled && (Date.now() - lastCreateAttemptAt) > 5000) {
        await quickStart.click({ force: true });
        lastCreateAttemptAt = Date.now();
        await delay(900);
      }
    }

    if (!lastCreateAttemptAt && !guidedFlowAttempted) {
      guidedFlowAttempted = true;
      const guidedRoomCode = await runGuidedSetupWizardLaunch({ page, timeoutMs });
      if (guidedRoomCode) return guidedRoomCode;
    }

    const bodyText = String(await page.locator("body").innerText().catch(() => "")).toLowerCase();
    if (
      bodyText.includes("failed to create room") ||
      bodyText.includes("permission denied while creating room") ||
      bodyText.includes("could not establish auth")
    ) {
      throw new Error("Room creation failed while waiting for host room code.");
    }

    if (await advanceHostLaunchUi(page)) {
      continue;
    }

    await delay(1200);
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for host room code.`);
};

const gotoHostAccessAndLogin = async ({ page, rootUrl, email, password, timeoutMs }) => {
  const safeRoot = String(rootUrl || "").replace(/\/+$/, "");
  const candidates = [
    `${safeRoot}/host-access`,
    `${safeRoot}/?mode=marketing&page=host_access`,
    deriveHostAccessUrl(rootUrl),
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

    const hasHeading = await page.getByText(/Host Login \+ (Application|Room Manager)/i).first().isVisible().catch(() => false);
    const hasAuthForm = await page.locator("form").first().isVisible().catch(() => false);
    const hasSignedInState = await page.getByText(/Signed in as/i).first().isVisible().catch(() => false);
    if (hasHeading && (hasAuthForm || hasSignedInState)) {
      loaded = true;
      break;
    }
  }
  if (!loaded) {
    throw new Error(`Could not load host access route from root url "${rootUrl}".`);
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

  const loginSucceeded = await Promise.race([
    page
      .getByText(new RegExp(`Signed in as\\s+${String(email || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"))
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs })
      .then(() => true)
      .catch(() => false),
    page
      .locator("form .mk3-input-error, form [role='alert']")
      .first()
      .waitFor({ state: "visible", timeout: Math.min(15000, timeoutMs) })
      .then(() => false)
      .catch(() => false),
  ]);

  if (!loginSucceeded) {
    const bodyText = String(await page.locator("body").innerText().catch(() => "")).slice(0, 400);
    throw new Error(`Host login did not complete successfully. Page snippet="${bodyText}"`);
  }

  return `Logged in as ${email}.`;
};

const ensureHostControlBar = async ({ page, timeoutMs }) => {
  const started = Date.now();
  while (Date.now() - started < Math.min(timeoutMs, 50000)) {
    const toggle = page.locator('[data-feature-id="deck-automation-menu-toggle"]').first();
    if (await toggle.isVisible().catch(() => false)) {
      return "Host control bar ready.";
    }

    const openButton = page.getByRole("button", { name: /^Open$/i }).first();
    const openVisible = await openButton.isVisible().catch(() => false);
    const openEnabled = await openButton.isEnabled().catch(() => false);
    if (openVisible && openEnabled) {
      await openButton.click({ force: true });
      await delay(1500);
      continue;
    }

    if (await advanceHostLaunchUi(page)) {
      continue;
    }

    await delay(700);
  }
  throw new Error("Could not reach host top chrome controls.");
};

const clickHostGamesTab = async (page) => {
  const gamesTabCount = await page.locator('[data-host-tab="games"]').count().catch(() => 0);
  let clickedGamesTab = false;
  for (let index = 0; index < gamesTabCount; index += 1) {
    const tab = page.locator('[data-host-tab="games"]').nth(index);
    if (!(await tab.isVisible().catch(() => false))) continue;
    await tab.click({ force: true }).catch(() => {});
    clickedGamesTab = true;
    await delay(1200);
    break;
  }
  if (!clickedGamesTab) {
    clickedGamesTab = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[data-host-tab="games"]'));
      const visible = tabs.find((entry) => {
        if (!(entry instanceof HTMLElement)) return false;
        return entry.offsetWidth > 0 || entry.offsetHeight > 0 || entry.getClientRects().length > 0;
      });
      if (!visible) return false;
      visible.click();
      return true;
    }).catch(() => false);
    if (clickedGamesTab) {
      await delay(1200);
    }
  }
  if (!clickedGamesTab) {
    const fallbackTab = page.getByRole("button", { name: /^Games$/i }).first();
    if (await fallbackTab.isVisible().catch(() => false)) {
      await fallbackTab.click({ force: true }).catch(() => {});
      await delay(1200);
      clickedGamesTab = true;
    }
  }
  return clickedGamesTab;
};

const waitForGamesLauncher = async ({ page, timeoutMs }) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const quickLaunch = page.locator("[data-game-quick-launch]").first();
    if (await quickLaunch.isVisible().catch(() => false)) {
      return true;
    }
    await delay(500);
  }
  return false;
};

const dismissAudiencePreviewIfVisible = async (page) => {
  const selectors = [
    'button[title="Hide preview"]',
    'button[aria-label="Hide preview"]',
  ];
  for (const selector of selectors) {
    const button = page.locator(selector).last();
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click({ force: true }).catch(() => {});
    await delay(500);
    return true;
  }
  return false;
};

const navigateHostToGames = async ({ page, rootUrl, roomCode, timeoutMs }) => {
  await ensureHostControlBar({ page, timeoutMs });
  await clickHostGamesTab(page);
  if (await waitForGamesLauncher({ page, timeoutMs: Math.min(8000, timeoutMs) })) {
    await dismissAudiencePreviewIfVisible(page);
    return "Games launcher ready from current host page.";
  }

  const hostOrigin = deriveSurfaceOriginFromRoot(rootUrl, "host");
  if (!hostOrigin) {
    throw new Error(`Could not resolve host origin from root url "${rootUrl}".`);
  }
  const hostGamesUrl = `${hostOrigin}/?room=${encodeURIComponent(roomCode)}&mode=host&hostUiVersion=v2&view=games&section=games.live_controls&tab=games`;
  await page.goto(hostGamesUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await delay(2500);
  await ensureHostControlBar({ page, timeoutMs });
  await clickHostGamesTab(page);
  if (await waitForGamesLauncher({ page, timeoutMs })) {
    await dismissAudiencePreviewIfVisible(page);
    return hostGamesUrl;
  }
  const snippet = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 320);
  throw new Error(`Games launcher did not render quick launch buttons. Snippet="${snippet}"`);
};

const prepareRoomForMode = async ({
  hostPage,
  singerSessions = [],
  tvPage,
  rootUrl,
  hostUrl,
  appOrigin,
  tvOrigin,
  suppliedRoomCode = "",
  singerName,
  timeoutMs,
}) => {
  let roomCode = String(suppliedRoomCode || "").trim().toUpperCase();

  if (roomCode) {
    await hostPage.goto(`${deriveSurfaceOriginFromRoot(rootUrl, "host")}/?room=${encodeURIComponent(roomCode)}&mode=host`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
  } else {
    await hostPage.goto(hostUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await delay(1500);
    roomCode = await waitForHostRoomCode({ page: hostPage, timeoutMs });
  }

  if (!roomCode) {
    throw new Error("No room code available after host setup.");
  }

  await ensureHostControlBar({ page: hostPage, timeoutMs });

  for (const session of singerSessions) {
    await session.page.goto(`${appOrigin}/?room=${encodeURIComponent(roomCode)}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await delay(2200);
    await ensureSingerFixtureSession({
      page: session.page,
      roomCode,
      singerName: session.name || singerName,
      tight15SearchTerms: session.tight15SearchTerms || [],
      timeoutMs,
    });
    await delay(1200);
  }
  await delay(3500);

  await ensureTvReady({
    page: tvPage,
    tvUrl: `${tvOrigin}/?room=${encodeURIComponent(roomCode)}&mode=tv`,
    timeoutMs,
  });

  return roomCode;
};

const readSingerFixtureIdentity = async (page) => {
  const mainView = page.locator('[data-singer-view="main"]').first();
  if (await mainView.isVisible().catch(() => false)) {
    return {
      authUid: String((await mainView.getAttribute("data-singer-room-user").catch(() => "")) || "").trim(),
      joinedName: String((await mainView.getAttribute("data-singer-room-user-name").catch(() => "")) || "").trim(),
      joined: true,
    };
  }
  const joinView = page.locator('[data-singer-view="join"]').first();
  if (await joinView.isVisible().catch(() => false)) {
    return {
      authUid: String((await joinView.getAttribute("data-singer-auth-uid").catch(() => "")) || "").trim(),
      joinedName: "",
      joined: false,
    };
  }
  return { authUid: "", joinedName: "", joined: false };
};

const seedSingerFixtureMembership = async ({ roomCode, authUid, singerName, tight15SearchTerms = [] }) => {
  if (!roomCode || !authUid) {
    throw new Error("Cannot seed singer fixture without room code and auth uid.");
  }
  const docId = `${roomCode}_${authUid}`;
  const now = new Date();
  const fields = {
    uid: authUid,
    roomCode,
    name: singerName,
    avatar: "🎤",
    isVip: false,
    vipLevel: 0,
    fameLevel: 0,
    totalFamePoints: 0,
    points: 100,
    totalEmojis: 0,
    lastActiveAt: now,
    lastSeen: now,
  };
  if (Array.isArray(tight15SearchTerms) && tight15SearchTerms.length) {
    fields.tight15Temp = buildTight15FixtureEntries(tight15SearchTerms);
  }
  await patchFirestoreDocument({
    documentPath: `artifacts/${FIRESTORE_APP_ID}/public/data/room_users/${docId}`,
    fields,
  });
  return docId;
};

const waitForSingerJoinedMarker = async ({ page, timeoutMs }) => {
  const hasJoinedMarker = async () => {
    const mainView = page.locator('[data-singer-view="main"]').first();
    if (!(await mainView.isVisible().catch(() => false))) return false;
    const joinedUid = String((await mainView.getAttribute("data-singer-room-user").catch(() => "")) || "").trim();
    const joinedName = String((await mainView.getAttribute("data-singer-room-user-name").catch(() => "")) || "").trim();
    return !!(joinedUid && joinedName);
  };

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await hasJoinedMarker()) return true;
    await delay(300);
  }
  return false;
};

const joinSingerIfNeeded = async ({ page, singerName, timeoutMs }) => {
  const joinView = page.locator('[data-singer-view="join"]').first();
  const nameInput = page.locator('[data-singer-join-name]').first();
  const fallbackInput = page.getByPlaceholder(/Enter Your Name/i).first();
  const joinAuthReady = async () => {
    const authFlag = String((await joinView.getAttribute("data-singer-auth-ready").catch(() => "")) || "").trim().toLowerCase();
    return authFlag === "true";
  };
  const awaitJoinStateStart = Date.now();
  let needsJoin = false;
  while (Date.now() - awaitJoinStateStart < Math.min(timeoutMs, 30000)) {
    if (await hasJoinedMarker()) return "Singer already joined.";
    needsJoin =
      (await joinView.isVisible().catch(() => false)) ||
      (await nameInput.isVisible().catch(() => false)) ||
      (await fallbackInput.isVisible().catch(() => false));
    if (needsJoin) break;
    await delay(300);
  }
  if (!needsJoin) {
    const snippet = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 260);
    throw new Error(`Singer page never resolved to join or joined state. Snippet="${snippet}"`);
  }

  const authReadyStart = Date.now();
  while (Date.now() - authReadyStart < Math.min(timeoutMs, 30000)) {
    if (await joinAuthReady()) break;
    await delay(250);
  }
  if (!(await joinAuthReady())) {
    throw new Error("Singer join screen never became auth-ready.");
  }

  if (await nameInput.count()) {
    await nameInput.fill(singerName);
  } else {
    await fallbackInput.fill(singerName);
  }

  const emojiChoice = page.locator("button[data-emoji-id]:not([disabled])").first();
  if (await emojiChoice.count()) {
    await emojiChoice.click({ force: true }).catch(() => {});
    await delay(120);
  }

  const joinButton = page.locator("[data-singer-join-button]").first();
  if (await joinButton.count()) {
    await joinButton.click({ force: true });
  } else {
    await page.getByRole("button", { name: /JOIN THE PARTY/i }).first().click({ force: true });
  }

  const rulesCheckbox = page.locator("[data-singer-rules-checkbox]").first();
  const fallbackRulesCheckbox = page.getByRole("checkbox", { name: /I agree to the party rules/i }).first();
  let rulesVisible = false;
  const rulesDetectStart = Date.now();
  while (Date.now() - rulesDetectStart < Math.min(8000, timeoutMs)) {
    rulesVisible =
      (await rulesCheckbox.isVisible().catch(() => false)) ||
      (await fallbackRulesCheckbox.isVisible().catch(() => false));
    if (rulesVisible) break;
    if (await isSingerMainReady()) break;
    await delay(250);
  }

  if (rulesVisible) {
    if (await rulesCheckbox.count()) {
      const isChecked = await rulesCheckbox.isChecked().catch(() => false);
      if (!isChecked) await rulesCheckbox.check({ force: true });
    } else {
      const isChecked = await fallbackRulesCheckbox.isChecked().catch(() => false);
      if (!isChecked) await fallbackRulesCheckbox.check({ force: true });
    }

    const confirm = page.locator("[data-singer-rules-confirm]").first();
    if (await confirm.count()) {
      await confirm.click({ force: true });
    } else {
      await page.getByRole("button", { name: /Let's go/i }).first().click({ force: true });
    }
  }

  const joinedStart = Date.now();
  while (Date.now() - joinedStart < timeoutMs) {
    if (await waitForSingerJoinedMarker({ page, timeoutMs: 500 })) return "Singer joined the room.";
    await delay(400);
  }
  throw new Error("Singer join did not reach main/game view within timeout.");
};

const ensureSingerFixtureSession = async ({ page, roomCode, singerName, tight15SearchTerms = [], timeoutMs }) => {
  const initialIdentity = await readSingerFixtureIdentity(page);
  if (initialIdentity.joined && initialIdentity.authUid && initialIdentity.joinedName) {
    if (tight15SearchTerms.length) {
      await seedSingerFixtureMembership({
        roomCode,
        authUid: initialIdentity.authUid,
        singerName,
        tight15SearchTerms,
      });
    }
    return "Singer fixture already ready.";
  }

  try {
    await joinSingerIfNeeded({ page, singerName, timeoutMs: Math.min(timeoutMs, 30000) });
  } catch {
    // Fall through to direct fixture seeding for deterministic game QA.
  }

  const identity = await readSingerFixtureIdentity(page);
  const authUid = identity.authUid;
  if (!authUid) {
    throw new Error("Singer fixture never exposed an auth uid.");
  }
  await seedSingerFixtureMembership({ roomCode, authUid, singerName, tight15SearchTerms });
  const joined = await waitForSingerJoinedMarker({ page, timeoutMs });
  if (!joined) {
    throw new Error("Seeded singer fixture did not hydrate the joined singer view within timeout.");
  }
  return tight15SearchTerms.length
    ? `Singer fixture ready with ${tight15SearchTerms.length} Tight 15 entries.`
    : "Singer fixture ready.";
};

const readRoomState = async (roomCode) => {
  const payload = await getFirestoreDocument({
    documentPath: `artifacts/${FIRESTORE_APP_ID}/public/data/rooms/${roomCode}`,
  });
  return fromFirestoreValue({ mapValue: { fields: payload?.fields || {} } }) || {};
};

const seedSelfieSubmissionFixture = async ({ roomCode, promptId, authUid, userName }) => {
  if (!roomCode || !promptId || !authUid) {
    throw new Error("Cannot seed selfie submission without room code, prompt id, and auth uid.");
  }
  const docId = `${roomCode}_${promptId}_${authUid}`;
  const now = new Date();
  await patchFirestoreDocument({
    documentPath: `artifacts/${FIRESTORE_APP_ID}/public/data/selfie_submissions/${docId}`,
    fields: {
      roomCode,
      promptId,
      uid: authUid,
      userName,
      avatar: "🎤",
      url: QA_SELFIE_DATA_URL,
      approved: true,
      timestamp: now,
    },
  });
  return docId;
};

const getEntrySingerFixtures = (entry, fallbackSingerName = "QA Game Tester") => {
  const configured = Array.isArray(entry?.fixture?.singers) ? entry.fixture.singers : [];
  if (configured.length) {
    return configured.map((item, index) => ({
      name: String(item?.name || `${fallbackSingerName} ${index + 1}`).trim(),
      tight15SearchTerms: Array.isArray(item?.tight15SearchTerms) ? item.tight15SearchTerms.filter(Boolean) : [],
      role: String(item?.role || "").trim().toLowerCase(),
    }));
  }
  return [{ name: String(fallbackSingerName || "QA Game Tester").trim(), tight15SearchTerms: [], role: "" }];
};

const createSingerSessions = async ({ browser, fixtures = [], appOrigin = "" }) => {
  const sessions = [];
  for (const fixture of fixtures) {
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      isMobile: true,
      hasTouch: true,
    });
    await applyQaAppCheckDebugInitScript(context);
    if (appOrigin) {
      await context.grantPermissions(["camera"], { origin: appOrigin }).catch(() => {});
    }
    const page = await context.newPage();
    sessions.push({
      context,
      page,
      name: fixture.name,
      tight15SearchTerms: fixture.tight15SearchTerms || [],
      role: fixture.role || "",
    });
  }
  return sessions;
};

const closeSingerSessions = async (sessions = []) => {
  for (const session of sessions) {
    await session?.context?.close().catch(() => {});
  }
};

const openSingerSongsTab = async (page) => {
  const candidates = [
    page.locator('[data-feature-id="singer-nav-songs"]').first(),
    page.getByRole("button", { name: /^SONGS$/i }).first(),
  ];
  for (const button of candidates) {
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.scrollIntoViewIfNeeded().catch(() => {});
    await button.click({ force: true }).catch(() => {});
    await delay(1000);
    return true;
  }
  return false;
};

const openSingerTight15Tab = async (page) => {
  const started = Date.now();
  while (Date.now() - started < 12000) {
    const tight15Button = page.getByRole("button", { name: /TIGHT 15/i }).first();
    if (await tight15Button.isVisible().catch(() => false)) {
      await tight15Button.scrollIntoViewIfNeeded().catch(() => {});
      await tight15Button.click({ force: true }).catch(() => {});
      await delay(1200);
      return true;
    }
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.35, behavior: "auto" })).catch(() => {});
    await delay(500);
  }
  return false;
};

const seedSingerTight15 = async ({ page, searchTerms = [], timeoutMs, failureScreenshotPath = "" }) => {
  if (!Array.isArray(searchTerms) || !searchTerms.length) return "No Tight 15 fixture required.";
  const openedSongs = await openSingerSongsTab(page);
  if (!openedSongs) {
    throw new Error("Could not open Songs tab for singer fixture.");
  }
  const opened = await openSingerTight15Tab(page);
  if (!opened) {
    throw new Error("Could not open Tight 15 tab for singer fixture.");
  }
  const addNewButton = page.getByRole("button", { name: /\+\s*Add New/i }).first();
  if (await addNewButton.isVisible().catch(() => false)) {
    await addNewButton.click({ force: true }).catch(() => {});
    await delay(400);
  }
  const searchInput = page.getByPlaceholder(/Search songs to add to your Tight 15/i).first();
  await searchInput.waitFor({ state: "visible", timeout: timeoutMs });

  for (const term of searchTerms) {
    await searchInput.fill(term);
    let clicked = false;
    const waitStart = Date.now();
    while (!clicked && Date.now() - waitStart < Math.min(12000, timeoutMs)) {
      clicked = await page.evaluate((termText) => {
        const input = document.querySelector('input[placeholder*="Search songs to add to your Tight 15"]');
        if (!(input instanceof HTMLInputElement)) return false;
        const root = input.parentElement;
        if (!root) return false;
        const options = Array.from(root.querySelectorAll('div.cursor-pointer'));
        const exact = options.find((entry) => {
          const text = String(entry.textContent || "").toLowerCase();
          return text.includes(String(termText || "").toLowerCase()) && text.includes("add");
        });
        const fallback = options.find((entry) => String(entry.textContent || "").includes("Add"));
        const target = exact || fallback;
        if (!(target instanceof HTMLElement)) return false;
        target.click();
        return true;
      }, term).catch(() => false);
      if (clicked) break;
      await delay(500);
    }
    if (!clicked) {
      if (failureScreenshotPath) {
        await page.screenshot({ path: failureScreenshotPath, fullPage: true }).catch(() => {});
      }
      throw new Error(`Could not add Tight 15 search result for term "${term}".`);
    }
    await delay(1200);
  }

  return `Seeded Tight 15 with ${searchTerms.length} song(s).`;
};

const ensureTvReady = async ({ page, tvUrl, timeoutMs }) => {
  await page.goto(tvUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await delay(2200);

  const startShowBtn = page.getByRole("button", { name: /start show|tap to start|start/i }).first();
  const startVisible = await startShowBtn.isVisible().catch(() => false);
  const startEnabled = await startShowBtn.isEnabled().catch(() => false);
  if (startVisible && startEnabled) {
    await startShowBtn.click({ force: true });
    await delay(1400);
  }
  return "TV ready.";
};

const readHostLiveMode = async (page) => {
  const livePills = page.locator("[data-host-live-mode]");
  const count = await livePills.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const livePill = livePills.nth(index);
    if (!(await livePill.isVisible().catch(() => false))) continue;
    const modeAttr = String((await livePill.getAttribute("data-host-live-mode")) || "").trim();
    if (modeAttr) return modeAttr;
    const innerText = String(await livePill.innerText().catch(() => "")).trim();
    if (innerText) return innerText;
  }
  const visibleText = String(await page.getByText(/LIVE:/i).first().innerText().catch(() => "")).trim();
  if (visibleText) return visibleText;
  const bodyText = String(await page.locator("body").innerText().catch(() => ""));
  const liveMatch = bodyText.match(/LIVE:\s*([A-Z0-9_]+)/i);
  return liveMatch?.[1] || "";
};

const waitForBodySignal = async ({ page, selector = "", regex, timeoutMs }) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (selector) {
      const hooked = page.locator(selector).first();
      if (await hooked.isVisible().catch(() => false)) {
        return `Selector visible: ${selector}`;
      }
    }
    const bodyText = String(await page.locator("body").innerText().catch(() => ""));
    if (regex?.test(bodyText)) {
      return bodyText.replace(/\s+/g, " ").trim().slice(0, 220);
    }
    await delay(500);
  }
  const snippet = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 260);
  throw new Error(`Expected signal not found. Snippet="${snippet}"`);
};

const clickVisibleGameLaunchButton = async (page, gameId) => {
  const cards = page.locator(`[data-game-card="${gameId}"]`);
  const cardCount = await cards.count().catch(() => 0);
  for (let index = cardCount - 1; index >= 0; index -= 1) {
    const card = cards.nth(index);
    if (!(await card.isVisible().catch(() => false))) continue;
    await card.scrollIntoViewIfNeeded().catch(() => {});
    const button = card.locator(`[data-game-quick-launch="${gameId}"]`).first();
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.scrollIntoViewIfNeeded().catch(() => {});
    await button.click({ force: true }).catch(() => {});
    return true;
  }
  return page.evaluate((targetGameId) => {
    const cards = Array.from(document.querySelectorAll(`[data-game-card="${targetGameId}"]`));
    const visibleCard = cards
      .filter((entry) => {
        if (!(entry instanceof HTMLElement)) return false;
        return entry.offsetWidth > 0 || entry.offsetHeight > 0 || entry.getClientRects().length > 0;
      })
      .at(-1);
    if (!(visibleCard instanceof HTMLElement)) return false;
    visibleCard.scrollIntoView({ block: "center", inline: "center" });
    const button = visibleCard.querySelector(`[data-game-quick-launch="${targetGameId}"]`);
    if (!(button instanceof HTMLElement)) return false;
    button.click();
    return true;
  }, gameId).catch(() => false);
};

const setCheckboxState = async (locator, nextChecked) => {
  const visible = await locator.isVisible().catch(() => false);
  if (!visible) return false;
  const current = await locator.isChecked().catch(() => null);
  if (current === null || current === nextChecked) return true;
  if (nextChecked) {
    await locator.check({ force: true }).catch(() => {});
  } else {
    await locator.uncheck({ force: true }).catch(() => {});
  }
  return true;
};

const selectParticipantsByNames = async ({ page, containerSelector, names = [] }) => {
  const modal = page.locator(containerSelector).first();
  if (!(await modal.isVisible().catch(() => false))) return false;
  const targets = Array.isArray(names) ? names.filter(Boolean) : [];
  if (!targets.length) return true;
  for (const name of targets) {
    const button = modal.getByRole("button", { name: new RegExp(escapeRegex(name), "i") }).first();
    const visible = await button.waitFor({ state: "visible", timeout: 1200 }).then(() => true).catch(() => false);
    if (!visible) return false;
    await button.scrollIntoViewIfNeeded().catch(() => {});
    await button.click({ force: true });
    await delay(150);
  }
  return true;
};

const openGameConfigureModal = async ({ page, gameId, timeoutMs }) => {
  const button = page.locator(`[data-game-configure="${gameId}"]`).first();
  await button.waitFor({ state: "visible", timeout: timeoutMs });
  await button.click({ force: true });
  await delay(800);
  return true;
};

const completeBracketReadyFlow = async ({ page, timeoutMs }) => {
  await openGameConfigureModal({ page, gameId: "karaoke_bracket", timeoutMs });
  const createButton = page.locator('[data-feature-id="host-bracket-create"]').first();
  await createButton.waitFor({ state: "visible", timeout: timeoutMs });
  const createEnabled = await createButton.isEnabled().catch(() => false);
  if (!createEnabled) {
    const snippet = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 260);
    throw new Error(`Bracket create stayed disabled. Snippet="${snippet}"`);
  }
  await createButton.click({ force: true });
  await delay(1200);

  const queueNextButton = page.locator('[data-feature-id="host-bracket-queue-next"]').first();
  const queueVisible = await queueNextButton.isVisible().catch(() => false);
  const queueEnabled = await queueNextButton.isEnabled().catch(() => false);
  if (queueVisible && queueEnabled) {
    await queueNextButton.click({ force: true });
    await delay(1200);
  }

  return "Bracket created from ready singers.";
};

const drawOnDoodleCanvas = async (page) => {
  const canvas = page.locator('[data-feature-id="singer-doodle-canvas"]').first();
  await canvas.waitFor({ state: "visible", timeout: 15000 });
  await canvas.evaluate((node) => {
    const canvasEl = node;
    if (!(canvasEl instanceof HTMLCanvasElement)) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const width = canvasEl.width || 320;
    const height = canvasEl.height || 320;
    ctx.fillStyle = "#00C4D9";
    ctx.fillRect(width * 0.15, height * 0.2, width * 0.55, height * 0.1);
    ctx.fillStyle = "#EC4899";
    ctx.beginPath();
    ctx.arc(width * 0.72, height * 0.35, Math.max(10, width * 0.08), 0, Math.PI * 2);
    ctx.fill();
  });
};

const completeDoodleScenario = async ({ drawerPage, voterPage, tvPage, timeoutMs }) => {
  await drawOnDoodleCanvas(drawerPage);
  const submitButton = drawerPage.locator('[data-feature-id="singer-doodle-submit"]').first();
  await submitButton.click({ force: true });
  await waitForBodySignal({
    page: drawerPage,
    selector: '[data-feature-id="singer-doodle-submit"]',
    regex: /submitted|awaiting host approval/i,
    timeoutMs: Math.min(12000, timeoutMs),
  });
  await waitForBodySignal({
    page: tvPage,
    selector: '[data-feature-id="tv-doodle-oke"]',
    regex: /live sketches:\s*1|votes/i,
    timeoutMs: Math.min(12000, timeoutMs),
  });
  await waitForBodySignal({
    page: voterPage,
    selector: '[data-feature-id^="singer-doodle-vote-"]',
    regex: /vote for the best interpretation|gallery/i,
    timeoutMs: Math.min(20000, timeoutMs),
  });
  const voteButton = voterPage.locator('[data-feature-id^="singer-doodle-vote-"]').first();
  await voteButton.click({ force: true });
  await waitForBodySignal({
    page: voterPage,
    selector: "",
    regex: /voted/i,
    timeoutMs: Math.min(8000, timeoutMs),
  });
  return "Doodle submitted and audience vote locked.";
};

const completeSelfieScenario = async ({ submitterPage, voterPage, tvPage, roomCode, submitterName, timeoutMs }) => {
  const submitterIdentity = await readSingerFixtureIdentity(submitterPage);
  const selfieRoomCode = sanitizeRoomCode(roomCode || extractRoomCodeFromUrl(submitterPage.url()));
  let promptId = "";
  let participantUid = String(submitterIdentity.authUid || "").trim();
  const promptStarted = Date.now();
  while (Date.now() - promptStarted < Math.min(15000, timeoutMs)) {
    const roomState = await readRoomState(selfieRoomCode);
    promptId = String(roomState?.selfieChallenge?.promptId || "").trim();
    if (!participantUid) {
      participantUid = String(roomState?.selfieChallenge?.participants?.[0] || "").trim();
    }
    if (promptId) break;
    await delay(500);
  }
  await seedSelfieSubmissionFixture({
    roomCode: selfieRoomCode,
    promptId,
    authUid: participantUid,
    userName: submitterName,
  });
  const latestRoomState = await readRoomState(selfieRoomCode);
  await patchFirestoreDocument({
    documentPath: `artifacts/${FIRESTORE_APP_ID}/public/data/rooms/${selfieRoomCode}`,
    fields: {
      selfieChallenge: {
        ...(latestRoomState?.selfieChallenge || {}),
        status: "voting",
      },
    },
    updateMask: ["selfieChallenge"],
  });
  await waitForBodySignal({
    page: submitterPage,
    selector: '[data-feature-id="singer-selfie-challenge"]',
    regex: /submitted - waiting for votes|waiting for votes|status:\s*voting|selfie challenge/i,
    timeoutMs: Math.min(12000, timeoutMs),
  });
  await waitForBodySignal({
    page: tvPage,
    selector: '[data-feature-id="tv-selfie-challenge"]',
    regex: new RegExp(escapeRegex(submitterName), "i"),
    timeoutMs: Math.min(20000, timeoutMs),
  });
  await waitForBodySignal({
    page: voterPage,
    selector: '[data-feature-id^="singer-selfie-vote-"]',
    regex: /selfie challenge|vote/i,
    timeoutMs: Math.min(20000, timeoutMs),
  });
  const voteButton = voterPage.locator('[data-feature-id^="singer-selfie-vote-"]').first();
  await voteButton.click({ force: true });
  await delay(700);
  return "Selfie submitted and audience vote cast.";
};

const completeHostLaunchSetupIfNeeded = async ({ page, entry, timeoutMs }) => {
  const start = Date.now();
  const singerNames = Array.isArray(entry?.fixture?.singers)
    ? entry.fixture.singers.map((item) => String(item?.name || "").trim()).filter(Boolean)
    : [];
  const primarySingerNames = singerNames.length ? [singerNames[0]] : [];

  while (Date.now() - start < Math.min(25000, timeoutMs)) {
    const doodleModalVisible = entry.id === "doodle_oke"
      && await page.locator('[data-feature-id="host-doodle-prompts"]').first().isVisible().catch(() => false);
    if (doodleModalVisible) {
      const prompts = page.locator('[data-feature-id="host-doodle-prompts"]').first();
      if (await prompts.isVisible().catch(() => false)) {
        await prompts.fill("Draw a broken microphone\nDraw a dramatic key change");
      }
      const drawSeconds = page.locator('[data-feature-id="host-doodle-draw-seconds"]').first();
      const guessSeconds = page.locator('[data-feature-id="host-doodle-guess-seconds"]').first();
      if (await drawSeconds.isVisible().catch(() => false)) await drawSeconds.fill("5");
      if (await guessSeconds.isVisible().catch(() => false)) await guessSeconds.fill("5");
      const clearParticipants = page.locator('[data-feature-id="host-doodle-clear-participants"]').first();
      if (await clearParticipants.isVisible().catch(() => false)) {
        await clearParticipants.click({ force: true });
      }
      const selectedParticipants = await selectParticipantsByNames({
        page,
        containerSelector: '[data-feature-id="host-doodle-config"]',
        names: primarySingerNames,
      });
      if (!selectedParticipants) {
        await delay(400);
        continue;
      }
      const startButton = page.locator('[data-feature-id="host-doodle-start"]').first();
      if (await startButton.isVisible().catch(() => false)) {
        await startButton.click({ force: true });
        await delay(700);
        return true;
      }
    }

    const selfieModalVisible = entry.id === "selfie_challenge"
      && await page.locator('[data-feature-id="host-selfie-prompt"]').first().isVisible().catch(() => false);
    if (selfieModalVisible) {
      const prompt = page.locator('[data-feature-id="host-selfie-prompt"]').first();
      if (await prompt.isVisible().catch(() => false)) {
        await prompt.fill("Show your best fake encore face");
      }
      await setCheckboxState(page.locator('[data-feature-id="host-selfie-require-approval"]').first(), false);
      await setCheckboxState(page.locator('[data-feature-id="host-selfie-auto-start-voting"]').first(), true);
      const clearParticipants = page.locator('[data-feature-id="host-selfie-clear-participants"]').first();
      if (await clearParticipants.isVisible().catch(() => false)) {
        await clearParticipants.click({ force: true });
      }
      const selectedParticipants = await selectParticipantsByNames({
        page,
        containerSelector: '[data-feature-id="host-selfie-config"]',
        names: primarySingerNames,
      });
      if (!selectedParticipants) {
        await delay(400);
        continue;
      }
      const startButton = page.locator('[data-feature-id="host-selfie-start"]').first();
      if (await startButton.isVisible().catch(() => false)) {
        await startButton.click({ force: true });
        await delay(700);
        return true;
      }
    }

    await delay(250);
  }

  return false;
};

const performInteraction = async ({ page, interaction, timeoutMs }) => {
  if (!interaction) return "No audience interaction configured.";

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (interaction.type === "click_selector") {
      const target = page.locator(interaction.selector).first();
      if (await target.isVisible().catch(() => false)) {
        await target.click({ force: true });
        await delay(700);
        const bodyText = String(await page.locator("body").innerText().catch(() => ""));
        if (!interaction.successRegex || interaction.successRegex.test(bodyText)) {
          return bodyText.replace(/\s+/g, " ").trim().slice(0, 220);
        }
      }
    } else if (interaction.type === "click_text") {
      const target = page.getByText(interaction.textRegex).first();
      if (await target.isVisible().catch(() => false)) {
        await target.click({ force: true });
        await delay(700);
        const bodyText = String(await page.locator("body").innerText().catch(() => ""));
        if (!interaction.successRegex || interaction.successRegex.test(bodyText)) {
          return bodyText.replace(/\s+/g, " ").trim().slice(0, 220);
        }
      }
    }
    await delay(400);
  }

  const snippet = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 260);
  throw new Error(`Interaction did not reach expected confirmation. Snippet="${snippet}"`);
};

const launchGameMode = async ({ page, entry, timeoutMs, diagnostics = [], failureScreenshotPath = "" }) => {
  const launchButton = page.locator(`[data-game-quick-launch="${entry.id}"]`);
  if ((await launchButton.count().catch(() => 0)) === 0) {
    throw new Error(`Quick launch button missing for ${entry.id}.`);
  }
  await clickVisibleGameLaunchButton(page, entry.id);

  const started = Date.now();
  let usedDomClickFallback = false;
  let lastLiveMode = "";
  while (Date.now() - started < Math.min(30000, timeoutMs)) {
    const liveMode = String(await readHostLiveMode(page).catch(() => "")).trim().toLowerCase();
    if (liveMode) lastLiveMode = liveMode;
    const bodyText = String(await page.locator("body").innerText().catch(() => ""));
    const normalizedBodyText = bodyText.toLowerCase();
    if (entry.expectedHostModes.some((mode) => liveMode.includes(mode) || normalizedBodyText.includes(`live: ${mode}`))) {
      if (entry.id === "karaoke_bracket") {
        const bracketDetail = await completeBracketReadyFlow({ page, timeoutMs });
        return `Host live mode: ${liveMode || "body-match"} | ${bracketDetail}`;
      }
      return `Host live mode: ${liveMode || "body-match"}`;
    }
    if (/add a prompt and pick participants|add prompts or a topic first|add a bingo board first|no trivia questions available|no wyr prompts available|need at least \d+ (selected )?singers with .*tight 15 songs/i.test(bodyText)) {
      throw new Error(bodyText.replace(/\s+/g, " ").trim().slice(0, 220));
    }
    const completedConfig = await completeHostLaunchSetupIfNeeded({ page, entry, timeoutMs });
    if (completedConfig) {
      await delay(500);
      continue;
    }
    if (!usedDomClickFallback && Date.now() - started > 2500) {
      const clicked = await clickVisibleGameLaunchButton(page, entry.id);
      usedDomClickFallback = clicked;
    }
    await delay(500);
  }

  const finalBodyText = String(await page.locator("body").innerText().catch(() => ""));
  const normalizedFinalBodyText = finalBodyText.toLowerCase();
  if (entry.expectedHostModes.some((mode) => normalizedFinalBodyText.includes(`live: ${mode}`))) {
    return "Host live mode: body-match-final";
  }
  if (failureScreenshotPath) {
    await page.screenshot({ path: failureScreenshotPath, fullPage: true }).catch(() => {});
  }
  const snippet = finalBodyText.replace(/\s+/g, " ").trim().slice(0, 260);
  throw new Error(`Mode launch did not become active for ${entry.id}. LastLiveMode="${lastLiveMode}". Snippet="${snippet}".${formatRecentDiagnostics(diagnostics)}`);
};

const endHostMode = async ({ page, timeoutMs, entry = null }) => {
  const endModeButton = page.getByRole("button", { name: /End Mode/i }).first();
  if (!(await endModeButton.isVisible().catch(() => false))) {
    throw new Error("End Mode button is not visible on host controlpad.");
  }
  await endModeButton.click({ force: true });

  const started = Date.now();
  while (Date.now() - started < Math.min(20000, timeoutMs)) {
    const livePill = page.locator("[data-host-live-mode]").first();
    if ((await livePill.count()) === 0) {
      return "Host returned to karaoke (live mode pill cleared).";
    }
    const attr = String((await livePill.getAttribute("data-host-live-mode")) || "").trim().toLowerCase();
    if (!attr || attr === "karaoke") {
      return `Host returned to ${attr || "karaoke"}.`;
    }
    await delay(500);
  }
  if (entry?.id === "karaoke_bracket") {
    const clearBracketButton = page.locator('[data-feature-id="host-bracket-clear"]').first();
    const clearVisible = await clearBracketButton.isVisible().catch(() => false);
    const clearEnabled = await clearBracketButton.isEnabled().catch(() => false);
    if (clearVisible && clearEnabled) {
      await clearBracketButton.click({ force: true });
      const retryStarted = Date.now();
      while (Date.now() - retryStarted < Math.min(15000, timeoutMs)) {
        const livePill = page.locator("[data-host-live-mode]").first();
        if ((await livePill.count()) === 0) {
          return "Host cleared bracket and returned to karaoke.";
        }
        const attr = String((await livePill.getAttribute("data-host-live-mode")) || "").trim().toLowerCase();
        if (!attr || attr === "karaoke") {
          return `Host cleared bracket and returned to ${attr || "karaoke"}.`;
        }
        await delay(500);
      }
    }
  }
  throw new Error("Host did not return to karaoke within timeout after End Mode.");
};

const run = async () => {
  const rootUrl = process.env.QA_ROOT_URL || DEFAULT_ROOT_URL;
  const hostUrl = process.env.QA_HOST_URL || deriveHostUrlFromRoot(rootUrl);
  const appOrigin = deriveSurfaceOriginFromRoot(rootUrl, "app") || rootUrl;
  const tvOrigin = deriveSurfaceOriginFromRoot(rootUrl, "tv") || rootUrl;
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = !toBool(process.env.QA_HEADFUL, false);
  const failureScreenshotPath = process.env.QA_FAILURE_SCREENSHOT || DEFAULT_FAILURE_SCREENSHOT;
  const email = String(process.env.QA_HOST_EMAIL || "").trim();
  const password = String(process.env.QA_HOST_PASSWORD || "");
  const singerName = String(process.env.QA_SINGER_NAME || "QA Game Tester").trim();
  const suppliedRoomCode = sanitizeRoomCode(process.env.QA_ROOM_CODE || "");
  const modeFilter = String(process.env.QA_GAME_MODE_FILTER || "")
    .split(",")
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);
  const activeMatrix = modeFilter.length
    ? HOST_GAME_MATRIX.filter((entry) => modeFilter.includes(entry.id))
    : HOST_GAME_MATRIX;

  if (!email || !password) {
    throw new Error("QA_HOST_EMAIL and QA_HOST_PASSWORD are required for host game matrix testing.");
  }
  if (!activeMatrix.length) {
    throw new Error("QA_GAME_MODE_FILTER did not match any host game matrix entries.");
  }

  requireQaAppCheckDebugTokenForRemoteUrl(rootUrl);
  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({
    headless,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  const checks = [];
  const modeResults = [];
  const hostDiagnostics = createPageDiagnosticsBucket();

  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  await applyQaAppCheckDebugInitScript(hostContext);
  await applyQaAppCheckDebugInitScript(tvContext);

  const hostPage = await hostContext.newPage();
  const tvPage = await tvContext.newPage();
  attachPageDiagnostics(hostPage, hostDiagnostics);

  let roomCode = suppliedRoomCode;
  let scenarioFailure = false;

  try {
    await runCheck(checks, "host_login_from_root_domain", async () =>
      gotoHostAccessAndLogin({ page: hostPage, rootUrl, email, password, timeoutMs })
    );

    for (const entry of activeMatrix) {
      const gameChecks = [];
      let singerSessions = [];
      hostDiagnostics.length = 0;

      try {
        singerSessions = await createSingerSessions({
          browser,
          fixtures: getEntrySingerFixtures(entry, singerName),
          appOrigin,
        });
        const primarySingerPage = singerSessions[0]?.page;

        await runCheck(gameChecks, `${entry.id}:room_ready`, async () => {
          roomCode = await prepareRoomForMode({
            hostPage,
            singerSessions,
            tvPage,
            rootUrl,
            hostUrl,
            appOrigin,
            tvOrigin,
            suppliedRoomCode,
            singerName,
            timeoutMs,
          });
          return suppliedRoomCode
            ? `Using provided room code ${roomCode}.`
            : `Created room ${roomCode}.`;
        });

        const roomReadyPassed = gameChecks.every((item) => item.pass);
        if (roomReadyPassed) {
          await runCheck(gameChecks, `${entry.id}:launch`, async () => {
            await navigateHostToGames({ page: hostPage, rootUrl, roomCode, timeoutMs });
            return launchGameMode({
              page: hostPage,
              entry,
              timeoutMs,
              diagnostics: hostDiagnostics,
              failureScreenshotPath: `tmp/qa-host-game-${entry.id}-failure.png`,
            });
          });
        }

        const launchPassed = gameChecks.every((item) => item.pass);
        if (launchPassed && primarySingerPage) {
          await runCheck(gameChecks, `${entry.id}:audience`, async () =>
            waitForBodySignal({
              page: primarySingerPage,
              selector: entry.audienceSelector,
              regex: entry.audienceRegex,
              timeoutMs: Math.min(25000, timeoutMs),
            })
          );

          if (entry.id === "doodle_oke" && singerSessions[1]?.page) {
            await runCheck(gameChecks, `${entry.id}:scenario`, async () =>
              completeDoodleScenario({
                drawerPage: singerSessions[0].page,
                voterPage: singerSessions[1].page,
                tvPage,
                timeoutMs,
              })
            );
          } else if (entry.id === "selfie_challenge" && singerSessions[1]?.page) {
            await runCheck(gameChecks, `${entry.id}:scenario`, async () =>
              completeSelfieScenario({
                submitterPage: singerSessions[0].page,
                voterPage: singerSessions[1].page,
                tvPage,
                roomCode,
                submitterName: singerSessions[0]?.name || "Singer",
                timeoutMs,
              })
            );
          } else if (entry.interaction) {
            await runCheck(gameChecks, `${entry.id}:interaction`, async () =>
              performInteraction({
                page: primarySingerPage,
                interaction: entry.interaction,
                timeoutMs: Math.min(20000, timeoutMs),
              })
            );
          }

          await runCheck(gameChecks, `${entry.id}:tv`, async () =>
            waitForBodySignal({
              page: tvPage,
              selector: entry.tvSelector,
              regex: entry.tvRegex,
              timeoutMs: Math.min(25000, timeoutMs),
            })
          );

          await runCheck(gameChecks, `${entry.id}:end_mode`, async () =>
            endHostMode({ page: hostPage, timeoutMs, entry })
          );
        }

        modeResults.push({
          id: entry.id,
          hostLabel: entry.hostLabel,
          roomCode,
          ok: gameChecks.every((item) => item.pass),
          checks: gameChecks,
        });
      } finally {
        await closeSingerSessions(singerSessions);
      }
    }
  } catch (error) {
    scenarioFailure = true;
    checks.push({
      name: "scenario_failure",
      pass: false,
      detail: String(error?.message || error),
    });
    try {
      await hostPage.screenshot({ path: failureScreenshotPath, fullPage: true });
    } catch {
      // ignore screenshot errors
    }
  } finally {
    await hostContext.close();
    await tvContext.close();
    await browser.close();
  }

  const failedChecks = checks.filter((check) => !check.pass);
  const failedModes = modeResults.filter((entry) => !entry.ok);
  const output = {
    ok: !scenarioFailure && failedChecks.length === 0 && failedModes.length === 0,
    rootUrl,
    hostUrl,
    appOrigin,
    tvOrigin,
    roomCode,
    singerName,
    modeFilter,
    headless,
    timeoutMs,
    checks,
    modeResults,
    failedCount: failedChecks.length + failedModes.length,
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
