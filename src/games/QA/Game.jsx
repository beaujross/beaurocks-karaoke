import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, serverTimestamp, query, where, getDocs } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';

const DEFAULT_EMOJI = String.fromCodePoint(0x1f600);
const TRIVIA_OPTION_LABELS = ['A', 'B', 'C', 'D'];

const getTimestampMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
};

const dedupeVotes = (entries = []) => {
    const latestByVoter = new Map();
    entries.forEach((entry, index) => {
        if (!entry?.isVote) return;
        const key = entry?.uid
            ? `uid:${entry.uid}`
            : `guest:${entry.userName || 'Player'}:${entry.avatar || DEFAULT_EMOJI}`;
        const ts = getTimestampMs(entry.timestamp);
        const current = latestByVoter.get(key);
        if (!current || ts >= current._ts) {
            latestByVoter.set(key, { ...entry, _ts: ts, _idx: index });
        }
    });
    return Array.from(latestByVoter.values()).map((entry) => {
        const clean = { ...entry };
        delete clean._ts;
        delete clean._idx;
        return clean;
    });
};

const QAGame = ({ isPlayer, roomCode, gameState, activeMode, user }) => {
    // 1. Identify Mode & State
    const safeMode = String(activeMode || '');
    const isTrivia = safeMode.includes('trivia');
    const isWyr = safeMode.includes('wyr');
    const modeReveal = safeMode.includes('reveal');
    const questionStatus = String(gameState?.status || '').toLowerCase();
    const questionId = gameState?.id || '';
    const voteType = isTrivia ? 'vote_trivia' : 'vote_wyr';

    // 2. Local State for Voting
    const [hasVoted, setHasVoted] = useState(false);
    const [myVote, setMyVote] = useState(null);
    const [votes, setVotes] = useState([]);
    const [isSubmittingVote, setIsSubmittingVote] = useState(false);
    const [voteError, setVoteError] = useState('');
    const [nowMs, setNowMs] = useState(Date.now());

    const roundDurationSec = Math.max(0, Number(gameState?.durationSec || 0));
    const startedAtMs = getTimestampMs(gameState?.startedAt);
    const revealAtMs = getTimestampMs(gameState?.revealAt)
        || (startedAtMs && roundDurationSec ? startedAtMs + (roundDurationSec * 1000) : 0);
    const autoReveal = gameState?.autoReveal !== false;
    const isTimerDriven = (isTrivia || isWyr) && autoReveal && revealAtMs > 0;
    const timerMsRemaining = isTimerDriven ? Math.max(0, revealAtMs - nowMs) : 0;
    const timerSecRemaining = isTimerDriven ? Math.ceil(timerMsRemaining / 1000) : null;
    const timerExpired = isTimerDriven && timerMsRemaining <= 0;
    const isReveal = modeReveal || questionStatus === 'reveal' || timerExpired;

    useEffect(() => {
        if (!isTimerDriven || isReveal) return;
        const timer = setInterval(() => setNowMs(Date.now()), 250);
        return () => clearInterval(timer);
    }, [isTimerDriven, isReveal, questionId]);

    // 3. Reset and rehydrate local vote state when the question changes
    useEffect(() => {
        setHasVoted(false);
        setMyVote(null);
        setIsSubmittingVote(false);
        setVoteError('');
        if (!isPlayer || !roomCode || !questionId || !user?.uid) return;
        let cancelled = false;
        const loadMyVote = async () => {
            try {
                const voteQuery = query(
                    collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'),
                    where('roomCode', '==', roomCode),
                    where('questionId', '==', questionId)
                );
                const snap = await getDocs(voteQuery);
                if (cancelled) return;
                const mine = dedupeVotes(snap.docs.map((d) => d.data()))
                    .filter((entry) => entry?.uid === user.uid && entry?.type === voteType);
                if (!mine.length) return;
                const latest = [...mine].sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp))[0];
                setHasVoted(true);
                setMyVote(latest?.val ?? null);
            } catch {
                // Non-fatal: player can still vote normally.
            }
        };
        loadMyVote();
        return () => {
            cancelled = true;
        };
    }, [isPlayer, roomCode, questionId, user?.uid, voteType]);

    // 3. Listen for Votes (TV Only)
    useEffect(() => {
        if (isPlayer) return; // Players don't need to fetch everyone's votes constantly
        if (!roomCode || !questionId) {
            setVotes([]);
            return;
        }

        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'),
            where('roomCode', '==', roomCode),
            where('questionId', '==', questionId)
        );
        let cancelled = false;

        // Poll for votes (real-time listener could be too heavy for 100+ users, polling is safer here)
        const loadVotes = async () => {
            try {
                const snap = await getDocs(q);
                if (cancelled) return;
                const allVotes = dedupeVotes(snap.docs.map((d) => d.data()));
                const filtered = allVotes.filter((entry) => entry?.type === voteType);
                setVotes(filtered);
            } catch {
                if (!cancelled) setVotes([]);
            }
        };

        const interval = setInterval(loadVotes, 1500);
        loadVotes(); // Initial fetch
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [isPlayer, roomCode, questionId, voteType]);

    // 4. Cast Vote (Player Only)
    const castVote = async (val) => {
        if (!isPlayer || !roomCode || !questionId || isReveal) return;
        if (hasVoted || isSubmittingVote) return;
        setVoteError('');
        setIsSubmittingVote(true);

        const userName = user?.name || 'Player';
        const userAvatar = user?.avatar || DEFAULT_EMOJI;
        const uid = user?.uid || null;

        try {
            const voteQuery = query(
                collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'),
                where('roomCode', '==', roomCode),
                where('questionId', '==', questionId)
            );
            const existingSnap = await getDocs(voteQuery);
            const existing = dedupeVotes(existingSnap.docs.map((d) => d.data()))
                .filter((entry) => entry?.type === voteType)
                .filter((entry) => {
                    if (uid) return entry?.uid === uid;
                    return (entry?.userName || 'Player') === userName && (entry?.avatar || DEFAULT_EMOJI) === userAvatar;
                });

            if (existing.length) {
                const latest = [...existing].sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp))[0];
                setHasVoted(true);
                setMyVote(latest?.val ?? val);
                return;
            }

            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
                roomCode,
                type: voteType,
                val,
                questionId,
                userName,
                avatar: userAvatar,
                uid,
                isVote: true,
                timestamp: serverTimestamp()
            });
            setHasVoted(true);
            setMyVote(val);
        } catch (error) {
            console.error('Vote submit failed', error);
            setVoteError('Could not submit vote. Please try again.');
        } finally {
            setIsSubmittingVote(false);
        }
    };

    const totalVotes = votes.length;

    // --- RENDER ---

    // Safety check
    if (!gameState) return <div className="h-full flex items-center justify-center text-white font-bebas text-2xl">WAITING FOR QUESTION...</div>;

    // --- TRIVIA MODE ---
    if (isTrivia) {
        const correctVotes = votes
            .filter((v) => Number(v?.val) === Number(gameState.correct))
            .sort((a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp));
        const correctRate = totalVotes ? Math.round((correctVotes.length / totalVotes) * 100) : 0;
        const pointsPerCorrect = Math.max(0, Number(gameState?.points || 100));
        const topCorrect = correctVotes.slice(0, 6).map((vote, index) => ({
            ...vote,
            rank: index + 1,
            speedMs: startedAtMs ? Math.max(0, getTimestampMs(vote.timestamp) - startedAtMs) : null
        }));

        if (isPlayer) {
            return (
                <div data-qa-player-view="trivia" className="h-full flex flex-col justify-center p-6 bg-gradient-to-br from-black via-[#12001f] to-[#0b0b18] text-white font-saira text-center">
                    <div className="text-xl font-bold mb-6 text-[#00C4D9] uppercase tracking-widest">Trivia Challenge</div>
                    {!isReveal && timerSecRemaining !== null && (
                        <div className="mb-4 inline-flex self-center items-center gap-2 text-xs uppercase tracking-[0.3em] bg-black/40 border border-white/10 px-4 py-2 rounded-full text-zinc-200">
                            <i className="fa-regular fa-clock"></i>
                            {timerSecRemaining}s left
                        </div>
                    )}
                    <h1 className="text-2xl font-bold mb-8 leading-tight">{gameState.q}</h1>
                    {hasVoted || isReveal ? (
                        <div className="text-center animate-in zoom-in">
                            <div className="text-6xl mb-4">{DEFAULT_EMOJI}</div>
                            {isReveal ? (
                                <>
                                    {!hasVoted ? (
                                        <>
                                            <div className="text-2xl font-bold text-amber-300">NO ANSWER SUBMITTED</div>
                                            <div className="text-sm mt-2 opacity-75">Jump in faster next round.</div>
                                        </>
                                    ) : myVote === gameState.correct ? (
                                        <>
                                            <div className="text-2xl font-bold text-cyan-300">CORRECT!</div>
                                            <div className="text-sm mt-2 opacity-80">+{gameState.points || 100} pts earned</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-2xl font-bold text-pink-300">NOT THIS TIME</div>
                                            <div className="text-sm mt-2 opacity-75">The correct answer is revealed on TV.</div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-bold">ANSWER LOCKED</div>
                                    <div className="text-sm mt-2 opacity-75">
                                        Choice: {TRIVIA_OPTION_LABELS[Number(myVote)] || '-'} | Watch TV for results.
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {gameState.options?.map((o, i) => (
                                <button
                                    key={i}
                                    data-qa-choice={i}
                                    onClick={() => castVote(i)}
                                    disabled={isSubmittingVote}
                                    className={`bg-black/50 border-2 border-[#00C4D9]/40 p-4 rounded-xl text-lg font-bold transition-colors text-left flex items-center gap-3 shadow-[0_0_20px_rgba(0,196,217,0.15)] ${isSubmittingVote ? 'opacity-70 cursor-not-allowed' : 'active:bg-[#EC4899] active:border-white'}`}
                                >
                                    <span className="bg-[#00C4D9]/20 w-8 h-8 flex items-center justify-center rounded-full text-sm">{TRIVIA_OPTION_LABELS[i]}</span>
                                    {o}
                                </button>
                            ))}
                            {voteError && <div className="text-sm text-rose-300 mt-2">{voteError}</div>}
                        </div>
                    )}
                </div>
            );
        }

        // Trivia TV
        return (
            <div data-qa-tv-view="trivia" className="h-full w-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#090014] via-[#120026] to-black text-white font-saira relative overflow-hidden z-[100]">
                <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,rgba(236,72,153,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(0,196,217,0.08)_1px,transparent_1px)] bg-[size:60px_60px] opacity-30"></div>
                
                <h1 className="text-5xl font-bebas text-[#EC4899] mb-8 tracking-widest z-10 drop-shadow-[0_0_18px_rgba(236,72,153,0.55)]">
                    {isReveal ? "ANSWER REVEALED" : "TRIVIA TIME"}
                </h1>

                <h2 className="text-6xl font-black text-center mb-12 max-w-6xl leading-tight z-10 drop-shadow-[0_0_35px_rgba(0,196,217,0.35)]">
                    {gameState.q}
                </h2>

                <div className="z-10 mb-6 flex flex-wrap items-center justify-center gap-3 text-base md:text-lg uppercase tracking-[0.18em] text-zinc-300">
                    {!isReveal && timerSecRemaining !== null && (
                        <span className="bg-black/40 border border-white/10 px-3 py-2 rounded-full">
                            {timerSecRemaining}s left
                        </span>
                    )}
                    <span className="bg-black/40 border border-white/10 px-3 py-2 rounded-full">
                        {totalVotes} {totalVotes === 1 ? 'response' : 'responses'} locked
                    </span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 w-full max-w-6xl z-10">
                    {gameState.options?.map((o, i) => {
                        const isCorrect = i === gameState.correct;
                        const voters = votes.filter(v => v.val === i);
                        const isDimmed = isReveal && !isCorrect;
                        
                        return (
                            <div key={i} className={`
                                p-8 rounded-3xl border-4 text-4xl font-bold relative overflow-hidden transition-all duration-500 flex flex-col justify-center min-h-[190px]
                                ${isCorrect && isReveal ? 'bg-[#00C4D9] border-white scale-105 shadow-[0_0_55px_rgba(0,196,217,0.7)] text-black' : 'bg-black/50 border-[#EC4899]/30 text-zinc-200'}
                                ${isDimmed ? 'opacity-30 blur-sm' : 'opacity-100'}
                            `}>
                                <div className="absolute top-3 left-3 text-sm uppercase tracking-[0.18em] bg-black/40 border border-white/10 rounded-full px-2 py-1">
                                    {TRIVIA_OPTION_LABELS[i]}
                                </div>
                                <div className="absolute top-3 right-3 text-sm bg-black/40 border border-white/10 rounded-full px-2 py-1">
                                    {voters.length}
                                </div>
                                <div className="relative z-10 text-center">{o}</div>

                                {isReveal && voters.length > 0 && (
                                    <div className="mt-4 flex justify-center gap-2 flex-wrap px-4">
                                        {voters.slice(0, 6).map((v, idx) => (
                                            <span key={idx} className="text-lg animate-pop bg-black/40 border border-white/10 rounded-full px-3 py-1 flex items-center gap-2" style={{animationDelay: `${idx*50}ms`}} title={v.userName}>
                                                <span className="text-xl">{v.avatar || DEFAULT_EMOJI}</span>
                                                <span className="text-sm font-bold">{v.userName || 'Player'}</span>
                                            </span>
                                        ))}
                                        {voters.length > 6 && <span className="text-sm bg-white/20 rounded-full px-2 py-1">+{voters.length - 6}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {isReveal && (
                    <div className="z-10 mt-8 w-full max-w-5xl bg-black/55 border border-white/15 rounded-3xl p-6">
                        <div className="text-sm uppercase tracking-[0.2em] text-zinc-300 mb-3">Question Summary</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-3">
                                <div className="text-xs md:text-sm uppercase tracking-[0.16em] text-zinc-400">Responses</div>
                                <div className="text-3xl font-black text-white">{totalVotes}</div>
                            </div>
                            <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-3">
                                <div className="text-xs md:text-sm uppercase tracking-[0.16em] text-zinc-400">Correct</div>
                                <div className="text-3xl font-black text-cyan-300">{correctVotes.length}</div>
                            </div>
                            <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-3">
                                <div className="text-xs md:text-sm uppercase tracking-[0.16em] text-zinc-400">Accuracy</div>
                                <div className="text-3xl font-black text-white">{correctRate}%</div>
                            </div>
                            <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-3">
                                <div className="text-xs md:text-sm uppercase tracking-[0.16em] text-zinc-400">Points Total</div>
                                <div className="text-3xl font-black text-amber-300">{correctVotes.length * pointsPerCorrect}</div>
                            </div>
                        </div>
                        <div className="text-sm uppercase tracking-[0.18em] text-zinc-300 mb-2">Top Correct</div>
                        {topCorrect.length ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {topCorrect.map((entry) => (
                                    <div key={`${entry.uid || entry.userName}_${entry.rank}`} className="bg-zinc-900/70 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-sm px-2 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-bold">
                                                #{entry.rank}
                                            </span>
                                            <span className="text-xl">{entry.avatar || DEFAULT_EMOJI}</span>
                                            <span className="font-bold text-zinc-100 truncate">{entry.userName || 'Player'}</span>
                                        </div>
                                        <span className="text-sm uppercase tracking-[0.14em] text-zinc-400 shrink-0">
                                            {entry.speedMs !== null ? `${(entry.speedMs / 1000).toFixed(2)}s` : 'Correct'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-base text-zinc-400">No correct answers this round.</div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // --- WYR MODE ---
    if (isWyr) {
        if (isPlayer) {
            return (
                <div data-qa-player-view="wyr" className="h-full flex flex-col justify-center p-6 bg-gradient-to-br from-black via-[#12001f] to-[#0b0b18] text-white font-saira text-center">
                    <div className="text-xl font-bold mb-6 text-[#EC4899] uppercase tracking-widest">WOULD YOU RATHER...</div>
                    {!isReveal && timerSecRemaining !== null && (
                        <div className="mb-4 inline-flex self-center items-center gap-2 text-xs uppercase tracking-[0.3em] bg-black/40 border border-white/10 px-4 py-2 rounded-full text-zinc-200">
                            <i className="fa-regular fa-clock"></i>
                            {timerSecRemaining}s left
                        </div>
                    )}

                    {hasVoted || isReveal ? (
                        <div className="text-center animate-in zoom-in">
                            <div className="text-6xl mb-4">{DEFAULT_EMOJI}</div>
                            {isReveal && !hasVoted ? (
                                <>
                                    <div className="text-2xl font-bold text-amber-300">NO VOTE SUBMITTED</div>
                                    <div className="text-sm mt-2 opacity-75">Jump in faster next round.</div>
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-bold">VOTE CAST!</div>
                                    <div className="text-sm mt-2 opacity-75">Check the big screen!</div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 h-full max-h-[60vh] justify-center">
                            <button
                                data-wyr-choice="A"
                                onClick={() => castVote('A')}
                                disabled={isSubmittingVote}
                                className={`flex-1 bg-[#EC4899] border-4 border-white/20 rounded-2xl text-2xl font-black shadow-lg transition-transform flex items-center justify-center p-4 leading-tight ${isSubmittingVote ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
                            >
                                {gameState.optionA}
                            </button>
                            <div className="text-xl font-bold opacity-50 py-2">OR</div>
                            <button
                                data-wyr-choice="B"
                                onClick={() => castVote('B')}
                                disabled={isSubmittingVote}
                                className={`flex-1 bg-[#00C4D9] border-4 border-white/20 rounded-2xl text-2xl font-black shadow-lg transition-transform flex items-center justify-center p-4 leading-tight ${isSubmittingVote ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
                            >
                                {gameState.optionB}
                            </button>
                            {voteError && <div className="text-sm text-rose-300 mt-2">{voteError}</div>}
                        </div>
                    )}
                </div>
            );
        }

        // TV View
        const votesA = votes.filter(v => v.val === 'A');
        const votesB = votes.filter(v => v.val === 'B');
        const total = votesA.length + votesB.length || 1;
        const perA = Math.round((votesA.length / total) * 100);
        const wyrPrompt = String(gameState?.question || '').trim();

        const topRailPadding = wyrPrompt ? 'clamp(210px, 29vh, 360px)' : 'clamp(150px, 20vh, 250px)';

        return (
            <div data-qa-tv-view="wyr" className="h-full w-full bg-gradient-to-br from-[#090014] via-[#120026] to-black text-white font-saira relative overflow-hidden z-[100]">
                <div className="absolute inset-x-0 top-5 z-30 px-6 flex flex-col items-center gap-3 pointer-events-none">
                    <h1 className="text-[clamp(2.4rem,4.8vw,6.5rem)] font-bebas text-white tracking-[0.14em] drop-shadow-[0_0_18px_rgba(236,72,153,0.55)] bg-black/55 px-8 py-2 rounded-full border border-white/10">
                        WOULD YOU RATHER...
                    </h1>
                    {wyrPrompt && (
                        <div className="w-full max-w-[94vw] px-8">
                            <div className="bg-black/68 border border-white/15 rounded-2xl px-6 py-4 text-center shadow-[0_0_24px_rgba(0,0,0,0.45)]">
                                <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Prompt</div>
                                <div className="text-[clamp(1rem,2vw,1.85rem)] font-black leading-tight text-white whitespace-pre-wrap break-words">
                                    {wyrPrompt}
                                </div>
                            </div>
                        </div>
                    )}
                    {!isReveal && timerSecRemaining !== null && (
                        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] bg-black/65 border border-white/10 px-4 py-2 rounded-full text-zinc-200">
                            <i className="fa-regular fa-clock"></i>
                            {timerSecRemaining}s left
                        </div>
                    )}
                </div>

                <div className="flex w-full h-full absolute inset-0 z-0">
                    <div
                        className="flex-1 bg-[#EC4899] flex flex-col items-center justify-center relative transition-all duration-1000 border-r-4 border-black overflow-hidden"
                        style={{ flex: isReveal ? (perA === 0 ? 0.0001 : perA / 100) : 1 }}
                    >
                        <div className="absolute top-6 left-6 text-sm uppercase tracking-[0.18em] bg-black/35 border border-white/20 rounded-full px-3 py-1 font-bold">A</div>
                        <div className="z-10 text-center w-full px-8 md:px-12 pb-10" style={{ paddingTop: topRailPadding }}>
                            <div className="text-[clamp(2rem,5.2vw,6rem)] font-black drop-shadow-xl mb-4 leading-[1.05] break-words">
                                {gameState.optionA}
                            </div>
                            {isReveal && (
                                <div className="animate-in zoom-in">
                                    <div className="text-[clamp(4.5rem,11vw,12rem)] font-bebas mb-4 leading-none opacity-80">{perA}%</div>
                                    <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto max-h-[26vh] overflow-y-auto custom-scrollbar pr-1">
                                        {votesA.map((v, i) => (
                                            <div key={i} className="bg-black/40 px-3 py-1 rounded-full text-lg font-bold flex items-center gap-2 border border-white/10 animate-float" style={{ animationDelay: `${i * 100}ms` }}>
                                                {v.avatar || DEFAULT_EMOJI} <span className="text-xs">{v.userName || 'Player'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        className="flex-1 bg-[#00C4D9] flex flex-col items-center justify-center relative transition-all duration-1000 border-l-4 border-black overflow-hidden"
                        style={{ flex: isReveal ? ((100 - perA) === 0 ? 0.0001 : (100 - perA) / 100) : 1 }}
                    >
                        <div className="absolute top-6 right-6 text-sm uppercase tracking-[0.18em] bg-black/35 border border-white/20 rounded-full px-3 py-1 font-bold">B</div>
                        <div className="z-10 text-center w-full px-8 md:px-12 pb-10" style={{ paddingTop: topRailPadding }}>
                            <div className="text-[clamp(2rem,5.2vw,6rem)] font-black drop-shadow-xl mb-4 leading-[1.05] break-words">
                                {gameState.optionB}
                            </div>
                            {isReveal && (
                                <div className="animate-in zoom-in">
                                    <div className="text-[clamp(4.5rem,11vw,12rem)] font-bebas mb-4 leading-none opacity-80">{100 - perA}%</div>
                                    <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto max-h-[26vh] overflow-y-auto custom-scrollbar pr-1">
                                        {votesB.map((v, i) => (
                                            <div key={i} className="bg-black/40 px-3 py-1 rounded-full text-lg font-bold flex items-center gap-2 border border-white/10 animate-float" style={{ animationDelay: `${i * 100}ms` }}>
                                                {v.avatar || DEFAULT_EMOJI} <span className="text-xs">{v.userName || 'Player'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {!isReveal && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[clamp(1.4rem,2.5vw,3rem)] font-black animate-pulse text-[#EC4899] bg-black/88 px-10 py-3 rounded-full z-50 border-2 border-[#EC4899] shadow-[0_0_30px_rgba(236,72,153,0.45)]">
                        VOTE NOW ON YOUR PHONES!
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default QAGame;
