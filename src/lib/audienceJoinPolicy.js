export const AUDIENCE_JOIN_ACCESS_MODES = Object.freeze({
    anonymousAllowed: 'anonymous_allowed',
    accountRequired: 'account_required',
});

export const AUDIENCE_WELCOME_GRANT_MODES = Object.freeze({
    none: 'none',
    oncePerRoomPerDevice: 'once_per_room_per_device',
    oncePerRoomPerAccount: 'once_per_room_per_account',
});

const VALID_AUDIENCE_JOIN_ACCESS_MODES = new Set(Object.values(AUDIENCE_JOIN_ACCESS_MODES));
const VALID_AUDIENCE_WELCOME_GRANT_MODES = new Set(Object.values(AUDIENCE_WELCOME_GRANT_MODES));

export const deriveAudienceWelcomeGrantMode = (accessMode = '') => (
    String(accessMode || '').trim().toLowerCase() === AUDIENCE_JOIN_ACCESS_MODES.accountRequired
        ? AUDIENCE_WELCOME_GRANT_MODES.oncePerRoomPerAccount
        : AUDIENCE_WELCOME_GRANT_MODES.oncePerRoomPerDevice
);

export const normalizeAudienceJoinPolicy = (input = {}, fallback = {}) => {
    const fallbackAccessMode = VALID_AUDIENCE_JOIN_ACCESS_MODES.has(String(fallback?.accessMode || '').trim().toLowerCase())
        ? String(fallback.accessMode).trim().toLowerCase()
        : AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed;
    const accessMode = VALID_AUDIENCE_JOIN_ACCESS_MODES.has(String(input?.accessMode || '').trim().toLowerCase())
        ? String(input.accessMode).trim().toLowerCase()
        : fallbackAccessMode;

    const explicitWelcomeGrantMode = String(input?.welcomeGrantMode || '').trim().toLowerCase();
    const fallbackWelcomeGrantMode = String(fallback?.welcomeGrantMode || '').trim().toLowerCase();
    const welcomeGrantMode = VALID_AUDIENCE_WELCOME_GRANT_MODES.has(explicitWelcomeGrantMode)
        ? explicitWelcomeGrantMode
        : VALID_AUDIENCE_WELCOME_GRANT_MODES.has(fallbackWelcomeGrantMode)
            ? fallbackWelcomeGrantMode
            : deriveAudienceWelcomeGrantMode(accessMode);

    return {
        accessMode,
        welcomeGrantMode,
    };
};

export const AUDIENCE_JOIN_ACCESS_OPTIONS = Object.freeze([
    {
        id: AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed,
        label: 'Anonymous Allowed',
        description: 'Guests join with a name and emoji. Welcome bonus is limited per device.',
    },
    {
        id: AUDIENCE_JOIN_ACCESS_MODES.accountRequired,
        label: 'BeauRocks Account Required',
        description: 'Guests must continue with a BeauRocks account before joining the room.',
    },
]);
