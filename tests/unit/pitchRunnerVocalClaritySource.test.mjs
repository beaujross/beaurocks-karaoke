import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const pitchRunnerSource = readFileSync('src/games/FlappyBird/Game.jsx', 'utf8');
const launcherSource = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');
const gameContainerSource = readFileSync('src/components/GameContainer.jsx', 'utf8');
const registrySource = readFileSync('src/lib/gameRegistry.js', 'utf8');

test('Pitch Runner uses forgiving trend steering instead of hard pitch snapping', () => {
  assert.match(pitchRunnerSource, /TREND_DEADBAND_SEMITONES/);
  assert.match(pitchRunnerSource, /LOW_CONFIDENCE_DRIFT/);
  assert.match(pitchRunnerSource, /const voiceStrength = clamp/);
  assert.match(pitchRunnerSource, /const trendSmoothing = 0\.12 \+ \(voiceStrength \* 0\.18\)/);
  assert.match(pitchRunnerSource, /orbY = lerp\(orbY, safeTargetY, 0\.035\)/);
  assert.doesNotMatch(pitchRunnerSource, /orbY = lerp\(orbY, targetY, 0\.26\)/);
});

test('Pitch Runner TV shows higher/lower/hold cues and recovery language', () => {
  assert.match(pitchRunnerSource, /const trendInstruction = !currentLiveMidi/);
  assert.match(pitchRunnerSource, /Sing higher/);
  assert.match(pitchRunnerSource, /Sing lower/);
  assert.match(pitchRunnerSource, /Hold steady/);
  assert.match(pitchRunnerSource, /Voice Trend/);
  assert.match(pitchRunnerSource, /Runner Cue/);
  assert.match(pitchRunnerSource, /const runnerCommand = shieldActive/);
  assert.match(pitchRunnerSource, /Runner Command/);
  assert.match(pitchRunnerSource, /SHIELD RUN/);
  assert.match(pitchRunnerSource, /FIND YOUR LANE/);
  assert.match(pitchRunnerSource, /Steer The Safe Lane/);
  assert.match(pitchRunnerSource, /checkpointLabel/);
});

