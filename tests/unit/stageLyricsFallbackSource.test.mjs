import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const stageSource = readFileSync('src/components/Stage.jsx', 'utf8');
const rendererSource = readFileSync('src/components/AppleLyricsRenderer.jsx', 'utf8');
const hostChromeSource = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');

test('Stage keeps its normal performance UI when requested lyrics are unavailable', () => {
  assert.match(stageSource, /const lyricsVisible = !!room\?\.showLyricsTv && hasLyrics;/);
  assert.match(stageSource, /\{lyricsVisible && \(/);
  assert.match(stageSource, /!lyricsVisible && !showVisualizerTv/);
  assert.match(stageSource, /room\?\.showLyricsTv && !hasLyrics/);
  assert.match(stageSource, /Lyrics unavailable/);
});

test('lyrics renderer distinguishes provider timing from estimated timing', () => {
  assert.match(rendererSource, /const hasProviderTiming = effectiveTimedLyrics\.length > 0;/);
  assert.match(rendererSource, /hasProviderTiming \? 'Synced' : 'Following'/);
  assert.match(rendererSource, /hasProviderTiming \? 'SYNCED' : 'ESTIMATED'/);
  assert.match(rendererSource, /data-lyrics-timing-quality=\{hasProviderTiming \? 'timed' : 'estimated'\}/);
});

test('selecting a lyrics TV layer also enables future queue lookup', () => {
  assert.match(hostChromeSource, /const wantsLyrics = mode === 'lyrics' \|\| mode === 'lyrics_viz';/);
  assert.match(hostChromeSource, /quickAutomationControls\?\.autoLyricsOnQueue !== true/);
  assert.match(hostChromeSource, /onToggleAutoLyricsOnQueue\?\.\(\)/);
});
