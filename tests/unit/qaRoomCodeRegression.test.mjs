import assert from 'node:assert/strict';
import { test } from 'vitest';

import { extractRoomCodeFromBodyText, isLikelyRoomCode } from '../../scripts/qa/lib/roomCode.js';

test('does not interpret ordinary ALREADY status copy as a room code', () => {
  assert.equal(isLikelyRoomCode('ALREADY'), false);
  assert.equal(extractRoomCodeFromBodyText('Room already created and ready.'), '');
});
