import assert from "node:assert/strict";
import { test } from "vitest";
import {
  RUN_OF_SHOW_ADVANCE_MODES,
  RUN_OF_SHOW_OPERATOR_ROLES,
  RUN_OF_SHOW_PROGRAM_MODES,
  RUN_OF_SHOW_PERFORMER_MODES,
  buildRunOfShowQueueDocId,
  getRunOfShowConveyorPhase,
  getRunOfShowConveyorSnapshot,
  getRunOfShowReleaseWindowTally,
  getRunOfShowAutomationPauseState,
  getRunOfShowBlockedActionLabel,
  getRunOfShowAdvanceMode,
  getRunOfShowHostAdvanceMinSec,
  getRunOfShowHudState,
  createRunOfShowItem,
  createDefaultRunOfShowDirector,
  getRunOfShowOperatorRole,
  getRunOfShowRoleCapabilities,
  getRunOfShowOperatingHint,
  getRunOfShowItemReadiness,
  getRunOfShowOpenSubmissionItems,
  getRunOfShowPublicItems,
  getRunOfShowProgressionDecision,
  hasRunOfShowBackingIdentity,
  hasRunOfShowTakeoverSoundtrackIdentity,
  isApprovedAutomationSource,
  isRunOfShowItemReady,
  normalizeRunOfShowPolicy,
  normalizeRunOfShowRoles,
  normalizeRunOfShowTemplateMeta,
  normalizeRunOfShowDirector,
  normalizeRunOfShowProgramMode,
  updateRunOfShowItem,
} from "../../src/lib/runOfShowDirector.js";

test("runOfShowDirector normalizes director state and performance readiness", () => {
  assert.equal(normalizeRunOfShowProgramMode("run_of_show"), RUN_OF_SHOW_PROGRAM_MODES.runOfShow);
  assert.equal(normalizeRunOfShowProgramMode("anything"), RUN_OF_SHOW_PROGRAM_MODES.standard);

  const director = normalizeRunOfShowDirector(createDefaultRunOfShowDirector({
    enabled: true,
    items: [
      createRunOfShowItem("performance", {
        performerMode: RUN_OF_SHOW_PERFORMER_MODES.openSubmission,
        title: "Open Slot",
        songTitle: "Dreams",
        assignedPerformerName: "Alex",
        backingPlan: {
          sourceType: "youtube",
          youtubeId: "abc123xyz89",
          approvalStatus: "approved",
          playbackReady: true,
        },
      }),
      createRunOfShowItem("announcement", {
        visibility: "private",
        title: "Host Note",
      }),
    ],
  }));

  assert.equal(director.items.length, 2);
  assert.equal(director.items[0].sequence, 1);
  assert.equal(getRunOfShowAdvanceMode(director.items[0]), RUN_OF_SHOW_ADVANCE_MODES.auto);
  assert.equal(getRunOfShowHostAdvanceMinSec(director.items[0]), 0);
  assert.equal(hasRunOfShowBackingIdentity(director.items[0].backingPlan), true);
  assert.equal(isApprovedAutomationSource(director.items[0].backingPlan), true);
  assert.equal(isRunOfShowItemReady(director.items[0]), true);
  assert.equal(getRunOfShowOpenSubmissionItems(director).length, 1);
  assert.equal(getRunOfShowPublicItems(director).length, 1);
  assert.equal(director.holdCurrent, false);
  assert.equal(director.holdAfterCurrent, false);
});

test("runOfShowDirector updates item state and blocks unapproved user-submitted backing", () => {
  const director = createDefaultRunOfShowDirector({
    items: [
      createRunOfShowItem("performance", {
        title: "Pending Slot",
        assignedPerformerName: "Sam",
        songTitle: "Halo",
        backingPlan: {
          sourceType: "user_submitted",
          submittedBackingId: "sub_123",
          approvalStatus: "pending",
          playbackReady: true,
        },
      }),
    ],
  });

  const item = normalizeRunOfShowDirector(director).items[0];
  assert.equal(isApprovedAutomationSource(item.backingPlan), false);
  assert.equal(isRunOfShowItemReady(item), false);

  const updated = updateRunOfShowItem(director, item.id, (current) => ({
    backingPlan: {
      ...current.backingPlan,
      approvalStatus: "approved",
    },
    status: "ready",
  }));

  const nextItem = normalizeRunOfShowDirector(updated).items[0];
  assert.equal(nextItem.status, "ready");
  assert.equal(isRunOfShowItemReady(nextItem), true);
  assert.equal(buildRunOfShowQueueDocId("br12", nextItem.id).startsWith("ros_BR12_"), true);
});

