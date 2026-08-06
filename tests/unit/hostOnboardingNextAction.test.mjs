import assert from 'node:assert/strict';
import { test } from 'vitest';
import { getHostOnboardingNextAction } from '../../src/apps/HostRelations/hostOnboardingNextActionModel.js';

const expectedActions = [
  ['invited', 'Invitation received', 'Set Up Host Profile', 'onboarding=1'],
  ['workspace_ready', 'Host identity ready', 'Create First Room', 'section=ops.room_setup'],
  ['first_room_complete', 'First Room created', 'Create Next Room', 'section=ops.room_setup'],
  ['repeat_room_complete', 'Returning Host', 'Open Host Panel', 'mode=host'],
];

test.each(expectedActions)('%s has one canonical next action', (currentStage, stageLabel, ctaLabel, hrefToken) => {
  const action = getHostOnboardingNextAction({ currentStage });
  assert.equal(action.currentStage, currentStage);
  assert.equal(action.stageLabel, stageLabel);
  assert.equal(action.ctaLabel, ctaLabel);
  assert.match(action.href, new RegExp(hrefToken.replace('.', '\\.')));
});

test('an unknown stage fails safely into the existing Host guide', () => {
  const action = getHostOnboardingNextAction({ currentStage: 'unexpected_stage' });
  assert.equal(action.currentStage, 'unexpected_stage');
  assert.equal(action.ctaLabel, 'Open Host Guide');
  assert.equal(action.href, '/hub?tab=help');
});
