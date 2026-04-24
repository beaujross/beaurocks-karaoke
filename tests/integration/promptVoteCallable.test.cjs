const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  castPromptVote,
  finalizePromptVoteRound,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const TRIVIA_ID = "trivia-1";
const WYR_ID = "wyr-1";
const HOST_UID = "host-uid";
const GUEST_UID = "guest-uid";
const OTHER_UID = "other-uid";
const THIRD_UID = "third-uid";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const triviaProjectionRef = db.doc(`${ROOT}/prompt_vote_public/${ROOM_CODE}_${TRIVIA_ID}`);
const triviaVoteRef = db.doc(`${ROOT}/prompt_votes/vote_${ROOM_CODE}_${TRIVIA_ID}_${GUEST_UID}`);
const triviaVoteRefFor = (uid) => db.doc(`${ROOT}/prompt_votes/vote_${ROOM_CODE}_${TRIVIA_ID}_${uid}`);
const wyrProjectionRef = db.doc(`${ROOT}/prompt_vote_public/${ROOM_CODE}_${WYR_ID}`);
const wyrVoteRefFor = (uid) => db.doc(`${ROOT}/prompt_votes/vote_${ROOM_CODE}_${WYR_ID}_${uid}`);
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

async function resetState({
  activeMode = "trivia_pop",
  triviaQuestion = null,
  wyrData = null,
  roomUsers = [GUEST_UID],
} = {}) {
  await Promise.all([
    deleteIfPresent(triviaProjectionRef),
    deleteIfPresent(triviaVoteRef),
    deleteIfPresent(triviaVoteRefFor(OTHER_UID)),
    deleteIfPresent(triviaVoteRefFor(THIRD_UID)),
    deleteIfPresent(wyrProjectionRef),
    deleteIfPresent(wyrVoteRefFor(GUEST_UID)),
    deleteIfPresent(wyrVoteRefFor(OTHER_UID)),
    deleteIfPresent(wyrVoteRefFor(THIRD_UID)),
    deleteIfPresent(roomRef),
    deleteIfPresent(roomUserRefFor(GUEST_UID)),
    deleteIfPresent(roomUserRefFor(OTHER_UID)),
    deleteIfPresent(roomUserRefFor(THIRD_UID)),
  ]);

  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    activeMode,
    triviaQuestion,
    wyrData,
  });

  for (const uid of roomUsers) {
    await roomUserRefFor(uid).set({
      roomCode: ROOM_CODE,
      uid,
      name: uid,
      avatar: ":)",
      points: 0,
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
    ["prompt vote writes one trivia vote per user and syncs projection", async () => {
      await resetState({
        activeMode: "trivia_pop",
        triviaQuestion: {
          id: TRIVIA_ID,
          q: "Who opened the show?",
          options: ["A", "B", "C", "D"],
          correct: 2,
          status: "asking",
          rewarded: false,
          points: 100,
          startedAt: Date.now(),
          durationSec: 20,
          autoReveal: true,
          revealAt: Date.now() + 20000,
        },
        roomUsers: [GUEST_UID],
      });

      const result = await castPromptVote.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        questionId: TRIVIA_ID,
        voteType: "vote_trivia",
        val: 2,
        userName: "Guest",
        avatar: ":D",
      }));

      assert.equal(result.ok, true);
      assert.equal(result.duplicate, false);
      assert.equal(result.voterUid, GUEST_UID);
      assert.equal(result.val, 2);

      const [voteSnap, projectionSnap] = await Promise.all([
        triviaVoteRef.get(),
        triviaProjectionRef.get(),
      ]);
      assert.equal(voteSnap.exists, true);
      assert.equal(voteSnap.get("val"), 2);
      assert.equal(projectionSnap.exists, true);
      assert.deepEqual(projectionSnap.get("votesByVoterUid"), {
        [GUEST_UID]: 2,
      });

      const duplicate = await castPromptVote.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        questionId: TRIVIA_ID,
        voteType: "vote_trivia",
        val: 2,
        userName: "Guest",
        avatar: ":D",
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);
    }],

    ["prompt vote rejects votes once reveal is active", async () => {
      const now = Date.now();
      await resetState({
        activeMode: "trivia_pop",
        triviaQuestion: {
          id: TRIVIA_ID,
          q: "Who opened the show?",
          options: ["A", "B", "C", "D"],
          correct: 2,
          status: "asking",
          rewarded: false,
          points: 100,
          startedAt: now - 30000,
          durationSec: 10,
          autoReveal: true,
          revealAt: now - 1000,
        },
        roomUsers: [GUEST_UID],
      });

      await expectHttpsError(
        () => castPromptVote.run(requestFor(GUEST_UID, {
          roomCode: ROOM_CODE,
          questionId: TRIVIA_ID,
          voteType: "vote_trivia",
          val: 1,
          userName: "Guest",
          avatar: ":D",
        })),
        "failed-precondition"
      );
    }],

    ["finalize prompt vote awards trivia correct answers once", async () => {
      const now = Date.now();
      await resetState({
        activeMode: "trivia_reveal",
        triviaQuestion: {
          id: TRIVIA_ID,
          q: "Who opened the show?",
          options: ["A", "B", "C", "D"],
          correct: 2,
          status: "reveal",
          rewarded: false,
          points: 100,
          startedAt: now - 30000,
          durationSec: 20,
          autoReveal: true,
          revealAt: now - 10000,
        },
        roomUsers: [GUEST_UID, OTHER_UID, THIRD_UID],
      });

      await Promise.all([
        triviaVoteRefFor(GUEST_UID).set({
          roomCode: ROOM_CODE,
          questionId: TRIVIA_ID,
          voteType: "vote_trivia",
          uid: GUEST_UID,
          voterUid: GUEST_UID,
          val: 2,
          userName: "Guest",
          avatar: ":D",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
        triviaVoteRefFor(OTHER_UID).set({
          roomCode: ROOM_CODE,
          questionId: TRIVIA_ID,
          voteType: "vote_trivia",
          uid: OTHER_UID,
          voterUid: OTHER_UID,
          val: 1,
          userName: "Other",
          avatar: ":O",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
        triviaVoteRefFor(THIRD_UID).set({
          roomCode: ROOM_CODE,
          questionId: TRIVIA_ID,
          voteType: "vote_trivia",
          uid: THIRD_UID,
          voterUid: THIRD_UID,
          val: 2,
          userName: "Third",
          avatar: ":P",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
      ]);

      const result = await finalizePromptVoteRound.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        questionId: TRIVIA_ID,
        voteType: "vote_trivia",
      }));

      assert.equal(result.ok, true);
      assert.equal(result.awardedCount, 2);
      assert.equal(result.awardedPoints, 200);

      const [guestSnap, otherSnap, thirdSnap, roomSnap, projectionSnap] = await Promise.all([
        roomUserRefFor(GUEST_UID).get(),
        roomUserRefFor(OTHER_UID).get(),
        roomUserRefFor(THIRD_UID).get(),
        roomRef.get(),
        triviaProjectionRef.get(),
      ]);
      assert.equal(guestSnap.get("points"), 100);
      assert.equal(otherSnap.get("points"), 0);
      assert.equal(thirdSnap.get("points"), 100);
      assert.equal(roomSnap.get("triviaQuestion.rewarded"), true);
      assert.equal(projectionSnap.get("status"), "reveal");

      const duplicate = await finalizePromptVoteRound.run(requestFor(OTHER_UID, {
        roomCode: ROOM_CODE,
        questionId: TRIVIA_ID,
        voteType: "vote_trivia",
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);

      const [guestAfter, thirdAfter] = await Promise.all([
        roomUserRefFor(GUEST_UID).get(),
        roomUserRefFor(THIRD_UID).get(),
      ]);
      assert.equal(guestAfter.get("points"), 100);
      assert.equal(thirdAfter.get("points"), 100);
    }],

    ["finalize prompt vote awards WYR majority once", async () => {
      const now = Date.now();
      await resetState({
        activeMode: "wyr_reveal",
        wyrData: {
          id: WYR_ID,
          question: "A or B?",
          optionA: "A",
          optionB: "B",
          status: "reveal",
          rewarded: false,
          points: 50,
          startedAt: now - 30000,
          durationSec: 20,
          autoReveal: true,
          revealAt: now - 10000,
        },
        roomUsers: [GUEST_UID, OTHER_UID, THIRD_UID],
      });

      await Promise.all([
        wyrVoteRefFor(GUEST_UID).set({
          roomCode: ROOM_CODE,
          questionId: WYR_ID,
          voteType: "vote_wyr",
          uid: GUEST_UID,
          voterUid: GUEST_UID,
          val: "A",
          userName: "Guest",
          avatar: ":D",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
        wyrVoteRefFor(OTHER_UID).set({
          roomCode: ROOM_CODE,
          questionId: WYR_ID,
          voteType: "vote_wyr",
          uid: OTHER_UID,
          voterUid: OTHER_UID,
          val: "A",
          userName: "Other",
          avatar: ":O",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
        wyrVoteRefFor(THIRD_UID).set({
          roomCode: ROOM_CODE,
          questionId: WYR_ID,
          voteType: "vote_wyr",
          uid: THIRD_UID,
          voterUid: THIRD_UID,
          val: "B",
          userName: "Third",
          avatar: ":P",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
      ]);

      const result = await finalizePromptVoteRound.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        questionId: WYR_ID,
        voteType: "vote_wyr",
      }));

      assert.equal(result.ok, true);
      assert.equal(result.winningSide, "A");
      assert.equal(result.awardedCount, 2);
      assert.equal(result.awardedPoints, 100);

      const [guestSnap, otherSnap, thirdSnap, roomSnap, projectionSnap] = await Promise.all([
        roomUserRefFor(GUEST_UID).get(),
        roomUserRefFor(OTHER_UID).get(),
        roomUserRefFor(THIRD_UID).get(),
        roomRef.get(),
        wyrProjectionRef.get(),
      ]);
      assert.equal(guestSnap.get("points"), 50);
      assert.equal(otherSnap.get("points"), 50);
      assert.equal(thirdSnap.get("points"), 0);
      assert.equal(roomSnap.get("wyrData.rewarded"), true);
      assert.equal(projectionSnap.get("status"), "reveal");

      const duplicate = await finalizePromptVoteRound.run(requestFor(OTHER_UID, {
        roomCode: ROOM_CODE,
        questionId: WYR_ID,
        voteType: "vote_wyr",
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);

      const [guestAfter, otherAfter] = await Promise.all([
        roomUserRefFor(GUEST_UID).get(),
        roomUserRefFor(OTHER_UID).get(),
      ]);
      assert.equal(guestAfter.get("points"), 50);
      assert.equal(otherAfter.get("points"), 50);
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
    console.error("prompt vote callable integration test failed.");
    console.error(err);
    process.exit(1);
  });
