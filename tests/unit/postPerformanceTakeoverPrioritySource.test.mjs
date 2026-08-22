import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const host = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const tv = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const functionsSource = readFileSync('functions/index.js', 'utf8');

test('Auto-Advance retries only after the post-performance surface lease expires', () => {
  assert.match(host, /getPostPerformanceSurfaceLease\(roomRef\.current \|\| room/);
  assert.match(host, /postPerformanceSurfaceLease\.remainingMs \+ 75/);
});

test('Public TV gives applause and recap priority over a newly-arrived game mode', () => {
  assert.match(tv, /if \(activeGameCartridgeMode && !applauseOverlayVisible && !recap\)/);
  const autoRecapEffect = tv.slice(tv.indexOf('// Auto Recap'), tv.indexOf('const triggerTipPulse'));
  assert.doesNotMatch(autoRecapEffect, /activeMode.*karaoke/);
});

test('the authoritative lineup action rejects starts while post-performance presentation owns the surface', () => {
  assert.match(functionsSource, /getRunOfShowPostPerformanceSurfaceLease\(roomData, nowMsValue\)/);
  assert.match(functionsSource, /Finish the performance recap before starting the next lineup item/);
});
