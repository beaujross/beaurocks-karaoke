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
  queueSurfaceCounts: null,
  onAssignQueueSongToRunOfShowItem: noop,
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

test('QueueListPanel renders live queue controls and a queue inspector at runtime', async () => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    db: {},
    doc: (...parts) => ({ parts }),
    deleteDoc: async () => {},
  }));

  const { default: QueueListPanel } = await import('../../src/apps/Host/components/QueueListPanel.jsx');
  const markup = renderToStaticMarkup(
    React.createElement(QueueListPanel, buildQueueListPanelProps()),
  );

  assert.match(markup, /data-feature-id="queue-live-controls"/);
  assert.match(markup, /Queue Controls/);
  assert.match(markup, /Queue Rules/);
  assert.match(markup, /Automation/);
  assert.match(markup, /Open Conveyor/);
  assert.match(markup, /data-feature-id="queue-song-inspector"/);
  assert.match(markup, /Queue Inspector/);
  assert.match(markup, /Start Singer/);
  assert.match(markup, /Move To Next/);
  assert.match(markup, /Edit Details/);
});

test('QueueListPanel inspector adapts to held and review-needed queue items', async () => {
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
  assert.match(heldMarkup, /Restore Singer/);

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
  assert.match(reviewMarkup, /Pick Backing/);
});
