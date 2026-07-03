import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildAudienceLedQueueFaceOffPlan,
  buildOneMinuteMicAdvancePlan,
  buildOneMinuteMicFinalizePlan,
  buildOneMinuteMicRoomPatch,
  buildSkipPerformanceDecision,
} = require('../../functions/lib/audienceDecisionAutomation');

const baseRoom = {
  activeMode: 'karaoke',
  oneMinuteMicEnabled: true,
  oneMinuteMicOpeningWindowSec: 60,
  oneMinuteMicVoteWindowSec: 12,
  currentPerformanceSession: {
    sessionId: 'perf_song_a_1000',
    songId: 'song_a',
    startedAtMs: 1000,
  },
  currentPerformanceMeta: {
    songId: 'song_a',
    startedAtMs: 1000,
    songTitle: 'Go Time',
    singerName: 'Beau',
    artist: 'The Rocks',
  },
};

test('One-Minute Mic automation opens a continue-or-rotate decision after the configured mark', () => {
  const early = buildOneMinuteMicRoomPatch({
    room: baseRoom,
    roomCode: 'ROOM1',
    nowMs: 60000,
  });
  assert.equal(early, null);

  const patch = buildOneMinuteMicRoomPatch({
    room: baseRoom,
    roomCode: 'ROOM1',
    nowMs: 62000,
  });
  assert.equal(patch.audienceDecision.type, 'continue_or_rotate');
  assert.equal(patch.audienceDecision.status, 'open');
  assert.equal(patch.audienceDecision.subjectSongId, 'song_a');
  assert.equal(patch.audienceDecision.subjectSessionId, 'perf_song_a_1000');
  assert.equal(patch.audienceDecision.closesAtMs, 74000);
  assert.equal(patch.oneMinuteMicLastDecisionKey, 'song_a:perf_song_a_1000:61000');
});

test('One-Minute Mic automation resolves to continue without creating a finish command', () => {
  const openDecision = buildOneMinuteMicRoomPatch({
    room: baseRoom,
    roomCode: 'ROOM1',
    nowMs: 62000,
  }).audienceDecision;

  const patch = buildOneMinuteMicRoomPatch({
    room: {
      ...baseRoom,
      audienceDecision: {
        ...openDecision,
        votesByUid: {
          u1: 'keep_singing',
          u2: 'keep_singing',
          u3: 'next_singer',
        },
      },
    },
    roomCode: 'ROOM1',
    nowMs: 75000,
  });

  assert.equal(patch.audienceDecision.status, 'resolved');
  assert.equal(patch.audienceDecision.resultChoice, 'keep_singing');
  assert.equal(patch.audienceDecision.resolutionAction, 'continue_song');
  assert.equal('audienceAutomationCommand' in patch, false);
});

test('One-Minute Mic automation accepts one keep-singing vote in a small room', () => {
  const openDecision = buildOneMinuteMicRoomPatch({
    room: baseRoom,
    roomCode: 'ROOM1',
    nowMs: 62000,
  }).audienceDecision;

  const patch = buildOneMinuteMicRoomPatch({
    room: {
      ...baseRoom,
      audienceDecision: {
        ...openDecision,
        votesByUid: {
          solo_guest: 'keep_singing',
        },
      },
    },
    roomCode: 'ROOM1',
    nowMs: 75000,
  });

  assert.equal(patch.audienceDecision.status, 'resolved');
  assert.equal(patch.audienceDecision.resultChoice, 'keep_singing');
  assert.equal(patch.audienceDecision.resolutionAction, 'continue_song');
  assert.equal('audienceAutomationCommand' in patch, false);
});

