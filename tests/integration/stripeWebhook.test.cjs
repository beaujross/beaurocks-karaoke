const assert = require("node:assert/strict");
const {
  deleteCollection,
  installIoGuards,
} = require("./harness.cjs");

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_auction123";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_auction123";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-bross";

const admin = require("../../functions/node_modules/firebase-admin");
const Stripe = require("../../functions/node_modules/stripe");
const { stripeWebhook } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOMSTRP";
const BUYER_UID = "stripe-buyer";
const CHECKOUT_ID = "cs_test_spotlight_1";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for webhook integration tests.");
}

installIoGuards();

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${BUYER_UID}`);
const songRef = db.doc(`${ROOT}/karaoke_songs/auction_song_stripe`);
const stripeCheckoutRef = db.doc(`${ROOT}/stripe_checkouts/${CHECKOUT_ID}`);
const stripeEventRef = db.doc(`${ROOT}/stripe_events/${CHECKOUT_ID}`);
const userRef = db.doc(`users/${BUYER_UID}`);

async function resetState() {
  await deleteCollection(db, ["activities"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "rooms"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "room_users"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "karaoke_songs"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "stripe_checkouts"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "stripe_events"]);
  await deleteCollection(db, ["users"]);

  await roomRef.set({
    hostUid: "host-uid",
    hostUids: ["host-uid"],
    selfServeMode: {
      enabled: true,
      format: "spotlight_auction",
      paidPriorityEnabled: true,
      startedAtMs: 1700000000000,
    },
  }, { merge: true });
  await roomUserRef.set({
    uid: BUYER_UID,
    roomCode: ROOM_CODE,
    name: "Stripe Donor",
    avatar: "STAR",
    points: 0,
  }, { merge: true });
  await songRef.set({
    roomCode: ROOM_CODE,
    singerUid: BUYER_UID,
    singerName: "Stripe Donor",
    songTitle: "Livin' on a Prayer",
    status: "requested",
    priorityScore: 1,
  }, { merge: true });
  await userRef.set({
    uid: BUYER_UID,
    pointsBalance: 0,
  }, { merge: true });
}

function createResponseCapture() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
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
}

async function invokeStripeWebhook(eventPayload) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const payload = JSON.stringify(eventPayload);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const req = {
    headers: {
      "stripe-signature": signature,
    },
    rawBody: Buffer.from(payload),
  };
  const res = createResponseCapture();
  await stripeWebhook(req, res);
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
  const baseEvent = {
    id: "evt_spotlight_auction_1",
    type: "checkout.session.completed",
    object: "event",
    data: {
      object: {
        id: CHECKOUT_ID,
        object: "checkout.session",
        mode: "payment",
        amount_total: 2000,
        payment_status: "paid",
        metadata: {
          roomCode: ROOM_CODE,
          points: "3000",
          rewardScope: "buyer_and_room",
          buyerUid: BUYER_UID,
          buyerName: "Stripe Donor",
          label: "Headliner",
          packId: "headliner",
        },
      },
    },
  };

  const checks = [
    ["refreshes spotlight auction projection from a signed Stripe checkout event", async () => {
      const response = await invokeStripeWebhook(baseEvent);
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body, { received: true });

      const checkoutSnap = await stripeCheckoutRef.get();
      assert.equal(checkoutSnap.exists, true);
      assert.equal(String(checkoutSnap.get("buyerUid")), BUYER_UID);
      assert.equal(Number(checkoutSnap.get("amountCents")), 2000);
      assert.equal(String(checkoutSnap.get("checkoutStatus")), "completed");

      const eventSnap = await stripeEventRef.get();
      assert.equal(eventSnap.exists, true);

      const roomSnap = await roomRef.get();
      const auctionState = roomSnap.data()?.selfServeMode?.auctionState || {};
      assert.equal(Array.isArray(auctionState.leaderboard), true);
      assert.equal(auctionState.leaderboard.length, 1);
      assert.equal(String(auctionState.leaderboard[0].uid), BUYER_UID);
      assert.equal(String(auctionState.leaderboard[0].songId), "auction_song_stripe");
      assert.equal(Number(auctionState.leaderboard[0].amountCents), 2000);
      assert.equal(String(auctionState.summary || ""), "Stripe Donor leads with $20.00");
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }

  if (results.every(Boolean)) {
    console.log("PASS stripeWebhook integration");
    return;
  }
  process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
