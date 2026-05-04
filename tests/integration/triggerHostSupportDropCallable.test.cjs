const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { triggerHostSupportDrop } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOMDROP";
const HOST_UID = "host-drop";
const GUEST_A_UID = "guest-a";
const GUEST_B_UID = "guest-b";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const guestARef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${GUEST_A_UID}`);
const guestBRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${GUEST_B_UID}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetRoom() {
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    hostName: "Captain Host",
  });
  await guestARef.set({
    uid: GUEST_A_UID,
    roomCode: ROOM_CODE,
    name: "Jamie",
    avatar: "MIC",
    points: 100,
  });
  await guestBRef.set({
    uid: GUEST_B_UID,
    roomCode: ROOM_CODE,
    name: "Alex",
    avatar: "STAR",
    points: 200,
  });
}

async function deleteCollection(pathSegments = []) {
  const ref = db.collection(pathSegments.join("/"));
  const snap = await ref.limit(500).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function resetState() {
  await deleteCollection(["activities"]);
  await deleteCollection(["artifacts", APP_ID, "public", "data", "room_users"]);
  await deleteCollection(["artifacts", APP_ID, "public", "data", "rooms"]);
  await resetRoom();
}

async function expectHttpsError(run, expectedCode) {
  try {
    await run();
  } catch (err) {
    const errorCode = String(err?.code || "");
    assert.ok(errorCode.includes(expectedCode), `Expected ${expectedCode} but got ${errorCode}`);
    return;
  }
  assert.fail(`Expected ${expectedCode} error but callable succeeded.`);
}

async function runCase(name, fn) {
  await resetState();
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    return false;
  }
}

async function run() {
  const checks = [
    ["host can trigger a guest spotlight support drop", async () => {
      const result = await triggerHostSupportDrop.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        scope: "user",
        targetUid: GUEST_A_UID,
        donorName: "Morgan",
        points: 250,
        amountCents: 1500,
      }));

      assert.equal(result.ok, true);
      assert.equal(result.scope, "user");
      assert.equal(result.targetName, "Jamie");

      const guestSnap = await guestARef.get();
      assert.equal(Number(guestSnap.get("points")), 350);

      const roomSnap = await roomRef.get();
      assert.equal(String(roomSnap.get("purchaseCelebration.buyerName")), "Morgan");
      assert.equal(String(roomSnap.get("purchaseCelebration.title")), "Morgan just backed Jamie");
      assert.equal(String(roomSnap.get("purchaseCelebration.subtitle")), "Support Spotlight - Jamie +250 pts");
      assert.equal(String(roomSnap.get("purchaseCelebration.rewardScope")), "buyer");
      assert.equal(Number(roomSnap.get("purchaseCelebration.amountCents")), 1500);
      assert.equal(String(roomSnap.get("purchaseCelebration.sourceProvider")), "host_manual");
    }],

    ["host can trigger an anonymous room-wide support drop", async () => {
      const result = await triggerHostSupportDrop.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        scope: "room",
        anonymous: true,
        points: 75,
        amountCents: 2000,
      }));

      assert.equal(result.ok, true);
      assert.equal(result.scope, "room");
      assert.equal(result.awardedCount, 2);
      assert.equal(result.donorName, "Anonymous Supporter");

      const guestASnap = await guestARef.get();
      const guestBSnap = await guestBRef.get();
      assert.equal(Number(guestASnap.get("points")), 175);
      assert.equal(Number(guestBSnap.get("points")), 275);

      const roomSnap = await roomRef.get();
      assert.equal(String(roomSnap.get("purchaseCelebration.title")), "Anonymous Supporter just backed the whole room");
      assert.equal(String(roomSnap.get("purchaseCelebration.subtitle")), "Room Support Burst - everyone +75 pts");
      assert.equal(String(roomSnap.get("purchaseCelebration.rewardScope")), "room");
    }],

    ["non-host cannot trigger support drops", async () => {
      await expectHttpsError(
        () => triggerHostSupportDrop.run(requestFor(GUEST_A_UID, {
          roomCode: ROOM_CODE,
          scope: "room",
          points: 50,
        })),
        "permission-denied"
      );
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }
  if (results.every(Boolean)) {
    console.log("PASS triggerHostSupportDrop integration");
    return;
  }
  process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
