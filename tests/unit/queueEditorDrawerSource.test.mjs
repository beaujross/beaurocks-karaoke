import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueEditSource = readFileSync('src/apps/Host/components/QueueEditSongModal.jsx', 'utf8');
const queueListSource = readFileSync('src/apps/Host/components/QueueListPanel.jsx', 'utf8');

test('queue editor uses a side drawer instead of a centered modal shell', () => {
  assert.match(queueEditSource, /data-feature-id="queue-edit-drawer"/);
  assert.match(queueEditSource, /absolute inset-y-0 right-0/);
  assert.match(queueEditSource, /Queue Inspector/);
  assert.doesNotMatch(queueEditSource, /EDIT SONG METADATA/);
  assert.doesNotMatch(queueEditSource, /items-center justify-center p-4 md:p-6/);
});

test('queue summary bar is quieter and no longer sticky', () => {
  assert.match(queueListSource, /live lane reflects what can actually go on stage/);
  assert.doesNotMatch(queueListSource, /sticky top-0 z-10/);
  assert.match(queueListSource, /Show Queue Bar/);
});
