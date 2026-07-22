import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const sitemapSource = readFileSync('scripts/generate-sitemap.mjs', 'utf8');

test('Host Access receives a dedicated private boot shell instead of homepage SEO copy', () => {
  assert.match(sitemapSource, /PRERENDER_ONLY_ROUTE_PAGES = \[[\s\S]*MARKETING_ROUTE_PAGES\.hostAccess/);
  assert.match(sitemapSource, /data-host-access-boot="true"/);
  assert.match(sitemapSource, /Opening Host Login/);
  assert.match(sitemapSource, /buildSeoRouteRecord\(route, \{ baseUrl: siteUrl, indexable: false \}\)/);
  assert.match(sitemapSource, /seo-static-shell--host-access/);
});
