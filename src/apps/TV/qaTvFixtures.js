export const FIXED_QA_TV_NOW_MS = 1763503200000;

export const QA_TV_VISUAL_SCENARIOS = Object.freeze([
    {
        id: 'preview-intro',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Preview Mode', 'Intro', 'Welcome To AAHF'],
    },
    {
        id: 'preview-wyr',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Preview Mode', 'Would You Rather Break', 'Pick A Side'],
    },
    {
        id: 'live-announcement',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['House Announcement', 'Talent Showcase Starts In Five', 'Live room takeover'],
    },
    {
        id: 'live-closing',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Closing Moment', 'Thank You For Singing', 'Show graphics live on Public TV'],
    },
]);

const buildBaseRoom = (roomCode = 'DEMOAAHF') => ({
    activeMode: 'karaoke',
    hostName: 'AAHF Host',
    roomCode,
});

export const buildQaTvFixture = (fixtureId = '', { roomCode = 'DEMOAAHF', nowMs = FIXED_QA_TV_NOW_MS } = {}) => {
    const safeId = String(fixtureId || '').trim().toLowerCase();
    const room = buildBaseRoom(roomCode);

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
                    subhead: 'Introductions, room framing, and a clean handoff into the first performer.',
                    summary: 'Host open | room rules | spotlight up',
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
                    subhead: 'Public TV takeover is active and background music should stay ducked until the host clears this block.',
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
                    subhead: 'Close the night with final thanks, links, and the next room callout.',
                    accentTheme: 'amber',
                    startedAtMs: Number(nowMs || FIXED_QA_TV_NOW_MS) - 1500,
                },
            },
        };
    }

    return null;
};
