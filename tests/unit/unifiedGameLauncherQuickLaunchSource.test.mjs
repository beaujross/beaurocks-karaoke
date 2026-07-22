import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const source = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');

test('UnifiedGameLauncher quick launch keeps voice games in TV-controlled crowd mode', () => {
  assert.match(
    source,
    /if \(gameId === 'flappy_bird'\) \{\s*return startFlappyAmbient\(\{ quick: true \}\);\s*\}/,
    'Quick Pitch Runner should always launch the TV crowd-mic path instead of silently switching to solo phone control',
  );
  assert.match(
    source,
    /if \(gameId === 'vocal_challenge'\) \{\s*return startVocalAmbient\(\{ quick: true \}\);\s*\}/,
    'Quick Vocal Challenge should always launch the TV crowd-mic path instead of depending on a phone-side controller',
  );
  assert.match(
    source,
    /const startFlappyAmbient = async[\s\S]*gameRulesId: now/,
    'Pitch Runner launches should push a fresh rules token so the room gets control instructions before gameplay',
  );
  assert.match(
    source,
    /const startVocalAmbient = async[\s\S]*gameRulesId: now/,
    'Vocal Challenge launches should push a fresh rules token so the room gets control instructions before gameplay',
  );
  assert.match(
    source,
    /const startRidingScalesCrowd = async[\s\S]*gameRulesId: now/,
    'Riding Scales launches should push a fresh rules token so the room gets control instructions before gameplay',
  );
});

