import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildRoomCostObservationCounts,
  getRoomCostUtcDateKey,
  shouldRecordRoomCostObservation,
} from '../../src/lib/roomCostObservation';

test('client Room cost observation model mirrors bounded server fields', () => {
  assert.equal(getRoomCostUtcDateKey(Date.UTC(2026, 6, 21)), '20260721');
  assert.equal(shouldRecordRoomCostObservation({ surface: 'host' }), true);
  assert.deepEqual(buildRoomCostObservationCounts({
    participants: Array.from({ length: 300 }),
    songs: [
      { status: 'requested' },
      { status: 'performing' },
      { status: 'performed' },
    ],
    activities: Array.from({ length: 90 }),
    mediaAssets: [{ _cloud: true }, { _legacy: true }],
    scenePresets: Array.from({ length: 60 }),
  }), {
    participantsObserved: 250,
    activeSongsObserved: 2,
    performedSongsObserved: 1,
    activitiesObserved: 80,
    mediaAssetsObserved: 2,
    scenePresetsObserved: 50,
  });
});
