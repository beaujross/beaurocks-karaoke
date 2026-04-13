#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const execFile = promisify(execFileCallback);
const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");

const APP_ID = "bross-app";
const DEFAULT_LOOKBACK_HOURS = 2;
const DEFAULT_TIMEZONE = "America/Los_Angeles";
const DEFAULT_LOG_LIMIT = 50;

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArg = (flag, fallback = "") => {
  const idx = args.indexOf(flag);
  if (idx < 0) return fallback;
  return args[idx + 1] || fallback;
};

const usage = `
Usage:
  node scripts/ops/playtest-room-report.mjs
  node scripts/ops/playtest-room-report.mjs --start 2026-04-12T21:00:00-07:00 --end 2026-04-12T23:00:00-07:00

Options:
  --start <iso>           Window start. Accepts ISO or local Date-compatible text.
  --end <iso>             Window end. Accepts ISO or local Date-compatible text.
  --lookback-hours <n>    If start/end omitted, report on the last N hours (default: 2)
  --timezone <iana>       Time zone label for local summaries (default: America/Los_Angeles)
  --room-codes <csv>      Optional room-code filter, e.g. XRJM,A6DE
  --project-id <id>       Override Google Cloud project id
  --skip-cloud-logs       Skip Cloud Logging issue lookup
  --out-dir <path>        Output directory (default: artifacts/playtests/<timestamp>)
  --report <path>         Explicit JSON report path
  --summary <path>        Explicit Markdown summary path
  --help                  Show this help
`;

if (hasFlag("--help")) {
  console.log(usage.trim());
  process.exit(0);
}

const parsePositiveInt = (value, fallback) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parseDateArg = (value, fallback = null) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
};

const now = new Date();
const lookbackHours = parsePositiveInt(readArg("--lookback-hours", DEFAULT_LOOKBACK_HOURS), DEFAULT_LOOKBACK_HOURS);
const endAt = parseDateArg(readArg("--end", ""), now);
const startAt = parseDateArg(readArg("--start", ""), new Date(endAt.getTime() - (lookbackHours * 60 * 60 * 1000)));
if (startAt.getTime() >= endAt.getTime()) {
  throw new Error("--start must be earlier than --end.");
}

const timezone = String(readArg("--timezone", DEFAULT_TIMEZONE) || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
const roomCodeFilter = String(readArg("--room-codes", "") || "")
  .split(",")
  .map((entry) => String(entry || "").trim().toUpperCase())
  .filter(Boolean);
const skipCloudLogs = hasFlag("--skip-cloud-logs");
const logLimit = parsePositiveInt(readArg("--log-limit", DEFAULT_LOG_LIMIT), DEFAULT_LOG_LIMIT);
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const defaultOutDir = path.resolve(path.join(projectRoot, "artifacts", "playtests", runId));
const outDir = path.resolve(readArg("--out-dir", defaultOutDir));
const reportPath = path.resolve(readArg("--report", path.join(outDir, "playtest-room-report.json")));
const summaryPath = path.resolve(readArg("--summary", path.join(outDir, "playtest-room-report.md")));

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

let envFallbacks = {};
const readEnv = (name, fallback = "") => String(process.env[name] || envFallbacks[name] || fallback || "").trim();
const ensureDir = async (targetPath = "") => {
  if (!targetPath) return;
  await fs.mkdir(targetPath, { recursive: true });
};

const writeJson = async (targetPath, data) => {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const normalizeName = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeRoomCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const participantKey = ({ name = "", uid = "" } = {}) => {
  const safeName = normalizeName(name);
  const safeUid = String(uid || "").trim();
  return safeName || safeUid || "unknown";
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?._seconds === "number") {
    return (value._seconds * 1000) + Math.floor(Number(value._nanoseconds || 0) / 1e6);
  }
  if (typeof value?.seconds === "number") {
    return (value.seconds * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  }
  return 0;
};

const toIso = (value) => {
  const ms = toMillis(value);
  return ms > 0 ? new Date(ms).toISOString() : null;
};

const safeDivide = (numerator, denominator) => {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return 0;
  return top / bottom;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
};

const formatPercent = (value) => `${round((Number(value || 0) * 100), 1)}%`;
const formatInTimeZone = (value, activeTimeZone = timezone) => {
  const ms = toMillis(value);
  if (!ms) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: activeTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(ms));
};

const summarizeCounts = (items = [], keyFn = (item) => item) => {
  const counts = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = String(keyFn(item) || "").trim();
    if (!key) return;
    counts.set(key, Math.max(0, Number(counts.get(key) || 0)) + 1);
  });
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
};

