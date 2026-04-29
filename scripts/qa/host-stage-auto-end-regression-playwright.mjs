import {
  applyQaAppCheckDebugInitScript,
  requireQaAppCheckDebugTokenForRemoteUrl,
} from "./lib/appCheckDebug.mjs";
import {
  delay,
  ensurePlaywright,
  runCheck,
} from "./shared/playwrightQa.mjs";

const PROJECT_ID = "beaurocks-karaoke-v2";
const APP_ID = "bross-app";
const DEFAULT_ROOT_URL = "https://beaurocks-karaoke-v2.web.app";
const DEFAULT_TIMEOUT_MS = 120000;
const NO_EARLY_APPLAUSE_WINDOW_MS = 3000;
const SEEDED_DURATION_SEC = 30;
const TEST_SONG_ID = "qa_auto_end_song";
const TEST_SONG_TITLE = "QA Auto End Guard";
const TEST_SINGER_NAME = "QA Stage Singer";
const REAL_MEDIA_URL = "https://samplelib.com/lib/preview/mp4/sample-5s.mp4";

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

const deriveHostAccessUrl = (rootUrl = "") => {
  const hostOrigin = deriveSurfaceOriginFromRoot(rootUrl, "host");
  if (hostOrigin) return `${hostOrigin}/host-access`;
  return `${String(rootUrl || "").replace(/\/+$/, "")}/host-access`;
};

const deriveHostUrlFromRoot = (rootUrl = "", roomCode = "") => {
  const hostOrigin = deriveSurfaceOriginFromRoot(rootUrl, "host") || String(rootUrl || "").replace(/\/+$/, "");
  return `${hostOrigin}/?mode=host&room=${encodeURIComponent(roomCode)}&hostUiVersion=v2&view=queue&section=queue.live_run&tab=stage`;
};

const deriveTvUrlFromRoot = (rootUrl = "", roomCode = "") => {
  const tvOrigin = deriveSurfaceOriginFromRoot(rootUrl, "tv") || String(rootUrl || "").replace(/\/+$/, "");
  return `${tvOrigin}/?mode=tv&room=${encodeURIComponent(roomCode)}`;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const toJsonOrText = async (response) => {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const extractFirestoreValue = (field = null) => {
  if (!field || typeof field !== "object") return null;
  if ("stringValue" in field) return String(field.stringValue || "");
  if ("integerValue" in field) return Number(field.integerValue || 0);
  if ("doubleValue" in field) return Number(field.doubleValue || 0);
  if ("booleanValue" in field) return field.booleanValue === true;
  if ("timestampValue" in field) return String(field.timestampValue || "");
  if ("nullValue" in field) return null;
  if ("mapValue" in field) {
    const fields = field.mapValue?.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, extractFirestoreValue(value)]),
    );
  }
  if ("arrayValue" in field) {
    return Array.isArray(field.arrayValue?.values)
      ? field.arrayValue.values.map((value) => extractFirestoreValue(value))
      : [];
  }
  return null;
};

const decodeFirestoreDocument = (document = {}) => {
  const fields = document?.fields || {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, extractFirestoreValue(value)]),
  );
};

const getFirebaseInit = async (rootUrl) => {
  const response = await fetchWithTimeout(`${String(rootUrl).replace(/\/+$/, "")}/__/firebase/init.json`);
  if (!response.ok) {
    throw new Error(`Failed to load firebase init config (${response.status}).`);
  }
  return response.json();
};

const roomDocumentUrl = (roomCode) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/rooms/${roomCode}`;

const songDocumentUrl = (songId) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/karaoke_songs/${songId}`;

const getCurrentUserUid = async (page) => {
  const uid = await page.evaluate(async () => {
    const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js");
    const app = getApps().length ? getApp() : initializeApp(window.__firebase_config || {});
    const auth = getAuth(app);
    return String(auth.currentUser?.uid || "");
  });
  if (!uid) throw new Error("No signed-in Firebase uid available in page context.");
  return uid;
};

const getCurrentUserIdToken = async (page) => {
  const token = await page.evaluate(async () => {
    const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js");
    const app = getApps().length ? getApp() : initializeApp(window.__firebase_config || {});
    const auth = getAuth(app);
    if (!auth.currentUser) return "";
    return auth.currentUser.getIdToken();
  });
  if (!token) throw new Error("No signed-in Firebase token available in page context.");
  return token;
};

