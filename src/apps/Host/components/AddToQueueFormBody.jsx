import React from 'react';
import { HOST_LIVE_OPS_LANGUAGE } from '../hostLiveOpsLanguage';
import { GAMES_META } from '../../../lib/gameRegistry';
import { getGameLifecycleLabel } from '../../../lib/gameLaunchCompatibility';
import {
    HOST_GAME_MOMENT_BUNDLE_IDS,
    filterGamesForHostMomentBundle,
    getHostGameMomentBundle,
    summarizeHostGameMomentBundles
} from '../../../lib/hostGameMomentBundles';
import { resolveRoomUserUid } from '../../../lib/gameLaunchSupport';
import {
    YOUTUBE_PLAYBACK_STATUSES,
    normalizeYouTubePlaybackState
} from '../../../lib/youtubePlaybackStatus';
import { getBackingSourceLabel } from '../../../lib/playbackSource';

const baseResultsCardClass = 'rounded-2xl border border-cyan-400/25 bg-zinc-950/98';

const resultMetaChipBaseClass = 'inline-flex h-5 items-center rounded-full border px-2 text-[9px] font-black uppercase tracking-[0.12em]';

const resultMetaChipToneClasses = Object.freeze({
    neutral: 'border-white/10 bg-white/5 text-zinc-200',
    ready: 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100',
    apple: 'border-pink-300/35 bg-pink-500/10 text-pink-100',
    external: 'border-orange-300/40 bg-orange-500/10 text-orange-100',
    local: 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100',
    youtube: 'border-red-300/35 bg-red-500/10 text-red-100',
    violet: 'border-violet-300/30 bg-violet-500/10 text-violet-100',
});

const getResultMetaChipClass = (tone = 'neutral') => (
    `${resultMetaChipBaseClass} ${resultMetaChipToneClasses[tone] || resultMetaChipToneClasses.neutral}`
);

const getCatalogCapabilityChipTone = (tone = '') => {
    if (tone === 'ready') return 'ready';
    if (tone === 'apple') return 'apple';
    if (tone === 'external') return 'external';
    if (tone === 'local') return 'local';
    return 'violet';
};

const getSourceChipTone = (source = '') => {
    if (source === 'itunes') return 'apple';
    if (source === 'youtube') return 'youtube';
    return 'local';
};

const getResultDurationSec = (result = {}) => {
    const rawMs = Number(result?.trackTimeMillis || result?.durationMs || 0);
    if (Number.isFinite(rawMs) && rawMs > 0) return Math.max(1, Math.round(rawMs / 1000));

    const rawSec = Number(result?.durationSec || result?.duration || 0);
    if (Number.isFinite(rawSec) && rawSec > 0) return Math.max(1, Math.round(rawSec));

    return 0;
};

