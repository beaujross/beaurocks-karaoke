const assert = require('node:assert/strict');

const admin = require('../../functions/node_modules/firebase-admin');
const { buildShadowLedgerEntry } = require('../../functions/lib/beauBucksLedger');
const { listMyRoomCreditActivity } = require('../../functions/index.js');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-bross';
const APP_ID = 'bross-app';
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = 'HIST1';
const OTHER_ROOM_CODE = 'HIST2';
const USER_UID = 'activity-user';
const OTHER_UID = 'other-user';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is required.');
process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid } : null,
  app: null,
  data,
  rawRequest: { ip: '127.0.0.1', get: () => '' },
});

async function expectHttpsError(run, expectedCode) {
  try {
    await run();
  } catch (error) {
    assert.ok(String(error?.code || '').includes(expectedCode), `Expected ${expectedCode}, received ${error?.code}`);
    return;
  }
  assert.fail(`Expected ${expectedCode} but callable succeeded.`);
}

async function run() {
  const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
  const ledger = buildShadowLedgerEntry({
    idempotencyKey: 'vip-history-proof', roomCode: ROOM_CODE, uid: USER_UID,
    eventCredits: { enabled: false }, type: 'vip_account_upgrade', amount: 5000,
    serverTimestamp: admin.firestore.Timestamp.fromMillis(1000),
  });
  const otherLedger = buildShadowLedgerEntry({
    idempotencyKey: 'other-user-history', roomCode: ROOM_CODE, uid: OTHER_UID,
    eventCredits: { enabled: false }, type: 'join_grant', amount: 999,
    serverTimestamp: admin.firestore.Timestamp.fromMillis(3000),
  });
  const refs = [
    roomUserRef,
    db.doc(`beaurocks_ledger_entries/${ledger.ledgerEntryId}`),
    db.doc(`beaurocks_ledger_entries/${otherLedger.ledgerEntryId}`),
    db.doc(`${ROOT}/stripe_checkouts/cs_paid_activity`),
    db.doc(`${ROOT}/stripe_checkouts/cs_unpaid_activity`),
    db.doc(`${ROOT}/stripe_checkouts/cs_other_room`),
  ];
  await Promise.all(refs.map((ref) => ref.delete().catch(() => {})));
  await Promise.all([
    roomUserRef.set({ roomCode: ROOM_CODE, uid: USER_UID, points: 6200 }),
    refs[1].set(ledger),
    refs[2].set(otherLedger),
    refs[3].set({ sessionId: 'cs_paid_activity', checkoutType: 'points_pack', roomCode: ROOM_CODE, buyerUid: USER_UID, label: 'Solo Boost', points: 1200, amountCents: 500, rewardScope: 'buyer', paymentStatus: 'paid', checkoutStatus: 'completed', fulfilledAt: admin.firestore.Timestamp.fromMillis(2000) }),
    refs[4].set({ sessionId: 'cs_unpaid_activity', checkoutType: 'points_pack', roomCode: ROOM_CODE, buyerUid: USER_UID, label: 'Unpaid', points: 7500, amountCents: 2000, paymentStatus: 'unpaid', checkoutStatus: 'created' }),
    refs[5].set({ sessionId: 'cs_other_room', checkoutType: 'points_pack', roomCode: OTHER_ROOM_CODE, buyerUid: USER_UID, label: 'Other Room', points: 3000, amountCents: 1000, paymentStatus: 'paid', checkoutStatus: 'completed' }),
  ]);

  await expectHttpsError(() => listMyRoomCreditActivity.run(requestFor(null, { roomCode: ROOM_CODE })), 'unauthenticated');
  await expectHttpsError(() => listMyRoomCreditActivity.run(requestFor(OTHER_UID, { roomCode: ROOM_CODE })), 'failed-precondition');

  const result = await listMyRoomCreditActivity.run(requestFor(USER_UID, { roomCode: ROOM_CODE, limit: 10 }));
  assert.equal(result.roomCode, ROOM_CODE);
  assert.equal(result.balance, 6200);
  assert.equal(result.balanceAuthority, 'room_balance');
  assert.equal(result.coverage, 'server_recorded_activity');
  assert.equal(result.activities.length, 2);
  assert.equal(result.activities[0].title, 'Solo Boost purchase');
  assert.equal(result.activities[0].payment.amountCents, 500);
  assert.equal(result.activities[1].title, 'VIP account reward');
  assert.ok(!JSON.stringify(result).includes('cs_paid_activity'));
  assert.ok(!JSON.stringify(result).includes(OTHER_UID));

  const fractionalLimitResult = await listMyRoomCreditActivity.run(requestFor(USER_UID, {
    roomCode: ROOM_CODE,
    limit: 1.8,
  }));
  assert.equal(fractionalLimitResult.activities.length, 1);

  console.log('PASS listMyRoomCreditActivity callable');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
