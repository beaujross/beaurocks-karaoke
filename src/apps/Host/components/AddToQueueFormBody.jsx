import React from 'react';
import {
    YOUTUBE_PLAYBACK_STATUSES,
    normalizeYouTubePlaybackState
} from '../../../lib/youtubePlaybackStatus';

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
    manual,
    setManual,
    manualSingerMode,
    setManualSingerMode,
    hostName,
    users,
    addSong,
    appleMusicAuthorized
}) => {
    const performerSelect = (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.65fr)] gap-2">
            <select
                data-feature-id="host-manual-performer-select"
                value={manualSingerMode === 'custom' ? '__custom' : manual.singer}
                onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__custom') {
                        setManualSingerMode('custom');
                        setManual(prev => ({ ...prev, singer: '' }));
                        return;
                    }
                    setManualSingerMode('select');
                    setManual(prev => ({ ...prev, singer: value }));
                }}
                className={`${styles.input} text-sm`}
            >
                <option value="">Select Performer</option>
                {hostName && (
                    <option value={hostName}>{hostName} (Host)</option>
                )}
                {users.map(u => (
                    <option key={u.uid || u.name} value={u.name}>
                        {u.avatar ? `${u.avatar} ` : ''}{u.name}
                    </option>
                ))}
                <option value="__custom">Custom performer...</option>
            </select>
            {manualSingerMode === 'custom' && (
                <input
                    value={manual.singer}
                    onChange={e=>setManual({...manual, singer:e.target.value})}
                    className={styles.input}
                    placeholder="Custom performer"
                />
            )}
        </div>
    );

    return (
    <div className="mt-2 pr-1">
        <div className="host-autocomplete-shell relative mb-2 z-30">
            <div className="host-autocomplete-field-wrap rounded-xl border border-cyan-400/25 bg-zinc-950/70 px-2 py-2">
                <div className="relative">
                    <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"></i>
                    <input
                        value={searchQ}
                        onChange={e=>setSearchQ(e.target.value)}
                        className={`${styles.input} host-autocomplete-input py-2 text-sm pl-8`}
                        placeholder="Search songs (autocomplete source + local library)"
                    />
                </div>
                <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Performer</div>
                    {performerSelect}
                </div>
                <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Autocomplete Source</div>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            type="button"
                            onClick={() => setAutocompleteProvider('youtube')}
                            className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.12em] ${
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
                            className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.12em] ${
                                autocompleteProvider === 'apple'
                                    ? 'border-pink-300/45 bg-pink-500/12 text-pink-100'
                                    : 'border-zinc-700 bg-zinc-900/70 text-zinc-400'
                            }`}
                            title={appleMusicAuthorized ? 'Use Apple Music autocomplete' : 'Connect Apple Music to use Apple autocomplete'}
                        >
                            <i className="fa-brands fa-apple mr-1"></i>
                            Apple Music
                        </button>
                    </div>
                </div>
                {queueSearchSourceNote && (
                    <div className="mt-2 text-[11px] text-cyan-200 bg-cyan-500/10 border border-cyan-400/25 rounded px-2 py-1">
                        {queueSearchSourceNote}
                    </div>
                )}
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={quickAddOnResultClick}
                            onChange={(e) => setQuickAddOnResultClick(e.target.checked)}
                            className="accent-[#00C4D9]"
                        />
                        Quick Add on click
                    </label>
                    <span>{quickAddOnResultClick ? 'Tap row to queue instantly' : 'Tap row to fill form'}</span>
                </div>
                <div className="mt-2 border-t border-white/10 pt-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Manual Entry</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input data-feature-id="host-manual-song-input" value={manual.song} onChange={e=>setManual({...manual, song:e.target.value})} className={styles.input} placeholder="Song"/>
                        <input data-feature-id="host-manual-artist-input" value={manual.artist} onChange={e=>setManual({...manual, artist:e.target.value})} className={styles.input} placeholder="Artist"/>
                    </div>
                </div>
            </div>
            {(results.length > 0 || searchQ.length >= 3) && (
                <div className="host-autocomplete-results absolute top-full mt-2 left-0 right-0 rounded-2xl border border-cyan-400/25 bg-zinc-950/98 z-50">
                    <div className="host-autocomplete-results-stem" aria-hidden="true"></div>
                    <div className="host-autocomplete-results-head px-3 py-2 border-b border-white/10 bg-black/30 flex items-center justify-between gap-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-300">Search Results</div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-200">
                            {results.length > 0 ? `${results.length} match${results.length === 1 ? '' : 'es'}` : 'No matches'}
                        </div>
                    </div>
                    <div className="host-autocomplete-results-list max-h-[32rem] overflow-y-auto custom-scrollbar p-3">
                        {results.length > 0 ? results.map((r, idx) => (
                            (() => {
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
                                                        <i className="fa-solid fa-hard-drive text-[#00C4D9] text-2xl"></i>
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
                                                    <div className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100 whitespace-nowrap">
                                                        {isAdding ? 'Adding…' : (quickAddOnResultClick ? 'Quick Add' : 'Select')}
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
                                                ) : (
                                                    <div className="mt-3 text-[11px] text-zinc-500">
                                                        {quickAddOnResultClick ? 'Click once to queue immediately.' : 'Click once to drop this into the manual queue form.'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        )) : (
                            <div className="host-search-helper text-center py-3 text-zinc-500 text-xs uppercase tracking-widest">
                                {queueSearchNoResultHint || 'No results yet'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
        {searchSources.itunes && itunesBackoffRemaining > 0 && (
            <div className="host-form-helper mb-2 text-yellow-300 text-xs">
                Apple Music art is rate-limited. Retrying in {itunesBackoffRemaining}s.
            </div>
        )}
        {quickAddNotice && (
            <div className="mb-2 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2">
                <div className="text-sm font-bold text-emerald-200 truncate">
                    Queued: {quickAddNotice.songTitle}
                </div>
                <div className="text-xs text-zinc-300 mt-1">{quickAddNotice.statusText}</div>
                {Boolean(quickAddNotice.lyricsGenerationResolution) && (
                    <div className="text-[10px] uppercase tracking-[0.1em] text-emerald-100/80 mt-1">
                        Resolution: {quickAddNotice.lyricsGenerationResolution}
                    </div>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
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
        )}
        <div className="mb-2 flex justify-end">
            <button data-feature-id="host-manual-queue-submit" onClick={addSong} className={`${styles.btnStd} ${styles.btnHighlight} px-4`}>
                Add to Queue
            </button>
        </div>
    </div>
);
};

export default AddToQueueFormBody;
