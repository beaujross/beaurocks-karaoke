import React, { useState } from 'react';

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
    statusPill,
    lyricsOpen,
    setLyricsOpen,
    onGenerateManualLyrics,
    manualBackingChip,
    openYtSearch,
    addSong,
    appleMusicAuthorized
}) => {
    const hasOptionalMedia = !!String(manual.lyrics || '').trim() || !!String(manual.url || '').trim();
    const mediaSummaryLabel = manualBackingChip.label === 'Apple Music'
        ? 'Apple default'
        : manualBackingChip.label;
    const [mediaToolsOpen, setMediaToolsOpen] = useState(() => hasOptionalMedia);

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
                        <button
                            type="button"
                            disabled
                            className="px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.12em] border-zinc-800 bg-zinc-900/60 text-zinc-600 cursor-not-allowed"
                            title="Coming soon"
                        >
                            <i className="fa-brands fa-spotify mr-1"></i>
                            Spotify (Soon)
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
                    <div className="host-autocomplete-results-list max-h-80 overflow-y-auto custom-scrollbar">
                        {results.length > 0 ? results.map((r, idx) => (
                            (() => {
                                const rowKey = getResultRowKey(r, idx);
                                const isAdding = quickAddLoadingKey === rowKey;
                                return (
                                    <div
                                        key={rowKey}
                                        onClick={() => handleResultClick(r, idx)}
                                        className="host-autocomplete-result-row group grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3 items-center px-3 py-2.5 hover:bg-zinc-900/90 border-b border-white/5 cursor-pointer"
                                    >
                                        <div className="w-[52px] h-[52px] flex items-center justify-center bg-zinc-900 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                                            {r.source === 'local' ? (
                                                <i className="fa-solid fa-hard-drive text-[#00C4D9] text-lg"></i>
                                            ) : r.source === 'youtube' ? (
                                                <div className="relative">
                                                    <img src={r.artworkUrl100} className="w-[52px] h-[52px] rounded-lg object-cover" alt="" />
                                                    <i className="fa-brands fa-youtube text-red-500 absolute -bottom-1 -right-1 text-[10px] bg-black/70 rounded-full p-[2px]"></i>
                                                </div>
                                            ) : (
                                                <img src={r.artworkUrl100} className="w-[52px] h-[52px] rounded-lg object-cover" alt="" />
                                            )}
                                        </div>
                                        <div className="min-w-0 space-y-0.5">
                                            <div className="font-semibold text-white text-sm leading-tight truncate">{r.trackName}</div>
                                            <div className="text-zinc-400 text-xs truncate">{r.artistName}</div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className={`px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.08em] ${
                                                    r.source === 'itunes'
                                                        ? 'border-pink-300/40 bg-pink-500/10 text-pink-100'
                                                        : r.source === 'youtube'
                                                            ? 'border-red-300/40 bg-red-500/10 text-red-100'
                                                            : 'border-cyan-300/40 bg-cyan-500/10 text-cyan-100'
                                                }`}>
                                                    {r.source === 'itunes' ? 'Apple' : r.source === 'youtube' ? 'YouTube' : 'Local'}
                                                </span>
                                                {r.source === 'youtube' && (
                                                    <span className={`px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.08em] ${r.playable === false ? 'border-rose-300/40 bg-rose-500/10 text-rose-100' : 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'}`}>
                                                    {r.playable === false ? 'Unverified' : 'Playable'}
                                                </span>
                                                )}
                                            </div>
                                            {!!r.sourceDetail && (
                                                <div className="text-[10px] text-zinc-500 truncate">{r.sourceDetail}</div>
                                            )}
                                        </div>
                                        <div className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                                            <span className="px-2 py-1 rounded-full border border-cyan-300/25 bg-cyan-500/10 text-cyan-100 whitespace-nowrap">
                                                {isAdding ? 'Adding...' : (quickAddOnResultClick ? 'Quick Add' : 'Select Track')}
                                            </span>
                                            <i className="fa-solid fa-chevron-right text-zinc-500 group-hover:text-cyan-200"></i>
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
                {!!quickAddNotice.lyricsGenerationResolution && (
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
        <div className="mb-2 rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Song Details</div>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1.4fr_1.4fr_1.1fr] gap-2">
                <input value={manual.song} onChange={e=>setManual({...manual, song:e.target.value})} className={styles.input} placeholder="Song"/>
                <input value={manual.artist} onChange={e=>setManual({...manual, artist:e.target.value})} className={styles.input} placeholder="Artist"/>
                <select
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
        </div>
        <div className="mb-2 rounded-xl border border-white/10 bg-black/30 p-3">
            <button
                type="button"
                onClick={() => setMediaToolsOpen(v => !v)}
                className="w-full flex items-center justify-between gap-3 text-left"
                aria-expanded={mediaToolsOpen}
            >
                <div className="min-w-0">
                    <div className="text-xs uppercase tracking-widest text-zinc-400">Load Music &amp; Media</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                        <span className={statusPill}>Backing: {mediaSummaryLabel}</span>
                        <span className={statusPill}>Lyrics: {manual.lyrics ? 'Added' : 'None'}</span>
                    </div>
                </div>
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-cyan-200">
                    {mediaToolsOpen ? 'Hide' : 'Open'}
                    <i className={`fa-solid ${mediaToolsOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                </span>
            </button>
            {mediaToolsOpen && (
                <div className="mt-3 border-t border-white/10 pt-3 space-y-3">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-zinc-400">
                                <span>Lyrics</span>
                                <span className={statusPill}>
                                    {manual.lyrics ? 'Added' : 'None'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setLyricsOpen(v => !v)}
                                    className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-xs min-h-[30px]`}
                                >
                                    {lyricsOpen ? 'Hide Lyrics' : 'Edit Lyrics'}
                                </button>
                                <button
                                    onClick={onGenerateManualLyrics}
                                    className={`${styles.btnStd} ${styles.btnHighlight} px-3 text-xs min-h-[30px]`}
                                    title="Add AI Lyrics"
                                >
                                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                                    Add AI Lyrics
                                </button>
                            </div>
                        </div>
                        {lyricsOpen && (
                            <textarea
                                value={manual.lyrics}
                                onChange={e=>setManual({...manual, lyrics:e.target.value})}
                                className={`${styles.input} w-full h-20 font-mono resize-none host-lyrics-input`}
                                placeholder="Paste lyrics here (optional)..."
                            />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-xs uppercase tracking-widest text-zinc-400">Backing Track</div>
                            <span
                                className={statusPill}
                                title={manualBackingChip.label === 'Apple Music'
                                    ? 'Default backing: Apple Music'
                                    : `Selected backing: ${manualBackingChip.label}`
                                }
                            >
                                {manualBackingChip.label === 'Apple Music'
                                    ? 'Default: Apple Music'
                                    : manualBackingChip.label
                                }
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <button
                                onClick={() => setManual(prev => ({ ...prev, url: '', backingAudioOnly: false }))}
                                className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-[#00C4D9] border-[#00C4D9]`}
                                title="Use the default Apple Music track"
                            >
                                <i className="fa-brands fa-apple mr-1"></i>
                                Apple Default
                            </button>
                            <button
                                onClick={() => openYtSearch('manual', `${manual.song} ${manual.artist}`.trim() || searchQ)}
                                className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-[#00C4D9] border-[#00C4D9]`}
                                title="Search YouTube and pick a backing track"
                            >
                                <i className="fa-brands fa-youtube mr-1"></i>
                                Search YouTube
                            </button>
                        </div>
                        <input
                            value={manual.url}
                            onChange={e=>setManual({...manual, url:e.target.value})}
                            className={styles.input}
                            placeholder="Paste a YouTube/local URL or YouTube playlist URL"
                        />
                        <div className="host-form-helper mt-2">Playlist URL in this field queues up to 1000 tracks.</div>
                    </div>
                </div>
            )}
        </div>
        <div className="mb-2 flex justify-end">
            <button onClick={addSong} className={`${styles.btnStd} ${styles.btnHighlight} px-4`}>
                Add to Queue
            </button>
        </div>
    </div>
);
};

export default AddToQueueFormBody;
