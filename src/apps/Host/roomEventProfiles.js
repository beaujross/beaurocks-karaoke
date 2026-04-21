import {
    RUN_OF_SHOW_PERFORMER_MODES,
    RUN_OF_SHOW_PROGRAM_MODES,
    createRunOfShowItem,
    normalizeRunOfShowDirector,
    normalizeRunOfShowPolicy,
    normalizeRunOfShowTemplateMeta,
    resequenceRunOfShowItems,
} from '../../lib/runOfShowDirector';
import { REQUEST_MODES } from '../../lib/requestModes';
import { getAudienceBrandThemePreset } from '../../lib/audienceBrandTheme';
import { normalizeAudienceFeatureAccess } from '../../lib/audienceFeatureAccess.js';
import { applyEventCreditsPreset } from './hostLaunchHelpers';

export const AAHF_KICKOFF_EVENT_PROFILE_ID = 'aahf_2026_kickoff';
export const AAHF_KICKOFF_STARTS_AT_LOCAL = '2026-05-01T19:00';
export const AAHF_KICKOFF_STARTS_AT_MS = Date.parse('2026-05-01T19:00:00-07:00');

const AAHF_KICKOFF_LOGO_URL = '/images/marketing/aahf-combined-badge-clean.png';

export const ROOM_EVENT_PROFILE_OPTIONS = Object.freeze([
    Object.freeze({
        id: AAHF_KICKOFF_EVENT_PROFILE_ID,
        label: 'AAHF Kick-Off',
        version: 1,
        startsAtLocal: AAHF_KICKOFF_STARTS_AT_LOCAL,
        startsAtMs: AAHF_KICKOFF_STARTS_AT_MS,
        description: 'AAHF kickoff defaults for Friday, May 1, 2026 from 7 PM to midnight, with explicit lyrics opening after 9 PM.',
        setupHighlights: Object.freeze([
            'Loads the AAHF logo and streamlined audience theme.',
            'Turns off marquee messages and pop-up trivia.',
            'Seeds a run of show with full-screen WYR and trivia breaks.'
        ]),
    }),
]);

export const getRoomEventProfileMeta = (profileId = '') => (
    ROOM_EVENT_PROFILE_OPTIONS.find((entry) => entry.id === String(profileId || '').trim().toLowerCase()) || null
);

