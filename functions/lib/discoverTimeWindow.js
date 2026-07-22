'use strict';

const MS_PER_HOUR = 60 * 60 * 1000;
const DEFAULT_EVENT_DURATION_MS = 6 * MS_PER_HOUR;
const DEFAULT_RECAP_RETENTION_MS = 30 * 24 * MS_PER_HOUR;

const normalizeDiscoverTimezone = (value = '', fallback = 'UTC') => {
  const timezone = String(value || '').trim().slice(0, 80);
  if (!timezone) return fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
    return timezone;
  } catch {
    return fallback;
  }
};

const getZonedDateParts = (timestampMs = 0, timezone = 'UTC') => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeDiscoverTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(Number(timestampMs || 0)));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year || 0),
    month: Number(values.month || 0),
    day: Number(values.day || 0),
    hour: Number(values.hour || 0),
    minute: Number(values.minute || 0),
  };
};

const dateKey = ({ year = 0, month = 0, day = 0 } = {}) => (
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const previousDateKey = (parts = {}) => {
  const previous = new Date(Date.UTC(parts.year, Math.max(0, parts.month - 1), parts.day - 1));
  return dateKey({
    year: previous.getUTCFullYear(),
    month: previous.getUTCMonth() + 1,
    day: previous.getUTCDate(),
  });
};

const getTonightServiceDateKey = (timestampMs = 0, timezone = 'UTC', { forEvent = false } = {}) => {
  const parts = getZonedDateParts(timestampMs, timezone);
  const minutes = (parts.hour * 60) + parts.minute;
  if (forEvent && minutes > 120 && minutes < 1020) return '';
  if (minutes < 120 || (forEvent && minutes <= 120)) return previousDateKey(parts);
  return dateKey(parts);
};

const getDiscoverListingEndMs = (item = {}) => {
  const startsAtMs = Number(item?.startsAtMs || 0);
  const endsAtMs = Number(item?.endsAtMs || 0);
  if (Number.isFinite(endsAtMs) && endsAtMs > startsAtMs) return endsAtMs;
  return startsAtMs > 0 ? startsAtMs + DEFAULT_EVENT_DURATION_MS : 0;
};

const isDiscoverListingActiveOrUpcoming = (item = {}, nowMs = Date.now(), lookaheadMs = 0) => {
  const startsAtMs = Number(item?.startsAtMs || 0);
  if (!Number.isFinite(startsAtMs) || startsAtMs <= 0) return false;
  const endMs = getDiscoverListingEndMs(item);
  return startsAtMs <= (nowMs + Math.max(0, Number(lookaheadMs || 0))) && endMs >= nowMs;
};

const hasDiscoverablePublicRecap = (item = {}) => (
  String(item?.listingType || '').trim().toLowerCase() === 'room_session'
  && !!String(item?.roomCode || '').trim()
  && (
    Number(item?.latestRecapAtMs || 0) > 0
    || !!String(item?.latestRecapUrl || item?.recapUrl || '').trim()
  )
);

const shouldIncludeDiscoverListingInAllWindow = (
  item = {},
  nowMs = Date.now(),
  { includeEnded = false, recapRetentionMs = DEFAULT_RECAP_RETENTION_MS } = {},
) => {
  if (String(item?.listingType || '').trim().toLowerCase() === 'venue') return true;
  const startsAtMs = Number(item?.startsAtMs || 0);
  if (!Number.isFinite(startsAtMs) || startsAtMs <= 0) return true;
  const endMs = getDiscoverListingEndMs(item);
  if (endMs >= nowMs || includeEnded) return true;
  const safeRetentionMs = Math.max(0, Number(recapRetentionMs || 0));
  return hasDiscoverablePublicRecap(item)
    && safeRetentionMs > 0
    && (nowMs - endMs) <= safeRetentionMs;
};

const matchesDirectoryDiscoverTimeWindow = (
  item = {},
  timeWindow = 'all',
  nowMs = Date.now(),
  timezone = 'UTC',
  options = {},
) => {
  const startsAtMs = Number(item?.startsAtMs || 0);
  if (timeWindow === 'all') {
    return shouldIncludeDiscoverListingInAllWindow(item, nowMs, options);
  }
  if (!Number.isFinite(startsAtMs) || startsAtMs <= 0) return false;
  const safeTimezone = normalizeDiscoverTimezone(timezone);
  if (timeWindow === 'now') {
    return isDiscoverListingActiveOrUpcoming(item, nowMs, MS_PER_HOUR);
  }
  if (timeWindow === 'this_week') {
    return startsAtMs <= (nowMs + (7 * 24 * MS_PER_HOUR))
      && getDiscoverListingEndMs(item) >= nowMs;
  }
  if (timeWindow === 'tonight') {
    const currentServiceDate = getTonightServiceDateKey(nowMs, safeTimezone);
    const eventServiceDate = getTonightServiceDateKey(startsAtMs, safeTimezone, { forEvent: true });
    return !!eventServiceDate
      && eventServiceDate === currentServiceDate
      && getDiscoverListingEndMs(item) >= nowMs;
  }
  return true;
};

module.exports = {
  DEFAULT_EVENT_DURATION_MS,
  DEFAULT_RECAP_RETENTION_MS,
  getDiscoverListingEndMs,
  hasDiscoverablePublicRecap,
  isDiscoverListingActiveOrUpcoming,
  matchesDirectoryDiscoverTimeWindow,
  normalizeDiscoverTimezone,
  shouldIncludeDiscoverListingInAllWindow,
};
