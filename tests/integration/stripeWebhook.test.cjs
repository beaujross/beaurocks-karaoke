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
const HOST_UID = "stripe-host";
const ORG_ID = "org_stripe-host";
const SUBSCRIPTION_ID = "sub_host_1";

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
  await deleteCollection(db, ["organizations", ORG_ID, "additional_usage_ledger"]);
  await deleteCollection(db, ["organizations", ORG_ID, "additional_usage_grant_state"]);
  await deleteCollection(db, ["organizations", ORG_ID, "usage_capacity"]);
  await deleteCollection(db, ["additional_usage_payment_refs"]);
  await deleteCollection(db, ["activities"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "rooms"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "room_users"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "karaoke_songs"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "stripe_checkouts"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "stripe_events"]);
  await deleteCollection(db, ["users"]);
  await deleteCollection(db, ["organizations"]);
  await deleteCollection(db, ["stripe_subscriptions"]);

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
    ["refuses Additional usage grants while the owner-reviewed catalog is disabled", async () => {
      await db.doc(`organizations/${ORG_ID}`).set({ orgId: ORG_ID, ownerUid: HOST_UID });
      const response = await invokeStripeWebhook({
        id: "evt_additional_usage_disabled",
        type: "checkout.session.completed",
        object: "event",
        data: {
          object: {
            id: "cs_additional_usage_disabled",
            object: "checkout.session",
            mode: "payment",
            amount_total: 1200,
            currency: "usd",
            payment_status: "paid",
            metadata: {
              checkoutType: "additional_usage",
              orgId: ORG_ID,
              periodKey: "202607",
              packId: "unapproved_pack",
            },
          },
        },
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.additionalUsageCheckout, true);
      assert.equal(response.body.granted, false);
      assert.equal(response.body.reasonCode, "additional_usage_checkout_disabled");
      const capacitySnap = await db.doc(`organizations/${ORG_ID}/usage_capacity/202607`).get();
      assert.equal(capacitySnap.exists, false);
      const ledgerSnap = await db.doc(`organizations/${ORG_ID}/additional_usage_ledger/cs_additional_usage_disabled`).get();
      assert.equal(ledgerSnap.exists, false);
      const subscriptionSnap = await db.doc(`organizations/${ORG_ID}/subscription/current`).get();
      assert.equal(subscriptionSnap.exists, false);
    }],
    ["revokes remaining capacity once across refund and overlapping chargeback events", async () => {
      const period = "202607";
      const sessionId = "cs_additional_usage_paid";
      const paymentIntentId = "pi_additional_usage_paid";
      await db.doc(`organizations/${ORG_ID}`).set({ orgId: ORG_ID, ownerUid: HOST_UID });
      await db.doc(`organizations/${ORG_ID}/additional_usage_ledger/${sessionId}`).set({
        schemaVersion: 1,
        orgId: ORG_ID,
        period,
        entryType: "purchase_grant",
        packId: "extra_night_test",
        label: "Extra private karaoke night",
        amountCents: 1200,
        currency: "usd",
        paymentStatus: "paid",
        capacityByMeter: { youtube_data_request: 500, ai_generate_content: 25 },
        stripeSessionId: sessionId,
        stripePaymentIntentId: paymentIntentId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.doc(`organizations/${ORG_ID}/additional_usage_grant_state/${sessionId}`).set({
        schemaVersion: 1,
        orgId: ORG_ID,
        period,
        stripeSessionId: sessionId,
        capacityByMeter: { youtube_data_request: 500, ai_generate_content: 25 },
        revokedByMeter: {},
        refundedAmountCents: 0,
        status: "active",
      });
      await db.doc(`organizations/${ORG_ID}/usage_capacity/${period}`).set({
        schemaVersion: 1,
        orgId: ORG_ID,
        period,
        meters: {
          youtube_data_request: { granted: 500, revoked: 0 },
          ai_generate_content: { granted: 25, revoked: 0 },
        },
      });
      await db.doc(`additional_usage_payment_refs/${paymentIntentId}`).set({
        schemaVersion: 1,
        orgId: ORG_ID,
        period,
        stripeSessionId: sessionId,
        stripePaymentIntentId: paymentIntentId,
      });

      const refundEvent = {
        id: "evt_additional_usage_refund",
        type: "charge.refunded",
        object: "event",
        data: {
          object: {
            id: "ch_additional_usage_paid",
            object: "charge",
            payment_intent: paymentIntentId,
            amount: 1200,
            amount_refunded: 600,
            currency: "usd",
          },
        },
      };
      const first = await invokeStripeWebhook(refundEvent);
      const replay = await invokeStripeWebhook(refundEvent);
      assert.equal(first.body.additionalUsageAdjustment, true);
      assert.equal(first.body.adjustmentType, "refund");
      assert.equal(first.body.applied, true);
      assert.equal(replay.body.duplicate, true);

      const capacityAfterRefund = await db.doc(`organizations/${ORG_ID}/usage_capacity/${period}`).get();
      assert.equal(capacityAfterRefund.get("meters.youtube_data_request.granted"), 500);
      assert.equal(capacityAfterRefund.get("meters.youtube_data_request.revoked"), 500);
      assert.equal(capacityAfterRefund.get("meters.ai_generate_content.revoked"), 25);
      const purchaseAfterRefund = await db.doc(`organizations/${ORG_ID}/additional_usage_ledger/${sessionId}`).get();
      assert.equal(purchaseAfterRefund.get("entryType"), "purchase_grant");
      assert.equal(purchaseAfterRefund.get("capacityByMeter.youtube_data_request"), 500);
      assert.equal(purchaseAfterRefund.get("revokedByMeter"), undefined);

      const secondRefund = await invokeStripeWebhook({
        ...refundEvent,
        id: "evt_additional_usage_refund_two",
        data: {
          object: {
            ...refundEvent.data.object,
            amount_refunded: 1200,
          },
        },
      });
      assert.equal(secondRefund.body.additionalUsageAdjustment, true);
      assert.equal(secondRefund.body.applied, false);
      assert.equal(secondRefund.body.reasonCode, "additional_usage_already_fully_revoked");
      const secondRefundEntry = await db.doc(`organizations/${ORG_ID}/additional_usage_ledger/evt_additional_usage_refund_two`).get();
      assert.equal(secondRefundEntry.get("adjustmentAmountCents"), 600);
      assert.equal(secondRefundEntry.get("stripeCumulativeRefundAmountCents"), 1200);
      const grantStateAfterRefunds = await db.doc(`organizations/${ORG_ID}/additional_usage_grant_state/${sessionId}`).get();
      assert.equal(grantStateAfterRefunds.get("refundedAmountCents"), 1200);

      const dispute = await invokeStripeWebhook({
        id: "evt_additional_usage_dispute",
        type: "charge.dispute.created",
        object: "event",
        data: {
          object: {
            id: "dp_additional_usage_paid",
            object: "dispute",
            charge: "ch_additional_usage_paid",
            payment_intent: paymentIntentId,
            amount: 1200,
            currency: "usd",
          },
        },
      });
      assert.equal(dispute.body.additionalUsageAdjustment, true);
      assert.equal(dispute.body.adjustmentType, "chargeback");
      assert.equal(dispute.body.applied, false);
      assert.equal(dispute.body.reasonCode, "additional_usage_already_fully_revoked");
      const capacityAfterDispute = await db.doc(`organizations/${ORG_ID}/usage_capacity/${period}`).get();
      assert.equal(capacityAfterDispute.get("meters.youtube_data_request.revoked"), 500);
      assert.equal(capacityAfterDispute.get("meters.ai_generate_content.revoked"), 25);
      const disputeEntry = await db.doc(`organizations/${ORG_ID}/additional_usage_ledger/evt_additional_usage_dispute`).get();
      assert.equal(disputeEntry.get("entryType"), "capacity_adjustment");
      assert.equal(disputeEntry.get("applied"), false);
    }],
    ["ignores refunds that are not mapped to an Additional usage purchase", async () => {
      const response = await invokeStripeWebhook({
        id: "evt_unrelated_refund",
        type: "charge.refunded",
        object: "event",
        data: {
          object: {
            id: "ch_unrelated_refund",
            object: "charge",
            payment_intent: "pi_unrelated_refund",
            amount: 500,
            amount_refunded: 500,
            currency: "usd",
          },
        },
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.additionalUsageAdjustment, false);
      assert.equal(response.body.ignored, true);
      assert.equal(response.body.reasonCode, "not_additional_usage");
      const ledgerSnap = await db.doc(`organizations/${ORG_ID}/additional_usage_ledger/evt_unrelated_refund`).get();
      assert.equal(ledgerSnap.exists, false);
    }],
    ["projects an active Host subscription idempotently with Room creation enabled", async () => {
      const subscriptionEvent = {
        id: "evt_host_subscription_active",
        type: "customer.subscription.updated",
        object: "event",
        data: {
          object: {
            id: SUBSCRIPTION_ID,
            object: "subscription",
            status: "active",
            customer: "cus_host_1",
            current_period_end: 1800000000,
            cancel_at_period_end: false,
            metadata: {
              orgId: ORG_ID,
              ownerUid: HOST_UID,
              planId: "host_monthly",
            },
          },
        },
      };

      const first = await invokeStripeWebhook(subscriptionEvent);
      const second = await invokeStripeWebhook(subscriptionEvent);
      assert.equal(first.statusCode, 200);
      assert.equal(second.statusCode, 200);

      const subscriptionSnap = await db.doc("organizations/" + ORG_ID + "/subscription/current").get();
      const entitlementSnap = await db.doc("organizations/" + ORG_ID + "/entitlements/current").get();
      assert.equal(subscriptionSnap.get("planId"), "host_monthly");
      assert.equal(subscriptionSnap.get("status"), "active");
      assert.equal(entitlementSnap.get("capabilities")?.["rooms.create"], true);
      assert.equal(entitlementSnap.get("capabilities")?.["ai.generate_content"], true);
    }],

    ["projects past-due Host recovery access without new-Room permission", async () => {
      const response = await invokeStripeWebhook({
        id: "evt_host_subscription_past_due",
        type: "customer.subscription.updated",
        object: "event",
        data: {
          object: {
            id: SUBSCRIPTION_ID,
            object: "subscription",
            status: "past_due",
            customer: "cus_host_1",
            current_period_end: 1800000000,
            cancel_at_period_end: false,
            metadata: {
              orgId: ORG_ID,
              ownerUid: HOST_UID,
              planId: "host_monthly",
            },
          },
        },
      });
      assert.equal(response.statusCode, 200);

      const entitlementSnap = await db.doc("organizations/" + ORG_ID + "/entitlements/current").get();
      assert.equal(entitlementSnap.get("status"), "past_due");
      assert.equal(entitlementSnap.get("capabilities")?.["rooms.create"], false);
      assert.equal(entitlementSnap.get("capabilities")?.["ai.generate_content"], true);
    }],

    ["projects a canceled Host subscription with Room creation disabled", async () => {
      const response = await invokeStripeWebhook({
        id: "evt_host_subscription_deleted",
        type: "customer.subscription.deleted",
        object: "event",
        data: {
          object: {
            id: SUBSCRIPTION_ID,
            object: "subscription",
            status: "canceled",
            customer: "cus_host_1",
            current_period_end: 1800000000,
            cancel_at_period_end: false,
            metadata: {
              orgId: ORG_ID,
              ownerUid: HOST_UID,
              planId: "host_monthly",
            },
          },
        },
      });
      assert.equal(response.statusCode, 200);

      const entitlementSnap = await db.doc("organizations/" + ORG_ID + "/entitlements/current").get();
      assert.equal(entitlementSnap.get("status"), "canceled");
      assert.equal(entitlementSnap.get("capabilities")?.["rooms.create"], false);
      assert.equal(entitlementSnap.get("capabilities")?.["ai.generate_content"], false);
    }],

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
