import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const badgeSource = fs.readFileSync(path.join(repoRoot, 'src/components/ContentSourceBadge.jsx'), 'utf8');
const queueCardSource = fs.readFileSync(path.join(repoRoot, 'src/apps/Host/components/QueueSongCard.jsx'), 'utf8');
const queueTabSource = fs.readFileSync(path.join(repoRoot, 'src/apps/Host/components/HostQueueTab.jsx'), 'utf8');

test('source badge exposes the normalized provider for compact branded treatments', () => {
  assert.match(badgeSource, /data-content-source=\{sourceMeta\.id\}/);
  assert.match(badgeSource, /getContentSourceMeta/);
});

test('queue presents sources by exception and distinguishes song-only review', () => {
  assert.match(queueCardSource, /playbackSelection\.showSource/);
  assert.match(queueCardSource, /Choose Version/);
  assert.match(queueCardSource, /Song only · host picks version/);
  assert.match(queueTabSource, /Song only · choose version/);
  assert.match(queueTabSource, /playbackSelection\.detail/);
});
