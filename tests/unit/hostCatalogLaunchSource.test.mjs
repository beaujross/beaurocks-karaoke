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
    /window\.__qaLastHelperQueuePayload = nextEvent;/,
    'QA helper flows should capture the real queue payload for Playwright release gates',
  );
});
