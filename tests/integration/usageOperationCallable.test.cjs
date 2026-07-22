const assert = require("node:assert/strict");

process.env.YOUTUBE_API_KEY = "integration-test-key";
process.env.GEMINI_API_KEY = "integration-test-gemini-key";

const admin = require("../../functions/node_modules/firebase-admin");
const { geminiGenerate, getMyUsageSummary, manageMyUsageControls, youtubeSearch } = require("../../functions/index.js");

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
    return error;
  }
  assert.fail(`Expected ${expectedCode} but callable succeeded.`);
};

const setup = async () => {
  await db.doc(`users/${HOST_UID}`).set({
    uid: HOST_UID,
    organization: { orgId: ORG_ID, role: "owner" },
  });
  await db.doc(`organizations/${ORG_ID}`).set({
    orgId: ORG_ID,
    ownerUid: HOST_UID,
    status: "active",
  });
  await db.doc(`organizations/${ORG_ID}/members/${HOST_UID}`).set({
    uid: HOST_UID,
    role: "owner",
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
    capabilities: { "api.youtube_data": true, "ai.generate_content": true },
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
  let youtubeProviderCalls = 0;
  let aiProviderCalls = 0;
  global.fetch = async (url) => {
    if (String(url || "").includes("generativelanguage.googleapis.com")) {
      aiProviderCalls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '["Sing like nobody is recording"]' }] } }] }),
      };
    }
    youtubeProviderCalls += 1;
    if (String(url || "").includes("/youtube/v3/search")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{
            id: { videoId: "video-one" },
            snippet: { title: "Test Song", channelTitle: "Test Channel", thumbnails: {} },
          }],
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [{
          id: "video-one",
          status: { embeddable: true, uploadStatus: "processed", privacyStatus: "public" },
          contentDetails: { duration: "PT3M30S" },
          statistics: { viewCount: "1000" },
        }],
      }),
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
    assert.equal(first.items.length, 1);
    assert.equal(youtubeProviderCalls, 2);

    const period = new Date().toISOString().slice(0, 7).replace("-", "");
    const usageSnap = await db.doc(`organizations/${ORG_ID}/usage/${period}`).get();
    assert.equal(usageSnap.get("meters.youtube_data_request.reserved"), 0);
    assert.equal(usageSnap.get("meters.youtube_data_request.settled"), 2);
    assert.equal(usageSnap.get("meters.youtube_data_request.used"), 2);
    assert.equal(usageSnap.get(`meters.youtube_data_request.rooms.${ROOM_CODE}.reserved`), 0);
    assert.equal(usageSnap.get(`meters.youtube_data_request.rooms.${ROOM_CODE}.settled`), 2);
    assert.equal(usageSnap.get(`meters.youtube_data_request.rooms.${ROOM_CODE}.used`), 2);
    const operationSnap = await db.doc(
      `organizations/${ORG_ID}/usage_operations/${period}:youtube-search:integration:one:search_list`
    ).get();
    assert.equal(operationSnap.get("state"), "settled");
    assert.equal(operationSnap.get("meterId"), "youtube_data_request");
    const detailsOperationSnap = await db.doc(
      `organizations/${ORG_ID}/usage_operations/${period}:youtube-search:integration:one:videos_list`
    ).get();
    assert.equal(detailsOperationSnap.get("state"), "settled");

    await expectHttpsError(() => youtubeSearch.run(requestFor({
      query: "different query same usage operation",
      roomCode: ROOM_CODE,
      usageContext,
    })), "aborted");
    assert.equal(youtubeProviderCalls, 2, "an idempotent replay must not call the provider again");
    const afterReplay = await db.doc(`organizations/${ORG_ID}/usage/${period}`).get();
    assert.equal(afterReplay.get("meters.youtube_data_request.settled"), 2);

    const savedRoomControls = await manageMyUsageControls.run(requestFor({
      action: "set_room_meter",
      roomCode: ROOM_CODE,
      meterId: "youtube_data_request",
      hardLimit: 2,
    }));
    assert.equal(savedRoomControls.meters.youtube_data_request.roomHardLimit, 2);
    const roomLimitError = await expectHttpsError(() => youtubeSearch.run(requestFor({
      query: "room budget must stop provider work",
      roomCode: ROOM_CODE,
      usageContext: {
        ...usageContext,
        operationId: "youtube-search:integration:room-limit",
      },
    })), "resource-exhausted");
    assert.equal(roomLimitError?.details?.reasonCode, "usage_room_hard_limit_reached");
    assert.equal(roomLimitError?.details?.scope, "room");
    assert.equal(roomLimitError?.details?.roomHardLimit, 2);
    assert.equal(roomLimitError?.details?.protectedRoomCapabilitiesAvailable, true);
    assert.equal(youtubeProviderCalls, 2, "a Room limit must stop work before the provider call");

    await manageMyUsageControls.run(requestFor({
      action: "clear_room_meter",
      roomCode: ROOM_CODE,
      meterId: "youtube_data_request",
    }));
    const savedWorkspaceControls = await manageMyUsageControls.run(requestFor({
      action: "set_workspace_meter",
      meterId: "youtube_data_request",
      hardLimit: 2,
    }));
    assert.equal(savedWorkspaceControls.meters.youtube_data_request.workspaceHardLimit, 2);
    const workspaceLimitError = await expectHttpsError(() => youtubeSearch.run(requestFor({
      query: "workspace budget must stop provider work",
      roomCode: ROOM_CODE,
      usageContext: {
        ...usageContext,
        operationId: "youtube-search:integration:workspace-limit",
      },
    })), "resource-exhausted");
    assert.equal(workspaceLimitError?.details?.reasonCode, "usage_workspace_hard_limit_reached");
    assert.equal(workspaceLimitError?.details?.scope, "workspace");
    assert.equal(youtubeProviderCalls, 2, "a Workspace limit must stop work before the provider call");

    await manageMyUsageControls.run(requestFor({
      action: "set_workspace_meter",
      meterId: "youtube_data_request",
      hardLimit: 25000,
    }));

    await db.doc(`organizations/${ORG_ID}/usage_capacity/${period}`).set({
      schemaVersion: 1,
      orgId: ORG_ID,
      period,
      meters: {
        youtube_data_request: { granted: 10, revoked: 0 },
      },
    });
    const expandedControls = await manageMyUsageControls.run(requestFor({
      action: "set_workspace_meter",
      meterId: "youtube_data_request",
      hardLimit: 25010,
    }));
    assert.equal(expandedControls.meters.youtube_data_request.planHardLimit, 25000);
    assert.equal(expandedControls.meters.youtube_data_request.additionalCapacity, 10);
    assert.equal(expandedControls.meters.youtube_data_request.maximumHardLimit, 25010);
    assert.equal(expandedControls.meters.youtube_data_request.workspaceHardLimit, 25010);
    const expandedSummary = await getMyUsageSummary.run(requestFor({ period }));
    assert.equal(expandedSummary.additionalUsage.checkoutEnabled, false);
    assert.equal(expandedSummary.additionalUsage.autoRefillEnabled, false);
    assert.equal(expandedSummary.additionalUsage.meters.youtube_data_request.active, 10);
    assert.equal(expandedSummary.meters.youtube_data_request.maximumHardLimit, 25010);

    await db.doc("platform_controls/usage").set({
      schemaVersion: 1,
      state: "blocked",
    });
    const circuitError = await expectHttpsError(() => youtubeSearch.run(requestFor({
      query: "platform circuit must stop provider work",
      roomCode: "",
      usageContext: {
        ...usageContext,
        operationId: "youtube-search:integration:platform-circuit",
      },
    })), "unavailable");
    assert.equal(circuitError?.details?.reasonCode, "usage_platform_circuit_open");
    assert.equal(circuitError?.details?.scope, "platform");
    assert.equal(youtubeProviderCalls, 2, "an open platform circuit must stop work before the provider call");

    await db.doc("platform_controls/usage").set({ state: "enabled" }, { merge: true });
    const aiOperationId = "ai-generation:integration:one";
    const aiResult = await geminiGenerate.run(requestFor({
      type: "selfie_prompt",
      context: {},
      roomCode: ROOM_CODE,
      usageContext: { source: "host_ai_test", surface: "host", operationId: aiOperationId },
    }));
    assert.deepEqual(aiResult.result, ["Sing like nobody is recording"]);
    assert.equal(aiProviderCalls, 1);
    const aiOperationSnap = await db.doc(
      `organizations/${ORG_ID}/usage_operations/${period}:${aiOperationId}:generate_content`
    ).get();
    assert.equal(aiOperationSnap.get("state"), "settled");
    assert.equal(aiOperationSnap.get("capabilityId"), "ai_generation");

    await expectHttpsError(() => geminiGenerate.run(requestFor({
      type: "selfie_prompt",
      context: {},
      roomCode: ROOM_CODE,
      usageContext: { source: "host_ai_test", surface: "host", operationId: aiOperationId },
    })), "aborted");
    assert.equal(aiProviderCalls, 1, "an AI operation replay must not call Gemini again");

    await db.doc(`organizations/${ORG_ID}/entitlements/current`).set({
      orgId: ORG_ID,
      planId: "host_monthly",
      status: "active",
      capabilities: { "api.youtube_data": true },
    });
    await db.doc(`${ROOT}/rooms/${ROOM_CODE}`).set({
      missionControl: { aiDemoBypass: true, aiDemoBypassUntil: Date.now() + 60000 },
    }, { merge: true });
    await manageMyUsageControls.run(requestFor({
      action: "set_workspace_meter",
      meterId: "ai_generate_content",
      hardLimit: 1,
    }));
    const demoLimitError = await expectHttpsError(() => geminiGenerate.run(requestFor({
      type: "selfie_prompt",
      context: {},
      roomCode: ROOM_CODE,
      usageContext: { source: "host_ai_demo_test", surface: "host", operationId: "ai-generation:integration:demo-limit" },
    })), "resource-exhausted");
    assert.equal(demoLimitError?.details?.reasonCode, "usage_workspace_hard_limit_reached");
    assert.equal(aiProviderCalls, 1, "AI demo access must not bypass the Workspace hard limit");

    console.log("PASS usage operations enforce replay protection, Room budgets, platform circuits, AI settlement, and bounded demo access");
  } finally {
    global.fetch = originalFetch;
  }
};

run().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
