import { EMOJI, emoji } from './emoji';

export const SPOTLIGHT_KINDS = Object.freeze({
    audience: 'audience_spotlight',
    tight15: 'tight15_showcase'
});

export const AUDIENCE_SPOTLIGHT_MODES = Object.freeze({
    cheer: 'cheer',
    qa: 'qa',
    roast: 'roast'
});

export const AUDIENCE_SPOTLIGHT_MODE_OPTIONS = Object.freeze([
    { id: AUDIENCE_SPOTLIGHT_MODES.cheer, label: 'Cheer', icon: 'fa-solid fa-sparkles' },
    { id: AUDIENCE_SPOTLIGHT_MODES.qa, label: 'Q&A', icon: 'fa-solid fa-comments' },
    { id: AUDIENCE_SPOTLIGHT_MODES.roast, label: 'Roast', icon: 'fa-solid fa-fire-flame-curved' }
]);

const AUDIENCE_SPOTLIGHT_PROMPTS = Object.freeze({
    [AUDIENCE_SPOTLIGHT_MODES.cheer]: [
        { title: 'Crowd Work', body: 'Give the room a wave and throw a couple of reactions onto the TV.', badge: 'Crowd Work' },
        { title: 'Tell The Room', body: 'Host prompt: ask them who they came with or what brought them out tonight.', badge: 'Host Cue' },
        { title: 'Energy Check', body: 'Let them pump up one side of the room, then answer back with phone reactions.', badge: 'Room Pop' }
    ],
    [AUDIENCE_SPOTLIGHT_MODES.qa]: [
        { title: 'Fun Q&A', body: 'What song always gets you on stage first?', badge: 'Question 1' },
        { title: 'Fun Q&A', body: 'Who in this room would you trust with the aux?', badge: 'Question 2' },
        { title: 'Fun Q&A', body: 'What is your walk-on anthem if the host calls your name right now?', badge: 'Question 3' }
    ],
    [AUDIENCE_SPOTLIGHT_MODES.roast]: [
        { title: 'Roast Setup', body: 'Host cue: ask the room for one playful roast and keep it light.', badge: 'Roast 1' },
        { title: 'Roast Setup', body: 'Make them defend their hottest karaoke take before the crowd reacts.', badge: 'Roast 2' },
        { title: 'Roast Setup', body: 'Ask which friend in the room would sell out their group chat first.', badge: 'Roast 3' }
    ]
});

const AUDIENCE_SPOTLIGHT_REACTION_SETS = Object.freeze({
    [AUDIENCE_SPOTLIGHT_MODES.cheer]: [
        { type: 'spotlight_wave', label: 'Wave', accentClass: 'border-cyan-300/40 bg-cyan-500/15 text-cyan-50' },
        { type: 'spotlight_heart', label: 'Love', accentClass: 'border-pink-300/40 bg-pink-500/15 text-pink-50' },
        { type: 'spotlight_fire', label: 'Heat', accentClass: 'border-orange-300/40 bg-orange-500/15 text-orange-50' },
        { type: 'spotlight_mic', label: 'Mic', accentClass: 'border-violet-300/40 bg-violet-500/15 text-violet-50' }
    ],
    [AUDIENCE_SPOTLIGHT_MODES.qa]: [
        { type: 'spotlight_question', label: 'Question', accentClass: 'border-cyan-300/40 bg-cyan-500/15 text-cyan-50' },
        { type: 'spotlight_truth', label: 'Story', accentClass: 'border-emerald-300/40 bg-emerald-500/15 text-emerald-50' },
        { type: 'spotlight_shrug', label: 'Unsure', accentClass: 'border-amber-300/40 bg-amber-500/15 text-amber-50' },
        { type: 'spotlight_mic', label: 'Answer', accentClass: 'border-violet-300/40 bg-violet-500/15 text-violet-50' }
    ],
    [AUDIENCE_SPOTLIGHT_MODES.roast]: [
        { type: 'spotlight_laugh', label: 'Laugh', accentClass: 'border-fuchsia-300/40 bg-fuchsia-500/15 text-fuchsia-50' },
        { type: 'spotlight_skull', label: 'Cooked', accentClass: 'border-zinc-300/40 bg-zinc-500/15 text-zinc-50' },
        { type: 'spotlight_clap', label: 'Good One', accentClass: 'border-cyan-300/40 bg-cyan-500/15 text-cyan-50' },
        { type: 'spotlight_micdrop', label: 'Mic Drop', accentClass: 'border-rose-300/40 bg-rose-500/15 text-rose-50' }
    ]
});

