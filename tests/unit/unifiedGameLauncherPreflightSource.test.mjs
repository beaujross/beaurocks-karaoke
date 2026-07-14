import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');

test('quick launch checks the shared room preflight before local setup or room mutation', () => {
  assert.match(source, /getRoomGameLaunchPreflight\(\{ requestedMode: gameId, room: room \|\| \{\} \}\)/);
  const dispatcherStart = source.indexOf('const quickLaunchGame = async');
  const preflight = source.indexOf('if (!canStartLifecycleMode(gameId)) return;', dispatcherStart);
  const firstLaunch = source.indexOf("return startFlappyAmbient({ quick: true })", dispatcherStart);
  assert.ok(dispatcherStart >= 0 && preflight > dispatcherStart && preflight < firstLaunch);
});

test('configured callbacks that can make a mode live use the same preflight wrapper', () => {
  const expected = [
    ['flappy_bird', 'onStartFlappyAmbient'],
    ['vocal_challenge', 'onStartVocalAmbient'],
    ['riding_scales', 'onStartRidingCrowd'],
    ['team_pong', 'onStartTeamPong'],
    ['volley_orb', 'onStartVolleyOrb'],
    ['musical_moments', 'onStartMusicalMoments'],
    ['doodle_oke', 'onStartDoodleOke'],
    ['selfie_challenge', 'onStartSelfieChallenge'],
    ['trivia_pop', 'onStartTrivia'],
    ['wyr', 'onStartWyr'],
    ['bingo', 'onStartBingo'],
    ['karaoke_bracket', 'onGoLiveSweet16Bracket'],
  ];
  expected.forEach(([mode, prop]) => {
    assert.match(source, new RegExp(`${prop}=\\{withGameLaunchPreflight\\('${mode}'`));
  });
});

test('configuration-only bracket setup and scoring callbacks stay outside launch preflight', () => {
  assert.match(source, /onCreateSweet16Bracket=\{onCreateSweet16Bracket\}/);
  assert.match(source, /onSetBracketMatchWinner=\{onSetBracketMatchWinner\}/);
  assert.match(source, /onClearSweet16Bracket=\{onClearSweet16Bracket\}/);
});
