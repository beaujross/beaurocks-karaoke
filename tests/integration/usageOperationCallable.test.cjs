const assert = require("node:assert/strict");

process.env.YOUTUBE_API_KEY = "integration-test-key";

const admin = require("../../functions/node_modules/firebase-admin");
const { youtubeSearch } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ORG_ID = "org_usage_operation_test";
const ROOM_CODE = "USAGE1";
const HOST_UID = "usage-operation-host";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
const db = admin.firestore();

const requestFor = (data = {}) => ({
  auth: { uid: HOST_UID, token: { email: `${HOST_UID}@test.local` } },
  app: null,
  data,
  rawRequest: { ip: "127.0.0.1", get: () => "" },
});

const expectHttpsError = async (run, expectedCode) => {
  try {
    await run();
  } catch (error) {
    assert.ok(String(error?.code || "").includes(expectedCode), `Expected ${expectedCode}, got ${error?.code}`);
    return;
  }
  assert.fail(`Expected ${expectedCode} but callable succeeded.`);
};

const setup = async () => {
  await db.doc(`organizations/${ORG_ID}`).set({
    orgId: ORG_ID,
    ownerUid: HOST_UID,
    status: "active",
  });
  await db.doc(`organizations/${ORG_ID}/subscription/current`).set({
    orgId: ORG_ID,
    planId: "host_monthly",
    status: "active",
  });
  await db.doc(`organizations/${ORG_ID}/entitlements/current`).set({
    orgId: ORG_ID,
    planId: "host_monthly",
    status: "active",
    capabilities: { "api.youtube_data": true },
  });
  await db.doc(`${ROOT}/rooms/${ROOM_CODE}`).set({
    roomCode: ROOM_CODE,
    orgId: ORG_ID,
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
  });
};

const run = async () => {
  await setup();
  const originalFetch = global.fetch;
  let providerCalls = 0;
  global.fetch = async () => {
    providerCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    };
  };

  try {
    const usageContext = {
      source: "host_usage_operation_test",
      surface: "host",
      operationId: "youtube-search:integration:one",
    };
    const first = await youtubeSearch.run(requestFor({
      query: "first unique usage operation query",
      roomCode: ROOM_CODE,
      usageContext,
    }));
    assert.deepEqual(first.items, []);
    assert.equal(providerCalls, 1);

    const period = new Date().toISOString().slice(0, 7).replace("-", "");
    const usageSnap = await db.doc(`organizations/${ORG_ID}/usage/${period}`).get();
    assert.equal(usageSnap.get("meters.youtube_data_request.reserved"), 0);
    assert.equal(usageSnap.get("meters.youtube_data_request.settled"), 1);
    assert.equal(usageSnap.get("meters.youtube_data_request.used"), 1);
    const operationSnap = await db.doc(
      `organizations/${ORG_ID}/usage_operations/${period}:youtube-search:integration:one:search_list`
    ).get();
    assert.equal(operationSnap.get("state"), "settled");
    assert.equal(operationSnap.get("meterId"), "youtube_data_request");

    await expectHttpsError(() => youtubeSearch.run(requestFor({
      query: "different query same usage operation",
      roomCode: ROOM_CODE,
      usageContext,
    })), "aborted");
    assert.equal(providerCalls, 1, "an idempotent replay must not call the provider again");
    const afterReplay = await db.doc(`organizations/${ORG_ID}/usage/${period}`).get();
    assert.equal(afterReplay.get("meters.youtube_data_request.settled"), 1);
    console.log("PASS YouTube search usage operation reserves, settles, and blocks replayed provider work");
  } finally {
    global.fetch = originalFetch;
  }
};

run().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
