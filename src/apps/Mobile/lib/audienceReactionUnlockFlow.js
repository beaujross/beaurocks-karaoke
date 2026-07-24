export const AUDIENCE_REACTION_UNLOCK_ACTIONS = Object.freeze({
    none: 'none',
    openPoints: 'open_points',
    spendPoints: 'spend_points',
    openBeauBucks: 'open_beaubucks',
    refreshBeauBucks: 'refresh_beaubucks',
    purchaseBeauBucks: 'purchase_beaubucks',
});

const normalizeSlotCount = (value = 4) => Math.max(4, Math.min(6, Number(value || 0) || 4));

export const resolveAudienceReactionSlotUnlock = ({
    slotNumber = 0,
    slotCount = 4,
    canAffordPoints = false,
    signedIn = false,
    walletStatus = 'idle',
    beauBucksBalance = 0,
    beauBucksCost = 0,
    sixthSlotAvailable = true,
} = {}) => {
    const safeSlotNumber = Number(slotNumber || 0);
    const safeSlotCount = normalizeSlotCount(slotCount);

    if (safeSlotNumber === 5) {
        if (safeSlotCount >= 5) return AUDIENCE_REACTION_UNLOCK_ACTIONS.none;
        return canAffordPoints
            ? AUDIENCE_REACTION_UNLOCK_ACTIONS.spendPoints
            : AUDIENCE_REACTION_UNLOCK_ACTIONS.openPoints;
    }

    if (safeSlotNumber !== 6 || safeSlotCount >= 6 || !sixthSlotAvailable) {
        return AUDIENCE_REACTION_UNLOCK_ACTIONS.none;
    }

    // Slot 6 is sequential. Resolve the visible slot-5 prerequisite before
    // asking the audience member to sign in or acquire BeauBucks.
    if (safeSlotCount < 5) return AUDIENCE_REACTION_UNLOCK_ACTIONS.openPoints;
    if (!signedIn) return AUDIENCE_REACTION_UNLOCK_ACTIONS.openBeauBucks;
    if (String(walletStatus || '').trim().toLowerCase() !== 'ready') {
        return AUDIENCE_REACTION_UNLOCK_ACTIONS.refreshBeauBucks;
    }

    const balance = Math.max(0, Number(beauBucksBalance || 0) || 0);
    const cost = Math.max(0, Number(beauBucksCost || 0) || 0);
    return balance >= cost
        ? AUDIENCE_REACTION_UNLOCK_ACTIONS.purchaseBeauBucks
        : AUDIENCE_REACTION_UNLOCK_ACTIONS.openBeauBucks;
};
