export const getReactionCooldownRemainingMs = (cooldownByType = {}, reactionKey = '', nowMs = Date.now()) => {
    const safeReactionKey = String(reactionKey || '').trim().toLowerCase();
    if (!safeReactionKey) return 0;
    const cooldownUntil = Number(cooldownByType?.[safeReactionKey] || 0);
    if (!cooldownUntil) return 0;
    return Math.max(0, cooldownUntil - Number(nowMs || 0));
};

export const isReactionCoolingDown = (cooldownByType = {}, reactionKey = '', nowMs = Date.now()) => (
    getReactionCooldownRemainingMs(cooldownByType, reactionKey, nowMs) > 0
);

export const getReactionCooldownLabel = (cooldownByType = {}, reactionKey = '', nowMs = Date.now()) => (
    `${Math.max(0.1, getReactionCooldownRemainingMs(cooldownByType, reactionKey, nowMs) / 1000).toFixed(1)}s`
);

export const applyReactionCooldown = (cooldownByType = {}, reactionKey = '', nowMs = Date.now(), cooldownMs = 0) => {
    const safeReactionKey = String(reactionKey || '').trim().toLowerCase();
    const safeCooldownMs = Math.max(0, Number(cooldownMs || 0) || 0);
    if (!safeReactionKey || !safeCooldownMs) return { ...(cooldownByType || {}) };
    return {
        ...(cooldownByType || {}),
        [safeReactionKey]: Number(nowMs || 0) + safeCooldownMs,
    };
};
