import React from 'react';

const TONE_BY_SEVERITY = {
    idle: 'border-zinc-700 bg-zinc-900/70 text-zinc-300',
    active: 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100',
    stale: 'border-amber-400/45 bg-amber-500/15 text-amber-100',
    critical: 'border-rose-400/50 bg-rose-500/15 text-rose-100'
};

const ModerationInboxChip = ({
    pendingCount = 0,
    severity = 'idle',
    needsAttention = false,
    onClick
}) => {
    const normalizedCount = Math.max(0, Number(pendingCount || 0));
    const toneClass = TONE_BY_SEVERITY[severity] || TONE_BY_SEVERITY.idle;
    const pulseClass = normalizedCount > 0 ? 'animate-pulse' : '';

    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${toneClass} ${pulseClass}`}
            title={normalizedCount > 0 ? `${normalizedCount} moderation item${normalizedCount === 1 ? '' : 's'} waiting` : 'No pending moderation'}
            aria-label="Open moderation inbox"
        >
            <i className="fa-solid fa-inbox"></i>
            <span className="hidden sm:inline">Inbox</span>
            <span className="rounded-md border border-white/20 bg-black/30 px-1.5 py-0.5 text-[10px] leading-none">
                {normalizedCount}
            </span>
            {needsAttention && (
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-300"></span>
            )}
        </button>
    );
};

export default ModerationInboxChip;
