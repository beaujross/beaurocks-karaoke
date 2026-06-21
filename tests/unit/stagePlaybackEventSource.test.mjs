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


test('Stage wraps YouTube postMessage calls and waits for iframe load before listening', () => {
  assert.match(
    source,
    /const postYouTubeFrameMessage = \(frame = null, message = \{\}, targetOrigin = YOUTUBE_DEFAULT_FRAME_ORIGIN\) => \{[\s\S]*try \{[\s\S]*postMessage\(JSON\.stringify\(message\), targetOrigin/,
    'Stage should catch YouTube postMessage origin races instead of throwing in Public TV.',
  );
  assert.match(
    source,
    /const youtubeIframeReady = youtubeIframeReadyKey === youtubeFrameKey;[\s\S]*if \(!isYoutube \|\| !youtubeId \|\| !youtubeIframeReady/,
    'Stage should wait for the active YouTube iframe load before subscribing to iframe messages.',
  );
});

test('Stage reports a fallback ended event when trusted YouTube duration elapses', () => {
  assert.match(
    source,
    /const getTrustedYoutubeDurationSec = \(\{ room = \{\}, current = \{\} \} = \{\}\) => \{[\s\S]*meta\?\.autoEndSafe === true[\s\S]*playerReportedDurationSec <= 0\) return 0;/,
    'Stage should only use explicit safe metadata or player-reported duration for fallback YouTube ending.',
  );
  assert.match(
    source,
    /completionReason: 'duration_elapsed_fallback'/,
    'Stage should mark the session ended if YouTube never emits an ended state after the trusted duration.',
  );
});
