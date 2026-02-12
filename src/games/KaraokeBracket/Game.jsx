import React from 'react';

const getContestant = (state, uid) => {
    if (!uid) return null;
    return state?.contestantsByUid?.[uid] || null;
};

const songLabel = (song = null) => {
    if (!song?.songTitle) return 'Song TBD';
    if (!song?.artist) return song.songTitle;
    return `${song.songTitle} - ${song.artist}`;
};

const KaraokeBracketGame = ({ gameState, view = 'tv', user }) => {
    const state = gameState || {};
    const rounds = Array.isArray(state?.rounds) ? state.rounds : [];
    const activeRoundIndex = Math.max(0, Number(state?.activeRoundIndex || 0));
    const round = rounds[activeRoundIndex] || rounds[0] || null;
    const matches = Array.isArray(round?.matches) ? round.matches : [];
    const activeMatchId = state?.activeMatchId || '';
    const activeMatch = matches.find((m) => m?.id === activeMatchId) || null;
    const localUid = user?.uid || '';
    const localInActiveMatch = !!(localUid && activeMatch && (activeMatch?.aUid === localUid || activeMatch?.bUid === localUid));
    const isComplete = state?.status === 'complete';
    const champion = getContestant(state, state?.championUid);
    const titleSize = view === 'tv' ? 'text-7xl' : 'text-4xl';
    const cardPadding = view === 'tv' ? 'p-5' : 'p-3';

    if (!round) {
        return (
            <div className="h-full w-full bg-gradient-to-br from-black via-[#120026] to-[#080512] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="text-xs uppercase tracking-[0.4em] text-zinc-500">Karaoke Tournament</div>
                    <div className="text-4xl font-bebas text-cyan-300 mt-3">Bracket Not Ready</div>
                    <div className="text-sm text-zinc-400 mt-2">Host is setting up matchups.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-gradient-to-br from-black via-[#120026] to-[#080512] text-white p-6 md:p-10 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-6">
                    <div className="text-xs uppercase tracking-[0.42em] text-zinc-500">Karaoke Tournament</div>
                    <div className={`${titleSize} font-bebas text-rose-300 mt-2`}>Sweet 16 Bracket</div>
                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mt-2">
                        {round?.name || 'Round'} | {state?.status || 'setup'}
                    </div>
                    {localInActiveMatch && (
                        <div className="inline-block mt-3 bg-cyan-500/15 border border-cyan-400/40 rounded-full px-4 py-2 text-xs uppercase tracking-[0.28em] text-cyan-200">
                            You are up in the current match
                        </div>
                    )}
                    {isComplete && (
                        <div className="mt-4 bg-emerald-500/15 border border-emerald-400/40 rounded-2xl px-5 py-3 inline-block">
                            <div className="text-[10px] uppercase tracking-[0.35em] text-emerald-200">Champion</div>
                            <div className="text-2xl font-black text-white mt-1">{champion?.name || state?.championName || 'Winner'}</div>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {matches.map((match) => {
                        const a = getContestant(state, match?.aUid);
                        const b = getContestant(state, match?.bUid);
                        const winnerUid = match?.winnerUid || '';
                        const isActive = activeMatchId && match?.id === activeMatchId;
                        return (
                            <div key={match?.id || `${match?.slot}`} className={`rounded-2xl border ${isActive ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-black/45'} ${cardPadding}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-xs uppercase tracking-[0.32em] text-zinc-500">Match {match?.slot || '-'}</div>
                                    {isActive && <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Now Live</div>}
                                </div>
                                <div className="space-y-3">
                                    <div className={`rounded-xl border px-3 py-2 ${winnerUid && winnerUid === a?.uid ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 bg-black/35'}`}>
                                        <div className="font-black text-lg">{a?.name || 'TBD'}</div>
                                        <div className="text-sm text-zinc-300">{songLabel(match?.aSong)}</div>
                                    </div>
                                    <div className={`rounded-xl border px-3 py-2 ${winnerUid && winnerUid === b?.uid ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 bg-black/35'}`}>
                                        <div className="font-black text-lg">{b?.name || 'TBD'}</div>
                                        <div className="text-sm text-zinc-300">{songLabel(match?.bSong)}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default KaraokeBracketGame;
