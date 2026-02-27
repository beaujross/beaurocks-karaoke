import React from 'react';

const VoiceHud = ({
    note,
    pitch,
    confidence,
    volumeNormalized,
    stableNote,
    stability,
    calibrating,
    view = 'mobile'
}) => {
    const pitchLabel = pitch > 0 ? `${Math.round(pitch)} Hz` : '--';
    const confidencePct = Math.round((confidence || 0) * 100);
    const stabilityPct = Math.round((stability || 0) * 100);
    const isTv = view === 'tv';
    const safeInsetStyle = isTv
        ? { top: 'max(14px, env(safe-area-inset-top))', right: 'max(14px, env(safe-area-inset-right))' }
        : undefined;

    return (
        <div
            className={`absolute ${isTv ? 'top-4 right-4' : 'top-4 right-4'} z-30 bg-black/68 backdrop-blur-md border border-white/20 rounded-2xl ${isTv ? 'p-5 w-[min(31vw,440px)] text-base shadow-[0_0_28px_rgba(0,0,0,0.45)]' : 'p-3 w-44 text-xs'} text-white`}
            style={safeInsetStyle}
        >
            <div className="flex items-center justify-between mb-2">
                <span className={`font-bold tracking-wide ${isTv ? 'text-2xl' : ''}`}>VOICE</span>
                {calibrating && <span className={`text-yellow-300 font-bold ${isTv ? 'text-base' : ''}`}>CALIBRATING</span>}
            </div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-300">Note</span>
                <span className={`font-mono ${isTv ? 'text-5xl leading-none' : 'text-lg'}`}>{note || '-'}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-300">Pitch</span>
                <span className={`font-mono ${isTv ? 'text-2xl' : ''}`}>{pitchLabel}</span>
            </div>
            <div className="mb-3">
                <div className={`flex items-center justify-between text-zinc-300 mb-1 ${isTv ? 'text-sm' : 'text-[10px]'}`}>
                    <span>Confidence</span>
                    <span>{confidencePct}%</span>
                </div>
                <div className={`${isTv ? 'h-4' : 'h-2'} rounded-full bg-white/10 overflow-hidden`}>
                    <div className="h-full bg-cyan-400 transition-all" style={{ width: `${confidencePct}%` }}></div>
                </div>
            </div>
            <div className="mb-3">
                <div className={`flex items-center justify-between text-zinc-300 mb-1 ${isTv ? 'text-sm' : 'text-[10px]'}`}>
                    <span>Volume</span>
                    <span>{Math.round((volumeNormalized || 0) * 100)}%</span>
                </div>
                <div className={`${isTv ? 'h-4' : 'h-2'} rounded-full bg-white/10 overflow-hidden`}>
                    <div className="h-full bg-pink-400 transition-all" style={{ width: `${Math.round((volumeNormalized || 0) * 100)}%` }}></div>
                </div>
            </div>
            <div>
                <div className={`flex items-center justify-between text-zinc-300 mb-1 ${isTv ? 'text-sm' : 'text-[10px]'}`}>
                    <span>Stability</span>
                    <span>{stableNote !== '-' ? `${stableNote} ${stabilityPct}%` : `${stabilityPct}%`}</span>
                </div>
                <div className={`${isTv ? 'h-4' : 'h-2'} rounded-full bg-white/10 overflow-hidden`}>
                    <div className="h-full bg-yellow-400 transition-all" style={{ width: `${stabilityPct}%` }}></div>
                </div>
            </div>
        </div>
    );
};

export default VoiceHud;
