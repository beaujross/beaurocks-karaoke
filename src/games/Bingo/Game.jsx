import React, { useEffect, useRef, useState } from 'react';
import { EMOJI } from '../../lib/emoji';

const BingoTile = ({ tile, size, index, highlighted, onSuggest, view, revealed, suggestCount = 0, sponsor }) => {
    const isRevealed = tile.status === 'revealed' || revealed?.[index]; 
    const isMystery = tile.type === 'mystery';
    const isKaraoke = tile.type === 'karaoke';
    const isMobile = view === 'mobile';
    const frontBorder = isMystery ? 'border-purple-500/60' : 'border-cyan-500/40';
    const frontBg = isMystery ? 'bg-zinc-900' : 'bg-zinc-900';
    const backBorder = isMystery ? 'border-yellow-300/80' : 'border-emerald-200';
    const backBg = isMystery ? 'bg-gradient-to-br from-purple-900 to-indigo-900' : 'bg-emerald-600';
    
    return ( 
        <div className="relative w-full h-full group"> 
            {/* FRONT (Hidden State) */}
            <div className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center p-2 text-center shadow-lg border-4 ${frontBorder} ${frontBg} transition-all duration-500 ${isRevealed ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}> 
                <div className={`${isMobile ? 'text-3xl' : 'text-6xl'} mb-2 opacity-50`}>{isMystery ? EMOJI.question : EMOJI.musicNotes}</div> 
                <div className={`font-bebas uppercase leading-none text-white ${size>4 ? (isMobile ? 'text-sm' : 'text-xl') : (isMobile ? 'text-lg' : 'text-3xl')}`}>{tile.text}</div> 
                {isMystery && <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-yellow-300 mt-2 font-bold uppercase tracking-widest`}>Mystery Song</div>} 
                {isKaraoke && tile.free && sponsor?.logo && (
                    <div className="mt-2 flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-400">
                        <span>Sponsored</span>
                        <img src={sponsor.logo} alt="" className="h-4 object-contain" />
                    </div>
                )}
            </div> 

            {/* BACK (Revealed State) */}
            <div className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center p-2 text-center shadow-[0_0_50px_rgba(255,255,255,0.2)] overflow-hidden border-4 ${backBorder} ${backBg} transition-all duration-500 ${isRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}> 
                {isMystery ? ( 
                    <> 
                        {tile.content?.art && <img src={tile.content.art} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm" alt="" />}
                        <div className="relative z-10 flex flex-col items-center"> 
                            {tile.content?.art && <img src={tile.content.art} className={`${isMobile ? 'w-10 h-10' : 'w-20 h-20'} rounded-lg shadow-xl mb-2 border-2 border-white`} alt="" />}
                            <div className={`font-black uppercase leading-none text-white drop-shadow-md ${size>4 ? (isMobile ? 'text-[10px]' : 'text-sm') : (isMobile ? 'text-xs' : 'text-xl')}`}>{tile.content?.title || "Unknown Song"}</div> 
                            <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-yellow-200 font-bold mt-1`}>{tile.content?.artist}</div> 
                        </div> 
                    </> 
                ) : ( 
                    <div className="flex flex-col items-center animate-pop">
                        <div className={`${isMobile ? 'text-4xl' : 'text-8xl'} text-white drop-shadow-lg`}>{EMOJI.check}</div> 
                        <div className={`font-bebas text-white ${isMobile ? 'text-base' : 'text-2xl'} mt-2`}>COMPLETE</div>
                    </div>
                )} 
            </div> 
            {/* Highlight indicator / Suggest button for players */}
            {highlighted && <div className="absolute inset-0 pointer-events-none border-4 border-rose-500 rounded-xl animate-ping"></div>}
            {!isMobile && suggestCount > 0 && !isRevealed && (
                <div className="absolute top-2 right-2 bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-bold px-2 py-1 rounded-full">
                    {suggestCount} votes
                </div>
            )}
            {!isRevealed && onSuggest && (
                <button onClick={() => onSuggest(index)} className="absolute inset-0 bg-transparent focus:outline-none" aria-label={`Suggest tile ${index + 1}`} />
            )}
        </div> 
    );
};

