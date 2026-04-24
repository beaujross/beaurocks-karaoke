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
    /Roaming DJ helper mode/,
    'Catalogue-only mode should identify itself to helpers instead of looking like the full host deck',
  );
  assert.match(
    hostAppSource,
    /if \(cataloguePendingSong\.__yt\) \{\s*await queueYouTubeIndexItem\(cataloguePendingSong\.item, singerName\);/,
    'YouTube catalogue picks should queue only after the helper confirms the singer name',
  );
  assert.match(
    hostAppSource,
    /await queueBrowseSong\(cataloguePendingSong, singerName\);/,
    'Browse catalogue picks should queue only after the helper confirms the singer name',
  );
});
