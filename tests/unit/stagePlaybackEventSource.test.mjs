import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/components/Stage.jsx', 'utf8');

test('Stage decorates playback events with performance-session context', () => {
  assert.match(
    source,
    /import \{ attachPerformancePlaybackContext \} from '\.\.\/lib\/performanceSessionPlayback';/,
    'Stage should import the performance playback context helper.',
  );
  assert.match(
    source,
    /onPlaybackEvent\(attachPerformancePlaybackContext\(event, \{ room, current \}\)\);/,
    'Stage should stamp outgoing playback events with the active room and current-song session context.',
  );
});

test('Stage ignores YouTube postMessage traffic from stale iframes', () => {
  assert.match(
    source,
    /if \(iframeRef\.current\?\.contentWindow && event\?\.source !== iframeRef\.current\.contentWindow\) return;/,
    'Stage should reject YouTube postMessage events that do not come from the active iframe.',
  );
});