export const normalizeSpotlightKind = (value = '') => {
    const key = String(value || '').trim().toLowerCase();
    if (key === SPOTLIGHT_KINDS.tight15) return SPOTLIGHT_KINDS.tight15;
    if (key === SPOTLIGHT_KINDS.audience) return SPOTLIGHT_KINDS.audience;
    return '';
};

export const normalizeAudienceSpotlightMode = (value = '') => {
    const key = String(value || '').trim().toLowerCase();
    return Object.values(AUDIENCE_SPOTLIGHT_MODES).includes(key)
        ? key
        : AUDIENCE_SPOTLIGHT_MODES.cheer;
};

export const inferSpotlightKind = (payload = null) => {
    const explicitKind = normalizeSpotlightKind(payload?.kind);
    if (explicitKind) return explicitKind;
    if (payload?.challengeSong) return SPOTLIGHT_KINDS.tight15;
    if (payload?.id) return SPOTLIGHT_KINDS.audience;
    return '';
};

export const getAudienceSpotlightPromptCatalog = (mode = '') => (
    AUDIENCE_SPOTLIGHT_PROMPTS[normalizeAudienceSpotlightMode(mode)] || AUDIENCE_SPOTLIGHT_PROMPTS[AUDIENCE_SPOTLIGHT_MODES.cheer]
);

export const buildAudienceSpotlightPrompt = (mode = '', index = 0) => {
    const safeMode = normalizeAudienceSpotlightMode(mode);
    const catalog = getAudienceSpotlightPromptCatalog(safeMode);
    const maxIndex = Math.max(0, catalog.length - 1);
    const numericIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
    const safeIndex = maxIndex > 0
        ? ((numericIndex % catalog.length) + catalog.length) % catalog.length
        : 0;
    const prompt = catalog[safeIndex] || catalog[0];
    return {
        mode: safeMode,
        index: safeIndex,
        title: prompt?.title || 'Audience Spotlight',
        body: prompt?.body || 'Give the room a wave and throw a couple of reactions onto the TV.',
        badge: prompt?.badge || 'Live'
    };
};

export const getAudienceSpotlightMessage = (mode = '') => {
    const safeMode = normalizeAudienceSpotlightMode(mode);
    if (safeMode === AUDIENCE_SPOTLIGHT_MODES.qa) return 'Fun Q&A live';
    if (safeMode === AUDIENCE_SPOTLIGHT_MODES.roast) return 'Friendly roast live';
    return 'Audience spotlight live';
};

export const getAudienceSpotlightModeMeta = (mode = '') => (
    AUDIENCE_SPOTLIGHT_MODE_OPTIONS.find((entry) => entry.id === normalizeAudienceSpotlightMode(mode))
    || AUDIENCE_SPOTLIGHT_MODE_OPTIONS[0]
);

export const getAudienceSpotlightReactions = (mode = '') => (
    AUDIENCE_SPOTLIGHT_REACTION_SETS[normalizeAudienceSpotlightMode(mode)]
    || AUDIENCE_SPOTLIGHT_REACTION_SETS[AUDIENCE_SPOTLIGHT_MODES.cheer]
);

export const getAudienceSpotlightReactionEmoji = (type = '') => ({
    spotlight_wave: EMOJI.wave,
    spotlight_heart: EMOJI.heart,
    spotlight_fire: EMOJI.fire,
    spotlight_mic: EMOJI.mic,
    spotlight_question: EMOJI.question,
    spotlight_truth: emoji(0x1F4AC),
    spotlight_shrug: emoji(0x1F937),
    spotlight_laugh: emoji(0x1F602),
    spotlight_skull: EMOJI.skull,
    spotlight_clap: EMOJI.clap,
    spotlight_micdrop: emoji(0x1F3A4)
}[String(type || '').trim().toLowerCase()] || EMOJI.sparkle);
