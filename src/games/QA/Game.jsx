import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, serverTimestamp, query, where, getDocs } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';

const DEFAULT_EMOJI = String.fromCodePoint(0x1f600);

const QAGame = ({ isPlayer, roomCode, gameState, activeMode, user }) => {
    // 1. Identify Mode & State
    const isTrivia = activeMode.includes('trivia');
    const isWyr = activeMode.includes('wyr');
    const isReveal = activeMode.includes('reveal');
    
    // 2. Local State for Voting
    const [hasVoted, setHasVoted] = useState(false);
    const [myVote, setMyVote] = useState(null);
    const [votes, setVotes] = useState([]);
    
    // 3. Listen for Votes (TV Only)
    useEffect(() => {
        if (isPlayer) return; // Players don't need to fetch everyone's votes constantly
        
        const qId = gameState?.id;
        if (!qId) return;

        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), 
            where('roomCode', '==', roomCode),
            where('questionId', '==', qId)
        );

        // Poll for votes (real-time listener could be too heavy for 100+ users, polling is safer here)
        const loadVotes = async () => {
            const snap = await getDocs(q);
            const v = snap.docs.map(d => d.data());
            setVotes(v);
        };
        
        const interval = setInterval(loadVotes, 1500);
        loadVotes(); // Initial fetch
        return () => clearInterval(interval);
    }, [isPlayer, roomCode, gameState?.id]);

    // 4. Cast Vote (Player Only)
    const castVote = async (val) => {
        if (hasVoted) return;
        setHasVoted(true);
        setMyVote(val);

        const userName = user?.name || 'Player';
        const userAvatar = user?.avatar || DEFAULT_EMOJI;

        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
            roomCode,
            type: isTrivia ? 'vote_trivia' : 'vote_wyr',
            val,
            questionId: gameState?.id,
            userName,
            avatar: userAvatar,
            uid: user?.uid || null,
            isVote: true,
            timestamp: serverTimestamp()
        });
    };

    // --- RENDER ---
    
    // Safety check
    if (!gameState) return <div className="h-full flex items-center justify-center text-white font-bebas text-2xl">WAITING FOR QUESTION...</div>;

    // --- TRIVIA MODE ---
    if (isTrivia) {
        if (isPlayer) {
            return (
                <div className="h-full flex flex-col justify-center p-6 bg-gradient-to-br from-black via-[#12001f] to-[#0b0b18] text-white font-saira text-center">
                    <div className="text-xl font-bold mb-6 text-[#00C4D9] uppercase tracking-widest">Trivia Challenge</div>
                    <h1 className="text-2xl font-bold mb-8 leading-tight">{gameState.q}</h1>
                    {hasVoted || isReveal ? (
                        <div className="text-center animate-in zoom-in">
                            <div className="text-6xl mb-4">{DEFAULT_EMOJI}</div>
                            {isReveal ? (
                                <>
                                    {myVote === gameState.correct ? (
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
                                    <div className="text-sm mt-2 opacity-75">Watch the TV for results!</div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {gameState.options?.map((o, i) => (
                                <button key={i} onClick={() => castVote(i)} className="bg-black/50 border-2 border-[#00C4D9]/40 p-4 rounded-xl text-lg font-bold active:bg-[#EC4899] active:border-white transition-colors text-left flex items-center gap-3 shadow-[0_0_20px_rgba(0,196,217,0.15)]">
                                    <span className="bg-[#00C4D9]/20 w-8 h-8 flex items-center justify-center rounded-full text-sm">{['A','B','C','D'][i]}</span>
                                    {o}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        // Trivia TV
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#090014] via-[#120026] to-black text-white font-saira relative overflow-hidden z-[100]">
                <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,rgba(236,72,153,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(0,196,217,0.08)_1px,transparent_1px)] bg-[size:60px_60px] opacity-30"></div>
                
                <h1 className="text-5xl font-bebas text-[#EC4899] mb-8 tracking-widest z-10 drop-shadow-[0_0_18px_rgba(236,72,153,0.55)]">
                    {isReveal ? "ANSWER REVEALED" : "TRIVIA TIME"}
                </h1>
                
                <h2 className="text-6xl font-black text-center mb-12 max-w-6xl leading-tight z-10 drop-shadow-[0_0_35px_rgba(0,196,217,0.35)]">
                    {gameState.q}
                </h2>
                
                <div className="grid grid-cols-2 gap-8 w-full max-w-5xl z-10">
                    {gameState.options?.map((o, i) => {
                        const isCorrect = i === gameState.correct;
                        const voters = votes.filter(v => v.val === i);
                        const isDimmed = isReveal && !isCorrect;
                        
                        return (
                            <div key={i} className={`
                                p-6 rounded-3xl border-4 text-3xl font-bold relative overflow-hidden transition-all duration-500 flex flex-col justify-center min-h-[150px]
                                ${isCorrect && isReveal ? 'bg-[#00C4D9] border-white scale-105 shadow-[0_0_55px_rgba(0,196,217,0.7)] text-black' : 'bg-black/50 border-[#EC4899]/30 text-zinc-200'}
                                ${isDimmed ? 'opacity-30 blur-sm' : 'opacity-100'}
                            `}>
                                <div className="relative z-10 text-center">{o}</div>
                                
                                {isReveal && voters.length > 0 && (
                                    <div className="mt-4 flex justify-center gap-2 flex-wrap px-4">
                                        {voters.slice(0, 12).map((v, idx) => (
                                            <span key={idx} className="text-base animate-pop bg-black/40 border border-white/10 rounded-full px-3 py-1 flex items-center gap-2" style={{animationDelay: `${idx*50}ms`}} title={v.userName}>
                                                <span className="text-xl">{v.avatar || DEFAULT_EMOJI}</span>
                                                <span className="text-xs font-bold">{v.userName || 'Player'}</span>
                                            </span>
                                        ))}
                                        {voters.length > 12 && <span className="text-xs bg-white/20 rounded-full px-2 py-1">+{voters.length - 12}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- WYR MODE ---
    if (isWyr) {
        if (isPlayer) {
            return (
                <div className="h-full flex flex-col justify-center p-6 bg-gradient-to-br from-black via-[#12001f] to-[#0b0b18] text-white font-saira text-center">
                    <div className="text-xl font-bold mb-6 text-[#EC4899] uppercase tracking-widest">WOULD YOU RATHER...</div>
                    
                    {hasVoted || isReveal ? (
                         <div className="text-center animate-in zoom-in">
                            <div className="text-6xl mb-4">{DEFAULT_EMOJI}</div>
                            <div className="text-2xl font-bold">VOTE CAST!</div>
                            <div className="text-sm mt-2 opacity-75">Check the big screen!</div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 h-full max-h-[60vh] justify-center">
                            <button onClick={() => castVote('A')} className="flex-1 bg-[#EC4899] border-4 border-white/20 rounded-2xl text-2xl font-black shadow-lg active:scale-95 transition-transform flex items-center justify-center p-4 leading-tight">
                                {gameState.optionA}
                            </button>
                            <div className="text-xl font-bold opacity-50 py-2">OR</div>
                            <button onClick={() => castVote('B')} className="flex-1 bg-[#00C4D9] border-4 border-white/20 rounded-2xl text-2xl font-black shadow-lg active:scale-95 transition-transform flex items-center justify-center p-4 leading-tight">
                                {gameState.optionB}
                            </button>
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

        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#090014] via-[#120026] to-black text-white font-saira relative overflow-hidden z-[100]">
                <h1 className="text-6xl font-bebas text-white mb-8 tracking-widest z-20 drop-shadow-[0_0_18px_rgba(236,72,153,0.55)] bg-black/50 px-8 py-2 rounded-full border border-white/10">
                    WOULD YOU RATHER...
                </h1>
                
                <div className="flex w-full h-full absolute inset-0 z-0">
                    {/* Option A Side */}
                    <div className="flex-1 bg-[#EC4899] flex flex-col items-center justify-center relative transition-all duration-1000 border-r-4 border-black overflow-hidden"
                         style={{ flex: isReveal ? (perA === 0 ? 0.0001 : perA/100) : 1 }}>
                        
                        <div className="z-10 p-12 text-center w-full">
                            <div className="text-6xl font-black drop-shadow-xl mb-4 leading-tight">{gameState.optionA}</div>
                            {isReveal && (
                                <div className="animate-in zoom-in">
                                    <div className="text-[12rem] font-bebas mb-4 leading-none opacity-80">{perA}%</div>
                                    <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                                        {votesA.map((v, i) => (
                                            <div key={i} className="bg-black/40 px-3 py-1 rounded-full text-lg font-bold flex items-center gap-2 border border-white/10 animate-float" style={{animationDelay: `${i*100}ms`}}>
                                                {v.avatar || DEFAULT_EMOJI} <span className="text-xs">{v.userName || 'Player'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Option B Side */}
                    <div className="flex-1 bg-[#00C4D9] flex flex-col items-center justify-center relative transition-all duration-1000 border-l-4 border-black overflow-hidden"
                         style={{ flex: isReveal ? ((100-perA) === 0 ? 0.0001 : (100-perA)/100) : 1 }}>
                        
                        <div className="z-10 p-12 text-center w-full">
                            <div className="text-6xl font-black drop-shadow-xl mb-4 leading-tight">{gameState.optionB}</div>
                            {isReveal && (
                                <div className="animate-in zoom-in">
                                    <div className="text-[12rem] font-bebas mb-4 leading-none opacity-80">{100-perA}%</div>
                                    <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                                        {votesB.map((v, i) => (
                                            <div key={i} className="bg-black/40 px-3 py-1 rounded-full text-lg font-bold flex items-center gap-2 border border-white/10 animate-float" style={{animationDelay: `${i*100}ms`}}>
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
                    <div className="absolute bottom-12 text-4xl font-bold animate-pulse text-[#EC4899] bg-black/90 px-12 py-4 rounded-full z-50 border-2 border-[#EC4899] shadow-[0_0_30px_rgba(236,72,153,0.45)]">
                        VOTE NOW ON YOUR PHONES!
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default QAGame;