test("runOfShowDirector derives conveyor phases without changing stored statuses", () => {
  const draftItem = createRunOfShowItem("announcement", {
    title: "Doors",
    status: "draft",
  });
  const readyItem = createRunOfShowItem("announcement", {
    title: "Sponsor beat",
    status: "ready",
  });
  const stagedItem = createRunOfShowItem("performance", {
    title: "Feature singer",
    status: "staged",
  });
  const liveItem = createRunOfShowItem("announcement", {
    title: "Live host beat",
    status: "live",
  });
  const blockedItem = createRunOfShowItem("performance", {
    title: "Needs backing",
    status: "blocked",
  });

  const director = createDefaultRunOfShowDirector({
    items: [liveItem, stagedItem, readyItem, draftItem, blockedItem],
  });

  const snapshot = getRunOfShowConveyorSnapshot(director);
  assert.equal(snapshot.liveItem?.id, liveItem.id);
  assert.equal(snapshot.flightedItem?.id, stagedItem.id);
  assert.equal(snapshot.onDeckItem?.id, readyItem.id);
  assert.deepEqual(snapshot.laterItems.map((item) => item.id), [draftItem.id, blockedItem.id]);

  assert.equal(getRunOfShowConveyorPhase(director, liveItem), "live");
  assert.equal(getRunOfShowConveyorPhase(director, stagedItem), "flighted");
  assert.equal(getRunOfShowConveyorPhase(director, readyItem), "on_deck");
  assert.equal(getRunOfShowConveyorPhase(director, draftItem), "planned");
  assert.equal(getRunOfShowConveyorPhase(director, blockedItem), "blocked");
  assert.equal(normalizeRunOfShowDirector(director).items.find((item) => item.id === readyItem.id)?.beltPhase, "on_deck");
  assert.equal(normalizeRunOfShowDirector(director).items.find((item) => item.id === stagedItem.id)?.beltPhase, "flighted");
});

test("runOfShowDirector normalizes release-window governance defaults", () => {
  const optionalItem = createRunOfShowItem("would_you_rather_break", {
    title: "Crowd pick"
  });
  const director = normalizeRunOfShowDirector(createDefaultRunOfShowDirector({
    items: [optionalItem],
    releaseWindow: {
      active: true,
      itemId: optionalItem.id,
      governanceMode: "cohost_vote",
      votesByUid: {
        co_1: "slot_scene",
        stranger: "keep_queue_moving"
      }
    }
  }));

  assert.equal(director.items[0].governanceMode, "crowd_signal");
  assert.equal(director.items[0].releasePolicy, "suggest_then_host_confirm");
  assert.equal(director.releaseWindow.active, true);
  assert.equal(director.releaseWindow.governanceMode, "cohost_vote");
  assert.deepEqual(
    director.releaseWindow.votesByUid,
    {
      co_1: "slot_scene",
      stranger: "keep_queue_moving"
    }
  );
  assert.deepEqual(
    getRunOfShowReleaseWindowTally(director.releaseWindow, { coHosts: ["co_1"] }),
    {
      slotSceneCount: 1,
      keepQueueMovingCount: 0,
      totalVotes: 1,
      leadingChoice: "slot_scene",
      summary: "1-0 favor slotting the scene"
    }
  );
});

test("runOfShowDirector preserves in-progress spacing for editable text fields", () => {
  const director = createDefaultRunOfShowDirector({
    items: [
      createRunOfShowItem("performance", {
        title: "Performance Slot 1",
        assignedPerformerName: "Jordan",
        songTitle: "Dreams",
        artistName: "Fleetwood Mac",
        notes: "Warm up the room",
      }),
    ],
  });

  const item = normalizeRunOfShowDirector(director).items[0];
  const updated = updateRunOfShowItem(director, item.id, () => ({
    title: "Performance Slot 1 ",
    assignedPerformerName: "Jordan ",
    songTitle: "Dreams ",
    artistName: "Fleetwood Mac ",
    notes: "Warm up the room ",
    presentationPlan: {
      headline: "Sing along ",
      subhead: "Big chorus ",
    },
  }));

  const nextItem = normalizeRunOfShowDirector(updated).items[0];
  assert.equal(nextItem.title, "Performance Slot 1 ");
  assert.equal(nextItem.assignedPerformerName, "Jordan ");
  assert.equal(nextItem.songTitle, "Dreams ");
  assert.equal(nextItem.artistName, "Fleetwood Mac ");
  assert.equal(nextItem.notes, "Warm up the room ");
  assert.equal(nextItem.presentationPlan.headline, "Sing along ");
  assert.equal(nextItem.presentationPlan.subhead, "Big chorus ");
});

