const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
process.env.MARKETING_SMS_REMINDERS_ENABLED = process.env.MARKETING_SMS_REMINDERS_ENABLED || "true";
const {
  ensureSong,
  ensureTrack,
  upsertDirectoryProfile,
  submitDirectoryListing,
  listModerationQueue,
  resolveModerationItem,
  followDirectoryEntity,
  unfollowDirectoryEntity,
  createDirectoryCheckin,
  submitDirectoryReview,
  runExternalDirectoryIngestion,
  submitDirectoryClaimRequest,
  resolveDirectoryClaimRequest,
  setDirectoryRsvp,
  setDirectoryReminderPreferences,
  listDirectoryGeoLanding,
  submitCatalogContribution,
  listCatalogContributionQueue,
  resolveCatalogContribution,
  previewDirectoryRoomSessionByCode,
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
    "directory_claim_requests",
    "directory_rsvps",
    "directory_reminders",
    "directory_geo_pages",
    "catalog_contributions",
    "songs",
    "tracks",
    "users",
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
  await db.doc(`users/${USER_UID}`).set({
    uid: USER_UID,
    name: "Directory User",
    subscription: { tier: "free" },
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
    ["upsertDirectoryProfile writes profile for caller", async () => {
      const result = await upsertDirectoryProfile.run(
        requestFor(USER_UID, { profile: { displayName: "Neon Host", roles: ["host"] } })
      );
      assert.equal(result.ok, true);
      const snap = await db.doc(`directory_profiles/${USER_UID}`).get();
      assert.equal(snap.exists, true);
      assert.equal(snap.get("displayName"), "Neon Host");
    }],

    ["ensureSong denies non-host direct catalog writes", async () => {
      await expectHttpsError(
        () => ensureSong.run(requestFor(USER_UID, { title: "My Song", artist: "Me" })),
        "permission-denied"
      );
    }],

    ["ensureSong allows host role direct catalog writes", async () => {
      await db.doc(`directory_profiles/${USER_UID}`).set({
        uid: USER_UID,
        displayName: "Host User",
        roles: ["host"],
        status: "approved",
      });
      const result = await ensureSong.run(
        requestFor(USER_UID, { title: "Host Song", artist: "Host Artist" })
      );
      assert.ok(result.songId);
      const snap = await db.doc(`songs/${result.songId}`).get();
      assert.equal(snap.exists, true);
      const track = await ensureTrack.run(
        requestFor(USER_UID, {
          songId: result.songId,
          source: "custom",
          mediaUrl: "https://cdn.example.com/host-song.mp3",
          label: "Host Version",
        })
      );
      assert.ok(track.trackId);
      const trackSnap = await db.doc(`tracks/${track.trackId}`).get();
      assert.equal(trackSnap.exists, true);
    }],

    ["submitCatalogContribution queues pending request", async () => {
      const result = await submitCatalogContribution.run(
        requestFor(USER_UID, {
          payload: {
            title: "Queue Song",
            artist: "Queue Artist",
            source: "youtube",
            mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        })
      );
      assert.equal(result.ok, true);
      assert.equal(result.status, "pending");
      const snap = await db.doc(`catalog_contributions/${result.contributionId}`).get();
      assert.equal(snap.exists, true);
      assert.equal(snap.get("status"), "pending");
    }],

    ["resolveCatalogContribution approves and applies to songs/tracks", async () => {
      const queued = await submitCatalogContribution.run(
        requestFor(USER_UID, {
          payload: {
            title: "Moderated Song",
            artist: "Moderated Artist",
            source: "custom",
            mediaUrl: "https://cdn.example.com/moderated.mp3",
          },
        })
      );
      const resolved = await resolveCatalogContribution.run(
        requestFor(MOD_UID, {
          contributionId: queued.contributionId,
          action: "approve",
          notes: "approved in test",
        })
      );
      assert.equal(resolved.ok, true);
      assert.equal(resolved.status, "approved");
      assert.ok(resolved.songId);
      assert.ok(resolved.trackId);
      const queueSnap = await db.doc(`catalog_contributions/${queued.contributionId}`).get();
      assert.equal(queueSnap.get("status"), "approved");
      assert.equal(String(queueSnap.get("moderation.action")), "approved");
      const songSnap = await db.doc(`songs/${resolved.songId}`).get();
      assert.equal(songSnap.exists, true);
      const trackSnap = await db.doc(`tracks/${resolved.trackId}`).get();
      assert.equal(trackSnap.exists, true);
    }],

    ["listCatalogContributionQueue is moderator-only and returns pending entries", async () => {
      await submitCatalogContribution.run(
        requestFor(USER_UID, {
          payload: {
            title: "Queue Listing Song",
            artist: "Queue Listing Artist",
          },
        })
      );
      await expectHttpsError(
        () => listCatalogContributionQueue.run(requestFor(USER_UID, { status: "pending", limit: 20 })),
        "permission-denied"
      );
      const result = await listCatalogContributionQueue.run(
        requestFor(MOD_UID, { status: "pending", limit: 20 })
      );
      assert.equal(result.ok, true);
      assert.ok(Array.isArray(result.items));
      assert.equal(Number(result.count || 0) >= 1, true);
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

    ["submitDirectoryClaimRequest creates pending claim", async () => {
      await db.doc("venues/venue_claim_test").set({
        title: "Claimable Venue",
        status: "approved",
        visibility: "public",
      });
      const result = await submitDirectoryClaimRequest.run(
        requestFor(USER_UID, {
          listingType: "venue",
          listingId: "venue_claim_test",
          role: "owner",
          evidence: "Business license on file.",
        })
      );
      assert.equal(result.ok, true);
      const snap = await db.doc(`directory_claim_requests/${result.claimId}`).get();
      assert.equal(snap.exists, true);
      assert.equal(snap.get("status"), "pending");
    }],

    ["resolveDirectoryClaimRequest approves ownership for moderators only", async () => {
      await db.doc("venues/venue_claim_test").set({
        title: "Claimable Venue",
        status: "approved",
        visibility: "public",
      });
      const claim = await submitDirectoryClaimRequest.run(
        requestFor(USER_UID, {
          listingType: "venue",
          listingId: "venue_claim_test",
          role: "owner",
          evidence: "I run this venue.",
        })
      );
      await expectHttpsError(
        () => resolveDirectoryClaimRequest.run(
          requestFor(USER_UID, { claimId: claim.claimId, action: "approve", notes: "nope" })
        ),
        "permission-denied"
      );
      const resolved = await resolveDirectoryClaimRequest.run(
        requestFor(MOD_UID, { claimId: claim.claimId, action: "approve", notes: "verified" })
      );
      assert.equal(resolved.ok, true);
      assert.equal(resolved.status, "approved");
      const venueSnap = await db.doc("venues/venue_claim_test").get();
      assert.equal(venueSnap.exists, true);
      assert.equal(venueSnap.get("ownerUid"), USER_UID);
    }],

    ["setDirectoryRsvp create update cancel lifecycle", async () => {
      const created = await setDirectoryRsvp.run(
        requestFor(USER_UID, {
          targetType: "event",
          targetId: "event_demo",
          status: "going",
          reminderChannels: ["email"],
        })
      );
      assert.equal(created.ok, true);
      const updated = await setDirectoryRsvp.run(
        requestFor(USER_UID, {
          targetType: "event",
          targetId: "event_demo",
          status: "interested",
          reminderChannels: ["email", "sms"],
        })
      );
      assert.equal(updated.ok, true);
      assert.equal(updated.status, "interested");
      const canceled = await setDirectoryRsvp.run(
        requestFor(USER_UID, {
          targetType: "event",
          targetId: "event_demo",
          status: "cancelled",
        })
      );
      assert.equal(canceled.ok, true);
      assert.equal(canceled.removed, true);
    }],

    ["setDirectoryReminderPreferences stores email and sms opts", async () => {
      const result = await setDirectoryReminderPreferences.run(
        requestFor(USER_UID, {
          targetType: "event",
          targetId: "event_demo",
          emailOptIn: true,
          smsOptIn: true,
          phone: "+1 (206) 555-0101",
        })
      );
      assert.equal(result.ok, true);
      const snap = await db.doc(`directory_reminders/${USER_UID}_event_event_demo`).get();
      assert.equal(snap.exists, true);
      assert.equal(!!snap.get("emailOptIn"), true);
      assert.equal(!!snap.get("smsOptIn"), true);
    }],

    ["listDirectoryGeoLanding returns public listings only", async () => {
      const now = Date.now() + 3600000;
      await db.doc("venues/geo_venue").set({
        title: "Geo Venue",
        status: "approved",
        visibility: "public",
        region: "wa_seattle",
        city: "Seattle",
        state: "WA",
      });
      await db.doc("karaoke_events/geo_event").set({
        title: "Geo Event",
        status: "approved",
        region: "wa_seattle",
        city: "Seattle",
        state: "WA",
        startsAtMs: now,
      });
      await db.doc("room_sessions/geo_session_public").set({
        title: "Geo Session Public",
        status: "approved",
        visibility: "public",
        region: "wa_seattle",
        startsAtMs: now,
      });
      await db.doc("room_sessions/geo_session_private").set({
        title: "Geo Session Private",
        status: "approved",
        visibility: "private",
        region: "wa_seattle",
        startsAtMs: now,
      });
      const result = await listDirectoryGeoLanding.run(
        requestFor("", {
          regionToken: "wa_seattle",
          dateWindow: "14d",
        })
      );
      assert.equal(result.ok, true);
      assert.equal(Number(result.counts?.venues || 0), 1);
      assert.equal(Number(result.counts?.events || 0), 1);
      assert.equal(Number(result.counts?.sessions || 0), 1);
    }],

    ["previewDirectoryRoomSessionByCode resolves approved room session", async () => {
      await db.doc("room_sessions/session_by_code").set({
        title: "Invite-only Room",
        status: "approved",
        visibility: "private",
        roomCode: "VIP123",
      });
      const result = await previewDirectoryRoomSessionByCode.run(
        requestFor("", { roomCode: "vip123" })
      );
      assert.equal(result.ok, true);
      assert.equal(result.roomCode, "VIP123");
      assert.equal(result.session?.id, "session_by_code");
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
