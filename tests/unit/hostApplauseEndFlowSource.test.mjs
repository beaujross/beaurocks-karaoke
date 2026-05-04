import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');

test('host end flow separates early backing corrections from normal applause finalization', () => {
  assert.match(
    source,
    /const applauseRunning = applauseMode === 'applause_countdown' \|\| applauseMode === 'applause' \|\| applauseMode === 'applause_result';/,
    'Host end-performance logic should still treat the full applause sequence as one active flow.',
  );
  assert.match(
    source,
    /const source = String\(options\?\.source \|\| 'host'\)\.trim\(\)\.toLowerCase\(\) \|\| 'host';/,
    'End-performance handling should distinguish direct host taps from auto/session completions.',
  );
  assert.match(
    source,
    /source === 'host'[\s\S]*performanceElapsedSec < EARLY_END_DECISION_THRESHOLD_SEC[\s\S]*setPendingEarlyEndDecision\(\{/s,
    'Very early manual endings should ask the host whether the issue was the backing before applause starts.',
  );
  assert.match(
    source,
    /const handleFinishPerformance = useCallback\(async \(songId = ''\) => \{[\s\S]*await startApplauseSequence\(\{ songId: targetSongId, autoFinalize: true \}\);/s,
    'Normal finish flow should still route through applause auto-finalize.',
  );
  assert.match(
    source,
    /handleEndPerformance\(currentSongId, \{ source: 'session' \}\)/,
    'Playback-session completion should bypass the early host decision prompt.',
  );
  assert.match(
    source,
    /handleEndPerformance\(String\(current\?\.id \|\| ''\), \{ source: 'auto' \}\)/,
    'Timed auto-end should also bypass the early host decision prompt.',
  );
  assert.match(
    source,
    /await updateRoom\(\{\s*activeMode: 'applause_countdown',\s*activeScreen: 'stage',\s*applausePeak: 0,\s*currentApplauseLevel: 0,\s*applauseSubject,\s*announcement: null,\s*tvPreviewOverlay: null,\s*roundWinnersMoment: null,\s*howToPlay: \{ active: false, id: nowMs\(\) \},\s*'readyCheck\.active': false\s*\}\);/s,
    'Starting applause should still clear the transient TV blockers that previously prevented the meter from mounting.',
  );
});

test('backing review prompt stays below top chrome and uses stable later-dismiss actions', () => {
  assert.match(
    source,
    /fixed bottom-4 right-4 z-\[190\] w-\[min\(92vw,24rem\)\]/,
    'Backing review prompt should mount in a bottom-safe position instead of clipping under top chrome.',
  );
  assert.match(
    source,
    /How was that backing\?/,
    'Backing review copy should read like a quick host check instead of a generic track-check popup.',
  );
  assert.match(
    source,
    /handlePostPerformanceBackingPromptAction\(null, 'later'\)/,
    'Prompt should offer a non-jumping later path instead of forcing the host into Inbox immediately.',
  );
  assert.match(
    source,
    /handlePostPerformanceBackingPromptAction\(null, 'dismiss'\)/,
    'Prompt should expose a true dismiss action so handled items do not feel like they resurrect.',
  );
  assert.match(
    source,
    /showPostPerformanceBackingPrompt\(targetSong\);/,
    'The prompt should appear as applause starts so hosts can review while the room is already in the end-of-song beat.',
  );
});
