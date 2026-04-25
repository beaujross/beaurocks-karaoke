import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');

test('audience app exposes run-of-show release-window controls for crowd and co-host voters', () => {
  assert.match(source, /getRunOfShowOperatorRole/);
  assert.match(source, /getRunOfShowReleaseWindowTally/);
  assert.match(source, /const canSeeAudienceReleaseWindow = useMemo/);
  assert.match(source, /const castRunOfShowReleaseVote = useCallback/);
  assert.match(source, /runOfShowDirector\.releaseWindow\.votesByUid/);
  assert.match(source, /Release Window/);
  assert.match(source, /Slot Scene/);
  assert.match(source, /Keep Singing/);
});
