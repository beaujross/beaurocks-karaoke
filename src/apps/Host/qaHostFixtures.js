import { createDefaultRunOfShowDirector } from '../../lib/runOfShowDirector.js';
import { normalizeAudienceBrandTheme } from '../../lib/audienceBrandTheme.js';

export const FIXED_QA_HOST_NOW_MS = 1763503200000;
export const QA_AAHF_EVENT_PROFILE_ID = 'aahf_2026_kickoff';
const AAHF_LOGO_URL = '/images/marketing/aahf-combined-badge-clean.png';
const GENERIC_LOGO_URL = '/images/logo-library/beaurocks-logo-neon trasnparent.png';
const QA_DREAMS_ART_URL = '/images/marketing/audience-surface-live.png';
const QA_VALERIE_ART_URL = '/images/marketing/app-landing-live.png';
const QA_SINCE_U_BEEN_GONE_ART_URL = '/images/marketing/tv-surface-live.png';
export const QA_AAHF_AUDIENCE_BRAND_THEME = normalizeAudienceBrandTheme({
    appTitle: 'AAHF Festival',
    primaryColor: '#E05A44',
    secondaryColor: '#F4C94A',
    accentColor: '#8F2D2A',
});
export const QA_GENERIC_AUDIENCE_BRAND_THEME = normalizeAudienceBrandTheme({
    appTitle: 'BeauRocks Karaoke',
    primaryColor: '#00C4D9',
    secondaryColor: '#FF7AC8',
    accentColor: '#15091f',
});

