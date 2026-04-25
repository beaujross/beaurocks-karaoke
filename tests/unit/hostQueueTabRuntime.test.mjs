import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, test, vi } from 'vitest';

const noop = () => {};
const styles = new Proxy({}, { get: () => '' });
const emoji = new Proxy({}, { get: () => '•' });

const buildHostQueueTabProps = (overrides = {}) => ({
  songs: [],
  room: {},
  roomCode: 'TEST',
  hostBase: 'https://host.example',
  tvBase: 'https://tv.example',
  tvLaunchUrl: 'https://tv.example/launch',
  updateRoom: async () => {},
  logActivity: async () => {},
  localLibrary: [],
  playSfxSafe: noop,
  users: [],
  sfxMuted: false,
  setSfxMuted: noop,
  sfxLevel: 0.5,
  sfxVolume: 50,
  setSfxVolume: noop,
  searchSources: [],
  ytIndex: {},
  setYtIndex: noop,
  persistYtIndex: async () => {},
  hideNonEmbeddableYouTube: false,
  autoDj: false,
  holdAutoBgDuringStageActivation: false,
  chatShowOnTv: false,
  setChatShowOnTv: noop,
  chatUnread: 0,
  dmUnread: 0,
  chatEnabled: true,
  setChatEnabled: noop,
  chatAudienceMode: 'all',
  setChatAudienceMode: noop,
  chatDraft: '',
  setChatDraft: noop,
  chatMessages: [],
  sendHostChat: async () => {},
  sendHostDmMessage: async () => {},
  itunesBackoffRemaining: 0,
  pinnedChatIds: [],
  setPinnedChatIds: noop,
  chatViewMode: 'room',
  handleChatViewMode: noop,
  appleMusicAuthorized: false,
  appleMusicPlaying: false,
  appleMusicStatus: 'stopped',
  playAppleMusicTrack: async () => {},
  pauseAppleMusic: async () => {},
  resumeAppleMusic: async () => {},
  stopAppleMusic: async () => {},
  hostName: 'Host',
  fetchTop100Art: async () => [],
  openChatSettings: noop,
  dmTargetUid: '',
  setDmTargetUid: noop,
  dmDraft: '',
  setDmDraft: noop,
  getAppleMusicUserToken: async () => '',
  silenceAll: noop,
  compactViewport: false,
  layoutMode: 'desktop',
  showLegacyLiveEffects: true,
  commandPaletteRequestToken: 0,
  onUpsertYtIndexEntries: noop,
  runOfShowEnabled: false,
  runOfShowDirector: null,
  runOfShowLiveItem: null,
  runOfShowStagedItem: null,
  runOfShowNextItem: null,
  runOfShowPreflightReport: null,
  onOpenRunOfShow: noop,
  onOpenRunOfShowIssue: noop,
  onStartRunOfShow: noop,
  onAdvanceRunOfShow: noop,
  onRewindRunOfShow: noop,
  onToggleRunOfShowPause: noop,
  onStopRunOfShow: noop,
  onClearRunOfShow: noop,
  onReturnCurrentToQueue: noop,
  runOfShowAssignableSlots: [],
  onAssignQueueSongToRunOfShowItem: noop,
  scenePresets: [],
  scenePresetUploading: false,
  scenePresetUploadProgress: 0,
  onCreateScenePreset: noop,
  onLaunchScenePreset: noop,
  onQueueScenePreset: noop,
  onAddScenePresetToRunOfShow: noop,
  onClearScenePreset: noop,
  onDeleteScenePreset: noop,
  crowdPulse: null,
  ytDiagnosticsMap: {},
  fetchYtDiagnostics: async () => null,
  getYtDiagnosticsKey: () => '',
  getTrackDiagnosticsTone: () => null,
  getTrackDiagnosticsSupport: () => '',
  runtimeVisible: true,
  styles,
  emoji,
  smallWaveform: () => null,
  ...overrides,
});

const mockHostQueueTabDependencies = () => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    db: {},
    auth: { currentUser: { uid: 'host-1' } },
    doc: (...parts) => ({ parts }),
    collection: (...parts) => ({ parts }),
    query: (...parts) => ({ parts }),
    where: (...parts) => ({ parts }),
    onSnapshot: () => noop,
    updateDoc: async () => {},
    addDoc: async () => ({}),
    deleteDoc: async () => {},
    serverTimestamp: () => ({ seconds: 0, nanoseconds: 0 }),
    getDoc: async () => ({ exists: () => false, data: () => ({}) }),
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

const renderQueueTabMarkup = async (overrides = {}) => {
  const { default: HostQueueTab } = await import('../../src/apps/Host/components/HostQueueTab.jsx');
  return renderToStaticMarkup(
    React.createElement(HostQueueTab, buildHostQueueTabProps(overrides)),
  );
};

beforeEach(() => {
  vi.resetModules();
});

test('HostQueueTab renders the extracted queue runtime shell with live controls and TV moments', async () => {
  mockHostQueueTabDependencies();

  const markup = await renderQueueTabMarkup();

  assert.match(markup, /data-feature-id="host-live-ops-panel"/);
  assert.match(markup, /data-feature-id="panel-queue-list"/);
  assert.match(markup, /data-feature-id="panel-tv-moments"/);
  assert.match(markup, /TV Moments/);
});

test('HostQueueTab still renders the runtime shell when its UI is hidden', async () => {
  mockHostQueueTabDependencies();

  const markup = await renderQueueTabMarkup({
    runtimeVisible: false,
    commandPaletteRequestToken: 3,
  });

  assert.match(markup, /data-feature-id="host-live-ops-panel"/);
  assert.match(markup, /data-feature-id="panel-queue-list"/);
  assert.match(markup, /data-feature-id="panel-tv-moments"/);
  assert.match(markup, /TV Moments/);
});
