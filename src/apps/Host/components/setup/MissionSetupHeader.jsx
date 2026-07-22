import React from 'react';

const MissionSetupHeader = ({
    styles,
    statusClass = '',
    statusLabel = 'Ready',
    onSkip = () => {},
    applying = false
}) => (
    <div className="px-4 py-4 md:px-6 md:py-5 border-b border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Room Readiness</div>
                <div className="text-2xl md:text-3xl font-black text-white mt-1">Set up tonight&apos;s room</div>
                <div className="text-sm text-zinc-400 mt-1">Review room control, guest entry, queue, and automation. Then Launch Room.</div>
            </div>
            <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-[0.24em] px-2 py-1 rounded-full border ${statusClass}`}>
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