const signInPageAnonymously = async (page, firebaseConfig) => {
  return page.evaluate(async (config) => {
    const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
    const { getAuth, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js");
    const app = getApps().length ? getApp() : initializeApp(config);
    const auth = getAuth(app);
    const user = auth.currentUser || (await signInAnonymously(auth)).user || null;
    if (!user) {
      return { uid: "", token: "", isAnonymous: false };
    }
    const token = await user.getIdToken();
    return {
      uid: String(user.uid || ""),
      token: String(token || ""),
      isAnonymous: user.isAnonymous === true,
    };
  }, firebaseConfig);
};

const patchFirestoreDocument = async ({ url, idToken, fields, timeoutMs = 15000 }) => {
  const response = await fetchWithTimeout(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields }),
  }, timeoutMs);
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Firestore PATCH failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
};

const deleteFirestoreDocument = async ({ url, idToken, timeoutMs = 10000 }) => {
  await fetchWithTimeout(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  }, timeoutMs).catch(() => {});
};

const fetchRoomDoc = async ({ roomCode, idToken, timeoutMs = 10000 }) => {
  const response = await fetchWithTimeout(roomDocumentUrl(roomCode), {
    headers: { Authorization: `Bearer ${idToken}` },
  }, timeoutMs);
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Room doc fetch failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return decodeFirestoreDocument(body);
};

const fetchSongDoc = async ({ songId, idToken, timeoutMs = 10000 }) => {
  const response = await fetchWithTimeout(songDocumentUrl(songId), {
    headers: { Authorization: `Bearer ${idToken}` },
  }, timeoutMs);
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Song doc fetch failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return decodeFirestoreDocument(body);
};

const waitForRoomPredicate = async ({
  roomCode,
  idToken,
  timeoutMs,
  pollMs = 1000,
  predicate,
  failureLabel = "room predicate",
}) => {
  const started = Date.now();
  let lastRoom = null;
  while ((Date.now() - started) < timeoutMs) {
    lastRoom = await fetchRoomDoc({ roomCode, idToken, timeoutMs: Math.min(10000, timeoutMs) });
    if (predicate(lastRoom)) return lastRoom;
    await delay(pollMs);
  }
  throw new Error(`${failureLabel} was not satisfied in time. Last activeMode=${String(lastRoom?.activeMode || "")}`);
};

const waitForVisibleText = async (page, regex, timeoutMs, failureLabel) => {
  const started = Date.now();
  let lastText = "";
  while ((Date.now() - started) < timeoutMs) {
    lastText = String(await page.locator("body").innerText().catch(() => ""));
    if (regex.test(lastText)) return lastText.replace(/\s+/g, " ").slice(0, 220);
    await delay(700);
  }
  throw new Error(`${failureLabel}. Snippet="${lastText.replace(/\s+/g, " ").slice(0, 220)}"`);
};

const assertNoApplauseState = async ({ roomCode, idToken, hostPage, tvPage, windowMs }) => {
  const started = Date.now();
  const applausePattern = /Applause Countdown|Applause Meter|APPLAUSE!/i;
  let observedKaraoke = false;
  while ((Date.now() - started) < windowMs) {
    const room = await fetchRoomDoc({ roomCode, idToken, timeoutMs: 10000 });
    const activeMode = String(room?.activeMode || "").trim().toLowerCase();
    if (activeMode === "karaoke") observedKaraoke = true;
    if (["applause_countdown", "applause", "applause_result"].includes(activeMode)) {
      throw new Error(`Applause started too early with activeMode=${activeMode}.`);
    }
    const hostText = String(await hostPage.locator("body").innerText().catch(() => ""));
    const tvText = String(await tvPage.locator("body").innerText().catch(() => ""));
    if (applausePattern.test(hostText) || applausePattern.test(tvText)) {
      throw new Error("Applause UI appeared during the no-early-applause guard window.");
    }
    await delay(1000);
  }
  if (!observedKaraoke) {
    throw new Error("Room never entered karaoke during the no-early-applause guard window.");
  }
  return `Stayed in karaoke for ${Math.round(windowMs / 1000)}s after stage start.`;
};

