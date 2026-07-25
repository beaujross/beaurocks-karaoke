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
        performanceMode: 'karaoke',
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
        description: 'Original tracks, big-screen lyrics when available, and group-friendly turns.',
        presetId: 'casual',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        performanceMode: 'sing_along',
        icon: 'fa-people-group',
        accent: 'from-fuchsia-500/24 via-violet-500/8 to-transparent',
        overrides: {
            showScoring: false,
            showLyricsTv: true,
            autoLyricsOnQueue: true,
        },
        requirements: {
            originalRecording: true,
            lyrics: 'preferred',
        },
        party: {
            autoCrowdMomentsEnabled: false,
        },
    },
    {
        id: 'lip_sync_night',
        label: 'Lip Sync Night',
        eyebrow: 'Performance first',
        description: 'Original vocals, optional lyrics, and crowd reactions focused on the show.',
        presetId: 'casual',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        performanceMode: 'lip_sync',
        icon: 'fa-star',
        accent: 'from-violet-500/24 via-pink-500/10 to-transparent',
        overrides: {
            showScoring: false,
            autoLyricsOnQueue: false,
        },
        requirements: {
            originalRecording: true,
            lyrics: 'optional',
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
        performanceMode: 'karaoke',
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
        performanceMode: 'karaoke',
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

const getPerformanceModeLabel = (performanceMode = '') => ({
    karaoke: 'Karaoke',
    sing_along: 'Sing-Along',
    lip_sync: 'Lip Sync',
}[performanceMode] || 'Karaoke');

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
        { label: 'Format', value: getPerformanceModeLabel(recipe.performanceMode) },
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
        performanceMode: normalizeText(stored.performanceMode) || 'karaoke',
        icon: 'fa-bookmark',
        accent: 'from-fuchsia-500/22 via-cyan-500/8 to-transparent',
        overrides: stored.overrides && typeof stored.overrides === 'object' ? { ...stored.overrides } : {},
        requirements: stored.requirements && typeof stored.requirements === 'object' ? { ...stored.requirements } : {},
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
    && normalizeText(selection.performanceMode || 'karaoke') === normalizeText(recipe.performanceMode || 'karaoke')
);

export const getPerformanceModeRequirements = (performanceMode = '') => {
    const normalized = normalizeText(performanceMode).toLowerCase();
    if (normalized === 'sing_along') return { originalRecording: true, lyrics: 'preferred' };
    if (normalized === 'lip_sync') return { originalRecording: true, lyrics: 'optional' };
    return {};
};

export const buildRoomSetupRecipePreflight = (recipe = {}, {
    searchSources = {},
    appleMusicAuthorized = false,
    localTrackCount = 0,
} = {}) => {
    const requirements = recipe?.requirements && typeof recipe.requirements === 'object'
        ? recipe.requirements
        : getPerformanceModeRequirements(recipe?.performanceMode);
    if (!requirements.originalRecording && !requirements.lyrics) return null;

    let status = 'action';
    let provider = '';
    let title = 'Choose a playback source';
    let detail = 'Enable a source with the recording this format needs.';

    if (searchSources.itunes !== false && appleMusicAuthorized) {
        status = 'ready';
        provider = 'apple';
        title = 'Apple Music connected';
        detail = 'Original recordings are ready for host playback.';
    } else if (searchSources.local !== false && Number(localTrackCount || 0) > 0) {
        status = 'review';
        provider = 'local';
        title = 'Local media available';
        detail = 'Confirm which local files contain the original recording before using Auto-DJ.';
    } else if (searchSources.youtube !== false) {
        status = 'review';
        provider = 'youtube';
        title = 'Pick an original version per song';
        detail = 'YouTube is available, but the host should confirm each requested version.';
    } else if (searchSources.itunes !== false) {
        provider = 'apple';
        title = 'Connect Apple Music';
        detail = 'Connect the host account before relying on original recordings.';
    }

    if (requirements.lyrics === 'preferred') {
        detail += ' Lyrics appear only when an authorized or host-supplied source provides them.';
    }

    return { status, provider, title, detail };
};

export const BUILTIN_ROOM_SETUP_RECIPES = BUILTIN_RECIPE_DEFINITIONS;
