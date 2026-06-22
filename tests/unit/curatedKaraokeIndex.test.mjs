import { describe, expect, it } from 'vitest';

import {
  buildBrowseCuratedYouTubeIndex,
  searchBrowseCuratedYouTubeIndex,
} from '../../src/lib/curatedKaraokeIndex.js';

describe('curatedKaraokeIndex', () => {
  it('promotes approved Browse backings into a playable YouTube index', () => {
    const index = buildBrowseCuratedYouTubeIndex();
    const mrBrightside = index.find((entry) => (
      entry.trackName === 'Mr. Brightside' && entry.artistName === 'The Killers'
    ));

    expect(mrBrightside).toBeTruthy();
    expect(mrBrightside.source).toBe('youtube');
    expect(mrBrightside.sourceReason).toBe('curated_browse');
    expect(mrBrightside.resolutionLayer).toBe('global_browse_index');
    expect(mrBrightside.playable).toBe(true);
    expect(mrBrightside.embeddable).toBe(true);
    expect(mrBrightside.videoId).toHaveLength(11);
  });

  it('searches common karaoke intent without requiring live YouTube results', () => {
    const matches = searchBrowseCuratedYouTubeIndex('sweet caroline');

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].trackName.toLowerCase()).toContain('sweet caroline');
    expect(matches[0].sourceDetail).toContain('No live YouTube search needed');
  });
});
