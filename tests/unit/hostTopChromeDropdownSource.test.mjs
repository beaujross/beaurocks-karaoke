import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const topChromeSource = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const presetSource = readFileSync('src/apps/Host/hostNightPresets.js', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('Host top chrome dropdowns stay open for in-menu control clicks', () => {
  assert.ok(!/window\.addEventListener\('pointerdown'/.test(topChromeSource), 'Top chrome should not close dropdowns from outside pointerdown listeners');
  assert.ok(!/window\.addEventListener\('blur'/.test(topChromeSource), 'Top chrome should not close dropdowns on window blur');
  assert.ok(!/window\.addEventListener\('focus'/.test(topChromeSource), 'Top chrome should not close dropdowns on window focus');
  assert.ok(!/document\.addEventListener\('visibilitychange'/.test(topChromeSource), 'Top chrome should not close dropdowns on visibility changes');

  const tvModeHandler = topChromeSource.match(/const applyTvDisplayMode = async \(mode\) => \{[\s\S]*?\n    \};/)?.[0] || '';
  const overlayHandler = topChromeSource.match(/const toggleOverlayScreen = async \(screenId\) => \{[\s\S]*?\n    \};/)?.[0] || '';
  const popTriviaHandler = topChromeSource.match(/const togglePopTriviaOverlay = async \(\) => \{[\s\S]*?\n    \};/)?.[0] || '';

  assert.ok(tvModeHandler && !/closeAllTopMenus\(\)/.test(tvModeHandler), 'TV display buttons should not collapse the TV dropdown');
  assert.ok(overlayHandler && !/closeAllTopMenus\(\)/.test(overlayHandler), 'Overlay buttons should not collapse the overlays dropdown');
  assert.ok(popTriviaHandler && !/closeAllTopMenus\(\)/.test(popTriviaHandler), 'Pop trivia button should not collapse the overlays dropdown');
});

test('Host night presets default casual TV to video-first media', () => {
  assert.match(presetSource, /description: 'Media-forward karaoke night with video prioritized on TV\.'/);
  assert.match(presetSource, /casual:[\s\S]*?settings: Object\.freeze\(\{[\s\S]*?showVisualizerTv: false,[\s\S]*?showLyricsTv: false,/);
});
test('Host top scenes dropdown uses thumbnail-first quick launch', () => {
  const sceneBlock = topChromeSource.match(/data-feature-id="deck-scenes-thumbnail-quick-launch"[\s\S]*?Open Media Library/)?.[0] || '';

  assert.match(topChromeSource, /TOP_SCENE_TEMPLATE_QUICK_PADS/);
  assert.match(topChromeSource, /data-feature-id="deck-scenes-thumbnail-quick-launch"/);
  assert.match(topChromeSource, /data-feature-id="deck-scene-thumbnail-launch"/);
  assert.match(topChromeSource, /data-feature-id="deck-scenes-template-quick-pads"/);
  assert.match(sceneBlock, /onLaunchScenePreset\?\.\(preset\)/);
  assert.match(sceneBlock, /onQueueScenePreset\?\.\(preset\)/);
  assert.match(topChromeSource, /Tap preview to run/);
  assert.ok(!/Run Of Show/.test(sceneBlock), 'Top scene quick-launch cards should not carry the old Run Of Show button');
  assert.match(hostAppSource, /onAddQuickRunOfShowMoment=\{addQuickRunOfShowMoment\}/);
});

