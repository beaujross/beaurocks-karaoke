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
    /const startFlappyAmbient = async[\s\S]*gameRulesId: Date\.now\(\)/,
    'Pitch Runner launches should push a fresh rules token so the room gets control instructions before gameplay',
  );
  assert.match(
    source,
    /const startVocalAmbient = async[\s\S]*gameRulesId: Date\.now\(\)/,
    'Vocal Challenge launches should push a fresh rules token so the room gets control instructions before gameplay',
  );
  assert.match(
    source,
    /const startRidingScalesCrowd = async[\s\S]*gameRulesId: Date\.now\(\)/,
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
  assert.match(source, /onStartNextTrivia=\{launchNextTrivia\}/, 'Trivia config should have a next-in-bank launch action');
  assert.match(source, /onStartNextWyr=\{launchNextWyr\}/, 'Would You Rather config should have a next-in-bank launch action');
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