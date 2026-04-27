import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('functions/index.js', 'utf8');

test('directory discover suppresses host-published room sessions while preserving official room entries', () => {
  assert.match(
    source,
    /const sourceType = String\(item\.sourceType \|\| ""\)\.trim\(\)\.toLowerCase\(\);/,
    'Discover filtering should normalize listing source type before making room-session visibility decisions',
  );
  assert.match(
    source,
    /const isHostRoomSession = item\.listingType === "room_session" && sourceType === "host_room";/,
    'Discover filtering should explicitly identify host-published room sessions',
  );
  assert.match(
    source,
    /if \(isHostRoomSession && !item\.isOfficialBeauRocksListing\) return false;/,
    'Public discover should hide ad hoc host room sessions while leaving the official AAHF room available',
  );
});
