import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildDirectoryOccurrenceRolloutConfig,
  buildNightSeriesId,
  buildWeeklyOccurrencePlan,
  isWeeklyRecurringRule,
  selectNextScheduledOccurrence,
  shouldArchiveOccurrence,
} = require('../../functions/lib/directoryOccurrences.js');

test('occurrence scheduler rollout is disabled by default and rejects unknown modes', () => {
  assert.deepEqual(
    buildDirectoryOccurrenceRolloutConfig({}),
    {
      requestedMode: 'off',
      mode: 'off',
      canRun: false,
      reason: 'rollout_disabled',
      canarySeriesIds: [],
      bootstrapEnabled: false,
      archiveEnabled: false,
      bootstrapLimit: 40,
      seriesLimit: 50,
    },
  );
  const invalid = buildDirectoryOccurrenceRolloutConfig({
    DIRECTORY_OCCURRENCE_ROLL_MODE: 'surprise',
  });
  assert.equal(invalid.canRun, false);
  assert.equal(invalid.reason, 'invalid_rollout_mode');
});

test('canary rollout requires bounded explicit series and cannot bootstrap or archive globally', () => {
  const missing = buildDirectoryOccurrenceRolloutConfig({
    DIRECTORY_OCCURRENCE_ROLL_MODE: 'canary',
  });
  assert.equal(missing.canRun, false);
  assert.equal(missing.reason, 'missing_canary_series_ids');

  const rollout = buildDirectoryOccurrenceRolloutConfig({
    DIRECTORY_OCCURRENCE_ROLL_MODE: 'canary',
    DIRECTORY_OCCURRENCE_CANARY_SERIES_IDS: 'night_alpha, night_alpha, invalid/id, night_beta',
    DIRECTORY_OCCURRENCE_BOOTSTRAP_ENABLED: 'true',
    DIRECTORY_OCCURRENCE_ARCHIVE_ENABLED: 'true',
  });
  assert.equal(rollout.canRun, true);
  assert.deepEqual(rollout.canarySeriesIds, ['night_alpha', 'night_beta']);
  assert.equal(rollout.bootstrapEnabled, false);
  assert.equal(rollout.archiveEnabled, false);
});

test('all-series rollout keeps bootstrap and archival independently opt-in and limits bounded', () => {
  const rollout = buildDirectoryOccurrenceRolloutConfig({
    DIRECTORY_OCCURRENCE_ROLL_MODE: 'all',
    DIRECTORY_OCCURRENCE_BOOTSTRAP_ENABLED: 'yes',
    DIRECTORY_OCCURRENCE_ARCHIVE_ENABLED: '1',
    DIRECTORY_OCCURRENCE_BOOTSTRAP_LIMIT: '999',
    DIRECTORY_OCCURRENCE_SERIES_LIMIT: '0',
  });
  assert.equal(rollout.canRun, true);
  assert.equal(rollout.bootstrapEnabled, true);
  assert.equal(rollout.archiveEnabled, true);
  assert.equal(rollout.bootstrapLimit, 160);
  assert.equal(rollout.seriesLimit, 1);
});

test('weekly occurrence ids are deterministic and a series id is stable', () => {
  const seriesId = buildNightSeriesId({
    venueId: 'venue_123',
    title: 'Thursday Karaoke',
    sourceListingId: 'room_abcd',
  });
  assert.equal(seriesId, buildNightSeriesId({
    venueId: 'venue_123',
    title: 'Thursday Karaoke',
    sourceListingId: 'room_abcd',
  }));
  const anchorStartsAtMs = Date.parse('2026-07-17T02:00:00.000Z');
  const planA = buildWeeklyOccurrencePlan({
    seriesId,
    anchorStartsAtMs,
    timezone: 'America/Los_Angeles',
    nowMs: Date.parse('2026-07-14T12:00:00.000Z'),
    weeksAhead: 2,
  });
  const planB = buildWeeklyOccurrencePlan({
    seriesId,
    anchorStartsAtMs,
    timezone: 'America/Los_Angeles',
    nowMs: Date.parse('2026-07-14T12:00:00.000Z'),
    weeksAhead: 2,
  });
  assert.deepEqual(planA, planB);
  assert.match(planA[0].occurrenceId, /^occ_[a-f0-9]{18}_20260716$/);
});

test('weekly plans preserve the venue-local wall time across daylight saving changes', () => {
  const plan = buildWeeklyOccurrencePlan({
    seriesId: 'night_dst',
    anchorStartsAtMs: Date.parse('2026-10-30T02:00:00.000Z'),
    anchorEndsAtMs: Date.parse('2026-10-30T06:00:00.000Z'),
    timezone: 'America/Los_Angeles',
    nowMs: Date.parse('2026-10-29T12:00:00.000Z'),
    weeksAhead: 3,
  });
  assert.equal(new Date(plan[0].startsAtMs).toISOString(), '2026-10-30T02:00:00.000Z');
  const afterDst = plan.find((entry) => entry.localDateKey === '2026-11-05');
  assert.equal(new Date(afterDst.startsAtMs).toISOString(), '2026-11-06T03:00:00.000Z');
  assert.equal(afterDst.endsAtMs - afterDst.startsAtMs, 4 * 60 * 60 * 1000);
});

test('cancelled occurrences are skipped without shifting the weekly series', () => {
  const base = {
    seriesId: 'night_cancel',
    anchorStartsAtMs: Date.parse('2026-07-17T02:00:00.000Z'),
    timezone: 'America/Los_Angeles',
    nowMs: Date.parse('2026-07-14T12:00:00.000Z'),
    weeksAhead: 3,
  };
  const initial = buildWeeklyOccurrencePlan(base);
  const cancelledId = initial[0].occurrenceId;
  const nextPlan = buildWeeklyOccurrencePlan({
    ...base,
    cancelledOccurrenceIds: [cancelledId],
  });
  assert.equal(nextPlan[0].status, 'cancelled');
  assert.equal(selectNextScheduledOccurrence(nextPlan, base.nowMs).occurrenceId, nextPlan[1].occurrenceId);
  assert.equal(nextPlan[1].startsAtMs - nextPlan[0].startsAtMs, 7 * 24 * 60 * 60 * 1000);
});

test('weekly rule normalization recognizes common moderated listing language', () => {
  assert.equal(isWeeklyRecurringRule('weekly'), true);
  assert.equal(isWeeklyRecurringRule('Every Thursday'), true);
  assert.equal(isWeeklyRecurringRule('Thursdays'), true);
  assert.equal(isWeeklyRecurringRule('one_time'), false);
});

test('stale archival preserves cancellations and only archives old scheduled occurrences', () => {
  const nowMs = Date.parse('2026-07-14T12:00:00.000Z');
  const oldEndsAtMs = nowMs - (91 * 24 * 60 * 60 * 1000);
  assert.equal(shouldArchiveOccurrence({ status: 'scheduled', endsAtMs: oldEndsAtMs }, nowMs), true);
  assert.equal(shouldArchiveOccurrence({ status: 'cancelled', endsAtMs: oldEndsAtMs }, nowMs), false);
  assert.equal(shouldArchiveOccurrence({ status: 'scheduled', endsAtMs: nowMs - 1000 }, nowMs), false);
});
