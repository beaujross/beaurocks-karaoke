import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const vocalChallengeSource = readFileSync('src/games/VocalChallenge/Game.jsx', 'utf8');
const launcherSource = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');
const gameContainerSource = readFileSync('src/components/GameContainer.jsx', 'utf8');
const registrySource = readFileSync('src/lib/gameRegistry.js', 'utf8');

test('Vocal Challenge uses shared sustained target tones instead of short beeps', () => {
  assert.match(vocalChallengeSource, /voiceGameSoundSystem/);
  assert.match(vocalChallengeSource, /playVoiceGameGuideTone/);
  assert.match(vocalChallengeSource, /mode: 'vocal_challenge'/);
  assert.match(vocalChallengeSource, /cue: 'guide'/);
  assert.match(vocalChallengeSource, /const toneDurationSec = clamp\(\(intervalMs \/ 1000\) \* 0\.54/);
  assert.doesNotMatch(vocalChallengeSource, /osc\.stop\(ctx\.currentTime \+ 0\.18\)/);
});

test('Vocal Challenge TV is framed as a target-ribbon battle', () => {
  assert.match(vocalChallengeSource, /const battleRoleLabel = crowdMode/);
  assert.match(vocalChallengeSource, /Crowd vs Target Ribbon/);
  assert.match(vocalChallengeSource, /Spotlight Battle/);
  assert.match(vocalChallengeSource, /const resultLabel = lastAward\?\.quality === 'perfect'/);
  assert.match(vocalChallengeSource, /Locked/);
  assert.match(vocalChallengeSource, /ribbonMatched/);
  assert.match(vocalChallengeSource, /Target Ribbon/);
  assert.match(vocalChallengeSource, /const battleCommand = preGameActive/);
  assert.match(vocalChallengeSource, /: showNoteShiftPulse/);
  assert.match(vocalChallengeSource, /Battle Command/);
  assert.match(vocalChallengeSource, /SLIDE NOW/);
  assert.match(vocalChallengeSource, /LOCK IT/);
});

test('Host launcher and public rules describe Vocal Challenge as a forgiving battle mode', () => {
  assert.match(launcherSource, /Target ribbon challenge/);
  assert.match(launcherSource, /Start crowd battle/);
  assert.match(launcherSource, /Start spotlight battle/);
  assert.match(launcherSource, /Locked \/ Close/);
  assert.match(gameContainerSource, /Follow the target ribbon and hold your voice inside the lane/);
  assert.match(gameContainerSource, /Locked notes score big, close notes still recover the phrase/);
  assert.match(registrySource, /id: 'vocal_challenge',[\s\S]*SingStar-style target ribbon battle/);
  assert.match(registrySource, /id: 'vocal_challenge',[\s\S]*badge: 'Battle'/);
});
test('Vocal Challenge keeps phrase-result history visible during the battle', () => {
  assert.match(vocalChallengeSource, /resultHistory: \[\]/);
  assert.match(vocalChallengeSource, /const nextAward = \{/);
  assert.match(vocalChallengeSource, /state\.resultHistory = \[/);
  assert.match(vocalChallengeSource, /\.slice\(0, 6\)/);
  assert.match(vocalChallengeSource, /Phrase Results/);
  assert.match(vocalChallengeSource, /No locks yet/);
  assert.match(vocalChallengeSource, /notes lock into the ribbon/);
});
test('Vocal Challenge supports host-owned room mic telemetry', () => {
  assert.match(launcherSource, /voiceInput: 'host',[\s\S]*mode: 'crowd'/);
  assert.match(gameContainerSource, /voiceInputMode !== 'host'/);
  assert.match(vocalChallengeSource, /const usesHostRoomMic = isRoomControlled/);
  assert.match(vocalChallengeSource, /const hostVoiceTelemetry = useMemo\(\(\) => data\.voiceTelemetry \|\| \{\}/);
  assert.match(vocalChallengeSource, /const note = hostVoiceFresh \? String\(hostVoiceTelemetry\.note \|\| '-'\) : localNote/);
});

test('Vocal Challenge has a room-mic energy lane fallback', () => {
  assert.match(vocalChallengeSource, /const energyPulse = crowdMode && usesHostRoomMic && volumeNormalized >= 0\.075/);
  assert.match(vocalChallengeSource, /const displayNote = stableNote !== '-' \? stableNote : \(energyPulse \? 'POWER' : note\)/);
  assert.match(vocalChallengeSource, /const energyLaneMatch = crowdMode && usesHostRoomMic && volumeNormalized >= \(assistActive \? 0\.065 : 0\.095\)/);
  assert.match(vocalChallengeSource, /\|\| energyLaneMatch/);
});

test('Vocal Challenge gates scoring until launch and host mic telemetry are ready', () => {
  assert.match(vocalChallengeSource, /const requestedLaunchAt = Math\.max\(0, Number\(data\.voiceLaunchAtMs \|\| 0\)\)/);
  assert.match(vocalChallengeSource, /const waitingForLaunch = state\.phase === 'playing' && launchAtMs > now/);
  assert.ok(!/waitingForLaunch \|\| waitingForHostMic/.test(vocalChallengeSource));
  assert.match(vocalChallengeSource, /preGameActive/);
});

test('Vocal Challenge preserves host-owned mic telemetry while syncing gameplay', () => {
  assert.match(vocalChallengeSource, /const buildGameDataPatch = \(payload = \{\}\) => Object\.entries\(payload\)\.reduce/);
  assert.match(vocalChallengeSource, /if \(key === 'voiceTelemetry'\) return patch;/);
  assert.match(vocalChallengeSource, /patch\[`gameData\.\$\{key\}`\] = value;/);
  assert.match(vocalChallengeSource, /buildGameDataPatch\(payload\)/);
  assert.doesNotMatch(vocalChallengeSource, /\{ gameData: payload \}/);
  assert.doesNotMatch(vocalChallengeSource, /state\.voiceTelemetry = hostVoiceTelemetry/);
});
