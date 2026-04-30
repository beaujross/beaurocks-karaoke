import { getTvReactionLaneLeft, getTvReactionMotionSpec } from "./publicTvReactionConfig.js";

export const FIXED_QA_TV_NOW_MS = 1763503200000;
const AAHF_EVENT_PROFILE_ID = 'aahf_2026_kickoff';
const AAHF_LOGO_URL = '/images/marketing/aahf-combined-badge-clean.png';
const GENERIC_LOGO_URL = '/images/logo-library/beaurocks-logo-neon trasnparent.png';
const QA_REACTION_TYPES = Object.freeze(['rocket', 'diamond', 'crown', 'money', 'drink', 'fire', 'heart', 'clap']);
const QA_REACTION_USERS = Object.freeze([
    { userName: 'Avery', avatar: '🎤' },
    { userName: 'Mika', avatar: '🎧' },
    { userName: 'Jules', avatar: '🎷' },
    { userName: 'Nova', avatar: '🪩' },
    { userName: 'Kai', avatar: '🥁' },
    { userName: 'Rin', avatar: '🎸' },
    { userName: 'Skye', avatar: '🎶' },
    { userName: 'Paz', avatar: '✨' },
]);

export const QA_TV_VISUAL_SCENARIOS = Object.freeze([
    {
        id: 'generic-preview-intro',
        roomCode: 'DEMOBR',
        expectedTexts: ['Preview Mode', 'Intro', 'Welcome To BeauRocks'],
    },
    {
        id: 'generic-live-announcement',
        roomCode: 'DEMOBR',
        expectedTexts: ['House Announcement', 'Karaoke Starts In Five', 'Show graphics live on Public TV'],
    },
    {
        id: 'preview-intro',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Preview Mode', 'Intro', 'Welcome To AAHF'],
    },
    {
        id: 'preview-wyr',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Preview Mode', 'Pick A Side', 'WYR'],
    },
    {
        id: 'live-announcement',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['House Announcement', 'Talent Showcase Starts In Five', 'Show graphics live on Public TV'],
    },
    {
        id: 'live-closing',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Closing Moment', 'Thank You For Singing', 'Show graphics live on Public TV'],
    },
    {
        id: 'reaction-showcase',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Avery', 'Bloom', 'Royal'],
    },
    {
        id: 'support-host-rain',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['DJ Beau made it rain', 'for all lobby members'],
    },
    {
        id: 'support-purchase-rain',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Maya boosted the room', 'Room support'],
    },
]);

const buildBaseRoom = (roomCode = 'DEMOAAHF', overrides = {}) => ({
    activeMode: 'karaoke',
    hostName: 'AAHF Host',
    roomCode,
    eventProfileId: AAHF_EVENT_PROFILE_ID,
    eventProfileLabel: 'AAHF Kick-Off',
    eventProfileVersion: 1,
    logoUrl: AAHF_LOGO_URL,
    audienceBrandTheme: {
        appTitle: 'AAHF Festival',
        primaryColor: '#E05A44',
        secondaryColor: '#F4C94A',
        accentColor: '#8F2D2A',
    },
    ...overrides,
});

const buildReactionShowcase = (nowMs = FIXED_QA_TV_NOW_MS) => (
    QA_REACTION_TYPES.map((type, index) => {
        const motion = getTvReactionMotionSpec({ type, id: `qa-${type}`, index });
        const person = QA_REACTION_USERS[index] || QA_REACTION_USERS[0];
        return {
            id: `qa-reaction-${type}`,
            type,
            userName: person.userName,
            user: person.userName,
            avatar: person.avatar,
            left: getTvReactionLaneLeft({ type, id: `qa-${type}`, index }),
            motionVariant: motion.variant,
            motionDurationMs: motion.durationMs,
            motionDriftX: motion.driftX,
            motionRiseY: motion.riseY,
            motionRotateDeg: motion.rotateDeg,
            motionScaleBoost: motion.scaleBoost + (index === 0 ? 0.08 : 0),
            arrivalGlowStrength: index === 0 ? 1 : 0.72,
            burstCount: 1,
            createdAtMs: Number(nowMs || FIXED_QA_TV_NOW_MS) - 250,
        };
    })
);

