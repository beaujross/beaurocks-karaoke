import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  collectFollowedHostIds,
  collectFollowedVenueIds,
} from '../../src/apps/Marketing/dashboardUtils.js';

test('follow target helpers keep host and venue identities separate', () => {
  const follows = [
    { targetType: 'host', targetId: 'h_1' },
    { targetType: 'venue', targetId: 'v_1' },
    { targetType: 'venue', targetId: 'v_1' },
    { targetType: 'host', targetId: 'h_2' },
    { targetType: 'venue', targetId: 'v_2' },
  ];

  assert.deepEqual(collectFollowedHostIds(follows), ['h_1', 'h_2']);
  assert.deepEqual(collectFollowedVenueIds(follows), ['v_1', 'v_2']);
});
