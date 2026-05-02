const assert = require("node:assert/strict");

process.env.GIVEBUTTER_WEBHOOK_SECRET = process.env.GIVEBUTTER_WEBHOOK_SECRET || "test_secret";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-bross";

const admin = require("../../functions/node_modules/firebase-admin");
const { givebutterWebhook, joinRoomAudience } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOMGB";
const USER_UID = "givebutter-buyer";
const SUPPORT_EVENT_ID = "donation123";
const ENTITLEMENT_EVENT_ID = "ticket123";
const SUPPORT_EVENT_REF_ID = `givebutter_support_${SUPPORT_EVENT_ID}`;
const ENTITLEMENT_REF_ID = `givebutter_${ENTITLEMENT_EVENT_ID}`;
const ENTITLEMENT_GRANT_REF_ID = `${ROOM_CODE}_aahf_kickoff_${USER_UID}_${ENTITLEMENT_REF_ID}`;

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for webhook integration tests.");
}

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${USER_UID}`);
const userRef = db.doc(`users/${USER_UID}`);
const eventConfigRef = db.doc(`room_event_credit_configs/${ROOM_CODE}`);
const supportPurchaseRef = db.doc(`support_purchase_events/${SUPPORT_EVENT_REF_ID}`);
const entitlementRef = db.doc(`event_attendee_entitlements/${ENTITLEMENT_REF_ID}`);
const entitlementGrantRef = db.doc(`room_event_credit_grants/${ENTITLEMENT_GRANT_REF_ID}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: data.__token || {} } : null,
  app: null,
  data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== "__token")),
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function deleteCollection(pathSegments = []) {
  const ref = db.collection(pathSegments.join("/"));
  const snap = await ref.limit(500).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function resetState({
  supportEnabled = true,
  seedBuyerRoomUser = true,
  seedUserPointsBalance = 25,
} = {}) {
  await deleteCollection(["support_purchase_events"]);
  await deleteCollection(["event_attendee_entitlements"]);
  await deleteCollection(["room_event_credit_grants"]);
  await deleteCollection(["room_event_credit_configs"]);
  await deleteCollection(["users"]);
  await deleteCollection(["activities"]);
  await deleteCollection(["artifacts", APP_ID, "public", "data", "rooms"]);
  await deleteCollection(["artifacts", APP_ID, "public", "data", "room_users"]);

  await roomRef.set({
    hostUid: "host-uid",
    hostUids: ["host-uid"],
    eventCredits: {
      enabled: true,
      presetId: "aahf_kickoff",
      eventId: "aahf_kickoff",
      eventLabel: "AAHF Karaoke Kick-Off",
      sourceProvider: "givebutter",
      sourceCampaignCode: "festival-kick-off-karaoke-party-y1ogra",
      supportProvider: supportEnabled ? "givebutter" : "",
      supportLabel: supportEnabled ? "Support AAHF Festival" : "",
      supportUrl: supportEnabled ? "https://givebutter.com/festival-kick-off-karaoke-party-y1ogra" : "",
      supportCampaignCode: supportEnabled ? "festival-kick-off-karaoke-party-y1ogra" : "",
      audienceAccessMode: "email_or_donation",
      supportCelebrationStyle: "moneybags_burst",
    },
  }, { merge: true });

  await eventConfigRef.set({
    enabled: true,
    presetId: "aahf_kickoff",
    eventId: "aahf_kickoff",
    eventLabel: "AAHF Karaoke Kick-Off",
    sourceProvider: "givebutter",
    sourceCampaignCode: "festival-kick-off-karaoke-party-y1ogra",
    generalAdmissionPoints: 200,
    supportProvider: supportEnabled ? "givebutter" : "",
    supportLabel: supportEnabled ? "Support AAHF Festival" : "",
    supportUrl: supportEnabled ? "https://givebutter.com/festival-kick-off-karaoke-party-y1ogra" : "",
    supportCampaignCode: supportEnabled ? "festival-kick-off-karaoke-party-y1ogra" : "",
    supportPoints: 0,
    supportBadge: true,
    supportCelebrationStyle: "moneybags_burst",
    supportOffers: supportEnabled ? [
      { id: "solo_boost", label: "Solo Boost", amount: 5, points: 1200, rewardScope: "buyer", awardBadge: false, supportUrl: "https://givebutter.com/festival-kick-off-karaoke-party-y1ogra", supportCampaignCode: "festival-kick-off-karaoke-party-y1ogra" },
      { id: "stage_starter", label: "Stage Starter", amount: 10, points: 3000, rewardScope: "buyer", awardBadge: false, supportUrl: "https://givebutter.com/festival-kick-off-karaoke-party-y1ogra", supportCampaignCode: "festival-kick-off-karaoke-party-y1ogra" },
      { id: "headliner", label: "Headliner", amount: 20, points: 7500, rewardScope: "buyer", awardBadge: false, supportUrl: "https://givebutter.com/festival-kick-off-karaoke-party-y1ogra", supportCampaignCode: "festival-kick-off-karaoke-party-y1ogra" },
    ] : [],
    claimCodes: {},
  }, { merge: true });

  if (seedBuyerRoomUser) {
    await roomUserRef.set({
      uid: USER_UID,
      roomCode: ROOM_CODE,
      name: "Donor Example",
      email: "donor@example.com",
      avatar: "MIC",
      points: 100,
    }, { merge: true });
  }

  await userRef.set({
    uid: USER_UID,
    pointsBalance: seedUserPointsBalance,
  }, { merge: true });
}

function createResponseCapture() {
  const response = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return response;
}

async function invokeGivebutterWebhook(payload, headers = {}) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const req = {
    method: "POST",
    body: payload,
    rawBody,
    get(name = "") {
      const token = String(name || "").toLowerCase();
      return headers[token] || "";
    },
  };
  const res = createResponseCapture();
  await givebutterWebhook(req, res);
  return res;
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
  const payload = {
    type: "transaction.created",
    data: {
      transaction_id: SUPPORT_EVENT_ID,
      amount: 10,
      name: "Donor Example",
      supporter: {
        email: "donor@example.com",
      },
      campaign: {
        slug: "festival-kick-off-karaoke-party-y1ogra",
      },
    },
  };

  const checks = [
    ["accepts Givebutter Signature header and grants AAHF buyer reward", async () => {
      const response = await invokeGivebutterWebhook(payload, {
        signature: "test_secret",
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body, {
        received: true,
        supportPurchase: true,
        roomCode: ROOM_CODE,
      });

      const roomUserSnap = await roomUserRef.get();
      assert.equal(Number(roomUserSnap.get("points")), 3100);
      assert.equal(roomUserSnap.get("roomBoosted"), true);
      assert.equal(Number(roomUserSnap.get("lastSupportPurchaseAmountCents")), 1000);
      assert.equal(String(roomUserSnap.get("lastSupportPurchaseProvider")), "givebutter");

      const userSnap = await userRef.get();
      assert.equal(Number(userSnap.get("pointsBalance")), 3025);

      const roomSnap = await roomRef.get();
      assert.equal(String(roomSnap.get("purchaseCelebration.label")), "Stage Starter");
      assert.equal(Number(roomSnap.get("purchaseCelebration.points")), 3000);
      assert.equal(String(roomSnap.get("purchaseCelebration.rewardScope")), "buyer");
      assert.equal(String(roomSnap.get("purchaseCelebration.sourceProvider")), "givebutter");

      const supportSnap = await supportPurchaseRef.get();
      assert.equal(supportSnap.exists, true);
      assert.equal(String(supportSnap.get("normalizedEmail")), "donor@example.com");
      assert.equal(String(supportSnap.get("sourceCampaignCode")), "festival-kick-off-karaoke-party-y1ogra");
      assert.equal(String(supportSnap.get("supportOfferId")), "stage_starter");
      assert.equal(Number(supportSnap.get("pointsGranted")), 3000);
      assert.equal(String(supportSnap.get("matchedUid")), USER_UID);
    }],

    ["deduplicates repeated Givebutter support events", async () => {
      const first = await invokeGivebutterWebhook(payload, {
        signature: "test_secret",
      });
      const second = await invokeGivebutterWebhook(payload, {
        signature: "test_secret",
      });

      assert.equal(first.statusCode, 200);
      assert.equal(second.statusCode, 200);
      assert.deepEqual(second.body, {
        received: true,
        duplicate: true,
        supportPurchase: true,
      });

      const roomUserSnap = await roomUserRef.get();
      assert.equal(Number(roomUserSnap.get("points")), 3100);

      const userSnap = await userRef.get();
      assert.equal(Number(userSnap.get("pointsBalance")), 3025);
    }],

    ["writes ticket entitlement and joinRoomAudience claims it by email", async () => {
      await resetState({
        supportEnabled: false,
        seedBuyerRoomUser: false,
        seedUserPointsBalance: 0,
      });
      const entitlementPayload = {
        type: "ticket.created",
        data: {
          ticket_id: ENTITLEMENT_EVENT_ID,
          ticket_type: "General Admission",
          name: "Ticket Guest",
          supporter: {
            email: "ticket@example.com",
          },
          campaign: {
            slug: "festival-kick-off-karaoke-party-y1ogra",
          },
        },
      };

      const response = await invokeGivebutterWebhook(entitlementPayload, {
        signature: "test_secret",
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body, {
        received: true,
        entitlementId: ENTITLEMENT_REF_ID,
        eventId: "festival-kick-off-karaoke-party-y1ogra",
      });

      const entitlementSnap = await entitlementRef.get();
      assert.equal(entitlementSnap.exists, true);
      assert.equal(String(entitlementSnap.get("normalizedEmail")), "ticket@example.com");
      assert.equal(String(entitlementSnap.get("ticketTier")), "general_admission");
      assert.equal(Number(entitlementSnap.get("pointsGranted")), 200);
      assert.equal(entitlementSnap.get("claimed"), false);

      const joinResult = await joinRoomAudience.run(requestFor(USER_UID, {
        roomCode: ROOM_CODE,
        name: "Ticket Guest",
        avatar: "MIC",
        __token: { email: "ticket@example.com" },
      }));

      assert.equal(joinResult.ok, true);

      const roomUserSnap = await roomUserRef.get();
      assert.equal(roomUserSnap.exists, true);
      assert.equal(Number(roomUserSnap.get("points")), 400);
      assert.equal(String(roomUserSnap.get("matchedTicketTier")), "general_admission");

      const userSnap = await userRef.get();
      assert.equal(Number(userSnap.get("pointsBalance")), 400);

      const claimedEntitlementSnap = await entitlementRef.get();
      assert.equal(claimedEntitlementSnap.get("claimed"), true);
      assert.equal(String(claimedEntitlementSnap.get("matchedUid")), USER_UID);
      assert.equal(String(claimedEntitlementSnap.get("matchedRoomCode")), ROOM_CODE);

      const grantSnap = await entitlementGrantRef.get();
      assert.equal(grantSnap.exists, true);
      assert.equal(Number(grantSnap.get("pointsGranted")), 200);
    }],

    ["rejects bad Givebutter signature without writing reward records", async () => {
      const response = await invokeGivebutterWebhook(payload, {
        signature: "wrong_secret",
      });

      assert.equal(response.statusCode, 400);
      assert.equal(response.body, "Webhook Error");

      const supportSnap = await supportPurchaseRef.get();
      assert.equal(supportSnap.exists, false);

      const entitlementSnap = await entitlementRef.get();
      assert.equal(entitlementSnap.exists, false);

      const roomUserSnap = await roomUserRef.get();
      assert.equal(Number(roomUserSnap.get("points")), 100);

      const userSnap = await userRef.get();
      assert.equal(Number(userSnap.get("pointsBalance")), 25);
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }
  if (results.every(Boolean)) {
    console.log("PASS givebutterWebhook integration");
    return;
  }
  process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