test("runOfShowDirector reports actionable readiness blockers for host UI", () => {
  const item = createRunOfShowItem("performance", {
    performerMode: RUN_OF_SHOW_PERFORMER_MODES.openSubmission,
    title: "Open Feature Slot",
    backingPlan: {
      sourceType: "manual_external",
      approvalStatus: "approved",
      playbackReady: false,
    },
  });

  const readiness = getRunOfShowItemReadiness(item, { pendingSubmissionCount: 2 });
  assert.equal(readiness.ready, false);
  assert.deepEqual(
    readiness.blockers.map((entry) => entry.key),
    [
      "performer_submission_pending",
      "song_missing",
      "backing_manual_external",
    ],
  );
  assert.match(readiness.summary, /Approve one of the 2 pending submissions/i);
});

test("runOfShowDirector supports built-in background tracks for takeover soundtracks", () => {
  const readyItem = createRunOfShowItem("announcement", {
    title: "Intro",
    presentationPlan: {
      publicTvTakeoverEnabled: true,
      takeoverScene: "intro",
      headline: "Welcome in",
      soundtrackSourceType: "bg_track",
      soundtrackBgTrackId: "retro_lounge",
      soundtrackMediaUrl: "https://cdn.example.com/retro-lounge.mp3",
      soundtrackAutoPlay: true,
    },
  });
  const missingTrackItem = createRunOfShowItem("announcement", {
    title: "Intermission",
    presentationPlan: {
      publicTvTakeoverEnabled: true,
      takeoverScene: "intermission",
      headline: "Quick reset",
      soundtrackSourceType: "bg_track",
      soundtrackAutoPlay: true,
    },
  });

  assert.equal(hasRunOfShowTakeoverSoundtrackIdentity(readyItem.presentationPlan), true);

  const readiness = getRunOfShowItemReadiness(missingTrackItem);
  assert.equal(readiness.ready, false);
  assert.match(readiness.summary, /built-in background tracks/i);
});

test("runOfShowDirector normalizes operator roles and template metadata", () => {
  const roles = normalizeRunOfShowRoles({
    coHosts: ["co_1", "co_1", " "],
    stageManagers: ["stage_1"],
    mediaCurators: ["media_1"],
  });
  const templateMeta = normalizeRunOfShowTemplateMeta({
    currentTemplateId: " template_main ",
    currentTemplateName: " Main Night ",
    lastArchiveId: "archive_1",
    archivedAtMs: "1234",
  });

  assert.deepEqual(roles, {
    coHosts: ["co_1", "stage_1", "media_1"],
  });
  assert.equal(templateMeta.currentTemplateId, "template_main");
  assert.equal(templateMeta.currentTemplateName, "Main Night");
  assert.equal(templateMeta.archivedAtMs, 1234);

  assert.equal(getRunOfShowOperatorRole({
    uid: "stage_1",
    hostUid: "host_1",
    hostUids: [],
    roles,
  }), RUN_OF_SHOW_OPERATOR_ROLES.coHost);
  assert.equal(getRunOfShowRoleCapabilities(RUN_OF_SHOW_OPERATOR_ROLES.coHost).canCurateMedia, true);
  assert.equal(getRunOfShowRoleCapabilities(RUN_OF_SHOW_OPERATOR_ROLES.coHost).canPauseAutomation, false);
});

test("runOfShowDirector operating hints reflect blocked policy decisions", () => {
  const policy = normalizeRunOfShowPolicy({
    noShowPolicy: "pull_from_queue",
    blockedActionPolicy: "manual_override_allowed",
    queueDivergencePolicy: "queue_can_fill_gaps",
  });
  const item = createRunOfShowItem("performance", {
    status: "blocked",
    backingPlan: {
      sourceType: "manual_external",
      approvalStatus: "pending",
      playbackReady: false,
    },
  });
  const readiness = getRunOfShowItemReadiness(item, { pendingSubmissionCount: 0 });

  assert.match(getRunOfShowBlockedActionLabel(readiness, item, policy), /pull a queue-ready replacement/i);
  assert.match(getRunOfShowOperatingHint({ item, readiness, policy }), /pull a queue-ready replacement/i);
});

