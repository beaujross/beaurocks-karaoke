const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  submitMarketingWaitlist,
  notifyOnHostApplicationCreated,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const USER_UID = "marketing-waitlist-user";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for marketing waitlist notification tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
const db = admin.firestore();

const requestFor = (uid, data = {}, options = {}) => ({
  auth: uid ? { uid, token: { email: options.email || `${uid}@test.local` } } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: (name = "") => {
      const key = String(name || "").toLowerCase();
      if (key === "origin") return "https://beaurocks.app";
      if (key === "user-agent") return "marketing-waitlist-notifications-test";
      return "";
    },
  },
});

async function deleteCollection(name) {
  const snap = await db.collection(name).limit(500).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function resetState() {
  const collections = [
    "marketing_waitlist",
    "marketing_meta",
    "host_access_applications",
    "host_application_notifications",
    "outboundMessages",
    "security_rate_limits",
  ];
  for (const name of collections) {
    await deleteCollection(name);
  }
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

async function findSingleDoc(collectionName, field, value) {
  const snap = await db.collection(collectionName).where(field, "==", value).limit(1).get();
  assert.equal(snap.size, 1, `Expected one ${collectionName} document for ${field}=${value}.`);
  return snap.docs[0];
}

async function run() {
  const checks = [
    ["submitMarketingWaitlist queues applicant confirmation email for host waitlist", async () => {
      const email = "qa-host-notifications@beaurocks.app";
      const result = await submitMarketingWaitlist.run(
        requestFor(USER_UID, {
          name: "QA Host Notifications",
          email,
          useCase: "host_application",
          source: "integration_email_notifications",
        })
      );

      assert.equal(result.ok, true);
      assert.equal(result.isNewSignup, true);
      assert.equal(result.linePosition, 1);

      const waitlistDoc = await findSingleDoc("marketing_waitlist", "email", email);
      assert.equal(waitlistDoc.get("status"), "active");
      assert.equal(waitlistDoc.get("linePosition"), 1);

      const applicationDoc = await findSingleDoc("host_access_applications", "email", email);
      assert.equal(applicationDoc.get("status"), "pending");
      assert.equal(applicationDoc.get("linePosition"), 1);
      assert.equal(applicationDoc.get("submissionCount"), 1);

      const messageSnap = await db.collection("outboundMessages").get();
      assert.equal(messageSnap.size, 1);
      const message = messageSnap.docs[0];
      assert.equal(message.get("status"), "queued");
      assert.equal(message.get("provider"), "smtp");
      assert.equal(message.get("source"), "submit_marketing_waitlist");
      assert.equal(message.get("eventType"), "host_application_applicant_received");
      assert.deepEqual(message.get("to"), [email]);
      assert.equal(message.get("meta.applicationId"), applicationDoc.id);
    }],

    ["notifyOnHostApplicationCreated queues admin alert email and writes notification log", async () => {
      const email = "qa-host-admin-alert@beaurocks.app";
      await submitMarketingWaitlist.run(
        requestFor(USER_UID, {
          name: "QA Host Admin Alert",
          email,
          useCase: "host_application",
          source: "integration_email_notifications",
        })
      );

      const applicationDoc = await findSingleDoc("host_access_applications", "email", email);

      await notifyOnHostApplicationCreated.run({
        params: { applicationId: applicationDoc.id },
        data: {
          data: () => applicationDoc.data(),
        },
      });

      const messages = await db.collection("outboundMessages").get();
      assert.equal(messages.size, 2);
      const adminMessage = messages.docs.find((docSnap) => docSnap.get("source") === "host_application_alert");
      assert.ok(adminMessage, "Expected queued admin alert outbound message.");
      assert.equal(adminMessage.get("status"), "queued");
      assert.equal(adminMessage.get("provider"), "smtp");
      assert.equal(adminMessage.get("eventType"), "host_application_created");
      assert.deepEqual(
        adminMessage.get("to"),
        ["hello@beauross.com", "hello@beaurocks.app"],
      );
      assert.equal(adminMessage.get("meta.applicationId"), applicationDoc.id);

      const notificationSnap = await db.collection("host_application_notifications").get();
      assert.equal(notificationSnap.size, 1);
      const notification = notificationSnap.docs[0];
      assert.equal(notification.get("applicationId"), applicationDoc.id);
      assert.equal(notification.get("eventType"), "host_application_created");
      assert.equal(notification.get("status"), "queued");
      assert.equal(notification.get("sent"), true);
      assert.equal(notification.get("outboundMessageId"), adminMessage.id);
      assert.deepEqual(
        notification.get("recipients"),
        ["hello@beauross.com", "hello@beaurocks.app"],
      );
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }

  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) {
    console.error(`\n${failed} marketing waitlist notification check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} marketing waitlist notification checks passed.`);
}

run().catch((error) => {
  console.error("Marketing waitlist notification integration test run failed.");
  console.error(error);
  process.exit(1);
});
