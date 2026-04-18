import React from 'react';
import { getYouTubeEmbedCacheStatus } from '../../../lib/youtubePlaybackStatus';

const getEmbedStatusMeta = (status) => {
    if (status === 'ok') {
        return {
            tone: 'border-emerald-500/50',
            chipClass: 'text-sm text-emerald-300 font-bold',
            chipIcon: 'fa-tv',
            chipLabel: 'Embeds on TV',
            helper: 'Uses the in-room player and keeps the main screen in sync.',
            actionClass: 'bg-cyan-600 text-white hover:bg-cyan-500',
            actionLabel: 'USE',
            recheckClass: 'bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/50',
            recheckLabel: 'Recheck'
        };
    }
    if (status === 'fail') {
        return {
            tone: 'border-orange-400/50',
            chipClass: 'text-sm text-orange-300 font-bold',
            chipIcon: 'fa-up-right-from-square',
            chipLabel: 'Not embeddable',
            helper: 'YouTube blocks iframe playback for this video, so the host has to launch it in a separate backing window instead of the TV embed.',
            actionClass: 'bg-orange-900/50 text-orange-200 hover:bg-orange-800/50',
            actionLabel: 'USE EXTERNAL',
            recheckClass: 'bg-orange-950/50 text-orange-200 hover:bg-orange-900/50',
            recheckLabel: 'Recheck'
        };
    }
    if (status === 'testing') {
        return {
            tone: 'border-yellow-500/50',
            chipClass: 'text-sm text-yellow-300 font-bold animate-pulse',
            chipIcon: 'fa-rotate',
            chipLabel: 'Checking playback...',
            helper: 'Confirming whether this result can embed on the TV screen.',
            actionClass: 'bg-zinc-700 text-zinc-300',
            actionLabel: 'CHECKING',
            recheckClass: 'bg-zinc-700 text-zinc-400',
            recheckLabel: 'Checking'
        };
    }
    return {
        tone: 'border-cyan-400/35 hover:border-cyan-300/50',
        chipClass: 'text-sm text-cyan-200 font-bold',
        chipIcon: 'fa-circle-question',
        chipLabel: 'Status pending',
        helper: 'We check whether the track embeds on TV or needs an external backing window.',
        actionClass: 'bg-cyan-600 text-white hover:bg-cyan-500',
        actionLabel: 'USE',
        recheckClass: 'bg-cyan-950/50 text-cyan-200 hover:bg-cyan-900/50',
        recheckLabel: 'Check'
    };
};

const QueueYouTubeSearchModal = ({
    open,
    styles,
    ytSearchQ,
    setYtSearchQ,
    ytEditingQuery,
    setYtEditingQuery,
    ytLoading,
    ytSearchError,
    ytResults,
    embedCache,
    searchYouTube,
    testEmbedVideo,
    selectYouTubeVideo,
    onClose,
    emoji
}) => {
    if (!open) return null;

    return (
        <div className="absolute inset-0 z-[70] bg-black/70 flex items-center justify-center p-6 backdrop-blur-sm pointer-events-none">
            <div className={`${styles.panel} p-6 w-full max-w-2xl border-white/20 max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto`}>
                <div className="flex justify-between items-center mb-4">
                    <div className={styles.header}>Search YouTube</div>
                    <button onClick={onClose} className={`${styles.btnStd} ${styles.btnNeutral} px-3`}>X</button>
                </div>

                <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="text-xs text-zinc-400">
                        Searching for: <span className="text-white font-bold">{ytSearchQ || '...'}</span>
                    </div>
                    <button
                        onClick={() => setYtEditingQuery(prev => !prev)}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-3`}
                    >
                        {ytEditingQuery ? 'Done' : 'Edit'}
                    </button>
                </div>
                {ytEditingQuery && (
                    <div className="flex gap-2 mb-4">
                        <input
                            value={ytSearchQ}
                            onChange={e => setYtSearchQ(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && searchYouTube()}
                            className={styles.input}
                            placeholder="Refine search..."
                        />
                        <button
                            onClick={() => searchYouTube()}
                            disabled={ytLoading}
                            className={`${styles.btnStd} ${ytLoading ? styles.btnNeutral : styles.btnHighlight} px-6 flex-shrink-0`}
                        >
                            {ytLoading ? emoji.refresh : emoji.magnifier}
                        </button>
                    </div>
                )}
                {ytSearchError && (
                    <div className="bg-red-900/30 border border-red-500/40 text-red-200 text-xs rounded-lg px-3 py-2 mb-3">
                        {ytSearchError}
                    </div>
                )}
                <div className="flex-1 min-h-0">
                    {ytResults.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1 pb-2">
                            {ytResults.map(video => {
                                const embedStatus = embedCache[video.id] || getYouTubeEmbedCacheStatus(video);
                                const isTesting = embedStatus === 'testing';
                                const statusMeta = getEmbedStatusMeta(embedStatus);

                                return (
                                    <div key={video.id} className={`bg-zinc-800/50 hover:bg-zinc-700 p-3 rounded-lg border transition-all flex gap-3 items-start ${statusMeta.tone}`}>
                                        <img src={video.thumbnail} className="w-24 h-16 rounded object-cover flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white truncate">{video.title}</div>
                                            <div className="text-sm text-zinc-400 truncate">{video.channel}</div>

                                            <div className="mt-2 flex items-center gap-2">
                                                <span className={statusMeta.chipClass}>
                                                    <i className={`fa-solid ${statusMeta.chipIcon} mr-1`}></i>
                                                    {statusMeta.chipLabel}
                                                </span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); testEmbedVideo(video); }}
                                                    disabled={isTesting}
                                                    className={`text-sm px-2 py-0.5 rounded ${statusMeta.recheckClass}`}
                                                >
                                                    {isTesting ? emoji.refresh : emoji.test} {statusMeta.recheckLabel}
                                                </button>
                                                <button
                                                    onClick={() => selectYouTubeVideo(video)}
                                                    disabled={isTesting}
                                                    className={`ml-auto text-sm px-3 py-0.5 rounded font-bold flex items-center gap-1 ${statusMeta.actionClass} ${isTesting ? 'cursor-wait opacity-70' : ''}`}
                                                >
                                                    {embedStatus === 'fail' ? <i className="fa-solid fa-up-right-from-square"></i> : null}
                                                    {statusMeta.actionLabel}
                                                </button>
                                            </div>
                                            <div className="mt-1 text-[11px] text-zinc-400">
                                                {statusMeta.helper}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-zinc-400">
                    <span className="text-emerald-300 font-semibold">Embeds on TV</span> keeps playback in the in-room player.
                    {' '}
                    <span className="text-orange-300 font-semibold">Not embeddable</span> means YouTube does not allow iframe/API playback for that video, so it uses a separate host-controlled window while the queue item and performance flow still stay in the app.
                </div>

                {ytSearchQ && ytResults.length === 0 && !ytLoading && (
                    <div className="host-search-helper text-center py-8">
                        No YouTube karaoke results. Try a different keyword or paste a direct YouTube URL.
                    </div>
                )}
            </div>
        </div>
    );
};

export default QueueYouTubeSearchModal;
