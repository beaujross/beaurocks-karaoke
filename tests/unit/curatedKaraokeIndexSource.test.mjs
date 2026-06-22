import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueTabSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const singerAppSource = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const functionsSource = readFileSync('functions/index.js', 'utf8');
const rulesSource = readFileSync('firestore.rules', 'utf8');

test('host YouTube autocomplete uses room, account, global, and Browse matches before live fallback', () => {
  assert.match(queueTabSource, /\[\.\.\.accountYtIndex, \.\.\.globalYtIndex, \.\.\.buildBrowseCuratedYouTubeIndex\(\)\]/);
  assert.match(queueTabSource, /sourceReason: 'curated_browse'/);
  assert.match(
    queueTabSource,
    /const knownYouTubeMatches = mergeUniqueQueueSearchResults\(ytMatches, curatedMatches\);[\s\S]*if \(knownYouTubeMatches\.length < 4\) \{[\s\S]*usageSource: 'host_queue_search_youtube_fallback'/,
    'Host queue search should only spend live YouTube search quota when room/global curated matches are thin',
  );
});

test('host catalogue search includes curated Browse matches in fallback and Apple paths', () => {
  assert.match(hostAppSource, /buildCuratedYouTubeAutocompleteEntries\(\[\.\.\.accountYtIndex, \.\.\.globalYtIndex, \.\.\.buildBrowseCuratedYouTubeIndex\(\)\], normalizedQuery\)/);
  assert.match(hostAppSource, /if \(shouldUseYouTubeFallback && knownYouTubeMatches\.length < 4\)/);
  assert.match(
    hostAppSource,
    /setCatalogueResults\(mergeUniqueQueueSearchResults\(localMatches, knownYouTubeMatches, itunesMatches\)\)/,
    'Apple catalogue results should still retain known YouTube matches from room and curated Browse indexes',
  );
});

test('audience YouTube search returns curated Browse matches before spending live quota', () => {
  assert.match(singerAppSource, /searchCuratedYouTubeEntries\(globalYtIndex, searchQ\)/);
  assert.match(singerAppSource, /searchBrowseCuratedYouTubeIndex\(searchQ, \{ playableOnly: true \}\)/);
  assert.match(
    singerAppSource,
    /if \(curatedResults\.length >= 4\)[\s\S]*setYoutubeResults\(curatedResults\)[\s\S]*return;[\s\S]*usageSource: 'audience_request_youtube_search'/,
    'Audience search should avoid live YouTube calls for common Browse-backed karaoke queries',
  );
});

test('server promotion callable persists account indexes and thresholded global indexes', () => {
  assert.match(functionsSource, /exports\.upsertCuratedYouTubeIndexes = onCall/);
  assert.match(functionsSource, /ensureRoomHostAccess\(\{[\s\S]*Only room hosts can promote curated YouTube index entries/);
  assert.match(functionsSource, /HOST_ACCOUNT_YOUTUBE_INDEXES_COLLECTION = "youtube_indexes"/);
  assert.match(functionsSource, /GLOBAL_YOUTUBE_INDEXES_COLLECTION = "global_youtube_indexes"/);
  assert.match(functionsSource, /filterGlobalYouTubePromotionCandidates/);
});

test('firestore rules make persisted indexes read-only to clients', () => {
  assert.match(rulesSource, /match \/organizations\/\{orgId\}\/youtube_indexes\/\{indexId\}/);
  assert.match(rulesSource, /allow read: if isOrganizationMember\(orgId\);/);
  assert.match(rulesSource, /match \/global_youtube_indexes\/\{indexId\}/);
  assert.match(rulesSource, /allow write: if false;/);
});