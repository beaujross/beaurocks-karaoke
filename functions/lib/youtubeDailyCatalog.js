"use strict";

const PACIFIC_TIME_ZONE = "America/Los_Angeles";
const DEFAULT_YOUTUBE_SEARCH_DAILY_LIMIT = 100;
// A 29-day lease leaves one daily maintenance cycle of safety before the
// YouTube policy's 30-day refresh-or-delete boundary.
const DEFAULT_YOUTUBE_CANDIDATE_RETENTION_MS = 29 * 24 * 60 * 60 * 1000;

const clampWholeNumber = (value, fallback, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
};

const buildPacificDateKey = (atMs = Date.now()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(atMs));
  const byType = Object.fromEntries(parts
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));
  return `${byType.year}${byType.month}${byType.day}`;
};

const buildYouTubeDailyCatalogPolicy = (env = process.env) => {
  const dailySearchLimit = clampWholeNumber(
    env.YOUTUBE_DAILY_SEARCH_LIST_CALL_LIMIT,
    DEFAULT_YOUTUBE_SEARCH_DAILY_LIMIT,
    1,
    100000
  );
  const defaultLiveReserve = Math.max(20, Math.ceil(dailySearchLimit * 0.25));
  const liveSearchReserve = clampWholeNumber(
    env.YOUTUBE_NIGHTLY_LIVE_SEARCH_RESERVE,
    defaultLiveReserve,
    1,
    Math.max(1, dailySearchLimit)
  );
  const defaultNightlyCap = Math.min(100, Math.max(1, Math.floor(dailySearchLimit * 0.25)));
  const nightlySearchCap = clampWholeNumber(
    env.YOUTUBE_NIGHTLY_CATALOG_SEARCH_CAP,
    defaultNightlyCap,
    0,
    Math.max(0, dailySearchLimit)
  );
  const enabled = String(env.YOUTUBE_NIGHTLY_CATALOG_ENABLED || "true")
    .trim()
    .toLowerCase() === "true";
  return {
    enabled,
    dailySearchLimit,
    liveSearchReserve,
    nightlySearchCap,
    nightlySearchCeiling: Math.max(0, dailySearchLimit - liveSearchReserve),
  };
};

const buildNightlyYouTubeSearchBudget = ({
  usedSearchCalls = 0,
  policy = buildYouTubeDailyCatalogPolicy(),
} = {}) => {
  if (!policy.enabled) return 0;
  const used = clampWholeNumber(usedSearchCalls, 0, 0);
  const remainingBeforeReserve = Math.max(0, policy.nightlySearchCeiling - used);
  return Math.min(policy.nightlySearchCap, remainingBeforeReserve);
};

const normalizeCatalogText = (value = "") => String(value || "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const tokensFor = (value = "") => new Set(normalizeCatalogText(value).split(/\s+/).filter(Boolean));

const tokenCoverage = (needle = "", haystack = "") => {
  const expected = [...tokensFor(needle)];
  if (!expected.length) return 0;
  const available = tokensFor(haystack);
  return expected.filter((token) => available.has(token)).length / expected.length;
};

const scoreNightlyKaraokeCandidate = ({ song = {}, item = {} } = {}) => {
  if (item.playable !== true || item.embeddable !== true) return -1;
  const resultTitle = normalizeCatalogText(item.title || "");
  const resultChannel = normalizeCatalogText(item.channelTitle || "");
  const intentText = `${resultTitle} ${resultChannel}`;
  const hasBackingIntent = /\b(karaoke|instrumental|backing track|sing along|minus one)\b/.test(intentText);
  if (!hasBackingIntent) return -1;
  const titleCoverage = tokenCoverage(song.title || song.songTitle || "", resultTitle);
  const artistCoverage = tokenCoverage(song.artist || "", `${resultTitle} ${resultChannel}`);
  if (titleCoverage < 0.75 || artistCoverage < 0.5) return -1;
  const riskyVocalCover = /\b(vocal cover|acapella|a cappella|reaction|tutorial)\b/.test(intentText);
  if (riskyVocalCover) return -1;
  const durationSec = Math.max(0, Number(item.durationSec || 0) || 0);
  if (durationSec && (durationSec < 60 || durationSec > 15 * 60)) return -1;
  const viewSignal = Math.min(12, Math.log10(Math.max(1, Number(item.viewCount || 0))) * 2);
  return Math.round((titleCoverage * 55) + (artistCoverage * 25) + 20 + viewSignal);
};

const selectNightlyKaraokeCandidate = ({ song = {}, items = [] } = {}) => (Array.isArray(items) ? items : [])
  .map((item) => ({ item, score: scoreNightlyKaraokeCandidate({ song, item }) }))
  .filter((entry) => entry.score >= 0)
  .sort((left, right) => right.score - left.score)[0] || null;

const timestampToMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return Math.max(0, Number(value.toMillis() || 0));
  if (value instanceof Date) return Math.max(0, value.getTime());
  return Math.max(0, Number(value || 0) || 0);
};

const isFreshYouTubeCandidate = ({ candidate = {}, atMs = Date.now() } = {}) => {
  const provider = String(candidate.provider || "").trim().toLowerCase();
  if (provider !== "youtube") return false;
  if (candidate.playable === false || candidate.embeddable === false || candidate.youtubePlaybackStatus === "blocked") {
    return false;
  }
  const explicitExpiryMs = timestampToMs(candidate.expiresAtMs || candidate.expiresAt);
  if (explicitExpiryMs) return explicitExpiryMs > atMs;
  const verifiedAtMs = timestampToMs(candidate.lastVerifiedAtMs || candidate.lastVerifiedAt);
  return verifiedAtMs > 0 && (verifiedAtMs + DEFAULT_YOUTUBE_CANDIDATE_RETENTION_MS) > atMs;
};

module.exports = {
  DEFAULT_YOUTUBE_CANDIDATE_RETENTION_MS,
  DEFAULT_YOUTUBE_SEARCH_DAILY_LIMIT,
  PACIFIC_TIME_ZONE,
  buildNightlyYouTubeSearchBudget,
  buildPacificDateKey,
  buildYouTubeDailyCatalogPolicy,
  isFreshYouTubeCandidate,
  scoreNightlyKaraokeCandidate,
  selectNightlyKaraokeCandidate,
  timestampToMs,
};
