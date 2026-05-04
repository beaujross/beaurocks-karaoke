#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  buildRoomRecapSummary,
  buildRoomRecapUrl,
} from "../../src/lib/roomRecap.js";

const require = createRequire(import.meta.url);
const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");
const APP_ID = "bross-app";

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArg = (flag, fallback = "") => {
  const idx = args.indexOf(flag);
  if (idx < 0) return fallback;
  return args[idx + 1] || fallback;
};

const usage = `
Usage:
  node scripts/ops/backfill-room-recap.mjs --room-code AAHF --session-id official_aahf_karaoke_kickoff_2026 --start 2026-05-01T19:00:00-07:00 --end 2026-05-02T03:00:00-07:00

Options:
  --room-code <code>      Room code to backfill
  --session-id <id>       Optional room_session document id to sync
  --start <iso>           Event window start
  --end <iso>             Event window end
  --origin <url>          Public origin for recap URLs (default: https://beaurocks.app)
  --dry-run               Print payload only, do not write
  --help                  Show help
`;

if (hasFlag("--help")) {
  console.log(usage.trim());
  process.exit(0);
}

const roomCode = String(readArg("--room-code", "")).trim().toUpperCase();
const sessionId = String(readArg("--session-id", "")).trim();
const startRaw = String(readArg("--start", "")).trim();
const endRaw = String(readArg("--end", "")).trim();
const publicOrigin = String(readArg("--origin", "https://beaurocks.app")).trim() || "https://beaurocks.app";
const reportPath = String(readArg("--report", "")).trim();
const dryRun = hasFlag("--dry-run");

if (!roomCode || !startRaw || !endRaw) {
  throw new Error("Missing required args. Provide --room-code, --start, and --end.");
}

const startAt = new Date(startRaw);
const endAt = new Date(endRaw);
if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt.getTime() >= endAt.getTime()) {
  throw new Error("Invalid event window. Ensure --start and --end are valid ISO timestamps and start < end.");
}

const loadDotEnvFallbacks = async () => {
  const files = [".env.local", ".env"];
  const values = {};
  for (const relativePath of files) {
    const absolutePath = path.join(projectRoot, relativePath);
    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      raw.split(/\r?\n/).forEach((line) => {
        const trimmed = String(line || "").trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex <= 0) return;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, "");
        if (!key || Object.prototype.hasOwnProperty.call(values, key)) return;
        values[key] = value;
      });
    } catch {
      // Ignore missing env files.
    }
  }
  return values;
};

const parseServiceAccountPayload = (raw = "") => {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isServiceAccountPayload = (payload = null) =>
  !!payload
  && typeof payload === "object"
  && String(payload.type || "").trim() === "service_account"
  && !!String(payload.client_email || "").trim()
  && !!String(payload.private_key || "").trim();

const loadServiceAccount = async () => {
  const envFallbacks = await loadDotEnvFallbacks();
  Object.entries(envFallbacks).forEach(([key, value]) => {
    if (!process.env[key] && value) process.env[key] = value;
  });

  const inlinePayload = parseServiceAccountPayload(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  );
  if (isServiceAccountPayload(inlinePayload)) return inlinePayload;

  const fileCandidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE,
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ].filter(Boolean);

  for (const candidate of fileCandidates) {
    const serviceAccountPath = path.isAbsolute(candidate)
      ? candidate
      : path.join(projectRoot, candidate);
    try {
      const raw = await fs.readFile(serviceAccountPath, "utf8");
      const parsed = parseServiceAccountPayload(raw);
      if (isServiceAccountPayload(parsed)) return parsed;
    } catch {
      // Try the next path.
    }
  }
  return null;
};

const loadFirebaseAdmin = () => {
  try {
    return require("firebase-admin");
  } catch {
    return require(path.join(projectRoot, "functions", "node_modules", "firebase-admin"));
  }
};

const initializeFirebaseAdmin = async () => {
  const admin = loadFirebaseAdmin();
  if (admin.apps.length) return admin;
  const serviceAccount = await loadServiceAccount();
  if (serviceAccount && admin.credential?.cert) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "beaurocks-karaoke-v2",
    });
    return admin;
  }
  admin.initializeApp({ projectId: "beaurocks-karaoke-v2" });
  return admin;
};

const queryCollectionByRange = async (collectionRef, field, start, end) => {
  const snap = await collectionRef.where(field, ">=", start).where(field, "<=", end).get();
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

const normalizeRoomCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const filterRoomCode = (items = []) =>
  (Array.isArray(items) ? items : []).filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode);

const uniqCapabilities = (values = []) => Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean)));

const loadWindowReport = async () => {
  if (!reportPath) return null;
  const absolutePath = path.isAbsolute(reportPath) ? reportPath : path.join(projectRoot, reportPath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.rooms)) return null;
  return parsed.rooms.find((entry) => String(entry?.roomCode || "").trim().toUpperCase() === roomCode) || null;
};

