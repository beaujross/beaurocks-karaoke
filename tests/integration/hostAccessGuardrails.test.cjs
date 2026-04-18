const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  bootstrapOnboardingWorkspace,
  provisionHostRoom,
  youtubeSearch,
  geminiGenerate,
  createAppleMusicToken,
  setHostApprovalStatus,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const ADMIN_UID = "host-guard-admin";
const USER_UID = "host-guard-user";
const AUDIENCE_UID = "host-guard-audience";
const ROOM_CODE = "GUARD1";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
const db = admin.firestore();

const requestFor = (uid, data = {}, options = {}) => ({
  auth: uid ? { uid, token: { email: options.email || `${uid}@test.local` } } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetState() {
  const collections = [
    "users",
    "directory_roles",
    "host_access_approvals",
    "host_access_approval_invites",
    "host_access_applications",
    "marketing_private_access",
    "marketing_private_invites",
    "security_rate_limits",
    "artifacts",
    "organizations",
  ];
  for (const name of collections) {
    const snap = await db.collection(name).limit(500).get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
  await db.doc(`users/${USER_UID}`).set({
    uid: USER_UID,
    name: "Guardrail User",
    subscription: { tier: "free" },
  }, { merge: true });
  await db.doc(`users/${AUDIENCE_UID}`).set({
    uid: AUDIENCE_UID,
    name: "Guardrail Audience",
    subscription: { tier: "free" },
  }, { merge: true });
  await db.doc(`directory_roles/${ADMIN_UID}`).set({
    roles: ["directory_admin"],
  }, { merge: true });
}

async function grantPrivateHostAccess(uid) {
  await setHostApprovalStatus.run(
    requestFor(ADMIN_UID, {
      target: uid,
      enabled: true,
      notes: "integration host access grant",
    })
  );
}

async function grantRoomYoutubeAccessForAudience(uid) {
  const roomOrgId = "org_guard_room";
  await db.doc(`organizations/${roomOrgId}`).set({
    orgId: roomOrgId,
    name: "Guard Room Org",
    ownerUid: ADMIN_UID,
    status: "active",
  }, { merge: true });
  await db.doc(`organizations/${roomOrgId}/subscription/current`).set({
    orgId: roomOrgId,
    planId: "host_annual",
    status: "active",
    provider: "integration_test",
  }, { merge: true });
  await db.doc(`organizations/${roomOrgId}/entitlements/current`).set({
    orgId: roomOrgId,
    planId: "host_annual",
    status: "active",
    source: "integration_test",
    capabilities: {
      "api.youtube_data": true,
    },
  }, { merge: true });
  await db.doc(`${ROOT}/rooms/${ROOM_CODE}`).set({
    roomCode: ROOM_CODE,
    orgId: roomOrgId,
    hostUid: ADMIN_UID,
    hostUids: [ADMIN_UID],
  }, { merge: true });
  await db.doc(`${ROOT}/room_users/${ROOM_CODE}_${uid}`).set({
    roomCode: ROOM_CODE,
    uid,
    name: "Audience Member",
  }, { merge: true });
}

async function grantHostScopedYoutubeAccessForAudience(uid) {
  await grantPrivateHostAccess(ADMIN_UID);
  await db.doc(`${ROOT}/rooms/${ROOM_CODE}`).set({
    roomCode: ROOM_CODE,
    hostUid: ADMIN_UID,
    hostUids: [ADMIN_UID],
  }, { merge: true });
  await db.doc(`${ROOT}/room_users/${ROOM_CODE}_${uid}`).set({
    roomCode: ROOM_CODE,
    uid,
    name: "Audience Member",
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
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    return false;
  }
}

async function run() {
  const checks = [
    ["free user cannot bootstrap onboarding workspace", async () => {
      await expectHttpsError(
        () => bootstrapOnboardingWorkspace.run(
          requestFor(USER_UID, { orgName: "Guardrail Org", hostName: "Guardrail Host" })
        ),
        "permission-denied"
      );
    }],
    ["free user cannot provision host room", async () => {
      await expectHttpsError(
        () => provisionHostRoom.run(
          requestFor(USER_UID, { requestId: "guardrail-room", hostName: "Guardrail Host" })
        ),
        "permission-denied"
      );
    }],
    ["approved host access can provision host room", async () => {
      await grantPrivateHostAccess(USER_UID);
      const result = await provisionHostRoom.run(
        requestFor(USER_UID, { requestId: "guardrail-room-ok", hostName: "Guardrail Host" })
      );
      assert.equal(result.ok, true);
      assert.ok(String(result.roomCode || "").trim().length > 0);
    }],
    ["free user cannot hit youtube data api callable", async () => {
      await expectHttpsError(
        () => youtubeSearch.run(
          requestFor(USER_UID, { query: "karaoke test" })
        ),
        "permission-denied"
      );
    }],
    ["approved host access can reach youtube data api guardrail layer", async () => {
      await grantPrivateHostAccess(USER_UID);
      await expectHttpsError(
        () => youtubeSearch.run(
          requestFor(USER_UID, { query: "karaoke test" })
        ),
        "failed-precondition"
      );
    }],
    ["room audience can reach youtube data api guardrail layer through room org entitlements", async () => {
      await grantRoomYoutubeAccessForAudience(AUDIENCE_UID);
      await expectHttpsError(
        () => youtubeSearch.run(
          requestFor(AUDIENCE_UID, { query: "karaoke test", roomCode: ROOM_CODE })
        ),
        "failed-precondition"
      );
    }],
    ["room audience can reach youtube data api guardrail layer through host entitlements when room org is missing", async () => {
      await grantHostScopedYoutubeAccessForAudience(AUDIENCE_UID);
      await expectHttpsError(
        () => youtubeSearch.run(
          requestFor(AUDIENCE_UID, { query: "karaoke test", roomCode: ROOM_CODE })
        ),
        "failed-precondition"
      );
    }],
    ["free user cannot hit gemini callable", async () => {
      await expectHttpsError(
        () => geminiGenerate.run(
          requestFor(USER_UID, { type: "lyrics", context: { title: "Golden Lights", artist: "Neon Crew" } })
        ),
        "permission-denied"
      );
    }],
    ["approved host access can reach gemini guardrail layer", async () => {
      await grantPrivateHostAccess(USER_UID);
      await expectHttpsError(
        () => geminiGenerate.run(
          requestFor(USER_UID, { type: "lyrics", context: { title: "Golden Lights", artist: "Neon Crew" } })
        ),
        "failed-precondition"
      );
    }],
    ["free user cannot mint apple music token", async () => {
      await expectHttpsError(
        () => createAppleMusicToken.run(
          requestFor(USER_UID, { roomCode: "DEMO1" })
        ),
        "permission-denied"
      );
    }],
  ];

  let failed = 0;
  for (const [name, fn] of checks) {
    const ok = await runCase(name, fn);
    if (!ok) failed += 1;
  }
  if (failed > 0) {
    process.exitCode = 1;
    throw new Error(`${failed} host access guardrail integration test(s) failed.`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
