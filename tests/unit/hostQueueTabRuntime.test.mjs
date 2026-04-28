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
  runOfShowOpenSlots: [],
  onAssignQueueSongToRunOfShowItem: noop,
  onAssignQueueSongToNextOpenRunOfShowSlot: noop,
  onFillRunOfShowOpenSlotsFromQueue: noop,
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
  coHostSignals: [],
  moderationQueueItems: [],
  moderationCounts: {},
  moderationActions: {},
  moderationBusyAction: '',
  moderationNeedsAttention: false,
  onOpenModerationInbox: noop,
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

const renderInboxMarkup = async (overrides = {}) => {
  const { default: HostInboxPanel } = await import('../../src/apps/Host/components/HostInboxPanel.jsx');
  return renderToStaticMarkup(
    React.createElement(HostInboxPanel, {
      roomCode: 'TEST',
      hostBase: 'https://host.example',
      coHostSignals: [],
      roomChatMessages: [],
      hostDmMessages: [],
      moderationQueueItems: [],
      moderationCounts: {},
      moderationActions: {},
      moderationBusyAction: '',
      moderationNeedsAttention: false,
      chatUnread: 0,
      dmUnread: 0,
      users: [],
      handleChatViewMode: noop,
      openChatSettings: noop,
      onOpenModerationInbox: noop,
      dmTargetUid: '',
      setDmTargetUid: noop,
      dmDraft: '',
      setDmDraft: noop,
      sendHostDmMessage: noop,
      styles,
      emoji,
      ...overrides,
    }),
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

test('HostQueueTab flags run-of-show attention in the queue-tab show handoff', async () => {
  mockHostQueueTabDependencies();

  const markup = await renderQueueTabMarkup({
    runOfShowEnabled: true,
    runOfShowDirector: {
      items: [
        {
          id: 'ros-1',
          type: 'announcement',
          title: 'Sponsor Beat',
          status: 'ready',
          sequence: 1,
          plannedDurationSec: 30,
        },
      ],
    },
    runOfShowPreflightReport: {
      criticalCount: 1,
      riskyCount: 2,
      criticalItems: [{ itemId: 'ros-1', summary: 'Missing media.' }],
      riskyItems: [{ itemId: 'ros-1', summary: 'Needs copy review.' }],
    },
  });

  assert.match(markup, /Run Of Show/);
  assert.match(markup, />3</);
});

test('HostQueueTab renders one unified desktop content rail with queue add inbox and run-of-show tabs', async () => {
  mockHostQueueTabDependencies();

  const markup = await renderQueueTabMarkup({
    runOfShowEnabled: true,
    runOfShowDirector: {
      items: [
        {
          id: 'ros-1',
          type: 'announcement',
          title: 'Sponsor Beat',
          status: 'ready',
          sequence: 1,
          plannedDurationSec: 30,
        },
      ],
    },
  });

  assert.match(markup, /data-feature-id="queue-surface-tab-add-desktop"/);
  assert.match(markup, /Add To Queue/);
  assert.match(markup, /data-feature-id="queue-surface-tab-queue-desktop"/);
  assert.match(markup, /Current Queue/);
  assert.match(markup, /data-feature-id="queue-surface-tab-inbox-desktop"/);
  assert.match(markup, />Inbox</);
  assert.match(markup, /data-feature-id="queue-surface-tab-show-desktop"/);
  assert.match(markup, /Run Of Show/);
});

test('HostInboxPanel renders a consolidated inbox for co-host notes moderation and chat', async () => {
  const markup = await renderInboxMarkup({
    coHostSignals: [
      {
        id: 'track_up',
        hostLabel: 'Track needs a bump',
        summary: '2 co-hosts flagged this',
        contextTitle: 'Jordan - Valerie',
        contextMeta: 'Amy Winehouse • 0:42 in • 1m ago',
        icon: 'fa-wave-square',
        tone: 'amber',
        uniqueCount: 2,
        latestAgeLabel: '1m ago',
      },
    ],
    moderationQueueItems: [
      {
        key: 'crowd-selfie-1',
        type: 'crowd_selfie',
        title: 'Guest selfie',
        subtitle: 'Crowd selfie awaiting approval for TV moments and recap',
        timestamp: Date.now(),
        submission: { id: 'crowd-selfie-1' },
      },
    ],
    moderationCounts: {
      totalPending: 1,
    },
    roomChatMessages: [
      {
        id: 'dm-1',
        user: 'Taylor',
        text: 'Love the energy tonight.',
        fromUid: 'guest-1',
        channel: 'room',
        timestamp: Date.now(),
      },
    ],
    hostDmMessages: [
      {
        id: 'dm-2',
        user: 'Taylor',
        text: 'Can you bump my helper access?',
        fromUid: 'guest-1',
        toUid: 'host-1',
        channel: 'dm',
        timestamp: Date.now(),
      },
    ],
  });

  assert.match(markup, /data-feature-id="host-inbox-panel"/);
  assert.match(markup, /Host Inbox/);
  assert.match(markup, /Needs Host/);
  assert.match(markup, /Everything Else/);
  assert.match(markup, /Track needs a bump/);
  assert.match(markup, /Guest selfie/);
  assert.match(markup, /Taylor/);
  assert.match(markup, /Jordan - Valerie/);
  assert.match(markup, /1 moderation/);
});

test('HostQueueTab keeps inbox out of the left rail and exposes it as a workspace tab', async () => {
  mockHostQueueTabDependencies();
  vi.doMock('../../src/apps/Host/hooks/useQueueTabState.js', async () => {
    const actual = await vi.importActual('../../src/apps/Host/hooks/useQueueTabState.js');
    return {
      ...actual,
      default: (args) => {
        const state = actual.default(args);
        return {
          ...state,
          stagePanelOpen: false,
        };
      },
    };
  });

  const markup = await renderQueueTabMarkup();

  assert.match(markup, /data-feature-id="panel-now-playing"/);
  assert.match(markup, /data-feature-id="queue-surface-tab-inbox-desktop"/);
  assert.doesNotMatch(markup, /Host Inbox/);
  assert.doesNotMatch(markup, /Transport/);
});
