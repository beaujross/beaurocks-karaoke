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