const topKeysByCountValue = (entries = [], valueSelector = (entry) => Number(entry?.count || 0), limit = 5) =>
  (Array.isArray(entries) ? entries : [])
    .slice()
    .sort((a, b) => Number(valueSelector(b) || 0) - Number(valueSelector(a) || 0))
    .slice(0, limit);

const summarizeDuplicateParticipants = (roomUsers = []) => {
  const byName = new Map();
  roomUsers.forEach((entry) => {
    const key = normalizeName(entry?.name || "");
    if (!key) return;
    const bucket = byName.get(key) || [];
    bucket.push(entry);
    byName.set(key, bucket);
  });
  return Array.from(byName.entries())
    .filter(([, bucket]) => bucket.length > 1)
    .map(([name, bucket]) => ({
      name,
      count: bucket.length,
      uids: bucket.map((entry) => String(entry?.uid || "").trim()).filter(Boolean),
    }))
    .sort((a, b) => b.count - a.count);
};

const collectIssue = (severity = "info", category = "note", detail = "", extra = {}) => ({
  severity,
  category,
  detail,
  ...extra,
});

const loadFirebaseAdmin = () => {
  try {
    return require("firebase-admin");
  } catch {
    try {
      return require(path.join(projectRoot, "functions", "node_modules", "firebase-admin"));
    } catch {
      return null;
    }
  }
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
  const inlinePayload = parseServiceAccountPayload(
    readEnv("FIREBASE_SERVICE_ACCOUNT_JSON")
    || readEnv("GOOGLE_SERVICE_ACCOUNT_JSON")
  );
  if (isServiceAccountPayload(inlinePayload)) return inlinePayload;

  const fileCandidates = [
    readEnv("FIREBASE_SERVICE_ACCOUNT_FILE"),
    readEnv("GOOGLE_SERVICE_ACCOUNT_FILE"),
    readEnv("GOOGLE_APPLICATION_CREDENTIALS"),
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
      // Try the next candidate.
    }
  }
  return null;
};

const resolveGcloudBinary = () => (process.platform === "win32" ? "gcloud.cmd" : "gcloud");

const resolveProjectId = async () => {
  const explicit = String(
    readArg("--project-id", "")
    || readEnv("GCLOUD_PROJECT")
    || readEnv("GOOGLE_CLOUD_PROJECT")
    || readEnv("FIREBASE_CONFIG_PROJECT_ID")
    || readEnv("SITEMAP_FIREBASE_PROJECT_ID")
  ).trim();
  if (explicit) return explicit;
  try {
    const { stdout } = await execFile(resolveGcloudBinary(), ["config", "get-value", "project"], {
      cwd: projectRoot,
      env: process.env,
      windowsHide: true,
    });
    return String(stdout || "").trim();
  } catch {
    return "";
  }
};

const initializeFirebaseAdmin = async (admin, projectId = "") => {
  if (!admin || admin.apps.length) return;

  const serviceAccount = await loadServiceAccount();
  if (serviceAccount && admin.credential?.cert) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      ...(projectId || serviceAccount.project_id
        ? { projectId: projectId || serviceAccount.project_id }
        : {}),
    });
    return;
  }

  if (projectId) {
    admin.initializeApp({ projectId });
    return;
  }

  admin.initializeApp();
};

