import { getRoomCurrencyPresentation } from './roomCurrencyPresentation';

const wholeNumber = (value = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

export const getRoomEconomySummary = (config = {}) => {
    const enabled = config?.enabled === true;
    const currency = getRoomCurrencyPresentation(config);
    const startingBalance = wholeNumber(config?.generalAdmissionPoints);
    const refillAmount = wholeNumber(config?.timedLobbyPoints);
    const refillIntervalMin = Math.max(1, wholeNumber(config?.timedLobbyIntervalMin) || 10);
    const refillCap = wholeNumber(config?.timedLobbyMaxPerGuest);
    const refillEnabled = enabled && config?.timedLobbyEnabled === true && refillAmount > 0;
    const supportLabel = String(config?.supportLabel || '').trim();
    const supportConnected = enabled && (
        Boolean(String(config?.supportProvider || config?.supportUrl || '').trim())
        || wholeNumber(config?.supportPoints) > 0
        || (Array.isArray(config?.supportOffers) && config.supportOffers.length > 0)
    );
    const warnings = [];

    if (enabled && currency.premium && startingBalance === 0) warnings.push('Set a starting BeauBucks balance.');
    if (enabled && config?.timedLobbyEnabled === true && refillAmount === 0) warnings.push('Automatic refill is on, but its amount is zero.');
    if (refillEnabled && refillCap > 0 && refillCap < refillAmount) warnings.push('Refill cap is lower than one refill.');
    if (supportConnected && !supportLabel) warnings.push('Add a clear guest-facing support label.');

    return {
        enabled,
        currency,
        startingBalance,
        refill: {
            enabled: refillEnabled,
            amount: refillAmount,
            intervalMin: refillIntervalMin,
            cap: refillCap,
        },
        support: {
            connected: supportConnected,
            label: supportLabel,
        },
        cards: [
            {
                id: 'receive',
                eyebrow: 'Guests receive',
                value: enabled ? `${startingBalance} ${currency.plural}` : 'No room wallet',
                note: enabled ? 'Granted when a guest enters the room.' : 'Participation stays free-form.',
            },
            {
                id: 'earn',
                eyebrow: 'They can earn more',
                value: refillEnabled ? `${refillAmount} every ${refillIntervalMin} min` : 'No automatic refill',
                note: refillEnabled
                    ? `${refillCap > 0 ? `Capped at ${refillCap} ${currency.plural} per guest.` : 'No automatic refill cap.'}`
                    : 'Host awards and configured activities can still add value.',
            },
            {
                id: 'spend',
                eyebrow: 'Value points toward',
                value: supportConnected ? (supportLabel || 'Supporting this room') : (currency.premium ? 'Premium room interactions' : 'Voting, boosts, and play'),
                note: supportConnected ? 'A support destination is connected.' : 'No donation or external checkout is connected.',
            },
        ],
        warnings,
    };
};
