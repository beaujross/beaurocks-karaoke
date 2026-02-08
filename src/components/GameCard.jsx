import React from 'react';

const STYLES = {
    btnStd: "rounded-xl font-bold transition-all active:scale-95 shadow-md uppercase tracking-wider flex items-center justify-center border text-[11px] sm:text-xs py-2 px-3 cursor-pointer whitespace-nowrap backdrop-blur-sm gap-2 min-h-[34px] focus:outline-none focus-visible:outline-none focus-visible:ring-0",
    btnPrimary: "bg-[#00C4D9]/20 border-[#00C4D9]/40 text-[#00C4D9] hover:bg-[#00C4D9]/30",
    btnSecondary: "bg-zinc-900/60 border-zinc-700 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-600",
};

const GameCard = ({ game, isActive, onConfigure, onStop }) => {
    const colorMap = {
        cyan: { bg: 'from-cyan-500/10 to-cyan-500/5', text: 'text-cyan-300', border: 'border-cyan-400/30', badge: 'bg-cyan-500/10 border-cyan-400/30 text-cyan-200' },
        pink: { bg: 'from-pink-500/10 to-pink-500/5', text: 'text-pink-300', border: 'border-pink-400/30', badge: 'bg-pink-500/10 border-pink-400/30 text-pink-200' },
        amber: { bg: 'from-amber-500/10 to-amber-500/5', text: 'text-amber-300', border: 'border-amber-400/30', badge: 'bg-amber-500/10 border-amber-400/30 text-amber-200' },
        emerald: { bg: 'from-emerald-500/10 to-emerald-500/5', text: 'text-emerald-300', border: 'border-emerald-400/30', badge: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200' },
        rose: { bg: 'from-rose-500/10 to-rose-500/5', text: 'text-rose-300', border: 'border-rose-400/30', badge: 'bg-rose-500/10 border-rose-400/30 text-rose-200' },
    };

    const c = colorMap[game.color] || colorMap.cyan;

    return (
        <div className={`relative overflow-hidden bg-gradient-to-b ${c.bg} border ${c.border} rounded-2xl p-5 flex flex-col gap-4 shadow-lg hover:shadow-xl transition-all`}>
            {/* Decorative blobs */}
            <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl opacity-20 ${c.bg.split(' ')[0].replace('from-', 'bg-')}`}></div>
            <div className={`absolute -left-4 bottom-0 w-20 h-20 rounded-full blur-2xl opacity-10 ${c.bg.split(' ')[1].replace('to-', 'bg-')}`}></div>

            {/* Header */}
            <div className="flex items-start justify-between relative z-10">
                <div>
                    <div className="text-4xl mb-2">{game.icon}</div>
                    <h3 className={`text-2xl font-bold ${c.text} mb-1`}>{game.name}</h3>
                    <p className="text-sm text-zinc-400 max-w-xs">{game.description}</p>
                </div>
                {game.badge && (
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${c.badge} flex-shrink-0`}>
                        {game.badge}
                    </span>
                )}
            </div>

            {/* Active indicator */}
            {isActive && (
                <div className={`text-xs text-white bg-red-600 px-3 py-2 rounded-lg border border-red-500 font-bold animate-pulse`}>
                    🔴 LIVE NOW
                </div>
            )}

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-2 relative z-10">
                <div className="bg-black/40 border border-white/10 rounded-xl p-2">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Category</div>
                    <div className="text-sm font-bold text-white capitalize">{game.category}</div>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-xl p-2">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Voice</div>
                    <div className="text-sm font-bold text-white">{game.needsVoice ? '🎤' : '📱'}</div>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 relative z-10">
                <button
                    onClick={onConfigure}
                    className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1 py-3 text-lg`}
                >
                    <i className="fa-solid fa-play mr-1"></i> LAUNCH
                </button>
                {isActive && (
                    <button
                        onClick={onStop}
                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4`}
                        title="Stop"
                    >
                        <i className="fa-solid fa-stop"></i>
                    </button>
                )}
            </div>
        </div>
    );
};

export default GameCard;
