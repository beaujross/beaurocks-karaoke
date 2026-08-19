import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  getTvReactionEntranceKey,
  getTvReactionEmojiClass,
  getTvReactionLabel,
  getTvReactionLaneLeft,
  getTvReactionMotionSpec,
  getTvReactionThemeKey,
  selectTvReactionPresentation,
} from '../../src/apps/TV/publicTvReactionConfig.js';
import { REACTION_CATALOG } from '../../src/lib/reactionCatalog.js';

test('Public TV reaction config preserves blossom presentation on the legacy money key', () => {
  assert.equal(getTvReactionLabel('money'), 'Bloom');
  assert.equal(getTvReactionThemeKey('money'), 'blossom');
  assert.equal(getTvReactionThemeKey('tomato'), 'blossom');
  assert.equal(getTvReactionThemeKey('lightning'), 'fire');
  assert.equal(getTvReactionThemeKey('ufo'), 'rocket');
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
  assert.equal(getTvReactionMotionSpec({ type: 'tomato', id: 'a', index: 0 }).variant, 'tomato-splat');
  assert.equal(getTvReactionMotionSpec({ type: 'dragon', id: 'a', index: 0 }).variant, 'dragon-breath');
  assert.equal(getTvReactionMotionSpec({ type: 'ufo', id: 'a', index: 0 }).variant, 'ufo-beam');
});

test('every voting reaction has a unique entrance identity', () => {
  const entranceKeys = REACTION_CATALOG.map((reaction) => getTvReactionEntranceKey(reaction.id));
  assert.equal(entranceKeys.every(Boolean), true);
  assert.equal(new Set(entranceKeys).size, REACTION_CATALOG.length);
  REACTION_CATALOG.forEach((reaction) => {
    assert.equal(
      getTvReactionMotionSpec({ type: reaction.id, id: 'catalog-check', index: 0 }).variant,
      getTvReactionEntranceKey(reaction.id),
    );
  });
});

test('Public TV reaction config exposes differentiated themed path tuning', () => {
  const rocket = getTvReactionMotionSpec({ type: 'rocket', id: 'hero', index: 0 });
  const crown = getTvReactionMotionSpec({ type: 'crown', id: 'hero', index: 0 });
  const blossom = getTvReactionMotionSpec({ type: 'money', id: 'hero', index: 0 });
  const drink = getTvReactionMotionSpec({ type: 'drink', id: 'hero', index: 0 });
  const heart = getTvReactionMotionSpec({ type: 'heart', id: 'hero', index: 0 });
  const ember = getTvReactionMotionSpec({ type: 'fire', id: 'hero', index: 0 });
  const applause = getTvReactionMotionSpec({ type: 'clap', id: 'hero', index: 0 });
  const prism = getTvReactionMotionSpec({ type: 'diamond', id: 'hero', index: 0 });

  assert.ok(rocket.entryY > crown.entryY);
  assert.ok(rocket.riseY > blossom.riseY);
  assert.ok(rocket.spinDeg > heart.spinDeg);
  assert.ok(Math.abs(drink.entryX) > Math.abs(heart.entryX));
  assert.ok(blossom.swayX > crown.swayX);
  assert.ok(ember.swayY > heart.swayY);
  assert.ok(applause.swayX > crown.swayX);
  assert.ok(prism.spinDeg > crown.spinDeg);
  assert.ok(rocket.exitScale < prism.exitScale);
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

test('Public TV reaction presentation caps density and coalesces repeated taps without changing source events', () => {
  const source = Array.from({ length: 12 }, (_, index) => ({
    id: `reaction-${index}`,
    uid: index < 5 ? 'repeat-user' : `user-${index}`,
    userName: index < 5 ? 'Repeat User' : `User ${index}`,
    type: index < 5 ? 'heart' : (index % 2 ? 'fire' : 'clap'),
    createdAtMs: 10_000 - (index * 200),
    burstCount: 1,
  }));
  const presented = selectTvReactionPresentation(source, {
    maxVisible: 6,
    maxPerParticipant: 1,
    coalesceWindowMs: 1800,
  });

  assert.equal(presented.length, 6);
  assert.equal(presented.filter((reaction) => reaction.presentationParticipantKey === 'repeat-user').length, 1);
  assert.equal(presented.find((reaction) => reaction.uid === 'repeat-user')?.burstCount, 5);
  assert.equal(source[0].burstCount, 1, 'presentation coalescing must not mutate scored reaction events');
});
