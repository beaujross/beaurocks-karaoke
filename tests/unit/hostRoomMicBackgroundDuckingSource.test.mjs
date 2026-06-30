import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('host room mic vocal games duck background music without rewriting saved bg volume', () => {
  assert.match(hostSource, /HOST_ROOM_MIC_BG_DUCK_LEVEL_PCT = 24/);
  assert.match(hostSource, /const hostRoomMicBgDuckActive = Boolean\(hostVoiceTelemetryTarget\)/);
  assert.match(hostSource, /const hostRoomMicBgDuckVolume = useMemo\(\(\) => \{/);
  assert.match(hostSource, /baseVolume \* \(duckPct \/ 100\)/);
  assert.match(hostSource, /audio\.volume = Math\.max\(0, Math\.min\(1, start \+ \(diff \* eased\)\)\)/);
  assert.ok(!/hostRoomMicBgDuckVolume[\s\S]{0,500}updateRoom\(\{ bgMusicVolume/.test(hostSource));
});