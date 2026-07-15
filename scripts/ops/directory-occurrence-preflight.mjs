#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");
const { isWeeklyRecurringRule } = require(
  path.join(projectRoot, "functions", "lib", "directoryOccurrences.js"),
);

const args = process.argv.slice(2);
const readArg = (flag, fallback = "") => {
  const index = args.indexOf(flag);
  return index >= 0 ? (args[index + 1] || fallback) : fallback;
};
const hasFlag = (flag) => args.includes(flag);
const clampLimit = (value, fallback = 500) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : fallback;
};
const usage = `
Usage:
  node scripts/ops/directory-occurrence-preflight.mjs --project <firebase-project-id>

Options:
  --project <id>    Firebase project ID (or use GCLOUD_PROJECT)
  --limit <n>       Maximum records scanned per collection (default: 500, max: 1000)
  --report <path>   Optional JSON report output
  --help            Show this help

This command is read-only. It never writes to Firestore.
`;

if (hasFlag("--help")) {
  console.log(usage.trim());
  process.exit(0);
}

const projectId = String(
  readArg("--project", process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || ""),
).trim();
const limit = clampLimit(readArg("--limit", "500"));
const reportPath = String(readArg("--report", "") || "").trim();

const loadFirebaseAdmin = () => {
  try {
    return require("firebase-admin");
  } catch {
    return require(path.join(projectRoot, "functions", "node_modules", "firebase-admin"));
  }
};

const isValidTimezone = (value = "") => {
  const timezone = String(value || "").trim();
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const readCollection = async (db, collectionName) => {
  const snapshot = await db.collection(collectionName).limit(limit).get();
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data() || {},
  }));
};

const toListingSummary = (collectionName, entry) => {
  const data = entry.data || {};
  const startsAtMs = Math.max(
    0,
    Number(data.seriesAnchorStartsAtMs || data.startsAtMs || 0) || 0,
  );
  const timezone = String(data.recurrenceTimezone || data.timezone || "").trim();
  return {
    collection: collectionName,
    id: entry.id,
    title: String(data.title || data.venueName || "").trim().slice(0, 160),
    nightSeriesId: String(data.nightSeriesId || "").trim().slice(0, 180),
    startsAtMs,
    timezone,
    visibility: String(data.visibility || "").trim(),
    recurringRule: String(data.recurringRule || "").trim(),
    issues: [
      ...(startsAtMs > 0 ? [] : ["missing_anchor"]),
      ...(isValidTimezone(timezone) ? [] : ["missing_or_invalid_timezone"]),
      ...(Number(data.endsAtMs || 0) > startsAtMs ? [] : ["missing_or_invalid_end"]),
    ],
  };
};

