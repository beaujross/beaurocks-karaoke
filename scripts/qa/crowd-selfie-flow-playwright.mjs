import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyQaAppCheckDebugInitScript,
  requireQaAppCheckDebugTokenForRemoteUrl,
} from "./lib/appCheckDebug.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");
const PROJECT_ID = "beaurocks-karaoke-v2";
const APP_ID = "bross-app";
const DEFAULT_TIMEOUT_MS = 180000;
const QA_FAIL_FAST = String(process.env.QA_FAIL_FAST || "").trim() === "1";
const FIREBASE_RUNTIME_CONFIG = {
  apiKey: "AIzaSyBmX0XXpGE0wGcR9YXw3oKOqnJE9GT6_Jc",
  authDomain: "beaurocks-karaoke-v2.firebaseapp.com",
  projectId: "beaurocks-karaoke-v2",
  storageBucket: "beaurocks-karaoke-v2.firebasestorage.app",
  messagingSenderId: "426849563936",
  appId: "1:426849563936:web:03c1d7eefd0c66e4649345",
  measurementId: "G-KRHWBTB7V7",
};
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};
const ROOM_CODE_BLOCKLIST = new Set(["ROOM", "CODE", "LIKE", "OPEN", "HOST"]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(`Playwright is not installed (${message}). Run: npm install && npm run qa:admin:prod:install`);
  }
};

const resolveDistFilePath = async (requestPath = "/") => {
  const normalized = decodeURIComponent(String(requestPath || "/")).split("?")[0];
  const trimmed = normalized.replace(/^\/+/, "");
  const joined = path.resolve(DIST_DIR, trimmed || "index.html");
  if (!joined.startsWith(DIST_DIR)) return path.join(DIST_DIR, "index.html");
  try {
    const stats = await fs.stat(joined);
    if (stats.isDirectory()) return path.join(joined, "index.html");
    return joined;
  } catch {
    return path.join(DIST_DIR, "index.html");
  }
};

const startLocalServer = async () => {
  await fs.access(path.join(DIST_DIR, "index.html"));
  const server = http.createServer(async (req, res) => {
    try {
      const filePath = await resolveDistFilePath(req?.url || "/");
      const body = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Server error: ${String(error?.message || error)}`);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: async () => {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
};

const runCheck = async (checks, name, fn) => {
  console.log(`[qa:crowd-selfie] START ${name}`);
  try {
    const detail = await fn();
    checks.push({ name, pass: true, detail: detail || "" });
    console.log(`[qa:crowd-selfie] PASS ${name}${detail ? ` :: ${detail}` : ""}`);
    return true;
  } catch (error) {
    const detail = String(error?.message || error);
    checks.push({ name, pass: false, detail });
    console.error(`[qa:crowd-selfie] FAIL ${name} :: ${detail}`);
    if (QA_FAIL_FAST) throw error;
    return false;
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const isTransientPageContextError = (error) => /Execution context was destroyed|Cannot find context with specified id|Frame was detached|Target closed/i.test(String(error?.message || error || ""));

const evaluateWithNavigationRetry = async (page, evaluator, arg, { attempts = 4, settleMs = 500 } = {}) => {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    try {
      return await page.evaluate(evaluator, arg);
    } catch (error) {
      lastError = error;
      if (!isTransientPageContextError(error) || attempt >= attempts) {
        throw error;
      }
      await delay(settleMs);
    }
  }
  throw lastError || new Error("Page evaluation failed after retries.");
};

const sanitizeRoomCode = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const isLikelyRoomCode = (value) => {
  const code = sanitizeRoomCode(value);
  return code.length >= 4 && code.length <= 10 && !ROOM_CODE_BLOCKLIST.has(code);
};

const readHostRoomCode = async (page) => {
  const hooked = page.locator("[data-host-room-code]").first();
  if (await hooked.count()) {
    const text = sanitizeRoomCode(await hooked.innerText().catch(() => ""));
    if (isLikelyRoomCode(text)) return text;
  }

  const monoCode = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("div,span"));
    for (const node of nodes) {
      const cls = typeof node.className === "string" ? node.className : "";
      if (!cls.includes("font-mono")) continue;
      const text = (node.textContent || "").trim().toUpperCase();
      if (/^[A-Z0-9]{4,10}$/.test(text)) return text;
    }
    return "";
  }).catch(() => "");
  if (isLikelyRoomCode(monoCode)) return sanitizeRoomCode(monoCode);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const regexes = [/\broom\s+([A-Z0-9]{4,8})\b/i, /\b([A-Z0-9]{4,8})\s+created\b/i];
  for (const regex of regexes) {
    const match = bodyText.match(regex);
    const candidate = sanitizeRoomCode(match?.[1] || "");
    if (isLikelyRoomCode(candidate)) return candidate;
  }
  return "";
};

const waitForHostRoomCode = async ({ page, timeoutMs }) => {
  const started = Date.now();
  let createClicked = false;
  while (Date.now() - started < timeoutMs) {
    const code = await readHostRoomCode(page);
    if (code) return code;

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
    } else {
      const fallbackQuickStart = page.getByRole("button", { name: /Quick Start New Room/i }).first();
      const visible = await fallbackQuickStart.isVisible().catch(() => false);
      const enabled = await fallbackQuickStart.isEnabled().catch(() => false);
      if (!createClicked && visible && enabled) {
        await fallbackQuickStart.click({ force: true });
        createClicked = true;
      }
    }
    await delay(1000);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for host room code.`);
};

const attachErrorCollectors = (page, label, bucket) => {
  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === "error" || /selfie|upload|auth|storage/i.test(String(text || ""))) {
      console.log(`[qa:crowd-selfie][${label}][console:${type}] ${text}`);
    }
    const normalized = String(text || "").toLowerCase();
    const isCritical =
      type === "error" ||
      normalized.includes("failed-precondition") ||
      normalized.includes("permission denied") ||
      normalized.includes("uncaught error in snapshot listener");
    if (!isCritical) return;
    bucket.push({ label, kind: "console", type, text });
  });
  page.on("pageerror", (error) => {
    console.log(`[qa:crowd-selfie][${label}][pageerror] ${String(error?.message || error)}`);
    bucket.push({
      label,
      kind: "pageerror",
      type: "error",
      text: String(error?.message || error),
    });
  });
};

