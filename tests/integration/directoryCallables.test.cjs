const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  upsertDirectoryProfile,
  submitDirectoryListing,
  listModerationQueue,
  resolveModerationItem,
  followDirectoryEntity,
  unfollowDirectoryEntity,
  createDirectoryCheckin,
  submitDirectoryReview,
  runExternalDirectoryIngestion,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const MOD_UID = "directory-mod";
const USER_UID = "directory-user";
const OTHER_UID = "directory-other";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
const db = admin.firestore();

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: { email: `${uid}@test.local` } } : null,
  app: null,
  data,
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetState() {
  const collections = [
    "directory_profiles",
    "directory_roles",
    "directory_submissions",
    "venues",
    "karaoke_events",
    "room_sessions",
    "follows",
    "checkins",
    "checkin_totals",
    "reviews",
    "review_totals",
    "directory_sync_jobs",
    "external_source_links",
  ];
  for (const name of collections) {
    const snap = await db.collection(name).limit(500).get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
  await db.doc(`directory_roles/${MOD_UID}`).set({
    roles: ["directory_editor"],
  });
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
    ["upsertDirectoryProfile writes profile for caller", async () => {
      const result = await upsertDirectoryProfile.run(
        requestFor(USER_UID, { profile: { displayName: "Neon Host", roles: ["host"] } })
      );
      assert.equal(result.ok, true);
      const snap = await db.doc(`directory_profiles/${USER_UID}`).get();
      assert.equal(snap.exists, true);
      assert.equal(snap.get("displayName"), "Neon Host");
    }],

    ["submitDirectoryListing creates pending submission", async () => {
      const result = await submitDirectoryListing.run(
        requestFor(USER_UID, {
          listingType: "venue",
          payload: {
            title: "Songhouse",
            city: "Seattle",
            state: "WA",
            region: "wa_seattle",
          },
        })
      );
      assert.equal(result.ok, true);
      const snap = await db.doc(`directory_submissions/${result.submissionId}`).get();
      assert.equal(snap.exists, true);
      assert.equal(snap.get("status"), "pending");
    }],

    ["submitDirectoryListing geocodes missing location when address is present", async () => {
      const originalFetch = global.fetch;
      const originalKey = process.env.GOOGLE_MAPS_API_KEY;
      process.env.GOOGLE_MAPS_API_KEY = "test-directory-key";
      let called = 0;
      global.fetch = async () => {
        called += 1;
        return {
          ok: true,
          json: async () => ({
            status: "OK",
            results: [{
              place_id: "test_place_id_123",
              formatted_address: "123 Main St, Seattle, WA 98101, USA",
              geometry: {
                location: { lat: 47.6097, lng: -122.3331 },
              },
            }],
          }),
        };
      };

      try {
        const result = await submitDirectoryListing.run(
          requestFor(USER_UID, {
            listingType: "venue",
            payload: {
              title: "Geocode Venue",
              address1: "123 Main St",
              city: "Seattle",
              state: "WA",
              region: "wa_seattle",
            },
          })
        );
        assert.equal(result.ok, true);
        const snap = await db.doc(`directory_submissions/${result.submissionId}`).get();
        assert.equal(snap.exists, true);
        const doc = snap.data() || {};
        assert.equal(Number(doc?.payload?.location?.lat), 47.6097);
        assert.equal(Number(doc?.payload?.location?.lng), -122.3331);
        assert.equal(doc?.payload?.externalSources?.google?.placeId, "test_place_id_123");
        assert.equal(called, 1);
      } finally {
        global.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
        else process.env.GOOGLE_MAPS_API_KEY = originalKey;
      }
    }],

    ["moderator resolves submission to approved canonical listing", async () => {
      const submission = await submitDirectoryListing.run(
        requestFor(USER_UID, {
          listingType: "event",
          payload: {
            title: "Friday Night Karaoke",
            city: "Seattle",
            state: "WA",
            region: "wa_seattle",
            startsAtMs: Date.now() + 3600000,
          },
        })
      );
      const resolved = await resolveModerationItem.run(
        requestFor(MOD_UID, {
          submissionId: submission.submissionId,
          action: "approve",
          notes: "Looks valid",
        })
      );
      assert.equal(resolved.ok, true);
      assert.equal(resolved.mode, "approved");
      const canonical = await db.doc(`karaoke_events/${resolved.entityId}`).get();
      assert.equal(canonical.exists, true);
      assert.equal(canonical.get("status"), "approved");
    }],

    ["non-moderator cannot list moderation queue", async () => {
      await expectHttpsError(
        () => listModerationQueue.run(requestFor(USER_UID, { status: "pending" })),
        "permission-denied"
      );
    }],

    ["follow and unfollow mutate follow graph idempotently", async () => {
      const followResult = await followDirectoryEntity.run(
        requestFor(USER_UID, { targetType: "host", targetId: OTHER_UID })
      );
      assert.equal(followResult.ok, true);
      const followSnap = await db.doc(`follows/${followResult.followId}`).get();
      assert.equal(followSnap.exists, true);

      const unfollowResult = await unfollowDirectoryEntity.run(
        requestFor(USER_UID, { targetType: "host", targetId: OTHER_UID })
      );
      assert.equal(unfollowResult.ok, true);
      const after = await db.doc(`follows/${followResult.followId}`).get();
      assert.equal(after.exists, false);
    }],

    ["createDirectoryCheckin updates aggregate totals", async () => {
      const result = await createDirectoryCheckin.run(
        requestFor(USER_UID, { targetType: "venue", targetId: "venue_demo", isPublic: false })
      );
      assert.equal(result.ok, true);
      const totals = await db.doc("checkin_totals/venue_venue_demo").get();
      assert.equal(totals.exists, true);
      assert.equal(Number(totals.get("totalCount") || 0), 1);
      assert.equal(Number(totals.get("publicCount") || 0), 0);
    }],

    ["submitDirectoryReview validates and updates rollups", async () => {
      const result = await submitDirectoryReview.run(
        requestFor(USER_UID, {
          targetType: "venue",
          targetId: "venue_demo",
          rating: 5,
          tags: ["host_vibe", "song_quality"],
          text: "Rotation stayed smooth and karaoke focused.",
        })
      );
      assert.equal(result.ok, true);
      const totals = await db.doc("review_totals/venue_venue_demo").get();
      assert.equal(totals.exists, true);
      assert.equal(Number(totals.get("reviewCount") || 0), 1);
      assert.equal(Number(totals.get("ratingSum") || 0), 5);
    }],

    ["runExternalDirectoryIngestion accepts dry-run candidate payload", async () => {
      const result = await runExternalDirectoryIngestion.run(
        requestFor(MOD_UID, {
          dryRun: true,
          providers: ["google", "yelp"],
          regions: ["wa_seattle"],
          records: [
            {
              name: "Karaoke Pilot",
              city: "Seattle",
              state: "WA",
              listingType: "venue",
            },
          ],
        })
      );
      assert.equal(result.ok, true);
      assert.equal(result.dryRun, true);
      assert.equal(Number(result.queued || 0), 1);
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }
  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) {
    console.error(`\n${failed} directory callable integration check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} directory callable integration checks passed.`);
}

run().catch((error) => {
  console.error("Directory callable integration test run failed.");
  console.error(error);
  process.exit(1);
});