const ensureStartShow = async (tvPage, timeoutMs) => {
  const startShowBtn = tvPage.getByRole("button", { name: /start show|tap to start|start/i }).first();
  const startVisible = await startShowBtn.isVisible().catch(() => false);
  const startEnabled = await startShowBtn.isEnabled().catch(() => false);
  if (startVisible && startEnabled) {
    await startShowBtn.click({ force: true, timeout: timeoutMs });
    await delay(1200);
  }
};

const loginHostPageWithCredentials = async ({ page, rootUrl, email, password, firebaseConfig, timeoutMs }) => {
  const accessUrl = deriveHostAccessUrl(rootUrl);
  await page.goto(accessUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await delay(2500);

  const signInResult = await page.evaluate(async ({ config, nextEmail, nextPassword }) => {
    try {
      const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
      const { getAuth, signOut, signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js");
      const app = getApps().length ? getApp() : initializeApp(config || {});
      const auth = getAuth(app);
      if (auth.currentUser?.uid) {
        await signOut(auth).catch(() => {});
      }
      const credential = await signInWithEmailAndPassword(auth, nextEmail, nextPassword);
      const token = await credential.user.getIdToken();
      return {
        ok: true,
        uid: String(credential.user?.uid || ""),
        email: String(credential.user?.email || ""),
        token: String(token || ""),
      };
    } catch (error) {
      return {
        ok: false,
        code: String(error?.code || ""),
        message: String(error?.message || error),
      };
    }
  }, {
    config: firebaseConfig,
    nextEmail: email,
    nextPassword: password,
  });

  if (!signInResult?.ok || !signInResult?.uid) {
    throw new Error(`Credential login did not complete. ${String(signInResult?.code || "")} ${String(signInResult?.message || "")}`.trim());
  }
};

const main = async () => {
  const rootUrl = String(process.env.QA_ROOT_URL || DEFAULT_ROOT_URL).trim();
  const timeoutMs = Math.max(45000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const hostEmail = String(process.env.QA_HOST_EMAIL || "").trim();
  const hostPassword = String(process.env.QA_HOST_PASSWORD || "");
  requireQaAppCheckDebugTokenForRemoteUrl(rootUrl);
  const firebaseConfig = await getFirebaseInit(rootUrl);
  const roomCode = `QA${Date.now().toString().slice(-6)}`;
  const songId = `${TEST_SONG_ID}_${Date.now().toString().slice(-6)}`;
  const hostUrl = deriveHostUrlFromRoot(rootUrl, roomCode);
  const tvUrl = deriveTvUrlFromRoot(rootUrl, roomCode);
  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless });
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await applyQaAppCheckDebugInitScript(hostContext);
  await applyQaAppCheckDebugInitScript(tvContext);
  await hostContext.addInitScript((config) => {
    if (!window.__firebase_config) window.__firebase_config = config;
  }, firebaseConfig);
  await tvContext.addInitScript((config) => {
    if (!window.__firebase_config) window.__firebase_config = config;
  }, firebaseConfig);

  const hostPage = await hostContext.newPage();
  const tvPage = await tvContext.newPage();
  const checks = [];
  const pageErrors = [];
  let idToken = "";
  let cleanupRoom = false;
  let cleanupSong = false;

  try {
    hostPage.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });
    tvPage.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });

    await runCheck(checks, "host_page_anonymous_auth_bootstrap", async () => {
      let uid = "";
      if (hostEmail && hostPassword) {
        await loginHostPageWithCredentials({
          page: hostPage,
          rootUrl,
          email: hostEmail,
          password: hostPassword,
          firebaseConfig,
          timeoutMs,
        });
        await delay(1200);
        idToken = await getCurrentUserIdToken(hostPage);
        uid = await getCurrentUserUid(hostPage);
        return `Credential host uid=${uid}`;
      }

      await hostPage.goto(`${rootUrl.replace(/\/+$/, "")}/`, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      const authState = await signInPageAnonymously(hostPage, firebaseConfig);
      await delay(1200);
      idToken = String(authState?.token || "").trim() || await getCurrentUserIdToken(hostPage).catch(() => "");
      uid = String(authState?.uid || "").trim() || await getCurrentUserUid(hostPage).catch(() => "");
      if (!uid || !idToken) {
        throw new Error("Anonymous auth bootstrap did not yield a reusable host token. Set QA_HOST_EMAIL and QA_HOST_PASSWORD for the secure path.");
      }
      return `Anonymous host uid=${uid} anonymous=${authState?.isAnonymous === true}`;
    });

    if (!idToken) {
      const bootstrapFailure = checks.find((entry) => entry.name === "host_page_anonymous_auth_bootstrap" && !entry.pass);
      const detail = bootstrapFailure?.detail ? ` Bootstrap failure: ${bootstrapFailure.detail}` : "";
      throw new Error(`Could not acquire a host auth token for the live QA run.${detail}`);
    }

    await runCheck(checks, "seed_room_and_browse_style_queue_song", async () => {
      const uid = await getCurrentUserUid(hostPage);
      const nowIso = new Date().toISOString();
      await patchFirestoreDocument({
        url: roomDocumentUrl(roomCode),
        idToken,
        fields: {
          roomCode: { stringValue: roomCode },
          hostUid: { stringValue: uid },
          hostUids: { arrayValue: { values: [{ stringValue: uid }] } },
          hostName: { stringValue: "QA Host" },
          activeMode: { stringValue: "lobby" },
          autoDj: { booleanValue: true },
          autoPlayMedia: { booleanValue: true },
          autoEndOnTrackFinish: { booleanValue: true },
          popTriviaEnabled: { booleanValue: false },
          applauseWarmupSec: { integerValue: "0" },
          applauseCountdownSec: { integerValue: "1" },
          applauseMeasureSec: { integerValue: "2" },
          timestamp: { timestampValue: nowIso },
        },
      });
      cleanupRoom = true;
      await patchFirestoreDocument({
        url: songDocumentUrl(songId),
        idToken,
        fields: {
          roomCode: { stringValue: roomCode },
          songTitle: { stringValue: TEST_SONG_TITLE },
          artist: { stringValue: "QA Fixture" },
          singerName: { stringValue: TEST_SINGER_NAME },
          singerUid: { stringValue: uid },
          mediaUrl: { stringValue: REAL_MEDIA_URL },
          status: { stringValue: "requested" },
          resolutionStatus: { stringValue: "resolved" },
          duration: { integerValue: "3" },
          backingDurationSec: { integerValue: String(SEEDED_DURATION_SEC) },
          trackSource: { stringValue: "youtube" },
          youtubeId: { stringValue: "qa_missing_clip" },
          timestamp: { timestampValue: nowIso },
          priorityScore: { integerValue: String(Date.now()) },
        },
      });
      cleanupSong = true;
      return `Seeded room ${roomCode} with queue song ${songId}.`;
    });

    await runCheck(checks, "host_loads_room_and_surfaces_seeded_song", async () => {
      await hostPage.goto(hostUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(5000);
      const stageTab = hostPage.locator('[data-host-tab="stage"]').first();
      if (await stageTab.isVisible().catch(() => false)) {
        await stageTab.click({ force: true });
        await delay(1200);
      }
      const queuePanel = hostPage.locator('[data-feature-id="panel-queue-list"]').first();
      if (await queuePanel.count().catch(() => 0)) {
        const expanded = String(await queuePanel.getAttribute("aria-expanded").catch(() => "")).trim().toLowerCase();
        if (expanded === "false") {
          await queuePanel.click({ force: true });
          await delay(700);
        }
      }
      const queueCard = hostPage.locator(`[data-queue-id="${songId}"]`).first();
      await queueCard.waitFor({ state: "visible", timeout: timeoutMs });
      return `Host loaded room ${roomCode} and shows ${TEST_SONG_TITLE}.`;
    });

    await runCheck(checks, "tv_loads_room_before_stage_start", async () => {
      await tvPage.goto(tvUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(2500);
      await ensureStartShow(tvPage, timeoutMs);
      const lastText = String(await tvPage.locator("body").innerText().catch(() => ""));
      if (new RegExp(TEST_SONG_TITLE, "i").test(lastText)) {
        throw new Error("TV showed the staged song before the host started it.");
      }
      return `TV route loaded before stage start.`;
    });

    await runCheck(checks, "host_starts_seeded_song_from_queue", async () => {
      const queueCard = hostPage.locator(`[data-queue-id="${songId}"]`).first();
      await queueCard.waitFor({ state: "visible", timeout: timeoutMs });
      const selectButton = queueCard.locator("button").first();
      await selectButton.waitFor({ state: "visible", timeout: timeoutMs });
      await selectButton.click({ force: true });
      const inspector = hostPage.locator('[data-feature-id="queue-song-inspector"]').first();
      await inspector.waitFor({ state: "visible", timeout: timeoutMs });
      const startSingerButton = inspector.getByRole("button", { name: /Start Singer/i }).first();
      await startSingerButton.waitFor({ state: "visible", timeout: timeoutMs });
      await startSingerButton.click({ force: true });
      let room = null;
      try {
        room = await waitForRoomPredicate({
          roomCode,
          idToken,
          timeoutMs: 25000,
          predicate: (nextRoom) => {
            const activeMode = String(nextRoom?.activeMode || "").trim().toLowerCase();
            const stagedSongId = String(nextRoom?.currentPerformanceMeta?.songId || "").trim();
            return activeMode === "karaoke" && stagedSongId === songId;
          },
          failureLabel: "host stage start room patch",
        });
      } catch (error) {
        const latestSong = await fetchSongDoc({ songId, idToken, timeoutMs: 10000 }).catch(() => null);
        const bodySnippet = String(await hostPage.locator("body").innerText().catch(() => ""))
          .replace(/\s+/g, " ")
          .slice(0, 600);
        const songStatus = String(latestSong?.status || "").trim() || "unknown";
        const perfStartedAt = String(latestSong?.performingStartedAt || "").trim() || "unset";
        throw new Error(`${String(error?.message || error)} Song status=${songStatus}; performingStartedAt=${perfStartedAt}; Host="${bodySnippet}"`);
      }
      return `Started ${TEST_SONG_TITLE} with activeMode=${room.activeMode}.`;
    });

    await runCheck(checks, "public_tv_shows_live_song_after_stage_start", async () => {
      const text = await waitForVisibleText(tvPage, new RegExp(TEST_SONG_TITLE, "i"), 20000, "Public TV did not surface the live song");
      return text;
    });

    await runCheck(checks, "stage_does_not_trigger_applause_immediately", async () => {
      return assertNoApplauseState({
        roomCode,
        idToken,
        hostPage,
        tvPage,
        windowMs: NO_EARLY_APPLAUSE_WINDOW_MS,
      });
    });

    await runCheck(checks, "auto_end_transitions_into_applause_later", async () => {
      const room = await waitForRoomPredicate({
        roomCode,
        idToken,
        timeoutMs: Math.min(timeoutMs, 70000),
        predicate: (nextRoom) => {
          const mode = String(nextRoom?.activeMode || "").trim().toLowerCase();
          return mode === "applause_countdown" || mode === "applause" || mode === "applause_result";
        },
        failureLabel: "room applause transition",
      });
      const tvText = await waitForVisibleText(
        tvPage,
        /Applause Countdown|Applause Meter/i,
        15000,
        "Public TV did not render the applause transition",
      );
      return `Room activeMode=${room.activeMode}; TV="${tvText}"`;
    });

    await runCheck(checks, "no_page_errors", async () => {
      if (pageErrors.length) throw new Error(pageErrors[0]);
      return "No runtime page errors.";
    });
  } finally {
    if (cleanupSong && idToken) {
      await deleteFirestoreDocument({ url: songDocumentUrl(songId), idToken }).catch(() => {});
    }
    if (cleanupRoom && idToken) {
      await deleteFirestoreDocument({ url: roomDocumentUrl(roomCode), idToken }).catch(() => {});
    }
    await hostContext.close().catch(() => {});
    await tvContext.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }
  const failed = checks.filter((entry) => !entry.pass);
  if (failed.length) {
    process.exitCode = 1;
    return;
  }
  console.log("Host stage auto-end regression QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
