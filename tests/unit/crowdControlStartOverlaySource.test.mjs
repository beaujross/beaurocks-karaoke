import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const overlaySource = readFileSync('src/games/shared/CrowdControlStartOverlay.jsx', 'utf8');
const pitchRunnerSource = readFileSync('src/games/FlappyBird/Game.jsx', 'utf8');
const vocalChallengeSource = readFileSync('src/games/VocalChallenge/Game.jsx', 'utf8');
const ridingScalesSource = readFileSync('src/games/RidingScales/Game.jsx', 'utf8');
const teamPongSource = readFileSync('src/games/TeamPong/Game.jsx', 'utf8');
const musicalMomentsSource = readFileSync('src/games/MusicalMoments/Game.jsx', 'utf8');

test('shared crowd-control launch overlay has countdown, live-control, and mic-needed states', () => {
  assert.match(overlaySource, /buildCrowdControlLaunchState/);
  assert.match(overlaySource, /label: 'WARMUP'/);
  assert.match(overlaySource, /label: 'CROWD IS LIVE'/);
  assert.match(overlaySource, /label: 'MIC CHECK'/);
  assert.match(overlaySource, /if \(needsMic && !live\)/);
  assert.match(overlaySource, /Crowd is live now/);
  assert.match(overlaySource, /Crowd controls now/);
});

test('crowd voice games use the shared launch overlay with distinct control copy', () => {
  assert.match(pitchRunnerSource, /CrowdControlStartOverlay[\s\S]*modeTitle="Pitch Runner"[\s\S]*The crowd is steering the runner now/);
  assert.match(vocalChallengeSource, /CrowdControlStartOverlay[\s\S]*modeTitle="Vocal Challenge"[\s\S]*target ribbon now/);
  assert.match(ridingScalesSource, /CrowdControlStartOverlay[\s\S]*modeTitle="Riding Scales"[\s\S]*riding the scale now/);
  assert.match(teamPongSource, /CrowdControlStartOverlay[\s\S]*modeTitle="Team Pong"[\s\S]*Audience phones are paddles now/);
  assert.match(musicalMomentsSource, /CrowdControlStartOverlay[\s\S]*modeTitle="Musical Moments"[\s\S]*Phones and the room mic are live now/);
});

test('Vocal Challenge and Riding Scales use local TV clocks so countdowns do not depend on room writes', () => {
  assert.match(vocalChallengeSource, /const \[launchClockMs, setLaunchClockMs\] = useState\(\(\) => Date\.now\(\)\)/);
  assert.match(vocalChallengeSource, /setInterval\(\(\) => setLaunchClockMs\(Date\.now\(\)\), 180\)/);
  assert.match(vocalChallengeSource, /Math\.max\(Number\(localState\.lastUpdated \|\| localState\.turnEndsAt \|\| 0\), launchClockMs\)/);
  assert.match(ridingScalesSource, /const \[launchClockMs, setLaunchClockMs\] = useState\(\(\) => Date\.now\(\)\)/);
  assert.match(ridingScalesSource, /setInterval\(\(\) => setLaunchClockMs\(Date\.now\(\)\), 180\)/);
  assert.match(ridingScalesSource, /Math\.max\(Number\(localState\.lastUpdated \|\| localState\.nextAt \|\| 0\), launchClockMs\)/);
});
