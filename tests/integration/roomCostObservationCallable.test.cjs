const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { recordRoomCostObservation } = require("../../functions/index.js");
const {
  getUtcDateKey,
  shouldSampleRoomCostObservation,
} = require("../../functions/lib/roomCostObservation");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const ROOM_CODE = "COST42";
const HOST_UID = "cost-host";
const ORG_ID = "org_cost_host";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}
process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const rootRef = db.collection("artifacts").doc("bross-app").collection("public").doc("data");
const roomRef = rootRef.collection("rooms").doc(ROOM_CODE);
const observationsRef = db.collection("room_cost_observations");

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: { email: `${uid}@example.com` } } : null,
  app: null,
  data,
  rawRequest: { ip: "127.0.0.1", get: () => "" },
});

const findSampledAudienceUid = (prefix) => {
  const dateKey = getUtcDateKey();
  for (let index = 0; index < 1000; index += 1) {
    const uid = `${prefix}-${index}`;
    if (shouldSampleRoomCostObservation({ surface: "audience", roomCode: ROOM_CODE, uid, dateKey })) return uid;
  }
  throw new Error("Could not find deterministic sampled Audience uid.");
};

async function resetData() {
  const observations = await observationsRef.get();
  await Promise.all(observations.docs.map((docSnap) => docSnap.ref.delete()));
  const roomUsers = await rootRef.collection("room_users").where("roomCode", "==", ROOM_CODE).get();
  await Promise.all(roomUsers.docs.map((docSnap) => docSnap.ref.delete()));
  await roomRef.set({
    roomCode: ROOM_CODE,
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    orgId: ORG_ID,
  });
}

async function expectHttpsError(run, expectedCode) {
  try {
    await run();
  } catch (error) {
    assert.ok(String(error?.code || "").includes(expectedCode), `Expected ${expectedCode}, got ${error?.code}`);
    return;
  }
  assert.fail(`Expected ${expectedCode} error.`);
}

async function run() {
  await resetData();

  const first = await recordRoomCostObservation.run(requestFor(HOST_UID, {
    roomCode: ROOM_CODE,
    surface: "host",
    counts: {
      participantsObserved: 999,
      activeSongsObserved: 999,
      performedSongsObserved: 999,
      activitiesObserved: 999,
      mediaAssetsObserved: 999,
      scenePresetsObserved: 999,
    },
  }));
  assert.equal(first.ok, true);
  assert.equal(first.sampled, true);
  assert.equal(first.duplicate, false);

  const duplicate = await recordRoomCostObservation.run(requestFor(HOST_UID, {
    roomCode: ROOM_CODE,
    surface: "host",
    counts: { participantsObserved: 1 },
  }));
  assert.equal(duplicate.duplicate, true);
  const hostDoc = await observationsRef.doc(first.observationId).get();
  assert.equal(hostDoc.get("counts.participantsObserved"), 250);
  assert.equal(hostDoc.get("counts.activitiesObserved"), 80);
  assert.equal(hostDoc.get("counts.scenePresetsObserved"), 50);

  const audienceUid = findSampledAudienceUid("joined-audience");
  await rootRef.collection("room_users").doc(`${ROOM_CODE}_${audienceUid}`).set({
    roomCode: ROOM_CODE,
    uid: audienceUid,
    name: "Sampled Guest",
  });
  const audience = await recordRoomCostObservation.run(requestFor(audienceUid, {
    roomCode: ROOM_CODE,
    surface: "audience",
    counts: { participantsObserved: 20 },
  }));
  assert.equal(audience.sampled, true);
  const audienceDoc = await observationsRef.doc(audience.observationId).get();
  assert.equal(audienceDoc.get("actorKind"), "sampled_audience");
  assert.equal(audienceDoc.data().uid, undefined);
  assert.ok(audienceDoc.get("expiresAt"));

  const outsiderUid = findSampledAudienceUid("outsider");
  await expectHttpsError(
    () => recordRoomCostObservation.run(requestFor(outsiderUid, {
      roomCode: ROOM_CODE,
      surface: "audience",
      counts: {},
    })),
    "permission-denied"
  );

  console.log("PASS room cost observations are authorized, bounded, sampled, and idempotent");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
