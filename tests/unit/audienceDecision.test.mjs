import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  AUDIENCE_DECISION_DISPLAY_MODES,
  AUDIENCE_DECISION_STATUS,
  AUDIENCE_DECISION_TYPES,
  buildAudienceDecisionFromReleaseWindow,
  buildContinueOrRotateDecision,
  buildSkipPerformanceDecision,
  buildReleaseWindowFromAudienceDecision,
  getAudienceDecisionTally,
  normalizeAudienceDecision,
  resolveAudienceDecision,
} from '../../src/lib/audienceDecision.js';

test('audienceDecision normalizes One-Minute Mic continue-or-rotate defaults', () => {
  const decision = normalizeAudienceDecision({
    type: AUDIENCE_DECISION_TYPES.continueOrRotate,
    openedAtMs: 1000,
    votesByUid: {
      guest_1: 'keep_singing',
      guest_2: 'next_singer',
      guest_3: 'invalid_choice',
    },
  }, {
    nowMs: 1000,
  });

  assert.equal(decision.category, 'performance_progression');
  assert.equal(decision.prompt, 'Keep it going?');
  assert.equal(decision.displayMode, AUDIENCE_DECISION_DISPLAY_MODES.glassOverlay);
  assert.equal(decision.durationSec, 12);
  assert.equal(decision.openingWindowSec, 60);
  assert.equal(decision.minimumVotes, 1);
  assert.equal(decision.thresholdMode, 'choice_threshold');
  assert.equal(decision.thresholdChoiceId, 'next_singer');
  assert.equal(decision.thresholdPct, 55);
  assert.equal(decision.fallbackChoiceId, 'keep_singing');
  assert.deepEqual(Object.keys(decision.votesByUid), ['guest_1', 'guest_2']);
});

test('audienceDecision rotates only when next singer clears the protected threshold', () => {
  const passing = resolveAudienceDecision({
    type: AUDIENCE_DECISION_TYPES.continueOrRotate,
    openedAtMs: 1000,
    closesAtMs: 13_000,
    votesByUid: {
      guest_1: 'keep_singing',
      guest_2: 'keep_singing',
      guest_3: 'next_singer',
    },
  }, {
    nowMs: 13_000,
  });

  assert.equal(passing.resolved, true);
  assert.equal(passing.resultChoice, 'keep_singing');
  assert.equal(passing.resolutionAction, 'continue_song');
  assert.equal(passing.decision.status, AUDIENCE_DECISION_STATUS.resolved);

  const smallRoomPassing = resolveAudienceDecision({
    type: AUDIENCE_DECISION_TYPES.continueOrRotate,
    openedAtMs: 1000,
    closesAtMs: 13_000,
    votesByUid: {
      guest_1: 'keep_singing',
    },
  }, {
    nowMs: 13_000,
  });

  assert.equal(smallRoomPassing.resolved, true);
  assert.equal(smallRoomPassing.resultChoice, 'keep_singing');
  assert.equal(smallRoomPassing.resolutionAction, 'continue_song');

  const rotating = resolveAudienceDecision({
    type: AUDIENCE_DECISION_TYPES.continueOrRotate,
    openedAtMs: 1000,
    closesAtMs: 13_000,
    votesByUid: {
      guest_1: 'keep_singing',
      guest_2: 'next_singer',
      guest_3: 'next_singer',
    },
  }, {
    nowMs: 13_000,
  });

  assert.equal(rotating.resolved, true);
  assert.equal(rotating.resultChoice, 'next_singer');
  assert.equal(rotating.resolutionAction, 'wrap_and_rotate');
});

test('audienceDecision keeps the singer on an exact tie', () => {
  const tied = resolveAudienceDecision({
    type: AUDIENCE_DECISION_TYPES.continueOrRotate,
    openedAtMs: 1000,
    closesAtMs: 13_000,
    votesByUid: {
      guest_1: 'keep_singing',
      guest_2: 'keep_singing',
      guest_3: 'next_singer',
      guest_4: 'next_singer',
    },
  }, {
    nowMs: 13_000,
  });

  assert.equal(tied.resultChoice, 'keep_singing');
  assert.equal(tied.resolutionAction, 'continue_song');
  assert.equal(tied.resolutionReason, 'tie_keeps_singer');
  assert.equal(tied.decision.resolutionReason, 'tie_keeps_singer');
});

