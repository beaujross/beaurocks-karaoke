import React from 'react';

const VoiceHud = ({
    note,
    pitch,
    confidence,
    volumeNormalized,
    stableNote,
    stability,
    calibrating
}) => {
    const pitchLabel = pitch > 0 ? `${Math.round(pitch)} Hz` : '--';
    const confidencePct = Math.round((confidence || 0) * 100);
    const stabilityPct = Math.round((stability || 0) * 100);

    return (
        <div className="absolute top-4 right-4 z-30 bg-black/60 backdrop-blur-md border border-white/20 rounded-xl p-3 w-44 text-xs text-white">
            <div className="flex items-center justify-between mb-2">
                <span className="font-bold tracking-wide">VOICE</span>
                {calibrating && <span className="text-yellow-300 font-bold">CALIBRATING</span>}
            </div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-300">Note</span>
                <span className="font-mono text-lg">{note || '-'}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-300">Pitch</span>
                <span className="font-mono">{pitchLabel}</span>
            </div>
            <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Confidence</span>
                    <span>{confidencePct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all" style={{ width: `${confidencePct}%` }}></div>
                </div>
            </div>
            <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Volume</span>
                    <span>{Math.round((volumeNormalized || 0) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-pink-400 transition-all" style={{ width: `${Math.round((volumeNormalized || 0) * 100)}%` }}></div>
                </div>
            </div>
            <div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Stability</span>
                    <span>{stableNote !== '-' ? `${stableNote} ${stabilityPct}%` : `${stabilityPct}%`}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-yellow-400 transition-all" style={{ width: `${stabilityPct}%` }}></div>
                </div>
            </div>
        </div>
    );
};

export default VoiceHud;
