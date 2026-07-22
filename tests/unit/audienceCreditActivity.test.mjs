import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildAudienceCreditActivity,
  buildAudienceLedgerAccountIds,
  buildConfirmationCode,
  sanitizeLedgerActivity,
  sanitizePaidCheckoutActivity,
} = require('../../functions/lib/audienceCreditActivity.js');

test('activity account lookup is scoped to one Room guest across both current currencies', () => {
  assert.deepEqual(buildAudienceLedgerAccountIds({ roomCode: ' Room1 ', uid: 'User_1' }), [
    'room1__user_1__points',
    'room1__user_1__beaubucks',
  ]);
});

test('posted ledger entries become sanitized, friendly Room activity', () => {
  const activity = sanitizeLedgerActivity({
    ledgerEntryId: 'ledger-secret', status: 'posted', direction: 'credit',
    type: 'vip_account_upgrade', amount: 5000, currency: 'points',
    createdAt: { seconds: 123 }, source: { sourceId: 'must-not-leak' },
  });
  assert.equal(activity.title, 'VIP account reward');
  assert.equal(activity.amount, 5000);
  assert.equal(activity.occurredAtMs, 123000);
  assert.equal(activity.source, undefined);
  assert.equal(activity.activityId, buildConfirmationCode('activity:ledger-secret'));
});

test('only completed paid checkouts become financial proof records', () => {
  assert.equal(sanitizePaidCheckoutActivity({ paymentStatus: 'unpaid', checkoutStatus: 'completed' }), null);
  const activity = sanitizePaidCheckoutActivity({
    documentId: 'cs_secret_checkout', sessionId: 'cs_secret_checkout', checkoutType: 'points_pack',
    checkoutStatus: 'completed', paymentStatus: 'paid', label: 'Solo Boost', points: 1200,
    amountCents: 500, fulfilledAt: { seconds: 456 },
  });
  assert.equal(activity.title, 'Solo Boost purchase');
  assert.equal(activity.payment.amountCents, 500);
  assert.match(activity.payment.confirmationCode, /^BR-[A-F0-9]{10}$/);
  assert.ok(!JSON.stringify(activity).includes('cs_secret_checkout'));
});

test('activity feed merges, sorts, and caps payment and Room records', () => {
  const result = buildAudienceCreditActivity({
    ledgerEntries: [
      { ledgerEntryId: 'one', status: 'posted', direction: 'debit', type: 'reaction_spend', amount: 2, createdAt: { seconds: 200 } },
      { ledgerEntryId: 'two', status: 'draft', direction: 'credit', type: 'join_grant', amount: 100, createdAt: { seconds: 500 } },
    ],
    paidCheckouts: [
      { documentId: 'paid', sessionId: 'paid', checkoutType: 'tip_crate', checkoutStatus: 'completed', paymentStatus: 'paid', label: 'Crowd Energy', points: 2500, amountCents: 1000, rewardScope: 'room', fulfilledAt: { seconds: 300 } },
    ],
    limit: 1,
  });
  assert.equal(result.activities.length, 1);
  assert.equal(result.activities[0].kind, 'payment');
  assert.equal(result.activities[0].direction, 'room_credit');
  assert.equal(result.hasMore, true);
  assert.equal(result.paymentRecordCount, 1);
});
