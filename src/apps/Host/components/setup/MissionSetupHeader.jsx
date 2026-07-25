import React from 'react';

const MissionSetupHeader = ({
    styles,
    statusClass = '',
    statusLabel = 'Ready',
    onSkip = () => {},
    applying = false
}) => (
    <div className="border-b border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_84%_0%,rgba(236,72,153,0.14),transparent_32%),linear-gradient(180deg,rgba(17,24,39,0.96),rgba(9,9,11,0.9))] px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/80">Step 2 of 2 · Set the night</div>
                <div className="mt-1 text-2xl font-black text-white md:text-3xl">What should tonight feel like?</div>
                <div className="mt-1 text-sm text-zinc-300">Pick a vibe, choose what happens between performances, then launch.</div>
            </div>
            <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${statusClass}`}>
                    {statusLabel}
                </span>
                <button
                    onClick={onSkip}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnNeutral} ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    Close
                </button>
            </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Room creation progress">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-100">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/16 text-[10px]"><i className="fa-solid fa-check" /></span>
                <span><b>Room created</b><span className="ml-1 hidden text-emerald-100/55 sm:inline">Identity and guest access</span></span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-fuchsia-300/30 bg-[linear-gradient(135deg,rgba(255,208,124,0.12),rgba(236,72,153,0.12))] px-3 py-2 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <span className="grid h-6 w-6 place-items-center rounded-full border border-amber-200/30 bg-amber-300/12 text-[10px] font-black text-amber-100">2</span>
                <span><b>Set the vibe</b><span className="ml-1 hidden text-zinc-400 sm:inline">Recipe and pacing</span></span>
            </div>
        </div>
    </div>
);

export default MissionSetupHeader;
