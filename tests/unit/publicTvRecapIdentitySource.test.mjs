import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('PublicTV recap leaderboard prefers the fresh recap payload for the just-finished performance', () => {
  assert.match(
    source,
    /const isSamePerformanceRecapSong = \(song = null, activeRecap = null\) => \{/,
    'PublicTV should centralize recap-to-performance matching instead of scattering looser comparisons.',
  );
  assert.match(
    source,
    /matchingRecapSongIndex >= 0[\s\S]*\{ \.\.\.song, \.\.\.recap, status: 'performed', isCurrentPerformance: true \}/s,
    'When the performed song already exists locally, the TV should merge in the fresh recap payload so names and scores do not lag behind.',
  );
  assert.doesNotMatch(
    source,
    /\|\| \(song\?\.songId && recap\?\.songId && String\(song\.songId\) === String\(recap\.songId\)\)/,
    'Canonical song ids are too broad for recap identity and should not be used as the primary match key.',
  );
});

test('PublicTV recap refreshes when the same performance receives fresher score fields', () => {
  assert.match(
    source,
    /const buildPerformanceRecapKey = \(recap = null\) => \{/,
    'PublicTV should derive a stable recap identity for refresh checks.',
  );
  assert.match(
    source,
    /const recapNeedsRefresh = \([\s\S]*nextRecapKey !== activeRecapKey[\s\S]*Number\(room\.lastPerformance\?\.hypeScore \|\| 0\) !== Number\(recap\?\.hypeScore \|\| 0\)[\s\S]*Number\(room\.lastPerformance\?\.applauseScore \|\| 0\) !== Number\(recap\?\.applauseScore \|\| 0\)[\s\S]*Number\(room\.lastPerformance\?\.hostBonus \|\| 0\) !== Number\(recap\?\.hostBonus \|\| 0\)/s,
    'The recap overlay should replace stale local data when later room snapshots bring corrected performer scores.',
  );
});

test('PublicTV only auto-opens finalized recaps and prefers the finalized total score field', () => {
  assert.match(
    source,
    /const recapEligible = room\.lastPerformance\?\.recapScoreFinalized === true;/,
    'PublicTV should not auto-open recap overlays from non-finalized performance payloads.',
  );
  assert.match(
    source,
    /const totalPoints = Math\.max\(0, Number\(recap\.totalPoints \?\? \(vibeScore \+ applauseScore \+ hostBonus\)\)\);/,
    'PublicTV should use the host-provided finalized total score when available.',
  );
});
test('PublicTV recap next-up phase prefers the finalized host snapshot', () => {
  assert.match(
    source,
    /const recapNextUpSnapshot = Array\.isArray\(recap\?\.nextUpSnapshot\)[\s\S]*const recapNextUpLineup = recapNextUpSnapshot\.length \? recapNextUpSnapshot : nextUp\.slice\(0, 3\);/s,
    'The recap next-up screen should use the host-captured lineup before falling back to the live queue.',
  );
  assert.match(
    source,
    /<PerformanceNextUpOverlay[\s\S]*nextUp=\{recapNextUpLineup\}/s,
    'PerformanceNextUpOverlay should receive the stable recap lineup during the recap loop.',
  );
});
test('PublicTV recap stages score subtotals before revealing the final total', () => {
  assert.ok(source.includes('const recapScoreFocusIndex = Math.max('));
  assert.ok(source.includes('const recapScoreVisibleCount = Math.max(0, Math.min(scoreBreakdownCards.length, recapScoreFocusIndex + 1));'));
  assert.ok(source.includes('const recapScoreTotalVisible = recapAgeMs >= recapScoreTotalRevealMs;'));
  assert.match(source, /const recapDetailsVisible = recapAgeMs >= recapScoreTotalRevealMs \+ Math\.min\(2200, Math\.max\(1200, Math\.round\(recapScoreStepMs \* 0\.85\)\)\);/);
  assert.match(
    source,
    /scoreBreakdownCards\.map\(\(item, index\) => \{[\s\S]*const active = !recapScoreTotalVisible && index === recapScoreFocusIndex;[\s\S]*const completed = recapScoreTotalVisible \|\| index < recapScoreFocusIndex;[\s\S]*recap-score-arrival/s,
    'Score subtotal cards should arrive one at a time before the final score reveal.',
  );
  assert.match(
    source,
    /recap-total-reveal[\s\S]*<RecapCountUpNumber[\s\S]*value=\{totalPoints\}[\s\S]*active=\{recapScoreTotalVisible\}/s,
    'The final score should count up after the subtotal tally has landed.',
  );
});
test('PublicTV recap has synthesized game-show UI cue hooks', () => {
  assert.match(source, /const playTvUiCue = useCallback\(\(cue = 'tick'/);
  assert.match(source, /case 'score_bonus':/);
  assert.match(source, /case 'total_reveal':/);
  assert.match(source, /case 'next_up':/);
  assert.match(source, /playTvUiCue\('score_tick'/);
});

test('PublicTV recap score reveal counts subtotals and total up with dramatic timing', () => {
  assert.match(source, /const RecapCountUpNumber = \(\{ value = 0, active = false, completed = false, durationMs = 1100/);
  assert.ok(source.includes('durationMs={recapScoreCountDurationMs}'));
  assert.ok(source.includes('durationMs={2300}'));
  assert.match(source, /performanceRecapScoreStepMs/);
  assert.match(source, /recapScoreStepMs = performanceRecapScoreStepMs;/);
  assert.match(source, /const recapScoreFinalHoldMs = Math\.max\(5200, Math\.min\(9000, Math\.round\(recapScoreStepMs \* 2\.25\)\)\);/);
  assert.match(source, /const recapBreakdownPhaseMs = Math\.max\([\s\S]*recapScoreTotalRevealMs \+ recapScoreFinalHoldMs[\s\S]*\);/);
});

test('PublicTV recap score screen keeps long song metadata inside the TV viewport', () => {
  assert.match(source, /const recapTitleClampStyle = \{[\s\S]*WebkitLineClamp: isVeryShortViewport \? 1 : 2[\s\S]*overflowWrap: 'anywhere'[\s\S]*\};/);
  assert.match(source, /style=\{recapTitleClampStyle\}/);
  assert.match(source, /<div className="min-h-0 flex-1 overflow-hidden">/);
  assert.match(source, /\{recapDetailsVisible && crowdMomentCards\.length > 0 && \(/);
  assert.match(source, /\{recapDetailsVisible && \(\s*<div className="rounded-\[1\.8rem\] border border-white\/10 bg-black\/20 p-5/);
  assert.match(source, /Score Locked[\s\S]*Added to tonight's board/);
});
test('PublicTV recap empty next-up phase prompts guests to join the queue', () => {
  assert.match(source, /<PerformanceNextUpOverlay[\s\S]*roomCode=\{roomCode\}[\s\S]*joinUrl=\{joinUrl\}/s);
  assert.match(source, /const emptyQueueQrValue = String\(joinUrl \|\| ''\)\.trim\(\) \|\|/);
  assert.match(source, /Who wants the next song\?/);
  assert.match(source, /<LocalQrImage value=\{emptyQueueQrValue\}/);
});
