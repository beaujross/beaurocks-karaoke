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
});
