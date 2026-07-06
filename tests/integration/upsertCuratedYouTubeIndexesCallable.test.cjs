const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { upsertCuratedYouTubeIndexes } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "MEDIA1";
const HOST_UID = "media-index-host";
const ORG_ID = "org_media-index-host";
const SONG_ID = "flowers__miley cyrus";
const CANDIDATE_ID = "flowers__youtube__flowers123";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const accountIndexRef = db.doc(`organizations/${ORG_ID}/youtube_indexes/karaoke`);
const globalIndexRef = db.doc(`${ROOT}/global_youtube_indexes/karaoke`);
const candidateRef = db.doc(`songs/${SONG_ID}/backing_candidates/${CANDIDATE_ID}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: { email: `${uid}@test.local` } } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function deleteQuery(query) {
  const snap = await query.get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function resetState() {
  await Promise.all([
    roomRef.delete().catch(() => {}),
    accountIndexRef.delete().catch(() => {}),
    globalIndexRef.delete().catch(() => {}),
    candidateRef.delete().catch(() => {}),
  ]);
  await deleteQuery(db.collection("security_rate_limits").limit(500));
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    orgId: ORG_ID,
  });
}

async function run() {
  await resetState();

  const result = await upsertCuratedYouTubeIndexes.run(requestFor(HOST_UID, {
    roomCode: ROOM_CODE,
    entries: [
      {
        videoId: "flowers123",
        trackName: "Flowers Karaoke Version",
        artistName: "Miley Cyrus",
        artworkUrl100: "https://img.example/flowers.jpg",
        url: "https://www.youtube.com/watch?v=flowers123",
        playable: true,
        embeddable: true,
        youtubePlaybackStatus: "embeddable",
        uploadStatus: "processed",
        privacyStatus: "public",
        canonicalSongId: SONG_ID,
        backingCandidateId: CANDIDATE_ID,
        rankingScore: 132,
        qualityScore: 18,
        usageCount: 3,
        successCount: 3,
        sourceDiscovery: "host_feedback",
        backingTelemetry: {
          hostUpvotes: 2,
          usageCount: 3,
          completionCount: 3,
          skipCount: 0,
        },
      },
      {
        videoId: "unknown456",
        trackName: "Unanchored Karaoke",
        artistName: "Unknown Artist",
        url: "https://www.youtube.com/watch?v=unknown456",
        playable: true,
        embeddable: true,
      },
    ],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.orgId, ORG_ID);
  assert.equal(result.accountCount, 2);
  assert.equal(result.globalCount, 1);
  assert.equal(result.promotedCount, 1);
  assert.equal(result.canonicalCandidateCount, 1);

  const accountSnap = await accountIndexRef.get();
  assert.equal(accountSnap.exists, true);
  const accountIndex = accountSnap.get("ytIndex") || [];
  assert.equal(accountIndex.length, 2);
  assert.equal(accountIndex.find((entry) => entry.videoId === "flowers123")?.canonicalSongId, SONG_ID);

  const globalSnap = await globalIndexRef.get();
  assert.equal(globalSnap.exists, true);
  const globalIndex = globalSnap.get("ytIndex") || [];
  assert.equal(globalIndex.length, 1);
  assert.equal(globalIndex[0].videoId, "flowers123");

  const candidateSnap = await candidateRef.get();
  assert.equal(candidateSnap.exists, true);
  assert.equal(candidateSnap.get("provider"), "youtube");
  assert.equal(candidateSnap.get("providerTrackId"), "flowers123");
  assert.equal(candidateSnap.get("canonicalSongId"), SONG_ID);
  assert.equal(candidateSnap.get("playable"), true);
  assert.equal(candidateSnap.get("embeddable"), true);
  assert.equal(candidateSnap.get("sourceDiscovery"), "host_feedback");
  assert.equal(candidateSnap.get("sourceRoomCode"), ROOM_CODE);
  assert.equal(candidateSnap.get("rankingScore"), 132);
  assert.equal(candidateSnap.get("telemetry.hostUpvotes"), 2);
  assert.equal(candidateSnap.get("telemetry.completionCount"), 3);

  const unanchoredSnap = await db.collectionGroup("backing_candidates")
    .where("providerTrackId", "==", "unknown456")
    .get();
  assert.equal(unanchoredSnap.empty, true);

  console.log("PASS upsertCuratedYouTubeIndexes canonical backing candidate persistence");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
