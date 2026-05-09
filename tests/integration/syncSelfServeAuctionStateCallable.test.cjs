const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { syncSelfServeAuctionState } = require("../../functions/index.js");
const {
  deleteCollection,
  installIoGuards,
  isRetryableFirestoreHarnessError,
  retryAsync,
  waitForDocument,
} = require("./harness.cjs");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOMAUCT";
const HOST_UID = "host-auction";
const BUYER_A_UID = "buyer-a";
const BUYER_B_UID = "buyer-b";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
installIoGuards();

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserARef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${BUYER_A_UID}`);
const roomUserBRef = db.doc(`${ROOT}/room_users/${ROOM_CODE}_${BUYER_B_UID}`);
const songARef = db.doc(`${ROOT}/karaoke_songs/song_a`);
const songBRef = db.doc(`${ROOT}/karaoke_songs/song_b`);
const supportEventRef = db.doc(`support_purchase_events/support_a`);
const stripeCheckoutRef = db.doc(`${ROOT}/stripe_checkouts/stripe_b`);

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
  await deleteCollection(db, ["support_purchase_events"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "stripe_checkouts"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "karaoke_songs"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "room_users"]);
  await deleteCollection(db, ["artifacts", APP_ID, "public", "data", "rooms"]);

  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    selfServeMode: {
      enabled: true,
      format: "spotlight_auction",
      paidPriorityEnabled: true,
      startedAtMs: 1700000000000,
    },
  }, { merge: true });

  await Promise.all([
    roomUserARef.set({ uid: BUYER_A_UID, roomCode: ROOM_CODE, name: "Alex", avatar: "MIC" }, { merge: true }),
    roomUserBRef.set({ uid: BUYER_B_UID, roomCode: ROOM_CODE, name: "Bailey", avatar: "STAR" }, { merge: true }),
    songARef.set({
      roomCode: ROOM_CODE,
      singerUid: BUYER_A_UID,
      singerName: "Alex",
      songTitle: "Mr. Brightside",
      status: "requested",
      priorityScore: 10,
    }, { merge: true }),
    songBRef.set({
      roomCode: ROOM_CODE,
      singerUid: BUYER_B_UID,
      singerName: "Bailey",
      songTitle: "Since U Been Gone",
      status: "requested",
      priorityScore: 20,
    }, { merge: true }),
    supportEventRef.set({
      roomCode: ROOM_CODE,
      matchedUid: BUYER_A_UID,
      rewardScope: "buyer",
      amountCents: 1200,
      sourceProvider: "givebutter",
      createdAt: admin.firestore.Timestamp.fromMillis(1700000005000),
    }, { merge: true }),
    stripeCheckoutRef.set({
      roomCode: ROOM_CODE,
      buyerUid: BUYER_B_UID,
      rewardScope: "buyer",
      amountCents: 2500,
      checkoutStatus: "completed",
      fulfilledAt: admin.firestore.Timestamp.fromMillis(1700000008000),
    }, { merge: true }),
  ]);
  await waitForDocument(roomRef, { predicate: (snap) => snap.exists });
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
    ["host can sync server-auth Spotlight Auction leaderboard", async () => {
      const result = await retryAsync(
        async (attempt) => {
          if (attempt > 0) {
            await resetState();
          }
          const seededRoomSnap = await waitForDocument(roomRef, { predicate: (snap) => snap.exists });
          assert.equal(seededRoomSnap.exists, true, "Expected seeded room before sync.");
          return syncSelfServeAuctionState.run(requestFor(HOST_UID, { roomCode: ROOM_CODE }));
        },
        {
          retries: 3,
          delayMs: 120,
          shouldRetry: isRetryableFirestoreHarnessError,
        }
      );
      assert.equal(result.ok, true);
      assert.equal(result.roomCode, ROOM_CODE);
      assert.equal(Array.isArray(result.auctionState.leaderboard), true);
      assert.equal(result.auctionState.leaderboard.length, 2);
      assert.equal(String(result.auctionState.leaderboard[0].uid), BUYER_B_UID);
      assert.equal(Number(result.auctionState.leaderboard[0].amountCents), 2500);
      assert.equal(String(result.auctionState.leaderboard[1].uid), BUYER_A_UID);

      const roomSnap = await roomRef.get();
      const auctionState = roomSnap.data()?.selfServeMode?.auctionState || {};
      assert.equal(String(auctionState?.leaderboard?.[0]?.uid), BUYER_B_UID);
      assert.equal(Number(auctionState?.leaderboard?.[0]?.amountCents), 2500);
      assert.equal(String(auctionState?.summary || ""), "Bailey leads with $25.00");
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }

  if (results.every(Boolean)) {
    console.log("All syncSelfServeAuctionState integration checks passed.");
    return;
  }
  process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