test("runOfShowDirector derives auto-pause state when the next performance is waiting on a singer", () => {
  const policy = normalizeRunOfShowPolicy({
    noShowPolicy: "pull_from_queue",
  });
  const pendingApprovalItem = createRunOfShowItem("performance", {
    performerMode: RUN_OF_SHOW_PERFORMER_MODES.openSubmission,
    title: "Open Slot",
    songTitle: "Dreams",
    backingPlan: {
      sourceType: "youtube",
      youtubeId: "abc123xyz89",
      approvalStatus: "approved",
      playbackReady: true,
    },
  });
  const missingSingerItem = createRunOfShowItem("performance", {
    title: "Featured Guest",
    songTitle: "Dreams",
    backingPlan: {
      sourceType: "youtube",
      youtubeId: "abc123xyz89",
      approvalStatus: "approved",
      playbackReady: true,
    },
  });

  assert.deepEqual(
    getRunOfShowAutomationPauseState({
      item: pendingApprovalItem,
      policy,
      pendingSubmissionCount: 2,
    }),
    {
      status: "waiting_for_performer",
      detail: "Approve one of the 2 pending submissions or assign a performer manually.",
    },
  );
  assert.match(
    getRunOfShowAutomationPauseState({
      item: missingSingerItem,
      policy,
      pendingSubmissionCount: 0,
    }).detail,
    /pull a queue-ready replacement/i,
  );
});

test("runOfShowDirector paused hud surfaces the active issue detail", () => {
  assert.deepEqual(
    getRunOfShowHudState({
      hasPlan: true,
      runEnabled: true,
      automationPaused: true,
      issueDetail: "Approve the next singer before auto can continue.",
    }),
    {
      title: "Needs attention",
      detail: "Approve the next singer before auto can continue.",
      tone: "warning",
    },
  );
});

test("runOfShowDirector progression decisions block timed completion when host advance is required", () => {
  const liveAnnouncement = createRunOfShowItem("announcement", {
    id: "announce_live",
    status: "live",
    automationMode: "auto",
    requireHostAdvance: true,
    plannedDurationSec: 45,
  });
  const stagedAnnouncement = createRunOfShowItem("announcement", {
    id: "announce_staged",
    status: "staged",
    automationMode: "manual",
  });
  const director = normalizeRunOfShowDirector(createDefaultRunOfShowDirector({
    items: [liveAnnouncement, stagedAnnouncement],
  }));

  assert.deepEqual(
    getRunOfShowProgressionDecision({
      director,
      item: director.items[0],
      phase: "complete",
    }),
    { allowed: false, reason: "require_host_advance" },
  );
  assert.deepEqual(
    getRunOfShowProgressionDecision({
      director,
      item: director.items[1],
      phase: "start",
    }),
    { allowed: false, reason: "item_manual_start" },
  );
});

test("runOfShowDirector gives winner declaration blocks host-controlled defaults", () => {
  const item = createRunOfShowItem("winner_declaration", {
    title: "Hourly Door Prize Winners",
  });

  assert.equal(item.plannedDurationSec, 75);
  assert.equal(item.advanceMode, "host_after_min");
  assert.equal(item.hostAdvanceMinSec, 20);
  assert.equal(item.requireHostAdvance, true);
  assert.equal(isRunOfShowItemReady(item), true);
});

test("runOfShowDirector seeds trivia and WYR breaks from the built-in question banks", () => {
  const triviaItem = createRunOfShowItem("trivia_break", {
    modeLaunchPlan: {
      modeKey: "trivia_pop",
    },
  }, 123456);
  const wyrItem = createRunOfShowItem("would_you_rather_break", {
    modeLaunchPlan: {
      modeKey: "wyr",
    },
  }, 123456);

  assert.match(triviaItem.modeLaunchPlan.launchConfig.question, /\?/);
  assert.equal(Array.isArray(triviaItem.modeLaunchPlan.launchConfig.options), true);
  assert.equal(triviaItem.modeLaunchPlan.launchConfig.options.length, 4);
  assert.equal(triviaItem.modeLaunchPlan.launchConfig.contentSource, "builtin_bank");
  assert.equal(getRunOfShowItemReadiness(triviaItem).ready, true);

  assert.match(wyrItem.modeLaunchPlan.launchConfig.question, /\?/);
  assert.equal(Array.isArray(wyrItem.modeLaunchPlan.launchConfig.options), true);
  assert.equal(wyrItem.modeLaunchPlan.launchConfig.options.length, 2);
  assert.equal(wyrItem.modeLaunchPlan.launchConfig.contentSource, "builtin_bank");
  assert.equal(getRunOfShowItemReadiness(wyrItem).ready, true);
});

