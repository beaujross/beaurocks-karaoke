const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { updateRoomAsHost } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const HOST_UID = "host-uid";
const GUEST_UID = "guest-uid";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);

const requestFor = (uid, updates = {}) => ({
  auth: uid ? { uid } : null,
  app: null,
  data: {
    roomCode: ROOM_CODE,
    updates,
  },
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetRoom() {
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    activeMode: "karaoke",
    autoDj: false,
    readyCheck: { active: true },
    bingoSuggestions: { "2": { count: 0, lastNote: "", lastAt: null } },
    bingoRevealed: { "2": false },
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
  await resetRoom();
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
    ["host can update allowed root keys", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        activeMode: "bingo",
        autoDj: true,
      }));
      assert.equal(result.ok, true);
      assert.deepEqual(new Set(result.updatedKeys), new Set(["activeMode", "autoDj"]));

      const snap = await roomRef.get();
      assert.equal(snap.get("activeMode"), "bingo");
      assert.equal(snap.get("autoDj"), true);
    }],

    ["host can update approved dotted paths", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        "readyCheck.active": false,
        "bingoSuggestions.2.count": 3,
        "bingoRevealed.2": true,
      }));

      const snap = await roomRef.get();
      assert.equal(snap.get("readyCheck.active"), false);
      assert.equal(snap.get("bingoSuggestions.2.count"), 3);
      assert.equal(snap.get("bingoRevealed.2"), true);
    }],

    ["host can use approved server timestamp marker", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        "bingoSuggestions.2.approvedAt": { __hostOp: "serverTimestamp" },
      }));

      const snap = await roomRef.get();
      const approvedAt = snap.get("bingoSuggestions.2.approvedAt");
      assert.ok(approvedAt && typeof approvedAt.toMillis === "function");
    }],

    ["host can update missionControl object payload", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        missionControl: {
          version: 1,
          enabled: true,
          setupDraft: {
            archetype: "casual",
            flowRule: "balanced",
            spotlightMode: "karaoke",
            assistLevel: "smart_assist",
          },
          advancedOverrides: {},
          lastAppliedAt: { __hostOp: "serverTimestamp" },
          lastSuggestedAction: "start_next",
        },
      }));

      const snap = await roomRef.get();
      const mission = snap.get("missionControl");
      assert.equal(mission.version, 1);
      assert.equal(mission.enabled, true);
      assert.equal(mission.setupDraft.archetype, "casual");
      assert.equal(mission.lastSuggestedAction, "start_next");
      assert.ok(mission.lastAppliedAt && typeof mission.lastAppliedAt.toMillis === "function");
    }],

    ["guest cannot update room as host", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(GUEST_UID, { activeMode: "bingo" })),
        "permission-denied"
      );
    }],

    ["blocked host identity fields are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, { hostUid: "other" })),
        "permission-denied"
      );
    }],

    ["unknown root keys are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, { totallyNewRoomKey: true })),
        "invalid-argument"
      );
    }],

    ["disallowed dotted paths are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, { "queueSettings.limitMode": "none" })),
        "invalid-argument"
      );
    }],

    ["invalid value types are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, { autoDj: "yes" })),
        "invalid-argument"
      );
    }],

    ["malformed operation markers are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, {
          "bingoSuggestions.2.approvedAt": { __hostOp: "serverTimestamp", extra: true },
        })),
        "invalid-argument"
      );
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }

  const failures = results.filter((ok) => !ok).length;
  if (failures > 0) {
    console.error(`\n${failures} callable integration check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} callable integration checks passed.`);
}

run().catch((err) => {
  console.error("Callable integration test run failed.");
  console.error(err);
  process.exit(1);
});