test('audienceDecision treats performance skip as a guarded supermajority-style decision', () => {
  const decision = normalizeAudienceDecision({
    type: AUDIENCE_DECISION_TYPES.skipPerformance,
    openedAtMs: 5000,
  }, {
    nowMs: 5000,
  });

  assert.equal(decision.sensitive, true);
  assert.equal(decision.hostOverrideEnabled, true);
  assert.equal(decision.minElapsedSec, 90);
  assert.equal(decision.minimumVotes, 8);
  assert.equal(decision.thresholdPct, 70);
  assert.equal(decision.prompt, 'Keep going or move to the next singer?');
  assert.deepEqual(decision.choices.map((choice) => choice.label), ['Keep Going', 'Move To Next']);
});

test('audienceDecision tallies generic room choices without counting invalid votes', () => {
  const tally = getAudienceDecisionTally({
    type: AUDIENCE_DECISION_TYPES.skipOrWait,
    votesByUid: {
      guest_1: 'wait',
      guest_2: 'skip',
      guest_3: 'skip',
      guest_4: 'banana',
    },
  });

  assert.equal(tally.totalVotes, 3);
  assert.equal(tally.leadingChoice, 'skip');
  assert.equal(tally.countsByChoice.wait, 1);
  assert.equal(tally.countsByChoice.skip, 2);
});

test('audienceDecision adapts existing release windows into the generic model', () => {
  const decision = buildAudienceDecisionFromReleaseWindow({
    active: true,
    itemId: 'queue_faceoff:song_a:song_b',
    subjectType: 'queue_faceoff',
    prompt: 'Crowd pick the next spotlight.',
    openedAtMs: 2000,
    closesAtMs: 20_000,
    choiceLabels: {
      slot_scene: 'Valerie',
      keep_queue_moving: 'Mr. Brightside',
    },
    choiceDetails: {
      slot_scene: 'Jamie',
      keep_queue_moving: 'Alex',
    },
    votesByUid: {
      guest_1: 'slot_scene',
    },
  }, {
    displayMode: 'glass_overlay',
    nowMs: 3000,
  });

  assert.equal(decision.type, AUDIENCE_DECISION_TYPES.queueFaceoff);
  assert.equal(decision.status, AUDIENCE_DECISION_STATUS.open);
  assert.equal(decision.displayMode, 'glass_overlay');
  assert.equal(decision.prompt, 'Crowd pick the next spotlight.');
  assert.deepEqual(decision.choices.map((choice) => choice.label), ['Valerie', 'Mr. Brightside']);
  assert.deepEqual(decision.choices.map((choice) => choice.detail), ['Jamie', 'Alex']);
  assert.deepEqual(decision.votesByUid, { guest_1: 'slot_scene' });
});
test('audienceDecision adapts generic decisions back into release-window presentation', () => {
  const releaseWindow = buildReleaseWindowFromAudienceDecision({
    id: 'one_minute_vote_1',
    type: AUDIENCE_DECISION_TYPES.continueOrRotate,
    status: AUDIENCE_DECISION_STATUS.open,
    songTitle: 'Valerie',
    artistName: 'Amy Winehouse',
    singerName: 'Jamie',
    choices: [
      { id: 'keep_singing', label: 'Keep Singing', detail: 'Jamie', subline: 'Amy Winehouse', resultAction: 'continue_song', tone: 'cyan' },
      { id: 'next_singer', label: 'Next Singer', detail: 'Rotate the mic', subline: 'Keep the queue moving', resultAction: 'wrap_and_rotate', tone: 'pink' },
    ],
    openedAtMs: 1000,
    closesAtMs: 13_000,
    votesByUid: {
      guest_1: 'keep_singing',
      guest_2: 'next_singer',
    },
  }, {
    nowMs: 2000,
  });

  assert.equal(releaseWindow.active, true);
  assert.equal(releaseWindow.subjectType, AUDIENCE_DECISION_TYPES.continueOrRotate);
  assert.equal(releaseWindow.governanceMode, 'crowd_vote');
  assert.equal(releaseWindow.subjectTitle, 'Valerie');
  assert.equal(releaseWindow.subjectSubtitle, 'Amy Winehouse');
  assert.equal(releaseWindow.choiceLabels.slot_scene, 'Keep Singing');
  assert.equal(releaseWindow.choiceLabels.keep_queue_moving, 'Next Singer');
  assert.equal(releaseWindow.choiceSublines.slot_scene, 'Amy Winehouse');
  assert.equal(releaseWindow.choiceSublines.keep_queue_moving, 'Keep the queue moving');
  assert.equal(releaseWindow.choiceAudienceDecisionIds.slot_scene, 'keep_singing');
  assert.equal(releaseWindow.choiceAudienceDecisionIds.keep_queue_moving, 'next_singer');
  assert.deepEqual(releaseWindow.votesByUid, {
    guest_1: 'slot_scene',
    guest_2: 'keep_queue_moving',
  });
});
test('audienceDecision builds a live One-Minute Mic decision payload', () => {
  const decision = buildContinueOrRotateDecision({
    songId: 'song_123',
    songTitle: 'Valerie',
    singerName: 'Jamie',
    artistName: 'Amy Winehouse',
    performanceSessionId: 'session_abc',
    openedAtMs: 60_000,
    voteWindowSec: 12,
    openingWindowSec: 60,
  });

  assert.equal(decision.type, AUDIENCE_DECISION_TYPES.continueOrRotate);
  assert.equal(decision.status, AUDIENCE_DECISION_STATUS.open);
  assert.equal(decision.subjectSongId, 'song_123');
  assert.equal(decision.subjectSessionId, 'session_abc');
  assert.equal(decision.openedAtMs, 60_000);
  assert.equal(decision.closesAtMs, 72_000);
  assert.equal(decision.prompt, 'Keep singing or next singer?');
  assert.equal(decision.thresholdChoiceId, 'next_singer');
  assert.equal(decision.fallbackChoiceId, 'keep_singing');
  assert.deepEqual(decision.choices.map((choice) => choice.id), ['keep_singing', 'next_singer']);
  assert.deepEqual(decision.choices.map((choice) => choice.resultAction), ['continue_song', 'wrap_and_rotate']);
});

