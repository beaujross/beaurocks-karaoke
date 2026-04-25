import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueSongCardSource = readFileSync('src/apps/Host/components/QueueSongCard.jsx', 'utf8');
const queueListPanelSource = readFileSync('src/apps/Host/components/QueueListPanel.jsx', 'utf8');

test('queue rows stay lighter and route deeper actions into an inspector', () => {
  assert.match(queueSongCardSource, /Inspect/);
  assert.match(queueSongCardSource, /onSelect\?\.\(song\)/);
  assert.match(queueSongCardSource, /Approve/);
  assert.match(queueSongCardSource, /Review/);
  assert.match(queueSongCardSource, /Linked/);
  assert.doesNotMatch(queueSongCardSource, />More\s*</);
  assert.doesNotMatch(queueSongCardSource, />Edit\s*</);
});

test('queue list exposes one inspector surface for queue-item operations', () => {
  assert.match(queueListPanelSource, /data-feature-id="queue-song-inspector"/);
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
  assert.match(queueListPanelSource, /Queue Inspector/);
  assert.match(queueListPanelSource, /Start Singer/);
  assert.match(queueListPanelSource, /Approve Request/);
  assert.match(queueListPanelSource, /Pick Backing/);
  assert.match(queueListPanelSource, /Edit Linked Song/);
  assert.match(queueListPanelSource, /Move To Next/);
  assert.match(queueListPanelSource, /Edit Details/);
  assert.match(queueListPanelSource, /Hold Singer/);
  assert.match(queueListPanelSource, /Remove From Queue/);
  assert.match(queueListPanelSource, /Assign Slot|Reassign Slot/);
  assert.match(queueListPanelSource, /Awaiting Approval/);
});
