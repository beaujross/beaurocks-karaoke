import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const fixtureSource = readFileSync('src/apps/Mobile/qaAudienceFixtures.js', 'utf8');

test('streamlined SONGS search unifies catalog, YouTube, and ask-host entry', () => {
  assert.match(
    source,
    /data-feature-id=\{item\.key === 'request' \? 'singer-nav-songs' : 'singer-nav-party'\}/,
  );
  assert.match(
    source,
    /data-feature-id="audience-request-source-switcher"[\s\S]*Songs[\s\S]*YouTube[\s\S]*openAudienceManualRequestFromSearch[\s\S]*Ask host/,
  );
  assert.match(source, /setCatalogSearchMode\(\(current\) => \['catalog', 'youtube'\]\.includes\(current\) \? current : preferredCatalogSearchMode\)/);
  assert.match(source, /openAudienceManualRequestFromSearch[\s\S]*setManualRequestComposerOpen\(true\)/);
  assert.match(
    source,
    /manualRequestComposerOpen && \(songsTab === 'requests' \|\| \(isStreamlinedAudienceShell && songsTab === 'browse'\)\)/,
  );
  assert.match(
    source,
    /manualRequestRouteActive = tab === 'request'[\s\S]*songsTab === 'requests'[\s\S]*isStreamlinedAudienceShell && songsTab === 'browse'[\s\S]*if \(!manualRequestRouteActive\)/,
  );
  assert.match(source, /data-feature-id="singer-request-song-title"/);
  assert.match(source, /data-feature-id="singer-request-submit"/);
});

test('joined SingerApp fixtures bypass profile onboarding before interaction checks', () => {
  assert.match(
    source,
    /const initialAudienceDemoFixture = useMemo\(\(\) => \{[\s\S]*buildQaAudienceFixture\(fixtureId, \{ roomCode: targetRoomCode \}\)[\s\S]*\}, \[roomCode\]\)/,
  );
  assert.match(
    fixtureSource,
    /vipProfile:\s*\{[\s\S]*location: 'Seattle'[\s\S]*birthMonth: 'Jan'[\s\S]*birthDay: '1'[\s\S]*tosAccepted: true/,
  );
  assert.match(
    fixtureSource,
    /safeId === 'streamlined-browse'[\s\S]*shellVariant: 'streamlined'[\s\S]*tab: 'request'[\s\S]*songsTab: 'browse'/,
  );
});

test('Apple-powered song matches remain canonical requests unless the room is YouTube-only', () => {
  assert.match(
    source,
    /if \(audienceYouTubeOnlySearch\) \{[\s\S]*This room requires a playable YouTube result\. Choose one above\.[\s\S]*return;[\s\S]*handleAudienceCatalogResultSelect\(result\);/,
  );
  assert.doesNotMatch(source, /Pick one of the YouTube karaoke results below for this song/);
  assert.match(source, /Request song - host chooses the karaoke version/);
  assert.match(source, /Host will choose the karaoke version\./);
  assert.match(source, /audienceYouTubeOnlySearch[\s\S]*Choose YouTube above/);
});
