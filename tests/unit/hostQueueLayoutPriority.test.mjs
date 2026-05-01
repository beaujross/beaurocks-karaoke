import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostQueueTabPath = path.resolve(__dirname, '../../src/apps/Host/components/HostQueueTab.jsx');
const queueListPanelPath = path.resolve(__dirname, '../../src/apps/Host/components/QueueListPanel.jsx');

test('live queue surface keeps the reorderable queue ahead of helper workflows', () => {
  const hostQueueTabSource = readFileSync(hostQueueTabPath, 'utf8');
  const queueListPanelSource = readFileSync(queueListPanelPath, 'utf8');

  const queuePanelIndex = hostQueueTabSource.indexOf('<QueueListPanel');
  const trackCheckIndex = hostQueueTabSource.indexOf('Track Check');
  assert.notStrictEqual(queuePanelIndex, -1, 'Host queue tab should still render the queue panel');
  assert.notStrictEqual(trackCheckIndex, -1, 'Host queue tab should still render Track Check tools');
  assert.ok(
    queuePanelIndex < trackCheckIndex,
    'Host queue tab should render the queue panel before Track Check helper content',
  );

  const readyQueueIndex = queueListPanelSource.indexOf('label="Ready To Run"');
  const quickAccessIndex = queueListPanelSource.indexOf('<QueueQuickAccessPanel');
  const inspectorIndex = queueListPanelSource.indexOf('<QueueInspector');
  assert.notStrictEqual(readyQueueIndex, -1, 'Queue list panel should still label the primary queue section');
  assert.notStrictEqual(quickAccessIndex, -1, 'Queue list panel should still render quick access controls');
  assert.notStrictEqual(inspectorIndex, -1, 'Queue list panel should still render the queue inspector');
  assert.ok(
    readyQueueIndex < quickAccessIndex,
    'Queue list panel should lead with the ready queue before quick access controls',
  );
  assert.ok(
    readyQueueIndex < inspectorIndex,
    'Queue list panel should lead with the ready queue before the queue inspector',
  );
});
