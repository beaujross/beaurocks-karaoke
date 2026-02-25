import React from 'react';

const HostQaDebugPanel = ({
    styles,
    roomCode,
    room,
    currentSong,
    queuedSongs,
    users,
    recentActivities,
    lastActivity,
    activities,
    copySnapshot,
    smokeIncludeWrite,
    setSmokeIncludeWrite,
    runSmokeTest,
    smokeRunning,
    smokeResults,
    sparkleEmoji
}) => (
    <div className={`${styles.panel} p-4 border-white/10`}>
        <div className={styles.header}>QA DEBUG</div>
        <div className="mb-3 text-xs text-zinc-400">
            Host UI version: <span className="text-cyan-300 font-semibold">v2 workspace</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3">
                <div className="text-sm uppercase tracking-widest text-zinc-500 mb-2">Room Snapshot</div>
                <div className="text-sm text-zinc-300">Room: <span className="text-white font-mono">{roomCode || '--'}</span></div>
                <div className="text-sm text-zinc-300">Mode: <span className="text-white">{room?.activeMode || 'karaoke'}</span></div>
                <div className="text-sm text-zinc-300">Screen: <span className="text-white">{room?.activeScreen || 'stage'}</span></div>
                <div className="text-sm text-zinc-300">On Stage: <span className="text-white">{currentSong?.singerName || 'None'}</span></div>
                <div className="text-sm text-zinc-300">Queue: <span className="text-white">{queuedSongs.length}</span></div>
                <div className="text-sm text-zinc-300">Lobby: <span className="text-white">{users?.length || 0}</span></div>
            </div>
            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3">
                <div className="text-sm uppercase tracking-widest text-zinc-500 mb-2">Health</div>
                <div className="text-sm text-zinc-300">BG Music: <span className="text-white">{room?.bgMusicPlaying ? 'On' : 'Off'}</span></div>
                <div className="text-sm text-zinc-300">Mix: <span className="text-white">{Math.round(room?.mixFader ?? 50)}%</span></div>
                <div className="text-sm text-zinc-300">Lyrics TV: <span className="text-white">{room?.showLyricsTv ? 'On' : 'Off'}</span></div>
                <div className="text-sm text-zinc-300">Visualizer TV: <span className="text-white">{room?.showVisualizerTv ? 'On' : 'Off'}</span></div>
                <div className="text-sm text-zinc-300">Lyrics Singer: <span className="text-white">{room?.showLyricsSinger ? 'On' : 'Off'}</span></div>
                <div className="text-sm text-zinc-300">Light Mode: <span className="text-white">{room?.lightMode || 'off'}</span></div>
                <div className="text-sm text-zinc-300">Audience Sync: <span className="text-white">{room?.audienceVideoMode || 'off'}</span></div>
            </div>
            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3">
                <div className="text-sm uppercase tracking-widest text-zinc-500 mb-2">Event Pulse</div>
                <div className="text-sm text-zinc-300">Last 5 min: <span className="text-white">{recentActivities.length}</span></div>
                <div className="text-sm text-zinc-300">Last Activity: <span className="text-white">{lastActivity?.text || 'None'}</span></div>
                <button onClick={copySnapshot} className={`${styles.btnStd} ${styles.btnNeutral} mt-3 w-full`}>
                    <i className="fa-solid fa-copy mr-1"></i>Copy Room Snapshot
                </button>
            </div>
        </div>
        <div className="mt-4 border-t border-white/10 pt-3">
            <div className="text-sm uppercase tracking-widest text-zinc-500 mb-2">Recent Activity</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                {(activities || []).slice(0, 10).map((entry, idx) => (
                    <div key={`${entry?.id || entry?.timestamp?.seconds || 'activity'}-${idx}`} className="text-sm text-zinc-300 bg-zinc-900/60 border border-white/5 rounded-lg px-2 py-1">
                        <span className="text-zinc-500 mr-1">{entry?.icon || sparkleEmoji}</span>
                        <span className="text-white">{entry?.user || 'Guest'}</span>
                        <span className="text-zinc-500"> {entry?.text || ''}</span>
                    </div>
                ))}
                {(activities || []).length === 0 && (
                    <div className="text-sm text-zinc-500 italic">No activity yet.</div>
                )}
            </div>
        </div>
        <div className="mt-4 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-sm uppercase tracking-widest text-zinc-500">Smoke Test</div>
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                    <input
                        type="checkbox"
                        checked={smokeIncludeWrite}
                        onChange={(event) => setSmokeIncludeWrite(event.target.checked)}
                        className="accent-[#00C4D9]"
                    />
                    Include write test
                </label>
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={runSmokeTest}
                    disabled={smokeRunning}
                    className={`${styles.btnStd} ${styles.btnSecondary} px-4 ${smokeRunning ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {smokeRunning ? 'Running...' : 'Run Smoke Test'}
                </button>
                <div className="text-sm text-zinc-500">Checks auth, room reads, user profile read/write, and optional write/delete.</div>
            </div>
            {smokeResults.length > 0 && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {smokeResults.map((result, idx) => (
                        <div key={`${result.label}-${idx}`} className="text-sm text-zinc-300 bg-zinc-900/60 border border-white/5 rounded-lg px-2 py-1 flex items-center justify-between gap-2">
                            <div className="truncate">
                                <span className="text-white">{result.label}</span>
                                {result.detail && <span className="text-zinc-500"> - {result.detail}</span>}
                            </div>
                            <span className={`text-sm uppercase tracking-widest ${
                                result.status === 'ok'
                                    ? 'text-emerald-400'
                                    : result.status === 'warn'
                                        ? 'text-yellow-400'
                                        : 'text-rose-400'
                            }`}>
                                {result.status}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
);

export default HostQaDebugPanel;
