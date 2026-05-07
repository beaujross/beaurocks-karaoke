import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  HOST_RUNTIME_MODE_EMPHASES,
  HOST_RUNTIME_SHELL_MODES,
  buildHostUiPrefsPatch,
  getHostRuntimeModeEmphasis,
  getHostRuntimeShellMode,
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

test('hostUiPrefs runtime shell helpers default safely and honor grouped values', () => {
  assert.equal(getHostRuntimeShellMode({}), HOST_RUNTIME_SHELL_MODES.classic);
  assert.equal(
    getHostRuntimeShellMode({ hostUiPrefs: { runtimeShellMode: HOST_RUNTIME_SHELL_MODES.socialGameNightExperiment } }),
    HOST_RUNTIME_SHELL_MODES.socialGameNightExperiment,
  );
  assert.equal(
    getHostRuntimeModeEmphasis({ hostUiPrefs: { runtimeModeEmphasis: HOST_RUNTIME_MODE_EMPHASES.collaborative } }),
    HOST_RUNTIME_MODE_EMPHASES.collaborative,
  );
  assert.equal(
    getHostRuntimeModeEmphasis({ hostUiPrefs: { runtimeModeEmphasis: 'unknown' } }),
    HOST_RUNTIME_MODE_EMPHASES.hostLed,
  );
});
