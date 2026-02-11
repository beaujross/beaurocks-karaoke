import React from 'react';

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
                                const embedStatus = embedCache[video.id];
                                const isOk = embedStatus === 'ok';
                                const isFail = embedStatus === 'fail';
                                const isTesting = embedStatus === 'testing';

                                return (
                                    <div key={video.id} className={`bg-zinc-800/50 hover:bg-zinc-700 p-3 rounded-lg border transition-all flex gap-3 items-start ${isFail ? 'border-red-500/50 opacity-60' : isOk ? 'border-green-500/50' : 'border-white/10 hover:border-cyan-400'}`}>
                                        <img src={video.thumbnail} className="w-24 h-16 rounded object-cover flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white truncate">{video.title}</div>
                                            <div className="text-sm text-zinc-400 truncate">{video.channel}</div>

                                            <div className="flex gap-2 mt-2 items-center">
                                                {isTesting && <span className="text-sm text-yellow-400 animate-pulse">{emoji.refresh} Testing...</span>}
                                                {isOk && <span className="text-sm text-green-400 font-bold">{emoji.check} Embeddable</span>}
                                                {isFail && <span className="text-sm text-red-400 font-bold">{emoji.cross} Can't Embed</span>}

                                                {!isFail && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); testEmbedVideo(video); }}
                                                        disabled={isTesting}
                                                        className={`text-sm px-2 py-0.5 rounded ${isTesting ? 'bg-zinc-600 text-zinc-400' : isOk ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/50 text-yellow-300 hover:bg-yellow-800/50'}`}
                                                    >
                                                        {emoji.test} {isOk ? 'Verified' : 'Test'}
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => selectYouTubeVideo(video)}
                                                    className={`ml-auto text-sm px-3 py-0.5 rounded font-bold flex items-center gap-1 ${isFail ? 'bg-orange-900/50 text-orange-300 hover:bg-orange-800/50' : 'bg-cyan-600 text-white hover:bg-cyan-500'}`}
                                                >
                                                    {isFail ? <>{emoji.radio} USE</> : <>USE</>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {ytSearchQ && ytResults.length === 0 && !ytLoading && (
                    <div className="host-search-helper text-center py-8">No results found</div>
                )}
            </div>
        </div>
    );
};

export default QueueYouTubeSearchModal;
