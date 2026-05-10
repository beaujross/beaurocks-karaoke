const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { manageHostSettingsDefaults, listHostSettingsAuditEntries } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const HOST_UID = "settings-owner";
const MEMBER_UID = "settings-member";
const ORG_ID = `org_${HOST_UID}`;

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const hostUserRef = db.collection("users").doc(HOST_UID);
const memberUserRef = db.collection("users").doc(MEMBER_UID);
const orgRef = db.collection("organizations").doc(ORG_ID);
const orgDefaultsRef = orgRef.collection("settings").doc("defaults");
const orgAuditRef = orgRef.collection("settings_audit");

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: { email: `${uid}@example.com`, name: uid } } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetData() {
  const auditSnaps = await orgAuditRef.get().catch(() => ({ docs: [] }));
  await Promise.all((auditSnaps.docs || []).map((docSnap) => docSnap.ref.delete().catch(() => {})));
  await Promise.all([
    hostUserRef.delete().catch(() => {}),
    memberUserRef.delete().catch(() => {}),
    orgDefaultsRef.delete().catch(() => {}),
    orgRef.collection("members").doc(HOST_UID).delete().catch(() => {}),
    orgRef.collection("members").doc(MEMBER_UID).delete().catch(() => {}),
    orgRef.delete().catch(() => {}),
  ]);
  await orgRef.set({
    orgId: ORG_ID,
    ownerUid: HOST_UID,
    name: "Settings Workspace",
    status: "active",
  });
  await orgRef.collection("subscription").doc("current").set({
    orgId: ORG_ID,
    planId: "host_annual",
    status: "active",
    provider: "test",
  });
  await orgRef.collection("entitlements").doc("current").set({
    orgId: ORG_ID,
    planId: "host_annual",
    status: "active",
    source: "test",
    capabilities: {
      "workspace.onboarding": true,
      "api.youtube_data": true,
      "api.apple_music": true,
      "ai.generate_content": true,
      "billing.invoice_drafts": true,
      "workspace.shared_templates": true,
    },
  });
  await orgRef.collection("members").doc(HOST_UID).set({ uid: HOST_UID, role: "owner" });
  await orgRef.collection("members").doc(MEMBER_UID).set({ uid: MEMBER_UID, role: "member" });
  await hostUserRef.set({
    organization: {
      orgId: ORG_ID,
      role: "owner",
    },
    subscription: {
      tier: "host",
    },
  }, { merge: true });
  await memberUserRef.set({
    organization: {
      orgId: ORG_ID,
      role: "member",
    },
    subscription: {
      tier: "host",
    },
  }, { merge: true });
}

async function expectHttpsError(run, expectedCode) {
  try {
    await run();
  } catch (err) {
    const errorCode = String(err?.code || "");
    assert.ok(
      errorCode.includes(expectedCode),
      `Expected error code "${expectedCode}" but got "${errorCode}".`
    );
    return;
  }
  assert.fail(`Expected "${expectedCode}" error but callable succeeded.`);
}

