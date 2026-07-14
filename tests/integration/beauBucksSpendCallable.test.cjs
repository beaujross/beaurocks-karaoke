const assert = require('node:assert/strict');

process.env.BEAUBUCKS_SPEND_ROOM_CODES = 'ROOM1';
process.env.BEAUBUCKS_SPEND_HOST_UIDS = '';

const admin = require('../../functions/node_modules/firebase-admin');
const { buildSpendOperationDocumentId } = require('../../functions/lib/beauBucksSpend');
const { buildLedgerEntryId } = require('../../functions/lib/beauBucksLedger');
const { spendAudienceRoomCredits } = require('../../functions/index.js');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-bross';
const APP_ID = 'bross-app';
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = 'ROOM1';
const OTHER_ROOM_CODE = 'ROOM2';
const USER_UID = 'audience-user';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required for callable integration tests.');
}
process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const otherRoomRef = db.doc(`${ROOT}/rooms/${OTHER_ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const otherRoomUserRef = db.doc(`${ROOT}/room_users/${OTHER_ROOM_CODE}_${USER_UID}`);
const userRef = db.doc(`users/${USER_UID}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid } : null,
  app: null,
  data,
  rawRequest: { ip: '127.0.0.1', get: () => '' },
});

const spendRequest = ({ roomCode = ROOM_CODE, kind, clientOperationId, payload = {} }) => requestFor(USER_UID, {
  roomCode,
  kind,
  clientOperationId,
  payload,
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

async function resetAccount({ points = 100, nameEmojiChangeCount = 1 } = {}) {
  const operationDocs = await db.collection('beaurocks_spend_operations').get();
  const ledgerDocs = await db.collection('beaurocks_ledger_entries').get();
  await Promise.all([
    ...operationDocs.docs.map((snap) => snap.ref.delete()),
    ...ledgerDocs.docs.map((snap) => snap.ref.delete()),
    roomRef.set({
      hostUid: 'host-uid',
      hostUids: ['host-uid'],
      eventCredits: { enabled: true, presetId: 'beaubucks', eventId: 'canary-night' },
    }),
    otherRoomRef.set({
      hostUid: 'host-uid',
      hostUids: ['host-uid'],
      eventCredits: { enabled: true, presetId: 'beaubucks', eventId: 'legacy-night' },
    }),
    roomUserRef.set({ roomCode: ROOM_CODE, uid: USER_UID, name: 'Before', avatar: '😀', points }),
    otherRoomUserRef.set({ roomCode: OTHER_ROOM_CODE, uid: USER_UID, name: 'Before', avatar: '😀', points }),
    userRef.set({ uid: USER_UID, name: 'Before', avatar: '😀', pointsBalance: 999, nameEmojiChangeCount }),
  ]);
}

async function assertOperationAndLedger({ clientOperationId, type, amount, direction = 'debit' }) {
  const operationDocumentId = buildSpendOperationDocumentId({ roomCode: ROOM_CODE, uid: USER_UID, clientOperationId });
  const operation = (await db.doc(`beaurocks_spend_operations/${operationDocumentId}`).get()).data();
  assert.equal(operation.outcome, 'accepted');
  assert.equal(operation.chargedAmount, amount);
  const ledgerId = buildLedgerEntryId(`audience_spend:${operationDocumentId}`);
  const ledger = (await db.doc(`beaurocks_ledger_entries/${ledgerId}`).get()).data();
  assert.equal(ledger.type, type);
  assert.equal(ledger.amount, amount);
  assert.equal(ledger.direction, direction);
  assert.equal(ledger.shadow, true);
  assert.equal(ledger.authoritative, false);
}

async function run() {
  await resetAccount();
  await expectHttpsError(
    () => spendAudienceRoomCredits.run(requestFor(null, {
      roomCode: ROOM_CODE,
      kind: 'reaction',
      clientOperationId: 'reaction:unauthenticated',
      payload: { reactionType: 'fire' },
    })),
    'unauthenticated'
  );

  const legacyBefore = (await otherRoomUserRef.get()).data();
  const legacyResult = await spendAudienceRoomCredits.run(spendRequest({
    roomCode: OTHER_ROOM_CODE,
    kind: 'reaction',
    clientOperationId: 'reaction:legacy-room',
    payload: { reactionType: 'fire' },
  }));
  assert.equal(legacyResult.outcome, 'legacy_fallback');
  assert.deepEqual((await otherRoomUserRef.get()).data(), legacyBefore);

  const reactionOperationId = 'reaction:accepted-1';
  const reactionRequest = spendRequest({
    kind: 'reaction',
    clientOperationId: reactionOperationId,
    payload: { reactionType: 'fire', performanceId: 'performance-1', canonicalSongId: 'song-1', backingTrackId: 'track-1' },
  });
  const acceptedReaction = await spendAudienceRoomCredits.run(reactionRequest);
  assert.equal(acceptedReaction.outcome, 'accepted');
  assert.equal(acceptedReaction.chargedAmount, 5);
  assert.equal(acceptedReaction.balanceAfter, 95);
  const duplicateReaction = await spendAudienceRoomCredits.run(reactionRequest);
  assert.equal(duplicateReaction.outcome, 'accepted');
  assert.equal(duplicateReaction.duplicate, true);
  assert.equal(duplicateReaction.replayCount, 1);
  const reactionOperationDocumentId = buildSpendOperationDocumentId({ roomCode: ROOM_CODE, uid: USER_UID, clientOperationId: reactionOperationId });
  assert.equal((await db.doc(`beaurocks_spend_operations/${reactionOperationDocumentId}`).get()).get('replayCount'), 1);
  assert.equal((await roomUserRef.get()).get('points'), 95);
  assert.equal((await userRef.get()).get('pointsBalance'), 999);
  await assertOperationAndLedger({ clientOperationId: reactionOperationId, type: 'reaction_spend', amount: 5 });

  await resetAccount({ points: 4 });
  const insufficientOperationId = 'reaction:insufficient-1';
  const insufficient = await spendAudienceRoomCredits.run(spendRequest({
    kind: 'reaction',
    clientOperationId: insufficientOperationId,
    payload: { reactionType: 'fire' },
  }));
  assert.equal(insufficient.outcome, 'insufficient_balance');
  assert.equal(insufficient.chargedAmount, 0);
  assert.equal((await roomUserRef.get()).get('points'), 4);
  const insufficientDuplicate = await spendAudienceRoomCredits.run(spendRequest({
    kind: 'reaction',
    clientOperationId: insufficientOperationId,
    payload: { reactionType: 'fire' },
  }));
  assert.equal(insufficientDuplicate.outcome, 'insufficient_balance');
  assert.equal(insufficientDuplicate.duplicate, true);
  assert.equal(insufficientDuplicate.replayCount, 1);

  await resetAccount({ points: 100 });
  const avatarOperationId = 'avatar_unlock:fox-1';
  const avatarResult = await spendAudienceRoomCredits.run(spendRequest({
    kind: 'avatar_unlock',
    clientOperationId: avatarOperationId,
    payload: { avatarId: 'fox' },
  }));
  assert.equal(avatarResult.outcome, 'accepted');
  assert.equal(avatarResult.chargedAmount, 60);
  assert.equal((await roomUserRef.get()).get('points'), 40);
  assert.deepEqual((await userRef.get()).get('unlockedEmojis'), ['fox']);
  await assertOperationAndLedger({ clientOperationId: avatarOperationId, type: 'avatar_unlock_spend', amount: 60 });

  await resetAccount({ points: 600, nameEmojiChangeCount: 1 });
  const profileOperationId = 'profile_change:paid-1';
  const profileResult = await spendAudienceRoomCredits.run(spendRequest({
    kind: 'profile_change',
    clientOperationId: profileOperationId,
    payload: { name: 'After', avatar: '😎' },
  }));
  assert.equal(profileResult.outcome, 'accepted');
  assert.equal(profileResult.chargedAmount, 500);
  assert.equal(profileResult.balanceAfter, 100);
  assert.equal((await roomUserRef.get()).get('name'), 'After');
  assert.equal((await userRef.get()).get('name'), 'After');
  assert.equal((await userRef.get()).get('nameEmojiChangeCount'), 2);
  await assertOperationAndLedger({ clientOperationId: profileOperationId, type: 'profile_change_spend', amount: 500 });

  console.log('PASS spendAudienceRoomCredits callable');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
