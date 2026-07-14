const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { permanentlyDeleteHostRoom } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "PURGE1";
const HOST_UID = "purge-host";
const OTHER_UID = "purge-other";
const ORG_ID = `org_${HOST_UID}`;
const PURGE_COLLECTIONS = [
  "room_uploads",
  "room_scene_presets",
  "karaoke_songs",
  "reactions",
  "activities",
  "messages",
  "room_users",
  "contacts",
  "selfie_submissions",
  "crowd_selfie_submissions",
  "selfie_votes",
];

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
const db = admin.firestore();

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: { email: `${uid}@test.local` } } : null,
  app: null,
  data,
  rawRequest: { ip: "127.0.0.1", get: () => "" },
});

async function clearCollection(path) {
  const snap = await db.collection(path).get();
  if (snap.empty) return;
  for (let offset = 0; offset < snap.docs.length; offset += 400) {
    const batch = db.batch();
    snap.docs.slice(offset, offset + 400).forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
}

async function resetState({ archived = true } = {}) {
  await Promise.all([
    ...PURGE_COLLECTIONS.map((name) => clearCollection(`${ROOT}/${name}`)),
    clearCollection(`${ROOT}/rooms`),
    clearCollection(`${ROOT}/host_libraries`),
    clearCollection("room_sessions"),
    clearCollection("organizations"),
    clearCollection("users"),
    clearCollection("security_rate_limits"),
  ]);
  await db.doc(`${ROOT}/rooms/${ROOM_CODE}`).set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    orgId: ORG_ID,
    archivedStatus: archived ? "archived" : "active",
  });
  await db.doc(`organizations/${ORG_ID}`).set({ orgId: ORG_ID, ownerUid: HOST_UID });
  await db.doc(`organizations/${ORG_ID}/members/${HOST_UID}`).set({ uid: HOST_UID, role: "owner" });
  await db.doc(`users/${HOST_UID}`).set({ organization: { orgId: ORG_ID, role: "owner" } });
}

async function seedArtifacts() {
  await Promise.all(PURGE_COLLECTIONS.map((name) =>
    db.doc(`${ROOT}/${name}/${ROOM_CODE}_${name}`).set({ roomCode: ROOM_CODE, marker: name })
  ));
  await db.doc(`${ROOT}/host_libraries/${ROOM_CODE}`).set({ roomCode: ROOM_CODE, marker: "library" });
  await db.doc(`room_sessions/${ROOM_CODE}_listing`).set({ roomCode: ROOM_CODE, sourceType: "host_room" });
}

async function expectRejected(promise, code) {
  await assert.rejects(promise, (error) => String(error?.code || "").includes(code));
}

async function run() {
  await resetState();
  await seedArtifacts();

  await expectRejected(
    permanentlyDeleteHostRoom.run(requestFor(null, { roomCode: ROOM_CODE, confirmationCode: ROOM_CODE })),
    "unauthenticated"
  );
  await expectRejected(
    permanentlyDeleteHostRoom.run(requestFor(OTHER_UID, { roomCode: ROOM_CODE, confirmationCode: ROOM_CODE })),
    "permission-denied"
  );
  await expectRejected(
    permanentlyDeleteHostRoom.run(requestFor(HOST_UID, { roomCode: ROOM_CODE, confirmationCode: "WRONG" })),
    "invalid-argument"
  );

  await resetState({ archived: false });
  await expectRejected(
    permanentlyDeleteHostRoom.run(requestFor(HOST_UID, { roomCode: ROOM_CODE, confirmationCode: ROOM_CODE })),
    "failed-precondition"
  );

  await resetState();
  await seedArtifacts();
  const result = await permanentlyDeleteHostRoom.run(requestFor(HOST_UID, {
    roomCode: ROOM_CODE,
    confirmationCode: ROOM_CODE,
  }));
  assert.equal(result.ok, true);
  assert.equal(result.roomCode, ROOM_CODE);
  assert.equal(result.deletedStorageObjectCount, 0);
  assert.equal(result.deletedDocumentCount, PURGE_COLLECTIONS.length + 3);

  const deletedSnaps = await Promise.all([
    ...PURGE_COLLECTIONS.map((name) => db.doc(`${ROOT}/${name}/${ROOM_CODE}_${name}`).get()),
    db.doc(`${ROOT}/host_libraries/${ROOM_CODE}`).get(),
    db.doc(`${ROOT}/rooms/${ROOM_CODE}`).get(),
    db.doc(`room_sessions/${ROOM_CODE}_listing`).get(),
  ]);
  assert.equal(deletedSnaps.every((snap) => !snap.exists), true);
  console.log("PASS permanentlyDeleteHostRoom authorization, archive precondition, and complete purge");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
