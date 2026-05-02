import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queueEditSongModalPath = path.resolve(__dirname, '../../src/apps/Host/components/QueueEditSongModal.jsx');
const queueYouTubeSearchModalPath = path.resolve(__dirname, '../../src/apps/Host/components/QueueYouTubeSearchModal.jsx');

test('queue YouTube search modal stacks above the queue editor drawer', () => {
  const queueEditSongModalSource = readFileSync(queueEditSongModalPath, 'utf8');
  const queueYouTubeSearchModalSource = readFileSync(queueYouTubeSearchModalPath, 'utf8');

  assert.match(
    queueEditSongModalSource,
    /fixed inset-0 z-\[160\]/,
    'Queue editor should remain on its current overlay layer',
  );
  assert.match(
    queueYouTubeSearchModalSource,
    /fixed inset-0 z-\[210\]/,
    'YouTube search modal should use a viewport-level overlay above the queue editor',
  );
  assert.match(
    queueYouTubeSearchModalSource,
    /data-feature-id="queue-youtube-results-scroll"[\s\S]*overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar/,
    'YouTube search modal results should live inside their own bounded scroll surface',
  );
  assert.match(
    queueYouTubeSearchModalSource,
    /fixed inset-0 z-\[210\] flex items-start justify-center overflow-y-auto overscroll-contain/,
    'YouTube search modal overlay should still be reachable on shorter host viewports',
  );
  assert.match(
    queueYouTubeSearchModalSource,
    /aria-label="Close YouTube search"/,
    'YouTube search modal should expose a plainly labeled close action in the visible header chrome',
  );
  assert.match(
    queueYouTubeSearchModalSource,
    /data-feature-id="queue-youtube-close-footer"/,
    'YouTube search modal should keep a second close action at the bottom so the host is not trapped after scrolling',
  );
});
