import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueSongCardSource = readFileSync('src/apps/Host/components/QueueSongCard.jsx', 'utf8');
const queueListPanelSource = readFileSync('src/apps/Host/components/QueueListPanel.jsx', 'utf8');

test('queue rows expose deeper actions inline instead of routing to a separate inspector', () => {
  assert.match(queueSongCardSource, /selected \? 'Less' : 'More'/);
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

test('queue list keeps queue-item operations inside the cards without a duplicate queue-controls slab', () => {
  assert.doesNotMatch(queueListPanelSource, /data-feature-id="queue-song-inspector"/);
  assert.doesNotMatch(queueListPanelSource, /data-feature-id="queue-live-controls"/);
  assert.doesNotMatch(queueListPanelSource, /Queue Controls/);
  assert.doesNotMatch(queueListPanelSource, /Queue Rules/);
  assert.doesNotMatch(queueListPanelSource, /Open Conveyor/);
  assert.match(queueListPanelSource, /Fill Next Slot/);
  assert.match(queueListPanelSource, /Fill All Suggested/);
  assert.match(queueListPanelSource, /Awaiting Approval/);
});
