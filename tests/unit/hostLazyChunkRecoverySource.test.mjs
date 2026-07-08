import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const hostAppSource = readFileSync(resolve('src/apps/Host/HostApp.jsx'), 'utf8');

test('Host lazy surfaces recover from stale deployed chunks', () => {
  assert.match(hostAppSource, /const isHostStaleChunkLoadError = \(error = null\) => \{/);
  assert.match(hostAppSource, /failed to fetch dynamically imported module/);
  assert.match(hostAppSource, /mime type of "text\/html"/);
  assert.match(hostAppSource, /requestHostReloadForStaleChunk\(\)/);
  assert.match(hostAppSource, /window\.location\.reload\(\)/);
  assert.match(hostAppSource, /const RunOfShowDirectorPanel = lazyHostSurface\(\(\) => import\('\.\/components\/RunOfShowDirectorPanel'\), 'Show conveyor updated'\);/);
  assert.doesNotMatch(hostAppSource, /const RunOfShowDirectorPanel = React\.lazy/);
});