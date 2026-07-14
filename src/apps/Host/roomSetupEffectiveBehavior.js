import { getRoomCurrencyPresentation } from '../../lib/roomCurrencyPresentation.js';
import { getRoomEconomySummary } from '../../lib/roomEconomySummary.js';

export const ROOM_SETUP_BEHAVIOR_VERSION = 1;

export const ROOM_SETUP_BEHAVIOR_DOMAINS = Object.freeze([
    Object.freeze({ key: 'operating_style', label: 'Operating style' }),
    Object.freeze({ key: 'crowd_experience', label: 'Crowd experience' }),
    Object.freeze({ key: 'economics', label: 'Points + BeauBucks' }),
    Object.freeze({ key: 'media', label: 'Media + catalog' }),
    Object.freeze({ key: 'advanced_exceptions', label: 'Advanced exceptions' }),
]);

const DOMAIN_PATHS = Object.freeze({
    operating_style: Object.freeze([
        'autoDj',
        'autoDjDelaySec',
        'autoPlayMedia',
        'autoEndOnTrackFinish',
        'queueSettings',
        'missionControl.setupDraft.assistLevel',
        'missionControl.party',
    ]),
    crowd_experience: Object.freeze([
        'gamePreviewId',
        'showScoring',
        'showFameLevel',
        'chatShowOnTv',
        'marqueeEnabled',
        'popTriviaEnabled',
        'audienceShellVariant',
        'audienceFeatureAccess',
        'audienceJoinPolicy.accessMode',
        'eventCredits.audienceAccessMode',
    ]),
    economics: Object.freeze([
        'eventCredits',
        'autoBonusEnabled',
        'autoBonusPoints',
        'tipPointRate',
    ]),
    media: Object.freeze([
        'requestMode',
        'allowSingerTrackSelect',
        'hideNonEmbeddableYouTube',
        'autoBgMusic',
        'autoLyricsOnQueue',
        'showLyricsTv',
        'searchSources',
        'hostNightPresetConfig.searchSources',
    ]),
    advanced_exceptions: Object.freeze([
        'missionControl.advancedOverrides',
        'missionControl.party',
        'eventProfileId',
        'eventProfileLabel',
        'runOfShowEnabled',
        'runOfShowDirector',
    ]),
});

const TRACKED_ROOTS = new Set(
    Object.values(DOMAIN_PATHS).flat().map((path) => String(path || '').split('.')[0]).filter(Boolean),
);

const FORMAT_LABELS = Object.freeze({
    karaoke: 'Karaoke-first',
    bingo: 'Music bingo spotlight',
    team_pong: 'Team Pong spotlight',
    trivia_pop: 'Pop trivia spotlight',
    karaoke_bracket: 'Karaoke bracket spotlight',
    wyr: 'Would You Rather spotlight',
});

const isPlainObject = (value) => (
    !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const cloneValue = (value) => {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (!isPlainObject(value)) return value;
    return Object.entries(value).reduce((next, [key, entry]) => {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') return next;
        next[key] = cloneValue(entry);
        return next;
    }, {});
};

const selectTrackedValues = (value = {}) => {
    if (!isPlainObject(value)) return {};
    return Object.entries(value).reduce((next, [key, entry]) => {
        if (!TRACKED_ROOTS.has(key)) return next;
        next[key] = cloneValue(entry);
        return next;
    }, {});
};

const mergeLayer = (target, source, sourceId, provenance, prefix = '') => {
    if (!isPlainObject(source)) return target;
    Object.entries(source).forEach(([key, value]) => {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
        const path = prefix ? `${prefix}.${key}` : key;
        if (isPlainObject(value)) {
            if (!isPlainObject(target[key])) target[key] = {};
            mergeLayer(target[key], value, sourceId, provenance, path);
            return;
        }
        target[key] = cloneValue(value);
        provenance[path] = sourceId;
    });
    return target;
};

const readPath = (value, path) => String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, segment) => current?.[segment], value);

const stableValue = (value) => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!isPlainObject(value)) {
        if (value === undefined) return null;
        if (typeof value === 'number' && !Number.isFinite(value)) return null;
        return value;
    }
    return Object.keys(value)
        .sort()
        .reduce((next, key) => {
            next[key] = stableValue(value[key]);
            return next;
        }, {});
};

const sourceIdsForPaths = (paths, provenance) => {
    const matched = [];
    Object.entries(provenance).forEach(([fieldPath, sourceId]) => {
        if (paths.some((path) => fieldPath === path || fieldPath.startsWith(`${path}.`))) {
            matched.push(sourceId);
        }
    });
    return [...new Set(matched)];
};

