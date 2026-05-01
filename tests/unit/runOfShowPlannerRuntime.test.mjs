import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, test, vi } from 'vitest';

const noop = () => {};

const buildDirectorPanelProps = (overrides = {}) => ({
  enabled: true,
  roomCode: 'AAHF',
  eventProfileId: 'aahf_kickoff',
  eventProfileLabel: 'AAHF Kick-Off',
  director: { items: [] },
  operatorRole: 'host',
  currentRoomDraftSummary: {
    queueCount: 3,
    sceneCount: 2,
  },
  scenePresets: [
    {
      id: 'scene-1',
      title: 'Sponsor Flyer',
      mediaType: 'image',
      durationSec: 20,
      createdAtMs: 1714512000000,
      lastPresentedAtMs: 1714515600000,
      presentedCount: 2,
    },
    {
      id: 'scene-2',
      title: 'Afterparty Video',
      mediaType: 'video',
      durationSec: 35,
      createdAtMs: 1714512600000,
    },
  ],
  onApplyGeneratedDraft: async () => {},
  onApplyCurrentRoomDraft: async () => {},
  onAddScenePresetToRunOfShow: noop,
  onAddItem: noop,
  onImportCsv: async () => {},
  onDuplicateItem: async () => {},
  onDeleteItem: async () => {},
  onMoveItem: async () => {},
  onUpdateItem: async () => {},
  onToggleAutomationPause: async () => {},
  onStartRunOfShow: async () => {},
  onStopRunOfShow: async () => {},
  onClearRunOfShow: async () => {},
  onPrepareItem: async () => {},
  onPreviewItem: async () => {},
  onClearPreview: async () => {},
  onStartItem: async () => {},
  onCompleteItem: async () => {},
  onSkipItem: async () => {},
  onOpenReleaseWindow: async () => {},
  onCloseReleaseWindow: async () => {},
  onReviewSubmission: async () => {},
  onAssignQueueSongToItem: async () => {},
  onUpdatePolicy: async () => {},
  onUpdateRoles: async () => {},
  onSaveTemplate: async () => {},
  onApplyTemplate: async () => {},
  onApplyStarterTemplate: async () => {},
  onArchiveCurrent: async () => {},
  ...overrides,
});

const buildHudProps = (overrides = {}) => ({
  enabled: true,
  director: {
    items: [
      {
        id: 'ros-1',
        type: 'announcement',
        title: 'Sponsor Break',
        status: 'ready',
        sequence: 1,
        plannedDurationSec: 30,
        presentationPlan: { headline: 'Thank our sponsors' },
      },
    ],
  },
  liveItem: null,
  stagedItem: null,
  nextItem: null,
  preflightReport: {
    readyToStart: true,
    criticalCount: 0,
    riskyCount: 0,
    criticalItems: [],
    riskyItems: [],
    summary: 'Ready to go.',
  },
  onOpenShowWorkspace: noop,
  onOpenIssue: noop,
  onFocusItem: noop,
  onPreviewItem: noop,
  onMoveItem: noop,
  onSkipItem: noop,
  onStartShow: noop,
  onAdvance: noop,
  onRewind: noop,
  onStop: noop,
  onClear: noop,
  onToggleAutomationPause: noop,
  styles: new Proxy({}, { get: () => '' }),
  ...overrides,
});

const renderDirectorPanelMarkup = async (overrides = {}) => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    callFunction: async () => ({ items: [] }),
  }));
  const React = (await import('react')).default;
  const { default: RunOfShowDirectorPanel } = await import('../../src/apps/Host/components/RunOfShowDirectorPanel.jsx');
  return renderToStaticMarkup(
    React.createElement(RunOfShowDirectorPanel, buildDirectorPanelProps(overrides)),
  );
};

const renderQueueHudMarkup = async (overrides = {}) => {
  const React = (await import('react')).default;
  const { default: RunOfShowQueueHud } = await import('../../src/apps/Host/components/RunOfShowQueueHud.jsx');
  return renderToStaticMarkup(
    React.createElement(RunOfShowQueueHud, buildHudProps(overrides)),
  );
};

beforeEach(() => {
  vi.resetModules();
});

test('RunOfShowDirectorPanel renders the planner scene library with shown-tonight metadata and recovery utilities', async () => {
  vi.doMock('react', async () => {
    const actual = await vi.importActual('react');
    let booleanStateCount = 0;
    const mockedUseState = (initialState) => {
      if (typeof initialState === 'boolean' && initialState === false) {
        booleanStateCount += 1;
        if (booleanStateCount === 7) {
          return actual.useState(true);
        }
      }
      return actual.useState(initialState);
    };
    const defaultExport = { ...(actual.default ?? actual), useState: mockedUseState };
    return {
      ...actual,
      default: defaultExport,
      useState: mockedUseState,
    };
  });

  const markup = await renderDirectorPanelMarkup();

  assert.match(markup, /Sponsor Flyer/);
  assert.match(markup, /Afterparty Video/);
  assert.match(markup, /Shown tonight/);
  assert.match(markup, /2x shown/);
  assert.match(markup, /Use In Plan/);
  assert.match(markup, /Utilities/);
  assert.match(markup, /Capture Live Room/);
});

test('RunOfShowQueueHud stays collapsed by default and keeps the summary visible with sparse plan data', async () => {
  const markup = await renderQueueHudMarkup({
    director: {
      items: [
        {
          id: 'ros-1',
          type: 'announcement',
          title: 'Sponsor Break',
          status: 'ready',
          sequence: 1,
          plannedDurationSec: 30,
        },
      ],
    },
  });

  assert.match(markup, /Show Details/);
  assert.match(markup, /Now: Sponsor Break/);
  assert.doesNotMatch(markup, /Hide Details/);
  assert.doesNotMatch(markup, /Full List/);
});

test('RunOfShowQueueHud can render the expanded detail state without crashing when only one plan item exists', async () => {
  vi.doMock('react', async () => {
    const actual = await vi.importActual('react');
    let booleanStateCount = 0;
    const mockedUseState = (initialState) => {
      if (typeof initialState === 'boolean' && booleanStateCount === 0) {
        booleanStateCount += 1;
        return actual.useState(true);
      }
      return actual.useState(initialState);
    };
    const defaultExport = { ...(actual.default ?? actual), useState: mockedUseState };
    return {
      ...actual,
      default: defaultExport,
      useState: mockedUseState,
    };
  });

  const markup = await renderQueueHudMarkup({
    director: {
      items: [
        {
          id: 'ros-1',
          type: 'announcement',
          title: 'Sponsor Break',
          status: 'ready',
          sequence: 1,
          plannedDurationSec: 30,
        },
      ],
    },
  });

  assert.match(markup, /Hide Details/);
  assert.match(markup, /Full List/);
  assert.match(markup, /Sponsor Break/);
  assert.match(markup, /Keep one more ready|Nothing set/);
});
