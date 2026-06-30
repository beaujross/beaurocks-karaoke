import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const singerSource = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const engineSource = readFileSync('src/apps/TV/lobbyPlaygroundEngine.js', 'utf8');

test('Volley Orb audience mode is simplified around room voice and backup air', () => {
  assert.match(singerSource, /Room mic leads/);
  assert.match(singerSource, /Make sound toward the room microphone/);
  assert.match(singerSource, /Backup Control/);
  assert.match(singerSource, /Add Air/);
  assert.ok(!/LOBBY_PLAYGROUND_INTERACTIONS\\.map/.test(singerSource));
  assert.ok(!/LOBBY_PLAYGROUND_ULTIMATES\\.map/.test(singerSource));
});

test('Volley Orb public TV uses phased altitude camera and phase copy', () => {
  assert.match(publicTvSource, /LOBBY_ALTITUDE_MAX_TRACKED_FT = 220/);
  assert.match(publicTvSource, /LOBBY_ALTITUDE_MAX_CAMERA_SHIFT_PCT = 64/);
  assert.match(publicTvSource, /climbPct \/ 92/);
  assert.match(publicTvSource, /phaseLabel: lobbyLevelMeta\.label/);
});

test('Volley Orb voice engine starts with forgiving volume inflation', () => {
  assert.match(engineSource, /phase: 'inflate'/);
  assert.match(engineSource, /volumeOnly: true/);
  assert.match(engineSource, /target\.volumeOnly \? 0\.65 : 1\.1/);
  assert.match(engineSource, /BLOW AIR/);
});
test('Volley Orb audience backup-air progress bar has a scoped usage percentage', () => {
  const declarationIndex = singerSource.indexOf('const lobbyPlayUsagePct = lobbyPlayMaxPerMinute > 0');
  const progressUseIndex = singerSource.indexOf('Math.max(12, Math.min(100, lobbyPlayUsagePct))');

  assert.ok(declarationIndex > 0, 'SingerApp should derive lobbyPlayUsagePct from the active rate plan');
  assert.ok(progressUseIndex > declarationIndex, 'SingerApp should declare lobbyPlayUsagePct before the backup-air progress bar reads it');
  assert.match(singerSource, /\? \(lobbyPlayUsageCount \/ lobbyPlayMaxPerMinute\) \* 100\s*: 0;/);
});

test('Volley Orb public TV maps crowd actions to visible orb physics', () => {
  assert.match(publicTvSource, /LOBBY_VOLLEY_PHASE_VISUALS/);
  assert.match(publicTvSource, /Room voice fills the balloon/);
  assert.match(publicTvSource, /Phones add backup air/);
  assert.match(publicTvSource, /Crowd Controls/);
  assert.match(publicTvSource, /lobby-volley-orb-phase-\$\{lobbyVolleyPhaseKey\}/);
  assert.match(publicTvSource, /--lobby-volley-inflation-scale/);
  assert.match(publicTvSource, /lobby-volley-orb-air-rings/);
  assert.match(publicTvSource, /lobby-volley-orb-thrust/);
  assert.match(publicTvSource, /lobbyOrbCameraSpeedPct/);
  assert.match(publicTvSource, /duration-700 ease-out/);
  assert.match(publicTvSource, /label: 'Add Air'/);
  assert.match(publicTvSource, /action: 'Add Air'/);
  assert.ok(!/action: item\.label/.test(publicTvSource));
});
