import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('public TV exposes a full-screen run-of-show release-window vote overlay', () => {
  assert.match(source, /RunOfShowReleaseWindowOverlay/);
  assert.match(source, /isRunOfShowReleaseWindowVotingOpen/);
  assert.match(source, /getRunOfShowReleaseWindowTally/);
  assert.match(source, /getRunOfShowReleaseWindowRemainingMs/);
  assert.match(source, /Audience Song Face-Off/);
  assert.match(source, /Co-Host Song Face-Off/);
  assert.match(source, /total votes/);
  assert.match(source, /Room Code/);
  assert.match(source, /tvReleaseWindowVisible/);
});
