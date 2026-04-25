import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    db,
    doc,
    onSnapshot,
    castPromptVote,
    finalizePromptVoteRound,
} from '../../lib/firebase';
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

const normalizePromptVoteQuestionId = (value = '') =>
    String(value || '')
        .trim()
        .replace(/[\\/]/g, '_')
        .slice(0, 160);

const buildPromptVoteProjectionId = (roomCode = '', questionId = '') => {
    const safeRoomCode = String(roomCode || '').trim().toUpperCase();
    const safeQuestionId = normalizePromptVoteQuestionId(questionId);
    if (!safeRoomCode || !safeQuestionId) return '';
    return `${safeRoomCode}_${safeQuestionId}`;
};

const asObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
};

const PromptVoteGame = ({ isPlayer, roomCode, gameState, activeMode, user }) => {
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
    const [votesByVoterUid, setVotesByVoterUid] = useState({});
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

    // 3. Reset local vote state when the question changes
    useEffect(() => {
        setHasVoted(false);
        setMyVote(null);
        setVotes([]);
        setVotesByVoterUid({});
        setIsSubmittingVote(false);
        setVoteError('');
    }, [questionId]);

    // 4. Subscribe to the projection doc for this prompt round
    useEffect(() => {
        if (!roomCode || !questionId) {
            setVotes([]);
            setVotesByVoterUid({});
            return;
        }

        const projectionId = buildPromptVoteProjectionId(roomCode, questionId);
        if (!projectionId) {
            setVotes([]);
            setVotesByVoterUid({});
            return;
        }

        return onSnapshot(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'prompt_vote_public', projectionId),
            (snap) => {
                if (!snap.exists()) {
                    setVotes([]);
                    setVotesByVoterUid({});
                    return;
                }
                const data = snap.data() || {};
                setVotes(Array.isArray(data.votes) ? data.votes : []);
                setVotesByVoterUid(asObject(data.votesByVoterUid));
            },
            () => {
                setVotes([]);
                setVotesByVoterUid({});
            }
        );
    }, [roomCode, questionId]);

    useEffect(() => {
        if (!isPlayer || !user?.uid) return;
        if (!Object.prototype.hasOwnProperty.call(votesByVoterUid, user.uid)) return;
        setHasVoted(true);
        setMyVote(votesByVoterUid[user.uid]);
    }, [isPlayer, user?.uid, votesByVoterUid]);

    // 5. Cast Vote (Player Only)
    const castVote = async (val) => {
        if (!isPlayer || !roomCode || !questionId || isReveal) return;
        if (hasVoted || isSubmittingVote) return;
        setVoteError('');
        setIsSubmittingVote(true);

        const userName = user?.name || 'Player';
        const userAvatar = user?.avatar || DEFAULT_EMOJI;
        const uid = user?.uid || null;

        try {
            const result = await castPromptVote({
                roomCode,
                questionId,
                voteType,
                val,
                userName,
                avatar: userAvatar,
                uid,
            });
            if (result?.duplicate || result?.ok) {
                setHasVoted(true);
                setMyVote(result?.val ?? val);
            }
            setHasVoted(true);
            setMyVote(val);
        } catch (error) {
            console.error('Vote submit failed', error);
            const errorCode = String(error?.code || '');
            if (errorCode.includes('failed-precondition')) {
                setVoteError(error?.message || 'Voting just closed.');
            } else if (errorCode.includes('already-exists')) {
                setVoteError('Your vote is already locked for this round.');
            } else if (errorCode.includes('permission-denied')) {
                setVoteError('Rejoin the room and try again.');
            } else {
                setVoteError('Could not submit vote. Please try again.');
            }
        } finally {
            setIsSubmittingVote(false);
        }
    };

    const totalVotes = votes.length;
    const finalizedPromptVoteQuestionIdsRef = useRef(new Set());
    const wyrVoteSummary = useMemo(() => {
        if (!isWyr) {
            return {
                votesA: [],
                votesB: [],
                total: 0,
                perA: 50,
                winningSide: '',
                winners: [],
                rewardPoints: 0
            };
        }
        const votesA = votes.filter((vote) => vote?.val === 'A');
        const votesB = votes.filter((vote) => vote?.val === 'B');
        const total = votesA.length + votesB.length;
        const perA = total ? Math.round((votesA.length / total) * 100) : 50;
        const winningSide = total && votesA.length !== votesB.length
            ? (votesA.length > votesB.length ? 'A' : 'B')
            : '';
        const rewardPoints = Math.max(0, Number(gameState?.points || 50));
        const winnerSource = winningSide === 'A' ? votesA : winningSide === 'B' ? votesB : [];
        const seenUids = new Set();
        const winners = winnerSource
            .map((vote) => ({
                uid: String(vote?.uid || '').trim(),
                userName: String(vote?.userName || 'Player').trim() || 'Player',
                avatar: String(vote?.avatar || DEFAULT_EMOJI).trim() || DEFAULT_EMOJI
            }))
            .filter((entry) => {
                if (!entry.uid || seenUids.has(entry.uid)) return false;
                seenUids.add(entry.uid);
                return true;
            });
        return { votesA, votesB, total, perA, winningSide, winners, rewardPoints };
    }, [gameState?.points, isWyr, votes]);

    useEffect(() => {
        finalizedPromptVoteQuestionIdsRef.current = new Set();
    }, [roomCode]);

    useEffect(() => {
        if (isPlayer || (!isTrivia && !isWyr) || !isReveal) return;
        const safeQuestionId = String(questionId || '').trim();
        if (!roomCode || !safeQuestionId) return;
        if (finalizedPromptVoteQuestionIdsRef.current.has(safeQuestionId)) return;
        finalizedPromptVoteQuestionIdsRef.current.add(safeQuestionId);
        void finalizePromptVoteRound({
            roomCode,
            questionId: safeQuestionId,
            voteType,
        }).catch(() => {
            finalizedPromptVoteQuestionIdsRef.current.delete(safeQuestionId);
        });
    }, [isPlayer, isReveal, isTrivia, isWyr, questionId, roomCode, voteType]);

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
                <div data-prompt-vote-player-view="trivia" className="h-full flex flex-col justify-center p-6 bg-gradient-to-br from-black via-[#12001f] to-[#0b0b18] text-white font-saira text-center">
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
            <div data-prompt-vote-tv-view="trivia" className="h-full w-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#090014] via-[#120026] to-black text-white font-saira relative overflow-hidden z-[100]">
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
                                <div className="absolute top-3 right-3 text-base bg-black/40 border border-white/10 rounded-full px-2 py-1 font-bold">
                                    {voters.length}
                                </div>
                                <div className="relative z-10 text-center">{o}</div>

                                {isReveal && voters.length > 0 && (
                                    <div className="mt-4 flex justify-center gap-2 flex-wrap px-4">
                                        {voters.slice(0, 6).map((v, idx) => (
                                            <span key={idx} className="text-lg animate-pop bg-black/40 border border-white/10 rounded-full px-3 py-1 flex items-center gap-2" style={{animationDelay: `${idx*50}ms`}} title={v.userName}>
                                                <span className="text-xl">{v.avatar || DEFAULT_EMOJI}</span>
                                                <span className="text-base font-bold">{v.userName || 'Player'}</span>
                                            </span>
                                        ))}
                                        {voters.length > 6 && <span className="text-base bg-white/20 rounded-full px-2 py-1 font-bold">+{voters.length - 6}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {isReveal && (
                    <div className="z-10 mt-8 w-full max-w-5xl bg-black/55 border border-white/15 rounded-3xl p-6">
                        <div className="text-lg uppercase tracking-[0.18em] text-zinc-200 mb-3">Question Summary</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-3">
                                <div className="text-sm md:text-base uppercase tracking-[0.14em] text-zinc-300">Responses</div>
                                <div className="text-3xl font-black text-white">{totalVotes}</div>
                            </div>
                            <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-3">
                                <div className="text-sm md:text-base uppercase tracking-[0.14em] text-zinc-300">Correct</div>
                                <div className="text-3xl font-black text-cyan-300">{correctVotes.length}</div>
                            </div>
                            <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-3">
                                <div className="text-sm md:text-base uppercase tracking-[0.14em] text-zinc-300">Accuracy</div>
                                <div className="text-3xl font-black text-white">{correctRate}%</div>
                            </div>
                            <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-3">
                                <div className="text-sm md:text-base uppercase tracking-[0.14em] text-zinc-300">Points Total</div>
                                <div className="text-3xl font-black text-amber-300">{correctVotes.length * pointsPerCorrect}</div>
                            </div>
                        </div>
                        <div className="text-base uppercase tracking-[0.16em] text-zinc-200 mb-2">Top Correct</div>
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
        const votesA = wyrVoteSummary.votesA;
        const votesB = wyrVoteSummary.votesB;
        const perA = wyrVoteSummary.perA;
        const majoritySide = wyrVoteSummary.winningSide;
        const rewardPoints = wyrVoteSummary.rewardPoints;
        const myVoteWonMajority = hasVoted && majoritySide && myVote === majoritySide;
        if (isPlayer) {
            return (
                <div data-prompt-vote-player-view="wyr" className="h-full flex flex-col justify-center p-6 bg-gradient-to-br from-black via-[#12001f] to-[#0b0b18] text-white font-saira text-center">
                    <div className="text-2xl font-black mb-6 text-[#EC4899] uppercase tracking-[0.2em]">WOULD YOU RATHER...</div>
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
                                    <div className="text-2xl font-bold">
                                        {isReveal
                                            ? (majoritySide
                                                ? (myVoteWonMajority ? 'MAJORITY PICK!' : 'RESULTS ARE IN')
                                                : 'DEAD HEAT')
                                            : 'VOTE CAST!'}
                                    </div>
                                    <div className="text-sm mt-2 opacity-75">
                                        {isReveal
                                            ? (majoritySide
                                                ? (myVoteWonMajority
                                                    ? `You backed the winning side. +${rewardPoints} pts.`
                                                    : `Most guests picked ${majoritySide}.`)
                                                : 'The room split evenly, so there was no bonus side.')
                                            : 'Check the big screen!'}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 h-full max-h-[60vh] justify-center">
                            <button
                                data-wyr-choice="A"
                                onClick={() => castVote('A')}
                                disabled={isSubmittingVote}
                                className={`flex-1 bg-gradient-to-br from-[#EC4899] to-[#c0267c] border-4 border-white/20 rounded-3xl text-3xl font-black shadow-[0_14px_38px_rgba(236,72,153,0.45)] transition-transform flex flex-col items-center justify-center p-5 leading-tight min-h-[150px] ${isSubmittingVote ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                            >
                                <span className="text-xs uppercase tracking-[0.3em] mb-2 text-pink-100/90">Choice A</span>
                                {gameState.optionA}
                            </button>
                            <div className="text-xl font-black opacity-70 py-1 tracking-[0.2em]">OR</div>
                            <button
                                data-wyr-choice="B"
                                onClick={() => castVote('B')}
                                disabled={isSubmittingVote}
                                className={`flex-1 bg-gradient-to-br from-[#00C4D9] to-[#0f8ea7] border-4 border-white/20 rounded-3xl text-3xl font-black shadow-[0_14px_38px_rgba(0,196,217,0.45)] transition-transform flex flex-col items-center justify-center p-5 leading-tight min-h-[150px] ${isSubmittingVote ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                            >
                                <span className="text-xs uppercase tracking-[0.3em] mb-2 text-cyan-100/90">Choice B</span>
                                {gameState.optionB}
                            </button>
                            {voteError && <div className="text-base text-rose-300 mt-2 font-semibold">{voteError}</div>}
                        </div>
                    )}
                </div>
            );
        }

        // TV View
        const wyrPrompt = String(gameState?.question || '').trim();

        const topRailPadding = wyrPrompt ? 'clamp(260px, 34vh, 430px)' : 'clamp(150px, 20vh, 250px)';

        return (
            <div data-prompt-vote-tv-view="wyr" className="h-full w-full bg-[linear-gradient(145deg,#06090f,#0b1018_38%,#111827)] text-white font-saira relative overflow-hidden z-[100]">
                <div className="absolute inset-x-0 top-5 z-30 px-6 flex flex-col items-center gap-3 pointer-events-none">
                    <h1 className="text-[clamp(2.4rem,4.8vw,6.5rem)] font-bebas text-white tracking-[0.14em] drop-shadow-[0_0_18px_rgba(34,211,238,0.22)] bg-black/60 px-8 py-2 rounded-full border border-white/10">
                        WOULD YOU RATHER...
                    </h1>
                    {wyrPrompt && (
                        <div className="w-full max-w-[96vw] px-6 md:px-10">
                            <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-[linear-gradient(145deg,rgba(8,10,18,0.96),rgba(15,23,42,0.94))] px-7 py-5 text-center shadow-[0_16px_52px_rgba(0,0,0,0.62)] backdrop-blur-sm">
                                <div className="pointer-events-none absolute inset-0 opacity-45 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.26),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.22),transparent_56%)]" />
                                <div className="relative text-[clamp(1rem,1.8vw,1.45rem)] uppercase tracking-[0.24em] text-zinc-200 mb-3 font-bold">Prompt</div>
                                <div className="relative text-[clamp(2.2rem,4.4vw,4.8rem)] font-black leading-[1.08] text-white whitespace-pre-wrap break-words drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
                                    {wyrPrompt}
                                </div>
                            </div>
                        </div>
                    )}
                    {!isReveal && timerSecRemaining !== null && (
                        <div className="inline-flex items-center gap-2 text-base uppercase tracking-[0.14em] bg-black/65 border border-white/10 px-4 py-2 rounded-full text-zinc-200">
                            <i className="fa-regular fa-clock"></i>
                            {timerSecRemaining}s left
                        </div>
                    )}
                </div>

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_26%,rgba(45,212,191,0.16),transparent_28%),radial-gradient(circle_at_84%_24%,rgba(236,72,153,0.16),transparent_26%)]"></div>
                <div className="flex w-full h-full absolute inset-0 z-0">
                    <div
                        className="flex-1 bg-[linear-gradient(145deg,rgba(7,22,27,0.98),rgba(15,49,60,0.95))] flex flex-col items-center justify-center relative transition-all duration-1000 border-r border-white/10 overflow-hidden"
                        style={{ flex: isReveal ? (perA === 0 ? 0.0001 : perA / 100) : 1 }}
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_52%)]" />
                        <div className="absolute inset-y-0 right-0 w-px bg-white/10" />
                        <div className="absolute top-6 left-6 text-sm uppercase tracking-[0.18em] bg-black/35 border border-teal-300/35 text-teal-100 rounded-full px-3 py-1 font-bold">A</div>
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
                                                {v.avatar || DEFAULT_EMOJI} <span className="text-sm">{v.userName || 'Player'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        className="flex-1 bg-[linear-gradient(145deg,rgba(24,10,22,0.98),rgba(64,20,47,0.95))] flex flex-col items-center justify-center relative transition-all duration-1000 border-l border-white/10 overflow-hidden"
                        style={{ flex: isReveal ? ((100 - perA) === 0 ? 0.0001 : (100 - perA) / 100) : 1 }}
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.24),transparent_52%)]" />
                        <div className="absolute top-6 right-6 text-sm uppercase tracking-[0.18em] bg-black/35 border border-pink-300/35 text-pink-100 rounded-full px-3 py-1 font-bold">B</div>
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
                                                {v.avatar || DEFAULT_EMOJI} <span className="text-sm">{v.userName || 'Player'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {!isReveal && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[clamp(1.4rem,2.5vw,3rem)] font-black animate-pulse text-white bg-black/88 px-10 py-3 rounded-full z-50 border border-white/12 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
                        VOTE NOW ON YOUR PHONES!
                    </div>
                )}
                {isReveal && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full border border-white/15 bg-[linear-gradient(145deg,rgba(8,10,18,0.96),rgba(20,24,36,0.92))] px-8 py-3 text-center shadow-[0_0_30px_rgba(0,0,0,0.45)]">
                        <div className="text-xs uppercase tracking-[0.24em] text-zinc-400">Result</div>
                        <div className="mt-1 text-[clamp(1.2rem,2vw,2rem)] font-black text-white">
                            {majoritySide ? `Majority picked ${majoritySide}` : 'Dead heat'}
                        </div>
                        <div className="mt-1 text-sm text-zinc-300">
                            {majoritySide
                                ? `Everyone on the ${majoritySide} side earns +${rewardPoints} pts.`
                                : 'No side earned bonus points this round.'}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default PromptVoteGame;
