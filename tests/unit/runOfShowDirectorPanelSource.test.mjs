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

test('run-of-show presets include a standalone leaderboard stack moment', () => {
  assert.match(source, /id: 'leaderboard_stack'/);
  assert.match(source, /label: 'Leaderboard Stack'/);
  assert.match(source, /activeScreen: 'leaderboard_stack'/);
  assert.match(source, /takeoverScene: 'leaderboard_stack'/);
  assert.match(source, /\{ value: 'leaderboard_stack', label: 'Leaderboard Stack' \}/);
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

test('run-of-show performance builder uses one primary performance setup path', () => {
  assert.match(source, /const getEditablePerformerMode = \(performerMode = ''\) => \(/);
  assert.match(source, /const getPerformerModeLabel = \(performerMode = ''\) => \(/);
  assert.match(source, /Performance Setup/);
  assert.match(source, /Setup Progress/);
  assert.match(source, /Continue To Track/);
  assert.match(source, /Step 1/);
  assert.match(source, /Step 2/);
  assert.match(source, /Step 3 - Track Setup/);
  assert.match(source, /Advanced Performance Settings/);
  assert.match(source, /Assigned Performance/);
  assert.match(source, /Performer name or label, like Performance TBD/);
  assert.match(source, /Suggested Matches/);
  assert.doesNotMatch(source, /Fast Assign/);
  assert.doesNotMatch(source, /Quick editor/);
  assert.doesNotMatch(source, /More Slot Controls/);
  assert.doesNotMatch(source, /Placeholder mode is on\./);
  assert.doesNotMatch(source, />Performance Prep</);
});

test('run-of-show director panel supports csv show-sheet import for rehearsal planning', () => {
  assert.match(source, /previewRunOfShowCsvImport/);
  assert.match(source, /Import CSV/);
  assert.match(source, /Upload CSV/);
  assert.match(source, /Append To Show/);
  assert.match(source, /Replace Show/);
  assert.match(source, /Blocked rows stay in the plan/);
  assert.match(source, /CSV only for May 1 prep/);
});
