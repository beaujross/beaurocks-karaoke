import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const addToQueueFormBodyPath = path.resolve(__dirname, '../../src/apps/Host/components/AddToQueueFormBody.jsx');

test('AddToQueueFormBody keeps YouTube/autocomplete results inside a dedicated scroll lane', () => {
  const source = readFileSync(addToQueueFormBodyPath, 'utf8');

  assert.match(
    source,
    /host-autocomplete-results-list min-h-0 flex-1 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar px-2 py-2/,
    'Autocomplete results should be their own compact touch-friendly scroll surface',
  );
  assert.match(
    source,
    /host-autocomplete-shell relative z-30 w-full min-w-0 \$\{dockResults \? 'flex min-h-0 flex-1 flex-col' : ''\}/,
    'Autocomplete shell should fill the available add-song workspace instead of inheriting a narrow field width',
  );
  assert.match(
    source,
    /mt-2 pr-1 \$\{dockResults \? 'flex min-h-0 flex-1 flex-col overflow-hidden' : ''\}/,
    'Docked add workspace should clip the shell and hand scrolling to the active content lane',
  );
  assert.match(
    source,
    /host-autocomplete-results absolute left-1\/2 top-full mt-2 z-50 flex w-\[min\(42rem,calc\(100vw-2rem\)\)\] -translate-x-1\/2 max-h-\[clamp\(18rem,calc\(100dvh-8rem\),82dvh\)\] flex-col overflow-hidden/,
    'Floating autocomplete results should use viewport-aware width and height while still clipping into an internal scroller',
  );
  assert.match(
    source,
    /mt-2 flex min-h-\[16rem\] flex-1 basis-0 flex-col overflow-hidden/,
    'Docked add-tab results should fill the available add workspace and keep an internal scroll lane',
  );
  assert.match(
    source,
    /mt-3 grid min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar pr-1/,
    'Docked moment cards should scroll independently so game and announcement controls stay reachable',
  );
});

test('AddToQueueFormBody autocomplete rows stay dense and metadata-forward', () => {
  const source = readFileSync(addToQueueFormBodyPath, 'utf8');

  assert.match(source, /const getResultDurationSec = \(result = \{\}\) => \{/);
  assert.match(source, /const durationLabel = formatResultDuration\(getResultDurationSec\(r\)\);/);
  assert.match(source, /grid-cols-\[56px_minmax\(0,1fr\)\]/);
  assert.match(source, /line-clamp-1 font-black/);
  assert.match(source, /durationLabel \? \([\s\S]*\{durationLabel\}/);
  assert.match(source, /playbackState\?\.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES\.notEmbeddable \? 'External' : 'TV'/);
  assert.doesNotMatch(source, /r\.sourceDetail/);
});