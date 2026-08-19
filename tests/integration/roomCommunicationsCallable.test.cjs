const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  sendRoomLoungeMessage,
  sendRoomHostMessage,
  manageRoomCoHostInvite,
  respondToRoomCoHostInvite,
  leaveRoomCoHostRole,
  sendRoomOperatorSignal,
  setRoomOperatorSignalStatus,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM-COMMS";
const HOST_UID = "host-comms";
const GUEST_UID = "guest-comms";
const OTHER_UID = "other-comms";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}
process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = (uid) => db.doc(`${ROOT}/room_users/${ROOM_CODE}_${uid}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? {
    uid,
    token: {
      name: uid === HOST_UID ? "Host" : "Guest",
      firebase: { sign_in_provider: "password" },
    },
  } : null,
  app: { appId: "test-app" },
  data: { roomCode: ROOM_CODE, ...data },
  rawRequest: { ip: `127.0.0.${uid === HOST_UID ? "1" : uid === GUEST_UID ? "2" : "3"}`, get: () => "" },
});

async function clearCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function resetRoom() {
  await Promise.all([
    clearCollection("room_lounge_messages"),
    clearCollection("room_private_messages"),
    clearCollection("room_host_threads"),
    clearCollection("room_operator_signals"),
    clearCollection("room_cohost_invites"),
    clearCollection("room_communication_limits"),
  ]);
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    coHostRoleSchemaVersion: 2,
    coHostUids: [],
    runOfShowRoles: { coHosts: [] },
    hostName: "Host",
    chatEnabled: true,
    chatShowOnTv: true,
    chatSlowModeSec: 0,
  });
  await Promise.all([
    roomUserRef(GUEST_UID).set({ roomCode: ROOM_CODE, uid: GUEST_UID, name: "Guest", isVip: false }),
    roomUserRef(OTHER_UID).set({ roomCode: ROOM_CODE, uid: OTHER_UID, name: "Other", isVip: false }),
  ]);
}

async function expectHttpsError(run, expectedCode) {
  try {
    await run();
  } catch (error) {
    assert.ok(String(error?.code || "").includes(expectedCode), `Expected ${expectedCode}, got ${error?.code}.`);
    return;
  }
  assert.fail(`Expected ${expectedCode} but callable succeeded.`);
}

async function runCase(name, fn) {
  await resetRoom();
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    return false;
  }
}

async function run() {
  const checks = [
    ["server publishes lounge messages and a TV-safe projection", async () => {
      const result = await sendRoomLoungeMessage.run(requestFor(GUEST_UID, { text: "Hello Room" }));
      assert.equal(result.delivered, true);
      assert.equal((await db.doc(`room_lounge_messages/${result.messageId}`).get()).get("uid"), GUEST_UID);
      assert.equal((await db.doc(`${ROOT}/tv_chat_messages/${result.messageId}`).get()).get("text"), "Hello Room");
    }],
    ["server derives the private Host-message participant", async () => {
      const result = await sendRoomHostMessage.run(requestFor(GUEST_UID, { text: "Please help", participantUid: OTHER_UID }));
      const snap = await db.doc(`room_private_messages/${result.messageId}`).get();
      assert.equal(snap.get("participantUid"), GUEST_UID);
      assert.equal(snap.get("toHost"), true);
    }],
    ["co-host access requires invitation acceptance and supports leaving", async () => {
      await expectHttpsError(
        () => sendRoomOperatorSignal.run(requestFor(GUEST_UID, { type: "guest_help" })),
        "permission-denied"
      );
      const invite = await manageRoomCoHostInvite.run(requestFor(HOST_UID, { targetUid: GUEST_UID, action: "invite" }));
      assert.equal(invite.status, "invited");
      assert.deepEqual((await roomRef.get()).get("coHostUids"), []);

      const response = await respondToRoomCoHostInvite.run(requestFor(GUEST_UID, { action: "accept" }));
      assert.equal(response.status, "active");
      assert.deepEqual((await roomRef.get()).get("coHostUids"), [GUEST_UID]);

      const signal = await sendRoomOperatorSignal.run(requestFor(GUEST_UID, { type: "wrong_backing" }));
      assert.equal(signal.delivered, true);
      const status = await setRoomOperatorSignalStatus.run(requestFor(HOST_UID, { signalId: signal.signalId, status: "resolved" }));
      assert.equal(status.status, "resolved");

      await leaveRoomCoHostRole.run(requestFor(GUEST_UID));
      assert.deepEqual((await roomRef.get()).get("coHostUids"), []);
    }],
    ["only a Host can invite a co-host", async () => {
      await expectHttpsError(
        () => manageRoomCoHostInvite.run(requestFor(GUEST_UID, { targetUid: OTHER_UID, action: "invite" })),
        "permission-denied"
      );
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) results.push(await runCase(name, fn));
  const failures = results.filter((ok) => !ok).length;
  if (failures) process.exitCode = 1;
  else console.log(`All ${results.length} Room communication callable checks passed.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
