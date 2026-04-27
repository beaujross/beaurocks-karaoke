import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const singerSource = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const tvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('Doodle Oke audience and TV surfaces stay wired into the optional-mode experience', () => {
  assert.match(singerSource, /data-feature-id="singer-doodle-oke"/);
  assert.match(singerSource, /lyric line showdown/i);
  assert.match(tvSource, /data-feature-id="tv-doodle-oke"/);
  assert.match(tvSource, /waiting for sketches/i);
  assert.match(tvSource, /Doodle Oke/);
});

test('Selfie Challenge audience and TV surfaces stay wired into the optional-mode experience', () => {
  assert.match(singerSource, /data-feature-id="singer-selfie-challenge"/);
  assert.match(singerSource, /Selfie Challenge/);
  assert.match(tvSource, /data-feature-id="tv-selfie-challenge"/);
  assert.match(tvSource, /waiting for selfies/i);
  assert.match(tvSource, /Selfie Challenge/);
});
