import React, { useMemo, useState } from 'react';
import { db, doc, updateDoc, serverTimestamp } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';

const getContestant = (state, uid) => {
    if (!uid) return null;
    return state?.contestantsByUid?.[uid] || null;
};

const songLabel = (song = null) => {
    if (!song?.songTitle) return 'Song TBD';
    if (!song?.artist) return song.songTitle;
    return `${song.songTitle} - ${song.artist}`;
};

const resolveRoomUserUid = (roomUser = {}) => roomUser?.uid || roomUser?.id?.split('_')[1] || '';

const buildMatchVoteSummary = ({ users = [], bracketId = '', match = null }) => {
    const summary = {
        total: 0,
        aVotes: 0,
        bVotes: 0
    };
    if (!match?.id || !bracketId || !Array.isArray(users) || !users.length) return summary;
    users.forEach((entry) => {
        const voterUid = resolveRoomUserUid(entry);
        if (!voterUid) return;
        if (voterUid === match.aUid || voterUid === match.bUid) return;
        const vote = entry?.bracketVote || null;
        if (!vote || vote.bracketId !== bracketId || vote.matchId !== match.id) return;
        if (vote.targetUid === match.aUid) {
            summary.aVotes += 1;
            summary.total += 1;
        } else if (vote.targetUid === match.bUid) {
            summary.bVotes += 1;
            summary.total += 1;
        }
    });
    return summary;
};

