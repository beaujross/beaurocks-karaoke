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
    /if \(!baseItems\.length\) \{[\s\S]*writeYoutubeSearchCache\(cacheKey, \[\]\);[\s\S]*await writePersistedYoutubeSearchCache\(cacheKey, \[\]\);[\s\S]*return \{ items: \[\] \};[\s\S]*writeYoutubeSearchCache\(cacheKey, items\);[\s\S]*await writePersistedYoutubeSearchCache\(cacheKey, items\);/,
    'youtubeSearch should persist both empty and successful result sets'
  );
});
