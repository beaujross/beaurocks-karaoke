const text = (value = '') => String(value || '').trim().toLowerCase();

const MODE_LABELS = Object.freeze({
    trivia_pop: 'Trivia',
    trivia_reveal: 'Trivia',
    wyr: 'Would You Rather',
    wyr_reveal: 'Would You Rather',
    bingo: 'Bingo',
    doodle_oke: 'Doodle-oke',
    selfie_challenge: 'Selfie Challenge',
    karaoke_bracket: 'Sweet 16 Bracket',
    flappy_bird: 'Pitch Runner',
    vocal_challenge: 'Vocal Challenge',
    riding_scales: 'Riding Scales',
    team_pong: 'Team Pong',
    musical_moments: 'Musical Moments',
    volley_orb: 'Volley Orb',
    applause: 'Applause',
    applause_countdown: 'Applause',
    applause_result: 'Applause',
});

export const getAudienceGameMembershipLabel = ({ activeMode = '', lightMode = '' } = {}) => {
    const mode = text(activeMode);
    if (MODE_LABELS[mode]) return MODE_LABELS[mode];
    const light = text(lightMode);
    if (light && light !== 'off') return light === 'guitar' ? 'Guitar Mode' : light === 'strobe' ? 'Beat Drop' : light === 'storm' ? 'Storm Mode' : 'Live Room Moment';
    return 'Live Room Moment';
};

export const getAudienceGameMembershipGate = ({
    hasRoomUser = false,
    membershipResolved = false,
    isDemoFixture = false,
    takeoverKind = '',
    activeMode = '',
    lightMode = '',
} = {}) => {
    const visible = !isDemoFixture && !hasRoomUser && !!text(takeoverKind);
    if (!visible) return Object.freeze({ visible: false, state: 'hidden', modeLabel: '' });
    const modeLabel = getAudienceGameMembershipLabel({ activeMode, lightMode });
    if (!membershipResolved) {
        return Object.freeze({
            visible: true,
            state: 'connecting',
            modeLabel,
            headline: `Connecting you to ${modeLabel}`,
            detail: 'Checking whether this device is already part of the room.',
        });
    }
    return Object.freeze({
        visible: true,
        state: 'join',
        modeLabel,
        headline: `Join to play ${modeLabel}`,
        detail: 'Pick a name once. You will return directly to the live round.',
    });
};
