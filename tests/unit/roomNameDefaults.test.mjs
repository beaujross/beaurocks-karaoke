import assert from 'node:assert/strict';
import { test } from 'vitest';

import { buildDefaultHostRoomName } from '../../src/apps/Host/roomNameDefaults.js';

test('default Room names include the host and a concise readable timestamp', () => {
  const timestamp = new Date(2026, 7, 1, 19, 5, 6, 123);

  assert.equal(
    buildDefaultHostRoomName('  Beau  ', timestamp),
    'Beau · Aug 1, 2026, 7:05 PM',
  );
});

test('default Room names remain usable before a host name is available', () => {
  const timestamp = new Date(2026, 7, 1, 7, 5, 6, 7);

  assert.equal(
    buildDefaultHostRoomName('', timestamp),
    'Host · Aug 1, 2026, 7:05 AM',
  );
});
