import { normalizeAudienceBrandTheme } from '../../lib/audienceBrandTheme.js';
import { normalizeAudienceFeatureAccess } from '../../lib/audienceFeatureAccess.js';

const DEFAULT_ROOM_CODE = 'DEMOAUD';
const AAHF_EVENT_PROFILE_ID = 'aahf_2026_kickoff';
const AAHF_LOGO_URL = '/images/marketing/aahf-combined-badge-clean.png';
const AAHF_AUDIENCE_BRAND_THEME = normalizeAudienceBrandTheme({
    appTitle: 'AAHF Festival',
    primaryColor: '#E05A44',
    secondaryColor: '#F4C94A',
    accentColor: '#8F2D2A',
});

const buildBaseRoom = ({ roomCode = DEFAULT_ROOM_CODE, shellVariant = 'classic', activeMode = 'karaoke' } = {}) => ({
    roomCode,
    hostName: 'AAHF Host',
    activeMode,
    lightMode: 'off',
    audienceShellVariant: shellVariant,
    audienceFeatureAccess: normalizeAudienceFeatureAccess({}),
    showScoring: true,
    showFameLevel: true,
    queueSettings: {
        limitMode: 'none',
        limitCount: 0,
        rotation: 'round_robin',
        firstTimeBoost: true
    },
    tipCrates: [],
    triviaQuestion: activeMode === 'trivia_pop'
        ? {
            id: 'trivia_demo_1',
            q: 'Which song always gets the room singing first?',
            options: ['Don’t Stop Believin’', 'Mr. Brightside', 'Dancing Queen'],
            correctIndex: 0,
            status: 'active',
            launchedAt: Date.now()
        }
        : null,
});

const buildAahfRoom = ({ roomCode = DEFAULT_ROOM_CODE, shellVariant = 'streamlined', activeMode = 'karaoke' } = {}) => ({
    ...buildBaseRoom({ roomCode, shellVariant, activeMode }),
    eventProfileId: AAHF_EVENT_PROFILE_ID,
    eventProfileLabel: 'AAHF Kick-Off',
    eventProfileVersion: 1,
    logoUrl: AAHF_LOGO_URL,
    audienceBrandTheme: AAHF_AUDIENCE_BRAND_THEME,
    eventCredits: {
        enabled: true,
        presetId: 'aahf_kickoff',
        eventId: 'aahf-2026-kickoff',
        eventLabel: 'AAHF Karaoke Kick-Off',
        sourceProvider: 'givebutter',
        sourceCampaignCode: 'aahf_kickoff',
        supportProvider: 'givebutter',
        supportLabel: 'Support AAHF Festival',
        supportUrl: 'https://givebutter.com/aahf-kickoff',
        supportCampaignCode: 'aahf_kickoff',
        supportPoints: 0,
        supportBadge: true,
        supportOffers: [
            { id: 'solo_boost', label: 'Solo Boost', amount: 5, points: 1200, rewardScope: 'buyer', awardBadge: false, supportUrl: 'https://givebutter.com/aahf-kickoff', supportCampaignCode: 'aahf_kickoff' },
            { id: 'stage_starter', label: 'Stage Starter', amount: 10, points: 3000, rewardScope: 'buyer', awardBadge: false, supportUrl: 'https://givebutter.com/aahf-kickoff', supportCampaignCode: 'aahf_kickoff' },
            { id: 'headliner', label: 'Headliner', amount: 20, points: 7500, rewardScope: 'buyer', awardBadge: false, supportUrl: 'https://givebutter.com/aahf-kickoff', supportCampaignCode: 'aahf_kickoff' },
        ],
        audienceAccessMode: 'email_or_donation',
        supportCelebrationStyle: 'moneybags_burst',
    },
    roomPlan: {
        startsAtLocal: '2026-05-01T19:00',
        startsAtMs: Date.parse('2026-05-01T19:00:00-07:00'),
    },
});

const buildAahfJoinFixture = ({ roomCode = DEFAULT_ROOM_CODE, showAbout = false, showPhoneModal = false } = {}) => ({
    ...buildBaseFixture({ shellVariant: 'streamlined', activeMode: 'karaoke' }),
    room: buildAahfRoom({ roomCode, shellVariant: 'streamlined', activeMode: 'karaoke' }),
    user: null,
    profile: null,
    termsAccepted: true,
    showAbout,
    showPhoneModal,
    form: {
        name: '',
        emoji: '🎤',
    },
});

