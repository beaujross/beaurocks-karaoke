import React from 'react';

const MissionSetupHeader = ({
    styles,
    statusClass = '',
    statusLabel = 'Ready',
    onSkip = () => {},
    applying = false
}) => (
    <div className="border-b border-white/10 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/70">Room Readiness</div>
                <div className="mt-0.5 text-xl font-black text-white md:text-2xl">Choose tonight&apos;s recipe</div>
                <div className="mt-0.5 text-xs text-zinc-400">Pick a starting plan, review what changes, then launch.</div>
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
    </div>
);

export default MissionSetupHeader;
