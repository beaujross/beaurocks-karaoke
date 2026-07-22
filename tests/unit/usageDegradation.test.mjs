import { expect, test } from 'vitest';
import {
  getUsageDegradationMessageForError,
  isUsageControlBlockedError,
  readUsageControlReason,
} from '../../src/lib/usageDegradation';

test('reads callable usage-control reasons from Firebase error details', () => {
  const error = {
    details: {
      reasonCode: 'usage_room_hard_limit_reached',
      capabilityId: 'youtube_metadata_lookup',
    },
  };
  expect(readUsageControlReason(error)).toBe('usage_room_hard_limit_reached');
  expect(isUsageControlBlockedError(error)).toBe(true);
  expect(getUsageDegradationMessageForError(error, { surface: 'audience' }))
    .toContain('song catalog');
});

test('does not mistake unrelated provider errors for a budget pause', () => {
  const error = { code: 'functions/unavailable', message: 'provider failed' };
  expect(readUsageControlReason(error)).toBe('');
  expect(isUsageControlBlockedError(error)).toBe(false);
  expect(getUsageDegradationMessageForError(error)).toBe('');
});

test('AI degradation preserves the protected karaoke path', () => {
  const message = getUsageDegradationMessageForError({
    details: {
      reasonCode: 'usage_workspace_hard_limit_reached',
      capabilityId: 'ai_generation',
    },
  });
  expect(message).toContain('manual Host controls');
});
