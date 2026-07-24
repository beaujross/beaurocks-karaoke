import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    AUDIENCE_REACTION_UNLOCK_ACTIONS,
    resolveAudienceReactionSlotUnlock,
} from '../../src/apps/Mobile/lib/audienceReactionUnlockFlow.js';

test('slot 5 spends Points only when the Room balance can cover it', () => {
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 5,
        slotCount: 4,
        canAffordPoints: false,
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.openPoints);
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 5,
        slotCount: 4,
        canAffordPoints: true,
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.spendPoints);
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 5,
        slotCount: 5,
        canAffordPoints: true,
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.none);
});

test('slot 6 resolves its visible slot-5 prerequisite before account or BeauBucks prompts', () => {
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 6,
        slotCount: 4,
        signedIn: false,
        walletStatus: 'idle',
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.openPoints);
});

test('slot 6 then routes through account, wallet refresh, balance, and purchase states', () => {
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 6,
        slotCount: 5,
        signedIn: false,
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.openBeauBucks);
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 6,
        slotCount: 5,
        signedIn: true,
        walletStatus: 'loading',
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.refreshBeauBucks);
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 6,
        slotCount: 5,
        signedIn: true,
        walletStatus: 'ready',
        beauBucksBalance: 99,
        beauBucksCost: 100,
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.openBeauBucks);
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 6,
        slotCount: 5,
        signedIn: true,
        walletStatus: 'ready',
        beauBucksBalance: 100,
        beauBucksCost: 100,
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.purchaseBeauBucks);
});

test('unavailable or already-unlocked slot requests do nothing', () => {
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 6,
        slotCount: 6,
        sixthSlotAvailable: true,
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.none);
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 6,
        slotCount: 5,
        sixthSlotAvailable: false,
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.none);
    assert.equal(resolveAudienceReactionSlotUnlock({
        slotNumber: 7,
        slotCount: 5,
    }), AUDIENCE_REACTION_UNLOCK_ACTIONS.none);
});
