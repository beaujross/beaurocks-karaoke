import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getCheckoutLaunchFeedback, getReactionFeedback } from '../../src/lib/roomActionFeedback.js';

test('reaction feedback reports balance and performer-score effects', () => {
  assert.equal(getReactionFeedback({ cost: 10, currencyLabel: 'BB', performerName: 'Taylor' }), "Reaction sent • 10 BB spent • Taylor's performer score increased");
  assert.equal(getReactionFeedback({ cost: 0 }), 'Reaction sent • FREE');
});

test('room votes and checkout launches do not imply financial completion', () => {
  assert.equal(getReactionFeedback({ roomInfluence: true }), 'Room vote sent • FREE');
  assert.equal(getCheckoutLaunchFeedback('Givebutter'), 'Givebutter checkout opened • no payment is recorded until you complete it there');
});
