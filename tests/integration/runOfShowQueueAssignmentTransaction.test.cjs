const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const admin = require("../../functions/node_modules/firebase-admin");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROSASSIGN1";
const SLOT_ID = "slot_1";
const SONG_A_ID = "song_a";
const SONG_B_ID = "song_b";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for transaction integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const songARef = db.doc(`${ROOT}/karaoke_songs/${SONG_A_ID}`);
const songBRef = db.doc(`${ROOT}/karaoke_songs/${SONG_B_ID}`);

let prepareRunOfShowQueueAssignment;

function buildAssignmentPatch(song, item) {
  return {
    performerMode: "assigned",
    assignedPerformerUid: String(song?.singerUid || "").trim(),
    assignedPerformerName: String(song?.singerName || "").trim(),
    songId: String(song?.songId || "").trim(),
    songTitle: String(song?.songTitle || "").trim(),
    artistName: String(song?.artist || "").trim(),
    preparedQueueSongId: String(song?.id || "").trim(),
    queueLinkState: "linked",
    backingPlan: {
      ...(item?.backingPlan || {}),
      label: [song?.songTitle, song?.artist].filter(Boolean).join(" - "),
      playbackReady: true,
      approvalStatus: "approved",
      resolutionStatus: "ready",
    },
  };
}

function deriveStatus(item = {}) {
  return String(item?.preparedQueueSongId || "").trim() ? "ready" : "blocked";
}

async function loadHelper() {
  if (prepareRunOfShowQueueAssignment) return;
  const helperPath = path.resolve(__dirname, "../../src/apps/Host/lib/runOfShowQueueAssignment.js");
  ({ prepareRunOfShowQueueAssignment } = await import(pathToFileURL(helperPath).href));
}

async function resetData() {
  await Promise.all([
    roomRef.delete().catch(() => {}),
    songARef.delete().catch(() => {}),
    songBRef.delete().catch(() => {}),
  ]);

  await roomRef.set({
    hostUid: "host-uid",
    hostUids: ["host-uid"],
    programMode: "run_of_show",
    runOfShowEnabled: true,
    runOfShowDirector: {
      enabled: true,
      items: [
        {
          id: SLOT_ID,
          type: "performance",
          title: "Open Performance Slot",
          sequence: 1,
          status: "blocked",
          performerMode: "placeholder",
          assignedPerformerUid: "",
          assignedPerformerName: "",
          approvedSubmissionId: "",
          songId: "",
          songTitle: "",
          artistName: "",
          queueLinkState: "unlinked",
          preparedQueueSongId: "",
          backingPlan: {
            playbackReady: false,
            approvalStatus: "",
            resolutionStatus: "",
          },
        },
      ],
    },
  });

  await songARef.set({
    id: SONG_A_ID,
    singerUid: "guest-a",
    singerName: "Singer A",
    songTitle: "Valerie",
    artist: "Amy Winehouse",
    status: "requested",
    runOfShowItemId: null,
  });

  await songBRef.set({
    id: SONG_B_ID,
    singerUid: "guest-b",
    singerName: "Singer B",
    songTitle: "Dreams",
    artist: "Fleetwood Mac",
    status: "requested",
    runOfShowItemId: null,
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function assignSongToSlot(songRef, delayMs = 0) {
  return db.runTransaction(async (transaction) => {
    const [roomSnap, songSnap] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(songRef),
    ]);
    if (!roomSnap.exists || !songSnap.exists) {
      throw new Error("missing_prereq");
    }
    const queueSong = { id: songRef.id, ...(songSnap.data() || {}) };
    const roomData = roomSnap.data() || {};
    const { nextDirector } = prepareRunOfShowQueueAssignment({
      director: roomData.runOfShowDirector || {},
      queueSong,
      itemId: SLOT_ID,
      buildAssignmentPatch,
      deriveStatus,
    });
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    transaction.update(roomRef, {
      runOfShowDirector: nextDirector,
    });
    transaction.update(songRef, {
      status: "assigned",
      runOfShowItemId: SLOT_ID,
    });
    return songRef.id;
  });
}

async function runCase(name, fn) {
  await resetData();
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
  await loadHelper();

  const checks = [
    ["only one competing transaction can claim an open run-of-show slot", async () => {
      const results = await Promise.allSettled([
        assignSongToSlot(songARef, 120),
        assignSongToSlot(songBRef, 0),
      ]);

      const fulfilled = results.filter((entry) => entry.status === "fulfilled");
      const rejected = results.filter((entry) => entry.status === "rejected");

      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.match(String(rejected[0].reason?.message || ""), /assignment_slot_unavailable/);

      const [roomSnap, songASnap, songBSnap] = await Promise.all([
        roomRef.get(),
        songARef.get(),
        songBRef.get(),
      ]);

      const item = (roomSnap.get("runOfShowDirector.items") || []).find((entry) => entry.id === SLOT_ID);
      assert.ok(item, "expected assigned slot in room document");
      assert.equal(item.queueLinkState, "linked");
      assert.equal(item.preparedQueueSongId, fulfilled[0].value);

      const songA = songASnap.data() || {};
      const songB = songBSnap.data() || {};
      const assignedSongs = [songA, songB].filter((song) => String(song.runOfShowItemId || "").trim() === SLOT_ID);
      assert.equal(assignedSongs.length, 1);
      assert.equal(String(assignedSongs[0].id || fulfilled[0].value), fulfilled[0].value);
    }],
  ];

  const outcomes = [];
  for (const [name, fn] of checks) {
    outcomes.push(await runCase(name, fn));
  }

  const passed = outcomes.filter(Boolean).length;
  console.log(`\n${passed}/${checks.length} transaction integration checks passed`);
  if (passed !== checks.length) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
