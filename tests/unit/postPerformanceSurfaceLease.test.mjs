import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  getPerformanceRecapDurationMs,
  getPostPerformanceSurfaceLease,
} from '../../src/lib/postPerformanceSurfaceLease.js';

test('applause owns the Public TV surface before any between-performance takeover', () => {
  const lease = getPostPerformanceSurfaceLease({
    activeMode: 'applause_countdown',
    applauseSubject: { autoFinalizeDeadlineMs: 12000 },
  }, { now: 10000 });

  assert.deepEqual(lease, {
    active: true,
    phase: 'applause',
    remainingMs: 2000,
    expiresAtMs: 12000,
  });
});

test('finalized performance recap keeps an exclusive surface lease for its configured presentation', () => {
  const room = {
    activeMode: 'karaoke',
    lastPerformance: {
      timestamp: 10000,
      recapScoreFinalized: true,
      hostBonus: 0,
    },
  };
  const durationMs = getPerformanceRecapDurationMs(room);
  const lease = getPostPerformanceSurfaceLease(room, {
    now: 12000,
    recapDurationMs: durationMs,
  });

  assert.equal(durationMs, 25290);
  assert.equal(lease.active, true);
  assert.equal(lease.phase, 'recap');
  assert.equal(lease.remainingMs, durationMs - 2000);
  assert.equal(getPostPerformanceSurfaceLease(room, {
    now: 10000 + durationMs,
    recapDurationMs: durationMs,
  }).active, false);
});

test('disabled automatic recaps do not hold the next room moment', () => {
  const room = {
    activeMode: 'karaoke',
    showPerformanceRecap: false,
    lastPerformance: { timestamp: 10000, recapScoreFinalized: true },
  };

  assert.equal(getPerformanceRecapDurationMs(room), 0);
  assert.equal(getPostPerformanceSurfaceLease(room, { now: 10001 }).active, false);
});
