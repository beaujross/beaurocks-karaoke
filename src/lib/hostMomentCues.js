import {
    RUN_OF_SHOW_MOMENT_CUE_IDS,
    RUN_OF_SHOW_MOMENT_CUE_TIMINGS
} from './runOfShowDirector.js';

export const HOST_MOMENT_CUES = Object.freeze([
    Object.freeze({
        id: 'hype',
        label: 'Hype',
        icon: 'fa-bolt',
        detail: 'Lift the room fast',
        editorHint: 'Use for intros, energy spikes, or crowd lift moments.',
        toneClass: 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100',
        chipClass: 'border-fuchsia-300/30 bg-fuchsia-500/12 text-fuchsia-100',
        soundCandidates: Object.freeze(['Airhorn', 'Crowd Cheer', 'Cheer'])
    }),
    Object.freeze({
        id: 'celebrate',
        label: 'Celebrate',
        icon: 'fa-stars',
        detail: 'Pay off a big moment',
        editorHint: 'Use after wins, milestones, sing-offs, or crowd applause peaks.',
        toneClass: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
        chipClass: 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100',
        soundCandidates: Object.freeze(['Crowd Cheer', 'Applause', 'Cheer'])
    }),
    Object.freeze({
        id: 'reveal',
        label: 'Reveal',
        icon: 'fa-wand-magic-sparkles',
        detail: 'Set up a payoff',
        editorHint: 'Use for trivia reveals, countdown payoffs, and challenge results.',
        toneClass: 'border-amber-300/30 bg-amber-500/10 text-amber-100',
        chipClass: 'border-amber-300/30 bg-amber-500/12 text-amber-100',
        soundCandidates: Object.freeze(['Drumroll'])
    }),
    Object.freeze({
        id: 'next_up',
        label: 'Next Up',
        icon: 'fa-microphone-lines',
        detail: 'Tee up the next act',
        editorHint: 'Use when a scene introduces the next singer or next block.',
        toneClass: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100',
        chipClass: 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100',
        soundCandidates: Object.freeze(['Cowbell', 'Applause'])
    }),
    Object.freeze({
        id: 'reset',
        label: 'Reset',
        icon: 'fa-rotate-left',
        detail: 'Clear back to neutral',
        editorHint: 'Use after a crowd beat when the room needs a clean baseline again.',
        toneClass: 'border-white/15 bg-white/5 text-zinc-100',
        chipClass: 'border-white/12 bg-white/6 text-zinc-100',
        soundCandidates: Object.freeze(['Scratch'])
    })
]);

export const HOST_MOMENT_CUE_BY_ID = Object.freeze(
    HOST_MOMENT_CUES.reduce((acc, cue) => {
        acc[cue.id] = cue;
        return acc;
    }, {})
);

export const HOST_MOMENT_CUE_OPTIONS = Object.freeze(
    RUN_OF_SHOW_MOMENT_CUE_IDS
        .filter((value) => value)
        .map((value) => {
            const cue = HOST_MOMENT_CUE_BY_ID[value];
            return {
                value,
                label: cue?.label || value.replaceAll('_', ' '),
                detail: cue?.detail || '',
                icon: cue?.icon || 'fa-bolt',
                toneClass: cue?.toneClass || 'border-white/15 bg-white/5 text-zinc-100'
            };
        })
);

export const HOST_MOMENT_CUE_TIMING_OPTIONS = Object.freeze(
    RUN_OF_SHOW_MOMENT_CUE_TIMINGS.map((value) => ({
        value,
        label: value === 'end' ? 'When scene ends' : 'When scene starts'
    }))
);

export const getHostMomentCueMeta = (momentId = '') => HOST_MOMENT_CUE_BY_ID[String(momentId || '').trim().toLowerCase()] || null;

export const getHostMomentCueSoundCandidates = (momentId = '') => {
    const cue = getHostMomentCueMeta(momentId);
    return Array.isArray(cue?.soundCandidates) ? cue.soundCandidates : [];
};

export const formatHostMomentCueSummary = (audioPlan = {}) => {
    const cueId = String(audioPlan?.momentCueId || '').trim().toLowerCase();
    if (!cueId) return '';
    const cue = getHostMomentCueMeta(cueId);
    const cueLabel = cue?.label || cueId.replaceAll('_', ' ');
    const cueTiming = String(audioPlan?.momentCueTiming || 'start').trim().toLowerCase() || 'start';
    return `${cueLabel} ${cueTiming === 'end' ? 'on end' : 'on start'}`;
};
