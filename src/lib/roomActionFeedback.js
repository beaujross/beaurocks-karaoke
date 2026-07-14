export const getReactionFeedback = ({
    cost = 0,
    currencyLabel = 'PTS',
    performerName = '',
    roomInfluence = false,
} = {}) => {
    const safeCost = Math.max(0, Math.floor(Number(cost) || 0));
    if (roomInfluence) return 'Room vote sent • FREE';
    const costLabel = safeCost > 0 ? `${safeCost} ${String(currencyLabel || 'PTS').trim() || 'PTS'} spent` : 'FREE';
    const safePerformer = String(performerName || '').trim();
    return safePerformer
        ? `Reaction sent • ${costLabel} • ${safePerformer}'s performer score increased`
        : `Reaction sent • ${costLabel}`;
};

export const getCheckoutLaunchFeedback = (providerLabel = 'External') => (
    `${String(providerLabel || 'External').trim() || 'External'} checkout opened • no payment is recorded until you complete it there`
);