export const QA_HOST_SCENARIOS = Object.freeze([
    {
        id: 'run-of-show-console-generic',
        roomCode: 'DEMOBR',
        expectedTexts: ['Advanced Show Controls', 'Now', 'Next', 'Apply For A Slot']
    },
    {
        id: 'run-of-show-console',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Advanced Show Controls', 'Now', 'Next', 'Apply For A Slot']
    },
    {
        id: 'run-of-show-stage-live',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Live Stage', 'Performance Controls', 'Post-Performance Timing']
    },
    {
        id: 'run-of-show-stage-live-generic',
        roomCode: 'DEMOBR',
        expectedTexts: ['Live Stage', 'Performance Controls', 'Post-Performance Timing']
    },
    {
        id: 'run-of-show-stage-live-social',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Social Game Night Console', 'Performance Actions', 'Room Deck']
    },
    {
        id: 'run-of-show-stage-live-generic-social',
        roomCode: 'DEMOBR',
        expectedTexts: ['Social Game Night Console', 'Performance Actions', 'Room Deck']
    },
    {
        id: 'cohost-queue-faceoff',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Co-Host Song Face-Off', 'Which queued song should go next?', 'Make Taylor Next']
    },
    {
        id: 'queue-overview-density',
        roomCode: 'DEMOAAHF',
        expectedTexts: ["Tonight's Lineup", 'Reorder']
    },
    {
        id: 'cohost-helper-catalog',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Co-Host Helper Catalog', 'Browse And Add For Guests', 'Copy Helper Link']
    },
    {
        id: 'cohost-credit-policy-settings',
        roomCode: 'DEMOAAHF',
        expectedTexts: ['Audience Store And Support', 'Co-host credit policy', 'Reaction tap cooldown']
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

const buildBaseFixture = (roomCode = 'DEMOAAHF', nowMs = FIXED_QA_HOST_NOW_MS, overrides = {}) => ({
    roomCode,
    settingsTab: 'general',
    room: {
        roomCode,
        hostUid: 'fixture_host',
        hostUids: ['fixture_host'],
        hostName: 'AAHF Host',
        eventProfileId: QA_AAHF_EVENT_PROFILE_ID,
        eventProfileLabel: 'AAHF Kick-Off',
        eventProfileVersion: 1,
        activeMode: 'karaoke',
        logoUrl: AAHF_LOGO_URL,
        lobbyOrbSkinUrl: AAHF_LOGO_URL,
        audienceShellVariant: 'streamlined',
        audienceBrandTheme: QA_AAHF_AUDIENCE_BRAND_THEME,
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
        },
        ...overrides,
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
        },
        {
            id: 'cloud_break_card',
            title: 'Festival Break Card',
            artist: 'Scene Upload',
            fileName: 'festival-break-card.png',
            url: QA_SINCE_U_BEEN_GONE_ART_URL,
            mediaUrl: QA_SINCE_U_BEEN_GONE_ART_URL,
            mediaType: 'image',
            storagePath: 'fixtures/festival-break-card.png',
            size: 102400,
            _cloud: true
        }
    ],
    scenePresets: [
        {
            id: 'scene_break_card',
            roomCode,
            title: 'Festival Break Card',
            mediaUrl: QA_SINCE_U_BEEN_GONE_ART_URL,
            mediaType: 'image',
            durationSec: 20,
            storagePath: 'fixtures/festival-break-card.png',
            fileName: 'festival-break-card.png',
            size: 102400,
            sourceUploadId: 'cloud_break_card'
        },
        {
            id: 'scene_welcome_loop',
            roomCode,
            title: 'Welcome Loop',
            mediaUrl: QA_DREAMS_ART_URL,
            mediaType: 'image',
            durationSec: 15,
            storagePath: 'fixtures/welcome-loop.png',
            fileName: 'welcome-loop.png',
            size: 98304,
            sourceUploadId: ''
        }
    ],
    ytIndex: [
        {
            videoId: 'yt_demo_backing_01',
            trackName: 'Dreams Karaoke Version',
            artistName: 'Venue Backing Library',
            url: 'https://www.youtube.com/watch?v=yt_demo_backing_01',
            durationSec: 212,
            playable: true,
            embeddable: true,
            youtubePlaybackStatus: 'embeddable',
            sourceDiscovery: 'trusted_catalog'
        },
        {
            videoId: 'yt_demo_valerie_02',
            trackName: 'Valerie Karaoke Backing',
            artistName: 'Venue Backing Library',
            url: 'https://www.youtube.com/watch?v=yt_demo_valerie_02',
            durationSec: 198,
            playable: true,
            embeddable: true,
            youtubePlaybackStatus: 'embeddable',
            sourceDiscovery: 'playlist_index'
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
});

const buildTriviaQuestionFixture = (nowMs = FIXED_QA_HOST_NOW_MS, overrides = {}) => ({
    id: 'qa_trivia_round_1',
    q: 'Which anthem gets the room singing first?',
    options: ['Don\'t Stop Believin\'', 'Mr. Brightside', 'Dancing Queen', 'Hey Ya!'],
    correct: 0,
    status: 'active',
    points: 100,
    durationSec: 20,
    autoReveal: true,
    startedAt: nowMs - 5000,
    revealAt: nowMs + 15000,
    ...overrides,
});

const buildWyrDataFixture = (nowMs = FIXED_QA_HOST_NOW_MS, overrides = {}) => ({
    id: 'qa_wyr_round_1',
    question: 'Would you rather open with a power ballad or a crowd singalong?',
    optionA: 'Power ballad',
    optionB: 'Crowd singalong',
    status: 'active',
    points: 50,
    durationSec: 20,
    autoReveal: true,
    startedAt: nowMs - 5000,
    revealAt: nowMs + 15000,
    ...overrides,
});

export const buildQaHostFixture = (fixtureId = '', { roomCode = 'DEMOAAHF', nowMs = FIXED_QA_HOST_NOW_MS } = {}) => {
    const safeId = String(fixtureId || '').trim().toLowerCase();
    if (safeId === 'room-manager') {
        return {
            ...buildBaseFixture(roomCode, nowMs),
            view: 'landing',
        };
    }
    if (safeId === 'room-setup-recipes') {
        return {
            ...buildBaseFixture(roomCode, nowMs),
            tab: 'stage',
            openNightSetupWizard: true,
        };
    }
    if (safeId === 'run-of-show-console-generic') {
        return {
            ...buildBaseFixture(roomCode, nowMs, {
                hostName: 'BeauRocks Host',
                eventProfileId: '',
                eventProfileLabel: 'BeauRocks Night',
                logoUrl: GENERIC_LOGO_URL,
                lobbyOrbSkinUrl: GENERIC_LOGO_URL,
                audienceBrandTheme: QA_GENERIC_AUDIENCE_BRAND_THEME,
            }),
            roomCode,
            tab: 'run_of_show',
        };
    }
    if (safeId === 'run-of-show-console') {
        return {
            ...buildBaseFixture(roomCode, nowMs),
            tab: 'run_of_show',
        };
    }
    if (safeId === 'run-of-show-stage-live') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        return {
            ...fixture,
            tab: 'stage',
            room: {
                ...(fixture.room || {}),
                videoPlaying: true,
                videoStartTimestamp: nowMs - 45000,
                pausedAt: null,
                showPerformanceRecap: true,
                applauseWarmupSec: 4,
                applauseCountdownSec: 4,
                applauseMeasureSec: 5,
                performanceRecapBreakdownMs: 5000,
                performanceRecapLeaderboardMs: 6000,
            },
            songs: [
                {
                    id: 'perf_live_1',
                    singerName: 'Alex Rivers',
                    singer: 'Alex Rivers',
                    emoji: '🎤',
                    photoUrl: 'https://i.pravatar.cc/240?img=12',
                    songTitle: 'Dreams',
                    title: 'Dreams',
                    artist: 'Fleetwood Mac',
                    artistName: 'Fleetwood Mac',
                    status: 'performing',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_backing_01',
                    youtubeId: 'yt_demo_backing_01',
                    albumArtUrl: QA_DREAMS_ART_URL,
                    duration: 212,
                    hostBonus: 25,
                    lyrics: 'Thunder only happens when it\'s raining',
                },
                {
                    id: 'queue_next_1',
                    singerName: 'Jordan',
                    singer: 'Jordan',
                    emoji: '✨',
                    photoUrl: 'https://i.pravatar.cc/240?img=32',
                    songTitle: 'Valerie',
                    title: 'Valerie',
                    artist: 'Amy Winehouse',
                    artistName: 'Amy Winehouse',
                    status: 'queued',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_valerie_02',
                    youtubeId: 'yt_demo_valerie_02',
                    albumArtUrl: QA_VALERIE_ART_URL,
                    duration: 198,
                },
                {
                    id: 'queue_wait_2',
                    singerName: 'Taylor',
                    singer: 'Taylor',
                    emoji: '🎸',
                    photoUrl: 'https://i.pravatar.cc/240?img=47',
                    songTitle: 'Since U Been Gone',
                    title: 'Since U Been Gone',
                    artist: 'Kelly Clarkson',
                    artistName: 'Kelly Clarkson',
                    status: 'queued',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_sinceu_03',
                    youtubeId: 'yt_demo_sinceu_03',
                    albumArtUrl: QA_SINCE_U_BEEN_GONE_ART_URL,
                    duration: 187,
                },
                {
                    id: 'queue_wait_3',
                    singerName: 'Sam Lee',
                    singer: 'Sam Lee',
                    emoji: '🔥',
                    photoUrl: 'https://i.pravatar.cc/240?img=14',
                    songTitle: 'Mr. Brightside',
                    title: 'Mr. Brightside',
                    artist: 'The Killers',
                    artistName: 'The Killers',
                    status: 'queued',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_brightside_04',
                    youtubeId: 'yt_demo_brightside_04',
                    albumArtUrl: QA_DREAMS_ART_URL,
                    duration: 223,
                }
            ],
        };
    }
    if (safeId === 'run-of-show-stage-live-generic') {
        const fixture = buildBaseFixture(roomCode, nowMs, {
            hostName: 'BeauRocks Host',
            eventProfileId: '',
            eventProfileLabel: 'BeauRocks Night',
            logoUrl: GENERIC_LOGO_URL,
            lobbyOrbSkinUrl: GENERIC_LOGO_URL,
            audienceBrandTheme: QA_GENERIC_AUDIENCE_BRAND_THEME,
        });
        return {
            ...fixture,
            tab: 'stage',
            room: {
                ...(fixture.room || {}),
                videoPlaying: true,
                videoStartTimestamp: nowMs - 45000,
                pausedAt: null,
                showPerformanceRecap: true,
                applauseWarmupSec: 4,
                applauseCountdownSec: 4,
                applauseMeasureSec: 5,
                performanceRecapBreakdownMs: 5000,
                performanceRecapLeaderboardMs: 6000,
            },
            songs: [
                {
                    id: 'perf_live_1',
                    singerName: 'Alex Rivers',
                    singer: 'Alex Rivers',
                    emoji: '🎤',
                    photoUrl: 'https://i.pravatar.cc/240?img=12',
                    songTitle: 'Dreams',
                    title: 'Dreams',
                    artist: 'Fleetwood Mac',
                    artistName: 'Fleetwood Mac',
                    status: 'performing',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_backing_01',
                    youtubeId: 'yt_demo_backing_01',
                    albumArtUrl: QA_DREAMS_ART_URL,
                    duration: 212,
                    hostBonus: 25,
                    lyrics: 'Thunder only happens when it\'s raining',
                },
                {
                    id: 'queue_next_1',
                    singerName: 'Jordan',
                    singer: 'Jordan',
                    emoji: '✨',
                    photoUrl: 'https://i.pravatar.cc/240?img=32',
                    songTitle: 'Valerie',
                    title: 'Valerie',
                    artist: 'Amy Winehouse',
                    artistName: 'Amy Winehouse',
                    status: 'requested',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_valerie_02',
                    youtubeId: 'yt_demo_valerie_02',
                    albumArtUrl: QA_VALERIE_ART_URL,
                    duration: 198,
                }
            ],
        };
    }
    if (safeId === 'run-of-show-stage-live-social') {
        const fixture = buildQaHostFixture('run-of-show-stage-live', { roomCode, nowMs });
        return {
            ...fixture,
            room: {
                ...(fixture?.room || {}),
                hostUiPrefs: {
                    ...((fixture?.room && fixture.room.hostUiPrefs) || {}),
                    runtimeShellMode: 'social_game_night_experiment',
                },
            },
        };
    }
    if (safeId === 'run-of-show-stage-live-generic-social') {
        const fixture = buildQaHostFixture('run-of-show-stage-live-generic', { roomCode, nowMs });
        return {
            ...fixture,
            room: {
                ...(fixture?.room || {}),
                hostUiPrefs: {
                    ...((fixture?.room && fixture.room.hostUiPrefs) || {}),
                    runtimeShellMode: 'social_game_night_experiment',
                },
            },
        };
    }
    if (safeId === 'cohost-queue-faceoff') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        return {
            ...fixture,
            tab: 'stage',
            room: {
                ...(fixture.room || {}),
                runOfShowDirector: {
                    ...(fixture.room?.runOfShowDirector || {}),
                    releaseWindow: {
                        active: true,
                        subjectType: 'queue_faceoff',
                        governanceMode: 'cohost_vote',
                        releasePolicy: 'suggest_then_host_confirm',
                        itemId: 'queue_faceoff:queue_1:queue_2',
                        itemTitle: 'Next Song Face-Off',
                        prompt: 'Co-hosts: which queued song should go next?',
                        openedAtMs: nowMs - 9_000,
                        closesAtMs: nowMs + 20_000,
                        choiceLabels: {
                            slot_scene: 'Valerie',
                            keep_queue_moving: 'Since U Been Gone',
                        },
                        choiceDetails: {
                            slot_scene: 'Jordan',
                            keep_queue_moving: 'Taylor',
                        },
                        choiceSongIds: {
                            slot_scene: 'queue_1',
                            keep_queue_moving: 'queue_2',
                        },
                        votesByUid: {
                            co_host_1: 'slot_scene',
                            co_host_2: 'keep_queue_moving',
                            co_host_3: 'keep_queue_moving',
                        },
                    },
                },
            },
            activities: [
                ...(Array.isArray(fixture.activities) ? fixture.activities : []),
                {
                    id: 'cohost_signal_track_1',
                    type: 'cohost_signal',
                    signalId: 'track_issue',
                    user: 'Stage Manager',
                    timestamp: nowMs - 3_000,
                },
            ],
            songs: [
                {
                    id: 'perf_live_1',
                    singerName: 'Alex Rivers',
                    singer: 'Alex Rivers',
                    songTitle: 'Dreams',
                    title: 'Dreams',
                    artist: 'Fleetwood Mac',
                    artistName: 'Fleetwood Mac',
                    status: 'performing',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_backing_01',
                    youtubeId: 'yt_demo_backing_01',
                    albumArtUrl: QA_DREAMS_ART_URL,
                    hostBonus: 25,
                    lyrics: 'Thunder only happens when it is raining',
                },
                {
                    id: 'queue_1',
                    singerUid: 'aud_2',
                    singerName: 'Jordan',
                    singer: 'Jordan',
                    songTitle: 'Valerie',
                    title: 'Valerie',
                    artist: 'Amy Winehouse',
                    artistName: 'Amy Winehouse',
                    status: 'requested',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_valerie_02',
                    youtubeId: 'yt_demo_valerie_02',
                    albumArtUrl: QA_VALERIE_ART_URL,
                    resolutionStatus: 'ready',
                    duration: 198,
                    priorityScore: 10,
                },
                {
                    id: 'queue_2',
                    singerUid: 'aud_1',
                    singerName: 'Taylor',
                    singer: 'Taylor',
                    songTitle: 'Since U Been Gone',
                    title: 'Since U Been Gone',
                    artist: 'Kelly Clarkson',
                    artistName: 'Kelly Clarkson',
                    status: 'requested',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_since_u_03',
                    youtubeId: 'yt_demo_since_u_03',
                    albumArtUrl: QA_SINCE_U_BEEN_GONE_ART_URL,
                    resolutionStatus: 'ready',
                    duration: 201,
                    priorityScore: 20,
                }
            ],
        };
    }
    if (safeId === 'queue-overview-density') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        const readySongs = [
            ['Jordan', 'Valerie', 'Amy Winehouse'],
            ['Taylor', 'Since U Been Gone', 'Kelly Clarkson'],
            ['Morgan', 'Mr. Brightside', 'The Killers'],
            ['Casey', 'Before He Cheats', 'Carrie Underwood'],
            ['Riley', 'No Scrubs', 'TLC'],
            ['Avery', 'I Want It That Way', 'Backstreet Boys'],
            ['Cameron', 'Man! I Feel Like a Woman!', 'Shania Twain'],
            ['Quinn', 'What Is Love', 'Haddaway'],
            ['Reese', 'You Oughta Know', 'Alanis Morissette'],
            ['Drew', 'Kiss Me', 'Sixpence None the Richer'],
            ['Skyler', 'Genie in a Bottle', 'Christina Aguilera'],
            ['Parker', 'Zombie', 'The Cranberries'],
        ];
        return {
            ...fixture,
            tab: 'stage',
            room: {
                ...(fixture.room || {}),
                runOfShowEnabled: true,
            },
            songs: [
                {
                    id: 'density_live',
                    singerName: 'Alex Rivers',
                    singer: 'Alex Rivers',
                    songTitle: 'Dreams',
                    title: 'Dreams',
                    artist: 'Fleetwood Mac',
                    artistName: 'Fleetwood Mac',
                    status: 'performing',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_backing_01',
                    youtubeId: 'yt_demo_backing_01',
                    albumArtUrl: QA_DREAMS_ART_URL,
                    lyrics: 'Thunder only happens when it is raining',
                },
                ...readySongs.map(([singerName, songTitle, artistName], index) => ({
                    id: `density_ready_${index + 1}`,
                    singerUid: `density_audience_${index + 1}`,
                    singerName,
                    singer: singerName,
                    songTitle,
                    title: songTitle,
                    artist: artistName,
                    artistName,
                    status: 'requested',
                    mediaUrl: `https://www.youtube.com/watch?v=density_backing_${index + 1}`,
                    youtubeId: `density_backing_${index + 1}`,
                    resolutionStatus: 'ready',
                    duration: 180 + index,
                    priorityScore: 100 - index,
                    createdAtMs: nowMs - (readySongs.length - index) * 1_000,
                })),
                {
                    id: 'density_pending',
                    singerName: 'Sam',
                    singer: 'Sam',
                    songTitle: 'Believe',
                    title: 'Believe',
                    artistName: 'Cher',
                    artist: 'Cher',
                    status: 'pending',
                    resolutionStatus: 'ready',
                    mediaUrl: 'https://www.youtube.com/watch?v=density_pending',
                    youtubeId: 'density_pending',
                },
                {
                    id: 'density_assigned',
                    singerName: 'Jamie',
                    singer: 'Jamie',
                    songTitle: 'Torn',
                    title: 'Torn',
                    artistName: 'Natalie Imbruglia',
                    artist: 'Natalie Imbruglia',
                    status: 'assigned',
                    runOfShowItemId: 'perf_next',
                    resolutionStatus: 'ready',
                    mediaUrl: 'https://www.youtube.com/watch?v=density_assigned',
                    youtubeId: 'density_assigned',
                },
                {
                    id: 'density_held',
                    singerName: 'Robin',
                    singer: 'Robin',
                    songTitle: 'Iris',
                    title: 'Iris',
                    artistName: 'Goo Goo Dolls',
                    artist: 'Goo Goo Dolls',
                    status: 'held',
                    holdReason: 'not_here',
                    resolutionStatus: 'ready',
                    mediaUrl: 'https://www.youtube.com/watch?v=density_held',
                    youtubeId: 'density_held',
                },
            ],
        };
    }
    if (safeId === 'cohost-helper-catalog') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        return {
            ...fixture,
            tab: 'browse',
            activeWorkspaceView: 'queue',
            activeWorkspaceSection: 'queue.catalog',
            catalogueOnly: true,
            room: {
                ...(fixture.room || {}),
                runOfShowRoles: {
                    coHosts: ['co_host_1'],
                },
            },
            songs: [
                {
                    id: 'queue_1',
                    singerUid: 'aud_1',
                    singerName: 'Taylor',
                    singer: 'Taylor',
                    songTitle: 'Dreams',
                    title: 'Dreams',
                    artist: 'Fleetwood Mac',
                    artistName: 'Fleetwood Mac',
                    status: 'requested',
                    mediaUrl: 'https://www.youtube.com/watch?v=yt_demo_backing_01',
                    youtubeId: 'yt_demo_backing_01',
                    albumArtUrl: QA_DREAMS_ART_URL,
                    resolutionStatus: 'ready',
                    duration: 212,
                    priorityScore: 10,
                }
            ],
        };
    }
    if (safeId === 'cohost-credit-policy-settings') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        return {
            ...fixture,
            tab: 'admin',
            settingsTab: 'monetization',
            room: {
                ...(fixture.room || {}),
                eventCredits: {
                    enabled: true,
                    presetId: 'custom_event_credits',
                    eventId: 'cohost_policy_demo',
                    eventLabel: 'Co-Host Policy Demo',
                    supportProvider: 'givebutter',
                    supportLabel: 'Support AAHF Festival',
                    supportUrl: 'https://givebutter.com/festival-kick-off-karaoke-party-y1ogra',
                    supportCampaignCode: 'festival-kick-off-karaoke-party-y1ogra',
                    supportPoints: 25,
                    supportBadge: false,
                    supportOffers: [],
                    audienceAccessMode: 'email_or_donation',
                    creditEarningMode: 'playful',
                    coHostCreditPolicy: 'unlimited',
                    reactionTapCooldownMs: 1600,
                    timedLobbyEnabled: true,
                    timedLobbyPoints: 50,
                    timedLobbyIntervalMin: 10,
                    timedLobbyMaxPerGuest: 300,
                    supportCelebrationStyle: 'moneybags_burst',
                    promoCampaigns: [],
                },
            },
        };
    }
    if (safeId === 'prompt-session-trivia-draft') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        const prompts = [
            { id: 'session-trivia-1', q: 'Which artist is known as The Boss?', options: ['Bruce Springsteen', 'Billy Joel', 'Bob Seger', 'John Mellencamp'], answer: 'Bruce Springsteen', correct: 0, points: 50 },
            { id: 'session-trivia-2', q: 'Which group released Dancing Queen?', options: ['ABBA', 'Blondie', 'The Go-Go\'s', 'Fleetwood Mac'], answer: 'ABBA', correct: 0, points: 50 },
        ];
        return {
            ...fixture,
            tab: 'stage',
            activeWorkspaceView: 'queue',
            activeWorkspaceSection: 'queue.live_run',
            room: {
                ...(fixture.room || {}),
                nightPlan: { experienceId: 'trivia', hostingLevel: 'guided', lyricsPolicy: 'optional' },
                promptSession: {
                    id: 'qa-trivia-session', kind: 'trivia', title: 'Trivia Night', prompts,
                    promptCount: prompts.length, currentIndex: 0, status: 'draft', revision: 3,
                    roundSec: 20, hostingLevel: 'guided', roundEndsAtMs: 0, updatedAtMs: nowMs,
                },
                activeMode: 'karaoke',
                triviaQuestion: null,
                wyrData: null,
            },
        };
    }
    if (safeId === 'prompt-session-wyr-live') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        const prompts = [
            { id: 'session-wyr-1', q: 'Would you rather open with a power ballad or a crowd singalong?', a: 'Power ballad', b: 'Crowd singalong', points: 50 },
            { id: 'session-wyr-2', q: 'Would you rather duet or go solo?', a: 'Duet', b: 'Solo', points: 50 },
        ];
        return {
            ...fixture,
            tab: 'stage',
            activeWorkspaceView: 'queue',
            activeWorkspaceSection: 'queue.live_run',
            room: {
                ...(fixture.room || {}),
                nightPlan: { experienceId: 'would_you_rather', hostingLevel: 'guided', lyricsPolicy: 'optional' },
                promptSession: {
                    id: 'qa-wyr-session', kind: 'would_you_rather', title: 'Would You Rather', prompts,
                    promptCount: prompts.length, currentIndex: 0, status: 'live', revision: 4,
                    roundSec: 20, hostingLevel: 'guided', roundEndsAtMs: nowMs + 600000, updatedAtMs: nowMs,
                },
                activeMode: 'wyr',
                triviaQuestion: null,
                wyrData: { ...prompts[0], question: prompts[0].q, optionA: prompts[0].a, optionB: prompts[0].b, status: 'live' },
            },
        };
    }
    if (safeId === 'prompt-round-trivia-live') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        return {
            ...fixture,
            tab: 'stage',
            room: {
                ...(fixture.room || {}),
                activeMode: 'trivia_pop',
                triviaQuestion: buildTriviaQuestionFixture(nowMs),
                wyrData: null,
            },
        };
    }
    if (safeId === 'prompt-round-trivia-reveal') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        return {
            ...fixture,
            tab: 'stage',
            room: {
                ...(fixture.room || {}),
                activeMode: 'trivia_reveal',
                triviaQuestion: buildTriviaQuestionFixture(nowMs, {
                    status: 'reveal',
                    revealAt: nowMs - 1000,
                }),
                wyrData: null,
            },
        };
    }
    if (safeId === 'prompt-round-wyr-live') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        return {
            ...fixture,
            tab: 'stage',
            room: {
                ...(fixture.room || {}),
                activeMode: 'wyr',
                triviaQuestion: null,
                wyrData: buildWyrDataFixture(nowMs),
            },
        };
    }
    if (safeId === 'prompt-round-wyr-reveal') {
        const fixture = buildBaseFixture(roomCode, nowMs);
        return {
            ...fixture,
            tab: 'stage',
            room: {
                ...(fixture.room || {}),
                activeMode: 'wyr_reveal',
                triviaQuestion: null,
                wyrData: buildWyrDataFixture(nowMs, {
                    status: 'reveal',
                    revealAt: nowMs - 1000,
                }),
            },
        };
    }
    return null;
};
