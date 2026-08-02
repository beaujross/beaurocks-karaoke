import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueSongCardSource = readFileSync('src/apps/Host/components/QueueSongCard.jsx', 'utf8');
const queueListPanelSource = readFileSync('src/apps/Host/components/QueueListPanel.jsx', 'utf8');
const queueSongInspectorSource = readFileSync('src/apps/Host/components/QueueSongInspector.jsx', 'utf8');

test('queue rows expose contextual actions and preserve deeper operations in the selected card', () => {
  assert.match(queueSongCardSource, /selected \? 'Close' : 'Details'/);
  assert.match(queueSongCardSource, /expandSelectedInline/);
  assert.match(queueSongCardSource, /onSelect\?\.\(song\)/);
  assert.match(queueSongCardSource, /Approve/);
  assert.match(queueSongCardSource, /Review/);
  assert.match(queueSongCardSource, /Linked/);
  assert.match(queueSongCardSource, /title="Edit queue item details"/);
  assert.match(queueSongCardSource, /title="Temporarily hold this singer"/);
  assert.match(queueSongCardSource, /title=\{isPendingApproval \? 'Remove this pending request' : 'Remove this singer from the queue'\}/);
  assert.match(queueSongCardSource, /data-feature-id="queue-song-slot-assignment"/);
  assert.doesNotMatch(queueSongCardSource, /Queue Actions/);
  assert.doesNotMatch(queueSongCardSource, /data-feature-id="queue-song-inline-actions"/);
  assert.doesNotMatch(queueSongCardSource, /data-feature-id="queue-song-expanded-actions"/);
});

test('queue list routes selection to a responsive inspector without a duplicate queue-controls slab', () => {
  assert.match(queueListPanelSource, /<QueueSongInspector/);
  assert.match(queueSongInspectorSource, /data-feature-id="queue-song-inspector"/);
  assert.match(queueSongInspectorSource, /createPortal/);
  assert.doesNotMatch(queueListPanelSource, /data-feature-id="queue-live-controls"/);
  assert.doesNotMatch(queueListPanelSource, /Queue Controls/);
  assert.doesNotMatch(queueListPanelSource, /Queue Rules/);
  assert.doesNotMatch(queueListPanelSource, /Open Conveyor/);
  assert.match(queueListPanelSource, /Fill Next Slot/);
  assert.match(queueListPanelSource, /Fill All Suggested/);
  assert.match(queueListPanelSource, /Awaiting Approval/);
  assert.match(queueListPanelSource, /QueueSectionHeader/);
  assert.match(queueListPanelSource, /HOST_LIVE_OPS_LANGUAGE\.lineup\} Order/);
  assert.match(queueListPanelSource, /getReadyQueuePositionLabel/);
  assert.match(queueListPanelSource, /queuePositionLabel=\{getReadyQueuePositionLabel\(i\)\}/);
  assert.doesNotMatch(queueListPanelSource, /QueueSectionToggle/);
});
