import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  isDiscoverListingActiveOrUpcoming,
  matchesDirectoryDiscoverTimeWindow,
  normalizeDiscoverTimezone,
} = require('../../functions/lib/discoverTimeWindow.js');

test('Tonight uses the viewer timezone and carries after-midnight events into the prior night', () => {
  const nowMs = new Date('2026-07-15T07:30:00.000Z').getTime(); // 12:30am PDT
  const lateStartMs = new Date('2026-07-15T07:45:00.000Z').getTime(); // 12:45am PDT
  const morningStartMs = new Date('2026-07-15T17:00:00.000Z').getTime(); // 10am PDT
  assert.equal(matchesDirectoryDiscoverTimeWindow(
    { startsAtMs: lateStartMs, endsAtMs: lateStartMs + 3600000 },
    'tonight',
    nowMs,
    'America/Los_Angeles',
  ), true);
  assert.equal(matchesDirectoryDiscoverTimeWindow(
    { startsAtMs: morningStartMs, endsAtMs: morningStartMs + 3600000 },
    'tonight',
    nowMs,
    'America/Los_Angeles',
  ), false);
});

test('Now honors an explicit end time for long events and rejects ended events', () => {
  const nowMs = new Date('2026-07-15T04:00:00.000Z').getTime();
  assert.equal(matchesDirectoryDiscoverTimeWindow({
    startsAtMs: nowMs - (4 * 3600000),
    endsAtMs: nowMs + 3600000,
  }, 'now', nowMs, 'UTC'), true);
  assert.equal(matchesDirectoryDiscoverTimeWindow({
    startsAtMs: nowMs - 3600000,
    endsAtMs: nowMs - 1000,
  }, 'now', nowMs, 'UTC'), false);
});

test('Smart live-or-soon signal does not elevate a listing whose end time has passed', () => {
  const nowMs = Date.now();
  assert.equal(isDiscoverListingActiveOrUpcoming({
    startsAtMs: nowMs - 3600000,
    endsAtMs: nowMs - 1,
  }, nowMs, 8 * 3600000), false);
});

test('Invalid timezones fall back without throwing', () => {
  assert.equal(normalizeDiscoverTimezone('Not/A_Timezone', 'UTC'), 'UTC');
});
