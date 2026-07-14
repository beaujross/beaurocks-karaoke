import { describe, expect, test } from 'vitest';
import { enrichCatalogResultsWithCanonicalIdentity, getCatalogRenditionCapability, getUnifiedCatalogSongKey, groupUnifiedCatalogResults } from '../../src/lib/unifiedCatalogResults.js';

describe('unifiedCatalogResults', () => {
  test('groups provider renditions under one canonical song', () => {
    const grouped = groupUnifiedCatalogResults([
      { canonicalSongId: 'song-1', source: 'itunes', trackName: 'September', artistName: 'Earth Wind & Fire', appleMusicId: 'apple-1' },
      { canonicalSongId: 'song-1', source: 'youtube', trackName: 'September Karaoke', artistName: 'Karaoke Channel', videoId: 'yt-1', playable: true, embeddable: true },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ source: 'youtube', catalogVersionCount: 2, catalogRecommendedTvReady: true });
    expect(grouped[0].catalogAlternatives).toHaveLength(1);
  });

  test('joins unresolved Apple intent to an Apple-anchored canonical backing', () => {
    const grouped = groupUnifiedCatalogResults([
      { source: 'itunes', trackName: 'September', artistName: 'Earth Wind & Fire', trackId: '1440833084' },
      { canonicalSongId: 'apple:1440833084', source: 'youtube', videoId: 'yt-1', playable: true, embeddable: true },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].source).toBe('youtube');
    expect(grouped[0].catalogAlternatives[0].source).toBe('itunes');
  });

  test('prefers verified indexed backings over live search results', () => {
    const [group] = groupUnifiedCatalogResults([
      { canonicalSongId: 'song-1', source: 'youtube', videoId: 'live', playable: true, embeddable: true, sourceReason: 'youtube_search' },
      { canonicalSongId: 'song-1', source: 'youtube', videoId: 'known', playable: true, embeddable: true, sourceReason: 'youtube_index' },
    ]);
    expect(group.videoId).toBe('known');
  });

  test('keeps provider results separate when canonical identity is unknown', () => {
    expect(getUnifiedCatalogSongKey({ source: 'youtube', trackName: 'Song Karaoke', artistName: 'Channel A' }))
      .not.toBe(getUnifiedCatalogSongKey({ source: 'youtube', trackName: 'Song Karaoke', artistName: 'Channel B' }));
  });

  test('enriches backing results with canonical display metadata in one batch', async () => {
    const resolver = async (items) => items.map((item, index) => ({
      index,
      found: true,
      songId: 'apple:123',
      trackId: 'canonical-track',
      title: 'September',
      artist: 'Earth, Wind & Fire',
      artworkUrl: 'https://example.com/album.jpg',
      matchedBy: 'source_lookup',
    }));
    const [result] = await enrichCatalogResultsWithCanonicalIdentity([
      { source: 'youtube', trackName: 'September Karaoke Version', artistName: 'Karaoke Channel', url: 'https://youtu.be/abc123' },
    ], resolver);
    expect(result).toMatchObject({
      canonicalSongId: 'apple:123',
      catalogDisplayTitle: 'September',
      catalogDisplayArtist: 'Earth, Wind & Fire',
      catalogArtworkUrl: 'https://example.com/album.jpg',
    });
  });

  test('describes renditions by host capability rather than provider alone', () => {
    expect(getCatalogRenditionCapability({ source: 'youtube', playable: true, embeddable: true }).label).toBe('TV Karaoke');
    expect(getCatalogRenditionCapability({ source: 'youtube', playable: true, embeddable: false }).label).toBe('External Playback');
    expect(getCatalogRenditionCapability({ source: 'itunes' }).label).toBe('Apple Sing-Along');
    expect(getCatalogRenditionCapability({ source: 'local' }).label).toBe('Room Upload');
    expect(getCatalogRenditionCapability({ source: 'unknown' }).label).toBe('Review Needed');
  });

  test('decorates recommended and alternate versions with capability labels', () => {
    const [group] = groupUnifiedCatalogResults([
      { canonicalSongId: 'song-1', source: 'itunes', trackId: 'apple-1' },
      { canonicalSongId: 'song-1', source: 'youtube', videoId: 'yt-1', playable: true, embeddable: true },
    ]);
    expect(group.catalogCapabilityLabel).toBe('TV Karaoke');
    expect(group.catalogAlternatives[0].catalogCapabilityLabel).toBe('Apple Sing-Along');
  });
});
