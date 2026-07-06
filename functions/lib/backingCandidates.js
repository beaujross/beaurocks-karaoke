"use strict";

const admin = require("firebase-admin");

const BACKING_FEEDBACK_EVENTS_COLLECTION = "backing_feedback_events";
const BACKING_CANDIDATES_SUBCOLLECTION = "backing_candidates";

const defaultExtractYouTubeId = (input = "") => {
  if (!input) return "";
  const match = String(input || "").match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : "";
};

const sanitizeBackingDocId = (value = "") => String(value || "")
  .trim()
  .replace(/[/\\]+/g, "__")
  .replace(/[^A-Za-z0-9_.:-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 260);

const buildBackingCandidateDocId = ({
  songId = "",
  source = "",
  mediaUrl = "",
  appleMusicId = "",
  backingCandidateId = "",
  extractYouTubeId = defaultExtractYouTubeId,
} = {}) => {
  const explicitId = sanitizeBackingDocId(backingCandidateId);
  if (explicitId) return explicitId;
  const provider = String(source || (appleMusicId ? "apple" : extractYouTubeId(mediaUrl) ? "youtube" : "custom")).trim().toLowerCase() || "custom";
  const providerTrackId = provider === "youtube"
    ? extractYouTubeId(mediaUrl)
    : provider === "apple"
      ? String(appleMusicId || "").trim()
      : String(mediaUrl || "custom").trim();
  return sanitizeBackingDocId(`${songId}__${provider}__${providerTrackId}`);
};

const normalizeBackingTelemetryForAdmin = (value = {}) => {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const count = (next) => Math.max(0, Math.round(Number(next || 0) || 0));
  return {
    hostUpvotes: count(input.hostUpvotes),
    hostDownvotes: count(input.hostDownvotes),
    coHostUpvotes: count(input.coHostUpvotes || input.cohostUpvotes),
    coHostDownvotes: count(input.coHostDownvotes || input.cohostDownvotes),
    audienceUpvotes: count(input.audienceUpvotes),
    audienceDownvotes: count(input.audienceDownvotes),
    usageCount: count(input.usageCount),
    completionCount: count(input.completionCount),
    skipCount: count(input.skipCount),
  };
};

const buildBackingTelemetryIncrementPatch = ({ rating = "up", actorRole = "host" } = {}) => {
  const safeRating = String(rating || "up").trim().toLowerCase();
  const safeRole = String(actorRole || "host").trim().toLowerCase();
  const increment = admin.firestore.FieldValue.increment;
  const telemetry = {
    usageCount: increment(1),
    [safeRating === "down" ? "skipCount" : "completionCount"]: increment(1),
  };
  if (safeRole === "audience") {
    telemetry[safeRating === "down" ? "audienceDownvotes" : "audienceUpvotes"] = increment(1);
  } else if (safeRole === "co_host" || safeRole === "cohost") {
    telemetry[safeRating === "down" ? "coHostDownvotes" : "coHostUpvotes"] = increment(1);
  } else {
    telemetry[safeRating === "down" ? "hostDownvotes" : "hostUpvotes"] = increment(1);
  }
  return { telemetry };
};


const buildCanonicalBackingCandidatePatchFromYouTubeIndexEntry = ({
  entry = {},
  roomCode = "",
  actorUid = "",
  sourceDiscovery = "trusted_catalog",
  timestamp = null,
  extractYouTubeId = defaultExtractYouTubeId,
} = {}) => {
  const input = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
  const videoId = String(input.videoId || input.providerTrackId || input.id || extractYouTubeId(input.url || input.mediaUrl || "")).trim();
  const canonicalSongId = String(input.canonicalSongId || input.songId || "").trim().slice(0, 220);
  if (!canonicalSongId || !videoId) return null;
  if (input.playable !== true || input.embeddable !== true || input.youtubePlaybackStatus === "blocked") return null;
  const mediaUrl = String(input.mediaUrl || input.url || `https://www.youtube.com/watch?v=${videoId}`).trim();
  const candidateId = buildBackingCandidateDocId({
    songId: canonicalSongId,
    source: "youtube",
    mediaUrl,
    backingCandidateId: input.backingCandidateId || "",
    extractYouTubeId,
  });
  if (!candidateId) return null;
  const timestampValue = timestamp || admin.firestore.FieldValue.serverTimestamp();
  const usageCount = Math.max(0, Math.round(Number(input.usageCount || 0) || 0));
  const successCount = Math.max(0, Math.round(Number(input.successCount || 0) || 0));
  const failureCount = Math.max(0, Math.round(Number(input.failureCount || 0) || 0));
  const inputTelemetry = input.backingTelemetry && typeof input.backingTelemetry === "object" && !Array.isArray(input.backingTelemetry)
    ? input.backingTelemetry
    : {};
  const telemetry = normalizeBackingTelemetryForAdmin({
    ...inputTelemetry,
    usageCount: Math.max(usageCount, Number(inputTelemetry.usageCount || 0) || 0),
    completionCount: Math.max(successCount, Number(inputTelemetry.completionCount || 0) || 0),
    skipCount: Math.max(failureCount, Number(inputTelemetry.skipCount || 0) || 0),
  });
  const rankingScore = Number(input.rankingScore);
  const qualityScore = Number(input.qualityScore);
  return {
    songId: canonicalSongId,
    candidateId,
    data: {
      candidateId,
      songId: canonicalSongId,
      canonicalSongId,
      title: String(input.trackName || input.title || "").trim().slice(0, 220),
      artist: String(input.artistName || input.artist || input.channelTitle || input.channel || "YouTube").trim().slice(0, 220) || "YouTube",
      provider: "youtube",
      providerTrackId: videoId,
      videoId,
      mediaUrl,
      thumbnailUrl: String(input.thumbnailUrl || input.artworkUrl100 || input.thumbnail || "").trim().slice(0, 700),
      artworkUrl100: String(input.artworkUrl100 || input.thumbnailUrl || input.thumbnail || "").trim().slice(0, 700),
      appleMusicId: String(input.appleMusicId || "").trim().slice(0, 220),
      label: String(input.sourceDetail || input.label || "Indexed YouTube backing").trim().slice(0, 240) || "Indexed YouTube backing",
      sourceDiscovery: String(sourceDiscovery || input.sourceDiscovery || "trusted_catalog").trim().slice(0, 80) || "trusted_catalog",
      sourceDetail: String(input.sourceDetail || "Indexed YouTube backing from a trusted room library.").trim().slice(0, 240),
      sourceRoomCode: String(roomCode || input.roomCode || "").trim().slice(0, 40),
      lastIndexedByUid: String(actorUid || input.updatedByUid || "").trim().slice(0, 160),
      backingOnly: true,
      playable: input.playable !== false,
      embeddable: input.embeddable !== false,
      youtubePlaybackStatus: String(input.youtubePlaybackStatus || "").trim().slice(0, 80),
      uploadStatus: String(input.uploadStatus || "").trim().slice(0, 80),
      privacyStatus: String(input.privacyStatus || "").trim().slice(0, 80),
      qualityScore: Number.isFinite(qualityScore) ? Math.max(0, qualityScore) : null,
      rankingScore: Number.isFinite(rankingScore) ? Math.max(0, rankingScore) : null,
      telemetry,
      usageCount,
      successCount,
      failureCount,
      lastVerifiedAt: timestampValue,
      lastIndexedAt: timestampValue,
      updatedAt: timestampValue,
      createdAt: timestampValue,
    },
  };
};

const upsertCanonicalBackingCandidateFromYouTubeIndexTx = (tx, {
  entry = {},
  roomCode = "",
  actorUid = "",
  sourceDiscovery = "trusted_catalog",
  timestamp = null,
} = {}) => {
  const candidate = buildCanonicalBackingCandidatePatchFromYouTubeIndexEntry({
    entry,
    roomCode,
    actorUid,
    sourceDiscovery,
    timestamp,
  });
  if (!candidate) return null;
  const candidateRef = admin.firestore()
    .collection("songs")
    .doc(candidate.songId)
    .collection(BACKING_CANDIDATES_SUBCOLLECTION)
    .doc(candidate.candidateId);
  const data = { ...candidate.data };
  if (roomCode) data.sourceRoomCodes = admin.firestore.FieldValue.arrayUnion(roomCode);
  tx.set(candidateRef, data, { merge: true });
  return { candidateRef, candidateId: candidate.candidateId, songId: candidate.songId };
};

const recordCanonicalBackingFeedbackAdmin = async ({
  rating = "up",
  actorUid = "",
  actorRole = "host",
  roomCode = "",
  songId = "",
  title = "",
  artist = "",
  trackId = "",
  source = "",
  mediaUrl = "",
  appleMusicId = "",
  backingCandidateId = "",
  rankingScore = null,
  backingTelemetry = null,
  qualityScore = null,
  label = "",
  now = null,
  extractYouTubeId = defaultExtractYouTubeId,
} = {}) => {
  const safeSongId = String(songId || "").trim();
  if (!safeSongId) return null;
  const safeSource = String(source || (appleMusicId ? "apple" : extractYouTubeId(mediaUrl) ? "youtube" : "custom")).trim().toLowerCase() || "custom";
  const candidateId = buildBackingCandidateDocId({
    songId: safeSongId,
    source: safeSource,
    mediaUrl,
    appleMusicId,
    backingCandidateId,
    extractYouTubeId,
  });
  if (!candidateId) return null;
  const timestamp = now || admin.firestore.FieldValue.serverTimestamp();
  const db = admin.firestore();
  const candidateRef = db.collection("songs").doc(safeSongId).collection(BACKING_CANDIDATES_SUBCOLLECTION).doc(candidateId);
  const eventRef = db.collection(BACKING_FEEDBACK_EVENTS_COLLECTION).doc();
  const youtubeId = safeSource === "youtube" ? extractYouTubeId(mediaUrl) : "";
  const rankingNumber = Number(rankingScore);
  const qualityNumber = Number(qualityScore);
  await db.runTransaction(async (tx) => {
    tx.set(candidateRef, {
      candidateId,
      songId: safeSongId,
      canonicalSongId: safeSongId,
      title: String(title || "").trim(),
      artist: String(artist || "").trim(),
      trackId: String(trackId || "").trim(),
      provider: safeSource,
      providerTrackId: youtubeId || String(appleMusicId || trackId || "").trim(),
      mediaUrl: mediaUrl || "",
      appleMusicId: appleMusicId || "",
      label: label || null,
      backingOnly: true,
      rankingScore: Number.isFinite(rankingNumber) ? Math.max(0, rankingNumber) : null,
      qualityScore: Number.isFinite(qualityNumber) ? Math.max(0, qualityNumber) : null,
      lastFeedbackAt: timestamp,
      updatedAt: timestamp,
      createdAt: timestamp,
      ...buildBackingTelemetryIncrementPatch({ rating, actorRole }),
    }, { merge: true });
    tx.set(eventRef, {
      eventId: eventRef.id,
      candidateId,
      songId: safeSongId,
      canonicalSongId: safeSongId,
      trackId: String(trackId || "").trim(),
      roomCode: roomCode || "",
      actorUid: actorUid || "",
      actorRole: String(actorRole || "host").trim().toLowerCase() || "host",
      signal: String(rating || "up").trim().toLowerCase() === "down" ? "downvote" : "upvote",
      provider: safeSource,
      providerTrackId: youtubeId || String(appleMusicId || trackId || "").trim(),
      mediaUrl: mediaUrl || "",
      appleMusicId: appleMusicId || "",
      rankingScore: Number.isFinite(rankingNumber) ? Math.max(0, rankingNumber) : null,
      telemetrySnapshot: normalizeBackingTelemetryForAdmin(backingTelemetry || {}),
      createdAt: timestamp,
    }, { merge: true });
  });
  return { candidateId, eventId: eventRef.id };
};

const buildCanonicalBackingCandidateSummaries = ({
  candidateDocs = [],
  songId = "",
  title = "",
  artist = "",
  scoreCatalogTextMatch = () => 0,
} = {}) => {
  const requestTitle = String(title || "").trim();
  const requestArtist = String(artist || "").trim();
  return (Array.isArray(candidateDocs) ? candidateDocs : [])
    .map((docSnap, index) => {
      const entry = docSnap && typeof docSnap.data === "function" ? docSnap.data() : docSnap || {};
      const candidateId = String(entry.candidateId || docSnap?.id || "").trim();
      const provider = String(entry.provider || entry.backingProvider || entry.source || "youtube").trim().toLowerCase() || "youtube";
      const providerTrackId = String(entry.providerTrackId || entry.videoId || entry.youtubeId || "").trim();
      const mediaUrl = String(entry.mediaUrl || (provider === "youtube" && providerTrackId ? `https://www.youtube.com/watch?v=${providerTrackId}` : "")).trim();
      const appleMusicId = String(entry.appleMusicId || (provider === "apple" ? providerTrackId : "")).trim();
      const candidateTitle = String(entry.title || entry.trackName || "").trim();
      const candidateArtist = String(entry.artist || entry.artistName || entry.channelTitle || entry.channel || "").trim();
      const telemetry = entry.telemetry && typeof entry.telemetry === "object" && !Array.isArray(entry.telemetry)
        ? entry.telemetry
        : entry.backingTelemetry && typeof entry.backingTelemetry === "object" && !Array.isArray(entry.backingTelemetry)
          ? entry.backingTelemetry
          : null;
      const qualityScore = Math.max(0, Number(entry.qualityScore || 0));
      const rankingScore = Math.max(0, Number(entry.rankingScore || 0));
      const rankingSignal = Math.min(90, Math.max(0, rankingScore - 45));
      const successCount = Math.max(0, Number(entry.successCount || telemetry?.completionCount || 0));
      const usageCount = Math.max(0, Number(entry.usageCount || telemetry?.usageCount || 0));
      const failureCount = Math.max(0, Number(entry.failureCount || telemetry?.skipCount || 0));
      const popularityScore = Math.min(40, successCount * 4) + Math.min(24, usageCount * 2) - Math.min(30, failureCount * 8);
      const titleScore = Math.min(50, scoreCatalogTextMatch(requestTitle, candidateTitle));
      const artistScore = Math.min(30, scoreCatalogTextMatch(requestArtist, candidateArtist));
      const playable = entry.playable !== false && entry.embeddable !== false && entry.youtubePlaybackStatus !== "blocked";
      return {
        id: candidateId || `canonical_backing:${index}`,
        source: provider,
        mediaUrl,
        appleMusicId,
        duration: entry.duration || entry.durationSec || null,
        backingOnly: entry.backingOnly !== false,
        audioOnly: !!entry.audioOnly,
        updatedAt: entry.lastFeedbackAt || entry.updatedAt || entry.lastUsedAt || null,
        approvalState: playable ? "approved" : "candidate",
        qualityScore,
        rankingScore,
        backingCandidateId: candidateId,
        canonicalSongId: String(entry.canonicalSongId || entry.songId || songId || "").trim(),
        backingTelemetry: telemetry,
        successCount,
        usageCount,
        failureCount,
        avoidRoomCount: Math.max(0, Number(entry.avoidRoomCount || 0)),
        globalFeedbackState: playable ? "neutral" : "avoid",
        layer: "canonical_backing",
        score: 150 + titleScore + artistScore + qualityScore + rankingSignal + popularityScore + (provider === "youtube" ? 10 : 0),
        label: String(entry.label || entry.sourceDetail || "Ranked backing").trim() || "Ranked backing",
      };
    })
    .filter((entry) => entry && (entry.mediaUrl || entry.appleMusicId))
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
    .slice(0, 5);
};

module.exports = {
  BACKING_CANDIDATES_SUBCOLLECTION,
  BACKING_FEEDBACK_EVENTS_COLLECTION,
  buildBackingCandidateDocId,
  buildBackingTelemetryIncrementPatch,
  buildCanonicalBackingCandidatePatchFromYouTubeIndexEntry,
  buildCanonicalBackingCandidateSummaries,
  defaultExtractYouTubeId,
  normalizeBackingTelemetryForAdmin,
  recordCanonicalBackingFeedbackAdmin,
  sanitizeBackingDocId,
  upsertCanonicalBackingCandidateFromYouTubeIndexTx,
};