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

test('run-of-show editor inputs force a dark text field surface even with browser autofill', () => {
  assert.match(source, /caret-white/);
  assert.match(source, /\[color-scheme:dark\]/);
  assert.match(source, /\[\&:-webkit-autofill\]:\[-webkit-text-fill-color:#fff\]/);
  assert.match(source, /\[\&:-webkit-autofill\]:shadow-\[inset_0_0_0px_1000px_rgba\(9,9,11,0\.96\)\]/);
});

test('run-of-show generator avoids placeholder trivia and WYR copy', () => {
  assert.doesNotMatch(source, /Quick room trivia check-in/);
  assert.doesNotMatch(source, /Crowd interaction moment/);
  assert.match(source, /modeKey: interactiveType === 'trivia_break' \? 'trivia_pop' : interactiveType === 'would_you_rather_break' \? 'wyr' : 'crowd_play'/);
});

test('run-of-show live HUD uses conveyor language and shows crowd pulse guidance', () => {
  assert.match(source, /Conveyor status/);
  assert.match(source, /Crowd Pulse/);
  assert.match(source, /Show Conveyor/);
  assert.match(source, /Conveyor Actions/);
  assert.match(source, /Open Issues/);
  assert.match(source, /Flighted/);
  assert.match(source, /Nothing is flighted yet\./);
  assert.match(source, /No scene is on deck yet\./);
  assert.doesNotMatch(source, /<div className="mr-2 text-\[10px\] uppercase tracking-\[0\.16em\] text-amber-100\/75">Open issues<\/div>/);
});

test('run-of-show performance builder uses one primary slot setup path', () => {
  assert.match(source, /const getEditablePerformerMode = \(performerMode = ''\) => \(/);
  assert.match(source, /const getPerformerModeLabel = \(performerMode = ''\) => \(/);
  assert.match(source, /Slot Setup/);
  assert.match(source, /Open Track Setup/);
  assert.match(source, /Advanced Slot Settings/);
  assert.match(source, /Named Slot/);
  assert.match(source, /Singer name or placeholder, like Singer TBD/);
  assert.doesNotMatch(source, /Fast Assign/);
  assert.doesNotMatch(source, /Quick editor/);
  assert.doesNotMatch(source, /More Slot Controls/);
  assert.doesNotMatch(source, /Placeholder mode is on\./);
});
