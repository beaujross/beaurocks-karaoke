import React from 'react';

const COUNT_TONE_BY_SEVERITY = {
    idle: 'bg-zinc-800/90 text-zinc-300',
    active: 'bg-cyan-500/20 text-cyan-100',
    stale: 'bg-amber-500/25 text-amber-100',
    critical: 'bg-rose-500/25 text-rose-100'
};

const ModerationInboxChip = ({
    pendingCount = 0,
    severity = 'idle',
    needsAttention = false,
    onClick,
    className = ''
}) => {
    const normalizedCount = Math.max(0, Number(pendingCount || 0));
    const countToneClass = COUNT_TONE_BY_SEVERITY[severity] || COUNT_TONE_BY_SEVERITY.idle;
    const activeClass = normalizedCount > 0
        ? 'text-[#00C4D9] border-[#00C4D9] bg-black/40'
        : 'text-zinc-400 border-transparent bg-zinc-900/40 hover:text-white';

    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-black uppercase tracking-[0.22em] rounded-xl border-b-2 transition-all ${activeClass} ${className}`}
            title={normalizedCount > 0 ? `${normalizedCount} moderation item${normalizedCount === 1 ? '' : 's'} waiting` : 'No pending moderation'}
            aria-label="Open moderation inbox"
        >
            <span>Inbox</span>
            <span className={`inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1.5 text-[10px] leading-none tracking-normal ${countToneClass}`}>
                {normalizedCount}
            </span>
            {needsAttention && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-300"></span>
            )}
        </button>
    );
};

export default ModerationInboxChip;
