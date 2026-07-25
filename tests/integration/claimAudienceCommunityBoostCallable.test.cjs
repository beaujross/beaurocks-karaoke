const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const admin = require("../../functions/node_modules/firebase-admin");
const { claimAudienceCommunityBoost } = require("../../functions/index.js");
const {
  AUDIENCE_COMMUNITY_BOOST_ACTION_ID,
  buildAudienceCommunityBoostClaimId,
} = require("../../functions/lib/audienceCommunityBoost");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "BOOST1";
const OTHER_ROOM_CODE = "BOOST2";
const USER_UID = "community-boost-user";
const CLAIM_ID = buildAudienceCommunityBoostClaimId(USER_UID);
const LEDGER_ID = crypto
  .createHash("sha256")
  .update(`audience_growth_action:${CLAIM_ID}`)
  .digest("hex");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("FIREBASE_AUTH_EMULATOR_HOST is required for Community Boost tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const otherRoomRef = db.doc(`${ROOT}/rooms/${OTHER_ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const otherRoomUserRef = db.doc(`${ROOT}/room_users/${OTHER_ROOM_CODE}_${USER_UID}`);
const userRef = db.doc(`users/${USER_UID}`);
const claimRef = db.doc(`audience_growth_action_claims/${CLAIM_ID}`);
const ledgerRef = db.doc(`beaurocks_ledger_entries/${LEDGER_ID}`);

const requestFor = (data = {}) => ({
  auth: { uid: USER_UID },
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetState({ emailVerified = true } = {}) {
  await Promise.all([
    roomRef.delete(),
    otherRoomRef.delete(),
    roomUserRef.delete(),
    otherRoomUserRef.delete(),
    userRef.delete(),
    claimRef.delete(),
    ledgerRef.delete(),
    admin.auth().deleteUser(USER_UID),
  ].map((promise) => promise.catch(() => {})));
  await admin.auth().createUser({
    uid: USER_UID,
    email: "community-boost@example.com",
    emailVerified,
  });
  await Promise.all([
    roomRef.set({ hostUid: "host-uid" }),
    otherRoomRef.set({ hostUid: "host-uid" }),
    roomUserRef.set({ roomCode: ROOM_CODE, uid: USER_UID, points: 100 }),
    otherRoomUserRef.set({ roomCode: OTHER_ROOM_CODE, uid: USER_UID, points: 25 }),
  ]);
}

async function expectCode(run, expectedCode) {
  try {
    await run();
  } catch (error) {
    assert.ok(String(error?.code || "").includes(expectedCode), `Expected ${expectedCode}, got ${error?.code}`);
    return;
  }
  assert.fail(`Expected ${expectedCode} but callable succeeded.`);
}

async function run() {
  await resetState();
  const first = await claimAudienceCommunityBoost.run(requestFor({
    roomCode: ROOM_CODE,
    selfAttested: true,
  }));
  const secondRoomAttempt = await claimAudienceCommunityBoost.run(requestFor({
    roomCode: OTHER_ROOM_CODE,
    selfAttested: true,
  }));

  assert.equal(first.ok, true);
  assert.equal(first.actionId, AUDIENCE_COMMUNITY_BOOST_ACTION_ID);
  assert.equal(first.pointsGranted, 250);
  assert.equal(first.roomPoints, 350);
  assert.deepEqual(first.networks, ["facebook", "instagram"]);
  assert.equal(secondRoomAttempt.duplicate, true);
  assert.equal(secondRoomAttempt.pointsGranted, 0);
  assert.equal(secondRoomAttempt.roomPoints, 25);

  const [roomUserSnap, otherRoomUserSnap, userSnap, claimSnap, ledgerSnap] = await Promise.all([
    roomUserRef.get(),
    otherRoomUserRef.get(),
    userRef.get(),
    claimRef.get(),
    ledgerRef.get(),
  ]);
  assert.equal(Number(roomUserSnap.get("points")), 350);
  assert.equal(Number(otherRoomUserSnap.get("points")), 25);
  assert.equal(Number(userSnap.get("pointsBalance")), 250);
  assert.equal(userSnap.get("communityBoostClaimed"), true);
  assert.equal(claimSnap.get("selfAttested"), true);
  assert.deepEqual(claimSnap.get("networks"), ["facebook", "instagram"]);
  assert.equal(Number(ledgerSnap.get("amount")), 250);

  await resetState({ emailVerified: false });
  await expectCode(
    () => claimAudienceCommunityBoost.run(requestFor({ roomCode: ROOM_CODE, selfAttested: true })),
    "failed-precondition"
  );
  await expectCode(
    () => claimAudienceCommunityBoost.run(requestFor({ roomCode: ROOM_CODE, selfAttested: false })),
    "failed-precondition"
  );

  console.log("PASS claimAudienceCommunityBoost callable");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
