const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  castRunOfShowReleaseWindowVote,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROSVOTE1";
const HOST_UID = "rosvote-host";
const GUEST_UID = "rosvote-guest";
const CO_HOST_UID = "rosvote-cohost";
const OUTSIDER_UID = "rosvote-outsider";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRefFor = (uid) => db.doc(`${ROOT}/room_users/${ROOM_CODE}_${uid}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: { email: `${uid}@example.com`, name: uid } } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function deleteIfPresent(ref) {
  try {
    await ref.delete();
  } catch {
    // Ignore cleanup failures in the emulator.
  }
}

async function resetData({
  governanceMode = "crowd_vote",
  closesAtMs = Date.now() + 20_000,
  roomUsers = [GUEST_UID, CO_HOST_UID],
} = {}) {
  await Promise.all([
    deleteIfPresent(roomRef),
    deleteIfPresent(roomUserRefFor(GUEST_UID)),
    deleteIfPresent(roomUserRefFor(CO_HOST_UID)),
    deleteIfPresent(roomUserRefFor(OUTSIDER_UID)),
  ]);

  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    programMode: "run_of_show",
    runOfShowEnabled: true,
    runOfShowRoles: {
      coHosts: [CO_HOST_UID],
    },
    runOfShowDirector: {
      enabled: true,
      releaseWindow: {
        active: true,
        itemId: "queue_faceoff_1",
        itemTitle: "Next song",
        subjectType: "queue_faceoff",
        governanceMode,
        releasePolicy: "suggest_then_host_confirm",
        prompt: "Which song should go next?",
        openedAtMs: Date.now(),
        closesAtMs,
        choiceLabels: {
          slot_scene: "Valerie",
          keep_queue_moving: "Since U Been Gone",
        },
        votesByUid: {},
        resultChoice: "",
        resolvedAtMs: 0,
      },
      items: [],
    },
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
    ["crowd vote lets a joined audience guest vote once the window is live", async () => {
      await resetData({ governanceMode: "crowd_vote" });

      const result = await castRunOfShowReleaseWindowVote.run(requestFor(GUEST_UID, {
        roomCode: ROOM_CODE,
        choice: "slot_scene",
      }));

      assert.equal(result.ok, true);
      assert.equal(result.choice, "slot_scene");
      assert.equal(result.totalVotes, 1);

      const roomSnap = await roomRef.get();
      assert.equal(roomSnap.get("runOfShowDirector.releaseWindow.votesByUid.rosvote-guest"), "slot_scene");
    }],

    ["co-host vote rejects joined guests who are not promoted co-hosts", async () => {
      await resetData({ governanceMode: "cohost_vote" });

      await expectHttpsError(
        () => castRunOfShowReleaseWindowVote.run(requestFor(GUEST_UID, {
          roomCode: ROOM_CODE,
          choice: "keep_queue_moving",
        })),
        "permission-denied"
      );
    }],

    ["release-window vote rejects expired windows and users who have not joined", async () => {
      await resetData({
        governanceMode: "crowd_vote",
        closesAtMs: Date.now() - 1_000,
        roomUsers: [GUEST_UID],
      });

      await expectHttpsError(
        () => castRunOfShowReleaseWindowVote.run(requestFor(GUEST_UID, {
          roomCode: ROOM_CODE,
          choice: "slot_scene",
        })),
        "failed-precondition"
      );

      await resetData({
        governanceMode: "crowd_vote",
        closesAtMs: Date.now() + 20_000,
        roomUsers: [GUEST_UID],
      });

      await expectHttpsError(
        () => castRunOfShowReleaseWindowVote.run(requestFor(OUTSIDER_UID, {
          roomCode: ROOM_CODE,
          choice: "slot_scene",
        })),
        "permission-denied"
      );
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }

  if (results.every(Boolean)) {
    console.log("run-of-show release-window vote callable integration tests passed.");
  } else {
    console.error("run-of-show release-window vote callable integration test failed.");
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
