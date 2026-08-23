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

export const equipBonusReactionAtSlot = ({ current = [], reactionType = '', slotIndex = 0, capacity = 0 } = {}) => {
    const safeType = token(reactionType);
    const safeCapacity = Math.max(0, Math.min(2, Number(capacity || 0)));
    const targetIndex = Math.max(0, Math.min(safeCapacity - 1, Number(slotIndex || 0)));
    if (!safeType || !safeCapacity || CORE_REACTION_TYPES.includes(safeType)) return [];
    const next = [...new Set((Array.isArray(current) ? current : []).map(token))]
        .filter((id) => id && !CORE_REACTION_TYPES.includes(id))
        .slice(0, safeCapacity);
    const existingIndex = next.indexOf(safeType);
    if (existingIndex === targetIndex) return next;
    if (existingIndex >= 0 && targetIndex < next.length) {
        [next[existingIndex], next[targetIndex]] = [next[targetIndex], next[existingIndex]];
        return next;
    }
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    if (targetIndex < next.length) next[targetIndex] = safeType;
    else next.push(safeType);
    return next.slice(0, safeCapacity);
};