const run = async () => {
  if (!projectId) {
    throw new Error("A Firebase project ID is required. Pass --project or set GCLOUD_PROJECT.");
  }
  const admin = loadFirebaseAdmin();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }
  const db = admin.firestore();
  const [events, sessions, series, occurrences] = await Promise.all([
    readCollection(db, "karaoke_events"),
    readCollection(db, "room_sessions"),
    readCollection(db, "night_series"),
    readCollection(db, "night_occurrences"),
  ]);

  const approvedWeeklyListings = [
    ...events
      .filter((entry) => entry.data.status === "approved" && isWeeklyRecurringRule(entry.data.recurringRule))
      .map((entry) => toListingSummary("karaoke_events", entry)),
    ...sessions
      .filter((entry) => entry.data.status === "approved" && isWeeklyRecurringRule(entry.data.recurringRule))
      .map((entry) => toListingSummary("room_sessions", entry)),
  ];
  const referencedSeriesIds = new Map();
  approvedWeeklyListings.forEach((listing) => {
    if (!listing.nightSeriesId) return;
    const references = referencedSeriesIds.get(listing.nightSeriesId) || [];
    references.push(`${listing.collection}/${listing.id}`);
    referencedSeriesIds.set(listing.nightSeriesId, references);
  });

  const duplicateSeriesReferences = Array.from(referencedSeriesIds.entries())
    .filter(([, references]) => references.length > 1)
    .map(([nightSeriesId, references]) => ({ nightSeriesId, references }));
  const referencedSeriesSnapshots = new Map(await Promise.all(
    Array.from(referencedSeriesIds.keys()).map(async (nightSeriesId) => {
      const snapshot = await db.collection("night_series").doc(nightSeriesId).get();
      return [nightSeriesId, snapshot.exists];
    }),
  ));
  const missingSeriesReferences = approvedWeeklyListings
    .filter((listing) => (
      listing.nightSeriesId
      && referencedSeriesSnapshots.get(listing.nightSeriesId) !== true
    ))
    .map((listing) => ({
      nightSeriesId: listing.nightSeriesId,
      source: `${listing.collection}/${listing.id}`,
    }));
  const invalidListings = approvedWeeklyListings.filter((listing) => listing.issues.length > 0);
  const activeSeries = series.filter((entry) => entry.data.active === true);
  const activeSeriesSourceChecks = await Promise.all(activeSeries.map(async (entry) => {
    const sourceCollection = String(entry.data.sourceCollection || "").trim();
    const sourceListingId = String(entry.data.sourceListingId || "").trim();
    if (!["karaoke_events", "room_sessions"].includes(sourceCollection) || !sourceListingId) {
      return { seriesId: entry.id, exists: false };
    }
    const sourceSnapshot = await db.collection(sourceCollection).doc(sourceListingId).get();
    return { seriesId: entry.id, exists: sourceSnapshot.exists };
  }));
  const seriesWithoutSource = activeSeriesSourceChecks
    .filter((entry) => !entry.exists)
    .map((entry) => entry.seriesId);
  const occurrenceStatusCounts = occurrences.reduce((counts, entry) => {
    const status = String(entry.data.status || "unknown").trim() || "unknown";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const blockers = [];
  if (invalidListings.length) blockers.push("invalid_weekly_listing_schedule");
  if (duplicateSeriesReferences.length) blockers.push("duplicate_series_reference");
  if (missingSeriesReferences.length) blockers.push("missing_series_document");
  if (seriesWithoutSource.length) blockers.push("active_series_missing_source");
  const report = {
    ok: blockers.length === 0,
    readOnly: true,
    projectId,
    generatedAt: new Date().toISOString(),
    scanLimitPerCollection: limit,
    scanned: {
      karaokeEvents: events.length,
      roomSessions: sessions.length,
      nightSeries: series.length,
      nightOccurrences: occurrences.length,
    },
    counts: {
      approvedWeeklyListings: approvedWeeklyListings.length,
      invalidWeeklyListings: invalidListings.length,
      activeSeries: activeSeries.length,
      missingSeriesReferences: missingSeriesReferences.length,
      duplicateSeriesReferences: duplicateSeriesReferences.length,
      activeSeriesMissingSource: seriesWithoutSource.length,
      occurrenceStatusCounts,
    },
    blockers,
    invalidListings,
    missingSeriesReferences,
    duplicateSeriesReferences,
    seriesWithoutSource,
    canaryCandidates: activeSeries.slice(0, 10).map((entry) => entry.id),
    notes: [
      "A clean report is a release gate, not permission to deploy.",
      "If any collection reaches the scan limit, rerun with --limit 1000 and verify coverage.",
      "Use one or two reviewed active series IDs for the first canary.",
    ],
  };

  if (reportPath) {
    const absoluteReportPath = path.resolve(reportPath);
    await fs.mkdir(path.dirname(absoluteReportPath), { recursive: true });
    await fs.writeFile(absoluteReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 2;
};

run().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    readOnly: true,
    projectId,
    error: String(error?.message || error || "unknown_error"),
  }, null, 2));
  process.exitCode = 1;
});