async function runCase(name, fn) {
  await resetData();
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
    ["host can save and read host defaults for crowd mode", async () => {
      const saveResult = await manageHostSettingsDefaults.run(requestFor(HOST_UID, {
        action: "save",
        target: "host_default",
        bundleKey: "crowd_mode",
        settings: {
          chatShowOnTv: true,
          chatTvMode: "fullscreen",
          showScoring: false,
          marqueeEnabled: true,
          popTriviaEnabled: true,
        },
        provenance: {
          sourceType: "preset",
          sourceId: "hype",
        },
      }));
      assert.equal(saveResult.ok, true);
      assert.equal(saveResult.bundle.settings.chatTvMode, "fullscreen");

      const readResult = await manageHostSettingsDefaults.run(requestFor(HOST_UID, {
        action: "get",
        target: "host_default",
      }));
      assert.equal(readResult.ok, true);
      assert.equal(readResult.bundles.crowd_mode.settings.chatShowOnTv, true);
      assert.equal(readResult.bundles.crowd_mode.settings.showScoring, false);

      const userSnap = await hostUserRef.get();
      assert.equal(userSnap.get("hostSettingsDefaults.bundles.crowd_mode.settings.marqueeEnabled"), true);
    }],

    ["owner can save and read workspace template defaults for operating style", async () => {
      const saveResult = await manageHostSettingsDefaults.run(requestFor(HOST_UID, {
        action: "save",
        target: "workspace_template",
        bundleKey: "operating_style",
        settings: {
          autoPlayMedia: true,
          readyCheckDurationSec: 12,
          queueSettings: {
            limitMode: "per_hour",
            limitCount: 2,
            rotation: "first_come",
            firstTimeBoost: false,
          },
        },
        provenance: {
          sourceType: "room_override",
          sourceId: "ROOM123",
        },
      }));
      assert.equal(saveResult.ok, true);
      assert.equal(saveResult.bundle.settings.queueSettings.rotation, "first_come");

      const readResult = await manageHostSettingsDefaults.run(requestFor(HOST_UID, {
        action: "get",
        target: "workspace_template",
      }));
      assert.equal(readResult.ok, true);
      assert.equal(readResult.bundles.operating_style.settings.autoPlayMedia, true);
      assert.equal(readResult.bundles.operating_style.settings.queueSettings.limitMode, "per_hour");

      const templateSnap = await orgDefaultsRef.get();
      assert.equal(templateSnap.get("bundles.operating_style.settings.readyCheckDurationSec"), 12);

      const auditDocs = await orgAuditRef.get();
      assert.equal(auditDocs.size, 1);
      assert.equal(auditDocs.docs[0].get("target"), "workspace_template");
      assert.equal(auditDocs.docs[0].get("bundleKey"), "operating_style");
    }],

    ["workspace member cannot save workspace template defaults", async () => {
      await expectHttpsError(
        () => manageHostSettingsDefaults.run(requestFor(MEMBER_UID, {
          action: "save",
          target: "workspace_template",
          bundleKey: "crowd_mode",
          settings: {
            chatShowOnTv: true,
          },
        })),
        "permission-denied"
      );
    }],

    ["workspace template becomes read-only after capability downgrade", async () => {
      await orgDefaultsRef.set({
        orgId: ORG_ID,
        bundles: {
          crowd_mode: {
            bundleKey: "crowd_mode",
            settings: {
              chatShowOnTv: true,
              showScoring: true,
              marqueeEnabled: true,
              popTriviaEnabled: false,
              chatTvMode: "auto",
            },
            provenance: {
              sourceType: "workspace_template",
              sourceId: "legacy_template",
              savedTo: "workspace_template",
              actorUid: HOST_UID,
            },
            updatedBy: HOST_UID,
            updatedAtMs: 44,
          },
        },
      }, { merge: true });
      await orgRef.collection("entitlements").doc("current").set({
        orgId: ORG_ID,
        planId: "free",
        status: "active",
        source: "downgrade_test",
        capabilities: {
          "workspace.onboarding": true,
          "api.youtube_data": true,
          "api.apple_music": true,
          "ai.generate_content": true,
          "billing.invoice_drafts": true,
          "workspace.shared_templates": false,
        },
      }, { merge: true });

      const readResult = await manageHostSettingsDefaults.run(requestFor(HOST_UID, {
        action: "get",
        target: "workspace_template",
      }));
      assert.equal(readResult.ok, true);
      assert.equal(readResult.bundles.crowd_mode.settings.chatShowOnTv, true);
      assert.equal(readResult.accessState.canRead, true);
      assert.equal(readResult.accessState.canSave, false);
      assert.equal(readResult.accessState.downgradeState, "read_only_after_downgrade");

      await expectHttpsError(
        () => manageHostSettingsDefaults.run(requestFor(HOST_UID, {
          action: "save",
          target: "workspace_template",
          bundleKey: "crowd_mode",
          settings: {
            chatShowOnTv: false,
            showScoring: false,
            marqueeEnabled: false,
            popTriviaEnabled: false,
          },
        })),
        "permission-denied"
      );
    }],

    ["audit listing keeps host-private saves restricted while exposing workspace-visible saves", async () => {
      await manageHostSettingsDefaults.run(requestFor(HOST_UID, {
        action: "save",
        target: "host_default",
        bundleKey: "crowd_mode",
        settings: {
          chatShowOnTv: true,
          chatTvMode: "auto",
          showScoring: true,
          marqueeEnabled: false,
          popTriviaEnabled: false,
        },
      }));
      await manageHostSettingsDefaults.run(requestFor(HOST_UID, {
        action: "save",
        target: "workspace_template",
        bundleKey: "operating_style",
        settings: {
          autoPlayMedia: true,
          readyCheckDurationSec: 10,
          queueSettings: {
            limitMode: "per_night",
            limitCount: 2,
            rotation: "round_robin",
            firstTimeBoost: true,
          },
        },
      }));

      const ownerAudit = await listHostSettingsAuditEntries.run(requestFor(HOST_UID, {
        limit: 10,
      }));
      assert.equal(ownerAudit.ok, true);
      assert.equal(ownerAudit.items.length, 2);
      assert.ok(ownerAudit.items.some((entry) => entry.visibility === "host_private"));
      assert.ok(ownerAudit.items.some((entry) => entry.visibility === "workspace_visible"));

      const memberAudit = await listHostSettingsAuditEntries.run(requestFor(MEMBER_UID, {
        limit: 10,
      }));
      assert.equal(memberAudit.ok, true);
      assert.equal(memberAudit.items.length, 1);
      assert.equal(memberAudit.items[0].visibility, "workspace_visible");
      assert.equal(memberAudit.items[0].target, "workspace_template");
    }],
  ];

  let failures = 0;
  for (const [name, fn] of checks) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await runCase(name, fn);
    if (!ok) failures += 1;
  }

  if (failures) {
    throw new Error(`${failures} callable integration check(s) failed.`);
  }
  console.log(`All ${checks.length} host settings defaults callable checks passed.`);
}

run().catch((error) => {
  console.error("host settings defaults callable integration test failed.");
  console.error(error);
  process.exitCode = 1;
});
