import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const functionsIndexPath = path.resolve(import.meta.dirname, '../../functions/index.js');

test('youtubeSearch checks the persisted Firestore cache before live YouTube API calls', () => {
  const source = readFileSync(functionsIndexPath, 'utf8');
  assert.match(
    source,
    /const persistedCachedItems = await readPersistedYoutubeSearchCache\(cacheKey\);[\s\S]*if \(persistedCachedItems !== null\) \{\s*return \{ items: persistedCachedItems, cached: true \};\s*\}[\s\S]*ensureYouTubeApiQuotaAvailable\(\);/,
    'youtubeSearch should read the durable cache before attempting a fresh live API request'
  );
});

test('youtubeSearch persists both empty and populated results for cross-session cache reuse', () => {
  const source = readFileSync(functionsIndexPath, 'utf8');
  assert.match(
    source,
    /if \(!baseItems\.length\) \{[\s\S]*primeYoutubeSearchCaches\(\{[\s\S]*persistEmpty: true,[\s\S]*return \{ items: \[\] \};[\s\S]*primeYoutubeSearchCaches\(\{[\s\S]*items,[\s\S]*\}\);/,
    'youtubeSearch should persist both empty and successful result sets'
  );
});

test('youtubeSearch reuses an intent-level cache before making a fresh live API call', () => {
  const source = readFileSync(functionsIndexPath, 'utf8');
  assert.match(
    source,
    /const intentKey = buildYouTubeSearchIntentKey\(query\);[\s\S]*const intentCacheKey = intentKey[\s\S]*const persistedCachedItems = await readPersistedYoutubeSearchCache\(cacheKey\);[\s\S]*if \(intentCacheKey\) \{[\s\S]*const persistedIntentCachedItems = await readPersistedYoutubeSearchCache\(intentCacheKey\);[\s\S]*return \{ items: persistedIntentCachedItems, cached: true \};[\s\S]*ensureYouTubeApiQuotaAvailable\(\);/,
    'youtubeSearch should try the normalized intent cache before spending live YouTube quota'
  );
});
