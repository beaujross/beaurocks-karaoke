import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/RunOfShowDirectorPanel.jsx', 'utf8');
const autopilotSource = readFileSync('src/apps/Host/runOfShowAutopilot.js', 'utf8');

test('run-of-show director panel keeps host-facing copy free of mojibake', () => {
  assert.doesNotMatch(source, /[^\x00-\x7F]/);
  assert.doesNotMatch(autopilotSource, /[^\x00-\x7F]/);
});

test('run-of-show creator incorporates setup autopilot and dead-air bridge planning', () => {
  assert.match(source, /buildRunOfShowAutopilotPlan/);
  assert.match(source, /buildRunOfShowBufferPlan/);
  assert.match(source, /Known-good filler/);
  assert.match(autopilotSource, /Dead-Air Bridge/);
  assert.match(autopilotSource, /known-good browse songs/);
});
