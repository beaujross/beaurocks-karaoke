const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { resolveSongCatalog } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const USER_UID = "audience-resolver";
const SONG_ID = "shallow__lady gaga";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const hostLibraryRef = db.doc(`${ROOT}/host_libraries/${ROOM_CODE}`);
const songRef = db.doc(`songs/${SONG_ID}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function clearCollection(collectionRef) {
  const snap = await collectionRef.get();
  await Promise.all(snap.docs.map((docSnap) => docSnap.ref.delete()));
}

async function resetState() {
  await clearCollection(songRef.collection("backing_candidates"));

  for (const ref of [roomRef, hostLibraryRef, songRef]) {
    try {
      await ref.delete();
    } catch {
      // Ignore cleanup failures.
    }
  }

  await roomRef.set({
    hostUid: "host-uid",
    hostUids: ["host-uid"],
  });
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
    ["resolveSongCatalog promotes room YouTube index into resolved backing", async () => {
      await hostLibraryRef.set({
        ytIndex: [
          {
            videoId: "yt123abc456",
            trackName: "Shallow Karaoke Version",
            artistName: "Lady Gaga",
            url: "https://www.youtube.com/watch?v=yt123abc456",
            playable: true,
            qualityScore: 18,
            rankingScore: 124,
            backingCandidateId: "shallow__youtube__yt123abc456",
            canonicalSongId: SONG_ID,
            backingTelemetry: { hostUpvotes: 2, hostDownvotes: 0 },
            successCount: 3,
            usageCount: 4,
          },
        ],
      }, { merge: true });

      const result = await resolveSongCatalog.run(requestFor(USER_UID, {
        title: "Shallow",
        artist: "Lady Gaga",
        roomCode: ROOM_CODE,
      }));

      assert.equal(result.songId, SONG_ID);
      assert.equal(result.track?.source, "youtube");
      assert.equal(result.track?.mediaUrl, "https://www.youtube.com/watch?v=yt123abc456");
      assert.equal(result.track?.resolutionLayer, "room_index");
      assert.equal(result.track?.rankingScore, 124);
      assert.equal(result.track?.backingCandidateId, "shallow__youtube__yt123abc456");
      assert.equal(result.track?.canonicalSongId, SONG_ID);
      assert.deepEqual(result.track?.backingTelemetry, { hostUpvotes: 2, hostDownvotes: 0 });
      assert.equal(result.found, true);
    }],
    ["resolveSongCatalog can reuse ranked canonical backing candidates", async () => {
      const candidateRef = songRef.collection("backing_candidates").doc("shallow__youtube__gold999");
      await candidateRef.set({
        candidateId: "shallow__youtube__gold999",
        songId: SONG_ID,
        canonicalSongId: SONG_ID,
        title: "Shallow Karaoke Version",
        artist: "Lady Gaga",
        provider: "youtube",
        providerTrackId: "gold999",
        mediaUrl: "https://www.youtube.com/watch?v=gold999",
        playable: true,
        embeddable: true,
        qualityScore: 16,
        rankingScore: 141,
        telemetry: {
          hostUpvotes: 3,
          usageCount: 5,
          completionCount: 4,
          skipCount: 0,
        },
      });

      const result = await resolveSongCatalog.run(requestFor(USER_UID, {
        title: "Shallow",
        artist: "Lady Gaga",
        roomCode: ROOM_CODE,
      }));

      assert.equal(result.songId, SONG_ID);
      assert.equal(result.track?.source, "youtube");
      assert.equal(result.track?.mediaUrl, "https://www.youtube.com/watch?v=gold999");
      assert.equal(result.track?.resolutionLayer, "canonical_backing");
      assert.equal(result.track?.rankingScore, 141);
      assert.equal(result.track?.backingCandidateId, "shallow__youtube__gold999");
      assert.equal(result.track?.canonicalSongId, SONG_ID);
      assert.equal(result.track?.usageCount, 5);
      assert.equal(result.track?.successCount, 4);
      assert.deepEqual(result.track?.backingTelemetry, {
        hostUpvotes: 3,
        usageCount: 5,
        completionCount: 4,
        skipCount: 0,
      });
      assert.equal(result.found, true);
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

  console.log("PASS resolveSongCatalog callable");
}

run();
