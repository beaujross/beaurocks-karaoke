import { createDefaultRunOfShowDirector } from '../../lib/runOfShowDirector.js';
import { normalizeAudienceBrandTheme } from '../../lib/audienceBrandTheme.js';

export const FIXED_QA_HOST_NOW_MS = 1763503200000;
const AAHF_EVENT_PROFILE_ID = 'aahf_2026_kickoff';
const AAHF_LOGO_URL = '/images/marketing/karaoke-kickoff-logo-simple.png';
const AAHF_AUDIENCE_BRAND_THEME = normalizeAudienceBrandTheme({
    appTitle: 'AAHF Karaoke',
    primaryColor: '#FF4FA3',
    secondaryColor: '#1ED7FF',
    accentColor: '#FACC15',
});

export const QA_HOST_SCENARIOS = Object.freeze([
    {
        id: 'run-of-show-console',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Run Of Show Director', 'Now', 'Next', 'Apply For A Slot']
    }
]);

const buildDirector = (nowMs = FIXED_QA_HOST_NOW_MS) => createDefaultRunOfShowDirector({
    enabled: true,
    automationPaused: false,
    currentItemId: 'intro_live',
    items: [
        {
            id: 'intro_live',
            type: 'intro',
            title: 'House Introductions',
            status: 'live',
            plannedDurationSec: 90,
            startsAtMs: nowMs - 60000,
            automationMode: 'auto',
            presentationPlan: {
                headline: 'Welcome To The Kick-Off',
                subhead: 'House rules and the first performer handoff.',
                takeoverScene: 'intro',
                publicTvTakeoverEnabled: true,
                accentTheme: 'amber',
                soundtrackSourceType: 'manual_external',
                soundtrackMediaUrl: 'https://media.example.com/fixtures/aahf-intro-sting.mp3',
                soundtrackLabel: 'AAHF Intro Sting',
                soundtrackAutoPlay: true
            }
        },
        {
            id: 'perf_next',
            type: 'performance',
            title: 'Feature Slot 1',
            status: 'ready',
            plannedDurationSec: 210,
            startsAtMs: nowMs + 180000,
            performerMode: 'assigned',
            assignedPerformerName: 'Alex Rivers',
            songTitle: 'Dreams',
            artistName: 'Fleetwood Mac',
            backingPlan: {
                sourceType: 'youtube',
                label: 'Studio-quality karaoke mix',
                youtubeId: 'yt_demo_backing_01',
                mediaUrl: 'https://youtube.com/watch?v=yt_demo_backing_01',
                approvalStatus: 'approved',
                playbackReady: true,
                resolutionStatus: 'ready'
            }
        },
        {
            id: 'audience_vote',
            type: 'would_you_rather_break',
            title: 'Audience Vote',
            status: 'draft',
            plannedDurationSec: 120,
            startsAtMs: nowMs + 420000,
            modeLaunchPlan: {
                modeKey: 'wyr',
                launchConfig: {
                    question: 'Would you rather open the next set with a power ballad or a singalong anthem?',
                    optionsCsv: 'Power ballad, Singalong anthem'
                }
            }
        },
        {
            id: 'open_slot',
            type: 'performance',
            title: 'Audience Spotlight',
            status: 'blocked',
            plannedDurationSec: 180,
            startsAtMs: nowMs + 540000,
            performerMode: 'open_submission',
            slotCriteria: {
                requiresAccount: true,
                minTight15Count: 2,
                hostApprovalRequired: true
            },
            backingPlan: {
                sourceType: 'manual_external',
                label: 'Waiting on host pick',
                approvalStatus: 'pending',
                playbackReady: false,
                resolutionStatus: 'needs_selection'
            }
        }
    ]
}, nowMs);

