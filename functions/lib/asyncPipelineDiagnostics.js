"use strict";

const {
  POP_TRIVIA_FAILED_RETRY_AFTER_MS,
  POP_TRIVIA_PENDING_RETRY_AFTER_MS,
} = require("./popTrivia");

const DEFAULT_LYRICS_PENDING_STALE_AFTER_MS = 3 * 60 * 1000;
const DEFAULT_POP_TRIVIA_PENDING_STALE_AFTER_MS = Math.max(
  2 * 60 * 1000,
  POP_TRIVIA_PENDING_RETRY_AFTER_MS * 2
);

const cleanToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

const getTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
};

const buildAgeMs = (updatedAtMs = 0, now = Date.now()) => {
  const safeUpdatedAt = Math.max(0, Number(updatedAtMs || 0));
  if (!safeUpdatedAt) return 0;
  return Math.max(0, Number(now) - safeUpdatedAt);
};

const describeAgeMinutes = (ageMs = 0) => {
  const safeAgeMs = Math.max(0, Number(ageMs || 0));
  return Number((safeAgeMs / 60000).toFixed(1));
};

const summarizeProviderTrace = (providerTrace = []) =>
  (Array.isArray(providerTrace) ? providerTrace : [])
    .slice(0, 4)
    .map((entry) => {
      const provider = cleanToken(entry?.provider || "unknown") || "unknown";
      const status = cleanToken(entry?.status || "miss") || "miss";
      const detail = String(entry?.detail || "").trim();
      return detail ? `${provider}:${status}:${detail}` : `${provider}:${status}`;
    })
    .join(" | ");

const classifyLyricsPipeline = (
  song = {},
  {
    now = Date.now(),
    pendingStaleAfterMs = DEFAULT_LYRICS_PENDING_STALE_AFTER_MS,
  } = {}
) => {
  const status = cleanToken(song?.lyricsGenerationStatus);
  const resolution = cleanToken(song?.lyricsGenerationResolution);
  const hasLyrics = !!String(song?.lyrics || "").trim();
  const hasTimedLyrics = Array.isArray(song?.lyricsTimed) && song.lyricsTimed.length > 0;
  const updatedAtMs = Math.max(
    0,
    getTimestampMs(song?.lyricsGenerationUpdatedAt),
    getTimestampMs(song?.timestamp)
  );
  const ageMs = buildAgeMs(updatedAtMs, now);
  const providerTraceSummary = summarizeProviderTrace(song?.lyricsProviderTrace || []);

  let issueCode = "";
  let recoveryEligible = false;
  let summary = "";

  if (!status || status === "disabled") {
    summary = status || "disabled";
  } else if (status === "resolved" && !hasLyrics && !hasTimedLyrics) {
    issueCode = "resolved_without_payload";
    recoveryEligible = true;
    summary = "resolved without lyrics payload";
  } else if (status === "pending" && ageMs >= pendingStaleAfterMs) {
    issueCode = "stale_pending";
    recoveryEligible = true;
    summary = `pending for ${describeAgeMinutes(ageMs)}m`;
  } else if (status === "error" || resolution === "provider_error" || resolution === "callable_error") {
    issueCode = "provider_error";
    recoveryEligible = true;
    summary = resolution || status;
  } else if (status === "permission_denied" || resolution === "permission_denied") {
    issueCode = "permission_denied";
    recoveryEligible = false;
    summary = "host access denied";
  } else if (status === "needs_user_token" || resolution === "needs_user_token") {
    issueCode = "needs_user_token";
    recoveryEligible = false;
    summary = "needs Apple Music user token";
  } else if (status === "capability_blocked" || resolution === "capability_blocked") {
    issueCode = "capability_blocked";
    recoveryEligible = false;
    summary = "AI capability blocked";
  } else {
    summary = resolution || status;
  }

  return {
    pipeline: "lyrics",
    status,
    resolution,
    updatedAtMs,
    ageMs,
    ageMinutes: describeAgeMinutes(ageMs),
    hasLyrics,
    hasTimedLyrics,
    issueCode,
    hasIssue: !!issueCode,
    recoveryEligible,
    providerTraceSummary,
    summary,
  };
};

const classifyPopTriviaPipeline = (
  song = {},
  {
    now = Date.now(),
    pendingStaleAfterMs = DEFAULT_POP_TRIVIA_PENDING_STALE_AFTER_MS,
    failedRetryAfterMs = POP_TRIVIA_FAILED_RETRY_AFTER_MS,
  } = {}
) => {
  const status = cleanToken(song?.popTriviaStatus);
  const source = cleanToken(song?.popTriviaSource);
  const questionCount = Array.isArray(song?.popTrivia) ? song.popTrivia.length : 0;
  const updatedAtMs = Math.max(
    0,
    Number(song?.popTriviaRequestedAtMs || 0),
    getTimestampMs(song?.popTriviaUpdatedAt),
    getTimestampMs(song?.popTriviaGeneratedAt),
    getTimestampMs(song?.timestamp)
  );
  const ageMs = buildAgeMs(updatedAtMs, now);
  const error = String(song?.popTriviaError || "").trim();

  let issueCode = "";
  let recoveryEligible = false;
  let summary = "";

  if (!status) {
    summary = "missing_status";
  } else if (status === "ready" && questionCount <= 0) {
    issueCode = "ready_without_payload";
    recoveryEligible = true;
    summary = "ready without trivia payload";
  } else if (status === "pending" && ageMs >= pendingStaleAfterMs) {
    issueCode = "stale_pending";
    recoveryEligible = true;
    summary = `pending for ${describeAgeMinutes(ageMs)}m`;
  } else if (status === "failed") {
    issueCode = "failed";
    recoveryEligible = ageMs >= failedRetryAfterMs;
    summary = error || "generation failed";
  } else {
    summary = source || status;
  }

  return {
    pipeline: "pop_trivia",
    status,
    source,
    questionCount,
    updatedAtMs,
    ageMs,
    ageMinutes: describeAgeMinutes(ageMs),
    error,
    issueCode,
    hasIssue: !!issueCode,
    recoveryEligible,
    summary,
  };
};

module.exports = {
  DEFAULT_LYRICS_PENDING_STALE_AFTER_MS,
  DEFAULT_POP_TRIVIA_PENDING_STALE_AFTER_MS,
  classifyLyricsPipeline,
  classifyPopTriviaPipeline,
  describeAgeMinutes,
  getTimestampMs,
};
