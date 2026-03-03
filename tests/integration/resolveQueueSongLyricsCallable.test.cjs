const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { resolveQueueSongLyrics } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOML";
const HOST_UID = "lyrics-host";
const GUEST_UID = "lyrics-guest";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
const db = admin.firestore();
const rootDoc = db.doc(ROOT);
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const queueRef = db.doc(`${ROOT}/karaoke_songs/song_a`);
const lyricsRef = db.doc("song_lyrics/song_a");

const requestFor = (uid, data = {}, options = {}) => ({
  auth: uid ? { uid } : null,
  app: options.noAppCheck ? null : { appId: "test-app" },
  data: {
    roomCode: ROOM_CODE,
    songId: "song_a",
    ...data,
  },
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetState() {
  await rootDoc.set({ updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await roomRef.set({
    roomCode: ROOM_CODE,
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    lyricsPipelineV2Enabled: true,
  }, { merge: true });
  await queueRef.set({
    roomCode: ROOM_CODE,
    songId: "song_a",
    songTitle: "Golden Lights",
    artist: "Neon Crew",
    lyrics: "",
    lyricsTimed: null,
    lyricsSource: "",
    status: "requested",
  }, { merge: true });
  await lyricsRef.delete().catch(() => {});
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
    ["requires authentication", async () => {
      await expectHttpsError(
        () => resolveQueueSongLyrics.run(requestFor("", {}, { noAppCheck: false })),
        "unauthenticated"
      );
    }],

    ["requires app check", async () => {
      await expectHttpsError(
        () => resolveQueueSongLyrics.run(requestFor(HOST_UID, {}, { noAppCheck: true })),
        "failed-precondition"
      );
    }],

    ["returns disabled when room pipeline v2 is off", async () => {
      await roomRef.set({ lyricsPipelineV2Enabled: false }, { merge: true });
      const result = await resolveQueueSongLyrics.run(requestFor(HOST_UID));
      assert.equal(result.ok, true);
      assert.equal(result.status, "disabled");
      assert.equal(result.resolution, "pipeline_v2_disabled");
    }],

    ["resolves from canonical cache and writes queue fields", async () => {
      await lyricsRef.set({
        songId: "song_a",
        title: "Golden Lights",
        artist: "Neon Crew",
        lyrics: "Line one\nLine two",
        lyricsTimed: null,
        lyricsSource: "catalog",
      }, { merge: true });

      const result = await resolveQueueSongLyrics.run(requestFor(HOST_UID));
      assert.equal(result.ok, true);
      assert.equal(result.status, "resolved");
      assert.equal(result.hasLyrics, true);

      const queueSnap = await queueRef.get();
      assert.equal(!!queueSnap.get("lyrics"), true);
      assert.equal(queueSnap.get("lyricsSource"), "catalog");
      assert.equal(queueSnap.get("lyricsGenerationStatus"), "resolved");
    }],

    ["returns already_resolved for songs that already have lyrics", async () => {
      await queueRef.set({
        lyrics: "Manual lyric line",
        lyricsSource: "manual",
      }, { merge: true });

      const result = await resolveQueueSongLyrics.run(requestFor(HOST_UID));
      assert.equal(result.ok, true);
      assert.equal(result.alreadyResolved, true);
      assert.equal(result.status, "resolved");
      assert.equal(result.resolution, "already_resolved");
    }],

    ["guest host check is enforced", async () => {
      await expectHttpsError(
        () => resolveQueueSongLyrics.run(requestFor(GUEST_UID)),
        "permission-denied"
      );
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }

  const failures = results.filter((ok) => !ok).length;
  if (failures > 0) {
    console.error(`\n${failures} lyrics callable integration check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} lyrics callable integration checks passed.`);
}

run().catch((err) => {
  console.error("Lyrics callable integration test run failed.");
  console.error(err);
  process.exit(1);
});

