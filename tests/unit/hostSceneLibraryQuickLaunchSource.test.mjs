import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');

test('Host scene library makes thumbnails the primary quick-launch target', () => {
  assert.match(source, /data-feature-id="host-scene-thumbnail-launch"/);
  assert.match(source, /onClick=\{\(\) => onLaunchScenePreset\?\.\(preset\)\}/);
  assert.match(source, /Tap thumbnail to run live/);
  assert.match(source, /repeat\(auto-fill,minmax\(168px,1fr\)\)/);
});

test('Host scene library keeps compact actions but removes per-card Run Of Show button', () => {
  assert.match(source, /Queue Next In Show/);
  assert.match(source, />\s*Edit\s*</);
  assert.ok(!/Use In Run Of Show/.test(source));
});

test('Host scene library includes built-in template scene quick pads', () => {
  assert.match(source, /SCENE_LIBRARY_TEMPLATE_QUICK_PADS/);
  assert.match(source, /host-scene-template-quick-pads/);
  assert.match(source, /host_update/);
  assert.match(source, /how_to_join/);
  assert.match(source, /sponsor_spotlight/);
  assert.match(source, /trivia_break/);
  assert.match(source, /onAddQuickRunOfShowMoment\?\.\(template\.id\)/);
});