const run = async () => {
  const admin = await initializeFirebaseAdmin();
  const db = admin.firestore();
  const root = db.collection("artifacts").doc(APP_ID).collection("public").doc("data");

  const [
    roomSnap,
    roomUsersRaw,
    reactionsRaw,
    activitiesRaw,
    chatMessagesRaw,
    queuedSongsRaw,
    performedSongsRaw,
    uploadsRaw,
    crowdSelfiesRaw,
  ] = await Promise.all([
    root.collection("rooms").doc(roomCode).get(),
    queryCollectionByRange(root.collection("room_users"), "lastActiveAt", startAt, endAt),
    queryCollectionByRange(root.collection("reactions"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("activities"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("chat_messages"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("karaoke_songs"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("karaoke_songs"), "performingStartedAt", startAt, endAt),
    queryCollectionByRange(root.collection("room_uploads"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("crowd_selfie_submissions"), "timestamp", startAt, endAt),
  ]);

  if (!roomSnap.exists) {
    throw new Error(`Room ${roomCode} was not found.`);
  }

  const room = roomSnap.data() || {};
  const queuedSongs = filterRoomCode(queuedSongsRaw);
  const performedSongs = filterRoomCode(performedSongsRaw);
  const songsById = new Map();
  [...queuedSongs, ...performedSongs].forEach((entry) => {
    if (normalizeRoomCode(entry?.roomCode || "") !== roomCode) return;
    const id = String(entry?.id || "").trim();
    if (!id || songsById.has(id)) return;
    songsById.set(id, entry);
  });

  const recap = buildRoomRecapSummary({
    roomCode,
    room,
    songs: [...songsById.values()],
    queuedSongs,
    performedSongs,
    users: filterRoomCode(roomUsersRaw),
    reactions: filterRoomCode(reactionsRaw),
    activities: filterRoomCode(activitiesRaw),
    crowdSelfies: filterRoomCode(crowdSelfiesRaw),
    chatMessages: filterRoomCode(chatMessagesRaw),
    uploads: filterRoomCode(uploadsRaw),
    generatedAtMs: Date.now(),
    source: "window_backfill",
    window: {
      startMs: startAt.getTime(),
      endMs: endAt.getTime(),
      startUtc: startAt.toISOString(),
      endUtc: endAt.toISOString(),
    },
  });
  const windowReport = await loadWindowReport();
  if (windowReport) {
    recap.totalUsers = Number(windowReport?.metrics?.uniqueParticipants || recap.totalUsers || 0) || recap.totalUsers;
    recap.totalQueuedSongs = Number(windowReport?.metrics?.songsQueued || recap.totalQueuedSongs || 0) || recap.totalQueuedSongs;
    recap.totalSongs = Number(windowReport?.metrics?.songsPerformed || recap.totalSongs || 0) || recap.totalSongs;
    recap.totalEmojiBursts = Number(windowReport?.metrics?.reactionCount || recap.totalEmojiBursts || 0) || recap.totalEmojiBursts;
    recap.topReactionTypes = Array.isArray(windowReport?.reactionTypeBreakdown) && windowReport.reactionTypeBreakdown.length
      ? windowReport.reactionTypeBreakdown.slice(0, 8)
      : recap.topReactionTypes;
    recap.topReactors = Array.isArray(windowReport?.topReactors) && windowReport.topReactors.length
      ? windowReport.topReactors.map((entry) => ({
        key: entry?.key || "",
        name: entry?.key || "",
        count: Number(entry?.count || 0) || 0,
      }))
      : recap.topReactors;
    recap.topEmojis = recap.topReactors.map((entry) => ({
      name: entry?.name || entry?.key || "Guest",
      avatar: "",
      totalEmojis: Number(entry?.count || 0) || 0,
    }));
    recap.topPerformances = Array.isArray(windowReport?.topPerformances) && windowReport.topPerformances.length
      ? windowReport.topPerformances.map((entry, index) => ({
        id: entry?.id || `report-performance-${index}`,
        singerName: entry?.singerName || "Singer",
        songTitle: entry?.songTitle || "Song",
        artist: entry?.artist || "",
        hypeScore: Number(entry?.hypeScore || 0) || 0,
        applauseScore: Number(entry?.applauseScore || 0) || 0,
        hostBonus: Number(entry?.hostBonus || 0) || 0,
        totalPoints: Number(entry?.totalPoints || entry?.hypeScore || 0) || 0,
        startedAt: entry?.startedAt || 0,
      }))
      : recap.topPerformances;
    recap.stats.totalUsers = Number(windowReport?.metrics?.uniqueParticipants || recap.stats.totalUsers || 0) || recap.stats.totalUsers;
    recap.stats.activeUserDocs = Number(windowReport?.metrics?.activeUserDocs || recap.stats.activeUserDocs || 0) || recap.stats.activeUserDocs;
    recap.stats.totalQueuedSongs = Number(windowReport?.metrics?.songsQueued || recap.stats.totalQueuedSongs || 0) || recap.stats.totalQueuedSongs;
    recap.stats.totalPerformedSongs = Number(windowReport?.metrics?.songsPerformed || recap.stats.totalPerformedSongs || 0) || recap.stats.totalPerformedSongs;
    recap.stats.totalEmojiBursts = Number(windowReport?.metrics?.reactionCount || recap.stats.totalEmojiBursts || 0) || recap.stats.totalEmojiBursts;
    recap.stats.reactionCount = Number(windowReport?.metrics?.reactionCount || recap.stats.reactionCount || 0) || recap.stats.reactionCount;
    recap.stats.reactionBursts = Number(windowReport?.metrics?.reactionBursts || recap.stats.reactionBursts || 0) || recap.stats.reactionBursts;
    recap.stats.uniqueRequesters = Number(windowReport?.metrics?.uniqueRequesters || recap.stats.uniqueRequesters || 0) || recap.stats.uniqueRequesters;
    recap.stats.uniquePerformers = Number(windowReport?.metrics?.uniquePerformers || recap.stats.uniquePerformers || 0) || recap.stats.uniquePerformers;
    recap.stats.uniqueReactors = Number(windowReport?.metrics?.uniqueReactors || recap.stats.uniqueReactors || 0) || recap.stats.uniqueReactors;
    recap.stats.activityEvents = Number(windowReport?.metrics?.activityEvents || recap.stats.activityEvents || 0) || recap.stats.activityEvents;
    recap.stats.performancesPerHour = Number(windowReport?.metrics?.performancesPerHour || recap.stats.performancesPerHour || 0) || recap.stats.performancesPerHour;
    recap.stats.reactionsPerPerformance = Number(windowReport?.metrics?.reactionsPerPerformance || recap.stats.reactionsPerPerformance || 0) || recap.stats.reactionsPerPerformance;
    recap.metrics.estimatedPeople = Number(windowReport?.metrics?.uniqueParticipants || recap.metrics.estimatedPeople || 0) || recap.metrics.estimatedPeople;
    recap.metrics.activeUserDocs = Number(windowReport?.metrics?.activeUserDocs || recap.metrics.activeUserDocs || 0) || recap.metrics.activeUserDocs;
    recap.metrics.uniqueRequesters = Number(windowReport?.metrics?.uniqueRequesters || recap.metrics.uniqueRequesters || 0) || recap.metrics.uniqueRequesters;
    recap.metrics.uniquePerformers = Number(windowReport?.metrics?.uniquePerformers || recap.metrics.uniquePerformers || 0) || recap.metrics.uniquePerformers;
    recap.metrics.uniqueReactors = Number(windowReport?.metrics?.uniqueReactors || recap.metrics.uniqueReactors || 0) || recap.metrics.uniqueReactors;
    recap.metrics.reactionCount = Number(windowReport?.metrics?.reactionCount || recap.metrics.reactionCount || 0) || recap.metrics.reactionCount;
    recap.metrics.reactionBursts = Number(windowReport?.metrics?.reactionBursts || recap.metrics.reactionBursts || 0) || recap.metrics.reactionBursts;
    recap.metrics.activityEvents = Number(windowReport?.metrics?.activityEvents || recap.metrics.activityEvents || 0) || recap.metrics.activityEvents;
    recap.metrics.performancesPerHour = Number(windowReport?.metrics?.performancesPerHour || recap.metrics.performancesPerHour || 0) || recap.metrics.performancesPerHour;
    recap.metrics.reactionsPerPerformance = Number(windowReport?.metrics?.reactionsPerPerformance || recap.metrics.reactionsPerPerformance || 0) || recap.metrics.reactionsPerPerformance;
  }

  const recapUrl = buildRoomRecapUrl(roomCode, publicOrigin);
  const output = {
    roomCode,
    recapUrl,
    estimatedPeople: recap?.metrics?.estimatedPeople || 0,
    reactions: recap?.stats?.reactionCount || 0,
    performedSongs: recap?.stats?.totalPerformedSongs || 0,
    queuedSongs: recap?.stats?.totalQueuedSongs || 0,
  };

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, output, recap }, null, 2));
    return;
  }

  await root.collection("rooms").doc(roomCode).set(
    {
      recap,
    },
    { merge: true }
  );

  const targetSessionId = sessionId || String(room?.discover?.listingId || "").trim();
  if (targetSessionId) {
    const sessionRef = db.collection("room_sessions").doc(targetSessionId);
    const sessionSnap = await sessionRef.get();
    const sessionData = sessionSnap.exists ? (sessionSnap.data() || {}) : {};
    const nextCapabilities = uniqCapabilities([...(sessionData?.beauRocksCapabilities || []), "recap_ready"]);
    await sessionRef.set(
      {
        hostRecapCount: Math.max(1, Number(sessionData?.hostRecapCount || 0) || 0),
        latestRecapAtMs: recap.generatedAt,
        latestRecapRoomCode: roomCode,
        latestRecapUrl: recapUrl,
        officialStatus: "completed",
        officialStatusLabel: "Recap Ready",
        beauRocksCapabilities: nextCapabilities,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    output.sessionId = targetSessionId;
  }

  console.log(JSON.stringify({ ok: true, dryRun: false, output }, null, 2));
};

run().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
  }, null, 2));
  process.exit(1);
});
