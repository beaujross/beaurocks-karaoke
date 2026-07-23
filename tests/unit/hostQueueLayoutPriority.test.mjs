import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostQueueTabPath = path.resolve(__dirname, '../../src/apps/Host/components/HostQueueTab.jsx');
const queueListPanelPath = path.resolve(__dirname, '../../src/apps/Host/components/QueueListPanel.jsx');
const queueSongCardPath = path.resolve(__dirname, '../../src/apps/Host/components/QueueSongCard.jsx');

test('live queue surface keeps the reorderable queue ahead of helper workflows', () => {
  const hostQueueTabSource = readFileSync(hostQueueTabPath, 'utf8');
  const queueListPanelSource = readFileSync(queueListPanelPath, 'utf8');
  const queueSongCardSource = readFileSync(queueSongCardPath, 'utf8');

  const queuePanelIndex = hostQueueTabSource.indexOf('<QueueListPanel');
  const trackCheckIndex = hostQueueTabSource.indexOf('Track Check');
  assert.notStrictEqual(queuePanelIndex, -1, 'Host queue tab should still render the queue panel');
  assert.notStrictEqual(trackCheckIndex, -1, 'Host queue tab should still render Track Check tools');
  assert.ok(
    queuePanelIndex < trackCheckIndex,
    'Host queue tab should render the queue panel before Track Check helper content',
  );

  const readyQueueIndex = queueListPanelSource.indexOf('readyQueueHeaderLabel');
  const lockedQueueIndex = queueListPanelSource.indexOf('lockedInLineup={lockedInLiveLineup}');
  const awaitingApprovalIndex = queueListPanelSource.indexOf('Awaiting Approval');
  const detailsActionIndex = queueSongCardSource.indexOf("selected ? 'Close' : 'Details'");
  assert.notStrictEqual(lockedQueueIndex, -1, 'Queue list panel should still expose the protected live lineup');
  assert.notStrictEqual(readyQueueIndex, -1, 'Queue list panel should expose the unified ready queue heading');
  assert.notStrictEqual(awaitingApprovalIndex, -1, 'Queue list panel should still expose the pending approval section');
  assert.notStrictEqual(detailsActionIndex, -1, 'Queue songs should expose a contextual details action');
  assert.ok(
    readyQueueIndex < lockedQueueIndex && lockedQueueIndex < awaitingApprovalIndex,
    'Queue list panel should lead with the ready lineup, protect its live slots, then show approval work',
  );
});
