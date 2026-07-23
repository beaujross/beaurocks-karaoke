import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, test, vi } from 'vitest';

const noop = () => {};
const styles = new Proxy({}, { get: (_, key) => (typeof key === 'string' ? key : '') });

const baseSong = {
  id: 'song-1',
  songTitle: 'Since U Been Gone',
  singerName: 'Kelly',
  artist: 'Kelly Clarkson',
  status: 'queued',
  resolutionStatus: 'resolved',
};

const buildQueueListPanelProps = (overrides = {}) => ({
  showQueueList: true,
  showQueueSummaryBar: true,
  onToggleQueueSummaryBar: noop,
  reviewRequiredCount: 0,
  pending: [],
  pendingQueueOpen: true,
  onTogglePendingQueue: noop,
  queue: [baseSong],
  readyQueueOpen: true,
  onToggleReadyQueue: noop,
  assigned: [],
  assignedQueueOpen: true,
  onToggleAssignedQueue: noop,
  held: [],
  reviewRequired: [],
  onApprovePending: noop,
  onDeletePending: noop,
  onMoveNext: noop,
  onHoldSinger: noop,
  onRestoreSinger: noop,
  dragQueueId: '',
  dragOverId: '',
  setDragQueueId: noop,
  setDragOverId: noop,
  reorderQueue: noop,
  touchReorderAvailable: false,
  touchReorderEnabled: false,
  touchReorderMode: false,
  handleTouchStart: noop,
  handleTouchMove: noop,
  handleTouchEnd: noop,
  updateStatus: noop,
  startEdit: noop,
  onRetryLyrics: noop,
  onFetchTimedLyrics: noop,
  onApproveAudienceBacking: noop,
  onAvoidAudienceBacking: noop,
  backingDecisionBusyKey: '',
  statusPill: 'status-pill',
  styles,
  compactViewport: false,
  runOfShowAssignableSlots: [],
  runOfShowOpenSlots: [],
  queueSurfaceCounts: null,
  onAssignQueueSongToRunOfShowItem: noop,
  onAssignQueueSongToNextOpenRunOfShowSlot: noop,
  onFillRunOfShowOpenSlotsFromQueue: noop,
  quickControls: {
    queueRuleSummary: 'Queue rules stay live here.',
    automationSummary: 'Automation stays close to the queue.',
    rotationLabel: 'Round Robin',
    limitLabel: 'No Limits',
    firstTimeBoost: true,
    showReadyCheck: true,
    autoDj: true,
    autoEndOnTrackFinish: false,
    autoPartyEnabled: true,
    popTriviaEnabled: false,
    onCycleQueueRotation: noop,
    onCycleQueueLimitMode: noop,
    onToggleFirstTimeBoost: noop,
    onTriggerReadyCheck: noop,
    onToggleAutoDj: noop,
    onToggleAutoEnd: noop,
    onToggleAutoParty: noop,
    onTogglePopTrivia: noop,
    onOpenRunOfShow: noop,
  },
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
});

test('QueueListPanel keeps the overview contextual and leaves deeper actions to selection', async () => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    db: {},
    doc: (...parts) => ({ parts }),
    deleteDoc: async () => {},
  }));

  const { default: QueueListPanel } = await import('../../src/apps/Host/components/QueueListPanel.jsx');
  const markup = renderToStaticMarkup(
    React.createElement(QueueListPanel, buildQueueListPanelProps()),
  );

  assert.doesNotMatch(markup, /data-feature-id="queue-live-controls"/);
  assert.doesNotMatch(markup, /Queue Controls/);
  assert.doesNotMatch(markup, /Queue Rules/);
  assert.doesNotMatch(markup, /Automation/);
  assert.doesNotMatch(markup, /Open Conveyor/);
  assert.doesNotMatch(markup, /data-feature-id="queue-song-expanded-actions"/);
  assert.match(markup, /Start Next/);
  assert.match(markup, /Details/);
  assert.doesNotMatch(markup, />Edit</);
  assert.doesNotMatch(markup, />Hold</);
  assert.doesNotMatch(markup, />Remove</);
  assert.doesNotMatch(markup, /Queue Inspector/);
  assert.doesNotMatch(markup, /Queue Actions/);
});

