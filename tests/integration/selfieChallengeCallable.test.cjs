const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  submitSelfieChallenge,
  castSelfieChallengeVote,
  setSelfieSubmissionApproval,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const PROMPT_ID = "prompt-1";
const HOST_UID = "host-uid";
const PARTICIPANT_UID = "participant-uid";
const VOTER_UID = "voter-uid";
const OUTSIDER_UID = "outsider-uid";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const projectionRef = db.doc(`${ROOT}/selfie_challenge_public/${ROOM_CODE}_${PROMPT_ID}`);
const submissionRef = db.doc(`${ROOT}/selfie_submissions/${ROOM_CODE}_${PROMPT_ID}_${PARTICIPANT_UID}`);
const voteRef = db.doc(`${ROOT}/selfie_votes/vote_${ROOM_CODE}_${PROMPT_ID}_${VOTER_UID}`);

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
  status = "collecting",
  requireApproval = true,
  participants = [PARTICIPANT_UID],
  roomUsers = [PARTICIPANT_UID],
} = {}) {
  await Promise.all([
    deleteIfPresent(voteRef),
    deleteIfPresent(submissionRef),
    deleteIfPresent(projectionRef),
    deleteIfPresent(roomRef),
    deleteIfPresent(roomUserRefFor(PARTICIPANT_UID)),
    deleteIfPresent(roomUserRefFor(VOTER_UID)),
    deleteIfPresent(roomUserRefFor(OUTSIDER_UID)),
  ]);

  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    activeMode: "selfie_challenge",
    selfieChallenge: {
      prompt: "Strike a pose",
      promptId: PROMPT_ID,
      participants,
      status,
      requireApproval,
      autoStartVoting: false,
      createdAt: Date.now(),
    },
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
    ["submit selfie challenge requires challenge participation", async () => {
      await resetState({
        participants: [PARTICIPANT_UID],
        roomUsers: [PARTICIPANT_UID, OUTSIDER_UID],
      });

      await expectHttpsError(
        () => submitSelfieChallenge.run(requestFor(OUTSIDER_UID, {
          roomCode: ROOM_CODE,
          promptId: PROMPT_ID,
          userName: "Outsider",
          avatar: ":(",
          url: "https://example.com/outsider.jpg",
          storagePath: "room_photos/ROOM1/outsider-uid/out.jpg",
        })),
        "permission-denied"
      );
    }],

    ["submit selfie challenge stores raw doc and projection state", async () => {
      await resetState({
        requireApproval: true,
        roomUsers: [PARTICIPANT_UID],
      });

      const result = await submitSelfieChallenge.run(requestFor(PARTICIPANT_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
        userName: "Participant",
        avatar: ":D",
        url: "https://example.com/participant.jpg",
        storagePath: "room_photos/ROOM1/participant-uid/participant.jpg",
      }));

      assert.equal(result.ok, true);
      assert.equal(result.duplicate, false);
      assert.equal(result.uid, PARTICIPANT_UID);

      const [submissionSnap, projectionSnap] = await Promise.all([
        submissionRef.get(),
        projectionRef.get(),
      ]);
      assert.equal(submissionSnap.exists, true);
      assert.equal(submissionSnap.get("uid"), PARTICIPANT_UID);
      assert.equal(submissionSnap.get("approved"), false);
      assert.equal(projectionSnap.exists, true);
      assert.deepEqual(projectionSnap.get("submittedUids"), [PARTICIPANT_UID]);
      assert.deepEqual(projectionSnap.get("submissions"), []);
      assert.deepEqual(projectionSnap.get("votesByVoterUid"), {});
    }],

    ["host approval updates public selfie challenge projection", async () => {
      await resetState({
        requireApproval: true,
        roomUsers: [PARTICIPANT_UID],
      });

      await submitSelfieChallenge.run(requestFor(PARTICIPANT_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
        userName: "Participant",
        avatar: ":D",
        url: "https://example.com/participant.jpg",
        storagePath: "room_photos/ROOM1/participant-uid/participant.jpg",
      }));

      const approval = await setSelfieSubmissionApproval.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        submissionId: submissionRef.id,
        approved: true,
      }));

      assert.equal(approval.ok, true);
      assert.equal(approval.approved, true);

      const projectionSnap = await projectionRef.get();
      const submissions = projectionSnap.get("submissions") || [];
      assert.equal(submissions.length, 1);
      assert.equal(submissions[0].uid, PARTICIPANT_UID);
      assert.equal(submissions[0].approved, true);
    }],

    ["selfie voting writes one vote per voter and syncs projection", async () => {
      await resetState({
        status: "collecting",
        requireApproval: false,
        roomUsers: [PARTICIPANT_UID, VOTER_UID],
      });

      await submitSelfieChallenge.run(requestFor(PARTICIPANT_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
        userName: "Participant",
        avatar: ":D",
        url: "https://example.com/participant.jpg",
        storagePath: "room_photos/ROOM1/participant-uid/participant.jpg",
      }));

      await roomRef.set({
        selfieChallenge: {
          prompt: "Strike a pose",
          promptId: PROMPT_ID,
          participants: [PARTICIPANT_UID],
          status: "voting",
          requireApproval: false,
          autoStartVoting: false,
          createdAt: Date.now(),
        },
      }, { merge: true });

      const result = await castSelfieChallengeVote.run(requestFor(VOTER_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
        targetUid: PARTICIPANT_UID,
      }));

      assert.equal(result.ok, true);
      assert.equal(result.duplicate, false);
      assert.equal(result.voterUid, VOTER_UID);
      assert.equal(result.targetUid, PARTICIPANT_UID);

      const [voteSnap, projectionSnap] = await Promise.all([
        voteRef.get(),
        projectionRef.get(),
      ]);
      assert.equal(voteSnap.exists, true);
      assert.equal(voteSnap.get("targetUid"), PARTICIPANT_UID);
      assert.deepEqual(projectionSnap.get("votesByVoterUid"), {
        [VOTER_UID]: PARTICIPANT_UID,
      });

      const duplicate = await castSelfieChallengeVote.run(requestFor(VOTER_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
        targetUid: PARTICIPANT_UID,
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);
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
    console.error("selfie challenge callable integration test failed.");
    console.error(err);
    process.exit(1);
  });
