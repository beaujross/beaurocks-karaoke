import reactionCatalog from '../../functions/lib/reactionCatalog.json' with { type: 'json' };

const token = (value = '') => String(value || '').trim().toLowerCase();
const buildEmoji = (codePoints = []) => String.fromCodePoint(...(Array.isArray(codePoints) ? codePoints : []));

export const REACTION_CATALOG = Object.freeze(Object.values(reactionCatalog.reactions || {}).map((reaction) => Object.freeze({
    ...reaction,
    id: token(reaction.id),
    emoji: buildEmoji(reaction.emojiCodePoints),
    pointCost: Math.max(0, Math.floor(Number(reaction.pointCost || 0))),
    scoreValue: Math.max(0, Math.floor(Number(reaction.scoreValue || 0))),
    cooldownMs: Math.max(0, Math.floor(Number(reaction.cooldownMs || 0))),
})));

export const getReactionDefinition = (reactionType = '') => (
    REACTION_CATALOG.find((reaction) => reaction.id === token(reactionType)) || null
);

export const getReactionCooldownMs = (reactionType = '', roomMinimumMs = 0) => Math.max(
    Math.max(0, Number(roomMinimumMs || 0) || 0),
    Number(getReactionDefinition(reactionType)?.cooldownMs || 0),
);

export const getReactionUnlockState = ({ reaction, accountEligible = false, fameLevel = 0, entitlementIds = [] } = {}) => {
    if (!reaction) return { unlocked: false, label: 'Unavailable' };
    const unlock = reaction.unlock || {};
    const owned = new Set((Array.isArray(entitlementIds) ? entitlementIds : []).map(token));
    if (unlock.type === 'free') return { unlocked: true, label: 'Starter' };
    if (unlock.type === 'account') return { unlocked: accountEligible, label: accountEligible ? 'Account' : 'Create account' };
    if (unlock.type === 'fame') {
        const unlocked = accountEligible && Number(fameLevel || 0) >= Number(unlock.level || 0);
        return { unlocked, label: unlocked ? `Fame ${unlock.level}` : `Reach Fame ${unlock.level}` };
    }
    if (unlock.type === 'entitlement') {
        const unlocked = accountEligible && owned.has(token(unlock.productId));
        return { unlocked, label: unlocked ? 'Owned' : 'BeauBucks' };
    }
    return { unlocked: false, label: 'Unavailable' };
};

export const REACTION_SCORE_POLICY = reactionCatalog.scorePolicy;
export const REACTION_PREMIUM_POLICY = reactionCatalog.premiumPolicy;
