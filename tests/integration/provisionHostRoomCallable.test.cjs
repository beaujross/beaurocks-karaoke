const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { provisionHostRoom } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const HOST_UID = "host-provisioner";
const CO_HOST_UID = "host-sidekick";

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
  await deleteCollection(["night_series"]);
  await deleteCollection(["night_occurrences"]);
  await deleteCollection(["organizations"]);
  await deleteCollection(["users"]);
  await deleteCollection(["room_event_credit_configs"]);
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
  await db.doc(`users/${CO_HOST_UID}`).set({
    uid: CO_HOST_UID,
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

async function seedHostSubscription(status = "active", planId = "host_monthly") {
  const orgId = "org_" + HOST_UID;
  await Promise.all([
    db.doc(`host_access_approvals/${HOST_UID}`).delete(),
    db.doc(`marketing_private_access/${HOST_UID}`).delete(),
  ]);
  await db.doc(`organizations/${orgId}`).set({
    orgId,
    ownerUid: HOST_UID,
    name: "Paid Host Workspace",
    status: "active",
  }, { merge: true });
  await db.doc(`organizations/${orgId}/subscription/current`).set({
    orgId,
    planId,
    status,
    provider: "stripe",
    cancelAtPeriodEnd: false,
  }, { merge: true });
  await db.doc(`organizations/${orgId}/entitlements/current`).delete();
  return orgId;
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
    ["unpaid account cannot create a Room without an approval override", async () => {
      await seedHostSubscription("inactive", "free");
      await assert.rejects(
        () => provisionHostRoom.run(
          requestFor(HOST_UID, {
            requestId: "unpaid_free",
            hostName: "Free Account",
          })
        ),
        (error) => {
          assert.equal(error.code, "permission-denied");
          assert.equal(error.details?.reason, "active_host_plan_required");
          assert.equal(error.details?.capability, "rooms.create");
          return true;
        }
      );
    }],

    ["active paid Host plan creates a Room without an approval override", async () => {
      await seedHostSubscription("active");
      const result = await provisionHostRoom.run(
        requestFor(HOST_UID, {
          requestId: "paid_active",
          hostName: "Paid Host",
        })
      );
      assert.equal(result.ok, true);
      assert.equal(result.created, true);
    }],

    ["trialing Host plan cannot create a Room before payment", async () => {
      await seedHostSubscription("trialing");
      await assert.rejects(
        () => provisionHostRoom.run(
          requestFor(HOST_UID, {
            requestId: "paid_trialing",
            hostName: "Trial Host",
          })
        ),
        (error) => {
          assert.equal(error.code, "permission-denied");
          assert.equal(error.details?.reason, "payment_required");
          assert.equal(error.details?.capability, "rooms.create");
          return true;
        }
      );
    }],

    ["past-due Host plan cannot create another Room", async () => {
      await seedHostSubscription("past_due");
      await assert.rejects(
        () => provisionHostRoom.run(
          requestFor(HOST_UID, {
            requestId: "paid_past_due",
            hostName: "Past Due Host",
          })
        ),
        (error) => {
          assert.equal(error.code, "permission-denied");
          assert.equal(error.details?.reason, "subscription_past_due");
          assert.match(String(error.message || ""), /past due/i);
          return true;
        }
      );
    }],

    ["canceled Host plan cannot create another Room", async () => {
      await seedHostSubscription("canceled");
      await assert.rejects(
        () => provisionHostRoom.run(
          requestFor(HOST_UID, {
            requestId: "paid_canceled",
            hostName: "Canceled Host",
          })
        ),
        (error) => {
          assert.equal(error.code, "permission-denied");
          assert.equal(error.details?.reason, "active_host_plan_required");
          return true;
        }
      );
    }],

    ["provisionHostRoom creates room + host library + idempotency record", async () => {
      const result = await provisionHostRoom.run(
        requestFor(HOST_UID, {
          requestId: "launch_a",
          hostName: "Neon Host",
          orgName: "Neon Org",
          logoUrl: "https://example.com/logo.png",
          roomName: "Neon Friday",
          coHostUids: [CO_HOST_UID],
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
      assert.equal(roomSnap.get("roomName"), "Neon Friday");
      assert.deepEqual(roomSnap.get("coHostUids"), [CO_HOST_UID]);
      assert.deepEqual(roomSnap.get("hostUids"), [HOST_UID, CO_HOST_UID]);

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
          roomName: "Friday House Karaoke",
          coHostUids: [CO_HOST_UID],
          discoveryListing: {
            publicRoom: true,
            title: "Friday House Karaoke",
            venueId: "venue_house",
            venueSource: "selected",
            recurringRule: "weekly",
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
      assert.equal(String(listingSnap.get("venueId")), "venue_house");
      assert.deepEqual(listingSnap.get("hostUids"), [HOST_UID, CO_HOST_UID]);
      assert.equal(String(listingSnap.get("recurringRule")), "weekly");
      assert.match(String(listingSnap.get("nightSeriesId")), /^night_[a-f0-9]{20}$/);
      assert.match(String(listingSnap.get("occurrenceId")), /^occ_[a-f0-9]{18}_[0-9]{8}$/);
      assert.equal(String(listingSnap.get("identityLinks.venueId")), "venue_house");

      const seriesId = String(listingSnap.get("nightSeriesId"));
      const seriesSnap = await db.doc(`night_series/${seriesId}`).get();
      assert.equal(seriesSnap.exists, true);
      assert.equal(seriesSnap.get("active"), true);
      const occurrencesSnap = await db.collection("night_occurrences")
        .where("seriesId", "==", seriesId)
        .get();
      assert.equal(occurrencesSnap.size >= 12, true);

      const roomSnap = await db.doc(`${ROOT}/rooms/${result.roomCode}`).get();
      assert.equal(roomSnap.exists, true);
      assert.equal(String(roomSnap.get("discover.listingId")), listingId);
      assert.equal(!!roomSnap.get("discover.publicRoom"), true);
      assert.equal(String(roomSnap.get("discover.occurrenceId")), String(listingSnap.get("occurrenceId")));
      assert.equal(String(roomSnap.get("roomName")), "Friday House Karaoke");
    }],

    ["provisionHostRoom applies preset branding overrides for festival rooms", async () => {
      const result = await provisionHostRoom.run(
        requestFor(HOST_UID, {
          requestId: "launch_aahf_branding",
          hostName: "Festival Host",
          roomName: "AAHF Kick-Off",
          logoUrl: "https://example.com/host-default-logo.png",
          nightPresetId: "aahf",
          nightPresetPayload: {
            id: "aahf",
            recipe: {
              flowRule: "balanced",
              assistLevel: "smart_assist",
              spotlightMode: "karaoke",
              performanceMode: "karaoke",
              party: {
                autoCrowdMomentsEnabled: true,
                autoCrowdMomentEverySongs: 3,
                autoCrowdMomentPreferredTypes: ["trivia", "would_you_rather"],
              },
            },
            settings: {
              audienceShellVariant: "streamlined",
            },
            audienceBrandTheme: {
              appTitle: "AAHF Festival",
              primaryColor: "#E05A44",
              secondaryColor: "#F4C94A",
              accentColor: "#8F2D2A",
            },
            brandingLogoUrl: "/images/marketing/aahf-combined-badge-clean.png",
            brandingOrbSkinUrl: "/images/marketing/aahf-combined-badge-clean.png",
          },
        })
      );

      assert.equal(result.ok, true);
      const roomSnap = await db.doc(`${ROOT}/rooms/${result.roomCode}`).get();
      assert.equal(roomSnap.exists, true);
      assert.equal(roomSnap.get("hostNightPreset"), "aahf");
      assert.equal(roomSnap.get("logoUrl"), "/images/marketing/aahf-combined-badge-clean.png");
      assert.equal(roomSnap.get("lobbyOrbSkinUrl"), "/images/marketing/aahf-combined-badge-clean.png");
      assert.equal(roomSnap.get("audienceShellVariant"), "streamlined");
      assert.equal(roomSnap.get("audienceBrandTheme.appTitle"), "AAHF Festival");
      assert.equal(roomSnap.get("missionControl.enabled"), true);
      assert.equal(roomSnap.get("missionControl.setupDraft.assistLevel"), "smart_assist");
      assert.equal(roomSnap.get("missionControl.party.autoCrowdMomentsEnabled"), true);
      assert.equal(roomSnap.get("missionControl.party.autoCrowdMomentEverySongs"), 3);
      assert.deepEqual(roomSnap.get("missionControl.party.autoCrowdMomentPreferredTypes"), ["trivia", "would_you_rather"]);
    }],

    ["provisionHostRoom stores public event credits and secure claim config", async () => {
      const result = await provisionHostRoom.run(
        requestFor(HOST_UID, {
          requestId: "launch_event_credits",
          hostName: "AAHF Host",
          roomName: "Kick-Off Room",
          eventCredits: {
            enabled: true,
            presetId: "aahf_kickoff",
            eventId: "aahf_kickoff",
            eventLabel: "AAHF Karaoke Kick-Off",
            sourceProvider: "givebutter",
            sourceCampaignCode: "AAHF2026",
            generalAdmissionPoints: 200,
            vipBonusPoints: 400,
            skipLineBonusPoints: 600,
            websiteCheckInPoints: 150,
            socialPromoPoints: 250,
            audienceAccessMode: "email_or_donation",
            creditEarningMode: "friendly",
            timedLobbyEnabled: true,
            timedLobbyPoints: 25,
            timedLobbyIntervalMin: 10,
            timedLobbyMaxPerGuest: 150,
            supportCelebrationStyle: "moneybags_burst",
            promoCampaigns: [
              {
                id: "website_check_in",
                label: "Website Check-In",
                type: "timed_drop",
                codeMode: "qr_link",
                code: "",
                pointsReward: 150,
                safePerk: "website_check_in",
                maxRedemptions: 5000,
                perUserLimit: 1,
                requiresRoomJoin: true,
                enabled: true,
              },
            ],
            claimCodes: {
              vip: "VIP2026",
              skipLine: "SKIP2026",
              websiteCheckIn: "CHECKIN2026",
              socialPromo: "POST2026",
            },
          },
        })
      );

      assert.equal(result.ok, true);
      const roomSnap = await db.doc(`${ROOT}/rooms/${result.roomCode}`).get();
      assert.equal(roomSnap.exists, true);
      assert.equal(roomSnap.get("eventCredits.enabled"), true);
      assert.equal(roomSnap.get("eventCredits.presetId"), "aahf_kickoff");
      assert.equal(roomSnap.get("eventCredits.sourceProvider"), "givebutter");
      assert.equal(roomSnap.get("eventCredits.sourceCampaignCode"), "AAHF2026");
      assert.equal(Number(roomSnap.get("eventCredits.generalAdmissionPoints")), 200);
      assert.equal(String(roomSnap.get("eventCredits.eventLabel")), "AAHF Karaoke Kick-Off");
      assert.equal(String(roomSnap.get("eventCredits.audienceAccessMode")), "email_or_donation");
      assert.equal(String(roomSnap.get("eventCredits.creditEarningMode")), "friendly");
      assert.equal(Number(roomSnap.get("eventCredits.timedLobbyPoints")), 25);
      assert.equal(String(roomSnap.get("eventCredits.supportCelebrationStyle")), "moneybags_burst");
      assert.equal(Number(roomSnap.get("eventCredits.promoCampaignCount")), 1);
      assert.equal(roomSnap.get("eventCredits.claimCodes"), undefined);

      const secureSnap = await db.doc(`room_event_credit_configs/${result.roomCode}`).get();
      assert.equal(secureSnap.exists, true);
      assert.equal(secureSnap.get("enabled"), true);
      assert.equal(secureSnap.get("presetId"), "aahf_kickoff");
      assert.equal(secureSnap.get("sourceProvider"), "givebutter");
      assert.equal(String(secureSnap.get("audienceAccessMode")), "email_or_donation");
      assert.equal(String(secureSnap.get("creditEarningMode")), "friendly");
      assert.equal(Number(secureSnap.get("timedLobbyMaxPerGuest")), 150);
      assert.equal(String(secureSnap.get("supportCelebrationStyle")), "moneybags_burst");
      assert.equal(String(secureSnap.get("claimCodes.vip")), "VIP2026");
      assert.equal(String(secureSnap.get("claimCodes.skipLine")), "SKIP2026");
      assert.equal(Array.isArray(secureSnap.get("promoCampaigns")), true);
      assert.equal(String(secureSnap.get("promoCampaigns")[0].id), "website_check_in");
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
