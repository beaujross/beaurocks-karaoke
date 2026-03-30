import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('browseCatalog', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('decorates browse songs with approved backing metadata', async () => {
    vi.doMock('../../src/lib/browseBackingIndex.js', () => ({
      BROWSE_BACKING_INDEX: {
        'mr brightside__the killers': {
          approved: true,
          playable: true,
          mediaUrl: 'https://www.youtube.com/watch?v=abc123',
          trackSource: 'youtube',
        },
      },
    }));

    const {
      buildBrowseSongKey,
      decorateBrowseSong,
      isApprovedPlayableBrowseSong,
    } = await import('../../src/lib/browseCatalog.js');

    const song = decorateBrowseSong({ title: 'Mr. Brightside', artist: 'The Killers' });

    expect(buildBrowseSongKey('Mr. Brightside', 'The Killers')).toBe('mr brightside__the killers');
    expect(song.hasApprovedBacking).toBe(true);
    expect(song.backing.mediaUrl).toContain('abc123');
    expect(isApprovedPlayableBrowseSong(song)).toBe(true);
  });

  it('filters unresolved browse songs in playable-only mode', async () => {
    vi.doMock('../../src/lib/browseBackingIndex.js', () => ({
      BROWSE_BACKING_INDEX: {
        'shallow__lady gaga': {
          approved: true,
          playable: true,
          mediaUrl: 'https://www.youtube.com/watch?v=ready1',
          trackSource: 'youtube',
        },
      },
    }));

    const { decorateBrowseSongs } = await import('../../src/lib/browseCatalog.js');
    const songs = decorateBrowseSongs([
      { title: 'Shallow', artist: 'Lady Gaga' },
      { title: 'Unknown Song', artist: 'Indie Artist' },
    ], { playableOnly: true });

    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('Shallow');
  });
});
