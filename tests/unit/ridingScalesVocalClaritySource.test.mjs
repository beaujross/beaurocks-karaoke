import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const ridingScalesSource = readFileSync('src/games/RidingScales/Game.jsx', 'utf8');
const gameContainerSource = readFileSync('src/components/GameContainer.jsx', 'utf8');

test('Riding Scales uses shared sustained guide tones with an echo tail', () => {
  assert.match(ridingScalesSource, /voiceGameSoundSystem/);
  assert.match(ridingScalesSource, /playVoiceGameGuideTone/);
  assert.match(ridingScalesSource, /mode: 'riding_scales'/);
  assert.match(ridingScalesSource, /cue: 'guide'/);
  assert.match(ridingScalesSource, /const toneDurationSec = clamp/);
  assert.doesNotMatch(ridingScalesSource, /osc\.stop\(ctx\.currentTime \+ 0\.2\)/);
});

test('Riding Scales explains breath windows and forgiving note matching', () => {
  assert.match(ridingScalesSource, /const breathWindowActive = localState\.phase === 'input'/);
  assert.match(ridingScalesSource, /Breath window\. Prepare, then lock the note/);
  assert.match(ridingScalesSource, /const scaleCommand = preGameActive/);
  assert.match(ridingScalesSource, /: localState\.phase === 'playback'/);
  assert.match(ridingScalesSource, /Scale Command/);
  assert.match(ridingScalesSource, /LISTEN/);
  assert.match(ridingScalesSource, /BREATHE/);
  assert.match(ridingScalesSource, /LOCK NOTE/);
  assert.match(ridingScalesSource, /Breath window\. Prepare, then lock the note/);
  assert.match(gameContainerSource, /First listen to the sustained guide notes/);
  assert.match(gameContainerSource, /Use the breath window between notes; close matches still count/);
});
test('Riding Scales shows phrase locks and checkpoint progress', () => {
  assert.match(ridingScalesSource, /phraseLocks: \[\]/);
  assert.match(ridingScalesSource, /checkpointCount: 0/);
  assert.match(ridingScalesSource, /const lockEntry = \{/);
  assert.match(ridingScalesSource, /state\.checkpointHistory = \[/);
  assert.match(ridingScalesSource, /Scale Locks/);
  assert.match(ridingScalesSource, /Lock every note in the phrase to bank a checkpoint/);
  assert.match(ridingScalesSource, /lockedNoteIndexes\.has\(idx\)/);
});
test('Riding Scales supports host-owned room mic telemetry', () => {
  assert.match(ridingScalesSource, /const usesHostRoomMic = isRoomControlled/);
  assert.match(ridingScalesSource, /const hostVoiceTelemetry = useMemo\(\(\) => gameData\.voiceTelemetry \|\| \{\}/);
  assert.match(ridingScalesSource, /const stableNote = hostVoiceFresh \? String\(hostVoiceTelemetry\.stableNote \|\| hostVoiceTelemetry\.note \|\| '-'\) : localStableNote/);
  assert.match(gameContainerSource, /voiceInputMode !== 'host'/);
});

test('Riding Scales has a room-mic energy step fallback', () => {
  assert.match(ridingScalesSource, /volumeNormalized: localVolumeNormalized/);
  assert.match(ridingScalesSource, /const volumeNormalized = hostVoiceFresh \? Number\(hostVoiceTelemetry\.volumeNormalized \|\| 0\) : localVolumeNormalized/);
  assert.match(ridingScalesSource, /const energyPulse = usesHostRoomMic && gameData\.mode === 'crowd' && volumeNormalized >= 0\.075/);
  assert.match(ridingScalesSource, /const displayNote = stableNote !== '-' \? stableNote : \(energyPulse \? 'POWER' : note\)/);
  assert.match(ridingScalesSource, /const energyStepMatch = usesHostRoomMic && gameData\.mode === 'crowd' && volumeNormalized >= \(assistActive \? 0\.065 : 0\.095\)/);
});

test('Riding Scales gates sequence timing until launch and host mic telemetry are ready', () => {
  assert.match(ridingScalesSource, /const requestedLaunchAt = Math\.max\(0, Number\(gameData\.voiceLaunchAtMs \|\| 0\)\)/);
  assert.match(ridingScalesSource, /const waitingForLaunch = \(state\.phase === 'playback' \|\| state\.phase === 'input'\) && launchAtMs > current/);
  assert.ok(!/waitingForLaunch \|\| waitingForHostMic/.test(ridingScalesSource));
  assert.match(ridingScalesSource, /preGameActive/);
});

test('Riding Scales preserves host-owned mic telemetry while syncing gameplay', () => {
  assert.match(ridingScalesSource, /const buildGameDataPatch = \(payload = \{\}\) => Object\.entries\(payload\)\.reduce/);
  assert.match(ridingScalesSource, /if \(key === 'voiceTelemetry'\) return patch;/);
  assert.match(ridingScalesSource, /patch\[`gameData\.\$\{key\}`\] = value;/);
  assert.match(ridingScalesSource, /buildGameDataPatch\(payload\)/);
  assert.doesNotMatch(ridingScalesSource, /\{ gameData: payload \}/);
  assert.doesNotMatch(ridingScalesSource, /state\.voiceTelemetry = hostVoiceTelemetry/);
});
