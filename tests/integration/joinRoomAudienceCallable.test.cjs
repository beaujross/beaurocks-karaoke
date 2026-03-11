const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { joinRoomAudience } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const USER_UID = "audience-uid";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const userRef = db.doc(`users/${USER_UID}`);

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
  const docs = [roomUserRef, roomRef, userRef];
  for (const ref of docs) {
    try {
      await ref.delete();
    } catch {
      // Ignore cleanup failures against missing docs.
    }
  }

  await roomRef.set({
    hostUid: "host-uid",
    hostUids: ["host-uid"],
  });
}

async function expectHttpsError(run, expectedCode) {
  try {
    await run();
  } catch (err) {
    const code = String(err?.code || "");
    assert.ok(code.includes(expectedCode), `Expected ${expectedCode} but got ${code}`);
    return;
  }
  assert.fail(`Expected ${expectedCode} but callable succeeded.`);
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
    ["audience join writes canonical projection", async () => {
      await userRef.set({
        uid: USER_UID,
        vipLevel: 2,
        totalFamePoints: 345,
        currentLevel: 4,
      }, { merge: true });

      const result = await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "Audience Guest Name That Is Long",
        avatar: "🎤",
      }));

      assert.equal(result.ok, true);
      assert.equal(result.roomCode, ROOM_CODE);
      assert.equal(result.uid, USER_UID);

      const snap = await roomUserRef.get();
      assert.equal(snap.get("uid"), USER_UID);
      assert.equal(snap.get("roomCode"), ROOM_CODE);
      assert.equal(snap.get("name"), "Audience Guest Nam");
      assert.equal(snap.get("avatar"), "🎤");
      assert.equal(snap.get("isVip"), true);
      assert.equal(snap.get("vipLevel"), 2);
      assert.equal(snap.get("fameLevel"), 4);
      assert.equal(snap.get("totalFamePoints"), 345);
      assert.equal(snap.get("points"), 100);
      assert.equal(snap.get("totalEmojis"), 0);
      assert.equal(snap.get("visits"), 1);
      assert.ok(snap.get("lastSeen"));
      assert.ok(snap.get("lastActiveAt"));
    }],

    ["audience join requires auth", async () => {
      await expectHttpsError(
        () => joinRoomAudience.run(requestFor("", { roomCode: ROOM_CODE, name: "Guest" })),
        "unauthenticated"
      );
    }],

    ["audience join rejects missing room", async () => {
      await roomRef.delete();
      await expectHttpsError(
        () => joinRoomAudience.run(requestFor(USER_UID, { roomCode: ROOM_CODE, name: "Guest" })),
        "not-found"
      );
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

  console.log("PASS joinRoomAudience callable");
}

run();