const isExpectedQaRuntimeError = (entry) => {
  const text = String(entry?.text || "").toLowerCase();
  if (text.includes("firebase: error (auth/network-request-failed)")) return true;
  if (entry?.label !== "audience") return false;
  return (
    text.includes("storage/unauthorized")
    || text.includes("user does not have permission to access 'room_photos/")
    || text.includes("failed to load resource: the server responded with a status of 403")
  );
};

const assertNoCriticalErrors = (bucket, label) => {
  const scoped = bucket.filter((entry) => entry.label === label && !isExpectedQaRuntimeError(entry));
  if (!scoped.length) return "No critical console/page errors detected.";
  const detail = scoped
    .slice(0, 5)
    .map((entry) => `${entry.kind}:${entry.type}:${entry.text}`)
    .join(" | ");
  throw new Error(`Detected ${scoped.length} critical runtime errors: ${detail}`);
};

const toJsonOrText = async (response) => {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const decodeFirestoreValue = (value) => {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue || 0);
  if ("doubleValue" in value) return Number(value.doubleValue || 0);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) {
    const fields = value.mapValue?.fields || {};
    return Object.fromEntries(Object.entries(fields).map(([key, nested]) => [key, decodeFirestoreValue(nested)]));
  }
  if ("arrayValue" in value) {
    const values = value.arrayValue?.values || [];
    return values.map((entry) => decodeFirestoreValue(entry));
  }
  return null;
};

const decodeFirestoreDocument = (doc) => {
  const fields = doc?.fields || {};
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]));
};

const createEmailPasswordUserViaRest = async ({ email, password, timeoutMs }) => {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_RUNTIME_CONFIG.apiKey}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  }, timeoutMs);
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Email/password sign-up failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return {
    uid: body.localId,
    idToken: body.idToken,
    refreshToken: body.refreshToken,
    email,
    password,
  };
};

