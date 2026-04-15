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
    await db.doc(`directory_profiles/${HOST_UID}`).set({
      uid: HOST_UID,
      displayName: "Host",
      status: "approved",
      visibility: "public",
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

    ["firestore: audience user can create own karaoke song request", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
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