export const buildQaTvFixture = (fixtureId = '', { roomCode = 'DEMOAAHF', nowMs = FIXED_QA_TV_NOW_MS } = {}) => {
    const safeId = String(fixtureId || '').trim().toLowerCase();
    const room = buildBaseRoom(roomCode);
    const genericRoom = buildBaseRoom(roomCode, {
        hostName: 'BeauRocks Host',
        roomCode,
        eventProfileId: '',
        eventProfileLabel: 'BeauRocks Night',
        logoUrl: GENERIC_LOGO_URL,
        audienceBrandTheme: {
            appTitle: 'BeauRocks Karaoke',
            primaryColor: '#00C4D9',
            secondaryColor: '#FF7AC8',
            accentColor: '#15091f',
        },
    });

    if (safeId === 'generic-preview-intro') {
        return {
            started: true,
            room: {
                ...genericRoom,
                tvPreviewOverlay: {
                    active: true,
                    preview: true,
                    itemId: 'intro_generic_1',
                    type: 'intro',
                    title: 'Introductions',
                    headline: 'Welcome To BeauRocks',
                    subhead: 'Generic house open before any event-specific festival theming is applied.',
                    summary: 'House intro | room rules | first singer up',
                    accentTheme: 'cyan',
                    takeoverScene: 'intro',
                    durationSec: 12,
                    startedAtMs: Number(nowMs || FIXED_QA_TV_NOW_MS) - 4000,
                    options: ['Host intro', 'Crowd framing', 'First mic up'],
                },
            },
        };
    }

    if (safeId === 'generic-live-announcement') {
        return {
            started: true,
            room: {
                ...genericRoom,
                announcement: {
                    active: true,
                    type: 'announcement',
                    takeoverScene: 'announcement',
                    headline: 'Karaoke Starts In Five',
                    subhead: 'Default BeauRocks announcement styling before a festival profile takes over the room.',
                    accentTheme: 'cyan',
                    startedAtMs: Number(nowMs || FIXED_QA_TV_NOW_MS) - 2000,
                },
            },
        };
    }

    if (safeId === 'preview-intro') {
        return {
            started: true,
            room: {
                ...room,
                tvPreviewOverlay: {
                    active: true,
                    preview: true,
                    itemId: 'intro_1',
                    type: 'intro',
                    title: 'Introductions',
                    headline: 'Welcome To AAHF',
                    subhead: 'Festival welcome, first requests in motion, and a clean handoff into the first singer.',
                    summary: 'Festival welcome | room cue | spotlight up',
                    accentTheme: 'amber',
                    takeoverScene: 'intro',
                    durationSec: 12,
                    startedAtMs: Number(nowMs || FIXED_QA_TV_NOW_MS) - 4000,
                    options: ['Host intro', 'Crowd framing', 'First mic up'],
                },
            },
        };
    }

    if (safeId === 'preview-wyr') {
        return {
            started: true,
            room: {
                ...room,
                tvPreviewOverlay: {
                    active: true,
                    preview: true,
                    itemId: 'wyr_1',
                    type: 'would_you_rather_break',
                    title: 'Would You Rather Break',
                    headline: 'Pick A Side',
                    subhead: 'Reset the room with a fast decision break before the next run of songs.',
                    accentTheme: 'pink',
                    takeoverScene: 'would_you_rather_break',
                    durationSec: 10,
                    startedAtMs: Number(nowMs || FIXED_QA_TV_NOW_MS) - 3000,
                    modeKey: 'wyr',
                    options: ['Sing every duet', 'Run the DJ booth'],
                },
            },
        };
    }

    if (safeId === 'live-announcement') {
        return {
            started: true,
            room: {
                ...room,
                announcement: {
                    active: true,
                    type: 'announcement',
                    takeoverScene: 'announcement',
                    headline: 'Talent Showcase Starts In Five',
                    subhead: 'AAHF goes full-screen here while the next live moment gets set for the room.',
                    accentTheme: 'cyan',
                    startedAtMs: Number(nowMs || FIXED_QA_TV_NOW_MS) - 2000,
                },
            },
        };
    }

    if (safeId === 'live-closing') {
        return {
            started: true,
            room: {
                ...room,
                announcement: {
                    active: true,
                    type: 'closing',
                    takeoverScene: 'closing',
                    headline: 'Thank You For Singing',
                    subhead: 'Send the room out on a thank-you beat and point them to the next AAHF moment.',
                    accentTheme: 'amber',
                    startedAtMs: Number(nowMs || FIXED_QA_TV_NOW_MS) - 1500,
                },
            },
        };
    }

    if (safeId === 'reaction-showcase') {
        return {
            started: true,
            room: {
                ...room,
                hostName: 'Reaction QA Host',
            },
            reactions: buildReactionShowcase(nowMs),
        };
    }

    if (safeId === 'support-host-rain') {
        return {
            started: true,
            room: {
                ...room,
                bonusDrop: {
                    id: 'qa-host-rain',
                    by: 'DJ Beau',
                    points: 250,
                },
            },
        };
    }

    if (safeId === 'support-purchase-rain') {
        return {
            started: true,
            room: {
                ...room,
                purchaseCelebration: {
                    id: 'qa-purchase-rain',
                    buyerName: 'Maya',
                    buyerAvatar: '🤑',
                    title: 'Maya boosted the room',
                    label: 'Room support',
                    subtitle: 'Festival support spotlight',
                    points: 120,
                    badgeAwarded: true,
                    badgeLabel: 'Moneybags',
                    sourceProvider: 'givebutter',
                    rewardScope: 'room',
                    amountCents: 2500,
                    celebrationStyle: 'moneybags_burst',
                    createdAtMs: Number(nowMs || FIXED_QA_TV_NOW_MS) - 1000,
                },
            },
        };
    }

    return null;
};
