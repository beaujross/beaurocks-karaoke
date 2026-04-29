import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';

const noop = () => {};

const mockHostQueueTabDependencies = ({
  updateDocMock,
  getDocMock = async () => ({ exists: () => false, data: () => ({}) }),
} = {}) => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    db: {},
    auth: { currentUser: { uid: 'host-1' } },
    doc: (...parts) => ({ parts }),
    collection: (...parts) => ({ parts }),
    query: (...parts) => ({ parts }),
    where: (...parts) => ({ parts }),
    onSnapshot: () => noop,
    updateDoc: updateDocMock || (async () => {}),
    addDoc: async () => ({}),
    deleteDoc: async () => {},
    serverTimestamp: () => ({ seconds: 0, nanoseconds: 0 }),
    getDoc: getDocMock,
    getDocs: async () => ({ docs: [] }),
    callFunction: async () => ({ items: [] }),
  }));

  vi.doMock('../../src/lib/logger.js', () => ({
    createLogger: () => ({
      debug: noop,
      error: noop,
      info: noop,
      warn: noop,
    }),
  }));
};

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

test('browse-backed stage start uses resolved media duration and does not arm immediate auto-end', async () => {
  const updateDocMock = vi.fn(async () => {});
  mockHostQueueTabDependencies({ updateDocMock });
  vi.spyOn(Date, 'now').mockReturnValue(100000);

  const { startQueueSongOnStage } = await import('../../src/apps/Host/components/HostQueueTab.jsx');
  const { getAutoEndSchedule } = await import('../../src/apps/Host/hostPlaybackAutomation.js');

  const updateRoomMock = vi.fn(async () => {});
  const stopAppleMusicMock = vi.fn(async () => {});
  const logActivityMock = vi.fn();

  const queueSong = {
    id: 'browse_song_1',
    status: 'requested',
    songTitle: 'Rollout',
    artist: 'Ludacris',
    singerName: 'Casey',
    mediaUrl: 'https://www.youtube.com/watch?v=t21DFnu00Dc',
    duration: 3,
  };

  const result = await startQueueSongOnStage({
    songId: queueSong.id,
    songs: [queueSong],
    room: {
      autoPlayMedia: true,
      autoEndOnTrackFinish: true,
      showLyricsTv: true,
    },
    roomCode: 'ROOM1',
    resolveDurationForUrl: async () => 245,
    isAudioUrl: () => false,
    holdAutoBgDuringStageActivation: noop,
    playAppleMusicTrack: vi.fn(async () => {}),
    stopAppleMusic: stopAppleMusicMock,
    updateRoom: updateRoomMock,
    logActivity: logActivityMock,
    emoji: { mic: 'mic' },
  });

  assert.equal(result.performanceStartedAtMs, 100000);
  assert.equal(result.performanceDurationSec, 245);
  assert.equal(result.songMediaUrl, 'https://www.youtube.com/watch?v=t21DFnu00Dc');

  assert.equal(updateDocMock.mock.calls.length, 1);
  const updateDocPayload = updateDocMock.mock.calls[0][1];
  assert.equal(updateDocPayload.status, 'performing');
  assert.equal(updateDocPayload.performanceStartedDurationSec, 245);
  assert.equal(updateDocPayload.duration, 245);
  assert.equal(updateDocPayload.backingDurationSec, 245);
  assert.equal(updateDocPayload.durationSource, 'backing_media');
  assert.equal(updateDocPayload.autoEndSafe, true);

  assert.equal(stopAppleMusicMock.mock.calls.length, 1);
  assert.equal(updateRoomMock.mock.calls.length, 1);
  const roomPatch = updateRoomMock.mock.calls[0][0];
  assert.equal(roomPatch.activeMode, 'karaoke');
  assert.equal(roomPatch.mediaUrl, 'https://www.youtube.com/watch?v=t21DFnu00Dc');
  assert.equal(roomPatch.videoPlaying, true);
  assert.equal(roomPatch.videoStartTimestamp, 100000);
  assert.equal(roomPatch.currentPerformanceMeta.songId, queueSong.id);
  assert.equal(roomPatch.currentPerformanceMeta.startedAtMs, 100000);
  assert.equal(roomPatch.currentPerformanceMeta.durationSec, 245);
  assert.equal(roomPatch.currentPerformanceMeta.backingDurationSec, 245);
  assert.equal(roomPatch.currentPerformanceMeta.autoEndSafe, true);
  assert.equal(roomPatch.currentPerformanceSession.songId, queueSong.id);
  assert.equal(roomPatch.currentPerformanceSession.startedAtMs, 100000);
  assert.equal(roomPatch.currentPerformanceSession.lastHeartbeatAtMs, 100000);
  assert.equal(roomPatch.currentPerformanceSession.expectedDurationSec, 245);

  const schedule = getAutoEndSchedule({
    autoEndEnabled: true,
    currentId: queueSong.id,
    activeMode: roomPatch.activeMode,
    mediaUrl: roomPatch.mediaUrl,
    videoPlaying: roomPatch.videoPlaying,
    videoStartTimestamp: roomPatch.currentPerformanceMeta.startedAtMs,
    performanceMetaSongId: roomPatch.currentPerformanceMeta.songId,
    performanceSessionSongId: roomPatch.currentPerformanceSession.songId,
    performanceSessionState: roomPatch.currentPerformanceSession.playbackState,
    performanceSessionSourceType: roomPatch.currentPerformanceSession.sourceType,
    performanceSessionLastHeartbeatAtMs: roomPatch.currentPerformanceSession.lastHeartbeatAtMs,
    capturedDurationSec: roomPatch.currentPerformanceMeta.durationSec,
    currentDurationSec: updateDocPayload.duration,
    autoEndSafe: roomPatch.currentPerformanceMeta.autoEndSafe,
    now: 100000,
  });

  assert.ok(schedule, 'auto-end should still arm for the active performance');
  assert.equal(schedule.autoEndKey, 'browse_song_1:100000:245');
  assert.equal(schedule.delayMs, 251000);
  assert.ok(schedule.delayMs > 10000, 'newly started songs should not auto-end immediately');

  assert.equal(logActivityMock.mock.calls.length, 1);
});
