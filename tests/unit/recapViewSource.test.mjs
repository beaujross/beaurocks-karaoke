import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const recapViewSource = readFileSync(resolve('src/apps/Recap/RecapView.jsx'), 'utf8');

describe('RecapView source', () => {
  test('performance peaks wire album art thumbnails into board rows', () => {
    expect(recapViewSource).toMatch(/artworkUrl=\{entry\.albumArtUrl\}/);
  });

  test('people rows wire audience avatar emoji into reactor and performer rows', () => {
    expect(recapViewSource).toMatch(/topReactors\.map\([\s\S]*avatar=\{entry\.avatar\}/);
    expect(recapViewSource).toMatch(/topPerformers\.map\([\s\S]*avatar=\{entry\.avatar\}/);
  });

  test('recap branding updates social meta tags and only shows the partner lockup when a room has one', () => {
    expect(recapViewSource).toMatch(/ensureMetaTag\(\{ property: 'og:image'/);
    expect(recapViewSource).toMatch(/summary\.hasPartnerLogo \?/);
  });
});