const formatQueue = (queue = {}) => {
    const rotation = String(queue?.rotation || 'round_robin').trim().toLowerCase();
    const limitMode = String(queue?.limitMode || 'none').trim().toLowerCase();
    const limitCount = Math.max(0, Number(queue?.limitCount || 0) || 0);
    const rotationLabel = rotation === 'first_come' ? 'first come' : 'round robin';
    if (limitMode === 'per_night' && limitCount > 0) return `${rotationLabel}, ${limitCount} per singer tonight`;
    if (limitMode === 'per_hour' && limitCount > 0) return `${rotationLabel}, ${limitCount} per singer each hour`;
    return `${rotationLabel}, no request cap`;
};

const formatMode = (value = '') => {
    const token = String(value || 'karaoke').trim().toLowerCase() || 'karaoke';
    return FORMAT_LABELS[token] || `${token.replaceAll('_', ' ')} spotlight`;
};

const formatJoinAccess = (effective = {}) => {
    const mode = String(effective?.audienceJoinPolicy?.accessMode || effective?.eventCredits?.audienceAccessMode || 'open').trim().toLowerCase();
    if (mode === 'account') return 'BeauRocks account';
    if (mode === 'email' || mode === 'email_capture') return 'Email entry';
    if (mode === 'donation') return 'Support unlock';
    if (mode === 'email_or_donation') return 'Email or support unlock';
    if (mode === 'invite') return 'Invite only';
    return 'Open join link';
};

const formatRequestPolicy = (effective = {}) => {
    const mode = String(effective?.requestMode || '').trim().toLowerCase();
    if (mode === 'playable_only') return 'Only songs with an approved backing can be requested';
    if (mode === 'guest_backing_optional' || effective?.allowSingerTrackSelect === true) {
        return 'Guests pick songs and may choose a backing track';
    }
    return 'Guests pick canonical songs; the backing can be chosen later';
};

const getSearchSources = (effective = {}) => {
    const sources = effective?.searchSources || effective?.hostNightPresetConfig?.searchSources || {};
    const labels = [];
    if (sources?.local !== false) labels.push('BeauRocks + local files');
    if (sources?.youtube !== false) labels.push('YouTube');
    if (sources?.itunes !== false) labels.push('Apple catalog');
    return labels.length ? labels : ['Host-added media'];
};

const buildDomainProvenance = (domainKey, sourceById, provenance) => {
    const ids = sourceIdsForPaths(DOMAIN_PATHS[domainKey] || [], provenance);
    const ranked = ids
        .map((id) => sourceById.get(id))
        .filter(Boolean)
        .sort((a, b) => a.order - b.order);
    const primary = ranked.at(-1) || null;
    return {
        sourceId: primary?.id || '',
        sourceLabel: primary?.label || 'Current room',
        sourceType: primary?.type || 'room',
        sources: ranked.map((source) => ({
            id: source.id,
            label: source.label,
            type: source.type,
        })),
    };
};