export const buildQaHostFixture = (fixtureId = '', { roomCode = 'DEMOAAHF', nowMs = FIXED_QA_HOST_NOW_MS } = {}) => {
    const safeId = String(fixtureId || '').trim().toLowerCase();
    if (safeId !== 'run-of-show-console') return null;
    return {
        roomCode,
        tab: 'run_of_show',
        settingsTab: 'general',
        room: {
            roomCode,
            hostUid: 'fixture_host',
            hostUids: ['fixture_host'],
            hostName: 'AAHF Host',
            eventProfileId: AAHF_EVENT_PROFILE_ID,
            eventProfileLabel: 'AAHF Kick-Off',
            eventProfileVersion: 1,
            activeMode: 'karaoke',
            logoUrl: AAHF_LOGO_URL,
            lobbyOrbSkinUrl: AAHF_LOGO_URL,
            audienceShellVariant: 'streamlined',
            audienceBrandTheme: AAHF_AUDIENCE_BRAND_THEME,
            roomPlan: {
                startsAtLocal: '2026-05-01T19:00',
                startsAtMs: Date.parse('2026-05-01T19:00:00-07:00'),
            },
            runOfShowEnabled: true,
            programMode: 'run_of_show',
            runOfShowPolicy: {
                defaultAutomationMode: 'auto',
                lateBlockPolicy: 'compress',
                noShowPolicy: 'pull_from_queue',
                queueDivergencePolicy: 'queue_can_fill_gaps',
                blockedActionPolicy: 'manual_override_allowed'
            },
            runOfShowRoles: {
                coHosts: ['co_host_1'],
                stageManagers: ['stage_mgr_1'],
                mediaCurators: ['media_curator_1']
            },
            runOfShowTemplateMeta: {
                currentTemplateId: 'aahf_template',
                currentTemplateName: 'AAHF Kick-Off',
                lastArchiveId: 'archive_prev',
                archivedAtMs: nowMs - 86400000
            },
            runOfShowDirector: buildDirector(nowMs),
            tvPreviewOverlay: {
                active: true,
                itemId: 'perf_next'
            }
        },
        songs: [
            { id: 'queue_1', title: 'Dreams', singer: 'Alex Rivers', status: 'queued' }
        ],
        localLibrary: [
            {
                id: 'local_dreams_master',
                title: 'Dreams (Local Master)',
                artist: 'Fleetwood Mac',
                fileName: 'dreams-local-master.mp3',
                url: 'https://media.example.com/local/dreams-local-master.mp3',
                _local: true
            },
            {
                id: 'local_valerie_cut',
                title: 'Valerie (Alt Cut)',
                artist: 'Amy Winehouse',
                fileName: 'valerie-alt-cut.mp3',
                url: 'https://media.example.com/local/valerie-alt-cut.mp3',
                _local: true
            }
        ],
        ytIndex: [
            {
                videoId: 'yt_demo_backing_01',
                trackName: 'Dreams Karaoke Version',
                artistName: 'Venue Backing Library',
                url: 'https://www.youtube.com/watch?v=yt_demo_backing_01',
                durationSec: 212,
                playable: true
            },
            {
                videoId: 'yt_demo_valerie_02',
                trackName: 'Valerie Karaoke Backing',
                artistName: 'Venue Backing Library',
                url: 'https://www.youtube.com/watch?v=yt_demo_valerie_02',
                durationSec: 198,
                playable: true
            }
        ],
        users: [
            { id: 'aud_1', name: 'Taylor' },
            { id: 'aud_2', name: 'Jordan' }
        ],
        runOfShowSubmissions: [
            {
                id: 'submission_1',
                itemId: 'open_slot',
                songTitle: 'Valerie',
                artistName: 'Amy Winehouse',
                displayName: 'Sam Lee',
                submissionStatus: 'pending'
            },
            {
                id: 'submission_approved_1',
                itemId: 'open_slot',
                songTitle: 'Dreams',
                artistName: 'Fleetwood Mac',
                displayName: 'Alex Rivers',
                submissionStatus: 'approved',
                mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_backing_01',
                youtubeId: 'yt_demo_backing_01'
            }
        ],
        runOfShowTemplates: [
            {
                id: 'aahf_template',
                templateId: 'aahf_template',
                templateName: 'AAHF Kick-Off',
                templateType: 'template',
                roomCode,
                runOfShowDirector: buildDirector(nowMs),
                runOfShowPolicy: {
                    defaultAutomationMode: 'auto',
                    lateBlockPolicy: 'compress',
                    noShowPolicy: 'pull_from_queue',
                    queueDivergencePolicy: 'queue_can_fill_gaps',
                    blockedActionPolicy: 'manual_override_allowed'
                }
            }
        ]
    };
};
