import { describe, expect, test } from 'vitest';
import { buildRoomRecapSummary, buildRoomRecapUrl, getSongArtworkUrl } from '../../src/lib/roomRecap.js';

describe('roomRecap summary', () => {
  test('dedupes reaction leaders across uid and short-name records while keeping avatar metadata', () => {
    const summary = buildRoomRecapSummary({
      roomCode: 'sing123',
      users: [
        { uid: 'u1', name: 'Teddy Ross', avatar: '🐯' },
        { uid: 'u2', name: 'Jordan', avatar: '🎤' },
      ],
      songs: [
        {
          id: 'song-1',
          status: 'performed',
          singerUid: 'u1',
          singerName: 'Teddy Ross',
          songTitle: 'Dreams',
          artist: 'Fleetwood Mac',
          albumArtUrl: 'https://example.com/dreams.jpg',
          hypeScore: 80,
          applauseScore: 90,
          hostBonus: 10,
        },
      ],
      reactions: [
        { uid: 'u1', userName: 'Teddy Ross', avatar: '🐯', type: 'fire', count: 7 },
        { userName: 'Teddy', type: 'clap', count: 5 },
        { uid: 'u2', userName: 'Jordan', avatar: '🎤', type: 'heart', count: 4 },
      ],
    });

    expect(summary.topReactors).toHaveLength(2);
    expect(summary.topReactors[0]).toMatchObject({
      name: 'Teddy Ross',
      avatar: '🐯',
      count: 12,
    });
    expect(summary.topPerformers[0]).toMatchObject({
      name: 'Teddy Ross',
      avatar: '🐯',
      performances: 1,
      loudest: 90,
    });
    expect(summary.topPerformances[0]).toMatchObject({
      singerName: 'Teddy Ross',
      singerAvatar: '🐯',
      songTitle: 'Dreams',
      albumArtUrl: 'https://example.com/dreams.jpg',
      totalPoints: 180,
    });
  });

  test('prefers the richest available song artwork field', () => {
    expect(getSongArtworkUrl({ artworkUrl60: 'https://example.com/60.jpg' })).toBe('https://example.com/60.jpg');
    expect(getSongArtworkUrl({ artworkUrl100: 'https://example.com/100.jpg', artworkUrl60: 'https://example.com/60.jpg' })).toBe('https://example.com/100.jpg');
    expect(getSongArtworkUrl({ albumArtUrl: 'https://example.com/album.jpg', artworkUrl100: 'https://example.com/100.jpg' })).toBe('https://example.com/album.jpg');
  });

  test('keeps asked game rounds and aggregates each audience answer into the recap', () => {
    const summary = buildRoomRecapSummary({
      roomCode: 'game1',
      room: {
        gameRoundHistory: [{
          id: 'trivia-1',
          type: 'trivia',
          question: 'Which city is called the Emerald City?',
          options: ['Seattle', 'Portland', 'Austin', 'Miami'],
          correct: 0,
          startedAt: 1000,
        }],
        wyrData: {
          id: 'wyr-1',
          question: 'Would you rather sing first or last?',
          optionA: 'First',
          optionB: 'Last',
          startedAt: 2000,
        },
      },
      promptVotes: [
        { questionId: 'trivia-1', voteType: 'vote_trivia', val: 0, userName: 'Alex' },
        { questionId: 'trivia-1', voteType: 'vote_trivia', val: 1, userName: 'Sam' },
        { questionId: 'wyr-1', voteType: 'vote_wyr', val: 'A', userName: 'Jordan' },
      ],
    });

    expect(summary.gameRounds).toHaveLength(2);
    expect(summary.gameRounds[0]).toMatchObject({
      questionId: 'trivia-1',
      responseCount: 2,
      counts: { Seattle: 1, Portland: 1 },
    });
    expect(summary.gameRounds[1]).toMatchObject({
      questionId: 'wyr-1',
      responseCount: 1,
      counts: { First: 1 },
    });
    expect(summary.stats).toMatchObject({ gameRounds: 2, gameResponses: 3 });
  });

  test('builds stable public recap urls', () => {
    expect(buildRoomRecapUrl('aahf')).toBe('/recaps/AAHF');
    expect(buildRoomRecapUrl('vip777', 'https://app.beaurocks.app/')).toBe('https://app.beaurocks.app/recaps/VIP777');
  });
});
