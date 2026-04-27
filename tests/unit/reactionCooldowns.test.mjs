import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  applyReactionCooldown,
  getReactionCooldownLabel,
  getReactionCooldownRemainingMs,
  isReactionCoolingDown,
} from '../../src/apps/Mobile/lib/reactionCooldowns.js';

test('reaction cooldown helpers isolate cooldown state per reaction button', () => {
  const nowMs = 10_000;
  const cooldowns = applyReactionCooldown({}, 'fire', nowMs, 1500);

  assert.equal(getReactionCooldownRemainingMs(cooldowns, 'fire', nowMs + 200), 1300);
  assert.equal(getReactionCooldownRemainingMs(cooldowns, 'heart', nowMs + 200), 0);
  assert.equal(isReactionCoolingDown(cooldowns, 'fire', nowMs + 200), true);
  assert.equal(isReactionCoolingDown(cooldowns, 'heart', nowMs + 200), false);
});

test('reaction cooldown label stays stable and readable for applause style countdowns', () => {
  const nowMs = 5_000;
  const cooldowns = applyReactionCooldown({}, 'clap', nowMs, 2200);

  assert.equal(getReactionCooldownLabel(cooldowns, 'clap', nowMs + 1000), '1.2s');
  assert.equal(getReactionCooldownLabel(cooldowns, 'heart', nowMs + 1000), '0.1s');
});