test("runOfShowDirector upgrades old placeholder interactive breaks but blocks partial custom prompts", () => {
  const placeholderTriviaItem = createRunOfShowItem("trivia_break", {
    modeLaunchPlan: {
      modeKey: "trivia_pop",
      launchConfig: {
        question: "Quick room trivia check-in",
        optionsCsv: "Option A, Option B, Option C"
      },
    },
  }, 123456);
  const partialCustomTriviaItem = createRunOfShowItem("trivia_break", {
    modeLaunchPlan: {
      modeKey: "trivia_pop",
      launchConfig: {
        question: "Name the host's favorite encore song?",
      },
    },
  });

  assert.notEqual(
    placeholderTriviaItem.modeLaunchPlan.launchConfig.question,
    "Quick room trivia check-in",
  );
  assert.equal(placeholderTriviaItem.modeLaunchPlan.launchConfig.options.length, 4);

  const readiness = getRunOfShowItemReadiness(partialCustomTriviaItem);
  assert.equal(readiness.ready, false);
  assert.deepEqual(
    readiness.blockers.map((entry) => entry.key),
    ["options_missing"],
  );
});

test("runOfShowDirector progression decisions respect host minimum live windows", () => {
  const now = Date.now();
  const liveAnnouncement = createRunOfShowItem("announcement", {
    id: "announce_live_min",
    status: "live",
    automationMode: "auto",
    advanceMode: "host_after_min",
    hostAdvanceMinSec: 90,
    liveStartedAtMs: now - 30_000,
  });
  const liveReadyAnnouncement = createRunOfShowItem("announcement", {
    id: "announce_live_ready",
    status: "live",
    automationMode: "auto",
    advanceMode: "host_after_min",
    hostAdvanceMinSec: 90,
    liveStartedAtMs: now - 120_000,
  });
  const director = normalizeRunOfShowDirector(createDefaultRunOfShowDirector({
    items: [liveAnnouncement, liveReadyAnnouncement],
  }));

  assert.equal(getRunOfShowAdvanceMode(director.items[0]), RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin);
  assert.equal(getRunOfShowHostAdvanceMinSec(director.items[0]), 90);
  assert.deepEqual(
    getRunOfShowProgressionDecision({
      director,
      item: director.items[0],
      phase: "complete",
    }),
    { allowed: false, reason: "host_advance_min_not_reached" },
  );
  assert.deepEqual(
    getRunOfShowProgressionDecision({
      director,
      item: director.items[1],
      phase: "complete",
    }),
    { allowed: false, reason: "ready_for_host_advance" },
  );
});

test("runOfShowDirector progression decisions respect hold flags", () => {
  const liveAnnouncement = createRunOfShowItem("announcement", {
    id: "announce_live",
    status: "live",
    automationMode: "auto",
  });
  const stagedAnnouncement = createRunOfShowItem("announcement", {
    id: "announce_staged",
    status: "staged",
    automationMode: "auto",
  });
  const holdCurrentDirector = normalizeRunOfShowDirector(createDefaultRunOfShowDirector({
    holdCurrent: true,
    items: [liveAnnouncement],
  }));
  const holdAfterDirector = normalizeRunOfShowDirector(createDefaultRunOfShowDirector({
    holdAfterCurrent: true,
    items: [stagedAnnouncement],
  }));

  assert.deepEqual(
    getRunOfShowProgressionDecision({
      director: holdCurrentDirector,
      item: holdCurrentDirector.items[0],
      phase: "complete",
    }),
    { allowed: false, reason: "hold_current" },
  );
  assert.deepEqual(
    getRunOfShowProgressionDecision({
      director: holdAfterDirector,
      item: holdAfterDirector.items[0],
      phase: "start",
    }),
    { allowed: false, reason: "hold_after_current" },
  );
});

test("runOfShowDirector preserves media-scene takeover fields for custom TV moments", () => {
  const item = createRunOfShowItem("announcement", {
    title: "Sponsor Flyer",
    presentationPlan: {
      publicTvTakeoverEnabled: true,
      takeoverScene: "media_scene",
      headline: "Sponsor Flyer",
      mediaSceneUrl: "https://cdn.example.com/flyer.png",
      mediaSceneType: "image",
      mediaSceneFit: "contain",
    },
  });

  const normalizedItem = normalizeRunOfShowDirector(createDefaultRunOfShowDirector({
    items: [item],
  })).items[0];

  assert.equal(normalizedItem.presentationPlan.takeoverScene, "media_scene");
  assert.equal(normalizedItem.presentationPlan.mediaSceneUrl, "https://cdn.example.com/flyer.png");
  assert.equal(normalizedItem.presentationPlan.mediaSceneType, "image");
  assert.equal(normalizedItem.presentationPlan.mediaSceneFit, "contain");
});
