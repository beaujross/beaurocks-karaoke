const assert = require('node:assert/strict');
const { deleteCollection, installIoGuards } = require('./harness.cjs');

process.env.BEAUBUCKS_AUTHORITY_ROOM_CODES = 'ROOMBB';
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
const USER_UID = 'beaubucks-buyer';
const SESSION_ID = 'cs_beaubucks_starter_1';
const PAYMENT_INTENT_ID = 'pi_beaubucks_starter_1';
const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const userRef = db.doc(`users/${USER_UID}`);
const checkoutRef = db.doc(`${ROOT}/stripe_checkouts/${SESSION_ID}`);
const accountId = buildBeauBucksAccountId({ roomCode: ROOM_CODE, uid: USER_UID });
const accountRef = db.doc(`beaurocks_ledger_accounts/${accountId}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid } : null,
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
      eventCredits: { enabled: true, presetId: 'beaubucks', beauBucksAuthorityEnabled: true },
    }),
    roomUserRef.set({ roomCode: ROOM_CODE, uid: USER_UID, name: 'Buyer', points: 777 }),
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
        rewardScope: 'room',
      },
    },
  },
};

async function run() {
  await resetState();

  await expectHttpsError(
    () => createBeauBucksCheckout.run(requestFor(USER_UID, { roomCode: ROOM_CODE, packId: 'beaubucks_starter_1200' })),
    'failed-precondition',
  );

  const purchase = await invokeStripeWebhook(purchaseEvent);
  assert.equal(purchase.statusCode, 200);
  assert.equal(purchase.body.beauBucksCheckout, true);
  assert.equal(purchase.body.granted, true);
  assert.equal((await accountRef.get()).get('balance'), 1200);
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
  assert.equal(wallet.canPurchase, false);
  assert.deepEqual(wallet.allowedSpendKinds, ['reaction']);

  const spendRequest = requestFor(USER_UID, {
    roomCode: ROOM_CODE,
    kind: 'reaction',
    clientOperationId: 'paid-reaction-1',
    payload: { reactionType: 'fire', performanceId: 'performance-1' },
  });
  const spend = await spendAudienceBeauBucks.run(spendRequest);
  assert.equal(spend.outcome, 'accepted');
  assert.equal(spend.chargedAmount, 5);
  assert.equal(spend.balanceAfter, 1195);
  const spendReplay = await spendAudienceBeauBucks.run(spendRequest);
  assert.equal(spendReplay.duplicate, true);
  assert.equal((await accountRef.get()).get('balance'), 1195);
  assert.equal((await roomUserRef.get()).get('points'), 777);

  const activity = await listMyRoomCreditActivity.run(requestFor(USER_UID, { roomCode: ROOM_CODE, limit: 10 }));
  assert.equal(activity.balance, 777);
  assert.equal(activity.beauBucksBalance, 1195);
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
  assert.equal((await accountRef.get()).get('balance'), 595);
  const refundReplay = await invokeStripeWebhook(refundEvent);
  assert.equal(refundReplay.body.duplicate, true);
  assert.equal((await accountRef.get()).get('balance'), 595);

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
  assert.equal(adjustment.appliedRevocation, 595);
  assert.equal(adjustment.unrecoveredAmount, 5);

  const restrictedSpend = await spendAudienceBeauBucks.run(requestFor(USER_UID, {
    roomCode: ROOM_CODE,
    kind: 'reaction',
    clientOperationId: 'paid-reaction-after-chargeback',
    payload: { reactionType: 'fire' },
  }));
  assert.equal(restrictedSpend.outcome, 'account_restricted');
  assert.equal(restrictedSpend.chargedAmount, 0);
  assert.equal((await accountRef.get()).get('balance'), 0);
  assert.equal((await roomUserRef.get()).get('points'), 777);

  console.log('PASS BeauBucks authority vertical callable');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