test('One-Minute Mic automation resolves to rotate by holding karaoke through a fade window', () => {
  const openDecision = buildOneMinuteMicRoomPatch({
    room: baseRoom,
    roomCode: 'ROOM1',
    nowMs: 62000,
  }).audienceDecision;

  const patch = buildOneMinuteMicRoomPatch({
    room: {
      ...baseRoom,
      audienceDecision: {
        ...openDecision,
        votesByUid: {
          u1: 'next_singer',
          u2: 'keep_singing',
          u3: 'next_singer',
        },
      },
    },
    roomCode: 'ROOM1',
    nowMs: 75000,
  });

  assert.equal(patch.audienceDecision.status, 'resolved');
  assert.equal(patch.audienceDecision.resultChoice, 'next_singer');
  assert.equal(patch.audienceDecision.resolutionAction, 'wrap_and_rotate');
  assert.equal(patch.activeMode, 'karaoke');
  assert.equal(patch.audienceAutomationCommand.action, 'finish_performance');
  assert.equal(patch.audienceAutomationCommand.status, 'fade_pending');
  assert.equal(patch.audienceAutomationCommand.songId, 'song_a');
  assert.ok(patch.audienceAutomationCommand.fadeEndsAtMs > patch.audienceAutomationCommand.fadeStartedAtMs);
  assert.equal(patch.oneMinuteMicWrapCue.type, 'rotate_fade');
  assert.equal('applauseSubject' in patch, false);
});

test('One-Minute Mic automation starts server applause after the rotate fade window', () => {
  const openDecision = buildOneMinuteMicRoomPatch({
    room: baseRoom,
    roomCode: 'ROOM1',
    nowMs: 62000,
  }).audienceDecision;
  const fadePatch = buildOneMinuteMicRoomPatch({
    room: {
      ...baseRoom,
      audienceDecision: {
        ...openDecision,
        votesByUid: {
          u1: 'next_singer',
          u2: 'keep_singing',
          u3: 'next_singer',
        },
      },
    },
    roomCode: 'ROOM1',
    nowMs: 75000,
  });

  const patch = buildOneMinuteMicRoomPatch({
    room: {
      ...baseRoom,
      audienceDecision: fadePatch.audienceDecision,
      audienceAutomationCommand: fadePatch.audienceAutomationCommand,
    },
    roomCode: 'ROOM1',
    nowMs: fadePatch.audienceAutomationCommand.fadeEndsAtMs + 100,
  });

  assert.equal(patch.activeMode, 'applause_countdown');
  assert.equal(patch.applauseSubject.autoFinalize, true);
  assert.equal(patch.applauseSubject.autoFinalizeSongId, 'song_a');
  assert.equal(patch.audienceAutomationCommand.action, 'finish_performance');
  assert.equal(patch.audienceAutomationCommand.status, 'server_started');
  assert.equal(patch.audienceAutomationCommand.songId, 'song_a');
  assert.equal(patch.oneMinuteMicWrapCue, null);
  assert.ok(patch.audienceAutomationCommand.finalizeAfterMs > patch.audienceAutomationCommand.createdAtMs);
});

