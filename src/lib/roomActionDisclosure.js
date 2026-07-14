const normalizeIntent = (intent = '') => String(intent || '').trim().toLowerCase();

const INTENT_LABELS = Object.freeze({
    play: 'Digital play',
    influence: 'Room influence',
    performer: 'Performer score',
    support: 'Real money',
});

export const formatRoomActionDisclosure = ({
    intent = 'play',
    cost = 0,
    currencyLabel = 'PTS',
    free = false,
    externalCheckout = false,
} = {}) => {
    const label = INTENT_LABELS[normalizeIntent(intent)] || INTENT_LABELS.play;
    if (externalCheckout) return `${label} • external checkout`;
    if (free) return `${label} • FREE`;
    return `${label} • ${Math.max(0, Math.floor(Number(cost) || 0))} ${String(currencyLabel || 'PTS').trim() || 'PTS'}`;
};
