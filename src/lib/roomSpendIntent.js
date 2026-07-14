import { getRoomCurrencyPresentation } from './roomCurrencyPresentation';

export const ROOM_SPEND_INTENTS = Object.freeze({
    play: 'play',
    influence: 'influence',
    performer: 'performer',
    support: 'support',
});

export const getRoomSpendIntentGuide = (config = {}) => {
    const currency = getRoomCurrencyPresentation(config);
    const supportConnected = config?.enabled === true && Boolean(
        String(config?.supportProvider || config?.supportUrl || config?.supportEmbedUrl || '').trim()
        || (Array.isArray(config?.supportOffers) && config.supportOffers.length > 0)
    );
    const valueName = currency.premium ? 'BeauBucks' : 'points';

    return {
        currency,
        supportConnected,
        items: [
            {
                id: ROOM_SPEND_INTENTS.play,
                label: 'Play',
                icon: 'fa-sparkles',
                detail: `Reactions and game actions use ${valueName}. They are digital play, not a cash payment.`,
                financial: false,
            },
            {
                id: ROOM_SPEND_INTENTS.influence,
                label: 'Influence',
                icon: 'fa-check-to-slot',
                detail: `Votes and boosts can shape tonight's room. Spending ${valueName} is not itself a donation.`,
                financial: false,
            },
            {
                id: ROOM_SPEND_INTENTS.performer,
                label: 'Cheer for a performer',
                icon: 'fa-microphone-lines',
                detail: `${valueName} can add to performer scores and rankings; they do not become a cash payout by default.`,
                financial: false,
            },
            {
                id: ROOM_SPEND_INTENTS.support,
                label: supportConnected ? 'Donate real money' : 'Donations not connected',
                icon: 'fa-hand-holding-heart',
                detail: supportConnected
                    ? 'The external checkout is the real-money support step. Its amount and recipient are shown before you leave BeauRocks.'
                    : 'This room has no external financial checkout connected.',
                financial: supportConnected,
            },
        ],
    };
};
