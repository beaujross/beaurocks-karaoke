const BUILTIN_RECIPE_DEFINITIONS = Object.freeze([
    {
        id: 'party_karaoke',
        label: 'Party Karaoke',
        eyebrow: 'Easygoing',
        description: 'An open queue, broad song search, and light help keeping the night moving.',
        presetId: 'casual',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        icon: 'fa-microphone-lines',
        accent: 'from-cyan-500/24 via-sky-500/8 to-transparent',
        overrides: {},
        party: {
            autoCrowdMomentsEnabled: false,
        },
    },
    {
        id: 'crowd_singalong',
        label: 'Crowd Sing-Along',
        eyebrow: 'Lyrics first',
        description: 'Apple Music, generated lyrics, and full-song performances built for singing together.',
        presetId: 'competition',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        icon: 'fa-people-group',
        accent: 'from-fuchsia-500/24 via-violet-500/8 to-transparent',
        overrides: {
            showScoring: false,
        },
        party: {
            autoCrowdMomentsEnabled: false,
        },
    },
    {
        id: 'score_challenge',
        label: 'Score Challenge',
        eyebrow: 'Competitive',
        description: 'Visible scoring, fair turns, Fame, and a tighter host-controlled queue.',
        presetId: 'competition',
        flowRule: 'fair_turns',
        assistLevel: 'manual_first',
        spotlightMode: 'karaoke',
        icon: 'fa-trophy',
        accent: 'from-amber-500/26 via-yellow-500/8 to-transparent',
        overrides: {
            showScoring: true,
        },
        party: {
            autoCrowdMomentsEnabled: false,
        },
    },
    {
        id: 'karaoke_trivia',
        label: 'Karaoke + Trivia',
        eyebrow: 'Variety',
        description: 'A karaoke-first night with short trivia and choice breaks every few singers.',
        presetId: 'casual',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        icon: 'fa-lightbulb',
        accent: 'from-emerald-500/24 via-cyan-500/8 to-transparent',
        overrides: {
            popTriviaEnabled: true,
        },
        party: {
            autoCrowdMomentsEnabled: true,
            autoCrowdMomentEverySongs: 3,
            autoCrowdMomentPreferredTypes: ['trivia', 'would_you_rather'],
        },
    },
]);

const normalizeText = (value = '') => String(value || '').trim();

const inferFlowRule = (preset = {}) => {
    const queue = preset?.settings?.queueSettings || {};
    if (normalizeText(queue.limitMode) === 'per_night') return 'fair_turns';
    if (normalizeText(queue.limitMode) === 'per_hour' || normalizeText(queue.rotation) === 'first_come') return 'rapid_fire';
    return 'balanced';
};

const inferAssistLevel = (preset = {}) => {
    if (preset?.settings?.autoDj && preset?.settings?.autoPlayMedia !== false) return 'autopilot_first';
    if (preset?.settings?.autoDj || preset?.settings?.autoPlayMedia !== false) return 'smart_assist';
    return 'manual_first';
};

const getMediaLabel = (preset = {}) => {
    const sources = preset?.searchSources || {};
    const labels = [
        sources.itunes !== false ? 'Apple Music' : '',
        sources.youtube !== false ? 'YouTube' : '',
        sources.local !== false ? 'Local' : '',
    ].filter(Boolean);
    return labels.length ? labels.join(' + ') : 'Curated only';
};

const getFlowLabel = (flowRule = '') => ({
    balanced: 'Balanced turns',
    fair_turns: 'Fair-turn cap',
    rapid_fire: 'Fast rotation',
}[flowRule] || 'Balanced turns');

const getAssistLabel = (assistLevel = '') => ({
    manual_first: 'Host controlled',
    smart_assist: 'Suggestions',
    autopilot_first: 'Auto-fill gaps',
}[assistLevel] || 'Suggestions');

const buildFacts = (recipe = {}, preset = {}) => {
    const settings = {
        ...(preset?.settings || {}),
        ...(recipe?.overrides || {}),
    };
    const cadence = recipe?.party?.autoCrowdMomentsEnabled
        ? `Every ${Math.max(1, Number(recipe.party.autoCrowdMomentEverySongs || 3))} singers`
        : 'No automatic breaks';
    return [
        { label: 'Songs', value: getMediaLabel(preset) },
        { label: 'Queue', value: getFlowLabel(recipe.flowRule) },
        { label: 'Host help', value: getAssistLabel(recipe.assistLevel) },
        { label: 'Scoring', value: settings.showScoring === false ? 'Off' : 'On' },
        { label: 'Between songs', value: cadence },
    ];
};

const buildSavedRecipe = (preset = {}) => {
    const stored = preset?.recipe && typeof preset.recipe === 'object' ? preset.recipe : {};
    const flowRule = normalizeText(stored.flowRule) || inferFlowRule(preset);
    const assistLevel = normalizeText(stored.assistLevel) || inferAssistLevel(preset);
    const recipe = {
        id: `saved_${preset.id}`,
        label: normalizeText(preset.label) || 'Saved Recipe',
        eyebrow: 'Saved recipe',
        description: normalizeText(preset.description) || 'Your saved room setup.',
        presetId: preset.id,
        flowRule,
        assistLevel,
        spotlightMode: normalizeText(stored.spotlightMode) || normalizeText(preset?.settings?.gamePreviewId) || 'karaoke',
        icon: 'fa-bookmark',
        accent: 'from-fuchsia-500/22 via-cyan-500/8 to-transparent',
        overrides: stored.overrides && typeof stored.overrides === 'object' ? { ...stored.overrides } : {},
        party: stored.party && typeof stored.party === 'object' ? { ...stored.party } : {},
        isSaved: true,
    };
    return {
        ...recipe,
        facts: buildFacts(recipe, preset),
    };
};

export const buildRoomSetupRecipeCards = ({ presets = [] } = {}) => {
    const presetMap = new Map((Array.isArray(presets) ? presets : []).map((preset) => [preset?.id, preset]));
    const builtIns = BUILTIN_RECIPE_DEFINITIONS.map((definition) => {
        const preset = presetMap.get(definition.presetId) || {};
        return {
            ...definition,
            facts: buildFacts(definition, preset),
        };
    });
    const saved = (Array.isArray(presets) ? presets : [])
        .filter((preset) => preset && !preset.isBuiltIn && normalizeText(preset.id))
        .map(buildSavedRecipe);
    return [...builtIns, ...saved];
};

export const isRoomSetupRecipeSelected = (recipe = {}, selection = {}) => (
    normalizeText(selection.archetype) === normalizeText(recipe.presetId)
    && normalizeText(selection.flowRule) === normalizeText(recipe.flowRule)
    && normalizeText(selection.assistLevel) === normalizeText(recipe.assistLevel)
    && normalizeText(selection.spotlightMode || 'karaoke') === normalizeText(recipe.spotlightMode || 'karaoke')
);

export const BUILTIN_ROOM_SETUP_RECIPES = BUILTIN_RECIPE_DEFINITIONS;
