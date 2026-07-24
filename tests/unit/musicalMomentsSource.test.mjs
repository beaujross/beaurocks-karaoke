import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const gameSource = readFileSync('src/games/MusicalMoments/Game.jsx', 'utf8');
const registrySource = readFileSync('src/lib/gameRegistry.js', 'utf8');
const launcherSource = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');
const gameContainerSource = readFileSync('src/components/GameContainer.jsx', 'utf8');
const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const launchSupportSource = readFileSync('src/lib/gameLaunchSupport.js', 'utf8');
const vocalProgressSource = readFileSync('docs/game-design/VOCAL_GAMES_PROGRESS.md', 'utf8');

test('Musical Moments is registered as a voice game cartridge and progress-ledger mode', () => {
  assert.match(registrySource, /const MusicalMomentsGame = lazy\(\(\) => import\('\.\.\/games\/MusicalMoments\/Game'\)\);/);
  assert.match(registrySource, /'musical_moments': MusicalMomentsGame/);
  assert.match(registrySource, /id: 'musical_moments'[\s\S]*name: 'Musical Moments'[\s\S]*needsVoice: true/);
  assert.match(gameContainerSource, /musical_moments: \{[\s\S]*title: 'Musical Moments'[\s\S]*Audience phones tap the hit/);
  assert.match(vocalProgressSource, /\| Musical Moments \| Media-loop rhythm challenge[\s\S]*Shared sound system \+ AudioScape geometry pass[\s\S]*real-room calibration/);
  assert.match(vocalProgressSource, /### Musical Moments[\s\S]*Audience phones get a large `Tap The Hit` action/);
});

test('Musical Moments uses host room mic telemetry, reveal scoring, and audience tap timing primitives', () => {
  assert.match(gameSource, /const buildMomentCue = \(gameState = \{\}\) => \(\{/);
  assert.match(gameSource, /parseYoutubeId\(gameState\.youtubeId \|\| gameState\.mediaUrl\)/);
  assert.match(gameSource, /const scoreTap = \(tapAtMs, startedAtMs, cue\) => \{/);
  assert.match(gameSource, /signedErrorMs/);
  assert.match(gameSource, /tapLatencyOffsetMs/);
  assert.match(gameSource, /const adjustedTapAtMs = tapAtMs - Number\(cue\.tapLatencyOffsetMs \|\| 0\)/);
  assert.match(gameSource, /const buildTimingStats = \(scoredTaps = \[\], cue\) => \{/);
  assert.match(gameSource, /const buildMomentReveal = \(\{ timingStats, vocalLift \}\) => \{/);
  assert.match(gameSource, /const voiceTelemetry = data\.voiceTelemetry \|\| \{\}/);
  assert.match(gameSource, /const vocalLift = vocalInWindow \? Math\.round/);
  assert.match(gameSource, /'gameData\.tapEvents': arrayUnion/);
  assert.match(gameSource, /Tap When It Hits/);
  assert.match(gameSource, /ROOM NAILED IT/);
  assert.match(gameSource, /Avg Offset/);
  assert.match(gameSource, /Early[\s\S]*On Time[\s\S]*Late/);
});

test('Host launcher can configure and launch Musical Moments with host mic armed', () => {
  assert.match(launcherSource, /const MUSICAL_MOMENT_PRESETS = Object\.freeze/);
  assert.match(launcherSource, /Whitney Silence Drop[\s\S]*3JWTaaS7LdU[\s\S]*startSec: 171[\s\S]*mysteryStartSec: 14[\s\S]*targetBeatSec: 18/);
  assert.match(launcherSource, /Silence Drop[\s\S]*High Note Lift[\s\S]*Chant Punch/);
  assert.match(launcherSource, /const \[musicalMomentTitle, setMusicalMomentTitle\] = useState\('Big Re-Entry Challenge'\);/);
  assert.match(launcherSource, /if \(gameId === 'musical_moments'\) return startMusicalMoments\(\);/);
  assert.match(launcherSource, /const startMusicalMoments = async \(\) => \{[\s\S]*hostVoiceMicControl\?\.onArm\?\.\(\);/);
  assert.match(launcherSource, /activeMode: 'musical_moments'[\s\S]*mysteryStartSec[\s\S]*targetAbsoluteSec[\s\S]*playMode[\s\S]*turnParticipantUids[\s\S]*voiceInput: 'host'[\s\S]*tapEvents: \[\]/);
  assert.match(launcherSource, /if \(selectedGame === 'musical_moments'\)/);
  assert.match(launcherSource, /applyMusicalMomentPreset/);
  assert.match(launcherSource, /savedMusicalMomentPresets/);
  assert.match(launcherSource, /saveMusicalMomentPreset/);
  assert.match(launcherSource, /musicalMomentPresets: nextPresets/);
  assert.match(launcherSource, /Crowd Play[\s\S]*Turn Battle/);
  assert.match(launcherSource, /Phone latency ms/);
  assert.match(launcherSource, /Latency Calibration/);
  assert.match(launcherSource, /Start Musical Moment/);
});

test('Host mic publishing and run-of-show launches include Musical Moments', () => {
  assert.match(hostSource, /musical_moments: 'Musical Moments'/);
  assert.match(hostSource, /\['flappy_bird', 'vocal_challenge', 'riding_scales', 'team_pong', 'musical_moments'\]\.includes\(activeMode\)/);
  assert.match(launchSupportSource, /if \(modeKey === 'musical_moments'\) \{/);
  assert.match(launchSupportSource, /activeMode: 'musical_moments'[\s\S]*voiceInput: 'host'[\s\S]*tapEvents: \[\]/);
});

test('Musical Moments adds shared reveal stingers, audio-scape geometry, and TV result coaching', () => {
  assert.match(gameSource, /voiceGameSoundSystem/);
  assert.match(gameSource, /playVoiceGameCue, buildDynamicAudioScapePlan/);
  assert.match(gameSource, /const playMusicalMomentCue/);
  assert.match(gameSource, /playVoiceGameCue/);
  assert.match(gameSource, /musical_moments/);
  assert.match(gameSource, /const buildMomentAudioScapeSamples/);
  assert.match(gameSource, /const audioScapePlan = useMemo/);
  assert.match(gameSource, /buildDynamicAudioScapePlan/);
  assert.match(gameSource, /Replay Geometry/);
  assert.match(gameSource, /Blind Listen/);
  assert.match(gameSource, /audioScapePlan\.segments\.map/);
  assert.match(gameSource, /Moment Grade/);
  assert.match(gameSource, /Loop Reveal/);
  assert.match(gameSource, /allTimingStats\.averageOffsetMs/);
  assert.match(gameSource, /latencyOffsetLabel/);
});
test('Musical Moments rewards successful beat hits and spotlights the player queue', () => {
  assert.match(gameSource, /increment, serverTimestamp/);
  assert.match(gameSource, /const MUSICAL_MOMENTS_NAILED_REWARD_POINTS = 120/);
  assert.match(gameSource, /const MUSICAL_MOMENTS_CLOSE_REWARD_POINTS = 40/);
  assert.match(gameSource, /const getMomentReward = \(scored\) => \{/);
  assert.match(gameSource, /const buildMomentSpotlight = \(scoredTaps = \[\], currentLoopIndex = 0\) => \{/);
  assert.match(gameSource, /rewardedTapKeysRef = useRef\(new Set\(\)\)/);
  assert.match(gameSource, /const rewardKey = `\$\{String\(data\.sessionId \|\| startedAtMs\)\}_\$\{activeUid\}_\$\{scored\?\.loopIndex \?\? currentLoopIndex\}_\$\{reward\.tier\}`/);
  assert.match(gameSource, /score: scored\?\.score \|\| 0/);
  assert.match(gameSource, /rating: scored\?\.rating \|\| 'Late'/);
  assert.match(gameSource, /rewardPoints: reward\.points/);
  assert.match(gameSource, /points: increment\(reward\.points\)/);
  assert.match(gameSource, /lastActiveAt: serverTimestamp\(\)/);
  assert.match(gameSource, /Beat Hit Celebration/);
  assert.match(gameSource, /Who's Up Next/);
  assert.match(gameSource, /\+\{lastTap\.rewardPoints\} PTS/);
});
test('Musical Moments keeps timing listen-first while preserving countdown cue and loop history', () => {
  assert.match(gameSource, /const buildBeatPhase = \(\{ phaseMs = 0, targetMs = 0, mysteryStartMs/);
  assert.match(gameSource, /callout: 'LISTEN'/);
  assert.match(gameSource, /callout: 'SILENCE IS LIVE'/);
  assert.match(gameSource, /No countdown\. Tap from the music\./);
  assert.match(gameSource, /callout: 'LISTEN CLOSE'/);
  assert.match(gameSource, /const buildMomentLoopHistory = \(scoredTaps = \[\], currentLoopIndex = 0, cue = \{\}\) => \{/);
  assert.match(gameSource, /const beatPhase = buildBeatPhase/);
  assert.match(gameSource, /const loopHistory = buildMomentLoopHistory/);
  assert.match(gameSource, /const currentLoopBest = currentLoopTaps\[0\] \|\| null/);
  assert.match(gameSource, /const countdownCueRef = useRef\(''\)/);
  assert.match(gameSource, /const countdownKey = `\$\{String\(data\.sessionId \|\| startedAtMs\)\}_\$\{currentLoopIndex\}_countdown`/);
  assert.match(gameSource, /playMusicalMomentCue\('countdown', \{ intensity: 0\.92, soundOptions \}\)/);
  assert.match(gameSource, /Listen-First Challenge/);
  assert.match(gameSource, /The screen will not show the hit\./);
  assert.match(gameSource, /Timing Hidden/);
  assert.doesNotMatch(gameSource, /Beat Clock/);
  assert.doesNotMatch(gameSource, /progressPct/);
  assert.doesNotMatch(gameSource, /targetPct/);
  assert.match(gameSource, /userCanTapThisTurn/);
  assert.match(gameSource, /Closest To The Crash/);
  assert.match(gameSource, /buildMomentLeaderboard/);
  assert.match(gameSource, /blindListenCallout/);
  assert.match(gameSource, /loopHistory\.map/);
});


