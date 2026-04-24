const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  submitDoodleOkeEntry,
  castDoodleOkeVote,
  setDoodleSubmissionApproval,
  syncDoodleOkePublicProjection,
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
const projectionRef = db.doc(`${ROOT}/doodle_oke_public/${ROOM_CODE}_${PROMPT_ID}`);
const submissionRef = db.doc(`${ROOT}/doodle_submissions/${ROOM_CODE}_${PROMPT_ID}_${PARTICIPANT_UID}`);
const voteRef = db.doc(`${ROOT}/doodle_votes/vote_${ROOM_CODE}_${PROMPT_ID}_${VOTER_UID}`);

const roomUserRefFor = (uid) => db.doc(`${ROOT}/room_users/${ROOM_CODE}_${uid}`);

const SAMPLE_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFQ8PDw8PDw8PDw8QDw8PFREWFhURFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDQ0NDw0NDisZFRkrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrK//AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQID/8QAFhEBAQEAAAAAAAAAAAAAAAAAABEh/9oADAMBAAIQAxAAAAHeA//EABgQAQEBAQEAAAAAAAAAAAAAAAERAAIx/9oACAEBAAEFAi2aY9P/xAAVEQEBAAAAAAAAAAAAAAAAAAABEP/aAAgBAwEBPwGn/8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAgEBPwCf/8QAGhAAAgIDAAAAAAAAAAAAAAAAAAERIUFRcf/aAAgBAQAGPwK5p2Yb/8QAGxABAQADAQEBAAAAAAAAAAAAAREAITFBUWH/2gAIAQEAAT8hSYo+2M4q9W0i1bYt3//aAAwDAQACAAMAAAAQPw//xAAVEQEBAAAAAAAAAAAAAAAAAAABEP/aAAgBAwEBPxBv/8QAFhEBAQEAAAAAAAAAAAAAAAAAABEh/9oACAECAQE/EE5//8QAGxABAQADAQEBAAAAAAAAAAAAAREAITFBUWH/2gAIAQEAAT8QW4hEl7gEJq9cDq6X5sYbU4u6tT//2Q==";

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
  status = "drawing",
  requireReview = true,
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

  const now = Date.now();
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    activeMode: "doodle_oke",
    doodleOke: {
      prompt: "Draw the chorus",
      promptId: PROMPT_ID,
      status,
      requireReview,
      startedAt: now,
      endsAt: now + 60000,
      guessEndsAt: now + 120000,
    },
    doodleOkeConfig: {
      participants,
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
    ["submit doodle requires round participation", async () => {
      await resetState({
        participants: [PARTICIPANT_UID],
        roomUsers: [PARTICIPANT_UID, OUTSIDER_UID],
      });

      await expectHttpsError(
        () => submitDoodleOkeEntry.run(requestFor(OUTSIDER_UID, {
          roomCode: ROOM_CODE,
          promptId: PROMPT_ID,
          name: "Outsider",
          avatar: ":(",
          image: SAMPLE_IMAGE,
        })),
        "permission-denied"
      );
    }],

    ["submit doodle stores raw doc and projection state", async () => {
      await resetState({
        requireReview: true,
        roomUsers: [PARTICIPANT_UID],
      });

      const result = await submitDoodleOkeEntry.run(requestFor(PARTICIPANT_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
        name: "Participant",
        avatar: ":D",
        image: SAMPLE_IMAGE,
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

    ["host approval updates public doodle projection", async () => {
      await resetState({
        requireReview: true,
        roomUsers: [PARTICIPANT_UID],
      });

      await submitDoodleOkeEntry.run(requestFor(PARTICIPANT_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
        name: "Participant",
        avatar: ":D",
        image: SAMPLE_IMAGE,
      }));

      const approval = await setDoodleSubmissionApproval.run(requestFor(HOST_UID, {
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

    ["host sync exposes existing doodles when review is turned off", async () => {
      await resetState({
        requireReview: true,
        roomUsers: [PARTICIPANT_UID],
      });

      await submitDoodleOkeEntry.run(requestFor(PARTICIPANT_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
        name: "Participant",
        avatar: ":D",
        image: SAMPLE_IMAGE,
      }));

      await roomRef.set({
        doodleOke: {
          prompt: "Draw the chorus",
          promptId: PROMPT_ID,
          status: "drawing",
          requireReview: false,
          startedAt: Date.now(),
          endsAt: Date.now() + 60000,
          guessEndsAt: Date.now() + 120000,
        },
      }, { merge: true });

      const syncResult = await syncDoodleOkePublicProjection.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
      }));

      assert.equal(syncResult.requireReview, false);
      const projectionSnap = await projectionRef.get();
      const submissions = projectionSnap.get("submissions") || [];
      assert.equal(submissions.length, 1);
      assert.equal(submissions[0].uid, PARTICIPANT_UID);
    }],

    ["doodle voting writes one vote per voter and syncs projection", async () => {
      await resetState({
        status: "drawing",
        requireReview: false,
        roomUsers: [PARTICIPANT_UID, VOTER_UID],
      });

      await submitDoodleOkeEntry.run(requestFor(PARTICIPANT_UID, {
        roomCode: ROOM_CODE,
        promptId: PROMPT_ID,
        name: "Participant",
        avatar: ":D",
        image: SAMPLE_IMAGE,
      }));

      await roomRef.set({
        doodleOke: {
          prompt: "Draw the chorus",
          promptId: PROMPT_ID,
          status: "voting",
          requireReview: false,
          startedAt: Date.now(),
          endsAt: Date.now() - 1000,
          guessEndsAt: Date.now() + 60000,
        },
      }, { merge: true });

      const result = await castDoodleOkeVote.run(requestFor(VOTER_UID, {
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

      const duplicate = await castDoodleOkeVote.run(requestFor(VOTER_UID, {
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
    console.error("doodle oke callable integration test failed.");
    console.error(err);
    process.exit(1);
  });
