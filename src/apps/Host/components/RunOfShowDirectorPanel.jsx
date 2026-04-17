import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { callFunction } from '../../../lib/firebase';
import { TRIVIA_BANK, WYR_BANK } from '../../../lib/gameDataConstants';
import {
    RUN_OF_SHOW_ADVANCE_MODES,
    RUN_OF_SHOW_BLOCKED_ACTION_POLICIES,
    RUN_OF_SHOW_DEFAULT_AUTOMATION_POLICIES,
    RUN_OF_SHOW_ITEM_TYPES,
    RUN_OF_SHOW_LATE_BLOCK_POLICIES,
    RUN_OF_SHOW_NO_SHOW_POLICIES,
    RUN_OF_SHOW_OPERATOR_ROLES,
    RUN_OF_SHOW_PERFORMER_MODES,
    RUN_OF_SHOW_QUEUE_DIVERGENCE_POLICIES,
    createRunOfShowItem,
    getRunOfShowHudActionKey,
    getRunOfShowHudState,
    getRunOfShowHudToneClass,
    getRunOfShowBlockedActionLabel,
    getRunOfShowAdvanceMode,
    getRunOfShowHostAdvanceMinSec,
    getNextRunOfShowItem,
    getRunOfShowItemReadiness,
    getRunOfShowItemLabel,
    getRunOfShowLiveItem,
    getRunOfShowOperatingHint,
    getRunOfShowStagedItem,
    hasRunOfShowTakeoverSoundtrackIdentity,
    isRunOfShowItemReady
} from '../../../lib/runOfShowDirector';
import {
    HOST_MOMENT_CUE_OPTIONS,
    HOST_MOMENT_CUE_TIMING_OPTIONS,
    formatHostMomentCueSummary,
    getHostMomentCueMeta
} from '../../../lib/hostMomentCues';
import { BG_TRACK_OPTIONS, getBgTrackById } from '../../../lib/bgTrackOptions';

const ITEM_TYPE_OPTIONS = RUN_OF_SHOW_ITEM_TYPES
    .filter((type) => type !== 'trivia_break')
    .map((type) => ({ value: type, label: getRunOfShowItemLabel(type) }));
const PERFORMER_MODE_OPTIONS = [
    { value: RUN_OF_SHOW_PERFORMER_MODES.assigned, label: 'Assigned' },
    { value: RUN_OF_SHOW_PERFORMER_MODES.placeholder, label: 'Placeholder' },
    { value: RUN_OF_SHOW_PERFORMER_MODES.openSubmission, label: 'Open Submission' }
];
const ROLE_LABELS = Object.freeze({
    [RUN_OF_SHOW_OPERATOR_ROLES.host]: 'Host',
    [RUN_OF_SHOW_OPERATOR_ROLES.coHost]: 'Co-Host',
    [RUN_OF_SHOW_OPERATOR_ROLES.stageManager]: 'Stage Manager',
    [RUN_OF_SHOW_OPERATOR_ROLES.mediaCurator]: 'Media Curator',
    [RUN_OF_SHOW_OPERATOR_ROLES.viewer]: 'Viewer'
});
const POLICY_LABELS = Object.freeze({
    auto: 'Auto when ready',
    manual: 'Manual by default',
    hold: 'Hold current order',
    compress: 'Compress current block',
    skip_optional: 'Skip optional blocks',
    hold_for_host: 'Hold for host decision',
    skip_to_next: 'Skip to next planned block',
    pull_from_queue: 'Pull from live queue',
    host_override_only: 'Host override only',
    allow_stage_manager: 'Stage manager may fill gaps',
    queue_can_fill_gaps: 'Queue may fill gaps',
    focus_next_fix: 'Fix next blocker first',
    manual_override_allowed: 'Allow manual override',
    skip_blocked_after_review: 'Skip after review'
});
const getAdvanceModeLabel = (item = {}) => {
    const advanceMode = getRunOfShowAdvanceMode(item);
    if (advanceMode === RUN_OF_SHOW_ADVANCE_MODES.host) return 'Host advances';
    if (advanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin) {
        const minimumSec = getRunOfShowHostAdvanceMinSec(item);
        return minimumSec > 0 ? `Host after ${formatDurationSec(minimumSec) || `${minimumSec}s`}` : 'Host after minimum';
    }
    return 'Auto after duration';
};
const POLICY_PRESETS = Object.freeze([
    {
        id: 'hands_on',
        label: 'Hands-On',
        description: 'Host stays in charge of pacing and blocker decisions.',
        policy: {
            defaultAutomationMode: 'manual',
            lateBlockPolicy: 'hold',
            noShowPolicy: 'hold_for_host',
            queueDivergencePolicy: 'host_override_only',
            blockedActionPolicy: 'focus_next_fix'
        }
    },
    {
        id: 'balanced',
        label: 'Balanced',
        description: 'Auto-stage when ready, but keep hosts in the loop on surprises.',
        policy: {
            defaultAutomationMode: 'auto',
            lateBlockPolicy: 'compress',
            noShowPolicy: 'hold_for_host',
            queueDivergencePolicy: 'allow_stage_manager',
            blockedActionPolicy: 'manual_override_allowed'
        }
    },
    {
        id: 'autopilot',
        label: 'Autopilot',
        description: 'Push the room forward aggressively when the plan is ready.',
        policy: {
            defaultAutomationMode: 'auto',
            lateBlockPolicy: 'skip_optional',
            noShowPolicy: 'pull_from_queue',
            queueDivergencePolicy: 'queue_can_fill_gaps',
            blockedActionPolicy: 'skip_blocked_after_review'
        }
    }
]);
const EVENT_FORMAT_OPTIONS = Object.freeze([
    { value: 'karaoke_heavy', label: 'Karaoke-Heavy', description: 'Mostly singer slots with short transitions.' },
    { value: 'mixed_variety', label: 'Mixed Variety', description: 'Karaoke plus audience breaks and announcements.' },
    { value: 'competition', label: 'Competition', description: 'Structured performance rounds with judging beats.' },
    { value: 'fundraiser', label: 'Fundraiser', description: 'More sponsor and donation moments between songs.' },
    { value: 'corporate_private', label: 'Corporate / Private', description: 'Shorter slots and more host-led moments.' },
    { value: 'blank_custom', label: 'Blank Custom', description: 'Start with your own custom block mix.' }
]);
const PACING_OPTIONS = Object.freeze([
    { value: 'tight', label: 'Tight', description: 'Short transitions and quick turns.' },
    { value: 'steady', label: 'Steady', description: 'Balanced pacing for most rooms.' },
    { value: 'cinematic', label: 'Cinematic', description: 'More space for intros, transitions, and takeovers.' }
]);
const INTERACTION_OPTIONS = Object.freeze([
    { value: 'low', label: 'Low', description: 'Keep the room focused on performance flow.' },
    { value: 'moderate', label: 'Moderate', description: 'Blend in audience moments without taking over the night.' },
    { value: 'high', label: 'High', description: 'Use more trivia, games, and hype beats.' }
]);
const MOMENT_CUE_OPTIONS = HOST_MOMENT_CUE_OPTIONS;
const MOMENT_CUE_TIMING_OPTIONS = HOST_MOMENT_CUE_TIMING_OPTIONS;
const GENERATOR_DEFAULTS = Object.freeze({
    format: 'karaoke_heavy',
    durationMin: 120,
    pacing: 'steady',
    performanceCount: 12,
    announcementCount: 2,
    interactiveCount: 1,
    includeIntermission: true,
    bufferCount: 1,
    automationPresetId: 'balanced',
    interactionLevel: 'moderate',
    applyMode: 'replace',
    step: 1
});
const GENERATOR_FORMAT_DEFAULTS = Object.freeze({
    karaoke_heavy: { performanceCount: 14, announcementCount: 1, interactiveCount: 1, includeIntermission: true, bufferCount: 1, automationPresetId: 'balanced' },
    mixed_variety: { performanceCount: 10, announcementCount: 2, interactiveCount: 2, includeIntermission: true, bufferCount: 2, automationPresetId: 'balanced' },
    competition: { performanceCount: 12, announcementCount: 3, interactiveCount: 1, includeIntermission: true, bufferCount: 2, automationPresetId: 'hands_on' },
    fundraiser: { performanceCount: 8, announcementCount: 4, interactiveCount: 1, includeIntermission: true, bufferCount: 2, automationPresetId: 'hands_on' },
    corporate_private: { performanceCount: 8, announcementCount: 3, interactiveCount: 2, includeIntermission: false, bufferCount: 2, automationPresetId: 'autopilot' },
    blank_custom: { performanceCount: 6, announcementCount: 1, interactiveCount: 1, includeIntermission: false, bufferCount: 1, automationPresetId: 'balanced' }
});
const BACKING_SOURCE_OPTIONS = [
    { value: 'canonical_default', label: 'Default', title: 'Canonical Default', description: 'Use the room-approved default track for this song.', trustLabel: 'Auto-ready when approved', tone: 'emerald' },
    { value: 'youtube', label: 'YouTube', title: 'YouTube', description: 'Assign a specific approved YouTube backing for this performance.', trustLabel: 'Needs approved id or media URL', tone: 'rose' },
    { value: 'apple_music', label: 'Apple', title: 'Apple Music / iTunes', description: 'Use Apple metadata or fallback media for a more canonical source.', trustLabel: 'Trusted when resolved', tone: 'cyan' },
    { value: 'user_submitted', label: 'User Submit', title: 'Approved User Submission', description: 'Reuse a singer-submitted backing only after host review.', trustLabel: 'Not trusted until approved', tone: 'amber' },
    { value: 'local_file', label: 'Local File', title: 'Local File', description: 'Point at a host-managed local asset or local playback reference.', trustLabel: 'Trusted when mapped', tone: 'violet' },
    { value: 'manual_external', label: 'Manual', title: 'Manual External', description: 'Planning-only hook for an external source the host must handle manually.', trustLabel: 'Manual only', tone: 'zinc' }
];
const ITEM_VISUALS = Object.freeze({
    intro: { icon: 'fa-door-open', tone: 'from-cyan-500/25 to-sky-500/15', chip: 'border-cyan-300/25 bg-cyan-500/12 text-cyan-100' },
    performance: { icon: 'fa-microphone-lines', tone: 'from-fuchsia-500/25 to-rose-500/15', chip: 'border-fuchsia-300/25 bg-fuchsia-500/12 text-fuchsia-100' },
    announcement: { icon: 'fa-bullhorn', tone: 'from-amber-500/25 to-orange-500/15', chip: 'border-amber-300/25 bg-amber-500/12 text-amber-100' },
    trivia_break: { icon: 'fa-lightbulb', tone: 'from-violet-500/25 to-indigo-500/15', chip: 'border-violet-300/25 bg-violet-500/12 text-violet-100' },
    game_break: { icon: 'fa-dice', tone: 'from-emerald-500/25 to-teal-500/15', chip: 'border-emerald-300/25 bg-emerald-500/12 text-emerald-100' },
    would_you_rather_break: { icon: 'fa-shuffle', tone: 'from-emerald-500/25 to-cyan-500/15', chip: 'border-emerald-300/25 bg-emerald-500/12 text-emerald-100' },
    intermission: { icon: 'fa-martini-glass-citrus', tone: 'from-sky-500/20 to-zinc-500/10', chip: 'border-sky-300/25 bg-sky-500/12 text-sky-100' },
    buffer: { icon: 'fa-wave-square', tone: 'from-zinc-500/20 to-zinc-400/10', chip: 'border-white/10 bg-white/5 text-zinc-200' },
    closing: { icon: 'fa-flag-checkered', tone: 'from-pink-500/20 to-violet-500/15', chip: 'border-pink-300/25 bg-pink-500/12 text-pink-100' }
});
const QUICK_ADD_SCENE_OPTIONS = Object.freeze([
    { value: 'performance', label: 'Performance Slot', icon: 'fa-microphone-lines', detail: 'Add a singer clip' },
    { value: 'announcement', label: 'Announcement', icon: 'fa-bullhorn', detail: 'Host beat or sponsor hit' },
    { value: 'would_you_rather_break', label: 'Audience Vote', icon: 'fa-shuffle', detail: 'Quick between-song room vote' },
    { value: 'intermission', label: 'Intermission', icon: 'fa-martini-glass-citrus', detail: 'Reset the room' },
    { value: 'closing', label: 'Closing', icon: 'fa-flag-checkered', detail: 'End the night cleanly' },
]);
const SPOTLIGHT_TIMELINE_OPTIONS = Object.freeze([
    { id: 'bingo', label: 'Bingo', detail: 'Crowd board play between performances.', icon: 'fa-table-cells-large', tone: 'emerald' },
    { id: 'team_pong', label: 'Team Pong', detail: 'Left-vs-right rally moment.', icon: 'fa-table-tennis-paddle-ball', tone: 'cyan' },
    { id: 'doodle_oke', label: 'Doodle-oke', detail: 'Draw and guess break.', icon: 'fa-pen', tone: 'violet' },
    { id: 'selfie_challenge', label: 'Selfie Challenge', detail: 'Photo prompt and voting.', icon: 'fa-camera-retro', tone: 'rose' },
    { id: 'karaoke_bracket', label: 'Bracket', detail: 'Tournament progression.', icon: 'fa-trophy', tone: 'rose' },
    { id: 'vocal_challenge', label: 'Vocal Challenge', detail: 'Pitch target game.', icon: 'fa-wave-square', tone: 'sky' },
    { id: 'riding_scales', label: 'Riding Scales', detail: 'Scale memory challenge.', icon: 'fa-music', tone: 'violet' },
    { id: 'flappy_bird', label: 'Flappy Bird', detail: 'Voice-volume obstacle spike.', icon: 'fa-feather-pointed', tone: 'emerald' },
    { id: 'applause_countdown', label: 'Applause Meter', detail: 'Crowd-volume payoff.', icon: 'fa-hands-clapping', tone: 'amber' },
    { id: 'selfie_cam', label: 'Selfie Cam', detail: 'Roaming spotlight camera.', icon: 'fa-camera', tone: 'cyan' },
]);
const VIBE_TIMELINE_OPTIONS = Object.freeze([
    { id: 'ballad', label: 'Ballad Wash', detail: 'Softer handoff lighting.', icon: 'fa-moon-stars', tone: 'violet' },
    { id: 'banger', label: 'Banger Drop', detail: 'High-energy light pulse.', icon: 'fa-bolt-lightning', tone: 'rose' },
    { id: 'storm', label: 'Storm', detail: 'Lightning/storm room effect.', icon: 'fa-cloud-bolt', tone: 'cyan' },
    { id: 'strobe', label: 'Strobe', detail: 'Short strobe burst.', icon: 'fa-burst', tone: 'amber' },
    { id: 'volley', label: 'Volley', detail: 'Back-and-forth crowd volley.', icon: 'fa-arrows-left-right', tone: 'emerald' },
]);
const MOMENT_PACKS = Object.freeze([
    {
        id: 'hype_intro',
        label: 'Hype Intro',
        subtitle: 'TV takeover + room-welcome headline',
        icon: 'fa-stars',
        tone: 'cyan',
        type: 'intro',
        chips: ['TV takeover', 'Opener'],
        overrides: {
            title: 'AAHF Kick-Off',
            plannedDurationSec: 75,
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'intro',
                headline: 'AAHF Karaoke Kick-Off',
                subhead: 'Doors at 7, first singers up early, and explicit lyrics stay after 9 PM.',
                accentTheme: 'fuchsia'
            }
        }
    },
    {
        id: 'would_you_rather',
        label: 'Would You Rather',
        subtitle: 'Fast audience vote with instant TV payoff',
        icon: 'fa-shuffle',
        tone: 'emerald',
        type: 'would_you_rather_break',
        chips: ['Vote', 'Reveal'],
        overrides: {
            title: 'Would You Rather',
            plannedDurationSec: 65,
            modeLaunchPlan: {
                modeKey: 'wyr',
                launchConfig: {
                    question: 'Would you rather sing the chorus solo or bring the whole row on stage?',
                    optionsCsv: 'Solo, Bring the row'
                }
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'would_you_rather_break',
                headline: 'Quick split-decision moment',
                subhead: 'Phones vote once and the room sees the split immediately.',
                accentTheme: 'emerald'
            }
        }
    },
    {
        id: 'selfie_cam',
        label: 'Selfie Cam',
        subtitle: 'Turn the room into a roaming spotlight moment',
        icon: 'fa-camera-retro',
        tone: 'amber',
        type: 'announcement',
        chips: ['Camera', 'Crowd energy'],
        overrides: {
            title: 'Selfie Cam Moment',
            plannedDurationSec: 45,
            roomMomentPlan: {
                activeMode: 'selfie_cam'
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'selfie_cam',
                headline: 'Selfie Cam goes live',
                subhead: 'Hand the spotlight to the crowd before the next singer starts.',
                accentTheme: 'amber'
            }
        }
    },
    {
        id: 'leaderboard_flash',
        label: 'Leaderboard Flash',
        subtitle: 'Show momentum and room standings on TV',
        icon: 'fa-ranking-star',
        tone: 'cyan',
        type: 'announcement',
        chips: ['Leaderboard', 'TV overlay'],
        overrides: {
            title: 'Leaderboard Flash',
            plannedDurationSec: 30,
            roomMomentPlan: {
                activeScreen: 'leaderboard'
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'leaderboard',
                headline: 'Room leaders on deck',
                subhead: 'Use this to punctuate momentum without changing the queue.',
                accentTheme: 'cyan'
            }
        }
    },
    {
        id: 'tip_burst',
        label: 'Tip Burst',
        subtitle: 'Put the support CTA on the big screen',
        icon: 'fa-hand-holding-dollar',
        tone: 'rose',
        type: 'announcement',
        chips: ['Tip CTA', 'Fundraiser'],
        overrides: {
            title: 'Support The Show',
            plannedDurationSec: 30,
            roomMomentPlan: {
                activeScreen: 'tipping'
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'tipping',
                headline: 'Fuel the show',
                subhead: 'Drop the tip call-to-action while the room resets for the next singer.',
                accentTheme: 'pink'
            }
        }
    },
    {
        id: 'how_to_play',
        label: 'How To Play',
        subtitle: 'Remind the room how joining and requesting works',
        icon: 'fa-circle-question',
        tone: 'cyan',
        type: 'announcement',
        chips: ['Instructions', 'Onboarding'],
        overrides: {
            title: 'How To Join In',
            plannedDurationSec: 25,
            roomMomentPlan: {
                showHowToPlay: true
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'how_to_play',
                headline: 'Phones out. Scan. Request.',
                subhead: 'Quick onboarding beat for late arrivals before the next song.',
                accentTheme: 'cyan'
            }
        }
    },
    {
        id: 'ballad_wash',
        label: 'Ballad Wash',
        subtitle: 'Shift the room vibe for a slower handoff',
        icon: 'fa-moon-stars',
        tone: 'violet',
        type: 'buffer',
        chips: ['Light mode', 'Reset'],
        overrides: {
            title: 'Ballad Reset',
            plannedDurationSec: 30,
            roomMomentPlan: {
                lightMode: 'ballad'
            },
            presentationPlan: {
                publicTvTakeoverEnabled: false,
                headline: 'Bring the room down softly',
                subhead: 'A short vibe wash before the next singer comes in.',
                accentTheme: 'violet'
            }
        }
    },
    {
        id: 'banger_drop',
        label: 'Banger Drop',
        subtitle: 'Kick the room back into a louder mode',
        icon: 'fa-bolt-lightning',
        tone: 'rose',
        type: 'announcement',
        chips: ['Light mode', 'Hype'],
        overrides: {
            title: 'Banger Drop',
            plannedDurationSec: 35,
            roomMomentPlan: {
                lightMode: 'banger'
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'announcement',
                headline: 'Bring the room up',
                subhead: 'Use a banger pulse before a high-energy singer takes over.',
                accentTheme: 'rose'
            }
        }
    }
]);
const TAKEOVER_STYLE_PRESETS = Object.freeze([
    Object.freeze({
        id: 'welcome_spotlight',
        label: 'Welcome Spotlight',
        detail: 'Clean opener that tees up the next act without overwhelming the room.',
        soundtrackHint: 'Best with a short walk-in or opener track.',
        icon: 'fa-stars',
        tone: 'cyan',
        takeoverScene: 'intro',
        accentTheme: 'cyan',
        cueId: 'next_up',
        cueTiming: 'start',
        duckBackingEnabled: true,
        duckLevelPct: 28,
    }),
    Object.freeze({
        id: 'crowd_pulse',
        label: 'Crowd Pulse',
        detail: 'High-energy beat for hype announcements, sponsor hits, or room reset pushes.',
        soundtrackHint: 'Use a banger drop, crowd chant, or short bumper.',
        icon: 'fa-bolt',
        tone: 'rose',
        takeoverScene: 'announcement',
        accentTheme: 'pink',
        cueId: 'hype',
        cueTiming: 'start',
        duckBackingEnabled: true,
        duckLevelPct: 24,
    }),
    Object.freeze({
        id: 'reveal_hit',
        label: 'Reveal Hit',
        detail: 'Best for winner reveals, scoreboards, sponsor draws, or challenge payoffs.',
        soundtrackHint: 'Use a suspense swell, reveal sting, or short payoff cue.',
        icon: 'fa-wand-magic-sparkles',
        tone: 'amber',
        takeoverScene: 'leaderboard',
        accentTheme: 'amber',
        cueId: 'reveal',
        cueTiming: 'start',
        duckBackingEnabled: true,
        duckLevelPct: 20,
    }),
    Object.freeze({
        id: 'reset_break',
        label: 'Reset Break',
        detail: 'Softer intermission or room-breathing moment before the next block.',
        soundtrackHint: 'Use a lighter bed or no soundtrack at all.',
        icon: 'fa-moon-stars',
        tone: 'violet',
        takeoverScene: 'intermission',
        accentTheme: 'violet',
        cueId: 'reset',
        cueTiming: 'end',
        duckBackingEnabled: false,
        duckLevelPct: 35,
    }),
    Object.freeze({
        id: 'finale_push',
        label: 'Finale Push',
        detail: 'Strong closing visual for final call, recap push, or thank-you moment.',
        soundtrackHint: 'Use a celebratory payoff or room-signoff song.',
        icon: 'fa-flag-checkered',
        tone: 'fuchsia',
        takeoverScene: 'closing',
        accentTheme: 'fuchsia',
        cueId: 'celebrate',
        cueTiming: 'start',
        duckBackingEnabled: true,
        duckLevelPct: 26,
    }),
]);
const TAKEOVER_STYLE_PRESET_BY_ID = Object.freeze(
    TAKEOVER_STYLE_PRESETS.reduce((acc, preset) => {
        acc[preset.id] = preset;
        return acc;
    }, {})
);
const showAdvancedDraftBuilder = false;
const showExtraBlockBin = false;
const extraBlockOptions = [];
const TIMELINE_LANE_ORDER = Object.freeze(['master', 'performance', 'host', 'audience']);
const TIMELINE_LANE_META = Object.freeze({
    master: { label: 'Master Sequence', detail: 'Everything in running order', tone: 'cyan' },
    performance: { label: 'Singer Slots', detail: 'Performance clips only', tone: 'fuchsia' },
    host: { label: 'Host Moments', detail: 'Intro, announcements, closing', tone: 'amber' },
    audience: { label: 'Audience Beats', detail: 'Trivia, games, buffers, breaks', tone: 'emerald' },
});

const textInputClass = 'w-full rounded-xl border border-cyan-300/24 bg-zinc-950/88 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none shadow-[inset_0_0_0_1px_rgba(34,211,238,0.04)] transition focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-60';
const selectInputClass = `${textInputClass} appearance-none pr-10`;
const surfaceClass = 'rounded-[28px] border border-white/10 bg-black/25';
const _miniSurfaceClass = 'rounded-2xl border border-white/10 bg-black/20';
const launchConfigToCsv = (cfg = {}) => Array.isArray(cfg?.options) ? cfg.options.join(', ') : String(cfg?.optionsCsv || '').trim();
const parseLaunchConfigOptions = (cfg = {}) => {
    if (Array.isArray(cfg?.options)) return cfg.options.map((entry) => String(entry || '').trim());
    return String(cfg?.optionsCsv || '')
        .split(',')
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
};
const normalizeTriviaEntry = (entry = {}, index = 0) => ({
    id: String(entry.id || `builtin_trivia_${index}`),
    q: String(entry.q || '').trim(),
    correct: String(entry.correct || '').trim(),
    w1: String(entry.w1 || '').trim(),
    w2: String(entry.w2 || '').trim(),
    w3: String(entry.w3 || '').trim(),
    points: Math.max(0, Number(entry.points || 100) || 100)
});
const normalizeWyrEntry = (entry = {}, index = 0) => ({
    id: String(entry.id || `builtin_wyr_${index}`),
    q: String(entry.q || '').trim(),
    a: String(entry.a || '').trim(),
    b: String(entry.b || '').trim(),
    points: Math.max(0, Number(entry.points || 50) || 50)
});
const buildTriviaLaunchConfigFromEntry = (entry = {}) => {
    const normalized = normalizeTriviaEntry(entry);
    const options = [normalized.correct, normalized.w1, normalized.w2, normalized.w3].filter(Boolean).slice(0, 4);
    return {
        question: normalized.q,
        options,
        optionsCsv: options.join(', '),
        correctIndex: options.length ? 0 : 0,
        points: normalized.points
    };
};
const buildWyrLaunchConfigFromEntry = (entry = {}) => {
    const normalized = normalizeWyrEntry(entry);
    const options = [normalized.a, normalized.b].filter(Boolean).slice(0, 2);
    return {
        question: normalized.q,
        options,
        optionsCsv: options.join(', '),
        points: normalized.points
    };
};
const FieldLabel = ({ children }) => <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">{children}</label>;
const normalizeSearch = (value = '') => String(value || '').trim().toLowerCase();
const formatMediaLabel = (title = '', artist = '') => [String(title || '').trim(), String(artist || '').trim()].filter(Boolean).join(' - ');
const buildMediaQuery = (item = {}) => [item?.songTitle, item?.artistName].map((value) => String(value || '').trim()).filter(Boolean).join(' ').trim();
const matchesMediaQuery = (parts = [], query = '') => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return true;
    const haystack = parts.map((part) => normalizeSearch(part)).filter(Boolean).join(' ');
    return normalizedQuery.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
};
const compactMediaDetail = (...parts) => parts.map((part) => String(part || '').trim()).filter(Boolean).join(' | ');
const buildQueueAssignmentFallbackPatch = (song = {}, item = {}) => {
    const mediaUrl = String(song?.mediaUrl || '').trim();
    const appleMusicId = String(song?.appleMusicId || '').trim();
    const trackId = String(song?.trackId || '').trim();
    const youtubeId = String(song?.youtubeId || '').trim();
    const hasPlaybackSource = !!(mediaUrl || appleMusicId || trackId || youtubeId);
    const sourceType = appleMusicId
        ? 'apple_music'
        : (youtubeId || mediaUrl)
            ? 'youtube'
            : trackId
                ? 'canonical_default'
                : String(item?.backingPlan?.sourceType || 'canonical_default').trim().toLowerCase() || 'canonical_default';
    return {
        performerMode: RUN_OF_SHOW_PERFORMER_MODES.assigned,
        assignedPerformerUid: String(song?.singerUid || '').trim(),
        assignedPerformerName: String(song?.singerName || item?.assignedPerformerName || '').trim(),
        approvedSubmissionId: '',
        songId: String(song?.songId || '').trim(),
        songTitle: String(song?.songTitle || '').trim(),
        artistName: String(song?.artist || '').trim(),
        preparedQueueSongId: String(song?.id || '').trim(),
        queueLinkState: 'linked',
        backingPlan: {
            ...(item?.backingPlan || {}),
            sourceType,
            label: formatSummaryLine(song?.songTitle || 'Queued performance', song?.artist || ''),
            mediaUrl,
            youtubeId: sourceType === 'youtube' ? (youtubeId || '') : '',
            appleMusicId: sourceType === 'apple_music' ? (appleMusicId || trackId) : '',
            trackId: sourceType === 'youtube' ? '' : trackId,
            localAssetId: '',
            submittedBackingId: '',
            approvalStatus: hasPlaybackSource ? 'approved' : 'pending',
            playbackReady: hasPlaybackSource,
            resolutionStatus: hasPlaybackSource ? 'ready' : 'needs_selection'
        }
    };
};
const buildSubmissionAssignmentPatch = (submission = {}, item = {}) => {
    const mediaUrl = String(submission?.mediaUrl || '').trim();
    const appleMusicId = String(submission?.appleMusicId || '').trim();
    const trackId = String(submission?.trackId || '').trim();
    const youtubeId = String(submission?.youtubeId || '').trim();
    const hasPlaybackSource = !!(mediaUrl || appleMusicId || trackId || youtubeId);
    const sourceType = appleMusicId
        ? 'apple_music'
        : (youtubeId || mediaUrl)
            ? 'youtube'
            : trackId
                ? 'canonical_default'
                : String(item?.backingPlan?.sourceType || 'canonical_default').trim().toLowerCase() || 'canonical_default';
    return {
        performerMode: RUN_OF_SHOW_PERFORMER_MODES.assigned,
        assignedPerformerUid: String(submission?.performerUid || submission?.uid || '').trim(),
        assignedPerformerName: String(submission?.displayName || submission?.performerName || item?.assignedPerformerName || '').trim(),
        approvedSubmissionId: String(submission?.id || '').trim(),
        preparedQueueSongId: '',
        queueLinkState: '',
        songId: String(submission?.songId || '').trim(),
        songTitle: String(submission?.songTitle || '').trim(),
        artistName: String(submission?.artistName || '').trim(),
        backingPlan: {
            ...(item?.backingPlan || {}),
            sourceType,
            label: formatSummaryLine(submission?.songTitle || 'Approved submission', submission?.artistName || ''),
            mediaUrl,
            youtubeId: sourceType === 'youtube' ? (youtubeId || '') : '',
            appleMusicId: sourceType === 'apple_music' ? (appleMusicId || trackId) : '',
            trackId: sourceType === 'youtube' ? '' : trackId,
            submittedBackingId: String(submission?.id || '').trim(),
            approvalStatus: 'approved',
            playbackReady: hasPlaybackSource,
            resolutionStatus: hasPlaybackSource ? 'ready' : 'needs_selection'
        }
    };
};
const getQueueFitScore = (item = {}, song = {}) => {
    const itemTitle = normalizeSearch(item?.songTitle);
    const itemArtist = normalizeSearch(item?.artistName);
    const itemSinger = normalizeSearch(item?.assignedPerformerName);
    const songTitle = normalizeSearch(song?.songTitle);
    const songArtist = normalizeSearch(song?.artist);
    const songSinger = normalizeSearch(song?.singerName);
    const titleMatch = itemTitle ? (songTitle === itemTitle ? 3 : (songTitle.includes(itemTitle) ? 2 : 0)) : 0;
    const artistMatch = itemArtist ? (songArtist === itemArtist ? 2 : (songArtist.includes(itemArtist) ? 1 : 0)) : 0;
    const singerMatch = itemSinger ? (songSinger === itemSinger ? 1 : 0) : 0;
    return titleMatch + artistMatch + singerMatch;
};
const getPerformanceAssignmentState = (item = {}, { pendingCount = 0 } = {}) => {
    if (String(item?.type || '').trim().toLowerCase() !== 'performance') return 'all';
    const performerReady = !!String(item?.assignedPerformerName || '').trim();
    const songReady = !!String(item?.songTitle || '').trim();
    const artistReady = !!String(item?.artistName || '').trim();
    const playbackReady = item?.backingPlan?.playbackReady === true;
    if (pendingCount > 0) return 'needs_review';
    if (isRunOfShowItemReady(item)) return 'ready';
    if (!performerReady && !songReady && !artistReady && !playbackReady) return 'empty';
    return 'needs_review';
};
const isUnassignedPerformanceItem = (item = {}) => {
    if (String(item?.type || '').trim().toLowerCase() !== 'performance') return false;
    return !String(item?.assignedPerformerName || '').trim()
        && !String(item?.songTitle || '').trim()
        && !String(item?.artistName || '').trim();
};
const formatDurationSec = (value = 0) => {
    const total = Math.max(0, Math.round(Number(value || 0)));
    if (!total) return '';
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
const pickerStatusTone = (tone = 'zinc') => {
    if (tone === 'emerald') return 'border-emerald-300/25 bg-emerald-500/12 text-emerald-100';
    if (tone === 'cyan') return 'border-cyan-300/25 bg-cyan-500/12 text-cyan-100';
    if (tone === 'rose') return 'border-rose-300/25 bg-rose-500/12 text-rose-100';
    if (tone === 'amber') return 'border-amber-300/25 bg-amber-500/12 text-amber-100';
    if (tone === 'violet') return 'border-violet-300/25 bg-violet-500/12 text-violet-100';
    return 'border-white/10 bg-white/5 text-zinc-200';
};
const uniqueById = (entries = []) => {
    const seen = new Set();
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
        const id = String(entry?.id || '').trim();
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

const statusTone = (status = '') => {
    const key = String(status || '').toLowerCase();
    if (key === 'live') return 'border-emerald-300/45 bg-emerald-500/18 text-emerald-100';
    if (key === 'staged') return 'border-cyan-300/45 bg-cyan-500/18 text-cyan-100';
    if (key === 'ready') return 'border-sky-300/35 bg-sky-500/14 text-sky-100';
    if (key === 'blocked') return 'border-amber-300/35 bg-amber-500/14 text-amber-100';
    if (key === 'complete') return 'border-zinc-300/20 bg-zinc-500/12 text-zinc-100';
    if (key === 'skipped') return 'border-zinc-300/20 bg-zinc-500/8 text-zinc-300';
    return 'border-white/10 bg-white/5 text-zinc-200';
};

const sourceTone = (tone = 'zinc', active = false) => {
    if (tone === 'emerald') return active ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-50' : 'border-emerald-300/18 bg-emerald-500/8 text-emerald-100';
    if (tone === 'cyan') return active ? 'border-cyan-300/45 bg-cyan-500/15 text-cyan-50' : 'border-cyan-300/18 bg-cyan-500/8 text-cyan-100';
    if (tone === 'sky') return active ? 'border-sky-300/45 bg-sky-500/15 text-sky-50' : 'border-sky-300/18 bg-sky-500/8 text-sky-100';
    if (tone === 'rose') return active ? 'border-rose-300/45 bg-rose-500/15 text-rose-50' : 'border-rose-300/18 bg-rose-500/8 text-rose-100';
    if (tone === 'amber') return active ? 'border-amber-300/45 bg-amber-500/15 text-amber-50' : 'border-amber-300/18 bg-amber-500/8 text-amber-100';
    if (tone === 'violet') return active ? 'border-violet-300/45 bg-violet-500/15 text-violet-50' : 'border-violet-300/18 bg-violet-500/8 text-violet-100';
    return active ? 'border-zinc-300/45 bg-zinc-500/15 text-zinc-50' : 'border-white/10 bg-white/5 text-zinc-200';
};

const backingApprovalMeta = (approvalStatus = '') => {
    const safe = String(approvalStatus || '').trim().toLowerCase();
    if (safe === 'approved') {
        return {
            label: 'Good for room',
            tone: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
        };
    }
    if (safe === 'rejected') {
        return {
            label: 'Bad fit',
            tone: 'border-rose-300/30 bg-rose-500/10 text-rose-100'
        };
    }
    if (safe === 'host_selected') {
        return {
            label: 'Host picked',
            tone: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100'
        };
    }
    if (safe === 'pending') {
        return {
            label: 'Needs review',
            tone: 'border-amber-300/30 bg-amber-500/10 text-amber-100'
        };
    }
    return {
        label: 'Unrated',
        tone: 'border-white/10 bg-white/5 text-zinc-200'
    };
};

const formatStart = (ms = 0) => {
    const safe = Number(ms || 0);
    if (!safe) return 'No clock time';
    try {
        return new Date(safe).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
        return 'Scheduled';
    }
};

const formatChecklist = (entries = []) => (Array.isArray(entries) ? entries : []).slice(0, 3);
const formatSummaryLine = (...parts) => parts.filter(Boolean).join(' | ');
const _uidListToCsv = (entries = []) => (Array.isArray(entries) ? entries : []).filter(Boolean).join(', ');
const _csvToUidList = (value = '') => String(value || '').split(',').map((entry) => String(entry || '').trim()).filter(Boolean);
const getItemVisual = (type = '') => ITEM_VISUALS[String(type || '').trim().toLowerCase()] || { icon: 'fa-layer-group', tone: 'from-zinc-500/20 to-zinc-400/10', chip: 'border-white/10 bg-white/5 text-zinc-200' };
const _roleTone = (role = '') => {
    if (role === RUN_OF_SHOW_OPERATOR_ROLES.host) return 'emerald';
    if (role === RUN_OF_SHOW_OPERATOR_ROLES.coHost) return 'cyan';
    if (role === RUN_OF_SHOW_OPERATOR_ROLES.stageManager) return 'amber';
    if (role === RUN_OF_SHOW_OPERATOR_ROLES.mediaCurator) return 'violet';
    return 'zinc';
};
const normalizeRoomUserCandidates = (entries = []) => {
    const seen = new Set();
    return (Array.isArray(entries) ? entries : []).map((entry = {}) => {
        const uid = String(entry?.uid || entry?.id || '').trim();
        if (!uid || seen.has(uid)) return null;
        seen.add(uid);
        return {
            uid,
            label: String(entry?.displayName || entry?.name || entry?.username || entry?.email || uid).trim(),
            meta: String(entry?.email || entry?.username || '').trim()
        };
    }).filter(Boolean);
};
const compactMomentSummary = (momentPlan = {}) => {
    const chips = [];
    if (momentPlan?.activeScreen) chips.push(String(momentPlan.activeScreen).replaceAll('_', ' '));
    if (momentPlan?.activeMode) chips.push(String(momentPlan.activeMode).replaceAll('_', ' '));
    if (momentPlan?.showHowToPlay) chips.push('how to play');
    if (momentPlan?.lightMode && String(momentPlan.lightMode).toLowerCase() !== 'off') chips.push(`${momentPlan.lightMode} lights`);
    return chips.join(' | ');
};
const cueSummaryLabel = (audioPlan = {}) => {
    return formatHostMomentCueSummary(audioPlan);
};
const getTakeoverStylePresetMatch = (item = {}) => {
    const scene = String(item?.presentationPlan?.takeoverScene || '').trim().toLowerCase();
    const accentTheme = String(item?.presentationPlan?.accentTheme || '').trim().toLowerCase();
    return TAKEOVER_STYLE_PRESETS.find((preset) =>
        preset.takeoverScene === scene && preset.accentTheme === accentTheme
    ) || null;
};
const buildTakeoverPresetUpdate = (item = {}, presetId = '') => {
    const preset = TAKEOVER_STYLE_PRESET_BY_ID[String(presetId || '').trim()] || null;
    if (!preset) return null;
    const currentPresentationPlan = item?.presentationPlan && typeof item.presentationPlan === 'object' ? item.presentationPlan : {};
    const currentAudioPlan = item?.audioPlan && typeof item.audioPlan === 'object' ? item.audioPlan : {};
    return {
        presentationPlan: {
            ...currentPresentationPlan,
            publicTvTakeoverEnabled: true,
            takeoverScene: preset.takeoverScene,
            accentTheme: preset.accentTheme,
        },
        audioPlan: {
            ...currentAudioPlan,
            duckBackingEnabled: preset.duckBackingEnabled,
            duckLevelPct: preset.duckLevelPct,
            momentCueId: preset.cueId,
            momentCueTiming: preset.cueTiming,
            momentCueAutoFire: true,
        }
    };
};
const TAKEOVER_ITEM_TYPES = new Set(['announcement', 'intro', 'closing', 'intermission', 'buffer']);
const distributeInsertions = (count = 0, total = 0) => {
    if (!count || !total) return [];
    return Array.from({ length: count }, (_, index) => Math.max(1, Math.min(total, Math.round(((index + 1) * total) / (count + 1)))));
};
const buildInteractiveType = (format = '', index = 0, interactionLevel = 'moderate') => {
    if (format === 'competition') return 'announcement';
    if (format === 'fundraiser') return index % 2 === 0 ? 'announcement' : 'would_you_rather_break';
    if (interactionLevel === 'low') return 'announcement';
    return index % 2 === 0 ? 'would_you_rather_break' : 'game_break';
};
const getTimelineLaneKey = (type = '') => {
    const safeType = String(type || '').trim().toLowerCase();
    if (safeType === 'performance') return 'performance';
    if (['intro', 'announcement', 'closing'].includes(safeType)) return 'host';
    return 'audience';
};
const buildTimelineSegments = (items = []) => {
    const safeItems = Array.isArray(items) ? items : [];
    const totalDuration = safeItems.reduce((sum, item) => sum + Math.max(30, Number(item?.plannedDurationSec || 0) || 0), 0) || (safeItems.length * 60) || 1;
    let cursor = 0;
    return safeItems.map((item, index) => {
        const durationSec = Math.max(30, Number(item?.plannedDurationSec || 0) || 0);
        const startSec = cursor;
        cursor += durationSec;
        return {
            item,
            index,
            durationSec,
            startSec,
            laneKey: getTimelineLaneKey(item?.type),
            startPct: (startSec / totalDuration) * 100,
            widthPct: Math.max((durationSec / totalDuration) * 100, 7),
        };
    });
};
const getPerformanceDurationForPacing = (pacing = 'steady') => (
    pacing === 'tight' ? 150 : pacing === 'cinematic' ? 225 : 180
);
const createGeneratedBlock = (type = 'buffer', overrides = {}) => createRunOfShowItem(type, {
    status: type === 'performance' ? 'blocked' : 'draft',
    automationMode: overrides.automationMode || 'auto',
    ...overrides
});
const buildGeneratedRunOfShowItems = (config = {}) => {
    const safeConfig = { ...GENERATOR_DEFAULTS, ...(config || {}) };
    const performanceCount = Math.max(0, Number(safeConfig.performanceCount || 0));
    const announcementCount = Math.max(0, Number(safeConfig.announcementCount || 0));
    const interactiveCount = Math.max(0, Number(safeConfig.interactiveCount || 0));
    const bufferCount = Math.max(0, Number(safeConfig.bufferCount || 0));
    const pacing = safeConfig.pacing || 'steady';
    const performanceDuration = getPerformanceDurationForPacing(pacing);
    const bufferDuration = pacing === 'tight' ? 20 : pacing === 'cinematic' ? 45 : 30;
    const introDuration = pacing === 'cinematic' ? 90 : 60;
    const intermissionDuration = safeConfig.format === 'corporate_private' ? 240 : 420;
    const items = [
        createGeneratedBlock('intro', {
            title: safeConfig.format === 'competition' ? 'Show Open + Rules' : 'Doors Open + Welcome',
            plannedDurationSec: introDuration,
            presentationPlan: { headline: 'Welcome to Tonight\'s Show', subhead: 'The room is about to go live.' }
        })
    ];
    const announcementPositions = new Set(distributeInsertions(announcementCount, performanceCount));
    const interactivePositions = new Set(distributeInsertions(interactiveCount, performanceCount));
    const bufferPositions = new Set(distributeInsertions(bufferCount, performanceCount));
    for (let index = 1; index <= performanceCount; index += 1) {
        items.push(createGeneratedBlock('performance', {
            title: safeConfig.format === 'competition' ? `Round Slot ${index}` : `Performance Slot ${index}`,
            plannedDurationSec: performanceDuration,
            performerMode: RUN_OF_SHOW_PERFORMER_MODES.placeholder,
            songTitle: '',
            artistName: '',
        }));
        if (safeConfig.includeIntermission && index === Math.ceil(performanceCount / 2)) {
            items.push(createGeneratedBlock('intermission', {
                title: 'Intermission',
                plannedDurationSec: intermissionDuration,
                presentationPlan: { headline: 'Take Five', subhead: 'Refresh drinks, queue up, and get ready for round two.' }
            }));
        }
        if (announcementPositions.has(index)) {
            items.push(createGeneratedBlock('announcement', {
                title: safeConfig.format === 'fundraiser' ? `Sponsor + Donation Moment ${announcementPositions.size ? Array.from(announcementPositions).indexOf(index) + 1 : 1}` : `Host Announcement ${Array.from(announcementPositions).indexOf(index) + 1}`,
                plannedDurationSec: 60,
                presentationPlan: { headline: 'Host Moment', subhead: 'Share context, sponsors, or the next beat of the night.' }
            }));
        }
        if (interactivePositions.has(index)) {
            const interactiveType = buildInteractiveType(safeConfig.format, index, safeConfig.interactionLevel);
            items.push(createGeneratedBlock(interactiveType, {
                title: getRunOfShowItemLabel(interactiveType),
                plannedDurationSec: interactiveType === 'announcement' ? 45 : 75,
                modeLaunchPlan: interactiveType === 'announcement' ? undefined : {
                    modeKey: interactiveType === 'trivia_break' ? 'trivia_pop' : interactiveType === 'would_you_rather_break' ? 'wyr' : 'crowd_play',
                    launchConfig: {
                        question: interactiveType === 'trivia_break' ? 'Quick room trivia check-in' : 'Crowd interaction moment',
                        optionsCsv: 'Option A, Option B, Option C'
                    }
                }
            }));
        }
        if (bufferPositions.has(index)) {
            items.push(createGeneratedBlock('buffer', {
                title: 'Recovery Buffer',
                plannedDurationSec: bufferDuration,
                notes: 'Use this if the room needs a timing reset.'
            }));
        }
    }
    items.push(createGeneratedBlock('closing', {
        title: 'Closing Moment',
        plannedDurationSec: 60,
        presentationPlan: { headline: 'Thanks for Singing', subhead: 'Wrap the night and point guests to the next event.' }
    }));
    return items;
};

const ReadinessPanel = ({ readiness = null, compact = false }) => {
    if (!readiness) return null;
    const blockers = formatChecklist(readiness.blockers);
    const advisories = blockers.length ? [] : formatChecklist(readiness.advisories);
    if (!blockers.length && !advisories.length) {
        return <div className={`rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 ${compact ? 'text-xs' : 'text-sm'} text-emerald-100`}>Ready for automation.</div>;
    }
    if (compact) {
        return (
            <div className="flex flex-wrap gap-2">
                {blockers.length ? (
                    <span className="rounded-full border border-amber-300/25 bg-amber-500/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
                        {blockers.length} blocker{blockers.length === 1 ? '' : 's'}
                    </span>
                ) : null}
                {advisories.length ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                        {advisories.length} polish note{advisories.length === 1 ? '' : 's'}
                    </span>
                ) : null}
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {blockers.length ? (
                <div className={`rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 ${compact ? 'text-xs' : 'text-sm'} text-amber-100`}>
                    <div className="font-semibold uppercase tracking-[0.14em] text-amber-50/90">Needs Attention</div>
                    <div className="mt-2 space-y-1.5">
                        {blockers.map((entry) => <div key={entry.key}>- {entry.label}</div>)}
                    </div>
                </div>
            ) : null}
            {advisories.length ? (
                <div className={`rounded-2xl border border-cyan-300/18 bg-cyan-500/10 px-3 py-2 ${compact ? 'text-xs' : 'text-sm'} text-cyan-100`}>
                    <div className="font-semibold uppercase tracking-[0.14em] text-cyan-50/90">Suggested Polish</div>
                    <div className="mt-2 space-y-1.5">
                        {advisories.map((entry) => <div key={entry.key}>- {entry.label}</div>)}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const itemSummary = (item = {}) => {
    if (item?.type === 'performance') {
        const performer = String(item?.assignedPerformerName || '').trim();
        const song = String(item?.songTitle || '').trim();
        const artist = String(item?.artistName || '').trim();
        return [performer, song, artist].filter(Boolean).join(' · ') || 'Performer and song still open';
    }
    if (item?.type === 'announcement' || item?.type === 'intro' || item?.type === 'closing') {
        return item?.presentationPlan?.headline || item?.notes || 'Presentation block';
    }
    if (item?.type === 'trivia_break' || item?.type === 'would_you_rather_break' || item?.type === 'game_break') {
        return item?.modeLaunchPlan?.launchConfig?.question || item?.modeLaunchPlan?.modeKey || 'Interactive break';
    }
    if (item?.roomMomentPlan) {
        return compactMomentSummary(item.roomMomentPlan) || item?.notes || 'Room moment';
    }
    return item?.notes || 'General show block';
};
const getEffectiveSuggestionSourceType = (sourceType = '') => {
    const safe = String(sourceType || '').trim().toLowerCase();
    if (safe === 'canonical_default' || safe === 'manual_external' || !safe) return 'youtube';
    return safe;
};
const getPerformerFieldLabel = (performerMode = '') => (
    performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? 'Performer Display Name' : 'Performer Display Name'
);
const getPerformerFieldPlaceholder = (performerMode = '') => {
    if (performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission) return 'Approved singer fills this in';
    if (performerMode === RUN_OF_SHOW_PERFORMER_MODES.placeholder) return 'Singer TBD, VIP Guest, Auction Winner';
    return 'Singer name for the room';
};
const getPerformerModeHint = (performerMode = '') => {
    if (performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission) return 'Leave this open and approve a singer into the slot later.';
    if (performerMode === RUN_OF_SHOW_PERFORMER_MODES.placeholder) return 'Use one placeholder name now, then bind a real attendee when the lobby fills.';
    return 'Lock this slot to a specific attendee or type the stage name directly.';
};

const getPerformanceIdentityFields = (item = {}) => ([
    {
        key: 'performer',
        label: 'Performer',
        value: String(item?.assignedPerformerName || '').trim(),
        fallback: 'Missing performer',
    },
    {
        key: 'song',
        label: 'Song',
        value: String(item?.songTitle || '').trim(),
        fallback: 'Missing song',
    },
    {
        key: 'artist',
        label: 'Artist',
        value: String(item?.artistName || '').trim(),
        fallback: 'Missing artist',
    },
]);

const getSourceMeta = (sourceType = '') => (
    BACKING_SOURCE_OPTIONS.find((option) => option.value === sourceType) || BACKING_SOURCE_OPTIONS[0]
);

const ControlButton = ({ children, tone = 'default', className = '', ...props }) => {
    const toneClass = tone === 'primary'
        ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100'
        : tone === 'success'
            ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
            : tone === 'warning'
                ? 'border-amber-300/35 bg-amber-500/12 text-amber-100'
                : tone === 'danger'
                    ? 'border-rose-300/35 bg-rose-500/12 text-rose-100'
                    : 'border-white/10 bg-white/5 text-zinc-100';
    return <button type="button" {...props} className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-1.5 min-h-[42px] touch-manipulation text-[10px] font-black uppercase tracking-[0.18em] disabled:opacity-40 ${toneClass} ${className}`}>{children}</button>;
};

const RunOfShowAdvanceModePicker = ({
    item = {},
    onUpdateItem,
    disabled = false,
    helper = 'During the show, use the live strip to change this without reopening the editor.'
}) => {
    const advanceMode = getRunOfShowAdvanceMode(item);
    const minimumSec = getRunOfShowHostAdvanceMinSec(item);
    const setAdvanceMode = (nextMode = RUN_OF_SHOW_ADVANCE_MODES.auto) => {
        if (typeof onUpdateItem !== 'function' || !item?.id) return;
        onUpdateItem(item.id, {
            advanceMode: nextMode,
            requireHostAdvance: nextMode !== RUN_OF_SHOW_ADVANCE_MODES.auto,
            hostAdvanceMinSec: nextMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin
                ? Math.max(5, minimumSec || Number(item?.plannedDurationSec || 0) || 45)
                : 0
        });
    };
    const setMinimumSec = (nextValue = 0) => {
        if (typeof onUpdateItem !== 'function' || !item?.id) return;
        onUpdateItem(item.id, {
            advanceMode: RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin,
            requireHostAdvance: true,
            hostAdvanceMinSec: Math.max(0, Number(nextValue || 0))
        });
    };
    return (
        <div className="rounded-2xl border border-amber-300/18 bg-amber-500/8 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabel>Scene Progress</FieldLabel>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200">
                    {getAdvanceModeLabel(item)}
                </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                {[
                    [RUN_OF_SHOW_ADVANCE_MODES.auto, 'Auto-advance'],
                    [RUN_OF_SHOW_ADVANCE_MODES.host, 'Wait for me'],
                    [RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin, 'Wait at least...']
                ].map(([value, label]) => {
                    const active = advanceMode === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            disabled={disabled}
                            onClick={() => setAdvanceMode(value)}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${active ? 'border-amber-300/35 bg-amber-500/14 text-amber-50' : 'border-white/10 bg-black/25 text-zinc-200 hover:border-amber-300/25'}`}
                        >
                            {label}
                        </button>
                    );
                })}
                {advanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin ? (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-2.5 py-1">
                        <input
                            type="number"
                            min="5"
                            step="5"
                            value={minimumSec}
                            onChange={(e) => setMinimumSec(e.target.value)}
                            disabled={disabled}
                            className="w-16 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-black text-white disabled:opacity-40"
                            aria-label="Minimum live time in seconds"
                        />
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">sec</span>
                    </div>
                ) : null}
            </div>
            <div className="mt-2 text-xs text-amber-100/75">{helper}</div>
        </div>
    );
};

const TAKEOVER_SOUNDTRACK_SOURCE_META = Object.freeze({
    youtube: {
        label: 'YouTube',
        primaryFieldLabel: 'YouTube ID',
        primaryPlaceholder: 'dQw4w9WgXcQ',
        secondaryFieldLabel: 'Fallback Media URL',
        secondaryPlaceholder: 'Optional direct video URL'
    },
    apple_music: {
        label: 'Apple Music',
        primaryFieldLabel: 'Apple Music Track ID',
        primaryPlaceholder: 'pl.u-...'
    },
    bg_track: {
        label: 'Built-In BG Track',
        primaryFieldLabel: 'Background Track',
        primaryPlaceholder: ''
    },
    manual_external: {
        label: 'Direct Media URL',
        primaryFieldLabel: 'Media URL',
        primaryPlaceholder: 'https://...'
    }
});

const getTakeoverSoundtrackSourceMeta = (sourceType = '') => (
    TAKEOVER_SOUNDTRACK_SOURCE_META[String(sourceType || '').trim().toLowerCase()] || null
);

const ROOM_OVERLAY_OPTIONS = Object.freeze([
    { value: 'stage', label: 'Stage' },
    { value: 'leaderboard', label: 'Leaderboard' },
    { value: 'tipping', label: 'Tip CTA' }
]);

const ROOM_MODE_OPTIONS = Object.freeze([
    { value: '', label: 'None' },
    { value: 'selfie_cam', label: 'Selfie Cam' }
]);

const ROOM_LIGHTING_OPTIONS = Object.freeze([
    { value: 'off', label: 'Off' },
    { value: 'ballad', label: 'Ballad' },
    { value: 'banger', label: 'Banger' }
]);

const RunOfShowTakeoverSoundtrackEditor = ({
    presentationPlan = {},
    audioPlan = {},
    matchedTakeoverPreset = null,
    customizeOpen = false,
    onToggleCustomize,
    onUpdatePresentationPlan,
    onUpdateAudioPlan,
    disabled = false
}) => {
    const sourceType = String(presentationPlan?.soundtrackSourceType || '').trim().toLowerCase();
    const sourceMeta = getTakeoverSoundtrackSourceMeta(sourceType);
    const sourceLabel = sourceMeta?.label || 'None';
    const selectedBgTrack = sourceType === 'bg_track'
        ? getBgTrackById(presentationPlan?.soundtrackBgTrackId || '')
        : null;
    const primaryValue = sourceType === 'youtube'
        ? (presentationPlan?.soundtrackYoutubeId || '')
        : sourceType === 'apple_music'
            ? (presentationPlan?.soundtrackAppleMusicId || '')
            : sourceType === 'bg_track'
                ? (presentationPlan?.soundtrackBgTrackId || '')
            : (presentationPlan?.soundtrackMediaUrl || '');
    const setSourceType = (nextType = '') => {
        if (typeof onUpdatePresentationPlan !== 'function') return;
        onUpdatePresentationPlan({
            soundtrackSourceType: nextType,
            soundtrackYoutubeId: nextType === 'youtube' ? (presentationPlan?.soundtrackYoutubeId || '') : '',
            soundtrackAppleMusicId: nextType === 'apple_music' ? (presentationPlan?.soundtrackAppleMusicId || '') : '',
            soundtrackBgTrackId: nextType === 'bg_track' ? (presentationPlan?.soundtrackBgTrackId || '') : '',
            soundtrackMediaUrl: nextType === 'manual_external'
                ? (presentationPlan?.soundtrackMediaUrl || '')
                : nextType === 'youtube'
                    ? (presentationPlan?.soundtrackMediaUrl || '')
                    : nextType === 'bg_track'
                        ? (selectedBgTrack?.url || presentationPlan?.soundtrackMediaUrl || '')
                        : '',
        });
    };
    const setPrimaryValue = (nextValue = '') => {
        if (typeof onUpdatePresentationPlan !== 'function') return;
        if (sourceType === 'youtube') {
            onUpdatePresentationPlan({ soundtrackYoutubeId: nextValue });
            return;
        }
        if (sourceType === 'apple_music') {
            onUpdatePresentationPlan({ soundtrackAppleMusicId: nextValue });
            return;
        }
        if (sourceType === 'bg_track') {
            const nextTrack = getBgTrackById(nextValue);
            onUpdatePresentationPlan({
                soundtrackBgTrackId: nextValue,
                soundtrackMediaUrl: nextTrack?.url || ''
            });
            return;
        }
        onUpdatePresentationPlan({ soundtrackMediaUrl: nextValue });
    };
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Takeover Soundtrack</div>
                    <div className="mt-1 text-sm text-zinc-300">Attach one track for this scene, then open more options only when you need labels, ducking, or fallback media.</div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200">
                        {sourceLabel}
                    </span>
                    <button
                        type="button"
                        onClick={onToggleCustomize}
                        disabled={disabled}
                        className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${customizeOpen ? 'border-cyan-300/28 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-black/25 text-zinc-300'}`}
                    >
                        {customizeOpen ? 'Hide Soundtrack Options' : 'Soundtrack Options'}
                    </button>
                </div>
            </div>
            {matchedTakeoverPreset?.soundtrackHint ? (
                <div className="mt-2 text-xs text-zinc-400">{matchedTakeoverPreset.soundtrackHint}</div>
            ) : null}
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                    <FieldLabel>Source</FieldLabel>
                    <SelectControl
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                        disabled={disabled}
                        className={textInputClass}
                    >
                        <option value="">None</option>
                        <option value="youtube">YouTube</option>
                        <option value="apple_music">Apple Music</option>
                        <option value="bg_track">Built-In BG Track</option>
                        <option value="manual_external">Direct Media URL</option>
                    </SelectControl>
                </div>
                {sourceMeta ? (
                    <div className="md:col-span-1 xl:col-span-2">
                        <FieldLabel>{sourceMeta.primaryFieldLabel}</FieldLabel>
                        {sourceType === 'bg_track' ? (
                            <SelectControl
                                value={primaryValue}
                                onChange={(e) => setPrimaryValue(e.target.value)}
                                disabled={disabled}
                                className={textInputClass}
                            >
                                <option value="">Choose a built-in background track</option>
                                {BG_TRACK_OPTIONS.map((track) => (
                                    <option key={track.id} value={track.id}>{track.name}</option>
                                ))}
                            </SelectControl>
                        ) : (
                            <input
                                value={primaryValue}
                                onChange={(e) => setPrimaryValue(e.target.value)}
                                disabled={disabled}
                                className={textInputClass}
                                placeholder={sourceMeta.primaryPlaceholder}
                            />
                        )}
                        {sourceType === 'bg_track' ? (
                            <div className="mt-2 text-xs text-zinc-500">
                                {selectedBgTrack?.name
                                    ? `${selectedBgTrack.name} will play from the built-in BeauRocks background-track library.`
                                    : 'Choose from the built-in BeauRocks background tracks.'}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="md:col-span-1 xl:col-span-2 rounded-2xl border border-dashed border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-500">
                        Pick a soundtrack source when this scene needs takeover audio.
                    </div>
                )}
            </div>
            {customizeOpen ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="xl:col-span-2">
                        <FieldLabel>Now Playing Label</FieldLabel>
                        <input
                            value={presentationPlan?.soundtrackLabel || ''}
                            onChange={(e) => onUpdatePresentationPlan?.({ soundtrackLabel: e.target.value })}
                            disabled={disabled}
                            className={textInputClass}
                            placeholder="Optional now playing label"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-300 pt-7">
                        <input
                            type="checkbox"
                            checked={presentationPlan?.soundtrackAutoPlay === true}
                            onChange={(e) => onUpdatePresentationPlan?.({ soundtrackAutoPlay: e.target.checked })}
                            disabled={disabled}
                        />
                        Auto-play soundtrack
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-300 pt-7">
                        <input
                            type="checkbox"
                            checked={audioPlan?.duckBackingEnabled === true}
                            onChange={(e) => onUpdateAudioPlan?.({ duckBackingEnabled: e.target.checked })}
                            disabled={disabled}
                        />
                        Duck backing audio
                    </label>
                    {audioPlan?.duckBackingEnabled === true ? (
                        <div>
                            <FieldLabel>Duck Level %</FieldLabel>
                            <input
                                type="number"
                                value={audioPlan?.duckLevelPct ?? 35}
                                onChange={(e) => onUpdateAudioPlan?.({ duckLevelPct: Number(e.target.value || 0) })}
                                disabled={disabled}
                                className={textInputClass}
                            />
                        </div>
                    ) : null}
                    {sourceType === 'youtube' ? (
                        <div className="md:col-span-2 xl:col-span-4">
                            <FieldLabel>{sourceMeta?.secondaryFieldLabel || 'Fallback Media URL'}</FieldLabel>
                            <input
                                value={presentationPlan?.soundtrackMediaUrl || ''}
                                onChange={(e) => onUpdatePresentationPlan?.({ soundtrackMediaUrl: e.target.value })}
                                disabled={disabled}
                                className={textInputClass}
                                placeholder={sourceMeta?.secondaryPlaceholder || 'Optional direct video URL'}
                            />
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

const SelectControl = ({ children, className = '', ...props }) => (
    <div className="group relative">
        <select {...props} className={`${selectInputClass} border-cyan-300/18 bg-gradient-to-r from-black/45 to-zinc-900/70 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.04)] transition group-hover:border-cyan-300/35 ${className}`}>
            {children}
        </select>
        <span className="pointer-events-none absolute inset-y-1 right-1 flex items-center rounded-xl border border-white/10 bg-black/35 px-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/85">
            Menu
            <i className="fa-solid fa-chevron-down"></i>
        </span>
    </div>
);

const RunOfShowRoomBehaviorEditor = ({
    item = {},
    onUpdateItem,
    disabled = false,
    customizeOpen = false,
    onToggleCustomize
}) => {
    const roomMomentPlan = item?.roomMomentPlan && typeof item.roomMomentPlan === 'object' ? item.roomMomentPlan : {};
    const activeScreen = String(roomMomentPlan?.activeScreen || '').trim() || 'stage';
    const activeMode = String(roomMomentPlan?.activeMode || '').trim();
    const lightMode = String(roomMomentPlan?.lightMode || 'off').trim() || 'off';
    const updateRoomMomentPlan = (patch = {}) => {
        if (typeof onUpdateItem !== 'function' || !item?.id) return;
        onUpdateItem(item.id, { roomMomentPlan: { ...(roomMomentPlan || {}), ...(patch || {}) } });
    };
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Room Behavior</div>
                    <div className="mt-1 text-sm text-zinc-300">Set what the room should see first, then open more options only when this scene needs lighting or a how-to overlay.</div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200">
                        {compactMomentSummary(roomMomentPlan) || 'Stage only'}
                    </span>
                    <button
                        type="button"
                        onClick={onToggleCustomize}
                        disabled={disabled}
                        className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${customizeOpen ? 'border-amber-300/28 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-black/25 text-zinc-300'}`}
                    >
                        {customizeOpen ? 'Hide Room Options' : 'Room Options'}
                    </button>
                </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                    <FieldLabel>TV Overlay</FieldLabel>
                    <SelectControl
                        value={activeScreen}
                        onChange={(e) => updateRoomMomentPlan({ activeScreen: e.target.value === 'stage' ? '' : e.target.value })}
                        disabled={disabled}
                        className={textInputClass}
                    >
                        {ROOM_OVERLAY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </SelectControl>
                </div>
                <div>
                    <FieldLabel>Phone / Room Mode</FieldLabel>
                    <SelectControl
                        value={activeMode}
                        onChange={(e) => updateRoomMomentPlan({ activeMode: e.target.value })}
                        disabled={disabled}
                        className={textInputClass}
                    >
                        {ROOM_MODE_OPTIONS.map((option) => (
                            <option key={option.value || 'none'} value={option.value}>{option.label}</option>
                        ))}
                    </SelectControl>
                </div>
            </div>
            {customizeOpen ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                        <FieldLabel>Vibe Lighting</FieldLabel>
                        <SelectControl
                            value={lightMode}
                            onChange={(e) => updateRoomMomentPlan({ lightMode: e.target.value })}
                            disabled={disabled}
                            className={textInputClass}
                        >
                            {ROOM_LIGHTING_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </SelectControl>
                    </div>
                    <label className="flex items-center gap-2 rounded-2xl bg-black/10 px-3 py-2 text-sm text-zinc-300 md:col-span-1 xl:col-span-2 xl:mt-6">
                        <input
                            type="checkbox"
                            checked={roomMomentPlan?.showHowToPlay === true}
                            onChange={(e) => updateRoomMomentPlan({ showHowToPlay: e.target.checked })}
                            disabled={disabled}
                        />
                        Show How To Play overlay
                    </label>
                </div>
            ) : null}
        </div>
    );
};

const QuickInlineSceneEditor = ({ item = {}, onUpdateItem, disabled = false }) => {
    const isPerformance = String(item?.type || '').trim().toLowerCase() === 'performance';
    const audioPlan = item?.audioPlan && typeof item.audioPlan === 'object' ? item.audioPlan : {};
    return (
        <div className="rounded-2xl border border-cyan-300/16 bg-cyan-500/8 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/80">Inline scene edits</div>
                    <div className="mt-1 text-sm text-zinc-200">Update the fields hosts touch most without leaving the scene card.</div>
                </div>
                <div className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                    {getRunOfShowItemLabel(item?.type)}
                </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="md:col-span-2">
                    <FieldLabel>Title</FieldLabel>
                    <div className="mt-1">
                        <input
                            value={item?.title || ''}
                            onChange={(e) => onUpdateItem?.(item.id, { title: e.target.value })}
                            disabled={disabled}
                            className={textInputClass}
                            placeholder={getRunOfShowItemLabel(item?.type)}
                        />
                    </div>
                </div>
                <div>
                    <FieldLabel>Duration Sec</FieldLabel>
                    <div className="mt-1">
                        <input
                            type="number"
                            min="0"
                            value={item?.plannedDurationSec || 0}
                            onChange={(e) => onUpdateItem?.(item.id, { plannedDurationSec: Math.max(0, Number(e.target.value || 0)) })}
                            disabled={disabled}
                            className={textInputClass}
                        />
                    </div>
                </div>
                {isPerformance ? (
                    <div>
                        <FieldLabel>Singer</FieldLabel>
                        <div className="mt-1">
                            <input
                                value={item?.assignedPerformerName || ''}
                                onChange={(e) => onUpdateItem?.(item.id, { assignedPerformerName: e.target.value })}
                                disabled={disabled}
                                className={textInputClass}
                                placeholder="Singer TBD"
                            />
                        </div>
                    </div>
                ) : null}
                {isPerformance ? (
                    <div>
                        <FieldLabel>Song</FieldLabel>
                        <div className="mt-1">
                            <input
                                value={item?.songTitle || ''}
                                onChange={(e) => onUpdateItem?.(item.id, { songTitle: e.target.value })}
                                disabled={disabled}
                                className={textInputClass}
                                placeholder="Song title"
                            />
                        </div>
                    </div>
                ) : null}
                {isPerformance ? (
                    <div>
                        <FieldLabel>Artist</FieldLabel>
                        <div className="mt-1">
                            <input
                                value={item?.artistName || ''}
                                onChange={(e) => onUpdateItem?.(item.id, { artistName: e.target.value })}
                                disabled={disabled}
                                className={textInputClass}
                                placeholder="Artist"
                            />
                        </div>
                    </div>
                ) : null}
                <div>
                    <FieldLabel>Scene Cue</FieldLabel>
                    <div className="mt-1">
                        <SelectControl
                            value={audioPlan?.momentCueId || ''}
                            onChange={(e) => onUpdateItem?.(item.id, {
                                audioPlan: {
                                    ...(audioPlan || {}),
                                    momentCueId: e.target.value,
                                    momentCueAutoFire: e.target.value ? (audioPlan?.momentCueAutoFire ?? true) : false
                                }
                            })}
                            disabled={disabled}
                        >
                            <option value="">No cue</option>
                            {MOMENT_CUE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </SelectControl>
                    </div>
                </div>
            </div>
            <div className="mt-3 text-xs text-zinc-400">
                Open the full editor when this scene needs public-TV treatment, soundtrack, room behavior, or slot policy changes.
            </div>
        </div>
    );
};

const RunOfShowMomentCueFields = ({ item = {}, onUpdateItem, disabled = false }) => {
    const audioPlan = item?.audioPlan && typeof item.audioPlan === 'object' ? item.audioPlan : {};
    const cueId = String(audioPlan?.momentCueId || '').trim().toLowerCase();
    const cueTiming = String(audioPlan?.momentCueTiming || 'start').trim().toLowerCase() || 'start';
    const autoFire = audioPlan?.momentCueAutoFire === true;
    const activeCue = getHostMomentCueMeta(cueId);
    const hasCustomCueOptions = Boolean(cueId) && (cueTiming !== 'start' || autoFire === false);
    const [customizeOpen, setCustomizeOpen] = useState(hasCustomCueOptions);
    useEffect(() => {
        if (hasCustomCueOptions) setCustomizeOpen(true);
    }, [hasCustomCueOptions, item?.id]);
    const setCueId = (nextCueId = '') => {
        onUpdateItem?.(item.id, {
            audioPlan: {
                ...(audioPlan || {}),
                momentCueId: nextCueId,
                momentCueTiming: nextCueId ? (audioPlan?.momentCueTiming || 'start') : 'start',
                momentCueAutoFire: nextCueId ? (audioPlan?.momentCueAutoFire ?? true) : false
            }
        });
    };
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Scene Cue</div>
                    <div className="mt-1 text-sm text-zinc-300">Pick one short room beat for this scene, then only open more options when timing or manual triggering needs to change.</div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${activeCue?.chipClass || 'border-white/10 bg-black/20 text-zinc-200'}`}>
                        {cueId ? cueSummaryLabel(audioPlan) : 'No cue'}
                    </span>
                    <button
                        type="button"
                        onClick={() => setCustomizeOpen((current) => !current)}
                        disabled={disabled || !cueId}
                        className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${customizeOpen && cueId ? 'border-fuchsia-300/28 bg-fuchsia-500/10 text-fuchsia-100' : 'border-white/10 bg-black/25 text-zinc-300'}`}
                    >
                        {customizeOpen && cueId ? 'Hide Cue Options' : 'Cue Options'}
                    </button>
                </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                    <FieldLabel>Cue</FieldLabel>
                    <SelectControl
                        value={cueId}
                        onChange={(event) => setCueId(event.target.value)}
                        disabled={disabled}
                    >
                        <option value="">No cue</option>
                        {MOMENT_CUE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </SelectControl>
                    {activeCue?.editorHint ? (
                        <div className="mt-2 text-xs text-zinc-500">{activeCue.editorHint}</div>
                    ) : (
                        <div className="mt-2 text-xs text-zinc-500">Leave this empty when the scene should stay clean and unpunctuated.</div>
                    )}
                </div>
                {cueId ? (
                    <div className={`rounded-2xl border px-3 py-3 text-sm ${activeCue?.toneClass || 'border-white/10 bg-black/20 text-zinc-200'}`}>
                        <div className="flex items-center gap-2">
                            <i className={`fa-solid ${activeCue?.icon || 'fa-bolt'}`}></i>
                            <span className="font-semibold text-white">{activeCue?.label || cueId}</span>
                        </div>
                        <div className="mt-1 text-xs text-current/80">{activeCue?.detail || 'Short room punctuation for this scene.'}</div>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-500">
                        No cue attached.
                    </div>
                )}
            </div>
            {customizeOpen && cueId ? (
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div>
                        <FieldLabel>Timing</FieldLabel>
                        <SelectControl
                            value={cueTiming}
                            onChange={(event) => onUpdateItem?.(item.id, {
                                audioPlan: {
                                    ...(audioPlan || {}),
                                    momentCueTiming: event.target.value
                                }
                            })}
                            disabled={disabled}
                        >
                            {MOMENT_CUE_TIMING_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </SelectControl>
                    </div>
                    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-200">
                        <input
                            type="checkbox"
                            checked={autoFire}
                            onChange={(event) => onUpdateItem?.(item.id, {
                                audioPlan: {
                                    ...(audioPlan || {}),
                                    momentCueAutoFire: event.target.checked
                                }
                            })}
                            disabled={disabled}
                        />
                        <span>Auto-fire this cue</span>
                    </label>
                </div>
            ) : null}
            {cueId ? (
                <div className="mt-3 rounded-xl bg-black/15 px-3 py-2 text-xs text-zinc-400">
                    {autoFire
                        ? `This scene will trigger ${cueSummaryLabel(audioPlan)} automatically.`
                        : 'Cue selected, but auto-fire is off. Turn it on when you want this beat to trigger on its own.'}
                </div>
            ) : null}
        </div>
    );
};

const CollapsiblePanel = ({ label, title, summary = '', open = false, onToggle, children, badge = '', tone = 'zinc', compact = false }) => {
    const toneClass = tone === 'cyan'
        ? 'border-cyan-300/22 bg-cyan-500/8'
        : tone === 'violet'
            ? 'border-violet-300/22 bg-violet-500/8'
            : tone === 'amber'
                ? 'border-amber-300/22 bg-amber-500/8'
                : 'border-white/10 bg-black/25';
    return (
        <div className={`rounded-2xl border ${toneClass} ${compact ? 'px-3 py-3' : 'p-3'}`}>
            <button
                type="button"
                onClick={onToggle}
                className="flex min-h-[52px] w-full touch-manipulation items-center justify-between gap-3 text-left"
                aria-expanded={open}
            >
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
                        {badge ? (
                            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                {badge}
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">{title}</div>
                    {summary ? <div className="mt-1 text-xs text-zinc-400">{summary}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-300">
                        {open ? 'Collapse' : 'Expand'}
                    </span>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-zinc-200 transition ${open ? 'rotate-180' : ''}`}>
                        <i className="fa-solid fa-chevron-down"></i>
                    </span>
                </div>
            </button>
            {open ? <div className="mt-4">{children}</div> : null}
        </div>
    );
};

const BoardCard = ({ label, item, readiness, emptyLabel, actionLabel, actionTone, onAction }) => (
    <article className={`${surfaceClass} p-3`}>
        <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">{label}</div>
        {item ? (
            <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(item.status)}`}>{item.status}</span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">{getRunOfShowItemLabel(item.type)}</span>
                </div>
                <div className="text-lg font-bold text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                <div className="text-sm text-zinc-300">{itemSummary(item)}</div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">{formatStart(item.startsAtMs)} · {Math.max(0, Number(item.plannedDurationSec || 0))} sec</div>
                <ReadinessPanel readiness={readiness} compact />
                {actionLabel ? <ControlButton tone={actionTone} onClick={onAction}>{actionLabel}</ControlButton> : null}
            </div>
        ) : <div className="mt-3 text-sm text-zinc-400">{emptyLabel}</div>}
    </article>
);

const OperationsStat = ({ label, value, tone = 'zinc', detail = '' }) => (
    <div className={`rounded-2xl border px-3 py-3 ${sourceTone(tone, false)}`}>
        <div className="text-[10px] uppercase tracking-[0.18em] text-current/70">{label}</div>
        <div className="mt-1 text-lg font-black text-white">{value}</div>
        {detail ? <div className="mt-1 text-xs text-current/80">{detail}</div> : null}
    </div>
);

const IssueJumpRail = ({ issues = [], onJump }) => {
    const activeIssues = issues.filter((entry) => Number(entry?.count || 0) > 0);
    if (!activeIssues.length) return null;
    return (
        <div className="rounded-[22px] border border-amber-300/16 bg-[linear-gradient(135deg,rgba(41,26,12,0.92),rgba(19,20,34,0.96))] px-3 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">Issue Rail</div>
                    <div className="mt-1 text-xs text-zinc-300">Jump straight to the first slot that still needs attention.</div>
                </div>
                <div className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">
                    {activeIssues.reduce((sum, entry) => sum + Number(entry.count || 0), 0)} open
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {activeIssues.map((issue) => (
                    <button
                        key={issue.key}
                        type="button"
                        onClick={() => onJump?.(issue)}
                        className="rounded-full border border-amber-300/25 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-50 transition hover:border-amber-200/45 hover:bg-amber-500/12"
                    >
                        {issue.count} {issue.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

const CompactTimelineOverview = ({
    items = [],
    currentItemId = '',
    liveItemId = '',
    stagedItemId = '',
    nextItemId = '',
    readinessById = {},
    pendingCountsById = {},
    onFocus,
    showHeader = true,
    canEditFlow = false,
    selectedItemId = '',
    onMoveItem,
    onDeleteItem,
    onSkipItem,
    dragState = null,
    onDragStart,
    onDragEnd,
    onDragTarget,
    onDropItem,
}) => {
    const segments = buildTimelineSegments(items);
    const activeSegment = segments.find((entry) => entry.item.id === (liveItemId || stagedItemId || currentItemId || nextItemId)) || segments[0] || null;
    const activePlayheadPct = activeSegment ? Math.min(98, Math.max(1, activeSegment.startPct)) : 0;
    const selectedTimelineItem = items.find((item) => item.id === selectedItemId) || items.find((item) => item.id === currentItemId) || null;
    const selectedIndex = selectedTimelineItem ? items.findIndex((item) => item.id === selectedTimelineItem.id) : -1;

    if (!segments.length) {
        return (
            <div className="rounded-[22px] border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-400">
                Add scenes to block out the night.
            </div>
        );
    }

    return (
        <div className="rounded-[22px] border border-white/10 bg-black/25 px-3 py-3">
            {showHeader ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Show Map</div>
                        <div className="mt-1 text-xs text-zinc-400">Current block, next block, and the rest of the timeline stay visible while you work.</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-300">
                        {items.length} scene{items.length === 1 ? '' : 's'}
                    </div>
                </div>
            ) : null}
            <div className={`relative overflow-x-auto pb-1 ${showHeader ? 'mt-3' : ''}`}>
                <div className="relative min-w-[960px] rounded-[20px] border border-white/10 bg-zinc-950/80 p-2">
                    <div className="absolute inset-y-2 left-2 right-2 rounded-[16px] bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:12.5%_100%]"></div>
                    {activePlayheadPct ? <div className="absolute top-2 bottom-2 z-[1] w-[2px] bg-cyan-300/90 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]" style={{ left: `${activePlayheadPct}%` }}></div> : null}
                    <div className="relative h-[74px]">
                        {segments.map((segment) => {
                            const item = segment.item;
                            const readiness = readinessById[item.id] || null;
                            const pendingCount = Number(pendingCountsById[item.id] || 0);
                            const visual = getItemVisual(item.type);
                            const label = item.id === liveItemId ? 'Live' : item.id === stagedItemId ? 'Staged' : item.id === nextItemId ? 'Next' : `#${segment.index + 1}`;
                            const blocked = Array.isArray(readiness?.blockers) && readiness.blockers.length > 0;
                            const needsAttention = blocked || pendingCount > 0;
                            const isDragging = dragState?.itemId === item.id;
                            const targetBefore = dragState?.itemId && dragState?.targetId === item.id && dragState?.position === 'before';
                            const targetAfter = dragState?.itemId && dragState?.targetId === item.id && dragState?.position === 'after';
                            return (
                                <div
                                    key={item.id}
                                    data-compact-timeline-item-id={item.id}
                                    draggable={canEditFlow}
                                    onDragStart={(event) => {
                                        if (!canEditFlow) return;
                                        event.dataTransfer.effectAllowed = 'move';
                                        onDragStart?.(event, item.id);
                                    }}
                                    onDragEnd={() => onDragEnd?.()}
                                    onDragOver={(event) => {
                                        if (!canEditFlow) return;
                                        event.preventDefault();
                                        const bounds = event.currentTarget.getBoundingClientRect();
                                        const position = event.clientX < bounds.left + (bounds.width / 2) ? 'before' : 'after';
                                        onDragTarget?.(item.id, position);
                                    }}
                                    onDrop={(event) => {
                                        if (!canEditFlow) return;
                                        event.preventDefault();
                                        onDropItem?.(item.id, dragState?.position || 'after');
                                    }}
                                    className={`absolute top-0 bottom-0 rounded-[18px] border p-2 text-left transition ${
                                        item.id === currentItemId || item.id === liveItemId
                                            ? 'border-cyan-300/45 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
                                            : needsAttention
                                                ? 'border-amber-300/40 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]'
                                                : 'border-white/10'
                                    } ${isDragging ? 'opacity-45' : ''}`}
                                    style={{
                                        left: `${segment.startPct}%`,
                                        width: `${segment.widthPct}%`,
                                        minWidth: 118,
                                        background: needsAttention ? 'rgba(58,26,8,0.42)' : 'rgba(9,11,18,0.82)'
                                    }}
                                >
                                    {targetBefore ? <div className="absolute -left-2 top-2 bottom-2 z-[2] w-1 rounded-full bg-cyan-300 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]"></div> : null}
                                    {targetAfter ? <div className="absolute -right-2 top-2 bottom-2 z-[2] w-1 rounded-full bg-cyan-300 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]"></div> : null}
                                    <button
                                        type="button"
                                        onClick={() => onFocus?.(item.id)}
                                        className={`relative flex h-full w-full flex-col justify-between rounded-[14px] border ${needsAttention ? 'border-amber-300/22' : 'border-white/10'} bg-gradient-to-br ${visual.tone} px-2 py-1.5 text-left`}
                                    >
                                        {needsAttention ? <div className="absolute inset-y-2 left-1 w-1 rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-rose-400"></div> : null}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-xl border ${visual.chip}`}>
                                                    <i className={`fa-solid ${visual.icon}`}></i>
                                                </span>
                                                {canEditFlow ? (
                                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-200">
                                                        <i className="fa-solid fa-grip-lines"></i>
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-1">
                                                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${statusTone(item.status)}`}>{label}</span>
                                                {blocked ? <span className="rounded-full border border-amber-300/40 bg-amber-500/16 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-50"><i className="fa-solid fa-triangle-exclamation"></i></span> : null}
                                                {pendingCount > 0 ? <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-100">{pendingCount}</span> : null}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-xs font-black uppercase tracking-[0.04em] text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                                            <div className="mt-0.5 truncate text-[11px] text-zinc-100/70">{itemSummary(item)}</div>
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            {selectedTimelineItem ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-cyan-300/18 bg-cyan-500/6 px-3 py-2.5">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/80">Timeline Actions</div>
                        <div className="mt-1 truncate text-sm font-black text-white">{selectedTimelineItem.title || getRunOfShowItemLabel(selectedTimelineItem.type)}</div>
                        <div className="text-xs text-zinc-400">Drag the strip to resequence fast, or use these buttons when you need a precise nudge.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={!canEditFlow || selectedIndex <= 0}
                            onClick={() => onMoveItem?.(selectedTimelineItem.id, -1)}
                            className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-100 disabled:opacity-30"
                        >
                            <i className="fa-solid fa-arrow-left mr-1"></i>
                            Earlier
                        </button>
                        <button
                            type="button"
                            disabled={!canEditFlow || selectedIndex < 0 || selectedIndex >= items.length - 1}
                            onClick={() => onMoveItem?.(selectedTimelineItem.id, 1)}
                            className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-100 disabled:opacity-30"
                        >
                            Later
                            <i className="fa-solid fa-arrow-right ml-1"></i>
                        </button>
                        <button
                            type="button"
                            disabled={!canEditFlow || ['complete', 'skipped'].includes(String(selectedTimelineItem.status || '').toLowerCase())}
                            onClick={() => onSkipItem?.(selectedTimelineItem.id, { manualAdvance: true })}
                            className="rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100 disabled:opacity-30"
                        >
                            Skip
                        </button>
                        <button
                            type="button"
                            onClick={() => onFocus?.(selectedTimelineItem.id)}
                            className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100"
                        >
                            Details
                        </button>
                        <button
                            type="button"
                            disabled={!canEditFlow}
                            onClick={() => onDeleteItem?.(selectedTimelineItem.id)}
                            className="rounded-full border border-rose-300/25 bg-rose-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-rose-100 disabled:opacity-30"
                        >
                            <i className="fa-solid fa-trash mr-1"></i>
                            Remove
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const LiveHudCard = ({ label, item, summary = '', note = '', badge = '', badgeTone = 'zinc', emptyLabel = 'Nothing queued.', onFocus }) => {
    const badgeToneClass = badgeTone === 'danger'
        ? 'border-amber-300/25 bg-amber-500/12 text-amber-100'
        : badgeTone === 'success'
            ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-100'
            : 'border-white/10 bg-black/30 text-zinc-300';
    return (
        <article className={`${surfaceClass} p-4`} aria-label={`${label} live run of show card`}>
            <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">{label}</div>
                {item ? <button type="button" onClick={() => onFocus?.(item.id)} className="text-[10px] uppercase tracking-[0.18em] text-cyan-200 hover:text-white">Open</button> : null}
            </div>
            {item ? (
                <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(item.status)}`}>{item.status}</span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">{getRunOfShowItemLabel(item.type)}</span>
                        {badge ? <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeToneClass}`}>{badge}</span> : null}
                    </div>
                    <div className="text-lg font-bold text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                    <div className="text-sm text-zinc-300">{summary || itemSummary(item)}</div>
                    {note ? <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-300">{note}</div> : null}
                </div>
            ) : <div className="mt-3 text-sm text-zinc-400">{emptyLabel}</div>}
        </article>
    );
};

const UtilityDrawer = ({ eyebrow, title, summary, open = false, onToggle, children, badge = '' }) => (
    <CollapsiblePanel
        label={eyebrow}
        title={title}
        summary={summary}
        open={open}
        onToggle={onToggle}
        badge={badge}
        tone="cyan"
        compact
    >
        {children}
    </CollapsiblePanel>
);

const StoryboardTimeline = ({
    items = [],
    liveItemId = '',
    stagedItemId = '',
    nextItemId = '',
    currentItemId = '',
    readinessById = {},
    pendingCountsById = {},
    expandedItemId = '',
    canEditFlow = false,
    onFocus,
    onMoveItem,
    getPrimaryAction,
    dragState = null,
    onDragStart,
    onDragEnd,
    onDragTarget,
    onDropItem,
}) => (
    <article className={`${surfaceClass} p-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Sequence Composer</div>
                <div className="mt-1 text-sm text-zinc-300">Arrange scenes like a filmstrip, drag cards to reorder them, then open the inspector only for the shot you want to tune.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                    Drag to reorder
                </div>
                <div className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">
                    {items.length} block{items.length === 1 ? '' : 's'}
                </div>
            </div>
        </div>
        {items.length ? (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {items.map((item, index) => {
                    const visual = getItemVisual(item.type);
                    const readiness = readinessById[item.id] || null;
                    const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers.length : 0;
                    const pendingCount = Number(pendingCountsById[item.id] || 0);
                    const sceneLabel = item.id === liveItemId ? 'Now' : item.id === stagedItemId ? 'Staged' : item.id === nextItemId ? 'Up next' : `Slot ${index + 1}`;
                    const action = typeof getPrimaryAction === 'function' ? getPrimaryAction(item, readiness, { pendingCount }) : null;
                    const castLine = item.type === 'performance'
                        ? formatSummaryLine(item.assignedPerformerName || 'Singer TBD', item.songTitle || 'Song TBD', item.artistName || '')
                        : (item.modeLaunchPlan?.modeKey ? String(item.modeLaunchPlan.modeKey).replaceAll('_', ' ') : item.notes || getRunOfShowItemLabel(item.type));
                    const readinessLabel = blockers ? `${blockers} blocker${blockers === 1 ? '' : 's'}` : pendingCount ? `${pendingCount} pending` : 'Ready';
                    const isDragging = dragState?.itemId === item.id;
                    const targetBefore = dragState?.targetId === item.id && dragState?.position === 'before';
                    const targetAfter = dragState?.targetId === item.id && dragState?.position === 'after';
                    return (
                        <div key={item.id} className="flex items-center gap-3">
                            <div
                                className={`relative w-[280px] shrink-0 rounded-[28px] border p-3 transition ${item.id === liveItemId ? 'border-cyan-300/45 bg-cyan-500/10' : item.id === expandedItemId ? 'border-violet-300/30 bg-violet-500/8' : 'border-white/10 bg-black/20'} ${item.id === currentItemId ? 'shadow-[0_0_0_1px_rgba(34,211,238,0.2)]' : ''} ${isDragging ? 'opacity-45' : ''}`}
                                draggable={canEditFlow}
                                onDragStart={(event) => {
                                    if (event.target instanceof Element && event.target.closest('button, input, select, textarea, label')) {
                                        event.preventDefault();
                                        return;
                                    }
                                    onDragStart?.(event, item.id);
                                }}
                                onDragEnd={() => onDragEnd?.()}
                                onDragOver={(event) => {
                                    if (!canEditFlow) return;
                                    event.preventDefault();
                                    const bounds = event.currentTarget.getBoundingClientRect();
                                    const position = event.clientX < bounds.left + (bounds.width / 2) ? 'before' : 'after';
                                    onDragTarget?.(item.id, position);
                                }}
                                onDrop={(event) => {
                                    if (!canEditFlow) return;
                                    event.preventDefault();
                                    onDropItem?.(item.id, dragState?.position || 'after');
                                }}
                            >
                                {targetBefore ? <div className="absolute -left-2 top-6 bottom-6 w-1 rounded-full bg-cyan-300 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]"></div> : null}
                                {targetAfter ? <div className="absolute -right-2 top-6 bottom-6 w-1 rounded-full bg-cyan-300 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]"></div> : null}
                                <button
                                    type="button"
                                    onClick={() => onFocus?.(item.id)}
                                    className="block w-full text-left"
                                >
                                    <div className={`rounded-[24px] border border-white/10 bg-gradient-to-br ${visual.tone} px-3 py-3`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${visual.chip}`}>
                                                    <i className={`fa-solid ${visual.icon}`}></i>
                                                </div>
                                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-zinc-200">
                                                    <i className="fa-solid fa-grip-lines"></i>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-2">
                                                <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone(item.status)}`}>
                                                    {sceneLabel}
                                                </span>
                                                {item.id === expandedItemId ? (
                                                    <span className="rounded-full border border-violet-300/25 bg-violet-500/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">
                                                        Inspector
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="mt-4 text-lg font-black leading-tight text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                                        <div className="mt-2 min-h-[36px] text-sm text-zinc-100/80">{castLine || 'Add details'}</div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Length</div>
                                            <div className="mt-1 text-sm font-semibold text-white">{formatDurationSec(item.plannedDurationSec) || `${Math.max(0, Number(item.plannedDurationSec || 0))}s`}</div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Readiness</div>
                                            <div className={`mt-1 text-sm font-semibold ${blockers ? 'text-amber-100' : pendingCount ? 'text-amber-100' : 'text-emerald-100'}`}>{readinessLabel}</div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Advance</div>
                                            <div className="mt-1 text-sm font-semibold text-white">{getAdvanceModeLabel(item)}</div>
                                        </div>
                                    </div>
                                </button>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                        <i className="fa-solid fa-grip-lines mr-1"></i>
                                        Drag
                                    </span>
                                    <button
                                        type="button"
                                        disabled={!canEditFlow || index === 0}
                                        onClick={() => onMoveItem?.(item.id, -1)}
                                        className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 disabled:opacity-30"
                                    >
                                        <i className="fa-solid fa-arrow-left mr-1"></i>
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canEditFlow || index === items.length - 1}
                                        onClick={() => onMoveItem?.(item.id, 1)}
                                        className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 disabled:opacity-30"
                                    >
                                        Next
                                        <i className="fa-solid fa-arrow-right ml-1"></i>
                                    </button>
                                    {action ? (
                                        <ControlButton tone={action.tone} onClick={action.onClick}>{action.label}</ControlButton>
                                    ) : null}
                                </div>
                            </div>
                            {index < items.length - 1 ? <div className="shrink-0 text-cyan-200/60"><i className="fa-solid fa-arrow-right"></i></div> : null}
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-zinc-400">
                No show blocks yet. Start with a generated draft or add your first scene.
            </div>
        )}
    </article>
);

const TimelineStudio = ({
    items = [],
    liveItemId = '',
    stagedItemId = '',
    nextItemId = '',
    currentItemId = '',
    readinessById = {},
    pendingCountsById = {},
    expandedItemId = '',
    canEditFlow = false,
    onFocus,
    onMoveItem,
    onDeleteItem,
    onAddItem,
    onAddScenePack,
    onToggleGenerator,
    generatorOpen = false,
}) => {
    const tickMarks = [0, 25, 50, 75, 100];
    const addSpotlightMoment = (modeId = '', option = null) => {
        const safeModeId = String(modeId || '').trim();
        if (!safeModeId) return;
        const baseTitle = String(option?.label || safeModeId).trim();
        if (safeModeId === 'selfie_cam') {
            onAddItem?.('announcement', {
                title: baseTitle,
                plannedDurationSec: 45,
                roomMomentPlan: { activeMode: 'selfie_cam' },
                presentationPlan: {
                    publicTvTakeoverEnabled: true,
                    takeoverScene: 'selfie_cam',
                    headline: baseTitle,
                    subhead: option?.detail || 'Camera moment for the whole room.',
                    accentTheme: option?.tone || 'cyan'
                }
            });
            return;
        }
        onAddItem?.('game_break', {
            title: baseTitle,
            plannedDurationSec: safeModeId === 'applause_countdown' ? 35 : 60,
            modeLaunchPlan: {
                modeKey: safeModeId,
                launchConfig: {},
                requiresAudienceTakeover: safeModeId !== 'applause_countdown'
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: safeModeId,
                headline: baseTitle,
                subhead: option?.detail || 'Live room mode moment.',
                accentTheme: option?.tone || 'cyan'
            }
        });
    };
    return (
        <article className={`${surfaceClass} p-3`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Timeline Studio</div>
                    <div className="mt-1 text-xs text-zinc-400">Add scenes, drag them into place, then open only the inspector you need.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={!canEditFlow}
                        onClick={onToggleGenerator}
                        className={`rounded-2xl border px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.18em] disabled:opacity-40 ${generatorOpen ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/30 text-zinc-200'}`}
                    >
                        <div>Generate Show Draft</div>
                        <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-400">{generatorOpen ? 'Hide wizard' : 'Auto-build from format'}</div>
                    </button>
                </div>
            </div>
            <div className="mt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Core Scene Blocks</div>
                        <div className="mt-1 text-sm text-zinc-300">Start with the normal rhythm of the night: singer slots, host beats, breaks, and closers.</div>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{QUICK_ADD_SCENE_OPTIONS.length} primary blocks</div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                    {QUICK_ADD_SCENE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            disabled={!canEditFlow}
                            onClick={() => onAddItem?.(option.value)}
                            className="rounded-[22px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(8,17,30,0.92),rgba(18,11,31,0.82))] p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-500/10 disabled:opacity-40"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-500/10 text-cyan-100">
                                    <i className={`fa-solid ${option.icon}`}></i>
                                </div>
                                <span className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-100">Add</span>
                            </div>
                            <div className="mt-3 text-sm font-black uppercase tracking-[0.12em] text-white">{option.label}</div>
                            <div className="mt-1 text-xs text-zinc-300">{option.detail}</div>
                        </button>
                    ))}
                </div>
            </div>
            <div className="mt-3 rounded-2xl border border-cyan-300/14 bg-cyan-500/6 px-3 py-2 text-xs text-cyan-100/90">
                New scenes open in the builder right away. Drag them into place after you fill in the basics.
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/18 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Game + Spotlight Modes</div>
                        <div className="mt-1 text-sm text-zinc-300">Planned interactive beats live here. Real-time vibe changes stay in the host dropdown, not the run-of-show builder.</div>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{SPOTLIGHT_TIMELINE_OPTIONS.length} insertable modes</div>
                </div>
                <div className="mt-3 rounded-2xl border border-amber-300/18 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-100/90">
                    Song-linked Pop Trivia stays a live host toggle during performances. The run-of-show builder only plans full-room breaks like <span className="font-semibold text-white">Would You Rather</span>, Bingo, or spotlight game moments.
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                    {SPOTLIGHT_TIMELINE_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            disabled={!canEditFlow}
                            onClick={() => addSpotlightMoment(option.id, option)}
                            className={`rounded-2xl border px-3 py-2.5 text-left transition hover:brightness-110 disabled:opacity-40 ${sourceTone(option.tone, false)}`}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border ${sourceTone(option.tone, true)}`}>
                                    <i className={`fa-solid ${option.icon}`}></i>
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-xs font-black uppercase tracking-[0.14em] text-white">{option.label}</div>
                                    <div className="mt-0.5 text-[11px] text-current/78">{option.detail}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Curated Packs</div>
                            <div className="mt-1 text-sm text-zinc-300">Drop in proven takeovers, onboarding beats, leaderboard flashes, and other specialist moments from the same add menu.</div>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{MOMENT_PACKS.length} reusable packs</div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {MOMENT_PACKS.map((pack) => (
                            <button
                                key={pack.id}
                                type="button"
                                disabled={!canEditFlow}
                                onClick={() => onAddScenePack?.(pack)}
                                className={`rounded-[22px] border p-3 text-left transition hover:brightness-110 disabled:opacity-40 ${sourceTone(pack.tone, false)}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${sourceTone(pack.tone, true)}`}>
                                        <i className={`fa-solid ${pack.icon}`}></i>
                                    </div>
                                    <span className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-100">Drop In</span>
                                </div>
                                <div className="mt-2 text-base font-black text-white">{pack.label}</div>
                                <div className="mt-1 text-xs text-current/80">{pack.subtitle}</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {pack.chips.map((chip) => (
                                        <span key={chip} className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-100/90">
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            {items.length ? (
                <div className="mt-4 space-y-3">
                    <div className="rounded-3xl border border-white/10 bg-black/25 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Combined Sequence Timeline</div>
                                <div className="mt-1 text-xs text-zinc-400">One timeline for the whole night. Click any scene to jump straight into its editor.</div>
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{items.length} clip{items.length === 1 ? '' : 's'}</div>
                        </div>
                        <div className="relative mt-3 h-6">
                            {tickMarks.map((pct, index) => (
                                <div key={pct} className="absolute top-0 bottom-0" style={{ left: `${pct}%` }}>
                                    <div className="h-3 w-px bg-white/15"></div>
                                    <div className="mt-1 -translate-x-1/2 text-[9px] uppercase tracking-[0.16em] text-zinc-500">
                                        {index === tickMarks.length - 1 ? 'End' : `${pct}%`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <CompactTimelineOverview
                        items={items}
                        currentItemId={currentItemId}
                        liveItemId={liveItemId}
                        stagedItemId={stagedItemId}
                        nextItemId={nextItemId}
                        readinessById={readinessById}
                        pendingCountsById={pendingCountsById}
                        canEditFlow={canEditFlow}
                        selectedItemId={expandedItemId}
                        onMoveItem={onMoveItem}
                        onDeleteItem={onDeleteItem}
                        onFocus={onFocus}
                        showHeader={false}
                    />
                </div>
            ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-zinc-400">
                    No scenes yet. Add a performance slot, build from a generated draft, or start with an intro clip.
                </div>
            )}
        </article>
    );
};

const QuickDraftPanel = ({
    canEditFlow = false,
    generatorConfig = {},
    updateGeneratorConfig,
    applyGeneratorDraft,
    generatorBusy = false,
    generatorOpen = false,
    onToggleGenerator,
    generatedDraftItems = [],
    itemsCount = 0,
    collapsed = false,
    onToggleCollapsed,
}) => {
    const formatLabel = EVENT_FORMAT_OPTIONS.find((option) => option.value === (generatorConfig.format || 'karaoke_heavy'))?.label || 'Custom';
    const automationLabel = POLICY_PRESETS.find((preset) => preset.id === (generatorConfig.automationPresetId || 'balanced'))?.label || 'Custom';

    return (
        <article className={`${surfaceClass} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Quick Draft</div>
                    <div className="mt-1 text-xs text-zinc-400">Start with the fast draft inputs here, then open the advanced builder below if you need more control.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                        {generatedDraftItems.length} planned block{generatedDraftItems.length === 1 ? '' : 's'}
                    </span>
                    {typeof onToggleCollapsed === 'function' ? (
                        <ControlButton onClick={onToggleCollapsed}>
                            {collapsed ? 'Expand Draft' : 'Collapse Draft'}
                        </ControlButton>
                    ) : null}
                    {!collapsed ? (
                        <ControlButton onClick={onToggleGenerator}>
                            {generatorOpen ? 'Hide Advanced Builder' : 'Open Advanced Builder'}
                        </ControlButton>
                    ) : null}
                </div>
            </div>
            {collapsed ? (
                <>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">{formatLabel}</span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{generatorConfig.durationMin || 0} min</span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{generatorConfig.performanceCount || 0} singer slots</span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{automationLabel}</span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{generatorConfig.applyMode === 'append' ? 'Append mode' : 'Replace mode'}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/14 bg-cyan-500/6 px-3 py-2 text-xs text-cyan-100/90">
                        <span>
                            {itemsCount
                                ? `You already have ${itemsCount} block${itemsCount === 1 ? '' : 's'} in this night. Expand this tray only when you want to rebuild or append a new outline.`
                                : 'Start with a fast draft, then fine-tune the scenes one at a time below.'}
                        </span>
                        <ControlButton tone="primary" className="shrink-0 justify-center" disabled={!canEditFlow || generatorBusy} onClick={applyGeneratorDraft}>
                            {generatorBusy ? 'Applying…' : itemsCount ? (generatorConfig.applyMode === 'append' ? 'Append Draft' : 'Replace Show') : 'Create Show'}
                        </ControlButton>
                    </div>
                </>
            ) : (
                <>
                    <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1.1fr)_120px_120px_170px_auto]">
                        <div>
                            <FieldLabel>Format</FieldLabel>
                            <SelectControl value={generatorConfig.format || 'karaoke_heavy'} onChange={(e) => updateGeneratorConfig({ format: e.target.value })} disabled={!canEditFlow}>
                                {EVENT_FORMAT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </SelectControl>
                        </div>
                        <div>
                            <FieldLabel>Minutes</FieldLabel>
                            <input type="number" value={generatorConfig.durationMin || 0} onChange={(e) => updateGeneratorConfig({ durationMin: Number(e.target.value || 0) })} disabled={!canEditFlow} className={textInputClass} />
                        </div>
                        <div>
                            <FieldLabel>Singer Slots</FieldLabel>
                            <input type="number" value={generatorConfig.performanceCount || 0} onChange={(e) => updateGeneratorConfig({ performanceCount: Number(e.target.value || 0) })} disabled={!canEditFlow} className={textInputClass} />
                        </div>
                        <div>
                            <FieldLabel>Automation</FieldLabel>
                            <SelectControl value={generatorConfig.automationPresetId || 'balanced'} onChange={(e) => updateGeneratorConfig({ automationPresetId: e.target.value })} disabled={!canEditFlow}>
                                {POLICY_PRESETS.map((preset) => (
                                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                                ))}
                            </SelectControl>
                        </div>
                        <div className="space-y-2 xl:pl-1">
                            <FieldLabel>Apply Mode</FieldLabel>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    ['replace', 'Replace'],
                                    ['append', 'Append'],
                                ].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        disabled={!canEditFlow}
                                        onClick={() => updateGeneratorConfig({ applyMode: value })}
                                        className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] disabled:opacity-40 ${generatorConfig.applyMode === value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/20 text-zinc-300'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <ControlButton tone="primary" className="w-full justify-center" disabled={!canEditFlow || generatorBusy} onClick={applyGeneratorDraft}>
                                {generatorBusy ? 'Applying…' : itemsCount ? (generatorConfig.applyMode === 'append' ? 'Append Draft' : 'Replace Show') : 'Create Show'}
                            </ControlButton>
                        </div>
                    </div>
                    <div className="mt-2 rounded-2xl border border-cyan-300/14 bg-cyan-500/6 px-3 py-2 text-xs text-cyan-100/90">
                        {itemsCount
                            ? `You already have ${itemsCount} block${itemsCount === 1 ? '' : 's'} in this night. Use Replace to rebuild the lineup or Append to tack this draft onto the end.`
                            : 'Start with a fast draft, then fine-tune the scenes one at a time below.'}
                    </div>
                </>
            )}
        </article>
    );
};

const QuickDraftModal = ({
    open = false,
    onClose,
    canEditFlow = false,
    generatorConfig = {},
    updateGeneratorConfig,
    applyGeneratorDraft,
    generatorBusy = false,
    generatorOpen = false,
    onToggleGenerator,
    generatedDraftItems = [],
    itemsCount = 0,
}) => {
    if (!open) return null;
    const formatLabel = EVENT_FORMAT_OPTIONS.find((option) => option.value === (generatorConfig.format || 'karaoke_heavy'))?.label || 'Custom';
    const automationLabel = POLICY_PRESETS.find((preset) => preset.id === (generatorConfig.automationPresetId || 'balanced'))?.label || 'Custom';

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/72 p-3 sm:items-center sm:p-4">
            <div className="max-h-[calc(100dvh-1rem)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-cyan-300/22 bg-[linear-gradient(180deg,rgba(5,10,22,0.98),rgba(8,13,24,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Quick Draft Builder</div>
                        <div className="mt-1 text-sm font-semibold text-white">Generate a show outline fast, then expand the advanced builder only if you need more control over pacing, block mix, or automation.</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">{formatLabel}</span>
                            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{generatorConfig.durationMin || 0} min</span>
                            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{generatorConfig.performanceCount || 0} singer slots</span>
                            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{automationLabel}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 hover:border-cyan-300/25"
                    >
                        Close
                    </button>
                </div>
                <div className="max-h-[calc(100dvh-10.5rem)] overflow-y-auto px-4 py-4 sm:px-5">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                        <QuickDraftPanel
                            canEditFlow={canEditFlow}
                            generatorConfig={generatorConfig}
                            updateGeneratorConfig={updateGeneratorConfig}
                            applyGeneratorDraft={applyGeneratorDraft}
                            generatorBusy={generatorBusy}
                            generatorOpen={generatorOpen}
                            onToggleGenerator={onToggleGenerator}
                            generatedDraftItems={generatedDraftItems}
                            itemsCount={itemsCount}
                            collapsed={false}
                        />
                        <article className={`${surfaceClass} p-4`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Format Guide</div>
                                    <div className="mt-1 text-xs text-zinc-400">Each format changes the ratio of songs, host beats, and audience moments so you start with the right shape before fine tuning details.</div>
                                </div>
                                <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{EVENT_FORMAT_OPTIONS.length} formats</span>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {EVENT_FORMAT_OPTIONS.map((option) => {
                                    const selected = generatorConfig.format === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            disabled={!canEditFlow}
                                            onClick={() => updateGeneratorConfig({ format: option.value })}
                                            className={`rounded-2xl border p-3 text-left transition disabled:opacity-40 ${selected ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                        >
                                            <div className="text-sm font-bold text-white">{option.label}</div>
                                            <div className="mt-1 text-xs text-current/80">{option.description}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </article>
                    </div>
                    {generatorOpen ? (
                        <article className={`${surfaceClass} mt-4 p-4`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Advanced Draft Builder</div>
                                    <div className="mt-1 text-sm text-zinc-300">Tune the generated outline in more detail when the quick draft needs a custom block mix or pacing change.</div>
                                </div>
                            </div>
                            <div className="mt-3 space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {[1, 2, 3, 4, 5].map((step) => (
                                        <button
                                            key={step}
                                            type="button"
                                            disabled={!canEditFlow}
                                            onClick={() => updateGeneratorConfig({ step })}
                                            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] disabled:opacity-40 ${generatorConfig.step === step ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/25 text-zinc-300'}`}
                                        >
                                            Step {step}
                                        </button>
                                    ))}
                                </div>
                                {generatorConfig.step === 1 ? (
                                    <div className="grid gap-3 lg:grid-cols-3">
                                        {EVENT_FORMAT_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                disabled={!canEditFlow}
                                                onClick={() => updateGeneratorConfig({ format: option.value })}
                                                className={`rounded-2xl border p-3 text-left transition disabled:opacity-40 ${generatorConfig.format === option.value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                            >
                                                <div className="text-sm font-bold text-white">{option.label}</div>
                                                <div className="mt-1 text-xs text-current/80">{option.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                                {generatorConfig.step === 2 ? (
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div>
                                            <FieldLabel>Total Duration Min</FieldLabel>
                                            <input type="number" value={generatorConfig.durationMin} onChange={(e) => updateGeneratorConfig({ durationMin: Number(e.target.value || 0) })} className={textInputClass} />
                                        </div>
                                        <div className="md:col-span-3">
                                            <FieldLabel>Pacing</FieldLabel>
                                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                                {PACING_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        disabled={!canEditFlow}
                                                        onClick={() => updateGeneratorConfig({ pacing: option.value })}
                                                        className={`rounded-2xl border p-3 text-left transition disabled:opacity-40 ${generatorConfig.pacing === option.value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                                    >
                                                        <div className="text-sm font-bold text-white">{option.label}</div>
                                                        <div className="mt-1 text-xs text-current/80">{option.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                                {generatorConfig.step === 3 ? (
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                        <div><FieldLabel>Performance Slots</FieldLabel><input type="number" value={generatorConfig.performanceCount} onChange={(e) => updateGeneratorConfig({ performanceCount: Number(e.target.value || 0) })} className={textInputClass} /></div>
                                        <div><FieldLabel>Announcements</FieldLabel><input type="number" value={generatorConfig.announcementCount} onChange={(e) => updateGeneratorConfig({ announcementCount: Number(e.target.value || 0) })} className={textInputClass} /></div>
                                        <div><FieldLabel>Interactive Beats</FieldLabel><input type="number" value={generatorConfig.interactiveCount} onChange={(e) => updateGeneratorConfig({ interactiveCount: Number(e.target.value || 0) })} className={textInputClass} /></div>
                                        <div><FieldLabel>Buffers</FieldLabel><input type="number" value={generatorConfig.bufferCount} onChange={(e) => updateGeneratorConfig({ bufferCount: Number(e.target.value || 0) })} className={textInputClass} /></div>
                                        <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={generatorConfig.includeIntermission === true} onChange={(e) => updateGeneratorConfig({ includeIntermission: e.target.checked })} />Include intermission</label></div>
                                    </div>
                                ) : null}
                                {generatorConfig.step === 4 ? (
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <div>
                                            <FieldLabel>Automation Style</FieldLabel>
                                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                                {POLICY_PRESETS.map((preset) => (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        onClick={() => updateGeneratorConfig({ automationPresetId: preset.id })}
                                                        className={`rounded-2xl border p-3 text-left transition ${generatorConfig.automationPresetId === preset.id ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                                    >
                                                        <div className="text-sm font-bold text-white">{preset.label}</div>
                                                        <div className="mt-1 text-xs text-current/80">{preset.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <FieldLabel>Interaction Level</FieldLabel>
                                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                                {INTERACTION_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => updateGeneratorConfig({ interactionLevel: option.value })}
                                                        className={`rounded-2xl border p-3 text-left transition ${generatorConfig.interactionLevel === option.value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                                    >
                                                        <div className="text-sm font-bold text-white">{option.label}</div>
                                                        <div className="mt-1 text-xs text-current/80">{option.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                                {generatorConfig.step === 5 ? (
                                    <div className="space-y-3">
                                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Generated Timeline</div>
                                                <div className="mt-3 grid gap-2">
                                                    {generatedDraftItems.map((entry, index) => (
                                                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                                                            <div className="min-w-0">
                                                                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">#{index + 1} {getRunOfShowItemLabel(entry.type)}</div>
                                                                <div className="truncate text-sm font-semibold text-white">{entry.title}</div>
                                                            </div>
                                                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">{entry.plannedDurationSec}s</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 space-y-3">
                                                <div>
                                                    <FieldLabel>Apply Mode</FieldLabel>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {[
                                                            ['replace', 'Replace current show'],
                                                            ['append', 'Append to current show']
                                                        ].map(([value, label]) => (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                disabled={!canEditFlow}
                                                                onClick={() => updateGeneratorConfig({ applyMode: value })}
                                                                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${generatorConfig.applyMode === value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/20 text-zinc-300'}`}
                                                            >
                                                                {label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-300">
                                                    {itemsCount
                                                        ? `There are already ${itemsCount} blocks in this show. ${generatorConfig.applyMode === 'replace' ? 'Replacing will overwrite the current timeline.' : 'Appending will keep the current timeline and add this draft to the end.'}`
                                                        : 'This room does not have a timeline yet. Applying will create the first draft.'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </article>
                    ) : null}
                </div>
                <div className="border-t border-white/10 bg-black/24 px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-zinc-400">
                            {generatedDraftItems.length
                                ? `${generatedDraftItems.length} planned block${generatedDraftItems.length === 1 ? '' : 's'} ready to apply.`
                                : 'Adjust the inputs to generate or refine the outline before applying it.'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <ControlButton onClick={onClose}>Cancel</ControlButton>
                            <ControlButton tone="primary" className="justify-center" disabled={!canEditFlow || generatorBusy} onClick={applyGeneratorDraft}>
                                {generatorBusy ? 'Applying...' : itemsCount ? (generatorConfig.applyMode === 'append' ? 'Append Draft' : 'Replace Show') : 'Create Show'}
                            </ControlButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TemplateToolsModal = ({
    open = false,
    onClose,
    canManageTemplates = false,
    starterTemplateOptions = [],
    templateDraftName = '',
    onTemplateDraftNameChange,
    currentTemplateId = '',
    currentTemplateName = '',
    runOfShowTemplates = [],
    onApplyStarterTemplate,
    onApplyTemplate,
    onSaveTemplate,
    onArchiveCurrent,
    lastArchiveId = '',
}) => {
    if (!open) return null;
    const safeTemplates = Array.isArray(runOfShowTemplates) ? runOfShowTemplates : [];

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/72 p-3 sm:items-center sm:p-4">
            <div className="max-h-[calc(100dvh-1rem)] w-full max-w-5xl overflow-hidden rounded-[28px] border border-cyan-300/22 bg-[linear-gradient(180deg,rgba(5,10,22,0.98),rgba(8,13,24,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Templates</div>
                        <div className="mt-1 text-sm font-semibold text-white">Reuse proven show formats without crowding the main editing lane.</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                {currentTemplateName || 'Unsaved working copy'}
                            </span>
                            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                {safeTemplates.length} saved
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 hover:border-cyan-300/25"
                    >
                        Close
                    </button>
                </div>
                <div className="max-h-[calc(100dvh-10.5rem)] overflow-y-auto px-4 py-4 sm:px-5">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                        <article className={`${surfaceClass} p-4`}>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Starter Templates</div>
                            <div className="mt-1 text-sm text-zinc-300">Apply a proven room format before you fine-tune tonight&rsquo;s sequence.</div>
                            <div className="mt-4 grid gap-2">
                                {starterTemplateOptions.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        disabled={!canManageTemplates}
                                        onClick={() => onApplyStarterTemplate?.(entry.id)}
                                        className={`rounded-2xl border px-3 py-3 text-left transition disabled:opacity-40 ${entry.toneClass}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/15 text-white">
                                                <i className={`fa-solid ${entry.icon}`}></i>
                                            </span>
                                            <span className="rounded-full border border-white/15 bg-black/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
                                                Starter
                                            </span>
                                        </div>
                                        <div className="mt-2 text-sm font-semibold text-white">{entry.label}</div>
                                        <div className="mt-1 text-xs text-current/80">{entry.detail}</div>
                                    </button>
                                ))}
                            </div>
                        </article>

                        <article className={`${surfaceClass} p-4`}>
                            <div className="space-y-3">
                                <div>
                                    <FieldLabel>Template Name</FieldLabel>
                                    <input
                                        value={templateDraftName}
                                        onChange={(e) => onTemplateDraftNameChange?.(e.target.value)}
                                        disabled={!canManageTemplates}
                                        className={textInputClass}
                                        placeholder="AAHF Kick-Off Format"
                                    />
                                </div>
                                <div>
                                    <FieldLabel>Saved Templates</FieldLabel>
                                    <SelectControl value={currentTemplateId || ''} onChange={(e) => onApplyTemplate?.(e.target.value)} disabled={!canManageTemplates}>
                                        <option value="">Select a saved template</option>
                                        {safeTemplates.map((entry) => (
                                            <option key={entry.id || entry.templateId} value={entry.templateId || entry.id}>{entry.templateName || entry.templateId || entry.id}</option>
                                        ))}
                                    </SelectControl>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    <ControlButton tone="primary" disabled={!canManageTemplates} onClick={() => onSaveTemplate?.(templateDraftName || currentTemplateName || 'Run Of Show Template')}>
                                        Save Template
                                    </ControlButton>
                                    <ControlButton disabled={!canManageTemplates || !String(currentTemplateId || '').trim()} onClick={() => onApplyTemplate?.(currentTemplateId)}>
                                        Reset To Current
                                    </ControlButton>
                                    <ControlButton tone="warning" disabled={!canManageTemplates} onClick={() => onArchiveCurrent?.(templateDraftName || currentTemplateName || 'Archived Run Of Show')}>
                                        Archive Night
                                    </ControlButton>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-zinc-400">
                                    Current template: <span className="text-white">{currentTemplateName || 'Unsaved working copy'}</span>{lastArchiveId ? ` | Last archive ${lastArchiveId}` : ''}
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShowMapCard = ({
    items = [],
    liveItemId = '',
    stagedItemId = '',
    nextItemId = '',
    expandedItemId = '',
    readinessById = {},
    pendingCountsById = {},
    getPrimaryAction,
    onFocus,
    canEditFlow = false,
    roomUserCandidates = [],
    onAssignLobbyPerformer,
    onClearLobbyPerformer,
    onUpdateItem,
    onLoadSuggestedBacking,
    mediaPicker = {},
    getSuggestedOptionsForItem,
    onApplyMediaSelection,
}) => {
    const blockedCount = items.filter((item) => Array.isArray(readinessById[item.id]?.blockers) && readinessById[item.id].blockers.length).length;
    return (
        <article className={`${surfaceClass} p-3`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Show Map</div>
                    <div className="mt-1 text-xs text-zinc-400">Scan the whole night in one list, then jump straight into the scene you want.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                        {items.length} scene{items.length === 1 ? '' : 's'}
                    </span>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${blockedCount ? 'border-amber-300/35 bg-amber-500/12 text-amber-100' : 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'}`}>
                        {blockedCount ? `${blockedCount} need attention` : 'No blockers'}
                    </span>
                </div>
            </div>
            <div className="mt-3 grid gap-1.5">
                {items.map((item, index) => {
                    const readiness = readinessById[item.id] || null;
                    const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers.length : 0;
                    const pendingCount = Number(pendingCountsById[item.id] || 0);
                    const hasIssues = blockers > 0 || pendingCount > 0;
                    const action = typeof getPrimaryAction === 'function' ? getPrimaryAction(item, readiness, { pendingCount }) : null;
                    const isFocused = expandedItemId === item.id;
                    const railLabel = item.id === liveItemId ? 'Now' : item.id === stagedItemId ? 'Staged' : item.id === nextItemId ? 'Up next' : `Scene ${index + 1}`;
                    const readinessLabel = blockers ? `${blockers} blocker${blockers === 1 ? '' : 's'}` : pendingCount ? `${pendingCount} pending` : 'Ready';
                    const performanceFields = item.type === 'performance' ? getPerformanceIdentityFields(item) : [];
                    const sourceMeta = getSourceMeta(item?.backingPlan?.sourceType || 'canonical_default');
                    const inlineSuggestedOptions = isFocused && item.type === 'performance' && typeof getSuggestedOptionsForItem === 'function'
                        ? getSuggestedOptionsForItem(item).slice(0, 5)
                        : [];
                    const showingInlinePicker = mediaPicker.itemId === item.id;
                    const inlinePickerError = showingInlinePicker ? String(mediaPicker.error || '').trim() : '';
                    const inlinePickerLoading = showingInlinePicker && mediaPicker.loading === true;
                    return (
                        <div
                            key={item.id}
                            className={`relative w-full rounded-[22px] border pl-4 pr-3 py-2.5 transition ${
                                isFocused
                                    ? 'border-cyan-300/35 bg-cyan-500/10'
                                    : hasIssues
                                        ? 'border-amber-300/35 bg-amber-500/[0.08] hover:border-amber-200/45'
                                        : 'border-white/10 bg-black/20 hover:border-cyan-300/25'
                            }`}
                        >
                            {hasIssues ? <div className="absolute inset-y-3 left-1.5 w-1 rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-rose-400 shadow-[0_0_16px_rgba(251,191,36,0.28)]"></div> : null}
                            <button
                                type="button"
                                onClick={() => onFocus?.(item.id)}
                                className="w-full text-left"
                            >
                                <div className="grid gap-2 xl:grid-cols-[84px_minmax(0,1.8fr)_108px_88px_112px_auto] xl:items-center">
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone(item.status)}`}>{railLabel}</span>
                                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{getRunOfShowItemLabel(item.type)}</span>
                                        {hasIssues ? (
                                            <span className="rounded-full border border-amber-300/40 bg-amber-500/16 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-50">
                                                <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                                                Needs prep
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-bold text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                                        <div className="mt-0.5 truncate text-xs text-zinc-400">{itemSummary(item)}</div>
                                        {performanceFields.length ? (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {performanceFields.map((field) => {
                                                    const hasValue = !!field.value;
                                                    return (
                                                        <span
                                                            key={field.key}
                                                            className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${hasValue ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/40 bg-amber-500/18 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]'}`}
                                                        >
                                                            {hasValue ? `${field.label}: ${field.value}` : field.fallback}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                                        <div className="text-[9px] text-zinc-500">Start</div>
                                        <div className="mt-0.5 text-xs font-semibold text-white normal-case tracking-normal">{formatStart(item.startsAtMs)}</div>
                                    </div>
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                                        <div className="text-[9px] text-zinc-500">Length</div>
                                        <div className="mt-0.5 text-xs font-semibold text-white normal-case tracking-normal">{formatDurationSec(item.plannedDurationSec) || `${Math.max(0, Number(item.plannedDurationSec || 0))}s`}</div>
                                    </div>
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                                        <div className="text-[9px] text-zinc-500">State</div>
                                        <div className={`mt-0.5 flex items-center gap-1 text-xs font-semibold normal-case tracking-normal ${hasIssues ? 'text-amber-50' : 'text-emerald-100'}`}>
                                            {hasIssues ? <i className="fa-solid fa-circle-exclamation text-[11px]"></i> : <i className="fa-solid fa-circle-check text-[11px]"></i>}
                                            <span>{readinessLabel}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap justify-start gap-1.5 xl:justify-end">
                                        {action ? <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">{action.label}</span> : null}
                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${isFocused ? 'border-violet-300/25 bg-violet-500/12 text-violet-100' : 'border-white/10 bg-black/30 text-zinc-300'}`}>{isFocused ? 'Editing' : 'Open'}</span>
                                    </div>
                                </div>
                            </button>
                            {isFocused && item.type === 'performance' ? (
                                <div data-performance-setup-for={item.id} className="mt-3 rounded-[20px] border border-cyan-300/16 bg-black/25 p-3">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">Inline Slot Setup</div>
                                            <div className="mt-1 text-sm text-zinc-300">Start with song search and backing here, then add the performer display name if you already know it.</div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${sourceTone(sourceMeta.tone, false)}`}>{sourceMeta.label}</span>
                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${item.backingPlan?.playbackReady === true ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}>
                                                {item.backingPlan?.playbackReady === true ? 'Playback ready' : 'Needs backing'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {PERFORMER_MODE_OPTIONS.map((option) => (
                                            <button
                                                key={`${item.id}-${option.value}`}
                                                type="button"
                                                disabled={!canEditFlow}
                                                onClick={() => onUpdateItem?.(item.id, { performerMode: option.value })}
                                                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${item.performerMode === option.value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/30 text-zinc-300'}`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                                        <div className="order-2 space-y-3 lg:order-2">
                                            <div>
                                                <FieldLabel>{getPerformerFieldLabel(item.performerMode)}</FieldLabel>
                                                <input
                                                    value={item.assignedPerformerName || ''}
                                                    onChange={(e) => onUpdateItem?.(item.id, { assignedPerformerName: e.target.value })}
                                                    disabled={!canEditFlow}
                                                    className={textInputClass}
                                                    placeholder={getPerformerFieldPlaceholder(item.performerMode)}
                                                />
                                            </div>
                                            {item.performerMode !== RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <FieldLabel>Bind Live Lobby Performer</FieldLabel>
                                                        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{roomUserCandidates.length ? `${roomUserCandidates.length} in lobby` : 'No one joined yet'}</span>
                                                    </div>
                                                    <SelectControl
                                                        value={item.assignedPerformerUid || ''}
                                                        onChange={(e) => {
                                                            const candidate = roomUserCandidates.find((entry) => entry.uid === e.target.value);
                                                            if (candidate) {
                                                                onAssignLobbyPerformer?.(item, candidate);
                                                            } else {
                                                                onClearLobbyPerformer?.(item);
                                                            }
                                                        }}
                                                        disabled={!canEditFlow || roomUserCandidates.length === 0}
                                                    >
                                                        <option value="">{roomUserCandidates.length ? 'Choose from live lobby' : 'No lobby performers yet'}</option>
                                                        {roomUserCandidates.map((candidate) => (
                                                            <option key={candidate.uid} value={candidate.uid}>{candidate.label}</option>
                                                        ))}
                                                    </SelectControl>
                                                </div>
                                            ) : null}
                                            <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-400">
                                                {getPerformerModeHint(item.performerMode)}
                                            </div>
                                        </div>
                                        <div className="order-1 space-y-3 lg:order-1">
                                            <div>
                                                <FieldLabel>Song Title</FieldLabel>
                                                <input
                                                    value={item.songTitle || ''}
                                                    onChange={(e) => onUpdateItem?.(item.id, { songTitle: e.target.value })}
                                                    disabled={!canEditFlow}
                                                    className={textInputClass}
                                                    placeholder="Song title"
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel>Artist</FieldLabel>
                                                <input
                                                    value={item.artistName || ''}
                                                    onChange={(e) => onUpdateItem?.(item.id, { artistName: e.target.value })}
                                                    disabled={!canEditFlow}
                                                    className={textInputClass}
                                                    placeholder="Artist"
                                                />
                                            </div>
                                            <div className="rounded-[24px] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(8,18,30,0.96),rgba(18,26,44,0.94))] px-4 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/80">YouTube Backing Search</div>
                                                        <div className="mt-1 text-sm text-white">{buildMediaQuery(item) || 'Enter song and artist, then search for a playable backing.'}</div>
                                                        <div className="mt-1 text-xs text-zinc-400">Host-picked YouTube results count as playable now. Mark them good or bad after you hear them.</div>
                                                    </div>
                                                    <ControlButton
                                                        tone={item.songTitle ? 'primary' : 'warning'}
                                                        disabled={!canEditFlow}
                                                        onClick={() => onLoadSuggestedBacking?.(item)}
                                                    >
                                                        Search YouTube
                                                    </ControlButton>
                                                </div>
                                                {item.backingPlan?.label || item.backingPlan?.youtubeId || item.backingPlan?.mediaUrl ? (
                                                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Current backing</div>
                                                                <div className="mt-1 text-sm font-semibold text-white">{item.backingPlan?.label || item.backingPlan?.youtubeId || item.backingPlan?.mediaUrl}</div>
                                                            </div>
                                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${backingApprovalMeta(item.backingPlan?.approvalStatus).tone}`}>
                                                                {backingApprovalMeta(item.backingPlan?.approvalStatus).label}
                                                            </span>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <ControlButton tone="success" onClick={() => onUpdateItem?.(item.id, { backingPlan: { ...(item.backingPlan || {}), approvalStatus: 'approved', playbackReady: true, resolutionStatus: 'ready' } })}>
                                                                Good for room
                                                            </ControlButton>
                                                            <ControlButton tone="danger" onClick={() => onUpdateItem?.(item.id, { backingPlan: { ...(item.backingPlan || {}), approvalStatus: 'rejected', playbackReady: false, resolutionStatus: 'needs_replacement' } })}>
                                                                Bad fit
                                                            </ControlButton>
                                                            <ControlButton onClick={() => onUpdateItem?.(item.id, { backingPlan: { ...(item.backingPlan || {}), label: '', mediaUrl: '', youtubeId: '', appleMusicId: '', trackId: '', localAssetId: '', submittedBackingId: '', playbackReady: false, approvalStatus: 'pending', resolutionStatus: 'needs_selection' } })}>
                                                                Clear
                                                            </ControlButton>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                {inlinePickerError ? <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{inlinePickerError}</div> : null}
                                                {inlinePickerLoading ? <div className="mt-3 text-sm text-cyan-100/80">Loading YouTube matches here…</div> : null}
                                                {inlineSuggestedOptions.length ? (
                                                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                                        {inlineSuggestedOptions.map((option) => (
                                                            <MediaPickerOption
                                                                key={option.id}
                                                                option={{ ...option, statusLabel: option.statusLabel || 'Suggested', statusTone: option.statusTone || option.tone || 'zinc' }}
                                                                onSelect={() => onApplyMediaSelection?.(item, option)}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : buildMediaQuery(item) ? (
                                                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-400">
                                                        Click <span className="font-semibold text-white">Search YouTube</span> and the best backing matches will appear right here.
                                                    </div>
                                                ) : (
                                                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-400">
                                                        Start with song title and artist, then choose the backing without leaving this slot.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </article>
    );
};

const BackingSourceCard = ({ option, selected = false, trusted = false, onSelect }) => (
    <button type="button" onClick={onSelect} aria-label={`Select ${option.title} backing source`} className={`rounded-2xl border p-3 text-left transition ${sourceTone(option.tone, selected)} hover:border-white/30`}>
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="text-sm font-bold text-white">{option.title}</div>
                <div className="mt-1 text-xs text-current/80">{option.description}</div>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${trusted ? 'border-emerald-300/30 bg-emerald-500/15 text-emerald-50' : 'border-white/10 bg-black/20 text-current/80'}`}>{trusted ? 'Ready' : option.trustLabel}</span>
        </div>
    </button>
);

const SubmissionStatusBadge = ({ count = 0 }) => (
    <span className="rounded-full border border-amber-300/35 bg-amber-500/14 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">{count} pending</span>
);

const MediaPickerOption = ({ option, onSelect }) => (
    <button
        type="button"
        onClick={onSelect}
        data-run-of-show-media-option-id={option.id}
        className="w-full overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(29,18,47,0.96),rgba(15,11,31,0.98))] text-left transition hover:border-cyan-300/35 hover:bg-[linear-gradient(180deg,rgba(39,24,60,0.98),rgba(17,12,34,0.98))]"
    >
        <div className="grid gap-3 md:grid-cols-[86px_minmax(0,1fr)]">
            <div className="relative overflow-hidden border-b border-white/10 bg-black/35 md:border-b-0 md:border-r">
                {option.artworkUrl ? (
                    <img src={option.artworkUrl} alt="" className="h-[86px] w-full object-cover md:h-full" loading="lazy" />
                ) : (
                    <div className={`flex h-[86px] w-full items-center justify-center border-0 ${pickerStatusTone(option.tone || 'zinc')}`}>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em]">{option.tag || 'Pick'}</span>
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white">
                    {option.tag || 'Select'}
                </div>
            </div>
            <div className="flex min-w-0 items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-black leading-tight text-white">{option.title}</div>
                    {option.subtitle ? <div className="mt-1 line-clamp-2 text-sm text-zinc-300">{option.subtitle}</div> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {option.statusLabel ? <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${pickerStatusTone(option.statusTone || option.tone || 'zinc')}`}>{option.statusLabel}</span> : null}
                        {option.actionHint ? <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100">{option.actionHint}</span> : null}
                    </div>
                    {option.detail ? <div className="mt-2 line-clamp-2 text-xs text-zinc-500">{option.detail}</div> : null}
                </div>
                <span className="shrink-0 text-cyan-100/80"><i className="fa-solid fa-plus"></i></span>
            </div>
        </div>
    </button>
);

export default function RunOfShowDirectorPanel({
    enabled = false,
    roomCode = '',
    programMode = 'standard_karaoke',
    director = null,
    runOfShowPolicy = null,
    runOfShowRoles = null,
    runOfShowTemplateMeta = null,
    runOfShowTemplates = [],
    submissions = [],
    queueSongs = [],
    roomUsers = [],
    localLibrary = [],
    ytIndex = [],
    appleMusicAuthorized = false,
    previewActiveId = '',
    focusRequest = null,
    operatorRole = RUN_OF_SHOW_OPERATOR_ROLES.viewer,
    operatorCapabilities = null,
    operatingHint = '',
    preflightReport = null,
    compactViewport = false,
    onSetProgramMode,
    onAddItem,
    onDuplicateItem,
    onDeleteItem,
    onMoveItem,
    onUpdateItem,
    onToggleAutomationPause,
    onStartRunOfShow,
    onStopRunOfShow,
    onPrepareItem,
    onPreviewItem,
    onClearPreview,
    onStartItem,
    onCompleteItem,
    onSkipItem,
    onReviewSubmission,
    onAssignQueueSongToItem,
    onUpdatePolicy,
    onUpdateRoles,
    onApplyGeneratedDraft,
    onSaveTemplate,
    onApplyTemplate,
    onApplyStarterTemplate,
    onArchiveCurrent,
}) {
    const items = useMemo(() => (Array.isArray(director?.items) ? director.items : []), [director?.items]);
    const automationPaused = !!director?.automationPaused;
    const currentItemId = String(director?.currentItemId || '').trim();
    const safePolicy = useMemo(() => (runOfShowPolicy || {}), [runOfShowPolicy]);
    const safeRoles = runOfShowRoles || {};
    const safeTemplateMeta = runOfShowTemplateMeta || {};
    const safeOperatorCapabilities = operatorCapabilities || {
        canOperate: false,
        canPauseAutomation: false,
        canReviewSubmissions: false,
        canCurateMedia: false,
        canEditFlow: false,
        canManageTemplates: false,
        canManageRoles: false,
    };
    const liveItem = useMemo(() => getRunOfShowLiveItem(director || {}), [director]);
    const stagedItem = useMemo(() => getRunOfShowStagedItem(director || {}), [director]);
    const nextItem = useMemo(() => getNextRunOfShowItem(director || {}), [director]);
    const laterItems = useMemo(
        () => items.filter((item) => !['complete', 'skipped'].includes(String(item?.status || '').toLowerCase()))
            .filter((item) => item.id !== liveItem?.id && item.id !== stagedItem?.id && item.id !== nextItem?.id)
            .slice(0, 4),
        [items, liveItem?.id, nextItem?.id, stagedItem?.id]
    );
    const pendingApprovals = (Array.isArray(submissions) ? submissions : []).filter((entry) => String(entry?.submissionStatus || 'pending').toLowerCase() === 'pending');
    const pendingCountsById = useMemo(() => {
        const counts = {};
        (Array.isArray(submissions) ? submissions : []).forEach((entry) => {
            const itemId = String(entry?.itemId || '').trim();
            if (!itemId) return;
            if (String(entry?.submissionStatus || 'pending').toLowerCase() !== 'pending') return;
            counts[itemId] = Number(counts[itemId] || 0) + 1;
        });
        return counts;
    }, [submissions]);
    const readinessById = useMemo(() => Object.fromEntries(items.map((item) => {
        const pendingSubmissionCount = (Array.isArray(submissions) ? submissions : [])
            .filter((entry) => entry.itemId === item.id)
            .filter((entry) => String(entry?.submissionStatus || 'pending').toLowerCase() === 'pending')
            .length;
        return [item.id, getRunOfShowItemReadiness(item, { pendingSubmissionCount })];
    })), [items, submissions]);
    const [expandedItemId, setExpandedItemId] = useState('');
    const [templateDraftName, setTemplateDraftName] = useState('');
    const [modeActionBusy, setModeActionBusy] = useState(false);
    const [studioMode, setStudioMode] = useState('build');
    const [goLiveSheetOpen, setGoLiveSheetOpen] = useState(false);
    const [liveTimelineOpen, setLiveTimelineOpen] = useState(false);
    const [coHostSearch, setCoHostSearch] = useState('');
    const [generatorOpen, setGeneratorOpen] = useState(items.length === 0);
    const [generatorConfig, setGeneratorConfig] = useState({ ...GENERATOR_DEFAULTS });
    const [generatorBusy, setGeneratorBusy] = useState(false);
    const [quickDraftModalOpen, setQuickDraftModalOpen] = useState(false);
    const [approvalInboxOpen, setApprovalInboxOpen] = useState(true);
    const [liveWaitAtLeastSec, setLiveWaitAtLeastSec] = useState(30);
    const [liveAdjustmentNowMs, setLiveAdjustmentNowMs] = useState(() => Date.now());
    const [planningControlsOpen, setPlanningControlsOpen] = useState(items.length === 0);
    const [coHostToolsOpen, setCoHostToolsOpen] = useState(false);
    const [templateToolsOpen, setTemplateToolsOpen] = useState(false);
    const STARTER_TEMPLATE_OPTIONS = Object.freeze([
        {
            id: 'aahf_kickoff',
            label: 'AAHF Kick-Off',
            detail: '7 PM to midnight structure with two rounds, a support beat, selfie cam, and explicit lyrics after 9 PM.',
            icon: 'fa-stars',
            toneClass: 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100'
        }
    ]);
    const [workspaceToolsOpen, setWorkspaceToolsOpen] = useState(false);
    const [buildSequenceOpen, setBuildSequenceOpen] = useState(items.length === 0);
    const [buildMapOpen, setBuildMapOpen] = useState(false);
    const [topBoardCollapsed, setTopBoardCollapsed] = useState(items.length > 0);
    const [pendingSetupScrollItemId, setPendingSetupScrollItemId] = useState('');
    const [repairFocus, setRepairFocus] = useState(null);
    const [sectionOpenState, setSectionOpenState] = useState({});
    const [dragState, setDragState] = useState({ itemId: '', targetId: '', position: 'after' });
    const [interactiveLibraryFilter, setInteractiveLibraryFilter] = useState('');
    const [interactiveLibrarySelection, setInteractiveLibrarySelection] = useState('');
    const [slotAssignmentFilter, setSlotAssignmentFilter] = useState('all');

    useEffect(() => {
        if (items.length === 0) {
            setBuildSequenceOpen(true);
            setBuildMapOpen(false);
            setTopBoardCollapsed(false);
        }
    }, [items.length]);
    const [slotFillBusy, setSlotFillBusy] = useState(false);
    const [slotAssignmentNotice, setSlotAssignmentNotice] = useState('');
    const [mediaPicker, setMediaPicker] = useState({
        itemId: '',
        sourceType: '',
        query: '',
        remoteResults: [],
        loading: false,
        error: ''
    });
    const isRunOfShowActive = enabled && programMode === 'run_of_show';
    const safePreflightReport = preflightReport && typeof preflightReport === 'object'
        ? preflightReport
        : {
            itemCount: items.length,
            readyCount: 0,
            criticalCount: 0,
            riskyCount: 0,
            pendingApprovalCount: 0,
            readyToStart: items.length > 0,
            criticalItems: [],
            riskyItems: [],
            summary: items.length ? 'Review the plan before launch.' : 'Add at least one run-of-show block before launch.'
        };
    const isHostOperator = operatorRole === RUN_OF_SHOW_OPERATOR_ROLES.host;
    const roomUserCandidates = useMemo(
        () => normalizeRoomUserCandidates([
            ...(Array.isArray(roomUsers) ? roomUsers : []),
            ...((safeRoles.coHosts || []).map((uid) => ({ id: uid, name: uid })))
        ]),
        [roomUsers, safeRoles.coHosts]
    );
    const activePolicyPreset = useMemo(
        () => POLICY_PRESETS.find((preset) => (
            preset.policy.defaultAutomationMode === (safePolicy.defaultAutomationMode || 'auto')
            && preset.policy.lateBlockPolicy === (safePolicy.lateBlockPolicy || 'hold')
            && preset.policy.noShowPolicy === (safePolicy.noShowPolicy || 'hold_for_host')
            && preset.policy.queueDivergencePolicy === (safePolicy.queueDivergencePolicy || 'host_override_only')
            && preset.policy.blockedActionPolicy === (safePolicy.blockedActionPolicy || 'focus_next_fix')
        )) || null,
        [safePolicy]
    );
    const pendingApprovalGroups = useMemo(() => {
        const grouped = new Map();
        pendingApprovals.forEach((entry) => {
            const itemId = String(entry?.itemId || '').trim();
            if (!itemId) return;
            if (!grouped.has(itemId)) grouped.set(itemId, []);
            grouped.get(itemId).push(entry);
        });
        return Array.from(grouped.entries()).map(([itemId, entries]) => ({
            itemId,
            item: items.find((entry) => entry.id === itemId) || null,
            submissions: entries
        }));
    }, [items, pendingApprovals]);
    const openItem = useCallback((itemId = '', options = {}) => {
        if (!itemId) return;
        if (!options.preserveRepair) setRepairFocus(null);
        setExpandedItemId(itemId);
        setStudioMode('build');
        setPendingSetupScrollItemId(options.scrollToSetup !== false ? itemId : '');
    }, []);
    const liveAdjustmentTarget = liveItem || stagedItem || nextItem || null;
    const liveAdjustmentUpcomingTarget = stagedItem || nextItem || null;
    const liveAdjustmentDurationSec = Math.max(0, Number(liveAdjustmentTarget?.plannedDurationSec || 0));
    const liveAdjustmentSoundtrackConfigured = hasRunOfShowTakeoverSoundtrackIdentity(liveAdjustmentTarget?.presentationPlan || {});
    const liveAdjustmentSoundtrackActive = liveAdjustmentSoundtrackConfigured && liveAdjustmentTarget?.presentationPlan?.soundtrackAutoPlay === true;
    const liveAdjustmentAdvanceMode = getRunOfShowAdvanceMode(liveAdjustmentTarget || {});
    const liveAdjustmentHostAdvanceMinSec = getRunOfShowHostAdvanceMinSec(liveAdjustmentTarget || {});
    const liveAdjustmentElapsedSec = liveAdjustmentTarget?.status === 'live'
        ? Math.max(0, Math.floor((liveAdjustmentNowMs - Number(liveAdjustmentTarget?.liveStartedAtMs || 0)) / 1000))
        : 0;
    const liveAdjustmentSupportsAdvanceControl = liveItem?.id === liveAdjustmentTarget?.id
        && String(liveAdjustmentTarget?.type || '').trim().toLowerCase() !== 'performance';
    const liveAdjustmentRequiresHostAdvance = liveAdjustmentAdvanceMode !== RUN_OF_SHOW_ADVANCE_MODES.auto;
    const liveAdjustmentMinAdvanceRemainingSec = liveAdjustmentTarget?.status === 'live' && liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin
        ? Math.max(0, Math.ceil(((Number(liveAdjustmentTarget?.liveStartedAtMs || 0) + (liveAdjustmentHostAdvanceMinSec * 1000)) - liveAdjustmentNowMs) / 1000))
        : 0;
    const liveAdjustmentAdvanceSummary = liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.host
        ? 'host advances'
        : liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin
            ? (liveAdjustmentTarget?.status === 'live'
                ? (liveAdjustmentMinAdvanceRemainingSec > 0
                    ? `host can advance in ${formatDurationSec(liveAdjustmentMinAdvanceRemainingSec) || `${liveAdjustmentMinAdvanceRemainingSec}s`}`
                    : 'host can advance now')
                : `host advances after ${formatDurationSec(liveAdjustmentHostAdvanceMinSec) || `${liveAdjustmentHostAdvanceMinSec}s`}`)
            : '';
    const handleExtendLiveAdjustment = async (deltaSec = 30) => {
        if (!liveAdjustmentTarget?.id || typeof onUpdateItem !== 'function') return;
        await onUpdateItem(liveAdjustmentTarget.id, {
            plannedDurationSec: Math.max(6, liveAdjustmentDurationSec + Math.max(0, Number(deltaSec || 0)))
        });
        openItem(liveAdjustmentTarget.id, { preserveRepair: true, scrollToSetup: false });
    };
    const handleToggleLiveTakeoverSoundtrack = async () => {
        if (!liveAdjustmentTarget?.id || !liveAdjustmentSoundtrackConfigured || typeof onUpdateItem !== 'function') return;
        await onUpdateItem(liveAdjustmentTarget.id, {
            presentationPlan: {
                ...(liveAdjustmentTarget.presentationPlan || {}),
                soundtrackAutoPlay: !liveAdjustmentSoundtrackActive
            }
        });
        openItem(liveAdjustmentTarget.id, { preserveRepair: true, scrollToSetup: false });
    };
    const handleSetLiveAdvanceMode = async (nextMode = RUN_OF_SHOW_ADVANCE_MODES.auto, options = {}) => {
        if (!liveAdjustmentSupportsAdvanceControl || !liveAdjustmentTarget?.id || typeof onUpdateItem !== 'function') return;
        const extraSec = Math.max(5, Number(options.extraSec ?? liveWaitAtLeastSec) || 30);
        const nextPatch = nextMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin
            ? {
                advanceMode: RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin,
                requireHostAdvance: true,
                hostAdvanceMinSec: Math.max(0, liveAdjustmentElapsedSec + extraSec)
            }
            : nextMode === RUN_OF_SHOW_ADVANCE_MODES.host
                ? {
                    advanceMode: RUN_OF_SHOW_ADVANCE_MODES.host,
                    requireHostAdvance: true,
                    hostAdvanceMinSec: 0
                }
                : {
                    advanceMode: RUN_OF_SHOW_ADVANCE_MODES.auto,
                    requireHostAdvance: false,
                    hostAdvanceMinSec: 0
                };
        await onUpdateItem(liveAdjustmentTarget.id, nextPatch);
        openItem(liveAdjustmentTarget.id, { preserveRepair: true, scrollToSetup: false });
    };
    const handleLiveWaitAtLeastInput = async (rawValue = '') => {
        const nextExtraSec = Math.max(5, Number(rawValue || 0) || 0);
        setLiveWaitAtLeastSec(nextExtraSec);
        if (liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin) {
            await handleSetLiveAdvanceMode(RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin, { extraSec: nextExtraSec });
        }
    };
    const handleSkipUpcomingItem = async () => {
        if (!liveAdjustmentUpcomingTarget?.id || typeof onSkipItem !== 'function') return;
        await onSkipItem(liveAdjustmentUpcomingTarget.id, { manualAdvance: true });
    };
    useEffect(() => {
        if (!liveAdjustmentSupportsAdvanceControl || liveAdjustmentAdvanceMode !== RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin) return undefined;
        const timer = setInterval(() => {
            setLiveAdjustmentNowMs(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, [liveAdjustmentAdvanceMode, liveAdjustmentSupportsAdvanceControl]);
    useEffect(() => {
        if (!liveAdjustmentTarget?.id) return;
        if (liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin) {
            setLiveWaitAtLeastSec(Math.max(5, liveAdjustmentMinAdvanceRemainingSec || 30));
            return;
        }
        setLiveWaitAtLeastSec(30);
    }, [liveAdjustmentAdvanceMode, liveAdjustmentMinAdvanceRemainingSec, liveAdjustmentTarget?.id]);
    useEffect(() => {
        const targetId = String(focusRequest?.itemId || '').trim();
        if (!targetId) return;
        const targetItem = items.find((entry) => entry.id === targetId);
        if (!targetItem) return;
        const action = String(focusRequest?.action || '').trim().toLowerCase();
        if (action === 'approval') {
            setApprovalInboxOpen(true);
            setExpandedItemId(targetId);
            setStudioMode('review');
            setPendingSetupScrollItemId('');
            return;
        }
        if (action === 'backing') {
            const nextSourceType = getEffectiveSuggestionSourceType(targetItem?.backingPlan?.sourceType || 'youtube');
            setRepairFocus({ itemId: targetItem.id, action: 'backing', token: Date.now() });
            setStudioMode('build');
            setPendingSetupScrollItemId('');
            if (nextSourceType !== String(targetItem?.backingPlan?.sourceType || '').trim().toLowerCase()) {
                onUpdateItem?.(targetItem.id, {
                    backingPlan: {
                        ...(targetItem?.backingPlan || {}),
                        sourceType: nextSourceType
                    }
                });
            }
            setExpandedItemId(targetItem.id);
            setMediaPicker({
                itemId: targetItem.id,
                sourceType: nextSourceType,
                query: buildMediaQuery(targetItem),
                remoteResults: [],
                loading: false,
                error: ''
            });
            scrollPerformancePrepSectionIntoView(targetItem.id, 'track');
            return;
        }
        setRepairFocus({ itemId: targetItem.id, action: 'setup', token: Date.now() });
        openItem(targetItem.id, { preserveRepair: true, scrollToSetup: targetItem.type === 'performance' });
    }, [focusRequest?.action, focusRequest?.itemId, focusRequest?.token, items, onUpdateItem, openItem]);
    useEffect(() => {
        if (!pendingSetupScrollItemId || studioMode !== 'build') return;
        const targetId = pendingSetupScrollItemId;
        const frameId = window.requestAnimationFrame(() => {
            const setupNode = document.querySelector(`[data-performance-setup-for="${targetId}"]`);
            const fallbackNode = document.querySelector(`[data-run-of-show-item-id="${targetId}"]`);
            const node = setupNode || fallbackNode;
            if (node instanceof HTMLElement) {
                node.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
            setPendingSetupScrollItemId('');
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [pendingSetupScrollItemId, studioMode]);
    const sectionKey = (itemId = '', section = '') => `${String(itemId || '').trim()}::${String(section || '').trim()}`;
    const toggleSection = (itemId = '', section = '', defaultOpen = false) => {
        const key = sectionKey(itemId, section);
        setSectionOpenState((prev) => ({
            ...prev,
            [key]: Object.prototype.hasOwnProperty.call(prev, key) ? !prev[key] : !defaultOpen
        }));
    };
    const isSectionOpen = (itemId = '', section = '', defaultOpen = false) => {
        const key = sectionKey(itemId, section);
        return Object.prototype.hasOwnProperty.call(sectionOpenState, key) ? !!sectionOpenState[key] : defaultOpen;
    };
    const setSectionOpen = (itemId = '', section = '', open = true) => {
        const key = sectionKey(itemId, section);
        setSectionOpenState((prev) => ({ ...prev, [key]: !!open }));
    };
    const openSection = (itemId = '', section = '') => {
        setSectionOpen(itemId, section, true);
    };
    const scrollPerformancePrepSectionIntoView = (itemId = '', step = 'singer') => {
        const safeItemId = String(itemId || '').trim();
        const safeStep = ['singer', 'song', 'track'].includes(String(step || '').trim().toLowerCase())
            ? String(step || '').trim().toLowerCase()
            : 'singer';
        if (!safeItemId || typeof window === 'undefined' || typeof document === 'undefined') return;
        window.requestAnimationFrame(() => {
            const sectionNode = document.querySelector(`[data-run-of-show-prep-section="${safeItemId}:${safeStep}"]`);
            const setupNode = document.querySelector(`[data-performance-setup-for="${safeItemId}"]`);
            const node = sectionNode || setupNode;
            if (node instanceof HTMLElement && typeof node.scrollIntoView === 'function') {
                node.scrollIntoView({ block: safeStep === 'track' ? 'center' : 'nearest', behavior: 'smooth' });
            }
        });
    };
    const setExclusivePrepStep = (itemId = '', step = 'singer', options = {}) => {
        const safeItemId = String(itemId || '').trim();
        const safeStep = ['singer', 'song', 'track'].includes(String(step || '').trim().toLowerCase())
            ? String(step || '').trim().toLowerCase()
            : 'singer';
        if (!safeItemId) return;
        setSectionOpenState((prev) => ({
            ...prev,
            [sectionKey(safeItemId, 'prep_step_singer')]: safeStep === 'singer',
            [sectionKey(safeItemId, 'prep_step_song')]: safeStep === 'song',
            [sectionKey(safeItemId, 'prep_step_track')]: safeStep === 'track',
        }));
        if (options?.scroll !== false) {
            scrollPerformancePrepSectionIntoView(safeItemId, safeStep);
        }
    };
    const clearDragState = () => setDragState({ itemId: '', targetId: '', position: 'after' });
    const updateDragTarget = (targetId = '', position = 'after') => {
        setDragState((prev) => {
            if (!prev.itemId) return prev;
            return { ...prev, targetId: String(targetId || '').trim(), position: position === 'before' ? 'before' : 'after' };
        });
    };
    const moveItemToTarget = (draggedId = '', targetId = '', position = 'after') => {
        const safeDraggedId = String(draggedId || '').trim();
        const safeTargetId = String(targetId || '').trim();
        if (!safeDraggedId || !safeTargetId || safeDraggedId === safeTargetId) return;
        const fromIndex = items.findIndex((entry) => entry.id === safeDraggedId);
        const targetIndex = items.findIndex((entry) => entry.id === safeTargetId);
        if (fromIndex < 0 || targetIndex < 0) return;
        const withoutDragged = items.filter((entry) => entry.id !== safeDraggedId);
        const targetIndexInWithout = withoutDragged.findIndex((entry) => entry.id === safeTargetId);
        if (targetIndexInWithout < 0) return;
        const desiredIndex = position === 'before' ? targetIndexInWithout : targetIndexInWithout + 1;
        const delta = desiredIndex - fromIndex;
        if (!delta) return;
        onMoveItem?.(safeDraggedId, delta);
    };
    const handleStoryboardDrop = (targetId = '', fallbackPosition = 'after') => {
        if (!safeOperatorCapabilities.canEditFlow || !dragState.itemId) return;
        moveItemToTarget(dragState.itemId, targetId, dragState.position || fallbackPosition);
        clearDragState();
    };
    const currentPickerItem = useMemo(
        () => items.find((item) => item.id === mediaPicker.itemId) || null,
        [items, mediaPicker.itemId]
    );
    const pickerSourceType = String(
        mediaPicker.sourceType
        || currentPickerItem?.backingPlan?.sourceType
        || 'canonical_default'
    ).toLowerCase();
    const pickerQuery = String(mediaPicker.query || '').trim();
    const pickerLocalResults = useMemo(() => {
        if (pickerSourceType !== 'local_file') return [];
        return uniqueById((Array.isArray(localLibrary) ? localLibrary : [])
            .filter((entry) => {
                const title = entry?.title || entry?.trackName || entry?.fileName || entry?.id || '';
                const artist = entry?.artist || entry?.artistName || '';
                const assetId = entry?.id || entry?.fileName || entry?.url || '';
                return matchesMediaQuery([title, artist, entry?.fileName, assetId], pickerQuery);
            })
            .slice(0, 8)
            .map((entry, index) => {
                const title = String(entry?.title || entry?.trackName || entry?.fileName || `Local Track ${index + 1}`).trim();
                const artist = String(entry?.artist || entry?.artistName || '').trim();
                const assetId = String(entry?.id || entry?.fileName || entry?.url || '').trim();
                const mediaUrl = String(entry?.url || entry?.downloadURL || '').trim();
                return {
                    id: `local:${assetId || index}`,
                    title,
                    subtitle: artist || 'Host-managed local asset',
                    detail: compactMediaDetail(assetId ? `Asset ${assetId}` : '', mediaUrl ? 'Mapped local playback url' : 'No mapped url yet'),
                    tag: 'Local',
                    tone: 'violet',
                    statusLabel: mediaUrl ? 'Auto-ready' : 'Needs url',
                    statusTone: mediaUrl ? 'emerald' : 'amber',
                    actionHint: 'Use',
                    sourceType: 'local_file',
                    assetId,
                    durationSec: Math.max(0, Math.round(Number(entry?.durationSec || entry?.duration || 0) || 0)),
                    mediaUrl,
                    artworkUrl: String(entry?.artworkUrl100 || entry?.artworkUrl || '').trim()
                };
            }));
    }, [localLibrary, pickerQuery, pickerSourceType]);
    const pickerIndexedYouTubeResults = useMemo(() => {
        if (pickerSourceType !== 'youtube') return [];
        return uniqueById((Array.isArray(ytIndex) ? ytIndex : [])
            .filter((entry) => entry?.playable !== false)
            .filter((entry) => matchesMediaQuery([entry?.trackName, entry?.artistName, entry?.videoId, entry?.url], pickerQuery))
            .slice(0, 8)
            .map((entry, index) => {
                const videoId = String(entry?.videoId || '').trim();
                const title = String(entry?.trackName || `YouTube Track ${index + 1}`).trim();
                const artist = String(entry?.artistName || 'YouTube').trim();
                return {
                    id: `youtube:${videoId || index}`,
                    title,
                    subtitle: artist,
                    detail: compactMediaDetail(videoId ? `Video ${videoId}` : '', formatDurationSec(entry?.durationSec), 'Indexed host library'),
                    tag: 'Indexed',
                    tone: 'rose',
                    statusLabel: entry?.playable === false ? 'Review' : 'Verified',
                    statusTone: entry?.playable === false ? 'amber' : 'emerald',
                    actionHint: 'Use',
                    sourceType: 'youtube',
                    youtubeId: videoId,
                    durationSec: Math.max(0, Math.round(Number(entry?.durationSec || 0) || 0)),
                    mediaUrl: String(entry?.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '')).trim(),
                    artworkUrl: String(entry?.artworkUrl100 || entry?.artworkUrl || '').trim()
                };
            }));
    }, [pickerQuery, pickerSourceType, ytIndex]);
    const pickerSubmissionResults = useMemo(() => {
        if (pickerSourceType !== 'user_submitted') return [];
        return uniqueById((Array.isArray(submissions) ? submissions : [])
            .filter((entry) => String(entry?.submissionStatus || '').toLowerCase() === 'approved')
            .filter((entry) => matchesMediaQuery([entry?.songTitle, entry?.artistName, entry?.displayName, entry?.id], pickerQuery))
            .slice(0, 8)
            .map((entry) => ({
                id: `submitted:${entry.id}`,
                title: entry?.songTitle || 'Approved submission',
                subtitle: compactMediaDetail(entry?.artistName, entry?.displayName ? `Singer ${entry.displayName}` : ''),
                detail: compactMediaDetail(entry?.backingLabel, entry?.backingUrl || entry?.mediaUrl ? 'Singer supplied backing' : 'Song-only submission'),
                tag: 'Approved',
                tone: 'amber',
                statusLabel: entry?.backingUrl || entry?.mediaUrl || entry?.youtubeId ? 'Playback-ready' : 'Needs backing',
                statusTone: entry?.backingUrl || entry?.mediaUrl || entry?.youtubeId ? 'emerald' : 'amber',
                actionHint: 'Attach',
                sourceType: 'user_submitted',
                submissionId: String(entry?.id || '').trim(),
                mediaUrl: String(entry?.backingUrl || entry?.mediaUrl || '').trim(),
                youtubeId: String(entry?.youtubeId || '').trim(),
                titleValue: String(entry?.songTitle || '').trim(),
                artistValue: String(entry?.artistName || '').trim(),
                artworkUrl: String(entry?.albumArtUrl || '').trim()
            })));
    }, [pickerQuery, pickerSourceType, submissions]);
    const pickerResults = useMemo(() => {
        if (pickerSourceType === 'local_file') return pickerLocalResults;
        if (pickerSourceType === 'youtube') return uniqueById([...pickerLocalResults, ...pickerIndexedYouTubeResults, ...(mediaPicker.remoteResults || [])]);
        if (pickerSourceType === 'apple_music') return uniqueById([...pickerLocalResults, ...(mediaPicker.remoteResults || [])]);
        if (pickerSourceType === 'user_submitted') return pickerSubmissionResults;
        return [];
    }, [mediaPicker.remoteResults, pickerIndexedYouTubeResults, pickerLocalResults, pickerSourceType, pickerSubmissionResults]);
    const reviewItems = useMemo(
        () => items.filter((item) => {
            const pendingCount = pendingCountsById[item.id] || 0;
            const blockers = readinessById[item.id]?.blockers || [];
            return pendingCount > 0 || blockers.length > 0;
        }),
        [items, pendingCountsById, readinessById]
    );
    const performerIssueItems = useMemo(
        () => items.filter((item) => item.type === 'performance')
            .filter((item) => (readinessById[item.id]?.blockers || []).some((entry) => String(entry?.key || '').startsWith('performer_'))),
        [items, readinessById]
    );
    const backingIssueItems = useMemo(
        () => items.filter((item) => item.type === 'performance')
            .filter((item) => (readinessById[item.id]?.blockers || []).some((entry) => String(entry?.key || '').startsWith('backing_'))),
        [items, readinessById]
    );
    const issueJumpTargets = useMemo(
        () => ([
            {
                key: 'performer',
                label: 'need performer',
                count: performerIssueItems.length,
                itemId: performerIssueItems[0]?.id || '',
                action: 'setup'
            },
            {
                key: 'backing',
                label: 'need backing',
                count: backingIssueItems.length,
                itemId: backingIssueItems[0]?.id || '',
                action: 'backing'
            },
            {
                key: 'approval',
                label: 'pending approvals',
                count: pendingApprovalGroups.length,
                itemId: pendingApprovalGroups[0]?.itemId || '',
                action: 'approval'
            }
        ]),
        [backingIssueItems, pendingApprovalGroups, performerIssueItems]
    );
    const totalOpenIssues = useMemo(
        () => issueJumpTargets.reduce((sum, issue) => sum + Number(issue?.count || 0), 0),
        [issueJumpTargets]
    );
    const filteredOperatorCandidates = useMemo(() => {
        const query = normalizeSearch(coHostSearch);
        return roomUserCandidates.filter((candidate) => {
            if (safeRoles.coHosts?.includes(candidate.uid)) return true;
            if (!query) return true;
            return matchesMediaQuery([candidate.label, candidate.meta, candidate.uid], query);
        });
    }, [coHostSearch, roomUserCandidates, safeRoles.coHosts]);
    const liveOperatingHint = useMemo(() => {
        if (operatingHint) return operatingHint;
        const hintTarget = liveItem || stagedItem || nextItem || null;
        return getRunOfShowOperatingHint({
            item: hintTarget || {},
            readiness: hintTarget?.id ? readinessById[hintTarget.id] : null,
            policy: safePolicy,
        });
    }, [liveItem, nextItem, operatingHint, readinessById, safePolicy, stagedItem]);
    const focusedBuildItemId = expandedItemId || currentItemId || liveItem?.id || stagedItem?.id || nextItem?.id || items[0]?.id || '';
    const focusedBuildItem = useMemo(
        () => items.find((item) => item.id === focusedBuildItemId) || null,
        [focusedBuildItemId, items]
    );
    const performanceItems = useMemo(
        () => items.filter((item) => String(item?.type || '').trim().toLowerCase() === 'performance'),
        [items]
    );
    const assignmentStateById = useMemo(
        () => Object.fromEntries(performanceItems.map((item) => [
            item.id,
            getPerformanceAssignmentState(item, { pendingCount: Number(pendingCountsById[item.id] || 0) })
        ])),
        [pendingCountsById, performanceItems]
    );
    const slotAssignmentCounts = useMemo(() => {
        const counts = { all: performanceItems.length, needs_review: 0, empty: 0, ready: 0 };
        performanceItems.forEach((item) => {
            const state = assignmentStateById[item.id] || 'needs_review';
            counts[state] = Number(counts[state] || 0) + 1;
        });
        return counts;
    }, [assignmentStateById, performanceItems]);
    const filteredAssignmentItems = useMemo(
        () => slotAssignmentFilter === 'all'
            ? performanceItems
            : performanceItems.filter((item) => assignmentStateById[item.id] === slotAssignmentFilter),
        [assignmentStateById, performanceItems, slotAssignmentFilter]
    );
    const slotFillCandidateCount = useMemo(
        () => performanceItems.filter((item) => isUnassignedPerformanceItem(item)).length,
        [performanceItems]
    );
    useEffect(() => {
        if (studioMode !== 'build') return;
        if (slotAssignmentFilter === 'all') return;
        if (!filteredAssignmentItems.length) return;
        if (assignmentStateById[focusedBuildItemId] === slotAssignmentFilter) return;
        openItem(filteredAssignmentItems[0]?.id || '', { scrollToSetup: false });
    }, [assignmentStateById, filteredAssignmentItems, focusedBuildItemId, openItem, slotAssignmentFilter, studioMode]);
    const normalizedTriviaBank = useMemo(
        () => (Array.isArray(TRIVIA_BANK) ? TRIVIA_BANK : []).map((entry, index) => normalizeTriviaEntry(entry, index)).filter((entry) => entry.q),
        []
    );
    const normalizedWyrBank = useMemo(
        () => (Array.isArray(WYR_BANK) ? WYR_BANK : []).map((entry, index) => normalizeWyrEntry(entry, index)).filter((entry) => entry.q),
        []
    );
    const focusedInteractiveBankEntries = useMemo(() => {
        if (focusedBuildItem?.type === 'trivia_break') {
            const query = normalizeSearch(interactiveLibraryFilter);
            return normalizedTriviaBank.filter((entry) => {
                if (!query) return true;
                return [entry.q, entry.correct, entry.w1, entry.w2, entry.w3]
                    .map((value) => normalizeSearch(value))
                    .filter(Boolean)
                    .some((value) => value.includes(query));
            });
        }
        if (focusedBuildItem?.type === 'would_you_rather_break') {
            const query = normalizeSearch(interactiveLibraryFilter);
            return normalizedWyrBank.filter((entry) => {
                if (!query) return true;
                return [entry.q, entry.a, entry.b]
                    .map((value) => normalizeSearch(value))
                    .filter(Boolean)
                    .some((value) => value.includes(query));
            });
        }
        return [];
    }, [focusedBuildItem?.type, interactiveLibraryFilter, normalizedTriviaBank, normalizedWyrBank]);
    const focusedBuildItemIndex = useMemo(
        () => focusedBuildItem ? items.findIndex((item) => item.id === focusedBuildItem.id) : -1,
        [focusedBuildItem, items]
    );
    const repairFocusItemId = String(repairFocus?.itemId || '').trim();
    const repairModeActive = studioMode === 'build' && !!repairFocusItemId && repairFocusItemId === focusedBuildItemId;
    const repairFocusMeta = useMemo(() => {
        if (!repairModeActive || !focusedBuildItem) return null;
        const action = String(repairFocus?.action || 'setup').trim().toLowerCase();
        if (action === 'backing') {
            return {
                eyebrow: 'Track repair',
                title: 'Pick or confirm one track',
                detail: 'The show only needs this backing fixed right now. Builder tools are tucked away until you reopen the full builder.',
                toneClass: 'border-amber-300/18 bg-amber-500/10 text-amber-50',
                chipClass: 'border-amber-300/25 bg-black/25 text-amber-100'
            };
        }
        return {
            eyebrow: 'Scene repair',
            title: focusedBuildItem.type === 'performance' ? 'Finish this performance slot' : 'Finish this scene',
            detail: 'Stay on this one block, make the needed fix, then jump back into the full builder only if you need broader edits.',
            toneClass: 'border-cyan-300/18 bg-cyan-500/10 text-cyan-50',
            chipClass: 'border-cyan-300/25 bg-black/25 text-cyan-100'
        };
    }, [focusedBuildItem, repairFocus?.action, repairModeActive]);
    useEffect(() => {
        setInteractiveLibraryFilter('');
        setInteractiveLibrarySelection('');
    }, [focusedBuildItemId]);
    const topBoardTarget = liveItem || stagedItem || nextItem || focusedBuildItem || items[0] || null;
    const updateInteractiveLaunchConfig = (item, patch = {}) => {
        if (!item?.id) return;
        const nextModeKey = item.type === 'trivia_break'
            ? 'trivia_pop'
            : item.type === 'would_you_rather_break'
                ? 'wyr'
                : (item.modeLaunchPlan?.modeKey || 'crowd_play');
        const nextLaunchConfig = {
            ...(item.modeLaunchPlan?.launchConfig || {}),
            ...patch
        };
        if (Array.isArray(nextLaunchConfig.options)) {
            nextLaunchConfig.options = nextLaunchConfig.options.map((entry) => String(entry || '').trim());
            nextLaunchConfig.optionsCsv = nextLaunchConfig.options.filter(Boolean).join(', ');
        }
        onUpdateItem?.(item.id, {
            modeLaunchPlan: {
                ...(item.modeLaunchPlan || {}),
                modeKey: nextModeKey,
                launchConfig: nextLaunchConfig
            }
        });
    };
    const applyInteractiveBankEntry = (item, entry) => {
        if (!item?.id || !entry) return;
        if (item.type === 'trivia_break') {
            updateInteractiveLaunchConfig(item, buildTriviaLaunchConfigFromEntry(entry));
            return;
        }
        if (item.type === 'would_you_rather_break') {
            updateInteractiveLaunchConfig(item, buildWyrLaunchConfigFromEntry(entry));
        }
    };
    const applyRandomInteractiveBankEntry = (item) => {
        const source = item?.type === 'trivia_break'
            ? normalizedTriviaBank
            : item?.type === 'would_you_rather_break'
                ? normalizedWyrBank
                : [];
        if (!source.length) return;
        const pick = source[Math.floor(Math.random() * source.length)];
        applyInteractiveBankEntry(item, pick);
    };
    const compactBoardSummary = useMemo(() => {
        const parts = [];
        if (items.length) parts.push(`${items.length} scene${items.length === 1 ? '' : 's'}`);
        if (totalOpenIssues) {
            parts.push(`${totalOpenIssues} open issue${totalOpenIssues === 1 ? '' : 's'}`);
        } else if (items.length) {
            parts.push('no open issues');
        }
        if (isRunOfShowActive) {
            parts.push(automationPaused ? 'automation paused' : 'run is live');
        } else if (items.length) {
            parts.push('timeline prep');
        }
        return parts.join(' · ');
    }, [automationPaused, isRunOfShowActive, items.length, totalOpenIssues]);
    useEffect(() => {
        const preferred = currentItemId || liveItem?.id || stagedItem?.id || nextItem?.id || items[0]?.id || '';
        setExpandedItemId((prev) => (prev && items.some((item) => item.id === prev) ? prev : preferred));
    }, [currentItemId, items, liveItem?.id, stagedItem?.id, nextItem?.id]);
    useEffect(() => {
        if (!isRunOfShowActive) return;
        setStudioMode('run');
        setGoLiveSheetOpen(false);
        setWorkspaceToolsOpen(false);
        setQuickDraftModalOpen(false);
        setTopBoardCollapsed(true);
    }, [isRunOfShowActive]);
    useEffect(() => {
        if (!isRunOfShowActive) {
            setLiveTimelineOpen(false);
        }
    }, [isRunOfShowActive]);
    useEffect(() => {
        if (studioMode !== 'build' && repairFocusItemId) {
            setRepairFocus(null);
        }
    }, [repairFocusItemId, studioMode]);
    useEffect(() => {
        if (!repairFocusItemId) return;
        if (!items.some((item) => item.id === repairFocusItemId)) {
            setRepairFocus(null);
        }
    }, [items, repairFocusItemId]);
    useEffect(() => {
        if (studioMode === 'build') return;
        if (!expandedItemId || typeof document === 'undefined') return;
        const node = document.querySelector(`[data-run-of-show-item-id="${expandedItemId}"]`);
        if (node && typeof node.scrollIntoView === 'function') {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [expandedItemId, studioMode]);
    useEffect(() => {
        setTemplateDraftName((prev) => prev || safeTemplateMeta?.currentTemplateName || '');
    }, [safeTemplateMeta?.currentTemplateName]);
    useEffect(() => {
        if (items.length === 0) {
            setGeneratorOpen(true);
        }
    }, [items.length]);

    useEffect(() => {
        if (!currentPickerItem) {
            setMediaPicker((prev) => ({ ...prev, remoteResults: [], loading: false, error: '' }));
            return undefined;
        }
        if (pickerSourceType !== 'apple_music' && pickerSourceType !== 'youtube') {
            setMediaPicker((prev) => ({ ...prev, remoteResults: [], loading: false, error: '' }));
            return undefined;
        }
        const query = pickerQuery || buildMediaQuery(currentPickerItem);
        if (query.length < 2) {
            setMediaPicker((prev) => ({ ...prev, remoteResults: [], loading: false, error: '' }));
            return undefined;
        }
        let cancelled = false;
        const timeoutId = window.setTimeout(async () => {
            setMediaPicker((prev) => ({ ...prev, loading: true, error: '' }));
            try {
                if (pickerSourceType === 'apple_music') {
                    const data = await callFunction('itunesSearch', {
                        term: query,
                        limit: 8,
                        roomCode,
                        usageContext: { source: 'host_run_of_show_apple_search' }
                    });
                    if (cancelled) return;
                    const results = (Array.isArray(data?.results) ? data.results : []).map((entry, index) => ({
                        id: `apple:${entry?.trackId || index}`,
                        title: String(entry?.trackName || `Apple Track ${index + 1}`).trim(),
                        subtitle: String(entry?.artistName || 'Apple Music').trim(),
                        detail: compactMediaDetail(entry?.collectionName, entry?.trackTimeMillis ? formatDurationSec(Math.round(Number(entry.trackTimeMillis || 0) / 1000)) : '', appleMusicAuthorized ? 'Apple account connected' : 'iTunes catalog result'),
                        tag: 'Apple',
                        tone: 'cyan',
                        statusLabel: entry?.previewUrl ? 'Preview audio' : 'Metadata only',
                        statusTone: entry?.previewUrl ? 'emerald' : 'amber',
                        actionHint: 'Use',
                        sourceType: 'apple_music',
                        trackId: String(entry?.trackId || '').trim(),
                        appleMusicId: String(entry?.trackId || '').trim(),
                        durationSec: Math.max(0, Math.round(Number(entry?.trackTimeMillis || 0) / 1000) || 0),
                        mediaUrl: String(entry?.previewUrl || '').trim(),
                        titleValue: String(entry?.trackName || '').trim(),
                        artistValue: String(entry?.artistName || '').trim(),
                        artworkUrl: String(entry?.artworkUrl100 || '').trim()
                    }));
                    setMediaPicker((prev) => ({ ...prev, remoteResults: uniqueById(results), loading: false, error: '' }));
                    return;
                }
                const data = await callFunction('youtubeSearch', {
                    query: `${query} karaoke`,
                    maxResults: 6,
                    playableOnly: true,
                    roomCode,
                    usageContext: { source: 'host_run_of_show_youtube_search' }
                });
                if (cancelled) return;
                const results = (Array.isArray(data?.items) ? data.items : []).map((entry, index) => {
                    const videoId = String(entry?.id || '').trim();
                    return {
                        id: `youtube:${videoId || index}`,
                        title: String(entry?.title || `YouTube Result ${index + 1}`).trim(),
                        subtitle: String(entry?.channelTitle || entry?.channel || 'YouTube').trim(),
                        detail: compactMediaDetail(videoId ? `Video ${videoId}` : '', formatDurationSec(entry?.durationSec), 'Live search'),
                        tag: 'Live',
                        tone: 'rose',
                        statusLabel: 'Playable',
                        statusTone: 'emerald',
                        actionHint: 'Use',
                        sourceType: 'youtube',
                        youtubeId: videoId,
                        durationSec: Math.max(0, Math.round(Number(entry?.durationSec || 0) || 0)),
                        mediaUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
                        artworkUrl: String(entry?.thumbnails?.medium?.url || entry?.thumbnails?.default?.url || '').trim()
                    };
                }).filter((entry) => entry.youtubeId || entry.mediaUrl);
                setMediaPicker((prev) => ({ ...prev, remoteResults: uniqueById(results), loading: false, error: '' }));
            } catch (_error) {
                if (cancelled) return;
                setMediaPicker((prev) => ({
                    ...prev,
                    remoteResults: [],
                    loading: false,
                    error: `Could not load ${pickerSourceType === 'apple_music' ? 'Apple' : 'YouTube'} results right now.`
                }));
            }
        }, 300);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [appleMusicAuthorized, currentPickerItem, pickerQuery, pickerSourceType, roomCode]);

    const handleRunOfShowModeToggle = async () => {
        if (!isHostOperator || modeActionBusy) return;
        setModeActionBusy(true);
        try {
            if (isRunOfShowActive) {
                if (typeof onStopRunOfShow === 'function') {
                    await onStopRunOfShow();
                } else if (typeof onSetProgramMode === 'function') {
                    await onSetProgramMode('standard_karaoke');
                }
            } else if (typeof onStartRunOfShow === 'function') {
                if (!safePreflightReport.readyToStart || safePreflightReport.criticalCount > 0 || safePreflightReport.riskyCount > 0) {
                    setGoLiveSheetOpen(true);
                    return;
                }
                await onStartRunOfShow();
            } else if (typeof onSetProgramMode === 'function') {
                await onSetProgramMode('run_of_show');
            }
        } finally {
            setModeActionBusy(false);
        }
    };
    const handleLaunchFromGoLive = async (options = {}) => {
        if (!isHostOperator || modeActionBusy || typeof onStartRunOfShow !== 'function') return;
        setModeActionBusy(true);
        try {
            await onStartRunOfShow({ allowUnsafe: options.allowUnsafe === true });
            setGoLiveSheetOpen(false);
        } finally {
            setModeActionBusy(false);
        }
    };

    const handleApplyPolicyPreset = (preset = null) => {
        if (!safeOperatorCapabilities.canEditFlow || !preset?.policy) return;
        onUpdatePolicy?.(preset.policy);
    };

    const focusFirstPendingApproval = () => {
        const firstPending = pendingApprovals[0];
        if (!firstPending?.itemId) return;
        setApprovalInboxOpen(true);
        openItem(firstPending.itemId);
    };
    const handleSubmissionDecision = async (submissionId = '', decision = '', targetItem = null) => {
        if (!submissionId || !decision || typeof onReviewSubmission !== 'function') return;
        await onReviewSubmission(submissionId, decision);
        if (decision === 'approved' && targetItem?.type === 'performance' && targetItem?.backingPlan?.playbackReady !== true) {
            setExclusivePrepStep(targetItem.id, 'track');
            openRepairForItem(targetItem, 'backing');
            return;
        }
        if (decision === 'approved' && targetItem?.id) {
            setExclusivePrepStep(targetItem.id, 'track');
        }
    };
    const handleAssignQueueSong = async (queueSong = null, targetItem = null) => {
        if (!queueSong?.id || !targetItem?.id || typeof onAssignQueueSongToItem !== 'function') return;
        await onAssignQueueSongToItem(queueSong.id, targetItem.id);
        const queueTrackAttached = !!(
            String(queueSong?.mediaUrl || '').trim()
            || String(queueSong?.appleMusicId || '').trim()
            || String(queueSong?.trackId || '').trim()
        );
        if (!queueTrackAttached && targetItem.type === 'performance') {
            setExclusivePrepStep(targetItem.id, 'track');
            openRepairForItem(targetItem, 'backing');
            return;
        }
        setExclusivePrepStep(targetItem.id, 'track');
    };
    const handleFillEmptySlots = async () => {
        if (!safeOperatorCapabilities.canEditFlow || slotFillBusy) return;
        const fillableItems = performanceItems.filter((item) => isUnassignedPerformanceItem(item));
        if (!fillableItems.length) {
            setSlotAssignmentNotice('No unassigned performance slots to fill.');
            return;
        }
        setSlotFillBusy(true);
        setSlotAssignmentNotice('');
        const approvedSubmissionByItemId = new Map(
            (Array.isArray(submissions) ? submissions : [])
                .filter((entry) => String(entry?.submissionStatus || '').trim().toLowerCase() === 'approved')
                .map((entry) => [String(entry?.itemId || '').trim(), entry])
                .filter(([itemId]) => !!itemId)
        );
        const usedQueueIds = new Set(
            performanceItems
                .map((item) => String(item?.preparedQueueSongId || '').trim())
                .filter(Boolean)
        );
        const queuePool = (Array.isArray(queueSongs) ? queueSongs : [])
            .filter((song) => String(song?.status || '').trim().toLowerCase() === 'requested')
            .filter((song) => !usedQueueIds.has(String(song?.id || '').trim()));
        let queueCursor = 0;
        let filledCount = 0;
        let remainingEmptyCount = fillableItems.length;
        let firstFilledItemId = '';
        try {
            for (const item of fillableItems) {
                const approvedSubmission = approvedSubmissionByItemId.get(String(item?.id || '').trim()) || null;
                if (approvedSubmission) {
                    onUpdateItem?.(item.id, buildSubmissionAssignmentPatch(approvedSubmission, item));
                    filledCount += 1;
                    remainingEmptyCount -= 1;
                    if (!firstFilledItemId) firstFilledItemId = item.id;
                    continue;
                }
                while (queueCursor < queuePool.length && usedQueueIds.has(String(queuePool[queueCursor]?.id || '').trim())) {
                    queueCursor += 1;
                }
                const queueSong = queuePool[queueCursor] || null;
                if (!queueSong) continue;
                const safeQueueId = String(queueSong?.id || '').trim();
                if (!safeQueueId) continue;
                usedQueueIds.add(safeQueueId);
                queueCursor += 1;
                if (typeof onAssignQueueSongToItem === 'function') {
                    await onAssignQueueSongToItem(safeQueueId, item.id);
                } else {
                    onUpdateItem?.(item.id, buildQueueAssignmentFallbackPatch(queueSong, item));
                }
                filledCount += 1;
                remainingEmptyCount -= 1;
                if (!firstFilledItemId) firstFilledItemId = item.id;
            }
        } finally {
            setSlotFillBusy(false);
        }
        if (firstFilledItemId) {
            openItem(firstFilledItemId);
            setExclusivePrepStep(firstFilledItemId, 'track');
        }
        setSlotAssignmentNotice(
            filledCount > 0
                ? `Filled ${filledCount} unassigned slot${filledCount === 1 ? '' : 's'}. ${remainingEmptyCount} still unassigned.`
                : 'No unassigned slots could be filled from approved submissions or the live queue.'
        );
        if (filledCount > 0 && slotAssignmentFilter === 'empty') {
            setSlotAssignmentFilter(remainingEmptyCount > 0 ? 'empty' : 'needs_review');
        }
    };
    const jumpToIssue = (issue = null) => {
        const itemId = String(issue?.itemId || '').trim();
        if (!itemId) return;
        if (issue?.action === 'approval') {
            setApprovalInboxOpen(true);
            openItem(itemId);
            return;
        }
        const targetItem = items.find((entry) => entry.id === itemId);
        if (!targetItem) return;
        openRepairForItem(targetItem, issue?.action === 'backing' ? 'backing' : 'setup');
    };
    const focusFirstCriticalPreflightIssue = () => {
        const firstCritical = safePreflightReport.criticalItems?.[0] || null;
        if (!firstCritical?.itemId) return;
        const targetItem = items.find((entry) => entry.id === firstCritical.itemId);
        if (!targetItem) return;
        openRepairForItem(targetItem, getRepairActionForItem(targetItem));
    };
    const focusFirstRiskyPreflightItem = () => {
        const firstRisky = safePreflightReport.riskyItems?.[0] || null;
        if (!firstRisky?.itemId) {
            setStudioMode('review');
            return;
        }
        const targetItem = items.find((entry) => entry.id === firstRisky.itemId);
        if (!targetItem) return;
        openRepairForItem(targetItem, getRepairActionForItem(targetItem));
    };
    const liveHudIssueDetail = nextItem?.id && pendingApprovals.some((entry) => entry.itemId === nextItem.id)
        ? 'The next block still needs singer approval.'
        : nextItem?.id && readinessById[nextItem.id]?.blockers?.length
            ? getRunOfShowBlockedActionLabel(readinessById[nextItem.id], nextItem, safePolicy)
            : safePreflightReport?.criticalItems?.[0]?.summary || safePreflightReport?.riskyItems?.[0]?.summary || '';
    const liveHudIssue = getRunOfShowHudState({
        hasPlan: items.length > 0,
        runEnabled: isRunOfShowActive,
        automationPaused,
        preflightReport: safePreflightReport,
        issueDetail: liveHudIssueDetail,
        liveItemId: liveItem?.id,
        stagedItemId: stagedItem?.id,
        nextItemId: nextItem?.id
    });
    const liveHudToneClass = getRunOfShowHudToneClass(liveHudIssue.tone);
    const liveHudActionKey = getRunOfShowHudActionKey({
        hasPlan: items.length > 0,
        runEnabled: isRunOfShowActive,
        automationPaused,
        preflightReport: safePreflightReport,
        hasIssue: !!liveHudIssueDetail
    });
    const liveHudPrimaryAction = (() => {
        if (liveHudActionKey === 'resume' && safeOperatorCapabilities.canPauseAutomation) {
            return {
                label: 'Resume',
                tone: 'success',
                onClick: () => onToggleAutomationPause?.(false)
            };
        }
        if (liveHudActionKey === 'fix_issue' && nextItem?.id && pendingApprovals.some((entry) => entry.itemId === nextItem.id) && safeOperatorCapabilities.canReviewSubmissions) {
            return {
                label: 'Fix Issue',
                tone: 'warning',
                onClick: focusFirstPendingApproval
            };
        }
        if (liveHudActionKey === 'fix_issue' && nextItem?.id && readinessById[nextItem.id]?.blockers?.length) {
            return {
                label: 'Fix Issue',
                tone: 'warning',
                onClick: () => jumpToIssue({ itemId: nextItem.id, action: getRepairActionForItem(nextItem) })
            };
        }
        if (liveHudActionKey === 'fix_issue') {
            return {
                label: 'Fix Issue',
                tone: 'warning',
                onClick: safePreflightReport?.criticalItems?.[0]?.itemId
                    ? focusFirstCriticalPreflightIssue
                    : focusFirstRiskyPreflightItem
            };
        }
        if (liveHudActionKey === 'go_live_check') {
            return {
                label: 'Go Live Check',
                tone: 'primary',
                onClick: () => setGoLiveSheetOpen(true)
            };
        }
        if (liveHudActionKey === 'start_show') {
            return {
                label: 'Start Show',
                tone: 'primary',
                onClick: () => handleLaunchFromGoLive()
            };
        }
        const liveAction = getPrimaryActionForItem(
            liveItem,
            liveItem?.id ? readinessById[liveItem.id] : null,
            { pendingCount: liveItem?.id ? pendingApprovals.filter((entry) => entry.itemId === liveItem.id).length : 0 }
        );
        if (liveAction) {
            return {
                ...liveAction,
                label: 'Advance'
            };
        }
        const railItem = stagedItem || nextItem;
        const railAction = getPrimaryActionForItem(
            railItem,
            railItem?.id ? readinessById[railItem.id] : null,
            { pendingCount: railItem?.id ? pendingApprovals.filter((entry) => entry.itemId === railItem.id).length : 0 }
        );
        if (!railAction) return null;
        return {
            ...railAction,
            label: 'Advance'
        };
    })();
    const focusNewestItemFromDirector = (nextDirector = null, fallbackType = '') => {
        const nextItems = Array.isArray(nextDirector?.items) ? nextDirector.items : [];
        if (!nextItems.length) return;
        const existingIds = new Set(items.map((entry) => entry.id));
        const newItems = nextItems.filter((entry) => !existingIds.has(entry.id));
        const target = [...newItems].reverse().find((entry) => !fallbackType || entry.type === fallbackType) || nextItems[nextItems.length - 1];
        if (target?.id) openItem(target.id, { scrollToSetup: target.type === 'performance' });
    };
    const handleAddItemAndFocus = async (type = 'buffer', overrides = {}) => {
        const nextDirector = await onAddItem?.(type, overrides);
        focusNewestItemFromDirector(nextDirector, type);
        return nextDirector;
    };
    const toggleCoHost = (uid = '') => {
        if (!safeOperatorCapabilities.canManageRoles) return;
        const safeUid = String(uid || '').trim();
        if (!safeUid) return;
        const nextCoHosts = safeRoles.coHosts?.includes(safeUid)
            ? safeRoles.coHosts.filter((entry) => entry !== safeUid)
            : [...(safeRoles.coHosts || []), safeUid];
        onUpdateRoles?.({ coHosts: nextCoHosts });
    };
    const updateGeneratorConfig = (patch = {}) => {
        setGeneratorConfig((prev) => {
            const nextFormat = patch.format || prev.format;
            const formatDefaults = GENERATOR_FORMAT_DEFAULTS[nextFormat] || {};
            return {
                ...prev,
                ...(patch.format ? formatDefaults : {}),
                ...(patch || {})
            };
        });
    };
    const generatedDraftItems = useMemo(
        () => buildGeneratedRunOfShowItems(generatorConfig),
        [generatorConfig]
    );
    const generatedPolicyPreset = useMemo(
        () => POLICY_PRESETS.find((preset) => preset.id === generatorConfig.automationPresetId) || POLICY_PRESETS[1],
        [generatorConfig.automationPresetId]
    );
    const applyGeneratorDraft = async () => {
        if (generatorBusy || typeof onApplyGeneratedDraft !== 'function') return;
        setGeneratorBusy(true);
        try {
            const nextDirector = await onApplyGeneratedDraft({
                items: generatedDraftItems,
                mode: generatorConfig.applyMode || 'replace'
            });
            if (generatedPolicyPreset?.policy) {
                await onUpdatePolicy?.(generatedPolicyPreset.policy);
            }
            focusNewestItemFromDirector(nextDirector);
            setGeneratorOpen(false);
        } finally {
            setGeneratorBusy(false);
        }
    };
    const assignLobbyPerformer = (item = {}, candidate = null) => {
        const itemId = String(item?.id || '').trim();
        const uid = String(candidate?.uid || '').trim();
        if (!itemId || !uid) return;
        const label = String(candidate?.label || '').trim() || uid;
        onUpdateItem?.(itemId, {
            performerMode: RUN_OF_SHOW_PERFORMER_MODES.assigned,
            assignedPerformerUid: uid,
            assignedPerformerName: label
        });
    };
    const clearLobbyPerformer = (item = {}) => {
        const itemId = String(item?.id || '').trim();
        if (!itemId) return;
        onUpdateItem?.(itemId, { assignedPerformerUid: '' });
    };
    const loadSuggestedBacking = (item = {}) => {
        if (!item?.id) return;
        const nextSourceType = getEffectiveSuggestionSourceType(item?.backingPlan?.sourceType || 'youtube');
        if (nextSourceType !== String(item?.backingPlan?.sourceType || '').trim().toLowerCase()) {
            onUpdateItem?.(item.id, {
                backingPlan: {
                    ...(item?.backingPlan || {}),
                    sourceType: nextSourceType
                }
            });
        }
        setExpandedItemId(item.id);
        setMediaPicker({
            itemId: item.id,
            sourceType: nextSourceType,
            query: buildMediaQuery(item),
            remoteResults: [],
            loading: false,
            error: ''
        });
        scrollPerformancePrepSectionIntoView(item.id, 'track');
    };
    function getRepairActionForItem(item = {}) {
        const blockers = readinessById[item?.id]?.blockers || [];
        const firstBlockingKey = String(blockers[0]?.key || '').trim().toLowerCase();
        return firstBlockingKey.startsWith('backing_') ? 'backing' : 'setup';
    }
    const openRepairForItem = (item = {}, action = 'setup') => {
        if (!item?.id) return;
        const safeAction = String(action || 'setup').trim().toLowerCase() === 'backing' ? 'backing' : 'setup';
        setRepairFocus({ itemId: item.id, action: safeAction, token: Date.now() });
        setStudioMode('build');
        if (safeAction === 'backing') {
            setPendingSetupScrollItemId('');
            loadSuggestedBacking(item);
            return;
        }
        openItem(item.id, { scrollToSetup: item.type === 'performance', preserveRepair: true });
    };
    const getSuggestedOptionsForItem = (item = {}) => {
        const sourceType = getEffectiveSuggestionSourceType(item?.backingPlan?.sourceType || 'canonical_default');
        const queryText = buildMediaQuery(item);
        if (!queryText) return [];
        const localMatches = uniqueById((Array.isArray(localLibrary) ? localLibrary : [])
            .filter((entry) => matchesMediaQuery([entry?.title, entry?.artist, entry?.fileName, entry?.id], queryText))
            .slice(0, 3)
            .map((entry, index) => ({
                id: `suggest-local:${entry?.id || index}`,
                title: String(entry?.title || entry?.fileName || `Local Track ${index + 1}`).trim(),
                subtitle: String(entry?.artist || 'Local Asset').trim(),
                detail: compactMediaDetail(entry?.fileName, 'Host library'),
                tag: 'Local',
                tone: 'violet',
                sourceType: 'local_file',
                assetId: String(entry?.id || '').trim(),
                mediaUrl: String(entry?.url || '').trim(),
                artworkUrl: String(entry?.artworkUrl100 || entry?.artworkUrl || '').trim(),
                actionHint: 'Use'
            })));
        const youtubeMatches = sourceType === 'apple_music'
            ? []
            : uniqueById((Array.isArray(ytIndex) ? ytIndex : [])
                .filter((entry) => entry?.playable !== false)
                .filter((entry) => matchesMediaQuery([entry?.trackName, entry?.artistName, entry?.videoId], queryText))
                .slice(0, 3)
                .map((entry, index) => ({
                    id: `suggest-youtube:${entry?.videoId || index}`,
                    title: String(entry?.trackName || `YouTube Match ${index + 1}`).trim(),
                    subtitle: String(entry?.artistName || 'YouTube').trim(),
                    detail: compactMediaDetail(entry?.videoId, 'Indexed YouTube'),
                    tag: 'YouTube',
                    tone: 'rose',
                    sourceType: 'youtube',
                    youtubeId: String(entry?.videoId || '').trim(),
                    mediaUrl: String(entry?.url || '').trim(),
                    artworkUrl: String(entry?.artworkUrl100 || entry?.artworkUrl || '').trim(),
                    actionHint: 'Use'
                })));
        const approvedSubmissionMatches = uniqueById((Array.isArray(submissions) ? submissions : [])
            .filter((entry) => String(entry?.submissionStatus || '').toLowerCase() === 'approved')
            .filter((entry) => matchesMediaQuery([entry?.songTitle, entry?.artistName, entry?.displayName], queryText))
            .slice(0, 2)
            .map((entry) => ({
                id: `suggest-submission:${entry.id}`,
                title: String(entry?.songTitle || 'Approved Submission').trim(),
                subtitle: compactMediaDetail(entry?.artistName, entry?.displayName),
                detail: compactMediaDetail(entry?.backingLabel, 'Approved submission'),
                tag: 'Approved',
                tone: 'amber',
                sourceType: 'user_submitted',
                submissionId: String(entry?.id || '').trim(),
                mediaUrl: String(entry?.backingUrl || entry?.mediaUrl || '').trim(),
                youtubeId: String(entry?.youtubeId || '').trim(),
                artworkUrl: String(entry?.albumArtUrl || '').trim(),
                actionHint: 'Attach'
            })));
        const remoteMatches = mediaPicker.itemId === item.id ? (mediaPicker.remoteResults || []) : [];
        if (sourceType === 'local_file') return localMatches;
        if (sourceType === 'user_submitted') return uniqueById([...approvedSubmissionMatches, ...localMatches]);
        if (sourceType === 'apple_music') return uniqueById([...localMatches, ...remoteMatches]);
        return uniqueById([...youtubeMatches, ...approvedSubmissionMatches, ...localMatches, ...remoteMatches]);
    };
    function getPrimaryActionForItem(item = null, readiness = null, options = {}) {
        if (!item || !safeOperatorCapabilities.canEditFlow && !safeOperatorCapabilities.canOperate) return null;
        const pendingCount = Number(options.pendingCount || 0);
        const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers : [];
        const status = String(item?.status || '').toLowerCase();
        if (status === 'live' && safeOperatorCapabilities.canOperate) {
            return { label: 'Complete', tone: 'success', onClick: () => onCompleteItem?.(item.id) };
        }
        if (status === 'staged' && safeOperatorCapabilities.canOperate) {
            return { label: 'Go Live', tone: 'success', onClick: () => onStartItem?.(item.id) };
        }
        if (['complete', 'skipped'].includes(status)) return null;
        if (!blockers.length && safeOperatorCapabilities.canOperate) {
            return { label: 'Stage', tone: 'primary', onClick: () => onPrepareItem?.(item.id) };
        }
        if (item?.type === 'performance') {
            const blockerKeys = blockers.map((entry) => entry.key);
            if (pendingCount > 0 && blockerKeys.includes('performer_submission_pending') && safeOperatorCapabilities.canReviewSubmissions) {
                return {
                    label: 'Review Submission',
                    tone: 'warning',
                    onClick: () => {
                        setApprovalInboxOpen(true);
                        openItem(item.id);
                    }
                };
            }
            if (blockerKeys.some((key) => key.startsWith('performer_'))) {
                return { label: 'Assign Singer', tone: 'warning', onClick: () => openItem(item.id) };
            }
            if (blockerKeys.some((key) => key.startsWith('backing_'))) {
                return { label: 'Pick Backing', tone: 'warning', onClick: () => loadSuggestedBacking(item) };
            }
        }
        return { label: blockers.length ? 'Finish Setup' : 'Stage', tone: blockers.length ? 'warning' : 'primary', onClick: () => openItem(item.id) };
    }
    const applyScenePack = (pack = null) => {
        if (!safeOperatorCapabilities.canEditFlow || !pack?.type) return;
        handleAddItemAndFocus(pack.type, pack.overrides || {});
    };

    const toggleMediaPicker = (item = {}) => {
        if (!safeOperatorCapabilities.canCurateMedia) return;
        const itemId = String(item?.id || '').trim();
        const sourceType = String(item?.backingPlan?.sourceType || 'canonical_default').trim().toLowerCase();
        if (!itemId) return;
        setMediaPicker((prev) => (
            prev.itemId === itemId
                ? { itemId: '', sourceType: '', query: '', remoteResults: [], loading: false, error: '' }
                : { itemId, sourceType, query: buildMediaQuery(item), remoteResults: [], loading: false, error: '' }
        ));
    };

    const applyMediaSelection = (item = {}, option = {}) => {
        if (!safeOperatorCapabilities.canCurateMedia) return;
        const itemId = String(item?.id || '').trim();
        if (!itemId) return;
        const optionTitle = String(option?.titleValue || option?.title || '').trim();
        const optionArtist = String(option?.artistValue || option?.subtitle || '').trim();
        const sourceType = String(option?.sourceType || item?.backingPlan?.sourceType || 'canonical_default').trim().toLowerCase();
        const optionDurationSec = Math.max(0, Math.round(Number(option?.durationSec || 0) || 0));
        const shouldSyncPlannedDuration = optionDurationSec > 0 && String(item?.plannedDurationSource || '').trim().toLowerCase() !== 'manual';
        const baseItemPatch = {
            ...(item?.songTitle ? {} : { songTitle: optionTitle }),
            ...(item?.artistName ? {} : { artistName: optionArtist }),
            ...(shouldSyncPlannedDuration ? { plannedDurationSec: optionDurationSec, plannedDurationSource: 'backing' } : {})
        };
        if (sourceType === 'local_file') {
            onUpdateItem?.(itemId, {
                ...baseItemPatch,
                backingPlan: {
                    ...(item?.backingPlan || {}),
                    sourceType,
                    label: formatMediaLabel(optionTitle, optionArtist) || item?.backingPlan?.label || 'Local backing',
                    durationSec: optionDurationSec > 0 ? optionDurationSec : Number(item?.backingPlan?.durationSec || 0),
                    localAssetId: String(option?.assetId || '').trim(),
                    mediaUrl: String(option?.mediaUrl || '').trim(),
                    approvalStatus: 'host_selected',
                    playbackReady: !!String(option?.assetId || option?.mediaUrl || '').trim(),
                    resolutionStatus: 'ready'
                }
            });
        } else if (sourceType === 'youtube') {
            onUpdateItem?.(itemId, {
                ...baseItemPatch,
                backingPlan: {
                    ...(item?.backingPlan || {}),
                    sourceType,
                    label: formatMediaLabel(optionTitle, optionArtist) || item?.backingPlan?.label || 'YouTube backing',
                    durationSec: optionDurationSec > 0 ? optionDurationSec : Number(item?.backingPlan?.durationSec || 0),
                    youtubeId: String(option?.youtubeId || '').trim(),
                    mediaUrl: String(option?.mediaUrl || '').trim(),
                    approvalStatus: 'host_selected',
                    playbackReady: !!String(option?.youtubeId || option?.mediaUrl || '').trim(),
                    resolutionStatus: 'ready'
                }
            });
        } else if (sourceType === 'apple_music') {
            const appleMusicId = String(option?.appleMusicId || option?.trackId || '').trim();
            onUpdateItem?.(itemId, {
                ...baseItemPatch,
                backingPlan: {
                    ...(item?.backingPlan || {}),
                    sourceType,
                    label: formatMediaLabel(optionTitle, optionArtist) || item?.backingPlan?.label || 'Apple backing',
                    durationSec: optionDurationSec > 0 ? optionDurationSec : Number(item?.backingPlan?.durationSec || 0),
                    appleMusicId,
                    trackId: String(option?.trackId || appleMusicId).trim(),
                    mediaUrl: String(option?.mediaUrl || '').trim(),
                    approvalStatus: 'host_selected',
                    playbackReady: !!String(option?.trackId || appleMusicId || option?.mediaUrl || '').trim(),
                    resolutionStatus: 'ready'
                }
            });
        } else if (sourceType === 'user_submitted') {
            const submissionIdentity = String(option?.submissionId || option?.mediaUrl || option?.youtubeId || '').trim();
            onUpdateItem?.(itemId, {
                ...baseItemPatch,
                approvedSubmissionId: String(option?.submissionId || item?.approvedSubmissionId || '').trim(),
                backingPlan: {
                    ...(item?.backingPlan || {}),
                    sourceType,
                    label: formatMediaLabel(optionTitle, optionArtist) || item?.backingPlan?.label || 'Approved submission',
                    durationSec: optionDurationSec > 0 ? optionDurationSec : Number(item?.backingPlan?.durationSec || 0),
                    submittedBackingId: String(option?.submissionId || '').trim(),
                    youtubeId: String(option?.youtubeId || '').trim(),
                    mediaUrl: String(option?.mediaUrl || '').trim(),
                    approvalStatus: 'approved',
                    playbackReady: !!submissionIdentity,
                    resolutionStatus: option?.mediaUrl || option?.youtubeId ? 'ready' : 'submission_attached'
                }
            });
        }
        setMediaPicker({ itemId: '', sourceType: '', query: '', remoteResults: [], loading: false, error: '' });
    };

    return (
        <section className={`rounded-3xl border border-cyan-500/20 bg-zinc-950/70 ${compactViewport ? 'p-3.5 space-y-3.5' : 'p-4 space-y-4'}`} aria-label="Run of Show Director">
            <div className="sticky top-0 z-20 space-y-3 rounded-[28px] bg-zinc-950/96 pb-3 backdrop-blur-md">
                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(11,17,32,0.98),rgba(17,24,39,0.96))] px-4 py-4 shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Run Of Show Board</div>
                            <div className="mt-1 text-sm text-white">
                                {isRunOfShowActive
                                    ? automationPaused
                                        ? 'Show is paused. Fix the issue or resume when you are ready.'
                                        : 'Show is live. Watch Now, Next, and only step in when the board asks for help.'
                                    : 'Build the show here, then use Go Live when the room is ready.'}
                            </div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                {compactBoardSummary || 'No scenes yet'}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setStudioMode('build')}
                                    className={`rounded-full border px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${studioMode === 'build' ? 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-black/25 text-zinc-300 hover:border-cyan-300/25'}`}
                            >
                                {isRunOfShowActive ? 'Full Timeline' : 'Timeline'}
                            </button>
                            {isRunOfShowActive ? (
                                <button
                                    type="button"
                                    onClick={() => setStudioMode('run')}
                                    className={`rounded-full border px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${studioMode === 'run' ? 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-black/25 text-zinc-300 hover:border-cyan-300/25'}`}
                                >
                                    Show HUD
                                </button>
                            ) : null}
                            {(totalOpenIssues || studioMode === 'review') ? (
                                <button
                                    type="button"
                                    onClick={() => setStudioMode('review')}
                                    className={`rounded-full border px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${studioMode === 'review' ? 'border-amber-300/45 bg-amber-500/15 text-amber-50' : 'border-white/10 bg-black/25 text-zinc-300 hover:border-amber-300/25'}`}
                                >
                                    Issues {totalOpenIssues ? totalOpenIssues : ''}
                                </button>
                            ) : null}
                            {!isRunOfShowActive ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setQuickDraftModalOpen(true)}
                                        className="rounded-full border border-cyan-300/35 bg-cyan-500/12 px-3.5 py-2 min-h-[42px] touch-manipulation text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100 hover:border-cyan-200/45"
                                    >
                                        Quick Draft
                                    </button>
                                    <ControlButton
                                        onClick={() => setWorkspaceToolsOpen((prev) => !prev)}
                                        aria-expanded={workspaceToolsOpen}
                                        className="gap-2"
                                    >
                                        <span>{workspaceToolsOpen ? 'Hide Tools' : 'Tools'}</span>
                                        <i className={`fa-solid fa-chevron-down transition-transform ${workspaceToolsOpen ? 'rotate-180' : ''}`}></i>
                                    </ControlButton>
                                </>
                            ) : null}
                            <button
                                type="button"
                                onClick={handleRunOfShowModeToggle}
                                disabled={!isHostOperator || modeActionBusy}
                                className={`rounded-full border px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] disabled:opacity-40 ${isRunOfShowActive ? 'border-rose-300/35 bg-rose-500/12 text-rose-100' : 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100'}`}
                            >
                                {modeActionBusy ? 'Updating...' : isRunOfShowActive ? 'Stop Show' : 'Go Live'}
                            </button>
                            {isRunOfShowActive ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => onToggleAutomationPause?.(!automationPaused)}
                                        disabled={!safeOperatorCapabilities.canPauseAutomation}
                                        className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-40"
                                    >
                                        {automationPaused ? 'Resume' : 'Pause'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLiveTimelineOpen((prev) => !prev)}
                                        className="rounded-full border border-white/10 bg-black/25 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-200 hover:border-cyan-300/25"
                                    >
                                        {liveTimelineOpen ? 'Hide Later' : 'Show Later'}
                                    </button>
                                    {previewActiveId ? <button type="button" onClick={() => onClearPreview?.()} className="rounded-full border border-violet-300/35 bg-violet-500/12 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet-100">Clear Preview</button> : null}
                                </>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => setTopBoardCollapsed((prev) => !prev)}
                                aria-expanded={!topBoardCollapsed}
                                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/25 px-3.5 py-2 min-h-[42px] touch-manipulation text-[11px] font-black uppercase tracking-[0.18em] text-zinc-200 hover:border-cyan-300/25"
                            >
                                <span>{topBoardCollapsed ? 'Open Board' : 'Collapse Board'}</span>
                                <i className={`fa-solid fa-chevron-down ml-2 transition-transform ${topBoardCollapsed ? '' : 'rotate-180'}`}></i>
                            </button>
                        </div>
                    </div>
                </div>
                {topBoardCollapsed ? (
                    <div className="rounded-[22px] border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-300">
                        <span className="font-semibold text-white">{topBoardTarget ? (topBoardTarget.title || getRunOfShowItemLabel(topBoardTarget.type)) : 'No scenes yet'}</span>
                        {topBoardTarget ? ` is the current focus. ${totalOpenIssues ? `${totalOpenIssues} open issue${totalOpenIssues === 1 ? '' : 's'} still need prep.` : 'Everything in view is clear.'}` : ' Add scenes to start building the night.'}
                    </div>
                ) : (
                    <>
                        <CompactTimelineOverview
                            items={items}
                            currentItemId={currentItemId}
                            liveItemId={liveItem?.id || ''}
                            stagedItemId={stagedItem?.id || ''}
                            nextItemId={nextItem?.id || ''}
                            readinessById={readinessById}
                            pendingCountsById={pendingCountsById}
                            canEditFlow={safeOperatorCapabilities.canEditFlow}
                            selectedItemId={expandedItemId}
                            onMoveItem={onMoveItem}
                            onDeleteItem={onDeleteItem}
                            onSkipItem={onSkipItem}
                            onFocus={openItem}
                            dragState={dragState}
                            onDragStart={(event, itemId) => {
                                if (!safeOperatorCapabilities.canEditFlow) return;
                                event.dataTransfer.effectAllowed = 'move';
                                setDragState({ itemId, targetId: itemId, position: 'after' });
                            }}
                            onDragEnd={clearDragState}
                            onDragTarget={updateDragTarget}
                            onDropItem={handleStoryboardDrop}
                            showHeader={false}
                        />
                        {isRunOfShowActive && liveAdjustmentTarget ? (
                            <div
                                data-live-adjustment-panel="true"
                                className="rounded-[20px] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(7,20,34,0.92),rgba(12,18,31,0.88))] px-3 py-3"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/80">Live Adjustments</div>
                                        <div className="mt-1 text-sm font-black text-white">
                                            {liveAdjustmentTarget.title || getRunOfShowItemLabel(liveAdjustmentTarget.type)}
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-400">
                                            {liveItem?.id === liveAdjustmentTarget.id ? 'Live now' : stagedItem?.id === liveAdjustmentTarget.id ? 'Staged next' : 'Up next'} · {formatDurationSec(liveAdjustmentDurationSec) || `${liveAdjustmentDurationSec}s`} window
                                            {liveAdjustmentRequiresHostAdvance ? ` · ${liveAdjustmentAdvanceSummary}` : ''}
                                            {liveAdjustmentSoundtrackConfigured ? ` · takeover audio ${liveAdjustmentSoundtrackActive ? 'on' : 'paused'}` : ''}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            data-live-adjustment="extend-30"
                                            onClick={() => handleExtendLiveAdjustment(30)}
                                            className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100"
                                        >
                                            +30 Sec
                                        </button>
                                        <button
                                            type="button"
                                            data-live-adjustment="extend-60"
                                            onClick={() => handleExtendLiveAdjustment(60)}
                                            className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100"
                                        >
                                            +60 Sec
                                        </button>
                                        {liveAdjustmentSoundtrackConfigured ? (
                                            <button
                                                type="button"
                                                data-live-adjustment="toggle-audio"
                                                onClick={handleToggleLiveTakeoverSoundtrack}
                                                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${liveAdjustmentSoundtrackActive ? 'border-amber-300/28 bg-amber-500/12 text-amber-100' : 'border-emerald-300/28 bg-emerald-500/12 text-emerald-100'}`}
                                            >
                                                {liveAdjustmentSoundtrackActive ? 'Pause Audio' : 'Resume Audio'}
                                            </button>
                                        ) : null}
                                        {liveAdjustmentUpcomingTarget ? (
                                            <button
                                                type="button"
                                                data-live-adjustment="skip-next"
                                                onClick={handleSkipUpcomingItem}
                                                className="rounded-full border border-rose-300/25 bg-rose-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-rose-100"
                                            >
                                                Skip Next
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                {liveAdjustmentSupportsAdvanceControl ? (
                                    <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Scene Progress</div>
                                                <div className="mt-1 text-sm font-semibold text-white">
                                                    {liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.auto
                                                        ? 'Auto-advance is on.'
                                                        : liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.host
                                                            ? 'The host decides when this scene ends.'
                                                            : liveAdjustmentMinAdvanceRemainingSec > 0
                                                                ? `The host can advance this scene in ${formatDurationSec(liveAdjustmentMinAdvanceRemainingSec) || `${liveAdjustmentMinAdvanceRemainingSec}s`}.`
                                                                : 'The minimum live time has elapsed. The host can advance when ready.'}
                                                </div>
                                            </div>
                                            <div className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200">
                                                {liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.auto
                                                    ? 'Auto-advance'
                                                    : liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.host
                                                        ? 'Wait for me'
                                                        : 'Wait at least...'}
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                data-live-adjustment="advance-auto"
                                                onClick={() => handleSetLiveAdvanceMode(RUN_OF_SHOW_ADVANCE_MODES.auto)}
                                                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.auto ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100' : 'border-white/10 bg-black/25 text-zinc-200 hover:border-emerald-300/25'}`}
                                            >
                                                Auto-advance
                                            </button>
                                            <button
                                                type="button"
                                                data-live-adjustment="advance-host"
                                                onClick={() => handleSetLiveAdvanceMode(RUN_OF_SHOW_ADVANCE_MODES.host)}
                                                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.host ? 'border-amber-300/35 bg-amber-500/12 text-amber-100' : 'border-white/10 bg-black/25 text-zinc-200 hover:border-amber-300/25'}`}
                                            >
                                                Wait for me
                                            </button>
                                            <div className={`flex items-center gap-2 rounded-full border px-2.5 py-1 ${liveAdjustmentAdvanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/25 text-zinc-200'}`}>
                                                <button
                                                    type="button"
                                                    data-live-adjustment="advance-host-after-min"
                                                    onClick={() => handleSetLiveAdvanceMode(RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin)}
                                                    className="text-[10px] font-black uppercase tracking-[0.16em]"
                                                >
                                                    Wait at least...
                                                </button>
                                                <input
                                                    type="number"
                                                    min="5"
                                                    step="5"
                                                    value={liveWaitAtLeastSec}
                                                    onChange={(e) => {
                                                        void handleLiveWaitAtLeastInput(e.target.value);
                                                    }}
                                                    className="w-16 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-black text-white"
                                                    aria-label="Additional wait time in seconds"
                                                />
                                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-current/80">sec</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                                <div className="mt-2 text-xs text-zinc-500">
                                    Drag the strip above to reorder fast when a singer no-shows or the room energy shifts.
                                </div>
                            </div>
                        ) : null}
                        {totalOpenIssues ? (
                            <div className="rounded-[20px] border border-amber-300/16 bg-[linear-gradient(135deg,rgba(41,26,12,0.72),rgba(19,20,34,0.9))] px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="mr-2 text-[10px] uppercase tracking-[0.16em] text-amber-100/75">Open issues</div>
                                    {issueJumpTargets.filter((entry) => Number(entry?.count || 0) > 0).map((issue) => (
                                        <button
                                            key={issue.key}
                                            type="button"
                                            onClick={() => jumpToIssue(issue)}
                                            className="rounded-full border border-amber-300/25 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-50 transition hover:border-amber-200/45 hover:bg-amber-500/12"
                                        >
                                            {issue.count} {issue.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </>
                )}
            </div>

            <QuickDraftModal
                open={quickDraftModalOpen}
                onClose={() => setQuickDraftModalOpen(false)}
                canEditFlow={safeOperatorCapabilities.canEditFlow}
                generatorConfig={generatorConfig}
                updateGeneratorConfig={updateGeneratorConfig}
                applyGeneratorDraft={async () => {
                    await applyGeneratorDraft();
                    setQuickDraftModalOpen(false);
                }}
                generatorBusy={generatorBusy}
                generatorOpen={generatorOpen}
                onToggleGenerator={() => setGeneratorOpen((prev) => !prev)}
                generatedDraftItems={generatedDraftItems}
                itemsCount={items.length}
            />

            <TemplateToolsModal
                open={templateToolsOpen}
                onClose={() => setTemplateToolsOpen(false)}
                canManageTemplates={safeOperatorCapabilities.canManageTemplates}
                starterTemplateOptions={STARTER_TEMPLATE_OPTIONS}
                templateDraftName={templateDraftName}
                onTemplateDraftNameChange={setTemplateDraftName}
                currentTemplateId={safeTemplateMeta.currentTemplateId || ''}
                currentTemplateName={safeTemplateMeta.currentTemplateName || ''}
                runOfShowTemplates={runOfShowTemplates}
                onApplyStarterTemplate={onApplyStarterTemplate}
                onApplyTemplate={onApplyTemplate}
                onSaveTemplate={onSaveTemplate}
                onArchiveCurrent={onArchiveCurrent}
                lastArchiveId={safeTemplateMeta.lastArchiveId || ''}
            />

            {goLiveSheetOpen && !isRunOfShowActive ? (
                <article className={`${surfaceClass} border-emerald-300/20 bg-emerald-500/8 p-4`} aria-label="Go live preflight">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-200">Go Live Check</div>
                            <div className="mt-1 text-base font-semibold text-white">
                                {safePreflightReport.criticalCount > 0
                                    ? 'Fix the blockers before the show starts.'
                                    : safePreflightReport.riskyCount > 0
                                        ? 'The show can start, but a few items still need a host eye.'
                                        : 'The show is clear to start.'}
                            </div>
                            <div className="mt-2 text-sm text-zinc-300">{safePreflightReport.summary}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <ControlButton onClick={() => setGoLiveSheetOpen(false)}>Back</ControlButton>
                            {safePreflightReport.criticalCount > 0 ? (
                                <ControlButton tone="warning" onClick={focusFirstCriticalPreflightIssue}>Fix Critical</ControlButton>
                            ) : null}
                            {safePreflightReport.riskyCount > 0 ? (
                                <ControlButton onClick={focusFirstRiskyPreflightItem}>Review Risk</ControlButton>
                            ) : null}
                            <ControlButton
                                tone="primary"
                                disabled={modeActionBusy || !safePreflightReport.readyToStart || safePreflightReport.criticalCount > 0}
                                onClick={() => handleLaunchFromGoLive()}
                            >
                                {modeActionBusy ? 'Starting...' : 'Start Show'}
                            </ControlButton>
                            {safePreflightReport.criticalCount > 0 && safePreflightReport.readyToStart ? (
                                <ControlButton
                                    tone="warning"
                                    disabled={modeActionBusy}
                                    onClick={() => handleLaunchFromGoLive({ allowUnsafe: true })}
                                >
                                    {modeActionBusy ? 'Starting...' : 'Start Anyway'}
                                </ControlButton>
                            ) : null}
                        </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Ready</div>
                            <div className="mt-2 text-2xl font-black text-white">{safePreflightReport.readyCount}</div>
                            <div className="text-xs text-zinc-400">Blocks fully ready</div>
                        </div>
                        <div className="rounded-2xl border border-amber-300/18 bg-amber-500/10 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-100/80">Critical</div>
                            <div className="mt-2 text-2xl font-black text-amber-50">{safePreflightReport.criticalCount}</div>
                            <div className="text-xs text-amber-100/80">Must-fix blockers</div>
                        </div>
                        <div className="rounded-2xl border border-cyan-300/18 bg-cyan-500/10 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/80">Risky</div>
                            <div className="mt-2 text-2xl font-black text-cyan-50">{safePreflightReport.riskyCount}</div>
                            <div className="text-xs text-cyan-100/80">Items to watch</div>
                        </div>
                    </div>
                </article>
            ) : null}

            {workspaceToolsOpen ? (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    <UtilityDrawer
                        eyebrow="Planning Controls"
                        title="Automation + pressure rules"
                        summary="Keep the setup logic available, but out of the way while you build and run the show."
                        open={planningControlsOpen}
                        onToggle={() => setPlanningControlsOpen((prev) => !prev)}
                        badge={activePolicyPreset ? activePolicyPreset.label : 'Custom'}
                    >
                        <div className="space-y-3">
                            <div className="grid gap-2 sm:grid-cols-3">
                                {POLICY_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleApplyPolicyPreset(preset)}
                                        disabled={!safeOperatorCapabilities.canEditFlow}
                                        className={`rounded-2xl border p-3 text-left transition disabled:opacity-40 ${activePolicyPreset?.id === preset.id ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/30'}`}
                                    >
                                        <div className="text-sm font-bold text-white">{preset.label}</div>
                                        <div className="mt-1 text-xs text-current/80">{preset.description}</div>
                                    </button>
                                ))}
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                <div>
                                    <FieldLabel>Default Automation</FieldLabel>
                                    <SelectControl value={safePolicy.defaultAutomationMode || 'auto'} onChange={(e) => onUpdatePolicy?.({ defaultAutomationMode: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow}>
                                        {RUN_OF_SHOW_DEFAULT_AUTOMATION_POLICIES.map((value) => <option key={value} value={value}>{POLICY_LABELS[value] || value}</option>)}
                                    </SelectControl>
                                </div>
                                <div>
                                    <FieldLabel>Late Blocks</FieldLabel>
                                    <SelectControl value={safePolicy.lateBlockPolicy || 'hold'} onChange={(e) => onUpdatePolicy?.({ lateBlockPolicy: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow}>
                                        {RUN_OF_SHOW_LATE_BLOCK_POLICIES.map((value) => <option key={value} value={value}>{POLICY_LABELS[value] || value}</option>)}
                                    </SelectControl>
                                </div>
                                <div>
                                    <FieldLabel>No-Show</FieldLabel>
                                    <SelectControl value={safePolicy.noShowPolicy || 'hold_for_host'} onChange={(e) => onUpdatePolicy?.({ noShowPolicy: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow}>
                                        {RUN_OF_SHOW_NO_SHOW_POLICIES.map((value) => <option key={value} value={value}>{POLICY_LABELS[value] || value}</option>)}
                                    </SelectControl>
                                </div>
                                <div>
                                    <FieldLabel>Queue Divergence</FieldLabel>
                                    <SelectControl value={safePolicy.queueDivergencePolicy || 'host_override_only'} onChange={(e) => onUpdatePolicy?.({ queueDivergencePolicy: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow}>
                                        {RUN_OF_SHOW_QUEUE_DIVERGENCE_POLICIES.map((value) => <option key={value} value={value}>{POLICY_LABELS[value] || value}</option>)}
                                    </SelectControl>
                                </div>
                                <div>
                                    <FieldLabel>Blocked Action</FieldLabel>
                                    <SelectControl value={safePolicy.blockedActionPolicy || 'focus_next_fix'} onChange={(e) => onUpdatePolicy?.({ blockedActionPolicy: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow}>
                                        {RUN_OF_SHOW_BLOCKED_ACTION_POLICIES.map((value) => <option key={value} value={value}>{POLICY_LABELS[value] || value}</option>)}
                                    </SelectControl>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-cyan-300/18 bg-cyan-500/10 px-3 py-3 text-sm text-cyan-100">
                                {liveOperatingHint}
                            </div>
                        </div>
                    </UtilityDrawer>

                    <UtilityDrawer
                        eyebrow="Co-Hosts"
                        title="People who keep the next slots ready"
                        summary="Assign support operators without taking focus away from the actual timeline."
                        open={coHostToolsOpen}
                        onToggle={() => setCoHostToolsOpen((prev) => !prev)}
                        badge={`${safeRoles.coHosts?.length || 0} assigned`}
                    >
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {[
                                    ['Operate', safeOperatorCapabilities.canOperate],
                                    ['Pause Auto', safeOperatorCapabilities.canPauseAutomation],
                                    ['Review Slots', safeOperatorCapabilities.canReviewSubmissions],
                                    ['Curate Media', safeOperatorCapabilities.canCurateMedia],
                                    ['Edit Flow', safeOperatorCapabilities.canEditFlow],
                                    ['Templates', safeOperatorCapabilities.canManageTemplates],
                                ].map(([label, active]) => (
                                    <span key={label} className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${active ? 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100' : 'border-white/10 bg-black/25 text-zinc-500'}`}>{label}</span>
                                ))}
                            </div>
                            <input
                                value={coHostSearch}
                                onChange={(e) => setCoHostSearch(e.target.value)}
                                disabled={!safeOperatorCapabilities.canManageRoles}
                                className={textInputClass}
                                placeholder="Search room people"
                            />
                            <div className="grid max-h-52 gap-2 overflow-auto pr-1">
                                {filteredOperatorCandidates.length ? filteredOperatorCandidates.map((candidate) => {
                                    const active = safeRoles.coHosts?.includes(candidate.uid);
                                    return (
                                        <button
                                            key={candidate.uid}
                                            type="button"
                                            disabled={!safeOperatorCapabilities.canManageRoles}
                                            onClick={() => toggleCoHost(candidate.uid)}
                                            className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left transition disabled:opacity-40 ${active ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                        >
                                            <div>
                                                <div className="text-sm font-semibold text-white">{candidate.label}</div>
                                                <div className="text-xs text-zinc-400">{candidate.meta || candidate.uid}</div>
                                            </div>
                                            <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${active ? 'border-cyan-300/40 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/30 text-zinc-400'}`}>{active ? 'Co-Host' : 'Add'}</span>
                                        </button>
                                    );
                                }) : (
                                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-400">No room users found yet. Co-host assignment appears here once people join the room.</div>
                                )}
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-zinc-400">
                                Co-hosts can operate live, review submissions, curate media, edit the flow, and manage templates. Only the host can change room mode, pause automation, and assign roles.
                            </div>
                        </div>
                    </UtilityDrawer>

                    <article className={`${surfaceClass} p-4`}>
                        <div className="rounded-[24px] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(10,17,32,0.92),rgba(18,12,34,0.86))] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">Templates</div>
                                    <div className="mt-1 text-sm font-semibold text-white">Keep reusable show formats in a separate tray.</div>
                                    <div className="mt-2 text-xs text-zinc-300">
                                        Current template: <span className="text-white">{safeTemplateMeta.currentTemplateName || 'Unsaved working copy'}</span>{safeTemplateMeta.lastArchiveId ? ` | Last archive ${safeTemplateMeta.lastArchiveId}` : ''}
                                    </div>
                                </div>
                                <ControlButton tone="primary" disabled={!safeOperatorCapabilities.canManageTemplates} onClick={() => setTemplateToolsOpen(true)}>
                                    Open Templates
                                </ControlButton>
                            </div>
                        </div>
                    </article>
                </div>
            ) : null}

            {studioMode === 'build' ? (
            <>
                {repairModeActive && focusedBuildItem && repairFocusMeta ? (
                    <article className={`${surfaceClass} p-4`}>
                        <div className={`rounded-[26px] border px-4 py-4 ${repairFocusMeta.toneClass}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-current/80">{repairFocusMeta.eyebrow}</div>
                                    <div className="mt-1 text-lg font-black text-white">{repairFocusMeta.title}</div>
                                    <div className="mt-2 text-sm text-current/90">{repairFocusMeta.detail}</div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-current/80">
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${repairFocusMeta.chipClass}`}>
                                            {focusedBuildItem.title || getRunOfShowItemLabel(focusedBuildItem.type)}
                                        </span>
                                        <span>{readinessById[focusedBuildItem.id]?.summary || 'Needs attention'}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <ControlButton onClick={() => setStudioMode('review')}>Open Issues</ControlButton>
                                    <ControlButton tone="primary" onClick={() => setRepairFocus(null)}>Open Full Builder</ControlButton>
                                </div>
                            </div>
                        </div>
                    </article>
                ) : (
                <article className={`${surfaceClass} p-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-3xl">
                            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Sequence Tools</div>
                            <div className="mt-1 text-sm text-zinc-200">Use this tray when you need to add or reorder scenes. The focused inspector below is the main editing workspace.</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                {items.length} scene{items.length === 1 ? '' : 's'}
                            </span>
                            <ControlButton onClick={() => setBuildSequenceOpen((prev) => !prev)}>
                                {buildSequenceOpen ? 'Hide Sequence Tools' : 'Open Sequence Tools'}
                            </ControlButton>
                        </div>
                    </div>
                    {buildSequenceOpen ? (
                        <div className="mt-4 space-y-3">
                            <div className="rounded-2xl border border-cyan-300/16 bg-cyan-500/8 px-4 py-3 text-sm text-zinc-200">
                                Keep this closed while editing scene details to avoid stacking the board, timeline, and inspector on top of each other.
                            </div>
                            <TimelineStudio
                                items={items}
                                liveItemId={liveItem?.id || ''}
                                stagedItemId={stagedItem?.id || ''}
                                nextItemId={nextItem?.id || ''}
                                currentItemId={currentItemId}
                                readinessById={readinessById}
                                pendingCountsById={pendingCountsById}
                                expandedItemId={expandedItemId}
                                canEditFlow={safeOperatorCapabilities.canEditFlow}
                                onMoveItem={onMoveItem}
                                onDeleteItem={onDeleteItem}
                                onAddItem={handleAddItemAndFocus}
                                onAddScenePack={applyScenePack}
                                onToggleGenerator={() => setGeneratorOpen((prev) => !prev)}
                                generatorOpen={generatorOpen}
                                getPrimaryAction={getPrimaryActionForItem}
                                onFocus={openItem}
                                dragState={dragState}
                                onDragStart={(event, itemId) => {
                                    if (!safeOperatorCapabilities.canEditFlow) return;
                                    event.dataTransfer.effectAllowed = 'move';
                                    setDragState({ itemId, targetId: itemId, position: 'after' });
                                }}
                                onDragEnd={clearDragState}
                                onDragTarget={updateDragTarget}
                                onDropItem={handleStoryboardDrop}
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                <div className="text-sm text-zinc-300">Scene map is available when you need a denser overview of slot readiness.</div>
                                <ControlButton onClick={() => setBuildMapOpen((prev) => !prev)}>
                                    {buildMapOpen ? 'Hide Scene Map' : 'Show Scene Map'}
                                </ControlButton>
                            </div>
                            {buildMapOpen ? (
                                <ShowMapCard
                                    items={items}
                                    liveItemId={liveItem?.id || ''}
                                    stagedItemId={stagedItem?.id || ''}
                                    nextItemId={nextItem?.id || ''}
                                    expandedItemId={focusedBuildItemId}
                                    readinessById={readinessById}
                                    pendingCountsById={pendingCountsById}
                                    getPrimaryAction={getPrimaryActionForItem}
                                    onFocus={openItem}
                                    canEditFlow={safeOperatorCapabilities.canEditFlow}
                                    roomUserCandidates={roomUserCandidates}
                                    onAssignLobbyPerformer={assignLobbyPerformer}
                                    onClearLobbyPerformer={clearLobbyPerformer}
                                    onUpdateItem={onUpdateItem}
                                    onLoadSuggestedBacking={loadSuggestedBacking}
                                    mediaPicker={mediaPicker}
                                    getSuggestedOptionsForItem={getSuggestedOptionsForItem}
                                    onApplyMediaSelection={applyMediaSelection}
                                />
                            ) : null}
                        </div>
                    ) : (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1">Focused scene {focusedBuildItemIndex >= 0 ? focusedBuildItemIndex + 1 : 1}</span>
                            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1">{liveItem?.title ? `Live: ${liveItem.title}` : 'Timeline ready'}</span>
                            {safeOperatorCapabilities.canEditFlow ? <span className="rounded-full border border-emerald-300/18 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">Inspector editing active</span> : null}
                        </div>
                    )}
                </article>
                )}
                {showAdvancedDraftBuilder ? (
                    <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Advanced Draft Builder</div>
                            <div className="mt-1 text-sm text-zinc-300">Tune the generated outline in more detail when the quick draft needs a custom block mix or pacing change.</div>
                        </div>
                    </div>
                    <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5].map((step) => (
                                <button
                                    key={step}
                                    type="button"
                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                    onClick={() => updateGeneratorConfig({ step })}
                                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] disabled:opacity-40 ${generatorConfig.step === step ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/25 text-zinc-300'}`}
                                >
                                    Step {step}
                                </button>
                            ))}
                        </div>
                        {generatorConfig.step === 1 ? (
                            <div className="grid gap-3 lg:grid-cols-3">
                                {EVENT_FORMAT_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        disabled={!safeOperatorCapabilities.canEditFlow}
                                        onClick={() => updateGeneratorConfig({ format: option.value })}
                                        className={`rounded-2xl border p-3 text-left transition disabled:opacity-40 ${generatorConfig.format === option.value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                    >
                                        <div className="text-sm font-bold text-white">{option.label}</div>
                                        <div className="mt-1 text-xs text-current/80">{option.description}</div>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                        {generatorConfig.step === 2 ? (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                    <FieldLabel>Total Duration Min</FieldLabel>
                                    <input type="number" value={generatorConfig.durationMin} onChange={(e) => updateGeneratorConfig({ durationMin: Number(e.target.value || 0) })} className={textInputClass} />
                                </div>
                                <div className="md:col-span-3">
                                    <FieldLabel>Pacing</FieldLabel>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                        {PACING_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                disabled={!safeOperatorCapabilities.canEditFlow}
                                                onClick={() => updateGeneratorConfig({ pacing: option.value })}
                                                className={`rounded-2xl border p-3 text-left transition disabled:opacity-40 ${generatorConfig.pacing === option.value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                            >
                                                <div className="text-sm font-bold text-white">{option.label}</div>
                                                <div className="mt-1 text-xs text-current/80">{option.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        {generatorConfig.step === 3 ? (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                <div><FieldLabel>Performance Slots</FieldLabel><input type="number" value={generatorConfig.performanceCount} onChange={(e) => updateGeneratorConfig({ performanceCount: Number(e.target.value || 0) })} className={textInputClass} /></div>
                                <div><FieldLabel>Announcements</FieldLabel><input type="number" value={generatorConfig.announcementCount} onChange={(e) => updateGeneratorConfig({ announcementCount: Number(e.target.value || 0) })} className={textInputClass} /></div>
                                <div><FieldLabel>Interactive Beats</FieldLabel><input type="number" value={generatorConfig.interactiveCount} onChange={(e) => updateGeneratorConfig({ interactiveCount: Number(e.target.value || 0) })} className={textInputClass} /></div>
                                <div><FieldLabel>Buffers</FieldLabel><input type="number" value={generatorConfig.bufferCount} onChange={(e) => updateGeneratorConfig({ bufferCount: Number(e.target.value || 0) })} className={textInputClass} /></div>
                                <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={generatorConfig.includeIntermission === true} onChange={(e) => updateGeneratorConfig({ includeIntermission: e.target.checked })} />Include intermission</label></div>
                            </div>
                        ) : null}
                        {generatorConfig.step === 4 ? (
                            <div className="grid gap-3 lg:grid-cols-2">
                                <div>
                                    <FieldLabel>Automation Style</FieldLabel>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                        {POLICY_PRESETS.map((preset) => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => updateGeneratorConfig({ automationPresetId: preset.id })}
                                                className={`rounded-2xl border p-3 text-left transition ${generatorConfig.automationPresetId === preset.id ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                            >
                                                <div className="text-sm font-bold text-white">{preset.label}</div>
                                                <div className="mt-1 text-xs text-current/80">{preset.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <FieldLabel>Interaction Level</FieldLabel>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                        {INTERACTION_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => updateGeneratorConfig({ interactionLevel: option.value })}
                                                className={`rounded-2xl border p-3 text-left transition ${generatorConfig.interactionLevel === option.value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-50' : 'border-white/10 bg-black/20 text-zinc-100 hover:border-cyan-300/25'}`}
                                            >
                                                <div className="text-sm font-bold text-white">{option.label}</div>
                                                <div className="mt-1 text-xs text-current/80">{option.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        {generatorConfig.step === 5 ? (
                            <div className="space-y-3">
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
                                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Generated Timeline</div>
                                        <div className="mt-3 grid gap-2">
                                            {generatedDraftItems.map((entry, index) => (
                                                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">#{index + 1} {getRunOfShowItemLabel(entry.type)}</div>
                                                        <div className="truncate text-sm font-semibold text-white">{entry.title}</div>
                                                    </div>
                                                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">{entry.plannedDurationSec}s</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 space-y-3">
                                        <div>
                                            <FieldLabel>Apply Mode</FieldLabel>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {[
                                                    ['replace', 'Replace current show'],
                                                    ['append', 'Append to current show']
                                                ].map(([value, label]) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        disabled={!safeOperatorCapabilities.canEditFlow || (value === 'replace' && items.length === 0 ? false : false)}
                                                        onClick={() => updateGeneratorConfig({ applyMode: value })}
                                                        className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${generatorConfig.applyMode === value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/20 text-zinc-300'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-300">
                                            {items.length
                                                ? `There are already ${items.length} blocks in this show. ${generatorConfig.applyMode === 'replace' ? 'Replacing will overwrite the current timeline.' : 'Appending will keep the current timeline and add this draft to the end.'}`
                                                : 'This room does not have a timeline yet. Applying will create the first draft.'}
                                        </div>
                                        <ControlButton tone="primary" disabled={!safeOperatorCapabilities.canEditFlow || generatorBusy} onClick={applyGeneratorDraft}>
                                            {generatorBusy ? 'Applying…' : generatorConfig.applyMode === 'append' ? 'Append Draft' : 'Apply Draft'}
                                        </ControlButton>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                    </>
                ) : null}
            </>
            ) : null}

            {studioMode === 'review' ? (
            <article className={`${surfaceClass} p-3`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Approval Inbox</div>
                        <div className="mt-1 text-sm text-zinc-300">Handle pending singer submissions and blockers here, then jump into Build only when a scene needs deeper edits.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <ControlButton tone="warning" disabled={!safeOperatorCapabilities.canReviewSubmissions || !pendingApprovals.length} onClick={focusFirstPendingApproval}>Review First Pending</ControlButton>
                        <ControlButton onClick={() => setApprovalInboxOpen((prev) => !prev)}>{approvalInboxOpen ? 'Collapse Inbox' : 'Open Inbox'}</ControlButton>
                    </div>
                </div>
                {approvalInboxOpen ? (
                    <div className="mt-3 grid gap-2">
                        {pendingApprovalGroups.length ? pendingApprovalGroups.map((group) => (
                            <div key={group.itemId} className="rounded-2xl border border-amber-300/18 bg-amber-500/10 px-3 py-2.5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.16em] text-amber-100/80">{group.item?.title || 'Open performance slot'}</div>
                                        <div className="mt-1 text-sm text-amber-50">{group.submissions.length} pending singer submission{group.submissions.length === 1 ? '' : 's'}.</div>
                                        <div className="mt-1 text-xs text-amber-100/80">{group.item?.songTitle ? `${group.item.songTitle}${group.item.artistName ? ` · ${group.item.artistName}` : ''}` : 'Song still open'}{` · ${readinessById[group.itemId]?.summary || 'Needs review'}`}</div>
                                    </div>
                                    <ControlButton onClick={() => openItem(group.itemId)}>Open Slot</ControlButton>
                                </div>
                                <div className="mt-2 grid gap-2">
                                    {group.submissions.map((submission) => (
                                        <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                                            <div>
                                                <div className="text-sm font-bold text-white">{submission.displayName || 'Singer'}</div>
                                                <div className="text-xs text-zinc-400">{submission.songTitle || 'Untitled Song'}{submission.artistName ? ` · ${submission.artistName}` : ''}{submission.backingUrl || submission.mediaUrl || submission.youtubeId ? ' · backing attached' : ' · song only'}</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <ControlButton tone="success" disabled={!safeOperatorCapabilities.canReviewSubmissions} onClick={() => handleSubmissionDecision(submission.id, 'approved', group.item)}>Approve + Assign</ControlButton>
                                                <ControlButton tone="danger" disabled={!safeOperatorCapabilities.canReviewSubmissions} onClick={() => onReviewSubmission?.(submission.id, 'declined')}>Decline</ControlButton>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )) : (
                            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-400">No pending singer approvals right now.</div>
                        )}
                    </div>
                ) : null}
            </article>
            ) : null}

            {studioMode === 'run' ? (
            <div className="space-y-3">
                <article className={`${surfaceClass} p-4`} aria-label="Run of show live HUD">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Show status</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${liveHudToneClass}`}>
                                    {liveHudIssue.label}
                                </span>
                                {(liveItem?.id || stagedItem?.id || nextItem?.id) ? (
                                    <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200">
                                        {liveItem?.id ? 'Now live' : stagedItem?.id ? 'Next staged' : 'Next queued'}
                                    </span>
                                ) : null}
                            </div>
                            <div className="mt-2 text-[13px] text-zinc-300">{liveHudIssue.detail}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {liveHudPrimaryAction ? (
                                <ControlButton tone={liveHudPrimaryAction.tone} className="px-4 py-2 text-[11px]" onClick={liveHudPrimaryAction.onClick}>
                                    {liveHudPrimaryAction.label}
                                </ControlButton>
                            ) : null}
                            {(automationPaused || totalOpenIssues) ? (
                                <ControlButton onClick={() => setStudioMode(totalOpenIssues ? 'review' : 'build')}>
                                    {totalOpenIssues ? 'Open Issues' : 'Open Timeline'}
                                </ControlButton>
                            ) : null}
                        </div>
                    </div>
                </article>
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <LiveHudCard
                        label="Now"
                        item={liveItem}
                        summary={liveItem ? itemSummary(liveItem) : ''}
                        note={liveItem?.startsAtMs ? `Started ${formatStart(liveItem.startsAtMs)}` : ''}
                        badge={automationPaused ? 'Paused' : 'Live'}
                        badgeTone={automationPaused ? 'danger' : 'success'}
                        emptyLabel="Nothing is live yet."
                        onFocus={openItem}
                    />
                    <LiveHudCard
                        label="Next"
                        item={stagedItem || nextItem}
                        summary={(stagedItem || nextItem) ? itemSummary(stagedItem || nextItem) : ''}
                        note={
                            (stagedItem || nextItem)
                                ? pendingApprovals.some((entry) => entry.itemId === (stagedItem || nextItem).id)
                                    ? 'Needs singer approval before it can run.'
                                    : readinessById[(stagedItem || nextItem).id]?.blockers?.length
                                        ? getRunOfShowBlockedActionLabel(readinessById[(stagedItem || nextItem).id], stagedItem || nextItem, safePolicy)
                                        : stagedItem?.id
                                            ? 'Ready to go live.'
                                            : 'Queued and clear.'
                                : ''
                        }
                        badge={
                            (stagedItem || nextItem)
                                ? stagedItem?.id
                                    ? 'Ready'
                                    : pendingApprovals.some((entry) => entry.itemId === (stagedItem || nextItem).id) || readinessById[(stagedItem || nextItem).id]?.blockers?.length
                                        ? 'Check first'
                                        : 'Queued'
                                : ''
                        }
                        badgeTone={
                            (stagedItem || nextItem) && (pendingApprovals.some((entry) => entry.itemId === (stagedItem || nextItem).id) || readinessById[(stagedItem || nextItem).id]?.blockers?.length)
                                ? 'danger'
                                : 'success'
                        }
                        emptyLabel="No next block is staged yet."
                        onFocus={openItem}
                    />
                </div>
                {liveTimelineOpen ? (
                    <article className={`${surfaceClass} p-4`} aria-label="Later run of show queue">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">Later</div>
                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{laterItems.length} upcoming</div>
                        </div>
                        <div className="mt-3 grid gap-2 lg:grid-cols-2 2xl:grid-cols-4">
                            {laterItems.length ? laterItems.map((item, index) => (
                                <button key={item.id} type="button" onClick={() => openItem(item.id)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-cyan-300/30">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">#{index + 1} Later</div>
                                            <div className="text-sm font-semibold text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                                            <div className="mt-1 truncate text-xs text-zinc-400">{itemSummary(item)}</div>
                                        </div>
                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone(item.status)}`}>{item.status}</span>
                                    </div>
                                </button>
                            )) : <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-400 lg:col-span-2 2xl:col-span-4">No queued later blocks yet.</div>}
                        </div>
                    </article>
                ) : null}
            </div>
            ) : null}

            {showExtraBlockBin && studioMode === 'build' ? (
            <div className={`${surfaceClass} p-3`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Clip Bin</div>
                        <div className="mt-1 text-sm text-zinc-300">Less common scene types live here. Add them when the timeline needs a specialist beat, not as part of the main flow.</div>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{extraBlockOptions.length} specialty clips</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {extraBlockOptions.map((option) => (
                        <button key={option.value} type="button" disabled={!enabled || !safeOperatorCapabilities.canEditFlow} onClick={() => handleAddItemAndFocus(option.value)} className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-zinc-200 disabled:opacity-40">+ {option.label}</button>
                    ))}
                </div>
            </div>
            ) : null}

            {studioMode === 'build' ? (!items.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-zinc-400">
                    No run-of-show items yet. Add blocks to build the order of the night.
                </div>
            ) : (
                <div className="grid gap-3">
                    {[focusedBuildItem].filter(Boolean).map((item) => {
                        const index = focusedBuildItemIndex;
                        const itemSubmissions = (Array.isArray(submissions) ? submissions : []).filter((entry) => entry.itemId === item.id);
                        const optionsCsv = launchConfigToCsv(item.modeLaunchPlan?.launchConfig);
                        const isExpanded = true;
                        const isCurrent = currentItemId === item.id || liveItem?.id === item.id;
                        const pendingSubmissionsForItem = itemSubmissions.filter((entry) => String(entry?.submissionStatus || 'pending').toLowerCase() === 'pending');
                        const pendingCount = pendingSubmissionsForItem.length;
                        const readiness = readinessById[item.id] || getRunOfShowItemReadiness(item, { pendingSubmissionCount: pendingCount });
                        const sourceType = String(item?.backingPlan?.sourceType || 'canonical_default').toLowerCase();
                        const sourceMeta = getSourceMeta(sourceType);
                        const primaryAction = getPrimaryActionForItem(item, readiness, { pendingCount });
                        const suggestedOptions = item.type === 'performance' ? getSuggestedOptionsForItem(item) : [];
                        const roomMomentOpen = isSectionOpen(item.id, 'room_moment');
                        const performerAdvancedOpen = isSectionOpen(item.id, 'performer_advanced');
                        const backingAdvancedOpen = isSectionOpen(item.id, 'backing_advanced');
                        const pendingSubmissionsOpen = isSectionOpen(item.id, 'pending_submissions', pendingCount > 0);
                        const sceneSettingsOpen = isSectionOpen(item.id, 'scene_settings');
                        const queueMatchesExpanded = isSectionOpen(item.id, 'queue_matches');
                        const queueOptionsOpen = isSectionOpen(item.id, 'queue_options', false);
                        const presentationOpen = isSectionOpen(item.id, 'presentation_scene');
                        const interactiveOpen = isSectionOpen(item.id, 'interactive_scene');
                        const targetBefore = dragState?.targetId === item.id && dragState?.position === 'before';
                        const targetAfter = dragState?.targetId === item.id && dragState?.position === 'after';
                        const isDragging = dragState?.itemId === item.id;
                        const updateBackingPlan = (patch) => {
                            if (!safeOperatorCapabilities.canCurateMedia) return;
                            onUpdateItem?.(item.id, { backingPlan: { ...(item.backingPlan || {}), ...(patch || {}) } });
                        };
                        const presentationPlan = item?.presentationPlan && typeof item.presentationPlan === 'object' ? item.presentationPlan : {};
                        const audioPlan = item?.audioPlan && typeof item.audioPlan === 'object' ? item.audioPlan : {};
                        const supportsPresentationScene = TAKEOVER_ITEM_TYPES.has(String(item?.type || '').trim().toLowerCase());
                        const matchedTakeoverPreset = getTakeoverStylePresetMatch(item);
                        const hasCustomPresentationOverrides = Boolean(String(presentationPlan?.backgroundMedia || '').trim())
                            || (!matchedTakeoverPreset && (
                                String(presentationPlan?.takeoverScene || '').trim()
                                || String(presentationPlan?.accentTheme || '').trim()
                            ));
                        const presentationCustomOverridesOpen = isSectionOpen(item.id, 'presentation_custom_overrides', hasCustomPresentationOverrides);
                        const soundtrackConfigured = hasRunOfShowTakeoverSoundtrackIdentity(presentationPlan);
                        const soundtrackControlsOpen = isSectionOpen(item.id, 'presentation_soundtrack', soundtrackConfigured);
                        const soundtrackSourceType = String(presentationPlan?.soundtrackSourceType || '').trim().toLowerCase();
                        const hasCustomSoundtrackOptions = Boolean(String(presentationPlan?.soundtrackLabel || '').trim())
                            || presentationPlan?.soundtrackAutoPlay === true
                            || audioPlan?.duckBackingEnabled === true
                            || soundtrackSourceType === 'bg_track'
                            || (soundtrackSourceType === 'youtube' && Boolean(String(presentationPlan?.soundtrackMediaUrl || '').trim()));
                        const soundtrackCustomizeOpen = isSectionOpen(item.id, 'presentation_soundtrack_customize', hasCustomSoundtrackOptions);
                        const roomMomentPlan = item?.roomMomentPlan && typeof item.roomMomentPlan === 'object' ? item.roomMomentPlan : {};
                        const hasCustomRoomOptions = (String(roomMomentPlan?.lightMode || 'off').trim().toLowerCase() !== 'off')
                            || roomMomentPlan?.showHowToPlay === true;
                        const roomMomentCustomizeOpen = isSectionOpen(item.id, 'room_moment_customize', hasCustomRoomOptions);
                        const updatePresentationPlan = (patch) => {
                            if (!safeOperatorCapabilities.canEditFlow) return;
                            onUpdateItem?.(item.id, { presentationPlan: { ...(presentationPlan || {}), ...(patch || {}) } });
                        };
                        const updateAudioPlan = (patch) => {
                            if (!safeOperatorCapabilities.canEditFlow) return;
                            onUpdateItem?.(item.id, { audioPlan: { ...(audioPlan || {}), ...(patch || {}) } });
                        };
                        const setPresentationSoundtrackEnabled = (enabled = false) => {
                            if (!safeOperatorCapabilities.canEditFlow) return;
                            setSectionOpen(item.id, 'presentation_soundtrack', enabled);
                            if (enabled) {
                                if (!soundtrackConfigured) {
                                    const defaultBgTrack = BG_TRACK_OPTIONS[0] || null;
                                    updatePresentationPlan({
                                        soundtrackSourceType: defaultBgTrack ? 'bg_track' : 'youtube',
                                        soundtrackBgTrackId: defaultBgTrack?.id || '',
                                        soundtrackMediaUrl: defaultBgTrack?.url || ''
                                    });
                                }
                                return;
                            }
                            setSectionOpen(item.id, 'presentation_soundtrack_customize', false);
                            onUpdateItem?.(item.id, {
                                presentationPlan: {
                                    ...(presentationPlan || {}),
                                    soundtrackSourceType: '',
                                    soundtrackYoutubeId: '',
                                    soundtrackAppleMusicId: '',
                                    soundtrackBgTrackId: '',
                                    soundtrackMediaUrl: '',
                                    soundtrackLabel: '',
                                    soundtrackAutoPlay: false
                                },
                                audioPlan: {
                                    ...(audioPlan || {}),
                                    duckBackingEnabled: false
                                }
                            });
                        };
                        const visual = getItemVisual(item.type);
                        const performanceFields = item.type === 'performance' ? getPerformanceIdentityFields(item) : [];
                        const summaryLine = item.type === 'performance'
                            ? formatSummaryLine(item.assignedPerformerName || 'Singer TBD', item.songTitle || 'Song TBD', item.artistName || '')
                            : (item.modeLaunchPlan?.modeKey ? String(item.modeLaunchPlan.modeKey).replaceAll('_', ' ') : item.notes || getRunOfShowItemLabel(item.type));
                        const queueCandidatesForItem = item.type === 'performance'
                            ? (Array.isArray(queueSongs) ? queueSongs : [])
                                .filter((song) => String(song?.status || '').trim().toLowerCase() === 'requested')
                                .map((song) => ({ ...song, _queueFitScore: getQueueFitScore(item, song) }))
                                .sort((left, right) => right._queueFitScore - left._queueFitScore)
                                .slice(0, 6)
                            : [];
                        const bestQueueCandidate = queueCandidatesForItem[0] || null;
                        const performerReady = !!String(item.assignedPerformerName || '').trim();
                        const songReady = !!String(item.songTitle || '').trim();
                        const artistReady = !!String(item.artistName || '').trim();
                        const playbackReady = item.backingPlan?.playbackReady === true;
                        const selectedBackingSummary = String(
                            item.backingPlan?.label
                            || item.backingPlan?.mediaUrl
                            || item.backingPlan?.youtubeId
                            || item.backingPlan?.appleMusicId
                            || item.backingPlan?.trackId
                            || ''
                        ).trim();
                        const hasSelectedBacking = selectedBackingSummary.length > 0;
                        const backingApprovalState = backingApprovalMeta(item.backingPlan?.approvalStatus);
                        const trackSetupState = playbackReady
                            ? {
                                label: 'Ready to run',
                                tone: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
                                detail: 'This slot has a playable track lined up.'
                            }
                            : hasSelectedBacking
                                ? {
                                    label: 'Needs host check',
                                    tone: 'border-amber-300/30 bg-amber-500/10 text-amber-100',
                                    detail: 'A track is selected, but it still needs a final go-ahead.'
                                }
                                : {
                                    label: 'Pick a track',
                                    tone: 'border-rose-300/30 bg-rose-500/10 text-rose-100',
                                    detail: 'Choose a backing before this performance can run.'
                                };
                        const slotNeedsApprovals = item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission && pendingCount > 0;
                        const slotNeedsQueueAssignment = !!bestQueueCandidate && (!performerReady || !songReady || !artistReady);
                        const slotNeedsPerformer = !slotNeedsApprovals && !slotNeedsQueueAssignment && !performerReady;
                        const slotNeedsSong = !slotNeedsApprovals && !slotNeedsQueueAssignment && performerReady && (!songReady || !artistReady);
                        const slotNeedsBacking = !slotNeedsApprovals && !slotNeedsQueueAssignment && !slotNeedsSong && !playbackReady;
                        const prepInboxMode = slotNeedsApprovals ? 'submissions' : (queueCandidatesForItem.length ? 'queue' : '');
                        const visiblePrepInboxSubmissions = pendingSubmissionsForItem.slice(0, 2);
                        const visiblePrepInboxQueue = queueCandidatesForItem.slice(0, 2);
                        const defaultPrepStep = slotNeedsApprovals || slotNeedsQueueAssignment || slotNeedsPerformer
                            ? 'singer'
                            : slotNeedsSong
                                ? 'song'
                                : 'track';
                        const activePrepStep = isSectionOpen(item.id, 'prep_step_singer', defaultPrepStep === 'singer')
                            ? 'singer'
                            : isSectionOpen(item.id, 'prep_step_song', defaultPrepStep === 'song')
                                ? 'song'
                                : 'track';
                        const singerSetupOpen = activePrepStep === 'singer';
                        const songSetupOpen = activePrepStep === 'song';
                        const trackPicksOpen = isSectionOpen(item.id, 'track_picks', !hasSelectedBacking || !playbackReady || mediaPicker.itemId === item.id || slotNeedsBacking || repairModeActive);
                        const advancedSlotControlsOpen = isSectionOpen(item.id, 'advanced_slot_controls', false);
                        const trackNeedsAdvancedSourceSetup = sourceType === 'manual_external' || sourceType === 'canonical_default';
                        const trackAdvancedOpen = backingAdvancedOpen || trackNeedsAdvancedSourceSetup || mediaPicker.itemId === item.id;
                        const quickPickerOpen = mediaPicker.itemId === item.id;
                        const quickSuggestedOptions = quickPickerOpen ? pickerResults.slice(0, 4) : suggestedOptions.slice(0, 3);
                        const performancePrepSteps = item.type === 'performance' ? [
                            {
                                key: 'performer',
                                label: 'Singer',
                                done: slotNeedsApprovals ? false : performerReady,
                                detail: slotNeedsApprovals
                                    ? `${pendingCount} waiting`
                                    : performerReady
                                        ? (item.assignedPerformerName || 'Assigned')
                                        : 'Choose one'
                            },
                            {
                                key: 'song',
                                label: 'Song',
                                done: slotNeedsQueueAssignment ? false : (songReady && artistReady),
                                detail: slotNeedsQueueAssignment
                                    ? `${bestQueueCandidate?.songTitle || 'Queued song'}${bestQueueCandidate?.artist ? ` • ${bestQueueCandidate.artist}` : ''}`
                                    : songReady
                                        ? `${item.songTitle || 'Song'}${artistReady ? ` • ${item.artistName}` : ''}`
                                        : 'Add title + artist'
                            },
                            {
                                key: 'track',
                                label: 'Track',
                                done: playbackReady,
                                detail: playbackReady
                                    ? (item.backingPlan?.label || item.backingPlan?.youtubeId || item.backingPlan?.mediaUrl || 'Track selected')
                                    : hasSelectedBacking
                                        ? 'Check current track'
                                        : 'Choose track'
                            }
                        ] : [];
                        const performancePrepPrimaryAction = item.type === 'performance' ? (
                            slotNeedsApprovals
                                ? {
                                    label: 'Review Singer Picks',
                                    tone: 'warning',
                                    onClick: () => openSection(item.id, 'pending_submissions')
                                }
                                : slotNeedsQueueAssignment
                                    ? {
                                        label: 'Use Best Queue Match',
                                        tone: 'primary',
                                        onClick: () => handleAssignQueueSong(bestQueueCandidate, item)
                                    }
                                    : slotNeedsPerformer
                                        ? {
                                            label: 'Choose Singer',
                                            tone: 'primary',
                                            onClick: () => setPendingSetupScrollItemId(item.id)
                                        }
                                        : slotNeedsSong
                                            ? {
                                                label: 'Add Song Details',
                                                tone: 'primary',
                                                onClick: () => setPendingSetupScrollItemId(item.id)
                                            }
                                            : slotNeedsBacking
                                                ? {
                                                    label: 'Find Karaoke Backing',
                                                    tone: 'primary',
                                                    onClick: () => loadSuggestedBacking(item)
                                                }
                                                : null
                        ) : null;
                        const visibleQueueCandidates = queueMatchesExpanded ? queueCandidatesForItem : queueCandidatesForItem.slice(0, 3);
                        return (
                            <article
                                key={item.id}
                                data-run-of-show-item-id={item.id}
                                className={`${surfaceClass} relative overflow-hidden ${isCurrent ? 'border-cyan-300/45 bg-cyan-500/8' : ''} ${isDragging ? 'opacity-50' : ''}`}
                                draggable={safeOperatorCapabilities.canEditFlow && !repairModeActive}
                                onDragStart={(event) => {
                                    if (!safeOperatorCapabilities.canEditFlow) return;
                                    if (event.target instanceof Element && event.target.closest('button, input, select, textarea, label')) {
                                        event.preventDefault();
                                        return;
                                    }
                                    event.dataTransfer.effectAllowed = 'move';
                                    setDragState({ itemId: item.id, targetId: item.id, position: 'after' });
                                }}
                                onDragEnd={clearDragState}
                                onDragOver={(event) => {
                                    if (!safeOperatorCapabilities.canEditFlow) return;
                                    event.preventDefault();
                                    const bounds = event.currentTarget.getBoundingClientRect();
                                    const position = event.clientY < bounds.top + (bounds.height / 2) ? 'before' : 'after';
                                    updateDragTarget(item.id, position);
                                }}
                                onDrop={(event) => {
                                    if (!safeOperatorCapabilities.canEditFlow) return;
                                    event.preventDefault();
                                    handleStoryboardDrop(item.id, dragState?.position || 'after');
                                }}
                            >
                                {targetBefore ? <div className="absolute inset-x-8 top-0 h-1 rounded-full bg-cyan-300 shadow-[0_0_0_8px_rgba(34,211,238,0.12)]"></div> : null}
                                {targetAfter ? <div className="absolute inset-x-8 bottom-0 h-1 rounded-full bg-cyan-300 shadow-[0_0_0_8px_rgba(34,211,238,0.12)]"></div> : null}
                                <div className={`grid ${compactViewport ? 'gap-3 p-3 xl:grid-cols-[284px_minmax(0,1fr)] 2xl:grid-cols-[304px_minmax(0,1fr)]' : 'gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[352px_minmax(0,1fr)]'} xl:items-start`}>
                                    <div className={`${compactViewport ? 'space-y-3' : 'space-y-4'} xl:sticky xl:top-[9.5rem]`}>
                                        <button type="button" onClick={() => openItem(item.id)} className="block min-w-0 text-left">
                                            <div className={`rounded-[22px] border border-white/10 bg-gradient-to-br ${visual.tone} p-4`}>
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${visual.chip}`}>
                                                            <i className={`fa-solid ${visual.icon}`}></i>
                                                        </div>
                                                        {!repairModeActive ? (
                                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-zinc-200">
                                                                <i className="fa-solid fa-grip-lines"></i>
                                                            </div>
                                                        ) : null}
                                                        <div>
                                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-200/80">Scene {index + 1}</div>
                                                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-100/75">{getRunOfShowItemLabel(item.type)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <div className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                                                            {item.id === liveItem?.id ? 'Now' : item.id === stagedItem?.id ? 'Staged' : item.id === nextItem?.id ? 'Up next' : 'Timeline'}
                                                        </div>
                                                        <div className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${statusTone(item.status)}`}>{item.status}</div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 text-2xl font-black leading-tight text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                                                <div className="mt-2 text-sm text-zinc-100/80">{summaryLine}</div>
                                                {performanceFields.length ? (
                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                        {performanceFields.map((field) => {
                                                            const hasValue = !!field.value;
                                                            return (
                                                                <span
                                                                    key={field.key}
                                                                    className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${hasValue ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}
                                                                >
                                                                    {hasValue ? `${field.label}: ${field.value}` : field.fallback}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </button>
                                        {isExpanded && !repairModeActive && buildSequenceOpen && buildMapOpen ? (
                                            <QuickInlineSceneEditor
                                                item={item}
                                                onUpdateItem={onUpdateItem}
                                                disabled={!safeOperatorCapabilities.canEditFlow}
                                            />
                                        ) : null}
                                        {repairModeActive ? (
                                            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                                                <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5">
                                                    <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">State</div>
                                                    <div className={`mt-1 text-sm font-semibold ${Array.isArray(readiness?.blockers) && readiness.blockers.length ? 'text-amber-100' : 'text-emerald-100'}`}>{readiness.summary}</div>
                                                    <div className="mt-1 text-xs text-zinc-400">
                                                        {formatStart(item.startsAtMs)} • {formatDurationSec(item.plannedDurationSec) || `${Math.max(0, Number(item.plannedDurationSec || 0))}s`}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {pendingCount > 0 ? <SubmissionStatusBadge count={pendingCount} /> : null}
                                                    {item.type === 'performance' ? (
                                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${item.backingPlan?.playbackReady === true ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}>
                                                            {item.backingPlan?.playbackReady === true ? 'Playback ready' : 'Needs backing'}
                                                        </span>
                                                    ) : null}
                                                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                                        Repair mode
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                                        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Starts</div>
                                                        <div className="mt-1 text-sm font-semibold text-white">{formatStart(item.startsAtMs)}</div>
                                                    </div>
                                                    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                                        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Length</div>
                                                        <div className="mt-1 text-sm font-semibold text-white">{formatDurationSec(item.plannedDurationSec) || `${Math.max(0, Number(item.plannedDurationSec || 0))}s`}</div>
                                                    </div>
                                                    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                                        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Playback</div>
                                                        <div className="mt-1 text-sm font-semibold text-white">{sourceMeta.label}</div>
                                                    </div>
                                                    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                                        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">State</div>
                                                        <div className={`mt-1 text-sm font-semibold ${Array.isArray(readiness?.blockers) && readiness.blockers.length ? 'text-amber-100' : 'text-emerald-100'}`}>{readiness.summary}</div>
                                                    </div>
                                                </div>
                                                <ReadinessPanel readiness={readiness} compact />
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">
                                                        <i className="fa-solid fa-grip-lines mr-1"></i>
                                                        Drag scene
                                                    </span>
                                                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{item.automationMode}</span>
                                                    {getRunOfShowAdvanceMode(item) !== RUN_OF_SHOW_ADVANCE_MODES.auto ? (
                                                        <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
                                                            {getAdvanceModeLabel(item)}
                                                        </span>
                                                    ) : null}
                                                    {previewActiveId === item.id ? <div className="rounded-full border border-violet-300/35 bg-violet-500/14 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-100">previewing</div> : null}
                                                    {pendingCount > 0 ? <SubmissionStatusBadge count={pendingCount} /> : null}
                                                    {item.type === 'performance' ? (
                                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${item.backingPlan?.playbackReady === true ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}>
                                                            {item.backingPlan?.playbackReady === true ? 'Playback ready' : 'Needs backing'}
                                                        </span>
                                                    ) : null}
                                                    <span className="rounded-full border border-violet-300/25 bg-violet-500/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">
                                                        Focused scene
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {repairModeActive ? (
                                                <ControlButton onClick={() => setRepairFocus(null)}>Open Full Builder</ControlButton>
                                            ) : (
                                                <>
                                                    <ControlButton disabled={index <= 0} onClick={() => index > 0 && openItem(items[index - 1]?.id)}>
                                                        <i className="fa-solid fa-arrow-left mr-1"></i>
                                                        Previous Scene
                                                    </ControlButton>
                                                    <ControlButton disabled={index >= items.length - 1} onClick={() => index < items.length - 1 && openItem(items[index + 1]?.id)}>
                                                        Next Scene
                                                        <i className="fa-solid fa-arrow-right ml-1"></i>
                                                    </ControlButton>
                                                </>
                                            )}
                                            {primaryAction ? (
                                                <ControlButton tone={primaryAction.tone} onClick={primaryAction.onClick}>{primaryAction.label}</ControlButton>
                                            ) : null}
                                            <ControlButton className={previewActiveId === item.id ? 'ring-1 ring-violet-300/45' : ''} onClick={() => onPreviewItem?.(item.id)}>
                                                {repairModeActive ? 'Preview' : 'Preview TV'}
                                            </ControlButton>
                                        </div>
                                    </div>

                                {isExpanded ? (
                                    <div className={`min-w-0 rounded-[24px] border border-white/10 bg-black/20 ${compactViewport ? 'p-4 space-y-4' : 'p-5 space-y-5'}`} aria-label={`Run of show details for ${item.title || getRunOfShowItemLabel(item.type)}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-300/16 bg-violet-500/8 px-4 py-4">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.18em] text-violet-100/80">{repairModeActive ? (repairFocusMeta?.eyebrow || 'Repair') : 'Scene Inspector'}</div>
                                                <div className="mt-1 text-sm text-zinc-200">{repairModeActive ? (repairFocusMeta?.title || 'Fix this scene') : 'Tune this scene without losing sight of the overall sequence.'}</div>
                                                {repairModeActive ? null : (
                                                    <div className="mt-2 text-xs text-zinc-400">This editor controls what the host sees, what the audience phone gets, and what the Public TV takes over with when this scene goes live.</div>
                                                )}
                                            </div>
                                            <div className="rounded-full border border-violet-300/25 bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">
                                                {getRunOfShowItemLabel(item.type)}
                                            </div>
                                        </div>
                                        {item.type !== 'performance' && !supportsPresentationScene ? (
                                            <>
                                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                    <div className="md:col-span-2">
                                                        <FieldLabel>Title</FieldLabel>
                                                        <input value={item.title || ''} onChange={(e) => onUpdateItem?.(item.id, { title: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} />
                                                    </div>
                                                    <div>
                                                        <FieldLabel>Visibility</FieldLabel>
                                                        <SelectControl value={item.visibility || 'public'} onChange={(e) => onUpdateItem?.(item.id, { visibility: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow}><option value="public">Public</option><option value="private">Private</option></SelectControl>
                                                    </div>
                                                    <div>
                                                        <FieldLabel>Automation</FieldLabel>
                                                        <SelectControl value={item.automationMode || 'auto'} onChange={(e) => onUpdateItem?.(item.id, { automationMode: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow}><option value="auto">Auto</option><option value="manual">Manual</option></SelectControl>
                                                    </div>
                                                </div>

                                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                                    <div>
                                                        <FieldLabel>Planned Duration Sec</FieldLabel>
                                                        <input
                                                            type="number"
                                                            value={item.plannedDurationSec || 0}
                                                            onChange={(e) => onUpdateItem?.(item.id, {
                                                                plannedDurationSec: Number(e.target.value || 0),
                                                                plannedDurationSource: 'manual'
                                                            })}
                                                            disabled={!safeOperatorCapabilities.canEditFlow}
                                                            className={textInputClass}
                                                        />
                                                    </div>
                                                    <div><FieldLabel>Planned Start</FieldLabel><input type="datetime-local" value={item.startsAtMs ? new Date(item.startsAtMs).toISOString().slice(0, 16) : ''} onChange={(e) => onUpdateItem?.(item.id, { startsAtMs: e.target.value ? new Date(e.target.value).getTime() : 0 })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                    <div><FieldLabel>Notes</FieldLabel><input value={item.notes || ''} onChange={(e) => onUpdateItem?.(item.id, { notes: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                </div>
                                                <RunOfShowAdvanceModePicker
                                                    item={item}
                                                    onUpdateItem={onUpdateItem}
                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                />
                                                {!repairModeActive ? (
                                                    <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-zinc-300">
                                                        <span className="font-semibold text-white">Scene controls:</span> Public scenes can take over TV and audience surfaces, automation decides whether the show advances by itself, and duration sets how long the block can hold the stage before the next one takes over.
                                                    </div>
                                                ) : null}
                                            </>
                                        ) : null}

                                        {!supportsPresentationScene && item.type !== 'performance' ? (
                                            <CollapsiblePanel
                                                label="Room Behavior"
                                                title="TV, phone, and room behavior"
                                                summary="Use this only when this scene needs overlay, room mode, or vibe controls."
                                                open={roomMomentOpen}
                                                onToggle={() => toggleSection(item.id, 'room_moment')}
                                                badge={compactMomentSummary(item.roomMomentPlan || {}) || 'Hidden by default'}
                                                tone="violet"
                                                compact
                                            >
                                                <div className="rounded-2xl bg-black/10 px-3 py-3 text-sm text-zinc-300">
                                                    Use this only when the scene needs something beyond the normal TV takeover and duration controls.
                                                </div>
                                                <RunOfShowRoomBehaviorEditor
                                                    item={item}
                                                    onUpdateItem={onUpdateItem}
                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                    customizeOpen={roomMomentCustomizeOpen}
                                                    onToggleCustomize={() => toggleSection(item.id, 'room_moment_customize', hasCustomRoomOptions)}
                                                />
                                            </CollapsiblePanel>
                                        ) : null}

                                        {item.type === 'performance' ? (
                                            <div className="space-y-4">
                                                <div data-performance-setup-for={item.id} className="rounded-2xl bg-black/15 p-4 space-y-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{repairModeActive ? 'Performance Repair' : 'Quick Performance Setup'}</div>
                                                        <div className="mt-1 text-sm text-zinc-300">
                                                            {repairModeActive
                                                                ? 'Finish this slot and get back to the live show.'
                                                                : 'Set the singer, lock the song, and confirm one playable track for this slot.'}
                                                        </div>
                                                        {!repairModeActive ? (
                                                            <div className="mt-2 text-xs text-zinc-400">Use queue assignment for requests you already have, or type song + artist to auto-find a karaoke backing without leaving this slot.</div>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone(item.status)}`}>{item.status}</span>
                                                        {!repairModeActive ? (
                                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${sourceTone(sourceMeta.tone, false)}`}>{sourceMeta.label}</span>
                                                        ) : null}
                                                        </div>
                                                    </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {PERFORMER_MODE_OPTIONS.map((option) => (
                                                        <button key={option.value} type="button" disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onUpdateItem?.(item.id, { performerMode: option.value })} className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${item.performerMode === option.value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/30 text-zinc-300'}`}>{option.label}</button>
                                                    ))}
                                                </div>
                                                <div className="rounded-2xl border border-cyan-300/16 bg-cyan-500/8 px-4 py-4">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/80">Fast Assign</div>
                                                            <div className="mt-1 text-sm text-zinc-200">Set the singer and song here without dropping into the lower editor cards.</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                                                            <span className={`rounded-full border px-2 py-1 ${performerReady ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}>{performerReady ? 'Singer ready' : 'Singer needed'}</span>
                                                            <span className={`rounded-full border px-2 py-1 ${(songReady && artistReady) ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}>{songReady && artistReady ? 'Song ready' : 'Song needed'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto]">
                                                        <div className="space-y-3">
                                                            <div>
                                                                <FieldLabel>{getPerformerFieldLabel(item.performerMode)}</FieldLabel>
                                                                <div className="mt-1">
                                                                    <input
                                                                        value={item.assignedPerformerName || ''}
                                                                        onChange={(e) => onUpdateItem?.(item.id, { assignedPerformerName: e.target.value })}
                                                                        disabled={!safeOperatorCapabilities.canEditFlow}
                                                                        className={textInputClass}
                                                                        placeholder={getPerformerFieldPlaceholder(item.performerMode)}
                                                                    />
                                                                </div>
                                                            </div>
                                                            {item.performerMode !== RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? (
                                                                <div>
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <FieldLabel>Live Lobby Performer</FieldLabel>
                                                                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                                                            {roomUserCandidates.length ? `${roomUserCandidates.length} in lobby` : 'No one joined yet'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-1">
                                                                        <SelectControl
                                                                            value={item.assignedPerformerUid || ''}
                                                                            onChange={(e) => {
                                                                                const candidate = roomUserCandidates.find((entry) => entry.uid === e.target.value);
                                                                                if (candidate) assignLobbyPerformer(item, candidate);
                                                                                else clearLobbyPerformer(item);
                                                                            }}
                                                                            disabled={!safeOperatorCapabilities.canEditFlow || roomUserCandidates.length === 0}
                                                                        >
                                                                            <option value="">{roomUserCandidates.length ? 'Choose from live lobby' : 'No lobby performers yet'}</option>
                                                                            {roomUserCandidates.map((candidate) => (
                                                                                <option key={candidate.uid} value={candidate.uid}>
                                                                                    {candidate.label}{candidate.meta ? ` · ${candidate.meta}` : ''}
                                                                                </option>
                                                                            ))}
                                                                        </SelectControl>
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <div>
                                                                <FieldLabel>Song Title</FieldLabel>
                                                                <div className="mt-1">
                                                                    <input value={item.songTitle || ''} onChange={(e) => onUpdateItem?.(item.id, { songTitle: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} placeholder="Song title" />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <FieldLabel>Artist</FieldLabel>
                                                                <div className="mt-1">
                                                                    <input value={item.artistName || ''} onChange={(e) => onUpdateItem?.(item.id, { artistName: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} placeholder="Artist" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 xl:flex-col xl:items-stretch">
                                                            {bestQueueCandidate && typeof onAssignQueueSongToItem === 'function' ? (
                                                                <ControlButton
                                                                    tone="primary"
                                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                                    onClick={() => handleAssignQueueSong(bestQueueCandidate, item)}
                                                                >
                                                                    Use Best Queue Match
                                                                </ControlButton>
                                                            ) : null}
                                                            <ControlButton
                                                                tone="primary"
                                                                onClick={() => {
                                                                    setExclusivePrepStep(item.id, 'track');
                                                                    loadSuggestedBacking(item);
                                                                }}
                                                                disabled={!safeOperatorCapabilities.canCurateMedia || !buildMediaQuery(item)}
                                                            >
                                                                Find Karaoke Backing
                                                            </ControlButton>
                                                            <ControlButton onClick={() => setExclusivePrepStep(item.id, performerReady ? (songReady && artistReady ? 'track' : 'song') : 'singer')}>
                                                                Open Focused Editor
                                                            </ControlButton>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 text-xs text-cyan-100/72">
                                                        Common slot assignment lives here. Open the lower cards when you need queue review, extra track picks, or advanced overrides.
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Quick editor</div>
                                                            <div className="mt-1 text-sm text-zinc-300">Edit the slot and search backing without dropping into the lower panels.</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {bestQueueCandidate && typeof onAssignQueueSongToItem === 'function' ? (
                                                                <ControlButton
                                                                    tone="primary"
                                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                                    onClick={() => handleAssignQueueSong(bestQueueCandidate, item)}
                                                                >
                                                                    Use best queue match
                                                                </ControlButton>
                                                            ) : null}
                                                            <ControlButton
                                                                tone="primary"
                                                                disabled={!safeOperatorCapabilities.canCurateMedia || !buildMediaQuery(item)}
                                                                onClick={() => loadSuggestedBacking(item)}
                                                            >
                                                                {quickPickerOpen ? 'Refresh Backing' : 'Find Karaoke Backing'}
                                                            </ControlButton>
                                                            <ControlButton
                                                                disabled={!safeOperatorCapabilities.canCurateMedia}
                                                                onClick={() => toggleMediaPicker(item)}
                                                            >
                                                                {quickPickerOpen ? 'Hide Search' : `Browse ${sourceMeta.label}`}
                                                            </ControlButton>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                                        <div className="space-y-3">
                                                            <div>
                                                                <FieldLabel>{getPerformerFieldLabel(item.performerMode)}</FieldLabel>
                                                                <div className="mt-1">
                                                                    <input
                                                                        value={item.assignedPerformerName || ''}
                                                                        onChange={(e) => onUpdateItem?.(item.id, { assignedPerformerName: e.target.value })}
                                                                        disabled={!safeOperatorCapabilities.canEditFlow}
                                                                        className={textInputClass}
                                                                        placeholder={getPerformerFieldPlaceholder(item.performerMode)}
                                                                    />
                                                                </div>
                                                            </div>
                                                            {item.performerMode !== RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? (
                                                                <div>
                                                                    <FieldLabel>Bind Live Lobby Performer</FieldLabel>
                                                                    <div className="mt-1">
                                                                        <SelectControl
                                                                            value={item.assignedPerformerUid || ''}
                                                                            onChange={(e) => {
                                                                                const candidate = roomUserCandidates.find((entry) => entry.uid === e.target.value);
                                                                                if (candidate) assignLobbyPerformer(item, candidate);
                                                                                else clearLobbyPerformer(item);
                                                                            }}
                                                                            disabled={!safeOperatorCapabilities.canEditFlow || roomUserCandidates.length === 0}
                                                                        >
                                                                            <option value="">{roomUserCandidates.length ? 'Choose from live lobby' : 'No lobby performers yet'}</option>
                                                                            {roomUserCandidates.map((candidate) => (
                                                                                <option key={candidate.uid} value={candidate.uid}>
                                                                                    {candidate.label}{candidate.meta ? ` · ${candidate.meta}` : ''}
                                                                                </option>
                                                                            ))}
                                                                        </SelectControl>
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="grid gap-3 md:grid-cols-2">
                                                                <div>
                                                                    <FieldLabel>Song Title</FieldLabel>
                                                                    <div className="mt-1">
                                                                        <input value={item.songTitle || ''} onChange={(e) => onUpdateItem?.(item.id, { songTitle: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} placeholder="Song title" />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <FieldLabel>Artist</FieldLabel>
                                                                    <div className="mt-1">
                                                                        <input value={item.artistName || ''} onChange={(e) => onUpdateItem?.(item.id, { artistName: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} placeholder="Artist" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                                                                <span className={`rounded-full border px-2 py-1 ${performerReady ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}>{performerReady ? 'Singer ready' : 'Singer needed'}</span>
                                                                <span className={`rounded-full border px-2 py-1 ${(songReady && artistReady) ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}>{songReady && artistReady ? 'Song ready' : 'Song needed'}</span>
                                                                <span className={`rounded-full border px-2 py-1 ${trackSetupState.tone}`}>{trackSetupState.label}</span>
                                                            </div>
                                                            {(quickPickerOpen || quickSuggestedOptions.length > 0) ? (
                                                                <div className="rounded-xl border border-cyan-300/16 bg-cyan-500/6 p-3">
                                                                    {quickPickerOpen ? (
                                                                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                                                            <input
                                                                                aria-label="Search run of show media"
                                                                                value={mediaPicker.query}
                                                                                onChange={(e) => setMediaPicker((prev) => ({ ...prev, query: e.target.value }))}
                                                                                className={textInputClass}
                                                                                placeholder={buildMediaQuery(item) || 'Search media'}
                                                                            />
                                                                            <ControlButton onClick={() => setMediaPicker((prev) => ({ ...prev, query: buildMediaQuery(item) }))}>Use Song Query</ControlButton>
                                                                        </div>
                                                                    ) : null}
                                                                    {mediaPicker.error && quickPickerOpen ? <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{mediaPicker.error}</div> : null}
                                                                    {mediaPicker.loading && quickPickerOpen ? <div className="mt-3 text-sm text-cyan-100/80">Loading {sourceMeta.title} results...</div> : null}
                                                                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                                                        {quickSuggestedOptions.map((option) => (
                                                                            <MediaPickerOption
                                                                                key={`${item.id}:quick:${option.id}`}
                                                                                option={quickPickerOpen ? option : { ...option, statusLabel: option.statusLabel || 'Suggested', statusTone: option.statusTone || option.tone || 'zinc' }}
                                                                                onSelect={() => applyMediaSelection(item, option)}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                    {!quickSuggestedOptions.length ? (
                                                                        <div className="mt-3 rounded-xl bg-black/10 px-3 py-3 text-sm text-zinc-400">
                                                                            {quickPickerOpen
                                                                                ? 'No backing matches yet. Try tightening the song title or artist.'
                                                                                : 'Add song title and artist to surface the fastest backing picks here.'}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`rounded-2xl border px-4 py-4 ${performancePrepPrimaryAction ? 'border-cyan-300/18 bg-cyan-500/8' : 'border-emerald-300/18 bg-emerald-500/8'}`}>
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Slot Prep</div>
                                                            <div className="mt-1 text-sm text-zinc-200">
                                                                {performancePrepPrimaryAction
                                                                    ? `Next up: ${performancePrepPrimaryAction.label}.`
                                                                    : 'Singer, song, and track are ready for this slot.'}
                                                            </div>
                                                            <div className="mt-2 text-xs text-zinc-400">
                                                                {`${performancePrepSteps.filter((step) => step.done).length} of ${performancePrepSteps.length} prep steps locked in. Use the stepper below to stay on one setup task at a time.`}
                                                            </div>
                                                        </div>
                                                        {performancePrepPrimaryAction ? (
                                                            <ControlButton tone={performancePrepPrimaryAction.tone} onClick={performancePrepPrimaryAction.onClick}>
                                                                {performancePrepPrimaryAction.label}
                                                            </ControlButton>
                                                        ) : (
                                                            <span className="rounded-full border border-emerald-300/25 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                                                                Ready to run
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {prepInboxMode ? (
                                                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Prep Inbox</div>
                                                                <div className="mt-1 text-sm text-zinc-300">
                                                                    {prepInboxMode === 'submissions'
                                                                        ? 'Start here. Review the best singer picks for this slot before you worry about anything else.'
                                                                        : 'These are the best live queue matches for this slot. Use one and the slot prep flow will carry you forward.'}
                                                                </div>
                                                            </div>
                                                            <ControlButton
                                                                onClick={() => {
                                                                    setExclusivePrepStep(item.id, 'singer');
                                                                    if (prepInboxMode === 'submissions') toggleSection(item.id, 'pending_submissions', true);
                                                                    else toggleSection(item.id, 'queue_options', true);
                                                                }}
                                                            >
                                                                {prepInboxMode === 'submissions' ? 'Open All Singer Picks' : 'Open Queue Options'}
                                                            </ControlButton>
                                                        </div>
                                                        <div className="mt-3 grid gap-2">
                                                            {prepInboxMode === 'submissions'
                                                                ? visiblePrepInboxSubmissions.map((submission) => (
                                                                    <div key={`${item.id}:prep:${submission.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-3">
                                                                        <div className="min-w-0">
                                                                            <div className="truncate text-sm font-semibold text-white">{submission.songTitle || 'Untitled Song'}</div>
                                                                            <div className="truncate text-xs text-zinc-400">{submission.displayName || 'Singer'}{submission.artistName ? ` · ${submission.artistName}` : ''}</div>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            <ControlButton tone="success" disabled={!safeOperatorCapabilities.canReviewSubmissions} onClick={() => handleSubmissionDecision(submission.id, 'approved', item)}>Approve + Assign</ControlButton>
                                                                            <ControlButton tone="danger" disabled={!safeOperatorCapabilities.canReviewSubmissions} onClick={() => onReviewSubmission?.(submission.id, 'declined')}>Decline</ControlButton>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                                : visiblePrepInboxQueue.map((queueSong) => (
                                                                    <div key={`${item.id}:prepqueue:${queueSong.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-3">
                                                                        <div className="min-w-0">
                                                                            <div className="truncate text-sm font-semibold text-white">{queueSong.songTitle || 'Queued Song'}</div>
                                                                            <div className="truncate text-xs text-zinc-400">{queueSong.singerName || 'Singer'}{queueSong.artist ? ` · ${queueSong.artist}` : ''}</div>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            {queueSong._queueFitScore > 0 ? (
                                                                                <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                                                                    Best match
                                                                                </span>
                                                                            ) : null}
                                                                            <ControlButton
                                                                                tone="primary"
                                                                                disabled={!safeOperatorCapabilities.canEditFlow}
                                                                                onClick={() => handleAssignQueueSong(queueSong, item)}
                                                                            >
                                                                                Use Queue Match
                                                                            </ControlButton>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                ) : null}
                                                <div className="grid gap-2 md:grid-cols-3">
                                                    {[
                                                        {
                                                            key: 'singer',
                                                            title: 'Singer',
                                                            detail: slotNeedsApprovals ? `${pendingCount} waiting` : (performerReady ? (item.assignedPerformerName || 'Assigned') : 'Choose one'),
                                                            done: !slotNeedsApprovals && performerReady,
                                                        },
                                                        {
                                                            key: 'song',
                                                            title: 'Song',
                                                            detail: songReady && artistReady ? `${item.songTitle || 'Song'}${item.artistName ? ` · ${item.artistName}` : ''}` : 'Needs title and artist',
                                                            done: songReady && artistReady,
                                                        },
                                                        {
                                                            key: 'track',
                                                            title: 'Track',
                                                            detail: playbackReady ? 'Ready' : (hasSelectedBacking ? 'Check current track' : 'Choose track'),
                                                            done: playbackReady,
                                                        },
                                                    ].map((step) => {
                                                        const active = activePrepStep === step.key;
                                                        return (
                                                            <button
                                                                key={`${item.id}:prepstep:${step.key}`}
                                                                type="button"
                                                                onClick={() => setExclusivePrepStep(item.id, step.key)}
                                                                className={`rounded-2xl border px-3 py-3 text-left transition ${active ? 'border-cyan-300/35 bg-cyan-500/12' : 'border-white/10 bg-black/15 hover:bg-black/25'}`}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{step.title}</div>
                                                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${step.done ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : active ? 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}>
                                                                        {step.done ? 'Done' : active ? 'Now' : 'Next'}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-2 text-sm text-zinc-200">{step.detail}</div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.placeholder ? (
                                                    <div className="rounded-2xl border border-cyan-300/16 bg-cyan-500/8 px-4 py-3 text-sm text-cyan-100/92">
                                                        <span className="font-semibold text-white">Placeholder mode is on.</span> Keep this slot loose with a label like <span className="font-semibold text-white">Singer TBD</span>, then bind the real singer from the live lobby or queue later.
                                                    </div>
                                                ) : null}
                                                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                                                        <div data-run-of-show-prep-section={`${item.id}:singer`}>
                                                            <CollapsiblePanel
                                                                label="Singer Setup"
                                                                title={performerReady ? 'Singer assigned' : 'Choose singer'}
                                                                summary={item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission
                                                                    ? 'Confirm who should own this slot.'
                                                                    : 'Assign or adjust who will sing this slot.'}
                                                                open={singerSetupOpen}
                                                                onToggle={() => setExclusivePrepStep(item.id, 'singer')}
                                                                badge={performerReady ? 'Ready' : 'Needs singer'}
                                                                tone={performerReady ? 'cyan' : 'amber'}
                                                                compact
                                                            >
                                                                <div className="space-y-3">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                {item.assignedPerformerUid ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => clearLobbyPerformer(item)}
                                                                        disabled={!safeOperatorCapabilities.canEditFlow}
                                                                        className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 disabled:opacity-40"
                                                                    >
                                                                        Clear lobby link
                                                                    </button>
                                                                ) : null}
                                                                </div>
                                                            <div>
                                                                <FieldLabel>{getPerformerFieldLabel(item.performerMode)}</FieldLabel>
                                                                <div className="mt-1">
                                                            <input
                                                                value={item.assignedPerformerName || ''}
                                                                onChange={(e) => onUpdateItem?.(item.id, { assignedPerformerName: e.target.value })}
                                                                disabled={!safeOperatorCapabilities.canEditFlow}
                                                                className={textInputClass}
                                                                placeholder={getPerformerFieldPlaceholder(item.performerMode)}
                                                            />
                                                                </div>
                                                            </div>
                                                            {item.performerMode !== RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? (
                                                                <div className="space-y-2">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <FieldLabel>Bind Live Lobby Performer</FieldLabel>
                                                                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                                                            {roomUserCandidates.length ? `${roomUserCandidates.length} in lobby` : 'No one joined yet'}
                                                                        </div>
                                                                    </div>
                                                                    <SelectControl
                                                                        value={item.assignedPerformerUid || ''}
                                                                        onChange={(e) => {
                                                                            const candidate = roomUserCandidates.find((entry) => entry.uid === e.target.value);
                                                                            if (candidate) assignLobbyPerformer(item, candidate);
                                                                            else clearLobbyPerformer(item);
                                                                        }}
                                                                        disabled={!safeOperatorCapabilities.canEditFlow || roomUserCandidates.length === 0}
                                                                    >
                                                                        <option value="">{roomUserCandidates.length ? 'Choose from live lobby' : 'No lobby performers yet'}</option>
                                                                        {roomUserCandidates.map((candidate) => (
                                                                            <option key={candidate.uid} value={candidate.uid}>
                                                                                {candidate.label}{candidate.meta ? ` · ${candidate.meta}` : ''}
                                                                            </option>
                                                                        ))}
                                                                    </SelectControl>
                                                                    <div className="rounded-2xl bg-black/10 px-3 py-2 text-xs text-zinc-400">
                                                                        Build ahead of time with one placeholder name like Singer TBD, then bind a real attendee once the lobby fills.
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                            <div className="rounded-2xl bg-black/10 px-3 py-2 text-xs text-zinc-400">
                                                                {getPerformerModeHint(item.performerMode)}
                                                            </div>
                                                                </div>
                                                            </CollapsiblePanel>
                                                        </div>
                                                        <div data-run-of-show-prep-section={`${item.id}:song`}>
                                                            <CollapsiblePanel
                                                                label="Song Setup"
                                                                title={songReady && artistReady ? 'Song details locked in' : 'Add song details'}
                                                                summary="Fill in or adjust the song title and artist used for track search."
                                                                open={songSetupOpen}
                                                                onToggle={() => setExclusivePrepStep(item.id, 'song')}
                                                                badge={songReady && artistReady ? 'Ready' : 'Needs song'}
                                                                tone={songReady && artistReady ? 'cyan' : 'amber'}
                                                                compact
                                                            >
                                                                <div className="space-y-3">
                                                            <div className="grid gap-3">
                                                                <div>
                                                                    <FieldLabel>Song Title</FieldLabel>
                                                                    <div className="mt-1">
                                                                        <input value={item.songTitle || ''} onChange={(e) => onUpdateItem?.(item.id, { songTitle: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} placeholder="Song title" />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <FieldLabel>Artist</FieldLabel>
                                                                    <div className="mt-1">
                                                                        <input value={item.artistName || ''} onChange={(e) => onUpdateItem?.(item.id, { artistName: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} placeholder="Artist" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                <ControlButton
                                                                    tone="primary"
                                                                    onClick={() => {
                                                                        setExclusivePrepStep(item.id, 'track');
                                                                        loadSuggestedBacking(item);
                                                                    }}
                                                                    disabled={!safeOperatorCapabilities.canCurateMedia || !buildMediaQuery(item)}
                                                                >
                                                                    Find Karaoke Backing
                                                                </ControlButton>
                                                            </div>
                                                            <div className="rounded-2xl bg-black/10 px-3 py-2 text-xs text-zinc-400">
                                                                Song and artist drive the YouTube karaoke search. Pick a playable result and this slot is much closer to ready.
                                                            </div>
                                                                </div>
                                                            </CollapsiblePanel>
                                                        </div>
                                                    </div>
                                                    {!repairModeActive ? (
                                                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                                                            <span className={`rounded-full border px-2 py-1 ${sourceTone(sourceMeta.tone, false)}`}>{PERFORMER_MODE_OPTIONS.find((option) => option.value === item.performerMode)?.label || 'Placeholder'}</span>
                                                            <span className={`rounded-full border px-2 py-1 ${item.backingPlan?.playbackReady === true ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/25 bg-amber-500/10 text-amber-100'}`}>{item.backingPlan?.playbackReady === true ? 'Playback ready' : 'Needs media'}</span>
                                                            <span className={`rounded-full border px-2 py-1 ${pendingCount ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-black/25 text-zinc-300'}`}>{pendingCount} pending approvals</span>
                                                        </div>
                                                    ) : null}
                                                    {typeof onAssignQueueSongToItem === 'function' ? (
                                                        <CollapsiblePanel
                                                            label="Queue Options"
                                                            title="Pull from live queue"
                                                            summary="Use this when you want to assign a queued request instead of picking from the prep inbox."
                                                            open={queueOptionsOpen}
                                                            onToggle={() => toggleSection(item.id, 'queue_options')}
                                                            badge={`${queueCandidatesForItem.length} match${queueCandidatesForItem.length === 1 ? '' : 'es'}`}
                                                            tone="cyan"
                                                            compact
                                                        >
                                                            <div className="mt-3 space-y-2.5">
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Live queue matches</div>
                                                                    <div className="mt-1 text-sm text-zinc-300">Assign a queued request straight into this performance slot without leaving the builder.</div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="text-xs text-zinc-500">{queueCandidatesForItem.length} queue match{queueCandidatesForItem.length === 1 ? '' : 'es'}</div>
                                                                    {queueCandidatesForItem.length > 3 ? (
                                                                        <ControlButton onClick={() => toggleSection(item.id, 'queue_matches')}>
                                                                            {queueMatchesExpanded ? 'Show Less' : `Show All ${queueCandidatesForItem.length}`}
                                                                        </ControlButton>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                            {queueCandidatesForItem.length ? (
                                                                <div className="grid gap-2">
                                                                    {visibleQueueCandidates.map((queueSong) => (
                                                                        <div key={`${item.id}:${queueSong.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/10 px-3 py-2">
                                                                            <div className="min-w-0">
                                                                                <div className="truncate text-sm font-semibold text-white">{queueSong.songTitle || 'Queued Song'}</div>
                                                                                <div className="truncate text-xs text-zinc-400">{queueSong.singerName || 'Singer'}{queueSong.artist ? ` · ${queueSong.artist}` : ''}</div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                {queueSong._queueFitScore > 0 ? (
                                                                                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                                                                        Best match
                                                                                    </span>
                                                                                ) : null}
                                                                                <ControlButton
                                                                                    tone="primary"
                                                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                                                    onClick={() => handleAssignQueueSong(queueSong, item)}
                                                                                >
                                                                                    Use Queue Match
                                                                                </ControlButton>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="rounded-xl bg-black/10 px-3 py-3 text-sm text-zinc-400">
                                                                    No ready queue songs yet. Once requests are in the live queue, you can bind them here with one click.
                                                                </div>
                                                            )}
                                                        </div>
                                                        </CollapsiblePanel>
                                                    ) : null}
                                                    <CollapsiblePanel
                                                        label="More Slot Controls"
                                                        title="Policy, admin, and scene settings"
                                                        summary="Open this only when you need deeper slot rules or editor controls."
                                                        open={advancedSlotControlsOpen}
                                                        onToggle={() => toggleSection(item.id, 'advanced_slot_controls')}
                                                        badge="Advanced"
                                                        tone="violet"
                                                        compact
                                                    >
                                                    {item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? (
                                                        <CollapsiblePanel
                                                            label="Submission Settings"
                                                            title="Rules for this open slot"
                                                            summary="Only adjust these when this performance needs stricter intake rules."
                                                            open={isSectionOpen(item.id, 'submission_rules')}
                                                            onToggle={() => toggleSection(item.id, 'submission_rules')}
                                                            badge={item.slotCriteria?.hostApprovalRequired !== false ? 'Host review on' : 'Open'}
                                                            tone="amber"
                                                            compact
                                                        >
                                                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                                                                <div><FieldLabel>Min Tight 15 Count</FieldLabel><input type="number" value={item.slotCriteria?.minTight15Count || 0} onChange={(e) => onUpdateItem?.(item.id, { slotCriteria: { ...(item.slotCriteria || {}), minTight15Count: Number(e.target.value || 0) } })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                                <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={item.slotCriteria?.requiresAccount !== false} onChange={(e) => onUpdateItem?.(item.id, { slotCriteria: { ...(item.slotCriteria || {}), requiresAccount: e.target.checked } })} disabled={!safeOperatorCapabilities.canEditFlow} />Account required</label></div>
                                                                <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={item.slotCriteria?.hostApprovalRequired !== false} onChange={(e) => onUpdateItem?.(item.id, { slotCriteria: { ...(item.slotCriteria || {}), hostApprovalRequired: e.target.checked } })} disabled={!safeOperatorCapabilities.canEditFlow} />Host approval required</label></div>
                                                            </div>
                                                        </CollapsiblePanel>
                                                    ) : null}
                                                    <CollapsiblePanel
                                                        label="Performance Tools"
                                                        title="Advanced performer fields"
                                                        summary="UID-level overrides for edge cases and imports."
                                                        open={performerAdvancedOpen}
                                                        onToggle={() => toggleSection(item.id, 'performer_advanced')}
                                                        badge={item.assignedPerformerUid || item.songId ? 'Configured' : 'Optional'}
                                                        tone="violet"
                                                        compact
                                                    >
                                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                            <div><FieldLabel>Performer UID</FieldLabel><input value={item.assignedPerformerUid || ''} onChange={(e) => onUpdateItem?.(item.id, { assignedPerformerUid: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                            <div><FieldLabel>Song ID</FieldLabel><input value={item.songId || ''} onChange={(e) => onUpdateItem?.(item.id, { songId: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                        </div>
                                                    </CollapsiblePanel>
                                                </CollapsiblePanel>

                                                {activePrepStep === 'track' ? (
                                                <>
                                                <div data-run-of-show-prep-section={`${item.id}:track`} className="border-t border-white/10 pt-3 space-y-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Track Setup</div>
                                                            <div className="mt-1 text-sm text-zinc-300">Choose the working track for this slot. Open details only if the main path is not enough.</div>
                                                        </div>
                                                        {mediaPicker.itemId === item.id && mediaPicker.loading ? <span className="text-xs text-cyan-100/80">Loading…</span> : null}
                                                    </div>
                                                    <div className="rounded-xl bg-black/10 px-3 py-3">
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${trackSetupState.tone}`}>
                                                                        {trackSetupState.label}
                                                                    </span>
                                                                    <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                                                        {sourceMeta.label}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Selected track</div>
                                                                <div className="mt-1 text-sm font-semibold text-white">
                                                                    {hasSelectedBacking ? selectedBackingSummary : 'No track chosen yet.'}
                                                                </div>
                                                                <div className="mt-1 text-sm text-zinc-300">{trackSetupState.detail}</div>
                                                                {hasSelectedBacking ? (
                                                                    <div className="mt-2 text-xs text-zinc-400">
                                                                        Room status: {backingApprovalState.label}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                <ControlButton
                                                                    tone="primary"
                                                                    onClick={() => loadSuggestedBacking(item)}
                                                                    disabled={!safeOperatorCapabilities.canCurateMedia || !buildMediaQuery(item)}
                                                                >
                                                                    {hasSelectedBacking ? 'Change Track' : 'Choose Track'}
                                                                </ControlButton>
                                                                {hasSelectedBacking ? (
                                                                    <>
                                                                        {!playbackReady ? (
                                                                            <ControlButton tone="success" onClick={() => updateBackingPlan({ approvalStatus: 'approved', playbackReady: true, resolutionStatus: 'ready' })}>Good for room</ControlButton>
                                                                        ) : null}
                                                                        <ControlButton tone="danger" onClick={() => updateBackingPlan({ approvalStatus: 'rejected', playbackReady: false, resolutionStatus: 'needs_replacement' })}>Bad fit</ControlButton>
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                            {suggestedOptions.length ? (
                                                                <CollapsiblePanel
                                                                    label="Track Picks"
                                                                    title={hasSelectedBacking ? 'Swap to another track' : 'Top picks for this slot'}
                                                                    summary="Open this when you want other likely matches."
                                                                    open={trackPicksOpen}
                                                                    onToggle={() => toggleSection(item.id, 'track_picks', !hasSelectedBacking || !playbackReady || mediaPicker.itemId === item.id || slotNeedsBacking || repairModeActive)}
                                                                    badge={`${suggestedOptions.length} option${suggestedOptions.length === 1 ? '' : 's'}`}
                                                                    tone="cyan"
                                                                    compact
                                                                >
                                                                    <div className="grid gap-3 lg:grid-cols-2">
                                                                        {suggestedOptions.slice(0, hasSelectedBacking ? 3 : 4).map((option) => (
                                                                            <MediaPickerOption
                                                                                key={option.id}
                                                                                option={{ ...option, statusLabel: option.statusLabel || 'Suggested', statusTone: option.statusTone || option.tone || 'zinc' }}
                                                                                onSelect={() => applyMediaSelection(item, option)}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                </CollapsiblePanel>
                                                            ) : (
                                                                <div className="rounded-xl bg-black/10 px-3 py-3 text-sm text-zinc-400">
                                                                    Add a song title and artist to surface stronger track picks. Once those are set, this area will lead with the best YouTube and room-backed matches.
                                                        </div>
                                                    )}
                                                </div>

                                                <CollapsiblePanel
                                                    label="Track Details"
                                                    title="Source details and overrides"
                                                    summary="Only open this when the main track flow is not enough."
                                                    open={trackAdvancedOpen}
                                                    onToggle={() => toggleSection(item.id, 'backing_advanced')}
                                                    badge={sourceMeta.label}
                                                    tone="amber"
                                                    compact
                                                >
                                                    <div className="rounded-xl bg-black/10 px-3 py-3">
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Current source</div>
                                                                <div className="mt-1 text-sm font-semibold text-white">{sourceMeta.label}</div>
                                                                <div className="mt-1 text-sm text-zinc-300">{hasSelectedBacking ? selectedBackingSummary : 'No track chosen yet.'}</div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap gap-4">
                                                            <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={item.backingPlan?.playbackReady === true} onChange={(e) => updateBackingPlan({ playbackReady: e.target.checked })} disabled={!safeOperatorCapabilities.canCurateMedia} />Playback ready</label>
                                                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Resolution: {item.backingPlan?.resolutionStatus || 'ready'}</div>
                                                        </div>
                                                    </div>
                                                        <div className="mt-3 space-y-3">
                                                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                                {BACKING_SOURCE_OPTIONS.map((option) => (
                                                                    <BackingSourceCard
                                                                        key={option.value}
                                                                        option={option}
                                                                        selected={sourceType === option.value}
                                                                        trusted={sourceType === option.value && isRunOfShowItemReady(item)}
                                                                        onSelect={() => {
                                                                            updateBackingPlan({ sourceType: option.value });
                                                                            if (mediaPicker.itemId === item.id) {
                                                                                setMediaPicker((prev) => ({
                                                                                    ...prev,
                                                                                    sourceType: option.value,
                                                                                    remoteResults: [],
                                                                                    loading: false,
                                                                                    error: ''
                                                                                }));
                                                                            }
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/10 px-3 py-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Alternate source picker</div>
                                                            <div className="mt-1 text-sm text-zinc-300">
                                                                {sourceType === 'manual_external'
                                                                    ? 'Manual external stays planning-only in v1.'
                                                                    : sourceType === 'canonical_default'
                                                                        ? 'Canonical default still needs a resolved track id or Apple fallback below.'
                                                                        : `Browse ${sourceMeta.title} matches for this performance and stamp the approved backing plan automatically.`}
                                                            </div>
                                                        </div>
                                                        {sourceType !== 'manual_external' && sourceType !== 'canonical_default' ? (
                                                            <ControlButton
                                                                tone="primary"
                                                                onClick={() => toggleMediaPicker(item)}
                                                                disabled={!safeOperatorCapabilities.canCurateMedia}
                                                                data-run-of-show-open-picker={item.id}
                                                            >
                                                                {mediaPicker.itemId === item.id ? 'Hide Picker' : `Browse ${sourceMeta.label}`}
                                                            </ControlButton>
                                                        ) : null}
                                                            </div>
                                                    {mediaPicker.itemId === item.id ? (
                                                        <div className="rounded-xl bg-cyan-500/6 p-3 space-y-3">
                                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                                <div>
                                                                    <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">Guided Selection</div>
                                                                    <div className="mt-1 text-sm text-cyan-50">Choose a result to auto-fill the backing plan for this performance.</div>
                                                                </div>
                                                                <div className="text-xs text-cyan-100/75">
                                                                    {pickerSourceType === 'apple_music'
                                                                        ? (appleMusicAuthorized ? 'Apple account connected' : 'Using iTunes catalog search')
                                                                        : pickerSourceType === 'youtube'
                                                                            ? 'Indexed host tracks first, then live search'
                                                                            : pickerSourceType === 'user_submitted'
                                                                                ? 'Approved submissions only'
                                                                                : 'Host-managed local assets'}
                                                                </div>
                                                            </div>
                                                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                                                <input
                                                                    aria-label="Search run of show media"
                                                                    value={mediaPicker.query}
                                                                    onChange={(e) => setMediaPicker((prev) => ({ ...prev, query: e.target.value }))}
                                                                    className={textInputClass}
                                                                    placeholder={buildMediaQuery(item) || 'Search media'}
                                                                />
                                                                <ControlButton onClick={() => setMediaPicker((prev) => ({ ...prev, query: buildMediaQuery(item) }))}>Use Song Query</ControlButton>
                                                            </div>
                                                            {mediaPicker.error ? <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{mediaPicker.error}</div> : null}
                                                            {mediaPicker.loading ? <div className="text-sm text-cyan-100/80">Loading {sourceMeta.title} results...</div> : null}
                                                            {pickerResults.length ? (
                                                                <div className="grid gap-3 lg:grid-cols-2">
                                                                    {pickerResults.map((option) => (
                                                                        <MediaPickerOption
                                                                            key={option.id}
                                                                            option={option}
                                                                            onSelect={() => applyMediaSelection(item, option)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="rounded-xl bg-black/10 px-3 py-3 text-sm text-zinc-400">
                                                                    {pickerSourceType === 'user_submitted'
                                                                        ? 'No approved submissions match yet. Approve a slot submission first, then you can reuse it here.'
                                                                        : pickerSourceType === 'local_file'
                                                                            ? 'No local assets matched this query.'
                                                                            : pickerSourceType === 'youtube'
                                                                                ? 'No indexed or live YouTube matches yet.'
                                                                                : 'No Apple catalog matches yet.'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                            <div className="grid gap-3 md:grid-cols-2">
                                                                <div><FieldLabel>Display Label</FieldLabel><input value={item.backingPlan?.label || ''} onChange={(e) => updateBackingPlan({ label: e.target.value })} disabled={!safeOperatorCapabilities.canCurateMedia} className={textInputClass} placeholder="What the host should see during the show" /></div>
                                                                <div className="rounded-xl bg-black/10 px-3 py-3 text-sm text-zinc-300">
                                                                    {sourceType === 'youtube'
                                                                        ? 'YouTube is the normal run-of-show lane. If the host picked it and it plays, the slot can run.'
                                                                        : sourceType === 'user_submitted'
                                                                            ? 'Submitted backing still needs explicit approval before automation will trust it.'
                                                                            : 'Use track details only for exceptions, imports, or fallback media.'}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-3">
                                                            {(sourceType === 'canonical_default' || sourceType === 'apple_music') ? (
                                                                <div className="grid gap-3 md:grid-cols-2">
                                                                    <div><FieldLabel>{sourceType === 'canonical_default' ? 'Canonical Track ID' : 'Apple Music ID'}</FieldLabel><input value={sourceType === 'canonical_default' ? (item.backingPlan?.trackId || '') : (item.backingPlan?.appleMusicId || '')} onChange={(e) => updateBackingPlan(sourceType === 'canonical_default' ? { trackId: e.target.value } : { appleMusicId: e.target.value })} className={textInputClass} /></div>
                                                                    <div><FieldLabel>{sourceType === 'canonical_default' ? 'Apple Fallback' : 'Track ID'}</FieldLabel><input value={sourceType === 'canonical_default' ? (item.backingPlan?.appleMusicId || '') : (item.backingPlan?.trackId || '')} onChange={(e) => updateBackingPlan(sourceType === 'canonical_default' ? { appleMusicId: e.target.value } : { trackId: e.target.value })} className={textInputClass} /></div>
                                                                </div>
                                                            ) : null}
                                                            {(sourceType === 'youtube' || sourceType === 'user_submitted') ? (
                                                                <div className="grid gap-3 md:grid-cols-2">
                                                                    <div><FieldLabel>Media URL</FieldLabel><input value={item.backingPlan?.mediaUrl || ''} onChange={(e) => updateBackingPlan({ mediaUrl: e.target.value })} className={textInputClass} /></div>
                                                                    <div><FieldLabel>{sourceType === 'youtube' ? 'YouTube ID' : 'Submitted Backing ID'}</FieldLabel><input value={sourceType === 'youtube' ? (item.backingPlan?.youtubeId || '') : (item.backingPlan?.submittedBackingId || '')} onChange={(e) => updateBackingPlan(sourceType === 'youtube' ? { youtubeId: e.target.value } : { submittedBackingId: e.target.value })} className={textInputClass} /></div>
                                                                </div>
                                                            ) : null}
                                                            {sourceType === 'local_file' ? (
                                                                <div className="grid gap-3 md:grid-cols-2">
                                                                    <div><FieldLabel>Local Asset ID</FieldLabel><input value={item.backingPlan?.localAssetId || ''} onChange={(e) => updateBackingPlan({ localAssetId: e.target.value })} className={textInputClass} /></div>
                                                                    <div><FieldLabel>Fallback Media URL</FieldLabel><input value={item.backingPlan?.mediaUrl || ''} onChange={(e) => updateBackingPlan({ mediaUrl: e.target.value })} className={textInputClass} /></div>
                                                                </div>
                                                            ) : null}
                                                            </div>
                                                        </div>
                                                            {sourceType === 'manual_external' ? <div className="rounded-xl bg-zinc-500/10 px-3 py-2 text-sm text-zinc-300">Manual external sources are planning-only in v1 and will not auto-run.</div> : null}
                                                </CollapsiblePanel>
                                                </>
                                                ) : null}

                                                {item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? (
                                                        <CollapsiblePanel
                                                            label="Singer Picks"
                                                            title="More singer submissions"
                                                            summary="Use this when you need more than the top singer picks shown in the prep inbox."
                                                        open={pendingSubmissionsOpen}
                                                        onToggle={() => toggleSection(item.id, 'pending_submissions', pendingCount > 0)}
                                                        badge={`${pendingCount} pending`}
                                                        tone="amber"
                                                        compact
                                                    >
                                                        {itemSubmissions.length === 0 ? <div className="text-sm text-zinc-400">No submissions for this slot yet.</div> : itemSubmissions.map((submission) => (
                                                            <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                                                <div>
                                                                    <div className="text-sm font-bold text-white">{submission.songTitle || 'Untitled Song'}</div>
                                                                <div className="text-xs text-zinc-400">{submission.displayName || 'Singer'}{submission.artistName ? ` · ${submission.artistName}` : ''}{` · ${submission.submissionStatus || 'pending'}`}</div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <ControlButton tone="success" disabled={!safeOperatorCapabilities.canReviewSubmissions} onClick={() => handleSubmissionDecision(submission.id, 'approved', item)}>Approve + Assign</ControlButton>
                                                                    <ControlButton tone="danger" disabled={!safeOperatorCapabilities.canReviewSubmissions} onClick={() => onReviewSubmission?.(submission.id, 'declined')}>Decline</ControlButton>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        </CollapsiblePanel>
                                                    ) : null}
                                                    <CollapsiblePanel
                                                        label="Planning Defaults"
                                                        title="Timeline defaults and notes"
                                                        summary="These define the planned setup for this scene. Use the live strip for temporary in-show changes."
                                                        open={sceneSettingsOpen}
                                                        onToggle={() => toggleSection(item.id, 'scene_settings')}
                                                        badge={getAdvanceModeLabel(item)}
                                                        tone="violet"
                                                        compact
                                                    >
                                                        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                                                            <span className="font-semibold text-white">Planning surface:</span> these values describe tonight&apos;s intended scene setup. Live adjustments should change the running show without rewriting the defaults here.
                                                        </div>
                                                        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                            <div className="md:col-span-2">
                                                                <FieldLabel>Title</FieldLabel>
                                                                <input value={item.title || ''} onChange={(e) => onUpdateItem?.(item.id, { title: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} />
                                                            </div>
                                                            <div>
                                                                <FieldLabel>Visibility</FieldLabel>
                                                                <SelectControl value={item.visibility || 'public'} onChange={(e) => onUpdateItem?.(item.id, { visibility: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow}><option value="public">Public</option><option value="private">Private</option></SelectControl>
                                                            </div>
                                                            <div>
                                                                <FieldLabel>Automation</FieldLabel>
                                                                <SelectControl value={item.automationMode || 'auto'} onChange={(e) => onUpdateItem?.(item.id, { automationMode: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow}><option value="auto">Auto</option><option value="manual">Manual</option></SelectControl>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                                            <div>
                                                                <FieldLabel>Planned Duration Sec</FieldLabel>
                                                                <input
                                                                    type="number"
                                                                    value={item.plannedDurationSec || 0}
                                                                    onChange={(e) => onUpdateItem?.(item.id, {
                                                                        plannedDurationSec: Number(e.target.value || 0),
                                                                        plannedDurationSource: 'manual'
                                                                    })}
                                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                                    className={textInputClass}
                                                                />
                                                            </div>
                                                            <div><FieldLabel>Planned Start</FieldLabel><input type="datetime-local" value={item.startsAtMs ? new Date(item.startsAtMs).toISOString().slice(0, 16) : ''} onChange={(e) => onUpdateItem?.(item.id, { startsAtMs: e.target.value ? new Date(e.target.value).getTime() : 0 })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                            <div><FieldLabel>Notes</FieldLabel><input value={item.notes || ''} onChange={(e) => onUpdateItem?.(item.id, { notes: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                        </div>
                                                        <div className="mt-3">
                                                            <RunOfShowMomentCueFields
                                                                item={item}
                                                                onUpdateItem={onUpdateItem}
                                                                disabled={!safeOperatorCapabilities.canEditFlow}
                                                            />
                                                        </div>
                                                        {!repairModeActive ? (
                                                            <div className="mt-3 rounded-2xl bg-black/15 px-4 py-3 text-sm text-zinc-300">
                                                                <span className="font-semibold text-white">Performance timing:</span>{' '}
                                                                {Number(item?.backingPlan?.durationSec || 0) > 0
                                                                    ? `the timeline keeps your planned estimate at ${formatDurationSec(item.plannedDurationSec) || `${Math.max(0, Number(item.plannedDurationSec || 0))}s`}, but the live stage runtime follows the selected backing at ${formatDurationSec(item?.backingPlan?.durationSec) || `${Math.max(0, Number(item?.backingPlan?.durationSec || 0))}s`}.`
                                                                    : 'until a backing track is attached, the live stage runtime falls back to this planned estimate.'}
                                                            </div>
                                                        ) : null}
                                                    </CollapsiblePanel>
                                                </div>
                                            </div>
                                            ) : null}

                                        {supportsPresentationScene ? (
                                            <CollapsiblePanel
                                                label="Public Scene"
                                                title="What audience sees and how it runs"
                                                summary="This is the canonical editing lane for public scenes: visuals, sound, progression, and room behavior."
                                                open={presentationOpen}
                                                onToggle={() => toggleSection(item.id, 'presentation_scene')}
                                                badge={presentationPlan?.headline || matchedTakeoverPreset?.label || 'Public scene'}
                                                tone="violet"
                                                compact
                                            >
                                                <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-300">
                                                    <span className="font-semibold text-white">One place on purpose:</span> plan the public scene here, then use live controls during the show for temporary pacing changes instead of reopening editor defaults.
                                                </div>
                                                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">What Audience Sees</div>
                                                    <div className="mt-1 text-sm text-zinc-300">Choose the public-TV treatment, headline, and any visual exception for this scene.</div>
                                                </div>
                                                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Scene Style</div>
                                                            <div className="mt-1 text-sm text-zinc-300">Choose the mood for this takeover. It sets the TV look and the default cue behavior together.</div>
                                                        </div>
                                                        {matchedTakeoverPreset ? (
                                                            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
                                                                {matchedTakeoverPreset?.label}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-3 grid gap-2 lg:grid-cols-3">
                                                        {TAKEOVER_STYLE_PRESETS.map((preset) => {
                                                            const active = matchedTakeoverPreset?.id === preset.id;
                                                            const toneClass = preset.tone === 'amber'
                                                                ? 'border-amber-300/25 bg-amber-500/10 text-amber-100'
                                                                : preset.tone === 'rose'
                                                                    ? 'border-rose-300/25 bg-rose-500/10 text-rose-100'
                                                                    : preset.tone === 'violet'
                                                                        ? 'border-violet-300/25 bg-violet-500/10 text-violet-100'
                                                                        : preset.tone === 'fuchsia'
                                                                            ? 'border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100'
                                                                            : 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100';
                                                            return (
                                                                <button
                                                                    key={preset.id}
                                                                    type="button"
                                                                    onClick={() => onUpdateItem?.(item.id, buildTakeoverPresetUpdate(item, preset.id))}
                                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                                    className={`rounded-2xl border px-3 py-3 text-left transition ${active ? `${toneClass} shadow-[0_0_0_1px_rgba(255,255,255,0.08)]` : 'border-white/10 bg-black/20 text-zinc-200 hover:border-white/18 hover:bg-white/6'}`}
                                                                >
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${active ? 'border-white/18 bg-black/15 text-white' : 'border-white/10 bg-black/20 text-zinc-200'}`}>
                                                                            <i className={`fa-solid ${preset.icon}`}></i>
                                                                        </span>
                                                                        {active ? (
                                                                            <span className="rounded-full border border-white/15 bg-black/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
                                                                                Active
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                    <div className="mt-2 text-sm font-semibold text-white">{preset.label}</div>
                                                                    <div className="mt-1 text-xs text-current/80">{preset.detail}</div>
                                                                    <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-current/70">
                                                                        {preset.soundtrackHint}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div><FieldLabel>Headline</FieldLabel><input value={presentationPlan?.headline || ''} onChange={(e) => updatePresentationPlan({ headline: e.target.value })} className={textInputClass} /></div>
                                                    <div><FieldLabel>Subhead</FieldLabel><input value={presentationPlan?.subhead || ''} onChange={(e) => updatePresentationPlan({ subhead: e.target.value })} className={textInputClass} /></div>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={presentationPlan?.publicTvTakeoverEnabled === true} onChange={(e) => updatePresentationPlan({ publicTvTakeoverEnabled: e.target.checked })} />Public TV takeover</label>
                                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={soundtrackControlsOpen || soundtrackConfigured} onChange={(e) => setPresentationSoundtrackEnabled(e.target.checked)} />Takeover soundtrack</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSection(item.id, 'presentation_custom_overrides', hasCustomPresentationOverrides)}
                                                        disabled={!safeOperatorCapabilities.canEditFlow}
                                                        className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${presentationCustomOverridesOpen ? 'border-violet-300/28 bg-violet-500/10 text-violet-100' : 'border-white/10 bg-black/25 text-zinc-300'}`}
                                                    >
                                                        {presentationCustomOverridesOpen ? 'Hide Visual Overrides' : 'Visual Overrides'}
                                                    </button>
                                                </div>
                                                {presentationCustomOverridesOpen ? (
                                                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Custom Visual Overrides</div>
                                                                <div className="mt-1 text-sm text-zinc-300">Only use this when the preset grid cannot describe the exact TV treatment you need.</div>
                                                            </div>
                                                            <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">Advanced</span>
                                                        </div>
                                                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                                                            <div><FieldLabel>Takeover Scene</FieldLabel><input value={presentationPlan?.takeoverScene || ''} onChange={(e) => updatePresentationPlan({ takeoverScene: e.target.value })} className={textInputClass} /></div>
                                                            <div><FieldLabel>Background Media</FieldLabel><input value={presentationPlan?.backgroundMedia || ''} onChange={(e) => updatePresentationPlan({ backgroundMedia: e.target.value })} className={textInputClass} /></div>
                                                            <div><FieldLabel>Accent Theme</FieldLabel><input value={presentationPlan?.accentTheme || ''} onChange={(e) => updatePresentationPlan({ accentTheme: e.target.value })} className={textInputClass} /></div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">How It Moves Forward</div>
                                                    <div className="mt-1 text-sm text-zinc-300">Set the planned progression rule for this scene. Live pacing changes should happen from the sticky run-of-show strip after the show starts.</div>
                                                </div>
                                                <RunOfShowAdvanceModePicker
                                                    item={item}
                                                    onUpdateItem={onUpdateItem}
                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                />
                                                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">How It Sounds</div>
                                                    <div className="mt-1 text-sm text-zinc-300">Attach takeover audio or cue punctuation only when this scene needs it.</div>
                                                </div>
                                                {soundtrackControlsOpen || soundtrackConfigured ? (
                                                    <RunOfShowTakeoverSoundtrackEditor
                                                        presentationPlan={presentationPlan}
                                                        audioPlan={audioPlan}
                                                        matchedTakeoverPreset={matchedTakeoverPreset}
                                                        customizeOpen={soundtrackCustomizeOpen}
                                                        onToggleCustomize={() => toggleSection(item.id, 'presentation_soundtrack_customize', hasCustomSoundtrackOptions)}
                                                        onUpdatePresentationPlan={updatePresentationPlan}
                                                        onUpdateAudioPlan={updateAudioPlan}
                                                        disabled={!safeOperatorCapabilities.canEditFlow}
                                                    />
                                                ) : null}
                                                <div className="mt-3">
                                                    <RunOfShowMomentCueFields
                                                        item={item}
                                                        onUpdateItem={onUpdateItem}
                                                        disabled={!safeOperatorCapabilities.canEditFlow}
                                                    />
                                                </div>
                                                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">What The Room Does</div>
                                                    <div className="mt-1 text-sm text-zinc-300">Choose the screen, room mode, and any scene-specific room behavior that should accompany the public scene.</div>
                                                </div>
                                                <RunOfShowRoomBehaviorEditor
                                                    item={item}
                                                    onUpdateItem={onUpdateItem}
                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                    customizeOpen={roomMomentCustomizeOpen}
                                                    onToggleCustomize={() => toggleSection(item.id, 'room_moment_customize', hasCustomRoomOptions)}
                                                />
                                                <div className="rounded-2xl border border-amber-300/18 bg-amber-500/8 px-3 py-3 text-sm text-amber-100/90">
                                                    <span className="font-semibold text-white">Live-only overrides:</span> once this scene is active, use the run-of-show live strip for temporary pacing changes instead of editing these planning defaults.
                                                </div>
                                            </CollapsiblePanel>
                                        ) : null}

                                        {(item.type === 'trivia_break' || item.type === 'would_you_rather_break' || item.type === 'game_break') ? (
                                            <CollapsiblePanel
                                                label="Interactive Scene"
                                                title={item.type === 'game_break' ? 'Prompt and answer settings' : 'Quick-launch prompt builder'}
                                                summary={item.type === 'game_break' ? 'Only open this when you are tuning the actual question or game payload.' : 'Use the same audience-friendly question setup you expect from the live vote launchers.'}
                                                open={interactiveOpen}
                                                onToggle={() => toggleSection(item.id, 'interactive_scene')}
                                                badge={item.modeLaunchPlan?.modeKey || 'Optional'}
                                                tone="violet"
                                                compact
                                            >
                                                {item.type === 'trivia_break' ? (
                                                    <div className="rounded-2xl border border-amber-300/18 bg-amber-500/8 px-3 py-3 text-sm text-amber-100/90">
                                                        <span className="font-semibold text-white">Legacy scene type:</span> Pop Trivia now runs as a live in-song host toggle, not a planned run-of-show slot. Keep this only if you still need the old break behavior.
                                                    </div>
                                                ) : null}
                                                {item.type === 'game_break' ? (
                                                    <>
                                                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-300">
                                                            <span className="font-semibold text-white">What this changes:</span> Mode Key decides which quick-play experience launches, Prompt is what the crowd sees on TV and phone, and the options/correct answer control how the audience round resolves.
                                                        </div>
                                                        <div className="rounded-2xl border border-amber-300/18 bg-amber-500/8 px-3 py-3 text-sm text-amber-100/90">
                                                            Use this for specialty game modes like Bingo, Team Pong, Bracket, Selfie Challenge, or Doodle-oke. For a quick room vote, use the dedicated Would You Rather scene so the host gets the right reveal flow.
                                                        </div>
                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <div><FieldLabel>Mode Key</FieldLabel><input value={item.modeLaunchPlan?.modeKey || ''} onChange={(e) => onUpdateItem?.(item.id, { modeLaunchPlan: { ...(item.modeLaunchPlan || {}), modeKey: e.target.value } })} className={textInputClass} /></div>
                                                            <div className="md:col-span-2"><FieldLabel>Prompt</FieldLabel><input value={item.modeLaunchPlan?.launchConfig?.question || ''} onChange={(e) => onUpdateItem?.(item.id, { modeLaunchPlan: { ...(item.modeLaunchPlan || {}), launchConfig: { ...(item.modeLaunchPlan?.launchConfig || {}), question: e.target.value } } })} className={textInputClass} /></div>
                                                        </div>
                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <div className="md:col-span-2"><FieldLabel>Options (comma separated)</FieldLabel><input value={optionsCsv} onChange={(e) => onUpdateItem?.(item.id, { modeLaunchPlan: { ...(item.modeLaunchPlan || {}), launchConfig: { ...(item.modeLaunchPlan?.launchConfig || {}), optionsCsv: e.target.value } } })} className={textInputClass} /></div>
                                                            <div><FieldLabel>Correct Index</FieldLabel><input type="number" value={item.modeLaunchPlan?.launchConfig?.correctIndex ?? 0} onChange={(e) => onUpdateItem?.(item.id, { modeLaunchPlan: { ...(item.modeLaunchPlan || {}), launchConfig: { ...(item.modeLaunchPlan?.launchConfig || {}), correctIndex: Number(e.target.value || 0) } } })} className={textInputClass} /></div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-300">
                                                            <span className="font-semibold text-white">What this changes:</span> This is the run-of-show version of quick launch. Pick from the built-in bank or tune the prompt manually, then the host can reveal the answer or results from the live run-of-show bar.
                                                        </div>
                                                        <div className="grid gap-3 md:grid-cols-4">
                                                            <div>
                                                                <FieldLabel>Mode</FieldLabel>
                                                                <input
                                                                    value={item.type === 'trivia_break' ? 'Trivia' : 'Would You Rather'}
                                                                    className={`${textInputClass} text-zinc-300`}
                                                                    disabled
                                                                />
                                                            </div>
                                                            <div>
                                                                <FieldLabel>Round Length (Sec)</FieldLabel>
                                                                <input
                                                                    type="number"
                                                                    min="5"
                                                                    max="180"
                                                                    value={Math.max(5, Number(item.modeLaunchPlan?.launchConfig?.durationSec || item.plannedDurationSec || 20))}
                                                                    onChange={(e) => updateInteractiveLaunchConfig(item, { durationSec: Math.max(5, Number(e.target.value || 0) || 20) })}
                                                                    className={textInputClass}
                                                                />
                                                            </div>
                                                            <div>
                                                                <FieldLabel>Reward Points</FieldLabel>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="500"
                                                                    value={Math.max(0, Number(item.modeLaunchPlan?.launchConfig?.points ?? (item.type === 'trivia_break' ? 100 : 50)))}
                                                                    onChange={(e) => updateInteractiveLaunchConfig(item, { points: Math.max(0, Number(e.target.value || 0)) })}
                                                                    className={textInputClass}
                                                                />
                                                            </div>
                                                            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-200">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.modeLaunchPlan?.launchConfig?.autoReveal !== false}
                                                                    onChange={(e) => updateInteractiveLaunchConfig(item, { autoReveal: e.target.checked })}
                                                                />
                                                                <span>Auto-reveal at timer end</span>
                                                            </label>
                                                        </div>
                                                        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div>
                                                                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{item.type === 'trivia_break' ? 'Question Bank' : 'Prompt Bank'}</div>
                                                                        <div className="mt-1 text-sm text-zinc-300">{item.type === 'trivia_break' ? 'Browse built-in trivia and drop it into this scene.' : 'Browse built-in WYR prompts and drop one into this scene.'}</div>
                                                                    </div>
                                                                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                                                        Quick Launch
                                                                    </span>
                                                                </div>
                                                                <input
                                                                    value={interactiveLibraryFilter}
                                                                    onChange={(e) => setInteractiveLibraryFilter(e.target.value)}
                                                                    placeholder={item.type === 'trivia_break' ? 'Filter trivia prompts' : 'Filter WYR prompts'}
                                                                    className={textInputClass}
                                                                />
                                                                <select
                                                                    value={interactiveLibrarySelection}
                                                                    onChange={(e) => setInteractiveLibrarySelection(e.target.value)}
                                                                    className={selectInputClass}
                                                                >
                                                                    <option value="">{item.type === 'trivia_break' ? 'Select a trivia question' : 'Select a WYR prompt'}</option>
                                                                    {focusedInteractiveBankEntries.map((entry) => (
                                                                        <option key={entry.id} value={entry.id}>{entry.q}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <ControlButton
                                                                        tone="primary"
                                                                        disabled={!interactiveLibrarySelection}
                                                                        onClick={() => applyInteractiveBankEntry(item, focusedInteractiveBankEntries.find((entry) => entry.id === interactiveLibrarySelection))}
                                                                    >
                                                                        Use Selected
                                                                    </ControlButton>
                                                                    <ControlButton
                                                                        disabled={!focusedInteractiveBankEntries.length}
                                                                        onClick={() => applyRandomInteractiveBankEntry(item)}
                                                                    >
                                                                        Random
                                                                    </ControlButton>
                                                                </div>
                                                                {interactiveLibrarySelection ? (
                                                                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                                                                        {(() => {
                                                                            const selectedEntry = focusedInteractiveBankEntries.find((entry) => entry.id === interactiveLibrarySelection);
                                                                            if (!selectedEntry) return 'Pick a bank item to preview it here.';
                                                                            if (item.type === 'trivia_break') {
                                                                                return (
                                                                                    <div className="space-y-2">
                                                                                        <div className="font-semibold text-white">{selectedEntry.q}</div>
                                                                                        <div className="text-zinc-400">Correct: {selectedEntry.correct}</div>
                                                                                        <div className="text-zinc-500">Distractors: {[selectedEntry.w1, selectedEntry.w2, selectedEntry.w3].filter(Boolean).join(' | ')}</div>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return (
                                                                                <div className="space-y-2">
                                                                                    <div className="font-semibold text-white">{selectedEntry.q}</div>
                                                                                    <div className="text-zinc-400">A: {selectedEntry.a}</div>
                                                                                    <div className="text-zinc-400">B: {selectedEntry.b}</div>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                                                                <div>
                                                                    <FieldLabel>{item.type === 'trivia_break' ? 'Trivia Question' : 'Prompt'}</FieldLabel>
                                                                    <input
                                                                        value={item.modeLaunchPlan?.launchConfig?.question || ''}
                                                                        onChange={(e) => updateInteractiveLaunchConfig(item, { question: e.target.value })}
                                                                        className={textInputClass}
                                                                        placeholder={item.type === 'trivia_break' ? 'What question should the room answer?' : 'What should the room vote on?'}
                                                                    />
                                                                </div>
                                                                {item.type === 'trivia_break' ? (
                                                                    <>
                                                                        <div className="grid gap-3 md:grid-cols-2">
                                                                            {Array.from({ length: 4 }).map((_, optionIndex) => {
                                                                                const currentOptions = parseLaunchConfigOptions(item.modeLaunchPlan?.launchConfig || {});
                                                                                while (currentOptions.length < 4) currentOptions.push('');
                                                                                return (
                                                                                    <div key={`${item.id}_trivia_option_${optionIndex}`}>
                                                                                        <FieldLabel>Answer {optionIndex + 1}</FieldLabel>
                                                                                        <input
                                                                                            value={currentOptions[optionIndex] || ''}
                                                                                            onChange={(e) => {
                                                                                                const nextOptions = [...currentOptions];
                                                                                                nextOptions[optionIndex] = e.target.value;
                                                                                                updateInteractiveLaunchConfig(item, { options: nextOptions });
                                                                                            }}
                                                                                            className={textInputClass}
                                                                                            placeholder={optionIndex === 0 ? 'Correct answer or strong option' : `Distractor ${optionIndex}`}
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <div className="grid gap-3 md:grid-cols-2">
                                                                            <div>
                                                                                <FieldLabel>Correct Answer</FieldLabel>
                                                                                <select
                                                                                    value={Math.max(0, Number(item.modeLaunchPlan?.launchConfig?.correctIndex || 0))}
                                                                                    onChange={(e) => updateInteractiveLaunchConfig(item, { correctIndex: Math.max(0, Number(e.target.value || 0)) })}
                                                                                    className={selectInputClass}
                                                                                >
                                                                                    {Array.from({ length: 4 }).map((_, optionIndex) => (
                                                                                        <option key={`${item.id}_correct_${optionIndex}`} value={optionIndex}>
                                                                                            Answer {optionIndex + 1}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-300">
                                                                                Trivia pays the correct answer side. Reveal from the run-of-show bar once voting feels done.
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="grid gap-3 md:grid-cols-2">
                                                                            {['Choice A', 'Choice B'].map((label, optionIndex) => {
                                                                                const currentOptions = parseLaunchConfigOptions(item.modeLaunchPlan?.launchConfig || {});
                                                                                while (currentOptions.length < 2) currentOptions.push('');
                                                                                return (
                                                                                    <div key={`${item.id}_wyr_option_${optionIndex}`}>
                                                                                        <FieldLabel>{label}</FieldLabel>
                                                                                        <input
                                                                                            value={currentOptions[optionIndex] || ''}
                                                                                            onChange={(e) => {
                                                                                                const nextOptions = [...currentOptions];
                                                                                                nextOptions[optionIndex] = e.target.value;
                                                                                                updateInteractiveLaunchConfig(item, { options: nextOptions });
                                                                                            }}
                                                                                            className={textInputClass}
                                                                                            placeholder={label}
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-300">
                                                                            WYR has no correct answer. When the host reveals results, the majority side wins the reward points for this scene.
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-3">
                                                            <RunOfShowMomentCueFields
                                                                item={item}
                                                                onUpdateItem={onUpdateItem}
                                                                disabled={!safeOperatorCapabilities.canEditFlow}
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </CollapsiblePanel>
                                        ) : null}

                                        <div className="flex flex-wrap justify-between gap-3">
                                            <div className="flex flex-wrap gap-2">
                                                {repairModeActive ? (
                                                    <ControlButton onClick={() => setRepairFocus(null)}>
                                                        Back To Builder
                                                    </ControlButton>
                                                ) : (
                                                    <>
                                                        <ControlButton disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onMoveItem?.(item.id, -1)}>Move Up</ControlButton>
                                                        <ControlButton disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onMoveItem?.(item.id, 1)}>Move Down</ControlButton>
                                                        <ControlButton disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onDuplicateItem?.(item.id)}>Duplicate</ControlButton>
                                                        <ControlButton tone="danger" disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onDeleteItem?.(item.id)}>Archive</ControlButton>
                                                    </>
                                                )}
                                            </div>
                                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Queue state: {item.queueLinkState || 'unlinked'}</div>
                                        </div>
                                    </div>
                                ) : null}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )) : null}

            {studioMode === 'review' ? (
                <div className="grid gap-3 lg:grid-cols-2">
                    {reviewItems.length ? reviewItems.map((item) => {
                        const blockers = formatChecklist(readinessById[item.id]?.blockers);
                        const pendingCount = pendingCountsById[item.id] || 0;
                        return (
                            <article key={`review-${item.id}`} className={`${surfaceClass} p-4`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{getRunOfShowItemLabel(item.type)}</div>
                                        <div className="mt-1 text-lg font-black text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                                        <div className="mt-1 text-sm text-zinc-400">{itemSummary(item)}</div>
                                        <div className="mt-2 text-xs text-zinc-500">Performer, song, and backing edits live in the build inspector.</div>
                                    </div>
                                    <button type="button" onClick={() => openItem(item.id)} className="rounded-full border border-cyan-300/35 bg-cyan-500/12 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                                        Open In Builder
                                    </button>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {pendingCount > 0 ? (
                                        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
                                            {pendingCount} pending approval{pendingCount === 1 ? '' : 's'}
                                        </span>
                                    ) : null}
                                    {blockers.length ? blockers.map((blocker) => (
                                        <span key={`${item.id}-${blocker.key || blocker.label}`} className="rounded-full border border-rose-300/30 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-rose-100">
                                            {blocker.label || 'Needs attention'}
                                        </span>
                                    )) : (
                                        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                                            Review ready
                                        </span>
                                    )}
                                </div>
                            </article>
                        );
                    }) : (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-zinc-400">
                            No approvals or blockers need review right now.
                        </div>
                    )}
                </div>
            ) : null}
        </section>
    );
}