test('One-Minute Mic automation finalizes server-started applause into a recap payload', () => {
  const plan = buildOneMinuteMicFinalizePlan({
    room: {
      ...baseRoom,
      roomCode: 'ROOM1',
      activeMode: 'karaoke',
      applausePeak: 83,
      autoBonusEnabled: true,
      autoBonusPoints: 25,
      audienceAutomationCommand: {
        id: 'one_minute_mic_rotate_ROOM1_song_a_perf_song_a_1000',
        source: 'one_minute_mic',
        action: 'finish_performance',
        status: 'server_started',
        songId: 'song_a',
        sessionId: 'perf_song_a_1000',
        createdAtMs: 75000,
        finalizeAfterMs: 85000,
      },
    },
    song: {
      id: 'song_a',
      songId: 'go_time_the_rocks',
      songTitle: 'Go Time',
      artist: 'The Rocks',
      singerName: 'Beau',
      hypeScore: 12,
      albumArtUrl: 'https://example.test/art.jpg',
      status: 'performing',
    },
    nextSongs: [
      { id: 'song_b', songTitle: 'Next Up', artist: 'Band', singerName: 'Alex', status: 'requested', priorityScore: 10 },
    ],
    nowMs: 90000,
  });

  assert.equal(plan.songId, 'song_a');
  assert.equal(plan.songPatch.status, 'performed');
  assert.equal(plan.songPatch.applauseScore, 83);
  assert.equal(plan.roomPatch.activeMode, 'karaoke');
  assert.equal(plan.roomPatch.currentPerformanceSession, null);
  assert.equal(plan.roomPatch.audienceAutomationCommand.status, 'server_consumed');
  assert.equal(plan.roomPatch.lastPerformance.recapScoreFinalized, true);
  assert.equal(plan.roomPatch.lastPerformance.totalPoints, 95);
  assert.equal(plan.roomPatch.lastPerformance.nextUpSnapshot[0].id, 'song_b');
});
test('One-Minute Mic automation advances the next playable queued singer after recap hold', () => {
  const plan = buildOneMinuteMicAdvancePlan({
    room: {
      activeMode: 'karaoke',
      oneMinuteMicEnabled: true,
      autoDj: true,
      autoDjDelaySec: 5,
      autoPlayMedia: true,
      lastPerformance: { timestamp: 100000 },
      currentPerformanceSession: null,
      currentPerformanceMeta: null,
    },
    songs: [
      { id: 'song_no_backing', status: 'requested', songTitle: 'No Backing', singerName: 'Nope', priorityScore: 1 },
      {
        id: 'song_next',
        status: 'requested',
        songTitle: 'Next Up',
        artist: 'Band',
        singerName: 'Alex',
        mediaUrl: 'https://www.youtube.com/watch?v=abc1234',
        duration: 210,
        priorityScore: 2,
      },
    ],
    nowMs: 106000,
  });

  assert.equal(plan.songId, 'song_next');
  assert.equal(plan.songPatch.status, 'performing');
  assert.equal(plan.roomPatch.activeMode, 'karaoke');
  assert.equal(plan.roomPatch.mediaUrl, 'https://www.youtube.com/watch?v=abc1234');
  assert.equal(plan.roomPatch.videoPlaying, true);
  assert.equal(plan.roomPatch.currentPerformanceMeta.songId, 'song_next');
  assert.equal(plan.roomPatch.currentPerformanceSession.songId, 'song_next');
  assert.equal(plan.roomPatch.currentPerformanceSession.sourceType, 'youtube');
});

test('One-Minute Mic automation waits through the server Auto-DJ hold before advancing', () => {
  const plan = buildOneMinuteMicAdvancePlan({
    room: {
      activeMode: 'karaoke',
      oneMinuteMicEnabled: true,
      autoDj: true,
      autoDjDelaySec: 10,
      lastPerformance: { timestamp: 100000 },
      currentPerformanceSession: null,
      currentPerformanceMeta: null,
    },
    songs: [
      { id: 'song_next', status: 'requested', mediaUrl: 'https://youtu.be/abc1234', priorityScore: 1 },
    ],
    nowMs: 105000,
  });

  assert.equal(plan, null);
});
test('One-Minute Mic automation resolves guarded crowd intervention into a graceful fade rotation', () => {
  const intervention = buildSkipPerformanceDecision({
    songId: 'song_a',
    songTitle: 'Go Time',
    singerName: 'Beau',
    artistName: 'The Rocks',
    performanceSessionId: 'perf_song_a_1000',
    openedAtMs: 100000,
    voteWindowSec: 15,
    minElapsedSec: 90,
  });

  const patch = buildOneMinuteMicRoomPatch({
    room: {
      ...baseRoom,
      audienceDecision: {
        ...intervention,
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
      },
    },
    roomCode: 'ROOM1',
    nowMs: 116000,
  });

  assert.equal(patch.audienceDecision.status, 'resolved');
  assert.equal(patch.audienceDecision.resultChoice, 'next_singer');
  assert.equal(patch.audienceDecision.resolutionAction, 'graceful_early_wrap');
  assert.equal(patch.activeMode, 'karaoke');
  assert.equal(patch.audienceAutomationCommand.action, 'finish_performance');
  assert.equal(patch.audienceAutomationCommand.status, 'fade_pending');
  assert.equal(patch.oneMinuteMicWrapCue.type, 'rotate_fade');
});

