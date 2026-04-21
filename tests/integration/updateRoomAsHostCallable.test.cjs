const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const { updateRoomAsHost } = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const HOST_UID = "host-uid";
const GUEST_UID = "guest-uid";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);

const requestFor = (uid, updates = {}) => ({
  auth: uid ? { uid } : null,
  app: null,
  data: {
    roomCode: ROOM_CODE,
    updates,
  },
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function resetRoom() {
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    activeMode: "karaoke",
    autoDj: false,
    readyCheck: { active: true },
    bingoSuggestions: { "2": { count: 0, lastNote: "", lastAt: null } },
    bingoRevealed: { "2": false },
  });
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
  await resetRoom();
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
    ["host can update allowed root keys", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        activeMode: "bingo",
        autoDj: true,
        audienceShellVariant: "streamlined",
        audienceFeatureAccess: {
          version: 1,
          features: {
            customEmoji: "account_required",
          },
        },
        lobbyOrbSkinUrl: "https://example.com/orb.png",
        eventCredits: {
          enabled: true,
          eventId: "aahf_kickoff",
          eventLabel: "AAHF Karaoke Kick-Off",
          generalAdmissionPoints: 200,
          vipBonusPoints: 400,
          audienceAccessMode: "email_or_donation",
          supportCelebrationStyle: "moneybags_burst",
        },
        programMode: "run_of_show",
        runOfShowEnabled: true,
        runOfShowPolicy: {
          defaultAutomationMode: "manual",
          lateBlockPolicy: "compress",
          noShowPolicy: "pull_from_queue",
          queueDivergencePolicy: "queue_can_fill_gaps",
          blockedActionPolicy: "manual_override_allowed",
        },
        runOfShowRoles: {
          coHosts: ["cohost_1"],
          stageManagers: ["stage_1"],
          mediaCurators: ["media_1"],
        },
        runOfShowTemplateMeta: {
          currentTemplateId: "template_1",
          currentTemplateName: "AAHF Kick-Off",
        },
        roundWinnersMoment: {
          active: true,
          title: "Round Results",
          winners: [
            { place: "gold", uid: "guest-1", name: "Alex", avatar: "🎤" },
          ],
        },
        tvPreviewOverlay: {
          active: true,
          itemId: "intro_1",
          headline: "Preview Intro",
        },
        runOfShowDirector: {
          enabled: true,
          automationPaused: false,
          items: [
            {
              id: "intro_1",
              type: "intro",
              title: "Introductions",
              sequence: 1,
              status: "ready",
              visibility: "public",
              automationMode: "auto",
            },
          ],
        },
      }));
      assert.equal(result.ok, true);
      assert.deepEqual(
        new Set(result.updatedKeys),
        new Set([
          "activeMode",
          "autoDj",
          "audienceShellVariant",
          "audienceFeatureAccess",
          "lobbyOrbSkinUrl",
          "eventCredits",
          "programMode",
          "runOfShowEnabled",
          "runOfShowPolicy",
          "runOfShowRoles",
          "runOfShowTemplateMeta",
          "roundWinnersMoment",
          "tvPreviewOverlay",
          "runOfShowDirector",
        ])
      );

      const snap = await roomRef.get();
      assert.equal(snap.get("activeMode"), "bingo");
      assert.equal(snap.get("autoDj"), true);
      assert.equal(snap.get("audienceShellVariant"), "streamlined");
      assert.equal(snap.get("audienceFeatureAccess.features.customEmoji"), "account_required");
      assert.equal(snap.get("lobbyOrbSkinUrl"), "https://example.com/orb.png");
      assert.equal(snap.get("eventCredits.enabled"), true);
      assert.equal(snap.get("eventCredits.generalAdmissionPoints"), 200);
      assert.equal(snap.get("eventCredits.audienceAccessMode"), "email_or_donation");
      assert.equal(snap.get("eventCredits.supportCelebrationStyle"), "moneybags_burst");
      assert.equal(snap.get("programMode"), "run_of_show");
      assert.equal(snap.get("runOfShowEnabled"), true);
      assert.equal(snap.get("runOfShowPolicy.defaultAutomationMode"), "manual");
      assert.deepEqual(snap.get("runOfShowRoles.coHosts"), ["cohost_1"]);
      assert.equal(snap.get("runOfShowTemplateMeta.currentTemplateName"), "AAHF Kick-Off");
      assert.equal((snap.get("roundWinnersMoment")?.winners || [])[0]?.name, "Alex");
      assert.equal(snap.get("tvPreviewOverlay.headline"), "Preview Intro");
      assert.equal((snap.get("runOfShowDirector")?.items || [])[0]?.title, "Introductions");
    }],

    ["legacy request mode updates backfill normalized backing policy fields", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        requestMode: "playable_only",
        allowSingerTrackSelect: false,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(
        new Set(result.updatedKeys),
        new Set([
          "requestMode",
          "allowSingerTrackSelect",
          "audienceBackingMode",
          "unknownBackingPolicy",
        ])
      );

      const snap = await roomRef.get();
      assert.equal(snap.get("requestMode"), "playable_only");
      assert.equal(snap.get("allowSingerTrackSelect"), false);
      assert.equal(snap.get("audienceBackingMode"), "canonical_plus_approved_backings");
      assert.equal(snap.get("unknownBackingPolicy"), "block_unknown");
    }],

    ["new backing policy updates backfill legacy compatibility fields", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        audienceBackingMode: "canonical_plus_audience_youtube",
        unknownBackingPolicy: "auto_queue_unverified",
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(
        new Set(result.updatedKeys),
        new Set([
          "requestMode",
          "allowSingerTrackSelect",
          "audienceBackingMode",
          "unknownBackingPolicy",
        ])
      );

      const snap = await roomRef.get();
      assert.equal(snap.get("requestMode"), "guest_backing_optional");
      assert.equal(snap.get("allowSingerTrackSelect"), true);
      assert.equal(snap.get("audienceBackingMode"), "canonical_plus_audience_youtube");
      assert.equal(snap.get("unknownBackingPolicy"), "auto_queue_unverified");
    }],

    ["host can toggle the room YouTube embeddable-only filter", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        hideNonEmbeddableYouTube: true,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(new Set(result.updatedKeys), new Set(["hideNonEmbeddableYouTube"]));

      const snap = await roomRef.get();
      assert.equal(snap.get("hideNonEmbeddableYouTube"), true);
    }],

    ["host can update performance recap timing fields", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        performanceRecapBreakdownMs: 6000,
        performanceRecapLeaderboardMs: 8000,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(
        new Set(result.updatedKeys),
        new Set([
          "performanceRecapBreakdownMs",
          "performanceRecapLeaderboardMs",
        ])
      );

      const snap = await roomRef.get();
      assert.equal(snap.get("performanceRecapBreakdownMs"), 6000);
      assert.equal(snap.get("performanceRecapLeaderboardMs"), 8000);
    }],

    ["approved-only backing mode coerces unknown policy to block unknown", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        audienceBackingMode: "canonical_plus_approved_backings",
      }));

      assert.equal(result.ok, true);
      const snap = await roomRef.get();
      assert.equal(snap.get("requestMode"), "playable_only");
      assert.equal(snap.get("allowSingerTrackSelect"), false);
      assert.equal(snap.get("audienceBackingMode"), "canonical_plus_approved_backings");
      assert.equal(snap.get("unknownBackingPolicy"), "block_unknown");
    }],

    ["host can archive and restore room metadata", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        archivedAt: { __hostOp: "serverTimestamp" },
        archivedBy: HOST_UID,
        archivedStatus: "archived",
        closedAt: 12345,
        updatedAt: { __hostOp: "serverTimestamp" },
      }));

      let snap = await roomRef.get();
      let archivedAt = snap.get("archivedAt");
      let updatedAt = snap.get("updatedAt");
      assert.ok(archivedAt && typeof archivedAt.toMillis === "function");
      assert.ok(updatedAt && typeof updatedAt.toMillis === "function");
      assert.equal(snap.get("archivedBy"), HOST_UID);
      assert.equal(snap.get("archivedStatus"), "archived");
      assert.equal(snap.get("closedAt"), 12345);

      await updateRoomAsHost.run(requestFor(HOST_UID, {
        archivedAt: null,
        archivedBy: null,
        archivedStatus: "active",
        closedAt: null,
        updatedAt: { __hostOp: "serverTimestamp" },
      }));

      snap = await roomRef.get();
      updatedAt = snap.get("updatedAt");
      assert.equal(snap.get("archivedAt"), null);
      assert.equal(snap.get("archivedBy"), null);
      assert.equal(snap.get("archivedStatus"), "active");
      assert.equal(snap.get("closedAt"), null);
      assert.ok(updatedAt && typeof updatedAt.toMillis === "function");
    }],

    ["host can update volley orb and lobby playground controls", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        lightMode: "volley",
        lobbyVolleyEnabled: true,
        lobbyPlaygroundPaused: true,
        lobbyPlaygroundVisualOnly: true,
        lobbyPlaygroundStrictMode: true,
        lobbyPlaygroundPerUserCooldownMs: 450,
        lobbyPlaygroundMaxPerMinute: 8,
      }));

      const snap = await roomRef.get();
      assert.equal(snap.get("lightMode"), "volley");
      assert.equal(snap.get("lobbyVolleyEnabled"), true);
      assert.equal(snap.get("lobbyPlaygroundPaused"), true);
      assert.equal(snap.get("lobbyPlaygroundVisualOnly"), true);
      assert.equal(snap.get("lobbyPlaygroundStrictMode"), true);
      assert.equal(snap.get("lobbyPlaygroundPerUserCooldownMs"), 450);
      assert.equal(snap.get("lobbyPlaygroundMaxPerMinute"), 8);
    }],

    ["host can update approved dotted paths", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        "readyCheck.active": false,
        "bingoSuggestions.2.count": 3,
        "bingoRevealed.2": true,
      }));

      const snap = await roomRef.get();
      assert.equal(snap.get("readyCheck.active"), false);
      assert.equal(snap.get("bingoSuggestions.2.count"), 3);
      assert.equal(snap.get("bingoRevealed.2"), true);
    }],

    ["host can use approved server timestamp marker", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        "bingoSuggestions.2.approvedAt": { __hostOp: "serverTimestamp" },
      }));

      const snap = await roomRef.get();
      const approvedAt = snap.get("bingoSuggestions.2.approvedAt");
      assert.ok(approvedAt && typeof approvedAt.toMillis === "function");
    }],

    ["host can update missionControl object payload", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        missionControl: {
          version: 1,
          enabled: true,
          setupDraft: {
            archetype: "casual",
            flowRule: "balanced",
            spotlightMode: "karaoke",
            assistLevel: "smart_assist",
          },
          party: {
            karaokeFirst: true,
            minSingingSharePct: 70,
            maxBreakDurationSec: 20,
            maxConsecutiveNonKaraokeModes: 1,
            state: {
              singingMs: 180000,
              groupMs: 30000,
            },
          },
          advancedOverrides: {},
          lastAppliedAt: { __hostOp: "serverTimestamp" },
          lastSuggestedAction: "start_next",
        },
      }));

      const snap = await roomRef.get();
      const mission = snap.get("missionControl");
      assert.equal(mission.version, 1);
      assert.equal(mission.enabled, true);
      assert.equal(mission.setupDraft.archetype, "casual");
      assert.equal(mission.party.karaokeFirst, true);
      assert.equal(mission.party.minSingingSharePct, 70);
      assert.equal(mission.party.maxBreakDurationSec, 20);
      assert.equal(mission.lastSuggestedAction, "start_next");
      assert.ok(mission.lastAppliedAt && typeof mission.lastAppliedAt.toMillis === "function");
    }],

    ["host can update visualizer and tv layout controls", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        visualizerSource: "stage_mic",
        visualizerMode: "rings",
        visualizerPreset: "club",
        visualizerSensitivity: 1.5,
        visualizerSmoothing: 0.45,
        visualizerSyncLightMode: true,
        lyricsMode: "full",
        hideWaveform: true,
        hideOverlay: true,
        hideLogo: false,
        hideCornerOverlay: false,
        reduceMotionFx: true,
        tvPresentationProfile: "simple",
      }));

      const snap = await roomRef.get();
      assert.equal(snap.get("visualizerSource"), "stage_mic");
      assert.equal(snap.get("visualizerMode"), "rings");
      assert.equal(snap.get("visualizerPreset"), "club");
      assert.equal(snap.get("visualizerSensitivity"), 1.5);
      assert.equal(snap.get("visualizerSmoothing"), 0.45);
      assert.equal(snap.get("visualizerSyncLightMode"), true);
      assert.equal(snap.get("lyricsMode"), "full");
      assert.equal(snap.get("hideWaveform"), true);
      assert.equal(snap.get("hideOverlay"), true);
      assert.equal(snap.get("hideLogo"), false);
      assert.equal(snap.get("hideCornerOverlay"), false);
      assert.equal(snap.get("reduceMotionFx"), true);
      assert.equal(snap.get("tvPresentationProfile"), "simple");
    }],

    ["host can launch vocal challenge payloads", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        activeMode: "vocal_challenge",
        gameData: {
          playerId: "guest-2",
          playerName: "Guest",
          playerAvatar: "O",
          inputSource: "turns",
          mode: "turns",
          participants: ["guest-2"],
          participantMeta: [{ id: "guest-2", name: "Guest", avatar: "O" }],
          turnIndex: 0,
          status: "playing",
          score: 0,
          streak: 0,
          turnDurationMs: 30000,
          difficulty: "standard",
          guideTone: true,
          timestamp: 12345,
        },
        gameParticipantMode: "selected",
        gameParticipants: ["guest-2"],
      }));

      const snap = await roomRef.get();
      assert.equal(snap.get("activeMode"), "vocal_challenge");
      assert.equal(snap.get("gameData.playerId"), "guest-2");
      assert.deepEqual(snap.get("gameData.participants"), ["guest-2"]);
      assert.deepEqual(snap.get("gameParticipants"), ["guest-2"]);
    }],

    ["host can launch bingo payloads with string board ids", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        activeMode: "bingo",
        bingoData: Array.from({ length: 25 }, (_, idx) => ({
          id: idx,
          type: "karaoke",
          text: idx === 12 ? "FREE" : `Tile ${idx}`,
          status: "hidden",
          content: null,
          free: idx === 12,
        })),
        bingoSize: 5,
        bingoMode: "karaoke",
        bingoSessionId: "bingo_test",
        bingoBoardId: "preset-karaoke-tropes",
        bingoVictory: null,
        bingoWin: null,
        bingoRevealed: { 12: true },
        bingoSuggestions: {},
        bingoVotingMode: "host+votes",
        bingoAutoApprovePct: 50,
        bingoShowTv: true,
        bingoMysteryRng: null,
        bingoTurnPick: null,
        bingoTurnOrder: null,
        bingoTurnIndex: null,
        bingoPickerUid: null,
        bingoPickerName: null,
        bingoFocus: null,
        gameParticipantMode: "all",
        gameParticipants: [],
      }));

      const snap = await roomRef.get();
      assert.equal(snap.get("activeMode"), "bingo");
      assert.equal(snap.get("bingoBoardId"), "preset-karaoke-tropes");
      assert.equal(snap.get("bingoData").length, 25);
    }],

    ["guest cannot update room as host", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(GUEST_UID, { activeMode: "bingo" })),
        "permission-denied"
      );
    }],

    ["blocked host identity fields are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, { hostUid: "other" })),
        "permission-denied"
      );
    }],

    ["unknown root keys are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, { totallyNewRoomKey: true })),
        "invalid-argument"
      );
    }],

    ["disallowed dotted paths are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, { "queueSettings.limitMode": "none" })),
        "invalid-argument"
      );
    }],

    ["invalid value types are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, { autoDj: "yes" })),
        "invalid-argument"
      );
    }],

    ["malformed operation markers are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, {
          "bingoSuggestions.2.approvedAt": { __hostOp: "serverTimestamp", extra: true },
        })),
        "invalid-argument"
      );
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

run().catch((err) => {
  console.error("Callable integration test run failed.");
  console.error(err);
  process.exit(1);
});
