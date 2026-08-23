import assert from 'node:assert/strict';
import { buildReactionLoadout, equipBonusReaction, equipBonusReactionAtSlot } from '../../src/lib/reactionLoadout.js';

const reactions = ['clap', 'heart', 'fire', 'drink', 'rocket', 'star_power', 'crown'].map((id) => ({ id }));

test('reaction loadout always keeps the four clear core reactions', () => {
    assert.deepEqual(buildReactionLoadout({ reactions, slotCount: 4 }), ['fire', 'heart', 'clap', 'drink']);
});

test('reaction loadout fills only unlocked bonus slots and respects preference', () => {
    const unlocked = new Set(['rocket', 'star_power']);
    assert.deepEqual(buildReactionLoadout({
        reactions,
        slotCount: 6,
        equippedBonusTypes: ['star_power'],
        isUnlocked: (id) => unlocked.has(id),
    }), ['fire', 'heart', 'clap', 'drink', 'star_power', 'rocket']);
});

test('equipping a bonus reaction moves it to the first available bonus slot', () => {
    assert.deepEqual(equipBonusReaction({ current: ['rocket', 'crown'], reactionType: 'star_power', capacity: 2 }), ['star_power', 'rocket']);
});

test('equipping into a named bonus slot replaces that slot without shuffling the other choice', () => {
    assert.deepEqual(equipBonusReactionAtSlot({
        current: ['rocket', 'diamond'],
        reactionType: 'meteor',
        slotIndex: 0,
        capacity: 2,
    }), ['meteor', 'diamond']);
    assert.deepEqual(equipBonusReactionAtSlot({
        current: ['rocket', 'diamond'],
        reactionType: 'diamond',
        slotIndex: 0,
        capacity: 2,
    }), ['diamond', 'rocket']);
});
