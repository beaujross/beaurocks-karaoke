'use strict';

const crypto = require('node:crypto');
const { normalizeDiscoverTimezone } = require('./discoverTimeWindow');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const DEFAULT_OCCURRENCE_DURATION_MS = 6 * 60 * 60 * 1000;
const MIN_OCCURRENCE_DURATION_MS = 15 * 60 * 1000;
const MAX_OCCURRENCE_DURATION_MS = 18 * 60 * 60 * 1000;
const MAX_ROLLOUT_CANARY_SERIES = 25;

const parseRolloutBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const token = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(token)) return true;
  if (['0', 'false', 'no', 'off'].includes(token)) return false;
  return fallback;
};

const clampRolloutLimit = (value, fallback, maximum) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
};

const normalizeRolloutSeriesIds = (value = '') => Array.from(new Set(
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((entry) => String(entry || '').trim().slice(0, 180))
    .filter((entry) => entry && !entry.includes('/')),
)).slice(0, MAX_ROLLOUT_CANARY_SERIES);

const buildDirectoryOccurrenceRolloutConfig = (environment = {}) => {
  const requestedMode = String(environment.DIRECTORY_OCCURRENCE_ROLL_MODE || 'off')
    .trim()
    .toLowerCase();
  const mode = ['canary', 'all'].includes(requestedMode) ? requestedMode : 'off';
  const canarySeriesIds = normalizeRolloutSeriesIds(
    environment.DIRECTORY_OCCURRENCE_CANARY_SERIES_IDS || '',
  );
  const canRun = mode === 'all' || (mode === 'canary' && canarySeriesIds.length > 0);
  const reason = mode === 'off'
    ? (requestedMode === 'off' ? 'rollout_disabled' : 'invalid_rollout_mode')
    : (canRun ? 'rollout_enabled' : 'missing_canary_series_ids');
  return {
    requestedMode,
    mode,
    canRun,
    reason,
    canarySeriesIds: mode === 'canary' ? canarySeriesIds : [],
    bootstrapEnabled: mode === 'all' && parseRolloutBoolean(
      environment.DIRECTORY_OCCURRENCE_BOOTSTRAP_ENABLED,
      false,
    ),
    archiveEnabled: mode === 'all' && parseRolloutBoolean(
      environment.DIRECTORY_OCCURRENCE_ARCHIVE_ENABLED,
      false,
    ),
    bootstrapLimit: clampRolloutLimit(
      environment.DIRECTORY_OCCURRENCE_BOOTSTRAP_LIMIT,
      40,
      160,
    ),
    seriesLimit: clampRolloutLimit(
      environment.DIRECTORY_OCCURRENCE_SERIES_LIMIT,
      50,
      200,
    ),
  };
};

const clampDurationMs = (value = 0) => {
  const duration = Number(value || 0);
  if (!Number.isFinite(duration) || duration < MIN_OCCURRENCE_DURATION_MS) {
    return DEFAULT_OCCURRENCE_DURATION_MS;
  }
  return Math.min(MAX_OCCURRENCE_DURATION_MS, Math.floor(duration));
};

const getZonedDateTimeParts = (timestampMs = 0, timezone = 'UTC') => {
  const safeTimezone = normalizeDiscoverTimezone(timezone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(Number(timestampMs || 0)));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year || 0),
    month: Number(values.month || 0),
    day: Number(values.day || 0),
    hour: Number(values.hour || 0),
    minute: Number(values.minute || 0),
    second: Number(values.second || 0),
  };
};

const zonedDateTimeToUtcMs = (parts = {}, timezone = 'UTC') => {
  const safeTimezone = normalizeDiscoverTimezone(timezone);
  const desiredAsUtc = Date.UTC(
    Number(parts.year || 0),
    Math.max(0, Number(parts.month || 1) - 1),
    Number(parts.day || 1),
    Number(parts.hour || 0),
    Number(parts.minute || 0),
    Number(parts.second || 0),
  );
  let guess = desiredAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getZonedDateTimeParts(guess, safeTimezone);
    const actualAsUtc = Date.UTC(
      actual.year,
      Math.max(0, actual.month - 1),
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const delta = desiredAsUtc - actualAsUtc;
    if (!delta) break;
    guess += delta;
  }
  return guess;
};

const buildDateKey = ({ year = 0, month = 0, day = 0 } = {}) => (
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const isWeeklyRecurringRule = (value = '') => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return false;
  if (['weekly', 'every_week', 'every week'].includes(token)) return true;
  return /(^|\s)(every\s+)?(mon|tues|wednes|thurs|fri|satur|sun)days?(\s|$)/.test(token)
    || token.includes('weekly');
};

