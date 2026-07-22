const fs = require("node:fs/promises");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const HOST_UID = "host-uid";
const GUEST_UID = "guest-uid";
const OTHER_UID = "other-uid";
const MOD_UID = "directory-mod";
const VENUE_ID = "venue_1";
const SESSION_ID = "session_1";
const REVIEW_ID = "review_1";
const BUCKET = `gs://${PROJECT_ID}.firebasestorage.app`;

let testEnv;

const roomPath = (roomCode = ROOM_CODE) => `${ROOT}/rooms/${roomCode}`;
const roomUserPath = (roomCode, uid) => `${ROOT}/room_users/${roomCode}_${uid}`;
const karaokeSongPath = (songId = "song_1") => `${ROOT}/karaoke_songs/${songId}`;
const nonAnonymousContext = (uid) => testEnv.authenticatedContext(uid, {
  firebase: { sign_in_provider: "password" },
});
const superAdminEmailContext = (uid, email = "hello@beaurocks.app") => testEnv.authenticatedContext(uid, {
  email,
  email_verified: true,
  firebase: { sign_in_provider: "password" },
});
const anonymousContext = (uid) => testEnv.authenticatedContext(uid, {
  firebase: { sign_in_provider: "anonymous" },
});

async function resetState() {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(roomPath()).set({
      hostUid: HOST_UID,
      hostUids: [HOST_UID],
      activeMode: "karaoke",
    });
    await db.doc(`venues/${VENUE_ID}`).set({
      title: "Approved Venue",
      status: "approved",
      visibility: "public",
      ownerUid: HOST_UID,
    });
    await db.doc(`room_sessions/${SESSION_ID}`).set({
      title: "Private Session",
      status: "approved",
      visibility: "private",
      ownerUid: HOST_UID,
    });
    await db.doc(`room_private_access/${ROOM_CODE}`).set({
      roomCode: ROOM_CODE,
      salt: "server-only-salt",
      hash: "server-only-hash",
    });
    await db.doc("night_series/night_rules_test").set({
      seriesId: "night_rules_test",
      roomCode: ROOM_CODE,
      active: true,
    });
    await db.doc("night_occurrences/occ_rules_test").set({
      occurrenceId: "occ_rules_test",
      seriesId: "night_rules_test",
      roomCode: ROOM_CODE,
      status: "scheduled",
    });
    await db.doc(`directory_profiles/${HOST_UID}`).set({
      uid: HOST_UID,
      displayName: "Host",
      status: "approved",
      visibility: "public",
    });
    await db.doc("performances/performance_rules_1").set({
      singerUid: GUEST_UID,
      singerName: "Guest",
      roomCode: ROOM_CODE,
      totalScore: 120,
    });
    await db.doc("public_chart_members/member_rules_1").set({
      memberKey: "member_rules_1",
      displayName: "Chart Singer",
      rankScore: 120,
    });
    await db.doc("public_chart_songs/song_rules_1").set({
      songId: "song_rules_1",
      songTitle: "Dreams",
      bestScore: 120,
    });
    await db.doc("public_chart_nights/night_rules_1").set({
      listingId: "night_rules_1",
      title: "Friday Night",
      rankScore: 120,
    });
    await db.doc("public_chart_moderation_events/mod_rules_1").set({
      resultId: "result_rules_1",
      action: "remove",
    });
  });
}

