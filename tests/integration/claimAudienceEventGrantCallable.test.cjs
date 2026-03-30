const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { claimAudienceEventGrant } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const USER_UID = "audience-claimer";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const userRef = db.doc(`users/${USER_UID}`);
const configRef = db.doc(`room_event_credit_configs/${ROOM_CODE}`);
const vipGrantRef = db.doc(`room_event_credit_grants/${ROOM_CODE}_aahf_kickoff_${USER_UID}_vip`);
const skipGrantRef = db.doc(`room_event_credit_grants/${ROOM_CODE}_aahf_kickoff_${USER_UID}_skip_line`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetState() {
  for (const ref of [roomRef, roomUserRef, userRef, configRef, vipGrantRef, skipGrantRef]) {
    try {
      await ref.delete();
    } catch {
      // Ignore cleanup failures.
    }
  }
  await roomRef.set({
    hostUid: "host-uid",
    hostUids: ["host-uid"],
    eventCredits: {
      enabled: true,
      eventId: "aahf_kickoff",
      eventLabel: "AAHF Karaoke Kick-Off",
      generalAdmissionPoints: 200,
      vipBonusPoints: 400,
      skipLineBonusPoints: 600,
      websiteCheckInPoints: 150,
      socialPromoPoints: 250,
    },
  });
  await configRef.set({
    enabled: true,
    eventId: "aahf_kickoff",
    eventLabel: "AAHF Karaoke Kick-Off",
    generalAdmissionPoints: 200,
    vipBonusPoints: 400,
    skipLineBonusPoints: 600,
    websiteCheckInPoints: 150,
    socialPromoPoints: 250,
    claimCodes: {
      vip: "VIP2026",
      skipLine: "SKIP2026",
      websiteCheckIn: "CHECKIN2026",
      socialPromo: "POST2026",
    },
  });
  await roomUserRef.set({
    roomCode: ROOM_CODE,
    uid: USER_UID,
    points: 125,
  }, { merge: true });
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
    ["claimAudienceEventGrant applies VIP bonus once", async () => {
      const first = await claimAudienceEventGrant.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        grantType: "vip",
        claimCode: "VIP2026",
      }));
      const second = await claimAudienceEventGrant.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        grantType: "vip",
        claimCode: "VIP2026",
      }));

      assert.equal(first.ok, true);
      assert.equal(first.duplicate, false);
      assert.equal(first.pointsGranted, 400);
      assert.equal(second.duplicate, true);

      const roomUserSnap = await roomUserRef.get();
      assert.equal(Number(roomUserSnap.get("points")), 525);

      const userSnap = await userRef.get();
      assert.equal(Number(userSnap.get("pointsBalance")), 400);
    }],

    ["claimAudienceEventGrant attaches skip-line entitlement", async () => {
      const result = await claimAudienceEventGrant.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        grantType: "skip_line",
        claimCode: "SKIP2026",
      }));
      assert.equal(result.ok, true);
      assert.equal(result.skipLineEntitled, true);

      const roomUserSnap = await roomUserRef.get();
      assert.equal(roomUserSnap.get("skipLineEntitled"), true);
      assert.equal(Number(roomUserSnap.get("points")), 725);
    }],

    ["claimAudienceEventGrant rejects invalid codes", async () => {
      await expectHttpsError(
        () => claimAudienceEventGrant.run(requestFor(USER_UID, {
          roomCode: ROOM_CODE,
          grantType: "vip",
          claimCode: "WRONG",
        })),
        "permission-denied"
      );
    }],
  ];

  let failures = 0;
  for (const [name, fn] of checks) {
    const ok = await runCase(name, fn);
    if (!ok) failures += 1;
  }

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("PASS claimAudienceEventGrant callable");
}

run();
