import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getRoomSpendIntentGuide, ROOM_SPEND_INTENTS } from '../../src/lib/roomSpendIntent.js';

test('ordinary points are explicitly separated from financial support', () => {
  const guide = getRoomSpendIntentGuide({ enabled: false });
  assert.equal(guide.currency.id, 'points');
  assert.equal(guide.supportConnected, false);
  assert.match(guide.items.find((item) => item.id === ROOM_SPEND_INTENTS.play).detail, /digital play, not a cash payment/);
  assert.equal(guide.items.find((item) => item.id === ROOM_SPEND_INTENTS.support).label, 'Donations not connected');
});

test('BeauBucks influence and performer scoring remain distinct from donation checkout', () => {
  const guide = getRoomSpendIntentGuide({ enabled: true, presetId: 'beaubucks' });
  assert.match(guide.items.find((item) => item.id === ROOM_SPEND_INTENTS.influence).detail, /Spending BeauBucks is not itself a donation/);
  assert.match(guide.items.find((item) => item.id === ROOM_SPEND_INTENTS.performer).detail, /do not become a cash payout by default/);
});

test('connected Givebutter support is the only financial intent', () => {
  const guide = getRoomSpendIntentGuide({ enabled: true, supportProvider: 'givebutter', supportUrl: 'https://givebutter.com/example' });
  assert.equal(guide.supportConnected, true);
  assert.equal(guide.items.filter((item) => item.financial).length, 1);
  assert.equal(guide.items.find((item) => item.financial).id, ROOM_SPEND_INTENTS.support);
  assert.match(guide.items.find((item) => item.financial).detail, /external checkout is the real-money support step/);
});
