import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const teamPongSource = readFileSync('src/games/TeamPong/Game.jsx', 'utf8');
const gameContainerSource = readFileSync('src/components/GameContainer.jsx', 'utf8');
const gameRegistrySource = readFileSync('src/lib/gameRegistry.js', 'utf8');
const launcherSource = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const firestoreRulesSource = readFileSync('firestore.rules', 'utf8');

test('Team Pong exposes distinct Save, Slow-Mo, Shield, Redirect, and Spike actions instead of one generic tap', () => {
  assert.match(teamPongSource, /TEAM_PONG_ACTIONS = Object\.freeze/);
  assert.match(teamPongSource, /save:[\s\S]*count: 1[\s\S]*cooldownMs: 260/);
  assert.match(teamPongSource, /spike:[\s\S]*count: 3[\s\S]*cooldownMs: 1900/);
  assert.match(teamPongSource, /shield:[\s\S]*count: 2[\s\S]*cooldownMs: 4200/);
  assert.match(teamPongSource, /slowmo:[\s\S]*count: 1[\s\S]*cooldownMs: 5600/);
  assert.match(teamPongSource, /redirect:[\s\S]*count: 2[\s\S]*cooldownMs: 7200/);
  assert.match(teamPongSource, /sendPongAction\('save'\)/);
  assert.match(teamPongSource, /sendPongAction\('spike'\)/);
  assert.match(teamPongSource, /sendPongAction\('shield'\)/);
  assert.match(teamPongSource, /sendPongAction\('slowmo'\)/);
  assert.match(teamPongSource, /sendPongAction\('redirect'\)/);
  assert.doesNotMatch(teamPongSource, /sendPongHit|Tap Phone = \+1 Hit/);
});

test('Team Pong TV and rules copy frame the game as direct paddle agency', () => {
  assert.match(teamPongSource, /CrowdControlStartOverlay/);
  assert.match(teamPongSource, /modeTitle="Team Pong"/);
  assert.match(teamPongSource, /Audience phones are paddles now/);
  assert.match(teamPongSource, /Your phone is your paddle/);
  assert.match(teamPongSource, /First side to/);
  assert.match(teamPongSource, /SAVE NOW/);
  assert.match(teamPongSource, /SPIKE CHARGED/);
  assert.match(teamPongSource, /const rallyCommand = rallyDanger/);
  assert.match(teamPongSource, /Paddle Command/);
  assert.match(teamPongSource, /START RALLY/);
  assert.match(teamPongSource, /Tap Save to swing your paddle and return the ball/);
  assert.match(teamPongSource, /latestTeamLabel/);
  assert.match(teamPongSource, /leftGoalPct/);
  assert.match(teamPongSource, /rightGoalPct/);
  assert.match(gameContainerSource, /Your phone controls your team paddle/);
  assert.match(gameContainerSource, /First side to the rally goal wins/);
  assert.match(gameContainerSource, /Chant to widen the return window/);
});

test('Team Pong metadata is categorized with vocal games without marking non-voice prompt games as voice', () => {
  assert.match(gameRegistrySource, /id: 'team_pong',[\s\S]*category: 'voice',[\s\S]*badge: 'Chant',[\s\S]*needsVoice: true/);
  assert.match(gameRegistrySource, /id: 'trivia_pop',[\s\S]*needsVoice: false/);
  assert.match(gameRegistrySource, /id: 'wyr',[\s\S]*needsVoice: false/);
  assert.match(gameRegistrySource, /id: 'bingo',[\s\S]*needsVoice: false/);
});
test('Team Pong host launcher exposes rally options and ability framing', () => {
  assert.match(launcherSource, /teamPongTargetRally/);
  assert.match(launcherSource, /teamPongRallyTimeoutMs/);
  assert.match(launcherSource, /rallyTimeoutMs: normalizedRallyTimeoutMs/);
  assert.match(launcherSource, /targetRally: normalizedTargetRally/);
  assert.match(launcherSource, /Audience phones become team paddles/);
  assert.match(launcherSource, /Phones are the paddles/);
  assert.match(launcherSource, /Spike sends a bigger \+3 shot across the table/);
  assert.match(launcherSource, /Redirect counters an attack/);
  assert.match(launcherSource, /Host room-mic chant charge widens the return window/);
  assert.match(launcherSource, /team_pong: 'Paddle saves'/);
  assert.match(launcherSource, /team_pong: 'Team paddles'/);
});
test('Team Pong consumes host room-mic telemetry as forgiving chant charge', () => {
  assert.match(teamPongSource, /const voiceTelemetry = gameState\?\.voiceTelemetry/);
  assert.match(teamPongSource, /const crowdChargePct = voiceFresh/);
  assert.match(teamPongSource, /const voiceBoostedRallyTimeoutMs = Math\.round\(rallyTimeoutMs \* \(1 \+ \(\(crowdChargePct \/ 100\) \* 0\.45\)\)\)/);
  assert.match(teamPongSource, /const effectiveRallyTimeoutMs = Math\.round\(voiceBoostedRallyTimeoutMs \* \(slowMoActive \? 1\.42 : 1\)\)/);
  assert.match(teamPongSource, /Room chant charge/);
  assert.match(teamPongSource, /Crowd chant widens the return window/);
});

