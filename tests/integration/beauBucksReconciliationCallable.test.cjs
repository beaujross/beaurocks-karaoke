const assert = require('node:assert/strict');

process.env.BEAUBUCKS_RECONCILIATION_ROOM_CODES = 'ROOM1';
process.env.BEAUBUCKS_RECONCILIATION_HOST_UIDS = '';
process.env.SUPER_ADMIN_UIDS = 'super-admin';

const admin = require('../../functions/node_modules/firebase-admin');
const { buildShadowLedgerEntry } = require('../../functions/lib/beauBucksLedger');
const { reconcileBeauBucksShadowLedger } = require('../../functions/index.js');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-bross';
const APP_ID = 'bross-app';
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = 'ROOM1';
const OTHER_ROOM_CODE = 'ROOM2';
const HOST_UID = 'host-uid';
const USER_UID = 'audience-user';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required for callable integration tests.');
}
process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const otherRoomRef = db.doc(`${ROOT}/rooms/${OTHER_ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const userRef = db.doc(`users/${USER_UID}`);
const eventGrantRef = db.doc(`room_event_credit_grants/vip-grant-1`);
const ledgerEntry = buildShadowLedgerEntry({
  idempotencyKey: 'room_event_credit_grant:join-grant-1',
  roomCode: ROOM_CODE,
  uid: USER_UID,
  eventCredits: { enabled: true, presetId: 'beaubucks' },
  type: 'join_grant',
  amount: 100,
  source: {
    provider: 'beaurocks',
    sourceId: 'join-grant-1',
    sourceCollection: 'room_event_credit_grants',
  },
  serverTimestamp: 'seed-time',
});
const ledgerRef = db.doc(`beaurocks_ledger_entries/${ledgerEntry.ledgerEntryId}`);

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

async function resetState() {
  await Promise.all([roomRef, otherRoomRef, roomUserRef, userRef, eventGrantRef, ledgerRef].map((ref) => ref.delete().catch(() => {})));
  await Promise.all([
    roomRef.set({
      hostUid: HOST_UID,
      hostUids: [HOST_UID],
      eventCredits: { enabled: true, presetId: 'beaubucks', eventId: 'canary-night' },
    }),
    otherRoomRef.set({
      hostUid: HOST_UID,
      hostUids: [HOST_UID],
      eventCredits: { enabled: true, presetId: 'beaubucks', eventId: 'other-night' },
    }),
    roomUserRef.set({ roomCode: ROOM_CODE, uid: USER_UID, points: 150, timedLobbyEarnedPoints: 0 }),
    userRef.set({ uid: USER_UID, pointsBalance: 999 }),
    eventGrantRef.set({
      roomCode: ROOM_CODE,
      uid: USER_UID,
      grantType: 'vip',
      pointsGranted: 50,
      source: 'claim_audience_event_grant',
    }),
    ledgerRef.set(ledgerEntry),
  ]);
}

async function run() {
  await resetState();

  await expectHttpsError(
    () => reconcileBeauBucksShadowLedger.run(requestFor(null, { roomCode: ROOM_CODE })),
    'unauthenticated'
  );
  await expectHttpsError(
    () => reconcileBeauBucksShadowLedger.run(requestFor('not-a-host', { roomCode: ROOM_CODE })),
    'permission-denied'
  );
  await expectHttpsError(
    () => reconcileBeauBucksShadowLedger.run(requestFor(HOST_UID, { roomCode: OTHER_ROOM_CODE })),
    'permission-denied'
  );

  const beforeRoomUser = (await roomUserRef.get()).data();
  const beforeLedger = (await ledgerRef.get()).data();
  const hostReport = await reconcileBeauBucksShadowLedger.run(requestFor(HOST_UID, {
    roomCode: ROOM_CODE,
    includeGlobalBalances: true,
  }));
  assert.equal(hostReport.readOnly, true);
  assert.equal(hostReport.authoritative, false);
  assert.equal(hostReport.balanceAuthority, 'legacy');
  assert.equal(hostReport.spendReadiness.balanceAuthority, 'legacy');
  assert.equal(hostReport.spendReadiness.boundaryReady, false);
  assert.equal(hostReport.spendReadiness.summary.operationCount, 0);
  assert.equal(hostReport.migrationReadiness.spendBoundaryReady, false);
  assert.equal(hostReport.migrationReadiness.balanceReadMigrationReady, false);
  assert.equal(hostReport.migrationReadiness.openingBalancePolicy.destructiveBackfillAllowed, false);
  assert.equal(hostReport.access.scope, 'canary_room_host');
  assert.equal(hostReport.access.globalBalancesIncluded, false);
  assert.equal(hostReport.accounts.length, 1);
  assert.equal(hostReport.accounts[0].legacy.globalPointsBalance, null);
  assert.equal(hostReport.accounts[0].delta, 50);
  assert.deepEqual(hostReport.accounts[0].classifications, ['missing_shadow_event']);
  assert.equal(hostReport.accounts[0].evidence.missingShadowEventCount, 1);
  assert.deepEqual((await roomUserRef.get()).data(), beforeRoomUser);
  assert.deepEqual((await ledgerRef.get()).data(), beforeLedger);

  const adminReport = await reconcileBeauBucksShadowLedger.run(requestFor('super-admin', {
    roomCode: ROOM_CODE,
    includeGlobalBalances: true,
  }));
  assert.equal(adminReport.access.scope, 'super_admin');
  assert.equal(adminReport.access.globalBalancesIncluded, true);
  assert.equal(adminReport.accounts[0].legacy.globalPointsBalance, 999);

  console.log('PASS reconcileBeauBucksShadowLedger callable');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
