import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildBeauBucksAccountId,
  buildBeauBucksAdjustmentPlan,
  buildPendingBeauBucksAdjustmentState,
  evaluateBeauBucksPurchaseReservation,
  getBeauBucksPack,
  getBeauBucksPurchaseLimit,
  isBeauBucksCheckoutEnabled,
  validateBeauBucksCheckoutFulfillment,
} = require('../../functions/lib/beauBucksAuthority.js');

test('the first BeauBucks pack and wallet persist at the BeauRocks account level while checkout fails closed', () => {
  const pack = getBeauBucksPack('beaubucks_starter_1200');
  assert.deepEqual(pack, {
    id: 'beaubucks_starter_1200', publicLabel: 'Starter 1,200 BeauBucks',
    amountCents: 500, currency: 'usd', beauBucks: 1200, scope: 'account', publicOffer: false,
  });
  assert.equal(isBeauBucksCheckoutEnabled(), false);
  assert.equal(buildBeauBucksAccountId({ roomCode: 'ROOM1', uid: 'User-1' }), 'account__User-1__beaubucks');
  assert.equal(buildBeauBucksAccountId({ roomCode: 'ROOM2', uid: 'User-1' }), 'account__User-1__beaubucks');
});

test('purchase reservations enforce one completed pack and one active checkout per BeauRocks account', () => {
  const pack = getBeauBucksPack('beaubucks_starter_1200');
  assert.deepEqual(getBeauBucksPurchaseLimit(), {
    maxCompletedPurchasesPerAccount: 1,
    reservationMinutes: 35,
  });
  const available = evaluateBeauBucksPurchaseReservation({
    account: {}, limitState: {}, pack, reservationId: 'reservation-1', nowMs: 1000,
  });
  assert.equal(available.allowed, true);
  assert.equal(available.reservationExpiresAtMs, 2101000);
  assert.equal(evaluateBeauBucksPurchaseReservation({
    account: {},
    limitState: { reservationId: 'reservation-other', reservationExpiresAtMs: 2101000 },
    pack,
    reservationId: 'reservation-1',
    nowMs: 1000,
  }).reasonCode, 'beaubucks_purchase_in_progress');
  assert.equal(evaluateBeauBucksPurchaseReservation({
    account: { lifetimePurchased: 1200 }, limitState: {}, pack, reservationId: 'reservation-1', nowMs: 1000,
  }).reasonCode, 'beaubucks_purchase_limit_reached');
  assert.equal(evaluateBeauBucksPurchaseReservation({
    account: {},
    limitState: { reservationId: 'expired', reservationExpiresAtMs: 999 },
    pack,
    reservationId: 'reservation-1',
    nowMs: 1000,
  }).allowed, true);
});

test('fulfillment accepts only a registered paid checkout with exact server pricing', () => {
  const checkout = {
    checkoutType: 'beaubucks_purchase', roomCode: 'ROOM1', buyerUid: 'user-1',
    packId: 'beaubucks_starter_1200', currency: 'usd', amountCents: 500, beauBucks: 1200, rewardScope: 'account',
  };
  const session = {
    payment_status: 'paid', amount_total: 500, currency: 'usd',
    metadata: { checkoutType: 'beaubucks_purchase', roomCode: 'ROOM1', buyerUid: 'user-1', packId: 'beaubucks_starter_1200', beauBucks: '1200', rewardScope: 'account' },
  };
  assert.equal(validateBeauBucksCheckoutFulfillment({ checkout, session }).ok, true);
  assert.equal(validateBeauBucksCheckoutFulfillment({ checkout, session: { ...session, amount_total: 499 } }).reasonCode, 'beaubucks_checkout_amount_mismatch');
  assert.equal(validateBeauBucksCheckoutFulfillment({ checkout, session: { ...session, payment_status: 'unpaid' } }).reasonCode, 'beaubucks_payment_not_paid');
});

