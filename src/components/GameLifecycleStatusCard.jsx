import React from 'react';

const GameLifecycleStatusCard = ({ presentation, surface = 'audience' }) => {
    if (!presentation?.visible) return null;
    const tv = surface === 'tv';
    return (
        <div
            data-game-lifecycle-status={surface}
            data-game-lifecycle-mode={presentation.modeId || ''}
            data-game-lifecycle-slot={presentation.slot || 'room_moment'}
            className={`pointer-events-none absolute left-1/2 top-3 z-[135] w-[min(94%,48rem)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/78 px-4 py-3 text-white shadow-[0_16px_36px_rgba(0,0,0,0.38)] backdrop-blur-md ${tv ? 'md:top-5 md:px-5 md:py-4' : ''}`}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/12 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100">{presentation.lifecycleLabel}</span>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-white">{presentation.phaseLabel}</span>
                </div>
                <span className="text-[10px] text-zinc-400">{presentation.revealOwner}</span>
            </div>
            <div className={`${tv ? 'mt-2 text-lg' : 'mt-2 text-sm'} font-black text-white`}>{presentation.audienceAction}</div>
            <div className="mt-1 text-[11px] text-zinc-400">Next: {presentation.nextStep}</div>
        </div>
    );
};

export default GameLifecycleStatusCard;
