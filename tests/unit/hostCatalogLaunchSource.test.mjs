import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const appSource = readFileSync('src/App.jsx', 'utf8');
const marketingSiteSource = readFileSync('src/apps/Marketing/MarketingSite.jsx', 'utf8');
const hostTopChromeSource = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const hostEntryBootstrapSource = readFileSync('src/apps/Host/hooks/useHostEntryBootstrap.js', 'utf8');

test('host catalogue launch preserves the requested catalog surface through auth handoff', () => {
  assert.match(
    hostTopChromeSource,
    /Open Helper Catalog/,
    'Host launch menu should present the helper catalog as an in-session tool first',
  );
  assert.match(
    hostAppSource,
    /catalogPanel: browsePanel,/,
    'Host queue workspace should reuse the existing helper/catalog browse panel for its Catalog tab',
  );
  assert.match(
    hostTopChromeSource,
    /onOpenCatalogueHelper\(\);/,
    'Primary helper catalog launch should stay inside the current authenticated host session',
  );
  assert.match(
    hostTopChromeSource,
    /view=queue&section=queue\.catalog/,
    'Launch Catalogue should target the host queue catalog surface',
  );
  assert.match(
    hostTopChromeSource,
    /section=queue\.catalog&catalogue=1/,
    'Launch Catalogue should enter catalogue-only helper mode for roaming DJ helpers',
  );
  assert.match(
    hostEntryBootstrapSource,
    /if \(c === '1'\) setCatalogueOnly\(true\);/,
    'Host bootstrap should honor the catalogue-only launch flag',
  );
  assert.doesNotMatch(
    hostEntryBootstrapSource,
    /if \(isMarketingDemoFixture && qaHostFixtureId\) return;/,
    'Catalogue-only helper URLs should still bootstrap correctly inside QA host fixtures',
  );
  assert.match(
    appSource,
    /buildSurfaceUrl\(\{ surface: 'marketing', path: 'host-access' \}, window\.location\)/,
    'Host auth gate should send unauthenticated hosts through the marketing host-access surface',
  );
  assert.match(
    appSource,
    /returnToUrl\.pathname = window\.location\.pathname \|\| '\/';/,
    'Host auth gate should preserve the current host path as the post-auth return target',
  );
  assert.match(
    appSource,
    /returnToUrl\.search = window\.location\.search \|\| '';/,
    'Host auth gate should preserve current host query params like view=queue and section=queue.catalog',
  );
  assert.doesNotMatch(
    appSource,
    /returnToUrl\.searchParams\.set\('intent', resumeIntent\)/,
    'Host auth gate should not replace the requested host surface with another host-access resume URL',
  );
  assert.match(
    marketingSiteSource,
    /resolveHostDashboardReturnHref\(route\.params\?\.return_to, window\.location\)/,
    'Host access resume should honor a safe return_to target after login',
  );
  assert.match(
    marketingSiteSource,
    /isHostAccessReturn/,
    'Host access resume should reject host-access return loops',
  );
});