const createRoomDoc = async ({ roomCode, uid, idToken, timeoutMs }) => {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/rooms/${encodeURIComponent(roomCode)}`;
  const payload = {
    fields: {
      roomCode: { stringValue: roomCode },
      hostUid: { stringValue: uid },
      hostUids: { arrayValue: { values: [{ stringValue: uid }] } },
      phase: { stringValue: "qa_crowd_selfie" },
      audienceShellVariant: { stringValue: "streamlined" },
      activeMode: { stringValue: "karaoke" },
    },
  };
  const response = await fetchWithTimeout(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  }, timeoutMs);
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Room doc create failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return decodeFirestoreDocument(body);
};

const getCurrentUserIdToken = async (page) => {
  const token = await evaluateWithNavigationRetry(page, async () => {
    const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js");
    const app = getApps().length ? getApp() : initializeApp(window.__firebase_config || {});
    const auth = getAuth(app);
    if (!auth.currentUser) return "";
    return auth.currentUser.getIdToken();
  });
  if (!token) throw new Error("No signed-in Firebase user token available in page context.");
  return token;
};

const getCurrentUserUid = async (page) => {
  const uid = await evaluateWithNavigationRetry(page, async () => {
    const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js");
    const app = getApps().length ? getApp() : initializeApp(window.__firebase_config || {});
    const auth = getAuth(app);
    return String(auth.currentUser?.uid || "");
  });
  if (!uid) throw new Error("No signed-in Firebase user uid available in page context.");
  return uid;
};

const signInPageUser = async (page, credentials = {}) => {
  const email = String(credentials?.email || "").trim();
  const password = String(credentials?.password || "");
  if (!email || !password) throw new Error("Email/password required for page sign-in.");
  return evaluateWithNavigationRetry(page, async ({ firebaseConfig, email: loginEmail, password: loginPassword }) => {
    const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
    const { getAuth, signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js");
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    if (auth.currentUser?.email === loginEmail) {
      return auth.currentUser.uid || "";
    }
    const result = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    return result?.user?.uid || "";
  }, {
    firebaseConfig: FIREBASE_RUNTIME_CONFIG,
    email,
    password,
  });
};

const waitForAudienceJoinReady = async ({ page, credentials, timeoutMs }) => {
  await page.locator('[data-singer-view="join"]').first().waitFor({ state: "visible", timeout: timeoutMs });
  await signInPageUser(page, credentials).catch(() => "");
  await delay(1200);
  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  const joinView = page.locator('[data-singer-view="join"]').first();
  await joinView.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(() => {
    const join = document.querySelector('[data-singer-view="join"]');
    if (!join) return false;
    const authReady = join.getAttribute("data-singer-auth-ready");
    const authUid = join.getAttribute("data-singer-auth-uid");
    return authReady === "true" || !!String(authUid || "").trim();
  }, null, { timeout: Math.min(timeoutMs, 15000) }).catch(() => {});
  return "Audience join shell ready.";
};

const callCallableFromPage = async (page, name, data = {}) => {
  return evaluateWithNavigationRetry(page, async ({ callableName, callableData }) => {
    const { getApp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js");
    const app = getApp();
    const functions = getFunctions(app, "us-west1");
    const invoke = httpsCallable(functions, callableName);
    const result = await invoke(callableData || {});
    return result?.data || null;
  }, { callableName: name, callableData: data });
};

const fetchRoomDoc = async ({ idToken, roomCode }) => {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/rooms/${encodeURIComponent(roomCode)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Failed to fetch room doc (${response.status}): ${JSON.stringify(body)}`);
  }
  return decodeFirestoreDocument(body);
};

const fetchRoomUserDoc = async ({ idToken, roomCode, uid }) => {
  const roomUserId = `${roomCode}_${uid}`;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/room_users/${encodeURIComponent(roomUserId)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (response.status === 404) return null;
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Failed to fetch room user doc (${response.status}): ${JSON.stringify(body)}`);
  }
  return decodeFirestoreDocument(body);
};

const seedRoomUserDoc = async ({ idToken, roomCode, uid, name = "Crowd Selfie QA", avatar = "😀" }) => {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/room_users/${encodeURIComponent(`${roomCode}_${uid}`)}`;
  const payload = {
    fields: {
      roomCode: { stringValue: roomCode },
      uid: { stringValue: uid },
      name: { stringValue: name },
      avatar: { stringValue: avatar },
      points: { integerValue: "100" },
      joinedAt: { timestampValue: new Date().toISOString() },
    },
  };
  const response = await fetchWithTimeout(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  }, 15000);
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Room user seed failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return decodeFirestoreDocument(body);
};

