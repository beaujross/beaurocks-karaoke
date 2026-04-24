const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  submitBingoTileConfirmation,
  submitBingoMysterySpin,
  lockBingoMysteryPick,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const HOST_UID = "host-uid";
const GUEST_UID = "guest-uid";
const OTHER_UID = "other-uid";
const OUTSIDER_UID = "outsider-uid";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRefFor = (uid) => db.doc(`${ROOT}/room_users/${ROOM_CODE}_${uid}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: data.__token || {} } : null,
  app: null,
  data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== "__token")),
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function deleteIfPresent(ref) {
  try {
    await ref.delete();
  } catch {
    // Ignore missing docs during cleanup.
  }
}

function buildTiles() {
  return [
    { text: "Singer hits the big note", type: "karaoke" },
    {
      text: "Mystery Song",
      type: "mystery",
      content: {
        title: "Dreams",
        artist: "Fleetwood Mac",
        art: "https://example.com/dreams.jpg",
        itunesId: "12345",
      },
    },
    { text: "Crowd sings along", type: "karaoke" },
  ];
}

async function resetState({
  bingoMode = "karaoke",
  roomUsers = [GUEST_UID, OTHER_UID],
  participantMode = "all",
  participants = [],
  pickerUid = null,
} = {}) {
  await Promise.all([
    deleteIfPresent(roomRef),
    deleteIfPresent(roomUserRefFor(GUEST_UID)),
    deleteIfPresent(roomUserRefFor(OTHER_UID)),
    deleteIfPresent(roomUserRefFor(OUTSIDER_UID)),
  ]);

  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    activeMode: "bingo",
    bingoData: buildTiles(),
    bingoMode,
    bingoSessionId: "bingo-session-1",
    bingoBoardId: "board-1",
    bingoSuggestions: {},
    bingoRevealed: {},
    bingoVotingMode: "host+votes",
    bingoAutoApprovePct: 100,
    bingoMysteryRng: bingoMode === "mystery"
      ? {
        active: true,
        finalized: false,
        results: {},
        startTime: Date.now(),
        durationSec: 12,
      }
      : null,
    bingoPickerUid: pickerUid,
    bingoPickerName: pickerUid || null,
    bingoTurnIndex: 0,
    bingoTurnPick: null,
    gameParticipantMode: participantMode,
    gameParticipants: participants,
  });

  for (const uid of roomUsers) {
    await roomUserRefFor(uid).set({
      roomCode: ROOM_CODE,
      uid,
      name: uid,
      avatar: ":)",
    }, { merge: true });
  }
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
    ["bingo observation confirmations auto-approve after threshold", async () => {
      await resetState();

      const first = await submitBingoTileConfirmation.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        tileIndex: 0,
        note: "Saw it",
      }));
      assert.equal(first.ok, true);
      assert.equal(first.autoApprove, false);

      const second = await submitBingoTileConfirmation.run(requestFor(OTHER_UID, {
        roomCode: ROOM_CODE,
        tileIndex: 0,
        note: "Confirmed",
      }));
      assert.equal(second.ok, true);
      assert.equal(second.autoApprove, true);

      const [roomSnap, guestSnap, otherSnap] = await Promise.all([
        roomRef.get(),
        roomUserRefFor(GUEST_UID).get(),
        roomUserRefFor(OTHER_UID).get(),
      ]);
      assert.equal(roomSnap.get("bingoSuggestions.0.count"), 2);
      assert.equal(roomSnap.get("bingoRevealed.0"), true);
      assert.equal(guestSnap.get("bingoVotesBySession.bingo-session-1.0"), true);
      assert.equal(otherSnap.get("bingoVotesBySession.bingo-session-1.0"), true);

      const duplicate = await submitBingoTileConfirmation.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        tileIndex: 0,
        note: "Retry",
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);
    }],

    ["bingo observation confirmation respects selected participants", async () => {
      await resetState({
        roomUsers: [GUEST_UID, OUTSIDER_UID],
        participantMode: "selected",
        participants: [GUEST_UID],
      });

      await expectHttpsError(
        () => submitBingoTileConfirmation.run(requestFor(OUTSIDER_UID, {
          roomCode: ROOM_CODE,
          tileIndex: 0,
          note: "Saw it",
        })),
        "permission-denied"
      );
    }],

    ["mystery bingo spin writes one server-owned rng result", async () => {
      await resetState({
        bingoMode: "mystery",
        roomUsers: [GUEST_UID],
      });

      const result = await submitBingoMysterySpin.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
      }));
      assert.equal(result.ok, true);
      assert.equal(result.duplicate, false);
      assert.ok(result.value >= 1 && result.value <= 1000);

      const duplicate = await submitBingoMysterySpin.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);

      const roomSnap = await roomRef.get();
      assert.equal(roomSnap.get(`bingoMysteryRng.results.${GUEST_UID}.uid`), GUEST_UID);
    }],

    ["mystery bingo picker locks tile and returns song payload", async () => {
      await resetState({
        bingoMode: "mystery",
        roomUsers: [GUEST_UID, OTHER_UID],
        pickerUid: GUEST_UID,
      });

      await expectHttpsError(
        () => lockBingoMysteryPick.run(requestFor(OTHER_UID, {
          roomCode: ROOM_CODE,
          tileIndex: 1,
        })),
        "permission-denied"
      );

      const result = await lockBingoMysteryPick.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        tileIndex: 1,
        note: "Pick",
      }));
      assert.equal(result.ok, true);
      assert.equal(result.tileIndex, 1);
      assert.equal(result.song.title, "Dreams");
      assert.equal(result.song.artist, "Fleetwood Mac");

      const roomSnap = await roomRef.get();
      assert.equal(roomSnap.get("bingoRevealed.1"), true);
      assert.equal(roomSnap.get("bingoTurnPick.pickerUid"), GUEST_UID);
      assert.equal(roomSnap.get("bingoFocus.index"), 1);
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
    console.error("bingo callable integration test failed.");
    console.error(err);
    process.exit(1);
  });