test('UnifiedGameLauncher game cards keep participant mode inside the metadata pill row', () => {
  assert.match(
    source,
    /participantConfig \? \(\s*<>\s*<button[\s\S]*participantConfig\.setMode\?\.\('all'\)[\s\S]*>\s*<i className="fa-solid fa-users text-\[10px\]"><\/i>\s*All/s,
    'Game cards should expose the all-player mode as an inline metadata pill instead of a separate stacked selector row',
  );
  assert.match(
    source,
    /participantConfig\.setMode\?\.\('selected'\)[\s\S]*playerCount \? `\$\{playerCount\} selected` : 'Pick players'/,
    'Game cards should expose selected-player mode and count directly in the pill row',
  );
  assert.match(
    source,
    /participantConfig\?\.mode === 'selected' && showPicker/,
    'The roster picker should only expand when selected-player mode is active, saving idle vertical space on the launcher cards',
  );
});

test('UnifiedGameLauncher exposes Trivia and WYR banks with next-question controls', () => {
  assert.match(
    source,
    /const PromptBankBrowser = \(\{ type, items = \[\]/,
    'Trivia and Would You Rather should use a visible bank browser instead of hiding the bank behind a compact select',
  );
  assert.match(source, /trivia-question-bank/, 'Trivia config should expose a browseable question bank surface');
  assert.match(source, /wyr-question-bank/, 'Would You Rather config should expose a browseable prompt bank surface');
  assert.match(source, /onStartNextTrivia=\{withGameLaunchPreflight\('trivia_pop', launchNextTrivia\)\}/, 'Trivia config should have a next-in-bank launch action');
  assert.match(source, /onStartNextWyr=\{withGameLaunchPreflight\('wyr', launchNextWyr\)\}/, 'Would You Rather config should have a next-in-bank launch action');
  assert.match(source, /gameRoundHistory: buildPromptRoundHistory\(room\)/, 'Launching the next prompt should preserve prior room questions for recap');
  assert.match(
    source,
    /room\?\.activeMode === 'trivia_pop'[\s\S]*onClick=\{launchNextTrivia\}[\s\S]*Next Question/,
    'A live Trivia round should expose a Next Question control in the active game strip',
  );
  assert.match(
    source,
    /room\?\.activeMode === 'wyr'[\s\S]*onClick=\{launchNextWyr\}[\s\S]*Next Question/,
    'A live Would You Rather round should expose a Next Question control in the active game strip',
  );
  assert.match(
    source,
    /triviaQuestion: \{[\s\S]*bankId: item\.id \|\| null,[\s\S]*bankIndex,[\s\S]*bankSize: triviaBank\.length/,
    'Launched Trivia rounds should retain bank metadata so next-question progression can follow the bank order',
  );
  assert.match(
    source,
    /wyrData: \{[\s\S]*bankId: item\.id \|\| null,[\s\S]*bankIndex,[\s\S]*bankSize: wyrBank\.length/,
    'Launched Would You Rather rounds should retain bank metadata so next-question progression can follow the bank order',
  );
  assert.match(
    source,
    /const nextQuestionAction = game\.id === 'trivia_pop' && \['trivia_pop', 'trivia_reveal'\]\.includes\(room\?\.activeMode\)/,
    'The active Trivia card should expose next-question progression during both voting and reveal states',
  );
  assert.match(
    source,
    /game\.id === 'wyr' && \['wyr', 'wyr_reveal'\]\.includes\(room\?\.activeMode\)/,
    'The active Would You Rather card should expose next-prompt progression during both voting and reveal states',
  );
  assert.match(
    source,
    /data-feature-id=\{`active-\$\{game\.id\}-next-question`\}/,
    'The visible active game card should include a stable next-question action for host workflow tests',
  );
});
test('UnifiedGameLauncher supports event trivia imports and Run of Show sequencing', () => {
  assert.match(source, /const parseTriviaImportText = \(rawText = ''\) => \{/, 'Host Games should parse pasted event trivia into the room bank');
  assert.match(source, /const \[triviaImportText, setTriviaImportText\] = useState\(''\);/, 'Trivia import text should be owned by UnifiedGameLauncher state before it is passed into the config modal');
  assert.match(source, /data-feature-id="trivia-bank-batch-import"/, 'Trivia config should expose a batch import textarea for event questions');
  assert.match(source, /onAddQuickRunOfShowMoment\('trivia_break'/, 'Trivia bank entries should be queueable as Run of Show trivia breaks');
  assert.match(source, /const UnifiedGameLauncher = \(\{[\s\S]*onAddQuickRunOfShowMoment[\s\S]*\}\) => \{/, 'UnifiedGameLauncher should receive the Run of Show queue callback as a prop');
  assert.match(source, /launchConfigOverrides: buildTriviaRunOfShowLaunchConfig\(entry, triviaRoundSec, triviaAutoReveal\)/, 'Queued Run of Show trivia should preserve the selected bank question and round settings');
  assert.match(source, /Queue visible set/, 'Hosts should be able to queue a filtered event set as a sequence');
});
test('GameCardItem receives next-question action through props', () => {
  assert.match(
    source,
    /const GameCardItem = \(\{[^}]*nextQuestionAction[^}]*\}\) => \{/,
    'GameCardItem must destructure nextQuestionAction from props instead of reading an undefined outer variable.',
  );
  assert.doesNotMatch(
    source,
    /const GameCardItem = \(\{(?![^}]*nextQuestionAction)[^}]*\}\) => \{[\s\S]*\{nextQuestionAction \? \(/,
    'The active game card should not render nextQuestionAction without receiving it as a prop.',
  );
});
test('UnifiedGameLauncher keeps game controls reachable on shorter host screens', () => {
  assert.match(
    source,
    /const GameConfigShell = \(\{ title, subtitle, accentClass, onClose, children \}\) => \{[\s\S]*overflow-y-auto overscroll-contain p-3 sm:p-6[\s\S]*max-h-\[calc\(100dvh-1\.5rem\)\][\s\S]*custom-scrollbar/,
    'Shared game config dialogs should scroll inside the viewport instead of letting lower controls fall off-screen.',
  );
  assert.match(
    source,
    /data-game-card=\{game\.id\}[\s\S]*overflow-visible bg-gradient-to-b/,
    'Game cards should not clip expanded per-game participant controls.',
  );
  assert.match(
    source,
    /selectedGame === 'flappy_bird'[\s\S]*max-h-\[calc\(100dvh-1\.5rem\)\][\s\S]*selectedGame === 'vocal_challenge'[\s\S]*max-h-\[calc\(100dvh-1\.5rem\)\][\s\S]*selectedGame === 'riding_scales'[\s\S]*max-h-\[calc\(100dvh-1\.5rem\)\]/,
    'The custom vocal game config dialogs should get the same viewport-safe scrolling as shared config dialogs.',
  );
});


test('UnifiedGameLauncher auto-arms the host room mic for host-mic voice games', () => {
  assert.match(source, /const startFlappyAmbient = async[\s\S]*hostVoiceMicControl\?\.onArm\?\.\(\)/, 'Pitch Runner crowd launch should start host mic capture immediately');
  assert.match(source, /const startVocalAmbient = async[\s\S]*hostVoiceMicControl\?\.onArm\?\.\(\)/, 'Vocal Challenge crowd launch should start host mic capture immediately');
  assert.match(source, /const startRidingScalesCrowd = async[\s\S]*hostVoiceMicControl\?\.onArm\?\.\(\)/, 'Riding Scales crowd launch should start host mic capture immediately');
  assert.match(source, /const startTeamPong = async[\s\S]*hostVoiceMicControl\?\.onArm\?\.\(\)/, 'Team Pong launch should start host mic capture immediately');
  assert.match(source, /hostVoiceMicControl\.statusText/, 'Launcher mic card should show the host-reported mic startup state');
  assert.match(source, /hostVoiceMicControl\.tvFeedLabel/, 'Launcher mic card should show whether the TV feed is live or waiting');
  assert.match(source, /selectedDeviceId/, 'Launcher mic setup should expose selected mic device state');
  assert.match(source, /onRefreshDevices/, 'Launcher mic setup should let the host refresh browser input devices');
  assert.match(source, /Test Tone/, 'Launcher mic setup should include a quick audible output check');
  assert.match(source, /hostVoiceMicControl\.error \? 'Retry Room Mic'/, 'Launcher mic card should expose retry when browser mic startup fails');
});
test('UnifiedGameLauncher schedules host-mic voice games with a synchronized launch warmup', () => {
  assert.match(source, /const VOICE_GAME_LAUNCH_WARMUP_MS = 6200/);
  assert.match(source, /const buildVoiceGameLaunchTimingConfig = \(now = Date\.now\(\), warmupMs = VOICE_GAME_LAUNCH_WARMUP_MS\) => \(\{[\s\S]*voiceLaunchAtMs: now \+ warmupMs,[\s\S]*launchCueId: now/);
  assert.match(source, /activeMode: 'flappy_bird',[\s\S]*\.\.\.buildVoiceGameLaunchTimingConfig\(now\)/);
  assert.match(source, /activeMode: 'vocal_challenge',[\s\S]*\.\.\.buildVoiceGameLaunchTimingConfig\(now\)/);
  assert.match(source, /activeMode: 'riding_scales',[\s\S]*\.\.\.buildVoiceGameLaunchTimingConfig\(now\)/);
});

test('UnifiedGameLauncher carries voice-game sound pack and room tuning metadata into launches', () => {
  assert.match(source, /const VOICE_GAME_SOUND_PACK_MANIFEST_URL = '\/audio\/voice-games\/manifest\.json'/);
  assert.match(source, /const VoiceAudioSetupPanel = \(\{ voiceRoomTuning = 'forgiving_room', setVoiceRoomTuning, hostVoiceMicControl = null \}\) =>/);
  assert.match(source, /const buildVoiceGameAudioLaunchConfig = \(\) => \(\{[\s\S]*soundPackManifestUrl: VOICE_GAME_SOUND_PACK_MANIFEST_URL,[\s\S]*soundPackBasePath: VOICE_GAME_SOUND_PACK_BASE_PATH,[\s\S]*voiceRoomTuning/);
  assert.match(source, /activeMode: 'flappy_bird',[\s\S]*\.\.\.buildVoiceGameAudioLaunchConfig\(\)/);
  assert.match(source, /activeMode: 'vocal_challenge',[\s\S]*\.\.\.buildVoiceGameAudioLaunchConfig\(\)/);
  assert.match(source, /activeMode: 'riding_scales',[\s\S]*\.\.\.buildVoiceGameAudioLaunchConfig\(\)/);
  assert.match(source, /activeMode: 'team_pong',[\s\S]*\.\.\.buildVoiceGameAudioLaunchConfig\(\)/);
  assert.match(source, /activeMode: 'musical_moments',[\s\S]*\.\.\.buildVoiceGameAudioLaunchConfig\(\)/);
});
