import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const launcherSource = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');
const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const pitchRunnerSource = readFileSync('src/games/FlappyBird/Game.jsx', 'utf8');
const vocalChallengeSource = readFileSync('src/games/VocalChallenge/Game.jsx', 'utf8');
const ridingScalesSource = readFileSync('src/games/RidingScales/Game.jsx', 'utf8');
const teamPongSource = readFileSync('src/games/TeamPong/Game.jsx', 'utf8');
const musicalMomentsSource = readFileSync('src/games/MusicalMoments/Game.jsx', 'utf8');

test('vocal games publish and preserve normalized post-game recaps', () => {
  assert.match(launcherSource, /const buildVocalGameRecap = \(modeId = '', gameData = \{\}\) => \{/);
  assert.match(launcherSource, /gameData: recap \? \{ recap \} : null/);
  assert.match(pitchRunnerSource, /const buildPitchRunnerRecap = \(state = \{\}, data = \{\}\) => \{/);
  assert.match(pitchRunnerSource, /activeMode: 'karaoke',[\s\S]*gameData: \{ recap \}/);
  assert.match(vocalChallengeSource, /const buildVocalChallengeRecap = \(state = \{\}, data = \{\}\) => \{/);
  assert.match(ridingScalesSource, /const buildRidingScalesRecap = \(state = \{\}, gameData = \{\}\) => \{/);
});

test('continuous vocal crowd games write liveStats for host-ended recaps', () => {
  assert.match(teamPongSource, /'gameData\.liveStats': \{[\s\S]*rallyCount[\s\S]*teamworkMultiplier/);
  assert.match(musicalMomentsSource, /'gameData\.liveStats': \{[\s\S]*roomScore[\s\S]*bestTapScore[\s\S]*vocalLift/);
});

test('Public TV and Host expose vocal game recap surfaces', () => {
  assert.match(publicTvSource, /const vocalGameRecap = room\?\.gameData\?\.recap/);
  assert.match(publicTvSource, /Vocal Game Recap/);
  assert.match(publicTvSource, /vocalGameRecapTvActive/);
  assert.match(hostSource, /data-host-vocal-game-recap/);
  assert.match(hostSource, /Clear Recap/);
  assert.match(hostSource, /activeMode === 'karaoke' && activeGameRecap/);
  assert.match(hostSource, /\|\| room\?\.gameData\?\.recap\)\) &&/);
  assert.match(hostSource, /room\?\.gameData\?\.recap \? 'RECAP' : ''/);
});
