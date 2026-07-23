import assert from 'node:assert/strict';
import { test } from 'vitest';

import buildHostRuntimeShellModel from '../../src/apps/Host/lib/hostRuntimeShellModel.js';
import { HOST_RUNTIME_MODE_EMPHASES } from '../../src/apps/Host/lib/hostUiPrefs.js';

test('hostRuntimeShellModel groups the live lane and candidate pool for the experimental shell', () => {
  const model = buildHostRuntimeShellModel({
    room: {},
    current: {
      id: 'live-1',
      singerName: 'Jordan',
      songTitle: 'Valerie',
      artist: 'Amy Winehouse',
      mediaUrl: 'https://www.youtube.com/watch?v=abc1234',
      playbackReady: true,
      status: 'performing',
    },
    nextQueueSong: {
      id: 'next-1',
      singerName: 'Taylor',
      songTitle: 'Dreams',
      artist: 'Fleetwood Mac',
      mediaUrl: 'https://www.youtube.com/watch?v=def5678',
      playbackReady: true,
      status: 'requested',
    },
    queue: [
      {
        id: 'next-1',
        singerName: 'Taylor',
        songTitle: 'Dreams',
        artist: 'Fleetwood Mac',
        mediaUrl: 'https://www.youtube.com/watch?v=def5678',
        playbackReady: true,
      },
      {
        id: 'queue-2',
        singerName: 'Alex',
        songTitle: 'Hey Ya!',
        artist: 'Outkast',
        mediaUrl: 'https://www.youtube.com/watch?v=ghi9012',
        playbackReady: true,
      },
    ],
    reviewRequired: [
      {
        id: 'review-1',
        singerName: 'Riley',
        songTitle: 'Unwritten',
        artist: 'Natasha Bedingfield',
        mediaResolutionStatus: 'needs_backing',
      },
    ],
    assigned: [
      {
        id: 'assigned-1',
        singerName: 'Morgan',
        songTitle: 'Levitating',
        artist: 'Dua Lipa',
        mediaUrl: 'https://www.youtube.com/watch?v=jkl3456',
        playbackReady: true,
      },
    ],
    held: [
      {
        id: 'held-1',
        singerName: 'Casey',
        songTitle: 'Mr. Brightside',
        artist: 'The Killers',
        mediaUrl: 'https://www.youtube.com/watch?v=mno7890',
        playbackReady: true,
      },
    ],
    scenePresets: [
      {
        id: 'scene-1',
        title: 'Crowd Camera',
        durationSec: 15,
        sceneAudienceReactionMode: 'cheer',
      },
    ],
    queueNeedsAttention: 2,
    inboxTotalCount: 1,
    postPerformanceBackingPrompt: {
      performanceKey: 'track-1',
      songTitle: 'Valerie',
    },
    currentSourceLabel: 'YouTube',
    currentSourcePlaying: true,
    autoDj: true,
  });

  assert.equal(model.currentPerformance?.title, 'Jordan');
  assert.equal(model.nextPerformance?.title, 'Taylor');
  assert.equal(model.topQuestions.liveNow?.title, 'Jordan');
  assert.equal(model.topQuestions.nextCommitted?.title, 'Taylor');
  assert.equal(model.playback.sourceLabel, 'YouTube');
  assert.equal(model.playback.playing, true);
  assert.equal(model.trackCheckState.hasPendingPrompt, true);
  assert.equal(model.roomControlsSummary.autoDj, true);
  assert.ok(model.rotationFlow.length >= 2);
  assert.ok(model.candidateGroups.some((group) => group.title === 'Needs Host Pick'));
  assert.ok(model.candidateGroups.some((group) => group.title === 'Scene Candidates'));
  assert.equal(model.topQuestions.needsIntervention?.title, '2 queue issues');
});

test('hostRuntimeShellModel presents assigned Planner performances with singer and song copy', () => {
  const model = buildHostRuntimeShellModel({
    room: {},
    runOfShowEnabled: true,
    runOfShowNextItem: {
      id: 'planned-performance',
      type: 'performance',
      title: 'Feature Slot 1',
      assignedPerformerName: 'Alex Rivers',
      songTitle: 'Dreams',
      artistName: 'Fleetwood Mac',
      status: 'ready',
    },
    autoDj: true,
  });

  assert.equal(model.nextPerformance?.objectType, 'performance');
  assert.equal(model.nextPerformance?.title, 'Alex Rivers');
  assert.equal(model.nextPerformance?.subtitle, 'Dreams — Fleetwood Mac');
  assert.equal(model.roomControlsSummary.autoDj, true);
});

test('hostRuntimeShellModel derives the correct runtime emphasis from governance and show state', () => {
  const crowdVoteModel = buildHostRuntimeShellModel({
    room: {},
    activeReleaseWindow: {
      active: true,
      governanceMode: 'crowd_vote',
      itemTitle: 'Pick the next singer',
    },
  });
  assert.equal(crowdVoteModel.runtimeModeEmphasis, HOST_RUNTIME_MODE_EMPHASES.audienceLed);

  const cohostVoteModel = buildHostRuntimeShellModel({
    room: {},
    activeReleaseWindow: {
      active: true,
      governanceMode: 'cohost_vote',
    },
  });
  assert.equal(cohostVoteModel.runtimeModeEmphasis, HOST_RUNTIME_MODE_EMPHASES.collaborative);

  const showcaseModel = buildHostRuntimeShellModel({
    room: {},
    runOfShowEnabled: true,
  });
  assert.equal(showcaseModel.runtimeModeEmphasis, HOST_RUNTIME_MODE_EMPHASES.curatedShowcase);

  const roomPrefModel = buildHostRuntimeShellModel({
    room: {
      hostUiPrefs: {
        runtimeModeEmphasis: HOST_RUNTIME_MODE_EMPHASES.collaborative,
      },
    },
  });
  assert.equal(roomPrefModel.runtimeModeEmphasis, HOST_RUNTIME_MODE_EMPHASES.collaborative);
});