test('audienceDecision builds and resolves guarded skip-performance votes', () => {
  const decision = buildSkipPerformanceDecision({
    songId: 'song_123',
    songTitle: 'Valerie',
    singerName: 'Jamie',
    artistName: 'Amy Winehouse',
    performanceSessionId: 'session_abc',
    openedAtMs: 100_000,
    voteWindowSec: 15,
    minElapsedSec: 90,
  });

  assert.equal(decision.type, AUDIENCE_DECISION_TYPES.skipPerformance);
  assert.equal(decision.status, AUDIENCE_DECISION_STATUS.open);
  assert.equal(decision.prompt, 'Keep going or move on?');
  assert.equal(decision.minimumVotes, 8);
  assert.equal(decision.thresholdChoiceId, 'next_singer');
  assert.equal(decision.thresholdPct, 70);
  assert.equal(decision.fallbackChoiceId, 'keep_singing');
  assert.equal(decision.sensitive, true);

  const protectedFallback = resolveAudienceDecision({
    ...decision,
    votesByUid: {
      u1: 'next_singer',
      u2: 'next_singer',
      u3: 'next_singer',
      u4: 'next_singer',
      u5: 'next_singer',
      u6: 'keep_singing',
      u7: 'keep_singing',
    },
  }, {
    nowMs: 115_000,
  });

  assert.equal(protectedFallback.resultChoice, 'keep_singing');
  assert.equal(protectedFallback.resolutionAction, 'continue_song');

  const passing = resolveAudienceDecision({
    ...decision,
    votesByUid: {
      u1: 'next_singer',
      u2: 'next_singer',
      u3: 'next_singer',
      u4: 'next_singer',
      u5: 'next_singer',
      u6: 'next_singer',
      u7: 'keep_singing',
      u8: 'keep_singing',
    },
  }, {
    nowMs: 115_000,
  });

  assert.equal(passing.resultChoice, 'next_singer');
  assert.equal(passing.resolutionAction, 'graceful_early_wrap');
});
