const assert = require('node:assert/strict');
const catalog = require('../../functions/lib/reactionCatalog.json');
const { getReactionDefinition, getReactionPointCosts, isReactionUnlocked, listReactionDefinitions } = require('../../functions/lib/reactionCatalog');

test('every reaction transfers points to score one-for-one', () => {
  const reactions = listReactionDefinitions();
  assert.ok(reactions.length >= 16);
  reactions.forEach((reaction) => assert.equal(reaction.scoreValue, reaction.pointCost, reaction.id));
  assert.deepEqual(getReactionPointCosts().clap, 2);
});

test('premium reactions mirror free scoring power and only add presentation', () => {
  listReactionDefinitions().filter((reaction) => reaction.premiumFlourish).forEach((reaction) => {
    const mirror = getReactionDefinition(reaction.mirrorsPowerOf);
    assert.ok(mirror, reaction.id);
    assert.equal(reaction.scoreValue, mirror.scoreValue, reaction.id);
    assert.ok(reaction.cooldownMs >= mirror.cooldownMs, reaction.id);
  });
  assert.equal(catalog.premiumPolicy, 'premium_changes_presentation_not_scoring_efficiency');
});

test('Fame and premium unlocks require an account and their exact authority', () => {
  const diamond = getReactionDefinition('diamond');
  const tomato = getReactionDefinition('tomato');
  assert.equal(isReactionUnlocked({ reaction: diamond, accountEligible: true, fameLevel: 2 }), false);
  assert.equal(isReactionUnlocked({ reaction: diamond, accountEligible: true, fameLevel: 3 }), true);
  assert.equal(isReactionUnlocked({ reaction: tomato, accountEligible: true, entitlementIds: [] }), false);
  assert.equal(isReactionUnlocked({ reaction: tomato, accountEligible: true, entitlementIds: ['reaction_tomato_splash'] }), true);
});