test('QueueListPanel keeps held and review-needed work in collapsed overview trays', async () => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    db: {},
    doc: (...parts) => ({ parts }),
    deleteDoc: async () => {},
  }));

  const { default: QueueListPanel } = await import('../../src/apps/Host/components/QueueListPanel.jsx');

  const heldMarkup = renderToStaticMarkup(
    React.createElement(QueueListPanel, buildQueueListPanelProps({
      queue: [],
      held: [{
        ...baseSong,
        id: 'held-1',
        status: 'held',
        holdReason: 'not_here',
      }],
      quickControls: null,
    })),
  );
  assert.match(heldMarkup, /data-feature-id="queue-section-held-toggle"/);
  assert.match(heldMarkup, /aria-expanded="false"/);
  assert.doesNotMatch(heldMarkup, /Restore/);

  const reviewMarkup = renderToStaticMarkup(
    React.createElement(QueueListPanel, buildQueueListPanelProps({
      queue: [],
      pending: [{
        ...baseSong,
        id: 'pending-1',
        status: 'pending',
        resolutionStatus: 'review_required',
      }],
      quickControls: null,
    })),
  );
  assert.match(reviewMarkup, /data-feature-id="queue-section-pending-toggle"/);
  assert.match(reviewMarkup, /aria-expanded="false"/);
  assert.doesNotMatch(reviewMarkup, />Review</);
});

test('QueueListPanel exposes fast run-of-show fill actions when open slots and ready queue coexist', async () => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    db: {},
    doc: (...parts) => ({ parts }),
    deleteDoc: async () => {},
  }));

  const { default: QueueListPanel } = await import('../../src/apps/Host/components/QueueListPanel.jsx');

  const markup = renderToStaticMarkup(
    React.createElement(QueueListPanel, buildQueueListPanelProps({
      runOfShowAssignableSlots: [
        { id: 'slot-1', label: '#1 · Opener' },
        { id: 'slot-2', label: '#2 · Mid Set' },
      ],
      runOfShowOpenSlots: [
        { id: 'slot-1', label: '#1 · Opener' },
        { id: 'slot-2', label: '#2 · Mid Set' },
      ],
    })),
  );

  assert.match(markup, /data-feature-id="queue-open-slot-actions"/);
  assert.match(markup, /Fill Next Slot/);
  assert.match(markup, /Fill All Suggested/);
  assert.doesNotMatch(markup, /Assign To Next Open Slot/);
  assert.doesNotMatch(markup, /Assign Selected Slot/);
});

test('QueueListPanel tightens copy when there is only one open run-of-show slot', async () => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    db: {},
    doc: (...parts) => ({ parts }),
    deleteDoc: async () => {},
  }));

  const { default: QueueListPanel } = await import('../../src/apps/Host/components/QueueListPanel.jsx');

  const markup = renderToStaticMarkup(
    React.createElement(QueueListPanel, buildQueueListPanelProps({
      runOfShowAssignableSlots: [
        { id: 'slot-1', label: '#1 · Opener' },
      ],
      runOfShowOpenSlots: [
        { id: 'slot-1', label: '#1 · Opener' },
      ],
    })),
  );

  assert.match(markup, /1 open slot can pull from queue/);
  assert.match(markup, /Fill Next Slot/);
  assert.doesNotMatch(markup, /Fill All Suggested/);
  assert.doesNotMatch(markup, /Assign To Next Open Slot/);
});

test('QueueListPanel does not show fast-fill actions for assignable slots that are not truly open', async () => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    db: {},
    doc: (...parts) => ({ parts }),
    deleteDoc: async () => {},
  }));

  const { default: QueueListPanel } = await import('../../src/apps/Host/components/QueueListPanel.jsx');

  const markup = renderToStaticMarkup(
    React.createElement(QueueListPanel, buildQueueListPanelProps({
      runOfShowAssignableSlots: [
        { id: 'slot-2', label: '#2 · Already Planned' },
      ],
      runOfShowOpenSlots: [],
    })),
  );

  assert.doesNotMatch(markup, /data-feature-id="queue-open-slot-actions"/);
  assert.doesNotMatch(markup, /Fill Next Slot/);
  assert.doesNotMatch(markup, /Assign Selected Slot/);
});
