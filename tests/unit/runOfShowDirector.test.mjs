import assert from "node:assert/strict";
import { test } from "vitest";
import {
  RUN_OF_SHOW_ADVANCE_MODES,
  RUN_OF_SHOW_OPERATOR_ROLES,
  RUN_OF_SHOW_PROGRAM_MODES,
  RUN_OF_SHOW_PERFORMER_MODES,
  buildRunOfShowQueueDocId,
  getRunOfShowBlockedActionLabel,
  getRunOfShowAdvanceMode,
  getRunOfShowHostAdvanceMinSec,
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
