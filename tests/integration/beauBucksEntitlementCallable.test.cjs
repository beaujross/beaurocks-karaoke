const assert = require('node:assert/strict');
const { deleteCollection, installIoGuards } = require('./harness.cjs');

process.env.BEAUBUCKS_AUTHORITY_ROOM_CODES = 'ROOMCOS';
process.env.BEAUBUCKS_AUTHORITY_HOST_UIDS = '';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-bross';

const admin = require('../../functions/node_modules/firebase-admin');
const { buildBeauBucksAccountId } = require('../../functions/lib/beauBucksAuthority');
const { buildEntitlementDocumentId } = require('../../functions/lib/beauBucksEntitlements');
const {
  getMyRoomBeauBucksWallet,
  purchaseBeauBucksEntitlement,
} = require('../../functions/index.js');

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is required.');
installIoGuards();

const APP_ID = 'bross-app';
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = 'ROOMCOS';
const USER_UID = 'premium-cosmetic-buyer';
const db = admin.firestore();
const accountId = buildBeauBucksAccountId({ uid: USER_UID });
const accountRef = db.doc(`beaurocks_ledger_accounts/${accountId}`);
const userRef = db.doc(`users/${USER_UID}`);

const requestFor = (data = {}, provider = 'password') => ({
  auth: { uid: USER_UID, token: { firebase: { sign_in_provider: provider } } },
  app: null,
  data,
  rawRequest: { ip: '127.0.0.1', get: () => '' },
});

async function resetState() {
  for (const collectionPath of [
    ['beaurocks_ledger_entries'],
    ['beaurocks_ledger_accounts'],
    ['beaurocks_account_entitlements'],
    ['beaurocks_entitlement_operations'],
    ['artifacts', APP_ID, 'public', 'data', 'rooms'],
    ['artifacts', APP_ID, 'public', 'data', 'room_users'],
    ['users'],
  ]) await deleteCollection(db, collectionPath);

  await Promise.all([
    db.doc(`${ROOT}/rooms/${ROOM_CODE}`).set({
      hostUid: 'host-uid',
      eventCredits: { enabled: true, beauBucksAuthorityEnabled: true, beauBucksEnabledTonight: false },
    }),
    db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`).set({ uid: USER_UID, points: 250 }),
    accountRef.set({ accountId, uid: USER_UID, currency: 'beaubucks', scope: 'account', status: 'active', balance: 1000 }),
    userRef.set({ uid: USER_UID, unlockedEmojis: [] }),
  ]);
}

async function run() {
  await resetState();

  const anonymousWallet = await getMyRoomBeauBucksWallet.run(requestFor({ roomCode: ROOM_CODE }, 'anonymous'));
  assert.equal(anonymousWallet.accountEligible, false);
  assert.equal(anonymousWallet.reactionSlotCount, 4);

  const wallet = await getMyRoomBeauBucksWallet.run(requestFor({ roomCode: ROOM_CODE }));
  assert.equal(wallet.reactionSlotCount, 5);
  assert.equal(wallet.premiumCatalog.length, 7);
  assert.deepEqual(wallet.allowedSpendKinds, ['durable_cosmetic_unlock']);

  const profileRequest = requestFor({
    roomCode: ROOM_CODE,
    productId: 'profile_disco_ball',
    clientOperationId: 'profile-disco-1',
  });
  const profileUnlock = await purchaseBeauBucksEntitlement.run(profileRequest);
  assert.equal(profileUnlock.outcome, 'accepted');
  assert.equal(profileUnlock.chargedAmount, 120);
  assert.equal(profileUnlock.balanceAfter, 880);
  assert.ok((await userRef.get()).get('unlockedEmojis').includes('disco_ball'));
  const entitlementId = buildEntitlementDocumentId({ uid: USER_UID, productId: 'profile_disco_ball' });
  assert.equal((await db.doc(`beaurocks_account_entitlements/${entitlementId}`).get()).exists, true);

  const replay = await purchaseBeauBucksEntitlement.run(profileRequest);
  assert.equal(replay.duplicate, true);
  assert.equal((await accountRef.get()).get('balance'), 880);

  const sixthSlot = await purchaseBeauBucksEntitlement.run(requestFor({
    roomCode: ROOM_CODE,
    productId: 'reaction_slot_6',
    clientOperationId: 'reaction-slot-6-1',
  }));
  assert.equal(sixthSlot.outcome, 'accepted');
  assert.equal(sixthSlot.reactionSlotCount, 6);
  assert.equal(sixthSlot.balanceAfter, 580);

  const finalWallet = await getMyRoomBeauBucksWallet.run(requestFor({ roomCode: ROOM_CODE }));
  assert.equal(finalWallet.balance, 580);
  assert.equal(finalWallet.reactionSlotCount, 6);
  assert.deepEqual(finalWallet.entitlementIds.sort(), ['profile_disco_ball', 'reaction_slot_6']);

  await accountRef.update({ balance: 0 });
  const insufficient = await purchaseBeauBucksEntitlement.run(requestFor({
    roomCode: ROOM_CODE,
    productId: 'profile_crystal_ball',
    clientOperationId: 'profile-crystal-no-funds',
  }));
  assert.equal(insufficient.outcome, 'insufficient_balance');
  assert.equal(insufficient.chargedAmount, 0);
  assert.equal((await userRef.get()).get('unlockedEmojis').includes('crystal_ball'), false);

  console.log('BeauBucks durable entitlement callable checks passed.');
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
