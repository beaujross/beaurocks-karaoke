import { describe, expect, test } from 'vitest';
import { buildRoomRecapSummary, getSongArtworkUrl } from '../../src/lib/roomRecap.js';

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
});
