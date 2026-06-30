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

test('backing review prompt stays in the stage rail and uses stable later-dismiss actions', () => {
  assert.doesNotMatch(
    source,
    /fixed bottom-4 right-4 z-\[190\] w-\[min\(92vw,24rem\)\]/,
    'Backing review prompt should not mount as a floating bottom-right widget that blocks host controls.',
  );
  assert.match(
    source,
    /if \(normalizedAction === 'later' \|\| normalizedAction === 'defer'\) \{\s*deferTrackCheckToInbox\(activePrompt, \{ focusInbox: false \}\);/s,
    'Prompt should offer a non-jumping later path instead of forcing the host into Inbox immediately.',
  );
  assert.match(
    source,
    /if \(normalizedAction === 'skip' \|\| normalizedAction === 'dismiss'\) \{\s*dismissTrackCheck\(activePrompt\);/s,
    'Prompt should expose a true dismiss action so handled items do not feel like they resurrect.',
  );
  assert.match(
    source,
    /showPostPerformanceBackingPrompt\(targetSong\);/,
    'The stage rail prompt should appear as applause starts so hosts can review while the room is already in the end-of-song beat.',
  );
});
test('host performance recap carries next-up and applause has a persisted fallback deadline', () => {
  assert.match(
    source,
    /const buildNextUpSnapshot = useCallback\(\(excludeSongId = ''\) => \{[\s\S]*singerAvatar: String\(song\?\.singerAvatar \|\| song\?\.avatar \|\| song\?\.emoji \|\| ''\)\.trim\(\),[\s\S]*lineupPosition: index \+ 1[\s\S]*\}, \[assigned, queue\]\);/s,
    'HostQueueTab should capture the ready lineup when finalizing a performance.',
  );
  assert.match(
    source,
    /const nextUpSnapshot = buildNextUpSnapshot\(id\);[\s\S]*nextUpSnapshot,[\s\S]*nextUpSnapshotCreatedAtMs: performanceEndedAtMs,/s,
    'The finalized recap payload should carry a stable next-up snapshot for the public TV recap loop.',
  );
  assert.match(
    source,
    /autoFinalizeDeadlineMs[\s\S]*applauseSubject = autoFinalize[\s\S]*autoFinalize: true,[\s\S]*autoFinalizeSongId: songId,[\s\S]*autoFinalizeDeadlineMs/s,
    'Auto-finalizing applause should persist its recovery deadline in the room subject.',
  );
  assert.match(
    source,
    /applause_deadline_elapsed[\s\S]*runUpdateStatus\(pendingSongId, 'performed'\)/s,
    'The host should finalize from the persisted applause deadline when the TV countdown path does not report back.',
  );
});