const buildBaseSongs = () => ([
    {
        id: 'performing_1',
        roomCode: DEFAULT_ROOM_CODE,
        status: 'performing',
        singerUid: 'fixture_user',
        singerName: 'Taylor Demo',
        songTitle: 'Dreams',
        title: 'Dreams',
        artist: 'Fleetwood Mac',
        emoji: '🎤',
        hypeScore: 88,
        applauseScore: 91,
    },
    {
        id: 'requested_1',
        roomCode: DEFAULT_ROOM_CODE,
        status: 'requested',
        singerUid: 'fixture_friend',
        singerName: 'Jordan',
        songTitle: 'Valerie',
        title: 'Valerie',
        artist: 'Amy Winehouse',
        emoji: '✨',
    },
    {
        id: 'requested_2',
        roomCode: DEFAULT_ROOM_CODE,
        status: 'requested',
        singerUid: 'fixture_user',
        singerName: 'Taylor Demo',
        songTitle: 'Since U Been Gone',
        title: 'Since U Been Gone',
        artist: 'Kelly Clarkson',
        emoji: '🔥',
    }
]);

const buildBaseUsers = () => ([
    { uid: 'fixture_user', name: 'Taylor Demo', avatar: '🎤', totalEmojis: 15, points: 640, isVip: true, totalFamePoints: 1800, currentLevel: 4 },
    { uid: 'fixture_friend', name: 'Jordan', avatar: '✨', totalEmojis: 9, points: 420, isVip: false, totalFamePoints: 900, currentLevel: 3 },
    { uid: 'fixture_guest', name: 'Riley', avatar: '🎉', totalEmojis: 4, points: 210, isVip: false, totalFamePoints: 300, currentLevel: 1 }
]);

const buildBaseFixture = ({ shellVariant = 'classic', activeMode = 'karaoke' } = {}) => ({
    room: buildBaseRoom({ shellVariant, activeMode }),
    songs: buildBaseSongs(),
    allUsers: buildBaseUsers(),
    user: { uid: 'fixture_user', name: 'Taylor Demo', avatar: '🎤', isVip: true },
    profile: { uid: 'fixture_user', name: 'Taylor Demo', avatar: '🎤', vipLevel: 1, totalFamePoints: 1800, currentLevel: 4, points: 640 },
    tab: 'home',
    songsTab: 'requests',
    socialTab: 'lounge',
    profileSubTab: 'overview',
    catalogSearchOpen: false,
    manualRequestComposerOpen: false,
    showReturningPrompt: false,
    termsAccepted: true,
    stageHomePanelExpanded: true,
    localReactions: [],
});

export const QA_AUDIENCE_FIXTURE_IDS = Object.freeze([
    'classic-home',
    'streamlined-home',
    'streamlined-aahf-home',
    'streamlined-aahf-join',
    'streamlined-aahf-join-about',
    'streamlined-aahf-join-access',
    'classic-trivia',
    'streamlined-trivia',
]);

export const buildQaAudienceFixture = (fixtureId = '', { roomCode = DEFAULT_ROOM_CODE } = {}) => {
    const safeId = String(fixtureId || '').trim().toLowerCase();
    if (!safeId) return null;

    if (safeId === 'classic-home') {
        return {
            ...buildBaseFixture({ shellVariant: 'classic', activeMode: 'karaoke' }),
            room: {
                ...buildBaseRoom({ roomCode, shellVariant: 'classic', activeMode: 'karaoke' }),
            },
        };
    }

    if (safeId === 'streamlined-home') {
        return {
            ...buildBaseFixture({ shellVariant: 'streamlined', activeMode: 'karaoke' }),
            room: {
                ...buildBaseRoom({ roomCode, shellVariant: 'streamlined', activeMode: 'karaoke' }),
            },
        };
    }

    if (safeId === 'streamlined-aahf-home') {
        return {
            ...buildBaseFixture({ shellVariant: 'streamlined', activeMode: 'karaoke' }),
            room: buildAahfRoom({ roomCode, shellVariant: 'streamlined', activeMode: 'karaoke' }),
        };
    }

    if (safeId === 'streamlined-aahf-join') {
        return buildAahfJoinFixture({ roomCode });
    }

    if (safeId === 'streamlined-aahf-join-about') {
        return buildAahfJoinFixture({ roomCode, showAbout: true });
    }

    if (safeId === 'streamlined-aahf-join-access') {
        return buildAahfJoinFixture({ roomCode, showPhoneModal: true });
    }

    if (safeId === 'classic-trivia') {
        return {
            ...buildBaseFixture({ shellVariant: 'classic', activeMode: 'trivia_pop' }),
            room: {
                ...buildBaseRoom({ roomCode, shellVariant: 'classic', activeMode: 'trivia_pop' }),
            },
        };
    }

    if (safeId === 'streamlined-trivia') {
        return {
            ...buildBaseFixture({ shellVariant: 'streamlined', activeMode: 'trivia_pop' }),
            room: {
                ...buildBaseRoom({ roomCode, shellVariant: 'streamlined', activeMode: 'trivia_pop' }),
            },
        };
    }

    return null;
};
