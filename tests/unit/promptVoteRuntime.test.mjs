import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, test, vi } from 'vitest';

const noop = () => {};

const mockPromptVoteDeps = () => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    db: {},
    doc: (...parts) => ({ parts }),
    onSnapshot: () => noop,
    castPromptVote: async () => ({ ok: true }),
    finalizePromptVoteRound: async () => ({ ok: true }),
  }));

  vi.doMock('../../src/lib/assets.js', () => ({
    APP_ID: 'bross-app',
    PROMPT_VOTE_SFX: { launch: '/launch.mp3', voteLock: '/vote.mp3', reveal: '/reveal.mp3', correct: '/correct.mp3' },
  }));
};

beforeEach(() => {
  vi.resetModules();
});

test('PromptVoteGame renders Trivia player and TV states with the expected core affordances', async () => {
  mockPromptVoteDeps();
  const { default: PromptVoteGame } = await import('../../src/games/PromptVote/Game.jsx');

  const triviaPlayer = renderToStaticMarkup(
    React.createElement(PromptVoteGame, {
      isPlayer: true,
      roomCode: 'AAHF',
      activeMode: 'trivia_pop',
      user: { uid: 'user-1', name: 'Alex', avatar: '🎤' },
      gameState: {
        id: 'trivia-1',
        q: 'Which artist sang Valerie?',
        options: ['Amy Winehouse', 'Adele', 'Dua Lipa', 'P!nk'],
        correct: 0,
        points: 100,
        durationSec: 16,
        startedAt: Date.now(),
      },
    }),
  );

  assert.match(triviaPlayer, /data-prompt-vote-player-view="trivia"/);
  assert.match(triviaPlayer, /Trivia Challenge/);
  assert.match(triviaPlayer, /Which artist sang Valerie\?/);
  assert.match(triviaPlayer, /data-qa-choice="0"/);
  assert.match(triviaPlayer, /Amy Winehouse/);
  assert.match(triviaPlayer, /circle_at_top_left/);

  const triviaTv = renderToStaticMarkup(
    React.createElement(PromptVoteGame, {
      isPlayer: false,
      roomCode: 'AAHF',
      activeMode: 'trivia_reveal',
      user: { uid: 'host-1', name: 'Host' },
      gameState: {
        id: 'trivia-1',
        q: 'Which artist sang Valerie?',
        options: ['Amy Winehouse', 'Adele', 'Dua Lipa', 'P!nk'],
        correct: 0,
        points: 100,
        durationSec: 16,
        startedAt: Date.now() - 30_000,
        status: 'reveal',
      },
    }),
  );

  assert.match(triviaTv, /data-prompt-vote-tv-view="trivia"/);
  assert.match(triviaTv, /ANSWER REVEALED/);
  assert.match(triviaTv, /Question Summary/);
  assert.match(triviaTv, /Responses/);
  assert.match(triviaTv, /circle_at_18%_18/);
  assert.match(triviaTv, /max-h-\[28vh\]/);
  assert.match(triviaTv, /min-h-\[clamp\(82px,15vh,145px\)\]/);
});

test('PromptVoteGame renders Would You Rather player and TV states with the expected choice surfaces', async () => {
  mockPromptVoteDeps();
  const { default: PromptVoteGame } = await import('../../src/games/PromptVote/Game.jsx');

  const wyrPlayer = renderToStaticMarkup(
    React.createElement(PromptVoteGame, {
      isPlayer: true,
      roomCode: 'AAHF',
      activeMode: 'wyr',
      user: { uid: 'user-2', name: 'Jordan', avatar: '🔥' },
      gameState: {
        id: 'wyr-1',
        question: 'Would you rather open with a power ballad or a singalong anthem?',
        optionA: 'Power ballad',
        optionB: 'Singalong anthem',
        points: 50,
        durationSec: 15,
        startedAt: Date.now(),
      },
    }),
  );

  assert.match(wyrPlayer, /data-prompt-vote-player-view="wyr"/);
  assert.match(wyrPlayer, /WOULD YOU RATHER/);
  assert.match(wyrPlayer, /data-wyr-choice="A"/);
  assert.match(wyrPlayer, /data-wyr-choice="B"/);
  assert.match(wyrPlayer, /Power ballad/);
  assert.match(wyrPlayer, /Singalong anthem/);

  const wyrTv = renderToStaticMarkup(
    React.createElement(PromptVoteGame, {
      isPlayer: false,
      roomCode: 'AAHF',
      activeMode: 'wyr_reveal',
      user: { uid: 'host-1', name: 'Host' },
      gameState: {
        id: 'wyr-1',
        question: 'Would you rather open with a power ballad or a singalong anthem?',
        optionA: 'Power ballad',
        optionB: 'Singalong anthem',
        points: 50,
        durationSec: 15,
        startedAt: Date.now() - 20_000,
        status: 'reveal',
      },
    }),
  );

  assert.match(wyrTv, /data-prompt-vote-tv-view="wyr"/);
  assert.match(wyrTv, /WOULD YOU RATHER/);
  assert.match(wyrTv, /Prompt/);
  assert.match(wyrTv, /Power ballad/);
  assert.match(wyrTv, /Singalong anthem/);
  assert.match(wyrPlayer, /circle_at_top_left/);
  assert.match(wyrTv, /circle_at_20%_20/);
  assert.match(wyrPlayer, /min-h-\[clamp\(112px,24vh,150px\)\]/);
  assert.match(wyrTv, /clamp\(150px, 24vh, 280px\)/);
});
