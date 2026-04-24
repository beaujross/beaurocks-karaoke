import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildRunOfShowAutopilotPlan,
  buildRunOfShowBufferPlan,
  buildRunOfShowGeneratorSeedFromMissionControl,
  getRunOfShowAssistLevelForPolicy,
} from '../../src/apps/Host/runOfShowAutopilot.js';

test('runOfShowAutopilot maps draft automation presets to setup assist levels', () => {
  assert.equal(getRunOfShowAssistLevelForPolicy('hands_on'), 'manual_first');
  assert.equal(getRunOfShowAssistLevelForPolicy('balanced'), 'smart_assist');
  assert.equal(getRunOfShowAssistLevelForPolicy('autopilot'), 'autopilot_first');
});

test('runOfShowAutopilot uses the same dead-air filler modes as room setup', () => {
  const balanced = buildRunOfShowAutopilotPlan({
    automationPresetId: 'balanced',
    performanceCount: 10,
  });
  assert.equal(balanced.deadAirFiller.mode, 'suggest');
  assert.equal(balanced.flowNodes.some((node) => node.label === 'Recovery Suggestions'), true);
  assert.equal(balanced.deadAirFiller.songs.length > 0, true);

  const autopilot = buildRunOfShowAutopilotPlan({
    automationPresetId: 'autopilot',
    performanceCount: 12,
  });
  assert.equal(autopilot.deadAirFiller.mode, 'auto_fill');
  assert.equal(autopilot.flowNodes.some((node) => node.label === 'Dead-Air Bridge'), true);
});

test('runOfShowAutopilot turns generated buffers into explicit dead-air bridge blocks', () => {
  const buffer = buildRunOfShowBufferPlan({
    config: { automationPresetId: 'autopilot' },
    durationSec: 30,
    index: 1,
  });

  assert.equal(buffer.title, 'Dead-Air Bridge');
  assert.equal(buffer.plannedDurationSec, 30);
  assert.match(buffer.notes, /known-good browse songs/);
  assert.equal(buffer.presentationPlan.publicTvTakeoverEnabled, true);
  assert.equal(buffer.presentationPlan.headline, 'Dead-Air Bridge');

  const manual = buildRunOfShowBufferPlan({
    config: { automationPresetId: 'hands_on' },
    durationSec: 30,
    index: 2,
  });
  assert.equal(manual.title, 'Recovery Buffer 2');
  assert.equal(manual.notes, 'Use this if the room needs a timing reset.');
});

test('runOfShowAutopilot seeds the show creator from persisted mission setup', () => {
  assert.deepEqual(
    buildRunOfShowGeneratorSeedFromMissionControl({
      setupDraft: {
        assistLevel: 'autopilot_first',
        archetype: 'competition',
      },
    }),
    {
      automationPresetId: 'autopilot',
      format: 'competition',
    }
  );

  assert.deepEqual(
    buildRunOfShowGeneratorSeedFromMissionControl({
      setupDraft: {
        assistLevel: 'smart_assist',
        spotlightMode: 'trivia_pop',
      },
    }),
    {
      automationPresetId: 'balanced',
      format: 'mixed_variety',
    }
  );
});
