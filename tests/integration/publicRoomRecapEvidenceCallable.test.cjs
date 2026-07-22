const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { publishPublicRoomRecap } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const HOST_UID = "recap-evidence-host";
const ROOM_CODE = "RECAPE1";
const SESSION_ID = "room_recape1";
const OCCURRENCE_ID = "occ_recape1";
const VENUE_ID = "venue_recape1";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error("FIREBASE_STORAGE_EMULATOR_HOST is required.");

process.env.GCLOUD_PROJECT = PROJECT_ID;
const db = admin.firestore();
const rootRef = db.collection("artifacts").doc("bross-app").collection("public").doc("data");

const requestFor = (uid, data = {}) => ({
  auth: {
    uid,
    token: {
      email: `${uid}@test.local`,
      firebase: { sign_in_provider: "password" },
    },
  },
  app: { appId: "recap-evidence-test" },
  data,
  rawRequest: { ip: "127.0.0.1", get: () => "" },
});

const resetCollection = async (collectionRef) => {
  const snap = await collectionRef.limit(500).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
};

const run = async () => {
  await resetCollection(db.collection("public_vibe_evidence"));
  await resetCollection(db.collection("room_sessions"));
  await resetCollection(db.collection("venues"));
  await resetCollection(rootRef.collection("rooms"));

  const nowMs = Date.now();
  await db.doc(`venues/${VENUE_ID}`).set({
    title: "Recap Evidence Venue",
    status: "approved",
    visibility: "public",
    ownerUid: HOST_UID,
  });
  await db.doc(`room_sessions/${SESSION_ID}`).set({
    title: "Recap Evidence Night",
    status: "approved",
    visibility: "public",
    roomCode: ROOM_CODE,
    venueId: VENUE_ID,
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    ownerUid: HOST_UID,
    occurrenceId: OCCURRENCE_ID,
    startsAtMs: nowMs - (3 * 60 * 60 * 1000),
    endsAtMs: nowMs - (60 * 60 * 1000),
  });
  await rootRef.collection("rooms").doc(ROOM_CODE).set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    publicRoom: true,
    roomName: "Recap Evidence Night",
    discover: {
      listingId: SESSION_ID,
      publicRoom: true,
      visibility: "public",
      occurrenceId: OCCURRENCE_ID,
    },
    recap: {
      generatedAt: nowMs,
      totalSongs: 9,
      totalUsers: 12,
      topSinger: "Test Singer",
    },
  });

  const first = await publishPublicRoomRecap.run(requestFor(HOST_UID, { roomCode: ROOM_CODE }));
  assert.equal(first.ok, true);
  assert.equal(first.roomCode, ROOM_CODE);
  assert.match(first.publicUrl, /recaps\/RECAPE1/);

  let evidenceSnap = await db.collection("public_vibe_evidence").get();
  assert.equal(evidenceSnap.size, 3);
  const records = evidenceSnap.docs.map((docSnap) => docSnap.data() || {});
  assert.deepEqual(records.map((record) => record.targetType).sort(), ["host", "room_session", "venue"]);
  assert.equal(records.every((record) => record.evidenceType === "room_recap"), true);
  assert.equal(records.every((record) => record.sessionId === OCCURRENCE_ID), true);
  assert.equal(records.every((record) => record.actorKey === null), true);
  assert.equal(records.every((record) => !Object.hasOwn(record, "actorUid")), true);
  assert.equal(records.every((record) => /^source_[a-f0-9]{40}$/.test(record.sourceKey)), true);
  assert.equal(records.every((record) => !Object.hasOwn(record, "sourceId")), true);
  assert.equal(records.every((record) => record.authenticated === false), true);
  assert.equal(records.every((record) => record.expiresAt?.toMillis?.() > Date.now()), true);

  const repeated = await publishPublicRoomRecap.run(requestFor(HOST_UID, { roomCode: ROOM_CODE }));
  assert.equal(repeated.ok, true);
  evidenceSnap = await db.collection("public_vibe_evidence").get();
  assert.equal(evidenceSnap.size, 3);

  const sessionSnap = await db.doc(`room_sessions/${SESSION_ID}`).get();
  assert.equal(sessionSnap.get("officialStatus"), "completed");
  assert.equal(sessionSnap.get("latestRecapRoomCode"), ROOM_CODE);
  console.log("PASS public recap publishes artifact and idempotent session/venue/host evidence");
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("FAIL public recap evidence integration");
    console.error(error);
    process.exit(1);
  });
