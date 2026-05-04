import React from 'react';
import {
    YOUTUBE_PLAYBACK_STATUSES,
    normalizeYouTubePlaybackState
} from '../../../lib/youtubePlaybackStatus';

const baseResultsCardClass = 'rounded-2xl border border-cyan-400/25 bg-zinc-950/98';

const ResultList = ({
    results = [],
    searchQ = '',
    queueSearchNoResultHint = '',
    getResultRowKey,
    quickAddLoadingKey = '',
    handleResultClick,
    quickAddOnResultClick = true,
    performanceActionsEnabled = false,
    nextOpenSlot = null,
    laterOpenSlot = null,
    onQueueOnly,
    onAddNext,
    onAddLater,
}) => (
    <>
        <div className="host-autocomplete-results-head flex items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 py-2">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-300">Results</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-200">
                {results.length > 0 ? `${results.length} match${results.length === 1 ? '' : 'es'}` : 'No matches'}
            </div>
        </div>
        <div className="host-autocomplete-results-list min-h-0 flex-1 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar p-3">
            {results.length > 0 ? results.map((r, idx) => {
                const rowKey = getResultRowKey(r, idx);
                const isAdding = quickAddLoadingKey === rowKey;
                const playbackState = r.source === 'youtube'
                    ? normalizeYouTubePlaybackState(r)
                    : null;

                return (
                    <div
                        key={rowKey}
                        onClick={() => handleResultClick(r, idx)}
                        className="host-autocomplete-result-row group mb-3 cursor-pointer rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(25,16,44,0.98),rgba(16,10,34,0.95))] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition hover:border-cyan-300/35 hover:bg-[linear-gradient(180deg,rgba(35,22,58,0.98),rgba(18,12,38,0.98))]"
                    >
                        <div className="grid gap-3 md:grid-cols-[94px_minmax(0,1fr)]">
                            <div className="relative overflow-hidden rounded-[1.1rem] border border-white/10 bg-black/40">
                                {r.source === 'local' ? (
                                    <div className="flex h-[94px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.28),transparent_55%),linear-gradient(180deg,rgba(12,17,31,1),rgba(8,12,24,1))]">
                                        <i className="fa-solid fa-hard-drive text-2xl text-[#00C4D9]"></i>
                                    </div>
                                ) : (
                                    <img src={r.artworkUrl100} className="h-[94px] w-full object-cover" alt="" />
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-2 py-2">
                                    <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-white">
                                        <span>#{idx + 1}</span>
                                        <span>{r.source === 'itunes' ? 'Apple' : r.source === 'youtube' ? 'YouTube' : 'Local'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="line-clamp-2 text-base font-black leading-tight text-white">{r.trackName}</div>
                                        <div className="mt-1 truncate text-sm text-zinc-300">{r.artistName}</div>
                                    </div>
                                    <div className="whitespace-nowrap rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                        {isAdding ? 'Adding...' : (quickAddOnResultClick ? 'Quick Add' : 'Select')}
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                        r.source === 'itunes'
                                            ? 'border-pink-300/40 bg-pink-500/10 text-pink-100'
                                            : r.source === 'youtube'
                                                ? 'border-red-300/40 bg-red-500/10 text-red-100'
                                                : 'border-cyan-300/40 bg-cyan-500/10 text-cyan-100'
                                    }`}>
                                        {r.source === 'itunes' ? 'Apple lookup' : r.source === 'youtube' ? 'Karaoke backing' : 'Local library'}
                                    </span>
                                    {r.source === 'youtube' ? (
                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${playbackState?.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.notEmbeddable ? 'border-orange-300/40 bg-orange-500/10 text-orange-100' : 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'}`}>
                                            {playbackState?.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.notEmbeddable ? 'Not embeddable' : 'Embeds on TV'}
                                        </span>
                                    ) : null}
                                </div>
                                {r.sourceDetail ? (
                                    <div className="mt-3 line-clamp-2 text-[11px] text-zinc-500">{r.sourceDetail}</div>
                                ) : null}
                                {performanceActionsEnabled ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {nextOpenSlot?.id ? (
                                            <button
                                                data-feature-id="performance-result-add-next"
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onAddNext?.(r);
                                                }}
                                                className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100"
                                            >
                                                Add Next
                                            </button>
                                        ) : null}
                                        {laterOpenSlot?.id ? (
                                            <button
                                                data-feature-id="performance-result-add-later"
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onAddLater?.(r);
                                                }}
                                                className="rounded-full border border-violet-300/30 bg-violet-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-100"
                                            >
                                                Add Later
                                            </button>
                                        ) : null}
                                        <button
                                            data-feature-id="performance-result-queue-only"
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onQueueOnly?.(r);
                                            }}
                                            className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200"
                                        >
                                            Queue Only
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                );
            }) : (
                <div className="host-search-helper py-3 text-center text-xs uppercase tracking-widest text-zinc-500">
                    {searchQ.length >= 3 ? (queueSearchNoResultHint || 'No results yet') : 'Type at least 3 characters to search.'}
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
        id: 'would_you_rather',
        category: 'game',
        title: 'Would You Rather',
        detail: 'Fast audience vote with instant reveal.',
        toneClass: 'border-emerald-300/22 bg-emerald-500/8',
    },
    {
        id: 'applause_meter',
        category: 'game',
        title: 'Applause Meter',
        detail: 'Measure the room before the next singer.',
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

const normalizePerformerSearch = (value = '') => (
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
);

const buildScenePresetPreview = (preset = {}) => {
    const mediaUrl = String(preset?.mediaUrl || '').trim();
    const mediaType = String(preset?.mediaType || '').trim().toLowerCase() === 'video' ? 'video' : 'image';
    return { mediaUrl, mediaType, isVideo: mediaType === 'video' };
};

const AddToQueueFormBody = ({
    searchQ,
    setSearchQ,
    autocompleteProvider,
    setAutocompleteProvider,
    styles,
    quickAddOnResultClick,
    setQuickAddOnResultClick,
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
    onOpenPlanner,
    onOpenTvLibrary,
    scenePresets = [],
    onQueueScenePreset,
    onAddScenePresetToRunOfShow,
    onAddQuickRunOfShowMoment,
    runOfShowOpenSlots = [],
    onQueuePerformanceResult,
    onQueueManualPerformance,
    dockResults = false,
}) => {
    const [manualEntryOpen, setManualEntryOpen] = React.useState(!dockResults);
    const [activeMomentType, setActiveMomentType] = React.useState('performance');
    const [selectedLaterSlotId, setSelectedLaterSlotId] = React.useState('');
    const [performerPickerOpen, setPerformerPickerOpen] = React.useState(false);

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
    const plannerLaunchMode = activeMomentType === 'audience' || activeMomentType === 'announcement' || activeMomentType === 'game' || activeMomentType === 'sponsor';
    const filteredMomentPacks = quickMomentPacks.filter((pack) => pack.category === activeMomentType);
    const recentScenePresets = Array.isArray(scenePresets) ? scenePresets.slice(0, 4) : [];
    const openPerformanceSlotCount = Array.isArray(runOfShowOpenSlots) ? runOfShowOpenSlots.length : 0;
    const nextOpenSlot = Array.isArray(runOfShowOpenSlots) ? runOfShowOpenSlots[0] || null : null;
    const laterOpenSlots = Array.isArray(runOfShowOpenSlots) ? runOfShowOpenSlots.slice(1, 4) : [];
    const selectedLaterSlot = laterOpenSlots.find((slot) => slot.id === selectedLaterSlotId) || laterOpenSlots[0] || null;
    const performanceResultListProps = {
        results,
        searchQ,
        queueSearchNoResultHint,
        getResultRowKey,
        quickAddLoadingKey,
        handleResultClick,
        quickAddOnResultClick,
        performanceActionsEnabled: performanceMode,
        nextOpenSlot,
        laterOpenSlot: selectedLaterSlot,
        onQueueOnly: (result) => onQueuePerformanceResult?.(result),
        onAddNext: (result) => onQueuePerformanceResult?.(result, {
            slotId: nextOpenSlot?.id || '',
            slotLabel: nextOpenSlot?.label || '',
        }),
        onAddLater: (result) => onQueuePerformanceResult?.(result, {
            slotId: selectedLaterSlot?.id || '',
            slotLabel: selectedLaterSlot?.label || '',
        }),
    };

    React.useEffect(() => {
        if (!laterOpenSlots.length) {
            setSelectedLaterSlotId('');
            return;
        }
        setSelectedLaterSlotId((current) => (
            laterOpenSlots.some((slot) => slot.id === current)
                ? current
                : String(laterOpenSlots[0]?.id || '')
        ));
    }, [laterOpenSlots]);

    const handleAddSinger = async () => {
        const queued = await addSong?.();
        if (queued?.id && typeof onManualQueueResult === 'function') {
            onManualQueueResult(queued);
        }
    };
    const handleAddSingerToSlot = async (slot = null) => {
        const slotId = String(slot?.id || '').trim();
        if (!slotId) return;
        await onQueueManualPerformance?.({
            slotId,
            slotLabel: slot?.label || '',
        });
    };

    return (
        <div className={`mt-2 pr-1 ${dockResults ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
            <div className="mb-2 flex flex-wrap gap-2">
                {momentTypes.map((entry) => {
                    const active = entry.id === activeMomentType;
                    return (
                        <button
                            key={entry.id}
                            type="button"
                            onClick={() => setActiveMomentType(entry.id)}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                                active
                                    ? 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100'
                                    : 'border-white/10 bg-black/20 text-zinc-300 hover:border-cyan-300/25 hover:text-white'
                            }`}
                        >
                            <i className={`fa-solid ${entry.icon} mr-1.5`}></i>
                            {entry.label}
                        </button>
                    );
                })}
            </div>

            {!performanceMode ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
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
                                    : 'Game break'}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                        {activeMomentType === 'tv'
                            ? 'Choose a scene source below.'
                            : 'Add a quick beat or open Planner.'}
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
                        {plannerLaunchMode && typeof onOpenPlanner === 'function' ? (
                            <button
                                type="button"
                                onClick={() => onOpenPlanner?.()}
                                className={`${styles.btnStd} ${styles.btnHighlight} px-3 py-1.5 text-[11px]`}
                            >
                                Planner
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className="host-autocomplete-shell relative z-30">
                    <div className={`host-autocomplete-field-wrap rounded-xl border border-cyan-400/25 bg-zinc-950/70 px-2 py-2 ${dockResults ? 'sticky top-0 z-20' : ''}`}>
                        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(14rem,0.9fr)_auto]">
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"></i>
                                <input
                                    value={searchQ}
                                    onChange={(e) => setSearchQ(e.target.value)}
                                    className={`${styles.input} host-autocomplete-input py-2 pl-8 text-sm`}
                                    placeholder="Search songs or backing tracks"
                                />
                            </div>
                            <div className="min-w-0">
                                {performerSelect}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setAutocompleteProvider('youtube')}
                                    className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${
                                        autocompleteProvider === 'youtube'
                                            ? 'border-red-300/45 bg-red-500/12 text-red-100'
                                            : 'border-zinc-700 bg-zinc-900/70 text-zinc-400'
                                    }`}
                                >
                                    <i className="fa-brands fa-youtube mr-1"></i>
                                    YouTube
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAutocompleteProvider('apple')}
                                    className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${
                                        autocompleteProvider === 'apple'
                                            ? 'border-pink-300/45 bg-pink-500/12 text-pink-100'
                                            : 'border-zinc-700 bg-zinc-900/70 text-zinc-400'
                                    }`}
                                    title={appleMusicAuthorized ? 'Use Apple Music autocomplete' : 'Connect Apple Music to use Apple autocomplete'}
                                >
                                    <i className="fa-brands fa-apple mr-1"></i>
                                    Apple Music
                                </button>
                                {typeof openYtSearch === 'function' ? (
                                    <button
                                        type="button"
                                        onClick={() => openYtSearch('manual', searchQ || `${manual.song || ''} ${manual.artist || ''}`.trim())}
                                        className={`${styles.btnStd} ${styles.btnSecondary} min-h-[38px] px-3 py-1 text-[11px]`}
                                    >
                                        Search YouTube
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        {queueSearchSourceNote ? (
                            <div className="mt-2 rounded px-2 py-1 text-[11px] text-cyan-200 border border-cyan-400/25 bg-cyan-500/10">
                                {queueSearchSourceNote}
                            </div>
                        ) : null}
                        {openPerformanceSlotCount > 0 ? (
                            <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    {nextOpenSlot ? (
                                        <span className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                                            Next: {nextOpenSlot.label}
                                        </span>
                                    ) : null}
                                    {laterOpenSlots.length > 0 ? (
                                        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Later target</span>
                                    ) : null}
                                    {laterOpenSlots.map((slot) => {
                                        const active = slot.id === selectedLaterSlot?.id;
                                        return (
                                            <button
                                                key={slot.id}
                                                type="button"
                                                onClick={() => setSelectedLaterSlotId(slot.id)}
                                                className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                                    active
                                                        ? 'border-violet-300/35 bg-violet-500/12 text-violet-100'
                                                        : 'border-white/10 bg-black/25 text-zinc-300'
                                                }`}
                                            >
                                                {slot.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                            <label className="inline-flex cursor-pointer select-none items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={quickAddOnResultClick}
                                    onChange={(e) => setQuickAddOnResultClick(e.target.checked)}
                                    className="accent-[#00C4D9]"
                                />
                                Tap to queue
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                                <span>
                                    {openPerformanceSlotCount > 0
                                        ? `${openPerformanceSlotCount} open slot${openPerformanceSlotCount === 1 ? '' : 's'}`
                                        : (quickAddOnResultClick ? '1 tap adds it' : '1 tap fills manual')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setManualEntryOpen((value) => !value)}
                                    className={`${styles.btnStd} ${styles.btnNeutral} px-2.5 py-1 text-[10px]`}
                                >
                                    {manualEntryOpen ? 'Hide' : 'Manual'}
                                </button>
                            </div>
                        </div>
                        {manualEntryOpen ? (
                            <div className="mt-2 border-t border-white/10 pt-2">
                                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Manual</div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    <input data-feature-id="host-manual-song-input" value={manual.song} onChange={(e) => setManual({ ...manual, song: e.target.value })} className={styles.input} placeholder="Song" />
                                    <input data-feature-id="host-manual-artist-input" value={manual.artist} onChange={(e) => setManual({ ...manual, artist: e.target.value })} className={styles.input} placeholder="Artist" />
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {!renderResultsInline && showResults ? (
                        <div className={`host-autocomplete-results absolute left-0 right-0 top-full mt-2 z-50 flex max-h-[min(32rem,calc(100dvh-14rem))] flex-col overflow-hidden ${baseResultsCardClass}`}>
                            <div className="host-autocomplete-results-stem" aria-hidden="true"></div>
                            <ResultList {...performanceResultListProps} />
                        </div>
                    ) : null}
                </div>
            )}

            {!performanceMode && activeMomentType === 'tv' ? (
                <div className="mt-3 grid gap-2 xl:grid-cols-2">
                    {recentScenePresets.length > 0 ? recentScenePresets.map((preset) => {
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
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onQueueScenePreset?.(preset)}
                                                className={`${styles.btnStd} ${styles.btnHighlight} px-3 py-1.5 text-[11px]`}
                                            >
                                                Add Next In Show
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onAddScenePresetToRunOfShow?.(preset)}
                                                className={`${styles.btnStd} ${styles.btnSecondary} px-3 py-1.5 text-[11px]`}
                                            >
                                                Add Later
                                            </button>
                                        </div>
                                        <div className="mt-2 text-[11px] text-zinc-500">
                                            Adds to the live show conveyor, not the singer queue.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-5 text-sm text-zinc-400 xl:col-span-2">
                            No saved scenes yet. Use `Search YouTube` or `Open Media Library`.
                        </div>
                    )}
                </div>
            ) : null}

            {!performanceMode && activeMomentType !== 'tv' ? (
                <div className="mt-3 grid gap-2 xl:grid-cols-2">
                    {filteredMomentPacks.map((pack) => (
                        <div key={pack.id} className={`rounded-2xl border p-3 ${pack.toneClass}`}>
                            <div className="text-sm font-black text-white">{pack.title}</div>
                            <div className="mt-1 text-xs text-zinc-300">{pack.detail}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => onAddQuickRunOfShowMoment?.(pack.id, { placement: 'next' })}
                                    className={`${styles.btnStd} ${styles.btnHighlight} px-3 py-1.5 text-[11px]`}
                                >
                                    Add Next
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onAddQuickRunOfShowMoment?.(pack.id, { placement: 'append' })}
                                    className={`${styles.btnStd} ${styles.btnSecondary} px-3 py-1.5 text-[11px]`}
                                >
                                    Add Later
                                </button>
                            </div>
                        </div>
                    ))}
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
                <div className={`mt-2 flex min-h-0 max-h-[min(56dvh,36rem)] flex-1 flex-col overflow-hidden ${baseResultsCardClass}`}>
                    <ResultList {...performanceResultListProps} />
                </div>
            ) : null}

            {performanceMode ? (
                <div className="mb-2 mt-2 flex flex-wrap justify-end gap-2">
                    {nextOpenSlot ? (
                        <button
                            data-feature-id="host-manual-add-next"
                            type="button"
                            onClick={() => { void handleAddSingerToSlot(nextOpenSlot); }}
                            className={`${styles.btnStd} ${styles.btnHighlight} px-4`}
                        >
                            Add Next
                        </button>
                    ) : null}
                    {selectedLaterSlot ? (
                        <button
                            data-feature-id="host-manual-add-later"
                            type="button"
                            onClick={() => { void handleAddSingerToSlot(selectedLaterSlot); }}
                            className={`${styles.btnStd} ${styles.btnSecondary} px-4`}
                        >
                            Add Later
                        </button>
                    ) : null}
                    <button data-feature-id="host-manual-queue-submit" onClick={() => { void handleAddSinger(); }} className={`${styles.btnStd} ${styles.btnNeutral} px-4`}>
                        Queue Only
                    </button>
                </div>
            ) : null}
        </div>
    );
};

export default AddToQueueFormBody;
