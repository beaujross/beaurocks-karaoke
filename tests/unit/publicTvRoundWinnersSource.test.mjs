import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('PublicTV round winners overlay displays prize and leaderboard stat context', () => {
  assert.match(publicTvSource, /const prize = moment\?\.prize/);
  assert.match(publicTvSource, /const metricLabel = String\(moment\?\.leaderboardMetricLabel/);
  assert.match(publicTvSource, /alt=\{prizeTitle \|\| 'Prize'\}/);
  assert.match(publicTvSource, /\{winner\.statValue\} \{winner\.statUnit \|\| ''\}/);
});
