const normalizeToken = (value = '') => String(value || '').trim().toLowerCase();

export const isBeauBucksEconomy = (config = {}) => {
    if (config?.enabled !== true) return false;
    const presetId = normalizeToken(config?.presetId);
    const eventId = normalizeToken(config?.eventId);
    if (['beaubucks', 'ticketed_event'].includes(presetId)) return true;
    if (['beaubucks', 'ticketed_event'].includes(eventId)) return true;
    const hasSupport = Boolean(String(config?.supportLabel || config?.supportProvider || config?.supportUrl || '').trim())
        || Number(config?.supportPoints || 0) > 0
        || (Array.isArray(config?.supportOffers) && config.supportOffers.length > 0);
    return hasSupport;
};

export const getRoomCurrencyPresentation = (config = {}) => {
    const premium = isBeauBucksEconomy(config);
    return premium
        ? {
            id: 'beaubucks',
            premium: true,
            singular: 'BeauBuck',
            plural: 'BeauBucks',
            shortLabel: 'BB',
            balanceLabel: 'BeauBucks balance',
            explanation: 'Premium room value for boosts, voting, ticket allocation, and support.',
        }
        : {
            id: 'points',
            premium: false,
            singular: 'point',
            plural: 'points',
            shortLabel: 'PTS',
            balanceLabel: 'Participation points',
            explanation: 'Playful, non-cash points earned through games, reactions, and host rewards.',
        };
};
