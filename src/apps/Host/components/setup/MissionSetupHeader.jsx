import React from 'react';

const MissionSetupHeader = ({
    styles,
    statusClass = '',
    statusLabel = 'Ready',
    onSkip = () => {},
    applying = false
}) => (
    <div className="border-b border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_84%_0%,rgba(236,72,153,0.12),transparent_32%),linear-gradient(180deg,rgba(17,24,39,0.96),rgba(9,9,11,0.9))] px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/80">Room Setup · Quick defaults</div>
                <div className="mt-0.5 text-xl font-black text-white md:text-2xl">Tune this room</div>
                <div className="mt-0.5 text-xs text-zinc-400">These choices now live on room creation too. Use this compact editor whenever plans change.</div>
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
