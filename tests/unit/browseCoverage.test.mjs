import { describe, expect, test } from 'vitest';
import { isBrowseCollectionReadyForTonight, sortBrowseCollectionsByReadiness, summarizeBrowseCoverage } from '../../src/lib/browseCoverage.js';

describe('browseCoverage', () => {
  test('summarizes verified backing readiness', () => {
    expect(summarizeBrowseCoverage([
      { hasApprovedBacking: true },
      { hasApprovedBacking: true },
      { hasApprovedBacking: false },
    ])).toEqual({ totalCount: 3, readyCount: 2, reviewCount: 1, readyPercent: 67, readiness: 'strong' });
  });

  test('sorts ready-tonight collections ahead of incomplete themes', () => {
    const sorted = sortBrowseCollectionsByReadiness([
      { title: 'Partial', coverage: { readyPercent: 40, readyCount: 4 } },
      { title: 'Complete', coverage: { readyPercent: 100, readyCount: 3 } },
    ]);
    expect(sorted.map((item) => item.title)).toEqual(['Complete', 'Partial']);
  });

  test('only promotes themes with enough verified depth for a host to use tonight', () => {
    expect(isBrowseCollectionReadyForTonight({ coverage: { readyCount: 3, readyPercent: 60 } })).toBe(true);
    expect(isBrowseCollectionReadyForTonight({ coverage: { readyCount: 2, readyPercent: 100 } })).toBe(false);
    expect(isBrowseCollectionReadyForTonight({ coverage: { readyCount: 6, readyPercent: 50 } })).toBe(false);
  });
});
