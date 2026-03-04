const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const {
  BASE_CAPABILITIES,
  PLAN_DEFINITIONS,
  USAGE_METER_DEFINITIONS,
  getPlanDefinition,
  isEntitledStatus,
  buildCapabilitiesForPlan,
  resolveUsageMeterQuota,
  buildUsageMeterSummary,
} = require("./lib/entitlementsUsage");
const { resolveLyricsForSong } = require("./lib/lyrics/resolveLyricsForSong");
const REACTION_POINT_COSTS = require("./lib/reactionPointCosts.json");

admin.initializeApp();
const APP_ID = "bross-app";
const ORGS_COLLECTION = "organizations";
const STRIPE_SUBSCRIPTIONS_COLLECTION = "stripe_subscriptions";

setGlobalOptions({
  region: "us-west1",
  maxInstances: 2,
  timeoutSeconds: 30,
  memory: "256MiB",
});

const YOUTUBE_API_KEY = defineSecret("YOUTUBE_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const APPLE_MUSIC_TEAM_ID = defineSecret("APPLE_MUSIC_TEAM_ID");
const APPLE_MUSIC_KEY_ID = defineSecret("APPLE_MUSIC_KEY_ID");
const APPLE_MUSIC_PRIVATE_KEY = defineSecret("APPLE_MUSIC_PRIVATE_KEY");
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const GOOGLE_MAPS_API_KEY = defineSecret("GOOGLE_MAPS_API_KEY");
const GOOGLE_MAPS_SERVER_API_KEY = defineSecret("GOOGLE_MAPS_SERVER_API_KEY");
const YELP_API_KEY = defineSecret("YELP_API_KEY");
const REMINDER_EMAIL_WEBHOOK_URL = defineSecret("REMINDER_EMAIL_WEBHOOK_URL");
const REMINDER_SMS_WEBHOOK_URL = defineSecret("REMINDER_SMS_WEBHOOK_URL");
const GEMINI_LYRICS_MODEL = "gemini-2.5-flash-preview-09-2025";
const GEMINI_LYRICS_INPUT_USD_PER_1M = Number(process.env.GEMINI_LYRICS_INPUT_USD_PER_1M || "0.3");
const GEMINI_LYRICS_OUTPUT_USD_PER_1M = Number(process.env.GEMINI_LYRICS_OUTPUT_USD_PER_1M || "2.5");
const LYRICS_PIPELINE_V2_ENABLED_DEFAULT = String(process.env.LYRICS_PIPELINE_V2_ENABLED || "false")
  .trim()
  .toLowerCase() === "true";
const LYRICS_TIMED_ADAPTER_ENABLED_DEFAULT = String(process.env.LYRICS_TIMED_ADAPTER_ENABLED || "false")
  .trim()
  .toLowerCase() === "true";

const rateState = new Map();
const GLOBAL_LIMITS = { perMinute: 120, perHour: 1000 };
const DEFAULT_LIMITS = { perMinute: 30, perHour: 300 };
const securitySignalState = new Map();
const SECURITY_ALERT_WINDOW_MS = 15 * 60 * 1000;
const youtubeSearchCache = new Map();
const YOUTUBE_SEARCH_CACHE_TTL_MS = 30000;
const YOUTUBE_SEARCH_CACHE_MAX_KEYS = 120;
const SUPER_ADMIN_EMAIL_DEFAULT = "hello@beauross.com";

const parseCsvEnvTokens = (value = "") =>
  String(value || "")
    .split(",")
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

const normalizeEmailToken = (value = "") => String(value || "").trim().toLowerCase();
const normalizeUidToken = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 180);

const SUPER_ADMIN_EMAILS = new Set(
  parseCsvEnvTokens(process.env.SUPER_ADMIN_EMAILS || SUPER_ADMIN_EMAIL_DEFAULT)
    .map(normalizeEmailToken)
    .filter(Boolean)
);
const SUPER_ADMIN_UIDS = new Set(
  parseCsvEnvTokens(process.env.SUPER_ADMIN_UIDS || "")
    .map(normalizeUidToken)
    .filter(Boolean)
);
const SUPER_ADMIN_UID_CACHE = new Map();
const SUPER_ADMIN_UID_CACHE_TTL_MS = 10 * 60 * 1000;

const nowMs = () => Date.now();

const isSuperAdminUid = async (uid = "") => {
  const safeUid = normalizeUidToken(uid);
  if (!safeUid) return false;
  if (SUPER_ADMIN_UIDS.has(safeUid)) return true;
  const now = nowMs();
  const cached = SUPER_ADMIN_UID_CACHE.get(safeUid);
  if (cached && Number(cached.expiresAt || 0) > now) {
    return !!cached.value;
  }
  try {
    const userRecord = await admin.auth().getUser(safeUid);
    const email = normalizeEmailToken(userRecord?.email || "");
    const emailVerified = userRecord?.emailVerified === true;
    const allowed = !!email && emailVerified && SUPER_ADMIN_EMAILS.has(email);
    SUPER_ADMIN_UID_CACHE.set(safeUid, {
      value: allowed,
      expiresAt: now + SUPER_ADMIN_UID_CACHE_TTL_MS,
    });
    return allowed;
  } catch (_error) {
    SUPER_ADMIN_UID_CACHE.set(safeUid, {
      value: false,
      expiresAt: now + (60 * 1000),
    });
    return false;
  }
};

const readYoutubeSearchCache = (cacheKey = "") => {
  if (!cacheKey) return null;
  const entry = youtubeSearchCache.get(cacheKey);
  if (!entry) return null;
  if (Number(entry.expiresAtMs || 0) <= nowMs()) {
    youtubeSearchCache.delete(cacheKey);
    return null;
  }
  return Array.isArray(entry.items) ? entry.items : null;
};

const writeYoutubeSearchCache = (cacheKey = "", items = []) => {
  if (!cacheKey) return;
  youtubeSearchCache.set(cacheKey, {
    items: Array.isArray(items) ? items : [],
    expiresAtMs: nowMs() + YOUTUBE_SEARCH_CACHE_TTL_MS,
  });
  if (youtubeSearchCache.size <= YOUTUBE_SEARCH_CACHE_MAX_KEYS) return;
  const oldest = youtubeSearchCache.keys().next().value;
  if (oldest) youtubeSearchCache.delete(oldest);
};

const getClientIp = (req) => {
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.ip || "unknown";
};

const sanitizeSecurityToken = (value = "", maxLen = 64) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, Math.max(1, Number(maxLen || 64)));

const trackSuspiciousPattern = ({
  type = "unknown",
  actor = "anon",
  windowMs = 120000,
  threshold = 5,
}) => {
  const safeType = sanitizeSecurityToken(type, 48) || "unknown";
  const safeActor = sanitizeSecurityToken(actor, 120) || "anon";
  const key = `${safeType}:${safeActor}`;
  const now = nowMs();
  const prev = Array.isArray(securitySignalState.get(key)) ? securitySignalState.get(key) : [];
  const retained = prev.filter((ts) => now - ts <= Math.max(5000, Number(windowMs || 120000)));
  retained.push(now);
  securitySignalState.set(key, retained);
  const count = retained.length;
  const minThreshold = Math.max(1, Number(threshold || 1));
  const shouldAlert = count === minThreshold || (count > minThreshold && count % minThreshold === 0);
  return { count, shouldAlert };
};

const emitSecurityAlert = async ({
  rootRef = getRootRef(),
  type = "security_event",
  severity = "warning",
  roomCode = "",
  uid = "",
  request = null,
  details = {},
}) => {
  try {
    const safeType = sanitizeSecurityToken(type, 48) || "security_event";
    const safeRoom = sanitizeSecurityToken(roomCode || "na", 32) || "na";
    const safeUid = sanitizeSecurityToken(uid || "anon", 48) || "anon";
    const now = nowMs();
    const windowStartMs = Math.floor(now / SECURITY_ALERT_WINDOW_MS) * SECURITY_ALERT_WINDOW_MS;
    const alertId = `${safeType}_${safeRoom}_${safeUid}_${windowStartMs}`;
    const req = request?.rawRequest || request || null;
    const ip = req ? getClientIp(req) : "unknown";
    const userAgent = typeof req?.get === "function"
      ? String(req.get("user-agent") || "").slice(0, 180)
      : "";

    await rootRef.collection("security_alerts").doc(alertId).set({
      type: safeType,
      severity: String(severity || "warning").slice(0, 24),
      roomCode: normalizeRoomCode(roomCode || ""),
      uid: uid || "",
      ip,
      userAgent,
      count: admin.firestore.FieldValue.increment(1),
      windowStartMs,
      lastSeenAtMs: now,
      details: isPlainObject(details) ? details : {},
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.warn(`[security-alert] type=${safeType} severity=${severity} uid=${uid || "anon"} room=${roomCode || "na"} ip=${ip}`);
  } catch (error) {
    console.warn("emitSecurityAlert failed", error?.message || error);
  }
};

const limitKey = (scope, ip) => `${scope}:${ip}`;

const checkRateLimit = (req, scope, limits = DEFAULT_LIMITS) => {
  const ip = getClientIp(req);
  const now = nowMs();
  const minuteKey = `${limitKey(scope, ip)}:m:${Math.floor(now / 60000)}`;
  const hourKey = `${limitKey(scope, ip)}:h:${Math.floor(now / 3600000)}`;
  const globalMinuteKey = `global:m:${Math.floor(now / 60000)}`;
  const globalHourKey = `global:h:${Math.floor(now / 3600000)}`;

  const bump = (key) => {
    const next = (rateState.get(key) || 0) + 1;
    rateState.set(key, next);
    return next;
  };

  const minuteCount = bump(minuteKey);
  const hourCount = bump(hourKey);
  const globalMinute = bump(globalMinuteKey);
  const globalHour = bump(globalHourKey);

  if (minuteCount > limits.perMinute || hourCount > limits.perHour) {
    throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
  }
  if (globalMinute > GLOBAL_LIMITS.perMinute || globalHour > GLOBAL_LIMITS.perHour) {
    throw new HttpsError("resource-exhausted", "Server is busy. Try again.");
  }
};

const ensureString = (val, name) => {
  if (!val || typeof val !== "string") {
    throw new HttpsError("invalid-argument", `${name} must be a string.`);
  }
};

const getAppCheckMode = () => {
  const mode = String(process.env.APP_CHECK_MODE || "off").trim().toLowerCase();
  return mode === "log" || mode === "enforce" ? mode : "off";
};

const hasAppCheck = (request) =>
  typeof request?.app?.appId === "string" && request.app.appId.trim().length > 0;

const enforceAppCheckIfEnabled = (request, scope = "unknown") => {
  if (hasAppCheck(request)) return;
  const mode = getAppCheckMode();
  if (mode === "off") return;

  const uid = request.auth?.uid || "anonymous";
  console.warn(`[app-check] missing token scope=${scope} uid=${uid}`);

  if (mode === "log") return;
  throw new HttpsError("failed-precondition", "App Check token required.");
};

const requireAuth = (request, message = "Sign in required.") => {
  const uid = request.auth?.uid || "";
  if (!uid) {
    throw new HttpsError("unauthenticated", message);
  }
  return uid;
};

const normalizeOptionalName = (value, fallback = "Guest") => {
  const name = typeof value === "string" ? value.trim().slice(0, 80) : "";
  return name || fallback;
};

const clampNumber = (val, min, max, fallback) => {
  const num = Number(val);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
};

const normalizeText = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const buildSongKey = (title = "", artist = "") => {
  const cleanTitle = normalizeText(title || "unknown");
  const cleanArtist = normalizeText(artist || "unknown");
  return `${cleanTitle}__${cleanArtist}`;
};

const extractYouTubeId = (input = "") => {
  if (!input) return "";
  const match = input.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : "";
};

const getWeekKeyUtc = (date = new Date()) => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - day);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isBetterScore = (candidateScore, candidateApplause, current) => {
  if (!current) return true;
  const bestScore = Number(current.bestScore || current.score || 0);
  const bestApplause = Number(current.applauseScore || 0);
  if (candidateScore > bestScore) return true;
  if (candidateScore === bestScore && candidateApplause > bestApplause) return true;
  return false;
};

let stripeClient = null;
const getStripeClient = () => {
  if (stripeClient) return stripeClient;
  const key = STRIPE_SECRET_KEY.value();
  if (!key) {
    throw new HttpsError("failed-precondition", "Stripe is not configured.");
  }
  stripeClient = new Stripe(key);
  return stripeClient;
};

const getRootRef = () =>
  admin
    .firestore()
    .collection("artifacts")
    .doc(APP_ID)
    .collection("public")
    .doc("data");

const normalizeRoomCode = (value = "") => String(value || "").trim().toUpperCase();
const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ123456789";
const ROOM_CODE_DEFAULT_LENGTH = 4;
const ROOM_CODE_MIN_LENGTH = 4;
const ROOM_CODE_MAX_LENGTH = 10;
const ROOM_CODE_GENERATION_ATTEMPTS = 24;
const ROOM_PROVISION_REQUEST_ID_MAX_LEN = 96;
const TIP_POINTS_PER_DOLLAR = 100;
const MISSION_CONTROL_VERSION = 1;
const MISSION_DEFAULT_ASSIST_LEVEL = "smart_assist";
const PROVISION_DEFAULT_PUBLIC_ORIGIN = "https://beaurocks.app";
const DEFAULT_MARQUEE_ITEMS = Object.freeze([
  "Welcome to BROSS Karaoke - scan the QR to join!",
  "Send reactions to hype the singer and light up the stage.",
  "Request a song anytime - the host will pull you up next.",
  "Tip the host to unlock bonus points and VIP perks.",
  "Ready Check incoming - tap READY to earn points.",
  "Share the room code with friends and fill the queue.",
]);
const DEFAULT_TIP_CRATES = Object.freeze([
  { id: "crate_small", label: "Quick Boost", amount: 5, points: 1000, rewardScope: "buyer", awardBadge: false },
  { id: "crate_mid", label: "Crowd Energy", amount: 10, points: 2500, rewardScope: "room", awardBadge: false },
  { id: "crate_big", label: "Room Rager", amount: 20, points: 6000, rewardScope: "room", awardBadge: true },
]);
const HOST_PROVISION_PRESET_OVERRIDES = Object.freeze({
  casual: Object.freeze({
    hostNightPreset: "casual",
    autoDj: true,
    autoBgMusic: true,
    autoPlayMedia: true,
    autoEndOnTrackFinish: true,
    showScoring: false,
    showFameLevel: false,
    allowSingerTrackSelect: true,
    marqueeEnabled: true,
    marqueeShowMode: "idle",
    chatShowOnTv: false,
    autoLyricsOnQueue: false,
    queueSettings: {
      limitMode: "none",
      limitCount: 0,
      rotation: "round_robin",
      firstTimeBoost: true,
    },
  }),
  competition: Object.freeze({
    hostNightPreset: "competition",
    autoDj: false,
    autoBgMusic: false,
    autoPlayMedia: true,
    autoEndOnTrackFinish: true,
    showScoring: true,
    showFameLevel: true,
    allowSingerTrackSelect: false,
    marqueeEnabled: false,
    marqueeShowMode: "idle",
    chatShowOnTv: false,
    autoLyricsOnQueue: true,
    queueSettings: {
      limitMode: "per_night",
      limitCount: 2,
      rotation: "round_robin",
      firstTimeBoost: false,
    },
  }),
  bingo: Object.freeze({
    hostNightPreset: "bingo",
    autoDj: false,
    autoBgMusic: true,
    autoPlayMedia: true,
    autoEndOnTrackFinish: true,
    showScoring: false,
    showFameLevel: false,
    allowSingerTrackSelect: true,
    marqueeEnabled: true,
    marqueeShowMode: "always",
    chatShowOnTv: true,
    autoLyricsOnQueue: false,
    gamePreviewId: "bingo",
  }),
  trivia: Object.freeze({
    hostNightPreset: "trivia",
    autoDj: false,
    autoBgMusic: true,
    autoPlayMedia: false,
    autoEndOnTrackFinish: true,
    showScoring: true,
    showFameLevel: false,
    allowSingerTrackSelect: false,
    marqueeEnabled: false,
    marqueeShowMode: "idle",
    chatShowOnTv: false,
    autoLyricsOnQueue: false,
    gamePreviewId: "trivia_pop",
  }),
});
const normalizeProvisionRoomCode = (value = "") =>
  normalizeRoomCode(value)
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_MAX_LENGTH);
const normalizeProvisionPresetId = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
const normalizeProvisionRequestId = (value = "") =>
  sanitizeSecurityToken(value, ROOM_PROVISION_REQUEST_ID_MAX_LEN);
const buildProvisioningJobDocId = (uid = "", requestId = "") => {
  const safeUid = normalizeUidToken(uid).slice(0, 120);
  const safeRequestId = normalizeProvisionRequestId(requestId);
  if (!safeUid || !safeRequestId) return "";
  return `${safeUid}_${safeRequestId}`;
};
const generateRoomCodeCandidate = (length = ROOM_CODE_DEFAULT_LENGTH) => {
  const safeLength = clampNumber(length, ROOM_CODE_MIN_LENGTH, ROOM_CODE_MAX_LENGTH, ROOM_CODE_DEFAULT_LENGTH);
  let code = "";
  for (let idx = 0; idx < safeLength; idx += 1) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
};
const resolveProvisionPresetOverrides = (presetId = "") => {
  const token = normalizeProvisionPresetId(presetId);
  return HOST_PROVISION_PRESET_OVERRIDES[token] || {};
};
const buildDefaultMissionControlPayload = () => ({
  version: MISSION_CONTROL_VERSION,
  enabled: false,
  setupDraft: {
    archetype: "casual",
    flowRule: "balanced",
    spotlightMode: "karaoke",
    assistLevel: MISSION_DEFAULT_ASSIST_LEVEL,
  },
  advancedOverrides: {},
  party: {
    karaokeFirst: true,
    minSingingSharePct: 70,
    maxBreakDurationSec: 20,
    maxConsecutiveNonKaraokeModes: 1,
    queueDepthGuardThreshold: 8,
    state: {
      singingMs: 0,
      groupMs: 0,
      songsSinceLastGroupMoment: 0,
      consecutiveNonKaraokeModes: 0,
      lastGroupMode: "",
    },
  },
  lastAppliedAt: admin.firestore.FieldValue.serverTimestamp(),
  lastSuggestedAction: "",
});
const buildProvisionedRoomData = ({
  hostUid = "",
  hostName = "Host",
  orgId = "",
  orgName = "",
  logoUrl = "",
  presetId = "custom",
} = {}) => {
  const presetOverrides = resolveProvisionPresetOverrides(presetId);
  const resolvedHostName = normalizeOptionalName(hostName, "Host");
  const resolvedOrgName = String(orgName || "").trim().slice(0, 120) || `${resolvedHostName} Workspace`;
  const resolvedLogoUrl = typeof logoUrl === "string"
    ? logoUrl.trim().slice(0, 2048)
    : "";
  const baseData = {
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    activeMode: "karaoke",
    hideWaveform: false,
    hideOverlay: true,
    videoVolume: 100,
    bgMusicVolume: 0.3,
    bgMusicPlaying: false,
    mixFader: 50,
    autoBgFadeOutMs: 900,
    autoBgFadeInMs: 900,
    autoBgMixDuringSong: 0,
    autoPlayMedia: true,
    autoDjDelaySec: 10,
    autoEndOnTrackFinish: true,
    autoBonusEnabled: true,
    autoBonusPoints: 25,
    hostName: resolvedHostName,
    hostUid,
    hostUids: [hostUid],
    orgId: orgId || null,
    orgName: resolvedOrgName,
    logoUrl: resolvedLogoUrl || null,
    lobbyOrbSkinUrl: null,
    autoDj: false,
    marqueeEnabled: false,
    marqueeDurationMs: 12000,
    marqueeIntervalMs: 20000,
    marqueeItems: DEFAULT_MARQUEE_ITEMS,
    marqueeShowMode: "idle",
    tipPointRate: TIP_POINTS_PER_DOLLAR,
    tipCrates: DEFAULT_TIP_CRATES,
    audienceVideoMode: "off",
    showLyricsTv: false,
    showVisualizerTv: false,
    visualizerMode: "ribbon",
    visualizerSource: "auto",
    visualizerPreset: "neon",
    visualizerSensitivity: 1,
    visualizerSmoothing: 0.35,
    visualizerSyncLightMode: false,
    lobbyPlaygroundPaused: false,
    lobbyPlaygroundVisualOnly: false,
    lobbyPlaygroundStrictMode: false,
    lobbyPlaygroundPerUserCooldownMs: 220,
    lobbyPlaygroundMaxPerMinute: 12,
    reduceMotionFx: false,
    showLyricsSinger: false,
    hideCornerOverlay: false,
    howToPlay: { active: false, id: nowMs() },
    gameRulesId: 0,
    showScoring: true,
    showFameLevel: true,
    allowSingerTrackSelect: false,
    hostNightPreset: "custom",
    bingoAudienceReopenEnabled: true,
    autoLyricsOnQueue: false,
    popTriviaEnabled: true,
    gameDefaults: {
      triviaRoundSec: 20,
      triviaAutoReveal: true,
      bingoVotingMode: "host+votes",
      bingoAutoApprovePct: 50,
    },
    queueSettings: {
      limitMode: "none",
      limitCount: 0,
      rotation: "round_robin",
      firstTimeBoost: true,
    },
    chatEnabled: true,
    chatShowOnTv: false,
    chatTvMode: "auto",
    chatSlowModeSec: 0,
    chatAudienceMode: "all",
    missionControl: buildDefaultMissionControlPayload(),
  };
  return {
    ...baseData,
    ...presetOverrides,
    queueSettings: {
      ...(baseData.queueSettings || {}),
      ...(presetOverrides.queueSettings || {}),
    },
    gameDefaults: {
      ...(baseData.gameDefaults || {}),
      ...(presetOverrides.gameDefaults || {}),
    },
    hostUids: [hostUid],
    hostUid,
    hostName: resolvedHostName,
    orgId: orgId || null,
    orgName: resolvedOrgName,
    logoUrl: resolvedLogoUrl || null,
  };
};
const shouldSyncHostRoomDiscovery = (listingInput = {}) => {
  if (!listingInput || typeof listingInput !== "object") return false;
  const data = listingInput;
  return !!data.publicRoom
    || !!String(data.title || "").trim()
    || !!String(data.description || "").trim()
    || !!String(data.startsAtLocal || "").trim()
    || !!String(data.address1 || "").trim()
    || !!String(data.city || "").trim()
    || !!String(data.state || "").trim()
    || !!String(data.lat || "").trim()
    || !!String(data.lng || "").trim()
    || !!data.virtualOnly;
};
const buildProvisionLaunchUrls = ({ origin = PROVISION_DEFAULT_PUBLIC_ORIGIN, roomCode = "" } = {}) => {
  const base = String(origin || PROVISION_DEFAULT_PUBLIC_ORIGIN).trim().replace(/\/+$/, "")
    || PROVISION_DEFAULT_PUBLIC_ORIGIN;
  const safeRoomCode = normalizeRoomCode(roomCode);
  return {
    hostUrl: `${base}/?mode=host&room=${encodeURIComponent(safeRoomCode)}`,
    tvUrl: `${base}/?mode=tv&room=${encodeURIComponent(safeRoomCode)}`,
    audienceUrl: `${base}/?room=${encodeURIComponent(safeRoomCode)}`,
  };
};
const parseRoomCodeEnvSet = (value = "") =>
  new Set(
    parseCsvEnvTokens(value)
      .map((entry) => normalizeRoomCode(entry))
      .filter(Boolean)
  );
const LYRICS_TIMED_ADAPTER_ROOM_CODES = parseRoomCodeEnvSet(process.env.LYRICS_TIMED_ADAPTER_ROOM_CODES || "");
const HOST_UPDATE_OP_FIELD = "__hostOp";
const HOST_UPDATE_SERVER_TIMESTAMP = "serverTimestamp";
const HOST_UPDATE_MAX_DEPTH = 8;
const HOST_UPDATE_MAX_ARRAY_ITEMS = 250;
const HOST_UPDATE_MAX_OBJECT_KEYS = 250;
const HOST_UPDATE_MAX_STRING_LENGTH = 20000;
const UPDATE_BLOCKED_PATH_TOKENS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);
const ROOM_UPDATE_BLOCKED_ROOT_KEYS = new Set([
  "hostUid",
  "hostUids",
  "orgId",
  "createdAt",
  "__proto__",
  "prototype",
  "constructor",
]);
const HOST_ROOM_ALLOWED_ROOT_KEYS = new Set([
  "activeMode",
  "activeScreen",
  "allowSingerTrackSelect",
  "announcement",
  "applausePeak",
  "appleMusicAutoPlaylistId",
  "appleMusicAutoPlaylistTitle",
  "appleMusicPlayback",
  "audienceVideoMode",
  "autoBgFadeInMs",
  "autoBgFadeOutMs",
  "autoBgMixDuringSong",
  "autoBonusEnabled",
  "autoBonusPoints",
  "autoBgMusic",
  "autoDj",
  "autoDjDelaySec",
  "autoEndOnTrackFinish",
  "autoLyricsOnQueue",
  "autoPlayMedia",
  "bgMusicPlaying",
  "bgMusicUrl",
  "bgMusicVolume",
  "bingoAudienceReopenEnabled",
  "bingoAutoApprovePct",
  "bingoBoardId",
  "bingoData",
  "bingoFocus",
  "bingoIncludeHost",
  "bingoMode",
  "bingoMysteryRng",
  "bingoPickerName",
  "bingoPickerUid",
  "bingoRevealed",
  "bingoSessionId",
  "bingoShowTv",
  "bingoSize",
  "bingoSponsorLogo",
  "bingoSponsorName",
  "bingoSuggestions",
  "bingoTurnIndex",
  "bingoTurnOrder",
  "bingoTurnPick",
  "bingoVictory",
  "bingoVotingMode",
  "bingoWin",
  "bonusDrop",
  "bouncerMode",
  "bracketLastSummary",
  "chatAudienceMode",
  "chatEnabled",
  "chatShowOnTv",
  "chatTvMode",
  "closedAt",
  "currentApplauseLevel",
  "doodleOke",
  "doodleOkeConfig",
  "doodleOkeIndex",
  "featuredPhotoId",
  "gameData",
  "gameDefaults",
  "gameParticipantMode",
  "gameParticipants",
  "gamePreviewAt",
  "gamePreviewId",
  "gameRulesId",
  "guitarSessionId",
  "guitarVictory",
  "guitarWinner",
  "hideCornerOverlay",
  "hideLogo",
  "hideOverlay",
  "hideWaveform",
  "highlightedTile",
  "hostName",
  "hostNightPreset",
  "howToPlay",
  "karaokeBracket",
  "lastPerformance",
  "layoutMode",
  "lightMode",
  "lyricsPipelineV2Enabled",
  "lobbyOrbSkinUrl",
  "logoUrl",
  "lyricsMode",
  "marqueeDurationMs",
  "marqueeEnabled",
  "marqueeIntervalMs",
  "marqueeItems",
  "marqueeShowMode",
  "mediaUrl",
  "missionControl",
  "mixFader",
  "pausedAt",
  "photoOverlay",
  "popTriviaEnabled",
  "queueSettings",
  "readyCheck",
  "readyCheckDurationSec",
  "readyCheckRewardPoints",
  "reduceMotionFx",
  "recap",
  "recapPreview",
  "selfieChallenge",
  "selfieMoment",
  "selfieMomentExpiresAt",
  "showFameLevel",
  "showLyricsSinger",
  "showLyricsTv",
  "showScoring",
  "showVisualizerTv",
  "singAlongMode",
  "spotlightUser",
  "stormConfig",
  "stormEndsAt",
  "stormPhase",
  "stormSequenceId",
  "stormStartedAt",
  "strobeCountdownUntil",
  "strobeEndsAt",
  "strobeResults",
  "strobeSessionId",
  "strobeVictory",
  "strobeWinner",
  "tipCrates",
  "tipPointRate",
  "tipQrUrl",
  "tipUrl",
  "triviaQuestion",
  "tvPresentationProfile",
  "videoPlaying",
  "videoStartTimestamp",
  "videoVolume",
  "visualizerMode",
  "visualizerPreset",
  "visualizerSensitivity",
  "visualizerSmoothing",
  "visualizerSource",
  "visualizerSyncLightMode",
  "wyrData",
]);
const HOST_ROOM_BOOLEAN_ROOT_KEYS = new Set([
  "allowSingerTrackSelect",
  "autoBonusEnabled",
  "autoBgMusic",
  "autoEndOnTrackFinish",
  "autoDj",
  "autoLyricsOnQueue",
  "autoPlayMedia",
  "bgMusicPlaying",
  "bingoAudienceReopenEnabled",
  "bingoIncludeHost",
  "bingoShowTv",
  "bouncerMode",
  "chatEnabled",
  "chatShowOnTv",
  "hideCornerOverlay",
  "hideLogo",
  "hideOverlay",
  "hideWaveform",
  "lyricsPipelineV2Enabled",
  "marqueeEnabled",
  "popTriviaEnabled",
  "reduceMotionFx",
  "showFameLevel",
  "showLyricsSinger",
  "showLyricsTv",
  "showScoring",
  "showVisualizerTv",
  "singAlongMode",
  "visualizerSyncLightMode",
]);
const HOST_ROOM_NUMBER_ROOT_KEYS = new Set([
  "applausePeak",
  "autoBgFadeInMs",
  "autoBgFadeOutMs",
  "autoBgMixDuringSong",
  "autoBonusPoints",
  "autoDjDelaySec",
  "bgMusicVolume",
  "bingoAutoApprovePct",
  "bingoBoardId",
  "bingoSize",
  "bingoTurnIndex",
  "closedAt",
  "currentApplauseLevel",
  "doodleOkeIndex",
  "gamePreviewAt",
  "gameRulesId",
  "guitarSessionId",
  "marqueeDurationMs",
  "marqueeIntervalMs",
  "mixFader",
  "pausedAt",
  "readyCheckDurationSec",
  "readyCheckRewardPoints",
  "selfieMomentExpiresAt",
  "stormEndsAt",
  "stormSequenceId",
  "stormStartedAt",
  "strobeCountdownUntil",
  "strobeEndsAt",
  "strobeSessionId",
  "tipPointRate",
  "videoStartTimestamp",
  "videoVolume",
  "visualizerSensitivity",
  "visualizerSmoothing",
]);
const HOST_ROOM_STRING_ROOT_KEYS = new Set([
  "activeMode",
  "activeScreen",
  "appleMusicAutoPlaylistId",
  "appleMusicAutoPlaylistTitle",
  "audienceVideoMode",
  "bgMusicUrl",
  "bingoMode",
  "bingoPickerName",
  "bingoPickerUid",
  "bingoSessionId",
  "bingoSponsorLogo",
  "bingoSponsorName",
  "bingoVotingMode",
  "chatAudienceMode",
  "chatTvMode",
  "gameParticipantMode",
  "gamePreviewId",
  "hostName",
  "hostNightPreset",
  "layoutMode",
  "lightMode",
  "lobbyOrbSkinUrl",
  "logoUrl",
  "lyricsMode",
  "marqueeShowMode",
  "mediaUrl",
  "stormPhase",
  "tipQrUrl",
  "tipUrl",
  "tvPresentationProfile",
  "visualizerMode",
  "visualizerPreset",
  "visualizerSource",
]);
const HOST_ROOM_ARRAY_ROOT_KEYS = new Set([
  "bingoTurnOrder",
  "gameParticipants",
  "marqueeItems",
]);
const HOST_ROOM_OBJECT_OR_NULL_ROOT_KEYS = new Set([
  "announcement",
  "appleMusicPlayback",
  "bingoFocus",
  "bingoMysteryRng",
  "bingoRevealed",
  "bingoSuggestions",
  "bingoTurnPick",
  "bingoVictory",
  "bingoWin",
  "bonusDrop",
  "bracketLastSummary",
  "doodleOke",
  "doodleOkeConfig",
  "gameData",
  "gameDefaults",
  "guitarVictory",
  "guitarWinner",
  "howToPlay",
  "karaokeBracket",
  "lastPerformance",
  "photoOverlay",
  "queueSettings",
  "readyCheck",
  "recap",
  "recapPreview",
  "selfieChallenge",
  "selfieMoment",
  "missionControl",
  "spotlightUser",
  "stormConfig",
  "strobeResults",
  "strobeVictory",
  "strobeWinner",
  "triviaQuestion",
  "wyrData",
]);
const HOST_ROOM_DOTTED_KEY_RULES = [
  {
    pattern: /^announcement\.active$/,
    label: "announcement.active",
    validate: (value) => typeof value === "boolean",
  },
  {
    pattern: /^readyCheck\.active$/,
    label: "readyCheck.active",
    validate: (value) => typeof value === "boolean",
  },
  {
    pattern: /^bingoRevealed\.[A-Za-z0-9_-]+$/,
    label: "bingoRevealed.<slot>",
    validate: (value) => typeof value === "boolean",
  },
  {
    pattern: /^bingoSuggestions\.[A-Za-z0-9_-]+\.approvedAt$/,
    label: "bingoSuggestions.<slot>.approvedAt",
    validate: (value) =>
      value === null || isHostServerTimestampMarker(value) || isFiniteNumber(value),
  },
  {
    pattern: /^bingoSuggestions\.[A-Za-z0-9_-]+\.count$/,
    label: "bingoSuggestions.<slot>.count",
    validate: (value) => isFiniteNumber(value),
  },
  {
    pattern: /^bingoSuggestions\.[A-Za-z0-9_-]+\.lastAt$/,
    label: "bingoSuggestions.<slot>.lastAt",
    validate: (value) => value === null || isFiniteNumber(value) || isHostServerTimestampMarker(value),
  },
  {
    pattern: /^bingoSuggestions\.[A-Za-z0-9_-]+\.lastNote$/,
    label: "bingoSuggestions.<slot>.lastNote",
    validate: (value) => typeof value === "string" && value.length <= HOST_UPDATE_MAX_STRING_LENGTH,
  },
];

const isPlainObject = (value) =>
  !!value && Object.prototype.toString.call(value) === "[object Object]";
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isBlockedKeyToken = (value = "") =>
  UPDATE_BLOCKED_PATH_TOKENS.has(value) || value.startsWith("__");
const isHostServerTimestampMarker = (value) =>
  isPlainObject(value)
    && Object.keys(value).length === 1
    && value[HOST_UPDATE_OP_FIELD] === HOST_UPDATE_SERVER_TIMESTAMP;
const isValidUpdatePathToken = (value = "") =>
  /^[A-Za-z0-9_-]{1,80}$/.test(value) && !isBlockedKeyToken(value);

const validateHostRoomUpdateValue = (value, depth = 0) => {
  if (depth > HOST_UPDATE_MAX_DEPTH) {
    throw new HttpsError("invalid-argument", "updates payload is nested too deeply.");
  }
  if (value === undefined) return;
  if (value === null) return;

  const valueType = typeof value;
  if (valueType === "string") {
    if (value.length > HOST_UPDATE_MAX_STRING_LENGTH) {
      throw new HttpsError("invalid-argument", "String update value is too large.");
    }
    return;
  }
  if (valueType === "boolean") return;
  if (valueType === "number") {
    if (!Number.isFinite(value)) {
      throw new HttpsError("invalid-argument", "Numeric update values must be finite.");
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > HOST_UPDATE_MAX_ARRAY_ITEMS) {
      throw new HttpsError("invalid-argument", "Array update value has too many items.");
    }
    value.forEach((entry) => validateHostRoomUpdateValue(entry, depth + 1));
    return;
  }

  if (!isPlainObject(value)) {
    throw new HttpsError("invalid-argument", "updates payload contains unsupported values.");
  }

  if (Object.prototype.hasOwnProperty.call(value, HOST_UPDATE_OP_FIELD)) {
    if (!isHostServerTimestampMarker(value)) {
      throw new HttpsError("invalid-argument", `Unsupported host update operation "${HOST_UPDATE_OP_FIELD}".`);
    }
    return;
  }

  const keys = Object.keys(value);
  if (keys.length > HOST_UPDATE_MAX_OBJECT_KEYS) {
    throw new HttpsError("invalid-argument", "Object update value has too many keys.");
  }
  keys.forEach((key) => {
    if (!isValidUpdatePathToken(key)) {
      throw new HttpsError("invalid-argument", `Invalid nested update key token: ${key}`);
    }
    validateHostRoomUpdateValue(value[key], depth + 1);
  });
};

const validateHostRoomUpdateType = (key, value) => {
  if (HOST_ROOM_BOOLEAN_ROOT_KEYS.has(key) && typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", `Room field "${key}" must be a boolean.`);
  }
  if (HOST_ROOM_NUMBER_ROOT_KEYS.has(key) && !(value === null || isFiniteNumber(value))) {
    throw new HttpsError("invalid-argument", `Room field "${key}" must be a finite number or null.`);
  }
  if (HOST_ROOM_STRING_ROOT_KEYS.has(key) && !(value === null || typeof value === "string")) {
    throw new HttpsError("invalid-argument", `Room field "${key}" must be a string or null.`);
  }
  if (HOST_ROOM_ARRAY_ROOT_KEYS.has(key) && !(value === null || Array.isArray(value))) {
    throw new HttpsError("invalid-argument", `Room field "${key}" must be an array or null.`);
  }
  if (HOST_ROOM_OBJECT_OR_NULL_ROOT_KEYS.has(key) && !(value === null || isPlainObject(value))) {
    throw new HttpsError("invalid-argument", `Room field "${key}" must be an object or null.`);
  }

  if (key === "bingoData") {
    const valid = value === null || isPlainObject(value) || Array.isArray(value);
    if (!valid) {
      throw new HttpsError("invalid-argument", "Room field \"bingoData\" must be an object, array, or null.");
    }
  }

  if (key === "featuredPhotoId") {
    const valid = value === null || typeof value === "string" || isFiniteNumber(value);
    if (!valid) {
      throw new HttpsError("invalid-argument", "Room field \"featuredPhotoId\" must be string, number, or null.");
    }
  }

  if (key === "highlightedTile") {
    const valid = value === null
      || typeof value === "string"
      || isFiniteNumber(value)
      || isPlainObject(value);
    if (!valid) {
      throw new HttpsError("invalid-argument", "Room field \"highlightedTile\" has an invalid value type.");
    }
  }
};

const matchDottedHostRoomRule = (key = "") =>
  HOST_ROOM_DOTTED_KEY_RULES.find((rule) => rule.pattern.test(key)) || null;

const decodeHostRoomUpdateValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => decodeHostRoomUpdateValue(entry));
  }
  if (!isPlainObject(value)) return value;
  if (Object.prototype.hasOwnProperty.call(value, HOST_UPDATE_OP_FIELD)) {
    if (!isHostServerTimestampMarker(value)) {
      throw new HttpsError("invalid-argument", "Unsupported host update operation payload.");
    }
    return admin.firestore.FieldValue.serverTimestamp();
  }
  const next = {};
  Object.entries(value).forEach(([key, child]) => {
    next[key] = decodeHostRoomUpdateValue(child);
  });
  return next;
};

const normalizeHostRoomUpdates = (rawUpdates = {}) => {
  if (!isPlainObject(rawUpdates)) {
    throw new HttpsError("invalid-argument", "updates must be an object.");
  }
  const entries = Object.entries(rawUpdates);
  if (!entries.length) {
    throw new HttpsError("invalid-argument", "updates must include at least one field.");
  }
  if (entries.length > 200) {
    throw new HttpsError("invalid-argument", "Too many updates in one request.");
  }

  const normalized = {};
  let estimatedChars = 0;

  entries.forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || "").trim();
    if (!key) {
      throw new HttpsError("invalid-argument", "Update keys must be non-empty strings.");
    }
    if (key.length > 160 || key.startsWith(".") || key.endsWith(".") || key.includes("..")) {
      throw new HttpsError("invalid-argument", `Invalid update key: ${key}`);
    }

    const pathTokens = key.split(".");
    if (!pathTokens.every((token) => isValidUpdatePathToken(token))) {
      throw new HttpsError("invalid-argument", `Invalid update key: ${key}`);
    }
    const rootKey = pathTokens[0];
    if (ROOM_UPDATE_BLOCKED_ROOT_KEYS.has(rootKey)) {
      throw new HttpsError("permission-denied", `Room field "${rootKey}" cannot be updated from client payloads.`);
    }
    if (!HOST_ROOM_ALLOWED_ROOT_KEYS.has(rootKey)) {
      throw new HttpsError("invalid-argument", `Room field "${rootKey}" is not writable through host updates.`);
    }

    validateHostRoomUpdateValue(rawValue);
    if (pathTokens.length > 1) {
      const dottedRule = matchDottedHostRoomRule(key);
      if (!dottedRule) {
        throw new HttpsError("invalid-argument", `Nested room update path "${key}" is not allowed.`);
      }
      if (!dottedRule.validate(rawValue)) {
        throw new HttpsError("invalid-argument", `Nested room update path "${dottedRule.label}" has an invalid value.`);
      }
    } else {
      validateHostRoomUpdateType(rootKey, rawValue);
    }

    const value = decodeHostRoomUpdateValue(rawValue);
    if (value === undefined) return;
    normalized[key] = value;
    estimatedChars += key.length;
    try {
      estimatedChars += JSON.stringify(rawValue).length;
    } catch {
      estimatedChars += 0;
    }
  });

  if (!Object.keys(normalized).length) {
    throw new HttpsError("invalid-argument", "No valid update fields provided.");
  }
  if (estimatedChars > 120000) {
    throw new HttpsError("invalid-argument", "updates payload too large.");
  }

  return normalized;
};

const sanitizeOrgToken = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

const buildOrgIdForUid = (uid = "") => {
  const token = sanitizeOrgToken(uid) || "owner";
  return `org_${token}`;
};

const normalizeOrganizationMemberRole = (value = "", fallback = "member") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === "owner" || token === "admin" || token === "member") return token;
  return fallback;
};

const normalizeOrgName = (value = "", uid = "") => {
  const trimmed = typeof value === "string" ? value.trim().slice(0, 120) : "";
  if (trimmed) return trimmed;
  const token = sanitizeOrgToken(uid).slice(0, 6) || "ORG";
  return `Workspace ${token.toUpperCase()}`;
};

const normalizeCapabilities = (input = {}) => {
  const caps = { ...BASE_CAPABILITIES };
  Object.entries(input || {}).forEach(([key, value]) => {
    caps[key] = !!value;
  });
  return caps;
};

const isPaidPlan = (planId = "") => {
  const plan = getPlanDefinition(planId);
  return !!(plan && plan.id !== "free" && plan.interval && plan.amountCents > 0);
};

const planToUserTier = (planId = "") => {
  const plan = getPlanDefinition(planId);
  return plan?.tier || "free";
};

const planToUserPlan = (planId = "") => {
  const plan = getPlanDefinition(planId);
  if (plan?.interval === "year") return "yearly";
  if (plan?.interval === "month") return "monthly";
  return "monthly";
};

const valueToMillis = (value) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const orgsCollection = () => admin.firestore().collection(ORGS_COLLECTION);

const getUsagePeriodKey = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
};

const normalizeUsagePeriodKey = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return getUsagePeriodKey();
  if (!/^\d{6}$/.test(trimmed)) return "";
  const month = Number(trimmed.slice(4, 6));
  if (month < 1 || month > 12) return "";
  return trimmed;
};

const getPeriodRangeForKey = (periodKey = "") => {
  const safe = String(periodKey || "");
  if (!/^\d{6}$/.test(safe)) {
    return { startMs: 0, endMs: 0 };
  }
  const year = Number(safe.slice(0, 4));
  const monthIndex = Number(safe.slice(4, 6)) - 1;
  const start = Date.UTC(year, monthIndex, 1, 0, 0, 0, 0);
  const end = Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0) - 1;
  return { startMs: start, endMs: end };
};

const toWholeNumber = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const readOrganizationUsageSummary = async ({
  orgId = "",
  entitlements = null,
  periodKey = getUsagePeriodKey(),
}) => {
  if (!orgId) {
    return {
      orgId: "",
      period: periodKey,
      planId: entitlements?.planId || "free",
      status: entitlements?.status || "inactive",
      meters: {},
      totals: {
        estimatedOverageCents: 0,
      },
      generatedAtMs: nowMs(),
      periodRange: getPeriodRangeForKey(periodKey),
    };
  }
  const usageRef = orgsCollection().doc(orgId).collection("usage").doc(periodKey);
  const usageSnap = await usageRef.get();
  const usageData = usageSnap.data() || {};
  const meterData = usageData.meters || {};
  const meters = {};
  let estimatedOverageCents = 0;

  Object.keys(USAGE_METER_DEFINITIONS).forEach((meterId) => {
    const quota = resolveUsageMeterQuota({
      meterId,
      planId: entitlements?.planId || "free",
      status: entitlements?.status || "inactive",
    });
    const used = toWholeNumber(meterData?.[meterId]?.used, 0);
    const summary = buildUsageMeterSummary({
      meterId,
      used,
      quota,
      periodKey,
    });
    meters[meterId] = summary;
    estimatedOverageCents += summary.estimatedOverageCents;
  });

  return {
    orgId,
    period: periodKey,
    planId: entitlements?.planId || "free",
    status: entitlements?.status || "inactive",
    meters,
    totals: {
      estimatedOverageCents,
    },
    generatedAtMs: nowMs(),
    periodRange: getPeriodRangeForKey(periodKey),
  };
};

const centsToDollarString = (cents = 0) => (toWholeNumber(cents, 0) / 100).toFixed(2);

const csvEscape = (value = "") => {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
};

const formatPeriodLabel = (periodKey = "") => {
  if (!/^\d{6}$/.test(String(periodKey || ""))) return "Current Period";
  const year = Number(periodKey.slice(0, 4));
  const monthIndex = Number(periodKey.slice(4, 6)) - 1;
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};

const buildUsageInvoiceDraft = ({
  orgId = "",
  orgName = "",
  entitlements = null,
  usageSummary = null,
  periodKey = getUsagePeriodKey(),
  includeBasePlan = false,
  taxRatePercent = 0,
  customerName = "",
}) => {
  const safeEntitlements = entitlements || {};
  const safeUsage = usageSummary || {
    meters: {},
    period: periodKey,
    totals: { estimatedOverageCents: 0 },
    periodRange: getPeriodRangeForKey(periodKey),
  };
  const period = safeUsage.period || periodKey;
  const periodLabel = formatPeriodLabel(period);
  const plan = getPlanDefinition(safeEntitlements.planId) || PLAN_DEFINITIONS.free;
  const issueDateMs = safeUsage?.periodRange?.endMs || nowMs();
  const dueDateMs = issueDateMs + (14 * 24 * 60 * 60 * 1000);
  const invoiceId = `INV-${sanitizeOrgToken(orgId).toUpperCase().slice(-12) || "ORG"}-${period}`;
  const lineItems = [];
  const billingEntity = String(customerName || "").trim() || String(orgName || "").trim() || orgId || "Customer";
  const rateCardSnapshot = {
    generatedAtMs: nowMs(),
    planId: safeEntitlements.planId || "free",
    planStatus: safeEntitlements.status || "inactive",
    meters: {},
  };

  if (includeBasePlan && isEntitledStatus(safeEntitlements.status) && plan.amountCents > 0) {
    lineItems.push({
      id: `base_plan_${plan.id}`,
      type: "base_plan",
      description: `${plan.name} subscription (${plan.interval || "period"})`,
      quantity: 1,
      unit: "plan",
      unitPriceCents: toWholeNumber(plan.amountCents, 0),
      amountCents: toWholeNumber(plan.amountCents, 0),
      period,
    });
  }

  const meters = Object.values(safeUsage.meters || {}).sort((a, b) =>
    String(a?.label || "").localeCompare(String(b?.label || ""))
  );
  meters.forEach((meter) => {
    const overageUnits = toWholeNumber(meter?.overageUnits, 0);
    const passThroughUnitCostCents = toWholeNumber(meter?.passThroughUnitCostCents, 0);
    const markupMultiplier = Number.isFinite(Number(meter?.markupMultiplier))
      ? Math.max(0, Number(meter?.markupMultiplier))
      : 1;
    const billableUnitRateCents = toWholeNumber(
      meter?.billableUnitRateCents,
      toWholeNumber(meter?.overageRateCents, 0)
    );
    rateCardSnapshot.meters[meter.meterId] = {
      meterId: meter.meterId,
      label: meter.label || meter.meterId,
      unit: meter.unit || "unit",
      includedUnits: toWholeNumber(meter?.included, 0),
      hardLimitUnits: toWholeNumber(meter?.hardLimit, 0),
      passThroughUnitCostCents,
      markupMultiplier,
      billableUnitRateCents,
    };
    if (!overageUnits || !billableUnitRateCents) return;
    lineItems.push({
      id: `overage_${meter.meterId}`,
      type: "overage",
      meterId: meter.meterId,
      description: `${meter.label} overage (${periodLabel})`,
      quantity: overageUnits,
      unit: meter.unit || "unit",
      includedUnits: toWholeNumber(meter?.included, 0),
      overageUnits,
      passThroughUnitCostCents,
      markupMultiplier,
      billableUnitRateCents,
      unitPriceCents: billableUnitRateCents,
      amountCents: overageUnits * billableUnitRateCents,
      period,
    });
  });

  const subtotalCents = lineItems.reduce((sum, line) => sum + toWholeNumber(line.amountCents, 0), 0);
  const safeTaxRatePercent = Math.max(0, Math.min(100, Number(taxRatePercent || 0)));
  const taxCents = Math.round(subtotalCents * (safeTaxRatePercent / 100));
  const totalCents = subtotalCents + taxCents;

  const qbseTransactionCsvRows = [
    ["Date", "Description", "Amount"],
    ...lineItems.map((line) => ([
      new Date(issueDateMs).toISOString().slice(0, 10),
      `${billingEntity} - ${line.description}`,
      centsToDollarString(line.amountCents),
    ])),
  ];
  const qbseTransactionCsv = qbseTransactionCsvRows
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\n");

  const lineItemCsvRows = [
    [
      "InvoiceNumber",
      "InvoiceDate",
      "DueDate",
      "Customer",
      "Description",
      "Qty",
      "UnitPrice",
      "Amount",
      "IncludedUnits",
      "OverageUnits",
      "PassThroughUnitCost",
      "MarkupMultiplier",
      "BillableUnitRate",
    ],
    ...lineItems.map((line) => ([
      invoiceId,
      new Date(issueDateMs).toISOString().slice(0, 10),
      new Date(dueDateMs).toISOString().slice(0, 10),
      billingEntity,
      line.description,
      String(line.quantity || 0),
      centsToDollarString(line.unitPriceCents || 0),
      centsToDollarString(line.amountCents || 0),
      String(toWholeNumber(line.includedUnits, 0)),
      String(toWholeNumber(line.overageUnits, 0)),
      centsToDollarString(line.passThroughUnitCostCents || 0),
      Number(line.markupMultiplier || 1).toFixed(2),
      centsToDollarString(line.billableUnitRateCents || line.unitPriceCents || 0),
    ])),
  ];
  const lineItemCsv = lineItemCsvRows
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\n");

  return {
    invoiceId,
    orgId,
    orgName: orgName || orgId,
    customerName: billingEntity,
    period,
    periodLabel,
    issueDateMs,
    dueDateMs,
    planId: safeEntitlements.planId || "free",
    planStatus: safeEntitlements.status || "inactive",
    includeBasePlan: !!includeBasePlan,
    taxRatePercent: safeTaxRatePercent,
    lineItems,
    totals: {
      subtotalCents,
      taxCents,
      totalCents,
    },
    rateCardSnapshot,
    usageSummary: safeUsage,
    quickbooks: {
      selfEmployed: {
        apiSupported: false,
        suggestedFlow: "Use line-item CSV for manual invoice entry and transaction CSV for income import reconciliation.",
        lineItemCsv,
        qbseTransactionCsv,
      },
      online: {
        apiSupported: true,
        suggestedFlow: "Map lineItems to QuickBooks Online Invoice API SalesItemLineDetail entries.",
        invoicePayloadCandidate: {
          customerDisplayName: billingEntity,
          txnDate: new Date(issueDateMs).toISOString().slice(0, 10),
          dueDate: new Date(dueDateMs).toISOString().slice(0, 10),
          lineItems: lineItems.map((line) => ({
            description: line.description,
            qty: line.quantity || 0,
            unitPrice: Number(centsToDollarString(line.unitPriceCents || 0)),
            amount: Number(centsToDollarString(line.amountCents || 0)),
          })),
        },
      },
    },
  };
};

const sanitizeInvoiceStatus = (value = "") => {
  const safe = String(value || "").trim().toLowerCase();
  if (["draft", "sent", "paid", "void"].includes(safe)) return safe;
  return "draft";
};

const MARKETING_WAITLIST_USE_CASES = new Set([
  "Home Party Host",
  "Fundraiser Organizer",
  "Community Event Host",
  "Venue / KJ Operator",
]);

const sanitizeWaitlistName = (value = "") => {
  const safe = String(value || "").trim().slice(0, 80);
  if (!safe) {
    throw new HttpsError("invalid-argument", "name is required.");
  }
  return safe;
};

const sanitizeWaitlistEmail = (value = "") => {
  const safe = String(value || "").trim().toLowerCase();
  if (!safe || safe.length > 254) {
    throw new HttpsError("invalid-argument", "Valid email is required.");
  }
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safe);
  if (!valid) {
    throw new HttpsError("invalid-argument", "Valid email is required.");
  }
  return safe;
};

const sanitizeOptionalWaitlistEmail = (value = "") => {
  const safe = String(value || "").trim();
  if (!safe) return "";
  return sanitizeWaitlistEmail(safe);
};

const parseBooleanInput = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const token = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(token)) return true;
  if (["0", "false", "no", "off"].includes(token)) return false;
  return fallback;
};

const sanitizeWaitlistUseCase = (value = "") => {
  const safe = String(value || "").trim();
  if (MARKETING_WAITLIST_USE_CASES.has(safe)) return safe;
  return "Home Party Host";
};

const sanitizeWaitlistSource = (value = "") => {
  const safe = String(value || "").trim().slice(0, 120);
  if (!safe) return "marketing_site";
  return safe;
};

const buildWaitlistDocId = (email = "") =>
  `wl_${email.replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 140) || "unknown"}`;

const normalizeMarketingPrivateInviteCode = (value = "", maxLen = 24) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9@]/g, "")
    .slice(0, Math.max(4, Number(maxLen || 24)));

const parseMarketingPrivateInviteCodes = (value = "") => {
  const raw = Array.isArray(value)
    ? value
    : String(value || "").split(/[,\n;|]/g);
  const out = [];
  const seen = new Set();
  raw.forEach((entry) => {
    const code = normalizeMarketingPrivateInviteCode(entry, 24);
    if (!code || seen.has(code)) return;
    seen.add(code);
    out.push(code);
  });
  return out;
};

const parseMarketingUidSet = (value = "") => {
  const raw = Array.isArray(value)
    ? value
    : String(value || "").split(/[,\n;|]/g);
  const out = new Set();
  raw.forEach((entry) => {
    const token = String(entry || "").trim().slice(0, 180);
    if (!token) return;
    out.add(token);
  });
  return out;
};

const parseMarketingRoomCodeSet = (value = "") => {
  const raw = Array.isArray(value)
    ? value
    : String(value || "").split(/[,\n;|]/g);
  const out = new Set();
  raw.forEach((entry) => {
    const token = normalizeRoomCode(entry);
    if (!token) return;
    out.add(token);
  });
  return out;
};

const DIRECTORY_MODERATOR_ROLES = new Set(["directory_editor", "directory_admin"]);
const DIRECTORY_ENTITY_TYPES = new Set(["host", "venue", "performer", "event", "session"]);
const DIRECTORY_LISTING_TYPES = new Set(["venue", "event", "room_session"]);
const DIRECTORY_ALLOWED_VISIBILITY = new Set(["public", "private"]);
const DIRECTORY_ALLOWED_STATUSES = new Set(["pending", "approved", "rejected", "disabled"]);
const DIRECTORY_ALLOWED_REVIEW_TAGS = new Set([
  "host_vibe",
  "rotation_speed",
  "song_quality",
  "sound_mix",
  "crowd_energy",
  "welcoming",
  "gear_quality",
  "karaoke_focus",
  "value",
]);
const DIRECTORY_SYNC_PROVIDER_SET = new Set(["google", "yelp"]);
const DIRECTORY_SYNC_MAX_BATCH = 80;
const DIRECTORY_DEFAULT_COUNTRY = "US";
const DIRECTORY_DEFAULT_REGION = "nationwide";
const DIRECTORY_MAPS_PUBLIC_ENABLED = String(process.env.DIRECTORY_MAPS_PUBLIC_ENABLED || "false")
  .trim()
  .toLowerCase() === "true";
const MARKETING_CLAIM_FLOW_ENABLED = String(process.env.MARKETING_CLAIM_FLOW_ENABLED || "true")
  .trim()
  .toLowerCase() === "true";
const MARKETING_RSVP_ENABLED = String(process.env.MARKETING_RSVP_ENABLED || "true")
  .trim()
  .toLowerCase() === "true";
const MARKETING_SMS_REMINDERS_ENABLED = String(process.env.MARKETING_SMS_REMINDERS_ENABLED || "false")
  .trim()
  .toLowerCase() === "true";
const MARKETING_GEO_PAGES_ENABLED = String(process.env.MARKETING_GEO_PAGES_ENABLED || "true")
  .trim()
  .toLowerCase() === "true";
const MARKETING_DISCOVER_GOOGLE_STATIC_IMAGES_ENABLED = String(process.env.MARKETING_DISCOVER_GOOGLE_STATIC_IMAGES_ENABLED || "false")
  .trim()
  .toLowerCase() === "true";
const MARKETING_DISCOVER_OFFICIAL_HOST_UIDS = parseMarketingUidSet(
  process.env.MARKETING_DISCOVER_OFFICIAL_HOST_UIDS || ""
);
const MARKETING_DISCOVER_OFFICIAL_ROOM_CODES = parseMarketingRoomCodeSet(
  process.env.MARKETING_DISCOVER_OFFICIAL_ROOM_CODES || ""
);
const MARKETING_PRIVATE_HOST_ACCESS_ENFORCED = String(process.env.MARKETING_PRIVATE_HOST_ACCESS_ENFORCED || "true")
  .trim()
  .toLowerCase() === "true";
const MARKETING_PRIVATE_INVITE_CODES = parseMarketingPrivateInviteCodes(
  process.env.MARKETING_PRIVATE_INVITE_CODES || process.env.MARKETING_PRIVATE_INVITE_CODE || ""
);
const DIRECTORY_CLAIM_LISTING_TYPES = new Set(["host", "venue", "performer", "event", "room_session"]);
const DIRECTORY_RSVP_STATUSES = new Set(["going", "interested", "not_going", "cancelled"]);
const DIRECTORY_REMINDER_CHANNELS = new Set(["email", "sms"]);
const DIRECTORY_REMINDER_ELIGIBLE_STATUSES = new Set(["going", "interested"]);
const DIRECTORY_REMINDER_SLOTS = [
  { id: "24h", maxMs: 24 * 60 * 60 * 1000, minMsExclusive: 2 * 60 * 60 * 1000 },
  { id: "2h", maxMs: 2 * 60 * 60 * 1000, minMsExclusive: 0 },
];
const DIRECTORY_REMINDER_MAX_BATCH = 250;
const MARKETING_REPORTING_WORKSTREAMS = new Set([
  "discover",
  "host_growth",
  "venue_growth",
  "performer_growth",
  "fan_growth",
  "demo",
  "acquisition",
  "admin_ops",
  "core",
]);
const MARKETING_REPORTING_MAX_BATCH = 25;
const DIRECTORY_DISCOVER_TIME_WINDOWS = new Set(["all", "now", "tonight", "this_week"]);
const DIRECTORY_DISCOVER_SORT_MODES = new Set(["smart", "soonest", "recent", "title"]);
const DIRECTORY_DISCOVER_DEFAULT_LIMIT = 40;
const DIRECTORY_DISCOVER_HOST_INSIGHTS_CACHE_TTL_MS = Math.max(
  15000,
  Number(process.env.DIRECTORY_DISCOVER_HOST_INSIGHTS_CACHE_TTL_MS || 90000)
);
const DIRECTORY_DISCOVER_HOST_INSIGHTS_ROOM_LIMIT = Math.max(
  120,
  Math.min(1000, Number(process.env.DIRECTORY_DISCOVER_HOST_INSIGHTS_ROOM_LIMIT || 480))
);
const DIRECTORY_DISCOVER_MAX_HOST_META_IDS = Math.max(
  20,
  Math.min(220, Number(process.env.DIRECTORY_DISCOVER_MAX_HOST_META_IDS || 140))
);
const DIRECTORY_DISCOVER_MAX_VENUE_META_IDS = Math.max(
  20,
  Math.min(260, Number(process.env.DIRECTORY_DISCOVER_MAX_VENUE_META_IDS || 180))
);
const DIRECTORY_DISCOVER_HOST_PLAN_TIERS = new Set(["host", "host_plus", "pro", "business", "enterprise"]);

let directoryDiscoverHostInsightsCache = {
  expiresAtMs: 0,
  byHostUid: new Map(),
  rankByHostUid: new Map(),
  sampleSize: 0,
};

const buildDirectoryNow = () => admin.firestore.FieldValue.serverTimestamp();

const safeDirectoryString = (value = "", maxLen = 180) =>
  String(value || "").trim().slice(0, maxLen);

const normalizeDirectoryToken = (value = "", maxLen = 120) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLen);

const normalizeDirectoryTextBlock = (value = "", maxLen = 5000) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLen);

const normalizeDirectoryOptionalUrl = (value = "") => {
  const url = safeDirectoryString(value, 2048);
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) return "";
  return url;
};

const normalizeDirectoryStringArray = (input = [], maxItems = 8, maxLen = 260) => {
  const source = Array.isArray(input) ? input : [input];
  const seen = new Set();
  const output = [];
  source.forEach((entry) => {
    const value = safeDirectoryString(entry, maxLen);
    if (!value || seen.has(value)) return;
    seen.add(value);
    output.push(value);
  });
  return output.slice(0, Math.max(1, Number(maxItems || 8)));
};

const normalizeDirectoryUrlArray = (input = [], maxItems = 8) => {
  const source = Array.isArray(input) ? input : [input];
  const seen = new Set();
  const output = [];
  source.forEach((entry) => {
    if (entry && typeof entry === "object") {
      const nested = [
        entry.url,
        entry.src,
        entry.imageUrl,
        entry.photoUrl,
      ];
      nested.forEach((candidate) => {
        const safeUrl = normalizeDirectoryOptionalUrl(candidate || "");
        if (!safeUrl || seen.has(safeUrl)) return;
        seen.add(safeUrl);
        output.push(safeUrl);
      });
      return;
    }
    const safeUrl = normalizeDirectoryOptionalUrl(entry || "");
    if (!safeUrl || seen.has(safeUrl)) return;
    seen.add(safeUrl);
    output.push(safeUrl);
  });
  return output.slice(0, Math.max(1, Number(maxItems || 8)));
};

const normalizeDirectoryLatLng = (input = {}) => {
  const lat = Number(input?.lat);
  const lng = Number(input?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
};

const normalizeDirectoryRoles = (input = []) => {
  const source = Array.isArray(input) ? input : [];
  const roleSet = new Set();
  source.forEach((entry) => {
    const token = normalizeDirectoryToken(entry, 40);
    if (!token) return;
    if (["host", "venue_owner", "performer", "fan"].includes(token)) {
      roleSet.add(token);
    }
  });
  if (!roleSet.size) roleSet.add("fan");
  return Array.from(roleSet);
};

const normalizeDirectoryStatus = (value = "", fallback = "pending") => {
  const token = normalizeDirectoryToken(value, 20);
  if (DIRECTORY_ALLOWED_STATUSES.has(token)) return token;
  return fallback;
};

const normalizeDirectoryVisibility = (value = "", fallback = "public") => {
  const token = normalizeDirectoryToken(value, 20);
  if (DIRECTORY_ALLOWED_VISIBILITY.has(token)) return token;
  return fallback;
};

const normalizeDirectoryProviders = (input = []) => {
  const values = Array.isArray(input) ? input : [input];
  const providers = [];
  values.forEach((provider) => {
    const token = normalizeDirectoryToken(provider, 20);
    if (!token || !DIRECTORY_SYNC_PROVIDER_SET.has(token)) return;
    if (providers.includes(token)) return;
    providers.push(token);
  });
  if (!providers.length) {
    providers.push("google");
    providers.push("yelp");
  }
  return providers;
};

const normalizeDirectoryDateWindowDays = (value = "14d") => {
  const token = normalizeDirectoryToken(value || "14d", 20);
  if (token === "today") return 1;
  if (token === "this_week" || token === "week") return 7;
  if (token === "this_month" || token === "month") return 30;
  const rawNum = Number(String(token || "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(rawNum)) return 14;
  return Math.max(1, Math.min(60, Math.floor(rawNum)));
};

const normalizeDirectoryDiscoverTimeWindow = (value = "all") => {
  const token = normalizeDirectoryToken(value || "all", 30) || "all";
  if (DIRECTORY_DISCOVER_TIME_WINDOWS.has(token)) return token;
  return "all";
};

const normalizeDirectoryDiscoverSortMode = (value = "smart") => {
  const token = normalizeDirectoryToken(value || "smart", 30) || "smart";
  if (DIRECTORY_DISCOVER_SORT_MODES.has(token)) return token;
  return "smart";
};

const normalizeDirectoryDiscoverCursor = (value = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const normalizeDirectoryDiscoverBounds = (value = null) => {
  if (!value || typeof value !== "object") return null;
  const north = Number(value.north);
  const south = Number(value.south);
  const east = Number(value.east);
  const west = Number(value.west);
  if (![north, south, east, west].every(Number.isFinite)) return null;
  if (north < south || north > 90 || south < -90 || east > 180 || east < -180 || west > 180 || west < -180) {
    return null;
  }
  return { north, south, east, west };
};

const isDirectoryLocationInBounds = (location = null, bounds = null) => {
  if (!location || !bounds) return false;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const inLat = lat >= bounds.south && lat <= bounds.north;
  const inLng = bounds.west <= bounds.east
    ? lng >= bounds.west && lng <= bounds.east
    : lng >= bounds.west || lng <= bounds.east;
  return inLat && inLng;
};

const hasBeauRocksBrandHint = (...parts) =>
  parts.some((value) => String(value || "").toLowerCase().includes("beaurocks"));

const isOfficialBeauRocksRoomListing = (listing = {}) => {
  if (String(listing?.listingType || "") !== "room_session") return false;
  if (listing?.isOfficialBeauRocksRoom === true) return true;
  const hostUid = String(listing?.hostUid || "").trim();
  const roomCode = normalizeRoomCode(listing?.roomCode || "");
  if (hostUid && MARKETING_DISCOVER_OFFICIAL_HOST_UIDS.has(hostUid)) return true;
  if (roomCode && MARKETING_DISCOVER_OFFICIAL_ROOM_CODES.has(roomCode)) return true;
  return hasBeauRocksBrandHint(listing?.title, listing?.hostName, listing?.venueName);
};

const getDirectoryDiscoverVenueId = (listing = {}) => {
  const listingType = String(listing?.listingType || "").trim().toLowerCase();
  if (listingType === "venue") return safeDirectoryString(listing?.id || "", 180);
  return safeDirectoryString(listing?.venueId || "", 180);
};

const listDirectoryDiscoverHostUids = (items = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const primary = safeDirectoryString(item?.hostUid || "", 180);
    const fallback = safeDirectoryString(item?.ownerUid || "", 180);
    const uid = primary || fallback;
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    out.push(uid);
  });
  return out;
};

const fetchDirectoryDiscoverHostInsights = async () => {
  const now = Date.now();
  const cached = directoryDiscoverHostInsightsCache;
  if (cached.expiresAtMs > now) return cached;

  const roomsRef = getRootRef().collection("rooms");
  let roomSnap = null;
  try {
    roomSnap = await roomsRef
      .orderBy("updatedAt", "desc")
      .limit(DIRECTORY_DISCOVER_HOST_INSIGHTS_ROOM_LIMIT)
      .get();
  } catch (_error) {
    roomSnap = await roomsRef
      .limit(DIRECTORY_DISCOVER_HOST_INSIGHTS_ROOM_LIMIT)
      .get();
  }

  const byHostUid = new Map();
  roomSnap.docs.forEach((docSnap) => {
    const room = docSnap.data() || {};
    const hostUid = safeDirectoryString(room.hostUid || "", 180);
    if (!hostUid) return;
    const recap = room.recap && typeof room.recap === "object" ? room.recap : null;
    const songs = Math.max(0, Number(recap?.totalSongs || 0) || 0);
    const users = Math.max(0, Number(recap?.totalUsers || 0) || 0);
    const existing = byHostUid.get(hostUid) || {
      hostUid,
      hostedRooms: 0,
      recapCount: 0,
      totalSongs: 0,
      totalUsers: 0,
      score: 0,
    };
    existing.hostedRooms += 1;
    if (recap) {
      existing.recapCount += 1;
      existing.totalSongs += songs;
      existing.totalUsers += users;
    }
    existing.score = Math.round(
      (existing.recapCount * 25)
      + (existing.totalSongs * 3)
      + existing.totalUsers
      + (existing.hostedRooms * 2)
    );
    byHostUid.set(hostUid, existing);
  });

  const rankedHosts = Array.from(byHostUid.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.recapCount !== a.recapCount) return b.recapCount - a.recapCount;
      return String(a.hostUid || "").localeCompare(String(b.hostUid || ""));
    });
  const rankByHostUid = new Map();
  rankedHosts.forEach((entry, index) => {
    rankByHostUid.set(entry.hostUid, index + 1);
  });

  const nextCache = {
    expiresAtMs: now + DIRECTORY_DISCOVER_HOST_INSIGHTS_CACHE_TTL_MS,
    byHostUid,
    rankByHostUid,
    sampleSize: roomSnap.size,
  };
  directoryDiscoverHostInsightsCache = nextCache;
  return nextCache;
};

const fetchDirectoryDiscoverHostAccountMeta = async (db, hostUids = []) => {
  const safeHostUids = Array.from(new Set((Array.isArray(hostUids) ? hostUids : [])
    .map((uid) => safeDirectoryString(uid || "", 180))
    .filter(Boolean)))
    .slice(0, DIRECTORY_DISCOVER_MAX_HOST_META_IDS);
  const byHostUid = new Map();
  if (!safeHostUids.length) return byHostUid;

  const profileRefs = safeHostUids.map((uid) => db.collection("directory_profiles").doc(uid));
  const userRefs = safeHostUids.map((uid) => db.collection("users").doc(uid));
  const [profileSnaps, userSnaps] = await Promise.all([
    db.getAll(...profileRefs),
    db.getAll(...userRefs),
  ]);

  safeHostUids.forEach((uid, index) => {
    const profileData = profileSnaps[index]?.exists ? (profileSnaps[index].data() || {}) : {};
    const userData = userSnaps[index]?.exists ? (userSnaps[index].data() || {}) : {};
    const roles = Array.isArray(profileData.roles)
      ? profileData.roles.map((entry) => normalizeDirectoryToken(entry, 40)).filter(Boolean)
      : [];
    const tier = normalizeDirectoryToken(userData?.subscription?.tier || "", 40);
    const hasHostRole = roles.includes("host") || roles.includes("venue_owner") || roles.includes("directory_admin");
    const hasHostPlan = !!tier && DIRECTORY_DISCOVER_HOST_PLAN_TIERS.has(tier);
    byHostUid.set(uid, {
      hasAccount: !!(profileSnaps[index]?.exists || userSnaps[index]?.exists),
      hasHostRole,
      hasHostPlan,
      tier,
    });
  });
  return byHostUid;
};

const fetchDirectoryDiscoverVenueEngagementMeta = async (db, venueIds = []) => {
  const safeVenueIds = Array.from(new Set((Array.isArray(venueIds) ? venueIds : [])
    .map((id) => safeDirectoryString(id || "", 180))
    .filter(Boolean)))
    .slice(0, DIRECTORY_DISCOVER_MAX_VENUE_META_IDS);
  const byVenueId = new Map();
  if (!safeVenueIds.length) return byVenueId;

  const reviewRefs = safeVenueIds.map((id) =>
    db.collection("review_totals").doc(buildDirectoryCheckinTotalDocId("venue", id))
  );
  const checkinRefs = safeVenueIds.map((id) =>
    db.collection("checkin_totals").doc(buildDirectoryCheckinTotalDocId("venue", id))
  );
  const [reviewSnaps, checkinSnaps] = await Promise.all([
    db.getAll(...reviewRefs),
    db.getAll(...checkinRefs),
  ]);

  safeVenueIds.forEach((venueId, index) => {
    const reviewData = reviewSnaps[index]?.exists ? (reviewSnaps[index].data() || {}) : {};
    const checkinData = checkinSnaps[index]?.exists ? (checkinSnaps[index].data() || {}) : {};
    const reviewCount = Math.max(0, Number(reviewData.reviewCount || 0) || 0);
    const ratingSum = Math.max(0, Number(reviewData.ratingSum || 0) || 0);
    const averageRating = reviewCount > 0 ? Number((ratingSum / reviewCount).toFixed(2)) : 0;
    const checkinCount = Math.max(0, Number(checkinData.totalCount || 0) || 0);
    const leaderboardScore = Math.round(
      (averageRating * 20)
      + (Math.min(checkinCount, 120) * 0.8)
      + (Math.min(reviewCount, 80) * 1.5)
    );
    byVenueId.set(venueId, {
      reviewCount,
      averageRating,
      checkinCount,
      leaderboardScore,
    });
  });
  return byVenueId;
};

const listDirectoryDiscoverVenueIds = (items = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const venueId = getDirectoryDiscoverVenueId(item);
    if (!venueId || seen.has(venueId)) return;
    seen.add(venueId);
    out.push(venueId);
  });
  return out;
};

const rankDirectoryDiscoverVenues = (byVenueId = new Map()) => {
  const ranked = Array.from(byVenueId.entries())
    .map(([venueId, meta]) => ({
      venueId,
      leaderboardScore: Math.max(0, Number(meta?.leaderboardScore || 0) || 0),
      checkinCount: Math.max(0, Number(meta?.checkinCount || 0) || 0),
      reviewCount: Math.max(0, Number(meta?.reviewCount || 0) || 0),
      averageRating: Math.max(0, Number(meta?.averageRating || 0) || 0),
    }))
    .sort((a, b) => {
      if (b.leaderboardScore !== a.leaderboardScore) return b.leaderboardScore - a.leaderboardScore;
      if (b.checkinCount !== a.checkinCount) return b.checkinCount - a.checkinCount;
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      return String(a.venueId || "").localeCompare(String(b.venueId || ""));
    });
  const rankByVenueId = new Map();
  ranked.forEach((entry, index) => {
    rankByVenueId.set(entry.venueId, index + 1);
  });
  return rankByVenueId;
};

const buildDirectoryPublicListing = (docSnap, forcedType = "") => {
  const data = docSnap.data() || {};
  const listingType = forcedType || safeDirectoryString(data.listingType || "", 40);
  const hostUid = safeDirectoryString(data.hostUid || "", 180);
  const ownerUid = safeDirectoryString(data.ownerUid || "", 180);
  const roomCode = safeDirectoryString(data.roomCode || "", 40);
  const title = safeDirectoryString(data.title || "", 200);
  const hostName = safeDirectoryString(data.hostName || "", 180);
  const venueName = safeDirectoryString(data.venueName || "", 180);
  const explicitOfficial = parseBooleanInput(
    data.isOfficialBeauRocksRoom ?? data.officialBeauRocksRoom ?? data.isOfficialRoom,
    false
  );
  const baseListing = {
    listingType,
    title,
    hostUid,
    hostName,
    ownerUid,
    venueName,
    roomCode,
    isOfficialBeauRocksRoom: explicitOfficial,
  };
  return {
    id: docSnap.id,
    listingType,
    title,
    description: normalizeDirectoryTextBlock(data.description || "", 400),
    city: safeDirectoryString(data.city || "", 80),
    state: safeDirectoryString(data.state || "", 40),
    region: normalizeDirectoryToken(data.region || "", 80),
    startsAtMs: Number(data.startsAtMs || 0) || 0,
    endsAtMs: Number(data.endsAtMs || 0) || 0,
    venueId: safeDirectoryString(data.venueId || "", 180),
    venueName,
    hostUid,
    hostName,
    ownerUid,
    roomCode,
    recurringRule: safeDirectoryString(data.recurringRule || "", 160),
    karaokeNightsLabel: safeDirectoryString(data.karaokeNightsLabel || "", 200),
    location: normalizeDirectoryLatLng(data.location || {}),
    status: normalizeDirectoryStatus(data.status || "approved", "approved"),
    visibility: normalizeDirectoryVisibility(data.visibility || "public", "public"),
    virtualOnly: !!data.virtualOnly || !!data.isVirtualOnly,
    sessionMode: safeDirectoryString(data.sessionMode || "", 40),
    sourceType: normalizeDirectoryToken(data.sourceType || "", 20),
    imageUrl: normalizeDirectoryOptionalUrl(data.imageUrl || ""),
    externalSources: data.externalSources && typeof data.externalSources === "object"
      ? data.externalSources
      : {},
    isOfficialBeauRocksRoom: isOfficialBeauRocksRoomListing(baseListing),
  };
};

const matchesDirectoryDiscoverSearch = (item = {}, token = "") => {
  const searchToken = String(token || "").trim().toLowerCase();
  if (!searchToken) return true;
  const haystack = normalizeDirectoryTextBlock([
    item.title,
    item.description,
    item.city,
    item.state,
    item.venueName,
    item.hostName,
    item.roomCode,
  ].filter(Boolean).join(" "), 1000).toLowerCase();
  return haystack.includes(searchToken);
};

const matchesDirectoryDiscoverTimeWindow = (item = {}, timeWindow = "all", nowMs = Date.now()) => {
  const startsAtMs = Number(item.startsAtMs || 0);
  if (timeWindow === "all") return true;
  if (!startsAtMs) return false;
  const msPerHour = 60 * 60 * 1000;
  const liveLookbackMs = 2 * msPerHour;
  if (timeWindow === "now") {
    return startsAtMs >= (nowMs - liveLookbackMs) && startsAtMs <= (nowMs + msPerHour);
  }
  if (timeWindow === "this_week") {
    return startsAtMs >= (nowMs - liveLookbackMs) && startsAtMs <= (nowMs + (7 * 24 * msPerHour));
  }
  if (timeWindow === "tonight") {
    const now = new Date(nowMs);
    const start = new Date(now);
    start.setHours(17, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(2, 0, 0, 0);
    if (now.getHours() < 2) {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    }
    return startsAtMs >= start.getTime() && startsAtMs <= end.getTime();
  }
  return true;
};

const requireDirectoryEntityType = (value = "") => {
  const type = normalizeDirectoryToken(value, 30);
  if (!DIRECTORY_ENTITY_TYPES.has(type)) {
    throw new HttpsError("invalid-argument", "Invalid directory targetType.");
  }
  return type;
};

const requireDirectoryListingType = (value = "") => {
  const listingType = normalizeDirectoryToken(value, 40);
  if (!DIRECTORY_LISTING_TYPES.has(listingType)) {
    throw new HttpsError("invalid-argument", "listingType must be venue, event, or room_session.");
  }
  return listingType;
};

const requireDirectoryClaimListingType = (value = "") => {
  const listingType = normalizeDirectoryToken(value, 40);
  if (!DIRECTORY_CLAIM_LISTING_TYPES.has(listingType)) {
    throw new HttpsError("invalid-argument", "Invalid claim listingType.");
  }
  return listingType;
};

const ensureDirectoryCollectionName = (listingType = "") => {
  if (listingType === "venue") return "venues";
  if (listingType === "event") return "karaoke_events";
  if (listingType === "room_session") return "room_sessions";
  throw new HttpsError("invalid-argument", "Unknown listingType.");
};

const ensureDirectoryClaimCollectionName = (listingType = "") => {
  if (listingType === "host" || listingType === "performer") return "directory_profiles";
  return ensureDirectoryCollectionName(listingType);
};

const ensureDirectoryReminderTargetCollection = (targetType = "") => {
  const token = normalizeDirectoryToken(targetType, 30);
  if (token === "event") return "karaoke_events";
  if (token === "session" || token === "room_session") return "room_sessions";
  throw new HttpsError("invalid-argument", "Reminder targetType must be event or session.");
};

const buildDirectoryReminderDispatchId = (docId = "", slotId = "", channel = "") => {
  const d = normalizeDirectoryToken(docId, 140);
  const s = normalizeDirectoryToken(slotId, 20);
  const c = normalizeDirectoryToken(channel, 20);
  return `${d}_${s}_${c}`.slice(0, 240);
};

const pickDirectoryReminderSlot = (timeUntilMs = 0) => {
  const value = Number(timeUntilMs || 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  return (
    DIRECTORY_REMINDER_SLOTS.find(
      (slot) => value <= slot.maxMs && value > slot.minMsExclusive
    ) || null
  );
};

const buildDirectorySubmissionId = (listingType = "", uid = "") => {
  const token = normalizeDirectoryToken(`${listingType}_${uid}`, 60) || "submission";
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `sub_${token}_${ts}_${rand}`;
};

const buildDirectoryCanonicalId = (listingType = "", title = "", city = "", state = "") => {
  const titleToken = normalizeDirectoryToken(title, 60) || "listing";
  const cityToken = normalizeDirectoryToken(city, 40) || "city";
  const stateToken = normalizeDirectoryToken(state, 12) || "st";
  const ts = Date.now();
  return `${listingType}_${titleToken}_${cityToken}_${stateToken}_${ts}`;
};

const buildDirectoryFollowDocId = (followerUid = "", targetType = "", targetId = "") => {
  const uidToken = normalizeDirectoryToken(followerUid, 80);
  const typeToken = normalizeDirectoryToken(targetType, 30);
  const idToken = normalizeDirectoryToken(targetId, 180);
  return `${uidToken}_${typeToken}_${idToken}`.slice(0, 260);
};

const buildDirectoryCheckinTotalDocId = (targetType = "", targetId = "") => {
  const typeToken = normalizeDirectoryToken(targetType, 30);
  const idToken = normalizeDirectoryToken(targetId, 180);
  return `${typeToken}_${idToken}`.slice(0, 230);
};

const buildDirectoryReviewDocId = (uid = "", targetType = "", targetId = "", eventId = "") => {
  const uidToken = normalizeDirectoryToken(uid, 80);
  const typeToken = normalizeDirectoryToken(targetType, 30);
  const idToken = normalizeDirectoryToken(targetId, 120);
  const eventToken = normalizeDirectoryToken(eventId || "direct", 80);
  return `${uidToken}_${typeToken}_${idToken}_${eventToken}`.slice(0, 260);
};

const buildDirectoryClaimDocId = (uid = "", listingType = "", listingId = "") => {
  const uidToken = normalizeDirectoryToken(uid, 80);
  const typeToken = normalizeDirectoryToken(listingType, 30);
  const idToken = normalizeDirectoryToken(listingId, 160);
  return `${uidToken}_${typeToken}_${idToken}`.slice(0, 260);
};

const buildDirectoryRsvpDocId = (uid = "", targetType = "", targetId = "") =>
  buildDirectoryFollowDocId(uid, targetType, targetId);

const normalizeDirectoryRsvpStatus = (value = "") => {
  const token = normalizeDirectoryToken(value || "going", 20) || "going";
  if (DIRECTORY_RSVP_STATUSES.has(token)) return token;
  return "going";
};

const normalizeDirectoryReminderChannels = (input = []) => {
  const source = Array.isArray(input) ? input : [input];
  const channels = [];
  source.forEach((entry) => {
    const token = normalizeDirectoryToken(entry, 20);
    if (!token || !DIRECTORY_REMINDER_CHANNELS.has(token)) return;
    if (channels.includes(token)) return;
    channels.push(token);
  });
  return channels;
};

const normalizeDirectoryPhone = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return "";
  if (cleaned.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
};

const normalizeDirectoryReviewTags = (input = []) => {
  const source = Array.isArray(input) ? input : [];
  const deduped = [];
  source.forEach((tag) => {
    const token = normalizeDirectoryToken(tag, 40);
    if (!token || !DIRECTORY_ALLOWED_REVIEW_TAGS.has(token)) return;
    if (deduped.includes(token)) return;
    deduped.push(token);
  });
  return deduped.slice(0, 6);
};

const buildUtcDayKey = (ms = Date.now()) => {
  const date = new Date(Number(ms || Date.now()));
  if (Number.isNaN(date.getTime())) return 0;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return Number(`${year}${month}${day}`);
};

const normalizeMarketingEventName = (value = "") =>
  normalizeDirectoryToken(value, 64);

const normalizeMarketingParamValue = (value = "") =>
  String(value ?? "")
    .trim()
    .slice(0, 260);

const toNumberRecord = (input = {}) => {
  if (!isPlainObject(input)) return {};
  const out = {};
  Object.entries(input).forEach(([key, value]) => {
    const token = normalizeDirectoryToken(key, 64);
    const num = Number(value);
    if (!token || !Number.isFinite(num) || num === 0) return;
    out[token] = num;
  });
  return out;
};

const incrementPatchField = (patch = {}, key = "", amount = 1) => {
  const safeKey = String(key || "").trim();
  if (!safeKey) return;
  const safeAmount = Number(amount || 0);
  if (!Number.isFinite(safeAmount) || safeAmount === 0) return;
  patch[safeKey] = admin.firestore.FieldValue.increment(safeAmount);
};

const resolveMarketingWorkstream = (eventName = "", params = {}) => {
  const name = normalizeMarketingEventName(eventName);
  const workstreamHint = normalizeDirectoryToken(params.workstream || "", 40);
  const persona = normalizeDirectoryToken(params.persona || "", 40);
  const listingType = normalizeDirectoryToken(params.listingType || "", 40);
  const targetType = normalizeDirectoryToken(params.targetType || "", 40);

  if (MARKETING_REPORTING_WORKSTREAMS.has(workstreamHint)) return workstreamHint;

  if (name.startsWith("mk_demo_")) return "demo";
  if (name.startsWith("mk_discover_") || name.startsWith("mk_geo_")) return "discover";
  if (name.startsWith("mk_admin_") || name.includes("moderation")) return "admin_ops";
  if (name.startsWith("marketing_account_")) return "acquisition";
  if (persona === "host" || name.includes("cadence_update") || name.includes("room_session")) return "host_growth";
  if (persona === "venue_owner" || listingType === "venue" || name.includes("listing_claim")) return "venue_growth";
  if (persona === "performer" || targetType === "performer" || name.includes("performer")) return "performer_growth";
  if (
    persona === "fan"
    || name.startsWith("mk_rsvp_")
    || name.startsWith("mk_follow_")
    || name.startsWith("mk_checkin_")
    || name.startsWith("mk_review_")
    || name.startsWith("mk_reminder_")
  ) {
    return "fan_growth";
  }
  if (name.startsWith("mk_page_view_") || name.startsWith("mk_persona_cta_")) return "discover";
  return "core";
};

const resolveGoldenPathSignal = (eventName = "", params = {}) => {
  const name = normalizeMarketingEventName(eventName);
  const cta = normalizeDirectoryToken(params.cta || "", 80);
  const listingType = normalizeDirectoryToken(params.listingType || "", 40);
  const status = normalizeDirectoryToken(params.status || "", 40);
  const mode = normalizeDirectoryToken(params.mode || "", 40);
  const enabled = Number(params.enabled || 0) === 1;

  if (name === "mk_golden_path_entry") {
    const pathId = normalizeDirectoryToken(params.pathId || "", 80);
    if (!pathId) return null;
    return { pathId, signalType: "entry" };
  }
  if (name === "mk_golden_path_milestone") {
    const pathId = normalizeDirectoryToken(params.pathId || "", 80);
    if (!pathId) return null;
    return { pathId, signalType: "milestone" };
  }

  if (name === "mk_persona_cta_click" && cta.startsWith("rail_")) {
    const pathByCta = {
      rail_for_hosts: "host_entry",
      rail_for_venues: "venue_entry",
      rail_for_performers: "performer_entry",
      rail_for_fans: "fan_entry",
      rail_try_demo: "demo_entry",
      rail_join_room_code: "host_join_entry",
    };
    const pathId = normalizeDirectoryToken(pathByCta[cta] || "", 80);
    if (!pathId) return null;
    return { pathId, signalType: "entry" };
  }

  if (name === "mk_listing_created_room_session") return { pathId: "host_create_session", signalType: "milestone" };
  if (name === "mk_listing_created_event") return { pathId: "host_publish_event", signalType: "milestone" };
  if (name === "mk_listing_created_venue") return { pathId: "venue_submit_listing", signalType: "milestone" };
  if (name === "mk_listing_claim_submit" && listingType === "venue") {
    return { pathId: "venue_claim_listing", signalType: "milestone" };
  }
  if (name === "mk_rsvp_set" && ["going", "interested"].includes(status)) {
    return { pathId: "fan_rsvp", signalType: "milestone" };
  }
  if (name === "mk_follow_set" && mode === "follow") {
    return { pathId: "fan_follow", signalType: "milestone" };
  }
  if (name === "mk_demo_live_sync_toggle" && enabled) {
    return { pathId: "demo_live_sync", signalType: "milestone" };
  }

  return null;
};

const normalizeMarketingTelemetryEvent = (raw = {}, fallback = {}) => {
  if (!isPlainObject(raw)) return null;
  const name = normalizeMarketingEventName(raw.name || raw.eventName || "");
  if (!name) return null;
  if (!name.startsWith("mk_") && !name.startsWith("marketing_")) return null;
  const params = isPlainObject(raw.params) ? raw.params : {};
  const atMs = clampNumber(raw.atMs ?? fallback.atMs ?? Date.now(), 0, Date.now() + 300000, Date.now());
  const sessionId = normalizeDirectoryToken(raw.sessionId || fallback.sessionId || "", 120);
  const routePage = normalizeDirectoryToken(
    raw.routePage || raw.page || params.route || params.page || fallback.routePage || "",
    80
  );
  const workstream = resolveMarketingWorkstream(name, params);
  const goldenPath = resolveGoldenPathSignal(name, params);
  return {
    name,
    atMs,
    sessionId,
    routePage,
    workstream: MARKETING_REPORTING_WORKSTREAMS.has(workstream) ? workstream : "core",
    goldenPathId: goldenPath?.pathId || "",
    goldenPathSignalType: goldenPath?.signalType || "",
    params: {
      persona: normalizeDirectoryToken(params.persona || "", 40),
      cta: normalizeDirectoryToken(params.cta || "", 80),
      status: normalizeDirectoryToken(params.status || "", 40),
      mode: normalizeDirectoryToken(params.mode || "", 40),
      targetType: normalizeDirectoryToken(params.targetType || "", 40),
      listingType: normalizeDirectoryToken(params.listingType || "", 40),
      source: normalizeDirectoryToken(params.source || "", 60),
      route: normalizeDirectoryToken(params.route || "", 40),
      submissionId: normalizeMarketingParamValue(params.submissionId || ""),
    },
  };
};

const reduceMarketingReportData = (docs = [], windowDays = 30) => {
  const totals = {
    events: 0,
    goldenPathEvents: 0,
    entries: 0,
    milestones: 0,
  };
  const workstreamRollup = {};
  const goldenPathRollup = {};
  const routePageRollup = {};
  const eventRollup = {};

  MARKETING_REPORTING_WORKSTREAMS.forEach((key) => {
    workstreamRollup[key] = {
      events: 0,
      goldenPathEvents: 0,
      entries: 0,
      milestones: 0,
    };
  });

  docs.forEach((docSnap) => {
    const data = isPlainObject(docSnap?.data?.()) ? docSnap.data() : {};
    totals.events += Number(data.totalEvents || 0);
    totals.goldenPathEvents += Number(data.goldenPathEvents || 0);
    totals.entries += Number(data.goldenPathEntries || 0);
    totals.milestones += Number(data.goldenPathMilestones || 0);

    const streamObject = isPlainObject(data.workstreams) ? data.workstreams : {};
    Object.entries(streamObject).forEach(([workstreamRaw, metricsRaw]) => {
      const workstream = normalizeDirectoryToken(workstreamRaw, 40);
      if (!MARKETING_REPORTING_WORKSTREAMS.has(workstream)) return;
      const metrics = toNumberRecord(metricsRaw || {});
      ["events", "goldenpathevents", "entries", "milestones"].forEach((metric) => {
        const amount = Number(metrics[metric] || 0);
        if (!amount) return;
        const canonicalMetric = metric === "goldenpathevents" ? "goldenPathEvents" : metric;
        workstreamRollup[workstream][canonicalMetric] += amount;
      });
    });

    Object.entries(toNumberRecord(data.goldenPaths || {})).forEach(([key, amount]) => {
      goldenPathRollup[key] = (goldenPathRollup[key] || 0) + amount;
    });
    Object.entries(toNumberRecord(data.routePages || {})).forEach(([key, amount]) => {
      routePageRollup[key] = (routePageRollup[key] || 0) + amount;
    });
    Object.entries(toNumberRecord(data.events || {})).forEach(([key, amount]) => {
      eventRollup[key] = (eventRollup[key] || 0) + amount;
    });
  });

  const workstreams = Object.entries(workstreamRollup)
    .map(([id, value]) => ({
      id,
      events: Number(value.events || 0),
      goldenPathEvents: Number(value.goldenPathEvents || 0),
      entries: Number(value.entries || 0),
      milestones: Number(value.milestones || 0),
      sharePct: totals.events > 0 ? Math.round((Number(value.events || 0) / totals.events) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.events - a.events);

  const goldenPaths = Object.entries(goldenPathRollup)
    .map(([id, count]) => ({ id, count: Number(count || 0) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const routePages = Object.entries(routePageRollup)
    .map(([id, count]) => ({ id, count: Number(count || 0) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topEvents = Object.entries(eventRollup)
    .map(([id, count]) => ({ id, count: Number(count || 0) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  return {
    windowDays,
    totals,
    workstreams,
    goldenPaths,
    routePages,
    topEvents,
  };
};

const getDirectoryGoogleApiKey = () =>
  String(process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "").trim();

const directoryRoleDocRef = (uid = "") => admin.firestore().collection("directory_roles").doc(uid);

const getDirectoryModeratorAccess = async (uid = "") => {
  if (!uid) return { isModerator: false, isAdmin: false, roles: [] };
  if (await isSuperAdminUid(uid)) {
    return {
      isModerator: true,
      isAdmin: true,
      roles: ["directory_admin", "super_admin"],
      mode: "super_admin",
    };
  }
  const roleSnap = await directoryRoleDocRef(uid).get();
  const roles = Array.isArray(roleSnap.data()?.roles)
    ? roleSnap.data().roles.map((entry) => normalizeDirectoryToken(entry, 40)).filter(Boolean)
    : [];
  const isAdmin = roles.includes("directory_admin");
  const isModerator = isAdmin || roles.includes("directory_editor");
  return { isModerator, isAdmin, roles };
};

const marketingPrivateAccessDocRef = (uid = "") =>
  admin.firestore().collection("marketing_private_access").doc(uid);

const marketingPrivateInviteDocRef = (email = "") =>
  admin.firestore().collection("marketing_private_invites").doc(buildWaitlistDocId(normalizeEmailToken(email)));

const requireDirectoryModerator = async (request, options = {}) => {
  const uid = requireAuth(request, options.authMessage || "Sign in required.");
  const access = await getDirectoryModeratorAccess(uid);
  if (!access.isModerator) {
    throw new HttpsError("permission-denied", options.deniedMessage || "Directory moderator role required.");
  }
  return { uid, ...access };
};

const CATALOG_EDITOR_PROFILE_ROLES = new Set(["host", "venue_owner"]);
const CATALOG_EDITOR_SUBSCRIPTION_TIERS = new Set(["host", "host_plus"]);

const getCatalogContributorAccess = async (uid = "") => {
  if (!uid) return { allowed: false, reason: "missing_uid" };
  const db = admin.firestore();
  const [moderatorAccess, profileSnap, userSnap] = await Promise.all([
    getDirectoryModeratorAccess(uid),
    db.collection("directory_profiles").doc(uid).get(),
    db.collection("users").doc(uid).get(),
  ]);

  if (moderatorAccess?.isModerator) {
    return { allowed: true, mode: "moderator", roles: moderatorAccess.roles || [] };
  }

  const profileRoles = Array.isArray(profileSnap.data()?.roles)
    ? profileSnap.data().roles.map((role) => normalizeDirectoryToken(role, 40)).filter(Boolean)
    : [];
  if (profileRoles.some((role) => CATALOG_EDITOR_PROFILE_ROLES.has(role))) {
    return { allowed: true, mode: "profile_role", roles: profileRoles };
  }

  const subscriptionTier = normalizeDirectoryToken(userSnap.data()?.subscription?.tier || "", 40);
  if (CATALOG_EDITOR_SUBSCRIPTION_TIERS.has(subscriptionTier)) {
    return { allowed: true, mode: "subscription_tier", tier: subscriptionTier };
  }

  return { allowed: false, reason: "insufficient_role_or_tier" };
};

const requireCatalogContributor = async (request, options = {}) => {
  const uid = requireAuth(request, options.authMessage || "Sign in required.");
  const access = await getCatalogContributorAccess(uid);
  if (!access.allowed) {
    throw new HttpsError(
      "permission-denied",
      options.deniedMessage || "Host-level access required to write global catalog entries."
    );
  }
  return { uid, ...access };
};

const normalizeDirectoryProfilePayload = (payload = {}) => {
  const firstName = safeDirectoryString(payload?.firstName || "", 80);
  const lastName = safeDirectoryString(payload?.lastName || "", 80);
  const computedDisplayName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const displayName = safeDirectoryString(payload?.displayName || payload?.name || computedDisplayName || "", 120);
  if (!displayName) {
    throw new HttpsError("invalid-argument", "displayName is required.");
  }
  return {
    displayName,
    firstName,
    lastName,
    handle: normalizeDirectoryToken(payload?.handle || "", 40),
    bio: normalizeDirectoryTextBlock(payload?.bio || "", 500),
    roles: normalizeDirectoryRoles(payload?.roles || []),
    city: safeDirectoryString(payload?.city || "", 80),
    state: safeDirectoryString(payload?.state || "", 40),
    country: safeDirectoryString(payload?.country || DIRECTORY_DEFAULT_COUNTRY, 2).toUpperCase(),
    avatarUrl: normalizeDirectoryOptionalUrl(payload?.avatarUrl || payload?.profilePictureUrl || ""),
    visibility: normalizeDirectoryVisibility(payload?.visibility || "public", "public"),
    socialLinks: {
      instagram: normalizeDirectoryOptionalUrl(payload?.socialLinks?.instagram || ""),
      tiktok: normalizeDirectoryOptionalUrl(payload?.socialLinks?.tiktok || ""),
      spotify: normalizeDirectoryOptionalUrl(payload?.socialLinks?.spotify || ""),
      website: normalizeDirectoryOptionalUrl(payload?.socialLinks?.website || ""),
    },
  };
};

const normalizeDirectoryListingPayload = (listingType = "", payload = {}, callerUid = "") => {
  const title = safeDirectoryString(payload?.title || payload?.name || "", 180);
  if (!title) {
    throw new HttpsError("invalid-argument", "Listing title is required.");
  }
  const venueId = safeDirectoryString(payload?.venueId || "", 180);
  const hostUid = safeDirectoryString(payload?.hostUid || callerUid, 180) || callerUid;
  const performerUid = safeDirectoryString(payload?.performerUid || "", 180);
  const region = normalizeDirectoryToken(payload?.region || DIRECTORY_DEFAULT_REGION, 80) || DIRECTORY_DEFAULT_REGION;
  const city = safeDirectoryString(payload?.city || "", 80);
  const state = safeDirectoryString(payload?.state || "", 40);
  const timezone = safeDirectoryString(payload?.timezone || "America/Los_Angeles", 80);
  const country = safeDirectoryString(payload?.country || DIRECTORY_DEFAULT_COUNTRY, 2).toUpperCase();
  const startsAtMs = Number(payload?.startsAtMs || 0);
  const endsAtMs = Number(payload?.endsAtMs || 0);
  const latLng = normalizeDirectoryLatLng(payload?.location || payload?.latLng || {});
  const startsAtSafe = Number.isFinite(startsAtMs) && startsAtMs > 0 ? Math.floor(startsAtMs) : 0;
  const endsAtSafe = Number.isFinite(endsAtMs) && endsAtMs > startsAtSafe ? Math.floor(endsAtMs) : 0;
  const visibility = normalizeDirectoryVisibility(payload?.visibility || "public", "public");
  const status = normalizeDirectoryStatus(payload?.status || "pending", "pending");
  const tags = normalizeDirectoryReviewTags(payload?.tags || []);

  const base = {
    listingType,
    title,
    description: normalizeDirectoryTextBlock(payload?.description || "", 3000),
    region,
    city,
    state,
    country,
    timezone,
    address1: safeDirectoryString(payload?.address1 || payload?.address || "", 180),
    address2: safeDirectoryString(payload?.address2 || "", 180),
    location: latLng,
    startsAtMs: startsAtSafe,
    endsAtMs: endsAtSafe,
    visibility,
    status,
    websiteUrl: normalizeDirectoryOptionalUrl(payload?.websiteUrl || ""),
    bookingUrl: normalizeDirectoryOptionalUrl(payload?.bookingUrl || ""),
    imageUrl: normalizeDirectoryOptionalUrl(payload?.imageUrl || ""),
    tags,
    venueId: listingType === "event" || listingType === "room_session" ? venueId : "",
    hostUid,
    performerUid,
    ownerUid: safeDirectoryString(payload?.ownerUid || callerUid, 180) || callerUid,
    ownerOrgId: safeDirectoryString(payload?.ownerOrgId || "", 180),
    sourceType: normalizeDirectoryToken(payload?.sourceType || "user", 20) || "user",
    externalSources: payload?.externalSources && typeof payload.externalSources === "object"
      ? payload.externalSources
      : {},
  };

  if (listingType === "venue") {
    return {
      ...base,
      phone: safeDirectoryString(payload?.phone || "", 40),
      karaokeNightsLabel: safeDirectoryString(payload?.karaokeNightsLabel || "", 160),
    };
  }
  if (listingType === "event") {
    return {
      ...base,
      recurringRule: safeDirectoryString(payload?.recurringRule || "", 120),
      hostName: safeDirectoryString(payload?.hostName || "", 120),
      venueName: safeDirectoryString(payload?.venueName || "", 120),
    };
  }
  if (listingType === "room_session") {
    return {
      ...base,
      roomCode: normalizeRoomCode(payload?.roomCode || ""),
      venueName: safeDirectoryString(payload?.venueName || "", 120),
      sessionMode: safeDirectoryString(payload?.sessionMode || "karaoke", 40),
      isPublicRoom: visibility === "public",
    };
  }
  throw new HttpsError("invalid-argument", "Unsupported listingType.");
};

const buildDirectoryCadencePatch = (listingType = "", payload = {}) => {
  const source = payload && typeof payload === "object" ? payload : {};
  if (listingType === "venue") {
    return {
      karaokeNightsLabel: safeDirectoryString(source.karaokeNightsLabel || "", 160),
      description: normalizeDirectoryTextBlock(source.description || "", 3000),
    };
  }
  if (listingType === "event") {
    return {
      startsAtMs: Number(source.startsAtMs || 0) || 0,
      endsAtMs: Number(source.endsAtMs || 0) || 0,
      recurringRule: safeDirectoryString(source.recurringRule || "", 120),
      hostName: safeDirectoryString(source.hostName || "", 120),
      venueName: safeDirectoryString(source.venueName || "", 120),
      description: normalizeDirectoryTextBlock(source.description || "", 3000),
    };
  }
  if (listingType === "room_session") {
    return {
      startsAtMs: Number(source.startsAtMs || 0) || 0,
      endsAtMs: Number(source.endsAtMs || 0) || 0,
      venueName: safeDirectoryString(source.venueName || "", 120),
      sessionMode: safeDirectoryString(source.sessionMode || "", 40),
      description: normalizeDirectoryTextBlock(source.description || "", 3000),
      visibility: normalizeDirectoryVisibility(source.visibility || "", ""),
    };
  }
  return {};
};

const hasDirectoryCadencePatch = (listingType = "", patch = {}) => {
  if (!patch || typeof patch !== "object") return false;
  if (listingType === "venue") {
    return !!(
      safeDirectoryString(patch.karaokeNightsLabel || "", 160)
      || normalizeDirectoryTextBlock(patch.description || "", 3000)
    );
  }
  if (listingType === "event") {
    return !!(
      Number(patch.startsAtMs || 0) > 0
      || Number(patch.endsAtMs || 0) > 0
      || safeDirectoryString(patch.recurringRule || "", 120)
      || safeDirectoryString(patch.hostName || "", 120)
      || safeDirectoryString(patch.venueName || "", 120)
      || normalizeDirectoryTextBlock(patch.description || "", 3000)
    );
  }
  if (listingType === "room_session") {
    return !!(
      Number(patch.startsAtMs || 0) > 0
      || Number(patch.endsAtMs || 0) > 0
      || safeDirectoryString(patch.venueName || "", 120)
      || safeDirectoryString(patch.sessionMode || "", 40)
      || normalizeDirectoryTextBlock(patch.description || "", 3000)
      || normalizeDirectoryVisibility(patch.visibility || "", "")
    );
  }
  return false;
};

const buildDirectoryMergedUpdatePayload = ({
  listingType = "",
  existing = {},
  patch = {},
  callerUid = "",
}) => {
  const safeCallerUid = safeDirectoryString(callerUid || "", 180) || "system";
  const existingOwnerUid = safeDirectoryString(existing.ownerUid || "", 180) || safeCallerUid;
  const existingHostUid = safeDirectoryString(existing.hostUid || "", 180) || existingOwnerUid;
  return normalizeDirectoryListingPayload(
    listingType,
    {
      ...existing,
      ...patch,
      listingType,
      ownerUid: existingOwnerUid,
      hostUid: existingHostUid,
      status: normalizeDirectoryStatus(existing.status || "approved", "approved"),
      visibility: normalizeDirectoryVisibility(existing.visibility || "public", "public"),
      sourceType: normalizeDirectoryToken(existing.sourceType || "user", 20) || "user",
      externalSources: existing.externalSources && typeof existing.externalSources === "object"
        ? existing.externalSources
        : {},
    },
    existingOwnerUid || existingHostUid || safeCallerUid
  );
};

const buildDirectoryExternalLinks = (payload = {}) => {
  const external = payload?.externalSources || {};
  if (!external || typeof external !== "object") return {};
  const google = external.google || {};
  const yelp = external.yelp || {};
  const googlePhotoRefs = normalizeDirectoryStringArray([
    google.photoRef,
    ...(Array.isArray(google.photoRefs) ? google.photoRefs : []),
    ...(Array.isArray(google.photoReferences) ? google.photoReferences : []),
  ], 8, 320);
  const googlePhotoUrls = normalizeDirectoryUrlArray([
    google.photoUrl,
    google.imageUrl,
    ...(Array.isArray(google.photoUrls) ? google.photoUrls : []),
    ...(Array.isArray(google.images) ? google.images : []),
  ], 8);
  const yelpImages = normalizeDirectoryUrlArray([
    yelp.imageUrl,
    yelp.photoUrl,
    ...(Array.isArray(yelp.images) ? yelp.images : []),
    ...(Array.isArray(yelp.photos) ? yelp.photos : []),
  ], 8);
  return {
    google: {
      placeId: safeDirectoryString(google.placeId || "", 180),
      mapsUrl: normalizeDirectoryOptionalUrl(google.mapsUrl || ""),
      imageUrl: googlePhotoUrls[0] || "",
      photoUrl: googlePhotoUrls[0] || "",
      photoUrls: googlePhotoUrls,
      photoRef: googlePhotoRefs[0] || "",
      photoRefs: googlePhotoRefs,
      address: safeDirectoryString(google.address || "", 220),
      rating: Number(google.rating || 0) || 0,
      reviewCount: Number(google.reviewCount || 0) || 0,
      refreshedAtMs: Number(google.refreshedAtMs || 0) || 0,
    },
    yelp: {
      businessId: safeDirectoryString(yelp.businessId || "", 180),
      url: normalizeDirectoryOptionalUrl(yelp.url || ""),
      imageUrl: yelpImages[0] || "",
      photoUrl: yelpImages[0] || "",
      images: yelpImages,
      address: safeDirectoryString(yelp.address || "", 220),
      rating: Number(yelp.rating || 0) || 0,
      reviewCount: Number(yelp.reviewCount || 0) || 0,
      refreshedAtMs: Number(yelp.refreshedAtMs || 0) || 0,
    },
  };
};

const deriveDirectoryProviderHints = (payload = {}) => {
  const hints = [];
  const googlePlaceId = safeDirectoryString(payload?.externalSources?.google?.placeId || "", 180);
  if (googlePlaceId) hints.push("google");
  const yelpBusinessId = safeDirectoryString(payload?.externalSources?.yelp?.businessId || "", 180);
  if (yelpBusinessId) hints.push("yelp");
  return hints;
};

const buildDirectoryGeocodeQuery = (payload = {}) => {
  const parts = [
    safeDirectoryString(payload?.address1 || payload?.address || "", 180),
    safeDirectoryString(payload?.city || "", 80),
    safeDirectoryString(payload?.state || "", 40),
    safeDirectoryString(payload?.country || DIRECTORY_DEFAULT_COUNTRY, 60),
  ].filter(Boolean);
  if (parts.length) return safeDirectoryString(parts.join(", "), 260);
  const fallback = [
    safeDirectoryString(payload?.title || payload?.name || "", 180),
    safeDirectoryString(payload?.venueName || "", 120),
    safeDirectoryString(payload?.city || "", 80),
    safeDirectoryString(payload?.state || "", 40),
  ].filter(Boolean).join(" ");
  return safeDirectoryString(fallback, 260);
};

const lookupGoogleGeocode = async ({ queryText = "" }) => {
  const apiKey = getDirectoryGoogleApiKey();
  const query = safeDirectoryString(queryText, 260);
  if (!apiKey || !query) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
  let res = null;
  try {
    res = await fetch(url, { method: "GET" });
  } catch {
    return null;
  }
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const top = Array.isArray(data?.results) ? data.results[0] : null;
  if (!top) return null;
  const lat = Number(top?.geometry?.location?.lat);
  const lng = Number(top?.geometry?.location?.lng);
  const loc = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  if (!loc) return null;
  const placeId = safeDirectoryString(top.place_id || "", 180);
  return {
    provider: "google",
    placeId,
    address: safeDirectoryString(top.formatted_address || "", 220),
    location: loc,
    mapsUrl: placeId
      ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(String(placeId))}`
      : "",
  };
};

const maybeEnrichDirectoryLocation = async (payload = {}) => {
  const normalized = payload && typeof payload === "object" ? { ...payload } : {};
  const existing = normalizeDirectoryLatLng(normalized.location || normalized.latLng || {});
  if (existing) {
    return {
      payload: {
        ...normalized,
        location: existing,
      },
      enriched: false,
    };
  }
  const queryText = buildDirectoryGeocodeQuery(normalized);
  if (!queryText) return { payload: normalized, enriched: false };

  const googleLookup = await lookupGoogleGeocode({ queryText });
  const geocoded = normalizeDirectoryLatLng(googleLookup?.location || {});
  if (!geocoded) return { payload: normalized, enriched: false };

  const externalSources = normalized.externalSources && typeof normalized.externalSources === "object"
    ? normalized.externalSources
    : {};
  const googleExternal = externalSources.google && typeof externalSources.google === "object"
    ? externalSources.google
    : {};
  const now = Date.now();
  return {
    payload: {
      ...normalized,
      address1: safeDirectoryString(normalized.address1 || normalized.address || googleLookup?.address || "", 180),
      location: geocoded,
      externalSources: {
        ...externalSources,
        google: {
          ...googleExternal,
          placeId: safeDirectoryString(googleExternal.placeId || googleLookup?.placeId || "", 180),
          mapsUrl: normalizeDirectoryOptionalUrl(googleExternal.mapsUrl || googleLookup?.mapsUrl || ""),
          refreshedAtMs: Number(googleExternal.refreshedAtMs || 0) || now,
        },
      },
    },
    enriched: true,
    provider: "google",
  };
};

const lookupGoogleVenue = async ({ name = "", locationText = "" }) => {
  const apiKey = getDirectoryGoogleApiKey();
  if (!apiKey) return null;
  const query = safeDirectoryString(`${name} ${locationText}`.trim(), 240);
  if (!query) return null;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return null;
  const data = await res.json();
  const top = Array.isArray(data?.results) ? data.results[0] : null;
  if (!top) return null;
  const lat = Number(top?.geometry?.location?.lat);
  const lng = Number(top?.geometry?.location?.lng);
  const loc = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const photoRefs = normalizeDirectoryStringArray(
    (Array.isArray(top?.photos) ? top.photos : [])
      .map((photo) => safeDirectoryString(photo?.photo_reference || "", 320))
      .filter(Boolean),
    8,
    320
  );
  return {
    provider: "google",
    placeId: safeDirectoryString(top.place_id || "", 180),
    name: safeDirectoryString(top.name || "", 180),
    address: safeDirectoryString(top.formatted_address || "", 220),
    rating: Number(top.rating || 0) || 0,
    reviewCount: Number(top.user_ratings_total || 0) || 0,
    location: loc,
    photoRef: photoRefs[0] || "",
    photoRefs,
    mapsUrl: top.place_id
      ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(String(top.place_id))}`
      : "",
    raw: {
      businessStatus: safeDirectoryString(top.business_status || "", 40),
      types: Array.isArray(top.types) ? top.types.slice(0, 20) : [],
    },
  };
};

const lookupYelpVenue = async ({ name = "", locationText = "" }) => {
  const apiKey = YELP_API_KEY.value();
  if (!apiKey) return null;
  const term = safeDirectoryString(name, 180);
  const location = safeDirectoryString(locationText, 180) || "United States";
  if (!term) return null;
  const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&limit=1`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const top = Array.isArray(data?.businesses) ? data.businesses[0] : null;
  if (!top) return null;
  const lat = Number(top?.coordinates?.latitude);
  const lng = Number(top?.coordinates?.longitude);
  const loc = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const address = Array.isArray(top?.location?.display_address)
    ? top.location.display_address.join(", ")
    : "";
  return {
    provider: "yelp",
    businessId: safeDirectoryString(top.id || "", 180),
    name: safeDirectoryString(top.name || "", 180),
    address: safeDirectoryString(address, 220),
    imageUrl: normalizeDirectoryOptionalUrl(top.image_url || ""),
    rating: Number(top.rating || 0) || 0,
    reviewCount: Number(top.review_count || 0) || 0,
    location: loc,
    url: normalizeDirectoryOptionalUrl(top.url || ""),
    raw: {
      isClosed: !!top.is_closed,
      categories: Array.isArray(top.categories) ? top.categories.slice(0, 10) : [],
    },
  };
};

const reserveOrganizationUsageUnits = async ({
  orgId = "",
  entitlements = null,
  meterId = "",
  units = 1,
}) => {
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Organization is not initialized.");
  }
  const meter = USAGE_METER_DEFINITIONS[meterId];
  if (!meter) {
    throw new HttpsError("invalid-argument", `Unknown usage meter "${meterId}".`);
  }
  const safeUnits = Math.max(1, toWholeNumber(units, 1));
  const periodKey = getUsagePeriodKey();
  const quota = resolveUsageMeterQuota({
    meterId,
    planId: entitlements?.planId || "free",
    status: entitlements?.status || "inactive",
  });
  const usageRef = orgsCollection().doc(orgId).collection("usage").doc(periodKey);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const db = admin.firestore();

  const nextUsed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const data = snap.data() || {};
    const currentUsed = toWholeNumber(data?.meters?.[meterId]?.used, 0);
    const plannedUsed = currentUsed + safeUnits;
    if (quota.hardLimit > 0 && plannedUsed > quota.hardLimit) {
      throw new HttpsError(
        "resource-exhausted",
        `${meter.label} monthly hard limit reached for this workspace.`
      );
    }
    const patch = {
      orgId,
      period: periodKey,
      planIdSnapshot: entitlements?.planId || "free",
      statusSnapshot: entitlements?.status || "inactive",
      updatedAt: now,
      [`meters.${meterId}.used`]: plannedUsed,
      [`meters.${meterId}.included`]: quota.included,
      [`meters.${meterId}.hardLimit`]: quota.hardLimit,
      [`meters.${meterId}.overageRateCents`]: quota.overageRateCents,
      [`meters.${meterId}.passThroughUnitCostCents`]: quota.passThroughUnitCostCents,
      [`meters.${meterId}.markupMultiplier`]: quota.markupMultiplier,
      [`meters.${meterId}.billableUnitRateCents`]: quota.billableUnitRateCents,
      [`meters.${meterId}.updatedAt`]: now,
    };
    if (!snap.exists) {
      patch.createdAt = now;
    }
    tx.set(usageRef, patch, { merge: true });
    return plannedUsed;
  });

  return buildUsageMeterSummary({
    meterId,
    used: nextUsed,
    quota,
    periodKey,
  });
};

const ensureOrganizationForUser = async ({ uid, orgName = "" }) => {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};
  const claimedOrgIdRaw = String(userData?.organization?.orgId || "").trim();
  const claimedOrgId = sanitizeOrgToken(claimedOrgIdRaw) || "";
  const ownerScopedOrgId = buildOrgIdForUid(uid);
  let orgId = ownerScopedOrgId;
  let role = "owner";

  if (claimedOrgId && claimedOrgId !== ownerScopedOrgId) {
    try {
      const claimedMemberSnap = await db
        .collection(ORGS_COLLECTION)
        .doc(claimedOrgId)
        .collection("members")
        .doc(uid)
        .get();
      if (claimedMemberSnap.exists) {
        orgId = claimedOrgId;
        role = normalizeOrganizationMemberRole(claimedMemberSnap.data()?.role || "member", "member");
      }
    } catch (_error) {
      orgId = ownerScopedOrgId;
      role = "owner";
    }
  }

  const orgRef = orgsCollection().doc(orgId);
  const memberRef = orgRef.collection("members").doc(uid);
  const subscriptionRef = orgRef.collection("subscription").doc("current");
  const entitlementsRef = orgRef.collection("entitlements").doc("current");
  const now = admin.firestore.FieldValue.serverTimestamp();

  const [orgSnap, memberSnap] = await Promise.all([
    orgRef.get(),
    memberRef.get(),
  ]);
  if (memberSnap.exists) {
    role = normalizeOrganizationMemberRole(memberSnap.data()?.role || role, role);
  }
  const batch = db.batch();
  if (!orgSnap.exists) {
    role = "owner";
    batch.set(orgRef, {
      orgId,
      name: normalizeOrgName(orgName, uid),
      ownerUid: uid,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    batch.set(subscriptionRef, {
      orgId,
      planId: "free",
      status: "inactive",
      provider: "internal",
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    batch.set(entitlementsRef, {
      orgId,
      planId: "free",
      status: "inactive",
      capabilities: { ...BASE_CAPABILITIES },
      source: "bootstrap",
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  } else {
    batch.set(orgRef, { updatedAt: now }, { merge: true });
  }
  batch.set(memberRef, {
    uid,
    role,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(userRef, {
    organization: {
      orgId,
      role,
      updatedAt: now,
    },
  }, { merge: true });
  await batch.commit();
  return { orgId, role };
};

const readOrganizationEntitlements = async (orgId = "") => {
  if (!orgId) {
    return {
      orgId: "",
      planId: "free",
      status: "inactive",
      capabilities: { ...BASE_CAPABILITIES },
      provider: "internal",
      renewalAtMs: 0,
      cancelAtPeriodEnd: false,
      source: "none",
    };
  }
  const orgRef = orgsCollection().doc(orgId);
  const [subscriptionSnap, entitlementsSnap] = await Promise.all([
    orgRef.collection("subscription").doc("current").get(),
    orgRef.collection("entitlements").doc("current").get(),
  ]);

  const subscriptionData = subscriptionSnap.data() || {};
  const planId = String(
    entitlementsSnap.data()?.planId
      || subscriptionData.planId
      || "free"
  ).trim() || "free";
  const status = String(
    entitlementsSnap.data()?.status
      || subscriptionData.status
      || "inactive"
  ).trim() || "inactive";
  const capabilities = entitlementsSnap.exists
    ? normalizeCapabilities(entitlementsSnap.data()?.capabilities || {})
    : buildCapabilitiesForPlan(planId, status);
  const renewalAtMs = valueToMillis(subscriptionData.currentPeriodEnd);
  const provider = String(subscriptionData.provider || "internal").trim() || "internal";
  const cancelAtPeriodEnd = !!subscriptionData.cancelAtPeriodEnd;

  return {
    orgId,
    planId,
    status,
    provider,
    renewalAtMs,
    cancelAtPeriodEnd,
    capabilities,
    source: String(entitlementsSnap.data()?.source || "derived"),
  };
};

const resolveUserEntitlements = async (uid) => {
  const db = admin.firestore();
  const { orgId, role } = await ensureOrganizationForUser({ uid });
  const [entitlements] = await Promise.all([
    readOrganizationEntitlements(orgId),
  ]);
  const superAdmin = await isSuperAdminUid(uid);
  if (superAdmin) {
    return {
      orgId,
      role: "owner",
      planId: entitlements.planId || "host_annual",
      status: "active",
      provider: "super_admin",
      renewalAtMs: entitlements.renewalAtMs,
      cancelAtPeriodEnd: false,
      source: "super_admin",
      capabilities: normalizeCapabilities({
        ...BASE_CAPABILITIES,
        "ai.generate_content": true,
        "api.youtube_data": true,
        "api.apple_music": true,
        "billing.invoice_drafts": true,
        "workspace.onboarding": true,
      }),
    };
  }
  const capabilities = normalizeCapabilities(entitlements.capabilities || {});
  const allowLegacyTierEntitlements = ["1", "true", "yes", "on"].includes(
    String(process.env.ALLOW_LEGACY_USER_TIER_ENTITLEMENTS || "").trim().toLowerCase()
  );
  if (allowLegacyTierEntitlements) {
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};
    const legacyTier = String(userData?.subscription?.tier || "").toLowerCase();
    if (legacyTier !== "host" && legacyTier !== "host_plus") {
      return {
        orgId,
        role,
        planId: entitlements.planId,
        status: entitlements.status,
        provider: entitlements.provider,
        renewalAtMs: entitlements.renewalAtMs,
        cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
        source: entitlements.source,
        capabilities,
      };
    }
    capabilities["ai.generate_content"] = true;
    capabilities["api.youtube_data"] = true;
    capabilities["api.apple_music"] = true;
    capabilities["billing.invoice_drafts"] = true;
    capabilities["workspace.onboarding"] = true;
  }
  return {
    orgId,
    role,
    planId: entitlements.planId,
    status: entitlements.status,
    provider: entitlements.provider,
    renewalAtMs: entitlements.renewalAtMs,
    cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
    source: entitlements.source,
    capabilities,
  };
};

const requireCapability = async (request, capability) => {
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  if (!entitlements.capabilities?.[capability]) {
    throw new HttpsError(
      "permission-denied",
      `Capability "${capability}" requires an active subscription.`
    );
  }
  return { uid, entitlements };
};

const resolveAiDemoBypassForRoomHost = async ({ request, uid }) => {
  const roomCode = normalizeRoomCode(request?.data?.roomCode || "");
  if (!roomCode) return { enabled: false, roomCode: "" };
  try {
    const { roomData } = await ensureRoomHostAccess({
      roomCode,
      callerUid: uid,
      deniedMessage: "Only room hosts can use AI demo bypass.",
    });
    const missionControl = isPlainObject(roomData?.missionControl)
      ? roomData.missionControl
      : {};
    const enabled = missionControl?.aiDemoBypass === true;
    const untilMsRaw = Number(missionControl?.aiDemoBypassUntil || 0);
    const untilMs = Number.isFinite(untilMsRaw) && untilMsRaw > 0 ? untilMsRaw : 0;
    const notExpired = !untilMs || untilMs > Date.now();
    return {
      enabled: enabled && notExpired,
      roomCode,
      untilMs,
    };
  } catch (_error) {
    return { enabled: false, roomCode };
  }
};

const resolvePlanIdFromStripeSubscription = ({ explicitPlanId = "", subscription = null, fallbackPlanId = "" }) => {
  const candidates = [explicitPlanId, fallbackPlanId, subscription?.metadata?.planId || ""];
  for (const candidate of candidates) {
    if (getPlanDefinition(candidate)) return candidate;
  }
  const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval || "";
  if (interval === "year") return "host_annual";
  if (interval === "month") return "host_monthly";
  return "free";
};

const applyOrganizationSubscriptionState = async ({
  orgId,
  ownerUid = "",
  planId = "free",
  status = "inactive",
  provider = "stripe",
  stripeCustomerId = "",
  stripeSubscriptionId = "",
  currentPeriodEndSec = 0,
  cancelAtPeriodEnd = false,
  source = "stripe_webhook",
}) => {
  if (!orgId) return;
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const safePlanId = getPlanDefinition(planId) ? planId : "free";
  const plan = getPlanDefinition(safePlanId) || PLAN_DEFINITIONS.free;
  const capabilities = buildCapabilitiesForPlan(safePlanId, status);
  const entitlementActive = isEntitledStatus(status);
  const currentPeriodEnd = Number(currentPeriodEndSec || 0) > 0
    ? new Date(Number(currentPeriodEndSec) * 1000)
    : null;
  const orgRef = orgsCollection().doc(orgId);
  const batch = db.batch();
  batch.set(orgRef, {
    orgId,
    ownerUid: ownerUid || null,
    billingPlanId: safePlanId,
    billingStatus: status,
    updatedAt: now,
  }, { merge: true });
  batch.set(orgRef.collection("subscription").doc("current"), {
    orgId,
    planId: safePlanId,
    status,
    provider,
    interval: plan.interval || null,
    amountCents: plan.amountCents || 0,
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
    cancelAtPeriodEnd: !!cancelAtPeriodEnd,
    currentPeriodEnd: currentPeriodEnd || null,
    updatedAt: now,
  }, { merge: true });
  batch.set(orgRef.collection("entitlements").doc("current"), {
    orgId,
    planId: safePlanId,
    status,
    capabilities,
    source,
    updatedAt: now,
  }, { merge: true });

  if (ownerUid) {
    const userRef = db.collection("users").doc(ownerUid);
    batch.set(userRef, {
      organization: {
        orgId,
        role: "owner",
        updatedAt: now,
      },
      subscription: {
        tier: planToUserTier(safePlanId),
        plan: planToUserPlan(safePlanId),
        startDate: entitlementActive ? now : null,
        renewalDate: currentPeriodEnd || null,
        cancelledAt: cancelAtPeriodEnd ? now : null,
        paymentMethod: provider,
      },
    }, { merge: true });
    batch.set(orgRef.collection("members").doc(ownerUid), {
      uid: ownerUid,
      role: "owner",
      updatedAt: now,
    }, { merge: true });
  }

  if (stripeSubscriptionId) {
    batch.set(db.collection(STRIPE_SUBSCRIPTIONS_COLLECTION).doc(stripeSubscriptionId), {
      orgId,
      ownerUid: ownerUid || null,
      planId: safePlanId,
      status,
      stripeCustomerId: stripeCustomerId || null,
      updatedAt: now,
    }, { merge: true });
  }

  await batch.commit();
};

const ensureRoomHostAccess = async ({
  tx = null,
  rootRef = getRootRef(),
  roomCode = "",
  callerUid = "",
  deniedMessage = "Only room hosts can perform this action.",
}) => {
  const safeRoomCode = normalizeRoomCode(roomCode);
  if (!safeRoomCode) {
    throw new HttpsError("invalid-argument", "roomCode is required.");
  }
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const superAdmin = await isSuperAdminUid(callerUid);

  const roomRef = rootRef.collection("rooms").doc(safeRoomCode);
  const roomSnap = tx ? await tx.get(roomRef) : await roomRef.get();
  if (!roomSnap.exists) {
    throw new HttpsError("not-found", "Room not found.");
  }

  const roomData = roomSnap.data() || {};
  const hostUid = typeof roomData.hostUid === "string" ? roomData.hostUid : "";
  const hostUids = Array.isArray(roomData.hostUids)
    ? roomData.hostUids.filter((u) => typeof u === "string")
    : [];
  const isHost = superAdmin || callerUid === hostUid || hostUids.includes(callerUid);
  if (!isHost) {
    throw new HttpsError("permission-denied", deniedMessage);
  }

  return { roomRef, roomData, roomCode: safeRoomCode };
};

const normalizeAwardKeyToken = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);

const normalizePointAwards = (awards = []) => {
  const aggregate = new Map();
  (Array.isArray(awards) ? awards : []).forEach((raw) => {
    const uid = typeof raw?.uid === "string" ? raw.uid.trim() : "";
    const points = clampNumber(raw?.points || 0, 0, 5000, 0);
    if (!uid || !points) return;
    aggregate.set(uid, (aggregate.get(uid) || 0) + points);
  });
  const normalized = [];
  for (const [uid, total] of aggregate.entries()) {
    const points = clampNumber(total, 0, 5000, 0);
    if (!points) continue;
    normalized.push({ uid, points });
  }
  return normalized;
};

const DEMO_ROOM_CODE_PATTERN = /^DEMO[A-Z0-9_-]{0,20}$/;
const DEMO_ALLOWED_ACTIONS = new Set([
  "bootstrap",
  "scene",
  "tick",
  "pause",
  "seek",
]);
const DEMO_DEFAULT_CROWD = 14;
const DEMO_MAX_CROWD = 32;
const DEMO_MAX_REACTION_EVENTS = 12;
const DEMO_MAX_VOTES_PER_OPTION = 12;
const DEMO_MAX_SEQUENCE = 4102444800000;
const DEMO_USER_LIBRARY = [
  { name: "Alex", avatar: ":)" },
  { name: "Jordan", avatar: ":D" },
  { name: "Taylor", avatar: "<3" },
  { name: "Casey", avatar: ":P" },
  { name: "Riley", avatar: ":]" },
  { name: "Quinn", avatar: ":}" },
  { name: "Parker", avatar: "8)" },
  { name: "Morgan", avatar: ":O" },
  { name: "Avery", avatar: ":|" },
  { name: "Harper", avatar: "^_^" },
  { name: "Reese", avatar: "\\o/" },
  { name: "Kai", avatar: "(*)" },
];

const sanitizeDemoToken = (value = "", maxLen = 64) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, Math.max(1, Number(maxLen || 64)));

const resolveDemoSceneMode = (sceneId = "") => {
  const token = sanitizeDemoToken(sceneId, 80);
  if (!token) return "karaoke";
  if (token.includes("guitar")) return "guitar";
  if (token.includes("vocal")) return "vocal";
  if (token.includes("trivia")) return "trivia";
  if (token.includes("wyr") || token.includes("would_you_rather")) return "wyr";
  if (token.includes("finale")) return "finale";
  return "karaoke";
};

const normalizeDemoDirectorPayload = (rawData = {}) => {
  if (!isPlainObject(rawData)) {
    throw new HttpsError("invalid-argument", "Demo payload must be an object.");
  }

  const roomCode = normalizeRoomCode(rawData.roomCode || "");
  ensureString(roomCode, "roomCode");
  if (!DEMO_ROOM_CODE_PATTERN.test(roomCode)) {
    throw new HttpsError("invalid-argument", "roomCode must start with DEMO and use simple tokens.");
  }

  const actionToken = sanitizeDemoToken(rawData.action || "tick", 24) || "tick";
  const action = DEMO_ALLOWED_ACTIONS.has(actionToken) ? actionToken : "tick";
  const actionId = sanitizeDemoToken(rawData.actionId || "", 96);
  const sequence = clampNumber(rawData.sequence ?? 0, 0, DEMO_MAX_SEQUENCE, 0);
  const sceneId = sanitizeDemoToken(rawData.sceneId || "karaoke_intro", 80) || "karaoke_intro";
  const timelineMs = clampNumber(rawData.timelineMs ?? 0, 0, 4 * 60 * 1000, 0);
  const progress = clampNumber(rawData.progress ?? 0, 0, 1, 0);
  const playing = rawData.playing !== false;
  const crowdSize = clampNumber(rawData.crowdSize ?? DEMO_DEFAULT_CROWD, 4, DEMO_MAX_CROWD, DEMO_DEFAULT_CROWD);

  const rawEvents = Array.isArray(rawData.reactionEvents) ? rawData.reactionEvents : [];
  const reactionEvents = rawEvents
    .slice(0, DEMO_MAX_REACTION_EVENTS)
    .map((entry, index) => {
      if (!isPlainObject(entry)) return null;
      const type = sanitizeDemoToken(entry.type || entry.emoji || "clap", 40) || "clap";
      const count = clampNumber(entry.count ?? 1, 1, 6, 1);
      const uid = sanitizeDemoToken(entry.uid || `demo_reactor_${index + 1}`, 48) || `demo_reactor_${index + 1}`;
      const userName = typeof entry.userName === "string"
        ? entry.userName.trim().slice(0, 80)
        : `Fan ${index + 1}`;
      const avatar = typeof entry.avatar === "string"
        ? entry.avatar.trim().slice(0, 16)
        : ":)";
      return {
        type,
        count,
        uid,
        userName: userName || `Fan ${index + 1}`,
        avatar: avatar || ":)",
      };
    })
    .filter(Boolean);

  let trivia = null;
  const rawTrivia = isPlainObject(rawData.trivia) ? rawData.trivia : null;
  if (rawTrivia) {
    const question = typeof rawTrivia.question === "string"
      ? rawTrivia.question.trim().slice(0, 240)
      : "";
    const options = Array.isArray(rawTrivia.options)
      ? rawTrivia.options
        .map((option) => String(option || "").trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 4)
      : [];
    if (question && options.length >= 2) {
      const correctIndex = clampNumber(rawTrivia.correctIndex ?? 0, 0, options.length - 1, 0);
      const statusToken = sanitizeDemoToken(rawTrivia.status || "live", 24);
      const status = statusToken === "reveal" ? "reveal" : "live";
      const questionId = sanitizeDemoToken(rawTrivia.questionId || `q_${Math.floor(timelineMs / 1000)}`, 64)
        || `q_${Math.floor(timelineMs / 1000)}`;
      const votesRaw = Array.isArray(rawTrivia.votes) ? rawTrivia.votes : [];
      const votes = options.map((_, index) => clampNumber(votesRaw[index] ?? 0, 0, 200, 0));
      trivia = {
        question,
        options,
        correctIndex,
        status,
        questionId,
        votes,
        points: clampNumber(rawTrivia.points ?? 100, 10, 500, 100),
        durationSec: clampNumber(rawTrivia.durationSec ?? 22, 8, 90, 22),
      };
    }
  }

  let wyr = null;
  const rawWyr = isPlainObject(rawData.wyr) ? rawData.wyr : null;
  if (rawWyr) {
    const question = typeof rawWyr.question === "string"
      ? rawWyr.question.trim().slice(0, 240)
      : "";
    const optionA = typeof rawWyr.optionA === "string"
      ? rawWyr.optionA.trim().slice(0, 120)
      : "";
    const optionB = typeof rawWyr.optionB === "string"
      ? rawWyr.optionB.trim().slice(0, 120)
      : "";
    if (question && optionA && optionB) {
      const statusToken = sanitizeDemoToken(rawWyr.status || "live", 24);
      const status = statusToken === "reveal" ? "reveal" : "live";
      const questionId = sanitizeDemoToken(rawWyr.questionId || `wyr_${Math.floor(timelineMs / 1000)}`, 64)
        || `wyr_${Math.floor(timelineMs / 1000)}`;
      const votesRaw = Array.isArray(rawWyr.votes) ? rawWyr.votes : [];
      const votes = [
        clampNumber(votesRaw[0] ?? 0, 0, 200, 0),
        clampNumber(votesRaw[1] ?? 0, 0, 200, 0),
      ];
      wyr = {
        question,
        optionA,
        optionB,
        status,
        questionId,
        votes,
        points: clampNumber(rawWyr.points ?? 50, 10, 500, 50),
        durationSec: clampNumber(rawWyr.durationSec ?? 18, 8, 90, 18),
      };
    }
  }

  return {
    roomCode,
    action,
    actionId,
    sequence,
    sceneId,
    timelineMs,
    progress,
    playing,
    crowdSize,
    reactionEvents,
    trivia,
    wyr,
  };
};

const buildDemoRoomUpdates = (payload = {}) => {
  const mode = resolveDemoSceneMode(payload.sceneId || "");
  const applauseLevel = clampNumber(Math.round(Number(payload.progress || 0) * 100), 0, 100, 0);
  const sceneLabel = String(payload.sceneId || "karaoke").replace(/[_-]+/g, " ").slice(0, 64);
  const now = Date.now();

  const updates = {
    activeMode: "karaoke",
    lightMode: "ballad",
    showLyricsTv: true,
    showLyricsSinger: true,
    popTriviaEnabled: true,
    tvPresentationProfile: "simple",
    hostName: "Demo Director",
    currentApplauseLevel: applauseLevel,
    announcement: {
      active: true,
      title: "Live Demo",
      message: `Scene: ${sceneLabel || "karaoke"}`,
      atMs: Number(payload.timelineMs || 0),
    },
  };

  if (mode === "guitar") {
    updates.lightMode = "guitar";
    updates.showLyricsTv = false;
    updates.showLyricsSinger = false;
    updates.guitarSessionId = Math.max(1, Math.floor(Number(payload.timelineMs || 0) / 1000) || 1);
  } else {
    updates.guitarSessionId = 0;
  }

  if (mode === "trivia") {
    const trivia = payload.trivia || {
      question: "Which control surface keeps everyone in sync?",
      options: ["Public TV", "Host Deck", "Audience App", "All three"],
      correctIndex: 3,
      status: "live",
      questionId: `q_${Math.floor(Number(payload.timelineMs || 0) / 1000)}`,
      votes: [8, 3, 6, 9],
      points: 100,
      durationSec: 22,
    };
    const isReveal = trivia.status === "reveal";
    updates.activeMode = isReveal ? "trivia_reveal" : "trivia_pop";
    updates.lightMode = "banger";
    updates.showLyricsTv = false;
    updates.showLyricsSinger = false;
    updates.triviaQuestion = {
      q: trivia.question,
      options: trivia.options,
      correct: trivia.correctIndex,
      id: trivia.questionId,
      status: isReveal ? "reveal" : "live",
      points: trivia.points,
      autoReveal: true,
      durationSec: trivia.durationSec,
      startedAt: now,
      revealAt: now + (Math.max(1, Number(trivia.durationSec || 22)) * 1000),
      rewarded: false,
    };
  } else {
    updates.triviaQuestion = null;
  }

  if (mode === "vocal") {
    updates.activeMode = "vocal_challenge";
    updates.lightMode = "banger";
    updates.showLyricsTv = true;
    updates.showLyricsSinger = true;
  }

  if (mode === "wyr") {
    const wyr = payload.wyr || {
      question: "Would you rather open with a duet or solo hook?",
      optionA: "Duet opener",
      optionB: "Solo hook",
      status: "live",
      questionId: `wyr_${Math.floor(Number(payload.timelineMs || 0) / 1000)}`,
      votes: [7, 9],
      points: 50,
      durationSec: 18,
    };
    const isReveal = wyr.status === "reveal";
    updates.activeMode = isReveal ? "wyr_reveal" : "wyr";
    updates.lightMode = "banger";
    updates.showLyricsTv = false;
    updates.showLyricsSinger = false;
    updates.wyrData = {
      question: wyr.question,
      optionA: wyr.optionA,
      optionB: wyr.optionB,
      id: wyr.questionId,
      status: isReveal ? "reveal" : "live",
      points: wyr.points,
      autoReveal: true,
      durationSec: wyr.durationSec,
      startedAt: now,
      revealAt: now + (Math.max(1, Number(wyr.durationSec || 18)) * 1000),
      rewarded: false,
    };
  } else {
    updates.wyrData = null;
  }

  if (mode === "finale") {
    updates.lightMode = "strobe";
    updates.bonusDrop = {
      id: `demo_bonus_${Math.floor(Number(payload.timelineMs || 0) / 1000)}`,
      points: 150,
      by: "Demo Crowd",
    };
  }

  return updates;
};

const seedDemoAudienceSnapshot = async ({
  rootRef = getRootRef(),
  roomCode = "",
  payload = {},
}) => {
  const safeRoomCode = normalizeRoomCode(roomCode);
  if (!safeRoomCode) return { crowdSize: 0 };

  const crowdSize = clampNumber(payload.crowdSize ?? DEMO_DEFAULT_CROWD, 4, DEMO_MAX_CROWD, DEMO_DEFAULT_CROWD);
  const mode = resolveDemoSceneMode(payload.sceneId || "");
  const timelineMs = Number(payload.timelineMs || 0);
  const sceneProgress = clampNumber(payload.progress ?? 0, 0, 1, 0);
  const performanceId = `demo_perf_${Math.floor(timelineMs / 30000)}`;
  const sessionId = Math.max(1, Math.floor(timelineMs / 1000) || 1);

  const db = admin.firestore();
  const batch = db.batch();
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  for (let index = 0; index < crowdSize; index += 1) {
    const profile = DEMO_USER_LIBRARY[index % DEMO_USER_LIBRARY.length];
    const uid = `demo_user_${String(index + 1).padStart(2, "0")}`;
    const points = 120 + (index * 17) + Math.round(sceneProgress * 120);
    const reactionScore = Math.max(1, Math.round(2 + sceneProgress * 12 + (index % 5)));
    const payloadDoc = {
      roomCode: safeRoomCode,
      uid,
      name: `${profile.name} ${index + 1}`,
      avatar: profile.avatar,
      isVip: index % 6 === 0,
      points,
      totalEmojis: reactionScore,
      lastPerformanceId: performanceId,
      lastActiveAt: serverNow,
      joinedAt: serverNow,
    };
    if (mode === "guitar") {
      payloadDoc.guitarSessionId = sessionId;
      payloadDoc.guitarHits = 6 + Math.round(sceneProgress * 24) + ((index % 7) * 2);
      payloadDoc.lastVibeAt = serverNow;
    } else {
      payloadDoc.guitarSessionId = null;
      payloadDoc.guitarHits = 0;
    }
    if (mode === "finale") {
      payloadDoc.strobeSessionId = sessionId;
      payloadDoc.strobeTaps = 8 + ((index % 6) * 3);
    } else {
      payloadDoc.strobeSessionId = null;
      payloadDoc.strobeTaps = 0;
    }
    batch.set(rootRef.collection("room_users").doc(`${safeRoomCode}_${uid}`), payloadDoc, { merge: true });
  }

  await batch.commit();
  return { crowdSize };
};

const writeDemoReactionEvents = async ({
  rootRef = getRootRef(),
  roomCode = "",
  payload = {},
}) => {
  const safeRoomCode = normalizeRoomCode(roomCode);
  if (!safeRoomCode) return 0;
  const events = Array.isArray(payload.reactionEvents)
    ? payload.reactionEvents.slice(0, DEMO_MAX_REACTION_EVENTS)
    : [];
  if (!events.length) return 0;

  const db = admin.firestore();
  const batch = db.batch();
  const sceneId = sanitizeDemoToken(payload.sceneId || "karaoke_intro", 80) || "karaoke_intro";
  const performanceId = `demo_perf_${Math.floor(Number(payload.timelineMs || 0) / 30000)}`;
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  events.forEach((entry, index) => {
    const ref = rootRef.collection("reactions").doc();
    const fallback = DEMO_USER_LIBRARY[index % DEMO_USER_LIBRARY.length];
    batch.set(ref, {
      roomCode: safeRoomCode,
      type: sanitizeDemoToken(entry.type || "clap", 40) || "clap",
      count: clampNumber(entry.count ?? 1, 1, 6, 1),
      uid: sanitizeDemoToken(entry.uid || `demo_reactor_${index + 1}`, 48) || `demo_reactor_${index + 1}`,
      userName: typeof entry.userName === "string" ? entry.userName : fallback.name,
      avatar: typeof entry.avatar === "string" ? entry.avatar : fallback.avatar,
      isVip: index % 6 === 0,
      isDemo: true,
      sceneId,
      performanceId,
      timestamp: serverNow,
    });
  });

  await batch.commit();
  return events.length;
};

const writeDemoTriviaVotes = async ({
  rootRef = getRootRef(),
  roomCode = "",
  payload = {},
}) => {
  const safeRoomCode = normalizeRoomCode(roomCode);
  if (!safeRoomCode) return 0;
  const mode = resolveDemoSceneMode(payload.sceneId || "");
  if (mode !== "trivia" && mode !== "wyr") return 0;

  const db = admin.firestore();
  const batch = db.batch();
  const questionIdToken = mode === "trivia"
    ? (payload?.trivia?.questionId || "q_demo")
    : (payload?.wyr?.questionId || "wyr_demo");
  const questionId = sanitizeDemoToken(questionIdToken, 64) || (mode === "trivia" ? "q_demo" : "wyr_demo");
  const serverNow = admin.firestore.FieldValue.serverTimestamp();
  const voteType = mode === "trivia" ? "vote_trivia" : "vote_wyr";
  const voteValues = mode === "trivia" ? [0, 1, 2, 3] : ["A", "B"];
  const voteCounts = mode === "trivia"
    ? (Array.isArray(payload?.trivia?.votes) ? payload.trivia.votes : [])
    : (Array.isArray(payload?.wyr?.votes) ? payload.wyr.votes : []);
  if (!voteCounts.length) return 0;

  let cursor = 0;
  let written = 0;
  for (let optionIndex = 0; optionIndex < voteValues.length; optionIndex += 1) {
    const requestedVotes = clampNumber(voteCounts[optionIndex] ?? 0, 0, 200, 0);
    const count = Math.min(DEMO_MAX_VOTES_PER_OPTION, requestedVotes);
    for (let i = 0; i < count; i += 1) {
      const profile = DEMO_USER_LIBRARY[cursor % DEMO_USER_LIBRARY.length];
      const uid = `demo_vote_${optionIndex + 1}_${i + 1}`;
      const voteDocId = `demo_vote_${safeRoomCode}_${questionId}_${uid}`;
      batch.set(rootRef.collection("reactions").doc(voteDocId), {
        roomCode: safeRoomCode,
        type: voteType,
        val: voteValues[optionIndex],
        questionId,
        uid,
        userName: profile.name,
        avatar: profile.avatar,
        isVote: true,
        isDemo: true,
        timestamp: serverNow,
      }, { merge: true });
      cursor += 1;
      written += 1;
    }
  }

  if (!written) return 0;
  await batch.commit();
  return written;
};

const applyRoomAwardsOnce = async ({
  roomCode,
  awardKey,
  awards = [],
  source = "room_signal",
}) => {
  const safeRoomCode = normalizeRoomCode(roomCode);
  const safeAwardKey = normalizeAwardKeyToken(awardKey);
  const normalizedAwards = normalizePointAwards(awards);
  if (!safeRoomCode || !safeAwardKey || !normalizedAwards.length) {
    return { applied: false, awardedCount: 0, awardedPoints: 0 };
  }

  const rootRef = getRootRef();
  const eventRef = rootRef.collection("room_awards").doc(safeAwardKey);

  return admin.firestore().runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (eventSnap.exists) {
      return { applied: false, duplicate: true, awardedCount: 0, awardedPoints: 0 };
    }

    const targets = normalizedAwards.map((entry) => ({
      ...entry,
      ref: rootRef.collection("room_users").doc(`${safeRoomCode}_${entry.uid}`),
    }));
    const snaps = await Promise.all(targets.map((entry) => tx.get(entry.ref)));

    const appliedAwards = [];
    const skippedUids = [];
    targets.forEach((entry, idx) => {
      if (!snaps[idx].exists) {
        skippedUids.push(entry.uid);
        return;
      }
      appliedAwards.push(entry);
      tx.update(entry.ref, {
        points: admin.firestore.FieldValue.increment(entry.points),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    let awardedPoints = 0;
    appliedAwards.forEach((entry) => {
      awardedPoints += entry.points;
    });

    tx.set(eventRef, {
      roomCode: safeRoomCode,
      source,
      awards: appliedAwards.map(({ uid, points }) => ({ uid, points })),
      skippedUids,
      awardedCount: appliedAwards.length,
      awardedPoints,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      applied: appliedAwards.length > 0,
      duplicate: false,
      awardedCount: appliedAwards.length,
      awardedPoints,
      skippedUids,
    };
  });
};

const decodeEntities = (input = "") =>
  input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const parseTimeMs = (val = "") => {
  const parts = val.split(":").map((p) => p.trim());
  const toSeconds = (p) => {
    const [s, ms = "0"] = p.split(".");
    return Number(s || 0) + Number(ms.padEnd(3, "0")) / 1000;
  };
  if (parts.length === 3) {
    return (
      Number(parts[0] || 0) * 3600 * 1000 +
      Number(parts[1] || 0) * 60 * 1000 +
      toSeconds(parts[2]) * 1000
    );
  }
  if (parts.length === 2) {
    return Number(parts[0] || 0) * 60 * 1000 + toSeconds(parts[1]) * 1000;
  }
  return toSeconds(parts[0] || "0") * 1000;
};

const parseTtml = (ttml = "") => {
  if (!ttml) return [];
  const results = [];
  const regex = /<p\b[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(ttml))) {
    const startMs = parseTimeMs(match[1]);
    const endMs = parseTimeMs(match[2]);
    const rawText = match[3]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    const text = decodeEntities(rawText);
    if (!text) continue;
    results.push({ text, startMs, endMs });
  }
  return results;
};

let appleTokenCache = { token: null, exp: 0 };
const getAppleMusicToken = () => {
  const teamId = APPLE_MUSIC_TEAM_ID.value();
  const keyId = APPLE_MUSIC_KEY_ID.value();
  let privateKey = APPLE_MUSIC_PRIVATE_KEY.value();
  if (!teamId || !keyId || !privateKey) {
    throw new HttpsError("failed-precondition", "Apple Music secrets not configured.");
  }
  privateKey = privateKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  if (appleTokenCache.token && appleTokenCache.exp > now + 60) {
    return appleTokenCache.token;
  }
  const exp = now + 60 * 60;
  const token = jwt.sign(
    { iss: teamId, iat: now, exp },
    privateKey,
    { algorithm: "ES256", header: { kid: keyId } }
  );
  appleTokenCache = { token, exp };
  return token;
};

const ensureSongAdmin = async ({
  title,
  artist,
  artworkUrl,
  itunesId,
  appleMusicId,
  aliases = [],
  verifyMeta = false,
  verifiedBy = "host",
}) => {
  const safeTitle = (title || "").trim();
  if (!safeTitle) return null;
  const safeArtist = (artist || "Unknown").trim() || "Unknown";
  const songId = buildSongKey(safeTitle, safeArtist);
  const ref = admin.firestore().collection("songs").doc(songId);
  const snap = await ref.get();

  const updates = {
    title: safeTitle,
    artist: safeArtist,
    normalizedKey: songId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  if (artworkUrl) {
    updates.artworkUrl = artworkUrl;
  }
  if (itunesId) {
    updates.itunesId = String(itunesId);
  }
  if (appleMusicId) {
    updates.appleMusicIds = admin.firestore.FieldValue.arrayUnion(String(appleMusicId));
  }
  if (aliases.length) {
    const cleanAliases = aliases.filter(Boolean).map((item) => String(item));
    if (cleanAliases.length) {
      updates.aliases = admin.firestore.FieldValue.arrayUnion(...cleanAliases);
    }
  }

  if (verifyMeta && typeof verifyMeta === "object") {
    updates.verifiedMeta = {
      title: safeTitle,
      artist: safeArtist,
      artworkUrl: artworkUrl || null,
      lyricsSource: verifyMeta.lyricsSource || null,
      lyricsTimed: !!verifyMeta.lyricsTimed,
      lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedBy,
    };
  }

  await ref.set(updates, { merge: true });
  return { songId, songData: snap.exists ? snap.data() : null };
};

const ensureTrackAdmin = async ({
  songId,
  source,
  mediaUrl,
  appleMusicId,
  label,
  duration,
  audioOnly,
  backingOnly,
  addedBy,
}) => {
  if (!songId) return null;
  const cleanSource = source || "custom";
  const youtubeId = cleanSource === "youtube" ? extractYouTubeId(mediaUrl) : "";
  let trackId = "";

  if (cleanSource === "youtube" && youtubeId) {
    trackId = `${songId}__yt__${youtubeId}`;
  } else if (cleanSource === "apple" && appleMusicId) {
    trackId = `${songId}__apple__${appleMusicId}`;
  }

  const payload = {
    songId,
    source: cleanSource,
    mediaUrl: mediaUrl || null,
    appleMusicId: appleMusicId || null,
    label: label || null,
    duration: duration || null,
    audioOnly: !!audioOnly,
    backingOnly: !!backingOnly,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (addedBy) payload.addedBy = addedBy;

  if (trackId) {
    const ref = admin.firestore().collection("tracks").doc(trackId);
    const snap = await ref.get();
    if (!snap.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    await ref.set(payload, { merge: true });
    return { trackId };
  }

  payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await admin.firestore().collection("tracks").add(payload);
  return { trackId: docRef.id };
};

const normalizeLyricsText = (value = "") =>
  typeof value === "string"
    ? value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
    : "";

const normalizeTimedLyrics = (timedLyrics = []) => {
  if (!Array.isArray(timedLyrics)) return [];
  const normalized = [];
  for (const raw of timedLyrics) {
    const text = normalizeLyricsText(raw?.text || "");
    if (!text) continue;
    const startMs = Math.max(0, Math.round(Number(raw?.startMs || 0)));
    const endCandidate = Math.round(Number(raw?.endMs || startMs + 2500));
    const endMs = Math.max(startMs + 300, endCandidate);
    normalized.push({ text, startMs, endMs });
  }
  return normalized;
};

const isRoomAiDemoBypassEnabled = (roomData = {}) => {
  const missionControl = isPlainObject(roomData?.missionControl)
    ? roomData.missionControl
    : {};
  if (missionControl?.aiDemoBypass !== true) return false;
  const untilRaw = Number(missionControl?.aiDemoBypassUntil || 0);
  const untilMs = Number.isFinite(untilRaw) && untilRaw > 0 ? untilRaw : 0;
  return !untilMs || untilMs > Date.now();
};

const isLyricsPipelineV2EnabledForRoom = (roomData = {}) => {
  if (typeof roomData?.lyricsPipelineV2Enabled === "boolean") {
    return roomData.lyricsPipelineV2Enabled;
  }
  return LYRICS_PIPELINE_V2_ENABLED_DEFAULT;
};

const isTimedAdapterEnabledForRoom = (roomCode = "") => {
  if (!LYRICS_TIMED_ADAPTER_ENABLED_DEFAULT) return false;
  if (!LYRICS_TIMED_ADAPTER_ROOM_CODES.size) return true;
  return LYRICS_TIMED_ADAPTER_ROOM_CODES.has(normalizeRoomCode(roomCode));
};

const compactLyricsProviderTrace = (trace = []) =>
  (Array.isArray(trace) ? trace : [])
    .slice(0, 8)
    .map((entry) => ({
      provider: String(entry?.provider || "").trim().slice(0, 40) || "unknown",
      status: String(entry?.status || "").trim().slice(0, 32) || "miss",
      latencyMs: Math.max(0, Math.round(Number(entry?.latencyMs || 0))),
      detail: String(entry?.detail || "").trim().slice(0, 140),
    }));

const normalizeLyricsGenerationStatus = ({
  hasLyrics = false,
  hasTimedLyrics = false,
  needsUserToken = false,
  resolution = "",
} = {}) => {
  if (hasLyrics || hasTimedLyrics) return "resolved";
  if (needsUserToken) return "needs_user_token";
  const token = String(resolution || "").trim().toLowerCase();
  if (token === "disabled") return "disabled";
  if (token === "capability_blocked") return "capability_blocked";
  if (token.includes("error")) return "error";
  return "no_match";
};

const buildLyricsResolverDeps = ({
  timedAdapterEnabled = false,
} = {}) => ({
  db: admin.firestore(),
  buildSongKey,
  normalizeLyricsText,
  normalizeTimedLyrics,
  fetchImpl: fetch,
  getAppleMusicToken,
  parseTtml,
  fetchAiLyricsFallbackText,
  timedAdapterEnabled: !!timedAdapterEnabled,
  resolveTimedLyrics: null,
});

const toMillisSafe = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
};

const scoreTrack = (track = {}) => {
  const source = String(track.source || "").toLowerCase();
  const sourceScore = source === "apple" ? 30 : source === "youtube" ? 20 : source ? 10 : 0;
  const backingScore = track.backingOnly ? 5 : 0;
  return sourceScore + backingScore;
};

const pickBestTrack = (tracks = []) => {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  return tracks
    .slice()
    .sort((a, b) => {
      const scoreDiff = scoreTrack(b) - scoreTrack(a);
      if (scoreDiff !== 0) return scoreDiff;
      return toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt);
    })[0];
};

const ensureSongLyricsAdmin = async ({
  songId,
  title,
  artist,
  lyrics,
  lyricsTimed,
  lyricsSource,
  appleMusicId,
  language = "en",
  verifiedBy = "system",
}) => {
  const safeSongId = String(songId || "").trim();
  if (!safeSongId) return { songId: "", hasLyrics: false, hasTimedLyrics: false };

  const normalizedLyrics = normalizeLyricsText(lyrics || "");
  const normalizedTimed = normalizeTimedLyrics(lyricsTimed);
  if (!normalizedLyrics && !normalizedTimed.length) {
    return { songId: safeSongId, hasLyrics: false, hasTimedLyrics: false };
  }

  const ref = admin.firestore().collection("song_lyrics").doc(safeSongId);
  const snap = await ref.get();
  const payload = {
    songId: safeSongId,
    title: (title || "").trim() || null,
    artist: (artist || "").trim() || null,
    lyrics: normalizedLyrics || "",
    lyricsTimed: normalizedTimed.length ? normalizedTimed : null,
    hasTimedLyrics: normalizedTimed.length > 0,
    lineCount: normalizedTimed.length
      || (normalizedLyrics ? normalizedLyrics.split("\n").filter(Boolean).length : 0),
    lyricsSource: (lyricsSource || (normalizedTimed.length ? "timed" : "text")).trim() || null,
    appleMusicId: appleMusicId ? String(appleMusicId) : null,
    language: (language || "en").trim() || "en",
    verifiedBy: (verifiedBy || "system").trim() || "system",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await ref.set(payload, { merge: true });
  await admin.firestore().collection("songs").doc(safeSongId).set(
    {
      hasLyrics: true,
      hasTimedLyrics: normalizedTimed.length > 0,
      canonicalLyricsSource: payload.lyricsSource || null,
      canonicalLyricsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    songId: safeSongId,
    hasLyrics: true,
    hasTimedLyrics: normalizedTimed.length > 0,
  };
};

const isSongVerified = (songDoc) => {
  const meta = songDoc?.verifiedMeta || {};
  return !!(meta.title && meta.artist && meta.artworkUrl);
};

const buildGeminiPrompt = (type, context) => {
  if (type === "bingo_board") {
    const { title, size, mode } = context || {};
    const count = Number(size || 5) ** 2;
    if (mode === "mystery") {
      return `Generate ${count} pairs of (Clue, Song Title, Artist) for a music bingo game with the theme "${title}". Format strictly as JSON array of objects: [{"clue": "...", "title": "...", "artist": "..."}]. Do not include markdown.`;
    }
    return `Generate ${count} short bingo terms (1-3 words) for a bingo game with the theme "${title}". Format strictly as JSON array of strings. Do not include markdown.`;
  }
  if (type === "lyrics") {
    const { title, artist } = context || {};
    return `Generate the full lyrics for the song "${title}" by "${artist}". Format strictly as JSON object with a single key "lyrics" containing the text with \\n for line breaks. Example: {"lyrics": "Line 1\\nLine 2"}. Do not include markdown.`;
  }
  if (type === "selfie_prompt") {
    return 'Generate 5 short, funny selfie prompts for a karaoke crowd. Format strictly as JSON array of strings. Do not include markdown.';
  }
  if (type === "doodle_lyrics") {
    const { topic, count } = context || {};
    const total = clampNumber(count || 12, 5, 30, 12);
    return `Generate ${total} short, recognizable lyric lines for a karaoke drawing game. Keep each line under 8 words. Theme: "${topic || 'karaoke hits'}". Format strictly as JSON array of strings. Do not include markdown.`;
  }
  if (type === "doodle_prompts") {
    const topic = Array.isArray(context)
      ? String(context[0] || "").trim()
      : String(context?.topic || "").trim();
    const total = clampNumber(
      Array.isArray(context) ? 12 : (context?.count || 12),
      5,
      30,
      12
    );
    return `Generate ${total} short, visual drawing prompts for a party doodle game. Theme: "${topic || 'fun drawings'}". Format strictly as JSON array of strings. Do not include markdown.`;
  }
  const songs = Array.isArray(context)
    ? context.slice(0, 5).map((s) => `${s.songTitle} by ${s.artist}`).join(", ")
    : "";
  const singleSong = (!Array.isArray(context) && context && typeof context === "object")
    ? context
    : null;
  if (type === "pop_trivia_song") {
    const songTitle = String(singleSong?.songTitle || "").trim() || "Unknown Song";
    const artist = String(singleSong?.artist || "").trim() || "Unknown Artist";
    const singerName = String(singleSong?.singerName || "").trim();
    const metadata = (singleSong?.metadata && typeof singleSong.metadata === "object" && !Array.isArray(singleSong.metadata))
      ? Object.entries(singleSong.metadata)
        .map(([k, v]) => `${k}: ${String(v || "").trim()}`)
        .filter((entry) => !entry.endsWith(": "))
      : [];
    const metadataLine = metadata.length ? metadata.join(", ") : "none";
    return `Create 4 multiple-choice karaoke pop-up trivia questions for "${songTitle}" by "${artist}".
Tone: funny, clever, and insightful (VH1 Pop-Up Video vibe), never mean.
Audience: live karaoke crowd answering quickly on phones while the song plays.
Known metadata: ${metadataLine}.
Current singer: ${singerName || "N/A"}.
Rules:
- Each question must be answerable in under 10 seconds.
- Mix playful culture facts and music-insight facts.
- Keep each answer option concise (under 45 characters).
- Avoid obscure deep-cut facts and avoid speculation.
Format strictly as JSON array of objects:
[{"q":"...","correct":"...","w1":"...","w2":"...","w3":"..."}]
Do not include markdown.`;
  }
  if (type === "trivia") {
    return `Generate 3 trivia questions based on: ${songs}. Format strictly as JSON array of objects: [{q, correct, w1, w2, w3}]`;
  }
  return `Generate 3 "Would You Rather" questions based on: ${songs}. Format strictly as JSON array: [{q, a, b}]`;
};

const fetchAiLyricsFallbackText = async (title, artist) => {
  const safeTitle = normalizeLyricsText(title);
  if (!safeTitle) return null;
  const safeArtist = normalizeLyricsText(artist || "Unknown") || "Unknown";
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    console.warn("autoAppleLyrics AI fallback skipped: GEMINI_API_KEY not configured.");
    return null;
  }
  const prompt = buildGeminiPrompt("lyrics", { title: safeTitle, artist: safeArtist });
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_LYRICS_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("autoAppleLyrics AI fallback request failed", res.status, text?.slice(0, 300));
      return null;
    }
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanText = rawText.replace(/```json|```/g, "").trim();
    if (!cleanText) return null;
    const parsed = JSON.parse(cleanText);
    const lyrics = normalizeLyricsText(parsed?.lyrics || "");
    if (!lyrics) return null;
    const usage = data?.usageMetadata || {};
    const promptTokens = Math.max(0, Number(usage?.promptTokenCount || 0));
    const outputTokens = Math.max(0, Number(usage?.candidatesTokenCount || 0));
    const totalTokens = Math.max(0, Number(usage?.totalTokenCount || (promptTokens + outputTokens)));
    const estimatedCostUsd = ((promptTokens / 1000000) * GEMINI_LYRICS_INPUT_USD_PER_1M)
      + ((outputTokens / 1000000) * GEMINI_LYRICS_OUTPUT_USD_PER_1M);
    return {
      lyrics,
      usage: {
        model: GEMINI_LYRICS_MODEL,
        promptTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
        inputUsdPer1M: GEMINI_LYRICS_INPUT_USD_PER_1M,
        outputUsdPer1M: GEMINI_LYRICS_OUTPUT_USD_PER_1M,
      },
    };
  } catch (err) {
    console.warn("autoAppleLyrics AI fallback failed", err?.message || err);
    return null;
  }
};

exports.itunesSearch = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "itunes");
  requireAuth(request);
  enforceAppCheckIfEnabled(request, "itunes_search");
  const term = request.data?.term || "";
  ensureString(term, "term");
  const limit = clampNumber(request.data?.limit || 6, 1, 25, 6);
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpsError("unavailable", "iTunes search failed.");
  }
  const data = await res.json();
  return { results: data.results || [] };
});

exports.ensureSong = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "ensure_song", { perMinute: 30, perHour: 180 });
  enforceAppCheckIfEnabled(request, "ensure_song");
  await requireCatalogContributor(request, {
    deniedMessage: "Host or moderator access required to write catalog songs.",
  });
  const data = request.data || {};
  const title = (data.title || "").trim();
  if (!title) {
    throw new HttpsError("invalid-argument", "title is required.");
  }
  const res = await ensureSongAdmin({
    title,
    artist: data.artist || "Unknown",
    artworkUrl: data.artworkUrl || "",
    itunesId: data.itunesId || "",
    appleMusicId: data.appleMusicId || "",
    aliases: Array.isArray(data.aliases) ? data.aliases : [],
    verifyMeta: data.verifyMeta || false,
    verifiedBy: data.verifiedBy || "host",
  });
  return { songId: res?.songId || buildSongKey(title, data.artist || "Unknown") };
});

exports.ensureTrack = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "ensure_track", { perMinute: 30, perHour: 180 });
  enforceAppCheckIfEnabled(request, "ensure_track");
  await requireCatalogContributor(request, {
    deniedMessage: "Host or moderator access required to write catalog tracks.",
  });
  const data = request.data || {};
  if (!data.songId) {
    throw new HttpsError("invalid-argument", "songId is required.");
  }
  const res = await ensureTrackAdmin({
    songId: data.songId,
    source: data.source || "custom",
    mediaUrl: data.mediaUrl || "",
    appleMusicId: data.appleMusicId || "",
    label: data.label || null,
    duration: data.duration ?? null,
    audioOnly: !!data.audioOnly,
    backingOnly: !!data.backingOnly,
    addedBy: data.addedBy || "",
  });
  return { trackId: res?.trackId || null };
});

exports.logPerformance = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "log_performance", { perMinute: 24, perHour: 240 });
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  enforceAppCheckIfEnabled(request, "log_performance");
  const data = request.data || {};
  const songTitle = (data.songTitle || data.title || "").trim();
  if (!songTitle) {
    throw new HttpsError("invalid-argument", "songTitle is required.");
  }
  const artist = (data.artist || "Unknown").trim() || "Unknown";
  const roomCode = data.roomCode || "";
  const albumArtUrl = data.albumArtUrl || "";
  const songResult = await ensureSongAdmin({
    title: songTitle,
    artist,
    artworkUrl: albumArtUrl,
    verifyMeta: false,
    verifiedBy: data.verifiedBy || "host",
  });
  const songId = data.songId || songResult?.songId || buildSongKey(songTitle, artist);
  const sourceGuess = data.trackSource
    || (data.appleMusicId ? "apple" : extractYouTubeId(data.mediaUrl || "") ? "youtube" : "custom");

  let trackId = data.trackId || null;
  if (!trackId && (data.mediaUrl || data.appleMusicId)) {
    const trackResult = await ensureTrackAdmin({
      songId,
      source: sourceGuess,
      mediaUrl: data.mediaUrl || "",
      appleMusicId: data.appleMusicId || "",
      duration: data.duration ?? null,
      audioOnly: !!data.audioOnly,
      backingOnly: !!data.backingAudioOnly,
      addedBy: data.addedBy || data.hostName || "Host",
    });
    trackId = trackResult?.trackId || null;
  }

  const applauseScore = Math.round(data.applauseScore || 0);
  const hypeScore = Math.round(data.hypeScore || 0);
  const hostBonus = Math.round(data.hostBonus || 0);
  const totalScore = hypeScore + applauseScore + hostBonus;
  const weekKey = getWeekKeyUtc(new Date());
  const isOfficial = isSongVerified(songResult?.songData);

  await admin.firestore().collection("performances").add({
    songId,
    trackId: trackId || null,
    roomCode,
    singerName: data.singerName || "",
    singerUid: data.singerUid || null,
    songTitle,
    artist,
    score: totalScore,
    totalScore,
    applauseScore,
    hypeScore,
    hostBonus,
    isOfficial,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  const bestRef = admin.firestore().collection("song_hall_of_fame").doc(songId);
  const bestSnap = await bestRef.get();
  const bestData = bestSnap.exists ? bestSnap.data() : null;
  const isNewAllTime = isBetterScore(totalScore, applauseScore, bestData);

  if (isNewAllTime) {
    await bestRef.set({
      songId,
      songTitle,
      artist,
      albumArtUrl,
      bestScore: totalScore,
      applauseScore,
      singerName: data.singerName || "",
      singerUid: data.singerUid || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const weeklyId = `${weekKey}__${songId}`;
  const weeklyRef = admin.firestore().collection("song_hall_of_fame_weeks").doc(weeklyId);
  const weeklySnap = await weeklyRef.get();
  const weeklyData = weeklySnap.exists ? weeklySnap.data() : null;
  if (isBetterScore(totalScore, applauseScore, weeklyData)) {
    await weeklyRef.set({
      weekKey,
      songId,
      songTitle,
      artist,
      albumArtUrl,
      bestScore: totalScore,
      applauseScore,
      singerName: data.singerName || "",
      singerUid: data.singerUid || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return {
    songId,
    trackId,
    totalScore,
    applauseScore,
    hypeScore,
    hostBonus,
    isNewAllTime,
    weekKey,
  };
});

exports.reconcilePerformanceRecap = onCall({ cors: true }, async (request) => {
  const callerUid = requireAuth(request);
  const data = request.data || {};
  const roomCode = normalizeRoomCode(data.roomCode || "");
  const performanceId = String(data.performanceId || "").trim();
  if (!roomCode) {
    throw new HttpsError("invalid-argument", "roomCode is required.");
  }
  if (!performanceId) {
    throw new HttpsError("invalid-argument", "performanceId is required.");
  }

  const rootRef = getRootRef();
  await ensureRoomHostAccess({
    rootRef,
    roomCode,
    callerUid,
    deniedMessage: "Only room hosts can reconcile recap data.",
  });

  const now = Date.now();
  const fallbackEndedAtMs = clampNumber(data.endedAtMs || now, 0, 4102444800000, now);
  const fallbackStartedAtMs = clampNumber(data.startedAtMs || 0, 0, 4102444800000, 0);
  const fallbackHypeScore = Math.max(0, Math.round(Number(data.fallbackHypeScore || 0)));
  const fallbackApplauseScore = Math.max(0, Math.round(Number(data.fallbackApplauseScore || 0)));
  const fallbackHostBonus = Math.max(0, Math.round(Number(data.fallbackHostBonus || 0)));

  const songRef = rootRef.collection("karaoke_songs").doc(performanceId);
  const songSnap = await songRef.get();
  const songData = songSnap.exists ? (songSnap.data() || {}) : {};
  const songStartedAtMs = toEpochMs(songData?.performingStartedAt) || toEpochMs(songData?.startedAt) || toEpochMs(songData?.timestamp);
  const windowStartMs = fallbackStartedAtMs || songStartedAtMs || Math.max(0, fallbackEndedAtMs - (12 * 60 * 1000));
  const windowEndMs = Math.max(windowStartMs, fallbackEndedAtMs);

  let reactionDocs = [];
  let reactionSource = "performance_id";
  try {
    const snap = await rootRef.collection("reactions").where("performanceId", "==", performanceId).get();
    reactionDocs = snap.docs;
  } catch (error) {
    console.warn("reconcilePerformanceRecap: performanceId query failed", error);
  }
  if (!reactionDocs.length) {
    reactionSource = "room_window_indexed";
    try {
      reactionDocs = await fetchRoomReactionsInWindow({
        rootRef,
        roomCode,
        windowStartMs,
        windowEndMs,
      });
    } catch (error) {
      reactionSource = "room_window_fallback";
      console.warn("reconcilePerformanceRecap: indexed room window query failed", error);
      try {
        const fallbackSnap = await rootRef
          .collection("reactions")
          .where("roomCode", "==", roomCode)
          .orderBy("timestamp", "desc")
          .limit(RECAP_WINDOW_QUERY_MAX_DOCS)
          .get();
        reactionDocs = fallbackSnap.docs;
      } catch (legacyError) {
        console.warn("reconcilePerformanceRecap: ordered fallback query failed", legacyError);
        const legacySnap = await rootRef
          .collection("reactions")
          .where("roomCode", "==", roomCode)
          .limit(RECAP_WINDOW_QUERY_MAX_DOCS)
          .get();
        reactionDocs = legacySnap.docs;
      }
    }
  }

  const reactionTotals = {};
  const contributionByParticipant = new Map();
  let eventCount = 0;
  let pointWeightedHype = 0;
  let nonPointCrowdActions = 0;
  let strumTotal = 0;
  let strobeTapTotal = 0;
  let stormLayerTotal = 0;
  let lobbyPlayTotal = 0;

  reactionDocs.forEach((docSnap) => {
    const entry = docSnap.data() || {};
    const entryRoomCode = normalizeRoomCode(entry.roomCode || "");
    if (entryRoomCode && entryRoomCode !== roomCode) return;

    const entryPerformanceId = String(entry.performanceId || entry.songId || "").trim();
    const timestampMs = toEpochMs(entry.timestamp);
    const inWindow = timestampMs > 0 && timestampMs >= (windowStartMs - RECAP_WINDOW_LEAD_MS) && timestampMs <= (windowEndMs + RECAP_WINDOW_TAIL_MS);
    const hasExplicitPerformance = !!entryPerformanceId;
    const matchesPerformance = entryPerformanceId === performanceId;
    if (!matchesPerformance && hasExplicitPerformance) return;
    if (!matchesPerformance && !inWindow) return;

    const type = normalizeReactionType(entry.type);
    if (!type) return;
    const count = Math.max(1, Math.min(600, Math.round(Number(entry.count || 1))));
    const multiplier = Math.max(1, Math.min(8, Number(entry.multiplier || 1)));
    const uid = String(entry.uid || "").trim();
    const participantKey = uid
      || String(entry.userName || entry.user || "guest").trim().toLowerCase()
      || `anon_${docSnap.id}`;
    if (!contributionByParticipant.has(participantKey)) {
      contributionByParticipant.set(participantKey, {
        uid: uid || null,
        userName: String(entry.userName || entry.user || "Guest").trim() || "Guest",
        avatar: String(entry.avatar || "").trim() || null,
        pointsGifted: 0,
        actions: 0,
        strums: 0,
        strobeTaps: 0,
        stormHits: 0,
      });
    }
    const participant = contributionByParticipant.get(participantKey);
    participant.actions += count;

    eventCount += 1;
    reactionTotals[type] = (reactionTotals[type] || 0) + count;
    const basePoints = Number(RECAP_REACTION_POINT_COSTS[type] || 0);
    if (basePoints > 0) {
      const weighted = Math.round(basePoints * count * multiplier);
      pointWeightedHype += weighted;
      participant.pointsGifted += weighted;
    } else {
      nonPointCrowdActions += count;
    }
    if (type === "strum") {
      strumTotal += count;
      participant.strums += count;
    } else if (type === "strobe_tap") {
      strobeTapTotal += count;
      participant.strobeTaps += count;
    } else if (type === "storm_layer") {
      stormLayerTotal += count;
      participant.stormHits += count;
    } else if (type.startsWith("lobby_play_")) {
      lobbyPlayTotal += count;
    }
  });

  const roomUsersSnap = await rootRef.collection("room_users").where("roomCode", "==", roomCode).get();
  let roomUserHype = 0;
  roomUsersSnap.docs.forEach((docSnap) => {
    const user = docSnap.data() || {};
    if (String(user.lastPerformanceId || "") !== performanceId) return;
    const uid = String(user.uid || "").trim();
    const userName = String(user.name || "Guest").trim() || "Guest";
    const key = uid || userName.toLowerCase();
    const points = Math.max(0, Math.round(Number(user.performancePointsGifted || 0)));
    roomUserHype += points;
    if (!contributionByParticipant.has(key)) {
      contributionByParticipant.set(key, {
        uid: uid || null,
        userName,
        avatar: String(user.avatar || "").trim() || null,
        pointsGifted: points,
        actions: 0,
        strums: 0,
        strobeTaps: 0,
        stormHits: 0,
      });
      return;
    }
    const current = contributionByParticipant.get(key);
    current.uid = current.uid || uid || null;
    current.userName = current.userName || userName;
    current.avatar = current.avatar || String(user.avatar || "").trim() || null;
    current.pointsGifted = Math.max(current.pointsGifted, points);
  });

  const crowdSignalScore = Math.round(
    (nonPointCrowdActions * 1.4)
    + (strumTotal * 1.8)
    + (strobeTapTotal * 1.1)
    + (stormLayerTotal * 1.5)
    + (lobbyPlayTotal * 0.75)
  );
  const resolvedHypeScore = Math.max(
    fallbackHypeScore,
    Math.round(pointWeightedHype),
    Math.round(roomUserHype),
    crowdSignalScore
  );
  const participantTotals = [...contributionByParticipant.values()]
    .sort((a, b) => (
      Number(b.pointsGifted || 0) - Number(a.pointsGifted || 0)
      || Number(b.actions || 0) - Number(a.actions || 0)
    ));
  const topFan = participantTotals[0] && (participantTotals[0].pointsGifted > 0 || participantTotals[0].actions > 0)
    ? {
      name: participantTotals[0].userName,
      avatar: participantTotals[0].avatar || null,
      pointsGifted: Number(participantTotals[0].pointsGifted || 0),
    }
    : null;

  const topStrummer = [...participantTotals].sort((a, b) => Number(b.strums || 0) - Number(a.strums || 0))[0] || null;
  const topStrobe = [...participantTotals].sort((a, b) => Number(b.strobeTaps || 0) - Number(a.strobeTaps || 0))[0] || null;
  const vibeStats = {
    guitar: strumTotal > 0
      ? {
        totalHits: strumTotal,
        top: topStrummer && topStrummer.strums > 0
          ? {
            name: topStrummer.userName,
            avatar: topStrummer.avatar || null,
            hits: Number(topStrummer.strums || 0),
          }
          : null,
      }
      : null,
    strobe: strobeTapTotal > 0
      ? {
        totalTaps: strobeTapTotal,
        top: topStrobe && topStrobe.strobeTaps > 0
          ? {
            name: topStrobe.userName,
            avatar: topStrobe.avatar || null,
            taps: Number(topStrobe.strobeTaps || 0),
          }
          : null,
      }
      : null,
    storm: stormLayerTotal > 0
      ? {
        totalHits: stormLayerTotal,
      }
      : null,
  };

  const ledgerId = buildLedgerDocId(roomCode, performanceId);
  await rootRef.collection("performance_event_ledgers").doc(ledgerId).set({
    roomCode,
    performanceId,
    songDocId: performanceId,
    songId: String(songData.songId || "").trim() || null,
    singerUid: String(songData.singerUid || data.singerUid || "").trim() || null,
    singerName: String(songData.singerName || data.singerName || "").trim() || null,
    computedByUid: callerUid,
    computedAt: admin.firestore.FieldValue.serverTimestamp(),
    version: 1,
    source: reactionSource,
    windowStartMs,
    windowEndMs,
    eventCount,
    reactionTotals,
    aggregate: {
      pointWeightedHype,
      roomUserHype,
      crowdSignalScore,
      resolvedHypeScore,
      applauseScore: fallbackApplauseScore,
      hostBonus: fallbackHostBonus,
      participantCount: participantTotals.length,
      nonPointCrowdActions,
      strumTotal,
      strobeTapTotal,
      stormLayerTotal,
      lobbyPlayTotal,
    },
    participants: participantTotals.slice(0, 18).map((entry) => ({
      uid: entry.uid || null,
      userName: entry.userName,
      avatar: entry.avatar || null,
      pointsGifted: Number(entry.pointsGifted || 0),
      actions: Number(entry.actions || 0),
      strums: Number(entry.strums || 0),
      strobeTaps: Number(entry.strobeTaps || 0),
      stormHits: Number(entry.stormHits || 0),
    })),
    topFan: topFan || null,
    vibeStats,
  }, { merge: true });

  return {
    ok: true,
    roomCode,
    performanceId,
    source: reactionSource,
    windowStartMs,
    windowEndMs,
    eventCount,
    reactionTotals,
    resolved: {
      hypeScore: resolvedHypeScore,
      applauseScore: fallbackApplauseScore,
      hostBonus: fallbackHostBonus,
    },
    topFan,
    vibeStats,
    participantCount: participantTotals.length,
  };
});

exports.youtubeSearch = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_search");
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  enforceAppCheckIfEnabled(request, "youtube_search");
  const query = request.data?.query || "";
  ensureString(query, "query");
  const maxResults = clampNumber(request.data?.maxResults || 10, 1, 10, 10);
  const playableOnly = request.data?.playableOnly !== false;
  const normalizedQuery = String(query || "").trim().toLowerCase().replace(/\s+/g, " ");
  const cacheKey = `${normalizedQuery}|${maxResults}|${playableOnly ? "playable" : "all"}`;
  const cachedItems = readYoutubeSearchCache(cacheKey);
  if (cachedItems) {
    return { items: cachedItems, cached: true };
  }
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  await reserveOrganizationUsageUnits({
    orgId: entitlements.orgId,
    entitlements,
    meterId: "youtube_data_request",
    units: 1,
  });
  const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=${maxResults}&order=relevance`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `YouTube search failed: ${text}`);
  }
  const data = await res.json();
  const baseItems = (data.items || []).map((item) => ({
    id: item.id?.videoId || item.id,
    title: item.snippet?.title || "",
    channelTitle: item.snippet?.channelTitle || "",
    thumbnails: item.snippet?.thumbnails || {},
  })).filter((item) => !!item.id);
  if (!baseItems.length) {
    return { items: [] };
  }

  await reserveOrganizationUsageUnits({
    orgId: entitlements.orgId,
    entitlements,
    meterId: "youtube_data_request",
    units: 1,
  });
  const ids = baseItems.map((item) => item.id).slice(0, 50);
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=status,contentDetails&id=${ids.join(",")}`;
  const detailsRes = await fetch(detailsUrl);
  if (!detailsRes.ok) {
    const text = await detailsRes.text();
    throw new HttpsError("unavailable", `YouTube playability check failed: ${text}`);
  }
  const details = await detailsRes.json();
  const statusById = new Map();
  (details.items || []).forEach((item) => {
    const id = String(item.id || "").trim();
    if (!id) return;
    const embeddable = !!item.status?.embeddable;
    const uploadStatus = String(item.status?.uploadStatus || "").toLowerCase();
    const privacyStatus = String(item.status?.privacyStatus || "").toLowerCase();
    const isUploadReady = uploadStatus === "processed" || uploadStatus === "uploaded";
    const isAllowedPrivacy = privacyStatus === "public" || privacyStatus === "unlisted";
    const playable = embeddable && isUploadReady && isAllowedPrivacy;
    const durationSec = parseIsoDuration(item.contentDetails?.duration || "");
    statusById.set(id, {
      embeddable,
      uploadStatus,
      privacyStatus,
      durationSec,
      playable,
    });
  });
  const items = baseItems
    .map((item) => {
      const status = statusById.get(item.id) || {};
      return {
        ...item,
        embeddable: !!status.embeddable,
        uploadStatus: status.uploadStatus || "",
        privacyStatus: status.privacyStatus || "",
        durationSec: Number(status.durationSec || 0),
        playable: !!status.playable,
      };
    })
    .filter((item) => (playableOnly ? item.playable : true));
  writeYoutubeSearchCache(cacheKey, items);
  return { items, cached: false };
});

exports.youtubePlaylist = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_playlist");
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  enforceAppCheckIfEnabled(request, "youtube_playlist");
  const playlistId = request.data?.playlistId || "";
  ensureString(playlistId, "playlistId");
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  const maxTotal = clampNumber(request.data?.maxTotal || 1000, 1, 1000, 1000);
  const items = [];
  let pageToken = "";
  while (items.length < maxTotal) {
    const batchSize = Math.min(50, maxTotal - items.length);
    await reserveOrganizationUsageUnits({
      orgId: entitlements.orgId,
      entitlements,
      meterId: "youtube_data_request",
      units: 1,
    });
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${apiKey}&part=snippet&maxResults=${batchSize}&playlistId=${playlistId}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new HttpsError("unavailable", `Playlist fetch failed: ${text}`);
    }
    const data = await res.json();
    (data.items || []).forEach((item) => {
      items.push({
        id: item.snippet?.resourceId?.videoId || item.id,
        title: item.snippet?.title || "",
        channelTitle: item.snippet?.channelTitle || "",
        thumbnails: item.snippet?.thumbnails || {},
      });
    });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return { items };
});

exports.youtubeStatus = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_status");
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  enforceAppCheckIfEnabled(request, "youtube_status");
  const ids = Array.isArray(request.data?.ids) ? request.data.ids : [];
  if (!ids.length) return { items: [] };
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  await reserveOrganizationUsageUnits({
    orgId: entitlements.orgId,
    entitlements,
    meterId: "youtube_data_request",
    units: 1,
  });
  const sliced = ids.slice(0, 50);
  const url = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=status&id=${sliced.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `YouTube status failed: ${text}`);
  }
  const data = await res.json();
  const items = (data.items || []).map((item) => ({
    id: item.id,
    embeddable: !!item.status?.embeddable,
  }));
  return { items };
});

const parseIsoDuration = (value = "") => {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
};

const RECAP_REACTION_POINT_COSTS = Object.freeze({ ...REACTION_POINT_COSTS });
const RECAP_WINDOW_LEAD_MS = 12000;
const RECAP_WINDOW_TAIL_MS = 20000;
const RECAP_WINDOW_QUERY_PAGE_SIZE = 1000;
const RECAP_WINDOW_QUERY_MAX_DOCS = 12000;

const toEpochMs = (value) => {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") {
    const ms = Number(value.toMillis());
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value?.seconds === "number") {
    const nanos = Number(value?.nanoseconds || 0);
    return (Number(value.seconds) * 1000) + Math.floor(nanos / 1000000);
  }
  if (value instanceof Date) {
    const ms = Number(value.getTime());
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
};

const normalizeReactionType = (value = "") => String(value || "").trim().toLowerCase();

const buildLedgerDocId = (roomCode = "", performanceId = "") =>
  `${String(roomCode || "").trim().toUpperCase()}_${String(performanceId || "").trim()}`
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 140);

const fetchRoomReactionsInWindow = async ({
  rootRef,
  roomCode,
  windowStartMs,
  windowEndMs,
  maxDocs = RECAP_WINDOW_QUERY_MAX_DOCS,
}) => {
  const safeStart = Math.max(0, Number(windowStartMs || 0) - RECAP_WINDOW_LEAD_MS);
  const safeEnd = Math.max(safeStart, Number(windowEndMs || 0) + RECAP_WINDOW_TAIL_MS);
  const lowerTs = admin.firestore.Timestamp.fromMillis(safeStart);
  const upperTs = admin.firestore.Timestamp.fromMillis(safeEnd);
  const collected = [];
  let cursor = null;
  while (collected.length < maxDocs) {
    const remaining = maxDocs - collected.length;
    const pageSize = Math.min(RECAP_WINDOW_QUERY_PAGE_SIZE, remaining);
    let q = rootRef
      .collection("reactions")
      .where("roomCode", "==", roomCode)
      .where("timestamp", ">=", lowerTs)
      .where("timestamp", "<=", upperTs)
      .orderBy("timestamp", "asc")
      .limit(pageSize);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    collected.push(...snap.docs);
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
  return collected;
};

exports.youtubeDetails = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_details");
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  enforceAppCheckIfEnabled(request, "youtube_details");
  const ids = Array.isArray(request.data?.ids) ? request.data.ids : [];
  if (!ids.length) return { items: [] };
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  await reserveOrganizationUsageUnits({
    orgId: entitlements.orgId,
    entitlements,
    meterId: "youtube_data_request",
    units: 1,
  });
  const sliced = ids.slice(0, 50);
  const url = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=contentDetails&id=${sliced.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `YouTube details failed: ${text}`);
  }
  const data = await res.json();
  const items = (data.items || []).map((item) => ({
    id: item.id,
    durationSec: parseIsoDuration(item.contentDetails?.duration || ""),
  }));
  return { items };
});

exports.geminiGenerate = onCall({ cors: true, secrets: [GEMINI_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "gemini", { perMinute: 10, perHour: 120 });
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  let aiDemoBypass = false;
  if (!entitlements.capabilities?.["ai.generate_content"]) {
    const bypass = await resolveAiDemoBypassForRoomHost({ request, uid });
    aiDemoBypass = !!bypass.enabled;
    if (!aiDemoBypass) {
      throw new HttpsError(
        "permission-denied",
        "Capability \"ai.generate_content\" requires an active subscription."
      );
    }
  }
  enforceAppCheckIfEnabled(request, "gemini");
  if (!aiDemoBypass) {
    await reserveOrganizationUsageUnits({
      orgId: entitlements.orgId,
      entitlements,
      meterId: "ai_generate_content",
      units: 1,
    });
  }
  const type = request.data?.type || "";
  ensureString(type, "type");
  const prompt = buildGeminiPrompt(type, request.data?.context);
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Gemini API key not configured.");
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `Gemini request failed: ${text}`);
  }
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanText = rawText.replace(/```json|```/g, "").trim();
  try {
    return { result: JSON.parse(cleanText) };
  } catch (_err) {
    throw new HttpsError("data-loss", "Gemini response parse failed.");
  }
});

const cacheSongLyricsFromQueueDoc = async (data = {}, verifiedBy = "queue") => {
  const rawTitle = (data.songTitle || data.title || "").trim();
  if (!rawTitle) return null;
  const rawArtist = (data.artist || "Unknown").trim() || "Unknown";
  const fallbackSongId = buildSongKey(rawTitle, rawArtist);
  const songId = (data.songId || "").trim() || fallbackSongId;

  const songResult = await ensureSongAdmin({
    title: rawTitle,
    artist: rawArtist,
    artworkUrl: data.albumArtUrl || "",
    appleMusicId: data.appleMusicId || "",
    verifyMeta: {
      lyricsSource: data.lyricsSource || null,
      lyricsTimed: Array.isArray(data.lyricsTimed) && data.lyricsTimed.length > 0,
    },
    verifiedBy,
  });
  const resolvedSongId = songResult?.songId || songId;
  const lyricRes = await ensureSongLyricsAdmin({
    songId: resolvedSongId,
    title: rawTitle,
    artist: rawArtist,
    lyrics: data.lyrics || "",
    lyricsTimed: data.lyricsTimed || null,
    lyricsSource: data.lyricsSource || "queue",
    appleMusicId: data.appleMusicId || "",
    verifiedBy,
  });

  if (data.appleMusicId) {
    const trackResult = await ensureTrackAdmin({
      songId: resolvedSongId,
      source: "apple",
      mediaUrl: "",
      appleMusicId: String(data.appleMusicId),
      duration: data.duration ?? null,
      audioOnly: true,
      backingOnly: true,
      addedBy: verifiedBy,
    });
    if (trackResult?.trackId) {
      await admin.firestore().collection("songs").doc(resolvedSongId).set(
        {
          primaryTrackId: trackResult.trackId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  return {
    songId: resolvedSongId,
    hasLyrics: !!lyricRes?.hasLyrics,
    hasTimedLyrics: !!lyricRes?.hasTimedLyrics,
  };
};

const runLyricsResolverForQueueSong = async ({
  songData = {},
  roomCode = "",
  roomData = {},
  timedOnly = false,
  musicUserToken = "",
} = {}) => {
  const safeTitle = normalizeLyricsText(songData?.songTitle || songData?.title || "");
  const safeArtist = normalizeLyricsText(songData?.artist || "Unknown") || "Unknown";
  if (!safeTitle) {
    return {
      hasLyrics: false,
      hasTimedLyrics: false,
      lyrics: "",
      lyricsTimed: null,
      lyricsSource: "",
      resolution: "missing_title",
      needsUserToken: false,
      songId: "",
      appleMusicId: "",
      providerTrace: [],
      providerMeta: null,
      aiCapabilityBlocked: false,
    };
  }

  const safeRoomCode = normalizeRoomCode(roomCode || songData?.roomCode || "");
  const orgId = String(roomData?.orgId || "").trim();
  let entitlements = null;
  if (orgId) {
    try {
      entitlements = await readOrganizationEntitlements(orgId);
    } catch (error) {
      console.warn("lyrics resolver entitlements lookup failed", error?.message || error);
    }
  }

  const aiCapabilityEnabled = !!entitlements?.capabilities?.["ai.generate_content"];
  const demoBypassEnabled = isRoomAiDemoBypassEnabled(roomData);
  const allowAiFallback = !timedOnly && (aiCapabilityEnabled || demoBypassEnabled);
  const timedAdapterEnabled = isTimedAdapterEnabledForRoom(safeRoomCode);
  let aiCapabilityBlocked = !timedOnly && !allowAiFallback;
  let aiMeterReserved = false;

  const deps = buildLyricsResolverDeps({ timedAdapterEnabled });
  deps.fetchAiLyricsFallbackText = async (title, artist) => {
    if (timedOnly) return null;
    if (!aiCapabilityEnabled && !demoBypassEnabled) {
      aiCapabilityBlocked = true;
      return null;
    }
    if (aiCapabilityEnabled && !aiMeterReserved) {
      try {
        await reserveOrganizationUsageUnits({
          orgId,
          entitlements,
          meterId: "ai_generate_content",
          units: 1,
        });
        aiMeterReserved = true;
      } catch (error) {
        const code = String(error?.code || "").toLowerCase();
        if (code.includes("resource-exhausted") || code.includes("permission-denied")) {
          aiCapabilityBlocked = true;
          if (!demoBypassEnabled) return null;
        } else if (!demoBypassEnabled) {
          console.warn("lyrics resolver AI meter reserve failed", error?.message || error);
          return null;
        }
      }
    }
    return fetchAiLyricsFallbackText(title, artist);
  };

  let resolved;
  try {
    resolved = await resolveLyricsForSong(
      {
        songId: String(songData?.songId || "").trim(),
        title: safeTitle,
        artist: safeArtist,
        storefront: String(songData?.storefront || "us").trim() || "us",
        musicUserToken: String(musicUserToken || "").trim(),
        allowAiFallback,
        allowTimedAdapter: timedAdapterEnabled,
        durationSec: Math.max(0, Number(songData?.duration || 0)),
        languageHint: "en",
      },
      deps
    );
  } catch (error) {
    return {
      hasLyrics: false,
      hasTimedLyrics: false,
      lyrics: "",
      lyricsTimed: null,
      lyricsSource: "",
      resolution: "provider_error",
      needsUserToken: false,
      songId: "",
      appleMusicId: "",
      providerTrace: [{
        provider: "resolver",
        status: "error",
        latencyMs: 0,
        detail: String(error?.message || error?.code || "resolver_failed").slice(0, 120),
      }],
      providerMeta: null,
      aiCapabilityBlocked,
    };
  }

  let finalResolution = String(resolved?.resolution || "").trim() || "no_match";
  if (!resolved?.hasLyrics && !resolved?.hasTimedLyrics && !resolved?.needsUserToken && !timedOnly && aiCapabilityBlocked) {
    finalResolution = "capability_blocked";
  }

  return {
    ...resolved,
    resolution: finalResolution,
    aiCapabilityBlocked,
  };
};

const applyLyricsResolutionToQueueSong = async ({
  songRef,
  resolved = {},
  actorTag = "queue",
} = {}) => {
  if (!songRef) {
    throw new HttpsError("invalid-argument", "songRef is required.");
  }

  const normalizedResolvedLyrics = normalizeLyricsText(resolved?.lyrics || "");
  const normalizedResolvedTimed = normalizeTimedLyrics(resolved?.lyricsTimed || []);
  const resolvedHasTimed = normalizedResolvedTimed.length > 0;
  const resolvedHasLyrics = !!normalizedResolvedLyrics;
  const resolvedSource = String(resolved?.lyricsSource || "").trim();
  const resolvedAppleMusicId = String(resolved?.appleMusicId || "").trim();
  const providerTrace = compactLyricsProviderTrace(resolved?.providerTrace || []);
  const resolutionToken = String(resolved?.resolution || "").trim() || "no_match";
  const needsUserToken = !!resolved?.needsUserToken;

  const txResult = await admin.firestore().runTransaction(async (tx) => {
    const latestSnap = await tx.get(songRef);
    if (!latestSnap.exists) {
      throw new HttpsError("not-found", "Song not found.");
    }
    const latest = latestSnap.data() || {};
    const existingTimed = normalizeTimedLyrics(latest?.lyricsTimed || []);
    const existingLyrics = normalizeLyricsText(latest?.lyrics || "");
    const hasExistingTimed = existingTimed.length > 0;
    const hasExistingLyrics = !!existingLyrics;

    const shouldWriteTimed = !hasExistingTimed && resolvedHasTimed;
    const shouldWriteLyrics = !hasExistingLyrics && resolvedHasLyrics;
    const nextTimed = shouldWriteTimed ? normalizedResolvedTimed : existingTimed;
    const nextLyrics = shouldWriteLyrics ? normalizedResolvedLyrics : existingLyrics;
    const nextHasTimed = nextTimed.length > 0;
    const nextHasLyrics = !!nextLyrics;
    const status = normalizeLyricsGenerationStatus({
      hasLyrics: nextHasLyrics,
      hasTimedLyrics: nextHasTimed,
      needsUserToken,
      resolution: resolutionToken,
    });

    const updates = {
      lyricsGenerationStatus: status,
      lyricsGenerationResolution: resolutionToken,
      lyricsGenerationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lyricsProviderTrace: providerTrace,
    };
    if (shouldWriteLyrics) updates.lyrics = normalizedResolvedLyrics;
    if (shouldWriteTimed) updates.lyricsTimed = normalizedResolvedTimed;
    if ((shouldWriteLyrics || shouldWriteTimed) && !String(latest?.lyricsSource || "").trim() && resolvedSource) {
      updates.lyricsSource = resolvedSource;
    }
    if (!String(latest?.appleMusicId || "").trim() && resolvedAppleMusicId) {
      updates.appleMusicId = resolvedAppleMusicId;
    }

    tx.set(songRef, updates, { merge: true });

    const mergedSong = {
      ...latest,
      ...(shouldWriteLyrics ? { lyrics: normalizedResolvedLyrics } : {}),
      ...(shouldWriteTimed ? { lyricsTimed: normalizedResolvedTimed } : {}),
      ...(updates.lyricsSource ? { lyricsSource: updates.lyricsSource } : {}),
      ...(updates.appleMusicId ? { appleMusicId: updates.appleMusicId } : {}),
      lyricsGenerationStatus: status,
      lyricsGenerationResolution: resolutionToken,
      lyricsProviderTrace: providerTrace,
    };

    return {
      mergedSong,
      status,
      resolution: resolutionToken,
      needsUserToken,
      wroteLyrics: shouldWriteLyrics,
      wroteTimedLyrics: shouldWriteTimed,
      hasLyrics: nextHasLyrics,
      hasTimedLyrics: nextHasTimed,
    };
  });

  if (txResult.hasLyrics || txResult.hasTimedLyrics) {
    try {
      await cacheSongLyricsFromQueueDoc(txResult.mergedSong, actorTag);
    } catch (error) {
      console.warn("lyrics resolver canonical cache update failed", error?.message || error);
    }
  }

  return txResult;
};

exports.resolveSongCatalog = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "resolve_song_catalog", { perMinute: 45, perHour: 500 });
  requireAuth(request);
  enforceAppCheckIfEnabled(request, "resolve_song_catalog");
  const data = request.data || {};
  const rawSongId = (data.songId || "").trim();
  const title = (data.title || "").trim();
  const artist = (data.artist || "Unknown").trim() || "Unknown";
  const songId = rawSongId || (title ? buildSongKey(title, artist) : "");
  if (!songId) {
    throw new HttpsError("invalid-argument", "songId or title is required.");
  }

  const songRef = admin.firestore().collection("songs").doc(songId);
  const lyricsRef = admin.firestore().collection("song_lyrics").doc(songId);
  const trackQuery = admin.firestore().collection("tracks").where("songId", "==", songId).limit(20);

  const [songSnap, lyricsSnap, trackSnap] = await Promise.all([
    songRef.get(),
    lyricsRef.get(),
    trackQuery.get(),
  ]);

  const tracks = trackSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const bestTrack = pickBestTrack(tracks);
  const lyrics = lyricsSnap.exists ? lyricsSnap.data() : null;

  return {
    found: !!(songSnap.exists || lyrics || bestTrack),
    songId,
    song: songSnap.exists ? { id: songSnap.id, ...songSnap.data() } : null,
    track: bestTrack ? {
      id: bestTrack.id,
      source: bestTrack.source || null,
      mediaUrl: bestTrack.mediaUrl || "",
      appleMusicId: bestTrack.appleMusicId || "",
      duration: bestTrack.duration || null,
      backingOnly: !!bestTrack.backingOnly,
      audioOnly: !!bestTrack.audioOnly,
      updatedAt: bestTrack.updatedAt || null,
    } : null,
    lyrics: lyrics ? {
      lyrics: lyrics.lyrics || "",
      timedLyrics: Array.isArray(lyrics.lyricsTimed) ? lyrics.lyricsTimed : null,
      source: lyrics.lyricsSource || null,
      appleMusicId: lyrics.appleMusicId || "",
      hasTimedLyrics: !!lyrics.hasTimedLyrics,
      updatedAt: lyrics.updatedAt || null,
    } : null,
  };
});

exports.upsertSongLyrics = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "upsert_song_lyrics", { perMinute: 20, perHour: 120 });
  enforceAppCheckIfEnabled(request, "upsert_song_lyrics");
  const { uid } = await requireCatalogContributor(request, {
    deniedMessage: "Host or moderator access required to update song lyrics.",
  });
  const data = request.data || {};
  const title = (data.title || "").trim();
  const artist = (data.artist || "Unknown").trim() || "Unknown";
  const explicitSongId = (data.songId || "").trim();
  if (!explicitSongId && !title) {
    throw new HttpsError("invalid-argument", "songId or title is required.");
  }

  let songId = explicitSongId;
  if (!songId) {
    const songResult = await ensureSongAdmin({
      title,
      artist,
      artworkUrl: data.artworkUrl || "",
      appleMusicId: data.appleMusicId || "",
      verifyMeta: false,
      verifiedBy: data.verifiedBy || uid,
    });
    songId = songResult?.songId || buildSongKey(title, artist);
  }

  if (title) {
    await ensureSongAdmin({
      title,
      artist,
      artworkUrl: data.artworkUrl || "",
      appleMusicId: data.appleMusicId || "",
      verifyMeta: {
        lyricsSource: data.lyricsSource || null,
        lyricsTimed: Array.isArray(data.lyricsTimed) && data.lyricsTimed.length > 0,
      },
      verifiedBy: data.verifiedBy || uid,
    });
  }

  const lyricResult = await ensureSongLyricsAdmin({
    songId,
    title,
    artist,
    lyrics: data.lyrics || "",
    lyricsTimed: data.lyricsTimed || null,
    lyricsSource: data.lyricsSource || "manual",
    appleMusicId: data.appleMusicId || "",
    language: data.language || "en",
    verifiedBy: data.verifiedBy || uid,
  });

  return {
    songId,
    hasLyrics: !!lyricResult?.hasLyrics,
    hasTimedLyrics: !!lyricResult?.hasTimedLyrics,
  };
});

exports.appleMusicLyrics = onCall(
  { cors: true, secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "apple_music");
    const uid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "apple_music_lyrics");
    const title = (request.data?.title || "").trim();
    const artist = (request.data?.artist || "").trim();
    const safeArtist = artist || "Unknown";
    const requestedSongId = (request.data?.songId || "").trim();
    const canonicalSongId = requestedSongId || buildSongKey(title, safeArtist);
    const musicUserToken = (request.data?.musicUserToken || "").trim();
    ensureString(title, "title");
    const storefront = request.data?.storefront || "us";
    const term = `${title} ${safeArtist}`.trim();
    if (!term) throw new HttpsError("invalid-argument", "Missing title/artist.");

    const cachedLyricsSnap = canonicalSongId
      ? await admin.firestore().collection("song_lyrics").doc(canonicalSongId).get()
      : null;
    if (cachedLyricsSnap?.exists) {
      const cached = cachedLyricsSnap.data() || {};
      const cachedTimed = normalizeTimedLyrics(cached.lyricsTimed);
      const cachedText = normalizeLyricsText(cached.lyrics || "");
      if (cachedTimed.length || cachedText) {
        return {
          found: true,
          cached: true,
          songId: cached.appleMusicId || "",
          title: cached.title || title,
          artist: cached.artist || safeArtist,
          timedLyrics: cachedTimed,
          lyrics: cachedText,
        };
      }
    }

    const entitlements = await resolveUserEntitlements(uid);
    const token = getAppleMusicToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (musicUserToken) {
      headers["Music-User-Token"] = musicUserToken;
    }
    await reserveOrganizationUsageUnits({
      orgId: entitlements.orgId,
      entitlements,
      meterId: "apple_music_request",
      units: 1,
    });
    const searchUrl = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(
      term
    )}&types=songs&limit=1`;
    const searchRes = await fetch(searchUrl, {
      headers,
    });
    if (!searchRes.ok) {
      const text = await searchRes.text();
      throw new HttpsError("unavailable", `Apple Music search failed: ${text}`);
    }
    const searchData = await searchRes.json();
    const song = searchData?.results?.songs?.data?.[0];
    if (!song?.id) {
      return { found: false, message: "No Apple Music match." };
    }
    const appleSongId = song.id;
    const resolvedTitle = song.attributes?.name || title;
    const resolvedArtist = song.attributes?.artistName || safeArtist;

    const songResult = await ensureSongAdmin({
      title: resolvedTitle,
      artist: resolvedArtist,
      appleMusicId: appleSongId,
      verifyMeta: false,
      verifiedBy: "apple_music",
    });
    const resolvedSongId = songResult?.songId || canonicalSongId || buildSongKey(resolvedTitle, resolvedArtist);
    const appleTrack = await ensureTrackAdmin({
      songId: resolvedSongId,
      source: "apple",
      mediaUrl: "",
      appleMusicId: appleSongId,
      label: "Apple Music",
      duration: null,
      audioOnly: true,
      backingOnly: true,
      addedBy: "apple_music",
    });
    if (appleTrack?.trackId) {
      await admin.firestore().collection("songs").doc(resolvedSongId).set(
        {
          primaryTrackId: appleTrack.trackId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await reserveOrganizationUsageUnits({
      orgId: entitlements.orgId,
      entitlements,
      meterId: "apple_music_request",
      units: 1,
    });
    const lyricsUrl = `https://api.music.apple.com/v1/catalog/${storefront}/songs/${appleSongId}/lyrics`;
    const lyricsRes = await fetch(lyricsUrl, {
      headers,
    });
    if (!lyricsRes.ok) {
      const text = await lyricsRes.text();
      // Apple returns code 40012 when lyrics permission is missing from the request.
      // This is commonly resolved by providing a Music User Token from MusicKit auth.
      if (lyricsRes.status === 400 && text.includes("\"code\":\"40012\"")) {
        return {
          found: true,
          songId: appleSongId,
          title: resolvedTitle,
          artist: resolvedArtist,
          timedLyrics: [],
          lyrics: "",
          needsUserToken: !musicUserToken,
          message: "Apple Music lyrics require additional permissions in request (code 40012).",
        };
      }
      throw new HttpsError("unavailable", `Apple Music lyrics failed: ${text}`);
    }
    const lyricsData = await lyricsRes.json();
    const attrs = lyricsData?.data?.[0]?.attributes || {};
    const ttml = attrs.ttml || "";
    const plainLyrics = attrs.lyrics || "";
    const timedLyrics = parseTtml(ttml);

    const lyricResult = await ensureSongLyricsAdmin({
      songId: resolvedSongId,
      title: resolvedTitle,
      artist: resolvedArtist,
      lyrics: plainLyrics,
      lyricsTimed: timedLyrics,
      lyricsSource: (timedLyrics.length || plainLyrics) ? "apple" : "",
      appleMusicId: appleSongId,
      language: attrs.language || "en",
      verifiedBy: "apple_music",
    });
    if (lyricResult?.hasLyrics) {
      await admin.firestore().collection("songs").doc(resolvedSongId).set(
        {
          primaryLyricsId: resolvedSongId,
          canonicalLyricsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      found: true,
      songId: appleSongId,
      title: resolvedTitle,
      artist: resolvedArtist,
      timedLyrics,
      lyrics: plainLyrics,
    };
  }
);

exports.resolveQueueSongLyrics = onCall(
  {
    cors: true,
    secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY, GEMINI_API_KEY],
  },
  async (request) => {
    checkRateLimit(request.rawRequest, "resolve_queue_song_lyrics", { perMinute: 90, perHour: 900 });
    const callerUid = requireAuth(request);
    if (!hasAppCheck(request)) {
      throw new HttpsError("failed-precondition", "App Check token required.");
    }

    const roomCode = normalizeRoomCode(request.data?.roomCode || "");
    const songId = String(request.data?.songId || "").trim();
    const timedOnly = request.data?.timedOnly === true;
    const force = request.data?.force === true;
    const musicUserToken = String(request.data?.musicUserToken || "").trim();
    if (!roomCode) {
      throw new HttpsError("invalid-argument", "roomCode is required.");
    }
    if (!songId) {
      throw new HttpsError("invalid-argument", "songId is required.");
    }

    const rootRef = getRootRef();
    const { roomData, roomCode: safeRoomCode } = await ensureRoomHostAccess({
      rootRef,
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can resolve queue lyrics.",
    });
    if (!isLyricsPipelineV2EnabledForRoom(roomData)) {
      return {
        ok: true,
        roomCode: safeRoomCode,
        songId,
        alreadyResolved: false,
        hasLyrics: false,
        hasTimedLyrics: false,
        lyricsSource: "",
        resolution: "pipeline_v2_disabled",
        status: "disabled",
        needsUserToken: false,
        providerTrace: [],
      };
    }

    const songRef = rootRef.collection("karaoke_songs").doc(songId);
    const songSnap = await songRef.get();
    if (!songSnap.exists) {
      throw new HttpsError("not-found", "Queued song not found.");
    }
    const songData = songSnap.data() || {};
    const songRoomCode = normalizeRoomCode(songData?.roomCode || "");
    if (songRoomCode && songRoomCode !== safeRoomCode) {
      throw new HttpsError("permission-denied", "Queued song does not belong to this room.");
    }

    const existingTimed = normalizeTimedLyrics(songData?.lyricsTimed || []);
    const existingLyrics = normalizeLyricsText(songData?.lyrics || "");
    const hasExistingTimed = existingTimed.length > 0;
    const hasExistingLyrics = !!existingLyrics;
    if (!force && ((timedOnly && hasExistingTimed) || (!timedOnly && (hasExistingTimed || hasExistingLyrics)))) {
      await songRef.set({
        lyricsGenerationStatus: "resolved",
        lyricsGenerationResolution: timedOnly ? "already_timed" : "already_resolved",
        lyricsGenerationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return {
        ok: true,
        roomCode: safeRoomCode,
        songId,
        alreadyResolved: true,
        hasLyrics: hasExistingLyrics,
        hasTimedLyrics: hasExistingTimed,
        lyricsSource: String(songData?.lyricsSource || "").trim() || "",
        resolution: timedOnly ? "already_timed" : "already_resolved",
        status: "resolved",
      };
    }

    const resolved = await runLyricsResolverForQueueSong({
      songData: {
        ...songData,
        roomCode: safeRoomCode,
      },
      roomCode: safeRoomCode,
      roomData,
      timedOnly,
      musicUserToken,
    });

    const actorTag = timedOnly ? "callable_timed_only" : "callable_retry";
    const applied = await applyLyricsResolutionToQueueSong({
      songRef,
      resolved,
      actorTag,
    });
    console.info("[lyrics-pipeline-v2] callable", {
      roomCode: safeRoomCode,
      songId,
      status: applied.status,
      resolution: applied.resolution,
      hasLyrics: applied.hasLyrics,
      hasTimedLyrics: applied.hasTimedLyrics,
      timedOnly,
    });

    return {
      ok: true,
      roomCode: safeRoomCode,
      songId,
      alreadyResolved: false,
      hasLyrics: applied.hasLyrics,
      hasTimedLyrics: applied.hasTimedLyrics,
      lyricsSource: String(applied.mergedSong?.lyricsSource || "").trim() || "",
      resolution: applied.resolution,
      status: applied.status,
      needsUserToken: applied.needsUserToken,
      providerTrace: compactLyricsProviderTrace(resolved?.providerTrace || []),
    };
  }
);

exports.autoAppleLyrics = onDocumentCreated(
  {
    document: `artifacts/${APP_ID}/public/data/karaoke_songs/{songId}`,
    secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY, GEMINI_API_KEY],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const initialRoomCode = normalizeRoomCode(data.roomCode || "");
    let initialRoomData = {};
    if (initialRoomCode) {
      try {
        const roomSnap = await getRootRef().collection("rooms").doc(initialRoomCode).get();
        initialRoomData = roomSnap.data() || {};
      } catch (error) {
        console.warn("autoAppleLyrics room lookup failed", error?.message || error);
      }
    }

    if (isLyricsPipelineV2EnabledForRoom(initialRoomData)) {
      if (data.lyricsTimed?.length || data.lyrics) {
        try {
          await cacheSongLyricsFromQueueDoc(data, "auto_queue_seed");
        } catch (error) {
          console.warn("autoAppleLyrics queue seed cache failed", error?.message || error);
        }
        try {
          await event.data.ref.set({
            lyricsGenerationStatus: "resolved",
            lyricsGenerationResolution: "seed_existing",
            lyricsGenerationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lyricsProviderTrace: [],
          }, { merge: true });
        } catch (_error) {
          // Best-effort status stamp.
        }
        return;
      }

      if (data.lyricsSource) {
        try {
          await event.data.ref.set({
            lyricsGenerationStatus: "resolved",
            lyricsGenerationResolution: "source_existing",
            lyricsGenerationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lyricsProviderTrace: [],
          }, { merge: true });
        } catch (_error) {
          // Best-effort status stamp.
        }
        return;
      }

      const resolved = await runLyricsResolverForQueueSong({
        songData: data,
        roomCode: initialRoomCode,
        roomData: initialRoomData,
        timedOnly: false,
      });
      await applyLyricsResolutionToQueueSong({
        songRef: event.data.ref,
        resolved,
        actorTag: "auto_pipeline_v2",
      });
      console.info("[lyrics-pipeline-v2] trigger", {
        roomCode: initialRoomCode || normalizeRoomCode(data.roomCode || ""),
        songId: event.params?.songId || "",
        resolution: resolved?.resolution || "",
        hasLyrics: !!resolved?.hasLyrics,
        hasTimedLyrics: !!resolved?.hasTimedLyrics,
      });
      return;
    }

    if (data.lyricsTimed?.length || data.lyrics) {
      try {
        await cacheSongLyricsFromQueueDoc(data, "auto_queue_seed");
      } catch (err) {
        console.warn("autoAppleLyrics queue seed cache failed", err?.message || err);
      }
      return;
    }
    if (data.lyricsSource) return;
    const rawTitle = data.songTitle || data.title || "";
    const rawArtist = data.artist || "";
    const cleanedTitle = rawTitle.replace(/\bkaraoke\b/gi, "").replace(/\s+/g, " ").trim();
    const cleanedArtist = rawArtist.replace(/\bkaraoke\b/gi, "").replace(/\s+/g, " ").trim();
    const term = `${cleanedTitle} ${cleanedArtist}`.trim();
    if (!cleanedTitle) return;
    const resolvedArtist = cleanedArtist || "Unknown";
    const canonicalSongId = (data.songId || buildSongKey(cleanedTitle, resolvedArtist)).trim();
    const roomCode = normalizeRoomCode(data.roomCode || "");
    let aiMeterContext = null;
    if (roomCode) {
      try {
        const roomSnap = await getRootRef().collection("rooms").doc(roomCode).get();
        const roomData = roomSnap.data() || {};
        const orgId = String(roomData.orgId || "").trim();
        if (orgId) {
          const entitlements = await readOrganizationEntitlements(orgId);
          aiMeterContext = { orgId, entitlements };
        }
      } catch (err) {
        console.warn("autoAppleLyrics org usage lookup failed", err?.message || err);
      }
    }

    const applyLyricsUpdate = async ({
      lyricsText = "",
      timedLyrics = null,
      lyricsSource = "",
      appleMusicId = "",
      aiUsage = null,
      verifiedBy = "auto_queue",
    }) => {
      const normalizedLyrics = normalizeLyricsText(lyricsText || "");
      const normalizedTimed = normalizeTimedLyrics(timedLyrics || []);
      const nextPayload = {
        lyrics: normalizedLyrics,
        lyricsTimed: normalizedTimed.length ? normalizedTimed : null,
        lyricsSource: lyricsSource || (normalizedTimed.length || normalizedLyrics ? "queue" : ""),
      };
      if (appleMusicId) {
        nextPayload.appleMusicId = String(appleMusicId);
      }
      if (aiUsage && typeof aiUsage === "object") {
        nextPayload.aiLyricsUsage = {
          model: String(aiUsage.model || GEMINI_LYRICS_MODEL),
          promptTokens: Math.max(0, Number(aiUsage.promptTokens || 0)),
          outputTokens: Math.max(0, Number(aiUsage.outputTokens || 0)),
          totalTokens: Math.max(0, Number(aiUsage.totalTokens || 0)),
          estimatedCostUsd: Math.max(0, Number(aiUsage.estimatedCostUsd || 0)),
          inputUsdPer1M: Math.max(0, Number(aiUsage.inputUsdPer1M || GEMINI_LYRICS_INPUT_USD_PER_1M)),
          outputUsdPer1M: Math.max(0, Number(aiUsage.outputUsdPer1M || GEMINI_LYRICS_OUTPUT_USD_PER_1M)),
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
      }
      await event.data.ref.set(nextPayload, { merge: true });
      await cacheSongLyricsFromQueueDoc({
        ...data,
        songTitle: data.songTitle || cleanedTitle,
        artist: data.artist || resolvedArtist,
        lyrics: nextPayload.lyrics || "",
        lyricsTimed: nextPayload.lyricsTimed || null,
        appleMusicId: nextPayload.appleMusicId || data.appleMusicId || "",
        lyricsSource: nextPayload.lyricsSource || "",
      }, verifiedBy);
    };

    try {
      if (canonicalSongId) {
        const cachedLyricsSnap = await admin.firestore().collection("song_lyrics").doc(canonicalSongId).get();
        if (cachedLyricsSnap.exists) {
          const cachedLyrics = cachedLyricsSnap.data() || {};
          const cachedTimed = normalizeTimedLyrics(cachedLyrics.lyricsTimed || []);
          const cachedText = normalizeLyricsText(cachedLyrics.lyrics || "");
          if (cachedTimed.length || cachedText) {
            await applyLyricsUpdate({
              lyricsText: cachedText,
              timedLyrics: cachedTimed,
              lyricsSource: cachedLyrics.lyricsSource || "catalog",
              appleMusicId: cachedLyrics.appleMusicId || data.appleMusicId || "",
              verifiedBy: "auto_catalog",
            });
            return;
          }
        }
      }
    } catch (err) {
      console.warn("autoAppleLyrics catalog lookup failed", err?.message || err);
    }

    let matchedAppleMusicId = "";
    try {
      const storefront = data.storefront || "us";
      const token = getAppleMusicToken();
      const searchApple = async (q) => {
        const url = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(
          q
        )}&types=songs&limit=1`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          const text = await res.text();
          console.warn(`Apple search failed (${res.status})`, text?.slice(0, 300));
          return null;
        }
        const data = await res.json();
        return data?.results?.songs?.data?.[0] || null;
      };
      let song = await searchApple(term);
      if (!song && cleanedTitle) {
        song = await searchApple(cleanedTitle);
      }
      if (song?.id) {
        matchedAppleMusicId = String(song.id);
        const lyricsUrl = `https://api.music.apple.com/v1/catalog/${storefront}/songs/${matchedAppleMusicId}/lyrics`;
        const lyricsRes = await fetch(lyricsUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!lyricsRes.ok) {
          const text = await lyricsRes.text();
          if (!(lyricsRes.status === 400 && text.includes("\"code\":\"40012\""))) {
            console.warn(`Apple lyrics failed (${lyricsRes.status})`, text?.slice(0, 300));
          }
        } else {
          const lyricsData = await lyricsRes.json();
          const attrs = lyricsData?.data?.[0]?.attributes || {};
          const ttml = attrs.ttml || "";
          const plainLyrics = attrs.lyrics || "";
          const timedLyrics = parseTtml(ttml);
          if (timedLyrics.length || plainLyrics) {
            await applyLyricsUpdate({
              lyricsText: plainLyrics,
              timedLyrics,
              lyricsSource: "apple",
              appleMusicId: matchedAppleMusicId,
              verifiedBy: "auto_apple",
            });
            return;
          }
        }
        if (!data.appleMusicId) {
          await event.data.ref.set({ appleMusicId: matchedAppleMusicId }, { merge: true });
        }
      }
    } catch (err) {
      console.error("autoAppleLyrics failed", err?.message || err);
    }

    if (!aiMeterContext?.orgId) {
      console.warn(`autoAppleLyrics AI fallback skipped: no org usage context for room ${roomCode || "unknown"}`);
      return;
    }
    const canUseAi = !!aiMeterContext.entitlements?.capabilities?.["ai.generate_content"];
    if (!canUseAi) {
      console.warn(`autoAppleLyrics AI fallback skipped: capability disabled for org ${aiMeterContext.orgId}`);
      return;
    }
    try {
      await reserveOrganizationUsageUnits({
        orgId: aiMeterContext.orgId,
        entitlements: aiMeterContext.entitlements,
        meterId: "ai_generate_content",
        units: 1,
      });
    } catch (err) {
      const code = String(err?.code || "").toLowerCase();
      if (code.includes("resource-exhausted")) {
        console.warn(`autoAppleLyrics AI fallback skipped: ai_generate_content limit reached for org ${aiMeterContext.orgId}`);
        return;
      }
      console.warn("autoAppleLyrics AI meter reserve failed", err?.message || err);
      return;
    }

    const aiLyricsResult = await fetchAiLyricsFallbackText(cleanedTitle, resolvedArtist);
    if (!aiLyricsResult?.lyrics) return;
    try {
      await applyLyricsUpdate({
        lyricsText: aiLyricsResult.lyrics,
        timedLyrics: null,
        lyricsSource: "ai",
        appleMusicId: matchedAppleMusicId || data.appleMusicId || "",
        aiUsage: aiLyricsResult.usage || null,
        verifiedBy: "auto_ai",
      });
    } catch (err) {
      console.error("autoAppleLyrics AI merge failed", err?.message || err);
    }
  }
);

const FIREBASE_HOSTING_SITE_ID = "beaurocks-karaoke-v2";
const DEFAULT_PUBLIC_ORIGIN = "https://beaurocks.app";
const FIRST_PARTY_ROOT_DOMAINS = [
  "beaurocks.app",
  "beaurocks.com",
];

const parseOriginHostname = (origin = "") => {
  try {
    return new URL(String(origin || "")).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const isAllowedOriginHostname = (hostname = "") => {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (FIRST_PARTY_ROOT_DOMAINS.some((root) => host === root || host.endsWith(`.${root}`))) return true;

  const webAppHost = `${FIREBASE_HOSTING_SITE_ID}.web.app`;
  if (host === webAppHost) return true;
  if (host.startsWith(`${FIREBASE_HOSTING_SITE_ID}--`) && host.endsWith(".web.app")) return true;

  const firebaseAppHost = `${FIREBASE_HOSTING_SITE_ID}.firebaseapp.com`;
  if (host === firebaseAppHost) return true;
  if (host.startsWith(`${FIREBASE_HOSTING_SITE_ID}--`) && host.endsWith(".firebaseapp.com")) return true;

  return false;
};

const isAllowedOrigin = (origin = "") => {
  const host = parseOriginHostname(origin);
  return isAllowedOriginHostname(host);
};

const resolveOrigin = (req, originFromClient) => {
  const origin = originFromClient || req.get("origin") || "";
  const host = parseOriginHostname(origin);
  return isAllowedOriginHostname(host) && origin.startsWith("http")
    ? origin
    : DEFAULT_PUBLIC_ORIGIN;
};

const normalizeDirectoryRegionList = (input = []) => {
  const source = Array.isArray(input) ? input : [input];
  const regions = [];
  source.forEach((entry) => {
    const token = normalizeDirectoryToken(entry, 80);
    if (!token) return;
    if (regions.includes(token)) return;
    regions.push(token);
  });
  return regions.slice(0, 40);
};

const normalizeDirectoryIngestionRecords = (input = []) => {
  const source = Array.isArray(input) ? input : [];
  const records = [];
  source.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const name = safeDirectoryString(entry.name || entry.title || "", 180);
    if (!name) return;
    const city = safeDirectoryString(entry.city || "", 80);
    const state = safeDirectoryString(entry.state || "", 40);
    const region = normalizeDirectoryToken(entry.region || `${state}_${city}` || DIRECTORY_DEFAULT_REGION, 80) || DIRECTORY_DEFAULT_REGION;
    const locationText = safeDirectoryString(
      entry.locationText || [city, state, "United States"].filter(Boolean).join(", "),
      220
    );
    records.push({
      name,
      city,
      state,
      region,
      locationText,
      address1: safeDirectoryString(entry.address1 || entry.address || "", 180),
      listingType: requireDirectoryListingType(entry.listingType || "venue"),
      startsAtMs: Number(entry.startsAtMs || 0) || 0,
      endsAtMs: Number(entry.endsAtMs || 0) || 0,
      hostName: safeDirectoryString(entry.hostName || "", 120),
      venueName: safeDirectoryString(entry.venueName || "", 120),
      websiteUrl: normalizeDirectoryOptionalUrl(entry.websiteUrl || ""),
      bookingUrl: normalizeDirectoryOptionalUrl(entry.bookingUrl || ""),
    });
  });
  return records.slice(0, DIRECTORY_SYNC_MAX_BATCH);
};

const hydrateIngestionRecordsFromRegions = async (regions = []) => {
  if (!regions.length) return [];
  const db = admin.firestore();
  const records = [];
  for (const regionId of regions.slice(0, 20)) {
    const snap = await db.collection("directory_regions").doc(regionId).get();
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const city = safeDirectoryString(data.city || "", 80);
    const state = safeDirectoryString(data.state || "", 40);
    const seeds = Array.isArray(data.seedListings) ? data.seedListings : [];
    seeds.slice(0, 20).forEach((seed) => {
      if (!seed || typeof seed !== "object") return;
      const name = safeDirectoryString(seed.name || seed.title || "", 180);
      if (!name) return;
      records.push({
        name,
        city: safeDirectoryString(seed.city || city, 80),
        state: safeDirectoryString(seed.state || state, 40),
        region: normalizeDirectoryToken(seed.region || regionId, 80) || regionId,
        locationText: safeDirectoryString(seed.locationText || [city, state, "United States"].filter(Boolean).join(", "), 220),
        address1: safeDirectoryString(seed.address1 || seed.address || "", 180),
        listingType: requireDirectoryListingType(seed.listingType || "venue"),
        startsAtMs: Number(seed.startsAtMs || 0) || 0,
        endsAtMs: Number(seed.endsAtMs || 0) || 0,
        hostName: safeDirectoryString(seed.hostName || "", 120),
        venueName: safeDirectoryString(seed.venueName || "", 120),
        websiteUrl: normalizeDirectoryOptionalUrl(seed.websiteUrl || ""),
        bookingUrl: normalizeDirectoryOptionalUrl(seed.bookingUrl || ""),
      });
    });
  }
  return records.slice(0, DIRECTORY_SYNC_MAX_BATCH);
};

const buildDirectoryExternalSources = ({ googleLookup = null, yelpLookup = null }) => {
  const payload = {};
  if (googleLookup) {
    const googlePhotoRefs = normalizeDirectoryStringArray([
      googleLookup.photoRef,
      ...(Array.isArray(googleLookup.photoRefs) ? googleLookup.photoRefs : []),
    ], 8, 320);
    payload.google = {
      placeId: safeDirectoryString(googleLookup.placeId || "", 180),
      mapsUrl: normalizeDirectoryOptionalUrl(googleLookup.mapsUrl || ""),
      photoRef: googlePhotoRefs[0] || "",
      photoRefs: googlePhotoRefs,
      imageUrl: normalizeDirectoryOptionalUrl(googleLookup.imageUrl || ""),
      photoUrl: normalizeDirectoryOptionalUrl(googleLookup.photoUrl || ""),
      photoUrls: normalizeDirectoryUrlArray(googleLookup.photoUrls || [], 8),
      rating: Number(googleLookup.rating || 0) || 0,
      reviewCount: Number(googleLookup.reviewCount || 0) || 0,
      refreshedAtMs: Date.now(),
      address: safeDirectoryString(googleLookup.address || "", 220),
    };
  }
  if (yelpLookup) {
    payload.yelp = {
      businessId: safeDirectoryString(yelpLookup.businessId || "", 180),
      url: normalizeDirectoryOptionalUrl(yelpLookup.url || ""),
      imageUrl: normalizeDirectoryOptionalUrl(yelpLookup.imageUrl || ""),
      rating: Number(yelpLookup.rating || 0) || 0,
      reviewCount: Number(yelpLookup.reviewCount || 0) || 0,
      refreshedAtMs: Date.now(),
      address: safeDirectoryString(yelpLookup.address || "", 220),
    };
  }
  return payload;
};

const executeDirectoryIngestion = async ({
  requestUid = "",
  providers = [],
  regions = [],
  records = [],
  dryRun = false,
  trigger = "manual",
}) => {
  const db = admin.firestore();
  const now = buildDirectoryNow();
  const providerList = normalizeDirectoryProviders(providers);
  const regionList = normalizeDirectoryRegionList(regions);
  let sourceRecords = normalizeDirectoryIngestionRecords(records);
  if (!sourceRecords.length && regionList.length) {
    sourceRecords = await hydrateIngestionRecordsFromRegions(regionList);
  }
  sourceRecords = sourceRecords.slice(0, DIRECTORY_SYNC_MAX_BATCH);
  const results = [];

  for (const record of sourceRecords) {
    let googleLookup = null;
    let yelpLookup = null;
    if (providerList.includes("google")) {
      try {
        googleLookup = await lookupGoogleVenue({
          name: record.name,
          locationText: record.locationText,
        });
      } catch (error) {
        console.warn("directory ingest google lookup failed", error?.message || error);
      }
    }
    if (providerList.includes("yelp")) {
      try {
        yelpLookup = await lookupYelpVenue({
          name: record.name,
          locationText: record.locationText,
        });
      } catch (error) {
        console.warn("directory ingest yelp lookup failed", error?.message || error);
      }
    }

    const externalSources = buildDirectoryExternalSources({ googleLookup, yelpLookup });
    const mappedLatLng = normalizeDirectoryLatLng(googleLookup?.location || yelpLookup?.location || {});
    const payload = normalizeDirectoryListingPayload(record.listingType, {
      title: record.name,
      description: "",
      city: record.city,
      state: record.state,
      region: record.region || DIRECTORY_DEFAULT_REGION,
      address1: record.address1 || googleLookup?.address || yelpLookup?.address || "",
      startsAtMs: record.startsAtMs,
      endsAtMs: record.endsAtMs,
      hostName: record.hostName,
      venueName: record.venueName || googleLookup?.name || yelpLookup?.name || "",
      websiteUrl: record.websiteUrl || yelpLookup?.url || "",
      bookingUrl: record.bookingUrl || "",
      imageUrl: record.imageUrl || yelpLookup?.imageUrl || "",
      location: mappedLatLng,
      sourceType: "external",
      externalSources,
      status: "pending",
      visibility: "public",
      ownerUid: requestUid || "system_sync",
    }, requestUid || "system_sync");

    const submissionId = buildDirectorySubmissionId(payload.listingType, requestUid || "system");
    const submissionDoc = {
      submissionId,
      listingType: payload.listingType,
      entityId: "",
      status: "pending",
      sourceType: "external",
      providers: providerList,
      payload,
      createdBy: requestUid || null,
      createdAt: now,
      updatedAt: now,
      moderation: {
        action: "pending",
        notes: "",
        moderatedBy: null,
        moderatedAt: null,
      },
      syncMeta: {
        trigger,
        regions: regionList,
      },
    };

    if (!dryRun) {
      await db.collection("directory_submissions").doc(submissionId).set(submissionDoc, { merge: true });
      const googlePlaceId = safeDirectoryString(externalSources?.google?.placeId || "", 180);
      if (googlePlaceId) {
        await db.collection("external_source_links").doc(`google_${googlePlaceId}`).set({
          provider: "google",
          providerEntityId: googlePlaceId,
          submissionId,
          listingType: payload.listingType,
          updatedAt: now,
        }, { merge: true });
      }
      const yelpBusinessId = safeDirectoryString(externalSources?.yelp?.businessId || "", 180);
      if (yelpBusinessId) {
        await db.collection("external_source_links").doc(`yelp_${yelpBusinessId}`).set({
          provider: "yelp",
          providerEntityId: yelpBusinessId,
          submissionId,
          listingType: payload.listingType,
          updatedAt: now,
        }, { merge: true });
      }
    }

    results.push({
      submissionId,
      listingType: payload.listingType,
      title: payload.title,
      city: payload.city,
      state: payload.state,
      hasGoogle: !!externalSources.google,
      hasYelp: !!externalSources.yelp,
    });
  }

  return {
    dryRun: !!dryRun,
    trigger,
    providers: providerList,
    regions: regionList,
    totalRecords: sourceRecords.length,
    queued: results.length,
    items: results,
  };
};

exports.googleMapsKey = onCall({ cors: true, secrets: [GOOGLE_MAPS_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "google_maps_key");
  requireAuth(request);
  enforceAppCheckIfEnabled(request, "google_maps_key");
  const origin = request.rawRequest?.get?.("origin") || "";
  if (origin && !isAllowedOrigin(origin)) {
    throw new HttpsError("permission-denied", "Origin not allowed.");
  }
  const apiKey = GOOGLE_MAPS_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Google Maps API key not configured.");
  }
  return { apiKey };
});

exports.submitMarketingWaitlist = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "submit_marketing_waitlist", { perMinute: 12, perHour: 80 });
  enforceAppCheckIfEnabled(request, "submit_marketing_waitlist");

  const name = sanitizeWaitlistName(request.data?.name || "");
  const email = sanitizeWaitlistEmail(request.data?.email || "");
  const useCase = sanitizeWaitlistUseCase(request.data?.useCase || "");
  const source = sanitizeWaitlistSource(request.data?.source || "");
  const now = admin.firestore.FieldValue.serverTimestamp();
  const uid = request.auth?.uid || null;
  const userAgent = String(request.rawRequest?.get?.("user-agent") || "").slice(0, 320);
  const ip = getClientIp(request.rawRequest);

  const db = admin.firestore();
  const waitlistRef = db.collection("marketing_waitlist").doc(buildWaitlistDocId(email));
  const metaRef = db.collection("marketing_meta").doc("waitlist");
  let linePosition = 0;
  let isNewSignup = false;

  await db.runTransaction(async (tx) => {
    const [signupSnap, metaSnap] = await Promise.all([tx.get(waitlistRef), tx.get(metaRef)]);
    const currentTotal = Number(metaSnap.data()?.totalSignups || 0);

    if (!signupSnap.exists) {
      linePosition = currentTotal + 1;
      isNewSignup = true;
      tx.set(waitlistRef, {
        name,
        email,
        useCase,
        source,
        status: "active",
        linePosition,
        createdAt: now,
        updatedAt: now,
        firstUid: uid,
        lastUid: uid,
        firstIp: ip,
        lastIp: ip,
        userAgent,
        duplicateSubmitCount: 0,
      }, { merge: true });
      tx.set(metaRef, {
        totalSignups: linePosition,
        updatedAt: now,
      }, { merge: true });
      return;
    }

    const existing = signupSnap.data() || {};
    linePosition = Number(existing.linePosition || currentTotal || 1);
    tx.set(waitlistRef, {
      name,
      useCase,
      source,
      updatedAt: now,
      lastUid: uid,
      lastIp: ip,
      userAgent,
      duplicateSubmitCount: admin.firestore.FieldValue.increment(1),
      lastSubmittedAt: now,
    }, { merge: true });
  });

  return {
    ok: true,
    linePosition,
    isNewSignup,
    message: isNewSignup
      ? `You are in line. Early access position: #${linePosition}.`
      : `You are already on the list. Current position: #${linePosition}.`,
  };
});

exports.redeemMarketingPrivateHostAccess = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "redeem_marketing_private_host_access", { perMinute: 18, perHour: 120 });
  enforceAppCheckIfEnabled(request, "redeem_marketing_private_host_access");
  const uid = requireAuth(request, "Sign in required.");
  const source = sanitizeWaitlistSource(request.data?.source || "marketing_site");
  const submittedCode = normalizeMarketingPrivateInviteCode(request.data?.code || "");

  if (MARKETING_PRIVATE_HOST_ACCESS_ENFORCED && !MARKETING_PRIVATE_INVITE_CODES.length) {
    throw new HttpsError("failed-precondition", "Private host invite code list is not configured.");
  }

  if (MARKETING_PRIVATE_HOST_ACCESS_ENFORCED && MARKETING_PRIVATE_INVITE_CODES.length) {
    if (!submittedCode) {
      throw new HttpsError("invalid-argument", "code is required.");
    }
    if (!MARKETING_PRIVATE_INVITE_CODES.includes(submittedCode)) {
      throw new HttpsError("permission-denied", "Invalid private host access code.");
    }
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const db = admin.firestore();
  const unlockMode = MARKETING_PRIVATE_HOST_ACCESS_ENFORCED
    ? (MARKETING_PRIVATE_INVITE_CODES.length > 1 ? "pin_multi" : "pin")
    : "disabled";
  const codeFingerprint = submittedCode
    ? `${submittedCode.length}_${submittedCode.slice(0, 2)}_${submittedCode.slice(-1)}`
    : "";

  await Promise.all([
    marketingPrivateAccessDocRef(uid).set({
      uid,
      privateHostAccessEnabled: true,
      unlockedVia: unlockMode,
      source,
      codeFingerprint,
      createdAt: now,
      updatedAt: now,
    }, { merge: true }),
    db.collection("users").doc(uid).set({
      marketing: {
        privateHostAccessEnabled: true,
        privateHostAccessUpdatedAt: now,
        privateHostAccessSource: source,
      },
      updatedAt: now,
    }, { merge: true }),
  ]);

  return {
    ok: true,
    privateHostAccessEnabled: true,
    mode: unlockMode,
  };
});

exports.setMarketingPrivateHostAccess = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "set_marketing_private_host_access", { perMinute: 30, perHour: 240 });
  enforceAppCheckIfEnabled(request, "set_marketing_private_host_access");
  const requesterUid = requireAuth(request, "Sign in required.");
  const requesterAccess = await getDirectoryModeratorAccess(requesterUid);
  if (!requesterAccess.isAdmin) {
    throw new HttpsError("permission-denied", "Directory admin role required.");
  }

  const payload = request.data && typeof request.data === "object" ? request.data : {};
  const enabled = parseBooleanInput(payload.enabled, true);
  const source = sanitizeWaitlistSource(payload.source || "admin_moderation");
  const notes = normalizeDirectoryTextBlock(payload.notes || "", 500);
  const targetToken = String(payload.target || payload.targetId || "").trim();

  let targetUid = normalizeUidToken(payload.uid || payload.targetUid || "");
  let targetEmail = sanitizeOptionalWaitlistEmail(payload.email || payload.targetEmail || "");
  if (!targetUid && !targetEmail && targetToken) {
    if (targetToken.includes("@")) {
      targetEmail = sanitizeWaitlistEmail(targetToken);
    } else {
      targetUid = normalizeUidToken(targetToken);
    }
  }
  if (!targetUid && !targetEmail) {
    throw new HttpsError("invalid-argument", "Provide uid or email.");
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const db = admin.firestore();
  const updates = [];
  const action = enabled ? "grant" : "revoke";

  if (targetEmail) {
    updates.push(
      marketingPrivateInviteDocRef(targetEmail).set({
        email: targetEmail,
        privateHostAccessEnabled: enabled,
        status: enabled ? "granted" : "revoked",
        source,
        notes,
        grantedByUid: requesterUid,
        grantedByRoles: requesterAccess.roles || [],
        lastAction: action,
        updatedAt: now,
        createdAt: now,
      }, { merge: true })
    );
  }

  if (targetUid) {
    updates.push(
      marketingPrivateAccessDocRef(targetUid).set({
        uid: targetUid,
        privateHostAccessEnabled: enabled,
        unlockedVia: enabled ? "admin_grant" : "admin_revoke",
        source,
        notes,
        invitedEmail: targetEmail || "",
        grantedByUid: requesterUid,
        updatedAt: now,
        createdAt: now,
      }, { merge: true })
    );
    updates.push(
      db.collection("users").doc(targetUid).set({
        marketing: {
          privateHostAccessEnabled: enabled,
          privateHostAccessUpdatedAt: now,
          privateHostAccessSource: source,
          privateHostAccessNotes: notes,
        },
        updatedAt: now,
      }, { merge: true })
    );
  }

  await Promise.all(updates);

  return {
    ok: true,
    privateHostAccessEnabled: enabled,
    targetUid,
    targetEmail,
    mode: targetUid ? "uid_grant" : "email_invite",
    message: targetUid
      ? `Host access ${enabled ? "granted" : "revoked"} for uid ${targetUid}.`
      : `Host access ${enabled ? "granted" : "revoked"} for ${targetEmail}.`,
  };
});

exports.getMyDirectoryAccess = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "get_my_directory_access", { perMinute: 60, perHour: 480 });
  enforceAppCheckIfEnabled(request, "get_my_directory_access");
  const uid = requireAuth(request, "Sign in required.");
  const access = await getDirectoryModeratorAccess(uid);
  return {
    ok: true,
    uid,
    isModerator: !!access.isModerator,
    isAdmin: !!access.isAdmin,
    roles: Array.isArray(access.roles) ? access.roles : [],
    mode: String(access.mode || ""),
  };
});

exports.setMyVipAccountStatus = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "set_my_vip_account_status", { perMinute: 24, perHour: 160 });
  enforceAppCheckIfEnabled(request, "set_my_vip_account_status");
  const uid = requireAuth(request, "Sign in required.");
  const source = normalizeDirectoryToken(request.data?.source || "audience_app", 60) || "audience_app";
  const qaBypass = !!request.data?.qaBypass;
  const vipLevel = clampNumber(request.data?.vipLevel, 1, 5, 1);

  let phone = "";
  if (qaBypass) {
    const isSuper = await isSuperAdminUid(uid);
    if (!isSuper) {
      throw new HttpsError("permission-denied", "QA VIP bypass requires super admin.");
    }
  } else {
    const userRecord = await admin.auth().getUser(uid);
    phone = normalizeDirectoryPhone(userRecord?.phoneNumber || "");
    if (!phone) {
      throw new HttpsError("failed-precondition", "Phone verification required before VIP unlock.");
    }
  }

  await admin.firestore().collection("users").doc(uid).set({
    vipLevel,
    isVip: vipLevel > 0,
    ...(phone ? { phone } : {}),
    vipStatusSource: source,
    vipStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    ok: true,
    uid,
    vipLevel,
    isVip: vipLevel > 0,
    phoneVerified: !!phone,
    mode: qaBypass ? "qa_bypass" : "phone_verified",
    source,
  };
});

exports.getDirectoryMapsConfig = onCall(
  { cors: true, secrets: [GOOGLE_MAPS_API_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "directory_maps_config", { perMinute: 60, perHour: 600 });
    const origin = request.rawRequest?.get?.("origin") || "";
    if (origin && !isAllowedOrigin(origin)) {
      throw new HttpsError("permission-denied", "Origin not allowed.");
    }
    const key = GOOGLE_MAPS_API_KEY.value();
    const mapEnabled = DIRECTORY_MAPS_PUBLIC_ENABLED && !!key;
    return {
      mapEnabled,
      apiKey: mapEnabled ? key : "",
      defaultCountry: DIRECTORY_DEFAULT_COUNTRY,
      defaultScope: DIRECTORY_DEFAULT_REGION,
      supportedProviders: ["google", "yelp"],
      reviewPolicy: "first_party_karaoke",
      featureFlags: {
        marketing_claim_flow_enabled: MARKETING_CLAIM_FLOW_ENABLED,
        marketing_rsvp_enabled: MARKETING_RSVP_ENABLED,
        marketing_sms_reminders_enabled: MARKETING_SMS_REMINDERS_ENABLED,
        marketing_geo_pages_enabled: MARKETING_GEO_PAGES_ENABLED,
        marketing_discover_google_static_images_enabled: MARKETING_DISCOVER_GOOGLE_STATIC_IMAGES_ENABLED,
      },
    };
  }
);

exports.upsertDirectoryProfile = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "upsert_directory_profile", { perMinute: 30, perHour: 240 });
  enforceAppCheckIfEnabled(request, "upsert_directory_profile");
  const uid = requireAuth(request);
  const profileInput = request.data?.profile && typeof request.data.profile === "object"
    ? request.data.profile
    : request.data;
  const normalized = normalizeDirectoryProfilePayload(profileInput || {});
  const db = admin.firestore();
  const [userSnap, existingProfileSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("directory_profiles").doc(uid).get(),
  ]);
  const userData = userSnap.data() || {};
  const existingProfile = existingProfileSnap.data() || {};
  const preservedRoles = normalizeDirectoryRoles(existingProfile.roles || []);
  const effectiveHandle = normalized.handle
    || normalizeDirectoryToken(existingProfile.handle || normalized.displayName, 40);
  const now = buildDirectoryNow();
  const payload = {
    uid,
    ...normalized,
    handle: effectiveHandle,
    roles: preservedRoles,
    status: "approved",
    vipLevel: Number(userData.vipLevel || 0) || 0,
    totalFamePoints: Number(userData.totalFamePoints || 0) || 0,
    fameLevel: Number(userData.currentLevel || 0) || 0,
    sourceUserUpdatedAtMs: Date.now(),
    updatedAt: now,
    createdAt: now,
  };
  await db.collection("directory_profiles").doc(uid).set(payload, { merge: true });
  return { ok: true, uid, profile: payload };
});

exports.submitCatalogContribution = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "submit_catalog_contribution", { perMinute: 24, perHour: 160 });
  enforceAppCheckIfEnabled(request, "submit_catalog_contribution");
  const uid = requireAuth(request);
  const payload = request.data?.payload && typeof request.data.payload === "object"
    ? request.data.payload
    : request.data || {};
  const title = safeDirectoryString(payload?.title || payload?.songTitle || "", 180);
  const artist = safeDirectoryString(payload?.artist || "", 180);
  if (!title || !artist) {
    throw new HttpsError("invalid-argument", "title and artist are required.");
  }
  const sourceToken = normalizeDirectoryToken(payload?.source || "custom", 20);
  const source = ["custom", "youtube", "apple"].includes(sourceToken) ? sourceToken : "custom";
  const mediaUrl = normalizeDirectoryOptionalUrl(payload?.mediaUrl || "");
  const appleMusicId = safeDirectoryString(payload?.appleMusicId || "", 120);
  const contributionId = `catalog_${Date.now()}_${uid.slice(0, 8)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = buildDirectoryNow();

  const contribution = {
    contributionId,
    status: "pending",
    type: "song_track_upsert",
    dedupeKey: buildSongKey(title, artist),
    payload: {
      title,
      artist,
      artworkUrl: normalizeDirectoryOptionalUrl(payload?.artworkUrl || ""),
      source,
      mediaUrl,
      appleMusicId,
      label: safeDirectoryString(payload?.label || "", 120),
      duration: clampNumber(payload?.duration || 0, 0, 7200, 0),
      audioOnly: !!payload?.audioOnly,
      backingOnly: !!payload?.backingOnly,
    },
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
    moderation: {
      action: "pending",
      notes: "",
      moderatedBy: null,
      moderatedAt: null,
    },
  };

  await admin.firestore().collection("catalog_contributions").doc(contributionId).set(contribution, { merge: true });
  return { ok: true, contributionId, status: "pending" };
});

exports.listCatalogContributionQueue = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "list_catalog_contribution_queue", { perMinute: 60, perHour: 600 });
  enforceAppCheckIfEnabled(request, "list_catalog_contribution_queue");
  await requireDirectoryModerator(request);
  const statusFilter = normalizeDirectoryToken(request.data?.status || "pending", 20) || "pending";
  const maxEntries = clampNumber(request.data?.limit || 40, 1, 200, 40);
  const snap = await admin.firestore()
    .collection("catalog_contributions")
    .orderBy("createdAt", "desc")
    .limit(maxEntries)
    .get();
  const items = snap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((entry) => !statusFilter || statusFilter === "all" || String(entry.status || "") === statusFilter);
  return {
    ok: true,
    status: statusFilter,
    count: items.length,
    items,
  };
});

exports.resolveCatalogContribution = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "resolve_catalog_contribution", { perMinute: 30, perHour: 300 });
  enforceAppCheckIfEnabled(request, "resolve_catalog_contribution");
  const { uid } = await requireDirectoryModerator(request);
  const contributionId = safeDirectoryString(request.data?.contributionId || "", 220);
  const action = normalizeDirectoryToken(request.data?.action || "approve", 20) || "approve";
  const notes = normalizeDirectoryTextBlock(request.data?.notes || "", 500);
  if (!contributionId) {
    throw new HttpsError("invalid-argument", "contributionId is required.");
  }
  if (!["approve", "reject"].includes(action)) {
    throw new HttpsError("invalid-argument", "action must be approve or reject.");
  }

  const db = admin.firestore();
  const ref = db.collection("catalog_contributions").doc(contributionId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Catalog contribution not found.");
  }
  const existing = snap.data() || {};
  if (String(existing.status || "") !== "pending") {
    return {
      ok: true,
      contributionId,
      status: existing.status || "unknown",
      songId: existing?.resolution?.songId || "",
      trackId: existing?.resolution?.trackId || "",
      mode: "already_resolved",
    };
  }

  const now = buildDirectoryNow();
  let songId = "";
  let trackId = "";
  if (action === "approve") {
    const payload = existing.payload || {};
    const title = safeDirectoryString(payload?.title || "", 180);
    const artist = safeDirectoryString(payload?.artist || "", 180) || "Unknown";
    if (!title) {
      throw new HttpsError("failed-precondition", "Contribution payload is missing title.");
    }
    const songResult = await ensureSongAdmin({
      title,
      artist,
      artworkUrl: normalizeDirectoryOptionalUrl(payload?.artworkUrl || ""),
      appleMusicId: safeDirectoryString(payload?.appleMusicId || "", 120),
      verifyMeta: false,
      verifiedBy: uid,
    });
    songId = songResult?.songId || buildSongKey(title, artist);

    const sourceToken = normalizeDirectoryToken(payload?.source || "custom", 20);
    const source = ["custom", "youtube", "apple"].includes(sourceToken) ? sourceToken : "custom";
    const mediaUrl = normalizeDirectoryOptionalUrl(payload?.mediaUrl || "");
    const appleMusicId = safeDirectoryString(payload?.appleMusicId || "", 120);
    if (mediaUrl || appleMusicId) {
      const trackResult = await ensureTrackAdmin({
        songId,
        source,
        mediaUrl,
        appleMusicId,
        label: safeDirectoryString(payload?.label || "", 120) || null,
        duration: clampNumber(payload?.duration || 0, 0, 7200, 0) || null,
        audioOnly: !!payload?.audioOnly,
        backingOnly: !!payload?.backingOnly,
        addedBy: uid,
      });
      trackId = trackResult?.trackId || "";
    }
  }

  const status = action === "approve" ? "approved" : "rejected";
  await ref.set({
    status,
    updatedAt: now,
    moderation: {
      action: status,
      notes,
      moderatedBy: uid,
      moderatedAt: now,
    },
    resolution: {
      songId: songId || "",
      trackId: trackId || "",
      appliedBy: action === "approve" ? uid : "",
      appliedAt: action === "approve" ? now : null,
    },
  }, { merge: true });

  return { ok: true, contributionId, status, songId, trackId };
});

exports.submitDirectoryListing = onCall(
  { cors: true, secrets: [GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_SERVER_API_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "submit_directory_listing", { perMinute: 20, perHour: 180 });
    enforceAppCheckIfEnabled(request, "submit_directory_listing");
    const uid = requireAuth(request);
    const listingType = requireDirectoryListingType(request.data?.listingType || "");
    const enrichment = await maybeEnrichDirectoryLocation(request.data?.payload || {});
    const payload = normalizeDirectoryListingPayload(
      listingType,
      enrichment.payload || request.data?.payload || {},
      uid
    );
    const submissionId = buildDirectorySubmissionId(listingType, uid);
    const now = buildDirectoryNow();
    const providerHints = deriveDirectoryProviderHints(payload);
    const docData = {
      submissionId,
      listingType,
      entityId: "",
      status: "pending",
      sourceType: "user",
      providers: providerHints,
      payload,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      moderation: {
        action: "pending",
        notes: "",
        moderatedBy: null,
        moderatedAt: null,
      },
      enrichment: {
        geocoded: !!enrichment.enriched,
        provider: enrichment.provider || "",
        geocodedAtMs: enrichment.enriched ? Date.now() : 0,
      },
    };
    await admin.firestore().collection("directory_submissions").doc(submissionId).set(docData, { merge: true });
    return { ok: true, submissionId, status: "pending" };
  }
);

const upsertHostRoomDiscoveryListingInternal = async ({
  callerUid = "",
  roomCode = "",
  listingInput = {},
  roomAccess = null,
} = {}) => {
  const safeCallerUid = safeDirectoryString(callerUid || "", 180);
  if (!safeCallerUid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const safeRoomCode = normalizeRoomCode(roomCode || "");
  if (!safeRoomCode) {
    throw new HttpsError("invalid-argument", "roomCode is required.");
  }
  const nextListingInput = listingInput && typeof listingInput === "object"
    ? listingInput
    : {};
  const access = roomAccess?.roomRef && roomAccess?.roomData
    ? {
      roomRef: roomAccess.roomRef,
      roomData: roomAccess.roomData,
      roomCode: normalizeRoomCode(roomAccess.roomCode || safeRoomCode),
    }
    : await ensureRoomHostAccess({
      roomCode: safeRoomCode,
      callerUid: safeCallerUid,
      deniedMessage: "Only room hosts can publish this room to discovery.",
    });
  const roomRef = access.roomRef;
  const roomData = access.roomData || {};
  const resolvedRoomCode = normalizeRoomCode(access.roomCode || safeRoomCode);

  const hostUid = safeDirectoryString(roomData.hostUid || safeCallerUid, 180) || safeCallerUid;
  const hostName = safeDirectoryString(roomData.hostName || "", 120) || "Host";
  const publicRoom = parseBooleanInput(
    nextListingInput.publicRoom ?? nextListingInput.isPublicRoom ?? nextListingInput.public ?? false,
    false
  );
  const virtualOnly = parseBooleanInput(
    nextListingInput.virtualOnly ?? nextListingInput.isVirtualOnly ?? false,
    false
  );
  const visibility = publicRoom ? "public" : "private";

  const startsAtMsRaw = Number(nextListingInput.startsAtMs || 0);
  let startsAtMs = Number.isFinite(startsAtMsRaw) && startsAtMsRaw > 0 ? Math.floor(startsAtMsRaw) : 0;
  if (!startsAtMs && String(nextListingInput.startsAtLocal || "").trim()) {
    const parsedStartsAt = Date.parse(String(nextListingInput.startsAtLocal || "").trim());
    if (Number.isFinite(parsedStartsAt) && parsedStartsAt > 0) {
      startsAtMs = Math.floor(parsedStartsAt);
    }
  }

  const endsAtMsRaw = Number(nextListingInput.endsAtMs || 0);
  const endsAtMs = Number.isFinite(endsAtMsRaw) && endsAtMsRaw > startsAtMs ? Math.floor(endsAtMsRaw) : 0;
  const parsedLat = Number(nextListingInput.lat ?? nextListingInput.location?.lat ?? 0);
  const parsedLng = Number(nextListingInput.lng ?? nextListingInput.location?.lng ?? 0);
  const location = Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
    ? { lat: parsedLat, lng: parsedLng }
    : normalizeDirectoryLatLng(nextListingInput.location || nextListingInput.latLng || {});
  const title = safeDirectoryString(
    nextListingInput.title || `${hostName} Karaoke Room ${resolvedRoomCode}`,
    180
  ) || `${hostName} Karaoke Room ${resolvedRoomCode}`;
  const sessionMode = safeDirectoryString(
    nextListingInput.sessionMode || (virtualOnly ? "virtual" : "karaoke"),
    40
  ) || (virtualOnly ? "virtual" : "karaoke");

  const basePayload = {
    title,
    description: normalizeDirectoryTextBlock(nextListingInput.description || "", 3000),
    region: normalizeDirectoryToken(nextListingInput.region || DIRECTORY_DEFAULT_REGION, 80) || DIRECTORY_DEFAULT_REGION,
    city: safeDirectoryString(nextListingInput.city || "", 80),
    state: safeDirectoryString(nextListingInput.state || "", 40),
    country: safeDirectoryString(nextListingInput.country || DIRECTORY_DEFAULT_COUNTRY, 2).toUpperCase(),
    timezone: safeDirectoryString(nextListingInput.timezone || "America/Los_Angeles", 80),
    address1: virtualOnly ? "" : safeDirectoryString(nextListingInput.address1 || nextListingInput.address || "", 180),
    address2: virtualOnly ? "" : safeDirectoryString(nextListingInput.address2 || "", 180),
    location: virtualOnly ? {} : location,
    startsAtMs,
    endsAtMs,
    visibility,
    status: "approved",
    websiteUrl: normalizeDirectoryOptionalUrl(nextListingInput.websiteUrl || ""),
    bookingUrl: normalizeDirectoryOptionalUrl(nextListingInput.bookingUrl || ""),
    imageUrl: normalizeDirectoryOptionalUrl(nextListingInput.imageUrl || ""),
    roomCode: resolvedRoomCode,
    venueName: safeDirectoryString(nextListingInput.venueName || "", 120),
    sessionMode,
    hostUid,
    hostName,
    ownerUid: safeCallerUid,
    sourceType: "host_room",
    isPublicRoom: publicRoom,
    virtualOnly,
    isVirtualOnly: virtualOnly,
    externalSources: nextListingInput.externalSources && typeof nextListingInput.externalSources === "object"
      ? nextListingInput.externalSources
      : {},
  };

  const enrichment = await maybeEnrichDirectoryLocation(basePayload);
  const normalized = normalizeDirectoryListingPayload(
    "room_session",
    enrichment.payload || basePayload,
    safeCallerUid
  );
  const listingId = safeDirectoryString(
    nextListingInput.listingId || `room_${normalizeDirectoryToken(resolvedRoomCode, 80) || "session"}`,
    220
  ) || `room_${normalizeDirectoryToken(resolvedRoomCode, 80) || "session"}`;
  const now = buildDirectoryNow();
  const roomSessionDoc = {
    ...normalized,
    listingType: "room_session",
    roomCode: resolvedRoomCode,
    hostUid,
    hostName,
    ownerUid: safeCallerUid,
    sourceType: "host_room",
    status: "approved",
    visibility,
    isPublicRoom: publicRoom,
    virtualOnly,
    isVirtualOnly: virtualOnly,
    sessionMode,
    updatedAt: now,
    updatedBy: safeCallerUid,
    createdAt: now,
    createdBy: safeCallerUid,
  };

  await Promise.all([
    admin.firestore().collection("room_sessions").doc(listingId).set(roomSessionDoc, { merge: true }),
    roomRef.set({
      discover: {
        listingId,
        publicRoom,
        visibility,
        virtualOnly,
        sessionMode,
        title,
        startsAtMs,
        updatedAt: now,
      },
      updatedAt: now,
    }, { merge: true }),
  ]);

  return {
    ok: true,
    listingId,
    roomCode: resolvedRoomCode,
    visibility,
    status: "approved",
    isPublicRoom: publicRoom,
    virtualOnly,
    sourceType: "host_room",
  };
};

exports.upsertHostRoomDiscoveryListing = onCall(
  { cors: true, secrets: [GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_SERVER_API_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "upsert_host_room_discovery_listing", { perMinute: 40, perHour: 320 });
    enforceAppCheckIfEnabled(request, "upsert_host_room_discovery_listing");
    const callerUid = requireAuth(request, "Sign in required.");
    const roomCode = normalizeRoomCode(request.data?.roomCode || "");
    if (!roomCode) {
      throw new HttpsError("invalid-argument", "roomCode is required.");
    }
    const listingInput = request.data?.listing && typeof request.data.listing === "object"
      ? request.data.listing
      : request.data || {};
    return upsertHostRoomDiscoveryListingInternal({
      callerUid,
      roomCode,
      listingInput,
    });
  }
);

exports.updateDirectoryListing = onCall(
  { cors: true, secrets: [GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_SERVER_API_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "update_directory_listing", { perMinute: 20, perHour: 180 });
    enforceAppCheckIfEnabled(request, "update_directory_listing");
    const uid = requireAuth(request);
    const listingType = requireDirectoryListingType(request.data?.listingType || "");
    const listingId = safeDirectoryString(request.data?.listingId || "", 220);
    if (!listingId) {
      throw new HttpsError("invalid-argument", "listingId is required.");
    }
    const updateScope = normalizeDirectoryToken(request.data?.updateScope || "listing", 40) || "listing";
    const enrichment = await maybeEnrichDirectoryLocation(request.data?.payload || {});
    const nextPayloadInput = enrichment.payload || request.data?.payload || {};
    const access = await getDirectoryModeratorAccess(uid);
    const collectionName = ensureDirectoryCollectionName(listingType);
    const db = admin.firestore();
    const listingRef = db.collection(collectionName).doc(listingId);
    const snap = await listingRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Listing not found.");
    }
    const existing = snap.data() || {};
    const ownerUid = safeDirectoryString(existing.ownerUid || "", 180);
    const hostUid = safeDirectoryString(existing.hostUid || "", 180);
    const isOwner = uid === ownerUid || uid === hostUid;
    const cadencePatch = buildDirectoryCadencePatch(listingType, nextPayloadInput);
    const hasCadencePatch = hasDirectoryCadencePatch(listingType, cadencePatch);

    if (access.isModerator) {
      let payload = null;
      const hasListingTitle = !!safeDirectoryString(nextPayloadInput?.title || nextPayloadInput?.name || "", 180);
      if (updateScope === "cadence" || !hasListingTitle) {
        if (!hasCadencePatch) {
          throw new HttpsError("invalid-argument", "Cadence update requires cadence fields.");
        }
        payload = buildDirectoryMergedUpdatePayload({
          listingType,
          existing,
          patch: cadencePatch,
          callerUid: uid,
        });
      } else {
        payload = normalizeDirectoryListingPayload(
          listingType,
          nextPayloadInput,
          uid
        );
      }
      const now = buildDirectoryNow();
      await listingRef.set({
        ...payload,
        listingType,
        status: normalizeDirectoryStatus(payload.status || existing.status || "approved", "approved"),
        ownerUid: ownerUid || payload.ownerUid || uid,
        updatedAt: now,
        updatedBy: uid,
      }, { merge: true });
      return { ok: true, mode: "direct_update", listingId };
    }

    if (!hasCadencePatch) {
      throw new HttpsError("invalid-argument", "Cadence update requires schedule fields.");
    }

    const mergedCadencePayload = buildDirectoryMergedUpdatePayload({
      listingType,
      existing,
      patch: cadencePatch,
      callerUid: ownerUid || hostUid || uid,
    });
    const now = buildDirectoryNow();

    if (isOwner) {
      await listingRef.set({
        ...mergedCadencePayload,
        listingType,
        status: normalizeDirectoryStatus(existing.status || mergedCadencePayload.status || "approved", "approved"),
        ownerUid: ownerUid || mergedCadencePayload.ownerUid || uid,
        updatedAt: now,
        updatedBy: uid,
        cadenceUpdatedAt: now,
        cadenceUpdatedBy: uid,
      }, { merge: true });
      return { ok: true, mode: "owner_direct_update", listingId, updateScope: "cadence" };
    }

    const submissionId = buildDirectorySubmissionId(listingType, uid);
    const providerHints = deriveDirectoryProviderHints(mergedCadencePayload);
    await db.collection("directory_submissions").doc(submissionId).set({
      submissionId,
      listingType,
      entityId: listingId,
      status: "pending",
      sourceType: "community_update",
      providers: providerHints,
      payload: {
        ...mergedCadencePayload,
        status: "pending",
      },
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      moderation: {
        action: "pending",
        notes: "",
        moderatedBy: null,
        moderatedAt: null,
      },
      enrichment: {
        geocoded: !!enrichment.enriched,
        provider: enrichment.provider || "",
        geocodedAtMs: enrichment.enriched ? Date.now() : 0,
      },
    }, { merge: true });
    return { ok: true, mode: "queued_for_review", submissionId, updateScope: "cadence" };
  }
);

exports.followDirectoryEntity = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "follow_directory_entity", { perMinute: 60, perHour: 500 });
  enforceAppCheckIfEnabled(request, "follow_directory_entity");
  const uid = requireAuth(request);
  const targetType = requireDirectoryEntityType(request.data?.targetType || "");
  const targetId = safeDirectoryString(request.data?.targetId || "", 220);
  if (!targetId) {
    throw new HttpsError("invalid-argument", "targetId is required.");
  }
  const docId = buildDirectoryFollowDocId(uid, targetType, targetId);
  const now = buildDirectoryNow();
  await admin.firestore().collection("follows").doc(docId).set({
    followerUid: uid,
    targetType,
    targetId,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  return { ok: true, followId: docId };
});

exports.unfollowDirectoryEntity = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "unfollow_directory_entity", { perMinute: 60, perHour: 500 });
  enforceAppCheckIfEnabled(request, "unfollow_directory_entity");
  const uid = requireAuth(request);
  const targetType = requireDirectoryEntityType(request.data?.targetType || "");
  const targetId = safeDirectoryString(request.data?.targetId || "", 220);
  if (!targetId) {
    throw new HttpsError("invalid-argument", "targetId is required.");
  }
  const docId = buildDirectoryFollowDocId(uid, targetType, targetId);
  await admin.firestore().collection("follows").doc(docId).delete().catch(() => {});
  return { ok: true, followId: docId };
});

exports.createDirectoryCheckin = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "create_directory_checkin", { perMinute: 40, perHour: 260 });
  enforceAppCheckIfEnabled(request, "create_directory_checkin");
  const uid = requireAuth(request);
  const targetType = requireDirectoryEntityType(request.data?.targetType || "");
  const targetId = safeDirectoryString(request.data?.targetId || "", 220);
  if (!targetId) {
    throw new HttpsError("invalid-argument", "targetId is required.");
  }
  const isPublic = !!request.data?.isPublic;
  const note = normalizeDirectoryTextBlock(request.data?.note || "", 280);
  const db = admin.firestore();
  const checkinRef = db.collection("checkins").doc();
  const totalsRef = db.collection("checkin_totals").doc(buildDirectoryCheckinTotalDocId(targetType, targetId));
  const now = buildDirectoryNow();

  await db.runTransaction(async (tx) => {
    tx.set(checkinRef, {
      checkinId: checkinRef.id,
      uid,
      targetType,
      targetId,
      isPublic,
      note,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    tx.set(totalsRef, {
      targetType,
      targetId,
      totalCount: admin.firestore.FieldValue.increment(1),
      publicCount: admin.firestore.FieldValue.increment(isPublic ? 1 : 0),
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
  });

  return {
    ok: true,
    checkinId: checkinRef.id,
    isPublic,
  };
});

exports.submitDirectoryReview = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "submit_directory_review", { perMinute: 25, perHour: 180 });
  enforceAppCheckIfEnabled(request, "submit_directory_review");
  const uid = requireAuth(request);
  const targetType = requireDirectoryEntityType(request.data?.targetType || "");
  const targetId = safeDirectoryString(request.data?.targetId || "", 220);
  if (!targetId) {
    throw new HttpsError("invalid-argument", "targetId is required.");
  }
  const eventId = safeDirectoryString(request.data?.eventId || "", 220);
  const ratingRaw = Number(request.data?.rating || 0);
  const rating = Math.round(ratingRaw);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new HttpsError("invalid-argument", "rating must be an integer between 1 and 5.");
  }
  const tags = normalizeDirectoryReviewTags(request.data?.tags || []);
  const text = normalizeDirectoryTextBlock(request.data?.text || "", 1800);
  const db = admin.firestore();
  const reviewId = buildDirectoryReviewDocId(uid, targetType, targetId, eventId);
  const reviewRef = db.collection("reviews").doc(reviewId);
  const totalsRef = db.collection("review_totals").doc(buildDirectoryCheckinTotalDocId(targetType, targetId));
  const now = buildDirectoryNow();

  await db.runTransaction(async (tx) => {
    const prevSnap = await tx.get(reviewRef);
    const prev = prevSnap.data() || {};
    const prevRating = Number(prev.rating || 0);
    const ratingDelta = rating - prevRating;
    const isNew = !prevSnap.exists;
    const prevTags = Array.isArray(prev.tags) ? prev.tags.map((tag) => normalizeDirectoryToken(tag, 40)).filter(Boolean) : [];
    const nextTags = tags;
    const totalsPatch = {
      targetType,
      targetId,
      ratingSum: admin.firestore.FieldValue.increment(ratingDelta),
      reviewCount: admin.firestore.FieldValue.increment(isNew ? 1 : 0),
      updatedAt: now,
      createdAt: now,
    };
    nextTags.forEach((tag) => {
      if (!prevTags.includes(tag)) {
        totalsPatch[`tagCounts.${tag}`] = admin.firestore.FieldValue.increment(1);
      }
    });
    prevTags.forEach((tag) => {
      if (!nextTags.includes(tag)) {
        totalsPatch[`tagCounts.${tag}`] = admin.firestore.FieldValue.increment(-1);
      }
    });

    tx.set(reviewRef, {
      reviewId,
      uid,
      targetType,
      targetId,
      eventId: eventId || null,
      rating,
      tags,
      text,
      visibility: "public",
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
    tx.set(totalsRef, totalsPatch, { merge: true });
  });

  return { ok: true, reviewId };
});

exports.listModerationQueue = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "list_moderation_queue", { perMinute: 40, perHour: 300 });
  enforceAppCheckIfEnabled(request, "list_moderation_queue");
  await requireDirectoryModerator(request, { deniedMessage: "Directory moderator role required." });
  const requestedStatus = normalizeDirectoryStatus(request.data?.status || "pending", "pending");
  const sourceType = normalizeDirectoryToken(request.data?.sourceType || "", 30);
  const entityType = normalizeDirectoryToken(request.data?.entityType || "", 30);
  const maxItems = clampNumber(request.data?.limit ?? 25, 1, 100, 25);
  let queueQuery = admin.firestore()
    .collection("directory_submissions")
    .orderBy("createdAt", "desc")
    .limit(maxItems);
  if (requestedStatus) {
    queueQuery = queueQuery.where("status", "==", requestedStatus);
  }
  if (sourceType) {
    queueQuery = queueQuery.where("sourceType", "==", sourceType);
  }
  if (entityType) {
    queueQuery = queueQuery.where("listingType", "==", entityType);
  }
  const snap = await queueQuery.get();
  const items = snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      submissionId: docSnap.id,
      listingType: data.listingType || "",
      status: data.status || "pending",
      sourceType: data.sourceType || "user",
      createdBy: data.createdBy || null,
      createdAtMs: valueToMillis(data.createdAt),
      updatedAtMs: valueToMillis(data.updatedAt),
      moderation: data.moderation || {},
      payload: data.payload || {},
      entityId: data.entityId || "",
      providers: Array.isArray(data.providers) ? data.providers : [],
    };
  });
  return {
    ok: true,
    count: items.length,
    items,
  };
});

exports.resolveModerationItem = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "resolve_moderation_item", { perMinute: 40, perHour: 220 });
  enforceAppCheckIfEnabled(request, "resolve_moderation_item");
  const { uid } = await requireDirectoryModerator(request, { deniedMessage: "Directory moderator role required." });
  const submissionId = safeDirectoryString(request.data?.submissionId || "", 240);
  if (!submissionId) {
    throw new HttpsError("invalid-argument", "submissionId is required.");
  }
  const action = normalizeDirectoryToken(request.data?.action || "", 20);
  if (!["approve", "reject"].includes(action)) {
    throw new HttpsError("invalid-argument", "action must be approve or reject.");
  }
  const notes = normalizeDirectoryTextBlock(request.data?.notes || "", 800);
  const db = admin.firestore();
  const submissionRef = db.collection("directory_submissions").doc(submissionId);
  const now = buildDirectoryNow();

  const outcome = await db.runTransaction(async (tx) => {
    const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists) {
      throw new HttpsError("not-found", "Submission not found.");
    }
    const submission = submissionSnap.data() || {};
    if (String(submission.status || "").toLowerCase() !== "pending") {
      return {
        mode: "already_resolved",
        status: submission.status || "unknown",
        entityId: submission.entityId || "",
      };
    }
    if (action === "reject") {
      tx.set(submissionRef, {
        status: "rejected",
        updatedAt: now,
        moderation: {
          action: "rejected",
          notes,
          moderatedBy: uid,
          moderatedAt: now,
        },
      }, { merge: true });
      return {
        mode: "rejected",
        status: "rejected",
        entityId: "",
      };
    }

    const listingType = requireDirectoryListingType(submission.listingType || "");
    const collectionName = ensureDirectoryCollectionName(listingType);
    const payload = normalizeDirectoryListingPayload(
      listingType,
      submission.payload || {},
      submission.createdBy || uid
    );
    const canonicalId = safeDirectoryString(submission.entityId || "", 220)
      || buildDirectoryCanonicalId(listingType, payload.title, payload.city, payload.state);
    const canonicalRef = db.collection(collectionName).doc(canonicalId);
    const canonicalSnap = await tx.get(canonicalRef);
    tx.set(canonicalRef, {
      ...payload,
      listingType,
      status: "approved",
      sourceType: payload.sourceType || submission.sourceType || "user",
      externalSources: buildDirectoryExternalLinks(payload),
      updatedAt: now,
      updatedBy: uid,
      approvedAt: now,
      approvedBy: uid,
      createdAt: canonicalSnap.exists ? canonicalSnap.data()?.createdAt || now : now,
    }, { merge: true });
    tx.set(submissionRef, {
      status: "approved",
      entityId: canonicalId,
      updatedAt: now,
      moderation: {
        action: "approved",
        notes,
        moderatedBy: uid,
        moderatedAt: now,
      },
    }, { merge: true });
    return {
      mode: "approved",
      status: "approved",
      entityId: canonicalId,
      listingType,
      collectionName,
    };
  });

  return { ok: true, ...outcome };
});

exports.runExternalDirectoryIngestion = onCall(
  { cors: true, secrets: [GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_SERVER_API_KEY, YELP_API_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "run_external_directory_ingestion", { perMinute: 10, perHour: 60 });
    enforceAppCheckIfEnabled(request, "run_external_directory_ingestion");
    const { uid } = await requireDirectoryModerator(request, { deniedMessage: "Directory moderator role required." });
    const dryRun = !!request.data?.dryRun;
    const providers = normalizeDirectoryProviders(request.data?.providers || []);
    const regions = normalizeDirectoryRegionList(request.data?.regions || []);
    const records = Array.isArray(request.data?.records) ? request.data.records : [];
    const result = await executeDirectoryIngestion({
      requestUid: uid,
      providers,
      regions,
      records,
      dryRun,
      trigger: "manual",
    });

    const jobId = `job_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!dryRun) {
      await admin.firestore().collection("directory_sync_jobs").doc(jobId).set({
        jobId,
        trigger: "manual",
        requestedBy: uid,
        providers: result.providers,
        regions: result.regions,
        dryRun: false,
        queued: result.queued,
        totalRecords: result.totalRecords,
        createdAt: buildDirectoryNow(),
      }, { merge: true });
    }
    return {
      ok: true,
      jobId,
      ...result,
    };
  }
);

exports.submitDirectoryClaimRequest = onCall({ cors: true }, async (request) => {
  if (!MARKETING_CLAIM_FLOW_ENABLED) {
    throw new HttpsError("failed-precondition", "Claim flow is disabled.");
  }
  checkRateLimit(request.rawRequest, "submit_directory_claim_request", { perMinute: 20, perHour: 160 });
  enforceAppCheckIfEnabled(request, "submit_directory_claim_request");
  const uid = requireAuth(request);
  const listingType = requireDirectoryClaimListingType(request.data?.listingType || "");
  const listingId = safeDirectoryString(request.data?.listingId || "", 220);
  if (!listingId) {
    throw new HttpsError("invalid-argument", "listingId is required.");
  }
  const role = normalizeDirectoryToken(request.data?.role || "owner", 40) || "owner";
  const evidenceInput = request.data?.evidence;
  const evidence = normalizeDirectoryTextBlock(
    typeof evidenceInput === "string"
      ? evidenceInput
      : JSON.stringify(evidenceInput || {}),
    3000
  );
  const claimId = buildDirectoryClaimDocId(uid, listingType, listingId);
  const now = buildDirectoryNow();
  await admin.firestore().collection("directory_claim_requests").doc(claimId).set({
    claimId,
    listingType,
    listingId,
    role,
    evidence,
    status: "pending",
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
    moderation: {
      action: "pending",
      notes: "",
      moderatedBy: null,
      moderatedAt: null,
    },
  }, { merge: true });
  return { ok: true, claimId, status: "pending" };
});

exports.resolveDirectoryClaimRequest = onCall({ cors: true }, async (request) => {
  if (!MARKETING_CLAIM_FLOW_ENABLED) {
    throw new HttpsError("failed-precondition", "Claim flow is disabled.");
  }
  checkRateLimit(request.rawRequest, "resolve_directory_claim_request", { perMinute: 30, perHour: 200 });
  enforceAppCheckIfEnabled(request, "resolve_directory_claim_request");
  const { uid } = await requireDirectoryModerator(request, { deniedMessage: "Directory moderator role required." });
  const claimId = safeDirectoryString(request.data?.claimId || "", 260);
  if (!claimId) {
    throw new HttpsError("invalid-argument", "claimId is required.");
  }
  const action = normalizeDirectoryToken(request.data?.action || "", 20);
  if (!["approve", "reject"].includes(action)) {
    throw new HttpsError("invalid-argument", "action must be approve or reject.");
  }
  const notes = normalizeDirectoryTextBlock(request.data?.notes || "", 800);
  const db = admin.firestore();
  const claimRef = db.collection("directory_claim_requests").doc(claimId);
  const now = buildDirectoryNow();

  const result = await db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) {
      throw new HttpsError("not-found", "Claim request not found.");
    }
    const claim = claimSnap.data() || {};
    const status = normalizeDirectoryToken(claim.status || "pending", 20);
    if (status !== "pending") {
      return {
        mode: "already_resolved",
        status,
      };
    }
    if (action === "reject") {
      tx.set(claimRef, {
        status: "rejected",
        updatedAt: now,
        moderation: {
          action: "rejected",
          notes,
          moderatedBy: uid,
          moderatedAt: now,
        },
      }, { merge: true });
      return {
        mode: "rejected",
        status: "rejected",
      };
    }

    const listingType = requireDirectoryClaimListingType(claim.listingType || "");
    const listingId = safeDirectoryString(claim.listingId || "", 220);
    if (!listingId) {
      throw new HttpsError("failed-precondition", "Claim request is missing listingId.");
    }
    const claimantUid = safeDirectoryString(claim.createdBy || "", 180);
    if (!claimantUid) {
      throw new HttpsError("failed-precondition", "Claim request is missing createdBy.");
    }
    const collectionName = ensureDirectoryClaimCollectionName(listingType);
    const listingRef = db.collection(collectionName).doc(listingId);
    const listingSnap = await tx.get(listingRef);
    if (!listingSnap.exists) {
      throw new HttpsError("not-found", "Listing for claim request was not found.");
    }
    const roleToken = normalizeDirectoryToken(claim.role || "owner", 40) || "owner";
    const listingPatch = {
      ownerUid: claimantUid,
      claimStatus: "verified",
      claimVerifiedAt: now,
      claimVerifiedBy: uid,
      updatedAt: now,
      updatedBy: uid,
    };
    if ((listingType === "event" || listingType === "room_session") && roleToken.includes("host")) {
      listingPatch.hostUid = claimantUid;
    }
    tx.set(listingRef, listingPatch, { merge: true });
    tx.set(claimRef, {
      status: "approved",
      updatedAt: now,
      moderation: {
        action: "approved",
        notes,
        moderatedBy: uid,
        moderatedAt: now,
      },
    }, { merge: true });
    return {
      mode: "approved",
      status: "approved",
      listingType,
      listingId,
      ownerUid: claimantUid,
    };
  });

  return { ok: true, claimId, ...result };
});

exports.setDirectoryRsvp = onCall({ cors: true }, async (request) => {
  if (!MARKETING_RSVP_ENABLED) {
    throw new HttpsError("failed-precondition", "RSVP flow is disabled.");
  }
  checkRateLimit(request.rawRequest, "set_directory_rsvp", { perMinute: 45, perHour: 320 });
  enforceAppCheckIfEnabled(request, "set_directory_rsvp");
  const uid = requireAuth(request);
  const targetType = requireDirectoryEntityType(request.data?.targetType || "");
  const targetId = safeDirectoryString(request.data?.targetId || "", 220);
  if (!targetId) {
    throw new HttpsError("invalid-argument", "targetId is required.");
  }
  const status = normalizeDirectoryRsvpStatus(request.data?.status || "going");
  const reminderChannels = normalizeDirectoryReminderChannels(request.data?.reminderChannels || []);
  const docId = buildDirectoryRsvpDocId(uid, targetType, targetId);
  const ref = admin.firestore().collection("directory_rsvps").doc(docId);

  if (status === "cancelled") {
    await ref.delete().catch(() => {});
    return { ok: true, docId, status: "cancelled", removed: true };
  }

  const now = buildDirectoryNow();
  await ref.set({
    docId,
    uid,
    targetType,
    targetId,
    status,
    reminderChannels,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  return { ok: true, docId, status, reminderChannels };
});

exports.setDirectoryReminderPreferences = onCall({ cors: true }, async (request) => {
  if (!MARKETING_RSVP_ENABLED) {
    throw new HttpsError("failed-precondition", "Reminders are disabled.");
  }
  checkRateLimit(request.rawRequest, "set_directory_reminder_preferences", { perMinute: 35, perHour: 260 });
  enforceAppCheckIfEnabled(request, "set_directory_reminder_preferences");
  const uid = requireAuth(request);
  const targetType = requireDirectoryEntityType(request.data?.targetType || "");
  const targetId = safeDirectoryString(request.data?.targetId || "", 220);
  if (!targetId) {
    throw new HttpsError("invalid-argument", "targetId is required.");
  }
  const emailOptIn = !!request.data?.emailOptIn;
  const smsOptIn = !!request.data?.smsOptIn;
  if (smsOptIn && !MARKETING_SMS_REMINDERS_ENABLED) {
    throw new HttpsError("failed-precondition", "SMS reminders are disabled.");
  }
  const phone = normalizeDirectoryPhone(request.data?.phone || "");
  if (smsOptIn && !phone) {
    throw new HttpsError("invalid-argument", "Valid phone is required for smsOptIn.");
  }

  const docId = buildDirectoryRsvpDocId(uid, targetType, targetId);
  const ref = admin.firestore().collection("directory_reminders").doc(docId);
  if (!emailOptIn && !smsOptIn) {
    await ref.delete().catch(() => {});
    return { ok: true, docId, removed: true };
  }
  const channels = [];
  if (emailOptIn) channels.push("email");
  if (smsOptIn) channels.push("sms");
  const now = buildDirectoryNow();
  await ref.set({
    docId,
    uid,
    targetType,
    targetId,
    emailOptIn,
    smsOptIn,
    phone: smsOptIn ? phone : "",
    channels,
    status: "active",
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  return {
    ok: true,
    docId,
    emailOptIn,
    smsOptIn,
    phone: smsOptIn ? phone : "",
    channels,
  };
});

exports.listDirectoryGeoLanding = onCall({ cors: true }, async (request) => {
  if (!MARKETING_GEO_PAGES_ENABLED) {
    throw new HttpsError("failed-precondition", "Geo pages are disabled.");
  }
  checkRateLimit(request.rawRequest, "list_directory_geo_landing", { perMinute: 80, perHour: 900 });
  const state = normalizeDirectoryToken(request.data?.state || "", 20);
  const city = normalizeDirectoryToken(request.data?.city || "", 80);
  const regionTokenInput = normalizeDirectoryToken(request.data?.regionToken || "", 80);
  const regionToken = regionTokenInput || (state && city ? `${state}_${city}` : "");
  const dateWindowDays = normalizeDirectoryDateWindowDays(request.data?.dateWindow || "14d");
  const nowMsValue = Date.now();
  const maxStartMs = nowMsValue + (dateWindowDays * 86400000);
  const db = admin.firestore();

  let venueQuery = db.collection("venues").where("status", "==", "approved").limit(180);
  let eventQuery = db.collection("karaoke_events").where("status", "==", "approved").limit(260);
  let sessionQuery = db.collection("room_sessions")
    .where("status", "==", "approved")
    .where("visibility", "==", "public")
    .limit(260);
  if (regionToken) {
    venueQuery = venueQuery.where("region", "==", regionToken);
    eventQuery = eventQuery.where("region", "==", regionToken);
    sessionQuery = sessionQuery.where("region", "==", regionToken);
  }

  const [venueSnap, eventSnap, sessionSnap, cacheSnap] = await Promise.all([
    venueQuery.get(),
    eventQuery.get(),
    sessionQuery.get(),
    db.collection("directory_geo_pages").doc(regionToken || "nationwide").get().catch(() => null),
  ]);

  const events = eventSnap.docs
    .map((docSnap) => buildDirectoryPublicListing(docSnap, "event"))
    .filter((item) => {
      const startsAtMs = Number(item.startsAtMs || 0);
      if (!startsAtMs) return true;
      return startsAtMs >= nowMsValue && startsAtMs <= maxStartMs;
    })
    .sort((a, b) => Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0));
  const sessions = sessionSnap.docs
    .map((docSnap) => buildDirectoryPublicListing(docSnap, "room_session"))
    .filter((item) => {
      const startsAtMs = Number(item.startsAtMs || 0);
      if (!startsAtMs) return true;
      return startsAtMs >= nowMsValue && startsAtMs <= maxStartMs;
    })
    .sort((a, b) => Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0));
  const venues = venueSnap.docs
    .map((docSnap) => buildDirectoryPublicListing(docSnap, "venue"))
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

  const cacheMeta = cacheSnap && cacheSnap.exists ? (cacheSnap.data() || {}) : null;
  return {
    ok: true,
    token: regionToken || "nationwide",
    state,
    city,
    dateWindowDays,
    generatedAtMs: nowMsValue,
    counts: {
      venues: venues.length,
      events: events.length,
      sessions: sessions.length,
      total: venues.length + events.length + sessions.length,
    },
    venues,
    events,
    sessions,
    cacheMeta: cacheMeta ? {
      token: safeDirectoryString(cacheMeta.token || "", 120),
      updatedAtMs: valueToMillis(cacheMeta.updatedAt),
      title: safeDirectoryString(cacheMeta.title || "", 180),
      description: normalizeDirectoryTextBlock(cacheMeta.description || "", 400),
    } : null,
  };
});

exports.listDirectoryDiscover = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "list_directory_discover", { perMinute: 90, perHour: 1000 });
  enforceAppCheckIfEnabled(request, "list_directory_discover");

  const regionToken = normalizeDirectoryToken(request.data?.region || request.data?.regionToken || "", 80);
  const searchToken = normalizeDirectoryTextBlock(request.data?.search || "", 120).toLowerCase();
  const listingTypeFilterRaw = normalizeDirectoryToken(request.data?.listingType || "all", 40);
  const listingTypeFilter = ["all", "venue", "event", "room_session"].includes(listingTypeFilterRaw)
    ? listingTypeFilterRaw
    : "all";
  const hostUidFilter = safeDirectoryString(request.data?.hostUid || "", 180);
  const officialRoomOnly = parseBooleanInput(request.data?.officialRoomOnly, false);
  const timeWindow = normalizeDirectoryDiscoverTimeWindow(request.data?.timeWindow || "all");
  const sortMode = normalizeDirectoryDiscoverSortMode(request.data?.sortMode || "smart");
  const cursor = normalizeDirectoryDiscoverCursor(request.data?.cursor || 0);
  const limit = clampNumber(request.data?.limit, 1, 120, DIRECTORY_DISCOVER_DEFAULT_LIMIT);
  const scanMultiplier = clampNumber(request.data?.scanMultiplier, 2, 6, 2);
  const scanLimit = clampNumber(limit * scanMultiplier, 48, 300, 120);
  const bounds = normalizeDirectoryDiscoverBounds(request.data?.bounds || null);
  const nowMs = Date.now();
  const db = admin.firestore();

  let venueQuery = db.collection("venues").where("status", "==", "approved").limit(scanLimit);
  let eventQuery = db.collection("karaoke_events")
    .where("status", "==", "approved")
    .limit(scanLimit);
  let sessionQuery = db.collection("room_sessions")
    .where("status", "==", "approved")
    .where("visibility", "==", "public")
    .limit(scanLimit);
  if (regionToken && regionToken !== "nationwide") {
    venueQuery = venueQuery.where("region", "==", regionToken);
    eventQuery = eventQuery.where("region", "==", regionToken);
    sessionQuery = sessionQuery.where("region", "==", regionToken);
  }

  const [venueSnap, eventSnap, sessionSnap] = await Promise.all([
    venueQuery.get(),
    eventQuery.get(),
    sessionQuery.get(),
  ]);

  const merged = [
    ...venueSnap.docs.map((docSnap) => buildDirectoryPublicListing(docSnap, "venue")),
    ...eventSnap.docs.map((docSnap) => buildDirectoryPublicListing(docSnap, "event")),
    ...sessionSnap.docs.map((docSnap) => buildDirectoryPublicListing(docSnap, "room_session")),
  ];

  const filtered = merged.filter((item) => {
    if (item.listingType !== "venue" && String(item.visibility || "public") !== "public") return false;
    if (listingTypeFilter !== "all" && item.listingType !== listingTypeFilter) return false;
    if (hostUidFilter && String(item.hostUid || "") !== hostUidFilter) return false;
    if (officialRoomOnly && !item.isOfficialBeauRocksRoom) return false;
    if (!matchesDirectoryDiscoverSearch(item, searchToken)) return false;
    if (!matchesDirectoryDiscoverTimeWindow(item, timeWindow, nowMs)) return false;
    if (bounds && !isDirectoryLocationInBounds(item.location, bounds)) return false;
    return true;
  });

  const typeRank = { event: 0, room_session: 1, venue: 2 };
  const sorted = filtered.slice().sort((a, b) => {
    const aStarts = Number(a.startsAtMs || 0);
    const bStarts = Number(b.startsAtMs || 0);
    if (sortMode === "title") {
      return String(a.title || "").localeCompare(String(b.title || ""));
    }
    if (sortMode === "recent") {
      if (aStarts !== bStarts) return bStarts - aStarts;
      return String(a.title || "").localeCompare(String(b.title || ""));
    }
    if (sortMode === "soonest") {
      if (aStarts > 0 && bStarts > 0 && aStarts !== bStarts) return aStarts - bStarts;
      if (aStarts > 0 && bStarts <= 0) return -1;
      if (aStarts <= 0 && bStarts > 0) return 1;
      return String(a.title || "").localeCompare(String(b.title || ""));
    }
    const aIsLive = aStarts > 0 && aStarts >= (nowMs - (2 * 60 * 60 * 1000)) && aStarts <= (nowMs + (8 * 60 * 60 * 1000));
    const bIsLive = bStarts > 0 && bStarts >= (nowMs - (2 * 60 * 60 * 1000)) && bStarts <= (nowMs + (8 * 60 * 60 * 1000));
    if (aIsLive !== bIsLive) return aIsLive ? -1 : 1;
    if ((typeRank[a.listingType] ?? 99) !== (typeRank[b.listingType] ?? 99)) {
      return (typeRank[a.listingType] ?? 99) - (typeRank[b.listingType] ?? 99);
    }
    if (aStarts > 0 && bStarts > 0 && aStarts !== bStarts) return aStarts - bStarts;
    if (aStarts > 0 && bStarts <= 0) return -1;
    if (aStarts <= 0 && bStarts > 0) return 1;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });

  const hostUidsForMeta = listDirectoryDiscoverHostUids(sorted);
  const venueIdsForMeta = listDirectoryDiscoverVenueIds(sorted);
  let hostInsights = { byHostUid: new Map(), rankByHostUid: new Map(), sampleSize: 0 };
  let hostAccountMetaByUid = new Map();
  let venueMetaById = new Map();
  let venueRankById = new Map();
  try {
    [
      hostInsights,
      hostAccountMetaByUid,
      venueMetaById,
    ] = await Promise.all([
      fetchDirectoryDiscoverHostInsights(),
      fetchDirectoryDiscoverHostAccountMeta(db, hostUidsForMeta),
      fetchDirectoryDiscoverVenueEngagementMeta(db, venueIdsForMeta),
    ]);
    venueRankById = rankDirectoryDiscoverVenues(venueMetaById);
  } catch (error) {
    console.warn("[directory/discover] metadata enrichment failed", String(error?.message || error || ""));
    hostInsights = { byHostUid: new Map(), rankByHostUid: new Map(), sampleSize: 0 };
    hostAccountMetaByUid = new Map();
    venueMetaById = new Map();
    venueRankById = new Map();
  }

  const enrichedSorted = sorted.map((item) => {
    const hostUid = safeDirectoryString(item.hostUid || item.ownerUid || "", 180);
    const venueId = getDirectoryDiscoverVenueId(item);
    const hostInsightsMeta = hostUid ? (hostInsights.byHostUid.get(hostUid) || null) : null;
    const hostAccountMeta = hostUid ? (hostAccountMetaByUid.get(hostUid) || null) : null;
    const venueMeta = venueId ? (venueMetaById.get(venueId) || null) : null;
    const hostLeaderboardRank = hostUid
      ? Math.max(0, Number(hostInsights.rankByHostUid.get(hostUid) || 0) || 0)
      : 0;
    const venueLeaderboardRank = venueId
      ? Math.max(0, Number(venueRankById.get(venueId) || 0) || 0)
      : 0;
    const hostTier = normalizeDirectoryToken(hostAccountMeta?.tier || "", 40);
    const hasBeauRocksHostAccount = !!hostAccountMeta?.hasAccount && (
      !!hostAccountMeta?.hasHostRole || !!hostAccountMeta?.hasHostPlan
    );
    const beauRocksElevatedReasons = [];
    if (item.isOfficialBeauRocksRoom) beauRocksElevatedReasons.push("official_room");
    if (hasBeauRocksHostAccount) beauRocksElevatedReasons.push("host_account");
    if (hostAccountMeta?.hasHostPlan) beauRocksElevatedReasons.push("host_plan");
    if (hostLeaderboardRank > 0 && hostLeaderboardRank <= 25) beauRocksElevatedReasons.push("host_leaderboard");
    if (venueLeaderboardRank > 0 && venueLeaderboardRank <= 25) beauRocksElevatedReasons.push("venue_leaderboard");
    const isBeauRocksElevated = beauRocksElevatedReasons.length > 0;
    return {
      ...item,
      hasBeauRocksHostAccount,
      hasBeauRocksHostRole: !!hostAccountMeta?.hasHostRole,
      hasBeauRocksHostPlan: !!hostAccountMeta?.hasHostPlan,
      beauRocksHostTier: hostTier,
      hostLeaderboardRank,
      hostLeaderboardScore: Math.max(0, Number(hostInsightsMeta?.score || 0) || 0),
      hostHostedRooms: Math.max(0, Number(hostInsightsMeta?.hostedRooms || 0) || 0),
      hostRecapCount: Math.max(0, Number(hostInsightsMeta?.recapCount || 0) || 0),
      hostTotalSongs: Math.max(0, Number(hostInsightsMeta?.totalSongs || 0) || 0),
      hostTotalUsers: Math.max(0, Number(hostInsightsMeta?.totalUsers || 0) || 0),
      venueLeaderboardRank,
      venueLeaderboardScore: Math.max(0, Number(venueMeta?.leaderboardScore || 0) || 0),
      venueAverageRating: Math.max(0, Number(venueMeta?.averageRating || 0) || 0),
      venueReviewCount: Math.max(0, Number(venueMeta?.reviewCount || 0) || 0),
      venueCheckinCount: Math.max(0, Number(venueMeta?.checkinCount || 0) || 0),
      isBeauRocksElevated,
      beauRocksElevatedReasons,
    };
  });

  const hostFacetsMap = new Map();
  const regionFacetsMap = new Map();
  const counts = {
    venue: 0,
    event: 0,
    room_session: 0,
    officialBeauRocksRooms: 0,
    beaurocksElevated: 0,
  };
  enrichedSorted.forEach((item) => {
    if (item.listingType === "event") counts.event += 1;
    else if (item.listingType === "room_session") counts.room_session += 1;
    else counts.venue += 1;
    if (item.isOfficialBeauRocksRoom) counts.officialBeauRocksRooms += 1;
    if (item.isBeauRocksElevated) counts.beaurocksElevated += 1;

    const hostUid = safeDirectoryString(item.hostUid || item.ownerUid || "", 180);
    if (hostUid) {
      const existing = hostFacetsMap.get(hostUid) || {
        hostUid,
        hostName: String(item.hostName || "").trim() || "Host",
        count: 0,
      };
      existing.count += 1;
      hostFacetsMap.set(hostUid, existing);
    }

    const token = String(item.region || "").trim().toLowerCase();
    if (token) {
      regionFacetsMap.set(token, (regionFacetsMap.get(token) || 0) + 1);
    }
  });

  const total = enrichedSorted.length;
  const pageItems = enrichedSorted.slice(cursor, cursor + limit);
  const nextCursor = cursor + pageItems.length < total ? String(cursor + pageItems.length) : "";
  const hostFacets = Array.from(hostFacetsMap.values())
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return String(a.hostName || "").localeCompare(String(b.hostName || ""));
    })
    .slice(0, 24);
  const regionFacets = Array.from(regionFacetsMap.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  return {
    ok: true,
    generatedAtMs: nowMs,
    total,
    cursor: String(cursor),
    nextCursor,
    limit,
    items: pageItems,
    facets: {
      host: hostFacets,
      region: regionFacets,
      counts: {
        venue: counts.venue,
        event: counts.event,
        room_session: counts.room_session,
        officialBeauRocksRooms: counts.officialBeauRocksRooms,
        beaurocksElevated: counts.beaurocksElevated,
        total,
      },
    },
    scan: {
      scanLimit,
      venues: venueSnap.size,
      events: eventSnap.size,
      sessions: sessionSnap.size,
      hostInsightsSample: Math.max(0, Number(hostInsights.sampleSize || 0) || 0),
    },
  };
});

exports.recordMarketingTelemetry = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "record_marketing_telemetry", { perMinute: 220, perHour: 3000 });
  enforceAppCheckIfEnabled(request, "record_marketing_telemetry");

  const rawEvents = Array.isArray(request.data?.events)
    ? request.data.events
    : (request.data?.event ? [request.data.event] : []);
  if (!rawEvents.length) {
    throw new HttpsError("invalid-argument", "events is required.");
  }

  const sessionId = normalizeDirectoryToken(request.data?.sessionId || "", 120);
  const routePage = normalizeDirectoryToken(request.data?.routePage || "", 80);
  const maxItems = Math.min(MARKETING_REPORTING_MAX_BATCH, rawEvents.length);
  const normalizedEvents = rawEvents
    .slice(0, maxItems)
    .map((entry) => normalizeMarketingTelemetryEvent(entry, { sessionId, routePage, atMs: Date.now() }))
    .filter(Boolean);
  if (!normalizedEvents.length) {
    return { ok: true, accepted: 0, ignored: rawEvents.length };
  }

  const dayKey = buildUtcDayKey(Date.now());
  const docId = `d_${dayKey}`;
  const ref = admin.firestore().collection("marketing_reporting_daily").doc(docId);
  const patch = {
    dayKey,
    updatedAt: buildDirectoryNow(),
  };
  incrementPatchField(patch, "totalEvents", normalizedEvents.length);

  normalizedEvents.forEach((entry) => {
    incrementPatchField(patch, `events.${entry.name}`, 1);
    if (entry.routePage) {
      incrementPatchField(patch, `routePages.${entry.routePage}`, 1);
    }
    const workstream = MARKETING_REPORTING_WORKSTREAMS.has(entry.workstream)
      ? entry.workstream
      : "core";
    incrementPatchField(patch, `workstreams.${workstream}.events`, 1);
    if (entry.goldenPathId) {
      incrementPatchField(patch, "goldenPathEvents", 1);
      incrementPatchField(patch, `goldenPaths.${entry.goldenPathId}`, 1);
      incrementPatchField(patch, `workstreams.${workstream}.goldenPathEvents`, 1);
      if (entry.goldenPathSignalType === "entry") {
        incrementPatchField(patch, "goldenPathEntries", 1);
        incrementPatchField(patch, `workstreams.${workstream}.entries`, 1);
      }
      if (entry.goldenPathSignalType === "milestone") {
        incrementPatchField(patch, "goldenPathMilestones", 1);
        incrementPatchField(patch, `workstreams.${workstream}.milestones`, 1);
      }
    }
  });

  await ref.set(patch, { merge: true });
  return {
    ok: true,
    accepted: normalizedEvents.length,
    ignored: Math.max(0, rawEvents.length - normalizedEvents.length),
    dayKey,
  };
});

exports.getMarketingReportingSummary = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "get_marketing_reporting_summary", { perMinute: 40, perHour: 400 });
  enforceAppCheckIfEnabled(request, "get_marketing_reporting_summary");
  await requireDirectoryModerator(request, { deniedMessage: "Directory moderator role required." });
  const windowDays = clampNumber(request.data?.windowDays ?? 30, 1, 90, 30);
  const now = Date.now();
  const endDayKey = buildUtcDayKey(now);
  const startMs = now - ((windowDays - 1) * 24 * 60 * 60 * 1000);
  const startDayKey = buildUtcDayKey(startMs);

  const snap = await admin.firestore()
    .collection("marketing_reporting_daily")
    .where("dayKey", ">=", startDayKey)
    .where("dayKey", "<=", endDayKey)
    .orderBy("dayKey", "asc")
    .limit(120)
    .get();

  const report = reduceMarketingReportData(snap.docs, windowDays);
  return {
    ok: true,
    ...report,
    startDayKey,
    endDayKey,
    dayCount: snap.size,
    generatedAtMs: now,
  };
});

exports.previewDirectoryRoomSessionByCode = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "preview_directory_room_session_by_code", { perMinute: 80, perHour: 700 });
  const roomCode = normalizeRoomCode(request.data?.roomCode || "");
  if (!roomCode) {
    throw new HttpsError("invalid-argument", "roomCode is required.");
  }
  const db = admin.firestore();
  const snap = await db.collection("room_sessions").where("roomCode", "==", roomCode).limit(8).get();
  if (snap.empty) {
    throw new HttpsError("not-found", "Room code not found.");
  }
  const approved = snap.docs
    .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
    .filter((entry) => normalizeDirectoryStatus(entry.status || "pending", "pending") === "approved")
    .sort((a, b) => Number(b.startsAtMs || 0) - Number(a.startsAtMs || 0));
  if (!approved.length) {
    throw new HttpsError("not-found", "Room code not found.");
  }
  const top = approved[0] || {};
  return {
    ok: true,
    roomCode,
    session: {
      id: safeDirectoryString(top.id || "", 220),
      title: safeDirectoryString(top.title || "", 180),
      description: normalizeDirectoryTextBlock(top.description || "", 400),
      startsAtMs: Number(top.startsAtMs || 0) || 0,
      endsAtMs: Number(top.endsAtMs || 0) || 0,
      hostUid: safeDirectoryString(top.hostUid || "", 180),
      hostName: safeDirectoryString(top.hostName || "", 180),
      venueId: safeDirectoryString(top.venueId || "", 220),
      venueName: safeDirectoryString(top.venueName || "", 220),
      visibility: normalizeDirectoryVisibility(top.visibility || "private", "private"),
    },
  };
});

exports.mergeAnonymousAccountData = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "merge_anonymous_account_data", { perMinute: 12, perHour: 60 });
  enforceAppCheckIfEnabled(request, "merge_anonymous_account_data");
  const callerUid = requireAuth(request);
  const sourceUid = safeDirectoryString(request.data?.sourceUid || "", 180);
  const targetUid = safeDirectoryString(request.data?.targetUid || callerUid, 180);
  if (!sourceUid) {
    throw new HttpsError("invalid-argument", "sourceUid is required.");
  }
  if (targetUid !== callerUid) {
    throw new HttpsError("permission-denied", "targetUid must match caller.");
  }
  if (sourceUid === targetUid) {
    return { ok: true, merged: false, reason: "same_uid" };
  }
  const db = admin.firestore();
  const now = buildDirectoryNow();
  const result = await db.runTransaction(async (tx) => {
    const sourceUserRef = db.collection("users").doc(sourceUid);
    const targetUserRef = db.collection("users").doc(targetUid);
    const sourceProfileRef = db.collection("directory_profiles").doc(sourceUid);
    const targetProfileRef = db.collection("directory_profiles").doc(targetUid);
    const [sourceUserSnap, targetUserSnap, sourceProfileSnap, targetProfileSnap] = await Promise.all([
      tx.get(sourceUserRef),
      tx.get(targetUserRef),
      tx.get(sourceProfileRef),
      tx.get(targetProfileRef),
    ]);
    if (!sourceUserSnap.exists) {
      return { merged: false, reason: "source_missing" };
    }
    const sourceUser = sourceUserSnap.data() || {};
    const targetUser = targetUserSnap.data() || {};
    const mergeArray = (a, b, limit = 200) => {
      const seen = new Set();
      const output = [];
      [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach((entry) => {
        const key = JSON.stringify(entry);
        if (seen.has(key)) return;
        seen.add(key);
        output.push(entry);
      });
      return output.slice(0, limit);
    };
    tx.set(targetUserRef, {
      name: safeDirectoryString(targetUser.name || sourceUser.name || "", 120),
      avatar: safeDirectoryString(targetUser.avatar || sourceUser.avatar || "", 16),
      tight15: mergeArray(targetUser.tight15, sourceUser.tight15, 30),
      unlockedEmojis: mergeArray(targetUser.unlockedEmojis, sourceUser.unlockedEmojis, 200),
      unlockedBadges: mergeArray(targetUser.unlockedBadges, sourceUser.unlockedBadges, 200),
      totalFamePoints: Math.max(Number(targetUser.totalFamePoints || 0), Number(sourceUser.totalFamePoints || 0)),
      currentLevel: Math.max(Number(targetUser.currentLevel || 0), Number(sourceUser.currentLevel || 0)),
      vipLevel: Math.max(Number(targetUser.vipLevel || 0), Number(sourceUser.vipLevel || 0)),
      mergedFromUids: admin.firestore.FieldValue.arrayUnion(sourceUid),
      updatedAt: now,
    }, { merge: true });
    tx.set(sourceUserRef, {
      mergedIntoUid: targetUid,
      mergedAt: now,
      accountStatus: "merged",
    }, { merge: true });

    if (sourceProfileSnap.exists || targetProfileSnap.exists) {
      const sourceProfile = sourceProfileSnap.data() || {};
      const targetProfile = targetProfileSnap.data() || {};
      tx.set(targetProfileRef, {
        uid: targetUid,
        displayName: safeDirectoryString(targetProfile.displayName || sourceProfile.displayName || targetUser.name || sourceUser.name || "BeauRocks User", 120),
        handle: normalizeDirectoryToken(targetProfile.handle || sourceProfile.handle || targetUid, 40),
        bio: normalizeDirectoryTextBlock(targetProfile.bio || sourceProfile.bio || "", 500),
        roles: normalizeDirectoryRoles([...(Array.isArray(targetProfile.roles) ? targetProfile.roles : []), ...(Array.isArray(sourceProfile.roles) ? sourceProfile.roles : [])]),
        city: safeDirectoryString(targetProfile.city || sourceProfile.city || "", 80),
        state: safeDirectoryString(targetProfile.state || sourceProfile.state || "", 40),
        country: safeDirectoryString(targetProfile.country || sourceProfile.country || DIRECTORY_DEFAULT_COUNTRY, 2).toUpperCase(),
        avatarUrl: normalizeDirectoryOptionalUrl(targetProfile.avatarUrl || sourceProfile.avatarUrl || ""),
        visibility: normalizeDirectoryVisibility(targetProfile.visibility || sourceProfile.visibility || "public", "public"),
        updatedAt: now,
        createdAt: now,
      }, { merge: true });
      tx.set(sourceProfileRef, {
        mergedIntoUid: targetUid,
        mergedAt: now,
        visibility: "private",
      }, { merge: true });
    }

    return { merged: true, reason: "ok" };
  });

  return { ok: true, ...result, sourceUid, targetUid };
});

exports.nightlyDirectorySync = onSchedule(
  {
    schedule: "15 3 * * *",
    timeZone: "America/Los_Angeles",
    secrets: [GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_SERVER_API_KEY, YELP_API_KEY],
  },
  async () => {
    const db = admin.firestore();
    const enabledSnap = await db
      .collection("directory_regions")
      .where("enabled", "==", true)
      .limit(30)
      .get();
    const regions = enabledSnap.docs.map((docSnap) => normalizeDirectoryToken(docSnap.id, 80)).filter(Boolean);
    if (!regions.length) {
      await db.collection("directory_sync_jobs").doc(`job_nightly_${Date.now()}_empty`).set({
        trigger: "nightly",
        providers: ["google", "yelp"],
        regions: [],
        queued: 0,
        totalRecords: 0,
        status: "skipped_no_regions",
        createdAt: buildDirectoryNow(),
      }, { merge: true });
      return;
    }
    const result = await executeDirectoryIngestion({
      requestUid: "system_nightly",
      providers: ["google", "yelp"],
      regions,
      records: [],
      dryRun: false,
      trigger: "nightly",
    });
    const jobId = `job_nightly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.collection("directory_sync_jobs").doc(jobId).set({
      jobId,
      trigger: "nightly",
      requestedBy: "system",
      providers: result.providers,
      regions: result.regions,
      dryRun: false,
      queued: result.queued,
      totalRecords: result.totalRecords,
      status: "completed",
      createdAt: buildDirectoryNow(),
    }, { merge: true });
  }
);

const dispatchDirectoryReminderHook = async ({ channel = "", payload = {} }) => {
  const token = normalizeDirectoryToken(channel, 20);
  const url = token === "sms"
    ? String(REMINDER_SMS_WEBHOOK_URL.value() || "").trim()
    : String(REMINDER_EMAIL_WEBHOOK_URL.value() || "").trim();
  if (!url) {
    return {
      sent: false,
      status: "provider_not_configured",
      httpStatus: 0,
      responseText: "",
      url: "",
    };
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });
    const text = await response.text().catch(() => "");
    if (!response.ok) {
      return {
        sent: false,
        status: "provider_error",
        httpStatus: Number(response.status || 0),
        responseText: text.slice(0, 600),
        url,
      };
    }
    return {
      sent: true,
      status: "sent",
      httpStatus: Number(response.status || 0),
      responseText: text.slice(0, 600),
      url,
    };
  } catch (error) {
    return {
      sent: false,
      status: "provider_error",
      httpStatus: 0,
      responseText: safeDirectoryString(error?.message || "dispatch failed", 600),
      url,
    };
  }
};

exports.dispatchDirectoryReminders = onSchedule(
  {
    schedule: "*/10 * * * *",
    timeZone: "UTC",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [REMINDER_EMAIL_WEBHOOK_URL, REMINDER_SMS_WEBHOOK_URL],
  },
  async () => {
    if (!MARKETING_RSVP_ENABLED) return;
    const db = admin.firestore();
    const nowMsValue = Date.now();
    const jobId = `reminder_job_${nowMsValue}_${Math.random().toString(36).slice(2, 8)}`;
    const remindersSnap = await db
      .collection("directory_reminders")
      .where("status", "==", "active")
      .limit(DIRECTORY_REMINDER_MAX_BATCH)
      .get();

    const counters = {
      remindersScanned: remindersSnap.size,
      channelsAttempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      providerNotConfigured: 0,
    };

    for (const reminderDoc of remindersSnap.docs) {
      const reminder = reminderDoc.data() || {};
      const uid = safeDirectoryString(reminder.uid || "", 180);
      const targetType = normalizeDirectoryToken(reminder.targetType || "", 30);
      const targetId = safeDirectoryString(reminder.targetId || "", 220);
      if (!uid || !targetType || !targetId) {
        counters.skipped += 1;
        continue;
      }
      let targetCollection = "";
      try {
        targetCollection = ensureDirectoryReminderTargetCollection(targetType);
      } catch {
        counters.skipped += 1;
        continue;
      }
      const rsvpDocId = buildDirectoryRsvpDocId(uid, targetType, targetId);
      const rsvpRef = db.collection("directory_rsvps").doc(rsvpDocId);
      const targetRef = db.collection(targetCollection).doc(targetId);
      const [rsvpSnap, targetSnap] = await Promise.all([rsvpRef.get(), targetRef.get()]);
      if (!rsvpSnap.exists || !targetSnap.exists) {
        counters.skipped += 1;
        continue;
      }
      const rsvp = rsvpSnap.data() || {};
      const rsvpStatus = normalizeDirectoryToken(rsvp.status || "", 20);
      if (!DIRECTORY_REMINDER_ELIGIBLE_STATUSES.has(rsvpStatus)) {
        counters.skipped += 1;
        continue;
      }
      const target = targetSnap.data() || {};
      const startsAtMs = Number(target.startsAtMs || 0);
      if (!Number.isFinite(startsAtMs) || startsAtMs <= nowMsValue) {
        counters.skipped += 1;
        continue;
      }
      const slot = pickDirectoryReminderSlot(startsAtMs - nowMsValue);
      if (!slot) {
        counters.skipped += 1;
        continue;
      }
      const channels = normalizeDirectoryReminderChannels(
        reminder.channels
          || [
            ...(reminder.emailOptIn ? ["email"] : []),
            ...(reminder.smsOptIn ? ["sms"] : []),
          ]
      );
      if (!channels.length) {
        counters.skipped += 1;
        continue;
      }
      for (const channel of channels) {
        if (channel === "sms" && !MARKETING_SMS_REMINDERS_ENABLED) {
          counters.skipped += 1;
          continue;
        }
        const dispatchId = buildDirectoryReminderDispatchId(reminderDoc.id, slot.id, channel);
        const dispatchRef = db.collection("directory_reminder_dispatch").doc(dispatchId);
        const dispatchSnap = await dispatchRef.get();
        if (dispatchSnap.exists) {
          counters.skipped += 1;
          continue;
        }
        counters.channelsAttempted += 1;
        const payload = {
          reminderId: reminderDoc.id,
          uid,
          channel,
          slotId: slot.id,
          targetType,
          targetId,
          startsAtMs,
          title: safeDirectoryString(target.title || "", 180),
          venueName: safeDirectoryString(target.venueName || "", 180),
          hostName: safeDirectoryString(target.hostName || "", 180),
          roomCode: safeDirectoryString(target.roomCode || "", 40),
          phone: channel === "sms" ? normalizeDirectoryPhone(reminder.phone || "") : "",
          requestedAtMs: nowMsValue,
        };
        const hookResult = await dispatchDirectoryReminderHook({ channel, payload });
        if (hookResult.sent) counters.sent += 1;
        else if (hookResult.status === "provider_not_configured") counters.providerNotConfigured += 1;
        else counters.failed += 1;
        await dispatchRef.set({
          dispatchId,
          reminderId: reminderDoc.id,
          uid,
          channel,
          slotId: slot.id,
          targetType,
          targetId,
          startsAtMs,
          status: hookResult.status,
          sent: hookResult.sent,
          providerUrl: hookResult.url || "",
          providerHttpStatus: hookResult.httpStatus || 0,
          providerResponse: hookResult.responseText || "",
          jobId,
          createdAt: buildDirectoryNow(),
        }, { merge: true });
        await reminderDoc.ref.set({
          lastDispatchAt: buildDirectoryNow(),
          lastDispatchSlot: slot.id,
          updatedAt: buildDirectoryNow(),
        }, { merge: true });
      }
    }

    await db.collection("directory_reminder_jobs").doc(jobId).set({
      jobId,
      status: "completed",
      counters,
      createdAt: buildDirectoryNow(),
      scheduledAtMs: nowMsValue,
    }, { merge: true });
  }
);

exports.ensureOrganization = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "ensure_organization", { perMinute: 20, perHour: 200 });
  const uid = requireAuth(request);
  enforceAppCheckIfEnabled(request, "ensure_organization");
  const orgName = typeof request.data?.orgName === "string" ? request.data.orgName : "";
  const ensured = await ensureOrganizationForUser({ uid, orgName });
  const entitlements = await resolveUserEntitlements(uid);
  return {
    orgId: ensured.orgId,
    role: ensured.role,
    planId: entitlements.planId,
    status: entitlements.status,
    provider: entitlements.provider,
    renewalAtMs: entitlements.renewalAtMs,
    cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
    capabilities: entitlements.capabilities,
  };
});

exports.bootstrapOnboardingWorkspace = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "bootstrap_onboarding_workspace", { perMinute: 20, perHour: 200 });
  const { uid } = await requireCapability(request, "workspace.onboarding");
  enforceAppCheckIfEnabled(request, "bootstrap_onboarding_workspace");
  const orgName = typeof request.data?.orgName === "string" ? request.data.orgName : "";
  const hostName = normalizeOptionalName(request.data?.hostName, "Host");
  const logoUrl = typeof request.data?.logoUrl === "string"
    ? request.data.logoUrl.trim().slice(0, 2048)
    : "";
  const planPreference = getPlanDefinition(request.data?.planId || "")
    ? request.data.planId
    : null;
  const ensured = await ensureOrganizationForUser({ uid, orgName });
  const orgRef = orgsCollection().doc(ensured.orgId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await orgRef.set({
    name: normalizeOrgName(orgName, uid),
    onboardingDefaults: {
      hostName,
      logoUrl: logoUrl || null,
      planPreference,
    },
    onboarding: {
      initializedAt: now,
      initializedBy: uid,
      updatedAt: now,
      updatedBy: uid,
    },
    updatedAt: now,
  }, { merge: true });
  const entitlements = await resolveUserEntitlements(uid);
  return {
    ok: true,
    orgId: ensured.orgId,
    role: ensured.role,
    entitlements,
  };
});

exports.getMyEntitlements = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "get_my_entitlements", { perMinute: 30, perHour: 300 });
  const uid = requireAuth(request);
  enforceAppCheckIfEnabled(request, "get_my_entitlements");
  const entitlements = await resolveUserEntitlements(uid);
  return entitlements;
});

exports.getMyUsageSummary = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "get_my_usage_summary", { perMinute: 30, perHour: 300 });
  const uid = requireAuth(request);
  enforceAppCheckIfEnabled(request, "get_my_usage_summary");
  const requestedPeriod = normalizeUsagePeriodKey(request.data?.period || "");
  if (!requestedPeriod) {
    throw new HttpsError("invalid-argument", "period must be in YYYYMM format.");
  }
  const entitlements = await resolveUserEntitlements(uid);
  const summary = await readOrganizationUsageSummary({
    orgId: entitlements.orgId,
    entitlements,
    periodKey: requestedPeriod,
  });
  return summary;
});

exports.getMyUsageInvoiceDraft = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "get_my_usage_invoice_draft", { perMinute: 20, perHour: 180 });
  const { entitlements } = await requireCapability(request, "billing.invoice_drafts");
  enforceAppCheckIfEnabled(request, "get_my_usage_invoice_draft");
  const requestedPeriod = normalizeUsagePeriodKey(request.data?.period || "");
  if (!requestedPeriod) {
    throw new HttpsError("invalid-argument", "period must be in YYYYMM format.");
  }
  const includeBasePlan = !!request.data?.includeBasePlan;
  const taxRatePercent = clampNumber(request.data?.taxRatePercent ?? 0, 0, 100, 0);
  const customerName = typeof request.data?.customerName === "string"
    ? request.data.customerName.trim().slice(0, 160)
    : "";
  const role = String(entitlements?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Only organization owners/admins can generate invoice drafts.");
  }
  const orgId = entitlements?.orgId || "";
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Organization is not initialized.");
  }
  const orgSnap = await orgsCollection().doc(orgId).get();
  const orgName = String(orgSnap.data()?.name || "").trim() || orgId;
  const usageSummary = await readOrganizationUsageSummary({
    orgId,
    entitlements,
    periodKey: requestedPeriod,
  });
  const invoice = buildUsageInvoiceDraft({
    orgId,
    orgName,
    entitlements,
    usageSummary,
    periodKey: requestedPeriod,
    includeBasePlan,
    taxRatePercent,
    customerName,
  });
  return invoice;
});

exports.saveMyUsageInvoiceDraft = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "save_my_usage_invoice_draft", { perMinute: 20, perHour: 180 });
  const { uid, entitlements } = await requireCapability(request, "billing.invoice_drafts");
  enforceAppCheckIfEnabled(request, "save_my_usage_invoice_draft");
  const requestedPeriod = normalizeUsagePeriodKey(request.data?.period || "");
  if (!requestedPeriod) {
    throw new HttpsError("invalid-argument", "period must be in YYYYMM format.");
  }
  const includeBasePlan = !!request.data?.includeBasePlan;
  const taxRatePercent = clampNumber(request.data?.taxRatePercent ?? 0, 0, 100, 0);
  const customerName = typeof request.data?.customerName === "string"
    ? request.data.customerName.trim().slice(0, 160)
    : "";
  const status = sanitizeInvoiceStatus(request.data?.status || "draft");
  const notes = typeof request.data?.notes === "string"
    ? request.data.notes.trim().slice(0, 5000)
    : "";

  const role = String(entitlements?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Only organization owners/admins can save invoice drafts.");
  }
  const orgId = entitlements?.orgId || "";
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Organization is not initialized.");
  }
  const orgRef = orgsCollection().doc(orgId);
  const orgSnap = await orgRef.get();
  const orgName = String(orgSnap.data()?.name || "").trim() || orgId;
  const usageSummary = await readOrganizationUsageSummary({
    orgId,
    entitlements,
    periodKey: requestedPeriod,
  });
  const invoiceDraft = buildUsageInvoiceDraft({
    orgId,
    orgName,
    entitlements,
    usageSummary,
    periodKey: requestedPeriod,
    includeBasePlan,
    taxRatePercent,
    customerName,
  });

  const invoicesRef = orgRef.collection("invoices");
  const docRef = invoicesRef.doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await docRef.set({
    orgId,
    orgName,
    period: invoiceDraft.period,
    invoiceId: invoiceDraft.invoiceId,
    status,
    notes,
    createdBy: uid,
    updatedBy: uid,
    customerName: invoiceDraft.customerName || "",
    includeBasePlan: !!includeBasePlan,
    taxRatePercent: Number(taxRatePercent || 0),
    lineItemCount: Array.isArray(invoiceDraft.lineItems) ? invoiceDraft.lineItems.length : 0,
    totals: invoiceDraft.totals || { subtotalCents: 0, taxCents: 0, totalCents: 0 },
    rateCardSnapshot: invoiceDraft.rateCardSnapshot || null,
    invoiceDraft,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  return {
    ok: true,
    recordId: docRef.id,
    invoiceId: invoiceDraft.invoiceId,
    status,
    invoiceDraft,
  };
});

exports.listMyUsageInvoices = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "list_my_usage_invoices", { perMinute: 30, perHour: 240 });
  const { entitlements } = await requireCapability(request, "billing.invoice_drafts");
  enforceAppCheckIfEnabled(request, "list_my_usage_invoices");
  const role = String(entitlements?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Only organization owners/admins can view invoice history.");
  }
  const orgId = entitlements?.orgId || "";
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Organization is not initialized.");
  }
  const maxItems = clampNumber(request.data?.limit ?? 25, 1, 100, 25);
  const statusFilter = sanitizeInvoiceStatus(request.data?.status || "");
  let invoiceQuery = orgsCollection()
    .doc(orgId)
    .collection("invoices")
    .orderBy("createdAt", "desc")
    .limit(maxItems);
  if (request.data?.status) {
    invoiceQuery = invoiceQuery.where("status", "==", statusFilter);
  }
  const snap = await invoiceQuery.get();
  const invoices = snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      recordId: docSnap.id,
      orgId: data.orgId || orgId,
      orgName: data.orgName || "",
      period: data.period || "",
      invoiceId: data.invoiceId || "",
      status: data.status || "draft",
      notes: data.notes || "",
      customerName: data.customerName || "",
      includeBasePlan: !!data.includeBasePlan,
      taxRatePercent: Number(data.taxRatePercent || 0),
      lineItemCount: Number(data.lineItemCount || 0),
      totals: data.totals || { subtotalCents: 0, taxCents: 0, totalCents: 0 },
      createdBy: data.createdBy || "",
      updatedBy: data.updatedBy || "",
      createdAtMs: valueToMillis(data.createdAt),
      updatedAtMs: valueToMillis(data.updatedAt),
    };
  });
  return {
    orgId,
    count: invoices.length,
    invoices,
  };
});

const pickProvisionRoomCode = async ({
  tx,
  rootRef = getRootRef(),
  preferredRoomCode = "",
} = {}) => {
  const preferred = normalizeProvisionRoomCode(preferredRoomCode);
  if (preferred) {
    if (preferred.length < ROOM_CODE_MIN_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `roomCode must be at least ${ROOM_CODE_MIN_LENGTH} characters.`
      );
    }
    const preferredRef = rootRef.collection("rooms").doc(preferred);
    const preferredSnap = await tx.get(preferredRef);
    if (preferredSnap.exists) {
      throw new HttpsError("already-exists", `Room code ${preferred} already exists.`);
    }
    return preferred;
  }

  for (let attempt = 0; attempt < ROOM_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateRoomCodeCandidate(ROOM_CODE_DEFAULT_LENGTH);
    const roomRef = rootRef.collection("rooms").doc(candidate);
    const snap = await tx.get(roomRef);
    if (!snap.exists) return candidate;
  }
  throw new HttpsError("resource-exhausted", "Could not reserve a room code. Retry.");
};

exports.provisionHostRoom = onCall(
  { cors: true, secrets: [GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_SERVER_API_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "provision_host_room", { perMinute: 30, perHour: 240 });
    enforceAppCheckIfEnabled(request, "provision_host_room");
    const callerUid = requireAuth(request, "Sign in required.");
    const payload = isPlainObject(request.data) ? request.data : {};
    const rootRef = getRootRef();
    const db = admin.firestore();
    const requestId = normalizeProvisionRequestId(payload.requestId || payload.actionId || "");
    const jobDocId = buildProvisioningJobDocId(callerUid, requestId);
    const jobRef = jobDocId ? rootRef.collection("room_provisioning_jobs").doc(jobDocId) : null;
    const launchOrigin = resolveOrigin(request.rawRequest, payload.origin);
    const hostName = normalizeOptionalName(payload.hostName, "Host");
    const orgNameInput = typeof payload.orgName === "string" ? payload.orgName : "";
    const orgName = normalizeOrgName(orgNameInput, callerUid);
    const logoUrl = typeof payload.logoUrl === "string"
      ? payload.logoUrl.trim().slice(0, 2048)
      : "";
    const preferredRoomCode = normalizeProvisionRoomCode(
      payload.roomCode || payload.preferredRoomCode || payload.launchRoomCode || ""
    );
    const presetId = normalizeProvisionPresetId(
      payload.nightPresetId || payload.hostNightPreset || "custom"
    ) || "custom";
    const listingInput = payload.discoveryListing && typeof payload.discoveryListing === "object"
      ? payload.discoveryListing
      : (payload.listing && typeof payload.listing === "object" ? payload.listing : {});
    const shouldSyncDiscovery = shouldSyncHostRoomDiscovery(listingInput);

    if (jobRef) {
      const existingJobSnap = await jobRef.get();
      if (existingJobSnap.exists) {
        const existingJob = existingJobSnap.data() || {};
        const existingRoomCode = normalizeRoomCode(existingJob.roomCode || "");
        if (existingRoomCode) {
          const launchUrls = buildProvisionLaunchUrls({
            origin: launchOrigin,
            roomCode: existingRoomCode,
          });
          return {
            ok: true,
            idempotent: true,
            created: false,
            roomCode: existingRoomCode,
            orgId: existingJob.orgId || "",
            role: existingJob.role || "owner",
            hostName: existingJob.hostName || hostName,
            orgName: existingJob.orgName || orgName,
            launchUrls,
            discovery: existingJob.discovery || null,
            warnings: Array.isArray(existingJob.warnings) ? existingJob.warnings : [],
          };
        }
      }
    }

    const ensured = await ensureOrganizationForUser({ uid: callerUid, orgName: orgNameInput });
    const roomData = buildProvisionedRoomData({
      hostUid: callerUid,
      hostName,
      orgId: ensured.orgId,
      orgName,
      logoUrl,
      presetId,
    });
    const provisioning = await db.runTransaction(async (tx) => {
      if (jobRef) {
        const existingJob = await tx.get(jobRef);
        if (existingJob.exists) {
          const existingRoomCode = normalizeRoomCode(existingJob.data()?.roomCode || "");
          if (existingRoomCode) {
            return {
              idempotent: true,
              created: false,
              roomCode: existingRoomCode,
            };
          }
        }
      }
      const roomCode = await pickProvisionRoomCode({
        tx,
        rootRef,
        preferredRoomCode,
      });
      const roomRef = rootRef.collection("rooms").doc(roomCode);
      tx.set(roomRef, roomData, { merge: false });
      tx.set(
        rootRef.collection("host_libraries").doc(roomCode),
        {
          ytIndex: [],
          logoLibrary: [],
          orbSkinLibrary: [],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      if (jobRef) {
        tx.set(
          jobRef,
          {
            requestId,
            roomCode,
            callerUid,
            hostName,
            orgId: ensured.orgId,
            orgName,
            role: ensured.role,
            presetId,
            status: "room_created",
            warnings: [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      return {
        idempotent: false,
        created: true,
        roomCode,
      };
    });

    const roomCode = normalizeRoomCode(provisioning.roomCode || "");
    if (!roomCode) {
      throw new HttpsError("internal", "Room provisioning failed to return a room code.");
    }
    const launchUrls = buildProvisionLaunchUrls({
      origin: launchOrigin,
      roomCode,
    });

    let discovery = null;
    const warnings = [];
    if (shouldSyncDiscovery) {
      try {
        discovery = await upsertHostRoomDiscoveryListingInternal({
          callerUid,
          roomCode,
          listingInput,
          roomAccess: {
            roomRef: rootRef.collection("rooms").doc(roomCode),
            roomData: {
              hostUid: callerUid,
              hostUids: [callerUid],
              hostName,
            },
            roomCode,
          },
        });
      } catch (error) {
        console.warn("provisionHostRoom discovery sync failed", error?.message || error);
        warnings.push("discovery_sync_failed");
      }
    }

    if (jobRef) {
      await jobRef.set(
        {
          roomCode,
          launchUrls,
          discovery: discovery || null,
          status: warnings.length ? "ready_with_warnings" : "ready",
          warnings,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      ok: true,
      idempotent: !!provisioning.idempotent,
      created: !!provisioning.created,
      roomCode,
      orgId: ensured.orgId,
      role: ensured.role,
      hostName,
      orgName,
      presetId,
      launchUrls,
      discovery,
      warnings,
    };
  }
);

exports.assertRoomHostAccess = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "assert_room_host_access", { perMinute: 60, perHour: 720 });
  enforceAppCheckIfEnabled(request, "assert_room_host_access");
  const callerUid = requireAuth(request);
  const roomCode = String(request.data?.roomCode || "").trim().toUpperCase();
  ensureString(roomCode, "roomCode");

  const { roomCode: safeRoomCode, roomData } = await ensureRoomHostAccess({
    roomCode,
    callerUid,
    deniedMessage: "Only room hosts can access host controls.",
  });

  const hostUid = typeof roomData?.hostUid === "string" ? roomData.hostUid : "";
  const hostUids = Array.isArray(roomData?.hostUids)
    ? roomData.hostUids.filter((uid) => typeof uid === "string")
    : [];

  return {
    ok: true,
    roomCode: safeRoomCode,
    hostUid,
    hostUids,
  };
});

exports.updateRoomAsHost = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "update_room_as_host", { perMinute: 90, perHour: 900 });
  enforceAppCheckIfEnabled(request, "update_room_as_host");
  const callerUid = requireAuth(request);
  const roomCode = String(request.data?.roomCode || "").trim().toUpperCase();
  ensureString(roomCode, "roomCode");
  const updates = normalizeHostRoomUpdates(request.data?.updates || {});

  const db = admin.firestore();
  const rootRef = getRootRef();
  const result = await db.runTransaction(async (tx) => {
    const { roomRef, roomCode: safeRoomCode } = await ensureRoomHostAccess({
      tx,
      rootRef,
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can update room controls.",
    });
    tx.update(roomRef, updates);
    return { roomCode: safeRoomCode };
  });

  return {
    ok: true,
    roomCode: result.roomCode,
    updatedKeys: Object.keys(updates),
  };
});

exports.runDemoDirectorAction = onCall({ cors: true }, async (request) => {
  const rootRef = getRootRef();
  const callerUid = String(request.auth?.uid || "");
  const callerIp = getClientIp(request.rawRequest);
  let payload = null;
  let safeRoomCode = "";

  try {
    checkRateLimit(request.rawRequest, "run_demo_director_action", { perMinute: 120, perHour: 1200 });
    enforceAppCheckIfEnabled(request, "run_demo_director_action");
    const authedUid = requireAuth(request);
    const superAdmin = await isSuperAdminUid(authedUid);
    payload = normalizeDemoDirectorPayload(request.data || {});
    safeRoomCode = payload.roomCode;

    const roomUpdates = normalizeHostRoomUpdates(buildDemoRoomUpdates(payload));
    const actorKey = sanitizeDemoToken(authedUid, 64) || "actor";

    const db = admin.firestore();
    const txResult = await db.runTransaction(async (tx) => {
      const roomRef = rootRef.collection("rooms").doc(safeRoomCode);
      const stateRef = rootRef.collection("demo_director_state").doc(safeRoomCode);
      const roomSnap = await tx.get(roomRef);
      const stateSnap = await tx.get(stateRef);

      let createdRoom = false;
      let stale = false;
      let duplicate = false;
      let lastSequence = -1;

      if (!roomSnap.exists) {
        createdRoom = true;
        tx.set(roomRef, {
          roomCode: safeRoomCode,
          hostUid: authedUid,
          hostUids: [authedUid],
          activeMode: "karaoke",
          lightMode: "ballad",
          showLyricsTv: true,
          showLyricsSinger: true,
          popTriviaEnabled: true,
          isDemoRoom: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        const roomData = roomSnap.data() || {};
        const hostUid = typeof roomData.hostUid === "string" ? roomData.hostUid : "";
        const hostUids = Array.isArray(roomData.hostUids)
          ? roomData.hostUids.filter((uid) => typeof uid === "string")
          : [];
        const isHost = superAdmin || authedUid === hostUid || hostUids.includes(authedUid);
        if (!isHost) {
          throw new HttpsError("permission-denied", "Only demo room hosts can drive demo director sync.");
        }
      }

      const stateData = stateSnap.exists ? (stateSnap.data() || {}) : {};
      const lastSequenceByActor = isPlainObject(stateData.lastSequenceByActor)
        ? stateData.lastSequenceByActor
        : {};
      const lastActionIdByActor = isPlainObject(stateData.lastActionIdByActor)
        ? stateData.lastActionIdByActor
        : {};
      lastSequence = Number(lastSequenceByActor[actorKey] ?? -1);
      const lastActionId = String(lastActionIdByActor[actorKey] || "");
      duplicate = !!payload.actionId && payload.sequence === lastSequence && payload.actionId === lastActionId;
      stale = payload.sequence > 0 && (payload.sequence < lastSequence || duplicate);
      if (stale) {
        return {
          createdRoom,
          stale,
          duplicate,
          lastSequence,
        };
      }

      tx.set(roomRef, {
        ...roomUpdates,
        isDemoRoom: true,
        demoLastAction: payload.action,
        demoLastActionId: payload.actionId || "",
        demoLastSequence: payload.sequence,
        demoLastScene: payload.sceneId,
        demoTimelineMs: payload.timelineMs,
        demoProgress: payload.progress,
        demoPlaying: !!payload.playing,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.set(stateRef, {
        roomCode: safeRoomCode,
        lastAction: payload.action,
        lastActionId: payload.actionId || "",
        lastScene: payload.sceneId,
        lastSequence: payload.sequence,
        lastSequenceByActor: {
          ...lastSequenceByActor,
          [actorKey]: payload.sequence,
        },
        lastActionIdByActor: {
          ...lastActionIdByActor,
          [actorKey]: payload.actionId || "",
        },
        timelineMs: payload.timelineMs,
        progress: payload.progress,
        playing: !!payload.playing,
        crowdSize: payload.crowdSize,
        updatedBy: authedUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { createdRoom, stale, duplicate, lastSequence };
    });

    if (txResult.stale) {
      const staleSignal = trackSuspiciousPattern({
        type: "demo_director_stale_sequence",
        actor: `${authedUid}_${callerIp}_${safeRoomCode}`,
        windowMs: 2 * 60 * 1000,
        threshold: 6,
      });
      if (staleSignal.shouldAlert) {
        await emitSecurityAlert({
          rootRef,
          type: "demo_director_stale_sequence",
          severity: "warning",
          roomCode: safeRoomCode,
          uid: authedUid,
          request,
          details: {
            staleCountWindow: staleSignal.count,
            duplicate: !!txResult.duplicate,
            action: payload.action,
            sequence: payload.sequence,
            lastSequence: Number(txResult.lastSequence || 0),
          },
        });
      }
      return {
        ok: true,
        roomCode: safeRoomCode,
        action: payload.action,
        sceneId: payload.sceneId,
        createdRoom: !!txResult.createdRoom,
        stale: true,
        duplicate: !!txResult.duplicate,
        sequence: payload.sequence,
        lastSequence: Number(txResult.lastSequence || 0),
        seededUsers: 0,
        reactionsWritten: 0,
        votesWritten: 0,
      };
    }

    let seededUsers = 0;
    const shouldSeedUsers = payload.action === "bootstrap" || payload.action === "scene" || payload.action === "seek";
    if (shouldSeedUsers) {
      const seedResult = await seedDemoAudienceSnapshot({
        rootRef,
        roomCode: safeRoomCode,
        payload,
      });
      seededUsers = Number(seedResult?.crowdSize || 0);
    }

    let reactionsWritten = 0;
    const shouldWriteReactions = payload.action === "bootstrap" || payload.action === "scene" || payload.action === "seek";
    if (shouldWriteReactions) {
      reactionsWritten = await writeDemoReactionEvents({
        rootRef,
        roomCode: safeRoomCode,
        payload,
      });
    }

    let votesWritten = 0;
    if (payload.action === "bootstrap" || payload.action === "scene" || payload.action === "seek") {
      votesWritten = await writeDemoTriviaVotes({
        rootRef,
        roomCode: safeRoomCode,
        payload,
      });
    }

    return {
      ok: true,
      roomCode: safeRoomCode,
      action: payload.action,
      sceneId: payload.sceneId,
      createdRoom: !!txResult.createdRoom,
      stale: false,
      duplicate: false,
      sequence: payload.sequence,
      seededUsers,
      reactionsWritten,
      votesWritten,
    };
  } catch (error) {
    const code = String(error?.code || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    const actor = `${callerUid || "anon"}_${callerIp}_${safeRoomCode || "na"}`;

    if (code.includes("permission-denied") || message.includes("only demo room hosts")) {
      await emitSecurityAlert({
        rootRef,
        type: "demo_director_permission_denied",
        severity: "high",
        roomCode: safeRoomCode,
        uid: callerUid,
        request,
        details: {
          code,
          action: payload?.action || "",
          sceneId: payload?.sceneId || "",
        },
      });
    } else if (code.includes("invalid-argument")) {
      const invalidSignal = trackSuspiciousPattern({
        type: "demo_director_invalid_argument",
        actor,
        windowMs: 10 * 60 * 1000,
        threshold: 4,
      });
      if (invalidSignal.shouldAlert) {
        await emitSecurityAlert({
          rootRef,
          type: "demo_director_invalid_argument",
          severity: "warning",
          roomCode: safeRoomCode,
          uid: callerUid,
          request,
          details: {
            invalidCountWindow: invalidSignal.count,
            code,
            message: message.slice(0, 160),
          },
        });
      }
    } else if (code.includes("resource-exhausted")) {
      await emitSecurityAlert({
        rootRef,
        type: "demo_director_rate_limit",
        severity: "warning",
        roomCode: safeRoomCode,
        uid: callerUid,
        request,
        details: {
          code,
          scope: "run_demo_director_action",
        },
      });
    }

    throw error;
  }
});

exports.awardRoomPoints = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "award_room_points", { perMinute: 20, perHour: 240 });
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const roomCode = String(request.data?.roomCode || "").trim().toUpperCase();
  ensureString(roomCode, "roomCode");

  const rawAwards = Array.isArray(request.data?.awards) ? request.data.awards : [];
  if (!rawAwards.length) {
    throw new HttpsError("invalid-argument", "awards must be a non-empty array.");
  }
  if (rawAwards.length > 25) {
    throw new HttpsError("invalid-argument", "Too many awards in one request.");
  }

  const normalizedAwards = normalizePointAwards(rawAwards);
  if (!normalizedAwards.length) {
    throw new HttpsError("invalid-argument", "No valid awards to apply.");
  }

  let totalRequested = 0;
  normalizedAwards.forEach((entry) => {
    totalRequested += entry.points;
  });
  if (totalRequested > 50000) {
    throw new HttpsError("invalid-argument", "Requested points exceed batch limit.");
  }
  const awardKey = normalizeAwardKeyToken(request.data?.awardKey || "");
  const source = typeof request.data?.source === "string" && request.data.source.trim()
    ? request.data.source.trim().slice(0, 80)
    : "manual_host_award";

  const db = admin.firestore();
  const rootRef = getRootRef();
  const callerUid = request.auth.uid;

  if (awardKey) {
    await db.runTransaction(async (tx) => {
      await ensureRoomHostAccess({
        tx,
        rootRef,
        roomCode,
        callerUid,
        deniedMessage: "Only room hosts can award points.",
      });
    });
    const onceResult = await applyRoomAwardsOnce({
      roomCode,
      awardKey,
      awards: normalizedAwards,
      source,
    });
    return {
      ok: true,
      awardedCount: onceResult.awardedCount || 0,
      awardedPoints: onceResult.awardedPoints || 0,
      skipped: Array.isArray(onceResult.skippedUids) ? onceResult.skippedUids : [],
      duplicate: !!onceResult.duplicate,
      applied: !!onceResult.applied,
    };
  }

  const result = await db.runTransaction(async (tx) => {
    const { roomCode: safeRoomCode } = await ensureRoomHostAccess({
      tx,
      rootRef,
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can award points.",
    });

    const userAwards = normalizedAwards.map(({ uid, points }) => ({
      uid,
      points,
      ref: rootRef.collection("room_users").doc(`${safeRoomCode}_${uid}`),
    }));

    const snaps = await Promise.all(userAwards.map((entry) => tx.get(entry.ref)));
    const awarded = [];
    const skipped = [];
    userAwards.forEach((entry, idx) => {
      if (!snaps[idx].exists) {
        skipped.push(entry.uid);
        return;
      }
      awarded.push(entry);
      tx.update(entry.ref, {
        points: admin.firestore.FieldValue.increment(entry.points),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    let awardedPoints = 0;
    awarded.forEach((entry) => {
      awardedPoints += entry.points;
    });
    return {
      awardedCount: awarded.length,
      awardedPoints,
      skipped,
    };
  });

  return {
    ok: true,
    ...result,
  };
});

exports.setSelfieSubmissionApproval = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "selfie_approval", { perMinute: 40, perHour: 400 });
  const callerUid = request.auth?.uid || "";
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const roomCode = String(request.data?.roomCode || "").trim().toUpperCase();
  ensureString(roomCode, "roomCode");
  const submissionId = String(request.data?.submissionId || "").trim();
  ensureString(submissionId, "submissionId");
  const approved = !!request.data?.approved;

  const db = admin.firestore();
  const rootRef = getRootRef();
  const submissionRef = rootRef.collection("selfie_submissions").doc(submissionId);

  await db.runTransaction(async (tx) => {
    const { roomCode: safeRoomCode } = await ensureRoomHostAccess({
      tx,
      rootRef,
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can moderate selfies.",
    });
    const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists) {
      throw new HttpsError("not-found", "Selfie submission not found.");
    }
    const submission = submissionSnap.data() || {};
    const submissionRoomCode = normalizeRoomCode(submission.roomCode || "");
    if (submissionRoomCode !== safeRoomCode) {
      throw new HttpsError("permission-denied", "Submission does not belong to this room.");
    }
    tx.update(submissionRef, {
      approved,
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
      moderatedBy: callerUid,
    });
  });

  return { ok: true, approved };
});

exports.deleteRoomReaction = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "delete_room_reaction", { perMinute: 40, perHour: 400 });
  const callerUid = request.auth?.uid || "";
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const roomCode = String(request.data?.roomCode || "").trim().toUpperCase();
  ensureString(roomCode, "roomCode");
  const reactionId = String(request.data?.reactionId || "").trim();
  ensureString(reactionId, "reactionId");

  const db = admin.firestore();
  const rootRef = getRootRef();
  const reactionRef = rootRef.collection("reactions").doc(reactionId);

  await db.runTransaction(async (tx) => {
    const { roomCode: safeRoomCode } = await ensureRoomHostAccess({
      tx,
      rootRef,
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can remove reactions.",
    });
    const reactionSnap = await tx.get(reactionRef);
    if (!reactionSnap.exists) {
      throw new HttpsError("not-found", "Reaction not found.");
    }
    const reaction = reactionSnap.data() || {};
    const reactionRoomCode = normalizeRoomCode(reaction.roomCode || "");
    if (reactionRoomCode !== safeRoomCode) {
      throw new HttpsError("permission-denied", "Reaction does not belong to this room.");
    }
    tx.delete(reactionRef);
  });

  return { ok: true };
});

exports.createSubscriptionCheckout = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_subscription_checkout");
    const planId = String(request.data?.planId || "").trim();
    const plan = getPlanDefinition(planId);
    if (!plan || !isPaidPlan(planId)) {
      throw new HttpsError("invalid-argument", "Invalid subscription plan.");
    }

    const orgName = typeof request.data?.orgName === "string" ? request.data.orgName : "";
    const { orgId } = await ensureOrganizationForUser({ uid: callerUid, orgName });
    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const stripe = getStripeClient();
    const ownerEmail = typeof request.auth?.token?.email === "string"
      ? request.auth.token.email.trim()
      : "";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      customer_email: ownerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: plan.amountCents,
            recurring: { interval: plan.interval },
            product_data: {
              name: `BROSS ${plan.name}`,
              description: `Organization subscription (${plan.id})`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        checkoutType: "org_subscription",
        orgId,
        ownerUid: callerUid,
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          orgId,
          ownerUid: callerUid,
          planId: plan.id,
        },
      },
      success_url: `${origin}/?mode=host&subscription=success&org=${encodeURIComponent(orgId)}`,
      cancel_url: `${origin}/?mode=host&subscription=cancel&org=${encodeURIComponent(orgId)}`,
    });

    return {
      url: session.url,
      id: session.id,
      orgId,
      planId: plan.id,
    };
  }
);

exports.createSubscriptionPortalSession = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_subscription_portal");
    const { orgId, role } = await ensureOrganizationForUser({ uid: callerUid });
    const superAdmin = await isSuperAdminUid(callerUid);
    if (!orgId) {
      throw new HttpsError("failed-precondition", "Organization is not initialized.");
    }
    if (!superAdmin && !["owner", "admin"].includes(role)) {
      throw new HttpsError("permission-denied", "Only organization owners/admins can manage billing.");
    }
    const subSnap = await orgsCollection()
      .doc(orgId)
      .collection("subscription")
      .doc("current")
      .get();
    const sub = subSnap.data() || {};
    const stripeCustomerId = String(sub.stripeCustomerId || "").trim();
    if (!stripeCustomerId) {
      throw new HttpsError(
        "failed-precondition",
        "No Stripe billing profile found. Start a subscription first."
      );
    }
    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/?mode=host&billing=return`,
    });

    return { url: session.url };
  }
);

exports.createTipCrateCheckout = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_tip_crate_checkout");
    const roomCode = normalizeRoomCode(request.data?.roomCode || "");
    const crateId = request.data?.crateId || "";
    ensureString(roomCode, "roomCode");
    ensureString(crateId, "crateId");

    const roomSnap = await getRootRef().collection("rooms").doc(roomCode).get();
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Room not found.");
    }
    const crates = Array.isArray(roomSnap.data()?.tipCrates)
      ? roomSnap.data().tipCrates
      : [];
    const crate = crates.find((c) => c.id === crateId);
    if (!crate) {
      throw new HttpsError("invalid-argument", "Tip crate not found.");
    }
    const amount = clampNumber(crate.amount || 0, 1, 500, 0);
    if (!amount) {
      throw new HttpsError("invalid-argument", "Invalid tip amount.");
    }
    const points = clampNumber(crate.points || 0, 0, 100000, 0);
    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const buyerUid = callerUid;
    const buyerName = normalizeOptionalName(request.data?.userName || "", "Guest");
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `BROSS Room Tip: ${crate.label || "Room Boost"}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        roomCode,
        crateId,
        points: `${points}`,
        rewardScope: crate.rewardScope || "room",
        awardBadge: crate.awardBadge ? "1" : "0",
        buyerUid,
        buyerName,
        label: crate.label || "Room Boost",
      },
      success_url: `${origin}/?room=${encodeURIComponent(roomCode)}&tip=success`,
      cancel_url: `${origin}/?room=${encodeURIComponent(roomCode)}&tip=cancel`,
    });

    return { url: session.url, id: session.id };
  }
);

exports.createPointsCheckout = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_points_checkout");
    const roomCode = normalizeRoomCode(request.data?.roomCode || "");
    const amount = clampNumber(request.data?.amount || 0, 1, 500, 0);
    const points = clampNumber(request.data?.points || 0, 0, 100000, 0);
    const label = normalizeOptionalName(request.data?.label || "", "Points Pack");
    const packId = request.data?.packId || "points_pack";
    const buyerName = normalizeOptionalName(request.data?.userName || "", "Guest");
    ensureString(roomCode, "roomCode");
    if (!amount || !points) {
      throw new HttpsError("invalid-argument", "Invalid points pack.");
    }

    const roomSnap = await getRootRef().collection("rooms").doc(roomCode).get();
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Room not found.");
    }

    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `BROSS Points: ${label}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        roomCode,
        points: `${points}`,
        packId,
        label,
        buyerUid: callerUid,
        buyerName,
      },
      success_url: `${origin}/?room=${encodeURIComponent(roomCode)}&points=success`,
      cancel_url: `${origin}/?room=${encodeURIComponent(roomCode)}&points=cancel`,
    });

    return { url: session.url, id: session.id };
  }
);

exports.createAppleMusicToken = onCall(
  { cors: true, secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "apple_music_token", { perMinute: 10, perHour: 80 });
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_apple_music_token");
    const roomCode = normalizeRoomCode(request.data?.roomCode || "");
    ensureString(roomCode, "roomCode");
    await ensureRoomHostAccess({
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can request Apple Music tokens.",
    });

    const teamId = APPLE_MUSIC_TEAM_ID.value();
    const keyId = APPLE_MUSIC_KEY_ID.value();
    const rawKey = APPLE_MUSIC_PRIVATE_KEY.value();
    const privateKey = rawKey.includes("BEGIN") ? rawKey : rawKey.replace(/\\n/g, "\n");
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 12;
    const token = jwt.sign(
      { iss: teamId, iat: now, exp },
      privateKey,
      { algorithm: "ES256", header: { alg: "ES256", kid: keyId } }
    );
    return { token, expiresAt: exp };
  }
);

exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = getStripeClient();
    const sig = req.headers["stripe-signature"];
    const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature failed.", err?.message || err);
      res.status(400).send("Webhook Error");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object || {};
      const metadata = session.metadata || {};
      const isSubscriptionCheckout =
        session.mode === "subscription"
        || metadata.checkoutType === "org_subscription"
        || !!metadata.orgId;

      if (isSubscriptionCheckout) {
        const stripeSubscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : "";
        const stripeCustomerId = typeof session.customer === "string"
          ? session.customer
          : "";
        const orgId = String(metadata.orgId || "").trim();
        let ownerUid = String(metadata.ownerUid || "").trim();
        let planId = String(metadata.planId || "").trim();
        let subscription = null;

        if (stripeSubscriptionId) {
          try {
            subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          } catch (err) {
            console.warn("Failed to retrieve Stripe subscription after checkout.", err?.message || err);
          }
        }

        if (!ownerUid && subscription?.metadata?.ownerUid) {
          ownerUid = String(subscription.metadata.ownerUid || "").trim();
        }
        planId = resolvePlanIdFromStripeSubscription({
          explicitPlanId: planId,
          subscription,
        });
        const status = String(
          subscription?.status
            || (session.payment_status === "paid" ? "active" : "incomplete")
        ).toLowerCase();
        const currentPeriodEndSec = Number(subscription?.current_period_end || 0);
        const cancelAtPeriodEnd = !!subscription?.cancel_at_period_end;

        if (orgId) {
          await applyOrganizationSubscriptionState({
            orgId,
            ownerUid,
            planId,
            status,
            provider: "stripe",
            stripeCustomerId,
            stripeSubscriptionId,
            currentPeriodEndSec,
            cancelAtPeriodEnd,
            source: "stripe_checkout_completed",
          });
        }

        res.json({
          received: true,
          subscriptionCheckout: true,
          orgId: orgId || null,
        });
        return;
      }

      const roomCode = metadata.roomCode;
      const points = Number(metadata.points || 0);
      const rewardScope = metadata.rewardScope || "room";
      const awardBadge = metadata.awardBadge === "1";
      const buyerUid = metadata.buyerUid || "";
      const buyerName = metadata.buyerName || "Guest";
      const label = metadata.label || "Room Boost";
      if (!roomCode || !points) {
        res.json({ received: true });
        return;
      }

      const eventId = session.id || event.id;
      const rootRef = getRootRef();
      const eventRef = rootRef.collection("stripe_events").doc(eventId);
      const existing = await eventRef.get();
      if (existing.exists) {
        res.json({ received: true, duplicate: true });
        return;
      }
      await eventRef.set({
        roomCode,
        points,
        amount: session.amount_total || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (rewardScope === "buyer" && buyerUid) {
        const buyerRef = rootRef.collection("room_users").doc(`${roomCode}_${buyerUid}`);
        await buyerRef.set(
          {
            points: admin.firestore.FieldValue.increment(points),
            roomBoostBadge: awardBadge ? true : undefined,
            roomBoosts: awardBadge ? admin.firestore.FieldValue.increment(1) : undefined,
          },
          { merge: true }
        );
      } else {
        const usersSnap = await rootRef
          .collection("room_users")
          .where("roomCode", "==", roomCode)
          .get();
        if (!usersSnap.empty) {
          const batch = admin.firestore().batch();
          usersSnap.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, {
              points: admin.firestore.FieldValue.increment(points),
            });
          });
          await batch.commit();
        }
        if (buyerUid && awardBadge) {
          const buyerRef = rootRef.collection("room_users").doc(`${roomCode}_${buyerUid}`);
          await buyerRef.set(
            {
              roomBoostBadge: true,
              roomBoosts: admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
          );
        }
      }

      const amount = session.amount_total
        ? `$${(session.amount_total / 100).toFixed(2)}`
        : "";
      await rootRef.collection("activities").add({
        roomCode,
        user: rewardScope === "buyer" ? buyerName : "TIP JAR",
        text:
          rewardScope === "buyer"
            ? `${buyerName} grabbed ${label} - +${points} pts`
            : `room tip jar hit ${amount} - everyone +${points} pts`,
        icon: "$",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object || {};
      const stripeSubscriptionId = String(subscription.id || "").trim();
      if (!stripeSubscriptionId) {
        res.json({ received: true, ignored: true });
        return;
      }
      const subMapSnap = await admin
        .firestore()
        .collection(STRIPE_SUBSCRIPTIONS_COLLECTION)
        .doc(stripeSubscriptionId)
        .get();
      const mapped = subMapSnap.data() || {};
      const orgId = String(subscription.metadata?.orgId || mapped.orgId || "").trim();
      const ownerUid = String(subscription.metadata?.ownerUid || mapped.ownerUid || "").trim();
      const planId = resolvePlanIdFromStripeSubscription({
        explicitPlanId: subscription.metadata?.planId || "",
        subscription,
        fallbackPlanId: mapped.planId || "",
      });
      const status = event.type === "customer.subscription.deleted"
        ? "canceled"
        : String(subscription.status || "inactive").toLowerCase();
      if (orgId) {
        await applyOrganizationSubscriptionState({
          orgId,
          ownerUid,
          planId,
          status,
          provider: "stripe",
          stripeCustomerId: String(subscription.customer || "").trim(),
          stripeSubscriptionId,
          currentPeriodEndSec: Number(subscription.current_period_end || 0),
          cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
          source: "stripe_subscription_event",
        });
      }
    }

    res.json({ received: true });
  }
);

exports.verifyAppleReceipt = onCall(
  { cors: true },
  async (request) => {
    const callerUid = requireAuth(request);
    const transactionId = request.data?.transactionId || "";
    const productId = request.data?.productId || "";
    const userUid = request.data?.userUid || "";
    ensureString(transactionId, "transactionId");
    ensureString(productId, "productId");
    ensureString(userUid, "userUid");
    if (userUid !== callerUid) {
      throw new HttpsError("permission-denied", "userUid must match authenticated user.");
    }

    // TODO: Wire App Store Server API with JWT auth and verify transaction.
    // After verification, grant entitlements and store a transaction record
    // to prevent duplicate grants.
    throw new HttpsError(
      "failed-precondition",
      "Apple IAP verification is currently unavailable."
    );
  }
);