test('fulfillment rejects altered registered value even when the signed total matches', () => {
  const result = validateBeauBucksCheckoutFulfillment({
    checkout: {
      checkoutType: 'beaubucks_purchase', roomCode: 'ROOM1', buyerUid: 'user-1',
      packId: 'beaubucks_starter_1200', amountCents: 500, currency: 'usd', beauBucks: 999, rewardScope: 'account',
    },
    session: {
      amount_total: 500, currency: 'usd', payment_status: 'paid',
      metadata: {
        checkoutType: 'beaubucks_purchase', roomCode: 'ROOM1', buyerUid: 'user-1',
        packId: 'beaubucks_starter_1200', beauBucks: '1200', rewardScope: 'account',
      },
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, 'beaubucks_checkout_amount_mismatch');
});

test('fulfillment rejects a checkout that attempts to restore Room-scoped purchased value', () => {
  const checkout = {
    checkoutType: 'beaubucks_purchase', roomCode: 'ROOM1', buyerUid: 'user-1',
    packId: 'beaubucks_starter_1200', currency: 'usd', amountCents: 500, beauBucks: 1200,
    rewardScope: 'room',
  };
  const session = {
    payment_status: 'paid', amount_total: 500, currency: 'usd',
    metadata: {
      checkoutType: 'beaubucks_purchase', roomCode: 'ROOM1', buyerUid: 'user-1',
      packId: 'beaubucks_starter_1200', beauBucks: '1200', rewardScope: 'room',
    },
  };
  assert.equal(validateBeauBucksCheckoutFulfillment({ checkout, session }).reasonCode, 'beaubucks_checkout_scope_mismatch');
});

test('partial refunds revoke proportionate unspent value and preserve shortfall evidence', () => {
  assert.deepEqual(buildBeauBucksAdjustmentPlan({
    purchaseBeauBucks: 1200, purchaseAmountCents: 500, requestedAdjustedAmountCents: 250,
    availableBalance: 1000, adjustmentType: 'refund',
  }), {
    targetAdjustedAmountCents: 250,
    requestedRevocation: 600,
    appliedRevocation: 600,
    unrecoveredAmount: 0,
    balanceAfter: 400,
    restrictAccount: false,
  });
  assert.deepEqual(buildBeauBucksAdjustmentPlan({
    purchaseBeauBucks: 1200, purchaseAmountCents: 500, priorAdjustedAmountCents: 250,
    requestedAdjustedAmountCents: 500, availableBalance: 100, adjustmentType: 'refund',
  }), {
    targetAdjustedAmountCents: 500,
    requestedRevocation: 600,
    appliedRevocation: 100,
    unrecoveredAmount: 500,
    balanceAfter: 0,
    restrictAccount: false,
  });
});

test('chargebacks target the full purchase and restrict the account', () => {
  const plan = buildBeauBucksAdjustmentPlan({
    purchaseBeauBucks: 1200, purchaseAmountCents: 500, availableBalance: 1200,
    requestedAdjustedAmountCents: 1, adjustmentType: 'chargeback',
  });
  assert.equal(plan.requestedRevocation, 1200);
  assert.equal(plan.balanceAfter, 0);
  assert.equal(plan.restrictAccount, true);
});

test('pending adjustment state is cumulative, bounded, and chargeback-sticky', () => {
  const refund = buildPendingBeauBucksAdjustmentState({
    existing: { cumulativeRefundedAmountCents: 100, eventIdHashes: ['one'], eventCount: 1 },
    eventIdHash: 'two', adjustmentType: 'refund', cumulativeRefundedAmountCents: 250,
  });
  assert.equal(refund.cumulativeRefundedAmountCents, 250);
  assert.equal(refund.chargebackObserved, false);
  assert.deepEqual(refund.eventIdHashes, ['one', 'two']);
  const chargeback = buildPendingBeauBucksAdjustmentState({
    existing: refund,
    eventIdHash: 'three', adjustmentType: 'chargeback', chargebackAmountCents: 500,
    maxEventIds: 2,
  });
  assert.equal(chargeback.chargebackObserved, true);
  assert.equal(chargeback.chargebackAmountCents, 500);
  assert.deepEqual(chargeback.eventIdHashes, ['two', 'three']);
  assert.equal(chargeback.eventCount, 3);
});