test('One-Minute Mic automation keeps singer when intervention misses protected threshold', () => {
  const intervention = buildSkipPerformanceDecision({
    songId: 'song_a',
    songTitle: 'Go Time',
    singerName: 'Beau',
    artistName: 'The Rocks',
    performanceSessionId: 'perf_song_a_1000',
    openedAtMs: 100000,
    voteWindowSec: 15,
    minElapsedSec: 90,
  });

  const patch = buildOneMinuteMicRoomPatch({
    room: {
      ...baseRoom,
      audienceDecision: {
        ...intervention,
        votesByUid: {
          u1: 'next_singer',
          u2: 'next_singer',
          u3: 'next_singer',
          u4: 'next_singer',
          u5: 'keep_singing',
          u6: 'keep_singing',
          u7: 'keep_singing',
          u8: 'keep_singing',
        },
      },
    },
    roomCode: 'ROOM1',
    nowMs: 116000,
  });

  assert.equal(patch.audienceDecision.status, 'resolved');
  assert.equal(patch.audienceDecision.resultChoice, 'keep_singing');
  assert.equal(patch.audienceDecision.resolutionAction, 'continue_song');
  assert.equal('audienceAutomationCommand' in patch, false);
});
test('audience-led Open Stage automation opens a between-performance song face-off with song metadata', () => {
  const patch = buildAudienceLedQueueFaceOffPlan({
    room: {
      activeMode: 'karaoke',
      selfServeMode: { enabled: true, format: 'open_stage' },
      lastPerformance: { timestamp: 100000 },
    },
    songs: [
      { id: 'song_a', status: 'requested', songTitle: 'Valerie', artist: 'Amy Winehouse', singerName: 'Alex', mediaUrl: 'https://youtu.be/aaa111', albumArtUrl: 'https://example.test/a.jpg', duration: 210, priorityScore: 10 },
      { id: 'song_b', status: 'requested', songTitle: 'Dreams', artist: 'Fleetwood Mac', singerName: 'Blair', mediaUrl: 'https://youtu.be/bbb222', albumArtUrl: 'https://example.test/b.jpg', duration: 258, priorityScore: 20 },
    ],
    nowMs: 120000,
  });

  assert.equal(patch.opened, true);
  assert.equal(patch.holdAdvance, true);
  assert.equal(patch.roomPatch.runOfShowDirector.releaseWindow.subjectType, 'queue_faceoff');
  assert.equal(patch.roomPatch.runOfShowDirector.releaseWindow.governanceMode, 'crowd_vote');
  assert.equal(patch.roomPatch.runOfShowDirector.releaseWindow.releasePolicy, 'auto_flight_winner');
  assert.equal(patch.roomPatch.runOfShowDirector.releaseWindow.origin, 'self_serve_open_stage_auto');
  assert.equal(patch.roomPatch.runOfShowDirector.releaseWindow.choiceLabels.slot_scene, 'Valerie');
  assert.equal(patch.roomPatch.runOfShowDirector.releaseWindow.choiceDetails.keep_queue_moving, 'Blair');
  assert.equal(patch.roomPatch.runOfShowDirector.releaseWindow.choiceSublines.slot_scene, 'Amy Winehouse - 3:30');
  assert.equal(patch.roomPatch.runOfShowDirector.releaseWindow.choiceArtworkUrls.keep_queue_moving, 'https://example.test/b.jpg');
  assert.equal(patch.roomPatch.selfServeMode.phase, 'crowd_vote');
  assert.equal(patch.roomPatch.selfServeMode.lastAutoFaceOffForCurrentId, 'between:100000');
});

