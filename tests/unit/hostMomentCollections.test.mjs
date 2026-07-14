import { describe, expect, test } from 'vitest';
import { decorateBrowseSongs } from '../../src/lib/browseCatalog.js';
import { HOST_MOMENT_COLLECTIONS } from '../../src/lib/hostMomentCollections.js';
import { isBrowseCollectionReadyForTonight, summarizeBrowseCoverage } from '../../src/lib/browseCoverage.js';

describe('hostMomentCollections', () => {
  test('ships only playbooks that meet the Ready Tonight threshold', () => {
    for (const collection of HOST_MOMENT_COLLECTIONS) {
      const songs = decorateBrowseSongs(collection.songs);
      const coverage = summarizeBrowseCoverage(songs);
      expect(isBrowseCollectionReadyForTonight({ coverage }), collection.title).toBe(true);
      expect(coverage.readyPercent, collection.title).toBe(100);
    }
  });

  test('frames collections around host interventions rather than genres', () => {
    expect(HOST_MOMENT_COLLECTIONS.every((collection) => collection.hostIntent && collection.subtitle)).toBe(true);
  });
});
