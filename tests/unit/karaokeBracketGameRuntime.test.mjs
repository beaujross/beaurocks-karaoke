import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, test, vi } from 'vitest';

const noop = () => {};

const mockKaraokeBracketDeps = () => {
  vi.doMock('../../src/lib/firebase.js', () => ({
    castKaraokeBracketVote: async () => ({ ok: true }),
  }));
};

beforeEach(() => {
  vi.resetModules();
});

test('KaraokeBracketGame resolves legacy room-user ids with underscore-containing UIDs for vote highlights and totals', async () => {
  mockKaraokeBracketDeps();
  const { default: KaraokeBracketGame } = await import('../../src/games/KaraokeBracket/Game.jsx');

  const singerAUid = 'singer_a_with_under_scores';
  const singerBUid = 'singer_b_with_under_scores';
  const voterUid = 'voter_uid_with_under_scores';

  const markup = renderToStaticMarkup(
    React.createElement(KaraokeBracketGame, {
      view: 'mobile',
      roomCode: 'ROOM1',
      user: { uid: voterUid, name: 'Voter' },
      users: [
        {
          id: `ROOM1_${singerAUid}`,
          name: 'Singer A',
          bracketVote: {
            bracketId: 'bracket_1',
            matchId: 'm_1_1',
            targetUid: singerAUid,
          },
        },
        {
          id: `ROOM1_${singerBUid}`,
          name: 'Singer B',
        },
        {
          id: `ROOM1_${voterUid}`,
          name: 'Voter',
          bracketVote: {
            bracketId: 'bracket_1',
            matchId: 'm_1_1',
            targetUid: singerAUid,
          },
        },
      ],
      room: {},
      gameState: {
        id: 'bracket_1',
        status: 'in_progress',
        activeRoundIndex: 0,
        activeMatchId: 'm_1_1',
        crowdVotingEnabled: true,
        contestantsByUid: {
          [singerAUid]: { uid: singerAUid, name: 'Singer A', avatar: 'A' },
          [singerBUid]: { uid: singerBUid, name: 'Singer B', avatar: 'B' },
        },
        rounds: [{
          id: 'round_1',
          index: 0,
          name: 'Final',
          matches: [{
            id: 'm_1_1',
            slot: 1,
            aUid: singerAUid,
            bUid: singerBUid,
            aSong: { songTitle: 'Song A', artist: 'Artist A' },
            bSong: { songTitle: 'Song B', artist: 'Artist B' },
            winnerUid: null,
          }],
        }],
      },
      onOpenTight15: noop,
    }),
  );

  assert.match(markup, /Audience Vote/);
  assert.match(markup, /border-cyan-300 bg-cyan-500\/20/);
  assert.match(markup, /1 crowd votes/);
  assert.doesNotMatch(markup, /2 crowd votes/);
});
