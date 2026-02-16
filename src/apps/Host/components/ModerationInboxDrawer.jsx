import React, { useEffect } from 'react';

const ModerationInboxDrawer = ({
    open = false,
    onClose,
    pendingCount = 0,
    severity = 'idle',
    needsAttention = false,
    children
}) => {
    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const severityLabel = severity === 'critical'
        ? 'Critical'
        : severity === 'stale'
            ? 'Needs Attention'
            : severity === 'active'
                ? 'Active'
                : 'Clear';

    return (
        <div className="fixed inset-0 z-[88]">
            <button
                type="button"
                onClick={onClose}
                className="absolute inset-0 bg-black/65 backdrop-blur-[1px]"
                aria-label="Close moderation inbox"
            />
            <aside className="absolute right-0 top-0 h-full w-[min(460px,95vw)] border-l border-white/15 bg-zinc-950/98 shadow-[0_0_40px_rgba(0,0,0,0.55)] flex flex-col">
                <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Global Moderation</div>
                        <div className="text-sm text-white font-bold mt-1">
                            {pendingCount > 0 ? `${pendingCount} item${pendingCount === 1 ? '' : 's'} pending` : 'No pending items'}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${
                            severity === 'critical'
                                ? 'border-rose-400/45 bg-rose-500/15 text-rose-100'
                                : severity === 'stale'
                                    ? 'border-amber-400/45 bg-amber-500/15 text-amber-100'
                                    : severity === 'active'
                                        ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-100'
                                        : 'border-zinc-600 bg-zinc-900/70 text-zinc-400'
                        }`}>
                            {severityLabel}
                        </span>
                        {needsAttention && (
                            <span className="inline-flex h-2 w-2 rounded-full bg-amber-300 animate-pulse"></span>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-zinc-400 hover:text-white"
                            aria-label="Close"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
                    {children}
                </div>
            </aside>
        </div>
    );
};

export default ModerationInboxDrawer;
