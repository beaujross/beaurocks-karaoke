const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { submitAudienceQueueSong } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const HOST_UID = "host-uid";
const GUEST_UID = "guest-uid";
const OTHER_UID = "other-uid";
const CO_HOST_UID = "cohost-uid";
const TARGET_UID = "target-uid";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRefFor = (uid) => db.doc(`${ROOT}/room_users/${ROOM_CODE}_${uid}`);
const queueRefFor = (uid, requestId) => db.doc(`${ROOT}/karaoke_songs/queue_${ROOM_CODE}_${uid}_${requestId}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: data.__token || {} } : null,
  app: null,
  data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== "__token")),
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function clearCollection(collectionPath) {
  const snap = await db.collection(collectionPath).get();
  await Promise.all(snap.docs.map((docSnap) => docSnap.ref.delete()));
}

async function resetState(roomPatch = {}) {
  await Promise.all([
    clearCollection(`${ROOT}/karaoke_songs`),
    roomRef.delete().catch(() => {}),
    roomUserRefFor(GUEST_UID).delete().catch(() => {}),
    roomUserRefFor(OTHER_UID).delete().catch(() => {}),
    roomUserRefFor(CO_HOST_UID).delete().catch(() => {}),
    roomUserRefFor(TARGET_UID).delete().catch(() => {}),
  ]);

  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    activeMode: "karaoke",
    queueSettings: {
      limitMode: "none",
      limitCount: 0,
      rotation: "round_robin",
      firstTimeBoost: true,
    },
    requestMode: "canonical_open",
    audienceBackingMode: "canonical_only",
    unknownBackingPolicy: "require_review",
    ...roomPatch,
  });
  await roomUserRefFor(GUEST_UID).set({
    roomCode: ROOM_CODE,
    uid: GUEST_UID,
    name: "Guest",
    avatar: "mic",
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
  assert.fail(`Expected callable to throw ${expectedCode}`);
}

async function runCase(name, fn) {
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
    ["audience queue song creates server-owned request and is retry-safe", async () => {
      await resetState({
        runOfShowDirector: { liveItemId: "ros_item_1" },
      });

      const result = await submitAudienceQueueSong.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        clientRequestId: "request_1",
        songTitle: "Dreams",
        artist: "Fleetwood Mac",
        albumArtUrl: "https://example.com/dreams.jpg",
        appleMusicId: "apple_123",
      }));

      assert.equal(result.ok, true);
      assert.equal(result.duplicate, false);
      assert.equal(result.songId, `queue_${ROOM_CODE}_${GUEST_UID}_request_1`);
      assert.equal(result.status, "pending");
      assert.equal(result.resolutionStatus, "review_required");

      const queueSnap = await queueRefFor(GUEST_UID, "request_1").get();
      assert.equal(queueSnap.exists, true);
      assert.equal(queueSnap.get("songTitle"), "Dreams");
      assert.equal(queueSnap.get("artist"), "Fleetwood Mac");
      assert.equal(queueSnap.get("singerUid"), GUEST_UID);
      assert.equal(queueSnap.get("singerName"), "Guest");
      assert.equal(queueSnap.get("submittedByUid"), GUEST_UID);
      assert.equal(queueSnap.get("queueRequestId"), "request_1");
      assert.equal(queueSnap.get("runOfShowItemId"), "ros_item_1");

      const duplicate = await submitAudienceQueueSong.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        clientRequestId: "request_1",
        songTitle: "Dreams",
        artist: "Fleetwood Mac",
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);
      assert.equal(duplicate.songId, result.songId);
    }],

    ["audience queue song requires joined room user", async () => {
      await resetState();
      await expectHttpsError(
        () => submitAudienceQueueSong.run(requestFor(OTHER_UID, {
          roomCode: ROOM_CODE,
          clientRequestId: "not_joined",
          songTitle: "Africa",
          artist: "Toto",
        })),
        "permission-denied"
      );
    }],

    ["audience queue song enforces hard queue limit server-side", async () => {
      await resetState({
        queueSettings: {
          limitMode: "per_night",
          limitCount: 1,
          rotation: "round_robin",
          firstTimeBoost: true,
        },
      });
      await db.doc(`${ROOT}/karaoke_songs/existing_song`).set({
        roomCode: ROOM_CODE,
        singerUid: GUEST_UID,
        singerName: "Guest",
        songTitle: "Existing",
        artist: "Singer",
        status: "requested",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      await expectHttpsError(
        () => submitAudienceQueueSong.run(requestFor(GUEST_UID, {
          roomCode: ROOM_CODE,
          clientRequestId: "over_limit",
          songTitle: "Africa",
          artist: "Toto",
        })),
        "resource-exhausted"
      );
    }],

    ["audience queue song honors playable-only rooms", async () => {
      await resetState({
        requestMode: "playable_only",
        audienceBackingMode: "canonical_plus_approved_backings",
        unknownBackingPolicy: "block_unknown",
      });

      await expectHttpsError(
        () => submitAudienceQueueSong.run(requestFor(GUEST_UID, {
          roomCode: ROOM_CODE,
          clientRequestId: "needs_backing",
          songTitle: "No Backing",
          artist: "Singer",
        })),
        "failed-precondition"
      );

      const result = await submitAudienceQueueSong.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        clientRequestId: "has_backing",
        songTitle: "Playable",
        artist: "Singer",
        mediaUrl: "https://www.youtube.com/watch?v=abc123XYZ9",
        trackSource: "youtube",
        resolutionStatus: "resolved",
        resolutionLayer: "global_catalog",
        trustedCandidate: true,
      }));
      assert.equal(result.ok, true);
      assert.equal(result.status, "requested");
      assert.equal(result.playbackReady, true);
      const queueSnap = await queueRefFor(GUEST_UID, "has_backing").get();
      assert.equal(queueSnap.get("playbackReady"), true);
      assert.equal(queueSnap.get("status"), "requested");
    }],

    ["audience queue song lets co-host queue for another joined singer", async () => {
      await resetState({
        runOfShowRoles: {
          coHosts: [CO_HOST_UID],
        },
      });
      await roomUserRefFor(CO_HOST_UID).set({
        roomCode: ROOM_CODE,
        uid: CO_HOST_UID,
        name: "Co Host",
        avatar: "sparkles",
      });
      await roomUserRefFor(TARGET_UID).set({
        roomCode: ROOM_CODE,
        uid: TARGET_UID,
        name: "Target Singer",
        avatar: "microphone",
      });

      const result = await submitAudienceQueueSong.run(requestFor(CO_HOST_UID, {
        roomCode: ROOM_CODE,
        clientRequestId: "cohost_target_request",
        targetSingerUid: TARGET_UID,
        songTitle: "Rhiannon",
        artist: "Fleetwood Mac",
      }));

      assert.equal(result.ok, true);
      const queueSnap = await queueRefFor(CO_HOST_UID, "cohost_target_request").get();
      assert.equal(queueSnap.exists, true);
      assert.equal(queueSnap.get("singerUid"), TARGET_UID);
      assert.equal(queueSnap.get("singerName"), "Target Singer");
      assert.equal(queueSnap.get("submittedByUid"), CO_HOST_UID);
    }],

    ["audience queue song blocks non-co-hosts from queueing for another singer", async () => {
      await resetState();
      await roomUserRefFor(TARGET_UID).set({
        roomCode: ROOM_CODE,
        uid: TARGET_UID,
        name: "Target Singer",
        avatar: "microphone",
      });

      await expectHttpsError(
        () => submitAudienceQueueSong.run(requestFor(GUEST_UID, {
          roomCode: ROOM_CODE,
          clientRequestId: "guest_target_request",
          targetSingerUid: TARGET_UID,
          songTitle: "Landslide",
          artist: "Fleetwood Mac",
        })),
        "permission-denied"
      );
    }],

    ["audience queue song applies queue limits to the targeted singer", async () => {
      await resetState({
        queueSettings: {
          limitMode: "per_night",
          limitCount: 1,
          rotation: "round_robin",
          firstTimeBoost: true,
        },
        runOfShowRoles: {
          coHosts: [CO_HOST_UID],
        },
      });
      await roomUserRefFor(CO_HOST_UID).set({
        roomCode: ROOM_CODE,
        uid: CO_HOST_UID,
        name: "Co Host",
        avatar: "sparkles",
      });
      await roomUserRefFor(TARGET_UID).set({
        roomCode: ROOM_CODE,
        uid: TARGET_UID,
        name: "Target Singer",
        avatar: "microphone",
      });
      await db.doc(`${ROOT}/karaoke_songs/existing_target_song`).set({
        roomCode: ROOM_CODE,
        singerUid: TARGET_UID,
        singerName: "Target Singer",
        songTitle: "Existing",
        artist: "Singer",
        status: "requested",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      await expectHttpsError(
        () => submitAudienceQueueSong.run(requestFor(CO_HOST_UID, {
          roomCode: ROOM_CODE,
          clientRequestId: "target_over_limit",
          targetSingerUid: TARGET_UID,
          songTitle: "Go Your Own Way",
          artist: "Fleetwood Mac",
        })),
        "resource-exhausted"
      );
    }],
  ];

  let failures = 0;
  for (const [name, fn] of checks) {
    const ok = await runCase(name, fn);
    if (!ok) failures += 1;
  }
  if (failures) {
    throw new Error(`${failures} audience queue callable check(s) failed.`);
  }
  console.log(`All ${checks.length} audience queue callable checks passed.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("audience queue callable integration test failed.");
    console.error(err);
    process.exit(1);
  });
