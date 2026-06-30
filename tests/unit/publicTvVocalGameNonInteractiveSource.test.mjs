import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const pitchRunnerSource = readFileSync('src/games/FlappyBird/Game.jsx', 'utf8');
const overlaySource = readFileSync('src/games/shared/CrowdControlStartOverlay.jsx', 'utf8');

test('Public TV vocal game mic status does not block live gameplay', () => {
  assert.match(overlaySource, /if \(needsMic && !live\)/);
  assert.ok(!/HOST MIC NEEDED/.test(overlaySource));
});

test('Public TV vocal game recap clock ticks until auto-dismiss', () => {
  assert.match(publicTvSource, /const vocalGameRecapActive = room\?\.gameData\?\.recap\?\.active === true/);
  assert.match(publicTvSource, /room\?\.gameData\?\.recap\?\.tvUntilMs/);
  assert.match(publicTvSource, /Number\(vocalGameRecap\?\.tvUntilMs \|\| 0\) > takeoverNowMs/);
});

test('Pitch Runner Public TV shows difficulty as a badge instead of TV-side controls', () => {
  assert.match(pitchRunnerSource, /<span>Difficulty<\/span>/);
  assert.match(pitchRunnerSource, /\{normalizeDifficulty\(visibleState\.difficulty\)\}/);
  assert.ok(!/\['easy', 'normal', 'hard'\]\.map/.test(pitchRunnerSource));
  assert.ok(!/onClick=\{\(\) => setDifficulty\(difficultyKey\)\}/.test(pitchRunnerSource));
});