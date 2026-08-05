const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
process.env.MARKETING_SMS_REMINDERS_ENABLED = process.env.MARKETING_SMS_REMINDERS_ENABLED || "true";
process.env.MARKETING_PRIVATE_INVITE_CODE = process.env.MARKETING_PRIVATE_INVITE_CODE || "TEST123";
process.env.PUBLIC_VIBE_INDEX_ROLL_MODE = "canary";
process.env.PUBLIC_VIBE_INDEX_CANARY_TARGETS = "venue:venue_demo";
const {
  ensureSong,
  ensureTrack,
  resolveCanonicalTrackIdentity,
  resolveCanonicalTrackIdentityBatch,
  upsertDirectoryProfile,
  submitDirectoryListing,
  listModerationQueue,
  resolveModerationItem,
  followDirectoryEntity,
  unfollowDirectoryEntity,
  createDirectoryCheckin,
  submitDirectoryReview,
  previewPublicVibeEvidenceBackfill,
  refreshPublicVibeIndexes,
  rollbackPublicVibeIndexJob,
  runExternalDirectoryIngestion,
  submitDirectoryClaimRequest,
  resolveDirectoryClaimRequest,
  submitMarketingWaitlist,
  setDirectoryRsvp,
  setDirectoryReminderPreferences,
  listDirectoryGeoLanding,
  listDirectoryDiscover,
  searchHostVenueAutocomplete,
  redeemMarketingPrivateHostAccess,
  setHostApprovalStatus,
  listHostApplications,
  resolveHostApplication,
  getMyHostAccessStatus,
  getMyDirectoryAccess,
  upsertHostRoomDiscoveryListing,
  setHostNightOccurrenceStatus,
  removeHostRoomDiscoveryListing,
  submitCatalogContribution,
  listCatalogContributionQueue,
  resolveCatalogContribution,
  previewDirectoryRoomSessionByCode,
  logPerformance,
  moderatePublicChartResult,
  previewPublicChartLaunch,
} = require("../../functions/index.js");
const {
  buildPublicVibeActorKey,
  buildPublicVibeSourceKey,
} = require("../../functions/lib/publicVibeEvidenceLedger.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const MOD_UID = "directory-mod";
const ADMIN_UID = "directory-admin";
const USER_UID = "directory-user";
const OTHER_UID = "directory-other";
const HOST_UID = "directory-host";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;
const db = admin.firestore();

const requestFor = (uid, data = {}, options = {}) => ({
  auth: uid ? {
    uid,
    token: {
      email: options.email || `${uid}@test.local`,
      firebase: { sign_in_provider: options.authProvider || "password" },
    },
  } : null,
  app: options.appCheck ? { appId: options.appId || "directory-test-app" } : null,
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
    "night_series",
    "night_occurrences",
    "follows",
    "checkins",
    "checkin_totals",
    "reviews",
    "review_totals",
    "directory_sync_jobs",
    "public_vibe_index_jobs",
    "public_vibe_evidence",
    "external_source_links",
    "directory_claim_requests",
    "directory_rsvps",
    "directory_reminders",
    "directory_geo_pages",
    "catalog_contributions",
    "songs",
    "tracks",
    "track_source_keys",
    "performances",
    "song_hall_of_fame",
    "song_hall_of_fame_weeks",
    "public_chart_members",
    "public_chart_songs",
    "public_chart_nights",
    "public_chart_moderation_events",
    "users",
    "marketing_private_access",
    "marketing_private_invites",
    "host_access_approvals",
    "host_access_approval_invites",
    "host_access_applications",
    "security_rate_limits",
  ];
  for (const name of collections) {
    const snap = await db.collection(name).limit(500).get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
  for (const rootCollection of ["rooms", "room_users"]) {
    const rootSnap = await db.collection("artifacts").doc("bross-app").collection("public").doc("data").collection(rootCollection).limit(500).get();
    if (!rootSnap.empty) {
      const batch = db.batch();
      rootSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }
  }
  await db.doc(`directory_roles/${MOD_UID}`).set({
    roles: ["directory_editor"],
  });
  await db.doc(`directory_roles/${ADMIN_UID}`).set({
    roles: ["directory_admin"],
  });
  await db.doc(`users/${USER_UID}`).set({
    uid: USER_UID,
    name: "Directory User",
    subscription: { tier: "free" },
  }, { merge: true });
  await db.doc(`users/${HOST_UID}`).set({
    uid: HOST_UID,
    name: "Directory Host",
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
    ["redeemMarketingPrivateHostAccess is disabled for approval-only onboarding", async () => {
      await expectHttpsError(
        () => redeemMarketingPrivateHostAccess.run(
          requestFor(USER_UID, { code: "TEST123", source: "integration_test" })
        ),
        "permission-denied"
      );
    }],

    ["setHostApprovalStatus denies non-admin moderator", async () => {
      await expectHttpsError(
        () => setHostApprovalStatus.run(
          requestFor(MOD_UID, { target: "invitee@beaurocks.app", enabled: true })
        ),
        "permission-denied"
      );
    }],

    ["getMyDirectoryAccess returns moderator/admin flags", async () => {
      const modAccess = await getMyDirectoryAccess.run(requestFor(MOD_UID));
      assert.equal(modAccess.ok, true);
      assert.equal(modAccess.isModerator, true);
      assert.equal(modAccess.isAdmin, false);

      const adminAccess = await getMyDirectoryAccess.run(requestFor(ADMIN_UID));
      assert.equal(adminAccess.ok, true);
      assert.equal(adminAccess.isModerator, true);
      assert.equal(adminAccess.isAdmin, true);
    }],

    ["previewPublicChartLaunch blocks reachable unapproved recent hosts and reports orphaned owners", async () => {
      await expectHttpsError(
        () => previewPublicChartLaunch.run(requestFor(MOD_UID)),
        "permission-denied"
      );
      const auth = admin.auth();
      const originalGetUser = auth.getUser;
      auth.getUser = async (uid) => ({
        uid,
        email: uid + "@test.local",
        emailVerified: true,
      });
      await db.doc("artifacts/bross-app/public/data/rooms/PREF1").set({
        hostUid: OTHER_UID,
        hostUids: [OTHER_UID],
        archivedStatus: "active",
        publicRoom: true,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      const blocked = await previewPublicChartLaunch.run(requestFor(ADMIN_UID));
      assert.equal(blocked.canLaunch, false);
      assert.equal(blocked.gateScope, "rooms_with_activity_in_last_30_days");
      assert.equal(blocked.activeRoomCount, 1);
      assert.deepEqual(blocked.unapprovedHostUids, [OTHER_UID]);

      await db.doc(`host_access_approvals/${OTHER_UID}`).set({
        uid: OTHER_UID,
        hostApprovalEnabled: true,
      });
      const ready = await previewPublicChartLaunch.run(requestFor(ADMIN_UID));
      assert.equal(ready.canLaunch, true);
      assert.equal(ready.chartEra, "launch_v1");
      assert.equal(ready.publicRoomCount, 1);
      assert.equal(ready.unapprovedHostCount, 0);

      await db.collection("host_access_approvals").doc(OTHER_UID).delete();
      auth.getUser = async () => {
        const error = new Error("User not found");
        error.code = "auth/user-not-found";
        throw error;
      };
      const orphaned = await previewPublicChartLaunch.run(requestFor(ADMIN_UID));
      assert.equal(orphaned.canLaunch, true);
      assert.equal(orphaned.orphanedHostCount, 1);
      assert.deepEqual(orphaned.orphanedHostUids, [OTHER_UID]);
      auth.getUser = originalGetUser;
    }],

    ["setHostApprovalStatus email grant writes host approval invite only", async () => {
      const inviteEmail = "invitee@beaurocks.app";
      const grant = await setHostApprovalStatus.run(
        requestFor(ADMIN_UID, {
          target: inviteEmail,
          enabled: true,
          notes: "integration invite",
        })
      );
      assert.equal(grant.ok, true);
      assert.equal(grant.hostApprovalEnabled, true);
      const inviteSnap = await db.doc("host_access_approval_invites/wl_invitee_beaurocks_app").get();
      assert.equal(inviteSnap.exists, true);
      assert.equal(!!inviteSnap.get("hostApprovalEnabled"), true);
      const accessSnap = await db.doc(`host_access_approvals/${USER_UID}`).get();
      assert.equal(accessSnap.exists, false);
    }],

    ["getMyHostAccessStatus reports false for free user and true for granted uid", async () => {
      const initial = await getMyHostAccessStatus.run(requestFor(USER_UID));
      assert.equal(initial.ok, true);
      assert.equal(initial.hasHostWorkspaceAccess, false);
      assert.equal(initial.entitledHostAccess, false);
      assert.equal(initial.hostApprovalEnabled, false);

      const grant = await setHostApprovalStatus.run(
        requestFor(ADMIN_UID, {
          target: USER_UID,
          enabled: true,
          notes: "uid grant for integration",
        })
      );
      assert.equal(grant.ok, true);
      assert.equal(grant.mode, "uid_grant");

      const afterGrant = await getMyHostAccessStatus.run(requestFor(USER_UID));
      assert.equal(afterGrant.ok, true);
      assert.equal(afterGrant.hasHostWorkspaceAccess, true);
      assert.equal(afterGrant.hostApprovalEnabled, true);
    }],

    ["host application queue can be listed and approved by admin", async () => {
      await submitMarketingWaitlist.run(
        requestFor(USER_UID, {
          name: "Queue Host",
          email: "queue-host@beaurocks.app",
          useCase: "host_application",
          source: "integration_test",
        })
      );

      const listed = await listHostApplications.run(
        requestFor(ADMIN_UID, { status: "pending" })
      );
      assert.equal(listed.ok, true);
      assert.equal(Array.isArray(listed.items), true);
      assert.equal(listed.items.length, 1);

      const applicationId = listed.items[0].applicationId;
      const resolved = await resolveHostApplication.run(
        requestFor(ADMIN_UID, {
          applicationId,
          action: "approve",
          notes: "approved in test",
        })
      );
      assert.equal(resolved.ok, true);
      assert.equal(resolved.notification.status, "queued");
      assert.equal(resolved.notification.recipient, "queue-host@beaurocks.app");
      const appSnap = await db.doc(`host_access_applications/${applicationId}`).get();
      assert.equal(String(appSnap.get("status")), "approved");
      assert.equal(String(appSnap.get("decisionEmail.status")), "queued");
      const approvalSnap = await db.doc(`host_access_approvals/${USER_UID}`).get();
      assert.equal(approvalSnap.exists, true);
      assert.equal(!!approvalSnap.get("hostApprovalEnabled"), true);

      const outboundSnap = await db.collection("outboundMessages")
        .where("eventType", "==", "host_application_applicant_approved")
        .get();
      assert.equal(outboundSnap.empty, false);
      const approvalMessage = outboundSnap.docs.find((docSnap) => docSnap.get("meta.applicationId") === applicationId);
      assert.ok(approvalMessage);
      const approvalText = String(approvalMessage.get("text") || "");
      assert.match(approvalText, /costs \$0/i);
      assert.match(approvalText, /No card is required/i);
      assert.match(approvalText, /will not charge you automatically/i);
      assert.match(approvalText, /hub\?tab=getting_started/i);
      assert.match(approvalText, /hub\?tab=help/i);

      const resent = await resolveHostApplication.run(
        requestFor(ADMIN_UID, { applicationId, action: "resend_invite" })
      );
      assert.equal(resent.ok, true);
      assert.equal(resent.status, "approved");
      assert.equal(resent.notification.status, "queued");

      const hostAccess = await getMyHostAccessStatus.run(requestFor(USER_UID));
      assert.equal(hostAccess.accessTerms.mode, "complimentary_testing");
      assert.equal(hostAccess.accessTerms.priceLabel, "$0 during testing");
      assert.equal(hostAccess.accessTerms.cardRequired, false);
      assert.equal(hostAccess.accessTerms.automaticCharges, false);
      assert.equal(hostAccess.subscriptionCheckoutEnabled, false);
    }],

    ["upsertHostRoomDiscoveryListing creates public room_session listing", async () => {
      await db.doc("artifacts/bross-app/public/data/rooms/DEMO1").set({
        hostUid: USER_UID,
        hostUids: [USER_UID],
        hostName: "Demo Host",
        hostNightPreset: "competition",
        showScoring: true,
        queueSettings: { rotation: "round_robin", firstTimeBoost: true },
        audienceJoinPolicy: { accessMode: "passcode_required" },
      }, { merge: true });
      const result = await upsertHostRoomDiscoveryListing.run(
        requestFor(USER_UID, {
          roomCode: "DEMO1",
          listing: {
            publicRoom: true,
            title: "House Karaoke Friday",
            city: "Seattle",
            state: "WA",
            venueId: "venue_demo_house",
            venueName: "Demo House",
            recurringRule: "weekly",
            startsAtMs: Date.now() + 3600000,
            location: { lat: 47.6062, lng: -122.3321 },
          },
        })
      );
      assert.equal(result.ok, true);
      assert.equal(result.isPublicRoom, true);
      const sessionSnap = await db.doc(`room_sessions/${result.listingId}`).get();
      assert.equal(sessionSnap.exists, true);
      assert.equal(String(sessionSnap.get("roomCode")), "DEMO1");
      assert.equal(String(sessionSnap.get("visibility")), "public");
      assert.equal(String(sessionSnap.get("status")), "approved");
      assert.equal(String(sessionSnap.get("recurringRule")), "weekly");
      assert.match(String(sessionSnap.get("nightSeriesId")), /^night_[a-f0-9]{20}$/);
      assert.match(String(sessionSnap.get("occurrenceId")), /^occ_[a-f0-9]{18}_[0-9]{8}$/);
      assert.equal(Number(sessionSnap.get("nextOccurrenceAtMs")) > Date.now(), true);
      assert.equal(String(sessionSnap.get("identityLinks.venueId")), "venue_demo_house");
      assert.equal(String(sessionSnap.get("joinAccessMode")), "passcode_required");
      assert.equal(sessionSnap.get("requiresGuestPasscode"), true);
      assert.equal(String(sessionSnap.get("experienceProfile.intensity")), "competitive");
      assert.equal(sessionSnap.get("experienceProfile.mechanics.firstTimerBoost"), true);
      const seriesId = String(sessionSnap.get("nightSeriesId"));
      const seriesSnap = await db.doc(`night_series/${seriesId}`).get();
      assert.equal(seriesSnap.exists, true);
      assert.equal(seriesSnap.get("active"), true);
      assert.equal(String(seriesSnap.get("sourceListingId")), result.listingId);
      const occurrencesSnap = await db.collection("night_occurrences")
        .where("seriesId", "==", seriesId)
        .get();
      assert.equal(occurrencesSnap.size >= 12, true);
      const originalOccurrenceId = String(sessionSnap.get("occurrenceId"));
      await expectHttpsError(
        () => setHostNightOccurrenceStatus.run(
          requestFor(OTHER_UID, {
            roomCode: "DEMO1",
            occurrenceId: originalOccurrenceId,
            action: "cancel",
          })
        ),
        "permission-denied"
      );
      const cancelled = await setHostNightOccurrenceStatus.run(
        requestFor(USER_UID, {
          roomCode: "DEMO1",
          occurrenceId: originalOccurrenceId,
          action: "cancel",
        })
      );
      assert.equal(cancelled.ok, true);
      assert.notEqual(String(cancelled.nextOccurrence?.occurrenceId || ""), originalOccurrenceId);
      const cancelledSnap = await db.doc(`night_occurrences/${originalOccurrenceId}`).get();
      assert.equal(String(cancelledSnap.get("status")), "cancelled");
      const shiftedSessionSnap = await db.doc(`room_sessions/${result.listingId}`).get();
      assert.notEqual(String(shiftedSessionSnap.get("occurrenceId")), originalOccurrenceId);
      const reinstated = await setHostNightOccurrenceStatus.run(
        requestFor(USER_UID, {
          roomCode: "DEMO1",
          occurrenceId: originalOccurrenceId,
          action: "reinstate",
        })
      );
      assert.equal(reinstated.ok, true);
      assert.equal(String(reinstated.nextOccurrence?.occurrenceId || ""), originalOccurrenceId);
      const discoverResult = await listDirectoryDiscover.run(
        requestFor("", { search: "house karaoke friday", listingType: "room_session", limit: 20 })
      );
      assert.equal(
        discoverResult.items.some((item) => item.id === result.listingId && item.sourceType === "host_room"),
        true
      );
      await db.doc(`public_chart_nights/${result.listingId}`).set({
        listingId: result.listingId,
        rankScore: 500,
      });
      const privateResult = await removeHostRoomDiscoveryListing.run(
        requestFor(USER_UID, { roomCode: "DEMO1" })
      );
      assert.equal(privateResult.ok, true);
      assert.equal(privateResult.visibility, "private");
      const privateSessionSnap = await db.doc(`room_sessions/${result.listingId}`).get();
      assert.equal(privateSessionSnap.exists, true);
      assert.equal(String(privateSessionSnap.get("visibility")), "private");
      assert.equal((await db.doc(`public_chart_nights/${result.listingId}`).get()).exists, false);
      const hiddenDiscoverResult = await listDirectoryDiscover.run(
        requestFor("", { search: "house karaoke friday", listingType: "room_session", limit: 20 })
      );
      assert.equal(hiddenDiscoverResult.items.some((item) => item.id === result.listingId), false);
      const privatePreview = await previewDirectoryRoomSessionByCode.run(
        requestFor("", { roomCode: "DEMO1" })
      );
      assert.equal(privatePreview.ok, true);
      assert.equal(String(privatePreview.session.visibility), "private");
      const privateSeriesSnap = await db.doc(`night_series/${seriesId}`).get();
      assert.equal(privateSeriesSnap.get("active"), true);
      assert.equal(String(privateSeriesSnap.get("visibility")), "private");
      await db.doc("artifacts/bross-app/public/data/rooms/DEMO2").set({
        hostUid: USER_UID,
        hostUids: [USER_UID],
        hostName: "Demo Host",
      });
      const noCoordinates = await upsertHostRoomDiscoveryListing.run(
        requestFor(USER_UID, {
          roomCode: "DEMO2",
          listing: { publicRoom: true, title: "No Coordinates Yet" },
        })
      );
      const noCoordinatesSnap = await db.doc("room_sessions/" + noCoordinates.listingId).get();
      assert.equal(noCoordinatesSnap.get("location"), null);
    }],

    ["upsertDirectoryProfile ignores client role escalation attempts", async () => {
      const result = await upsertDirectoryProfile.run(
        requestFor(USER_UID, { profile: { displayName: "Neon Host", roles: ["host"] } })
      );
      assert.equal(result.ok, true);
      const snap = await db.doc(`directory_profiles/${USER_UID}`).get();
      assert.equal(snap.exists, true);
      assert.deepEqual(snap.get("roles"), ["fan"]);
    }],

    ["upsertDirectoryProfile writes profile for caller", async () => {
      const result = await upsertDirectoryProfile.run(
        requestFor(USER_UID, {
          profile: {
            displayName: "Neon Host",
            chartName: "Neon Voice",
            chartVisibility: "anonymous",
            roles: ["host"],
          },
        })
      );
      assert.equal(result.ok, true);
      const snap = await db.doc(`directory_profiles/${USER_UID}`).get();
      assert.equal(snap.exists, true);
      assert.equal(snap.get("displayName"), "Neon Host");
      assert.equal(snap.get("chartName"), "Neon Voice");
      assert.equal(snap.get("chartVisibility"), "anonymous");
      assert.deepEqual(snap.get("roles"), ["fan"]);
      const userSnap = await db.doc(`users/${USER_UID}`).get();
      assert.equal(userSnap.get("leaderboardProfile.displayName"), "Neon Voice");
      assert.equal(userSnap.get("leaderboardProfile.visibility"), "anonymous");
    }],

    ["upsertDirectoryProfile preserves existing server-assigned roles", async () => {
      await db.doc(`directory_profiles/${USER_UID}`).set({
        uid: USER_UID,
        displayName: "Neon Host",
        roles: ["host"],
        status: "approved",
      }, { merge: true });
      const result = await upsertDirectoryProfile.run(
        requestFor(USER_UID, { profile: { displayName: "Neon Host", roles: ["fan"] } })
      );
      assert.equal(result.ok, true);
      const snap = await db.doc(`directory_profiles/${USER_UID}`).get();
      assert.deepEqual(snap.get("roles"), ["host"]);
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

    ["resolveCanonicalTrackIdentity reuses persisted youtube mappings", async () => {
      await db.doc(`directory_profiles/${USER_UID}`).set({
        uid: USER_UID,
        displayName: "Host User",
        roles: ["host"],
        status: "approved",
      });
      const song = await ensureSong.run(
        requestFor(USER_UID, { title: "Don't Stop Believin'", artist: "Journey" })
      );
      const track = await ensureTrack.run(
        requestFor(USER_UID, {
          songId: song.songId,
          source: "youtube",
          mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          label: "YouTube Karaoke",
        })
      );
      assert.ok(track.trackId);

      const resolved = await resolveCanonicalTrackIdentity.run(
        requestFor(USER_UID, {
          title: "Journey - Don't Stop Believin' (Karaoke Version)",
          artist: "Sing King Karaoke",
          source: "youtube",
          mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        })
      );
      assert.equal(resolved.found, true);
      assert.equal(resolved.songId, song.songId);
      assert.equal(resolved.trackId, track.trackId);
    }],

    ["resolveCanonicalTrackIdentityBatch resolves youtube mappings in one request", async () => {
      await db.doc(`directory_profiles/${USER_UID}`).set({
        uid: USER_UID,
        displayName: "Host User",
        roles: ["host"],
        status: "approved",
      });
      const song = await ensureSong.run(
        requestFor(USER_UID, { title: "Africa", artist: "Toto" })
      );
      const track = await ensureTrack.run(
        requestFor(USER_UID, {
          songId: song.songId,
          source: "youtube",
          mediaUrl: "https://www.youtube.com/watch?v=PWgvGjAhvIw",
          label: "YouTube Karaoke",
        })
      );

      const result = await resolveCanonicalTrackIdentityBatch.run(
        requestFor(USER_UID, {
          items: [
            {
              title: "Toto - Africa (Karaoke Version)",
              artist: "Sing King Karaoke",
              source: "youtube",
              mediaUrl: "https://www.youtube.com/watch?v=PWgvGjAhvIw",
            },
          ],
        })
      );
      assert.equal(Array.isArray(result.items), true);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].songId, song.songId);
      assert.equal(result.items[0].trackId, track.trackId);
    }],
    ["canonical song resolution follows aliases and merge redirects", async () => {
      await db.doc(`directory_profiles/${USER_UID}`).set({ uid: USER_UID, roles: ["host"], status: "approved" });
      const canonical = await ensureSong.run(requestFor(USER_UID, {
        title: "Don't Stop Believin'", artist: "Journey", aliases: ["Dont Stop Believing"],
      }));
      const aliasResult = await resolveCanonicalTrackIdentity.run(requestFor(USER_UID, {
        title: "Dont Stop Believing", artist: "Journey",
      }));
      assert.equal(aliasResult.songId, canonical.songId);
      assert.match(aliasResult.matchedBy, /alias$/);
      const duplicate = await ensureSong.run(requestFor(USER_UID, {
        title: "Don't Stop Believin' Remastered", artist: "Journey",
      }));
      await db.doc(`songs/${duplicate.songId}`).set({
        mergedIntoSongId: canonical.songId, mergeReason: "same_composition_remaster",
      }, { merge: true });
      const redirected = await resolveCanonicalTrackIdentity.run(requestFor(USER_UID, { songId: duplicate.songId }));
      assert.equal(redirected.songId, canonical.songId);
      assert.match(redirected.matchedBy, /redirect$/);
      const conflict = await ensureSong.run(requestFor(USER_UID, {
        title: "Different Song", artist: "Journey", aliases: ["Dont Stop Believing"],
      }));
      const aliasAfterConflict = await resolveCanonicalTrackIdentity.run(requestFor(USER_UID, {
        title: "Dont Stop Believing", artist: "Journey",
      }));
      assert.equal(aliasAfterConflict.songId, canonical.songId);
      const conflictSnap = await db.doc(`songs/${conflict.songId}`).get();
      assert.equal(
        (conflictSnap.get("aliasConflicts") || []).some((value) => String(value).includes(canonical.songId)),
        true,
      );
    }],

    ["logPerformance collapses youtube-backed scores onto canonical song ids", async () => {
      await db.doc(`directory_profiles/${USER_UID}`).set({
        uid: USER_UID,
        displayName: "Host User",
        roles: ["host"],
        status: "approved",
      });
      await db.doc(`host_access_approvals/${USER_UID}`).set({
        uid: USER_UID,
        hostApprovalEnabled: true,
      });
      const song = await ensureSong.run(
        requestFor(USER_UID, { title: "Don't Stop Believin'", artist: "Journey" })
      );
      const track = await ensureTrack.run(
        requestFor(USER_UID, {
          songId: song.songId,
          source: "youtube",
          mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          label: "YouTube Karaoke",
        })
      );
      const performanceId = "performance_roomx_1";
      await db.doc(`directory_profiles/${USER_UID}`).set({
        uid: USER_UID,
        displayName: "Beau",
        chartName: "Beau On The Mic",
        chartVisibility: "public",
        visibility: "public",
        status: "approved",
      }, { merge: true });
      await db.doc("room_sessions/room_roomx").set({
        roomCode: "ROOMX",
        title: "Friday Spotlight",
        venueName: "Demo House",
        hostName: "Host User",
        city: "Seattle",
        state: "WA",
        status: "approved",
        visibility: "public",
      });
      await db.doc(`artifacts/bross-app/public/data/rooms/ROOMX`).set({
        hostUid: USER_UID,
        hostUids: [USER_UID],
        discover: {
          listingId: "room_roomx",
          publicRoom: true,
          visibility: "public",
        },
        lastPerformance: {
          id: performanceId,
          songTitle: "Journey - Don't Stop Believin' (Karaoke Version)",
          artist: "Sing King Karaoke",
          singerName: "Beau",
          singerUid: USER_UID,
          applauseScore: 88,
          hypeScore: 22,
          hostBonus: 10,
        },
      });
      await db.doc(`artifacts/bross-app/public/data/room_users/ROOMX_${USER_UID}`).set({
        roomCode: "ROOMX",
        uid: USER_UID,
        name: "Beau",
        leaderboardAccountEligible: true,
      });
      await db.doc(`users/${USER_UID}`).set({
        uid: USER_UID,
        name: "Beau",
        leaderboardAccountEligible: true,
        leaderboardProfile: {
          displayName: "Beau On The Mic",
          visibility: "public",
        },
      }, { merge: true });
      const result = await logPerformance.run(
        requestFor(USER_UID, {
          roomCode: "ROOMX",
          performanceId,
          songTitle: "Journey - Don't Stop Believin' (Karaoke Version)",
          artist: "Sing King Karaoke",
          singerName: "Beau",
          mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          trackSource: "youtube",
          canonicalSongId: song.songId,
          backingCandidateId: `${song.songId}__youtube__dQw4w9WgXcQ`,
          providerTrackId: "dQw4w9WgXcQ",
          applauseScore: 88,
          hypeScore: 22,
          hostBonus: 10,
        })
      );
      assert.equal(result.songId, song.songId);
      assert.equal(result.canonicalSongId, song.songId);
      assert.equal(result.trackId, track.trackId);
      assert.equal(result.globalLeaderboardEligible, true);
      assert.equal(result.leaderboardEligibility, "qualified_member");
      assert.equal(result.duplicate, false);
      assert.equal(result.fameAward.status, "awarded");
      assert.equal(result.fameAward.awarded, 86);

      const retryResult = await logPerformance.run(
        requestFor(USER_UID, {
          roomCode: "ROOMX",
          performanceId,
          songTitle: "Journey - Don't Stop Believin' (Karaoke Version)",
          artist: "Sing King Karaoke",
          singerName: "Beau",
          mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          trackSource: "youtube",
          canonicalSongId: song.songId,
          backingCandidateId: `${song.songId}__youtube__dQw4w9WgXcQ`,
          providerTrackId: "dQw4w9WgXcQ",
          applauseScore: 88,
          hypeScore: 22,
          hostBonus: 10,
        })
      );
      assert.equal(retryResult.duplicate, true);
      assert.equal(retryResult.totalScore, 120);
      assert.equal(retryResult.fameAward.duplicate, true);
      assert.equal(retryResult.fameAward.awarded, 86);
      assert.equal((await db.doc(`users/${USER_UID}`).get()).get("totalFamePoints"), 86);

      const performanceSnap = await db.collection("performances").where("canonicalSongId", "==", song.songId).get();
      assert.equal(performanceSnap.size, 1);
      assert.equal(performanceSnap.docs[0].get("backingCandidateId"), `${song.songId}__youtube__dQw4w9WgXcQ`);
      assert.equal(performanceSnap.docs[0].get("providerTrackId"), "dQw4w9WgXcQ");
      assert.equal(performanceSnap.docs[0].get("projectionVersion"), 1);
      assert.equal(performanceSnap.docs[0].get("fameAwardVersion"), 1);
      assert.equal(performanceSnap.docs[0].get("fameAwarded"), 86);

      const hallOfFameSnap = await db.doc(`song_hall_of_fame/${song.songId}`).get();
      assert.equal(hallOfFameSnap.exists, true);
      assert.equal(hallOfFameSnap.get("canonicalSongId"), song.songId);
      assert.equal(hallOfFameSnap.get("songTitle"), "Don't Stop Believin'");
      assert.equal(hallOfFameSnap.get("artist"), "Journey");
      assert.equal(hallOfFameSnap.get("globalLeaderboardEligible"), true);
      assert.equal(hallOfFameSnap.get("singerUid"), undefined);

      const memberChartsSnap = await db.collection("public_chart_members").get();
      assert.equal(memberChartsSnap.size, 1);
      assert.equal(memberChartsSnap.docs[0].get("displayName"), "Beau On The Mic");
      assert.equal(memberChartsSnap.docs[0].get("performanceCount"), 1);
      assert.equal(memberChartsSnap.docs[0].get("rankScore"), 120);
      assert.equal(memberChartsSnap.docs[0].get("profileUid"), undefined);
      const publicSongSnap = await db.doc(`public_chart_songs/${song.songId}`).get();
      assert.equal(publicSongSnap.exists, true);
      assert.equal(publicSongSnap.get("canonicalSongId"), song.songId);
      assert.equal(publicSongSnap.get("displayName"), "Beau On The Mic");
      assert.equal(publicSongSnap.get("resultId"), performanceSnap.docs[0].id);
      assert.equal(publicSongSnap.get("profileUid"), undefined);
      assert.equal(publicSongSnap.get("schemaVersion"), 2);
      const publicSongLeaders = publicSongSnap.get("leaders");
      assert.equal(publicSongLeaders.length, 1);
      assert.equal(publicSongLeaders[0].resultId, performanceSnap.docs[0].id);
      assert.equal(publicSongLeaders[0].displayName, "Beau On The Mic");
      assert.equal(publicSongLeaders[0].score, 120);
      assert.equal(publicSongLeaders[0].memberKey, memberChartsSnap.docs[0].id);
      assert.equal(publicSongLeaders[0].singerUid, undefined);
      assert.equal(publicSongLeaders[0].roomCode, undefined);
      const publicNightSnap = await db.doc("public_chart_nights/room_roomx").get();
      assert.equal(publicNightSnap.exists, true);
      assert.equal(publicNightSnap.get("title"), "Friday Spotlight");
      assert.equal(publicNightSnap.get("performanceCount"), 1);
      assert.equal(publicNightSnap.get("rankScore"), 120);
      assert.equal(publicNightSnap.get("topProfileUid"), undefined);

      await assert.rejects(
        () => moderatePublicChartResult.run(requestFor(USER_UID, {
          resultId: performanceSnap.docs[0].id,
          apply: true,
        })),
        (error) => error?.code === "permission-denied"
      );
      const repairPreview = await moderatePublicChartResult.run(requestFor(ADMIN_UID, {
        resultId: performanceSnap.docs[0].id,
        reason: "integration_preview",
      }));
      assert.equal(repairPreview.dryRun, true);
      assert.equal(repairPreview.affectedSongId, song.songId);
      assert.equal((await db.doc(`public_chart_songs/${song.songId}`).get()).exists, true);

      const repairResult = await moderatePublicChartResult.run(requestFor(ADMIN_UID, {
        resultId: performanceSnap.docs[0].id,
        reason: "integration_removal",
        apply: true,
      }));
      assert.equal(repairResult.applied, true);
      assert.equal(repairResult.remainingMemberPerformances, 0);
      assert.equal((await db.collection("public_chart_members").get()).empty, true);
      assert.equal((await db.doc(`public_chart_songs/${song.songId}`).get()).exists, false);
      assert.equal((await db.doc("public_chart_nights/room_roomx").get()).exists, false);
      assert.equal((await db.doc(`song_hall_of_fame/${song.songId}`).get()).exists, false);
      assert.equal((await db.doc(`performances/${performanceSnap.docs[0].id}`).get()).get("publicChartStatus"), "removed");
      assert.equal((await db.collection("public_chart_moderation_events").get()).size, 1);
    }],

    ["logPerformance keeps guests in room history without entering global charts", async () => {
      await db.doc(`host_access_approvals/${HOST_UID}`).set({
        uid: HOST_UID,
        hostApprovalEnabled: true,
      });
      const performanceId = "performance_guest_1";
      await db.doc(`artifacts/bross-app/public/data/rooms/GUEST1`).set({
        hostUid: HOST_UID,
        hostUids: [HOST_UID],
        lastPerformance: {
          id: performanceId,
          songTitle: "Dreams",
          artist: "Fleetwood Mac",
          singerName: "Room Guest",
          singerUid: OTHER_UID,
          applauseScore: 40,
          hypeScore: 20,
          hostBonus: 5,
        },
      });
      await db.doc(`artifacts/bross-app/public/data/room_users/GUEST1_${OTHER_UID}`).set({
        roomCode: "GUEST1",
        uid: OTHER_UID,
        name: "Room Guest",
        leaderboardAccountEligible: false,
      });
      await db.doc(`users/${OTHER_UID}`).set({
        uid: OTHER_UID,
        name: "Room Guest",
        leaderboardAccountEligible: false,
      });

      const result = await logPerformance.run(requestFor(HOST_UID, {
        roomCode: "GUEST1",
        performanceId,
        songTitle: "Dreams",
        artist: "Fleetwood Mac",
        singerName: "Room Guest",
        singerUid: OTHER_UID,
        applauseScore: 40,
        hypeScore: 20,
        hostBonus: 5,
      }));

      assert.equal(result.globalLeaderboardEligible, false);
      assert.equal(result.leaderboardEligibility, "room_only_guest");
      assert.equal(result.fameAward.status, "account_required");
      assert.equal(result.fameAward.awarded, 0);
      assert.equal((await db.doc(`users/${OTHER_UID}`).get()).get("totalFamePoints"), undefined);
      const performanceSnap = await db.collection("performances").where("performanceId", "==", performanceId).get();
      assert.equal(performanceSnap.size, 1);
      assert.equal(performanceSnap.docs[0].get("globalLeaderboardEligible"), false);
      assert.equal(performanceSnap.docs[0].get("fameAwardStatus"), "account_required");
      const hallSnap = await db.collection("song_hall_of_fame").limit(1).get();
      assert.equal(hallSnap.empty, true);
      assert.equal((await db.collection("public_chart_members").get()).empty, true);
      assert.equal((await db.collection("public_chart_songs").get()).empty, true);
      assert.equal((await db.collection("public_chart_nights").get()).empty, true);
    }],

    ["logPerformance rejects an approved host who does not own the room", async () => {
      await db.doc(`host_access_approvals/${USER_UID}`).set({
        uid: USER_UID,
        hostApprovalEnabled: true,
      });
      await db.doc(`artifacts/bross-app/public/data/rooms/LOCKED1`).set({
        hostUid: HOST_UID,
        hostUids: [HOST_UID],
        lastPerformance: {
          id: "performance_locked_1",
          songTitle: "Dreams",
          artist: "Fleetwood Mac",
          singerName: "Singer",
          applauseScore: 40,
        },
      });

      await assert.rejects(
        () => logPerformance.run(requestFor(USER_UID, {
          roomCode: "LOCKED1",
          performanceId: "performance_locked_1",
          songTitle: "Dreams",
          artist: "Fleetwood Mac",
        })),
        (error) => String(error?.code || "").includes("permission-denied"),
      );
      const performanceSnap = await db.collection("performances").limit(1).get();
      assert.equal(performanceSnap.empty, true);
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
            region: "nationwide",
          },
        })
      );
      assert.equal(result.ok, true);
      const snap = await db.doc(`directory_submissions/${result.submissionId}`).get();
      assert.equal(snap.exists, true);
      assert.equal(snap.get("status"), "pending");
      assert.equal(snap.get("payload.region"), "wa_seattle");
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
            endsAtMs: Date.now() + (5 * 3600000),
            timezone: "America/Los_Angeles",
            recurringRule: "Every Friday",
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
      assert.equal(String(canonical.get("recurringRule")), "weekly");
      const seriesId = String(canonical.get("nightSeriesId") || "");
      assert.match(seriesId, /^night_[a-f0-9]{20}$/);
      const seriesSnap = await db.doc(`night_series/${seriesId}`).get();
      assert.equal(seriesSnap.exists, true);
      assert.equal(String(seriesSnap.get("sourceCollection")), "karaoke_events");
      const occurrencesSnap = await db.collection("night_occurrences")
        .where("seriesId", "==", seriesId)
        .get();
      assert.equal(occurrencesSnap.size >= 12, true);
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
      assert.equal((await db.collection("public_vibe_evidence").get()).empty, true);
    }],

    ["qualified check-ins create one server evidence record and reject replay, anonymous, and owner boosts", async () => {
      await db.doc("venues/venue_demo").set({
        title: "Evidence Venue",
        status: "approved",
        visibility: "public",
        ownerUid: HOST_UID,
      });
      await db.doc("room_sessions/evidence_session").set({
        title: "Evidence Night",
        status: "approved",
        visibility: "public",
        roomCode: "VIBE1",
        venueId: "venue_demo",
        hostUid: HOST_UID,
        hostUids: [HOST_UID],
        ownerUid: HOST_UID,
        startsAtMs: Date.now() - (60 * 60 * 1000),
        endsAtMs: Date.now() + (3 * 60 * 60 * 1000),
      });
      await db.doc(`artifacts/bross-app/public/data/room_users/VIBE1_${USER_UID}`).set({ roomCode: "VIBE1", uid: USER_UID });
      await db.doc(`artifacts/bross-app/public/data/room_users/VIBE1_${OTHER_UID}`).set({ roomCode: "VIBE1", uid: OTHER_UID });
      await db.doc(`artifacts/bross-app/public/data/room_users/VIBE1_${HOST_UID}`).set({ roomCode: "VIBE1", uid: HOST_UID });

      const payload = {
        targetType: "venue",
        targetId: "venue_demo",
        roomSessionId: "evidence_session",
        isPublic: false,
      };
      await createDirectoryCheckin.run(requestFor(USER_UID, payload));
      await createDirectoryCheckin.run(requestFor(USER_UID, payload));
      await createDirectoryCheckin.run(requestFor(OTHER_UID, payload, { authProvider: "anonymous" }));
      await createDirectoryCheckin.run(requestFor(HOST_UID, payload));

      const evidenceSnap = await db.collection("public_vibe_evidence").get();
      assert.equal(evidenceSnap.size, 1);
      const evidence = evidenceSnap.docs[0].data() || {};
      assert.equal(evidence.evidenceType, "authenticated_checkin");
      assert.equal(evidence.targetType, "venue");
      assert.equal(evidence.targetId, "venue_demo");
      assert.equal(evidence.sessionId, "evidence_session");
      assert.match(evidence.actorKey, /^actor_[a-f0-9]{40}$/);
      assert.notEqual(evidence.actorKey, USER_UID);
      assert.equal(Object.hasOwn(evidence, "actorUid"), false);
      assert.match(evidence.sourceKey, /^source_[a-f0-9]{40}$/);
      assert.equal(Object.hasOwn(evidence, "sourceId"), false);
      assert.equal(evidence.authenticated, true);
      assert.equal(evidence.expiresAt?.toMillis?.() > Date.now(), true);
      assert.equal(evidence.serverVerified, true);
      assert.equal(evidence.scoreVersion, "vibe_v2");
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

    ["verified reviews write evidence only for an authenticated room member and real session", async () => {
      await db.doc("venues/venue_demo").set({
        title: "Evidence Venue",
        status: "approved",
        visibility: "public",
        ownerUid: HOST_UID,
      });
      await db.doc("room_sessions/review_session").set({
        title: "Review Night",
        status: "approved",
        visibility: "public",
        roomCode: "VIBE2",
        venueId: "venue_demo",
        hostUid: HOST_UID,
        ownerUid: HOST_UID,
        startsAtMs: Date.now() - (2 * 60 * 60 * 1000),
        endsAtMs: Date.now() - (60 * 60 * 1000),
      });
      await db.doc(`artifacts/bross-app/public/data/room_users/VIBE2_${USER_UID}`).set({ roomCode: "VIBE2", uid: USER_UID });

      const payload = {
        targetType: "venue",
        targetId: "venue_demo",
        roomSessionId: "review_session",
        eventId: "review_session",
        rating: 5,
        tags: ["friendly"],
      };
      await submitDirectoryReview.run(requestFor(USER_UID, payload));
      await submitDirectoryReview.run(requestFor(USER_UID, { ...payload, rating: 4 }));
      await submitDirectoryReview.run(requestFor(USER_UID, {
        ...payload,
        roomSessionId: "forged_session",
        eventId: "forged_session",
      }));

      const evidenceSnap = await db.collection("public_vibe_evidence").get();
      assert.equal(evidenceSnap.size, 1);
      const evidence = evidenceSnap.docs[0].data() || {};
      assert.equal(evidence.evidenceType, "verified_review");
      assert.match(evidence.actorKey, /^actor_[a-f0-9]{40}$/);
      assert.notEqual(evidence.actorKey, USER_UID);
      assert.equal(Object.hasOwn(evidence, "actorUid"), false);
      assert.match(evidence.sourceKey, /^source_[a-f0-9]{40}$/);
      assert.equal(Object.hasOwn(evidence, "sourceId"), false);
      assert.equal(evidence.authenticated, true);
      assert.equal(evidence.expiresAt?.toMillis?.() > Date.now(), true);
      assert.equal(evidence.sessionId, "review_session");
      assert.equal(evidence.verificationMethod, "authenticated_room_member_review");
    }],

    ["previewPublicVibeEvidenceBackfill is admin-only, aggregate-only, bounded, and read-only", async () => {
      const nowMs = Date.now();
      await db.doc("venues/venue_preview").set({
        title: "Protected Preview Venue",
        status: "approved",
        visibility: "public",
        ownerUid: HOST_UID,
      });
      const records = [
        { type: "room_recap", sessionId: "preview_night_1", daysAgo: 3 },
        { type: "room_recap", sessionId: "preview_night_2", daysAgo: 1 },
        ...["preview_guest_1", "preview_guest_2", "preview_guest_3"].map((actorUid) => ({
          type: "authenticated_checkin",
          sessionId: "preview_night_1",
          actorUid,
          daysAgo: 3,
        })),
        ...["preview_guest_4", "preview_guest_5"].map((actorUid) => ({
          type: "authenticated_checkin",
          sessionId: "preview_night_2",
          actorUid,
          daysAgo: 1,
        })),
      ];
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        const occurredAtMs = nowMs - (record.daysAgo * 24 * 60 * 60 * 1000);
        await db.doc(`public_vibe_evidence/preview_evidence_${index}`).set({
          evidenceType: record.type,
          targetType: "venue",
          targetId: "venue_preview",
          sessionId: record.sessionId,
          actorKey: record.actorUid ? buildPublicVibeActorKey(record.actorUid) : null,
          sourceCollection: "protected_preview_fixture",
          sourceKey: buildPublicVibeSourceKey("protected_preview_fixture", `source_${index}`),
          occurredAtMs,
          occurredAt: admin.firestore.Timestamp.fromMillis(occurredAtMs),
          verifiedAtMs: occurredAtMs,
          expiresAtMs: nowMs + (60 * 24 * 60 * 60 * 1000),
          expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + (60 * 24 * 60 * 60 * 1000)),
          status: "active",
          serverVerified: true,
          authenticated: record.type !== "room_recap",
        });
      }
      const beforeEvidenceIds = (await db.collection("public_vibe_evidence").get()).docs.map((doc) => doc.id).sort();
      const beforeJobs = await db.collection("public_vibe_index_jobs").get();

      await expectHttpsError(
        () => previewPublicVibeEvidenceBackfill.run(requestFor("", {}, { appCheck: true })),
        "unauthenticated"
      );
      await expectHttpsError(
        () => previewPublicVibeEvidenceBackfill.run(requestFor(ADMIN_UID, {})),
        "failed-precondition"
      );
      await expectHttpsError(
        () => previewPublicVibeEvidenceBackfill.run(requestFor(MOD_UID, {}, { appCheck: true })),
        "permission-denied"
      );
      const preview = await previewPublicVibeEvidenceBackfill.run(
        requestFor(ADMIN_UID, { targetTypes: ["venue"], limit: 25 }, { appCheck: true })
      );

      assert.equal(preview.ok, true);
      assert.equal(preview.dryRun, true);
      assert.equal(preview.scoreVersion, "vibe_v2");
      assert.equal(preview.sampleLimit, 25);
      assert.equal(preview.targetCount, 1);
      assert.equal(preview.eligibleTargetCount, 1);
      assert.equal(preview.qualifiedEvidenceCount, 7);
      assert.equal(preview.writesAttempted, 0);
      assert.equal(preview.writesPerformed, 0);
      assert.deepEqual(preview.selectedTargetTypes, ["venue"]);
      assert.equal(preview.privacy.identifiersReturned, false);
      assert.equal(preview.privacy.individualEvidenceReturned, false);
      const serialized = JSON.stringify(preview);
      assert.equal(serialized.includes("venue_preview"), false);
      assert.equal(serialized.includes("preview_guest"), false);
      assert.equal(serialized.includes("preview_night"), false);
      assert.equal(serialized.includes("source_"), false);
      const afterEvidenceIds = (await db.collection("public_vibe_evidence").get()).docs.map((doc) => doc.id).sort();
      const afterJobs = await db.collection("public_vibe_index_jobs").get();
      assert.deepEqual(afterEvidenceIds, beforeEvidenceIds);
      assert.equal(beforeJobs.size, afterJobs.size);
    }],

    ["refreshPublicVibeIndexes previews, writes, and remains idempotent", async () => {
      await db.doc("venues/venue_demo").set({
        title: "Vibe Rollup Venue",
        status: "approved",
        visibility: "public",
        city: "Seattle",
        state: "WA",
        karaokeNightsLabel: "Every Friday",
        experienceTags: ["friendly", "high_energy"],
      }, { merge: true });
      await db.doc("review_totals/venue_venue_demo").set({
        targetType: "venue",
        targetId: "venue_demo",
        reviewCount: 2,
        ratingSum: 10,
      }, { merge: true });
      await db.doc("checkin_totals/venue_venue_demo").set({
        targetType: "venue",
        targetId: "venue_demo",
        totalCount: 3,
        publicCount: 2,
      }, { merge: true });

      const preview = await refreshPublicVibeIndexes.run(
        requestFor(MOD_UID, { targetType: "venue", targetId: "venue_demo", dryRun: true, limit: 50 })
      );
      assert.equal(preview.ok, true);
      assert.equal(preview.dryRun, true);
      assert.equal(preview.published, 1);
      assert.equal(preview.changed, 1);
      assert.equal(preview.written, 0);
      assert.equal((await db.doc("venues/venue_demo").get()).get("publicVibeIndex"), undefined);

      await expectHttpsError(
        () => refreshPublicVibeIndexes.run(
          requestFor(MOD_UID, { targetType: "venue", targetId: "venue_demo", dryRun: false, limit: 50 }, { appCheck: true })
        ),
        "permission-denied"
      );
      await expectHttpsError(
        () => refreshPublicVibeIndexes.run(
          requestFor(ADMIN_UID, { targetType: "venue", targetId: "venue_demo", dryRun: false, limit: 50 })
        ),
        "failed-precondition"
      );
      const applied = await refreshPublicVibeIndexes.run(
        requestFor(ADMIN_UID, { targetType: "venue", targetId: "venue_demo", dryRun: false, limit: 50 }, { appCheck: true })
      );
      assert.equal(applied.written, 1);
      assert.equal(!!applied.jobId, true);
      const venueSnap = await db.doc("venues/venue_demo").get();
      assert.equal(venueSnap.get("publicVibeIndex.status"), "published");
      assert.equal(venueSnap.get("publicVibeIndex.scoreVersion"), "vibe_v1");
      assert.equal(Number(venueSnap.get("publicVibeIndex.score") || 0) > 0, true);
      assert.equal(venueSnap.get("publicVibeIndex.reviewCount"), undefined);
      const jobSnap = await db.doc(`public_vibe_index_jobs/${applied.jobId}`).get();
      assert.equal(jobSnap.get("status"), "completed");
      assert.equal(jobSnap.get("actorUid"), ADMIN_UID);
      const changeSnap = await db.collection(`public_vibe_index_jobs/${applied.jobId}/changes`).limit(5).get();
      assert.equal(changeSnap.size, 1);

      const repeated = await refreshPublicVibeIndexes.run(
        requestFor(ADMIN_UID, { targetType: "venue", targetId: "venue_demo", dryRun: false, limit: 50 }, { appCheck: true })
      );
      assert.equal(repeated.changed, 0);
      assert.equal(repeated.written, 0);

      const rolledBack = await rollbackPublicVibeIndexJob.run(
        requestFor(ADMIN_UID, { jobId: applied.jobId }, { appCheck: true })
      );
      assert.equal(rolledBack.restored, 1);
      assert.equal((await db.doc("venues/venue_demo").get()).get("publicVibeIndex"), undefined);
      const rollbackJobSnap = await db.doc(`public_vibe_index_jobs/${applied.jobId}`).get();
      assert.equal(rollbackJobSnap.get("status"), "rolled_back");
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

    ["submitDirectoryClaimRequest rejects missing and non-public targets", async () => {
      await expectHttpsError(
        () => submitDirectoryClaimRequest.run(
          requestFor(USER_UID, {
            listingType: "venue",
            listingId: "venue_claim_missing",
            role: "owner",
            evidence: "This target does not exist.",
          })
        ),
        "not-found"
      );
      await db.doc("venues/venue_claim_private").set({
        title: "Private Venue",
        status: "approved",
        visibility: "private",
      });
      await expectHttpsError(
        () => submitDirectoryClaimRequest.run(
          requestFor(USER_UID, {
            listingType: "venue",
            listingId: "venue_claim_private",
            role: "owner",
            evidence: "This target is private.",
          })
        ),
        "not-found"
      );
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
        ownerUid: USER_UID,
      });
      await db.doc("venues/geo_venue_private").set({
        title: "Private Geo Venue",
        status: "approved",
        visibility: "private",
        region: "wa_seattle",
      });
      await db.doc("karaoke_events/geo_event").set({
        title: "Geo Event",
        status: "approved",
        region: "wa_seattle",
        city: "Seattle",
        state: "WA",
        startsAtMs: now,
      });
      await db.doc("karaoke_events/geo_event_private").set({
        title: "Private Geo Event",
        status: "approved",
        visibility: "private",
        region: "wa_seattle",
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
      assert.equal(
        [...result.venues, ...result.events, ...result.sessions]
          .every((item) => !("ownerUid" in item) && !("identityLinks" in item)),
        true
      );
    }],

    ["previewDirectoryRoomSessionByCode resolves approved room session", async () => {
      await db.doc("room_sessions/session_by_code").set({
        title: "Invite-only Room",
        status: "approved",
        visibility: "private",
        roomCode: "VIP123",
        latestRecapAtMs: 1710000000000,
        latestRecapUrl: "https://app.beaurocks.app/recaps/VIP123",
        hostRecapCount: 2,
      });
      const result = await previewDirectoryRoomSessionByCode.run(
        requestFor("", { roomCode: "vip123" })
      );
      assert.equal(result.ok, true);
      assert.equal(result.roomCode, "VIP123");
      assert.equal(result.session?.id, "session_by_code");
      assert.equal(result.session?.latestRecapAtMs, 1710000000000);
      assert.equal(result.session?.latestRecapUrl, "https://app.beaurocks.app/recaps/VIP123");
      assert.equal(result.session?.hostRecapCount, 2);
    }],

    ["searchHostVenueAutocomplete returns approved public venue matches for hosts", async () => {
      await db.doc("venues/venue_neon_house").set({
        title: "Neon Karaoke House",
        status: "approved",
        visibility: "public",
        city: "Seattle",
        state: "WA",
        address1: "101 Pine St",
        location: { lat: 47.6062, lng: -122.3321 },
      });
      await db.doc("venues/venue_private_hide").set({
        title: "Neon Hidden Lounge",
        status: "approved",
        visibility: "private",
        city: "Seattle",
        state: "WA",
      });

      const result = await searchHostVenueAutocomplete.run(
        requestFor(HOST_UID, {
          query: "neon",
          limit: 5,
        })
      );

      assert.equal(result.ok, true);
      assert.equal(Array.isArray(result.items), true);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].venueId, "venue_neon_house");
      assert.equal(result.items[0].title, "Neon Karaoke House");
      assert.equal(result.items[0].city, "Seattle");
      assert.equal(result.items[0].state, "WA");
    }],

    ["listDirectoryDiscover paginates and filters by search", async () => {
      await db.doc("directory_profiles/discover_host_1").set({
        displayName: "DJ Neon",
        roles: ["host"],
        profilePictureUrl: "https://cdn.example.com/discover-host.png",
        photoUrl: "https://cdn.example.com/discover-host-photo.png",
        heroImageUrl: "https://cdn.example.com/discover-host-hero.png",
        imageUrls: [
          "https://cdn.example.com/discover-host-hero.png",
          "https://cdn.example.com/discover-host-gallery.png",
        ],
      });
      await db.doc("venues/discover_venue_1").set({
        title: "Neon Karaoke House",
        status: "approved",
        visibility: "public",
        ownerUid: USER_UID,
        city: "Seattle",
        state: "WA",
        region: "wa_seattle",
      });
      await db.doc("karaoke_events/discover_event_1").set({
        title: "Friday Neon Party",
        status: "approved",
        visibility: "public",
        city: "Seattle",
        state: "WA",
        region: "wa_seattle",
        hostUid: "discover_host_1",
        startsAtMs: Date.now() + 3600000,
      });
      await db.doc("room_sessions/discover_session_1").set({
        title: "Neon Session",
        status: "approved",
        visibility: "public",
        city: "Seattle",
        state: "WA",
        region: "wa_seattle",
        hostUid: "discover_host_1",
        roomCode: "NEON1",
      });
      const first = await listDirectoryDiscover.run(
        requestFor("", {
          search: "neon",
          region: "wa_seattle",
          limit: 2,
        })
      );
      assert.equal(first.ok, true);
      assert.equal(Array.isArray(first.items), true);
      assert.equal(first.items.length, 2);
      assert.equal(Number(first.total || 0) >= 3, true);
      assert.equal(!!String(first.nextCursor || "").trim(), true);
      assert.equal(
        first.items.some((item) => String(item.hostUid || "") === "discover_host_1" && String(item.avatarUrl || "").includes("discover-host.png")),
        true
      );
      assert.equal(
        first.items.some((item) =>
          String(item.hostUid || "") === "discover_host_1"
          && [
            item.hostProfileImageUrl,
            item.hostHeroImageUrl,
            item.hostPhotoUrl,
            ...(Array.isArray(item.hostImageUrls) ? item.hostImageUrls : []),
          ].some((value) => String(value || "").includes("discover-host"))
        ),
        true
      );
      assert.equal(
        first.items.every((item) => item.publicVibeIndex?.scoreVersion === "vibe_v1"),
        true
      );
      assert.equal(
        first.items.every((item) => !("hostTotalSongs" in item) && !("hostTotalUsers" in item)),
        true
      );
      assert.equal(
        first.items.every((item) => !("ownerUid" in item) && !("identityLinks" in item)),
        true
      );
      assert.equal(first.items.every((item) => item.canManage === false), true);


      const second = await listDirectoryDiscover.run(
        requestFor("", {
          search: "neon",
          region: "wa_seattle",
          limit: 2,
          cursor: first.nextCursor,
        })
      );
      assert.equal(second.ok, true);
      assert.equal(Array.isArray(second.items), true);
      assert.equal(second.items.length >= 1, true);

      const ownerView = await listDirectoryDiscover.run(
        requestFor(USER_UID, {
          search: "Neon Karaoke House",
          region: "wa_seattle",
          limit: 10,
        })
      );
      const ownedVenue = ownerView.items.find((item) => item.id === "discover_venue_1");
      assert.equal(ownedVenue?.canManage, true);
      assert.equal("ownerUid" in ownedVenue, false);
    }],

    ["listDirectoryDiscover hides ended and cancelled nights but supports explicit archive lookup", async () => {
      const nowMs = Date.now();
      await db.doc("karaoke_events/discover_ended_event").set({
        title: "Archive Lifecycle Sentinel",
        status: "approved",
        visibility: "public",
        startsAtMs: nowMs - 7_200_000,
        endsAtMs: nowMs - 3_600_000,
      });
      await db.doc("karaoke_events/discover_cancelled_event").set({
        title: "Cancelled Lifecycle Sentinel",
        status: "approved",
        visibility: "public",
        occurrenceStatus: "cancelled",
        startsAtMs: nowMs + 3_600_000,
        endsAtMs: nowMs + 7_200_000,
      });
      const defaultResult = await listDirectoryDiscover.run(
        requestFor("", {
          search: "Lifecycle Sentinel",
          listingType: "event",
          limit: 20,
        })
      );
      assert.equal(defaultResult.items.length, 0);

      const archiveResult = await listDirectoryDiscover.run(
        requestFor("", {
          search: "Archive Lifecycle Sentinel",
          listingType: "event",
          includeEnded: true,
          limit: 20,
        })
      );
      assert.equal(archiveResult.items.some((item) => item.id === "discover_ended_event"), true);
      assert.equal(archiveResult.items.some((item) => item.id === "discover_cancelled_event"), false);
    }],

    ["listDirectoryDiscover collapses duplicate AAHF event into the official listing", async () => {
      await db.doc("karaoke_events/aahf_duplicate_event").set({
        title: "AAHF Karaoke Kick-Off",
        description: "Duplicate seeded event that should collapse into the official registry entry.",
        status: "approved",
        visibility: "public",
        city: "Bainbridge Island",
        state: "WA",
        region: "wa_kitsap",
        venueName: "Bainbridge Island Museum of Art",
        address1: "550 Winslow Way E",
        startsAtMs: new Date("2026-05-01T19:00:00-07:00").getTime(),
        endsAtMs: new Date("2026-05-02T00:00:00-07:00").getTime(),
      });

      const result = await listDirectoryDiscover.run(
        requestFor("", {
          search: "aahf",
          region: "wa_kitsap",
          listingType: "event",
          includeEnded: true,
          limit: 20,
        })
      );

      assert.equal(result.ok, true);
      const aahfItems = (Array.isArray(result.items) ? result.items : [])
        .filter((item) => String(item.title || "").toLowerCase().includes("aahf"));
      assert.equal(aahfItems.length, 1);
      assert.equal(aahfItems[0].id, "official_aahf_karaoke_kickoff_2026");
      assert.equal(aahfItems[0].listingType, "room_session");
      assert.equal(aahfItems[0].roomCode, "AAHF");
      assert.equal(aahfItems[0].startsAtMs, new Date("2026-05-01T19:00:00-07:00").getTime());
      assert.equal(aahfItems[0].endsAtMs, new Date("2026-05-02T00:00:00-07:00").getTime());
      assert.equal(aahfItems[0].imageUrl, "/images/marketing/CLEAN%201.png");
      assert.equal(aahfItems[0].officialBadgeImageUrl, "/images/marketing/karaoke-kickoff-logo-simple.png");
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
