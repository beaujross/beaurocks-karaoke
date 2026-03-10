#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");
const APP_ID = "bross-app";
const DEFAULT_LOOKBACK_HOURS = 24;
const DEFAULT_LIMIT = 150;

const {
  classifyLyricsPipeline,
  classifyPopTriviaPipeline,
} = require(path.join(projectRoot, "functions", "lib", "asyncPipelineDiagnostics.js"));

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArg = (flag, fallback = "") => {
  const idx = args.indexOf(flag);
  if (idx < 0) return fallback;
  return args[idx + 1] || fallback;
};

const usage = `
Usage:
  node scripts/ops/async-pipeline-audit.mjs

Options:
  --lookback-hours <n>   Lookback window for issue samples (default: ${DEFAULT_LOOKBACK_HOURS})
  --limit <n>            Max docs to scan per query (default: ${DEFAULT_LIMIT})
  --report <path>        Optional JSON output path
  --help                 Show this help
`;

if (hasFlag("--help")) {
  console.log(usage.trim());
  process.exit(0);
}

const clampPositiveInt = (value, fallback) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const lookbackHours = clampPositiveInt(readArg("--lookback-hours", DEFAULT_LOOKBACK_HOURS), DEFAULT_LOOKBACK_HOURS);
const limit = clampPositiveInt(readArg("--limit", DEFAULT_LIMIT), DEFAULT_LIMIT);
const reportPath = String(readArg("--report", "") || "").trim();
const nowMs = Date.now();
const lookbackMs = lookbackHours * 60 * 60 * 1000;

const readEnv = (name, fallback = "") => String(process.env[name] || fallback || "").trim();

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
      // Ignore this candidate and continue.
    }
  }
  return null;
};

const initializeFirebaseAdmin = async (admin) => {
  if (!admin || admin.apps.length) return;

  const explicitProjectId = readEnv("GCLOUD_PROJECT")
    || readEnv("GOOGLE_CLOUD_PROJECT")
    || readEnv("FIREBASE_CONFIG_PROJECT_ID");
  const serviceAccount = await loadServiceAccount();

  if (serviceAccount && admin.credential?.cert) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      ...(explicitProjectId || serviceAccount.project_id
        ? { projectId: explicitProjectId || serviceAccount.project_id }
        : {}),
    });
    return;
  }

  if (explicitProjectId) {
    admin.initializeApp({ projectId: explicitProjectId });
    return;
  }

  admin.initializeApp();
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
};

const sanitizeIssueEntry = (entry = {}) => ({
  songDocId: entry.songDocId || "",
  roomCode: entry.roomCode || "",
  songTitle: entry.songTitle || "",
  artist: entry.artist || "",
  singerName: entry.singerName || "",
  songStatus: entry.songStatus || "",
  issueCode: entry.issueCode || "",
  ageMinutes: entry.ageMinutes || 0,
  recoveryEligible: !!entry.recoveryEligible,
  summary: entry.summary || "",
  status: entry.status || "",
  resolution: entry.resolution || "",
  source: entry.source || "",
  providerTraceSummary: entry.providerTraceSummary || "",
});

const appendIssueCounts = (counts = {}, entries = []) => {
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (!entry?.issueCode) return;
    counts[entry.issueCode] = Math.max(0, Number(counts[entry.issueCode] || 0)) + 1;
  });
  return counts;
};