test('Pitch Runner launcher, rules, and metadata explain the safe-lane runner identity', () => {
  assert.match(launcherSource, /Safe-lane pitch run/);
  assert.match(launcherSource, /Higher \/ Lower/);
  assert.match(launcherSource, /Hold Steady/);
  assert.match(launcherSource, /Crowd runner/);
  assert.match(gameContainerSource, /calibrate a low and high note, then the room steers by trend/);
  assert.match(gameContainerSource, /Sing higher, lower, or hold steady/);
  assert.match(registrySource, /id: 'flappy_bird',[\s\S]*forgiving voice runner/);
  assert.match(registrySource, /id: 'flappy_bird',[\s\S]*badge: 'Runner'/);
});
test('Pitch Runner awards checkpoint shields and generated runner cue tones', () => {
  assert.match(pitchRunnerSource, /const playRunnerCue = \(cue = 'hold', soundOptions = \{\}\)/);
  assert.match(pitchRunnerSource, /voiceGameSoundSystem/);
  assert.match(pitchRunnerSource, /playVoiceGameCue\('pitch_runner', cue/);
  assert.match(pitchRunnerSource, /gatesPassed \+= 1/);
  assert.match(pitchRunnerSource, /const checkpointHit = gatesPassed % 5 === 0/);
  assert.match(pitchRunnerSource, /score \+= checkpointHit \? 95 : 35/);
  assert.match(pitchRunnerSource, /shieldUntil = Math\.max\(Number\(shieldUntil \|\| 0\), Date\.now\(\) \+ 1200\)/);
  assert.match(pitchRunnerSource, /Every 5 gates gives a checkpoint shield/);
  assert.match(pitchRunnerSource, /gates to shield/);
});
test('Pitch Runner supports host-owned room mic telemetry', () => {
  assert.match(launcherSource, /inputSource: 'ambient', voiceInput: 'host'/);
  assert.match(gameContainerSource, /voiceInputMode !== 'host'/);
  assert.match(pitchRunnerSource, /const usesHostRoomMic = isRoomControlled/);
  assert.match(pitchRunnerSource, /const hostVoiceTelemetry = useMemo\(\(\) => data\.voiceTelemetry \|\| \{\}/);
  assert.match(pitchRunnerSource, /const pitch = hostVoiceFresh \? Number\(hostVoiceTelemetry\.pitch \|\| 0\) : localPitch/);
});

test('Pitch Runner treats room-mic energy as a fallback control signal', () => {
  assert.match(pitchRunnerSource, /const energyMidi = usesHostRoomMic && !pitchMidi && volumeNormalized >= 0\.055/);
  assert.match(pitchRunnerSource, /label: pitchMidi \? labelFromMidi\(pitchMidi\) : \(energyMidi \? 'ENERGY' : '--'\)/);
  assert.match(pitchRunnerSource, /stableNote: pitchMidi \? stableNote : \(energyMidi \? 'ENERGY' : stableNote\)/);
});
test('Pitch Runner sync does not overwrite host mic telemetry while the host mic is driving movement', () => {
  assert.match(pitchRunnerSource, /const patch = \{[\s\S]*'gameData\.orbY':[\s\S]*'gameData\.voice':[\s\S]*'gameData\.timestamp'/, 'Pitch Runner should sync gameplay with nested gameData field updates');
  assert.doesNotMatch(pitchRunnerSource, /gameData: \{[\s\S]*voiceTelemetry: hostVoiceTelemetry[\s\S]*\}/, 'Pitch Runner TV sync should not clobber fresh host mic telemetry with stale props');
});

test('Pitch Runner host-room-mic launches do not require public TV setup clicks', () => {
  assert.match(pitchRunnerSource, /const hostRoomMicAutoStartRef = useRef\(false\)/);
  assert.match(pitchRunnerSource, /if \(!isController \|\| !usesHostRoomMic \|\| hostRoomMicAutoStartRef\.current\) return;/);
  assert.match(pitchRunnerSource, /const launchAtMs = Math\.max\(0, Number\(stateRef\.current\?\.voiceLaunchAtMs \|\| data\.voiceLaunchAtMs \|\| 0\)\)/);
  assert.match(pitchRunnerSource, /if \(launchAtMs && Date\.now\(\) < launchAtMs\) return;/);
  assert.match(pitchRunnerSource, /if \(!hostVoiceFresh\) return;/);
  assert.match(pitchRunnerSource, /status: 'playing'[\s\S]*shieldUntil: Date\.now\(\) \+ 1400/);
  assert.match(pitchRunnerSource, /CrowdControlStartOverlay/);
  assert.match(pitchRunnerSource, /modeTitle="Pitch Runner"/);
  assert.match(pitchRunnerSource, /The crowd is steering the runner now/);
  assert.match(pitchRunnerSource, /voiceLaunchAtMs: Math\.max\(0, Number\(data\.voiceLaunchAtMs \|\| 0\)\)/);
  assert.match(pitchRunnerSource, /isController && !usesHostRoomMic && visibleState\.status === 'waiting'/);
  assert.match(pitchRunnerSource, /isController && !usesHostRoomMic && visibleState\.status === 'ready'/);
  assert.match(pitchRunnerSource, /isController && !usesHostRoomMic && visibleState\.status === 'playing'/);
});


test('Pitch Runner room sync always writes defined identity fields', () => {
  assert.match(pitchRunnerSource, /playerId: String\(data\.playerId \|\| 'AMBIENT'\)/);
  assert.match(pitchRunnerSource, /playerName: String\(data\.playerName \|\| 'THE CROWD'\)/);
  assert.match(pitchRunnerSource, /playerAvatar: String\(data\.playerAvatar \|\| 'MIC'\)/);
  assert.match(pitchRunnerSource, /'gameData\.playerId': String\(nextState\.playerId \|\| data\.playerId \|\| 'AMBIENT'\)/);
  assert.match(pitchRunnerSource, /'gameData\.voiceInput': usesHostRoomMic \? 'host' : String\(nextState\.voiceInput \|\| data\.voiceInput \|\| ''\)/);
});
