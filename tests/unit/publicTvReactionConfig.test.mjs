import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  getTvReactionEmojiClass,
  getTvReactionLabel,
  getTvReactionLaneLeft,
  getTvReactionMotionSpec,
  getTvReactionThemeKey,
} from '../../src/apps/TV/publicTvReactionConfig.js';

test('Public TV reaction config preserves blossom presentation on the legacy money key', () => {
  assert.equal(getTvReactionLabel('money'), 'Bloom');
  assert.equal(getTvReactionThemeKey('money'), 'blossom');
  assert.match(getTvReactionEmojiClass('money'), /reaction-emoji-blossom/);

  const motion = getTvReactionMotionSpec({ type: 'money', id: 'alpha', index: 0 });
  assert.equal(motion.variant, 'blossom');
  assert.equal(motion.themeKey, 'blossom');
});

test('Public TV reaction config keeps unique motion identities for the major reaction types', () => {
  assert.equal(getTvReactionMotionSpec({ type: 'rocket', id: 'a', index: 0 }).variant, 'launch');
  assert.equal(getTvReactionMotionSpec({ type: 'diamond', id: 'a', index: 0 }).variant, 'prism');
  assert.equal(getTvReactionMotionSpec({ type: 'crown', id: 'a', index: 0 }).variant, 'royal');
  assert.equal(getTvReactionMotionSpec({ type: 'drink', id: 'a', index: 0 }).variant, 'cheers');
  assert.equal(getTvReactionMotionSpec({ type: 'fire', id: 'a', index: 0 }).variant, 'ember');
  assert.equal(getTvReactionMotionSpec({ type: 'heart', id: 'a', index: 0 }).variant, 'heart');
  assert.equal(getTvReactionMotionSpec({ type: 'clap', id: 'a', index: 0 }).variant, 'applause');
});

test('Public TV reaction config keeps deterministic lane placement and safe fallbacks', () => {
  assert.equal(
    getTvReactionLaneLeft({ type: 'rocket', id: 'same', index: 1, wide: true }),
    getTvReactionLaneLeft({ type: 'rocket', id: 'same', index: 1, wide: true }),
  );

  assert.equal(getTvReactionLabel(''), 'Reaction');
  assert.equal(getTvReactionThemeKey('unknown_custom'), 'default');
  assert.match(getTvReactionEmojiClass('unknown_custom'), /animate-float/);
  assert.match(
    getTvReactionMotionSpec({ type: 'unknown_custom', id: 'fallback', index: 0 }).variant,
    /^(drift-left|drift-right|hover|bounce)$/,
  );
});