const formatResultDuration = (durationSec = 0) => {
    const safeSec = Math.max(0, Math.round(Number(durationSec || 0)));
    if (!safeSec) return '';
    const minutes = Math.floor(safeSec / 60);
    const seconds = safeSec % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const ResultList = ({
    results = [],
    searchQ = '',
    queueSearchNoResultHint = '',
    getResultRowKey,
    quickAddLoadingKey = '',
    handleResultClick,
    performanceActionsEnabled = false,
    onQueueOnly,
    compactRows = false,
}) => (
    <>
        <div className="host-autocomplete-results-head flex items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 py-1.5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-300">Results</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-200">
                {results.length > 0 ? `${results.length} match${results.length === 1 ? '' : 'es'}` : 'No matches'}
            </div>
        </div>
        <div className={`host-autocomplete-results-list min-h-0 flex-1 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar px-2 py-2 ${compactRows ? 'grid content-start gap-1 xl:grid-cols-2' : ''}`}>
            {results.length > 0 ? results.map((r, idx) => {
                const rowKey = getResultRowKey(r, idx);
                const isAdding = quickAddLoadingKey === rowKey;
                const playbackState = r.source === 'youtube'
                    ? normalizeYouTubePlaybackState(r)
                    : null;
                const durationLabel = formatResultDuration(getResultDurationSec(r));
                const sourceLabel = getBackingSourceLabel({
                    source: r.source,
                    mediaUrl: r.url || r.mediaUrl,
                    usesAppleBacking: r.source === 'itunes',
                    variant: 'compact'
                });
                const activateResult = () => {
                    if (isAdding) return;
                    if (performanceActionsEnabled) {
                        onQueueOnly?.(r);
                        return;
                    }
                    handleResultClick(r, idx);
                };
                const thumbnailSourceLabel = r.source === 'itunes'
                    ? 'Apple'
                    : r.source === 'youtube'
                        ? 'YouTube'
                        : 'Known';

                return (
                    <div
                        key={rowKey}
                        data-feature-id="performance-result-row"
                        role="button"
                        tabIndex={0}
                        aria-label={`${isAdding ? 'Adding' : performanceActionsEnabled ? HOST_LIVE_OPS_LANGUAGE.addToLineup : 'Select'} ${r.catalogDisplayTitle || r.trackName || 'result'}`}
                        onClick={activateResult}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                activateResult();
                            }
                        }}
                        className={`host-autocomplete-result-row group ${compactRows ? 'rounded-lg px-2 py-1.5' : 'mb-2 rounded-[1.15rem] p-2.5'} ${isAdding ? 'cursor-wait opacity-70' : 'cursor-pointer'} border border-white/10 bg-[linear-gradient(180deg,rgba(25,16,44,0.98),rgba(16,10,34,0.95))] shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition hover:border-cyan-300/35 hover:bg-[linear-gradient(180deg,rgba(35,22,58,0.98),rgba(18,12,38,0.98))] focus-visible:border-cyan-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25`}
                    >
                        <div className={`grid gap-2 ${compactRows ? 'grid-cols-[48px_minmax(0,1fr)]' : 'grid-cols-[64px_minmax(0,1fr)] md:grid-cols-[76px_minmax(0,1fr)]'}`}>
                            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
                                {r.source === 'local' ? (
                                    <div className={`${compactRows ? 'h-12' : 'h-16 md:h-[76px]'} flex w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.28),transparent_55%),linear-gradient(180deg,rgba(12,17,31,1),rgba(8,12,24,1))]`}>
                                        <i className="fa-solid fa-hard-drive text-xl text-[#00C4D9]"></i>
                                    </div>
                                ) : (
                                    <img src={r.catalogArtworkUrl || r.artworkUrl100} className={`${compactRows ? 'h-12' : 'h-16 md:h-[76px]'} w-full object-cover`} alt="" />
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-1.5 py-1.5">
                                    <div className="flex items-center justify-between gap-1 text-[8px] font-black uppercase tracking-[0.14em] text-white">
                                        <span>#{idx + 1}</span>
                                        <span>{thumbnailSourceLabel}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className={`${compactRows ? 'text-sm' : 'text-[15px]'} line-clamp-1 font-black leading-tight text-white`}>{r.catalogDisplayTitle || r.trackName}</div>
                                        <div className="mt-0.5 truncate text-xs text-zinc-300">{r.catalogDisplayArtist || r.artistName}</div>
                                    </div>
                                    <div className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2.5 text-[9px] font-black uppercase tracking-[0.13em] text-cyan-50">
                                        {isAdding ? 'Adding...' : performanceActionsEnabled ? HOST_LIVE_OPS_LANGUAGE.addToLineup : 'Select'}
                                    </div>
                                </div>
                                <div className={`${compactRows ? 'mt-1 flex max-h-[18px] flex-nowrap gap-1 overflow-hidden' : 'mt-1.5 flex flex-wrap gap-1.5'}`}>
                                    {r.catalogCapabilityLabel ? (
                                        <span title={r.catalogCapabilityDetail || ''} className={getResultMetaChipClass(getCatalogCapabilityChipTone(r.catalogCapabilityTone))}>
                                            {r.catalogCapabilityLabel}
                                        </span>
                                    ) : null}
                                    <span className={getResultMetaChipClass(getSourceChipTone(r.source))}>
                                        Via {sourceLabel}
                                    </span>
                                    {Number(r.catalogVersionCount || 0) > 1 ? (
                                        <span className={getResultMetaChipClass('violet')}>
                                            {r.catalogVersionCount} versions
                                        </span>
                                    ) : null}
                                    {r.catalogRecommendedTvReady ? <span className={getResultMetaChipClass('ready')}>Recommended</span> : null}
                                    {r.source === 'youtube'
                                        && !r.catalogCapabilityLabel
                                        && playbackState?.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.notEmbeddable ? (
                                        <span className={getResultMetaChipClass('external')}>
                                            External playback
                                        </span>
                                    ) : null}
                                    {durationLabel ? (
                                        <span className={getResultMetaChipClass('neutral')}>
                                            {durationLabel}
                                        </span>
                                    ) : null}
                                </div>
                                {Array.isArray(r.catalogAlternatives) && r.catalogAlternatives.length > 0 ? (
                                    <details className="mt-2" onClick={(event) => event.stopPropagation()}>
                                        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">
                                            Other versions ({r.catalogAlternatives.length})
                                        </summary>
                                        <div className="mt-2 grid gap-1.5">
                                            {r.catalogAlternatives.map((alternative, alternativeIndex) => (
                                                <button
                                                    key={`${rowKey}_alternative_${getResultRowKey(alternative, alternativeIndex)}`}
                                                    type="button"
                                                    onClick={() => {
                                                        if (performanceActionsEnabled) {
                                                            onQueueOnly?.(alternative);
                                                            return;
                                                        }
                                                        handleResultClick(alternative, alternativeIndex);
                                                    }}
                                                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-left hover:border-violet-300/30"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-xs font-bold text-white">{alternative.trackName || alternative.title}</span>
                                                        <span className="block truncate text-[10px] text-zinc-400">{alternative.artistName || alternative.artist || alternative.sourceDetail || 'Alternate backing'}</span>
                                                    </span>
                                                    <span className="shrink-0 text-right">
                                                        <span className={getResultMetaChipClass(getCatalogCapabilityChipTone(alternative.catalogCapabilityTone))}>{alternative.catalogCapabilityLabel || 'Review Needed'}</span>
                                                        <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">via {alternative.source || 'known'}</span>
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </details>
                                ) : null}
                            </div>
                        </div>
                    </div>
                );
            }) : (
                <div className={`host-search-helper py-3 text-center text-xs uppercase tracking-widest text-zinc-500 ${compactRows ? 'col-span-full' : ''}`}>
                    {searchQ.length >= 3 ? (queueSearchNoResultHint || 'No results yet') : `Type at least 3 characters. Each result has ${HOST_LIVE_OPS_LANGUAGE.addToLineup}.`}
                </div>
            )}
        </div>
    </>
);
const momentTypes = [
    { id: 'performance', label: 'Performance', icon: 'fa-microphone-lines' },
    { id: 'tv', label: 'TV', icon: 'fa-tv' },
    { id: 'audience', label: 'Audience', icon: 'fa-people-group' },
    { id: 'announcement', label: 'Announcement', icon: 'fa-bullhorn' },
    { id: 'game', label: 'Game', icon: 'fa-dice' },
    { id: 'sponsor', label: 'Sponsor', icon: 'fa-hand-holding-heart' },
];

export const HOST_MOMENT_DESTINATIONS = Object.freeze({
    queue: 'queue',
    planner: 'planner',
    runOfShow: 'run_of_show',
});

const momentDestinationOptions = [
    {
        id: HOST_MOMENT_DESTINATIONS.queue,
        label: HOST_LIVE_OPS_LANGUAGE.lineup,
        actionLabel: HOST_LIVE_OPS_LANGUAGE.addToLineup,
        detail: `Adds it to the end of ${HOST_LIVE_OPS_LANGUAGE.lineup}.`,
    },
    {
        id: HOST_MOMENT_DESTINATIONS.planner,
        label: HOST_LIVE_OPS_LANGUAGE.momentDrafts,
        actionLabel: HOST_LIVE_OPS_LANGUAGE.saveDraft,
        detail: `Keeps it private until you add it to ${HOST_LIVE_OPS_LANGUAGE.lineup}.`,
    },
    {
        id: HOST_MOMENT_DESTINATIONS.runOfShow,
        label: HOST_LIVE_OPS_LANGUAGE.lineup,
        actionLabel: HOST_LIVE_OPS_LANGUAGE.addToLineup,
        detail: `Adds it to the structured order in ${HOST_LIVE_OPS_LANGUAGE.lineup}.`,
    },
];

const getMomentDestinationMeta = (destination = HOST_MOMENT_DESTINATIONS.queue) => (
    momentDestinationOptions.find((entry) => entry.id === destination) || momentDestinationOptions[0]
);

const quickMomentPacks = [
    {
        id: 'selfie_cam',
        category: 'audience',
        title: 'Selfie Cam',
        detail: 'Crowd spotlight between singers.',
        toneClass: 'border-amber-300/22 bg-amber-500/8',
    },
    {
        id: 'leaderboard_flash',
        category: 'audience',
        title: 'Leaderboard Flash',
        detail: 'Show standings on TV without breaking flow.',
        toneClass: 'border-cyan-300/22 bg-cyan-500/8',
    },
    {
        id: 'host_update',
        category: 'announcement',
        title: 'Host Update',
        detail: 'Short host-led room beat.',
        toneClass: 'border-white/10 bg-black/20',
    },
    {
        id: 'how_to_join',
        category: 'announcement',
        title: 'How To Join',
        detail: 'Push the room back to phones fast.',
        toneClass: 'border-cyan-300/22 bg-cyan-500/8',
    },
    {
        id: 'winner_declaration',
        category: 'announcement',
        title: 'Declare Winner',
        detail: 'Drop a quick winner reveal into the live plan.',
        toneClass: 'border-amber-300/22 bg-amber-500/8',
    },
    {
        id: 'support_the_show',
        category: 'sponsor',
        title: 'Support The Show',
        detail: 'Donation beat or cause slide.',
        toneClass: 'border-pink-300/22 bg-pink-500/8',
    },
    {
        id: 'sponsor_spotlight',
        category: 'sponsor',
        title: 'Sponsor Spotlight',
        detail: 'Quick branded thank-you moment.',
        toneClass: 'border-amber-300/22 bg-amber-500/8',
    },
];

const gameMomentPacks = [
    {
        id: 'trivia_pop',
        title: 'Trivia',
        detail: 'Timed room question with instant scoreboard payoff.',
        toneClass: 'border-violet-300/22 bg-violet-500/8',
    },
    {
        id: 'wyr',
        title: 'Would You Rather',
        detail: 'Fast audience vote with instant reveal.',
        toneClass: 'border-emerald-300/22 bg-emerald-500/8',
    },
    ...GAMES_META.filter((game) => !['trivia_pop', 'wyr'].includes(String(game?.id || '').trim().toLowerCase())).map((game) => ({
        id: game.id,
        title: game.name,
        detail: game.description,
        toneClass: game.category === 'voice'
            ? 'border-cyan-300/22 bg-cyan-500/8'
            : game.category === 'social'
                ? 'border-rose-300/22 bg-rose-500/8'
                : 'border-emerald-300/22 bg-emerald-500/8',
    })),
    {
        id: 'applause_countdown',
        title: 'Applause Meter',
        detail: 'Measure the room before the next singer.',
        toneClass: 'border-amber-300/22 bg-amber-500/8',
    },
];

export const GAME_QUEUE_ASSIGNMENT_MODES = Object.freeze({
    crowd: 'crowd',
    spotlight: 'spotlight',
});

const SPOTLIGHT_VOICE_GAME_IDS = new Set(['flappy_bird', 'vocal_challenge', 'riding_scales']);

// eslint-disable-next-line react-refresh/only-export-components -- test-facing helper kept with the queue form logic it validates.
export const supportsSpotlightSingerAssignment = (packId = '') => (
    SPOTLIGHT_VOICE_GAME_IDS.has(String(packId || '').trim().toLowerCase())
);

const normalizePerformerSearch = (value = '') => (
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
);

const normalizeMomentSearch = (value = '') => (
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
);

const matchesMomentSearch = (query = '', fields = []) => {
    const safeQuery = normalizeMomentSearch(query);
    if (!safeQuery) return true;
    return (Array.isArray(fields) ? fields : []).some((field) => normalizeMomentSearch(field).includes(safeQuery));
};

const buildScenePresetPreview = (preset = {}) => {
    const mediaUrl = String(preset?.mediaUrl || '').trim();
    const mediaType = String(preset?.mediaType || '').trim().toLowerCase() === 'video' ? 'video' : 'image';
    return { mediaUrl, mediaType, isVideo: mediaType === 'video' };
};

// eslint-disable-next-line react-refresh/only-export-components -- test-facing helper kept with the queue form logic it validates.
export const buildGameMomentQueueOptions = (packId = '', {
    destination = HOST_MOMENT_DESTINATIONS.queue,
    assignmentMode = GAME_QUEUE_ASSIGNMENT_MODES.crowd,
    performer = null,
} = {}) => {
    const safeDestination = Object.values(HOST_MOMENT_DESTINATIONS).includes(String(destination || '').trim().toLowerCase())
        ? String(destination || '').trim().toLowerCase()
        : HOST_MOMENT_DESTINATIONS.queue;
    const safeAssignmentMode = String(assignmentMode || '').trim().toLowerCase() === GAME_QUEUE_ASSIGNMENT_MODES.spotlight
        ? GAME_QUEUE_ASSIGNMENT_MODES.spotlight
        : GAME_QUEUE_ASSIGNMENT_MODES.crowd;
    const performerUid = String(performer?.uid || '').trim();
    const performerName = String(performer?.name || '').trim();
    if (supportsSpotlightSingerAssignment(packId) && safeAssignmentMode === GAME_QUEUE_ASSIGNMENT_MODES.spotlight && performerUid) {
        return {
            destination: safeDestination,
            placement: 'append',
            launchConfigOverrides: {
                participantMode: 'selected',
                participants: [performerUid],
            },
            itemOverrides: {
                notes: performerName
                    ? `Spotlight singer: ${performerName}.`
                    : 'Spotlight singer assigned.',
            },
            presentationOverrides: {
                subhead: performerName
                    ? `${performerName} takes the mic on phone while the room watches.`
                    : 'Selected singer takes the mic on phone while the room watches.',
            },
        };
    }
    return {
        destination: safeDestination,
        placement: 'append',
    };
};

const AddToQueueFormBody = ({
    searchQ,
    setSearchQ,
    autocompleteProvider,
    setAutocompleteProvider,
    youtubeSearchMode = 'karaoke',
    setYoutubeSearchMode = () => {},
    styles,
    results,
    queueSearchSourceNote,
    queueSearchNoResultHint,
    getResultRowKey,
    quickAddLoadingKey,
    handleResultClick,
    searchSources,
    itunesBackoffRemaining,
    quickAddNotice,
    onUndoQuickAdd,
    onChangeQuickAddBacking,
    onManualQueueResult,
    manual,
    setManual,
    setManualSingerMode,
    hostName,
    users,
    addSong,
    appleMusicAuthorized,
    openYtSearch,
    onOpenTvLibrary,
    scenePresets = [],
    onQueueScenePreset,
    onAddQuickRunOfShowMoment,
    onQueuePerformanceResult,
    dockResults = false,
}) => {
    const [manualEntryOpen, setManualEntryOpen] = React.useState(!dockResults);
    const [activeMomentType, setActiveMomentType] = React.useState('performance');
    const [momentDestination, setMomentDestination] = React.useState(HOST_MOMENT_DESTINATIONS.queue);
    const [selectedGameMomentBundleId, setSelectedGameMomentBundleId] = React.useState(HOST_GAME_MOMENT_BUNDLE_IDS.betweenSongs);
    const [performerPickerOpen, setPerformerPickerOpen] = React.useState(false);
    const [gameAssignmentModes, setGameAssignmentModes] = React.useState({});
    const [gameSelectedPerformerByPack, setGameSelectedPerformerByPack] = React.useState({});
    const [searchOptionsOpen, setSearchOptionsOpen] = React.useState(false);
    const [momentTypeMenuOpen, setMomentTypeMenuOpen] = React.useState(false);

    React.useEffect(() => {
        if (!dockResults) {
            setManualEntryOpen(true);
        }
    }, [dockResults]);

    const performerOptions = [];
    const seenPerformerNames = new Set();
    const pushPerformerOption = (entry = {}, type = 'guest') => {
        const rawName = String(entry?.name || '').trim();
        if (!rawName) return;
        const normalizedName = normalizePerformerSearch(rawName);
        if (!normalizedName || seenPerformerNames.has(normalizedName)) return;
        seenPerformerNames.add(normalizedName);
        performerOptions.push({
            key: String(entry?.uid || normalizedName),
            name: rawName,
            avatar: String(entry?.avatar || '').trim(),
            type,
        });
    };
    if (hostName) {
        pushPerformerOption({ uid: `host:${hostName}`, name: hostName }, 'host');
    }
    users.forEach((user) => {
        pushPerformerOption(user, 'guest');
    });
    performerOptions.sort((left, right) => {
        if (left.type !== right.type) return left.type === 'host' ? -1 : 1;
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
    const assignableGamePerformers = users
        .map((user) => {
            const uid = resolveRoomUserUid(user);
            const name = String(user?.name || '').trim();
            if (!uid || !name) return null;
            return {
                uid,
                name,
                avatar: String(user?.avatar || '').trim(),
            };
        })
        .filter(Boolean)
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));

    const performerQuery = String(manual?.singer || '').trim();
    const normalizedPerformerQuery = normalizePerformerSearch(performerQuery);
    const filteredPerformerOptions = performerOptions
        .filter((option) => {
            if (!normalizedPerformerQuery) return true;
            return normalizePerformerSearch(option.name).includes(normalizedPerformerQuery);
        })
        .slice(0, 8);
    const hasExactPerformerMatch = performerOptions.some(
        (option) => normalizePerformerSearch(option.name) === normalizedPerformerQuery
    );
    const showCustomPerformerOption = normalizedPerformerQuery && !hasExactPerformerMatch;
    const showPerformerSuggestions = performerPickerOpen && (showCustomPerformerOption || filteredPerformerOptions.length > 0);
    const applyPerformerSelection = (name = '', mode = 'select') => {
        setManualSingerMode(mode);
        setManual((prev) => ({ ...prev, singer: String(name || '').trim() }));
        setPerformerPickerOpen(false);
    };
    const performerSelect = (
        <div className="relative min-w-0">
            <div className="relative">
                <i className="fa-solid fa-user-microphone pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"></i>
                <input
                    data-feature-id="host-manual-performer-select"
                    value={manual.singer}
                    onChange={(e) => {
                        const value = e.target.value;
                        setManualSingerMode('custom');
                        setManual((prev) => ({ ...prev, singer: value }));
                        setPerformerPickerOpen(true);
                    }}
                    onFocus={() => setPerformerPickerOpen(true)}
                    onBlur={() => {
                        globalThis.setTimeout(() => setPerformerPickerOpen(false), 120);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setPerformerPickerOpen(false);
                        }
                    }}
                    className={`${styles.input} pl-8 pr-24 text-sm`}
                    placeholder="Search performer or type custom"
                    autoComplete="off"
                />
                <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyPerformerSelection(hostName || performerQuery, hostName ? 'select' : 'custom')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200"
                >
                    {hostName ? 'Host' : 'Keep'}
                </button>
            </div>
            {showPerformerSuggestions ? (
                <div
                    data-feature-id="host-manual-performer-suggestions"
                    className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-cyan-300/20 bg-zinc-950/98 shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
                >
                    <div className="max-h-64 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar p-2">
                        {showCustomPerformerOption ? (
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => applyPerformerSelection(performerQuery, 'custom')}
                                className="mb-2 flex w-full items-center justify-between rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-left transition hover:border-cyan-200/35 hover:bg-cyan-500/14"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-black text-cyan-100">{performerQuery}</span>
                                    <span className="block text-[10px] uppercase tracking-[0.16em] text-cyan-200/75">Use custom performer</span>
                                </span>
                                <span className="rounded-full border border-cyan-300/30 bg-black/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                                    Custom
                                </span>
                            </button>
                        ) : null}
                        {filteredPerformerOptions.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => applyPerformerSelection(option.name, 'select')}
                                className="mb-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left transition last:mb-0 hover:border-cyan-300/25 hover:bg-white/5"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-bold text-white">
                                        {option.avatar ? `${option.avatar} ` : ''}{option.name}
                                    </span>
                                    <span className="block text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                        {option.type === 'host' ? 'Host' : 'Live lobby'}
                                    </span>
                                </span>
                                {option.type === 'host' ? (
                                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                                        Host
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );

    const renderResultsInline = dockResults;
    const showResults = results.length > 0 || searchQ.length >= 3;
    const performanceMode = activeMomentType === 'performance';
    const momentDestinationMeta = getMomentDestinationMeta(momentDestination);
    const youtubeProviderAvailable = searchSources?.youtube !== false;
    const appleProviderConfigured = searchSources?.itunes !== false;
    const appleProviderAvailable = appleProviderConfigured && appleMusicAuthorized;
    const momentSearchPlaceholder = activeMomentType === 'game'
        ? 'Search game modes'
        : activeMomentType === 'tv'
            ? 'Search saved TV moments'
            : 'Search show moments';
    const gameMomentBundleOptions = summarizeHostGameMomentBundles(gameMomentPacks);
    const selectedGameMomentBundle = getHostGameMomentBundle(selectedGameMomentBundleId);
    const bundledGameMomentPacks = filterGamesForHostMomentBundle(gameMomentPacks, selectedGameMomentBundleId);
    const filteredMomentPacks = (activeMomentType === 'game'
        ? bundledGameMomentPacks
        : quickMomentPacks.filter((pack) => pack.category === activeMomentType))
        .filter((pack) => matchesMomentSearch(searchQ, [pack.title, pack.detail, pack.id]));
    const allScenePresets = Array.isArray(scenePresets) ? scenePresets : [];
    const filteredScenePresets = allScenePresets.filter((preset) => matchesMomentSearch(searchQ, [
        preset?.title,
        preset?.mediaType,
        preset?.fileName,
    ]));
    const performanceResultListProps = {
        results,
        searchQ,
        queueSearchNoResultHint,
        getResultRowKey,
        quickAddLoadingKey,
        handleResultClick: (result, index) => handleResultClick?.(result, index, { queueOnClick: false }),
        performanceActionsEnabled: performanceMode,
        onQueueOnly: (result) => onQueuePerformanceResult?.(result),
    };

    React.useEffect(() => {
        if (autocompleteProvider === 'apple' && !appleProviderAvailable) {
            setAutocompleteProvider(youtubeProviderAvailable ? 'youtube' : 'apple');
        } else if (autocompleteProvider === 'youtube' && !youtubeProviderAvailable && appleProviderAvailable) {
            setAutocompleteProvider('apple');
        }
    }, [appleProviderAvailable, autocompleteProvider, setAutocompleteProvider, youtubeProviderAvailable]);

    const handleAddSinger = async () => {
        const queued = await addSong?.();
        if (queued?.id && typeof onManualQueueResult === 'function') {
            onManualQueueResult(queued);
        }
    };
    const mediaSourceButtonClass = (active, tone = 'cyan') => {
        const activeClass = tone === 'red'
            ? 'border-red-300/45 bg-red-400 text-zinc-950 shadow-[0_8px_18px_rgba(248,113,113,0.18)]'
            : 'border-pink-300/45 bg-pink-300 text-zinc-950 shadow-[0_8px_18px_rgba(249,168,212,0.18)]';
        return `inline-flex min-h-[34px] items-center rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${
            active ? activeClass : 'border-transparent text-zinc-400 hover:bg-white/7 hover:text-zinc-100'
        }`;
    };
    const youtubeModeButtonClass = (active) => (
        `flex min-h-[30px] items-center justify-center rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] transition ${
            active ? 'border-cyan-300/35 bg-cyan-500/16 text-cyan-100' : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
        }`
    );
    return (
        <div className={`mt-2 pr-1 ${dockResults ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden' : ''}`}>
            <div
                role="tablist"
                aria-label="Performance and moment types"
                data-feature-id="host-moment-type-tabs"
                className={`${dockResults && performanceMode && !momentTypeMenuOpen ? 'hidden' : 'mb-2 flex'} host-brand-tabs host-brand-tabs--workspace min-h-[46px] shrink-0 custom-scrollbar`}
            >
                {momentTypes.map((entry) => {
                    const active = entry.id === activeMomentType;
                    return (
                        <button
                            key={entry.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => {
                                setActiveMomentType(entry.id);
                                if (dockResults && entry.id === 'performance') {
                                    setMomentTypeMenuOpen(false);
                                }
                            }}
                            className={`host-brand-tab inline-flex min-h-[38px] min-w-max items-center gap-2 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] ${active ? 'is-active' : ''}`}
                        >
                            <i className={`fa-solid ${entry.icon}`}></i>
                            {entry.label}
                        </button>
                    );
                })}
            </div>

            {!performanceMode ? (
                <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        {activeMomentType === 'tv' ? 'TV Moment' : 'Moment Builder'}
                    </div>
                    <div className="mt-1 text-base font-black text-white">
                        {activeMomentType === 'tv'
                            ? 'TV moment'
                            : activeMomentType === 'audience'
                                ? 'Audience moment'
                                : activeMomentType === 'announcement'
                                    ? 'Announcement'
                                    : activeMomentType === 'sponsor'
                                        ? 'Sponsor moment'
                                        : 'Game break'}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                        {activeMomentType === 'tv'
                            ? 'Choose a saved scene or open the media library.'
                            : `Choose where this moment belongs. ${HOST_LIVE_OPS_LANGUAGE.lineup} always adds it at the end.`}
                    </div>
                    <div className="mt-3 grid gap-2 rounded-xl border border-cyan-300/16 bg-cyan-500/[0.06] p-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] sm:items-end" data-feature-id="moment-destination-control">
                        <label className="block min-w-0">
                            <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Destination</span>
                            <select
                                value={momentDestination}
                                onChange={(event) => setMomentDestination(event.target.value)}
                                className={`${styles.input} text-sm`}
                            >
                                {momentDestinationOptions.map((option) => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                        <div className="min-w-0 pb-1 text-xs text-zinc-300">
                            <span className="font-semibold text-white">{momentDestinationMeta.actionLabel}.</span>{' '}
                            {momentDestinationMeta.detail}
                        </div>
                    </div>
                    {activeMomentType === 'game' ? (
                        <div className="mt-3" data-feature-id="queue-game-moment-bundles">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">When should it run?</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {gameMomentBundleOptions.map((bundle) => {
                                    const active = bundle.id === selectedGameMomentBundleId;
                                    return (
                                        <button
                                            key={bundle.id}
                                            type="button"
                                            data-feature-id={`queue-game-bundle-${bundle.id}`}
                                            onClick={() => setSelectedGameMomentBundleId(bundle.id)}
                                            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${active ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-black/20 text-zinc-300'}`}
                                        >
                                            {bundle.shortLabel} ({bundle.modeCount})
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-2 text-[11px] leading-4 text-cyan-100/70">{selectedGameMomentBundle.hostCue}</div>
                            {selectedGameMomentBundleId === HOST_GAME_MOMENT_BUNDLE_IDS.alongsideKaraoke ? (
                                <div className="mt-2 rounded-xl border border-violet-300/20 bg-violet-500/8 px-3 py-2 text-[11px] leading-4 text-zinc-300" data-feature-id="queue-pop-trivia-companion-note">
                                    Pop Trivia is a during-performance companion, so it is enabled from the Game Launchpad rather than queued as a standalone break.
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="mt-3">
                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"></i>
                            <input
                                data-feature-id="host-moment-search-input"
                                value={searchQ}
                                onChange={(e) => setSearchQ(e.target.value)}
                                className={`${styles.input} pl-8 text-sm`}
                                placeholder={momentSearchPlaceholder}
                            />
                        </div>
                        <div className="mt-2 text-[11px] text-zinc-500">
                            {activeMomentType === 'game'
                                ? `${filteredMomentPacks.length} game mode${filteredMomentPacks.length === 1 ? '' : 's'} ready to queue`
                                : activeMomentType === 'tv'
                                    ? `${filteredScenePresets.length} TV moment${filteredScenePresets.length === 1 ? '' : 's'} found`
                                    : `${filteredMomentPacks.length} queueable moment${filteredMomentPacks.length === 1 ? '' : 's'} found`}
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {activeMomentType === 'tv' && typeof openYtSearch === 'function' ? (
                            <button
                                type="button"
                                onClick={() => openYtSearch('manual', searchQ || `${manual.song || ''} ${manual.artist || ''}`.trim())}
                                className={`${styles.btnStd} ${styles.btnHighlight} px-3 py-1.5 text-[11px]`}
                            >
                                Search YouTube
                            </button>
                        ) : null}
                        {activeMomentType === 'tv' && typeof onOpenTvLibrary === 'function' ? (
                            <button
                                type="button"
                                onClick={() => onOpenTvLibrary?.()}
                                className={`${styles.btnStd} ${styles.btnSecondary} px-3 py-1.5 text-[11px]`}
                            >
                                Open Media Library
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className={`host-autocomplete-shell relative z-30 w-full min-w-0 ${dockResults ? 'flex min-h-0 shrink-0 flex-col' : ''}`}>
                    <div className={`host-autocomplete-field-wrap w-full min-w-0 rounded-xl border border-cyan-400/25 bg-zinc-950/70 px-2 ${dockResults ? 'sticky top-0 z-20 shrink-0 py-1.5' : 'py-2'}`}>
                        <div className={`grid gap-2 ${dockResults ? 'md:grid-cols-[minmax(0,1fr)_minmax(11rem,0.52fr)_auto]' : 'md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.62fr)]'}`}>
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"></i>
                                <input
                                    value={searchQ}
                                    onChange={(e) => setSearchQ(e.target.value)}
                                    className={`${styles.input} host-autocomplete-input py-2 pl-8 pr-3 text-sm`}
                                    placeholder="Search songs or backing tracks"
                                />
                            </div>
                            <div className="min-w-0">
                                {performerSelect}
                            </div>
                            {dockResults ? (
                                <div className="flex min-w-max items-center justify-end gap-1.5">
                                    <button
                                        type="button"
                                        data-feature-id="host-performance-search-tools"
                                        aria-expanded={searchOptionsOpen}
                                        onClick={() => setSearchOptionsOpen((value) => !value)}
                                        className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/6 px-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-200 transition hover:border-cyan-300/30 hover:text-cyan-100"
                                        title="Source, filters, full search, and manual entry"
                                    >
                                        <i className="fa-solid fa-sliders"></i>
                                        {autocompleteProvider === 'youtube' ? 'YouTube' : 'Apple'}
                                    </button>
                                    <button
                                        type="button"
                                        data-feature-id="host-add-other-moment"
                                        aria-expanded={momentTypeMenuOpen}
                                        onClick={() => setMomentTypeMenuOpen((value) => !value)}
                                        className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-fuchsia-300/18 bg-fuchsia-500/8 px-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-fuchsia-100 transition hover:border-fuchsia-300/35"
                                        title="Add a game, TV scene, announcement, or sponsor moment"
                                    >
                                        <i className="fa-solid fa-shapes"></i>
                                        Other
                                    </button>
                                </div>
                            ) : null}
                            <div className={`${dockResults ? (searchOptionsOpen ? 'md:col-span-3' : 'hidden') : 'md:col-span-2'}`}>
                                <div className="grid min-w-0 gap-2 rounded-xl border border-white/10 bg-black/25 p-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
                                    <div className="min-w-0">
                                        <div className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Backing source</div>
                                        <div className="inline-flex min-w-0 gap-1 rounded-xl bg-zinc-950/80 p-0.5">
                                        {youtubeProviderAvailable ? (
                                        <button
                                            type="button"
                                            onClick={() => setAutocompleteProvider('youtube')}
                                            data-search-control='provider'
                                            aria-pressed={autocompleteProvider === 'youtube'}
                                            className={mediaSourceButtonClass(autocompleteProvider === 'youtube', 'red')}
                                            title="Use YouTube backing search"
                                        >
                                            <i className="fa-brands fa-youtube mr-1.5"></i>
                                            YouTube
                                        </button>
                                        ) : null}
                                        {appleProviderAvailable ? (
                                        <button
                                            type="button"
                                            onClick={() => setAutocompleteProvider('apple')}
                                            data-search-control='provider'
                                            aria-pressed={autocompleteProvider === 'apple'}
                                            className={mediaSourceButtonClass(autocompleteProvider === 'apple', 'pink')}
                                            title="Use Apple Music autocomplete"
                                        >
                                            <i className="fa-brands fa-apple mr-1.5"></i>
                                            Apple
                                        </button>
                                        ) : null}
                                        </div>
                                    </div>
                                    {autocompleteProvider === 'youtube' ? (
                                        <div className="min-w-0 sm:border-l sm:border-white/10 sm:pl-2">
                                        <div className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">YouTube filter</div>
                                        <div className="inline-flex gap-1 rounded-xl border border-white/10 bg-zinc-950/60 p-0.5">
                                            {[
                                                ['karaoke', 'Karaoke tracks'],
                                                ['any', 'All videos']
                                            ].map(([mode, label]) => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => setYoutubeSearchMode(mode)}
                                                    data-search-control='scope'
                                                    aria-pressed={youtubeSearchMode === mode}
                                                    className={youtubeModeButtonClass(youtubeSearchMode === mode)}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        </div>
                                    ) : appleProviderConfigured && !appleMusicAuthorized ? (
                                        <div className="self-center text-[10px] leading-4 text-zinc-500 sm:border-l sm:border-white/10 sm:pl-2" data-feature-id="apple-search-unavailable">
                                            Connect Apple Music in Media to search it.
                                        </div>
                                    ) : <div />}
                                    {autocompleteProvider === 'youtube' && typeof openYtSearch === 'function' ? (
                                            <button
                                                type="button"
                                                data-feature-id="host-performance-search-expand"
                                                onClick={() => openYtSearch('manual', searchQ || `${manual.song || ''} ${manual.artist || ''}`.trim())}
                                                className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/6 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-200 transition hover:border-red-300/30 hover:bg-red-500/10 hover:text-red-100"
                                                title="Open the full YouTube catalog search"
                                            >
                                                <i className="fa-brands fa-youtube"></i>
                                                Expand Search
                                            </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        {queueSearchSourceNote ? (
                            <div className={`${dockResults && !searchOptionsOpen ? 'hidden' : 'mt-2'} rounded border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200`}>
                                {queueSearchSourceNote}
                            </div>
                        ) : null}
                        <div className={`${dockResults && !searchOptionsOpen ? 'hidden' : 'mt-2 flex'} justify-end`}>
                            <button
                                type="button"
                                onClick={() => setManualEntryOpen((value) => !value)}
                                className={`${styles.btnStd} ${styles.btnNeutral} px-2.5 py-1 text-[10px]`}
                            >
                                {manualEntryOpen ? 'Hide Manual Entry' : 'Manual Entry'}
                            </button>
                        </div>
                        {manualEntryOpen && (!dockResults || searchOptionsOpen) ? (
                            <div className="mt-2 border-t border-white/10 pt-2">
                                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Manual</div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    <input data-feature-id="host-manual-song-input" value={manual.song} onChange={(e) => setManual({ ...manual, song: e.target.value })} className={styles.input} placeholder="Song" />
                                    <input data-feature-id="host-manual-artist-input" value={manual.artist} onChange={(e) => setManual({ ...manual, artist: e.target.value })} className={styles.input} placeholder="Artist" />
                                </div>
                                <div className="mt-2 flex justify-end">
                                    <button
                                        data-feature-id="host-manual-queue-submit"
                                        type="button"
                                        disabled={!String(manual.song || '').trim()}
                                        onClick={() => { void handleAddSinger(); }}
                                        className={`${styles.btnStd} ${styles.btnHighlight} px-4 ${!String(manual.song || '').trim() ? 'cursor-not-allowed opacity-45' : ''}`}
                                    >
                                        {String(manual.song || '').trim() ? 'Add Manual Request' : 'Enter a Song Title'}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {!renderResultsInline && showResults ? (
                        <div className={`host-autocomplete-results absolute left-1/2 top-full mt-2 z-50 flex w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 max-h-[clamp(18rem,calc(100dvh-8rem),82dvh)] flex-col overflow-hidden ${baseResultsCardClass}`}>
                            <div className="host-autocomplete-results-stem" aria-hidden="true"></div>
                            <ResultList {...performanceResultListProps} compactRows={dockResults} />
                        </div>
                    ) : null}
                </div>
            )}

            {!performanceMode && activeMomentType === 'tv' ? (
                <div className={`${dockResults ? 'mt-3 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden' : 'mt-3'}`}>
                    {filteredScenePresets.length > 0 ? (
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-cyan-100">
                                {filteredScenePresets.length} saved scene{filteredScenePresets.length === 1 ? '' : 's'}
                            </span>
                        </div>
                    ) : null}
                    <div className={`${dockResults ? 'max-h-none flex-1 basis-0' : 'max-h-[30rem]'} grid min-h-0 gap-2 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar pr-1 xl:grid-cols-2`}>
                    {filteredScenePresets.length > 0 ? filteredScenePresets.map((preset) => {
                        const preview = buildScenePresetPreview(preset);
                        return (
                            <div key={preset.id || preset.title} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <div className="flex gap-3">
                                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/35">
                                        {preview.mediaUrl ? (
                                            preview.isVideo ? (
                                                <video src={preview.mediaUrl} className="h-full w-full object-cover" muted playsInline />
                                            ) : (
                                                <img src={preview.mediaUrl} alt="" className="h-full w-full object-cover" />
                                            )
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-lg text-zinc-500">
                                                <i className={`fa-solid ${preview.isVideo ? 'fa-film' : 'fa-image'}`}></i>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-black text-white">{String(preset?.title || '').trim() || 'TV Moment'}</div>
                                                <div className="mt-1 text-xs text-zinc-400">
                                                    {preview.isVideo ? 'Video' : 'Image'} scene
                                                </div>
                                            </div>
                                            <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                                                {Math.max(5, Math.min(600, Number(preset?.durationSec || 20) || 20))}s
                                            </span>
                                        </div>
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => onQueueScenePreset?.(preset, {
                                                    destination: momentDestination,
                                                    placement: 'append',
                                                })}
                                                className={`${styles.btnStd} ${styles.btnHighlight} px-3 py-1.5 text-[11px]`}
                                            >
                                                {momentDestinationMeta.actionLabel}
                                            </button>
                                        </div>
                                        <div className="mt-2 text-[11px] text-zinc-500">
                                            {momentDestinationMeta.detail}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-5 text-sm text-zinc-400 xl:col-span-2">
                            {searchQ.trim()
                                ? 'No saved TV moments match that search yet.'
                                : 'No saved scenes yet. Use Search YouTube or Open Media Library.'}
                        </div>
                    )}
                    </div>
                </div>
            ) : null}

            {!performanceMode && activeMomentType !== 'tv' ? (
                <div className={`${dockResults ? 'mt-3 grid min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar pr-1' : 'mt-3 grid'} gap-2 xl:grid-cols-2`}>
                    {filteredMomentPacks.length > 0 ? filteredMomentPacks.map((pack) => (
                        <div key={pack.id} className={`rounded-2xl border p-3 ${pack.toneClass}`}>
                            {(() => {
                                const spotlightSupported = activeMomentType === 'game' && supportsSpotlightSingerAssignment(pack.id);
                                const lifecycleLabel = activeMomentType === 'game' ? getGameLifecycleLabel(pack.id) : '';
                                const assignmentMode = gameAssignmentModes[pack.id] === GAME_QUEUE_ASSIGNMENT_MODES.spotlight
                                    ? GAME_QUEUE_ASSIGNMENT_MODES.spotlight
                                    : GAME_QUEUE_ASSIGNMENT_MODES.crowd;
                                const selectedPerformerUid = String(gameSelectedPerformerByPack[pack.id] || '').trim();
                                const selectedPerformer = assignableGamePerformers.find((entry) => entry.uid === selectedPerformerUid) || null;
                                const needsSpotlightSinger = spotlightSupported
                                    && assignmentMode === GAME_QUEUE_ASSIGNMENT_MODES.spotlight
                                    && !selectedPerformer;
                                const destinationOptions = buildGameMomentQueueOptions(pack.id, {
                                    destination: momentDestination,
                                    assignmentMode,
                                    performer: selectedPerformer,
                                });
                                return (
                                    <>
                            <div className="flex items-center justify-between gap-2"><div className="text-sm font-black text-white">{pack.title}</div>{lifecycleLabel ? <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300" data-game-lifecycle-label={pack.id}>{lifecycleLabel}</span> : null}</div>
                            <div className="mt-1 text-xs text-zinc-300">{pack.detail}</div>
                            <div className="mt-2 text-[11px] text-zinc-500">
                                {spotlightSupported
                                    ? assignmentMode === GAME_QUEUE_ASSIGNMENT_MODES.spotlight
                                        ? (selectedPerformer
                                            ? `${selectedPerformer.name} will use singer phone mic while the room watches.`
                                            : 'Pick a singer to route phone mic control for this break.')
                                        : 'Default: crowd sing-along on the TV mic.'
                                    : momentDestinationMeta.detail}
                            </div>
                            {spotlightSupported ? (
                                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            data-feature-id={`moment-pack-mode-crowd-${pack.id}`}
                                            onClick={() => setGameAssignmentModes((prev) => ({
                                                ...prev,
                                                [pack.id]: GAME_QUEUE_ASSIGNMENT_MODES.crowd,
                                            }))}
                                            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                                assignmentMode === GAME_QUEUE_ASSIGNMENT_MODES.crowd
                                                    ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100'
                                                    : 'border-white/10 bg-black/25 text-zinc-300'
                                            }`}
                                        >
                                            Crowd Mode
                                        </button>
                                        <button
                                            type="button"
                                            data-feature-id={`moment-pack-mode-spotlight-${pack.id}`}
                                            onClick={() => setGameAssignmentModes((prev) => ({
                                                ...prev,
                                                [pack.id]: GAME_QUEUE_ASSIGNMENT_MODES.spotlight,
                                            }))}
                                            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                                assignmentMode === GAME_QUEUE_ASSIGNMENT_MODES.spotlight
                                                    ? 'border-amber-300/35 bg-amber-500/12 text-amber-100'
                                                    : 'border-white/10 bg-black/25 text-zinc-300'
                                            }`}
                                        >
                                            Spotlight Singer
                                        </button>
                                    </div>
                                    {assignmentMode === GAME_QUEUE_ASSIGNMENT_MODES.spotlight ? (
                                        <div className="mt-3">
                                            <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                                                Singer Phone Mic
                                            </label>
                                            <select
                                                data-feature-id={`moment-pack-performer-${pack.id}`}
                                                value={selectedPerformerUid}
                                                onChange={(event) => {
                                                    const nextUid = String(event.target.value || '').trim();
                                                    setGameSelectedPerformerByPack((prev) => ({
                                                        ...prev,
                                                        [pack.id]: nextUid,
                                                    }));
                                                }}
                                                className={`${styles.input} text-sm`}
                                            >
                                                <option value="">Select singer</option>
                                                {assignableGamePerformers.map((performer) => (
                                                    <option key={`${pack.id}-${performer.uid}`} value={performer.uid}>
                                                        {performer.avatar ? `${performer.avatar} ` : ''}{performer.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="mt-2 text-[11px] text-zinc-500">
                                                {assignableGamePerformers.length
                                                    ? 'Queued spotlight runs from that singer device instead of the TV crowd mic.'
                                                    : 'No active singer devices found yet. Keep it in crowd mode until someone joins.'}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            <div className="mt-3 flex justify-end">
                                <button
                                    type="button"
                                    data-feature-id={`moment-pack-destination-${pack.id}`}
                                    onClick={() => onAddQuickRunOfShowMoment?.(pack.id, destinationOptions)}
                                    disabled={needsSpotlightSinger}
                                    className={`${styles.btnStd} ${styles.btnHighlight} px-3 py-1.5 text-[11px] ${needsSpotlightSinger ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    {momentDestinationMeta.actionLabel}
                                </button>
                            </div>
                                    </>
                                );
                            })()}
                        </div>
                    )) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-5 text-sm text-zinc-400 xl:col-span-2">
                            {searchQ.trim()
                                ? 'No queueable moments match that search.'
                                : 'No queueable moments available yet.'}
                        </div>
                    )}
                </div>
            ) : null}

            {searchSources.itunes && itunesBackoffRemaining > 0 ? (
                <div className="host-form-helper mb-2 mt-2 text-xs text-yellow-300">
                    Apple Music art is rate-limited. Retrying in {itunesBackoffRemaining}s.
                </div>
            ) : null}

            {quickAddNotice ? (
                <div className="mb-2 mt-2 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2">
                    <div className="truncate text-sm font-bold text-emerald-200">
                        Queued: {quickAddNotice.songTitle}
                    </div>
                    <div className="mt-1 text-xs text-zinc-300">{quickAddNotice.statusText}</div>
                    {quickAddNotice.lyricsGenerationResolution ? (
                        <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-emerald-100/80">
                            Resolution: {quickAddNotice.lyricsGenerationResolution}
                        </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button
                            onClick={onUndoQuickAdd}
                            className={`${styles.btnStd} ${styles.btnDanger} px-3 py-1 text-xs`}
                        >
                            Undo
                        </button>
                        <button
                            onClick={onChangeQuickAddBacking}
                            className={`${styles.btnStd} ${styles.btnSecondary} px-3 py-1 text-xs`}
                        >
                            Change Backing
                        </button>
                    </div>
                </div>
            ) : null}

            {performanceMode && renderResultsInline ? (
                <div className={`mt-2 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden ${baseResultsCardClass}`}>
                    <ResultList {...performanceResultListProps} compactRows={dockResults} />
                </div>
            ) : null}

        </div>
    );
};

export default AddToQueueFormBody;