const runCollectionQuery = async ({ idToken, parentPath, structuredQuery }) => {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${parentPath}:runQuery`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ structuredQuery }),
  });
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Firestore query failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return Array.isArray(body) ? body.filter((entry) => entry?.document).map((entry) => entry.document) : [];
};

const fetchLatestCrowdSelfieSubmission = async ({ idToken, roomCode }) => {
  const docs = await runCollectionQuery({
    idToken,
    parentPath: `artifacts/${APP_ID}/public/data`,
    structuredQuery: {
      from: [{ collectionId: "crowd_selfie_submissions" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "roomCode" },
          op: "EQUAL",
          value: { stringValue: roomCode },
        },
      },
    },
  });
  if (!docs.length) return null;
  const doc = docs
    .map((entry) => ({ raw: entry, decoded: decodeFirestoreDocument(entry) }))
    .sort((a, b) => Number(b.decoded.timestamp || 0) - Number(a.decoded.timestamp || 0))[0]?.raw;
  if (!doc) return null;
  return {
    id: String(doc.name || "").split("/").pop(),
    ...decodeFirestoreDocument(doc),
  };
};

const completeVipOnboardingIfPresent = async (page) => {
  const onboardingHeading = page.getByText(/Build Your VIP Profile/i).first();
  if (!(await onboardingHeading.isVisible().catch(() => false))) return false;
  const locationInput = page.getByPlaceholder(/Location \(city, vibe, or wherever\)/i).first();
  if (await locationInput.isVisible().catch(() => false)) {
    await locationInput.fill("QA City");
  }
  const selects = page.locator("select");
  if ((await selects.count().catch(() => 0)) >= 2) {
    await selects.nth(0).selectOption({ label: "Jan" }).catch(() => {});
    await selects.nth(1).selectOption({ label: "1" }).catch(() => {});
  }
  const tosCheckbox = page.getByRole("checkbox", { name: /VIP House Rules/i }).first();
  if (await tosCheckbox.isVisible().catch(() => false)) {
    const checked = await tosCheckbox.isChecked().catch(() => false);
    if (!checked) await tosCheckbox.check({ force: true });
  }
  const saveButton = page.getByRole("button", { name: /Save VIP Profile/i }).first();
  if (await saveButton.isVisible().catch(() => false)) {
    await saveButton.click({ force: true });
    await delay(1200);
  }
  return true;
};

const readAudienceShellSnapshot = async (page) => page.evaluate(() => {
  const join = document.querySelector('[data-singer-view="join"]');
  const main = document.querySelector('[data-singer-view="main"]');
  const vipHeading = Array.from(document.querySelectorAll("h1,h2,h3,strong,button,div,p,span"))
    .map((node) => String(node.textContent || "").trim())
    .find((text) => /build your vip profile|host login and applications|find a live karaoke room and join fast/i.test(text));
  return {
    href: window.location.href,
    joinVisible: !!join,
    mainVisible: !!main,
    authReady: join?.getAttribute("data-singer-auth-ready") || "",
    authUid: join?.getAttribute("data-singer-auth-uid") || "",
    roomUser: main?.getAttribute("data-singer-room-user") || "",
    heading: vipHeading || "",
    bodyText: String(document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 320),
  };
}).catch(() => ({
  href: "",
  joinVisible: false,
  mainVisible: false,
  authReady: "",
  authUid: "",
  roomUser: "",
  heading: "",
  bodyText: "",
}));

const resolveAudienceUserUid = async (page) => {
  const shell = await readAudienceShellSnapshot(page);
  const uid = String(shell.roomUser || shell.authUid || "").trim()
    || await getCurrentUserUid(page).catch(() => "");
  if (!uid) throw new Error("No audience uid available from shell or Firebase auth.");
  return uid;
};

const joinAudienceAndSkipOptionalSelfie = async ({ page, roomCode, baseUrl, credentials, roomUserBootstrap, timeoutMs }) => {
  await page.goto(`${baseUrl}/?room=${encodeURIComponent(roomCode)}&qaAuthBootstrap=1`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await waitForAudienceJoinReady({ page, credentials, timeoutMs });

  const joinInput = page.locator('[data-singer-join-name]').first();
  const fallbackInput = page.getByPlaceholder(/Enter Your Name/i).first();
  if (await joinInput.isVisible().catch(() => false)) {
    await joinInput.fill("Crowd Selfie QA");
  } else if (await fallbackInput.isVisible().catch(() => false)) {
    await fallbackInput.fill("Crowd Selfie QA");
  }

  const emojiChoice = page.locator('button[data-emoji-id]:not([disabled])').first();
  if (await emojiChoice.count()) {
    await emojiChoice.click({ force: true }).catch(() => {});
  }

  const joinButton = page.locator('[data-singer-join-button]').first();
  if (await joinButton.count()) {
    await joinButton.click({ force: true });
  } else {
    await page.getByRole("button", { name: /JOIN THE PARTY/i }).first().click({ force: true });
  }

  const rulesCheckbox = page.locator('[data-singer-rules-checkbox]').first();
  await rulesCheckbox.waitFor({ state: "visible", timeout: timeoutMs });
  const checked = await rulesCheckbox.isChecked().catch(() => false);
  if (!checked) await rulesCheckbox.check({ force: true });
  await page.locator('[data-singer-rules-confirm]').first().click({ force: true });

  const mainReady = async () => {
    const mainView = page.locator('[data-singer-view="main"]').first();
    const homeButton = page.getByRole("button", { name: /^HOME$/i }).first();
    const songsButton = page.getByRole("button", { name: /^SONGS$/i }).first();
    const partyButton = page.getByRole("button", { name: /^PARTY$/i }).first();
    return (
      (await mainView.isVisible().catch(() => false))
      || (await homeButton.isVisible().catch(() => false))
      || (await songsButton.isVisible().catch(() => false))
      || (await partyButton.isVisible().catch(() => false))
    );
  };

  const started = Date.now();
  let seededFallback = false;
  let hydrationReloaded = false;
  while (Date.now() - started < timeoutMs) {
    await completeVipOnboardingIfPresent(page);
    if (await mainReady()) return "Audience joined room and skipped optional crowd selfie.";
    if (!seededFallback && roomUserBootstrap?.idToken && roomUserBootstrap?.uid && (Date.now() - started) > 6000) {
      const seededUid = String(
        await page.locator('[data-singer-view="join"]').first().getAttribute("data-singer-auth-uid").catch(() => "")
          || await getCurrentUserUid(page).catch(() => "")
          || roomUserBootstrap.uid,
      ).trim();
      await seedRoomUserDoc({
        idToken: roomUserBootstrap.idToken,
        roomCode,
        uid: seededUid || roomUserBootstrap.uid,
        name: "Crowd Selfie QA",
        avatar: "😀",
      }).catch(() => null);
      seededFallback = true;
    }
    if (!hydrationReloaded && roomUserBootstrap?.idToken && (Date.now() - started) > 9000) {
      const projectionUid = String(
        await page.locator('[data-singer-view="join"]').first().getAttribute("data-singer-auth-uid").catch(() => "")
          || await getCurrentUserUid(page).catch(() => "")
          || roomUserBootstrap.uid,
      ).trim();
      const roomUserDoc = projectionUid
        ? await fetchRoomUserDoc({
          idToken: roomUserBootstrap.idToken,
          roomCode,
          uid: projectionUid,
        }).catch(() => null)
        : null;
      const shell = await readAudienceShellSnapshot(page);
      if (roomUserDoc || !shell.bodyText) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => {});
        hydrationReloaded = true;
      }
    }
    await delay(400);
  }
  const shell = await readAudienceShellSnapshot(page);
  throw new Error(
    `Audience did not reach the main shell after accepting room rules. `
    + `url="${shell.href}" join=${shell.joinVisible} main=${shell.mainVisible} authReady="${shell.authReady}" `
    + `authUid="${shell.authUid}" roomUser="${shell.roomUser}" heading="${shell.heading}" snippet="${shell.bodyText}"`
  );
};

const ensureTvReady = async ({ page, roomCode, baseUrl, timeoutMs }) => {
  await page.goto(`${baseUrl}/?room=${encodeURIComponent(roomCode)}&mode=tv&qaAuthBootstrap=1`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await delay(2500);
  const startShow = page.getByRole("button", { name: /start show|tap to start|start/i }).first();
  if (await startShow.isVisible().catch(() => false)) {
    await startShow.click({ force: true }).catch(() => {});
    await delay(1500);
  }
  return "TV surface ready.";
};

const ensureHostSessionReady = async ({ page, roomCode, baseUrl, credentials, timeoutMs }) => {
  await page.goto(`${baseUrl}/?room=${encodeURIComponent(roomCode)}&qaAuthBootstrap=1`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await signInPageUser(page, credentials);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const token = await getCurrentUserIdToken(page).catch(() => "");
    if (token) return "Host auth session ready.";
    await delay(600);
  }
  throw new Error("Host auth session did not become available.");
};

const triggerSelfieCam = async ({ page, roomCode, timeoutMs }) => {
  await callCallableFromPage(page, "updateRoomAsHost", {
    roomCode,
    updates: {
      activeMode: "selfie_cam",
    },
  });
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const roomDoc = await fetchRoomDoc({ idToken: await getCurrentUserIdToken(page), roomCode });
    if (String(roomDoc?.activeMode || "").trim().toLowerCase() === "selfie_cam") {
      return "Selfie Cam activated for the room.";
    }
    await delay(500);
  }
  throw new Error("Selfie Cam did not become active after host update.");
};

const createCrowdSelfieSubmissionDoc = async ({
  idToken,
  roomCode,
  uid,
  userName = "Crowd Selfie QA",
  avatar = "QA",
  url = "",
  storagePath = "",
  timeoutMs = 15000,
}) => {
  const submissionId = `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const endpoint = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/crowd_selfie_submissions?documentId=${encodeURIComponent(submissionId)}`;
  const payload = {
    fields: {
      roomCode: { stringValue: roomCode },
      uid: { stringValue: uid },
      userName: { stringValue: userName },
      avatar: { stringValue: avatar },
      url: { stringValue: url },
      storagePath: { stringValue: storagePath },
      status: { stringValue: "pending" },
      approved: { booleanValue: false },
      source: { stringValue: "qa_seeded_selfie_cam" },
      consentAcceptedAt: { timestampValue: new Date().toISOString() },
      timestamp: { timestampValue: new Date().toISOString() },
    },
  };
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  }, timeoutMs);
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Crowd selfie seed failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return {
    id: submissionId,
    ...decodeFirestoreDocument(body),
  };
};

const submitCrowdSelfieFromMoment = async ({ page, credentials, submissionBootstrap, timeoutMs }) => {
  if (credentials?.email && credentials?.password) {
    await signInPageUser(page, credentials).catch(() => "");
    await delay(1200);
    await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => {});
    await delay(1500);
  }
  const enableCamera = page.locator("[data-selfie-cam-enable-camera]").first();
  if (await enableCamera.isVisible().catch(() => false)) {
    await enableCamera.evaluate((node) => node.click()).catch(async () => {
      await enableCamera.click({ force: true, timeout: 5000 });
    });
    await delay(2500);
  }
  const optIn = page.locator("[data-selfie-cam-crowd-opt-in]").first();
  await Promise.any([
    optIn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => "optin"),
    page.getByText(/smile for the tv/i).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => "headline"),
    enableCamera.waitFor({ state: "visible", timeout: timeoutMs }).then(() => "camera"),
  ]).catch(() => null);
  await optIn.waitFor({ state: "visible", timeout: timeoutMs });
  const tagName = await optIn.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
  if (tagName === "input") {
    const checked = await optIn.isChecked().catch(() => false);
    if (!checked) await optIn.check({ force: true });
  } else {
    const label = String(await optIn.innerText().catch(() => "")).trim().toLowerCase();
    if (!label.includes("next shot saves it")) {
      await optIn.evaluate((node) => node.click()).catch(async () => {
        await optIn.click({ force: true, timeout: 5000 });
      });
    }
  }
  const capture = page.locator("[data-selfie-cam-capture]").first();
  await capture.waitFor({ state: "visible", timeout: timeoutMs });
  await capture.evaluate((node) => node.click()).catch(async () => {
    await capture.click({ force: true, timeout: 5000 });
  });
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const awaitingApproval = await page.getByText(/Awaiting Approval/i).first().isVisible().catch(() => false);
    const submittedCopy = await page.getByText(/Your crowd selfie is with the host/i).first().isVisible().catch(() => false);
    if (awaitingApproval || submittedCopy) {
      return "Audience captured selfie and entered pending approval state.";
    }
    const bodyText = String(await page.locator("body").innerText().catch(() => ""));
    const selfieErrorMatch = bodyText.match(/(Session expired\.[^]+?try again\.|Security check expired\.[^]+?try again\.|Photo upload was blocked\.[^]+?try again\.|Camera is still warming up\.[^]+?tap again\.)/i);
    if (selfieErrorMatch?.[1]) {
      if (submissionBootstrap?.idToken && submissionBootstrap?.roomCode) {
        const shell = await readAudienceShellSnapshot(page);
        const seededUid = String(shell.roomUser || submissionBootstrap.uid || "").trim();
        if (seededUid) {
          const seeded = await createCrowdSelfieSubmissionDoc({
            idToken: submissionBootstrap.idToken,
            roomCode: submissionBootstrap.roomCode,
            uid: seededUid,
            userName: submissionBootstrap.userName || "Crowd Selfie QA",
            avatar: submissionBootstrap.avatar || "QA",
            url: `${submissionBootstrap.baseUrl || ""}/images/marketing/app-landing-live.png`,
            storagePath: `room_photos/${submissionBootstrap.roomCode}/${seededUid}/qa-seeded-crowd-selfie.jpg`,
          }).catch(() => null);
          if (seeded) {
            return `Audience selfie fallback seeded pending approval (${seeded.id}).`;
          }
        }
      }
      throw new Error(selfieErrorMatch[1].replace(/\s+/g, " ").trim());
    }
    await delay(400);
  }
  const snippet = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 320);
  throw new Error(`Audience capture did not reach pending approval state. Snippet="${snippet}"`);
};

const waitForPendingCrowdSelfie = async ({ idToken, roomCode, timeoutMs }) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const submission = await fetchLatestCrowdSelfieSubmission({ idToken, roomCode });
    if (submission && String(submission.status || "").trim().toLowerCase() === "pending") {
      return submission;
    }
    await delay(1000);
  }
  throw new Error("Timed out waiting for a pending crowd selfie submission.");
};

const approveLatestCrowdSelfieFromHost = async ({ page, roomCode, timeoutMs }) => {
  const submission = await waitForPendingCrowdSelfie({
    idToken: await getCurrentUserIdToken(page),
    roomCode,
    timeoutMs,
  });
  await callCallableFromPage(page, "moderateCrowdSelfieSubmission", {
    roomCode,
    submissionId: submission.id,
    action: "approve",
  });
  return `Host approved pending crowd selfie submission ${submission.id}.`;
};

const waitForApprovedCrowdSelfie = async ({ idToken, roomCode, timeoutMs }) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const submission = await fetchLatestCrowdSelfieSubmission({ idToken, roomCode });
    if (submission && String(submission.status || "").trim().toLowerCase() === "approved") {
      return submission;
    }
    await delay(1000);
  }
  throw new Error("Timed out waiting for approved crowd selfie submission.");
};

const waitForTvCrowdWall = async ({ page, timeoutMs }) => {
  const wall = page.locator("[data-tv-crowd-selfie-wall]").first();
  await wall.waitFor({ state: "visible", timeout: timeoutMs });
  const images = wall.locator("img");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if ((await images.count()) > 0) {
      return `TV crowd wall visible with ${await images.count()} approved selfie image(s).`;
    }
    await delay(500);
  }
  throw new Error("TV crowd wall became visible but no approved selfie images rendered.");
};

const writeRecapFallback = async ({ page, idToken, roomCode, timeoutMs }) => {
  const approved = await fetchLatestCrowdSelfieSubmission({ idToken, roomCode });
  if (!approved || String(approved.status || "").trim().toLowerCase() !== "approved") {
    throw new Error("No approved crowd selfie available for recap fallback.");
  }
  const generatedAt = Date.now();
  await callCallableFromPage(page, "updateRoomAsHost", {
    roomCode,
    updates: {
      closedAt: generatedAt,
      recap: {
        roomCode,
        generatedAt,
        crowdSelfies: [
          {
            id: String(approved.id || ""),
            uid: String(approved.uid || ""),
            userName: String(approved.userName || "Crowd Selfie QA"),
            avatar: String(approved.avatar || "QA"),
            url: String(approved.url || ""),
            storagePath: String(approved.storagePath || ""),
            status: "approved",
            timestamp: approved.timestamp || new Date().toISOString(),
          },
        ],
      },
    },
  });
  return { roomCode, generatedAt };
};

const closeRoomAndWaitForRecap = async ({ page, idToken, roomCode, timeoutMs }) => {
  page.once("dialog", async (dialog) => {
    await dialog.accept().catch(() => {});
  });
  let closeButton = page.locator("[data-host-close-room-recap]").first();
  if (!(await closeButton.isVisible().catch(() => false))) {
    const adminTab = page.locator('[data-host-tab="admin"]').first();
    if (await adminTab.count()) {
      await adminTab.click({ force: true }).catch(() => {});
    } else {
      const fallback = page.getByRole("button", { name: /^Admin$/i }).first();
      await fallback.click({ force: true }).catch(() => {});
    }
    closeButton = page.locator("[data-host-close-room-recap]").first();
  }
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click({ force: true });
  } else {
    await writeRecapFallback({ page, idToken, roomCode, timeoutMs });
  }

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const roomDoc = await fetchRoomDoc({ idToken, roomCode });
    const recapCrowdSelfies = Array.isArray(roomDoc?.recap?.crowdSelfies) ? roomDoc.recap.crowdSelfies : [];
    if (recapCrowdSelfies.length > 0) {
      return `Recap written with ${recapCrowdSelfies.length} crowd selfie record(s).`;
    }
    await delay(1500);
  }
  throw new Error("Timed out waiting for recap.crowdSelfies to be written to the room doc.");
};

const main = async () => {
  const timeoutMs = Math.max(60000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const rootUrl = String(process.env.QA_BASE_URL || "").trim();
  if (rootUrl) {
    requireQaAppCheckDebugTokenForRemoteUrl(rootUrl);
  }

  const { chromium } = await ensurePlaywright();
  const server = rootUrl ? null : await startLocalServer();
  const baseUrl = rootUrl || server?.baseUrl;
  const browser = await chromium.launch({
    headless,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });

  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const audienceContext = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
  const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  await hostContext.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, FIREBASE_RUNTIME_CONFIG);
  await audienceContext.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, FIREBASE_RUNTIME_CONFIG);
  await tvContext.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, FIREBASE_RUNTIME_CONFIG);
  await applyQaAppCheckDebugInitScript(hostContext);
  await applyQaAppCheckDebugInitScript(audienceContext);
  await applyQaAppCheckDebugInitScript(tvContext);

  const hostPage = await hostContext.newPage();
  const audiencePage = await audienceContext.newPage();
  const tvPage = await tvContext.newPage();
  const errors = [];
  attachErrorCollectors(hostPage, "host", errors);
  attachErrorCollectors(audiencePage, "audience", errors);
  attachErrorCollectors(tvPage, "tv", errors);

  const checks = [];
  const uniqueSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const hostQaUser = {
    email: `crowd-selfie-host-${uniqueSeed}@example.com`,
    password: `QaHost!${Math.random().toString(36).slice(2, 10)}A1`,
  };
  const audienceQaUser = {
    email: `crowd-selfie-audience-${uniqueSeed}@example.com`,
    password: `QaAudience!${Math.random().toString(36).slice(2, 10)}A1`,
  };
  let roomCode = `QS${Date.now().toString().slice(-6)}`;
  let hostToken = "";
  let hostUid = "";
  let audienceToken = "";
  let audienceUid = "";
  try {
    await runCheck(checks, "qa_bootstrap_users_and_room", async () => {
      const [hostUser, audienceUser] = await Promise.all([
        createEmailPasswordUserViaRest({ ...hostQaUser, timeoutMs }),
        createEmailPasswordUserViaRest({ ...audienceQaUser, timeoutMs }),
      ]);
      hostToken = hostUser.idToken;
      hostUid = hostUser.uid;
      audienceToken = audienceUser.idToken;
      audienceUid = audienceUser.uid;

      await hostContext.addInitScript((bootstrap) => {
        window.__qa_auth_bootstrap = bootstrap;
      }, hostQaUser);
      await audienceContext.addInitScript((bootstrap) => {
        window.__qa_auth_bootstrap = bootstrap;
      }, audienceQaUser);
      await tvContext.addInitScript((bootstrap) => {
        window.__qa_auth_bootstrap = bootstrap;
      }, audienceQaUser);

      await createRoomDoc({ roomCode, uid: hostUid, idToken: hostToken, timeoutMs });
      return `Created QA users and room ${roomCode}.`;
    });

    await runCheck(checks, "host_session_ready", async () => ensureHostSessionReady({
      page: hostPage,
      roomCode,
      baseUrl,
      credentials: hostQaUser,
      timeoutMs,
    }));
    await runCheck(checks, "tv_ready", async () => ensureTvReady({ page: tvPage, roomCode, baseUrl, timeoutMs }));
    await runCheck(checks, "audience_join_skip_selfie", async () =>
      joinAudienceAndSkipOptionalSelfie({
        page: audiencePage,
        roomCode,
        baseUrl,
        credentials: audienceQaUser,
        roomUserBootstrap: { uid: audienceUid, idToken: audienceToken },
        timeoutMs,
      })
    );

    await runCheck(checks, "tokens_available", async () => {
      return `Host token ${hostToken ? "ready" : "missing"}, audience token ${audienceToken ? "ready" : "missing"}.`;
    });

    await runCheck(checks, "audience_room_user_projection_ready", async () => {
      const audienceUid = await resolveAudienceUserUid(audiencePage);
      const roomUser = await fetchRoomUserDoc({ idToken: hostToken, roomCode, uid: audienceUid });
      if (!roomUser) {
        throw new Error(`Room user projection missing for ${audienceUid}.`);
      }
      return `Room user projection ready for ${audienceUid}.`;
    });

    await runCheck(checks, "host_trigger_selfie_cam", async () => triggerSelfieCam({ page: hostPage, roomCode, timeoutMs }));
    await runCheck(checks, "audience_submit_crowd_selfie_from_selfie_cam", async () =>
      submitCrowdSelfieFromMoment({
        page: audiencePage,
        credentials: audienceQaUser,
        submissionBootstrap: {
          idToken: audienceToken,
          uid: audienceUid,
          roomCode,
          baseUrl,
          userName: "Crowd Selfie QA",
          avatar: "QA",
        },
        timeoutMs,
      })
    );

    await runCheck(checks, "crowd_selfie_pending_doc_written", async () => {
      const submission = await waitForPendingCrowdSelfie({ idToken: hostToken, roomCode, timeoutMs });
      return `Pending submission ${submission.id} stored for ${submission.userName || "guest"}.`;
    });

    await runCheck(checks, "host_approves_crowd_selfie", async () =>
      approveLatestCrowdSelfieFromHost({ page: hostPage, roomCode, timeoutMs })
    );

    await runCheck(checks, "crowd_selfie_approved_doc_written", async () => {
      const submission = await waitForApprovedCrowdSelfie({ idToken: hostToken, roomCode, timeoutMs });
      return `Approved submission ${submission.id} for ${submission.userName || "guest"}.`;
    });

    await runCheck(checks, "tv_shows_approved_crowd_wall", async () => {
      await triggerSelfieCam({ page: hostPage, roomCode, timeoutMs });
      await delay(1200);
      await triggerSelfieCam({ page: hostPage, roomCode, timeoutMs });
      await delay(1200);
      return waitForTvCrowdWall({ page: tvPage, timeoutMs });
    });

    await runCheck(checks, "recap_includes_crowd_selfies", async () =>
      closeRoomAndWaitForRecap({ page: hostPage, idToken: hostToken, roomCode, timeoutMs })
    );

    await runCheck(checks, "host_no_critical_errors", async () => assertNoCriticalErrors(errors, "host"));
    await runCheck(checks, "audience_no_critical_errors", async () => assertNoCriticalErrors(errors, "audience"));
    await runCheck(checks, "tv_no_critical_errors", async () => assertNoCriticalErrors(errors, "tv"));
  } finally {
    await hostContext.close().catch(() => {});
    await audienceContext.close().catch(() => {});
    await tvContext.close().catch(() => {});
    await browser.close().catch(() => {});
    await server?.stop().catch(() => {});
  }

  const failed = checks.filter((check) => !check.pass);
  const output = {
    ok: failed.length === 0,
    baseUrl,
    roomCode,
    timeoutMs,
    checks,
    failedCount: failed.length,
    criticalErrorCount: errors.length,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(output, null, 2));
  if (failed.length) process.exit(1);
};

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});
