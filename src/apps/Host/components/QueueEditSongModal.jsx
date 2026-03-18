import React from 'react';

const QueueEditSongModal = ({
    open,
    song = null,
    styles,
    editForm,
    setEditForm,
    openYtSearch,
    syncEditDuration,
    generateLyrics,
    onRetryLyrics,
    onFetchTimedLyrics,
    onCancel,
    onSave,
    emoji
}) => {
    if (!open) return null;

    const hasTimedLyrics = Array.isArray(song?.lyricsTimed) && song.lyricsTimed.length > 0;
    const hasLyrics = !!String(song?.lyrics || editForm.lyrics || '').trim();
    const lyricsStatus = String(song?.lyricsGenerationStatus || editForm.lyricsGenerationStatus || '').trim().toLowerCase();
    const lyricsResolution = String(song?.lyricsGenerationResolution || editForm.lyricsGenerationResolution || '').trim();
    const playbackLabel = editForm.appleMusicId || !editForm.url
        ? 'Saved / Apple default'
        : (String(editForm.url || '').includes('youtu') ? 'YouTube backing' : 'Custom media');
    const statusToneClass = hasTimedLyrics
        ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
        : hasLyrics
            ? 'border-sky-300/40 bg-sky-500/10 text-sky-100'
            : lyricsStatus === 'pending'
                ? 'border-cyan-300/40 bg-cyan-500/10 text-cyan-100'
                : 'border-zinc-600/60 bg-zinc-900/70 text-zinc-300';
    const statusLabel = hasTimedLyrics
        ? 'Timed lyrics ready'
        : hasLyrics
            ? 'Static lyrics ready'
            : lyricsStatus === 'pending'
                ? 'Lyrics resolving'
                : 'No lyrics loaded';

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 md:p-6 backdrop-blur-sm">
            <div className={`${styles.panel} w-full max-w-5xl border-white/20 overflow-hidden`}>
                <div className="px-5 py-4 border-b border-white/10 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className={styles.header}>EDIT SONG METADATA</div>
                        <div className="mt-1 text-sm text-zinc-400">
                            Update playback, lyrics, and queue metadata without leaving the stage deck.
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em]">
                        <span className={`rounded-full border px-3 py-1 ${statusToneClass}`}>{statusLabel}</span>
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-cyan-100">
                            {playbackLabel}
                        </span>
                    </div>
                </div>

                <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        <input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className={styles.input}
                            placeholder="Title"
                        />
                        <input
                            value={editForm.artist}
                            onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                            className={styles.input}
                            placeholder="Artist"
                        />
                        <input
                            value={editForm.singer}
                            onChange={(e) => setEditForm({ ...editForm, singer: e.target.value })}
                            className={styles.input}
                            placeholder="Performer"
                        />
                        <input
                            value={editForm.art}
                            onChange={(e) => setEditForm({ ...editForm, art: e.target.value })}
                            className={styles.input}
                            placeholder="Artwork URL"
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <section className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.24em] text-zinc-300">Lyrics On Screen</div>
                                    <div className="mt-1 text-sm text-zinc-400">
                                        Control the words shown to the singer and TV. Timed sync is preserved unless you replace it with manual lyrics.
                                    </div>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${statusToneClass}`}>
                                    {statusLabel}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={generateLyrics}
                                    className={`${styles.btnStd} ${styles.btnInfo} px-3 text-sm`}
                                >
                                    {emoji.robot} Auto-generate
                                </button>
                                <button
                                    onClick={() => onRetryLyrics?.(song)}
                                    className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-sm`}
                                    title="Retry full lyrics resolution"
                                >
                                    Retry Lyrics
                                </button>
                                <button
                                    onClick={() => onFetchTimedLyrics?.(song)}
                                    className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-sm`}
                                    title="Fetch timed lyrics only"
                                >
                                    Fetch Timed
                                </button>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                                <div className="font-semibold text-white">Lyrics status</div>
                                <div className="mt-1">
                                    {hasTimedLyrics
                                        ? 'Timed sync is ready for singer and TV surfaces.'
                                        : hasLyrics
                                            ? 'Static lyrics are saved. Auto scroll uses the duration below.'
                                            : lyricsStatus === 'pending'
                                                ? 'BeauRocks is still checking cache, Apple, and AI fallback.'
                                                : 'No lyrics are currently attached to this queue item.'}
                                </div>
                                {!!lyricsResolution && (
                                    <div className="mt-1 text-xs text-zinc-500">Resolution: {lyricsResolution}</div>
                                )}
                            </div>

                            <div className="flex gap-2 items-center bg-black/20 p-2 rounded-xl">
                                <span className="text-sm text-zinc-400">Duration</span>
                                <input
                                    type="range"
                                    min="60"
                                    max="600"
                                    value={editForm.duration}
                                    onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                                    className="flex-1 accent-pink-500"
                                />
                                <span className="text-sm font-mono w-12 text-right">{editForm.duration}s</span>
                                <button
                                    onClick={syncEditDuration}
                                    className="text-sm px-2 py-1 rounded border border-cyan-400/40 text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20"
                                    title="Sync duration from URL"
                                >
                                    Sync
                                </button>
                            </div>

                            <textarea
                                value={editForm.lyrics}
                                onChange={(e) => setEditForm({ ...editForm, lyrics: e.target.value })}
                                className={`${styles.input} h-56 font-mono host-lyrics-input`}
                                placeholder="Paste custom lyrics here if the default lyrics are missing or wrong..."
                            />
                        </section>

                        <section className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.24em] text-zinc-300">Playback For The Room</div>
                                    <div className="mt-1 text-sm text-zinc-400">
                                        Choose what the room hears behind the singer. Leave it blank to use the saved or Apple default backing.
                                    </div>
                                </div>
                                <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-cyan-100">
                                    {playbackLabel}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setEditForm((prev) => ({ ...prev, url: '', appleMusicId: prev.originalAppleMusicId || prev.appleMusicId || '' }))}
                                    className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-sm text-[#00C4D9] border-[#00C4D9]`}
                                    title="Use the saved or Apple default backing for this song"
                                >
                                    <i className="fa-brands fa-apple mr-1"></i>
                                    Use Saved / Default
                                </button>
                                <button
                                    onClick={() => openYtSearch('edit', `${editForm.title} ${editForm.artist}`.trim())}
                                    className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-sm text-[#00C4D9] border-[#00C4D9]`}
                                    title="Search YouTube and pick backing"
                                >
                                    <i className="fa-brands fa-youtube mr-1"></i>
                                    Choose YouTube Backing
                                </button>
                            </div>

                            <input
                                value={editForm.url}
                                onChange={(e) => setEditForm({ ...editForm, url: e.target.value, appleMusicId: '' })}
                                className={styles.input}
                                placeholder="Optional: paste a YouTube, local, or playlist URL directly"
                            />

                            <div className="text-sm text-zinc-400">
                                Leave this blank to use the saved/default backing. Playlist URLs queue up to 1000 tracks.
                            </div>
                        </section>
                    </div>
                </div>

                <div className="flex gap-2 justify-end px-5 py-4 border-t border-white/10 bg-black/20">
                    <button onClick={onCancel} className={`${styles.btnStd} ${styles.btnNeutral}`}>Cancel</button>
                    <button onClick={onSave} className={`${styles.btnStd} ${styles.btnPrimary} px-8`}>Save changes</button>
                </div>
            </div>
        </div>
    );
};

export default QueueEditSongModal;