export const buildAahfKickoffStarterTemplate = (now = Date.now()) => {
    const roundOneSlots = Array.from({ length: 4 }, (_, index) => createRunOfShowItem('performance', {
        title: `Round One Slot ${index + 1}`,
        plannedDurationSec: 210,
        performerMode: RUN_OF_SHOW_PERFORMER_MODES.openSubmission,
        status: 'blocked',
    }, now + index + 2));
    const roundTwoSlots = Array.from({ length: 4 }, (_, index) => createRunOfShowItem('performance', {
        title: `Round Two Slot ${index + 1}`,
        plannedDurationSec: 210,
        performerMode: RUN_OF_SHOW_PERFORMER_MODES.openSubmission,
        status: 'blocked',
    }, now + index + 20));
    const items = resequenceRunOfShowItems([
        createRunOfShowItem('intro', {
            title: 'AAHF Kick-Off',
            plannedDurationSec: 75,
            status: 'ready',
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'intro',
                headline: 'AAHF Karaoke Kick-Off',
                subhead: 'Doors at 7, phones out, first singers up, and explicit lyrics stay after 9 PM.',
                accentTheme: 'fuchsia'
            },
            audioPlan: {
                momentCueId: 'next_up',
                momentCueTiming: 'start',
                momentCueAutoFire: true,
            }
        }, now),
        createRunOfShowItem('announcement', {
            title: 'How To Join In',
            plannedDurationSec: 30,
            status: 'ready',
            roomMomentPlan: {
                showHowToPlay: true
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'how_to_play',
                headline: 'Phones out. Scan. Request.',
                subhead: 'Quick onboarding pass before the early set, with explicit lyrics opening after 9 PM.',
                accentTheme: 'cyan'
            }
        }, now + 1),
        roundOneSlots[0],
        roundOneSlots[1],
        createRunOfShowItem('would_you_rather_break', {
            title: 'Crowd Reset Vote',
            plannedDurationSec: 35,
            status: 'ready',
            modeLaunchPlan: {
                modeKey: 'wyr',
                launchConfig: {
                    question: 'Would you rather open the next set with a power ballad or a singalong anthem?',
                    options: ['Power ballad', 'Singalong anthem'],
                    durationSec: 35,
                    points: 50,
                    autoReveal: true,
                }
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'would_you_rather_break',
                headline: 'Crowd vote break',
                subhead: 'Reset the room between singers without falling back to pop-up trivia.',
                accentTheme: 'emerald'
            }
        }, now + 4),
        roundOneSlots[2],
        roundOneSlots[3],
        createRunOfShowItem('trivia_break', {
            title: 'Karaoke Quick Hit',
            plannedDurationSec: 40,
            status: 'ready',
            modeLaunchPlan: {
                modeKey: 'trivia_pop',
                launchConfig: {
                    question: 'In karaoke, what does a duet mean?',
                    options: [
                        'Two singers share one song',
                        'The same singer repeats the chorus',
                        'The audience picks the next track'
                    ],
                    correctIndex: 0,
                    durationSec: 40,
                    points: 100,
                    autoReveal: true,
                }
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'trivia_break',
                headline: 'Full-screen trivia break',
                subhead: 'Keep the room engaged while the next singer gets to the stage.',
                accentTheme: 'violet'
            }
        }, now + 7),
        createRunOfShowItem('announcement', {
            title: 'Support The Show',
            plannedDurationSec: 35,
            status: 'ready',
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'tipping',
                headline: 'Support the AAHF kick-off',
                subhead: 'Fuel the room before the next run starts.',
                accentTheme: 'pink'
            },
            audioPlan: {
                duckBackingEnabled: true,
                duckLevelPct: 24,
                momentCueId: 'hype',
                momentCueTiming: 'start',
                momentCueAutoFire: true,
            }
        }, now + 10),
        createRunOfShowItem('winner_declaration', {
            title: 'Hourly Door Prize Winners',
            plannedDurationSec: 75,
            status: 'ready',
            advanceMode: 'host_after_min',
            hostAdvanceMinSec: 20,
            notes: 'Pick the podium and hand out the hourly door prize before the room resets.',
            presentationPlan: {
                publicTvTakeoverEnabled: false,
                takeoverScene: 'winner_reveal',
                headline: 'Hourly winners',
                subhead: 'Pick gold, silver, and bronze before the next block starts.',
                accentTheme: 'amber'
            },
            audioPlan: {
                momentCueId: 'reveal',
                momentCueTiming: 'start',
                momentCueAutoFire: true,
            }
        }, now + 10.5),
        createRunOfShowItem('announcement', {
            title: 'Selfie Cam Moment',
            plannedDurationSec: 45,
            status: 'ready',
            roomMomentPlan: {
                activeMode: 'selfie_cam'
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'selfie_cam',
                headline: 'Selfie Cam goes live',
                subhead: 'Turn the room into the spotlight before round two.',
                accentTheme: 'amber'
            }
        }, now + 11),
        createRunOfShowItem('intermission', {
            title: 'Take Five',
            plannedDurationSec: 300,
            status: 'ready',
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'intermission',
                headline: 'Take five',
                subhead: 'Refresh drinks, queue up, and get ready for round two.',
                accentTheme: 'violet'
            },
            audioPlan: {
                momentCueId: 'reset',
                momentCueTiming: 'end',
                momentCueAutoFire: true,
            }
        }, now + 12),
        roundTwoSlots[0],
        roundTwoSlots[1],
        createRunOfShowItem('would_you_rather_break', {
            title: 'Encore Energy Check',
            plannedDurationSec: 35,
            status: 'ready',
            modeLaunchPlan: {
                modeKey: 'wyr',
                launchConfig: {
                    question: 'Would you rather close with a throwback anthem or a big modern singalong?',
                    options: ['Throwback anthem', 'Modern singalong'],
                    durationSec: 35,
                    points: 50,
                    autoReveal: true,
                }
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'would_you_rather_break',
                headline: 'Encore vote',
                subhead: 'Quick room pulse check before the last two slots.',
                accentTheme: 'cyan'
            }
        }, now + 22),
        roundTwoSlots[2],
        roundTwoSlots[3],
        createRunOfShowItem('closing', {
            title: 'Finale Push',
            plannedDurationSec: 60,
            status: 'ready',
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'closing',
                headline: 'Thanks for singing',
                subhead: 'Wrap the room cleanly and point guests to the next AAHF beat.',
                accentTheme: 'fuchsia'
            },
            audioPlan: {
                momentCueId: 'celebrate',
                momentCueTiming: 'start',
                momentCueAutoFire: true,
            }
        }, now + 30),
    ]);

    return {
        templateId: 'starter_aahf_kickoff',
        templateName: 'AAHF Kick-Off',
        templateType: 'starter',
        runOfShowPolicy: normalizeRunOfShowPolicy({
            defaultAutomationMode: 'auto',
            lateBlockPolicy: 'compress',
            noShowPolicy: 'pull_from_queue',
            queueDivergencePolicy: 'queue_can_fill_gaps',
            blockedActionPolicy: 'manual_override_allowed'
        }),
        runOfShowDirector: normalizeRunOfShowDirector({
            enabled: true,
            automationPaused: false,
            automationStatus: 'idle',
            currentItemId: items[0]?.id || '',
            items
        }),
    };
};

