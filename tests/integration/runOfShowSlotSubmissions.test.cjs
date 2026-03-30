const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  submitRunOfShowSlotSong,
  reviewRunOfShowSlotSubmission,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "SHOW1";
const HOST_UID = "show-host";
const GUEST_UID = "show-guest";
const CO_HOST_UID = "show-cohost";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const submissionsCol = db.collection(`${ROOT}/run_of_show_slot_submissions`);

const basePerformanceItem = {
  id: "perf_open_1",
  type: "performance",
  title: "Opening Performance",
  sequence: 1,
  status: "blocked",
  visibility: "public",
  automationMode: "auto",
  performerMode: "open_submission",
  assignedPerformerUid: "",
  assignedPerformerName: "",
  approvedSubmissionId: "",
  songId: "",
  songTitle: "",
  artistName: "",
  slotCriteria: {
    requiresAccount: true,
    minTight15Count: 0,
    hostApprovalRequired: true,
  },
  submissionWindow: {},
  queueLinkState: "unlinked",
  backingPlan: {
    sourceType: "youtube",
    label: "Host approved backing",
    mediaUrl: "https://example.com/backing.mp3",
    approvalStatus: "approved",
    playbackReady: true,
    resolutionStatus: "ready",
  },
  presentationPlan: {
    publicTvTakeoverEnabled: false,
    takeoverScene: "performance",
    headline: "",
    subhead: "",
    backgroundMedia: "",
    accentTheme: "cyan",
  },
  audioPlan: {
    duckBackingEnabled: false,
    duckLevelPct: 35,
    resumeAfterBlock: true,
    voiceoverPriority: "",
  },
  modeLaunchPlan: {
    modeKey: "",
    launchConfig: {},
    requiresAudienceTakeover: false,
  },
};

const submitRequestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: { email: `${uid}@example.com`, name: uid } } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetData() {
  const existingSubmissions = await submissionsCol.where("roomCode", "==", ROOM_CODE).get();
  await Promise.all(existingSubmissions.docs.map((docSnap) => docSnap.ref.delete()));
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    programMode: "run_of_show",
    runOfShowEnabled: true,
    runOfShowRoles: {
      coHosts: [CO_HOST_UID],
      stageManagers: [],
      mediaCurators: [],
    },
    runOfShowDirector: {
      enabled: true,
      automationPaused: false,
      items: [basePerformanceItem],
    },
  });
}

async function expectHttpsError(run, expectedCode) {
  try {
    await run();
  } catch (err) {
    const errorCode = String(err?.code || "");
    assert.ok(
      errorCode.includes(expectedCode),
      `Expected error code "${expectedCode}" but got "${errorCode}".`
    );
    return;
  }
  assert.fail(`Expected "${expectedCode}" error but callable succeeded.`);
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
  const checks = [
    ["submit creates a pending slot submission", async () => {
      const result = await submitRunOfShowSlotSong.run(submitRequestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        itemId: "perf_open_1",
        songTitle: "Dreams",
        artistName: "Fleetwood Mac",
        displayName: "Guest Performer",
      }));
      assert.equal(result.ok, true);
      assert.equal(result.submissionStatus, "pending");

      const submissionSnap = await submissionsCol.doc(result.submissionId).get();
      assert.equal(submissionSnap.get("roomCode"), ROOM_CODE);
      assert.equal(submissionSnap.get("itemId"), "perf_open_1");
      assert.equal(submissionSnap.get("songTitle"), "Dreams");
      assert.equal(submissionSnap.get("submissionStatus"), "pending");
    }],

    ["host approval assigns the submission into the performance item", async () => {
      const submitResult = await submitRunOfShowSlotSong.run(submitRequestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        itemId: "perf_open_1",
        songTitle: "Dreams",
        artistName: "Fleetwood Mac",
        displayName: "Guest Performer",
        songId: "dreams__fleetwood_mac",
      }));

      const reviewResult = await reviewRunOfShowSlotSubmission.run(submitRequestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        submissionId: submitResult.submissionId,
        decision: "approved",
      }));
      assert.equal(reviewResult.ok, true);
      assert.equal(reviewResult.decision, "approved");

      const roomSnap = await roomRef.get();
      const approvedItem = roomSnap.get("runOfShowDirector.items")[0];
      assert.equal(approvedItem.performerMode, "assigned");
      assert.equal(approvedItem.assignedPerformerUid, GUEST_UID);
      assert.equal(approvedItem.assignedPerformerName, "Guest Performer");
      assert.equal(approvedItem.songTitle, "Dreams");
      assert.equal(approvedItem.artistName, "Fleetwood Mac");
      assert.equal(approvedItem.status, "ready");
      assert.equal(approvedItem.blockedReason, "");
    }],

    ["non-host cannot review a submission", async () => {
      const submitResult = await submitRunOfShowSlotSong.run(submitRequestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        itemId: "perf_open_1",
        songTitle: "Dreams",
      }));

      await expectHttpsError(
        () => reviewRunOfShowSlotSubmission.run(submitRequestFor("random-guest", {
          roomCode: ROOM_CODE,
          submissionId: submitResult.submissionId,
          decision: "approved",
        })),
        "permission-denied"
      );
    }],

    ["co-host can review a submission without full host ownership", async () => {
      const submitResult = await submitRunOfShowSlotSong.run(submitRequestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        itemId: "perf_open_1",
        songTitle: "Dreams",
      }));

      const reviewResult = await reviewRunOfShowSlotSubmission.run(submitRequestFor(CO_HOST_UID, {
        roomCode: ROOM_CODE,
        submissionId: submitResult.submissionId,
        decision: "declined",
      }));
      assert.equal(reviewResult.ok, true);
      assert.equal(reviewResult.decision, "declined");

      const submissionSnap = await submissionsCol.doc(submitResult.submissionId).get();
      assert.equal(submissionSnap.get("submissionStatus"), "declined");
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }
  if (results.some((passed) => !passed)) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
