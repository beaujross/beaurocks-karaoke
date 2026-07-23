const token = (value = '') => String(value || '').trim().toLowerCase();

export const CORE_REACTION_TYPES = Object.freeze(['fire', 'heart', 'clap', 'drink']);

export const buildReactionLoadout = ({
    reactions = [],
    slotCount = 4,
    equippedBonusTypes = [],
    isUnlocked = () => false,
} = {}) => {
    const bonusCapacity = Math.max(0, Math.min(2, Number(slotCount || 0) - CORE_REACTION_TYPES.length));
    if (!bonusCapacity) return [...CORE_REACTION_TYPES];
    const eligible = reactions
        .map((reaction) => token(reaction?.id))
        .filter((id) => id && !CORE_REACTION_TYPES.includes(id) && isUnlocked(id));
    const preferred = [...new Set((Array.isArray(equippedBonusTypes) ? equippedBonusTypes : []).map(token))]
        .filter((id) => eligible.includes(id));
    const fallback = eligible.filter((id) => !preferred.includes(id));
    return [...CORE_REACTION_TYPES, ...preferred, ...fallback].slice(0, CORE_REACTION_TYPES.length + bonusCapacity);
};

export const equipBonusReaction = ({ current = [], reactionType = '', capacity = 0 } = {}) => {
    const safeType = token(reactionType);
    const safeCapacity = Math.max(0, Math.min(2, Number(capacity || 0)));
    if (!safeType || !safeCapacity || CORE_REACTION_TYPES.includes(safeType)) return [];
    const without = (Array.isArray(current) ? current : []).map(token).filter((id) => id && id !== safeType);
    return [safeType, ...without].slice(0, safeCapacity);
};
