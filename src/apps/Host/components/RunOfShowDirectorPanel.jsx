import React, { useEffect, useMemo, useState } from 'react';
import { callFunction } from '../../../lib/firebase';
import {
    RUN_OF_SHOW_BLOCKED_ACTION_POLICIES,
    RUN_OF_SHOW_DEFAULT_AUTOMATION_POLICIES,
    RUN_OF_SHOW_ITEM_TYPES,
    RUN_OF_SHOW_LATE_BLOCK_POLICIES,
    RUN_OF_SHOW_NO_SHOW_POLICIES,
    RUN_OF_SHOW_OPERATOR_ROLES,
    RUN_OF_SHOW_PERFORMER_MODES,
    RUN_OF_SHOW_QUEUE_DIVERGENCE_POLICIES,
    createRunOfShowItem,
    getRunOfShowBlockedActionLabel,
    getNextRunOfShowItem,
    getRunOfShowItemReadiness,
    getRunOfShowItemLabel,
    getRunOfShowLiveItem,
    getRunOfShowOperatingHint,
    getRunOfShowStagedItem,
    isRunOfShowItemReady
} from '../../../lib/runOfShowDirector';

const ITEM_TYPE_OPTIONS = RUN_OF_SHOW_ITEM_TYPES.map((type) => ({ value: type, label: getRunOfShowItemLabel(type) }));
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
    { value: 'trivia_break', label: 'Trivia Beat', icon: 'fa-lightbulb', detail: 'Crowd participation moment' },
    { value: 'intermission', label: 'Intermission', icon: 'fa-martini-glass-citrus', detail: 'Reset the room' },
    { value: 'closing', label: 'Closing', icon: 'fa-flag-checkered', detail: 'End the night cleanly' },
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
                subhead: 'Lights up, room opens, and the first singer hits the board.',
                accentTheme: 'fuchsia'
            }
        }
    },
    {
        id: 'pop_trivia',
        label: 'Pop Trivia',
        subtitle: 'Drop in a live trivia round between songs',
        icon: 'fa-lightbulb',
        tone: 'violet',
        type: 'trivia_break',
        chips: ['Trivia', 'Audience phones'],
        overrides: {
            title: 'Pop Trivia Break',
            plannedDurationSec: 75,
            modeLaunchPlan: {
                modeKey: 'trivia_pop',
                launchConfig: {
                    question: 'Which movie musical deserves the loudest singalong tonight?',
                    optionsCsv: 'Grease, Mamma Mia!, Moulin Rouge!, The Greatest Showman',
                    correctIndex: 3
                }
            },
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                takeoverScene: 'trivia_break',
                headline: 'Phones vote. TV reveals.',
                subhead: 'One quick trivia pulse keeps the room engaged between performances.',
                accentTheme: 'violet'
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
const TIMELINE_LANE_ORDER = Object.freeze(['master', 'performance', 'host', 'audience']);
const TIMELINE_LANE_META = Object.freeze({
    master: { label: 'Master Sequence', detail: 'Everything in running order', tone: 'cyan' },
    performance: { label: 'Singer Slots', detail: 'Performance clips only', tone: 'fuchsia' },
    host: { label: 'Host Moments', detail: 'Intro, announcements, closing', tone: 'amber' },
    audience: { label: 'Audience Beats', detail: 'Trivia, games, buffers, breaks', tone: 'emerald' },
});

const textInputClass = 'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none';
const selectInputClass = `${textInputClass} appearance-none pr-10`;
const surfaceClass = 'rounded-3xl border border-white/10 bg-black/25';
const miniSurfaceClass = 'rounded-2xl border border-white/10 bg-black/20';
const launchConfigToCsv = (cfg = {}) => Array.isArray(cfg?.options) ? cfg.options.join(', ') : String(cfg?.optionsCsv || '').trim();
const FieldLabel = ({ children }) => <label className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{children}</label>;
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
    if (tone === 'rose') return active ? 'border-rose-300/45 bg-rose-500/15 text-rose-50' : 'border-rose-300/18 bg-rose-500/8 text-rose-100';
    if (tone === 'amber') return active ? 'border-amber-300/45 bg-amber-500/15 text-amber-50' : 'border-amber-300/18 bg-amber-500/8 text-amber-100';
    if (tone === 'violet') return active ? 'border-violet-300/45 bg-violet-500/15 text-violet-50' : 'border-violet-300/18 bg-violet-500/8 text-violet-100';
    return active ? 'border-zinc-300/45 bg-zinc-500/15 text-zinc-50' : 'border-white/10 bg-white/5 text-zinc-200';
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
const uidListToCsv = (entries = []) => (Array.isArray(entries) ? entries : []).filter(Boolean).join(', ');
const csvToUidList = (value = '') => String(value || '').split(',').map((entry) => String(entry || '').trim()).filter(Boolean);
const getItemVisual = (type = '') => ITEM_VISUALS[String(type || '').trim().toLowerCase()] || { icon: 'fa-layer-group', tone: 'from-zinc-500/20 to-zinc-400/10', chip: 'border-white/10 bg-white/5 text-zinc-200' };
const roleTone = (role = '') => {
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
const distributeInsertions = (count = 0, total = 0) => {
    if (!count || !total) return [];
    return Array.from({ length: count }, (_, index) => Math.max(1, Math.min(total, Math.round(((index + 1) * total) / (count + 1)))));
};
const buildInteractiveType = (format = '', index = 0, interactionLevel = 'moderate') => {
    if (format === 'competition') return 'announcement';
    if (format === 'fundraiser') return index % 2 === 0 ? 'announcement' : 'trivia_break';
    if (interactionLevel === 'low') return 'announcement';
    return index % 2 === 0 ? 'trivia_break' : 'game_break';
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
    return <button type="button" {...props} className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] disabled:opacity-40 ${toneClass} ${className}`}>{children}</button>;
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
                className="flex w-full items-center justify-between gap-3 text-left"
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
    <article className={`${surfaceClass} p-4`}>
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

const OpsBoardCard = ({ label, item, readiness, emptyLabel, children, actionLabel, actionTone, onAction, onFocus }) => (
    <article className={`${surfaceClass} p-4`} aria-label={`${label} run of show card`}>
        <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">{label}</div>
            {item ? <button type="button" onClick={() => onFocus?.(item.id)} className="text-[10px] uppercase tracking-[0.18em] text-cyan-200 hover:text-white">Focus item</button> : null}
        </div>
        {item ? (
            <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(item.status)}`}>{item.status}</span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">{getRunOfShowItemLabel(item.type)}</span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{item.automationMode}</span>
                </div>
                <div className="text-lg font-bold text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                <div className="text-sm text-zinc-300">{itemSummary(item)}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                    <div className={`${miniSurfaceClass} px-3 py-2`}>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Clock</div>
                        <div className="mt-1 text-sm font-semibold text-white">{formatStart(item.startsAtMs)}</div>
                    </div>
                    <div className={`${miniSurfaceClass} px-3 py-2`}>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Duration</div>
                        <div className="mt-1 text-sm font-semibold text-white">{Math.max(0, Number(item.plannedDurationSec || 0))} sec</div>
                    </div>
                </div>
                <ReadinessPanel readiness={readiness} compact />
                {children}
                {actionLabel ? <ControlButton tone={actionTone} onClick={onAction}>{actionLabel}</ControlButton> : null}
            </div>
        ) : <div className="mt-3 text-sm text-zinc-400">{emptyLabel}</div>}
    </article>
);