const queryCollectionByRange = async (collectionRef, field, start, end) => {
  const snap = await collectionRef.where(field, ">=", start).where(field, "<=", end).get();
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

const readCloudLogs = async ({ projectId = "", filter = "", limit = logLimit }) => {
  if (!projectId || !filter) {
    return { ok: false, skipped: true, reason: "missing_project_or_filter", entries: [] };
  }
  try {
    const { stdout } = await execFile(resolveGcloudBinary(), [
      "logging",
      "read",
      filter,
      `--project=${projectId}`,
      `--limit=${Math.max(1, Number(limit || logLimit))}`,
      "--format=json",
    ], {
      cwd: projectRoot,
      env: process.env,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    const parsed = JSON.parse(String(stdout || "[]"));
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return { ok: true, entries };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: String(error?.message || error),
      entries: [],
    };
  }
};

const summarizeLogEntries = (entries = []) => {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const byService = summarizeCounts(
    safeEntries,
    (entry) => entry?.resource?.labels?.service_name || "unknown"
  ).slice(0, 10);
  return {
    count: safeEntries.length,
    byService,
    samples: safeEntries.slice(0, 8).map((entry) => ({
      timestamp: entry?.timestamp || "",
      severity: entry?.severity || "",
      service: entry?.resource?.labels?.service_name || "",
      textPayload: String(entry?.textPayload || entry?.jsonPayload?.message || "").trim().slice(0, 320),
    })),
  };
};

const buildRoomReport = ({
  roomCode = "",
  room = {},
  roomUsers = [],
  reactions = [],
  activities = [],
  chatMessages = [],
  songsQueued = [],
  songsPerformed = [],
  uploads = [],
  crowdSelfies = [],
  feedback = [],
  trackFeedbackDown = [],
  trackFeedbackUp = [],
  start,
  end,
}) => {
  const uniqueParticipantKeys = new Set(roomUsers.map((entry) => participantKey(entry)).filter(Boolean));
  const duplicateParticipants = summarizeDuplicateParticipants(roomUsers);
  const distinctParticipantNames = Array.from(
    new Set(roomUsers.map((entry) => normalizeName(entry?.name || "")).filter(Boolean))
  );

  const reactorKeys = new Set(reactions.map((entry) => participantKey({ name: entry?.userName, uid: entry?.uid })).filter(Boolean));
  const chatterKeys = new Set(chatMessages.map((entry) => participantKey({ name: entry?.userName, uid: entry?.uid })).filter(Boolean));
  const feedbackKeys = new Set(feedback.map((entry) => participantKey({ name: entry?.userName, uid: entry?.uid })).filter(Boolean));
  const requesterKeys = new Set(songsQueued.map((entry) => participantKey({ name: entry?.singerName, uid: entry?.singerUid })).filter(Boolean));
  const performerKeys = new Set(songsPerformed.map((entry) => participantKey({ name: entry?.singerName, uid: entry?.singerUid })).filter(Boolean));
  const audienceEngagedKeys = new Set([...reactorKeys, ...chatterKeys, ...feedbackKeys]);
  const totalReactionCount = reactions.reduce((sum, entry) => sum + Math.max(0, Number(entry?.count || 0) || 0), 0);
  const reactionCountByParticipant = new Map();
  reactions.forEach((entry) => {
    const key = participantKey({ name: entry?.userName, uid: entry?.uid });
    if (!key) return;
    reactionCountByParticipant.set(
      key,
      Math.max(0, Number(reactionCountByParticipant.get(key) || 0)) + Math.max(0, Number(entry?.count || 0) || 0)
    );
  });
  const topReactor = Array.from(reactionCountByParticipant.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)[0] || null;

  const reactionTypeBreakdown = Array.from(
    reactions.reduce((map, entry) => {
      const key = String(entry?.type || "unknown").trim() || "unknown";
      map.set(key, Math.max(0, Number(map.get(key) || 0)) + Math.max(0, Number(entry?.count || 0) || 0));
      return map;
    }, new Map()).entries()
  )
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const feedbackVibeScores = feedback.map((entry) => Number(entry?.vibeScore || 0)).filter((entry) => entry > 0);
  const feedbackReadabilityScores = feedback.map((entry) => Number(entry?.readabilityScore || 0)).filter((entry) => entry > 0);
  const avgVibeScore = feedbackVibeScores.length
    ? round(feedbackVibeScores.reduce((sum, value) => sum + value, 0) / feedbackVibeScores.length, 2)
    : 0;
  const avgReadabilityScore = feedbackReadabilityScores.length
    ? round(feedbackReadabilityScores.reduce((sum, value) => sum + value, 0) / feedbackReadabilityScores.length, 2)
    : 0;
  const lowFeedback = feedback.filter((entry) => Number(entry?.vibeScore || 0) <= 2 || Number(entry?.readabilityScore || 0) <= 2);

  const lyricsIssues = songsPerformed
    .filter((entry) => {
      const status = String(entry?.lyricsGenerationStatus || "").trim().toLowerCase();
      const resolution = String(entry?.lyricsGenerationResolution || "").trim().toLowerCase();
      const hasLyrics = !!String(entry?.lyrics || "").trim();
      return (
        status === "error"
        || status === "needs_user_token"
        || status === "capability_blocked"
        || status === "pending"
        || (!hasLyrics && resolution && resolution !== "catalog_text")
      );
    })
    .map((entry) => ({
      songTitle: entry?.songTitle || "",
      singerName: entry?.singerName || "",
      lyricsGenerationStatus: entry?.lyricsGenerationStatus || "",
      lyricsGenerationResolution: entry?.lyricsGenerationResolution || "",
    }));

  const issueList = [];
  if (duplicateParticipants.length) {
    issueList.push(collectIssue("warning", "identity_duplication", `${duplicateParticipants.length} duplicate participant name pattern(s) detected.`, { duplicates: duplicateParticipants }));
  }
  if (lyricsIssues.length) {
    issueList.push(collectIssue("warning", "lyrics_pipeline", `${lyricsIssues.length} performed song(s) had unresolved or degraded lyrics state.`, { songs: lyricsIssues.slice(0, 8) }));
  }
  if (trackFeedbackDown.length) {
    issueList.push(collectIssue("warning", "host_track_feedback", `${trackFeedbackDown.length} distinct track(s) were marked skip next time.`, { samples: trackFeedbackDown.slice(0, 6) }));
  }
  if (!chatMessages.length) {
    issueList.push(collectIssue("info", "coverage_gap", "No in-room chat messages were recorded."));
  }
  if (!uploads.length && !crowdSelfies.length) {
    issueList.push(collectIssue("info", "coverage_gap", "No upload or selfie flows were exercised."));
  }
  if (lowFeedback.length) {
    issueList.push(collectIssue("warning", "audience_feedback", `${lowFeedback.length} feedback submission(s) reported a low vibe/readability score.`, {
      samples: lowFeedback.slice(0, 6).map((entry) => ({
        userName: entry?.userName || "",
        vibeScore: entry?.vibeScore || 0,
        readabilityScore: entry?.readabilityScore || 0,
        summary: entry?.summary || "",
      })),
    }));
  }

  const timelineMs = [
    ...roomUsers.map((entry) => toMillis(entry?.lastActiveAt)),
    ...reactions.map((entry) => toMillis(entry?.timestamp)),
    ...activities.map((entry) => toMillis(entry?.timestamp)),
    ...chatMessages.map((entry) => toMillis(entry?.timestamp)),
    ...songsQueued.map((entry) => toMillis(entry?.timestamp)),
    ...songsPerformed.map((entry) => toMillis(entry?.performingStartedAt)),
    ...feedback.map((entry) => toMillis(entry?.createdAt)),
  ].filter((value) => value > 0);
  const firstEventMs = timelineMs.length ? Math.min(...timelineMs) : 0;
  const lastEventMs = timelineMs.length ? Math.max(...timelineMs) : 0;
  const activeMinutes = firstEventMs && lastEventMs
    ? round(Math.max(1, (lastEventMs - firstEventMs) / 60000), 1)
    : round((end.getTime() - start.getTime()) / 60000, 1);
  const activeHours = activeMinutes / 60;

  return {
    roomCode,
    roomName: String(room?.roomName || "").trim(),
    hostName: String(room?.hostName || "").trim(),
    hostUid: String(room?.hostUid || "").trim(),
    programMode: String(room?.programMode || "").trim(),
    window: {
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      firstEventUtc: firstEventMs ? new Date(firstEventMs).toISOString() : null,
      lastEventUtc: lastEventMs ? new Date(lastEventMs).toISOString() : null,
      firstEventLocal: firstEventMs ? formatInTimeZone(firstEventMs) : "",
      lastEventLocal: lastEventMs ? formatInTimeZone(lastEventMs) : "",
      activeMinutes,
    },
    metrics: {
      activeUserDocs: roomUsers.length,
      uniqueParticipants: uniqueParticipantKeys.size,
      duplicateDisplayNamePatterns: duplicateParticipants.length,
      audienceEngagedParticipants: audienceEngagedKeys.size,
      audienceEngagementRate: round(safeDivide(audienceEngagedKeys.size, uniqueParticipantKeys.size), 4),
      uniqueReactors: reactorKeys.size,
      reactorRate: round(safeDivide(reactorKeys.size, uniqueParticipantKeys.size), 4),
      uniqueChatters: chatterKeys.size,
      chatterRate: round(safeDivide(chatterKeys.size, uniqueParticipantKeys.size), 4),
      feedbackSubmitters: feedbackKeys.size,
      feedbackSubmitterRate: round(safeDivide(feedbackKeys.size, uniqueParticipantKeys.size), 4),
      songsQueued: songsQueued.length,
      uniqueRequesters: requesterKeys.size,
      requesterRate: round(safeDivide(requesterKeys.size, uniqueParticipantKeys.size), 4),
      songsPerformed: songsPerformed.length,
      uniquePerformers: performerKeys.size,
      queueAddsPerPerformance: round(safeDivide(songsQueued.length, songsPerformed.length), 4),
      performancesPerHour: round(safeDivide(songsPerformed.length, activeHours), 2),
      reactionBursts: reactions.length,
      reactionCount: totalReactionCount,
      reactionsPerActiveParticipant: round(safeDivide(totalReactionCount, uniqueParticipantKeys.size), 2),
      reactionsPerReactor: round(safeDivide(totalReactionCount, reactorKeys.size), 2),
      reactionsPerPerformance: round(safeDivide(totalReactionCount, songsPerformed.length), 2),
      topReactorShare: round(safeDivide(topReactor?.count || 0, totalReactionCount), 4),
      activityEvents: activities.length,
      chatMessages: chatMessages.length,
      uploads: uploads.length,
      crowdSelfies: crowdSelfies.length,
      hostTrackThumbsDown: trackFeedbackDown.length,
      hostTrackThumbsUp: trackFeedbackUp.length,
      avgFeedbackVibeScore: avgVibeScore,
      avgFeedbackReadabilityScore: avgReadabilityScore,
    },
    reactionTypeBreakdown,
    topReactors: topKeysByCountValue(
      Array.from(reactionCountByParticipant.entries()).map(([key, count]) => ({ key, count })),
      (entry) => entry?.count,
      5
    ),
    duplicateParticipants,
    distinctParticipantNames,
    topPerformances: songsPerformed
      .map((entry) => ({
        singerName: entry?.singerName || "",
        songTitle: entry?.songTitle || "",
        artist: entry?.artist || "",
        hypeScore: Number(entry?.hypeScore || 0) || 0,
        startedAt: toIso(entry?.performingStartedAt),
        lyricsGenerationStatus: entry?.lyricsGenerationStatus || "",
      }))
      .sort((a, b) => b.hypeScore - a.hypeScore)
      .slice(0, 8),
    feedbackSummary: {
      count: feedback.length,
      commonMoments: summarizeCounts(feedback, (entry) => entry?.moment || "").slice(0, 5),
      commonFixes: summarizeCounts(feedback, (entry) => entry?.fix || "").slice(0, 5),
      samples: feedback.slice(0, 8).map((entry) => ({
        userName: entry?.userName || "",
        vibeScore: Number(entry?.vibeScore || 0) || 0,
        readabilityScore: Number(entry?.readabilityScore || 0) || 0,
        summary: entry?.summary || "",
        extra: entry?.extra || "",
        fixNote: entry?.fixNote || "",
        createdAt: toIso(entry?.createdAt),
      })),
    },
    trackFeedbackSummary: {
      thumbsDown: trackFeedbackDown.length,
      thumbsUp: trackFeedbackUp.length,
      downSamples: trackFeedbackDown.slice(0, 6),
      upSamples: trackFeedbackUp.slice(0, 6),
    },
    issues: issueList,
  };
};

const buildMarkdownSummary = (report = {}) => {
  const lines = [];
  lines.push("# Playtest Room Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt || ""}`);
  lines.push(`Window: ${report.window?.startLocal || ""} -> ${report.window?.endLocal || ""}`);
  lines.push(`UTC: ${report.window?.startUtc || ""} -> ${report.window?.endUtc || ""}`);
  lines.push("");
  lines.push("## Overall");
  lines.push("");
  lines.push(`- Rooms active: ${report.totals?.rooms || 0}`);
  lines.push(`- Active user docs: ${report.totals?.activeUserDocs || 0}`);
  lines.push(`- Distinct participant names: ${report.totals?.distinctParticipantNames || 0}`);
  lines.push(`- Songs queued: ${report.totals?.songsQueued || 0}`);
  lines.push(`- Songs performed: ${report.totals?.songsPerformed || 0}`);
  lines.push(`- Reaction count: ${report.totals?.reactionCount || 0}`);
  lines.push(`- Feedback submissions: ${report.totals?.feedbackSubmissions || 0}`);
  lines.push("");
  lines.push("## Room Comparison");
  lines.push("");
  lines.push("| Room | Participants | Engaged | Reactions | Performances | Queue Adds/Performance | Reactions/Performance | Feedback | Key Issue |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  (report.rooms || []).forEach((room) => {
    const keyIssue = room?.issues?.[0]?.detail || "";
    lines.push(`| ${room.roomCode} | ${room.metrics?.uniqueParticipants || 0} | ${formatPercent(room.metrics?.audienceEngagementRate || 0)} | ${room.metrics?.reactionCount || 0} | ${room.metrics?.songsPerformed || 0} | ${room.metrics?.queueAddsPerPerformance || 0} | ${room.metrics?.reactionsPerPerformance || 0} | ${room.feedbackSummary?.count || 0} | ${keyIssue.replace(/\|/g, "/")} |`);
  });
  lines.push("");
  (report.rooms || []).forEach((room) => {
    lines.push(`## Room ${room.roomCode}`);
    lines.push("");
    lines.push(`- Name: ${room.roomName || "Untitled room"}`);
    lines.push(`- Host: ${room.hostName || "Unknown"}`);
    lines.push(`- Active span: ${room.window?.firstEventLocal || ""} -> ${room.window?.lastEventLocal || ""} (${room.window?.activeMinutes || 0} min)`);
    lines.push(`- Participants: ${room.metrics?.uniqueParticipants || 0} unique from ${room.metrics?.activeUserDocs || 0} room_user docs`);
    lines.push(`- Audience engagement: ${room.metrics?.audienceEngagedParticipants || 0} participants (${formatPercent(room.metrics?.audienceEngagementRate || 0)})`);
    lines.push(`- Reactors: ${room.metrics?.uniqueReactors || 0} (${formatPercent(room.metrics?.reactorRate || 0)}), ${room.metrics?.reactionCount || 0} total reactions`);
    lines.push(`- Queue / stage: ${room.metrics?.songsQueued || 0} queued, ${room.metrics?.songsPerformed || 0} performed, ${room.metrics?.queueAddsPerPerformance || 0} queue-adds/performance`);
    lines.push(`- Throughput: ${room.metrics?.performancesPerHour || 0} performances/hour, ${room.metrics?.reactionsPerPerformance || 0} reactions/performance`);
    lines.push(`- Feedback: ${room.feedbackSummary?.count || 0} submission(s), avg vibe ${room.metrics?.avgFeedbackVibeScore || 0}/5, avg readability ${room.metrics?.avgFeedbackReadabilityScore || 0}/5`);
    lines.push(`- Host track calls: ${room.metrics?.hostTrackThumbsUp || 0} up, ${room.metrics?.hostTrackThumbsDown || 0} down`);
    if (room.topPerformances?.length) {
      lines.push("- Top performances:");
      room.topPerformances.slice(0, 3).forEach((entry) => lines.push(`  - ${entry.singerName || "Singer"} - ${entry.songTitle || "Song"} (${entry.hypeScore || 0} hype)`));
    }
    if (room.feedbackSummary?.samples?.length) {
      lines.push("- Feedback samples:");
      room.feedbackSummary.samples.slice(0, 3).forEach((entry) => lines.push(`  - ${entry.userName || "Guest"}: ${entry.summary || "No summary."}`));
    }
    if (room.issues?.length) {
      lines.push("- Issues:");
      room.issues.forEach((entry) => lines.push(`  - [${entry.severity}] ${entry.detail}`));
    }
    lines.push("");
  });
  lines.push("## Runtime Issues");
  lines.push("");
  lines.push(`- Cloud Run errors: ${report.runtime?.cloudRunErrors?.count || 0}`);
  lines.push(`- App Check missing-token logs: ${report.runtime?.appCheckMissing?.count || 0}`);
  if (report.runtime?.cloudRunErrors?.byService?.length) {
    lines.push("- Error-heavy services:");
    report.runtime.cloudRunErrors.byService.slice(0, 5).forEach((entry) => lines.push(`  - ${entry.key}: ${entry.count}`));
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
};

const run = async () => {
  envFallbacks = await loadDotEnvFallbacks();
  Object.entries(envFallbacks).forEach(([key, value]) => {
    if (!process.env[key] && value) {
      process.env[key] = value;
    }
  });
  const admin = loadFirebaseAdmin();
  if (!admin) {
    throw new Error("firebase-admin is not available in this repository.");
  }

  const projectId = await resolveProjectId();
  await initializeFirebaseAdmin(admin, projectId);

  const db = admin.firestore();
  const root = db.collection("artifacts").doc(APP_ID).collection("public").doc("data");

  const [
    roomUsersRaw,
    reactionsRaw,
    activitiesRaw,
    chatMessagesRaw,
    queuedSongsRaw,
    performedSongsRaw,
    uploadsRaw,
    crowdSelfiesRaw,
    feedbackRaw,
    tracksAvoidedRaw,
    tracksPreferredRaw,
  ] = await Promise.all([
    queryCollectionByRange(root.collection("room_users"), "lastActiveAt", startAt, endAt),
    queryCollectionByRange(root.collection("reactions"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("activities"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("chat_messages"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("karaoke_songs"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("karaoke_songs"), "performingStartedAt", startAt, endAt),
    queryCollectionByRange(root.collection("room_uploads"), "timestamp", startAt, endAt),
    queryCollectionByRange(root.collection("crowd_selfie_submissions"), "timestamp", startAt, endAt),
    queryCollectionByRange(db.collection("feedback"), "createdAt", startAt, endAt),
    queryCollectionByRange(db.collection("tracks"), "lastAvoidedAt", startAt, endAt),
    queryCollectionByRange(db.collection("tracks"), "lastPositiveFeedbackAt", startAt, endAt),
  ]);

  const filtered = (items = []) => {
    if (!roomCodeFilter.length) return items;
    return items.filter((entry) => roomCodeFilter.includes(normalizeRoomCode(entry?.roomCode || entry?.lastAvoidedRoomCode || entry?.lastPositiveFeedbackRoomCode || "")));
  };

  const roomUsers = filtered(roomUsersRaw);
  const reactions = filtered(reactionsRaw);
  const activities = filtered(activitiesRaw);
  const chatMessages = filtered(chatMessagesRaw);
  const queuedSongs = filtered(queuedSongsRaw);
  const performedSongs = filtered(performedSongsRaw);
  const uploads = filtered(uploadsRaw);
  const crowdSelfies = filtered(crowdSelfiesRaw);
  const feedback = filtered(feedbackRaw);
  const tracksAvoided = roomCodeFilter.length
    ? tracksAvoidedRaw.filter((entry) => roomCodeFilter.includes(normalizeRoomCode(entry?.lastAvoidedRoomCode || "")))
    : tracksAvoidedRaw;
  const tracksPreferred = roomCodeFilter.length
    ? tracksPreferredRaw.filter((entry) => roomCodeFilter.includes(normalizeRoomCode(entry?.lastPositiveFeedbackRoomCode || "")))
    : tracksPreferredRaw;

  const activeRoomCodes = new Set();
  [roomUsers, reactions, activities, chatMessages, queuedSongs, performedSongs, uploads, crowdSelfies, feedback].forEach((collection) => {
    collection.forEach((entry) => {
      const roomCode = normalizeRoomCode(entry?.roomCode || "");
      if (roomCode) activeRoomCodes.add(roomCode);
    });
  });
  if (roomCodeFilter.length) {
    roomCodeFilter.forEach((entry) => activeRoomCodes.add(entry));
  }

  const roomDocs = new Map();
  for (const roomCode of Array.from(activeRoomCodes).sort()) {
    const roomSnap = await root.collection("rooms").doc(roomCode).get();
    roomDocs.set(roomCode, roomSnap.exists ? roomSnap.data() || {} : {});
  }

  const roomReports = Array.from(activeRoomCodes).sort().map((roomCode) => buildRoomReport({
    roomCode,
    room: roomDocs.get(roomCode) || {},
    roomUsers: roomUsers.filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode),
    reactions: reactions.filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode),
    activities: activities.filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode),
    chatMessages: chatMessages.filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode),
    songsQueued: queuedSongs.filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode),
    songsPerformed: performedSongs.filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode),
    uploads: uploads.filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode),
    crowdSelfies: crowdSelfies.filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode),
    feedback: feedback.filter((entry) => normalizeRoomCode(entry?.roomCode || "") === roomCode),
    trackFeedbackDown: tracksAvoided.filter((entry) => normalizeRoomCode(entry?.lastAvoidedRoomCode || "") === roomCode).map((entry) => ({
      trackId: entry?.id || "",
      lastAvoidedAt: toIso(entry?.lastAvoidedAt),
      globalFeedbackState: entry?.globalFeedbackState || "",
      globalAvoidRoomCount: Number(entry?.globalAvoidRoomCount || 0) || 0,
    })),
    trackFeedbackUp: tracksPreferred.filter((entry) => normalizeRoomCode(entry?.lastPositiveFeedbackRoomCode || "") === roomCode).map((entry) => ({
      trackId: entry?.id || "",
      lastPositiveFeedbackAt: toIso(entry?.lastPositiveFeedbackAt),
    })),
    start: startAt,
    end: endAt,
  })).sort((a, b) => (b.metrics?.reactionCount || 0) - (a.metrics?.reactionCount || 0));

  const cloudRunErrorFilter = [
    'resource.type="cloud_run_revision"',
    `timestamp>="${startAt.toISOString()}"`,
    `timestamp<="${endAt.toISOString()}"`,
    "severity>=ERROR",
  ].join(" AND ");
  const appCheckMissingFilter = [
    'resource.type="cloud_run_revision"',
    `timestamp>="${startAt.toISOString()}"`,
    `timestamp<="${endAt.toISOString()}"`,
    'textPayload:"[app-check]"',
  ].join(" AND ");

  const [cloudRunErrors, appCheckMissing] = skipCloudLogs
    ? [
      { ok: false, skipped: true, reason: "skip_cloud_logs", entries: [] },
      { ok: false, skipped: true, reason: "skip_cloud_logs", entries: [] },
    ]
    : await Promise.all([
      readCloudLogs({ projectId, filter: cloudRunErrorFilter, limit: logLimit }),
      readCloudLogs({ projectId, filter: appCheckMissingFilter, limit: logLimit }),
    ]);

  const totals = {
    rooms: roomReports.length,
    activeUserDocs: roomUsers.length,
    distinctParticipantNames: Array.from(new Set(roomUsers.map((entry) => normalizeName(entry?.name || "")).filter(Boolean))).length,
    songsQueued: queuedSongs.length,
    songsPerformed: performedSongs.length,
    reactionBursts: reactions.length,
    reactionCount: reactions.reduce((sum, entry) => sum + Math.max(0, Number(entry?.count || 0) || 0), 0),
    activityEvents: activities.length,
    chatMessages: chatMessages.length,
    feedbackSubmissions: feedback.length,
    crowdSelfies: crowdSelfies.length,
    uploads: uploads.length,
  };

  const crossRoomDuplicateNames = summarizeDuplicateParticipants(roomUsers);
  const overallIssues = [];
  if (crossRoomDuplicateNames.length) {
    overallIssues.push(collectIssue("warning", "identity_duplication", `${crossRoomDuplicateNames.length} duplicate participant name pattern(s) appeared across the reporting window.`, { duplicates: crossRoomDuplicateNames }));
  }
  if ((cloudRunErrors.entries || []).length) {
    overallIssues.push(collectIssue("warning", "runtime_errors", `${cloudRunErrors.entries.length} Cloud Run error log(s) were recorded in the same window.`, { samples: summarizeLogEntries(cloudRunErrors.entries).samples }));
  }
  if ((appCheckMissing.entries || []).length) {
    overallIssues.push(collectIssue("info", "app_check", `${appCheckMissing.entries.length} App Check missing-token log(s) were recorded.`, { samples: summarizeLogEntries(appCheckMissing.entries).samples }));
  }

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    projectId,
    timezone,
    window: {
      startUtc: startAt.toISOString(),
      endUtc: endAt.toISOString(),
      startLocal: formatInTimeZone(startAt),
      endLocal: formatInTimeZone(endAt),
    },
    filters: {
      roomCodes: roomCodeFilter,
      skipCloudLogs,
    },
    totals,
    rooms: roomReports,
    feedback: {
      count: feedback.length,
      byRoom: summarizeCounts(feedback, (entry) => normalizeRoomCode(entry?.roomCode || "")),
      commonMoments: summarizeCounts(feedback, (entry) => entry?.moment || "").slice(0, 8),
      commonFixes: summarizeCounts(feedback, (entry) => entry?.fix || "").slice(0, 8),
      samples: feedback.slice(0, 10).map((entry) => ({
        roomCode: normalizeRoomCode(entry?.roomCode || ""),
        userName: entry?.userName || "",
        vibeScore: Number(entry?.vibeScore || 0) || 0,
        readabilityScore: Number(entry?.readabilityScore || 0) || 0,
        summary: entry?.summary || "",
        extra: entry?.extra || "",
        fixNote: entry?.fixNote || "",
        createdAt: toIso(entry?.createdAt),
      })),
    },
    runtime: {
      cloudRunErrors: summarizeLogEntries(cloudRunErrors.entries),
      appCheckMissing: summarizeLogEntries(appCheckMissing.entries),
      cloudLogStatus: {
        cloudRunErrors: cloudRunErrors.ok ? "ok" : (cloudRunErrors.skipped ? "skipped" : "error"),
        appCheckMissing: appCheckMissing.ok ? "ok" : (appCheckMissing.skipped ? "skipped" : "error"),
        cloudRunErrorsReason: cloudRunErrors.reason || "",
        appCheckMissingReason: appCheckMissing.reason || "",
      },
    },
    issues: overallIssues,
  };

  await writeJson(reportPath, report);
  await ensureDir(path.dirname(summaryPath));
  await fs.writeFile(summaryPath, buildMarkdownSummary(report), "utf8");

  console.log(JSON.stringify({
    ok: true,
    reportPath,
    summaryPath,
    rooms: report.rooms.map((entry) => ({
      roomCode: entry.roomCode,
      uniqueParticipants: entry.metrics?.uniqueParticipants || 0,
      reactionCount: entry.metrics?.reactionCount || 0,
      songsPerformed: entry.metrics?.songsPerformed || 0,
      feedback: entry.feedbackSummary?.count || 0,
    })),
    runtime: {
      cloudRunErrors: report.runtime?.cloudRunErrors?.count || 0,
      appCheckMissing: report.runtime?.appCheckMissing?.count || 0,
    },
  }, null, 2));
};

run().catch(async (error) => {
  const failure = {
    ok: false,
    generatedAt: new Date().toISOString(),
    error: String(error?.message || error),
    window: {
      startUtc: startAt.toISOString(),
      endUtc: endAt.toISOString(),
    },
  };
  try {
    await writeJson(reportPath, failure);
  } catch {
    // Best effort during fatal exit.
  }
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
});
