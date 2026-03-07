const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { provisionHostRoom } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const HOST_UID = "host-provisioner";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: (name = "") => {
      const token = String(name || "").toLowerCase();
      if (token === "origin") return "https://beaurocks.app";
      return "";
    },
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

async function resetState() {
  await deleteCollection(["room_sessions"]);
  await deleteCollection(["organizations"]);
  await deleteCollection(["users"]);
  await deleteCollection(["host_access_approvals"]);
  await deleteCollection(["host_access_approval_invites"]);
  await deleteCollection(["host_access_applications"]);
  await deleteCollection(["marketing_private_access"]);
  await deleteCollection(["marketing_private_invites"]);
  await deleteCollection(["security_rate_limits"]);
  await deleteCollection(["artifacts", APP_ID, "public", "data", "rooms"]);
  await deleteCollection(["artifacts", APP_ID, "public", "data", "host_libraries"]);
  await deleteCollection(["artifacts", APP_ID, "public", "data", "room_provisioning_jobs"]);
  await db.doc(`users/${HOST_UID}`).set({
    uid: HOST_UID,
    subscription: { tier: "free" },
  }, { merge: true });
  await db.doc(`host_access_approvals/${HOST_UID}`).set({
    uid: HOST_UID,
    hostApprovalEnabled: true,
  }, { merge: true });
  await db.doc(`marketing_private_access/${HOST_UID}`).set({
    uid: HOST_UID,
    privateHostAccessEnabled: true,
  }, { merge: true });
}

async function runCase(name, fn) {
  await resetState();
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
    ["provisionHostRoom creates room + host library + idempotency record", async () => {
      const result = await provisionHostRoom.run(
        requestFor(HOST_UID, {
          requestId: "launch_a",
          hostName: "Neon Host",
          orgName: "Neon Org",
          logoUrl: "https://example.com/logo.png",
        })
      );
      assert.equal(result.ok, true);
      assert.equal(result.created, true);
      assert.equal(result.idempotent, false);
      assert.ok(/^[A-Z0-9]{4,10}$/.test(String(result.roomCode || "")));

      const roomRef = db.doc(`${ROOT}/rooms/${result.roomCode}`);
      const roomSnap = await roomRef.get();
      assert.equal(roomSnap.exists, true);
      assert.equal(roomSnap.get("hostUid"), HOST_UID);
      assert.equal(roomSnap.get("hostName"), "Neon Host");
      assert.equal(roomSnap.get("orgName"), "Neon Org");
      assert.equal(roomSnap.get("logoUrl"), "https://example.com/logo.png");

      const libSnap = await db.doc(`${ROOT}/host_libraries/${result.roomCode}`).get();
      assert.equal(libSnap.exists, true);
      assert.deepEqual(libSnap.get("ytIndex"), []);
      assert.deepEqual(libSnap.get("logoLibrary"), []);
      assert.deepEqual(libSnap.get("orbSkinLibrary"), []);

      const jobSnap = await db.doc(`${ROOT}/room_provisioning_jobs/${HOST_UID}_launch_a`).get();
      assert.equal(jobSnap.exists, true);
      assert.equal(jobSnap.get("roomCode"), result.roomCode);
      assert.equal(jobSnap.get("status"), "ready");
    }],

    ["provisionHostRoom reuses same room for matching requestId", async () => {
      const first = await provisionHostRoom.run(
        requestFor(HOST_UID, {
          requestId: "launch_same",
          hostName: "Host Alpha",
        })
      );
      const second = await provisionHostRoom.run(
        requestFor(HOST_UID, {
          requestId: "launch_same",
          hostName: "Host Beta",
        })
      );

      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      assert.equal(first.roomCode, second.roomCode);
      assert.equal(second.idempotent, true);
      assert.equal(second.created, false);

      const roomSnap = await db.doc(`${ROOT}/rooms/${first.roomCode}`).get();
      assert.equal(roomSnap.exists, true);
    }],

    ["provisionHostRoom can upsert discovery listing in same request", async () => {
      const result = await provisionHostRoom.run(
        requestFor(HOST_UID, {
          requestId: "launch_discovery",
          hostName: "Discovery Host",
          discoveryListing: {
            publicRoom: true,
            title: "Friday House Karaoke",
            city: "Seattle",
            state: "WA",
            startsAtMs: Date.now() + (60 * 60 * 1000),
            location: { lat: 47.6062, lng: -122.3321 },
          },
        })
      );

      assert.equal(result.ok, true);
      assert.ok(result.discovery);
      assert.equal(result.discovery.isPublicRoom, true);
      const listingId = String(result.discovery.listingId || "");
      assert.ok(listingId.length > 0);

      const listingSnap = await db.doc(`room_sessions/${listingId}`).get();
      assert.equal(listingSnap.exists, true);
      assert.equal(String(listingSnap.get("roomCode")), result.roomCode);
      assert.equal(String(listingSnap.get("visibility")), "public");

      const roomSnap = await db.doc(`${ROOT}/rooms/${result.roomCode}`).get();
      assert.equal(roomSnap.exists, true);
      assert.equal(String(roomSnap.get("discover.listingId")), listingId);
      assert.equal(!!roomSnap.get("discover.publicRoom"), true);
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

run().catch((error) => {
  console.error("Callable integration test run failed.");
  console.error(error);
  process.exit(1);
});
