import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('host background analyser waits for a user gesture before creating AudioContext', () => {
  const audioInitStart = hostSource.indexOf('// Audio Init');
  const micStart = hostSource.indexOf('const requestStageMic', audioInitStart);
  const audioInitSource = hostSource.slice(audioInitStart, micStart);

  assert.ok(audioInitStart >= 0 && micStart > audioInitStart, 'Host audio initialization block should be discoverable');
  assert.match(audioInitSource, /const initializeOrResumeBgAnalyser = \(\) => \{/);
  assert.match(audioInitSource, /window\.addEventListener\('pointerdown', initializeOrResumeBgAnalyser/);
  assert.match(audioInitSource, /window\.addEventListener\('keydown', initializeOrResumeBgAnalyser\)/);
  assert.doesNotMatch(audioInitSource, /useEffect\(\(\) => \{\s*if \(!bgAudio\.current \|\| bgCtxRef\.current\) return;\s*const AudioCtx/);
});
