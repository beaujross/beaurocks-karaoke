import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueEditSource = readFileSync('src/apps/Host/components/QueueEditSongModal.jsx', 'utf8');
const queueListSource = readFileSync('src/apps/Host/components/QueueListPanel.jsx', 'utf8');
const queueActionsSource = readFileSync('src/apps/Host/hooks/useQueueSongActions.js', 'utf8');

test('format-aware Auto-DJ gives the host one visible and resolvable confirmation path', () => {
  assert.match(queueListSource, /data-autodj-format-review="true"/);
  assert.match(queueListSource, /Auto-DJ waiting/);
  assert.match(queueEditSource, /What will the room hear\?/);
  assert.match(queueEditSource, /Original recording/);
  assert.match(queueEditSource, /Karaoke backing/);
  assert.match(queueActionsSource, /playbackContentKind/);
  assert.match(queueActionsSource, /PLAYBACK_CONTENT_KINDS\.originalRecording/);
});
