const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const admin = require("../../functions/node_modules/firebase-admin");
const { setMyVipAccountStatus } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "VIP1";
const USER_UID = "verified-audience";
const SOURCE_UID = "anonymous-audience";
const GRANT_ID = `${ROOM_CODE}_vip_account_upgrade_${USER_UID}_vip_account_upgrade`;
const LEDGER_ID = crypto
  .createHash("sha256")
  .update(`room_event_credit_grant:${GRANT_ID}`)
  .digest("hex");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("FIREBASE_AUTH_EMULATOR_HOST is required for VIP callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const sourceRoomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${SOURCE_UID}`);
const userRef = db.doc(`users/${USER_UID}`);
const sourceUserRef = db.doc(`users/${SOURCE_UID}`);
const grantRef = db.doc(`room_event_credit_grants/${GRANT_ID}`);
const ledgerRef = db.doc(`beaurocks_ledger_entries/${LEDGER_ID}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetState() {
  await Promise.all([
    roomRef.delete(),
    roomUserRef.delete(),
    sourceRoomUserRef.delete(),
    userRef.delete(),
    sourceUserRef.delete(),
    grantRef.delete(),
    ledgerRef.delete(),
    admin.auth().deleteUser(USER_UID),
  ].map((promise) => promise.catch(() => {})));
  await admin.auth().createUser({
    uid: USER_UID,
    email: "verified-audience@example.com",
    emailVerified: true,
  });
  await Promise.all([
    roomRef.set({ hostUid: "host-uid", hostUids: ["host-uid"] }),
    roomUserRef.set({ roomCode: ROOM_CODE, uid: USER_UID, points: 125, totalEmojis: 3 }),
  ]);
}

async function runCase(name, fn) {
  await resetState();
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    return false;
  }
}

async function run() {
  const checks = [
    ["verified account receives its VIP reward exactly once", async () => {
      const payload = { roomCode: ROOM_CODE, vipLevel: 1, source: "audience_email_verify" };
      const first = await setMyVipAccountStatus.run(requestFor(USER_UID, payload));
      const second = await setMyVipAccountStatus.run(requestFor(USER_UID, payload));

      assert.equal(first.ok, true);
      assert.equal(first.duplicate, false);
      assert.equal(first.pointsGranted, 5000);
      assert.equal(first.roomPoints, 5125);
      assert.equal(second.duplicate, true);
      assert.equal(second.pointsGranted, 0);
      assert.equal(second.roomPoints, 5125);

      const [roomUserSnap, userSnap, grantSnap, ledgerSnap] = await Promise.all([
        roomUserRef.get(),
        userRef.get(),
        grantRef.get(),
        ledgerRef.get(),
      ]);
      assert.equal(Number(roomUserSnap.get("points")), 5125);
      assert.equal(roomUserSnap.get("isVip"), true);
      assert.equal(Number(userSnap.get("pointsBalance")), 5000);
      assert.equal(userSnap.get("isVip"), true);
      assert.equal(Number(grantSnap.get("pointsGranted")), 5000);
      assert.equal(Number(ledgerSnap.get("amount")), 5000);
      assert.equal(ledgerSnap.get("currency"), "points");
    }],

    ["validated anonymous room progress migrates with the reward", async () => {
      await Promise.all([
        sourceUserRef.set({ mergedIntoUid: USER_UID, accountStatus: "merged" }),
        sourceRoomUserRef.set({ roomCode: ROOM_CODE, uid: SOURCE_UID, points: 900, totalEmojis: 12 }),
      ]);

      const result = await setMyVipAccountStatus.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        sourceUid: SOURCE_UID,
        vipLevel: 1,
        source: "audience_email_verify",
      }));
      const [targetSnap, sourceSnap] = await Promise.all([roomUserRef.get(), sourceRoomUserRef.get()]);

      assert.equal(result.sourceRoomUserMigrated, true);
      assert.equal(result.roomPoints, 5900);
      assert.equal(Number(targetSnap.get("points")), 5900);
      assert.equal(Number(targetSnap.get("totalEmojis")), 12);
      assert.equal(sourceSnap.exists, false);
    }],

    ["unvalidated source UID cannot transfer room progress", async () => {
      await sourceRoomUserRef.set({ roomCode: ROOM_CODE, uid: SOURCE_UID, points: 900 });

      const result = await setMyVipAccountStatus.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        sourceUid: SOURCE_UID,
        vipLevel: 1,
        source: "audience_email_verify",
      }));
      const sourceSnap = await sourceRoomUserRef.get();

      assert.equal(result.sourceRoomUserMigrated, false);
      assert.equal(result.roomPoints, 5125);
      assert.equal(sourceSnap.exists, true);
    }],
  ];

  let failures = 0;
  for (const [name, fn] of checks) {
    const ok = await runCase(name, fn);
    if (!ok) failures += 1;
  }
  if (failures > 0) {
    process.exitCode = 1;
    return;
  }
  console.log("PASS setMyVipAccountStatus callable");
}

run();