const BingoGame = ({ gameState, onSuggest, view, onClose }) => {
    const tiles = gameState?.tiles || [];
    const size = gameState?.size || 5;
    const highlighted = gameState?.highlightedTile ?? null;
    const mode = gameState?.bingoMode || (tiles[0]?.type) || 'karaoke';
    const revealed = gameState?.revealed || {};
    const suggestions = gameState?.suggestions || {};
    const sponsor = gameState?.sponsor || {};
    const focus = gameState?.focus || null;
    const pickerName = gameState?.pickerName || '';

    const isMystery = mode === 'mystery';
    const isMobile = view === 'mobile';
    const [showWin, setShowWin] = useState(false);
    const [showFocus, setShowFocus] = useState(null);
    const victoryRules = gameState?.bingoVictory || {};
    const enabledRules = [
        victoryRules?.line?.enabled ? { label: 'Line', reward: victoryRules?.line?.reward } : null,
        victoryRules?.corners?.enabled ? { label: 'Four Corners', reward: victoryRules?.corners?.reward } : null,
        victoryRules?.blackout?.enabled ? { label: 'Blackout', reward: victoryRules?.blackout?.reward } : null
    ].filter(Boolean);
    const lastWinRef = useRef('');
    const bingoWin = gameState?.bingoWin;
    const winKey = bingoWin ? `${bingoWin.type}-${bingoWin.detectedAt || ''}` : '';

    useEffect(() => {
        if (!bingoWin?.type || !winKey) return;
        if (lastWinRef.current === winKey) return;
        lastWinRef.current = winKey;
        const showTimer = setTimeout(() => setShowWin(true), 0);
        const hideTimer = setTimeout(() => setShowWin(false), 6000);
        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, [bingoWin?.type, winKey]);

    useEffect(() => {
        if (focus?.index === undefined || focus?.index === null) return;
        setShowFocus(focus);
        const hideTimer = setTimeout(() => setShowFocus(null), 7000);
        return () => clearTimeout(hideTimer);
    }, [focus?.index, focus?.at]);

    return ( 
        <div className={`h-screen w-screen bg-zinc-900 flex flex-col items-center justify-center relative overflow-hidden z-[100] ${isMobile ? 'p-4' : 'p-8'}`}> 
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 animate-pulse"></div> 
            
            {showWin && bingoWin && (
                <div className="absolute inset-0 z-[130] bg-black/80 flex items-center justify-center" onClick={() => setShowWin(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setShowWin(false); }}
                >
                    <div className="max-w-3xl w-full bg-zinc-900/95 border border-white/10 rounded-3xl p-10 text-center">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-400 mb-2">Bingo Win</div>
                        <div className="text-6xl font-bebas text-yellow-300 mb-4">BINGO!</div>
                        <div className="text-2xl text-zinc-200 font-bold mb-3">{bingoWin.label}</div>
                        {bingoWin.reward && (
                            <div className="text-lg text-cyan-200">Reward: {bingoWin.reward}</div>
                        )}
                        <div className="text-xs text-zinc-400 mt-6">Tap to continue</div>
                    </div>
                </div>
            )}
            {showFocus && tiles[showFocus.index] && (
                <div className="absolute inset-0 z-[125] bg-black/85 flex items-center justify-center p-6">
                    <div className="w-full max-w-3xl bg-zinc-900/95 border border-white/10 rounded-3xl p-8 text-center">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-400 mb-2">Mystery Reveal</div>
                        <div className="text-4xl font-bebas text-white mb-4">{pickerName ? `${pickerName} picked` : 'New pick'}</div>
                        {tiles[showFocus.index].content?.art && (
                            <img src={tiles[showFocus.index].content.art} alt="" className="w-40 h-40 rounded-2xl mx-auto mb-4 object-cover border border-white/10 shadow-xl" />
                        )}
                        <div className="text-3xl font-bold text-white">{tiles[showFocus.index].content?.title || tiles[showFocus.index].text}</div>
                        <div className="text-lg text-zinc-300 mt-2">{tiles[showFocus.index].content?.artist || ''}</div>
                        <div className="text-xs text-zinc-500 mt-4">Added to the queue</div>
                    </div>
                </div>
            )}

            {/* Header / Instructions */}
            <div className="z-10 text-center mb-6 relative w-full">
                {isMobile && onClose && (
                    <button
                        onClick={onClose}
                        className="absolute right-0 top-0 bg-black/60 border border-white/10 text-white px-3 py-1 rounded-full text-[10px] uppercase tracking-widest"
                    >
                        Back
                    </button>
                )}
                <h1 className={`${isMobile ? 'text-3xl' : 'text-6xl'} font-bebas text-transparent bg-clip-text bg-gradient-to-r ${isMystery ? 'from-purple-400 to-pink-600' : 'from-cyan-300 to-teal-200'} drop-shadow-lg`}>
                    {isMystery ? 'MYSTERY BINGO' : 'KARAOKE BINGO'}
                </h1>
                <p className={`${isMobile ? 'text-[11px]' : 'text-xl'} text-zinc-300 font-bold uppercase tracking-widest mt-2`}>
                    {isMystery ? 'Listen and match the clue.' : 'Spot the tropes, tag the board.'}
                </p>
                {isMystery && pickerName && (
                    <div className="mt-3 text-xs uppercase tracking-[0.35em] text-zinc-400">
                        Picker: <span className="text-white font-bold">{pickerName}</span>
                    </div>
                )}
                {enabledRules.length > 0 && !isMobile && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-zinc-400">
                        {enabledRules.map((rule, idx) => (
                            <span key={`${rule.label}-${idx}`} className="px-3 py-1 rounded-full border border-white/10 bg-black/30">
                                {rule.label}{rule.reward ? ` | ${rule.reward}` : ''}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div className={`${isMobile ? 'w-[92vw] max-w-[420px]' : 'w-full max-w-[1200px]'} ${isMobile ? 'aspect-square' : 'aspect-video'} flex items-center justify-center z-10`}> 
                <div className={`${isMobile ? 'gap-2' : 'gap-4'} grid w-full h-full`} style={{gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`}}>
                    {tiles.map((tile, i) => (
                        <BingoTile
                            key={i}
                            tile={tile}
                            size={size}
                            index={i}
                            highlighted={highlighted === i}
                            onSuggest={onSuggest}
                            view={view}
                            revealed={revealed}
                            suggestCount={suggestions?.[i]?.count || 0}
                            sponsor={sponsor}
                        />
                    ))} 
                </div> 
            </div> 
        </div> 
    );
};

export default BingoGame;
