const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { recordTrackFeedback } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const HOST_UID = "backing-feedback-host";
const SONG_ID = "flowers__miley cyrus";
const CANDIDATE_ID = "flowers__youtube__flowers123";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
const db = admin.firestore();

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: { email: `${uid}@test.local` } } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetState() {
  const collections = [
    "directory_profiles",
    "users",
    "songs",
    "tracks",
    "track_source_keys",
    "backing_feedback_events",
    "security_rate_limits",
  ];
  for (const name of collections) {
    const snap = await db.collection(name).limit(500).get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
  await db.doc(`directory_profiles/${HOST_UID}`).set({
    uid: HOST_UID,
    displayName: "Backing Feedback Host",
    roles: ["host"],
    status: "approved",
  }, { merge: true });
}

async function run() {
  await resetState();

  const result = await recordTrackFeedback.run(requestFor(HOST_UID, {
    rating: "up",
    roomCode: "ROOM1",
    songId: SONG_ID,
    title: "Flowers",
    artist: "Miley Cyrus",
    mediaUrl: "https://www.youtube.com/watch?v=flowers123",
    source: "youtube",
    label: "Host-approved YouTube track",
    qualityScore: 140,
    rankingScore: 122,
    backingCandidateId: CANDIDATE_ID,
    backingTelemetry: {
      hostUpvotes: 1,
      hostDownvotes: 0,
      usageCount: 1,
      completionCount: 1,
      skipCount: 0,
    },
  }));

  assert.equal(result.recorded, true);
  assert.equal(result.rating, "up");
  assert.equal(result.backingCandidateId, CANDIDATE_ID);

  const trackSnap = await db.doc(`tracks/${SONG_ID}__yt__flowers123`).get();
  assert.equal(trackSnap.exists, true);
  assert.equal(trackSnap.get("backingCandidateId"), CANDIDATE_ID);
  assert.equal(trackSnap.get("rankingScore"), 122);

  const candidateSnap = await db.doc(`songs/${SONG_ID}/backing_candidates/${CANDIDATE_ID}`).get();
  assert.equal(candidateSnap.exists, true);
  assert.equal(candidateSnap.get("provider"), "youtube");
  assert.equal(candidateSnap.get("providerTrackId"), "flowers123");
  assert.equal(candidateSnap.get("rankingScore"), 122);
  assert.equal(candidateSnap.get("telemetry.hostUpvotes"), 1);
  assert.equal(candidateSnap.get("telemetry.completionCount"), 1);

  const eventsSnap = await db.collection("backing_feedback_events").where("candidateId", "==", CANDIDATE_ID).get();
  assert.equal(eventsSnap.size, 1);
  const event = eventsSnap.docs[0].data();
  assert.equal(event.signal, "upvote");
  assert.equal(event.actorUid, HOST_UID);
  assert.equal(event.roomCode, "ROOM1");
  assert.equal(event.telemetrySnapshot.hostUpvotes, 1);

  console.log("PASS recordTrackFeedback canonical backing candidate persistence");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});