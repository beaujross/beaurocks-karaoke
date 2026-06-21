import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const source = readFileSync('src/hooks/usePitch.js', 'utf8');

test('usePitch memoizes primitive options so mic capture does not remount on every rerender', () => {
  assert.match(
    source,
    /const \{\s*minVolumeThreshold = 0\.02,[\s\S]*uiUpdateIntervalMs = 50\s*\} = options;/,
    'usePitch should unpack primitive options before memoizing the config',
  );
  assert.match(
    source,
    /const opts = useMemo\(\(\) => \(\{[\s\S]*uiUpdateIntervalMs[\s\S]*\}\), \[[\s\S]*uiUpdateIntervalMs[\s\S]*\]\);/,
    'usePitch should memoize from primitive option fields instead of the raw options object identity',
  );
  assert.doesNotMatch(
    source,
    /const opts = useMemo\(\(\) => \(\{[\s\S]*\}\), \[options\]\);/,
    'usePitch should not depend on the raw options object because callers pass fresh literals during normal rerenders',
  );
});