const KaraokeBracketGame = ({ gameState, view = 'tv', user, users = [], roomCode = '' }) => {
    const state = gameState || {};
    const rounds = Array.isArray(state?.rounds) ? state.rounds : [];
    const activeRoundIndex = Math.max(0, Number(state?.activeRoundIndex || 0));
    const round = rounds[activeRoundIndex] || rounds[0] || null;
    const matches = useMemo(() => (Array.isArray(round?.matches) ? round.matches : []), [round]);
    const activeMatchId = state?.activeMatchId || '';
    const activeMatch = matches.find((m) => m?.id === activeMatchId) || null;
    const localUid = user?.uid || '';
    const localInActiveMatch = !!(localUid && activeMatch && (activeMatch?.aUid === localUid || activeMatch?.bUid === localUid));
    const [voteBusy, setVoteBusy] = useState(false);
    const [voteError, setVoteError] = useState('');
    const isComplete = state?.status === 'complete';
    const champion = getContestant(state, state?.championUid);
    const championName = champion?.name || state?.championName || 'Champion';
    const championAvatar = champion?.avatar || '🏆';
    const roundTransition = state?.roundTransition || null;
    const showRoundTransition = !!roundTransition?.id && !isComplete && !activeMatchId;
    const titleSize = view === 'tv' ? 'text-7xl' : 'text-4xl';
    const cardPadding = view === 'tv' ? 'p-5' : 'p-3';
    const metaLabelClass = view === 'tv'
        ? 'text-sm uppercase tracking-[0.24em] text-zinc-400'
        : 'text-xs uppercase tracking-[0.4em] text-zinc-500';
    const subtleLabelClass = view === 'tv'
        ? 'text-sm uppercase tracking-[0.2em] text-zinc-300'
        : 'text-xs uppercase tracking-[0.3em] text-zinc-400';
    const crowdVotingEnabled = state?.crowdVotingEnabled !== false;
    const voteSummaryByMatch = useMemo(() => {
        const next = {};
        matches.forEach((match) => {
            next[match.id] = buildMatchVoteSummary({
                users,
                bracketId: state?.id || '',
                match
            });
        });
        return next;
    }, [matches, state?.id, users]);
    const myRoomUser = useMemo(
        () => users.find((entry) => resolveRoomUserUid(entry) === localUid) || null,
        [users, localUid]
    );
    const myVoteTargetUid = (myRoomUser?.bracketVote?.bracketId === state?.id && myRoomUser?.bracketVote?.matchId === activeMatch?.id)
        ? myRoomUser?.bracketVote?.targetUid
        : '';
    const canVote = view === 'mobile'
        && !!roomCode
        && !!localUid
        && !!activeMatch?.id
        && !localInActiveMatch
        && !isComplete
        && crowdVotingEnabled;

    const castVote = async (targetUid) => {
        if (!canVote || voteBusy || !targetUid) return;
        setVoteBusy(true);
        setVoteError('');
        try {
            await updateDoc(
                doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${localUid}`),
                {
                    bracketVote: {
                        bracketId: state?.id || '',
                        matchId: activeMatch.id,
                        targetUid,
                        votedAt: serverTimestamp()
                    },
                    lastActiveAt: serverTimestamp()
                }
            );
        } catch (error) {
            console.error('Bracket vote failed', error);
            setVoteError('Could not submit vote. Please try again.');
        } finally {
            setVoteBusy(false);
        }
    };

    if (!round) {
        return (
            <div className="h-full w-full bg-gradient-to-br from-black via-[#120026] to-[#080512] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className={metaLabelClass}>Karaoke Tournament</div>
                    <div className="text-4xl font-bebas text-cyan-300 mt-3">Bracket Not Ready</div>
                    <div className={`${view === 'tv' ? 'text-lg' : 'text-sm'} text-zinc-400 mt-2`}>Host is setting up matchups.</div>
                </div>
            </div>
        );
    }

    if (isComplete) {
        const confettiCount = view === 'tv' ? 22 : 12;
        return (
            <div className="h-full w-full relative overflow-hidden bg-gradient-to-br from-black via-[#230035] to-[#0a0420] text-white flex items-center justify-center p-6 md:p-12">
                <div className="absolute inset-0 opacity-70">
                    {[...Array(confettiCount)].map((_, idx) => (
                        <span
                            key={`bracket-confetti-${idx}`}
                            className="absolute w-3 h-3 rounded-full animate-pulse"
                            style={{
                                left: `${(idx * 17) % 100}%`,
                                top: `${(idx * 29) % 100}%`,
                                background: idx % 2 ? '#f472b6' : '#22d3ee',
                                animationDelay: `${(idx % 7) * 0.2}s`
                            }}
                        />
                    ))}
                </div>
                <div className="relative z-10 w-full max-w-5xl text-center bg-black/45 border border-emerald-300/40 rounded-[2.4rem] p-8 md:p-12 shadow-[0_0_80px_rgba(16,185,129,0.2)]">
                    <div className={metaLabelClass}>Tournament Complete</div>
                    <div className={`${view === 'tv' ? 'text-8xl' : 'text-5xl'} font-bebas text-emerald-300 mt-3`}>Champion Crowned</div>
                    <div className="mt-6 text-7xl">{championAvatar}</div>
                    <div className={`${view === 'tv' ? 'text-6xl' : 'text-4xl'} font-black text-white mt-4`}>{championName}</div>
                    <div className={`${view === 'tv' ? 'text-lg' : 'text-sm'} uppercase tracking-[0.18em] text-zinc-300 mt-4`}>
                        Sweet {state?.size || 16} | {rounds.length} rounds finished
                    </div>
                    <div className={`mt-6 ${view === 'tv' ? 'text-lg' : 'text-sm'} text-zinc-300`}>
                        Queue normal karaoke or reseed another bracket when you are ready.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-gradient-to-br from-black via-[#120026] to-[#080512] text-white p-6 md:p-10 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-6">
                    <div className={metaLabelClass}>Karaoke Tournament</div>
                    <div className={`${titleSize} font-bebas text-rose-300 mt-2`}>Sweet 16 Bracket</div>
                    <div className={`${view === 'tv' ? 'text-lg' : 'text-sm'} uppercase tracking-[0.18em] text-zinc-400 mt-2`}>
                        {round?.name || 'Round'} | {state?.status || 'setup'}
                    </div>
                    {localInActiveMatch && (
                        <div className={`inline-block mt-3 bg-cyan-500/15 border border-cyan-400/40 rounded-full px-4 py-2 ${view === 'tv' ? 'text-sm tracking-[0.2em]' : 'text-xs tracking-[0.28em]'} uppercase text-cyan-200`}>
                            You are up in the current match
                        </div>
                    )}
                    {isComplete && (
                        <div className="mt-4 bg-emerald-500/15 border border-emerald-400/40 rounded-2xl px-5 py-3 inline-block">
                            <div className={`${view === 'tv' ? 'text-sm' : 'text-[10px]'} uppercase tracking-[0.24em] text-emerald-200`}>Champion</div>
                            <div className="text-2xl font-black text-white mt-1">{champion?.name || state?.championName || 'Winner'}</div>
                        </div>
                    )}
                </div>
                {showRoundTransition && (
                    <div className="mb-6 rounded-3xl border border-cyan-300/40 bg-cyan-500/10 px-5 py-5 text-center shadow-[0_0_35px_rgba(6,182,212,0.16)]">
                        <div className={`${view === 'tv' ? 'text-sm' : 'text-[10px]'} uppercase tracking-[0.24em] text-cyan-200`}>Round Complete</div>
                        <div className={`${view === 'tv' ? 'text-4xl' : 'text-2xl'} font-bebas text-white mt-2`}>
                            {roundTransition?.fromRoundName || 'Round'} Finished
                        </div>
                        <div className={`${view === 'tv' ? 'text-lg' : 'text-sm'} text-zinc-300 mt-2`}>
                            Next up: <span className="font-bold text-cyan-200">{roundTransition?.toRoundName || round?.name || 'Next Round'}</span>
                        </div>
                        <div className={subtleLabelClass + ' mt-4'}>
                            Host: queue the next match to begin
                        </div>
                    </div>
                )}
                {view === 'mobile' && activeMatch && !isComplete && (
                    <div className="mb-6 bg-black/45 border border-white/10 rounded-2xl p-4">
                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">Audience Vote</div>
                        {!crowdVotingEnabled ? (
                            <div className="text-sm text-zinc-400 mt-2">Crowd voting is paused by the host.</div>
                        ) : localInActiveMatch ? (
                            <div className="text-sm text-zinc-400 mt-2">You are performing this match. Audience voting is disabled for performers.</div>
                        ) : (
                            <>
                                <div className="text-sm text-zinc-300 mt-2">Pick who should advance in Match {activeMatch?.slot || '-'}</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                    {[
                                        { uid: activeMatch?.aUid, label: getContestant(state, activeMatch?.aUid)?.name || 'Singer A', votes: voteSummaryByMatch?.[activeMatch?.id]?.aVotes || 0 },
                                        { uid: activeMatch?.bUid, label: getContestant(state, activeMatch?.bUid)?.name || 'Singer B', votes: voteSummaryByMatch?.[activeMatch?.id]?.bVotes || 0 }
                                    ].map((option) => (
                                        <button
                                            key={option.uid || option.label}
                                            type="button"
                                            onClick={() => castVote(option.uid)}
                                            disabled={!canVote || voteBusy || !option.uid}
                                            className={`rounded-xl border px-3 py-3 text-left ${myVoteTargetUid === option.uid ? 'border-cyan-300 bg-cyan-500/20' : 'border-white/15 bg-black/35'} ${(!canVote || voteBusy || !option.uid) ? 'opacity-60 cursor-not-allowed' : 'hover:border-cyan-300/70'}`}
                                        >
                                            <div className="font-bold text-white">{option.label}</div>
                                            <div className="text-xs text-zinc-400 mt-1">{option.votes} crowd votes</div>
                                        </button>
                                    ))}
                                </div>
                                {voteError && <div className="text-xs text-rose-300 mt-2">{voteError}</div>}
                            </>
                        )}
                    </div>
                )}
                <div className={`grid grid-cols-1 ${view === 'tv' ? '2xl:grid-cols-2' : 'lg:grid-cols-2'} gap-4`}>
                    {matches.map((match) => {
                        const a = getContestant(state, match?.aUid);
                        const b = getContestant(state, match?.bUid);
                        const winnerUid = match?.winnerUid || '';
                        const isActive = activeMatchId && match?.id === activeMatchId;
                        const voteSummary = voteSummaryByMatch?.[match?.id] || { aVotes: 0, bVotes: 0 };
                        return (
                            <div key={match?.id || `${match?.slot}`} className={`rounded-2xl border ${isActive ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-black/45'} ${cardPadding}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`${view === 'tv' ? 'text-sm tracking-[0.22em]' : 'text-xs tracking-[0.32em]'} uppercase text-zinc-500`}>Match {match?.slot || '-'}</div>
                                    {isActive && <div className={`${view === 'tv' ? 'text-sm tracking-[0.2em]' : 'text-[10px] tracking-[0.3em]'} uppercase text-cyan-200`}>Now Live</div>}
                                </div>
                                <div className="space-y-3">
                                    <div className={`rounded-xl border px-3 py-2 ${winnerUid && winnerUid === a?.uid ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 bg-black/35'}`}>
                                        <div className={`font-black ${view === 'tv' ? 'text-2xl' : 'text-lg'}`}>{a?.name || 'TBD'}</div>
                                        <div className={`${view === 'tv' ? 'text-lg' : 'text-sm'} text-zinc-300`}>{songLabel(match?.aSong)}</div>
                                        {crowdVotingEnabled && <div className={`${view === 'tv' ? 'text-sm' : 'text-[11px]'} text-cyan-200 mt-1`}>{voteSummary.aVotes || 0} crowd votes</div>}
                                    </div>
                                    <div className={`rounded-xl border px-3 py-2 ${winnerUid && winnerUid === b?.uid ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 bg-black/35'}`}>
                                        <div className={`font-black ${view === 'tv' ? 'text-2xl' : 'text-lg'}`}>{b?.name || 'TBD'}</div>
                                        <div className={`${view === 'tv' ? 'text-lg' : 'text-sm'} text-zinc-300`}>{songLabel(match?.bSong)}</div>
                                        {crowdVotingEnabled && <div className={`${view === 'tv' ? 'text-sm' : 'text-[11px]'} text-cyan-200 mt-1`}>{voteSummary.bVotes || 0} crowd votes</div>}
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
