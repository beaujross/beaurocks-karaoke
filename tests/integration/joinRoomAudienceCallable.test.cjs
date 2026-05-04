const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { joinRoomAudience, claimTimedLobbyCredits, submitAudienceEmailCapture } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const USER_UID = "audience-uid";
const SECOND_UID = "audience-uid-2";
const SHARED_INSTALL_ID = "device_same_browser";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const secondRoomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${SECOND_UID}`);
const userRef = db.doc(`users/${USER_UID}`);
const secondUserRef = db.doc(`users/${SECOND_UID}`);
const eventConfigRef = db.doc(`room_event_credit_configs/${ROOM_CODE}`);
const grantRef = db.doc(`room_event_credit_grants/${ROOM_CODE}_aahf_kickoff_${USER_UID}_general_admission`);
const entitlementRef = db.doc(`event_attendee_entitlements/givebutter_order123`);
const entitlementGrantRef = db.doc(`room_event_credit_grants/${ROOM_CODE}_aahf_kickoff_${USER_UID}_givebutter_order123`);
const supportPurchaseRef = db.doc(`support_purchase_events/givebutter_support_donation123`);
const contactRef = db.doc(`${ROOT}/contacts/${ROOM_CODE}_${require("node:crypto").createHash("sha256").update("guest@example.com").digest("hex").slice(0, 24)}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: data.__token || {} } : null,
  app: null,
  data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== "__token")),
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetState() {
  const docs = [roomUserRef, secondRoomUserRef, roomRef, userRef, secondUserRef, eventConfigRef, grantRef, entitlementRef, entitlementGrantRef, supportPurchaseRef, contactRef];
  for (const ref of docs) {
    try {
      await ref.delete();
    } catch {
      // Ignore cleanup failures against missing docs.
    }
  }
  const [joinGrantSnaps, eventGrantSnaps] = await Promise.all([
    db.collection("room_join_grants").where("roomCode", "==", ROOM_CODE).get(),
    db.collection("room_event_credit_grants").where("roomCode", "==", ROOM_CODE).get(),
  ]);
  await Promise.all([
    ...joinGrantSnaps.docs.map((snap) => snap.ref.delete().catch(() => undefined)),
    ...eventGrantSnaps.docs.map((snap) => snap.ref.delete().catch(() => undefined)),
  ]);

  await roomRef.set({
    hostUid: "host-uid",
    hostUids: ["host-uid"],
  });
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
    ["audience join writes canonical projection", async () => {
      await userRef.set({
        uid: USER_UID,
        vipLevel: 2,
        totalFamePoints: 345,
        currentLevel: 4,
      }, { merge: true });

      const result = await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "Audience Guest Name That Is Long",
        avatar: "🎤",
      }));

      assert.equal(result.ok, true);
      assert.equal(result.roomCode, ROOM_CODE);
      assert.equal(result.uid, USER_UID);

      const snap = await roomUserRef.get();
      assert.equal(snap.get("uid"), USER_UID);
      assert.equal(snap.get("roomCode"), ROOM_CODE);
      assert.equal(snap.get("name"), "Audience Guest Nam");
      assert.equal(snap.get("avatar"), "🎤");
      assert.equal(snap.get("isVip"), true);
      assert.equal(snap.get("vipLevel"), 2);
      assert.equal(snap.get("fameLevel"), 4);
      assert.equal(snap.get("totalFamePoints"), 345);
      assert.equal(snap.get("points"), 100);
      assert.equal(snap.get("totalEmojis"), 0);
      assert.equal(snap.get("visits"), 1);
      assert.ok(snap.get("lastSeen"));
      assert.ok(snap.get("lastActiveAt"));
    }],

    ["audience join requires auth", async () => {
      await expectHttpsError(
        () => joinRoomAudience.run(requestFor("", { roomCode: ROOM_CODE, name: "Guest" })),
        "unauthenticated"
      );
    }],

    ["audience join rejects missing room", async () => {
      await roomRef.delete();
      await expectHttpsError(
        () => joinRoomAudience.run(requestFor(USER_UID, { roomCode: ROOM_CODE, name: "Guest" })),
        "not-found"
      );
    }],

    ["audience join rejects anonymous auth when room requires account", async () => {
      await roomRef.set({
        audienceJoinPolicy: {
          accessMode: "account_required",
        },
      }, { merge: true });
      await expectHttpsError(
        () => joinRoomAudience.run(requestFor(USER_UID, {
          roomCode: ROOM_CODE,
          name: "Guest",
          __token: {
            firebase: { sign_in_provider: "anonymous" },
          },
        })),
        "failed-precondition"
      );
    }],

    ["audience join applies event general-admission grant once", async () => {
      await roomRef.set({
        hostUid: "host-uid",
        hostUids: ["host-uid"],
        eventCredits: {
          enabled: true,
          eventId: "aahf_kickoff",
          eventLabel: "AAHF Karaoke Kick-Off",
          generalAdmissionPoints: 250,
        },
      }, { merge: true });
      await eventConfigRef.set({
        enabled: true,
        sourceProvider: "givebutter",
        eventId: "aahf_kickoff",
        eventLabel: "AAHF Karaoke Kick-Off",
        generalAdmissionPoints: 250,
        claimCodes: {},
      }, { merge: true });

      await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "Guest",
        avatar: "🎤",
      }));
      await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "Guest",
        avatar: "🎤",
      }));

      const roomUserSnap = await roomUserRef.get();
      assert.equal(Number(roomUserSnap.get("points")), 250);
      assert.equal(Number(roomUserSnap.get("visits")), 2);

      const userSnap = await userRef.get();
      assert.equal(Number(userSnap.get("pointsBalance")), 250);

      const grantSnap = await grantRef.get();
      assert.equal(grantSnap.exists, true);
      assert.equal(Number(grantSnap.get("pointsGranted")), 250);
    }],

    ["audience join does not duplicate welcome grant across refreshed anonymous sessions on one install", async () => {
      await roomRef.set({
        audienceJoinPolicy: {
          accessMode: "anonymous_allowed",
        },
      }, { merge: true });

      await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "Guest",
        avatar: "🎤",
        installId: SHARED_INSTALL_ID,
        __token: {
          firebase: { sign_in_provider: "anonymous" },
        },
      }));
      await roomUserRef.set({
        points: 175,
      }, { merge: true });

      const result = await joinRoomAudience.run(requestFor(SECOND_UID, {
        roomCode: ROOM_CODE,
        name: "Guest Reloaded",
        avatar: "🎶",
        installId: SHARED_INSTALL_ID,
        __token: {
          firebase: { sign_in_provider: "anonymous" },
        },
      }));

      assert.equal(result.ok, true);
      assert.equal(result.uid, SECOND_UID);

      const originalSnap = await roomUserRef.get();
      assert.equal(originalSnap.exists, false);

      const refreshedSnap = await secondRoomUserRef.get();
      assert.equal(refreshedSnap.exists, true);
      assert.equal(Number(refreshedSnap.get("points")), 175);
      assert.equal(Number(refreshedSnap.get("visits")), 2);
      assert.equal(String(refreshedSnap.get("name")), "Guest Reloaded");
      assert.equal(String(refreshedSnap.get("participantIdentityType")), "anon_device");
      assert.ok(String(refreshedSnap.get("participantKey") || "").startsWith("anon_device:"));

      const joinGrantSnaps = await db.collection("room_join_grants").where("roomCode", "==", ROOM_CODE).get();
      assert.equal(joinGrantSnaps.size, 1);
      assert.equal(Number(joinGrantSnaps.docs[0].get("pointsGranted")), 100);
    }],

    ["audience join auto-applies matching Givebutter entitlement by email", async () => {
      await roomRef.set({
        hostUid: "host-uid",
        hostUids: ["host-uid"],
        eventCredits: {
          enabled: true,
          presetId: "aahf_kickoff",
          sourceProvider: "givebutter",
          sourceCampaignCode: "AAHF2026",
          eventId: "aahf_kickoff",
          eventLabel: "AAHF Karaoke Kick-Off",
          generalAdmissionPoints: 200,
          vipBonusPoints: 400,
          skipLineBonusPoints: 600,
        },
      }, { merge: true });
      await eventConfigRef.set({
        enabled: true,
        presetId: "aahf_kickoff",
        sourceProvider: "givebutter",
        sourceCampaignCode: "AAHF2026",
        eventId: "aahf_kickoff",
        eventLabel: "AAHF Karaoke Kick-Off",
        generalAdmissionPoints: 200,
        vipBonusPoints: 400,
        skipLineBonusPoints: 600,
        claimCodes: {},
      }, { merge: true });
      await entitlementRef.set({
        sourceProvider: "givebutter",
        normalizedEmail: "vip@example.com",
        attendeeName: "VIP Guest",
        eventId: "aahf_kickoff",
        sourceCampaignCode: "AAHF2026",
        ticketTier: "vip",
        pointsGranted: 800,
        skipLineEntitled: true,
        claimed: false,
      }, { merge: true });

      await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "VIP Guest",
        avatar: "🎤",
        __token: { email: "vip@example.com" },
      }));

      const roomUserSnap = await roomUserRef.get();
      assert.equal(Number(roomUserSnap.get("points")), 1000);
      assert.equal(roomUserSnap.get("skipLineEntitled"), true);
      assert.equal(String(roomUserSnap.get("matchedTicketTier")), "vip");

      const userSnap = await userRef.get();
      assert.equal(Number(userSnap.get("pointsBalance")), 1000);

      const grantSnap = await entitlementGrantRef.get();
      assert.equal(grantSnap.exists, true);
      assert.equal(Number(grantSnap.get("pointsGranted")), 800);
    }],

    ["audience join restores supporter unlock from prior Givebutter purchase match", async () => {
      await supportPurchaseRef.set({
        sourceProvider: "givebutter",
        roomCode: ROOM_CODE,
        normalizedEmail: "supporter@example.com",
        attendeeName: "Supporter Guest",
        amountCents: 2500,
      }, { merge: true });

      await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "Supporter Guest",
        avatar: "🎤",
        __token: { email: "supporter@example.com" },
      }));

      const roomUserSnap = await roomUserRef.get();
      assert.equal(roomUserSnap.get("roomBoostBadge"), true);
      assert.equal(roomUserSnap.get("roomBoosted"), true);
      assert.equal(Number(roomUserSnap.get("lastSupportPurchaseAmountCents")), 2500);

      const supportSnap = await supportPurchaseRef.get();
      assert.equal(String(supportSnap.get("matchedUid")), USER_UID);
      assert.equal(String(supportSnap.get("matchedRoomCode")), ROOM_CODE);
    }],

    ["timed lobby credits grant on interval and respect per-guest cap", async () => {
      await roomRef.set({
        hostUid: "host-uid",
        hostUids: ["host-uid"],
        eventCredits: {
          enabled: true,
          creditEarningMode: "friendly",
          generalAdmissionPoints: 100,
          timedLobbyEnabled: true,
          timedLobbyPoints: 25,
          timedLobbyIntervalMin: 1,
          timedLobbyMaxPerGuest: 25,
        },
      }, { merge: true });

      await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "Guest",
        avatar: "ðŸŽ¤",
      }));
      await roomUserRef.set({ lastTimedLobbyCreditAtMs: Date.now() - 61000 }, { merge: true });

      const first = await claimTimedLobbyCredits.run(requestFor(USER_UID, { roomCode: ROOM_CODE }));
      assert.equal(first.ok, true);
      assert.equal(Number(first.pointsGranted), 25);

      const second = await claimTimedLobbyCredits.run(requestFor(USER_UID, { roomCode: ROOM_CODE }));
      assert.equal(second.ok, true);
      assert.equal(Number(second.pointsGranted), 0);

      const roomUserSnap = await roomUserRef.get();
      assert.equal(Number(roomUserSnap.get("timedLobbyEarnedPoints")), 25);
      assert.equal(Number(roomUserSnap.get("points")), 125);
    }],

    ["simple audience email capture stores room contact without email-link account creation", async () => {
      await roomRef.set({
        hostUid: "host-uid",
        hostUids: ["host-uid"],
        eventCredits: {
          enabled: true,
          audienceAccessMode: "email_capture",
        },
      }, { merge: true });
      await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "Guest",
        avatar: "ðŸŽ¤",
      }));

      const result = await submitAudienceEmailCapture.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        email: "guest@example.com",
        name: "Guest",
      }));
      assert.equal(result.ok, true);
      const snap = await contactRef.get();
      assert.equal(snap.exists, true);
      assert.equal(snap.get("email"), "guest@example.com");
      assert.equal(snap.get("source"), "audience_email_capture");
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

  console.log("PASS joinRoomAudience callable");
}

run();