async function runCase(name, fn) {
  await resetState();
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
  const firestoreRules = await fs.readFile("firestore.rules", "utf8");
  const storageRules = await fs.readFile("storage.rules", "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });

  const checks = [
    ["firestore: public can read sanitized chart projections", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(db.doc("public_chart_members/member_rules_1").get());
      await assertSucceeds(db.doc("public_chart_songs/song_rules_1").get());
      await assertSucceeds(db.doc("public_chart_nights/night_rules_1").get());
      await assertFails(db.doc("public_chart_moderation_events/mod_rules_1").get());
    }],

    ["firestore: clients cannot write sanitized chart projections", async () => {
      const db = nonAnonymousContext(GUEST_UID).firestore();
      await assertFails(db.doc("public_chart_members/member_rules_1").set({ rankScore: 999 }));
      await assertFails(db.doc("public_chart_songs/song_rules_1").set({ bestScore: 999 }));
      await assertFails(db.doc("public_chart_nights/night_rules_1").set({ rankScore: 999 }));
      await assertFails(db.doc("public_chart_moderation_events/mod_rules_1").set({ action: "restore" }));
    }],

    ["firestore: singer can read own raw performance history", async () => {
      const db = nonAnonymousContext(GUEST_UID).firestore();
      await assertSucceeds(db.doc("performances/performance_rules_1").get());
    }],

    ["firestore: another user cannot read raw performance history", async () => {
      const db = nonAnonymousContext(OTHER_UID).firestore();
      await assertFails(db.doc("performances/performance_rules_1").get());
    }],

    ["firestore: unauthenticated clients cannot read raw performance history", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc("performances/performance_rules_1").get());
    }],

    ["firestore: unauthenticated cannot read user profile", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc(`users/${GUEST_UID}`).get());
    }],

    ["firestore: user can read own profile", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`users/${GUEST_UID}`).set({
          uid: GUEST_UID,
          name: "Guest",
          vipLevel: 0,
        });
      });
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(db.doc(`users/${GUEST_UID}`).get());
    }],

    ["firestore: user cannot read another user's profile", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`users/${HOST_UID}`).set({
          uid: HOST_UID,
          name: "Host",
          vipLevel: 1,
        });
      });
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(db.doc(`users/${HOST_UID}`).get());
    }],

    ["firestore: public can read canonical song lyrics", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("song_lyrics/test-song").set({
          songId: "test-song",
          lyrics: "line one\nline two",
        });
      });
      const db = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(db.doc("song_lyrics/test-song").get());
    }],

    ["firestore: clients cannot write canonical song lyrics", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertFails(
        db.doc("song_lyrics/test-song").set({
          songId: "test-song",
          lyrics: "forbidden write",
        })
      );
    }],

    ["firestore: user can write own profile", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`users/${GUEST_UID}`).set({
          name: "Guest",
          avatar: "😀",
        })
      );
    }],

    ["firestore: user cannot set own vipLevel directly", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`users/${GUEST_UID}`).set({
          name: "Guest",
          vipLevel: 1,
          isVip: true,
        })
      );
    }],

    ["firestore: user cannot set own fame fields directly", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`users/${GUEST_UID}`).set({
          name: "Guest",
          totalFamePoints: 9000,
          currentLevel: 12,
        })
      );
    }],

    ["firestore: user cannot write another user profile", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`users/${OTHER_UID}`).set({
          name: "Nope",
        })
      );
    }],

    ["firestore: host can update safe fields but cannot inject a public Vibe Index", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(
        db.doc(`directory_profiles/${HOST_UID}`).update({ bio: "Safe host profile edit" })
      );
      await assertFails(
        db.doc(`directory_profiles/${HOST_UID}`).update({
          publicVibeIndex: {
            scoreVersion: "vibe_v1",
            status: "published",
            score: 100,
            minimumThresholdMet: true,
          },
        })
      );
    }],

    ["firestore: profile owner cannot create server-managed Vibe fields", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`directory_profiles/${GUEST_UID}`).set({
          uid: GUEST_UID,
          displayName: "Guest",
          status: "approved",
          visibility: "public",
          publicVibeIndexRollupVersion: "rollup_v1",
        })
      );
    }],

    ["firestore: Vibe audit jobs are moderator-readable and never client-writable", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`directory_roles/${MOD_UID}`).set({ roles: ["directory_editor"] });
        await db.doc("public_vibe_index_jobs/job_rules_1").set({ status: "completed" });
        await db.doc("public_vibe_index_jobs/job_rules_1/changes/change_1").set({
          targetType: "venue",
          targetId: VENUE_ID,
        });
      });
      const moderatorDb = testEnv.authenticatedContext(MOD_UID).firestore();
      await assertSucceeds(moderatorDb.doc("public_vibe_index_jobs/job_rules_1").get());
      await assertSucceeds(moderatorDb.doc("public_vibe_index_jobs/job_rules_1/changes/change_1").get());
      await assertFails(moderatorDb.doc("public_vibe_index_jobs/job_rules_1").update({ status: "rolled_back" }));
      const userDb = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(userDb.doc("public_vibe_index_jobs/job_rules_1").get());
    }],

    ["firestore: Vibe evidence is never client-readable or writable", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`directory_roles/${MOD_UID}`).set({ roles: ["directory_editor"] });
        await db.doc("public_vibe_evidence/evidence_rules_1").set({
          evidenceType: "authenticated_checkin",
          targetType: "venue",
          targetId: VENUE_ID,
          actorKey: "actor_rules_fixture",
          serverVerified: true,
        });
      });
      const anonymousDb = testEnv.unauthenticatedContext().firestore();
      const guestDb = nonAnonymousContext(GUEST_UID).firestore();
      const moderatorDb = nonAnonymousContext(MOD_UID).firestore();
      await assertFails(anonymousDb.doc("public_vibe_evidence/evidence_rules_1").get());
      await assertFails(guestDb.doc("public_vibe_evidence/evidence_rules_1").get());
      await assertFails(moderatorDb.doc("public_vibe_evidence/evidence_rules_1").get());
      await assertFails(guestDb.doc("public_vibe_evidence/forged").set({
        evidenceType: "authenticated_checkin",
        targetType: "venue",
        targetId: VENUE_ID,
        actorKey: "actor_forged",
        serverVerified: true,
      }));
    }],

    ["firestore: unauthenticated can read approved venue listing", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(db.doc(`venues/${VENUE_ID}`).get());
    }],

    ["firestore: unauthenticated cannot read private room session", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc(`room_sessions/${SESSION_ID}`).get());
    }],

    ["firestore: user can create follow for self", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`follows/${GUEST_UID}_host_${HOST_UID}`).set({
          followerUid: GUEST_UID,
          targetType: "host",
          targetId: HOST_UID,
        })
      );
    }],

    ["firestore: user cannot spoof follow owner", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`follows/${OTHER_UID}_host_${HOST_UID}`).set({
          followerUid: OTHER_UID,
          targetType: "host",
          targetId: HOST_UID,
        })
      );
    }],

    ["firestore: user can create private checkin but unauthenticated cannot read it", async () => {
      const ownerDb = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        ownerDb.doc("checkins/checkin_1").set({
          uid: GUEST_UID,
          targetType: "venue",
          targetId: VENUE_ID,
          isPublic: false,
        })
      );
      const publicDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(publicDb.doc("checkins/checkin_1").get());
    }],

    ["firestore: user can create own review", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`reviews/${REVIEW_ID}`).set({
          uid: GUEST_UID,
          targetType: "venue",
          targetId: VENUE_ID,
          rating: 5,
        })
      );
    }],

    ["firestore: non-owner cannot update another user's review", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`reviews/${REVIEW_ID}`).set({
          uid: GUEST_UID,
          targetType: "venue",
          targetId: VENUE_ID,
          rating: 4,
        });
      });
      const db = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(
        db.doc(`reviews/${REVIEW_ID}`).update({
          rating: 1,
        })
      );
    }],

    ["firestore: non-moderator cannot read another user's submission", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("directory_submissions/sub_1").set({
          createdBy: HOST_UID,
          status: "pending",
        });
      });
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(db.doc("directory_submissions/sub_1").get());
    }],

    ["firestore: moderator can read queue submission", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("directory_submissions/sub_1").set({
          createdBy: HOST_UID,
          status: "pending",
        });
        await db.doc(`directory_roles/${MOD_UID}`).set({
          roles: ["directory_editor"],
        });
      });
      const db = testEnv.authenticatedContext(MOD_UID).firestore();
      await assertSucceeds(db.doc("directory_submissions/sub_1").get());
    }],

    ["firestore: user can create own directory claim request", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`directory_claim_requests/${GUEST_UID}_venue_${VENUE_ID}`).set({
          createdBy: GUEST_UID,
          listingType: "venue",
          listingId: VENUE_ID,
          status: "pending",
        })
      );
    }],

    ["firestore: user cannot read another user's claim request", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("directory_claim_requests/claim_1").set({
          createdBy: HOST_UID,
          listingType: "venue",
          listingId: VENUE_ID,
          status: "pending",
        });
      });
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(db.doc("directory_claim_requests/claim_1").get());
    }],

    ["firestore: user can manage own RSVP but others cannot read", async () => {
      const ownerDb = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        ownerDb.doc(`directory_rsvps/${GUEST_UID}_event_event_1`).set({
          uid: GUEST_UID,
          targetType: "event",
          targetId: "event_1",
          status: "going",
        })
      );
      const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(otherDb.doc(`directory_rsvps/${GUEST_UID}_event_event_1`).get());
      await assertFails(
        otherDb.doc(`directory_rsvps/${GUEST_UID}_event_event_1`).update({ status: "interested" })
      );
      await assertSucceeds(
        ownerDb.doc(`directory_rsvps/${GUEST_UID}_event_event_1`).update({ status: "interested" })
      );
    }],

    ["firestore: user can manage own reminder preferences", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`directory_reminders/${GUEST_UID}_event_event_1`).set({
          uid: GUEST_UID,
          targetType: "event",
          targetId: "event_1",
          emailOptIn: true,
          smsOptIn: false,
        })
      );
      await assertSucceeds(
        db.doc(`directory_reminders/${GUEST_UID}_event_event_1`).update({
          smsOptIn: true,
          phone: "+12065550101",
        })
      );
    }],

    ["firestore: geo page cache is publicly readable and not client writable", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("directory_geo_pages/wa_seattle").set({
          token: "wa_seattle",
          title: "Seattle Karaoke",
        });
      });
      const publicDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(publicDb.doc("directory_geo_pages/wa_seattle").get());
      const authedDb = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertFails(
        authedDb.doc("directory_geo_pages/wa_seattle").set({ token: "wa_seattle" }, { merge: true })
      );
    }],

    ["firestore: reminder dispatch logs are moderator-readable only", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("directory_reminder_dispatch/dispatch_1").set({
          status: "sent",
          uid: HOST_UID,
        });
        await db.doc(`directory_roles/${MOD_UID}`).set({
          roles: ["directory_editor"],
        });
      });
      const modDb = testEnv.authenticatedContext(MOD_UID).firestore();
      await assertSucceeds(modDb.doc("directory_reminder_dispatch/dispatch_1").get());
      const userDb = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(userDb.doc("directory_reminder_dispatch/dispatch_1").get());
    }],

    ["firestore: reminder jobs are moderator-readable only", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("directory_reminder_jobs/job_1").set({
          status: "completed",
        });
        await db.doc(`directory_roles/${MOD_UID}`).set({
          roles: ["directory_editor"],
        });
      });
      const modDb = testEnv.authenticatedContext(MOD_UID).firestore();
      await assertSucceeds(modDb.doc("directory_reminder_jobs/job_1").get());
      const userDb = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(userDb.doc("directory_reminder_jobs/job_1").get());
    }],

    ["firestore: unauthenticated cannot create room", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        db.doc(roomPath("UNAUTH")).set({
          hostUid: "x",
          hostUids: ["x"],
        })
      );
    }],

    ["firestore: host can create room", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(
        db.doc(roomPath("NEW01")).set({
          hostUid: HOST_UID,
          hostUids: [HOST_UID],
        })
      );
    }],

    ["firestore: non-host can update whitelisted room key", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(db.doc(roomPath()).update({ activeMode: "bingo" }));
    }],

    ["firestore: host cannot directly update room key (callable-only host writes)", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertFails(db.doc(roomPath()).update({ activeMode: "karaoke_bracket" }));
    }],

    ["firestore: public TV can report performance playback session progress", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(roomPath()).set({
          hostUid: HOST_UID,
          hostUids: [HOST_UID],
          activeMode: "karaoke",
          currentPerformanceSession: {
            sessionId: "song_1_1000",
            songId: "song_1",
            startedAtMs: 1000,
            playbackState: "starting",
          },
          currentPerformanceMeta: {
            songId: "song_1",
            durationSec: 0,
            backingDurationSec: 0,
            autoEndSafe: false,
          },
        });
      });
      const db = anonymousContext(GUEST_UID).firestore();
      await assertSucceeds(db.doc(roomPath()).update({
        "currentPerformanceSession.lastReportedAtMs": 12000,
        "currentPerformanceSession.lastHeartbeatAtMs": 12000,
        "currentPerformanceSession.playerReportedDurationSec": 205,
        "currentPerformanceSession.playerPositionSec": 47,
        "currentPerformanceSession.playbackState": "playing",
        "currentPerformanceSession.playbackStartedAtMs": 12000,
        "currentPerformanceMeta.durationSec": 205,
        "currentPerformanceMeta.backingDurationSec": 205,
        "currentPerformanceMeta.durationSource": "player_reported",
        "currentPerformanceMeta.durationConfidence": "high",
        "currentPerformanceMeta.autoEndSafe": true,
      }));
    }],

    ["firestore: even a room host cannot read or write guest passcode hashes", async () => {
      const db = nonAnonymousContext(HOST_UID).firestore();
      await assertFails(db.doc(`room_private_access/${ROOM_CODE}`).get());
      await assertFails(db.doc(`room_private_access/${ROOM_CODE}`).set({
        roomCode: ROOM_CODE,
        salt: "client-salt",
        hash: "client-hash",
      }));
    }],

    ["firestore: recurrence definitions and cancellation history are callable-only", async () => {
      const db = nonAnonymousContext(HOST_UID).firestore();
      await assertFails(db.doc("night_series/night_rules_test").get());
      await assertFails(db.doc("night_series/night_rules_test").update({ active: false }));
      await assertFails(db.doc("night_occurrences/occ_rules_test").get());
      await assertFails(db.doc("night_occurrences/occ_rules_test").update({ status: "cancelled" }));
    }],

    ["firestore: public TV cannot rewrite active performance session identity", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(roomPath()).set({
          hostUid: HOST_UID,
          hostUids: [HOST_UID],
          activeMode: "karaoke",
          currentPerformanceSession: {
            sessionId: "song_1_1000",
            songId: "song_1",
            startedAtMs: 1000,
            playbackState: "starting",
          },
        });
      });
      const db = anonymousContext(GUEST_UID).firestore();
      await assertFails(db.doc(roomPath()).update({
        "currentPerformanceSession.songId": "song_2",
        "currentPerformanceSession.lastReportedAtMs": 12000,
      }));
    }],


    ["firestore: non-host cannot update non-whitelisted room key", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(db.doc(roomPath()).update({ tipPointRate: 999 }));
    }],

    ["firestore: room user id must match roomCode_uid", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/room_users/${ROOM_CODE}_WRONG`).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
        })
      );
    }],

    ["firestore: user can create own room_user doc", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
        })
      );
    }],

    ["firestore: audience join payload can create own room_user doc", async () => {
      const db = anonymousContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          avatar: "😀",
          isVip: false,
          vipLevel: 0,
          fameLevel: 0,
          totalFamePoints: 0,
          lastActiveAt: new Date(),
          points: 100,
          totalEmojis: 0,
          lastSeen: new Date(),
        })
      );
    }],

    ["firestore: audience vibe payload can create own room_user doc", async () => {
      const db = anonymousContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          avatar: "😀",
          isVip: false,
          vipLevel: 0,
          fameLevel: 0,
          totalFamePoints: 0,
          lastActiveAt: new Date(),
          guitarSessionId: 12345,
          guitarHits: 7,
          lastVibeAt: new Date(),
        }, { merge: true })
      );
    }],

    ["firestore: user can update own room_user guitar vibe state", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          avatar: "😀",
          isVip: false,
          vipLevel: 0,
          fameLevel: 0,
          totalFamePoints: 0,
          lastActiveAt: new Date(),
        })
      );
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          guitarSessionId: 12345,
          guitarHits: 11,
          lastVibeAt: new Date(),
        }, { merge: true })
      );
    }],

    ["firestore: user cannot self-escalate room_user VIP projection", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          isVip: true,
          vipLevel: 1,
        })
      );
    }],

    ["firestore: stale room_user privilege projection does not block harmless self updates", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          avatar: "😀",
          isVip: true,
          vipLevel: 3,
          fameLevel: 12,
          totalFamePoints: 2400,
          lastActiveAt: new Date(),
        });
      });
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          name: "Guest Updated",
          lastActiveAt: new Date(),
        }, { merge: true })
      );
    }],

    ["firestore: user cannot update room_user with unknown field", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          points: 100,
        })
      );
      await assertFails(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).update({
          adminOverride: true,
        })
      );
    }],

    ["firestore: user can update own room_user request intent fields", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
        })
      );
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          requestIntent: "host_pick_tight15",
          requestIntentUpdatedAt: new Date(),
        }, { merge: true })
      );
    }],

    ["firestore: user can update room_user points within delta limit", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          points: 100,
        })
      );
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).update({
          points: 9500,
        })
      );
    }],

    ["firestore: user cannot update room_user points with extreme jump", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          points: 100,
        })
      );
      await assertFails(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).update({
          points: 30000,
        })
      );
    }],

    ["firestore: host can delete another user in room", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
        });
      });
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).delete());
    }],

    ["firestore: audience user cannot mutate bracket vote directly", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          avatar: "smile",
        });
      });
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).update({
          bracketVote: {
            bracketId: "bracket_1",
            matchId: "m_1_1",
            targetUid: OTHER_UID,
          },
        })
      );
    }],

    ["firestore: audience user cannot create raw karaoke song request", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(karaokeSongPath("song_self")).set({
          roomCode: ROOM_CODE,
          songTitle: "Will",
          artist: "Joyner Lucas",
          singerName: "Guest",
          singerUid: GUEST_UID,
          status: "requested",
          resolutionStatus: "review_required",
          resolutionLayer: "manual_review",
          collabOpen: true,
        })
      );
    }],

    ["firestore: host can create karaoke song request", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(
        db.doc(karaokeSongPath("song_host")).set({
          roomCode: ROOM_CODE,
          songTitle: "Will",
          artist: "Joyner Lucas",
          singerName: "Guest",
          singerUid: GUEST_UID,
          status: "requested",
        })
      );
    }],

    ["firestore: audience user cannot create karaoke song for another singer", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(karaokeSongPath("song_other")).set({
          roomCode: ROOM_CODE,
          songTitle: "Will",
          artist: "Joyner Lucas",
          singerName: "Other",
          singerUid: OTHER_UID,
          status: "requested",
        })
      );
    }],

    ["firestore: non-anonymous account can create chat message", async () => {
      const db = nonAnonymousContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/chat_messages/chat_1`).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          user: "Guest",
          text: "Hello room",
          channel: "lounge",
        })
      );
    }],

    ["firestore: user cannot create room_user doc with phone field", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          phone: "+12065550101",
        })
      );
    }],

    ["firestore: audience user can create activity with matching uid", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/activities/activity_1`).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          user: "Guest",
          text: "joined the party",
          icon: "wave",
        })
      );
    }],

    ["firestore: audience user cannot create activity without uid", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/activities/activity_2`).set({
          roomCode: ROOM_CODE,
          user: "Guest",
          text: "joined the party",
          icon: "wave",
        })
      );
    }],

    ["firestore: audience user cannot spoof activity uid", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/activities/activity_3`).set({
          roomCode: ROOM_CODE,
          uid: OTHER_UID,
          user: "Guest",
          text: "joined the party",
          icon: "wave",
        })
      );
    }],

    ["firestore: host can create activity without uid", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/activities/activity_host`).set({
          roomCode: ROOM_CODE,
          user: "HOST",
          text: "triggered a mode change",
          icon: "GAME",
        })
      );
    }],

    ["firestore: audience user can create reaction with matching uid", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/reactions/reaction_1`).set({
          roomCode: ROOM_CODE,
          type: "heart",
          count: 1,
          uid: GUEST_UID,
          userName: "Guest",
          avatar: "😀",
          isFree: true,
        })
      );
    }],

    ["firestore: audience user can create spotlight reaction metadata", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/reactions/reaction_spotlight_wave`).set({
          roomCode: ROOM_CODE,
          type: "spotlight_wave",
          count: 1,
          uid: GUEST_UID,
          userName: "Guest",
          avatar: "????",
          isVip: false,
          isFree: true,
          spotlightSessionId: "audience_spotlight_guest-uid_123",
          spotlightKind: "audience_spotlight",
          spotlightMode: "cheer",
          spotlightUserId: GUEST_UID,
          timestamp: new Date(),
        })
      );
    }],

    ["firestore: audience user can create commentator row reaction metadata", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/reactions/reaction_commentator_hot_take`).set({
          roomCode: ROOM_CODE,
          type: "commentator_hot_take",
          count: 1,
          uid: GUEST_UID,
          userName: "Guest",
          avatar: "????",
          isVip: false,
          isFree: true,
          audienceDisplaySessionId: "audience_display_commentator_row_123",
          audienceDisplayMode: "commentator_row",
          audienceDisplayRole: "commentator",
          timestamp: new Date(),
        })
      );
    }],

    ["firestore: audience user cannot create invalid commentator row role", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/reactions/reaction_commentator_invalid_role`).set({
          roomCode: ROOM_CODE,
          type: "commentator_hot_take",
          count: 1,
          uid: GUEST_UID,
          userName: "Guest",
          avatar: "????",
          isFree: true,
          audienceDisplaySessionId: "audience_display_commentator_row_123",
          audienceDisplayMode: "commentator_row",
          audienceDisplayRole: "host",
        })
      );
    }],

    ["firestore: audience user cannot spoof reaction uid", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/reactions/reaction_2`).set({
          roomCode: ROOM_CODE,
          type: "heart",
          count: 1,
          uid: OTHER_UID,
          userName: "Guest",
          avatar: "😀",
          isFree: true,
        })
      );
    }],

    ["firestore: reaction requires existing room", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/reactions/reaction_3`).set({
          roomCode: "MISSING",
          type: "heart",
          count: 1,
          uid: GUEST_UID,
          userName: "Guest",
          avatar: "😀",
          isFree: true,
        })
      );
    }],

    ["firestore: reaction unknown key is denied", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/reactions/reaction_4`).set({
          roomCode: ROOM_CODE,
          type: "heart",
          count: 1,
          uid: GUEST_UID,
          userName: "Guest",
          avatar: "😀",
          isFree: true,
          pointsGranted: 5000,
        })
      );
    }],

    ["firestore: audience user can create WYR vote reaction with letter val", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/reactions/reaction_vote_wyr`).set({
          roomCode: ROOM_CODE,
          type: "vote_wyr",
          val: "A",
          questionId: "wyr_1",
          uid: GUEST_UID,
          userName: "Guest",
          avatar: "😀",
          isVote: true,
        })
      );
    }],

    ["firestore: audience user cannot mutate bingo rng directly", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(roomPath()).update({
          bingoMysteryRng: {
            active: true,
            results: {
              [GUEST_UID]: { uid: GUEST_UID, value: 999 },
            },
          },
        })
      );
    }],

    ["firestore: reaction vote val rejects invalid string", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/reactions/reaction_vote_invalid`).set({
          roomCode: ROOM_CODE,
          type: "vote_wyr",
          val: "LEFT",
          questionId: "wyr_1",
          uid: GUEST_UID,
          userName: "Guest",
          avatar: "😀",
          isVote: true,
        })
      );
    }],

    ["firestore: audience user cannot create raw prompt vote docs", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/prompt_votes/prompt_vote_1`).set({
          roomCode: ROOM_CODE,
          questionId: "trivia_1",
          voteType: "vote_trivia",
          voterUid: GUEST_UID,
          uid: GUEST_UID,
          val: 2,
          userName: "Guest",
          avatar: "ðŸ˜€",
        })
      );
    }],

    ["firestore: audience user can read prompt vote projection", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`${ROOT}/prompt_vote_public/${ROOM_CODE}_trivia_1`).set({
          roomCode: ROOM_CODE,
          questionId: "trivia_1",
          voteType: "vote_trivia",
          votesByVoterUid: {
            [GUEST_UID]: 2,
          },
          votes: [],
        });
      });
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(db.doc(`${ROOT}/prompt_vote_public/${ROOM_CODE}_trivia_1`).get());
    }],

    ["firestore: audience user can create selfie photo reaction", async () => {
      const db = anonymousContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/reactions/reaction_selfie_photo`).set({
          roomCode: ROOM_CODE,
          type: "photo",
          userName: "Guest",
          avatar: "😀",
          url: "https://firebasestorage.googleapis.com/v0/b/demo/o/test.jpg",
          storagePath: `room_photos/${ROOM_CODE}/${GUEST_UID}/snap.jpg`,
          timestamp: new Date(),
        })
      );
    }],

    ["firestore: anonymous auth cannot create chat message", async () => {
      const db = anonymousContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/chat_messages/chat_anon`).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          user: "Guest",
          text: "Hi from anon",
          channel: "lounge",
        })
      );
    }],

    ["firestore: chat sender uid must match authenticated uid", async () => {
      const db = nonAnonymousContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/chat_messages/chat_spoof`).set({
          roomCode: ROOM_CODE,
          uid: OTHER_UID,
          user: "Spoof",
          text: "I should not send this",
          channel: "lounge",
        })
      );
    }],

    ["firestore: chat requires an existing room", async () => {
      const db = nonAnonymousContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/chat_messages/chat_missing_room`).set({
          roomCode: "MISSING",
          uid: GUEST_UID,
          user: "Guest",
          text: "No room",
          channel: "lounge",
        })
      );
    }],

    ["storage: host can upload allowed audio/video", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_uploads/${ROOM_CODE}/clip.mp3`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "audio/mpeg" })
      );
    }],

    ["storage: host can upload branding image", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_branding/${ROOM_CODE}/logo.png`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: host can upload round winner prize image", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`round_winner_prizes/${ROOM_CODE}/prize.jpg`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "image/jpeg" })
      );
    }],

    ["storage: host can upload room scene image", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_scene_media/${ROOM_CODE}/slide.png`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: host can upload room scene video", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_scene_media/${ROOM_CODE}/scene.mp4`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "video/mp4" })
      );
    }],

    ["storage: host can overwrite branding image at same path", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_branding/${ROOM_CODE}/logo.png`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
      await assertSucceeds(
        ref.putString("def", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: host can upload nested branding image paths", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_branding/${ROOM_CODE}/orb-skins/logo.png`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: super admin email can upload branding image for another host room", async () => {
      const storage = superAdminEmailContext("super-admin-email").storage(BUCKET);
      const ref = storage.ref(`room_branding/${ROOM_CODE}/logo.png`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: audience participant can upload room photo", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          uid: GUEST_UID,
          roomCode: ROOM_CODE,
          name: "Guest",
          avatar: "😀",
        });
      });
      const storage = anonymousContext(GUEST_UID).storage(BUCKET);
      const ref = storage.ref(`room_photos/${ROOM_CODE}/${GUEST_UID}/snap.jpg`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "image/jpeg" })
      );
    }],

    ["storage: audience participant can overwrite own room photo", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
          avatar: "😀",
        });
      });
      const storage = anonymousContext(GUEST_UID).storage(BUCKET);
      const ref = storage.ref(`room_photos/${ROOM_CODE}/${GUEST_UID}/snap.jpg`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "image/jpeg" })
      );
      await assertSucceeds(
        ref.putString("def", "raw", { contentType: "image/jpeg" })
      );
    }],

    ["storage: non-participant cannot upload room photo", async () => {
      const storage = anonymousContext(OTHER_UID).storage(BUCKET);
      const ref = storage.ref(`room_photos/${ROOM_CODE}/${OTHER_UID}/snap.jpg`);
      await assertFails(
        ref.putString("abc", "raw", { contentType: "image/jpeg" })
      );
    }],

    ["storage: non-host cannot upload branding image", async () => {
      const storage = testEnv.authenticatedContext(OTHER_UID).storage(BUCKET);
      const ref = storage.ref(`room_branding/${ROOM_CODE}/logo.png`);
      await assertFails(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: non-host cannot upload round winner prize image", async () => {
      const storage = testEnv.authenticatedContext(OTHER_UID).storage(BUCKET);
      const ref = storage.ref(`round_winner_prizes/${ROOM_CODE}/prize.jpg`);
      await assertFails(
        ref.putString("abc", "raw", { contentType: "image/jpeg" })
      );
    }],

    ["storage: non-host cannot upload room scene media", async () => {
      const storage = testEnv.authenticatedContext(OTHER_UID).storage(BUCKET);
      const ref = storage.ref(`room_scene_media/${ROOM_CODE}/slide.png`);
      await assertFails(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["firestore: host can create room scene preset", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/room_scene_presets/${ROOM_CODE}_scene_1`).set({
          roomCode: ROOM_CODE,
          title: "Sponsor slide",
          mediaUrl: "https://example.com/slide.png",
          mediaType: "image",
          durationSec: 20,
        })
      );
    }],

    ["firestore: non-host cannot create room scene preset", async () => {
      const db = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/room_scene_presets/${ROOM_CODE}_scene_2`).set({
          roomCode: ROOM_CODE,
          title: "Intrude",
          mediaUrl: "https://example.com/slide.png",
          mediaType: "image",
          durationSec: 20,
        })
      );
    }],

    ["storage: non-host cannot upload room media", async () => {
      const storage = testEnv.authenticatedContext(OTHER_UID).storage(BUCKET);
      const ref = storage.ref(`room_uploads/${ROOM_CODE}/intrude.mp4`);
      await assertFails(
        ref.putString("abc", "raw", { contentType: "video/mp4" })
      );
    }],

    ["storage: host cannot upload non-media content types", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_uploads/${ROOM_CODE}/bad.png`);
      await assertFails(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: only host can read uploaded room media", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage(BUCKET);
        const ref = storage.ref(`room_uploads/${ROOM_CODE}/private.mp4`);
        await ref.putString("abc", "raw", { contentType: "video/mp4" });
      });
      const hostStorage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const guestStorage = testEnv.authenticatedContext(GUEST_UID).storage(BUCKET);
      const hostRef = hostStorage.ref(`room_uploads/${ROOM_CODE}/private.mp4`);
      const guestRef = guestStorage.ref(`room_uploads/${ROOM_CODE}/private.mp4`);
      await assertSucceeds(hostRef.getDownloadURL());
      await assertFails(guestRef.getDownloadURL());
    }],

    ["firestore: host can create account media asset for hosted room", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/host_media_assets/asset_1`).set({
          ownerUid: HOST_UID,
          roomCode: ROOM_CODE,
          roomCodes: [ROOM_CODE],
          libraryScope: "account",
          title: "Walk-in music",
          mediaUrl: "https://example.com/audio.mp3",
          url: "https://example.com/audio.mp3",
          mediaType: "audio",
          storagePath: `host_media/${HOST_UID}/uploads/${ROOM_CODE}/audio.mp3`,
        })
      );
    }],

    ["firestore: non-owner cannot create account media asset", async () => {
      const db = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/host_media_assets/asset_2`).set({
          ownerUid: HOST_UID,
          roomCode: ROOM_CODE,
          roomCodes: [ROOM_CODE],
          libraryScope: "account",
          title: "Intrude",
          mediaUrl: "https://example.com/audio.mp3",
          mediaType: "audio",
        })
      );
    }],

    ["firestore: room co-host can read shared account media but not delete it", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(roomPath()).set({ hostUid: HOST_UID, hostUids: [HOST_UID, OTHER_UID], activeMode: "karaoke" }, { merge: true });
        await db.doc(`${ROOT}/host_media_assets/asset_3`).set({
          ownerUid: HOST_UID,
          roomCode: ROOM_CODE,
          roomCodes: [ROOM_CODE],
          libraryScope: "account",
          title: "Shared scene",
          mediaUrl: "https://example.com/scene.mp4",
          mediaType: "video",
        });
      });
      const db = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertSucceeds(db.doc(`${ROOT}/host_media_assets/asset_3`).get());
      await assertFails(db.doc(`${ROOT}/host_media_assets/asset_3`).delete());
    }],

    ["firestore: host can create account media folder", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/host_media_folders/folder_1`).set({
          ownerUid: HOST_UID,
          title: "Bingo Night",
          kind: "sfx",
          createdAtMs: 1,
        })
      );
    }],

    ["storage: owner can upload account host media", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const audioRef = storage.ref(`host_media/${HOST_UID}/uploads/${ROOM_CODE}/clip.mp3`);
      const imageRef = storage.ref(`host_media/${HOST_UID}/scenes/${ROOM_CODE}/slide.png`);
      await assertSucceeds(audioRef.putString("abc", "raw", { contentType: "audio/mpeg" }));
      await assertSucceeds(imageRef.putString("abc", "raw", { contentType: "image/png" }));
    }],

    ["storage: non-owner cannot access account host media", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage(BUCKET);
        const ref = storage.ref(`host_media/${HOST_UID}/uploads/${ROOM_CODE}/private.mp3`);
        await ref.putString("abc", "raw", { contentType: "audio/mpeg" });
      });
      const otherStorage = testEnv.authenticatedContext(OTHER_UID).storage(BUCKET);
      const otherRef = otherStorage.ref(`host_media/${HOST_UID}/uploads/${ROOM_CODE}/private.mp3`);
      await assertFails(otherRef.getDownloadURL());
      await assertFails(otherRef.putString("def", "raw", { contentType: "audio/mpeg" }));
    }],

    ["firestore: super admin email can update host libraries for another host room", async () => {
      const db = superAdminEmailContext("super-admin-email").firestore();
      await assertSucceeds(
        db.doc(`${ROOT}/host_libraries/${ROOM_CODE}`).set(
          { logoLibrary: ["https://example.com/logo.png"] },
          { merge: true }
        )
      );
    }],
    ["firestore: org member can read host account youtube index", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("organizations/org_host-uid/members/host-uid").set({ uid: HOST_UID, role: "owner" });
        await db.doc(`organizations/org_host-uid/youtube_indexes/karaoke`).set({
          orgId: "org_host-uid",
          ownerUid: HOST_UID,
          ytIndex: [{ videoId: "abc123xyz89", trackName: "Known Song" }],
        });
      });
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(db.doc(`organizations/org_host-uid/youtube_indexes/karaoke`).get());
    }],

    ["firestore: non member cannot read host account youtube index", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("organizations/org_host-uid/members/host-uid").set({ uid: HOST_UID, role: "owner" });
        await db.doc(`organizations/org_host-uid/youtube_indexes/karaoke`).set({
          orgId: "org_host-uid",
          ownerUid: HOST_UID,
          ytIndex: [{ videoId: "abc123xyz89", trackName: "Known Song" }],
        });
      });
      const db = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(db.doc(`organizations/org_host-uid/youtube_indexes/karaoke`).get());
    }],

    ["firestore: clients cannot write persisted youtube indexes", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertFails(db.doc(`organizations/org_host-uid/youtube_indexes/karaoke`).set({ orgId: "org_host-uid", ytIndex: [] }));
      await assertFails(db.doc(`${ROOT}/global_youtube_indexes/karaoke`).set({ ytIndex: [] }));
    }],

    ["firestore: usage controls remain server-only", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      const protectedPaths = [
        "platform_controls/usage",
        "organizations/org_host-uid/usage_controls/current",
        "organizations/org_host-uid/usage_room_controls/ROOM1",
        "organizations/org_host-uid/usage_operations/202607:operation-one",
        "organizations/org_host-uid/usage_capacity/202607",
        "organizations/org_host-uid/additional_usage_ledger/receipt-one",
        "organizations/org_host-uid/additional_usage_grant_state/grant-one",
        "additional_usage_payment_refs/pi_server_only",
      ];
      for (const protectedPath of protectedPaths) {
        await assertFails(db.doc(protectedPath).get());
        await assertFails(db.doc(protectedPath).set({ state: "enabled", hardLimit: 999999 }));
      }
    }],

    ["firestore: global youtube index is readable by app clients", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`${ROOT}/global_youtube_indexes/karaoke`).set({
          scope: "global_karaoke",
          ytIndex: [{ videoId: "abc123xyz89", trackName: "Known Song" }],
        });
      });
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(db.doc(`${ROOT}/global_youtube_indexes/karaoke`).get());
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    // Execute each case in isolation so state doesn't bleed across checks.
    results.push(await runCase(name, fn));
  }
  await testEnv.cleanup();

  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) {
    console.error(`\n${failed} rules check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} rules checks passed.`);
}

run().catch(async (err) => {
  console.error("Rules test run failed.");
  console.error(err);
  if (testEnv) {
    await testEnv.cleanup();
  }
  process.exit(1);
});
