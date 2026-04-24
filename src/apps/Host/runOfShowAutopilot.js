import {
    buildDeadAirFillerPayload,
    buildDeadAirFillerSongPlan,
    getDeadAirFillerModeForAssist,
} from './deadAirAutopilot.js';

const normalizeText = (value = '') => String(value || '').trim();
const normalizeKeyText = (value = '') => normalizeText(value).toLowerCase();

export const getRunOfShowAssistLevelForPolicy = (automationPresetId = 'balanced') => {
    const safePreset = normalizeKeyText(automationPresetId || 'balanced');
    if (safePreset === 'autopilot') return 'autopilot_first';
    if (safePreset === 'hands_on') return 'manual_first';
    return 'smart_assist';
};

export const buildRunOfShowGeneratorSeedFromMissionControl = (missionControl = {}) => {
    const setupDraft = missionControl?.setupDraft && typeof missionControl.setupDraft === 'object'
        ? missionControl.setupDraft
        : {};
    const assistLevel = normalizeKeyText(setupDraft.assistLevel);
    const archetype = normalizeKeyText(setupDraft.archetype || setupDraft.presetId);
    const spotlightMode = normalizeKeyText(setupDraft.spotlightMode || setupDraft.primaryMode);
    const seed = {};

    if (assistLevel === 'autopilot_first') seed.automationPresetId = 'autopilot';
    else if (assistLevel === 'manual_first') seed.automationPresetId = 'hands_on';
    else if (assistLevel === 'smart_assist') seed.automationPresetId = 'balanced';

    if (archetype === 'competition') seed.format = 'competition';
    else if (archetype === 'fundraiser') seed.format = 'fundraiser';
    else if (archetype === 'corporate_private' || archetype === 'private') seed.format = 'corporate_private';
    else if (spotlightMode && spotlightMode !== 'karaoke') seed.format = 'mixed_variety';
    else if (archetype) seed.format = 'karaoke_heavy';

    return seed;
};

export const buildRunOfShowAutopilotPlan = (config = {}) => {
    const automationPresetId = normalizeKeyText(config?.automationPresetId || 'balanced') || 'balanced';
    const assistLevel = getRunOfShowAssistLevelForPolicy(automationPresetId);
    const songs = buildDeadAirFillerSongPlan({ limit: 6 });
    const deadAirFiller = buildDeadAirFillerPayload({
        assistLevel,
        delaySec: assistLevel === 'autopilot_first' ? 8 : 12,
        songs,
        songLimit: 6,
    });
    const performanceCount = Math.max(0, Number(config?.performanceCount || 0) || 0);
    const mode = getDeadAirFillerModeForAssist(assistLevel);
    const modeLabel = mode === 'auto_fill'
        ? 'Auto-fill'
        : mode === 'suggest'
            ? 'Suggest'
            : 'Off';
    const summary = mode === 'auto_fill'
        ? 'Auto-fills dead air with known-good browse songs when the night needs a bridge.'
        : mode === 'suggest'
            ? 'Keeps known-good filler songs ready for host approval during recovery gaps.'
            : 'Keeps dead-air filler off and leaves recovery choices to the host.';

    return {
        automationPresetId,
        assistLevel,
        deadAirFiller,
        modeLabel,
        summary,
        flowNodes: [
            { id: 'outline', label: 'Outline' },
            { id: 'slots', label: `${performanceCount} Singer Slots` },
            {
                id: 'dead_air',
                label: mode === 'auto_fill'
                    ? 'Dead-Air Bridge'
                    : mode === 'suggest'
                        ? 'Recovery Suggestions'
                        : 'Host Recovery'
            },
        ],
    };
};

export const buildRunOfShowBufferPlan = ({
    config = {},
    durationSec = 30,
    index = 1,
} = {}) => {
    const autopilotPlan = buildRunOfShowAutopilotPlan(config);
    const mode = autopilotPlan.deadAirFiller.mode;
    const plannedDurationSec = Math.max(10, Number(durationSec || 30) || 30);
    const firstSongs = (autopilotPlan.deadAirFiller.songs || [])
        .slice(0, 3)
        .map((song) => [song.title, song.artist].filter(Boolean).join(' by '))
        .filter(Boolean);
    const songLine = firstSongs.length ? ` Candidates: ${firstSongs.join(', ')}.` : '';

    if (mode === 'auto_fill') {
        return {
            title: index > 1 ? `Dead-Air Bridge ${index}` : 'Dead-Air Bridge',
            plannedDurationSec,
            notes: `Autopilot bridge using known-good browse songs if the planned timeline or live queue needs cover.${songLine}`,
            presentationPlan: {
                publicTvTakeoverEnabled: true,
                headline: 'Dead-Air Bridge',
                subhead: 'A known-good filler song is ready if the room needs cover.',
                takeoverScene: 'buffer',
                accentTheme: 'cyan'
            }
        };
    }

    if (mode === 'suggest') {
        return {
            title: index > 1 ? `Recovery Buffer ${index}` : 'Recovery Buffer',
            plannedDurationSec,
            notes: `Suggest a known-good browse song if the room needs a timing reset.${songLine}`,
            presentationPlan: {
                headline: 'Recovery Buffer',
                subhead: 'Known-good filler suggestions are ready for host approval.',
                takeoverScene: 'buffer',
                accentTheme: 'cyan'
            }
        };
    }

    return {
        title: index > 1 ? `Recovery Buffer ${index}` : 'Recovery Buffer',
        plannedDurationSec,
        notes: 'Use this if the room needs a timing reset.',
        presentationPlan: {
            headline: 'Recovery Buffer',
            subhead: 'Host-controlled timing reset.',
            takeoverScene: 'buffer',
            accentTheme: 'zinc'
        }
    };
};