test('Team Pong adds team-specific charge meters and generated rally cues', () => {
  assert.match(teamPongSource, /voiceGameSoundSystem/);
  assert.match(teamPongSource, /const playTeamPongCue = \(cue = 'save', soundOptions = \{\}\)/);
  assert.match(teamPongSource, /playVoiceGameCue\('team_pong', cue/);
  assert.match(teamPongSource, /const leftChargePct = useMemo/);
  assert.match(teamPongSource, /const rightChargePct = useMemo/);
  assert.match(teamPongSource, /Your Team Charge/);
  assert.match(teamPongSource, /Left charge/);
  assert.match(teamPongSource, /Right charge/);
  assert.match(teamPongSource, /playTeamPongCue\('spike', soundOptions\)/);
  assert.match(teamPongSource, /playTeamPongCue\('shield', soundOptions\)/);
  assert.match(teamPongSource, /playTeamPongCue\('slowmo', soundOptions\)/);
  assert.match(teamPongSource, /playTeamPongCue\('redirect', soundOptions\)/);
  assert.match(teamPongSource, /voiceBoostedRallyTimeoutMs[\s\S]*slowMoActive[\s\S]*slowMoActive \? 1\.42 : 1/);
  assert.match(teamPongSource, /stats\.leftShields \* 9/);
  assert.match(teamPongSource, /stats\.leftSlowMos \* 7/);
  assert.match(teamPongSource, /stats\.leftRedirects \* 11/);
  assert.match(teamPongSource, /redirectWindowActive/);
});

test('Host room mic publishes voice telemetry through gameData for Team Pong and voice games', () => {
  assert.match(hostAppSource, /const getHostRoomVoiceTarget = \(room = \{\}\) => \{/);
  assert.match(hostAppSource, /\['flappy_bird', 'vocal_challenge', 'riding_scales', 'team_pong', 'musical_moments'\]\.includes\(activeMode\)/);
  assert.match(hostAppSource, /const hostVoiceTelemetryTarget = getHostRoomVoiceTarget\(room\)/);
  assert.match(hostAppSource, /hostVoiceTelemetryTarget === 'volley'[\s\S]*\{ lobbyVoiceTelemetry: liveTelemetry \}[\s\S]*\{ 'gameData\.voiceTelemetry': liveTelemetry \}/);
  assert.match(hostAppSource, /HostRoomVoiceMicCard/);
  assert.match(hostAppSource, /Room Voice Mic/);
  assert.match(hostAppSource, /const tvFeedLabel = hostVoiceTelemetryTarget/);
  assert.match(hostAppSource, /TV feed live/);
  assert.match(hostAppSource, /TV Feed/);
  assert.match(launcherSource, /hostVoiceMicControl\?\.visible/);
});

test('Host only marks room mic telemetry live after a real mic stream is ready', () => {
  assert.match(hostAppSource, /const hostVoiceCaptureActive = hostVolleyVoiceArmed/, 'Arming should immediately start host mic capture, even before a game target exists');
  assert.match(hostAppSource, /const hostVoiceStreamReady = hostVolleyVoiceStreamActive && !hostVolleyVoiceMicError/, 'Host should require a real browser stream before claiming mic readiness');
  assert.match(hostAppSource, /const hostVolleyVoiceMicActive = hostVolleyVoiceArmed && Boolean\(hostVoiceTelemetryTarget\) && hostVoiceStreamReady/, 'Live telemetry should require armed, targeted, and stream-ready states');
  assert.match(hostAppSource, /active: false,[\s\S]*streamActive: !!hostVolleyVoiceStreamActive,[\s\S]*micError: String\(hostVolleyVoiceMicError \|\| ''\)/, 'Inactive telemetry should explain startup state instead of pretending the mic is live');
  assert.match(hostAppSource, /active: true,[\s\S]*streamActive: true,[\s\S]*micStatus: String\(hostVolleyVoiceMicStatus \|\| 'live'\)/, 'Live telemetry should carry stream status for voice games');
  assert.match(hostAppSource, /onRetry: \(\) => \{[\s\S]*setHostVolleyVoiceArmed\(false\)[\s\S]*setTimeout\(\(\) => setHostVolleyVoiceArmed\(true\), 60\)/, 'Host mic control should be able to restart browser capture after a blocked or failed attempt');
});
test('Host publishes host mic telemetry at game-control latency', () => {
  assert.match(hostAppSource, /Number\(hostVolleyVoiceLastWriteRef\.current \|\| 0\)\) < 220/, 'Host mic telemetry should update quickly enough for public TV game control');
});
test('Team Pong paddle actions are permitted by the reactions Firestore rules contract', () => {
  assert.match(firestoreRulesSource, /function reactionAllowedKeys\(\)[\s\S]*'action'/);
  assert.match(firestoreRulesSource, /request\.resource\.data\.action is string[\s\S]*\['save', 'spike', 'shield', 'slowmo', 'redirect'\]/);
  assert.match(teamPongSource, /action,\s*\n\s*count: Number\(actionMeta\.count \|\| 1\)/);
});