export const buildRoomEventProfilePatch = (profileId = '', options = {}) => {
    const meta = getRoomEventProfileMeta(profileId);
    if (!meta) return null;

    if (meta.id === AAHF_KICKOFF_EVENT_PROFILE_ID) {
        const startsAtMs = Math.max(0, Number(options?.startsAtMs || meta.startsAtMs || 0) || 0);
        const startsAtLocal = String(options?.startsAtLocal || meta.startsAtLocal || '').trim().slice(0, 64);
        const starter = buildAahfKickoffStarterTemplate(startsAtMs || Date.now());
        const nextDirector = normalizeRunOfShowDirector(starter.runOfShowDirector || {});
        const nextPolicy = normalizeRunOfShowPolicy(starter.runOfShowPolicy || {});
        const nextTemplateMeta = normalizeRunOfShowTemplateMeta({
            currentTemplateId: starter.templateId,
            currentTemplateName: starter.templateName,
        });

        return {
            eventProfileId: meta.id,
            eventProfileLabel: meta.label,
            eventProfileVersion: meta.version,
            hostNightPreset: 'competition',
            logoUrl: AAHF_KICKOFF_LOGO_URL,
            lobbyOrbSkinUrl: AAHF_KICKOFF_LOGO_URL,
            audienceShellVariant: 'streamlined',
            audienceBrandTheme: getAudienceBrandThemePreset('festival_sunburst', {
                appTitle: 'AAHF Festival',
            }),
            audienceFeatureAccess: normalizeAudienceFeatureAccess({
                features: {
                    customEmoji: 'open',
                },
            }),
            autoDj: false,
            autoBgMusic: false,
            autoPlayMedia: true,
            autoEndOnTrackFinish: true,
            autoBonusEnabled: true,
            autoBonusPoints: 25,
            autoDjDelaySec: 8,
            showVisualizerTv: false,
            showLyricsTv: true,
            showScoring: true,
            showFameLevel: true,
            requestMode: REQUEST_MODES.canonicalOpen,
            allowSingerTrackSelect: false,
            marqueeEnabled: false,
            marqueeShowMode: 'idle',
            chatShowOnTv: false,
            chatTvMode: 'auto',
            bouncerMode: true,
            bingoAudienceReopenEnabled: true,
            autoLyricsOnQueue: true,
            popTriviaEnabled: false,
            queueSettings: {
                limitMode: 'per_night',
                limitCount: 2,
                rotation: 'round_robin',
                firstTimeBoost: false,
            },
            roomPlan: {
                startsAtLocal,
                startsAtMs,
            },
            eventCredits: applyEventCreditsPreset('aahf_kickoff', {
                eventLabel: meta.label,
                presetId: 'aahf_kickoff',
            }),
            programMode: RUN_OF_SHOW_PROGRAM_MODES.runOfShow,
            runOfShowEnabled: true,
            runOfShowDirector: nextDirector,
            runOfShowPolicy: nextPolicy,
            runOfShowTemplateMeta: nextTemplateMeta,
        };
    }

    return null;
};
