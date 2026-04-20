const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  executeRunOfShowAction,
  manageRunOfShowTemplate,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROSRUN1";
const HOST_UID = "ros-host";
const CO_HOST_UID = "ros-cohost";
const STAGE_UID = "ros-stage";
const MEDIA_UID = "ros-media";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const templatesCol = db.collection(`${ROOT}/run_of_show_templates`);

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
  const existingTemplates = await templatesCol.where("roomCode", "==", ROOM_CODE).get();
  await Promise.all(existingTemplates.docs.map((docSnap) => docSnap.ref.delete()));
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    programMode: "run_of_show",
    runOfShowEnabled: true,
    runOfShowRoles: {
      coHosts: [CO_HOST_UID],
      stageManagers: [STAGE_UID],
      mediaCurators: [MEDIA_UID],
    },
    runOfShowPolicy: {
      defaultAutomationMode: "auto",
      lateBlockPolicy: "compress",
      noShowPolicy: "hold_for_host",
      queueDivergencePolicy: "host_override_only",
      blockedActionPolicy: "focus_next_fix",
    },
    runOfShowDirector: {
      enabled: true,
      automationPaused: false,
      currentItemId: "perf_live",
      items: [
        {
          id: "perf_live",
          type: "performance",
          title: "Feature Performance",
          sequence: 1,
          status: "live",
          visibility: "public",
          automationMode: "auto",
          performerMode: "assigned",
          assignedPerformerUid: "guest_1",
          assignedPerformerName: "Guest One",
          songTitle: "Dreams",
          artistName: "Fleetwood Mac",
          queueLinkState: "live",
          backingPlan: {
            sourceType: "youtube",
            youtubeId: "abc123xyz89",
            mediaUrl: "https://www.youtube.com/watch?v=abc123xyz89",
            approvalStatus: "approved",
            playbackReady: true,
            resolutionStatus: "ready",
          },
        },
        {
          id: "perf_next",
          type: "performance",
          title: "Next Performance",
          sequence: 2,
          status: "staged",
          visibility: "public",
          automationMode: "auto",
          advanceMode: "host_after_min",
          hostAdvanceMinSec: 75,
          requireHostAdvance: true,
          performerMode: "assigned",
          assignedPerformerUid: "guest_2",
          assignedPerformerName: "Guest Two",
          songTitle: "Valerie",
          artistName: "Amy Winehouse",
          queueLinkState: "staged",
          backingPlan: {
            sourceType: "local_file",
            localAssetId: "local_valerie",
            mediaUrl: "https://media.example.com/local/valerie.mp3",
            approvalStatus: "approved",
            playbackReady: true,
            resolutionStatus: "ready",
          },
        },
      ],
    },
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
    ["stage manager can complete a live run-of-show item", async () => {
      const result = await executeRunOfShowAction.run(requestFor(STAGE_UID, {
        roomCode: ROOM_CODE,
        action: "complete",
        itemId: "perf_live",
      }));

      assert.equal(result.ok, true);
      const roomSnap = await roomRef.get();
      const item = (roomSnap.get("runOfShowDirector.items") || []).find((entry) => entry.id === "perf_live");
      assert.equal(item.status, "complete");
      assert.equal(roomSnap.get("runOfShowDirector.currentItemId"), "");
    }],

    ["stage manager cannot pause automation", async () => {
      await expectHttpsError(
        () => executeRunOfShowAction.run(requestFor(STAGE_UID, {
          roomCode: ROOM_CODE,
          action: "pause_automation",
        })),
        "permission-denied"
      );
    }],

    ["legacy media curator role is normalized into co-host operator access", async () => {
      const result = await executeRunOfShowAction.run(requestFor(MEDIA_UID, {
        roomCode: ROOM_CODE,
        action: "start",
        itemId: "perf_next",
      }));

      assert.equal(result.ok, true);
      const roomSnap = await roomRef.get();
      const item = (roomSnap.get("runOfShowDirector.items") || []).find((entry) => entry.id === "perf_next");
      assert.equal(item.status, "live");
      assert.equal(roomSnap.get("runOfShowDirector.currentItemId"), "perf_next");
      assert.equal(item.advanceMode, "host_after_min");
      assert.equal(item.hostAdvanceMinSec, 75);
    }],

    ["host cannot complete a host-after-min scene before minimum live time elapses", async () => {
      await roomRef.set({
        runOfShowDirector: {
          enabled: true,
          automationPaused: false,
          currentItemId: "announce_hold",
          items: [
            {
              id: "announce_hold",
              type: "announcement",
              title: "Sponsor Hit",
              sequence: 1,
              status: "live",
              visibility: "public",
              automationMode: "auto",
              advanceMode: "host_after_min",
              hostAdvanceMinSec: 120,
              requireHostAdvance: true,
              liveStartedAtMs: Date.now() - 15_000,
            },
          ],
        },
      }, { merge: true });

      await expectHttpsError(
        () => executeRunOfShowAction.run(requestFor(HOST_UID, {
          roomCode: ROOM_CODE,
          action: "complete",
          itemId: "announce_hold",
        })),
        "failed-precondition"
      );
    }],

    ["host can save and apply a run-of-show template", async () => {
      const saveResult = await manageRunOfShowTemplate.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "save",
        templateId: "kickoff_v1",
        templateName: "Kick-Off v1",
      }));
      assert.equal(saveResult.ok, true);

      await roomRef.set({
        runOfShowDirector: {
          enabled: true,
          automationPaused: false,
          currentItemId: "",
          items: [
            {
              id: "buffer_only",
              type: "buffer",
              title: "Changed Working Copy",
              sequence: 1,
              status: "draft",
              visibility: "private",
              automationMode: "manual",
            },
          ],
        },
      }, { merge: true });

      const applyResult = await manageRunOfShowTemplate.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "apply",
        templateId: "kickoff_v1",
      }));
      assert.equal(applyResult.ok, true);

      const roomSnap = await roomRef.get();
      const items = roomSnap.get("runOfShowDirector.items") || [];
      assert.equal(items.length, 2);
      assert.equal(items[0].id, "perf_live");
      assert.equal(items[1].advanceMode, "host_after_min");
      assert.equal(items[1].hostAdvanceMinSec, 75);
      assert.equal(roomSnap.get("runOfShowTemplateMeta.currentTemplateId"), "kickoff_v1");
      assert.equal(roomSnap.get("runOfShowTemplateMeta.currentTemplateName"), "Kick-Off v1");
    }],

    ["starting a WYR run-of-show break writes the live prompt payload", async () => {
      await roomRef.set({
        runOfShowDirector: {
          enabled: true,
          automationPaused: false,
          currentItemId: "",
          items: [
            {
              id: "wyr_break",
              type: "would_you_rather_break",
              title: "Audience Vote",
              sequence: 1,
              status: "staged",
              visibility: "public",
              automationMode: "auto",
              plannedDurationSec: 18,
              modeLaunchPlan: {
                modeKey: "wyr",
                launchConfig: {
                  question: "Would you rather sing only power ballads or only disco anthems tonight?",
                  options: ["Power ballads", "Disco anthems"],
                  points: 75,
                  durationSec: 21,
                  autoReveal: true,
                },
              },
            },
          ],
        },
      }, { merge: true });

      const result = await executeRunOfShowAction.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "start",
        itemId: "wyr_break",
      }));

      assert.equal(result.ok, true);
      const roomSnap = await roomRef.get();
      assert.equal(roomSnap.get("activeMode"), "wyr");
      assert.equal(roomSnap.get("wyrData.question"), "Would you rather sing only power ballads or only disco anthems tonight?");
      assert.equal(roomSnap.get("wyrData.optionA"), "Power ballads");
      assert.equal(roomSnap.get("wyrData.optionB"), "Disco anthems");
      assert.equal(roomSnap.get("wyrData.points"), 75);
      assert.equal(roomSnap.get("wyrData.durationSec"), 21);
      assert.equal(roomSnap.get("announcement"), null);
    }],

    ["starting a trivia run-of-show break writes the live trivia payload", async () => {
      await roomRef.set({
        runOfShowDirector: {
          enabled: true,
          automationPaused: false,
          currentItemId: "",
          items: [
            {
              id: "trivia_break",
              type: "trivia_break",
              title: "Trivia Break",
              sequence: 1,
              status: "staged",
              visibility: "public",
              automationMode: "auto",
              plannedDurationSec: 18,
              modeLaunchPlan: {
                modeKey: "trivia_pop",
                launchConfig: {
                  question: "Which diva opened the fundraiser in 1989?",
                  options: ["Cher", "Madonna", "Whitney Houston", "Celine Dion"],
                  correctIndex: 2,
                  points: 120,
                  durationSec: 19,
                  autoReveal: true,
                },
              },
              presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: "trivia_break",
              },
            },
          ],
        },
      }, { merge: true });

      const result = await executeRunOfShowAction.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "start",
        itemId: "trivia_break",
      }));

      assert.equal(result.ok, true);
      const roomSnap = await roomRef.get();
      assert.equal(roomSnap.get("activeMode"), "trivia_pop");
      assert.equal(roomSnap.get("triviaQuestion.q"), "Which diva opened the fundraiser in 1989?");
      assert.deepEqual(roomSnap.get("triviaQuestion.options"), ["Cher", "Madonna", "Whitney Houston", "Celine Dion"]);
      assert.equal(roomSnap.get("triviaQuestion.correct"), 2);
      assert.equal(roomSnap.get("triviaQuestion.points"), 120);
      assert.equal(roomSnap.get("announcement"), null);
    }],

    ["starting a winner declaration block keeps the podium manual until the host declares winners", async () => {
      await roomRef.set({
        activeMode: "karaoke",
        activeScreen: "stage",
        roundWinnersMoment: null,
        runOfShowDirector: {
          enabled: true,
          automationPaused: false,
          currentItemId: "",
          items: [
            {
              id: "winner_block",
              type: "winner_declaration",
              title: "Hourly Door Prize Winners",
              sequence: 1,
              status: "staged",
              visibility: "public",
              automationMode: "auto",
              advanceMode: "host_after_min",
              hostAdvanceMinSec: 20,
              requireHostAdvance: true,
              plannedDurationSec: 75,
              notes: "Pick the podium before the next singer starts.",
              presentationPlan: {
                publicTvTakeoverEnabled: false,
                headline: "Hourly winners",
                subhead: "Pick gold, silver, and bronze before the next block starts.",
                takeoverScene: "winner_reveal",
                accentTheme: "amber",
              },
            },
          ],
        },
      }, { merge: true });

      const result = await executeRunOfShowAction.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "start",
        itemId: "winner_block",
      }));

      assert.equal(result.ok, true);
      const roomSnap = await roomRef.get();
      const liveItem = (roomSnap.get("runOfShowDirector.items") || []).find((entry) => entry.id === "winner_block");
      assert.equal(roomSnap.get("runOfShowDirector.currentItemId"), "winner_block");
      assert.equal(liveItem?.status, "live");
      assert.equal(roomSnap.get("announcement"), null);
      assert.equal(roomSnap.get("roundWinnersMoment"), null);
      assert.equal(roomSnap.get("activeMode"), "karaoke");
      assert.equal(roomSnap.get("activeScreen"), "stage");
    }],

    ["starting a generic game break writes launch payload without a takeover overlay", async () => {
      await roomRef.set({
        runOfShowDirector: {
          enabled: true,
          automationPaused: false,
          currentItemId: "",
          items: [
            {
              id: "team_pong_break",
              type: "game_break",
              title: "Team Pong Rally",
              sequence: 1,
              status: "staged",
              visibility: "public",
              automationMode: "auto",
              plannedDurationSec: 25,
              modeLaunchPlan: {
                modeKey: "team_pong",
                launchConfig: {
                  question: "Left side or right side?",
                  options: ["Left", "Right"],
                  durationSec: 25,
                },
              },
              presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: "game_break",
              },
            },
          ],
        },
      }, { merge: true });

      const result = await executeRunOfShowAction.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "start",
        itemId: "team_pong_break",
      }));

      assert.equal(result.ok, true);
      const roomSnap = await roomRef.get();
      assert.equal(roomSnap.get("activeMode"), "team_pong");
      assert.equal(roomSnap.get("gameData.question"), "Left side or right side?");
      assert.deepEqual(roomSnap.get("gameData.options"), ["Left", "Right"]);
      assert.equal(roomSnap.get("gameData.runOfShowItemId"), "team_pong_break");
      assert.equal(roomSnap.get("announcement"), null);
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    results.push(await runCase(name, fn));
  }
  if (results.some((passed) => !passed)) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
