import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
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

test('One-Minute Mic automation resolves to rotate by starting server applause', () => {
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
  assert.equal(patch.activeMode, 'applause_countdown');
  assert.equal(patch.applauseSubject.autoFinalize, true);
  assert.equal(patch.applauseSubject.autoFinalizeSongId, 'song_a');
  assert.equal(patch.audienceAutomationCommand.action, 'finish_performance');
  assert.equal(patch.audienceAutomationCommand.status, 'server_started');
  assert.equal(patch.audienceAutomationCommand.songId, 'song_a');
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
test('One-Minute Mic automation resolves guarded crowd intervention into graceful rotation', () => {
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
  assert.equal(patch.activeMode, 'applause_countdown');
  assert.equal(patch.audienceAutomationCommand.action, 'finish_performance');
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