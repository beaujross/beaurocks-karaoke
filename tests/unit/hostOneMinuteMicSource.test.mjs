import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');

test('HostQueueTab opens and resolves One-Minute Mic continue-or-rotate decisions', () => {
  assert.match(source, /AUDIENCE_DECISION_TYPES/);
  assert.match(source, /buildContinueOrRotateDecision/);
  assert.match(source, /oneMinuteMicEnabled/);
  assert.match(source, /performanceProgressionMode \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'one_minute_mic'/);
  assert.match(source, /oneMinuteMicOpeningWindowSec/);
  assert.match(source, /oneMinuteMicVoteWindowSec/);
  assert.match(source, /audienceDecision: buildContinueOrRotateDecision/);
  assert.match(source, /One-Minute Mic decision failed to open/);
  assert.match(source, /callFunction\('syncOneMinuteMicRoom'/);
  assert.match(source, /Wrapping with a quick fade/);
  assert.match(source, /Crowd unlocked the rest of the song\./);
});

test('HostQueueTab consumes backend One-Minute Mic rotate commands through the existing finish flow', () => {
  assert.match(source, /audienceAutomationCommandKeyRef/);
  assert.match(source, /room\?\.audienceAutomationCommand/);
  assert.match(source, /String\(command\?\.action \|\| ''\)\.trim\(\)\.toLowerCase\(\) !== 'finish_performance'/);
  assert.match(source, /handleFinishPerformance\(targetSongId\)/);
  assert.match(source, /status: 'consumed'/);
  assert.match(source, /consumedBy: 'host_runtime'/);
});
