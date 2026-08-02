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
  onAddQuickRunOfShowMoment: noop,
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
  onUpdateScenePreset: noop,
  onLaunchScenePreset: noop,
  onQueueScenePreset: noop,
  onAddScenePresetToRunOfShow: noop,
  onClearScenePreset: noop,
  onDeleteScenePreset: noop,
  onSceneLibraryModalChange: noop,
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

const mockDesktopQueueSurfaceTab = (initialTab = 'inbox') => {
  vi.doMock('react', async () => {
    const actual = await vi.importActual('react');
    let injectedQueueTab = false;
    return {
      ...actual,
      default: actual.default ?? actual,
      useState: (initialState) => {
        if (!injectedQueueTab && initialState === 'queue') {
          injectedQueueTab = true;
          return actual.useState(initialTab);
        }
        return actual.useState(initialState);
      },
    };
  });
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

test('HostQueueTab renders the extracted queue runtime shell with a TV library launcher', async () => {
  mockHostQueueTabDependencies();

  const markup = await renderQueueTabMarkup();

  assert.doesNotMatch(markup, /data-feature-id="host-panel-layout-controls"/);
  assert.doesNotMatch(markup, /Expand All/);
  assert.doesNotMatch(markup, /Collapse All/);
  assert.doesNotMatch(markup, /Reset/);
  assert.match(markup, /data-feature-id="queue-surface-tab-queue-desktop"/);
  assert.match(markup, /data-feature-id="queue-surface-tab-add-desktop"/);
  assert.match(markup, /data-feature-id="panel-queue-list"/);
  assert.doesNotMatch(markup, /data-feature-id="panel-tv-moments"/);
  assert.doesNotMatch(markup, /data-feature-id="panel-tv-moments-toggle"/);
  assert.match(markup, /Tonight&#x27;s Lineup/);
});

test('HostQueueTab still renders the runtime shell when its UI is hidden', async () => {
  mockHostQueueTabDependencies();

  const markup = await renderQueueTabMarkup({
    runtimeVisible: false,
    commandPaletteRequestToken: 3,
  });

  assert.doesNotMatch(markup, /data-feature-id="host-panel-layout-controls"/);
  assert.match(markup, /data-feature-id="queue-surface-tab-queue-desktop"/);
  assert.match(markup, /data-feature-id="panel-queue-list"/);
  assert.doesNotMatch(markup, /data-feature-id="panel-tv-moments"/);
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

  assert.match(markup, /Show Plan|Planned Moments Hopper/);
  assert.match(markup, />3</);
});

test('HostQueueTab renders one unified desktop content rail with queue add inbox and planner tabs', async () => {
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
  assert.match(markup, /Add Performance/);
  assert.match(markup, /data-feature-id="queue-surface-tab-queue-desktop"/);
  assert.match(markup, /Tonight&#x27;s Lineup/);
  assert.match(markup, /data-feature-id="queue-surface-tab-inbox-desktop"/);
  assert.match(markup, />Inbox</);
  assert.match(markup, /data-feature-id="queue-surface-tab-show-desktop"/);
  assert.match(markup, /Show Plan/);
  assert.doesNotMatch(markup, /Moment Plan/);
});

test('HostInboxPanel renders a consolidated inbox for co-host notes moderation and chat', async () => {
  const markup = await renderInboxMarkup({
    systemInboxItems: [
      {
        id: 'track-check-1',
        type: 'track_check',
        source: 'System',
        title: 'Dont Stop Believin',
        body: 'Deferred from stage. Review when you have a beat and decide whether to use this backing again.',
        context: 'Journey',
        ageLabel: 'Later',
        onApprove: noop,
        onReject: noop,
        onDismiss: noop,
      },
    ],
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
  assert.match(markup, /Dont Stop Believin/);
  assert.match(markup, /Journey/);
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

test('HostQueueTab mounts the inbox workspace without a host-room runtime crash', async () => {
  mockHostQueueTabDependencies();
  mockDesktopQueueSurfaceTab('inbox');

  const markup = await renderQueueTabMarkup({
    chatUnread: 2,
    dmUnread: 1,
  });

  assert.match(markup, /data-feature-id="panel-inbox"/);
  assert.match(markup, /Host Inbox/);
  assert.match(markup, /Needs Host/);
});

test('HostQueueTab renders the inbox workspace badge with branded pink attention styling', async () => {
  mockHostQueueTabDependencies();

  const markup = await renderQueueTabMarkup({
    chatUnread: 2,
    dmUnread: 1,
    coHostSignals: [
      { id: 'cohost-1', hostLabel: 'Need a ruling' },
    ],
    moderationCounts: {
      totalPending: 1,
    },
  });

  assert.match(
    markup,
    /data-feature-id="queue-surface-tab-inbox-desktop"[\s\S]*border-pink-100\/70[\s\S]*rgba\(236,72,153,0\.96\)[\s\S]*>5</,
  );
});

test('HostQueueTab keeps add-to-queue search controls visible inside the dedicated add workspace', async () => {
  mockHostQueueTabDependencies();
  mockDesktopQueueSurfaceTab('add');
  vi.doMock('../../src/apps/Host/hooks/useQueueTabState.js', async () => {
    const actual = await vi.importActual('../../src/apps/Host/hooks/useQueueTabState.js');
    return {
      ...actual,
      default: (args) => {
        const state = actual.default(args);
        return {
          ...state,
          showAddForm: false,
        };
      },
    };
  });

  const markup = await renderQueueTabMarkup();

  assert.match(markup, /data-feature-id="queue-surface-tab-add-desktop"/);
  assert.match(markup, /Performance/);
  assert.match(markup, /TV/);
  assert.match(markup, /Announcement/);
  assert.match(markup, /Search songs or backing tracks/);
  assert.match(markup, /Expand Search/);
  assert.match(markup, /Backing source/);
  assert.match(markup, /YouTube filter/);
  assert.doesNotMatch(markup, /More YouTube|Open YouTube search/);
  assert.match(markup, /Manual/);
  assert.match(markup, /Results/);
  assert.match(markup, /Add to Lineup/);
  assert.doesNotMatch(markup, /Enter a Song Title/);
});

test('HostQueueTab keeps performance creation append-only even when show slots are open', async () => {
  mockHostQueueTabDependencies();
  mockDesktopQueueSurfaceTab('add');

  const markup = await renderQueueTabMarkup({
    runOfShowOpenSlots: [
      { id: 'slot-1', label: '#2 Performance Slot', sequence: 2 },
      { id: 'slot-2', label: '#3 Performance Slot', sequence: 3 },
    ],
  });

  assert.match(markup, /Add Performance/);
  assert.match(markup, /Add to Lineup/);
  assert.doesNotMatch(markup, /Next: #2 Performance Slot/);
  assert.doesNotMatch(markup, /Later target/);
  assert.doesNotMatch(markup, /Queue Only/);
  assert.doesNotMatch(markup, /Tap to queue/);
});

test('HostQueueTab protects the live lineup and exposes quick between-song inserts in queue view', async () => {
  mockHostQueueTabDependencies();

  const markup = await renderQueueTabMarkup({
    songs: [
      {
        id: 'live-1',
        status: 'performing',
        singerName: 'Alex',
        songTitle: 'Dreams',
        artist: 'Fleetwood Mac',
      },
      {
        id: 'queue-1',
        status: 'requested',
        singerName: 'Jordan',
        songTitle: 'Valerie',
        artist: 'Amy Winehouse',
      },
      {
        id: 'queue-2',
        status: 'requested',
        singerName: 'Taylor',
        songTitle: 'Since U Been Gone',
        artist: 'Kelly Clarkson',
      },
      {
        id: 'queue-3',
        status: 'requested',
        singerName: 'Sam',
        songTitle: 'Mr. Brightside',
        artist: 'The Killers',
      },
    ],
    currentBgTrackUploadId: '',
    onAddQuickRunOfShowMoment: noop,
  });

  assert.match(markup, /Up Next/);
  assert.match(markup, /data-feature-id="panel-queue-list"/);
  assert.match(markup, /Next/);
  assert.match(markup, /Then/);
  assert.match(markup, /Q3/);
  assert.doesNotMatch(markup, /Lock the lineup|Lineup protected|Queue needs attention/);
  assert.doesNotMatch(markup, /Trivia Next/);
  assert.doesNotMatch(markup, /Winner Next/);
  assert.doesNotMatch(markup, /Vote Next/);
  assert.match(markup, /fa-lock/);
});

test('HostQueueTab keeps the stage rail ahead of the queue workspace in compact layouts', async () => {
  mockHostQueueTabDependencies();

  const markup = await renderQueueTabMarkup({
    compactViewport: true,
    layoutMode: 'mobile',
  });

  const stageIndex = markup.indexOf('data-feature-id="panel-now-playing"');
  const queueIndex = markup.indexOf('data-feature-id="queue-surface-tab-queue"');

  assert.notStrictEqual(stageIndex, -1, 'Stage panel should still render in compact layouts');
  assert.notStrictEqual(queueIndex, -1, 'Queue workspace tabs should still render in compact layouts');
  assert.ok(stageIndex < queueIndex, 'Compact layouts should keep the stage rail ahead of the queue workspace');
});

test('Show Plan keeps Stage visible and exposes the TV handoff plus detailed director', async () => {
  mockHostQueueTabDependencies();
  mockDesktopQueueSurfaceTab('show');

  const markup = await renderQueueTabMarkup({
    autoDj: true,
    runOfShowEnabled: false,
    runOfShowDirector: {
      items: [
        {
          id: 'moment-1',
          type: 'announcement',
          title: 'Welcome New Guests',
          status: 'ready',
          sequence: 1,
          plannedDurationSec: 30,
        },
      ],
    },
    runOfShowNextItem: {
      id: 'moment-1',
      type: 'announcement',
      title: 'Welcome New Guests',
      status: 'ready',
    },
    onTriggerRunOfShowItem: noop,
    runOfShowDirectorPanel: React.createElement(
      'div',
      { 'data-testid': 'embedded-run-of-show-director' },
      'Detailed director controls',
    ),
  });

  const stageIndex = markup.indexOf('data-feature-id="panel-now-playing"');
  const momentPrepIndex = markup.indexOf('data-feature-id="host-moment-prep-workbench"');
  assert.notStrictEqual(stageIndex, -1, 'Stage should remain rendered beside Show Plan');
  assert.notStrictEqual(momentPrepIndex, -1, 'Show Plan should render in its own queue workspace section');
  assert.ok(stageIndex < momentPrepIndex, 'Stage should remain ahead of the contained Show Plan section');
  assert.match(markup, /data-feature-id="moment-prep-live-handoff"/);
  assert.match(markup, /Start Next/);
  assert.match(markup, /Auto DJ runs performances only/);
  assert.match(markup, /data-feature-id="moment-prep-full-director"/);
  assert.match(markup, /Detailed director controls/);
});

test('Show Plan keeps drafts out of Lineup Overview and exposes the inline WYR editor', async () => {
  mockHostQueueTabDependencies();
  mockDesktopQueueSurfaceTab('show');

  const markup = await renderQueueTabMarkup({
    runOfShowDirector: {
      items: [
        {
          id: 'lineup-1',
          type: 'announcement',
          title: 'Committed Welcome',
          status: 'ready',
          destination: 'queue',
          sequence: 1,
          plannedDurationSec: 30,
        },
        {
          id: 'draft-wyr-1',
          type: 'would_you_rather_break',
          title: 'Draft Crowd Vote',
          status: 'prepared',
          destination: 'planner',
          sequence: 2,
          plannedDurationSec: 65,
          modeLaunchPlan: {
            modeKey: 'wyr',
            launchConfig: {
              question: 'Would you rather sing solo or as a duet?',
              options: ['Solo', 'Duet'],
              points: 50,
              autoReveal: true,
            },
          },
        },
      ],
    },
    onUpdateRunOfShowItem: noop,
    onFocusRunOfShowItem: noop,
    onPreviewRunOfShowItem: noop,
    onPromotePreparedRunOfShowItems: noop,
  });

  const timelineStart = markup.indexOf('data-feature-id="moment-prep-timeline-track"');
  const draftTrayStart = markup.indexOf('data-feature-id="moment-prep-prepared-hopper"');
  const lineupMarkup = markup.slice(timelineStart, draftTrayStart);

  assert.match(lineupMarkup, /Committed Welcome/);
  assert.doesNotMatch(lineupMarkup, /Draft Crowd Vote/);
  assert.match(markup, /data-feature-id="moment-draft-inline-editor"/);
  assert.match(markup, /Edit draft here/);
  assert.match(markup, /Question for the Room/);
  assert.match(markup, /Choice A/);
  assert.match(markup, /Choice B/);
  assert.match(markup, /More settings/);
});

test('Moment Prep offers manual Start Next before Auto Advance is enabled', async () => {
  mockHostQueueTabDependencies();
  mockDesktopQueueSurfaceTab('show');

  const markup = await renderQueueTabMarkup({
    runOfShowEnabled: false,
    runOfShowDirector: {
      items: [
        {
          id: 'moment-manual-1',
          destination: 'queue',
          type: 'would_you_rather_break',
          title: 'Manual Moment',
          status: 'ready',
          sequence: 1,
        },
      ],
    },
    runOfShowNextItem: null,
    runOfShowStagedItem: null,
    onAdvanceRunOfShow: noop,
    onStartRunOfShow: noop,
  });

  assert.match(markup, /data-moment-live-action="start-next"/);
  assert.match(markup, /Start Next/);
  assert.match(markup, /data-moment-live-action="enable-auto-advance"/);
  assert.match(markup, /Turn On Auto-Advance/);
});
