import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const readSource = (path) => readFileSync(path, 'utf8');
const expectedEncodedLogoPath = '/images/logo-library/beaurocks-logo-neon%20trasnparent.png';

test('root, install manifest, and generated marketing pages use the supplied Beau Rocks Karaoke logo', () => {
  const indexSource = readSource('index.html');
  const manifestSource = readSource('public/manifest.webmanifest');
  const sitemapSource = readSource('scripts/generate-sitemap.mjs');

  assert.equal(indexSource.includes(expectedEncodedLogoPath), true);
  assert.equal(manifestSource.includes(expectedEncodedLogoPath), true);
  assert.equal(sitemapSource.includes(expectedEncodedLogoPath), true);
  assert.equal(indexSource.includes('beaurocks-karaoke-logo-2.png'), false);
  assert.equal(manifestSource.includes('beaurocks-karaoke-logo-2.png'), false);
});