const buildDomains = ({ effective, sourceById, provenance, exceptionCount = 0, context = {} }) => {
    const queue = effective?.queueSettings || {};
    const economy = getRoomEconomySummary(effective?.eventCredits || {});
    const currency = getRoomCurrencyPresentation(effective?.eventCredits || {});
    const spotlightMode = String(effective?.gamePreviewId || context?.spotlightMode || 'karaoke').trim().toLowerCase() || 'karaoke';
    const sourceLabels = getSearchSources(effective);
    const explicitExceptions = Math.max(0, Number(exceptionCount || 0) || 0);
    const eventProfileLabel = String(context?.eventProfileLabel || effective?.eventProfileLabel || '').trim();
    const operating = effective?.autoDj
        ? `Assisted flow with ${formatQueue(queue)}`
        : `Host-led flow with ${formatQueue(queue)}`;
    const crowdSignals = [
        effective?.showScoring !== false ? 'scoring on' : 'scoring off',
        effective?.chatShowOnTv ? 'TV chat on' : 'TV chat off',
        effective?.marqueeEnabled ? 'marquee on' : 'marquee off',
    ];
    const economicsSummary = economy.enabled
        ? `${economy.startingBalance} ${currency.plural} at entry${economy.refill.enabled ? `, +${economy.refill.amount} every ${economy.refill.intervalMin} min` : ', no automatic refill'}`
        : 'Participation points; no event wallet or paid-value balance';
    const exceptionsSummary = explicitExceptions > 0
        ? `${explicitExceptions} confirmed exception${explicitExceptions === 1 ? '' : 's'} override the main plan`
        : 'No advanced exceptions override the main plan';

    const definitions = {
        operating_style: {
            summary: operating,
            details: [
                { label: 'Queue', value: formatQueue(queue) },
                { label: 'Stage handoff', value: effective?.autoPlayMedia === false ? 'Host starts media' : 'Media starts with the stage action' },
                { label: 'Between singers', value: effective?.autoDj ? `Auto DJ after ${Math.max(2, Number(effective?.autoDjDelaySec || 10) || 10)}s` : 'Host controls the next move' },
            ],
        },
        crowd_experience: {
            summary: `${formatMode(spotlightMode)}; ${crowdSignals.join(', ')}`,
            details: [
                { label: 'Format', value: formatMode(spotlightMode) },
                { label: 'Guest entry', value: formatJoinAccess(effective) },
                { label: 'Audience feedback', value: effective?.showScoring !== false ? 'Scores and reactions are visible' : 'Reactions stay playful without public scores' },
                { label: 'TV extras', value: [effective?.chatShowOnTv && 'chat', effective?.marqueeEnabled && 'marquee', effective?.popTriviaEnabled && 'pop trivia'].filter(Boolean).join(', ') || 'No extra overlays by default' },
            ],
        },
        economics: {
            summary: economicsSummary,
            details: [
                { label: 'Guest balance', value: economy.enabled ? `${economy.startingBalance} ${currency.plural}` : 'Participation points only' },
                { label: 'Refills', value: economy.refill.enabled ? `${economy.refill.amount} every ${economy.refill.intervalMin} min; cap ${economy.refill.cap || 'none'}` : 'No automatic refill' },
                { label: 'Real-money support', value: economy.support.connected ? (economy.support.label || 'Connected support destination') : 'No external checkout connected' },
            ],
            warnings: economy.warnings,
        },
        media: {
            summary: `${formatRequestPolicy(effective)}. Browse ${sourceLabels.join(', ')}.`,
            details: [
                { label: 'Catalog', value: sourceLabels.join(', ') },
                { label: 'Requests', value: formatRequestPolicy(effective) },
                { label: 'YouTube safety', value: effective?.hideNonEmbeddableYouTube === false ? 'Host may review unverified results' : 'Non-embeddable results stay hidden' },
                { label: 'Background audio', value: effective?.autoBgMusic ? 'Enabled between performances' : 'Host-controlled' },
            ],
        },
        advanced_exceptions: {
            summary: eventProfileLabel ? `${exceptionsSummary}; ${eventProfileLabel} profile is active` : exceptionsSummary,
            details: [
                { label: 'Overrides', value: explicitExceptions > 0 ? `${explicitExceptions} active` : 'None' },
                { label: 'Event profile', value: eventProfileLabel || 'None' },
                { label: 'Run of show', value: effective?.runOfShowEnabled ? 'Enabled' : 'Not required' },
            ],
        },
    };

    return ROOM_SETUP_BEHAVIOR_DOMAINS.map((domain) => {
        const resolvedProvenance = buildDomainProvenance(domain.key, sourceById, provenance);
        const directSource = domain.key === 'advanced_exceptions' && explicitExceptions > 0
            ? [...sourceById.values()].filter((source) => source.type === 'direct_edit' || source.type === 'override').at(-1)
            : null;
        return {
            ...domain,
            ...definitions[domain.key],
            provenance: directSource ? {
                sourceId: directSource.id,
                sourceLabel: directSource.label,
                sourceType: directSource.type,
                sources: [
                    ...resolvedProvenance.sources.filter((source) => source.id !== directSource.id),
                    { id: directSource.id, label: directSource.label, type: directSource.type },
                ],
            } : resolvedProvenance,
        };
    });
};

export const resolveRoomSetupEffectiveBehavior = ({
    layers = [],
    effectiveRoom = null,
    exceptionCount = 0,
    context = {},
} = {}) => {
    const normalizedLayers = (Array.isArray(layers) && layers.length > 0
        ? layers
        : [{ id: 'current_room', label: 'Current room', type: 'room', values: effectiveRoom || {} }]
    ).map((layer, order) => ({
        id: String(layer?.id || `source_${order + 1}`).trim() || `source_${order + 1}`,
        label: String(layer?.label || 'Current room').trim() || 'Current room',
        type: String(layer?.type || 'room').trim().toLowerCase() || 'room',
        values: selectTrackedValues(layer?.values),
        order,
    }));
    const sourceById = new Map(normalizedLayers.map((source) => [source.id, source]));
    const provenance = {};
    const effective = normalizedLayers.reduce(
        (next, source) => mergeLayer(next, source.values, source.id, provenance),
        {},
    );
    const behaviorSnapshot = Object.values(DOMAIN_PATHS)
        .flat()
        .filter((path) => !path.startsWith('missionControl.advancedOverrides'))
        .reduce((next, path) => {
            next[path] = stableValue(readPath(effective, path));
            return next;
        }, {});
    const domains = buildDomains({ effective, sourceById, provenance, exceptionCount, context });

    return {
        version: ROOM_SETUP_BEHAVIOR_VERSION,
        behaviorKey: JSON.stringify(stableValue(behaviorSnapshot)),
        effective,
        domains,
        provenance: {
            sources: normalizedLayers.map(({ id, label, type }) => ({ id, label, type })),
            fields: { ...provenance },
        },
    };
};

export default resolveRoomSetupEffectiveBehavior;
