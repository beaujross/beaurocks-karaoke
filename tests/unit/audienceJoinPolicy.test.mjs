import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  AUDIENCE_JOIN_ACCESS_MODES,
  AUDIENCE_JOIN_ACCESS_OPTIONS,
  normalizeAudienceJoinPolicy,
} from '../../src/lib/audienceJoinPolicy.js';

test('audience join policy preserves passcode-required access', () => {
  const policy = normalizeAudienceJoinPolicy({ accessMode: 'passcode_required' });
  assert.equal(policy.accessMode, AUDIENCE_JOIN_ACCESS_MODES.passcodeRequired);
  assert.ok(AUDIENCE_JOIN_ACCESS_OPTIONS.some((option) => option.id === policy.accessMode));
});

test('unknown audience join modes fall back to anonymous access', () => {
  const policy = normalizeAudienceJoinPolicy({ accessMode: 'unknown' });
  assert.equal(policy.accessMode, AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed);
});
