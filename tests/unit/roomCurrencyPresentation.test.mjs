import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getRoomCurrencyPresentation, isBeauBucksEconomy } from '../../src/lib/roomCurrencyPresentation.js';

test('room currency presentation separates playful points from BeauBucks economies', () => {
  assert.equal(isBeauBucksEconomy({ enabled: false, presetId: 'beaubucks' }), false);
  assert.equal(getRoomCurrencyPresentation({ enabled: false }).id, 'points');
  assert.equal(getRoomCurrencyPresentation({ enabled: false }).shortLabel, 'PTS');

  assert.equal(isBeauBucksEconomy({ enabled: true, presetId: 'beaubucks' }), true);
  assert.equal(isBeauBucksEconomy({ enabled: true, presetId: 'ticketed_event' }), true);
  assert.equal(isBeauBucksEconomy({ enabled: true, supportLabel: 'Support the room' }), true);
  assert.equal(getRoomCurrencyPresentation({ enabled: true, eventId: 'beaubucks' }).plural, 'BeauBucks');
  assert.equal(getRoomCurrencyPresentation({ enabled: true, supportPoints: 25 }).balanceLabel, 'BeauBucks balance');
});
