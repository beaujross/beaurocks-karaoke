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
const privateAccessRef = db.doc(`room_private_access/${ROOM_CODE}`);

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
  await privateAccessRef.delete().catch(() => undefined);
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
    ["host can require, rotate, and remove a guest passcode without exposing it on the room", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        audienceJoinPolicy: { accessMode: "passcode_required" },
        audienceJoinPasscode: "PARTY7",
      }));
      assert.equal(result.ok, true);
      assert.equal(result.passcodeConfigured, true);
      assert.deepEqual(result.updatedKeys, ["audienceJoinPolicy"]);

      const roomSnap = await roomRef.get();
      const accessSnap = await privateAccessRef.get();
      assert.equal(roomSnap.get("audienceJoinPolicy.accessMode"), "passcode_required");
      assert.equal(roomSnap.get("audienceJoinPasscode"), undefined);
      assert.equal(accessSnap.exists, true);
      assert.equal(accessSnap.get("roomCode"), ROOM_CODE);
      assert.ok(String(accessSnap.get("salt") || "").length > 0);
      assert.match(String(accessSnap.get("hash") || ""), /^[a-f0-9]{64}$/);
      assert.notEqual(accessSnap.get("hash"), "PARTY7");

      const firstHash = accessSnap.get("hash");
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        audienceJoinPasscode: "NEWCODE9",
      }));
      assert.notEqual((await privateAccessRef.get()).get("hash"), firstHash);

      const openResult = await updateRoomAsHost.run(requestFor(HOST_UID, {
        audienceJoinPolicy: { accessMode: "anonymous_allowed" },
      }));
      assert.equal(openResult.passcodeConfigured, false);
      assert.equal((await privateAccessRef.get()).exists, false);
    }],

    ["host cannot enable passcode admission without setting a passcode", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, {
          audienceJoinPolicy: { accessMode: "passcode_required" },
        })),
        "failed-precondition"
      );
    }],

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
        searchSources: {
          local: true,
          youtube: true,
          itunes: false,
        },
        hostDiagnostics: {
          appleMusic: {
            stage: "picker_path",
            status: 400,
            message: "Apple Music picker test diagnostic",
          },
        },        hostNightPresetConfig: {
          id: "festival_custom",
          label: "Festival Custom",
          basePresetId: "competition",
          settings: {
            audienceShellVariant: "streamlined",
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
          creditEarningMode: "friendly",
          timedLobbyEnabled: true,
          timedLobbyPoints: 25,
          timedLobbyIntervalMin: 10,
          timedLobbyMaxPerGuest: 150,
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
          "searchSources",
          "hostDiagnostics",
          "hostNightPresetConfig",
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
      assert.deepEqual(snap.get("searchSources"), {
        local: true,
        youtube: true,
        itunes: false,
      });
      assert.equal(snap.get("audienceShellVariant"), "streamlined");
      assert.equal(snap.get("hostDiagnostics.appleMusic.stage"), "picker_path");
      assert.equal(snap.get("hostDiagnostics.appleMusic.status"), 400);
      assert.equal(snap.get("audienceFeatureAccess.features.customEmoji"), "account_required");
      assert.equal(snap.get("hostNightPresetConfig.id"), "festival_custom");
      assert.equal(snap.get("lobbyOrbSkinUrl"), "https://example.com/orb.png");
      assert.equal(snap.get("eventCredits.enabled"), true);
      assert.equal(snap.get("eventCredits.generalAdmissionPoints"), 200);
      assert.equal(snap.get("eventCredits.audienceAccessMode"), "email_or_donation");
      assert.equal(snap.get("eventCredits.creditEarningMode"), "friendly");
      assert.equal(snap.get("eventCredits.timedLobbyEnabled"), true);
      assert.equal(Number(snap.get("eventCredits.timedLobbyPoints")), 25);
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

    ["self-serve mode updates are accepted for room-format launches", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        selfServeMode: {
          enabled: true,
          format: "spotlight_auction",
          shortLabel: "Support Surge",
          paidPriorityEnabled: true,
          auctionWindow: {
            slotCount: 6,
            remainingSlots: 6,
          },
          restoreState: {
            requestMode: "canonical_open",
            allowSingerTrackSelect: false,
            audienceBackingMode: "canonical_only",
            unknownBackingPolicy: "require_review",
            bouncerMode: false,
            queueSettings: {
              limitMode: "none",
              limitCount: 0,
              rotation: "round_robin",
              firstTimeBoost: true,
            },
          },
        },
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(new Set(result.updatedKeys), new Set(["selfServeMode"]));

      const snap = await roomRef.get();
      assert.equal(snap.get("selfServeMode.enabled"), true);
      assert.equal(snap.get("selfServeMode.format"), "spotlight_auction");
      assert.equal(snap.get("selfServeMode.shortLabel"), "Support Surge");
      assert.equal(snap.get("selfServeMode.auctionWindow.slotCount"), 6);
    }],

    ["request mode save overrides stale audience backing mode", async () => {
      await roomRef.set({
        requestMode: "playable_only",
        allowSingerTrackSelect: false,
        audienceBackingMode: "canonical_plus_approved_backings",
        unknownBackingPolicy: "block_unknown",
      }, { merge: true });

      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        requestMode: "guest_backing_optional",
        allowSingerTrackSelect: true,
        audienceBackingMode: "canonical_plus_approved_backings",
        unknownBackingPolicy: "auto_queue_unverified",
      }));

      assert.equal(result.ok, true);

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
        performanceRecapScoreStepMs: 1800,
        performanceRecapLeaderboardMs: 8000,
        performanceRecapNextUpMs: 5000,
        performanceIntroSec: 12,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(
        new Set(result.updatedKeys),
        new Set([
          "performanceRecapBreakdownMs",
          "performanceRecapScoreStepMs",
          "performanceRecapLeaderboardMs",
          "performanceRecapNextUpMs",
          "performanceIntroSec",
        ])
      );

      const snap = await roomRef.get();
      assert.equal(snap.get("performanceRecapBreakdownMs"), 6000);
      assert.equal(snap.get("performanceRecapScoreStepMs"), 1800);
      assert.equal(snap.get("performanceRecapLeaderboardMs"), 8000);
      assert.equal(snap.get("performanceRecapNextUpMs"), 5000);
      assert.equal(snap.get("performanceIntroSec"), 12);
    }],

    ["host can update audience YouTube-only search mode", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        audienceYoutubeOnlySearch: true,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(result.updatedKeys, ["audienceYoutubeOnlySearch"]);

      let snap = await roomRef.get();
      assert.equal(snap.get("audienceYoutubeOnlySearch"), true);

      await updateRoomAsHost.run(requestFor(HOST_UID, {
        audienceYoutubeOnlySearch: false,
      }));

      snap = await roomRef.get();
      assert.equal(snap.get("audienceYoutubeOnlySearch"), false);
    }],

    ["host can toggle post-performance backing prompts", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        hostUiPrefs: {
          postPerformanceBackingPromptEnabled: false,
        },
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(
        new Set(result.updatedKeys),
        new Set(["hostUiPrefs"])
      );

      const snap = await roomRef.get();
      assert.equal(snap.get("hostUiPrefs.postPerformanceBackingPromptEnabled"), false);
    }],

    ["host can persist stage-start session payloads", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        activeMode: "karaoke",
        mediaUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
        videoPlaying: true,
        videoStartTimestamp: 1714411111000,
        currentPerformanceMeta: {
          songId: "song_123",
          startedAtMs: 1714411111000,
          durationSec: 30,
          backingDurationSec: 5,
          durationSource: "backing_media",
          durationConfidence: "high",
          autoEndSafe: true,
          source: "backing_media",
          mediaUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
        },
        currentPerformanceSession: {
          sessionId: "perf_song_123_1714411111000",
          songId: "song_123",
          sourceType: "native_video",
          mediaUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
          startedAtMs: 1714411111000,
          playbackState: "starting",
          playerReportedDurationSec: 30,
          expectedDurationSec: 30,
          lastHeartbeatAtMs: 1714411111000,
          lastReportedAtMs: 1714411111000,
          completionReason: "",
          watchdogDeadlineMs: 1714411231000,
        },
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(
        new Set(result.updatedKeys),
        new Set([
          "activeMode",
          "mediaUrl",
          "videoPlaying",
          "videoStartTimestamp",
          "currentPerformanceMeta",
          "currentPerformanceSession",
        ])
      );

      const snap = await roomRef.get();
      assert.equal(snap.get("activeMode"), "karaoke");
      assert.equal(snap.get("mediaUrl"), "https://samplelib.com/lib/preview/mp4/sample-5s.mp4");
      assert.equal(snap.get("videoPlaying"), true);
      assert.equal(snap.get("videoStartTimestamp"), 1714411111000);
      assert.equal(snap.get("currentPerformanceMeta.songId"), "song_123");
      assert.equal(snap.get("currentPerformanceMeta.durationSource"), "backing_media");
      assert.equal(snap.get("currentPerformanceSession.sessionId"), "perf_song_123_1714411111000");
      assert.equal(snap.get("currentPerformanceSession.playbackState"), "starting");
      assert.equal(snap.get("currentPerformanceSession.expectedDurationSec"), 30);
    }],


    ["host can persist a constrained local background playback observation", async () => {
      const observation = {
        type: "local_upload",
        id: "upload_house_mix",
        title: "House Mix",
        url: "https://cdn.example.test/house-mix.mp3",
        status: "playing",
        reason: "",
        lastReportedAt: 1714411115000,
      };
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        backgroundAudioPlayback: observation,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(result.updatedKeys, ["backgroundAudioPlayback"]);
      const snap = await roomRef.get();
      assert.deepEqual(snap.get("backgroundAudioPlayback"), observation);
    }],

    ["malformed local background playback observations are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, {
          backgroundAudioPlayback: { type: "spotify", status: "playing", unexpected: true },
        })),
        "invalid-argument"
      );
    }],

    ["host can sync Apple Music playback dotted fields", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        "appleMusicPlayback.status": "playing",
        "appleMusicPlayback.positionSec": 42.5,
        "appleMusicPlayback.lastReportedAt": 1714411115000,
        "appleMusicPlayback.lastHeartbeatAt": 1714411115000,
        "appleMusicPlayback.durationSec": 210,
        "currentPerformanceSession.playbackState": "playing",
        "currentPerformanceSession.playerPositionSec": 42.5,
        "currentPerformanceSession.lastReportedAtMs": 1714411115000,
        "currentPerformanceSession.lastHeartbeatAtMs": 1714411115000,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(
        new Set(result.updatedKeys),
        new Set([
          "appleMusicPlayback.status",
          "appleMusicPlayback.positionSec",
          "appleMusicPlayback.lastReportedAt",
          "appleMusicPlayback.lastHeartbeatAt",
          "appleMusicPlayback.durationSec",
          "currentPerformanceSession.playbackState",
          "currentPerformanceSession.playerPositionSec",
          "currentPerformanceSession.lastReportedAtMs",
          "currentPerformanceSession.lastHeartbeatAtMs",
        ])
      );

      const snap = await roomRef.get();
      assert.equal(snap.get("appleMusicPlayback.status"), "playing");
      assert.equal(snap.get("appleMusicPlayback.positionSec"), 42.5);
      assert.equal(snap.get("currentPerformanceSession.playbackState"), "playing");
      assert.equal(snap.get("currentPerformanceSession.playerPositionSec"), 42.5);
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

    ["host can update One-Minute Mic runtime controls", async () => {
      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        oneMinuteMicEnabled: true,
        performanceProgressionMode: "one_minute_mic",
        oneMinuteMicOpeningWindowSec: 60,
        oneMinuteMicVoteWindowSec: 12,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(
        new Set(result.updatedKeys),
        new Set([
          "oneMinuteMicEnabled",
          "performanceProgressionMode",
          "oneMinuteMicOpeningWindowSec",
          "oneMinuteMicVoteWindowSec",
        ])
      );

      const snap = await roomRef.get();
      assert.equal(snap.get("oneMinuteMicEnabled"), true);
      assert.equal(snap.get("performanceProgressionMode"), "one_minute_mic");
      assert.equal(snap.get("oneMinuteMicOpeningWindowSec"), 60);
      assert.equal(snap.get("oneMinuteMicVoteWindowSec"), 12);
    }],

    ["host can update audience display runtime controls", async () => {
      const audienceDisplay = {
        mode: "commentator_row",
        selectedUids: ["guest-1", "guest-2"],
        roleSource: "manual",
        showReactions: true,
        maxVisible: 4,
        sessionId: "audience_display_test",
        updatedAtMs: 1714411111000,
      };

      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        audienceDisplay,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(result.updatedKeys, ["audienceDisplay"]);

      let snap = await roomRef.get();
      assert.equal(snap.get("audienceDisplay.mode"), "commentator_row");
      assert.deepEqual(snap.get("audienceDisplay.selectedUids"), ["guest-1", "guest-2"]);
      assert.equal(snap.get("audienceDisplay.roleSource"), "manual");
      assert.equal(snap.get("audienceDisplay.showReactions"), true);
      assert.equal(snap.get("audienceDisplay.maxVisible"), 4);

      await updateRoomAsHost.run(requestFor(HOST_UID, { audienceDisplay: null }));
      snap = await roomRef.get();
      assert.equal(snap.get("audienceDisplay"), null);
    }],
    ["host can open and clear a bounded audience decision", async () => {
      const decision = {
        id: "continue_or_rotate:song_123:perf_123",
        type: "continue_or_rotate",
        status: "open",
        active: true,
        subjectSongId: "song_123",
        subjectSessionId: "perf_123",
        openedAtMs: 1714411111000,
        closesAtMs: 1714411122000,
        choices: [
          { id: "keep_singing", label: "Keep singing" },
          { id: "next_singer", label: "Next singer" },
        ],
        votesByUid: {},
      };

      const result = await updateRoomAsHost.run(requestFor(HOST_UID, {
        audienceDecision: decision,
      }));

      assert.equal(result.ok, true);
      assert.deepEqual(result.updatedKeys, ["audienceDecision"]);

      let snap = await roomRef.get();
      assert.equal(snap.get("audienceDecision.type"), "continue_or_rotate");
      assert.equal(snap.get("audienceDecision.status"), "open");

      await updateRoomAsHost.run(requestFor(HOST_UID, { audienceDecision: null }));
      snap = await roomRef.get();
      assert.equal(snap.get("audienceDecision"), null);
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
        lobbyVolleyLaunchId: 123456,
        lobbyVolleyStartedAtMs: 123456,
        lobbyPlaygroundPaused: true,
        lobbyPlaygroundVisualOnly: true,
        lobbyPlaygroundStrictMode: true,
        lobbyPlaygroundPerUserCooldownMs: 450,
        lobbyPlaygroundMaxPerMinute: 8,
        lobbyVoiceTelemetry: {
          active: true,
          source: "host",
          capturedAtMs: 123,
        },
      }));

      const snap = await roomRef.get();
      assert.equal(snap.get("lightMode"), "volley");
      assert.equal(snap.get("lobbyVolleyEnabled"), true);
      assert.equal(snap.get("lobbyVolleyLaunchId"), 123456);
      assert.equal(snap.get("lobbyVolleyStartedAtMs"), 123456);
      assert.equal(snap.get("lobbyPlaygroundPaused"), true);
      assert.equal(snap.get("lobbyPlaygroundVisualOnly"), true);
      assert.equal(snap.get("lobbyPlaygroundStrictMode"), true);
      assert.equal(snap.get("lobbyPlaygroundPerUserCooldownMs"), 450);
      assert.equal(snap.get("lobbyPlaygroundMaxPerMinute"), 8);
      assert.equal(snap.get("lobbyVoiceTelemetry.active"), true);
      assert.equal(snap.get("lobbyVoiceTelemetry.source"), "host");
    }],

    ["host can update approved dotted paths", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        "readyCheck.active": false,
        "bingoSuggestions.2.count": 3,
        "bingoRevealed.2": true,
        "gameData.voiceTelemetry": {
          active: true,
          source: "host",
          pitch: 220,
          confidence: 0.8,
          capturedAtMs: 456,
        },
      }));

      const snap = await roomRef.get();
      assert.equal(snap.get("readyCheck.active"), false);
      assert.equal(snap.get("bingoSuggestions.2.count"), 3);
      assert.equal(snap.get("bingoRevealed.2"), true);
      assert.equal(snap.get("gameData.voiceTelemetry.active"), true);
      assert.equal(snap.get("gameData.voiceTelemetry.pitch"), 220);
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
          deadAirFiller: {
            enabled: true,
            mode: "auto_fill",
            source: "browse_catalog_known_good",
            delaySec: 10,
            songs: [
              {
                title: "Sweet Caroline",
                artist: "Neil Diamond",
                browseSongKey: "sweet caroline__neil diamond",
                hasApprovedBacking: true,
              },
            ],
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
      assert.equal(mission.deadAirFiller.enabled, true);
      assert.equal(mission.deadAirFiller.mode, "auto_fill");
      assert.equal(mission.deadAirFiller.source, "browse_catalog_known_good");
      assert.equal(mission.deadAirFiller.delaySec, 10);
      assert.equal(mission.deadAirFiller.songs[0].title, "Sweet Caroline");
      assert.equal(mission.deadAirFiller.songs[0].hasApprovedBacking, true);
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

    ["host can save musical moment presets", async () => {
      await updateRoomAsHost.run(requestFor(HOST_UID, {
        musicalMomentPresets: [{
          id: "whitney_i_will_always_love_you_silence_drop",
          label: "Whitney Silence Drop",
          title: "I Will Always Love You: Silence Drop",
          artist: "Whitney Houston",
          mediaUrl: "https://www.youtube.com/watch?v=3JWTaaS7LdU",
          startSec: 171,
          loopSec: 24,
          mysteryStartSec: 14,
          targetBeatSec: 18,
          hitWindowMs: 700,
          playMode: "crowd",
        }],
      }));

      const snap = await roomRef.get();
      const presets = snap.get("musicalMomentPresets");
      assert.equal(presets[0].id, "whitney_i_will_always_love_you_silence_drop");
      assert.equal(presets[0].targetBeatSec, 18);
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

    ["invalid search source payloads are rejected", async () => {
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, {
          searchSources: {
            local: true,
            youtube: "yes",
          },
        })),
        "invalid-argument"
      );
      await expectHttpsError(
        () => updateRoomAsHost.run(requestFor(HOST_UID, {
          searchSources: {
            youtube: true,
            spotify: true,
          },
        })),
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