test('host catalogue helper mode requires singer assignment before queueing', () => {
  assert.match(
    hostAppSource,
    /const \[showCataloguePrompt, setShowCataloguePrompt\] = useState\(false\);/,
    'Catalogue-only mode should keep an explicit visible assignment prompt state',
  );
  assert.match(
    hostAppSource,
    /Co-Host Helper Catalog/,
    'Catalogue-only mode should identify itself as a constrained co-host helper surface',
  );
  assert.match(
    hostAppSource,
    /data-host-helper-shell="true"/,
    'Helper catalog should render inside a dedicated trimmed helper shell instead of the full host deck',
  );
  assert.match(
    hostAppSource,
    /Staff-safe roaming iPad mode\. Search, pick the singer, queue the song\./,
    'Helper shell should explain the simplified roaming-iPad workflow',
  );
  assert.match(
    hostAppSource,
    /Current Singer Target/,
    'Helper catalog should keep the current singer target visible while browsing',
  );
  assert.match(
    hostAppSource,
    /Helper Search/,
    'Helper catalog should expose an explicit search surface inside helper mode',
  );
  assert.match(
    hostAppSource,
    /Search song or artist\.\.\./,
    'Helper catalog search should offer a direct search input for quick song lookup',
  );
  assert.match(
    hostAppSource,
    /Pick once, then tap album art or add\./,
    'Helper catalog should explain the simplified browse interaction model',
  );
  assert.match(
    hostAppSource,
    /const catalogueAddButtonLabel = catalogueOnly\s*\n\s*\? \(catalogueHelperSingerAssigned \? `Add For \$\{catalogueHelperSingerLabel\}` : 'Choose Singer'\)/,
    'Helper catalog add calls should reflect whether a singer is already selected',
  );
  assert.match(
    hostAppSource,
    /const cataloguePendingSongArtwork = cataloguePendingSong/,
    'Helper assignment prompt should resolve artwork for the pending catalog pick',
  );
  assert.match(
    hostAppSource,
    /if \(catalogueOnly && !singerSelection\.name\) \{\s*toast\('Choose who this song is for first\.'\);/,
    'Helper catalog should require a visible singer target before completing an add',
  );
  assert.match(
    hostAppSource,
    /if \(singerSelection\.name\) \{\s*try \{\s*await queueBrowseSong\(song, singerSelection\);/,
    'Browse picks should queue directly once the helper has already selected a singer target',
  );
  assert.match(
    hostAppSource,
    /if \(cataloguePendingSong\.__yt\) \{\s*await queueYouTubeIndexItem\(cataloguePendingSong\.item, singerSelection\);/,
    'YouTube catalogue picks should queue only after the helper confirms the singer name',
  );
  assert.match(
    hostAppSource,
    /await queueBrowseSong\(cataloguePendingSong, singerSelection\);/,
    'Browse catalogue picks should queue only after the helper confirms the singer name',
  );
  assert.match(
    hostAppSource,
    /singerUid: singerIdentity\.singerUid \|\| null/,
    'Helper-originated queue writes should preserve singerUid when the helper picked a joined guest',
  );
  assert.match(
    hostAppSource,
    /duration: durationSec \|\| null,\s*durationSec: durationSec \|\| null,\s*mediaDurationSec: durationSec \|\| null,\s*backingDurationSec: durationSec \|\| null,\s*autoEndSafe: false,/,
    'Helper YouTube queue writes should preserve duration without allowing metadata-only auto-end',
  );
  assert.match(
    hostAppSource,
    /backingAudioOnly,\s*audioOnly: backingAudioOnly/,
    'Helper YouTube queue writes should preserve external-window playback flags',
  );
  assert.match(
    hostAppSource,
    /durationSec: durationSec > 0 \? durationSec : null,\s*mediaDurationSec: durationSec > 0 \? durationSec : null,\s*backingDurationSec: durationSec > 0 \? durationSec : null,/,
    'Browse helper queue writes should also persist duration into the playback-safe fields',
  );
  assert.match(
    hostAppSource,
    /window\.__qaLastHelperQueuePayload = nextEvent;/,
    'QA helper flows should capture the real queue payload for Playwright release gates',
  );
});

test('host catalog and media library accept migrated upload URL fields', () => {
  assert.match(
    hostAppSource,
    /url: String\(item\?\.url \|\| item\?\.mediaUrl \|\| ''\)\.trim\(\),\s*mediaUrl: String\(item\?\.mediaUrl \|\| item\?\.url \|\| ''\)\.trim\(\),/,
    'Room library uploads should be queueable whether the stored field is url or mediaUrl',
  );
  assert.match(
    hostAppSource,
    /const mediaUrl = getRoomMediaUrl\(item\);\s*const mediaTitle = String\(item\?\.title \|\| item\?\.trackName \|\| item\?\.fileName \|\| ''\)\.trim\(\);/,
    'Local upload queueing should normalize the media URL and display title before writing queue records',
  );
  assert.match(
    hostAppSource,
    /flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6 custom-scrollbar touch-scroll-y/,
    'Browse and Top 100 modals should expose real scroll containers, not only scrollbar styling',
  );
});
test('host catalog collection browsing preserves navigation and defaults to verified backings', () => {
  assert.match(
    hostAppSource,
    /data-feature-id="host-catalog-category-detail"/,
    'Collection detail should render as an identifiable inline catalog surface',
  );
  assert.match(
    hostAppSource,
    /data-feature-id="host-catalog-category-rail"/,
    'Collection detail should keep direct collection switching visible',
  );
  assert.doesNotMatch(
    hostAppSource,
    /activeBrowseList && \(\s*<div className="fixed inset-0/,
    'Collection detail should not cover the Host workspace with a full-screen overlay',
  );
  assert.match(
    hostAppSource,
    /const \[browseBackingFilter, setBrowseBackingFilter\] = useState\('ready'\);/,
    'Curated browse should default to TV-ready backings',
  );
  assert.match(
    hostAppSource,
    /activeBrowseList\.songs\.filter\(\(song\) => song\.hasApprovedBacking\)/,
    'TV-ready browse should filter collection songs through the approved backing index',
  );
  assert.match(hostAppSource, /Ready on TV/, 'Playable backing status should be explicit to hosts');
});
