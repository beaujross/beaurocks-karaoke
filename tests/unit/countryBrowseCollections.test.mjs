import { describe, expect, it } from 'vitest';

import { BROWSE_BACKING_INDEX } from '../../src/lib/browseBackingIndex.js';
import { TOPIC_HITS } from '../../src/lib/browseLists.js';

const normalize = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const buildSongKey = ({ title = '', artist = '' } = {}) => (
  `${normalize(title)}__${normalize(artist || 'unknown') || 'unknown'}`
);

const getCollection = (id) => TOPIC_HITS.find((collection) => collection.id === id);

describe('country Browse collections', () => {
  it.each([
    ['classic_country', 'Classic Country Favorites'],
    ['modern_country', 'Modern Country Hits'],
  ])('publishes the %s collection with a complete playable backing set', (id, title) => {
    const collection = getCollection(id);

    expect(collection?.title).toBe(title);
    expect(collection?.songs).toHaveLength(8);

    const backingRecords = collection.songs.map((song) => BROWSE_BACKING_INDEX[buildSongKey(song)]);
    backingRecords.forEach((backing) => {
      expect(backing).toMatchObject({
        approved: true,
        playable: true,
        embeddable: true,
        trackSource: 'youtube',
      });
      expect(backing.mediaUrl).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
      expect(backing.videoId).toMatch(/^[a-zA-Z0-9_-]{11}$/);
      expect(backing.durationSec).toBeGreaterThan(0);
    });
  });

  it('keeps song identities unique inside each country collection', () => {
    ['classic_country', 'modern_country'].forEach((id) => {
      const songKeys = getCollection(id).songs.map(buildSongKey);
      expect(new Set(songKeys).size).toBe(songKeys.length);
    });
  });
});
