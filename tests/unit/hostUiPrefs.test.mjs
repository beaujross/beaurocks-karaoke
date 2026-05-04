import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildHostUiPrefsPatch,
  getHostUiPrefs,
  isPostPerformanceBackingPromptEnabled,
} from '../../src/apps/Host/lib/hostUiPrefs.js';

test('hostUiPrefs resolves grouped values first and falls back to legacy room fields', () => {
  assert.deepEqual(getHostUiPrefs({}), {});
  assert.equal(isPostPerformanceBackingPromptEnabled({}), true);
  assert.equal(isPostPerformanceBackingPromptEnabled({ postPerformanceBackingPromptEnabled: false }), false);
  assert.equal(
    isPostPerformanceBackingPromptEnabled({
      postPerformanceBackingPromptEnabled: false,
      hostUiPrefs: { postPerformanceBackingPromptEnabled: true },
    }),
    true,
  );
});

test('hostUiPrefs patch helper merges into the existing object payload', () => {
  assert.deepEqual(
    buildHostUiPrefsPatch(
      { hostUiPrefs: { postPerformanceBackingPromptEnabled: true, compactNav: false } },
      { postPerformanceBackingPromptEnabled: false },
    ),
    { postPerformanceBackingPromptEnabled: false, compactNav: false },
  );
});
