import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const visualizerSource = readFileSync('src/games/shared/CrowdMicInputVisualizer.jsx', 'utf8');
const pitchRunnerSource = readFileSync('src/games/FlappyBird/Game.jsx', 'utf8');
const vocalChallengeSource = readFileSync('src/games/VocalChallenge/Game.jsx', 'utf8');
const ridingScalesSource = readFileSync('src/games/RidingScales/Game.jsx', 'utf8');
const teamPongSource = readFileSync('src/games/TeamPong/Game.jsx', 'utf8');
const musicalMomentsSource = readFileSync('src/games/MusicalMoments/Game.jsx', 'utf8');
const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('shared crowd mic visualizer derives smooth TV animation from existing telemetry frames', () => {
  assert.match(visualizerSource, /buildCrowdMicVisualizerModel/);
  assert.match(visualizerSource, /const BAR_COUNT = 18/);
  assert.match(visualizerSource, /staleMs = 2200/);
  assert.match(visualizerSource, /volumeNormalized \?\? telemetry\?\.volume \?\? telemetry\?\.rawLift/);
  assert.match(visualizerSource, /transition: 'height 180ms ease, opacity 180ms ease'/);
  assert.match(visualizerSource, /TV feed live/);
  assert.match(visualizerSource, /Stale mic feed/);
  assert.match(visualizerSource, /Browser stream ready/);
  assert.match(visualizerSource, /CROWD LIVE/);
});

test('all vocal-control TV games show host mic input without adding a second telemetry path', () => {
  assert.match(pitchRunnerSource, /CrowdMicInputVisualizer[\s\S]*telemetry=\{hostVoiceTelemetry\}[\s\S]*Steering signal/);
  assert.match(vocalChallengeSource, /CrowdMicInputVisualizer[\s\S]*telemetry=\{hostVoiceTelemetry\}[\s\S]*Ribbon input/);
  assert.match(ridingScalesSource, /CrowdMicInputVisualizer[\s\S]*telemetry=\{hostVoiceTelemetry\}[\s\S]*Scale input/);
  assert.match(teamPongSource, /CrowdMicInputVisualizer[\s\S]*telemetry=\{voiceTelemetry \|\| \{\}\}[\s\S]*Crowd Chant/);
  assert.match(musicalMomentsSource, /CrowdMicInputVisualizer[\s\S]*telemetry=\{voiceTelemetry\}[\s\S]*Vocal lift/);
});

test('Volley Orb reuses lobby voice telemetry and host publish cadence stays throttled', () => {
  assert.match(publicTvSource, /CrowdMicInputVisualizer/);
  assert.match(publicTvSource, /telemetry=\{room\?\.lobbyVoiceTelemetry \|\| lobbyVoiceState \|\| \{\}\}/);
  assert.match(publicTvSource, /label="Vocal Rocket"/);
  assert.match(hostAppSource, /hostVoiceTelemetryTarget === 'volley'[\s\S]*\{ lobbyVoiceTelemetry: liveTelemetry \}[\s\S]*\{ 'gameData\.voiceTelemetry': liveTelemetry \}/);
  assert.match(hostAppSource, /Number\(hostVolleyVoiceLastWriteRef\.current \|\| 0\)\) < 220/);
  assert.match(hostAppSource, /hostVolleyVoiceInactiveSentRef\.current[\s\S]*< 900/);
});