test('audience-led Open Stage automation holds Auto-DJ while a crowd face-off is open', () => {
  const plan = buildAudienceLedQueueFaceOffPlan({
    room: {
      selfServeMode: { enabled: true, format: 'open_stage' },
      runOfShowDirector: {
        releaseWindow: {
          active: true,
          subjectType: 'queue_faceoff',
          origin: 'self_serve_open_stage_auto',
          openedAtMs: 120000,
          closesAtMs: 138000,
          choiceSongIds: { slot_scene: 'song_a', keep_queue_moving: 'song_b' },
          votesByUid: {},
        },
      },
    },
    songs: [],
    nowMs: 130000,
  });

  assert.equal(plan.holdAdvance, true);
  assert.equal(plan.reason, 'audience_faceoff_open');
  assert.equal(plan.roomPatch, undefined);
});

test('audience-led Open Stage automation resolves the vote and promotes the winning song next', () => {
  const plan = buildAudienceLedQueueFaceOffPlan({
    room: {
      selfServeMode: { enabled: true, format: 'open_stage', lastAutoFaceOffForCurrentId: 'between:100000' },
      runOfShowDirector: {
        releaseWindow: {
          active: true,
          subjectType: 'queue_faceoff',
          origin: 'self_serve_open_stage_auto',
          openedAtMs: 120000,
          closesAtMs: 138000,
          choiceSongIds: { slot_scene: 'song_a', keep_queue_moving: 'song_b' },
          votesByUid: { u1: 'keep_queue_moving', u2: 'keep_queue_moving', u3: 'slot_scene' },
        },
      },
    },
    songs: [
      { id: 'song_a', status: 'requested', songTitle: 'Valerie', mediaUrl: 'https://youtu.be/aaa111', priorityScore: 10 },
      { id: 'song_b', status: 'requested', songTitle: 'Dreams', mediaUrl: 'https://youtu.be/bbb222', priorityScore: 20 },
      { id: 'song_c', status: 'requested', songTitle: 'Creep', mediaUrl: 'https://youtu.be/ccc333', priorityScore: 30 },
    ],
    nowMs: 140000,
  });

  assert.equal(plan.resolved, true);
  assert.equal(plan.winnerSongId, 'song_b');
  assert.equal(plan.roomPatch.runOfShowDirector.releaseWindow.active, false);
  assert.equal(plan.roomPatch.runOfShowDirector.releaseWindow.resultChoice, 'keep_queue_moving');
  assert.equal(plan.roomPatch.runOfShowDirector.releaseWindow.votesSummary.totalVotes, 3);
  assert.equal(plan.roomPatch.selfServeMode.phase, 'winner_locked');
  assert.deepEqual(plan.songPatches.map((entry) => entry.songId), ['song_b', 'song_a', 'song_c']);
  assert.deepEqual(plan.songPatches.map((entry) => entry.patch.priorityScore), [140000, 140001, 140002]);
  assert.equal(plan.songPatches[0].patch.status, 'requested');
});

test('audience-led queue automation does not open in host-led rooms or over host decisions', () => {
  const hostLed = buildAudienceLedQueueFaceOffPlan({
    room: { selfServeMode: { enabled: false, format: 'open_stage' }, lastPerformance: { timestamp: 1 } },
    songs: [
      { id: 'song_a', status: 'requested', mediaUrl: 'https://youtu.be/a', priorityScore: 1 },
      { id: 'song_b', status: 'requested', mediaUrl: 'https://youtu.be/b', priorityScore: 2 },
    ],
    nowMs: 10,
  });
  assert.equal(hostLed, null);

  const hostDecision = buildAudienceLedQueueFaceOffPlan({
    room: {
      selfServeMode: { enabled: true, format: 'open_stage' },
      runOfShowDirector: { releaseWindow: { active: true, subjectType: 'queue_faceoff', origin: 'host_manual', closesAtMs: 5 } },
    },
    songs: [],
    nowMs: 10,
  });
  assert.equal(hostDecision.holdAdvance, true);
  assert.equal(hostDecision.reason, 'another_decision_open');
});