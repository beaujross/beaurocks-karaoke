import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('PublicTV validates playback events against the active performance session before writing room state', () => {
  assert.match(
    source,
    /import \{ buildPerformanceSessionPlaybackWrite \} from '\.\.\/\.\.\/lib\/performanceSessionPlayback';/,
    'PublicTV should import the playback-session write helper.',
  );
  assert.match(
    source,
    /const nextWrite = buildPerformanceSessionPlaybackWrite\(\{\s*event,\s*session: room\?\.currentPerformanceSession,\s*currentPerformanceMeta: room\?\.currentPerformanceMeta,\s*mediaUrl: room\?\.mediaUrl,\s*now: nowMs\(\)\s*\}\);/,
    'PublicTV should centralize playback-session writes through the tested helper.',
  );
  assert.match(
    source,
    /if \(!nextWrite\) return;/,
    'PublicTV should bail out when the helper rejects a stale or invalid playback event.',
  );
});

test('PublicTV reports playback telemetry directly without calling host-only room controls', () => {
  assert.doesNotMatch(
    source,
    /updateRoomAsHost/,
    'PublicTV is display telemetry and should not call the host-only room controls callable.',
  );
  assert.doesNotMatch(
    source,
    /buildPerformanceSessionHostFallbackUpdate/,
    'PublicTV should avoid host fallback writes that fail for non-host TV sessions.',
  );
  assert.match(
    source,
    /await updateDoc\(doc\(db, "artifacts", APP_ID, "public", "data", "rooms", roomCode\), nextWrite\.patch\);/,
    'PublicTV should use the narrow Firestore telemetry write path.',
  );
});
