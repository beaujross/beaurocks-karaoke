import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const appSource = readFileSync('src/App.jsx', 'utf8');
const marketingSiteSource = readFileSync('src/apps/Marketing/MarketingSite.jsx', 'utf8');
const hostTopChromeSource = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');

test('host catalogue launch preserves the requested catalog surface through auth handoff', () => {
  assert.match(
    hostTopChromeSource,
    /view=queue&section=queue\.catalog/,
    'Launch Catalogue should target the host queue catalog surface',
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
