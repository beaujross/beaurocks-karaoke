import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueSongCardSource = readFileSync('src/apps/Host/components/QueueSongCard.jsx', 'utf8');
const queueListPanelSource = readFileSync('src/apps/Host/components/QueueListPanel.jsx', 'utf8');

test('queue rows expose deeper actions inline instead of routing to a separate inspector', () => {
  assert.match(queueSongCardSource, /Queue Actions/);
  assert.match(queueSongCardSource, /selected \? 'Less' : 'More'/);
  assert.match(queueSongCardSource, /onSelect\?\.\(song\)/);
  assert.match(queueSongCardSource, /Approve/);
  assert.match(queueSongCardSource, /Review/);
  assert.match(queueSongCardSource, /Linked/);
  assert.match(queueSongCardSource, /Edit Details/);
  assert.match(queueSongCardSource, /Hold Singer/);
  assert.match(queueSongCardSource, /Remove From Queue/);
});

test('queue list keeps queue-item operations inside the cards and preserves live controls', () => {
  assert.doesNotMatch(queueListPanelSource, /data-feature-id="queue-song-inspector"/);
  assert.match(queueListPanelSource, /data-feature-id="queue-live-controls"/);
  assert.match(queueListPanelSource, /Queue Controls/);
  assert.match(queueListPanelSource, /Queue Rules/);
  assert.match(queueListPanelSource, /Automation/);
  assert.match(queueListPanelSource, /Rotation/);
  assert.match(queueListPanelSource, /Request Cap/);
  assert.match(queueListPanelSource, /First-Time Boost/);
  assert.match(queueListPanelSource, /Auto DJ/);
  assert.match(queueListPanelSource, /Auto End/);
  assert.match(queueListPanelSource, /Auto Party/);
  assert.match(queueListPanelSource, /Pop Trivia/);
  assert.match(queueListPanelSource, /Fill Next Slot/);
  assert.match(queueListPanelSource, /Fill All Suggested/);
  assert.match(queueListPanelSource, /Awaiting Approval/);
});
