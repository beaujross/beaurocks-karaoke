const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { uploadAudienceRoomPhoto } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const USER_UID = "audience-uid";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error("FIREBASE_STORAGE_EMULATOR_HOST is required for storage callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const bucket = admin.storage().bucket();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: data.__token || {} } : null,
  app: null,
  data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== "__token")),
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetState() {
  try {
    await roomUserRef.delete();
  } catch {
    // Ignore cleanup failures against missing docs.
  }
  try {
    await roomRef.delete();
  } catch {
    // Ignore cleanup failures against missing docs.
  }

  await roomRef.set({
    hostUid: "host-uid",
    hostUids: ["host-uid"],
    activeMode: "karaoke",
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
    ["room photo upload requires room membership", async () => {
      await expectHttpsError(
        () => uploadAudienceRoomPhoto.run(requestFor(USER_UID, {
          roomCode: ROOM_CODE,
          suffix: "challenge",
          mimeType: "image/jpeg",
          imageBase64: Buffer.from("fake-image").toString("base64"),
        })),
        "permission-denied"
      );
    }],

    ["room photo upload stores image after audience join", async () => {
      await roomUserRef.set({
        roomCode: ROOM_CODE,
        uid: USER_UID,
        name: "Guest",
        avatar: "😀",
      }, { merge: true });

      const result = await uploadAudienceRoomPhoto.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        suffix: "challenge",
        mimeType: "image/jpeg",
        imageBase64: Buffer.from("fake-image").toString("base64"),
      }));

      assert.equal(result.ok, true);
      assert.equal(result.roomCode, ROOM_CODE);
      assert.equal(result.uid, USER_UID);
      assert.match(String(result.storagePath || ""), new RegExp(`^room_photos/${ROOM_CODE}/${USER_UID}/`));
      assert.match(String(result.url || ""), /alt=media&token=/);

      const [exists] = await bucket.file(result.storagePath).exists();
      assert.equal(exists, true);
    }],
  ];

  let failures = 0;
  for (const [name, fn] of checks) {
    const ok = await runCase(name, fn);
    if (!ok) failures += 1;
  }

  if (failures > 0) {
    throw new Error(`${failures} callable integration check(s) failed.`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("uploadAudienceRoomPhoto callable integration test failed.");
    console.error(err);
    process.exit(1);
  });
