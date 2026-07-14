import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getRoomEconomySummary } from '../../src/lib/roomEconomySummary.js';

test('summarizes an ordinary points room without inventing premium value', () => {
  const summary = getRoomEconomySummary({ enabled: false });
  assert.equal(summary.currency.id, 'points');
  assert.equal(summary.cards[0].value, 'No room wallet');
  assert.equal(summary.cards[1].value, 'No automatic refill');
  assert.equal(summary.cards[2].value, 'Voting, boosts, and play');
  assert.deepEqual(summary.warnings, []);
});

test('summarizes BeauBucks grants and capped automatic refills', () => {
  const summary = getRoomEconomySummary({
    enabled: true,
    presetId: 'beaubucks',
    generalAdmissionPoints: 100,
    timedLobbyEnabled: true,
    timedLobbyPoints: 25,
    timedLobbyIntervalMin: 10,
    timedLobbyMaxPerGuest: 150,
  });
  assert.equal(summary.cards[0].value, '100 BeauBucks');
  assert.equal(summary.cards[1].value, '25 every 10 min');
  assert.match(summary.cards[1].note, /150 BeauBucks/);
  assert.deepEqual(summary.warnings, []);
});

test('summarizes fundraiser intent and reports contradictory configuration', () => {
  const summary = getRoomEconomySummary({
    enabled: true,
    supportProvider: 'givebutter',
    generalAdmissionPoints: 0,
    timedLobbyEnabled: true,
    timedLobbyPoints: 0,
  });
  assert.equal(summary.support.connected, true);
  assert.equal(summary.cards[2].value, 'Supporting this room');
  assert.deepEqual(summary.warnings, [
    'Set a starting BeauBucks balance.',
    'Automatic refill is on, but its amount is zero.',
    'Add a clear guest-facing support label.',
  ]);
});

test('warns when the refill cap cannot accommodate one refill', () => {
  const summary = getRoomEconomySummary({
    enabled: true,
    presetId: 'beaubucks',
    generalAdmissionPoints: 100,
    timedLobbyEnabled: true,
    timedLobbyPoints: 50,
    timedLobbyMaxPerGuest: 25,
  });
  assert.deepEqual(summary.warnings, ['Refill cap is lower than one refill.']);
});