const UtilityDrawer = ({ eyebrow, title, summary, open = false, onToggle, children, badge = '' }) => (
    <article className={`${surfaceClass} p-4`}>
        <CollapsiblePanel
            label={eyebrow}
            title={title}
            summary={summary}
            open={open}
            onToggle={onToggle}
            badge={badge}
            tone="cyan"
        >
            {children}
        </CollapsiblePanel>
    </article>
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
    <article className={`${surfaceClass} p-4`}>
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
                                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Mode</div>
                                            <div className="mt-1 text-sm font-semibold text-white">{item.automationMode || 'auto'}</div>
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
    onAddItem,
    onAddScenePack,
    onToggleGenerator,
    generatorOpen = false,
    getPrimaryAction,
    dragState = null,
    onDragStart,
    onDragEnd,
    onDragTarget,
    onDropItem,
}) => {
    const segments = buildTimelineSegments(items);
    const activeSegment = segments.find((entry) => entry.item.id === (liveItemId || stagedItemId || currentItemId || nextItemId)) || segments[0] || null;
    const activePlayheadPct = activeSegment ? Math.min(98, Math.max(1, activeSegment.startPct)) : 0;
    const tickMarks = [0, 25, 50, 75, 100];
    return (
        <article className={`${surfaceClass} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Timeline Studio</div>
                    <div className="mt-1 text-sm text-zinc-300">Add scenes from the clip bin, drag clips across the night, then open the inspector only for the scene you want to refine.</div>
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
            <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                {QUICK_ADD_SCENE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        disabled={!canEditFlow}
                        onClick={() => onAddItem?.(option.value)}
                        className="rounded-[22px] border border-white/10 bg-black/25 px-3 py-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-500/10 disabled:opacity-40"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-cyan-100">
                                <i className={`fa-solid ${option.icon}`}></i>
                            </div>
                            <span className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-300">Add</span>
                        </div>
                        <div className="mt-3 text-sm font-bold text-white">{option.label}</div>
                        <div className="mt-1 text-xs text-zinc-400">{option.detail}</div>
                    </button>
                ))}
            </div>
            <div className="mt-3 rounded-2xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3 text-sm text-cyan-100">
                New clips land at the end of the sequence. Drag them into place like a video timeline once they appear.
            </div>
            <div className="mt-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Moment Packs</div>
                <div className="mt-1 text-sm text-zinc-300">Use the tech the room already has. Drop in TV takeovers, trivia, onboarding beats, selfie cam, tip bursts, leaderboard flashes, and vibe-light moments without building them from scratch.</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {MOMENT_PACKS.map((pack) => (
                        <button
                            key={pack.id}
                            type="button"
                            disabled={!canEditFlow}
                            onClick={() => onAddScenePack?.(pack)}
                            className={`rounded-[26px] border p-4 text-left transition hover:brightness-110 disabled:opacity-40 ${sourceTone(pack.tone, false)}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${sourceTone(pack.tone, true)}`}>
                                    <i className={`fa-solid ${pack.icon}`}></i>
                                </div>
                                <span className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-100">Drop In</span>
                            </div>
                            <div className="mt-3 text-lg font-black text-white">{pack.label}</div>
                            <div className="mt-1 text-sm text-current/80">{pack.subtitle}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
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
            {items.length ? (
                <div className="mt-4 overflow-x-auto pb-2">
                    <div className="min-w-[980px] space-y-4">
                        <div className="relative rounded-3xl border border-white/10 bg-black/25 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Sequence Scale</div>
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
                        {TIMELINE_LANE_ORDER.map((laneKey) => {
                            const laneMeta = TIMELINE_LANE_META[laneKey];
                            const laneSegments = laneKey === 'master' ? segments : segments.filter((entry) => entry.laneKey === laneKey);
                            return (
                                <div key={laneKey} className="rounded-3xl border border-white/10 bg-black/25 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{laneMeta.label}</div>
                                            <div className="mt-1 text-xs text-zinc-400">{laneMeta.detail}</div>
                                        </div>
                                        <div className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${sourceTone(laneMeta.tone, false)}`}>
                                            {laneSegments.length} clip{laneSegments.length === 1 ? '' : 's'}
                                        </div>
                                    </div>
                                    <div className="relative mt-3 h-[108px] overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950/75">
                                        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:12.5%_100%]"></div>
                                        {activePlayheadPct ? <div className="absolute top-0 bottom-0 z-[1] w-[2px] bg-cyan-300/90 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]" style={{ left: `${activePlayheadPct}%` }}></div> : null}
                                        {laneSegments.length ? laneSegments.map((segment) => {
                                            const item = segment.item;
                                            const readiness = readinessById[item.id] || null;
                                            const pendingCount = Number(pendingCountsById[item.id] || 0);
                                            const visual = getItemVisual(item.type);
                                            const action = typeof getPrimaryAction === 'function' ? getPrimaryAction(item, readiness, { pendingCount }) : null;
                                            const label = item.id === liveItemId ? 'Now' : item.id === stagedItemId ? 'Staged' : item.id === nextItemId ? 'Up next' : item.id === expandedItemId ? 'Inspector' : getRunOfShowItemLabel(item.type);
                                            const isDragging = dragState?.itemId === item.id;
                                            const targetBefore = dragState?.targetId === item.id && dragState?.position === 'before';
                                            const targetAfter = dragState?.targetId === item.id && dragState?.position === 'after';
                                            return (
                                                <button
                                                    key={`${laneKey}:${item.id}`}
                                                    type="button"
                                                    onClick={() => onFocus?.(item.id)}
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
                                                    className={`absolute top-3 bottom-3 rounded-[22px] border p-3 text-left transition ${item.id === currentItemId || item.id === liveItemId ? 'border-cyan-300/45 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]' : 'border-white/10'} ${isDragging ? 'opacity-45' : ''}`}
                                                    style={{
                                                        left: `${segment.startPct}%`,
                                                        width: `${segment.widthPct}%`,
                                                        minWidth: laneKey === 'master' ? 150 : 124,
                                                        background: 'rgba(9,11,18,0.82)'
                                                    }}
                                                >
                                                    {targetBefore ? <div className="absolute -left-1 top-3 bottom-3 w-1 rounded-full bg-cyan-300"></div> : null}
                                                    {targetAfter ? <div className="absolute -right-1 top-3 bottom-3 w-1 rounded-full bg-cyan-300"></div> : null}
                                                    <div className={`flex h-full flex-col justify-between rounded-[18px] border border-white/10 bg-gradient-to-br ${visual.tone} px-3 py-2`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border ${visual.chip}`}>
                                                                <i className={`fa-solid ${visual.icon}`}></i>
                                                            </div>
                                                            <div className="flex flex-wrap justify-end gap-1">
                                                                <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${statusTone(item.status)}`}>{label}</span>
                                                                {pendingCount > 0 ? <span className="rounded-full border border-amber-300/35 bg-amber-500/12 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-100">{pendingCount} pending</span> : null}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 min-w-0">
                                                            <div className="truncate text-sm font-black uppercase tracking-[0.04em] text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                                                            <div className="mt-1 truncate text-xs text-zinc-100/75">{itemSummary(item)}</div>
                                                        </div>
                                                        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-200/80">
                                                            <span>{formatDurationSec(item.plannedDurationSec) || `${Math.max(0, Number(item.plannedDurationSec || 0))}s`}</span>
                                                            {action ? <span className="truncate text-cyan-100">{action.label}</span> : <span>{item.automationMode || 'auto'}</span>}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        }) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
                                                No clips in this lane yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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
}) => (
    <article className={`${surfaceClass} p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Quick Draft</div>
                <div className="mt-1 text-sm text-zinc-300">Build tonight&apos;s outline from a few decisions, then refine only the scenes that matter.</div>
            </div>
            <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                    {generatedDraftItems.length} planned block{generatedDraftItems.length === 1 ? '' : 's'}
                </span>
                <ControlButton onClick={onToggleGenerator}>
                    {generatorOpen ? 'Hide Advanced Builder' : 'Open Advanced Builder'}
                </ControlButton>
            </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_150px_150px_190px_220px]">
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
                <FieldLabel>Automation Style</FieldLabel>
                <SelectControl value={generatorConfig.automationPresetId || 'balanced'} onChange={(e) => updateGeneratorConfig({ automationPresetId: e.target.value })} disabled={!canEditFlow}>
                    {POLICY_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                </SelectControl>
            </div>
            <div className="space-y-2">
                <FieldLabel>Apply Mode</FieldLabel>
                <div className="flex flex-wrap gap-2">
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
                <ControlButton tone="primary" disabled={!canEditFlow || generatorBusy} onClick={applyGeneratorDraft}>
                    {generatorBusy ? 'Applying…' : itemsCount ? (generatorConfig.applyMode === 'append' ? 'Append Draft' : 'Replace Show') : 'Create Show'}
                </ControlButton>
            </div>
        </div>
        <div className="mt-3 rounded-2xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3 text-sm text-cyan-100">
            {itemsCount
                ? `You already have ${itemsCount} block${itemsCount === 1 ? '' : 's'} in this night. Use Replace to rebuild the lineup or Append to tack this draft onto the end.`
                : 'Start with a fast draft, then fine-tune the scenes one at a time below.'}
        </div>
    </article>
);

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
}) => {
    const blockedCount = items.filter((item) => Array.isArray(readinessById[item.id]?.blockers) && readinessById[item.id].blockers.length).length;
    return (
        <article className={`${surfaceClass} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Show Map</div>
                    <div className="mt-1 text-sm text-zinc-300">See the whole night in one stacked view, then open only the scene you want to edit.</div>
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
            <div className="mt-4 grid gap-2">
                {items.map((item, index) => {
                    const readiness = readinessById[item.id] || null;
                    const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers.length : 0;
                    const pendingCount = Number(pendingCountsById[item.id] || 0);
                    const action = typeof getPrimaryAction === 'function' ? getPrimaryAction(item, readiness, { pendingCount }) : null;
                    const isFocused = expandedItemId === item.id;
                    const railLabel = item.id === liveItemId ? 'Now' : item.id === stagedItemId ? 'Staged' : item.id === nextItemId ? 'Up next' : `Scene ${index + 1}`;
                    const readinessLabel = blockers ? `${blockers} blocker${blockers === 1 ? '' : 's'}` : pendingCount ? `${pendingCount} pending` : 'Ready';
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onFocus?.(item.id)}
                            className={`w-full rounded-[24px] border px-4 py-3 text-left transition ${isFocused ? 'border-cyan-300/35 bg-cyan-500/10' : 'border-white/10 bg-black/20 hover:border-cyan-300/25'}`}
                        >
                            <div className="grid gap-3 xl:grid-cols-[92px_minmax(0,1.7fr)_130px_120px_140px_auto] xl:items-center">
                                <div className="flex flex-wrap gap-2">
                                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone(item.status)}`}>{railLabel}</span>
                                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{getRunOfShowItemLabel(item.type)}</span>
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                                    <div className="mt-1 truncate text-xs text-zinc-400">{itemSummary(item)}</div>
                                </div>
                                <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                                    <div className="text-[9px] text-zinc-500">Start</div>
                                    <div className="mt-1 text-sm font-semibold text-white normal-case tracking-normal">{formatStart(item.startsAtMs)}</div>
                                </div>
                                <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                                    <div className="text-[9px] text-zinc-500">Length</div>
                                    <div className="mt-1 text-sm font-semibold text-white normal-case tracking-normal">{formatDurationSec(item.plannedDurationSec) || `${Math.max(0, Number(item.plannedDurationSec || 0))}s`}</div>
                                </div>
                                <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                                    <div className="text-[9px] text-zinc-500">State</div>
                                    <div className={`mt-1 text-sm font-semibold normal-case tracking-normal ${blockers || pendingCount ? 'text-amber-100' : 'text-emerald-100'}`}>{readinessLabel}</div>
                                </div>
                                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                                    {action ? <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">{action.label}</span> : null}
                                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${isFocused ? 'border-violet-300/25 bg-violet-500/12 text-violet-100' : 'border-white/10 bg-black/30 text-zinc-300'}`}>{isFocused ? 'Editing' : 'Open'}</span>
                                </div>
                            </div>
                        </button>
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
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-500/10"
    >
        <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
                {option.artworkUrl ? (
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                        <img src={option.artworkUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                ) : (
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${pickerStatusTone(option.tone || 'zinc')}`}>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em]">{option.tag || 'Pick'}</span>
                    </div>
                )}
                <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{option.title}</div>
                    {option.subtitle ? <div className="mt-1 truncate text-sm text-zinc-300">{option.subtitle}</div> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${sourceTone(option.tone || 'zinc', false)}`}>{option.tag || 'Select'}</span>
                        {option.statusLabel ? <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${pickerStatusTone(option.statusTone || option.tone || 'zinc')}`}>{option.statusLabel}</span> : null}
                    </div>
                    {option.detail ? <div className="mt-2 text-xs text-zinc-500">{option.detail}</div> : null}
                </div>
            </div>
            {option.actionHint ? <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-cyan-100/80">{option.actionHint}</span> : null}
        </div>
    </button>
);

export default function RunOfShowDirectorPanel({
    enabled = false,
    programMode = 'standard_karaoke',
    director = null,
    runOfShowPolicy = null,
    runOfShowRoles = null,
    runOfShowTemplateMeta = null,
    runOfShowTemplates = [],
    submissions = [],
    roomUsers = [],
    localLibrary = [],
    ytIndex = [],
    appleMusicAuthorized = false,
    previewActiveId = '',
    operatorRole = RUN_OF_SHOW_OPERATOR_ROLES.viewer,
    operatorCapabilities = null,
    operatingHint = '',
    onSetEnabled,
    onSetProgramMode,
    onAddItem,
    onDuplicateItem,
    onDeleteItem,
    onMoveItem,
    onUpdateItem,
    onToggleAutomationPause,
    onPrepareItem,
    onPreviewItem,
    onClearPreview,
    onStartItem,
    onCompleteItem,
    onSkipItem,
    onReviewSubmission,
    onUpdatePolicy,
    onUpdateRoles,
    onApplyGeneratedDraft,
    onSaveTemplate,
    onApplyTemplate,
    onArchiveCurrent,
}) {
    const items = Array.isArray(director?.items) ? director.items : [];
    const automationPaused = !!director?.automationPaused;
    const currentItemId = String(director?.currentItemId || '').trim();
    const safePolicy = runOfShowPolicy || {};
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
    const [coHostSearch, setCoHostSearch] = useState('');
    const [generatorOpen, setGeneratorOpen] = useState(items.length === 0);
    const [generatorConfig, setGeneratorConfig] = useState({ ...GENERATOR_DEFAULTS });
    const [generatorBusy, setGeneratorBusy] = useState(false);
    const [approvalInboxOpen, setApprovalInboxOpen] = useState(true);
    const [planningControlsOpen, setPlanningControlsOpen] = useState(items.length === 0);
    const [coHostToolsOpen, setCoHostToolsOpen] = useState(false);
    const [templateToolsOpen, setTemplateToolsOpen] = useState(false);
    const [sectionOpenState, setSectionOpenState] = useState({});
    const [dragState, setDragState] = useState({ itemId: '', targetId: '', position: 'after' });
    const [mediaPicker, setMediaPicker] = useState({
        itemId: '',
        query: '',
        remoteResults: [],
        loading: false,
        error: ''
    });
    const isRunOfShowActive = enabled && programMode === 'run_of_show';
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
    const openItem = (itemId = '') => {
        if (!itemId) return;
        setExpandedItemId(itemId);
    };
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
    const extraBlockOptions = useMemo(
        () => ITEM_TYPE_OPTIONS.filter((option) => !QUICK_ADD_SCENE_OPTIONS.some((entry) => entry.value === option.value)),
        []
    );
    const pickerSourceType = String(currentPickerItem?.backingPlan?.sourceType || 'canonical_default').toLowerCase();
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
    const blockedCount = useMemo(
        () => items.filter((item) => (readinessById[item.id]?.blockers || []).length > 0).length,
        [items, readinessById]
    );
    const reviewItems = useMemo(
        () => items.filter((item) => {
            const pendingCount = pendingCountsById[item.id] || 0;
            const blockers = readinessById[item.id]?.blockers || [];
            return pendingCount > 0 || blockers.length > 0;
        }),
        [items, pendingCountsById, readinessById]
    );
    const autoReadyCount = useMemo(
        () => items.filter((item) => isRunOfShowItemReady(item)).length,
        [items]
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
    const focusedBuildItemIndex = useMemo(
        () => focusedBuildItem ? items.findIndex((item) => item.id === focusedBuildItem.id) : -1,
        [focusedBuildItem, items]
    );

    useEffect(() => {
        const preferred = currentItemId || liveItem?.id || stagedItem?.id || nextItem?.id || items[0]?.id || '';
        setExpandedItemId((prev) => (prev && items.some((item) => item.id === prev) ? prev : preferred));
    }, [currentItemId, items, liveItem?.id, stagedItem?.id, nextItem?.id]);
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
                    const data = await callFunction('itunesSearch', { term: query, limit: 8 });
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
                        mediaUrl: String(entry?.previewUrl || '').trim(),
                        titleValue: String(entry?.trackName || '').trim(),
                        artistValue: String(entry?.artistName || '').trim(),
                        artworkUrl: String(entry?.artworkUrl100 || '').trim()
                    }));
                    setMediaPicker((prev) => ({ ...prev, remoteResults: uniqueById(results), loading: false, error: '' }));
                    return;
                }
                const data = await callFunction('youtubeSearch', { query: `${query} karaoke`, maxResults: 6, playableOnly: true });
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
                        mediaUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
                        artworkUrl: String(entry?.thumbnails?.medium?.url || entry?.thumbnails?.default?.url || '').trim()
                    };
                }).filter((entry) => entry.youtubeId || entry.mediaUrl);
                setMediaPicker((prev) => ({ ...prev, remoteResults: uniqueById(results), loading: false, error: '' }));
            } catch (error) {
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
    }, [appleMusicAuthorized, currentPickerItem, pickerQuery, pickerSourceType]);

    const handleRunOfShowModeToggle = async () => {
        if (!isHostOperator || typeof onSetProgramMode !== 'function' || modeActionBusy) return;
        setModeActionBusy(true);
        try {
            await onSetProgramMode(isRunOfShowActive ? 'standard_karaoke' : 'run_of_show');
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
            await onApplyGeneratedDraft({
                items: generatedDraftItems,
                mode: generatorConfig.applyMode || 'replace'
            });
            if (generatedPolicyPreset?.policy) {
                await onUpdatePolicy?.(generatedPolicyPreset.policy);
            }
            setGeneratorOpen(false);
        } finally {
            setGeneratorBusy(false);
        }
    };
    const loadSuggestedBacking = (item = {}) => {
        if (!item?.id) return;
        setExpandedItemId(item.id);
        setMediaPicker({
            itemId: item.id,
            query: buildMediaQuery(item),
            remoteResults: [],
            loading: false,
            error: ''
        });
    };
    const getSuggestedOptionsForItem = (item = {}) => {
        const sourceType = String(item?.backingPlan?.sourceType || 'canonical_default').toLowerCase();
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
                actionHint: 'Attach'
            })));
        const remoteMatches = mediaPicker.itemId === item.id ? (mediaPicker.remoteResults || []) : [];
        if (sourceType === 'local_file') return localMatches;
        if (sourceType === 'user_submitted') return uniqueById([...approvedSubmissionMatches, ...localMatches]);
        if (sourceType === 'apple_music') return uniqueById([...localMatches, ...remoteMatches]);
        return uniqueById([...youtubeMatches, ...approvedSubmissionMatches, ...localMatches, ...remoteMatches]);
    };
    const getPrimaryActionForItem = (item = null, readiness = null, options = {}) => {
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
    };
    const applyScenePack = (pack = null) => {
        if (!safeOperatorCapabilities.canEditFlow || !pack?.type) return;
        onAddItem?.(pack.type, pack.overrides || {});
    };

    const toggleMediaPicker = (item = {}) => {
        if (!safeOperatorCapabilities.canCurateMedia) return;
        const itemId = String(item?.id || '').trim();
        if (!itemId) return;
        setMediaPicker((prev) => (
            prev.itemId === itemId
                ? { itemId: '', query: '', remoteResults: [], loading: false, error: '' }
                : { itemId, query: buildMediaQuery(item), remoteResults: [], loading: false, error: '' }
        ));
    };

    const applyMediaSelection = (item = {}, option = {}) => {
        if (!safeOperatorCapabilities.canCurateMedia) return;
        const itemId = String(item?.id || '').trim();
        if (!itemId) return;
        const optionTitle = String(option?.titleValue || option?.title || '').trim();
        const optionArtist = String(option?.artistValue || option?.subtitle || '').trim();
        const sourceType = String(option?.sourceType || item?.backingPlan?.sourceType || 'canonical_default').trim().toLowerCase();
        const baseItemPatch = {
            ...(item?.songTitle ? {} : { songTitle: optionTitle }),
            ...(item?.artistName ? {} : { artistName: optionArtist })
        };
        if (sourceType === 'local_file') {
            onUpdateItem?.(itemId, {
                ...baseItemPatch,
                backingPlan: {
                    ...(item?.backingPlan || {}),
                    sourceType,
                    label: formatMediaLabel(optionTitle, optionArtist) || item?.backingPlan?.label || 'Local backing',
                    localAssetId: String(option?.assetId || '').trim(),
                    mediaUrl: String(option?.mediaUrl || '').trim(),
                    approvalStatus: 'approved',
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
                    youtubeId: String(option?.youtubeId || '').trim(),
                    mediaUrl: String(option?.mediaUrl || '').trim(),
                    approvalStatus: 'approved',
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
                    appleMusicId,
                    trackId: String(option?.trackId || appleMusicId).trim(),
                    mediaUrl: String(option?.mediaUrl || '').trim(),
                    approvalStatus: 'approved',
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
                    submittedBackingId: String(option?.submissionId || '').trim(),
                    youtubeId: String(option?.youtubeId || '').trim(),
                    mediaUrl: String(option?.mediaUrl || '').trim(),
                    approvalStatus: 'approved',
                    playbackReady: !!submissionIdentity,
                    resolutionStatus: option?.mediaUrl || option?.youtubeId ? 'ready' : 'submission_attached'
                }
            });
        }
        setMediaPicker({ itemId: '', query: '', remoteResults: [], loading: false, error: '' });
    };

    return (
        <section className="rounded-3xl border border-cyan-500/20 bg-zinc-950/70 p-4 space-y-4" aria-label="Run of Show Director">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-sm uppercase tracking-[0.3em] text-cyan-300">Run Of Show Director</div>
                    <div className="mt-1 text-sm text-zinc-400">Run the night from one control rail: what is live, what is next, and what is still blocking automation.</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isRunOfShowActive ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>
                            {isRunOfShowActive ? 'Run-of-show active' : 'Standard karaoke mode'}
                        </span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${automationPaused ? 'border-amber-300/35 bg-amber-500/12 text-amber-100' : 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'}`}>
                            {automationPaused ? 'Automation paused' : 'Automation ready'}
                        </span>
                        {activePolicyPreset ? (
                            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">
                                {activePolicyPreset.label} preset
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleRunOfShowModeToggle}
                        disabled={!isHostOperator || modeActionBusy}
                        className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] disabled:opacity-40 ${isRunOfShowActive ? 'border-rose-300/35 bg-rose-500/12 text-rose-100' : 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100'}`}
                    >
                        {modeActionBusy ? 'Updating…' : isRunOfShowActive ? 'Exit Run Of Show' : 'Start Run Of Show'}
                    </button>
                    <button type="button" onClick={() => onToggleAutomationPause?.(!automationPaused)} disabled={!isRunOfShowActive || !safeOperatorCapabilities.canPauseAutomation} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white disabled:opacity-40">{automationPaused ? 'Resume Automation' : 'Pause Automation'}</button>
                    {previewActiveId ? <button type="button" onClick={() => onClearPreview?.()} className="rounded-full border border-violet-300/35 bg-violet-500/12 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-violet-100">Clear Preview</button> : null}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/10 bg-black/20 px-4 py-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Studio View</div>
                    <div className="mt-1 text-sm text-zinc-300">
                        {studioMode === 'build'
                            ? 'Build the sequence visually from clips, packs, and inline insertions.'
                            : studioMode === 'run'
                                ? 'Run the night from now, next, and later without the builder noise.'
                                : 'Review approvals, blockers, and readiness warnings before they stall the room.'}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {[
                        ['build', 'Build'],
                        ['run', 'Run'],
                        ['review', 'Review'],
                    ].map(([modeId, label]) => (
                        <button
                            key={modeId}
                            type="button"
                            onClick={() => setStudioMode(modeId)}
                            className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition ${studioMode === modeId ? 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-black/25 text-zinc-300 hover:border-cyan-300/25'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
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

                <UtilityDrawer
                    eyebrow="Templates"
                    title="Reuse a proven show format"
                    summary="Keep template operations available without taking over the main planning view."
                    open={templateToolsOpen}
                    onToggle={() => setTemplateToolsOpen((prev) => !prev)}
                    badge={safeTemplateMeta.currentTemplateName || 'Unsaved'}
                >
                    <div className="space-y-3">
                        <div>
                            <FieldLabel>Template Name</FieldLabel>
                            <input value={templateDraftName} onChange={(e) => setTemplateDraftName(e.target.value)} disabled={!safeOperatorCapabilities.canManageTemplates} className={textInputClass} placeholder="AAHF Kick-Off Format" />
                        </div>
                        <div>
                            <FieldLabel>Saved Templates</FieldLabel>
                            <SelectControl value={safeTemplateMeta.currentTemplateId || ''} onChange={(e) => onApplyTemplate?.(e.target.value)} disabled={!safeOperatorCapabilities.canManageTemplates}>
                                <option value="">Select a saved template</option>
                                {(Array.isArray(runOfShowTemplates) ? runOfShowTemplates : []).map((entry) => (
                                    <option key={entry.id || entry.templateId} value={entry.templateId || entry.id}>{entry.templateName || entry.templateId || entry.id}</option>
                                ))}
                            </SelectControl>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                            <ControlButton tone="primary" disabled={!safeOperatorCapabilities.canManageTemplates} onClick={() => onSaveTemplate?.(templateDraftName || safeTemplateMeta.currentTemplateName || 'Run Of Show Template')}>Save Template</ControlButton>
                            <ControlButton disabled={!safeOperatorCapabilities.canManageTemplates || !(safeTemplateMeta.currentTemplateId || '').trim()} onClick={() => onApplyTemplate?.(safeTemplateMeta.currentTemplateId)}>Reapply Current</ControlButton>
                            <ControlButton tone="warning" disabled={!safeOperatorCapabilities.canManageTemplates} onClick={() => onArchiveCurrent?.(templateDraftName || safeTemplateMeta.currentTemplateName || 'Archived Run Of Show')}>Archive Night</ControlButton>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-zinc-400">
                            Current template: <span className="text-white">{safeTemplateMeta.currentTemplateName || 'Unsaved working copy'}</span>{safeTemplateMeta.lastArchiveId ? ` | Last archive ${safeTemplateMeta.lastArchiveId}` : ''}
                        </div>
                    </div>
                </UtilityDrawer>
            </div>

            {studioMode === 'build' ? (
            <>
                <QuickDraftPanel
                    canEditFlow={safeOperatorCapabilities.canEditFlow}
                    generatorConfig={generatorConfig}
                    updateGeneratorConfig={updateGeneratorConfig}
                    applyGeneratorDraft={applyGeneratorDraft}
                    generatorBusy={generatorBusy}
                    generatorOpen={generatorOpen}
                    onToggleGenerator={() => setGeneratorOpen((prev) => !prev)}
                    generatedDraftItems={generatedDraftItems}
                    itemsCount={items.length}
                />
                {generatorOpen ? (
                <article className={`${surfaceClass} p-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Advanced Draft Builder</div>
                            <div className="mt-1 text-sm text-zinc-300">Tune the generated outline in more detail when the quick draft needs a custom block mix or pacing change.</div>
                        </div>
                    </div>
                    <div className="mt-4 space-y-4">
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
                </article>
                ) : null}
            </>
            ) : null}

            {studioMode === 'build' ? (
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
            />
            ) : null}

            {studioMode === 'build' ? (
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
                onAddItem={onAddItem}
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
            ) : null}

            {studioMode !== 'build' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <OperationsStat label="Automation" value={automationPaused ? 'Paused' : enabled ? 'Armed' : 'Off'} tone={automationPaused ? 'amber' : enabled ? 'cyan' : 'zinc'} detail={enabled ? 'Host can still override every block.' : 'Enable for designated run-of-show rooms.'} />
                <OperationsStat label="Auto-Ready Blocks" value={`${autoReadyCount}/${items.length || 0}`} tone="emerald" detail="Approved media and performer data resolved." />
                <OperationsStat label="Needs Attention" value={String(blockedCount)} tone={blockedCount ? 'amber' : 'emerald'} detail={blockedCount ? 'Blocked items will halt auto-advance.' : 'No current blockers surfaced.'} />
                <OperationsStat label="Pending Approvals" value={String(pendingApprovals.length)} tone={pendingApprovals.length ? 'amber' : 'zinc'} detail={pendingApprovals.length ? 'Review open slot submissions before staging.' : 'No performer approvals waiting.'} />
            </div>
            ) : null}

            {studioMode === 'review' ? (
            <article className={`${surfaceClass} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Approval Inbox</div>
                        <div className="mt-1 text-sm text-zinc-300">Review pending singer submissions in one place, then jump back into the affected slot only if deeper edits are needed.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <ControlButton tone="warning" disabled={!safeOperatorCapabilities.canReviewSubmissions || !pendingApprovals.length} onClick={focusFirstPendingApproval}>Review First Pending</ControlButton>
                        <ControlButton onClick={() => setApprovalInboxOpen((prev) => !prev)}>{approvalInboxOpen ? 'Collapse Inbox' : 'Open Inbox'}</ControlButton>
                    </div>
                </div>
                {approvalInboxOpen ? (
                    <div className="mt-4 grid gap-3">
                        {pendingApprovalGroups.length ? pendingApprovalGroups.map((group) => (
                            <div key={group.itemId} className="rounded-2xl border border-amber-300/18 bg-amber-500/10 px-3 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.16em] text-amber-100/80">{group.item?.title || 'Open performance slot'}</div>
                                        <div className="mt-1 text-sm text-amber-50">{group.submissions.length} pending singer submission{group.submissions.length === 1 ? '' : 's'}.</div>
                                        <div className="mt-1 text-xs text-amber-100/80">{group.item?.songTitle ? `${group.item.songTitle}${group.item.artistName ? ` · ${group.item.artistName}` : ''}` : 'Song still open'}{` · ${readinessById[group.itemId]?.summary || 'Needs review'}`}</div>
                                    </div>
                                    <ControlButton onClick={() => openItem(group.itemId)}>Open Slot</ControlButton>
                                </div>
                                <div className="mt-3 grid gap-2">
                                    {group.submissions.map((submission) => (
                                        <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                                            <div>
                                                <div className="text-sm font-bold text-white">{submission.displayName || 'Singer'}</div>
                                                <div className="text-xs text-zinc-400">{submission.songTitle || 'Untitled Song'}{submission.artistName ? ` · ${submission.artistName}` : ''}{submission.backingUrl || submission.mediaUrl || submission.youtubeId ? ' · backing attached' : ' · song only'}</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <ControlButton tone="success" disabled={!safeOperatorCapabilities.canReviewSubmissions} onClick={() => onReviewSubmission?.(submission.id, 'approved')}>Approve + Assign</ControlButton>
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
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.1fr)_340px]">
                {(() => {
                    const action = getPrimaryActionForItem(
                        liveItem,
                        liveItem?.id ? readinessById[liveItem.id] : null,
                        { pendingCount: liveItem?.id ? pendingApprovals.filter((entry) => entry.itemId === liveItem.id).length : 0 }
                    );
                    return (
                        <OpsBoardCard
                            label="Now"
                            item={liveItem}
                            readiness={liveItem?.id ? readinessById[liveItem.id] : null}
                            emptyLabel="Nothing live yet."
                            actionLabel={action?.label || ''}
                            actionTone={action?.tone}
                            onAction={action?.onClick}
                            onFocus={openItem}
                        />
                    );
                })()}
                {(() => {
                    const railItem = stagedItem || nextItem;
                    const action = getPrimaryActionForItem(
                        railItem,
                        railItem?.id ? readinessById[railItem.id] : null,
                        { pendingCount: railItem?.id ? pendingApprovals.filter((entry) => entry.itemId === railItem.id).length : 0 }
                    );
                    return (
                        <OpsBoardCard
                            label="Next"
                            item={railItem}
                            readiness={railItem?.id ? readinessById[railItem.id] : null}
                            emptyLabel="No upcoming block staged."
                            actionLabel={action?.label || ''}
                            actionTone={action?.tone}
                            onAction={action?.onClick}
                            onFocus={openItem}
                        >
                            {railItem && pendingApprovals.some((entry) => entry.itemId === railItem.id) ? (
                                <div className="rounded-2xl border border-amber-300/18 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">This block has pending singer approvals in the inbox.</div>
                            ) : null}
                            {railItem ? (
                                <div className="flex flex-wrap gap-2">
                                    <ControlButton onClick={() => openItem(railItem.id)}>Details</ControlButton>
                                    <ControlButton onClick={() => onPreviewItem?.(railItem.id)}>Preview TV</ControlButton>
                                </div>
                            ) : null}
                        </OpsBoardCard>
                    );
                })()}
                <article className={`${surfaceClass} p-4`} aria-label="Later run of show queue">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">Later</div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{laterItems.length} upcoming</div>
                    </div>
                    <div className="mt-3 space-y-2">
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
                        )) : <div className="text-sm text-zinc-400">No queued later blocks yet.</div>}
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Live operator notes</div>
                            <div className="mt-2 text-sm text-zinc-200">
                                {automationPaused
                                    ? 'Automation is paused. The host must manually prep and start the next block.'
                                    : nextItem?.id && pendingApprovals.some((entry) => entry.itemId === nextItem.id)
                                        ? 'The next planned block still has pending singer approvals in the inbox.'
                                        : nextItem?.id && readinessById[nextItem.id]?.blockers?.length
                                        ? getRunOfShowBlockedActionLabel(readinessById[nextItem.id], nextItem, safePolicy)
                                        : 'Automation is armed. The next block can auto-stage once it clears readiness checks.'}
                            </div>
                        </div>
                    </div>
                </article>
            </div>
            ) : null}

            {studioMode === 'build' ? (
            <div className={`${surfaceClass} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Clip Bin</div>
                        <div className="mt-1 text-sm text-zinc-300">Less common scene types live here. Add them when the timeline needs a specialist beat, not as part of the main flow.</div>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{extraBlockOptions.length} specialty clips</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {extraBlockOptions.map((option) => (
                        <button key={option.value} type="button" disabled={!enabled || !safeOperatorCapabilities.canEditFlow} onClick={() => onAddItem?.(option.value)} className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-zinc-200 disabled:opacity-40">+ {option.label}</button>
                    ))}
                </div>
            </div>
            ) : null}

            {studioMode === 'build' ? (!items.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-zinc-400">
                    No run-of-show items yet. Add blocks to build the order of the night.
                </div>
            ) : (
                <div className="grid gap-4">
                    {[focusedBuildItem].filter(Boolean).map((item) => {
                        const index = focusedBuildItemIndex;
                        const itemSubmissions = (Array.isArray(submissions) ? submissions : []).filter((entry) => entry.itemId === item.id);
                        const optionsCsv = launchConfigToCsv(item.modeLaunchPlan?.launchConfig);
                        const isExpanded = true;
                        const isCurrent = currentItemId === item.id || liveItem?.id === item.id;
                        const pendingCount = itemSubmissions.filter((entry) => String(entry?.submissionStatus || 'pending').toLowerCase() === 'pending').length;
                        const readiness = readinessById[item.id] || getRunOfShowItemReadiness(item, { pendingSubmissionCount: pendingCount });
                        const sourceType = String(item?.backingPlan?.sourceType || 'canonical_default').toLowerCase();
                        const sourceMeta = getSourceMeta(sourceType);
                        const primaryAction = getPrimaryActionForItem(item, readiness, { pendingCount });
                        const suggestedOptions = item.type === 'performance' ? getSuggestedOptionsForItem(item) : [];
                        const performerAdvancedOpen = isSectionOpen(item.id, 'performer_advanced');
                        const backingAdvancedOpen = isSectionOpen(item.id, 'backing_advanced');
                        const targetBefore = dragState?.targetId === item.id && dragState?.position === 'before';
                        const targetAfter = dragState?.targetId === item.id && dragState?.position === 'after';
                        const isDragging = dragState?.itemId === item.id;
                        const updateBackingPlan = (patch) => {
                            if (!safeOperatorCapabilities.canCurateMedia) return;
                            onUpdateItem?.(item.id, { backingPlan: { ...(item.backingPlan || {}), ...(patch || {}) } });
                        };
                        const visual = getItemVisual(item.type);
                        const summaryLine = item.type === 'performance'
                            ? formatSummaryLine(item.assignedPerformerName || 'Singer TBD', item.songTitle || 'Song TBD', item.artistName || '')
                            : (item.modeLaunchPlan?.modeKey ? String(item.modeLaunchPlan.modeKey).replaceAll('_', ' ') : item.notes || getRunOfShowItemLabel(item.type));
                        return (
                            <article
                                key={item.id}
                                data-run-of-show-item-id={item.id}
                                className={`${surfaceClass} relative overflow-hidden ${isCurrent ? 'border-cyan-300/45 bg-cyan-500/8' : ''} ${isDragging ? 'opacity-50' : ''}`}
                                draggable={safeOperatorCapabilities.canEditFlow}
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
                                <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                                    <button type="button" onClick={() => openItem(item.id)} className="min-w-0 text-left">
                                        <div className={`rounded-[24px] border border-white/10 bg-gradient-to-br ${visual.tone} p-4`}>
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${visual.chip}`}>
                                                        <i className={`fa-solid ${visual.icon}`}></i>
                                                    </div>
                                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-zinc-200">
                                                        <i className="fa-solid fa-grip-lines"></i>
                                                    </div>
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
                                        </div>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-4">
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
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">
                                                <i className="fa-solid fa-grip-lines mr-1"></i>
                                                Drag scene
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{item.automationMode}</span>
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
                                    </button>
                                    <div className="flex flex-wrap justify-end gap-2 lg:w-[320px] lg:self-start">
                                        <ControlButton disabled={index <= 0} onClick={() => index > 0 && openItem(items[index - 1]?.id)}>
                                            <i className="fa-solid fa-arrow-left mr-1"></i>
                                            Previous Scene
                                        </ControlButton>
                                        <ControlButton disabled={index >= items.length - 1} onClick={() => index < items.length - 1 && openItem(items[index + 1]?.id)}>
                                            Next Scene
                                            <i className="fa-solid fa-arrow-right ml-1"></i>
                                        </ControlButton>
                                        {primaryAction ? (
                                            <ControlButton tone={primaryAction.tone} onClick={primaryAction.onClick}>{primaryAction.label}</ControlButton>
                                        ) : null}
                                        <ControlButton className={previewActiveId === item.id ? 'ring-1 ring-violet-300/45' : ''} onClick={() => onPreviewItem?.(item.id)}>Preview TV</ControlButton>
                                        <ControlButton tone="primary" onClick={() => openItem(item.id)}>
                                            Focused Scene
                                        </ControlButton>
                                    </div>
                                </div>

                                {isExpanded ? (
                                    <div className="border-t border-white/10 bg-black/20 p-4 space-y-4" aria-label={`Run of show details for ${item.title || getRunOfShowItemLabel(item.type)}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-300/16 bg-violet-500/8 px-3 py-3">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.18em] text-violet-100/80">Scene Inspector</div>
                                                <div className="mt-1 text-sm text-zinc-200">Tune this scene without losing sight of the overall sequence.</div>
                                            </div>
                                            <div className="rounded-full border border-violet-300/25 bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">
                                                {getRunOfShowItemLabel(item.type)}
                                            </div>
                                        </div>
                                        <ReadinessPanel readiness={readiness} />
                                        <div className="grid gap-3 md:grid-cols-4">
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

                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div><FieldLabel>Planned Duration Sec</FieldLabel><input type="number" value={item.plannedDurationSec || 0} onChange={(e) => onUpdateItem?.(item.id, { plannedDurationSec: Number(e.target.value || 0) })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                            <div><FieldLabel>Planned Start</FieldLabel><input type="datetime-local" value={item.startsAtMs ? new Date(item.startsAtMs).toISOString().slice(0, 16) : ''} onChange={(e) => onUpdateItem?.(item.id, { startsAtMs: e.target.value ? new Date(e.target.value).getTime() : 0 })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                            <div><FieldLabel>Notes</FieldLabel><input value={item.notes || ''} onChange={(e) => onUpdateItem?.(item.id, { notes: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Room Moment Layer</div>
                                                    <div className="mt-1 text-sm text-zinc-300">Turn this scene into a real BeauRocks moment with built-in overlays, modes, and vibe changes instead of extra setup text.</div>
                                                </div>
                                                <div className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                                    {compactMomentSummary(item.roomMomentPlan || {}) || 'Stage default'}
                                                </div>
                                            </div>
                                            <div className="grid gap-3 lg:grid-cols-4">
                                                <div className="space-y-2">
                                                    <FieldLabel>TV Overlay</FieldLabel>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            ['stage', 'Stage'],
                                                            ['leaderboard', 'Leaderboard'],
                                                            ['tipping', 'Tip CTA'],
                                                        ].map(([value, label]) => {
                                                            const active = String(item.roomMomentPlan?.activeScreen || '').trim() === value || (!item.roomMomentPlan?.activeScreen && value === 'stage');
                                                            return (
                                                                <button
                                                                    key={value}
                                                                    type="button"
                                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                                    onClick={() => onUpdateItem?.(item.id, { roomMomentPlan: { ...(item.roomMomentPlan || {}), activeScreen: value === 'stage' ? '' : value } })}
                                                                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${active ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/30 text-zinc-300'}`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <FieldLabel>Phone / Room Mode</FieldLabel>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            ['', 'None'],
                                                            ['selfie_cam', 'Selfie Cam'],
                                                        ].map(([value, label]) => {
                                                            const active = String(item.roomMomentPlan?.activeMode || '').trim() === value;
                                                            return (
                                                                <button
                                                                    key={value || 'none'}
                                                                    type="button"
                                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                                    onClick={() => onUpdateItem?.(item.id, { roomMomentPlan: { ...(item.roomMomentPlan || {}), activeMode: value } })}
                                                                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${active ? 'border-amber-300/35 bg-amber-500/12 text-amber-100' : 'border-white/10 bg-black/30 text-zinc-300'}`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <FieldLabel>Vibe Lighting</FieldLabel>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            ['off', 'Off'],
                                                            ['ballad', 'Ballad'],
                                                            ['banger', 'Banger'],
                                                        ].map(([value, label]) => {
                                                            const active = String(item.roomMomentPlan?.lightMode || 'off').trim() === value;
                                                            return (
                                                                <button
                                                                    key={value}
                                                                    type="button"
                                                                    disabled={!safeOperatorCapabilities.canEditFlow}
                                                                    onClick={() => onUpdateItem?.(item.id, { roomMomentPlan: { ...(item.roomMomentPlan || {}), lightMode: value } })}
                                                                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${active ? 'border-rose-300/35 bg-rose-500/12 text-rose-100' : 'border-white/10 bg-black/30 text-zinc-300'}`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <FieldLabel>Quick Instruction Beat</FieldLabel>
                                                    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-300">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.roomMomentPlan?.showHowToPlay === true}
                                                            onChange={(e) => onUpdateItem?.(item.id, { roomMomentPlan: { ...(item.roomMomentPlan || {}), showHowToPlay: e.target.checked } })}
                                                            disabled={!safeOperatorCapabilities.canEditFlow}
                                                        />
                                                        Show How To Play overlay
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {item.type === 'performance' ? (
                                            <div className="space-y-4">
                                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Quick Performance Setup</div>
                                                            <div className="mt-1 text-sm text-zinc-300">Pick how this slot gets a singer, fill in the public-facing song info, then lock the backing source below.</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone(item.status)}`}>{item.status}</span>
                                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${sourceTone(sourceMeta.tone, false)}`}>{sourceMeta.label}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {PERFORMER_MODE_OPTIONS.map((option) => (
                                                            <button key={option.value} type="button" disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onUpdateItem?.(item.id, { performerMode: option.value })} className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40 ${item.performerMode === option.value ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/30 text-zinc-300'}`}>{option.label}</button>
                                                        ))}
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <div><FieldLabel>Performer</FieldLabel><input value={item.assignedPerformerName || ''} onChange={(e) => onUpdateItem?.(item.id, { assignedPerformerName: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} placeholder={item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? 'Approved singer fills this in' : 'Singer name'} /></div>
                                                        <div><FieldLabel>Song Title</FieldLabel><input value={item.songTitle || ''} onChange={(e) => onUpdateItem?.(item.id, { songTitle: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                        <div><FieldLabel>Artist</FieldLabel><input value={item.artistName || ''} onChange={(e) => onUpdateItem?.(item.id, { artistName: e.target.value })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <div className={`${miniSurfaceClass} px-3 py-3`}>
                                                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Slot Mode</div>
                                                            <div className="mt-1 text-sm font-semibold text-white">
                                                                {PERFORMER_MODE_OPTIONS.find((option) => option.value === item.performerMode)?.label || 'Placeholder'}
                                                            </div>
                                                            <div className="mt-1 text-xs text-zinc-400">
                                                                {item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission
                                                                    ? 'Guests can compete for this slot and the host approves the winner.'
                                                                    : item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.assigned
                                                                        ? 'This slot is locked to a specific singer.'
                                                                        : 'Use this as a flexible placeholder until the room settles.'}
                                                            </div>
                                                        </div>
                                                        <div className={`${miniSurfaceClass} px-3 py-3`}>
                                                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Backing Readiness</div>
                                                            <div className="mt-1 text-sm font-semibold text-white">
                                                                {item.backingPlan?.playbackReady === true ? 'Playback ready' : 'Needs media'}
                                                            </div>
                                                            <div className="mt-1 text-xs text-zinc-400">
                                                                {item.backingPlan?.label || 'Choose a backing source and approved track below.'}
                                                            </div>
                                                        </div>
                                                        <div className={`${miniSurfaceClass} px-3 py-3`}>
                                                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Approval Queue</div>
                                                            <div className="mt-1 text-sm font-semibold text-white">{pendingCount} pending</div>
                                                            <div className="mt-1 text-xs text-zinc-400">
                                                                {item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission
                                                                    ? 'Review and approve one singer to snap them into the slot.'
                                                                    : 'Only open-submission slots use the approval queue.'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? (
                                                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                                                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Submission Rules</div>
                                                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                                                                <div><FieldLabel>Min Tight 15 Count</FieldLabel><input type="number" value={item.slotCriteria?.minTight15Count || 0} onChange={(e) => onUpdateItem?.(item.id, { slotCriteria: { ...(item.slotCriteria || {}), minTight15Count: Number(e.target.value || 0) } })} disabled={!safeOperatorCapabilities.canEditFlow} className={textInputClass} /></div>
                                                                <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={item.slotCriteria?.requiresAccount !== false} onChange={(e) => onUpdateItem?.(item.id, { slotCriteria: { ...(item.slotCriteria || {}), requiresAccount: e.target.checked } })} disabled={!safeOperatorCapabilities.canEditFlow} />Account required</label></div>
                                                                <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={item.slotCriteria?.hostApprovalRequired !== false} onChange={(e) => onUpdateItem?.(item.id, { slotCriteria: { ...(item.slotCriteria || {}), hostApprovalRequired: e.target.checked } })} disabled={!safeOperatorCapabilities.canEditFlow} />Host approval required</label></div>
                                                            </div>
                                                        </div>
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
                                                </div>

                                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Suggested Backing</div>
                                                            <div className="mt-1 text-sm text-zinc-300">Start with likely matches for this song, then open the full picker only if you need more options.</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <ControlButton onClick={() => loadSuggestedBacking(item)}>Load Live Suggestions</ControlButton>
                                                            {mediaPicker.itemId === item.id && mediaPicker.loading ? <span className="text-xs text-cyan-100/80">Loading…</span> : null}
                                                        </div>
                                                    </div>
                                                    {suggestedOptions.length ? (
                                                        <div className="grid gap-2">
                                                            {suggestedOptions.slice(0, 4).map((option) => (
                                                                <MediaPickerOption
                                                                    key={option.id}
                                                                    option={{ ...option, statusLabel: option.statusLabel || 'Suggested', statusTone: option.statusTone || option.tone || 'zinc' }}
                                                                    onSelect={() => applyMediaSelection(item, option)}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-400">
                                                            Add a song title and artist to surface stronger backing suggestions. Remote Apple and YouTube suggestions load on demand.
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Backing Source</div>
                                                            <div className="mt-1 text-sm text-zinc-300">Pick the trusted playback lane first, then browse approved media instead of typing ids by hand.</div>
                                                        </div>
                                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${sourceTone(sourceMeta.tone, false)}`}>{isRunOfShowItemReady(item) ? 'automation trusted' : sourceMeta.trustLabel}</span>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                        {BACKING_SOURCE_OPTIONS.map((option) => (
                                                            <BackingSourceCard
                                                                key={option.value}
                                                                option={option}
                                                                selected={sourceType === option.value}
                                                                trusted={sourceType === option.value && isRunOfShowItemReady(item)}
                                                                onSelect={() => updateBackingPlan({ sourceType: option.value })}
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Media picker</div>
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
                                                        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/6 p-3 space-y-3">
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
                                                            {mediaPicker.error ? <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{mediaPicker.error}</div> : null}
                                                            {mediaPicker.loading ? <div className="text-sm text-cyan-100/80">Loading {sourceMeta.title} results...</div> : null}
                                                            {pickerResults.length ? (
                                                                <div className="grid gap-2">
                                                                    {pickerResults.map((option) => (
                                                                        <MediaPickerOption
                                                                            key={option.id}
                                                                            option={option}
                                                                            onSelect={() => applyMediaSelection(item, option)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-400">
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
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <div className="md:col-span-2"><FieldLabel>Display Label</FieldLabel><input value={item.backingPlan?.label || ''} onChange={(e) => updateBackingPlan({ label: e.target.value })} disabled={!safeOperatorCapabilities.canCurateMedia} className={textInputClass} placeholder="What the host should see during the show" /></div>
                                                        <div><FieldLabel>Approval</FieldLabel><SelectControl value={item.backingPlan?.approvalStatus || 'approved'} onChange={(e) => updateBackingPlan({ approvalStatus: e.target.value })} disabled={!safeOperatorCapabilities.canCurateMedia}><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></SelectControl></div>
                                                    </div>
                                                    <CollapsiblePanel
                                                        label="Playback Overrides"
                                                        title="Advanced override fields"
                                                        summary="Direct IDs and fallback media only when the visual picker is not enough."
                                                        open={backingAdvancedOpen}
                                                        onToggle={() => toggleSection(item.id, 'backing_advanced')}
                                                        badge={(item.backingPlan?.trackId || item.backingPlan?.appleMusicId || item.backingPlan?.youtubeId || item.backingPlan?.localAssetId || item.backingPlan?.submittedBackingId) ? 'Overrides set' : 'Optional'}
                                                        tone="amber"
                                                        compact
                                                    >
                                                        <div className="mt-3 space-y-3">
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
                                                    </CollapsiblePanel>
                                                    {sourceType === 'manual_external' ? <div className="rounded-2xl border border-zinc-300/15 bg-zinc-500/10 px-3 py-2 text-sm text-zinc-300">Manual external sources are planning-only in v1 and will not auto-run.</div> : null}
                                                    <div className="flex flex-wrap gap-4">
                                                        <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={item.backingPlan?.playbackReady === true} onChange={(e) => updateBackingPlan({ playbackReady: e.target.checked })} disabled={!safeOperatorCapabilities.canCurateMedia} />Playback ready</label>
                                                        <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Resolution: {item.backingPlan?.resolutionStatus || 'ready'}</div>
                                                    </div>
                                                </div>

                                                {item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission ? (
                                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Pending Submissions</div>
                                                                <div className="text-sm text-zinc-400 mt-1">Approve a song to snap it directly into this slot.</div>
                                                            </div>
                                                            <SubmissionStatusBadge count={pendingCount} />
                                                        </div>
                                                        {itemSubmissions.length === 0 ? <div className="text-sm text-zinc-400">No submissions for this slot yet.</div> : itemSubmissions.map((submission) => (
                                                            <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                                                <div>
                                                                    <div className="text-sm font-bold text-white">{submission.songTitle || 'Untitled Song'}</div>
                                                                <div className="text-xs text-zinc-400">{submission.displayName || 'Singer'}{submission.artistName ? ` · ${submission.artistName}` : ''}{` · ${submission.submissionStatus || 'pending'}`}</div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <ControlButton tone="success" disabled={!safeOperatorCapabilities.canReviewSubmissions} onClick={() => onReviewSubmission?.(submission.id, 'approved')}>Approve + Assign</ControlButton>
                                                                    <ControlButton tone="danger" disabled={!safeOperatorCapabilities.canReviewSubmissions} onClick={() => onReviewSubmission?.(submission.id, 'declined')}>Decline</ControlButton>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        {(item.type === 'announcement' || item.type === 'intro' || item.type === 'closing' || item.type === 'intermission' || item.type === 'buffer') ? (
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3">
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div><FieldLabel>Headline</FieldLabel><input value={item.presentationPlan?.headline || ''} onChange={(e) => onUpdateItem?.(item.id, { presentationPlan: { ...(item.presentationPlan || {}), headline: e.target.value } })} className={textInputClass} /></div>
                                                    <div><FieldLabel>Subhead</FieldLabel><input value={item.presentationPlan?.subhead || ''} onChange={(e) => onUpdateItem?.(item.id, { presentationPlan: { ...(item.presentationPlan || {}), subhead: e.target.value } })} className={textInputClass} /></div>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div><FieldLabel>Takeover Scene</FieldLabel><input value={item.presentationPlan?.takeoverScene || ''} onChange={(e) => onUpdateItem?.(item.id, { presentationPlan: { ...(item.presentationPlan || {}), takeoverScene: e.target.value } })} className={textInputClass} /></div>
                                                    <div><FieldLabel>Background Media</FieldLabel><input value={item.presentationPlan?.backgroundMedia || ''} onChange={(e) => onUpdateItem?.(item.id, { presentationPlan: { ...(item.presentationPlan || {}), backgroundMedia: e.target.value } })} className={textInputClass} /></div>
                                                    <div><FieldLabel>Accent Theme</FieldLabel><input value={item.presentationPlan?.accentTheme || ''} onChange={(e) => onUpdateItem?.(item.id, { presentationPlan: { ...(item.presentationPlan || {}), accentTheme: e.target.value } })} className={textInputClass} /></div>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={item.presentationPlan?.publicTvTakeoverEnabled === true} onChange={(e) => onUpdateItem?.(item.id, { presentationPlan: { ...(item.presentationPlan || {}), publicTvTakeoverEnabled: e.target.checked } })} />Public TV takeover</label>
                                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={item.audioPlan?.duckBackingEnabled === true} onChange={(e) => onUpdateItem?.(item.id, { audioPlan: { ...(item.audioPlan || {}), duckBackingEnabled: e.target.checked } })} />Duck backing</label>
                                                    <div><FieldLabel>Duck Level %</FieldLabel><input type="number" value={item.audioPlan?.duckLevelPct ?? 35} onChange={(e) => onUpdateItem?.(item.id, { audioPlan: { ...(item.audioPlan || {}), duckLevelPct: Number(e.target.value || 0) } })} className={textInputClass} /></div>
                                                </div>
                                            </div>
                                        ) : null}

                                        {(item.type === 'trivia_break' || item.type === 'would_you_rather_break' || item.type === 'game_break') ? (
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3">
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div><FieldLabel>Mode Key</FieldLabel><input value={item.modeLaunchPlan?.modeKey || ''} onChange={(e) => onUpdateItem?.(item.id, { modeLaunchPlan: { ...(item.modeLaunchPlan || {}), modeKey: e.target.value } })} className={textInputClass} /></div>
                                                    <div className="md:col-span-2"><FieldLabel>Prompt</FieldLabel><input value={item.modeLaunchPlan?.launchConfig?.question || ''} onChange={(e) => onUpdateItem?.(item.id, { modeLaunchPlan: { ...(item.modeLaunchPlan || {}), launchConfig: { ...(item.modeLaunchPlan?.launchConfig || {}), question: e.target.value } } })} className={textInputClass} /></div>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div className="md:col-span-2"><FieldLabel>Options (comma separated)</FieldLabel><input value={optionsCsv} onChange={(e) => onUpdateItem?.(item.id, { modeLaunchPlan: { ...(item.modeLaunchPlan || {}), launchConfig: { ...(item.modeLaunchPlan?.launchConfig || {}), optionsCsv: e.target.value } } })} className={textInputClass} /></div>
                                                    <div><FieldLabel>Correct Index</FieldLabel><input type="number" value={item.modeLaunchPlan?.launchConfig?.correctIndex ?? 0} onChange={(e) => onUpdateItem?.(item.id, { modeLaunchPlan: { ...(item.modeLaunchPlan || {}), launchConfig: { ...(item.modeLaunchPlan?.launchConfig || {}), correctIndex: Number(e.target.value || 0) } } })} className={textInputClass} /></div>
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="flex flex-wrap justify-between gap-3">
                                            <div className="flex flex-wrap gap-2">
                                                <ControlButton disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onMoveItem?.(item.id, -1)}>Move Up</ControlButton>
                                                <ControlButton disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onMoveItem?.(item.id, 1)}>Move Down</ControlButton>
                                                <ControlButton disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onDuplicateItem?.(item.id)}>Duplicate</ControlButton>
                                                <ControlButton tone="danger" disabled={!safeOperatorCapabilities.canEditFlow} onClick={() => onDeleteItem?.(item.id)}>Archive</ControlButton>
                                            </div>
                                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Queue state: {item.queueLinkState || 'unlinked'}</div>
                                        </div>
                                    </div>
                                ) : null}
                            </article>
                        );
                    })}
                </div>
            )) : null}

            {studioMode === 'review' ? (
                <div className="grid gap-3 lg:grid-cols-2">
                    {reviewItems.length ? reviewItems.map((item) => {
                        const blockers = readinessById[item.id]?.blockers || [];
                        const pendingCount = pendingCountsById[item.id] || 0;
                        return (
                            <article key={`review-${item.id}`} className={`${surfaceClass} p-4`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{getRunOfShowItemLabel(item.type)}</div>
                                        <div className="mt-1 text-lg font-black text-white">{item.title || getRunOfShowItemLabel(item.type)}</div>
                                        <div className="mt-1 text-sm text-zinc-400">{itemSummary(item)}</div>
                                    </div>
                                    <button type="button" onClick={() => openItem(item.id)} className="rounded-full border border-cyan-300/35 bg-cyan-500/12 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                                        Open Inspector
                                    </button>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {pendingCount > 0 ? (
                                        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
                                            {pendingCount} pending approval{pendingCount === 1 ? '' : 's'}
                                        </span>
                                    ) : null}
                                    {blockers.length ? blockers.map((blocker) => (
                                        <span key={`${item.id}-${blocker}`} className="rounded-full border border-rose-300/30 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-rose-100">
                                            {String(blocker || '').replaceAll('_', ' ')}
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