const summarizeRoomIssueCounts = (entries = []) => {
  const roomCounts = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const roomCode = String(entry?.roomCode || "").trim() || "UNKNOWN";
    roomCounts.set(roomCode, Math.max(0, Number(roomCounts.get(roomCode) || 0)) + 1);
  });
  return Array.from(roomCounts.entries())
    .map(([roomCode, count]) => ({ roomCode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

const collectDocsByField = async (collectionRef, field = "", queryLimit = limit) => {
  const safeField = String(field || "").trim();
  if (!safeField) return [];
  try {
    const snap = await collectionRef.orderBy(safeField, "desc").limit(queryLimit).get();
    return snap.docs;
  } catch (error) {
    return [{
      __queryError: true,
      field: safeField,
      message: String(error?.message || error),
    }];
  }
};

const run = async () => {
  const admin = loadFirebaseAdmin();
  if (!admin) {
    const result = {
      ok: false,
      skipped: true,
      reason: "firebase_admin_unavailable",
      generatedAt: new Date().toISOString(),
    };
    if (reportPath) {
      await fs.mkdir(path.dirname(path.resolve(reportPath)), { recursive: true });
      await fs.writeFile(path.resolve(reportPath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  await initializeFirebaseAdmin(admin);
  const db = admin.firestore();
  const songsRef = db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("karaoke_songs");
  const lookbackCutoffMs = nowMs - lookbackMs;

  const [lyricsUpdatedDocs, lyricsTimestampDocs, popTriviaUpdatedDocs, popTriviaGeneratedDocs] = await Promise.all([
    collectDocsByField(songsRef, "lyricsGenerationUpdatedAt", limit),
    collectDocsByField(songsRef, "timestamp", limit),
    collectDocsByField(songsRef, "popTriviaUpdatedAt", limit),
    collectDocsByField(songsRef, "popTriviaGeneratedAt", limit),
  ]);

  const queryErrors = [lyricsUpdatedDocs, lyricsTimestampDocs, popTriviaUpdatedDocs, popTriviaGeneratedDocs]
    .flat()
    .filter((entry) => entry?.__queryError)
    .map((entry) => ({
      field: entry.field,
      message: entry.message,
    }));

  const docMap = new Map();
  [lyricsUpdatedDocs, lyricsTimestampDocs, popTriviaUpdatedDocs, popTriviaGeneratedDocs]
    .flat()
    .filter((entry) => !entry?.__queryError && entry?.id)
    .forEach((docSnap) => {
      docMap.set(docSnap.id, docSnap);
    });

  const lyricsIssues = [];
  const popTriviaIssues = [];

  for (const docSnap of docMap.values()) {
    const data = docSnap.data() || {};
    const baselineUpdatedAtMs = Math.max(
      0,
      toMillis(data?.lyricsGenerationUpdatedAt),
      toMillis(data?.popTriviaUpdatedAt),
      toMillis(data?.popTriviaGeneratedAt),
      Number(data?.popTriviaRequestedAtMs || 0),
      toMillis(data?.timestamp)
    );
    if (baselineUpdatedAtMs > 0 && baselineUpdatedAtMs < lookbackCutoffMs) continue;

    const lyricsState = classifyLyricsPipeline(data, { now: nowMs });
    if (lyricsState.hasIssue) {
      lyricsIssues.push(sanitizeIssueEntry({
        songDocId: docSnap.id,
        roomCode: data.roomCode,
        songTitle: data.songTitle,
        artist: data.artist,
        singerName: data.singerName,
        songStatus: data.status,
        ...lyricsState,
      }));
    }

    const popTriviaState = classifyPopTriviaPipeline(data, { now: nowMs });
    if (popTriviaState.hasIssue) {
      popTriviaIssues.push(sanitizeIssueEntry({
        songDocId: docSnap.id,
        roomCode: data.roomCode,
        songTitle: data.songTitle,
        artist: data.artist,
        singerName: data.singerName,
        songStatus: data.status,
        ...popTriviaState,
      }));
    }
  }

  lyricsIssues.sort((a, b) => b.ageMinutes - a.ageMinutes);
  popTriviaIssues.sort((a, b) => b.ageMinutes - a.ageMinutes);

  const credentialsUnavailable = queryErrors.length >= 4
    && docMap.size === 0
    && queryErrors.every((entry) => String(entry?.message || "").toLowerCase().includes("default credentials"));

  const result = {
    ok: true,
    skipped: credentialsUnavailable,
    reason: credentialsUnavailable ? "missing_firestore_credentials" : "",
    generatedAt: new Date().toISOString(),
    lookbackHours,
    lookbackCutoffMs,
    scannedDocs: docMap.size,
    queryErrors,
    lyrics: {
      totalIssues: lyricsIssues.length,
      issueCounts: appendIssueCounts({}, lyricsIssues),
      recoveryEligible: lyricsIssues.filter((entry) => entry.recoveryEligible).length,
      topRooms: summarizeRoomIssueCounts(lyricsIssues),
      samples: lyricsIssues.slice(0, 20),
    },
    popTrivia: {
      totalIssues: popTriviaIssues.length,
      issueCounts: appendIssueCounts({}, popTriviaIssues),
      recoveryEligible: popTriviaIssues.filter((entry) => entry.recoveryEligible).length,
      topRooms: summarizeRoomIssueCounts(popTriviaIssues),
      samples: popTriviaIssues.slice(0, 20),
    },
  };

  if (reportPath) {
    const resolved = path.resolve(reportPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(result, null, 2));
};

run().catch(async (error) => {
  const failure = {
    ok: false,
    generatedAt: new Date().toISOString(),
    error: String(error?.message || error),
  };
  if (reportPath) {
    const resolved = path.resolve(reportPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true }).catch(() => {});
    await fs.writeFile(resolved, `${JSON.stringify(failure, null, 2)}\n`, "utf8").catch(() => {});
  }
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
});
