const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { redeemPromoCode } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const USER_UID = "promo-user";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const userRef = db.doc(`users/${USER_UID}`);
const configRef = db.doc(`room_event_credit_configs/${ROOM_CODE}`);
const redemptionRef = db.doc(`room_promo_redemptions/${ROOM_CODE}_website_check_in_${USER_UID}`);

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
  for (const ref of [roomRef, roomUserRef, userRef, configRef, redemptionRef]) {
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
      presetId: "aahf_kickoff",
      eventId: "aahf_kickoff",
      eventLabel: "AAHF Karaoke Kick-Off",
      sourceProvider: "givebutter",
      generalAdmissionPoints: 200,
      promoCampaignCount: 1,
      promoCampaigns: [
        {
          id: "website_check_in",
          label: "Website Check-In",
          type: "timed_drop",
          codeMode: "vanity",
          pointsReward: 150,
          safePerk: "website_check_in",
          maxRedemptions: 2,
          perUserLimit: 1,
          requiresRoomJoin: true,
          validFromMs: 0,
          validUntilMs: 0,
        },
      ],
    },
  }, { merge: true });
  await configRef.set({
    enabled: true,
    presetId: "aahf_kickoff",
    eventId: "aahf_kickoff",
    eventLabel: "AAHF Karaoke Kick-Off",
    sourceProvider: "givebutter",
    promoCampaigns: [
      {
        id: "website_check_in",
        label: "Website Check-In",
        type: "timed_drop",
        codeMode: "vanity",
        code: "CHECKIN2026",
        pointsReward: 150,
        safePerk: "website_check_in",
        maxRedemptions: 2,
        perUserLimit: 1,
        requiresRoomJoin: true,
        enabled: true,
        validFromMs: 0,
        validUntilMs: 0,
      },
    ],
  }, { merge: true });
  await roomUserRef.set({
    roomCode: ROOM_CODE,
    uid: USER_UID,
    points: 100,
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
    ["redeemPromoCode applies promo once and grants points + safe perk", async () => {
      const first = await redeemPromoCode.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        code: "CHECKIN2026",
      }));
      const second = await redeemPromoCode.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        code: "CHECKIN2026",
      }));

      assert.equal(first.ok, true);
      assert.equal(first.duplicate, false);
      assert.equal(first.pointsGranted, 150);
      assert.equal(first.safePerk, "website_check_in");
      assert.equal(second.duplicate, true);

      const roomUserSnap = await roomUserRef.get();
      assert.equal(Number(roomUserSnap.get("points")), 250);
      assert.deepEqual(roomUserSnap.get("promoPerks"), ["website_check_in"]);

      const userSnap = await userRef.get();
      assert.equal(Number(userSnap.get("pointsBalance")), 150);
    }],

    ["redeemPromoCode rejects room-join-required campaigns for outsiders", async () => {
      await roomUserRef.delete();
      await expectHttpsError(
        () => redeemPromoCode.run(requestFor(USER_UID, {
          roomCode: ROOM_CODE,
          code: "CHECKIN2026",
        })),
        "failed-precondition"
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

  console.log("PASS redeemPromoCode callable");
}

run();
