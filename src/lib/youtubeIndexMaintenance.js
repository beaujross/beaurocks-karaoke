const DAY_MS = 24 * 60 * 60 * 1000;

export const YOUTUBE_INDEX_RETENTION_MS = 30 * DAY_MS;
export const YOUTUBE_INDEX_REFRESH_WINDOW_MS = 3 * DAY_MS;
export const YOUTUBE_INDEX_DEFAULT_MAX_REFRESH_IDS = 12;
export const YOUTUBE_INDEX_EVENT_RESERVE_SEARCHES = 25;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampNumber = (value, min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0) => (
  Math.min(max, Math.max(min, toNumber(value, fallback)))
);

const nowMs = () => Date.now();

export const resolveYtIndexLastValidatedAtMs = (entry = {}, overrides = {}, now = nowMs()) => {
  const explicit = Math.max(0, toNumber(overrides.lastValidatedAtMs ?? entry.lastValidatedAtMs, 0));
  if (explicit > 0) return explicit;
  const curatedAtMs = Math.max(0, toNumber(overrides.curatedAtMs ?? entry.curatedAtMs, 0));
  return curatedAtMs > 0 ? curatedAtMs : now;
};

export const resolveYtIndexExpiresAtMs = (entry = {}, overrides = {}, lastValidatedAtMs = 0) => {
  const explicit = Math.max(0, toNumber(overrides.expiresAtMs ?? entry.expiresAtMs, 0));
  if (explicit > 0) return explicit;
  return lastValidatedAtMs > 0 ? lastValidatedAtMs + YOUTUBE_INDEX_RETENTION_MS : 0;
};

export const isYtIndexEntryExpired = (entry = {}, atMs = nowMs()) => {
  const normalized = entry && typeof entry === 'object' ? entry : {};
  const lastValidatedAtMs = resolveYtIndexLastValidatedAtMs(normalized, {}, atMs);
  const expiresAtMs = resolveYtIndexExpiresAtMs(normalized, {}, lastValidatedAtMs);
  return expiresAtMs > 0 && expiresAtMs <= atMs;
};

export const shouldRefreshYtIndexEntry = (entry = {}, atMs = nowMs(), refreshWindowMs = YOUTUBE_INDEX_REFRESH_WINDOW_MS) => {
  const normalized = entry && typeof entry === 'object' ? entry : {};
  const lastValidatedAtMs = resolveYtIndexLastValidatedAtMs(normalized, {}, atMs);
  const expiresAtMs = resolveYtIndexExpiresAtMs(normalized, {}, lastValidatedAtMs);
  if (!lastValidatedAtMs || !expiresAtMs) return true;
  return expiresAtMs <= (atMs + Math.max(0, toNumber(refreshWindowMs, YOUTUBE_INDEX_REFRESH_WINDOW_MS)));
};

export const getYtIndexRefreshPriorityScore = (entry = {}, atMs = nowMs()) => {
  const normalized = entry && typeof entry === 'object' ? entry : {};
  const lastValidatedAtMs = resolveYtIndexLastValidatedAtMs(normalized, {}, atMs);
  const expiresAtMs = resolveYtIndexExpiresAtMs(normalized, {}, lastValidatedAtMs);
  const ageDays = lastValidatedAtMs > 0 ? Math.max(0, (atMs - lastValidatedAtMs) / DAY_MS) : 30;
  const expiresSoonScore = expiresAtMs > 0
    ? Math.max(0, 10 - ((expiresAtMs - atMs) / DAY_MS)) * 4
    : 40;
  const usageScore = Math.min(35, clampNumber(normalized.usageCount, 0, 1000) * 4);
  const successScore = Math.min(35, clampNumber(normalized.successCount, 0, 1000) * 6);
  const rankScore = Math.min(30, Math.max(0, toNumber(normalized.rankingScore, 0) - 50) / 3);
  const qualityScore = Math.min(20, clampNumber(normalized.qualityScore, 0, 1000));
  const failurePenalty = Math.min(30, clampNumber(normalized.failureCount, 0, 1000) * 8);
  const playablePenalty = normalized.playable === false ? 20 : 0;
  return Math.round(ageDays + expiresSoonScore + usageScore + successScore + rankScore + qualityScore - failurePenalty - playablePenalty);
};

export const shouldHoldYouTubeIndexMaintenanceForReserve = ({
  telemetry = null,
  eventReserveSearches = YOUTUBE_INDEX_EVENT_RESERVE_SEARCHES,
} = {}) => {
  const blocked = telemetry?.quotaBlocked === true;
  if (blocked) return true;
  const reserve = Math.max(0, toNumber(eventReserveSearches, YOUTUBE_INDEX_EVENT_RESERVE_SEARCHES));
  const freshSearchesLeft = Math.max(0, toNumber(telemetry?.todayEstimatedFreshSearchesLeft, Number.POSITIVE_INFINITY));
  if (!Number.isFinite(freshSearchesLeft)) return false;
  return freshSearchesLeft <= reserve;
};

export const planYouTubeIndexRefresh = ({
  entries = [],
  atMs = nowMs(),
  maxIds = YOUTUBE_INDEX_DEFAULT_MAX_REFRESH_IDS,
  refreshWindowMs = YOUTUBE_INDEX_REFRESH_WINDOW_MS,
  telemetry = null,
  eventReserveSearches = YOUTUBE_INDEX_EVENT_RESERVE_SEARCHES,
} = {}) => {
  const sourceEntries = Array.isArray(entries) ? entries : [];
  const safeMaxIds = Math.max(0, Math.floor(toNumber(maxIds, YOUTUBE_INDEX_DEFAULT_MAX_REFRESH_IDS)));
  if (!safeMaxIds || !sourceEntries.length) {
    return { ids: [], candidates: [], heldForReserve: false, reason: 'empty' };
  }
  if (shouldHoldYouTubeIndexMaintenanceForReserve({ telemetry, eventReserveSearches })) {
    return { ids: [], candidates: [], heldForReserve: true, reason: 'event_reserve' };
  }
  const seen = new Set();
  const candidates = sourceEntries
    .map((entry, index) => {
      const videoId = String(entry?.videoId || entry?.id || '').trim();
      if (!videoId || seen.has(videoId)) return null;
      seen.add(videoId);
      if (!shouldRefreshYtIndexEntry(entry, atMs, refreshWindowMs)) return null;
      return {
        videoId,
        index,
        score: getYtIndexRefreshPriorityScore(entry, atMs),
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || Number(left.index || 0) - Number(right.index || 0));
  const selected = candidates.slice(0, safeMaxIds);
  return {
    ids: selected.map((entry) => entry.videoId),
    candidates,
    heldForReserve: false,
    reason: selected.length ? 'selected' : 'fresh',
  };
};