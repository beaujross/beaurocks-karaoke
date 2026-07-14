import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostRoomLaunchPadBrowser.jsx', 'utf8');

test('room creation previews the shared guest economy before launch', () => {
  assert.match(source, /getRoomEconomySummary/);
  assert.match(source, /const launchEconomySummary = getRoomEconomySummary\(eventCreditsConfig\)/);
  assert.match(source, /data-launch-economy-preview="true"/);
  assert.match(source, /What guests experience/);
  assert.match(source, /launchEconomySummary\.cards\.map/);
  assert.match(source, /launchEconomySummary\.warnings\.join/);
});
