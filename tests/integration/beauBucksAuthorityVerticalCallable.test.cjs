const assert = require('node:assert/strict');
const { deleteCollection, installIoGuards } = require('./harness.cjs');

process.env.BEAUBUCKS_AUTHORITY_ROOM_CODES = 'ROOMBB,ROOMB2';
process.env.BEAUBUCKS_AUTHORITY_HOST_UIDS = '';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_beaubucks123';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_beaubucks123';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-bross';

const admin = require('../../functions/node_modules/firebase-admin');
const Stripe = require('../../functions/node_modules/stripe');
const { buildLedgerEntryId } = require('../../functions/lib/beauBucksLedger');
const {
  buildBeauBucksAccountId,
  buildBeauBucksAdjustmentId,
  buildBeauBucksPaymentRefId,
} = require('../../functions/lib/beauBucksAuthority');
const {
  createBeauBucksCheckout,
  getMyRoomBeauBucksWallet,
  listMyRoomCreditActivity,
  spendAudienceBeauBucks,
  stripeWebhook,
} = require('../../functions/index.js');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required for callable integration tests.');
}
installIoGuards();

const APP_ID = 'bross-app';
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = 'ROOMBB';
const SECOND_ROOM_CODE = 'ROOMB2';
const USER_UID = 'beaubucks-buyer';
const SESSION_ID = 'cs_beaubucks_starter_1';
const PAYMENT_INTENT_ID = 'pi_beaubucks_starter_1';
const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const secondRoomRef = db.doc(`${ROOT}/rooms/${SECOND_ROOM_CODE}`);
const secondRoomUserRef = db.doc(`${ROOT}/room_users/${SECOND_ROOM_CODE}_${USER_UID}`);
const userRef = db.doc(`users/${USER_UID}`);
const checkoutRef = db.doc(`${ROOT}/stripe_checkouts/${SESSION_ID}`);
const accountId = buildBeauBucksAccountId({ uid: USER_UID });
const accountRef = db.doc(`beaurocks_ledger_accounts/${accountId}`);
const purchaseLimitRef = db.doc(`beaurocks_beaubucks_purchase_limits/${accountId}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: { firebase: { sign_in_provider: 'password' } } } : null,
  app: null,
  data,
  rawRequest: { ip: '127.0.0.1', get: () => '' },
});

const createResponseCapture = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  send(body) { this.body = body; return this; },
  json(body) { this.body = body; return this; },
});

async function invokeStripeWebhook(eventPayload) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const payload = JSON.stringify(eventPayload);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const req = { headers: { 'stripe-signature': signature }, rawBody: Buffer.from(payload) };
  const res = createResponseCapture();
  await stripeWebhook(req, res);
  return res;
}

async function expectHttpsError(run, expectedCode) {
  try {
    await run();
  } catch (error) {
    assert.ok(String(error?.code || '').includes(expectedCode), `Expected ${expectedCode}, received ${error?.code}`);
    return;
  }
  assert.fail(`Expected ${expectedCode} but callable succeeded.`);
}

async function resetState() {
  for (const collectionPath of [
    ['beaurocks_ledger_entries'],
    ['beaurocks_ledger_accounts'],
    ['beaurocks_payment_refs'],
    ['beaurocks_payment_adjustments'],
    ['beaurocks_pending_payment_adjustments'],
    ['beaurocks_pending_payment_adjustment_events'],
    ['beaurocks_beaubucks_purchase_limits'],
    ['beaurocks_spend_operations'],
    ['artifacts', APP_ID, 'public', 'data', 'rooms'],
    ['artifacts', APP_ID, 'public', 'data', 'room_users'],
    ['artifacts', APP_ID, 'public', 'data', 'stripe_checkouts'],
    ['users'],
  ]) {
    await deleteCollection(db, collectionPath);
  }
  await Promise.all([
    roomRef.set({
      hostUid: 'host-uid',
      hostUids: ['host-uid'],
      eventCredits: {
        enabled: true,
        presetId: 'beaubucks',
        beauBucksAuthorityEnabled: true,
        beauBucksEnabledTonight: true,
      },
    }),
    secondRoomRef.set({
      hostUid: 'host-uid',
      hostUids: ['host-uid'],
      eventCredits: {
        enabled: true,
        presetId: 'beaubucks',
        beauBucksAuthorityEnabled: true,
        beauBucksEnabledTonight: true,
      },
    }),
    roomUserRef.set({ roomCode: ROOM_CODE, uid: USER_UID, name: 'Buyer', points: 777 }),
    secondRoomUserRef.set({ roomCode: SECOND_ROOM_CODE, uid: USER_UID, name: 'Buyer', points: 222 }),
    userRef.set({ uid: USER_UID, pointsBalance: 999 }),
    checkoutRef.set({
      schemaVersion: 1,
      checkoutType: 'beaubucks_purchase',
      sessionId: SESSION_ID,
      roomCode: ROOM_CODE,
      buyerUid: USER_UID,
      packId: 'beaubucks_starter_1200',
      label: 'Starter 1,200 BeauBucks',
      amountCents: 500,
      currency: 'usd',
      beauBucks: 1200,
      rewardScope: 'account',
      checkoutStatus: 'created',
    }),
  ]);
}

const purchaseEvent = {
  id: 'evt_beaubucks_purchase_1',
  type: 'checkout.session.completed',
  object: 'event',
  data: {
    object: {
      id: SESSION_ID,
      object: 'checkout.session',
      mode: 'payment',
      amount_total: 500,
      currency: 'usd',
      payment_status: 'paid',
      payment_intent: PAYMENT_INTENT_ID,
      metadata: {
        checkoutType: 'beaubucks_purchase',
        roomCode: ROOM_CODE,
        buyerUid: USER_UID,
        packId: 'beaubucks_starter_1200',
        beauBucks: '1200',
        rewardScope: 'account',
      },
    },
  },
};

async function run() {
  await resetState();

  await roomRef.update({ 'eventCredits.beauBucksEnabledTonight': false });
  const offWallet = await getMyRoomBeauBucksWallet.run(requestFor(USER_UID, { roomCode: ROOM_CODE }));
  assert.equal(offWallet.authorityEnabled, true);
  assert.equal(offWallet.hostEnabledTonight, true);
  assert.equal(offWallet.experienceEnabled, true);
  assert.equal(offWallet.unavailableReason, '');
  assert.deepEqual(offWallet.allowedSpendKinds, ['durable_cosmetic_unlock']);

  await expectHttpsError(
    () => createBeauBucksCheckout.run(requestFor(USER_UID, { roomCode: ROOM_CODE, packId: 'beaubucks_starter_1200' })),
    'failed-precondition',
  );

  const purchase = await invokeStripeWebhook(purchaseEvent);
  assert.equal(purchase.statusCode, 200);
  assert.equal(purchase.body.beauBucksCheckout, true);
  assert.equal(purchase.body.granted, true);
  assert.equal((await accountRef.get()).get('balance'), 1200);
  assert.equal((await purchaseLimitRef.get()).get('completedPurchases'), 1);
  assert.equal((await purchaseLimitRef.get()).get('lastCompletedSessionId'), SESSION_ID);
  assert.equal((await roomUserRef.get()).get('points'), 777);
  assert.equal((await userRef.get()).get('pointsBalance'), 999);

  const purchaseLedgerRef = db.doc(`beaurocks_ledger_entries/${buildLedgerEntryId(`beaubucks_purchase:${SESSION_ID}`)}`);
  const purchaseLedger = (await purchaseLedgerRef.get()).data();
  assert.equal(purchaseLedger.type, 'purchase_grant');
  assert.equal(purchaseLedger.amount, 1200);
  assert.equal(purchaseLedger.authoritative, true);
  assert.equal(purchaseLedger.shadow, false);
  assert.equal(purchaseLedger.financial.amountCents, 500);
  assert.equal((await db.doc(`beaurocks_payment_refs/${buildBeauBucksPaymentRefId(PAYMENT_INTENT_ID)}`).get()).exists, true);

  const purchaseReplay = await invokeStripeWebhook(purchaseEvent);
  assert.equal(purchaseReplay.body.duplicate, true);
  assert.equal((await accountRef.get()).get('balance'), 1200);

  const wallet = await getMyRoomBeauBucksWallet.run(requestFor(USER_UID, { roomCode: ROOM_CODE }));
  assert.equal(wallet.balance, 1200);
  assert.equal(wallet.authority, 'ledger');
  assert.equal(wallet.hostEnabledTonight, true);
  assert.equal(wallet.experienceEnabled, true);
  assert.equal(wallet.unavailableReason, '');
  assert.equal(wallet.canPurchase, false);
  assert.deepEqual(wallet.allowedSpendKinds, ['durable_cosmetic_unlock']);

  const spendRequest = requestFor(USER_UID, {
    roomCode: ROOM_CODE,
    kind: 'reaction',
    clientOperationId: 'paid-reaction-1',
    payload: { reactionType: 'fire', performanceId: 'performance-1' },
  });
  await expectHttpsError(
    () => spendAudienceBeauBucks.run(spendRequest),
    'failed-precondition',
  );
  assert.equal((await accountRef.get()).get('balance'), 1200);
  assert.equal((await roomUserRef.get()).get('points'), 777);

  const secondRoomWallet = await getMyRoomBeauBucksWallet.run(requestFor(USER_UID, { roomCode: SECOND_ROOM_CODE }));
  assert.equal(secondRoomWallet.scope, 'account');
  assert.equal(secondRoomWallet.balance, 1200);
  assert.equal(secondRoomWallet.experienceEnabled, true);
  const secondRoomActivity = await listMyRoomCreditActivity.run(requestFor(USER_UID, { roomCode: SECOND_ROOM_CODE, limit: 10 }));
  assert.equal(secondRoomActivity.balance, 222);
  assert.equal(secondRoomActivity.beauBucksBalance, 1200);
  assert.equal(secondRoomActivity.beauBucksWalletScope, 'account');
  assert.ok(secondRoomActivity.activities.some((entry) => entry.currency === 'beaubucks'));

  const activity = await listMyRoomCreditActivity.run(requestFor(USER_UID, { roomCode: ROOM_CODE, limit: 10 }));
  assert.equal(activity.balance, 777);
  assert.equal(activity.beauBucksBalance, 1200);
  assert.equal(activity.beauBucksBalanceAuthority, 'ledger');
  assert.equal(activity.beauBucksWalletAvailable, true);
  const purchaseProof = activity.activities.find((entry) => entry.title === 'BeauBucks purchase');
  assert.equal(purchaseProof.kind, 'payment');
  assert.equal(purchaseProof.payment.amountCents, 500);

  const refundEvent = {
    id: 'evt_beaubucks_refund_half',
    type: 'charge.refunded',
    object: 'event',
    data: { object: {
      id: 'ch_beaubucks_1', object: 'charge', payment_intent: PAYMENT_INTENT_ID,
      amount: 500, amount_refunded: 250, currency: 'usd',
    } },
  };
  const refund = await invokeStripeWebhook(refundEvent);
  assert.equal(refund.body.beauBucksAdjustment, true);
  assert.equal(refund.body.applied, true);
  assert.equal((await accountRef.get()).get('balance'), 600);
  const refundReplay = await invokeStripeWebhook(refundEvent);
  assert.equal(refundReplay.body.duplicate, true);
  assert.equal((await accountRef.get()).get('balance'), 600);

  const chargebackEvent = {
    id: 'evt_beaubucks_chargeback',
    type: 'charge.dispute.created',
    object: 'event',
    data: { object: {
      id: 'dp_beaubucks_1', object: 'dispute', charge: 'ch_beaubucks_1',
      payment_intent: PAYMENT_INTENT_ID, amount: 500, currency: 'usd',
    } },
  };
  const chargeback = await invokeStripeWebhook(chargebackEvent);
  assert.equal(chargeback.body.beauBucksAdjustment, true);
  assert.equal(chargeback.body.applied, true);
  assert.equal((await accountRef.get()).get('balance'), 0);
  assert.equal((await accountRef.get()).get('status'), 'restricted');
  const adjustment = (await db.doc(`beaurocks_payment_adjustments/${buildBeauBucksAdjustmentId(chargebackEvent.id)}`).get()).data();
  assert.equal(adjustment.appliedRevocation, 600);
  assert.equal(adjustment.unrecoveredAmount, 0);

  await expectHttpsError(
    () => spendAudienceBeauBucks.run(requestFor(USER_UID, {
      roomCode: ROOM_CODE,
      kind: 'reaction',
      clientOperationId: 'paid-reaction-after-chargeback',
      payload: { reactionType: 'fire' },
    })),
    'failed-precondition',
  );
  assert.equal((await accountRef.get()).get('balance'), 0);
  assert.equal((await roomUserRef.get()).get('points'), 777);

  await resetState();
  const earlyRefund = await invokeStripeWebhook(refundEvent);
  assert.equal(earlyRefund.body.additionalUsageAdjustment, false);
  assert.equal(earlyRefund.body.beauBucksAdjustment, false);
  assert.equal(earlyRefund.body.beauBucksAdjustmentPending, true);
  assert.equal(earlyRefund.body.ignored, true);
  const earlyRefundReplay = await invokeStripeWebhook(refundEvent);
  assert.equal(earlyRefundReplay.body.pendingAdjustmentDuplicate, true);
  const paymentRefId = buildBeauBucksPaymentRefId(PAYMENT_INTENT_ID);
  const pendingRefundRef = db.doc(`beaurocks_pending_payment_adjustments/${paymentRefId}`);
  assert.equal((await pendingRefundRef.get()).get('cumulativeRefundedAmountCents'), 250);
  assert.equal((await pendingRefundRef.get()).get('eventCount'), 1);
  assert.equal((await db.doc(`beaurocks_pending_payment_adjustment_events/${buildBeauBucksAdjustmentId(refundEvent.id)}`).get()).exists, true);

  const purchaseAfterRefund = await invokeStripeWebhook(purchaseEvent);
  assert.equal(purchaseAfterRefund.body.granted, true);
  assert.equal(purchaseAfterRefund.body.pendingAdjustmentApplied, true);
  assert.equal(purchaseAfterRefund.body.pendingAdjustmentType, 'refund');
  assert.equal((await accountRef.get()).get('balance'), 600);
  assert.equal((await accountRef.get()).get('status'), 'active');
  assert.equal((await pendingRefundRef.get()).get('status'), 'recovered');
  assert.equal((await db.doc(`beaurocks_payment_refs/${paymentRefId}`).get()).get('status'), 'partially_refunded');
  const recoveredRefundAdjustmentId = buildBeauBucksAdjustmentId(`pending_recovery:${paymentRefId}`);
  const recoveredRefundAdjustment = (await db.doc(`beaurocks_payment_adjustments/${recoveredRefundAdjustmentId}`).get()).data();
  assert.equal(recoveredRefundAdjustment.appliedRevocation, 600);
  assert.equal(recoveredRefundAdjustment.unrecoveredAmount, 0);
  const recoveredRefundLedgerId = buildLedgerEntryId(`beaubucks_pending_adjustment:${paymentRefId}`);
  assert.equal((await db.doc(`beaurocks_ledger_entries/${recoveredRefundLedgerId}`).get()).get('type'), 'refund_reversal');
  const purchaseAfterRefundReplay = await invokeStripeWebhook(purchaseEvent);
  assert.equal(purchaseAfterRefundReplay.body.duplicate, true);
  assert.equal((await accountRef.get()).get('balance'), 600);
  assert.equal((await roomUserRef.get()).get('points'), 777);
  assert.equal((await userRef.get()).get('pointsBalance'), 999);

  await resetState();
  const earlyChargeback = await invokeStripeWebhook(chargebackEvent);
  assert.equal(earlyChargeback.body.beauBucksAdjustmentPending, true);
  assert.equal((await db.doc(`beaurocks_pending_payment_adjustments/${paymentRefId}`).get()).get('chargebackObserved'), true);
  const purchaseAfterChargeback = await invokeStripeWebhook(purchaseEvent);
  assert.equal(purchaseAfterChargeback.body.granted, true);
  assert.equal(purchaseAfterChargeback.body.pendingAdjustmentApplied, true);
  assert.equal(purchaseAfterChargeback.body.pendingAdjustmentType, 'chargeback');
  assert.equal((await accountRef.get()).get('balance'), 0);
  assert.equal((await accountRef.get()).get('status'), 'restricted');
  const recoveredChargebackAdjustment = (await db.doc(`beaurocks_payment_adjustments/${recoveredRefundAdjustmentId}`).get()).data();
  assert.equal(recoveredChargebackAdjustment.appliedRevocation, 1200);
  assert.equal(recoveredChargebackAdjustment.unrecoveredAmount, 0);
  assert.equal((await db.doc(`beaurocks_ledger_entries/${recoveredRefundLedgerId}`).get()).get('type'), 'chargeback_reversal');
  assert.equal((await roomUserRef.get()).get('points'), 777);
  assert.equal((await userRef.get()).get('pointsBalance'), 999);

  console.log('PASS BeauBucks authority vertical callable');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
