import React from 'react';

const QueueEditSongModal = ({
    open,
    styles,
    editForm,
    setEditForm,
    openYtSearch,
    syncEditDuration,
    generateLyrics,
    onCancel,
    onSave,
    emoji
}) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className={`${styles.panel} p-6 w-full max-w-lg border-white/20 space-y-3`}>
                <div className={styles.header}>EDIT SONG METADATA</div>
                <div className="grid grid-cols-2 gap-2">
                    <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className={styles.input} placeholder="Title" />
                    <input value={editForm.artist} onChange={e => setEditForm({ ...editForm, artist: e.target.value })} className={styles.input} placeholder="Artist" />
                </div>
                <div className="flex gap-2 items-center">
                    <input value={editForm.url} onChange={e => setEditForm({ ...editForm, url: e.target.value })} className={`${styles.input} flex-1`} placeholder="Media URL (YouTube/MP4)" />
                    <button onClick={() => openYtSearch('edit', `${editForm.title} ${editForm.artist}`.trim())} className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-[#00C4D9] border-[#00C4D9]`} title="Search YouTube"><i className="fa-brands fa-youtube"></i> Find</button>
                </div>

                <div className={styles.header}>LYRICS & TIMING</div>
                <div className="flex gap-2 items-center bg-black/20 p-2 rounded">
                    <span className="text-sm text-zinc-400">Duration:</span>
                    <input type="range" min="60" max="600" value={editForm.duration} onChange={e => setEditForm({ ...editForm, duration: e.target.value })} className="flex-1 accent-pink-500" />
                    <span className="text-sm font-mono w-10 text-right">{editForm.duration}s</span>
                    <button onClick={syncEditDuration} className="text-sm px-2 py-1 rounded border border-cyan-400/40 text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20" title="Sync duration from URL">Sync</button>
                </div>
                <div className="text-sm text-zinc-500">Used only when lyrics have no sync data (AI or manual). Sets scroll speed.</div>
                <textarea value={editForm.lyrics} onChange={e => setEditForm({ ...editForm, lyrics: e.target.value })} className={`${styles.input} h-32 font-mono host-lyrics-input`} placeholder="Paste lyrics here..."></textarea>

                <div className="flex gap-2">
                    <button onClick={generateLyrics} className={`${styles.btnStd} ${styles.btnInfo} flex-1`}>{emoji.robot} Auto-generate (AI)</button>
                </div>

                <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-white/10">
                    <button onClick={onCancel} className={`${styles.btnStd} ${styles.btnNeutral}`}>Cancel</button>
                    <button onClick={onSave} className={`${styles.btnStd} ${styles.btnPrimary} px-8`}>Save changes</button>
                </div>
            </div>
        </div>
    );
};

export default QueueEditSongModal;
