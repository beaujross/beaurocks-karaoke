import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

test('Host and Audience surfaces share usage-control recovery guidance', () => {
  const host = readSource('src/apps/Host/HostApp.jsx');
  const audience = readSource('src/apps/Mobile/SingerApp.jsx');
  expect(host).toContain("from '../../lib/usageDegradation'");
  expect(audience).toContain("from '../../lib/usageDegradation'");
});

test('Public TV playback has no fresh variable-cost provider dependency', () => {
  const publicTv = readSource('src/apps/TV/PublicTV.jsx');
  for (const callable of [
    'youtubeSearch',
    'youtubeDetails',
    'youtubeStatus',
    'youtubePlaylist',
    'youtubeRefreshIndexEntries',
    'appleMusicLyrics',
    'geminiGenerate',
  ]) {
    expect(publicTv).not.toContain(`callFunction('${callable}'`);
    expect(publicTv).not.toContain(`callFunction("${callable}"`);
  }
});
