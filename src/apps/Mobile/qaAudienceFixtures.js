import { normalizeAudienceBrandTheme } from '../../lib/audienceBrandTheme.js';

const DEFAULT_ROOM_CODE = 'DEMOAUD';
const AAHF_EVENT_PROFILE_ID = 'aahf_2026_kickoff';
const AAHF_LOGO_URL = '/images/marketing/karaoke-kickoff-logo-simple.png';
const AAHF_AUDIENCE_BRAND_THEME = normalizeAudienceBrandTheme({
    appTitle: 'AAHF Karaoke',
    primaryColor: '#FF4FA3',
    secondaryColor: '#1ED7FF',
    accentColor: '#FACC15',
});

const buildBaseRoom = ({ roomCode = DEFAULT_ROOM_CODE, shellVariant = 'classic', activeMode = 'karaoke' } = {}) => ({
    roomCode,
    hostName: 'AAHF Host',
    activeMode,
    lightMode: 'off',
    audienceShellVariant: shellVariant,
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
    roomPlan: {
        startsAtLocal: '2026-05-01T19:00',
        startsAtMs: Date.parse('2026-05-01T19:00:00-07:00'),
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