const buildNightSeriesId = ({
  explicitSeriesId = '',
  venueId = '',
  venueName = '',
  title = '',
  sourceListingId = '',
} = {}) => {
  const explicit = String(explicitSeriesId || '').trim().slice(0, 180);
  if (explicit) return explicit;
  const seed = [venueId || venueName, title, sourceListingId, 'weekly']
    .map((entry) => String(entry || '').trim().toLowerCase())
    .join('|');
  return `night_${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 20)}`;
};

const buildOccurrenceId = (seriesId = '', localDateKey = '') => {
  const seriesHash = crypto.createHash('sha256').update(String(seriesId || '')).digest('hex').slice(0, 18);
  const dateToken = String(localDateKey || '').replace(/[^0-9]/g, '').slice(0, 8);
  return `occ_${seriesHash}_${dateToken}`;
};

const buildWeeklyOccurrencePlan = ({
  seriesId = '',
  anchorStartsAtMs = 0,
  anchorEndsAtMs = 0,
  timezone = 'UTC',
  nowMs = Date.now(),
  weeksAhead = 12,
  includePriorWeeks = 1,
  cancelledOccurrenceIds = [],
} = {}) => {
  const anchorStart = Number(anchorStartsAtMs || 0);
  if (!seriesId || !Number.isFinite(anchorStart) || anchorStart <= 0) return [];
  const safeTimezone = normalizeDiscoverTimezone(timezone);
  const anchorParts = getZonedDateTimeParts(anchorStart, safeTimezone);
  const nowParts = getZonedDateTimeParts(nowMs, safeTimezone);
  const anchorDaySerial = Date.UTC(anchorParts.year, anchorParts.month - 1, anchorParts.day);
  const nowDaySerial = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  const elapsedWeeks = Math.floor((nowDaySerial - anchorDaySerial) / WEEK_MS);
  const startIndex = Math.max(0, elapsedWeeks - Math.max(0, Number(includePriorWeeks || 0)));
  const safeWeeksAhead = Math.max(1, Math.min(52, Number(weeksAhead || 12)));
  const endIndex = Math.max(startIndex, elapsedWeeks + safeWeeksAhead);
  const durationMs = clampDurationMs(Number(anchorEndsAtMs || 0) - anchorStart);
  const cancelled = new Set((Array.isArray(cancelledOccurrenceIds) ? cancelledOccurrenceIds : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean));
  const occurrences = [];

  for (let ordinal = startIndex; ordinal <= endIndex; ordinal += 1) {
    const targetDate = new Date(anchorDaySerial + (ordinal * WEEK_MS));
    const targetParts = {
      year: targetDate.getUTCFullYear(),
      month: targetDate.getUTCMonth() + 1,
      day: targetDate.getUTCDate(),
      hour: anchorParts.hour,
      minute: anchorParts.minute,
      second: anchorParts.second,
    };
    const startsAtMs = zonedDateTimeToUtcMs(targetParts, safeTimezone);
    const localDateKey = buildDateKey(targetParts);
    const occurrenceId = buildOccurrenceId(seriesId, localDateKey);
    occurrences.push({
      occurrenceId,
      seriesId,
      ordinal,
      localDateKey,
      timezone: safeTimezone,
      startsAtMs,
      endsAtMs: startsAtMs + durationMs,
      status: cancelled.has(occurrenceId) ? 'cancelled' : 'scheduled',
    });
  }
  return occurrences;
};

const selectNextScheduledOccurrence = (occurrences = [], nowMs = Date.now()) => (
  (Array.isArray(occurrences) ? occurrences : [])
    .filter((entry) => entry?.status === 'scheduled' && Number(entry.endsAtMs || 0) >= Number(nowMs || 0))
    .sort((a, b) => Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0))[0]
  || null
);

const shouldArchiveOccurrence = (
  occurrence = {},
  nowMs = Date.now(),
  retentionMs = 90 * DAY_MS,
) => (
  String(occurrence?.status || '').trim().toLowerCase() === 'scheduled'
  && Number(occurrence?.endsAtMs || 0) > 0
  && Number(occurrence.endsAtMs) < (Number(nowMs || 0) - Math.max(0, Number(retentionMs || 0)))
);

module.exports = {
  DEFAULT_OCCURRENCE_DURATION_MS,
  buildDirectoryOccurrenceRolloutConfig,
  buildNightSeriesId,
  buildOccurrenceId,
  buildWeeklyOccurrencePlan,
  getZonedDateTimeParts,
  isWeeklyRecurringRule,
  selectNextScheduledOccurrence,
  shouldArchiveOccurrence,
  zonedDateTimeToUtcMs,
};
