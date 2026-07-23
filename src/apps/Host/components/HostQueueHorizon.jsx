import React from 'react';

const SEGMENT_TONES = Object.freeze({
    live: 'border-pink-300/30 bg-pink-500/10 text-pink-100',
    next: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100',
    then: 'border-white/10 bg-white/[0.04] text-zinc-200',
    moment: 'border-violet-300/30 bg-violet-500/10 text-violet-100',
});

const HorizonSegment = ({ segment, onSelect, className = '' }) => {
    const item = segment?.item || {};
    const isMoment = item.objectType !== 'performance';
    const title = String(item.title || (isMoment ? 'Planned moment' : 'Guest')).trim();
    const subtitle = String(item.subtitle || (isMoment ? 'Room moment' : 'Song')).trim();
    const artworkUrl = String(item.artworkUrl || '').trim();
    const avatarEmoji = String(item.avatarEmoji || '').trim();
    return (
        <button
            type="button"
            onClick={() => onSelect?.(segment)}
            className={`group flex min-h-[44px] min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition hover:border-white/30 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${SEGMENT_TONES[segment?.tone] || SEGMENT_TONES.then} ${className}`}
            aria-label={`${segment?.label || 'Queue'}: ${title}, ${subtitle}`}
        >
            <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-sm" aria-hidden="true">
                {artworkUrl ? (
                    <img src={artworkUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                ) : (
                    avatarEmoji || <i className={`fa-solid ${isMoment ? 'fa-clapperboard' : 'fa-microphone-lines'} text-[12px]`} />
                )}
                {artworkUrl && avatarEmoji ? (
                    <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-zinc-950 bg-zinc-900 text-[11px] shadow-md">
                        {avatarEmoji}
                    </span>
                ) : null}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-black uppercase tracking-[0.12em] opacity-80">{segment?.label}</span>
                <span className="block truncate text-sm font-black leading-tight text-white">{title}</span>
                <span className="block truncate text-[12px] leading-tight text-zinc-300">{subtitle}</span>
            </span>
        </button>
    );
};

const HostQueueHorizon = ({
    model,
    onSelectSegment,
    onOpenQueue,
    onOpenAttention,
    onOpenAutomation,
    compact = false,
}) => {
    const segments = Array.isArray(model?.segments) ? model.segments : [];
    const primarySegments = segments.slice(0, 3);
    const mobilePrimarySegment = primarySegments.find((segment) => segment?.key !== 'on-stage') || primarySegments[0] || null;
    const attentionCount = Math.max(0, Number(model?.attentionCount || 0));
    const remainingCount = Math.max(0, Number(model?.remainingCount || 0));
    const automationEnabled = model?.automation?.enabled === true;

    return (
        <section
            data-feature-id="host-queue-horizon"
            aria-label="Live Queue horizon"
            className="host-queue-horizon shrink-0 border-b border-cyan-300/15 bg-zinc-950/96 px-3 py-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.28)] sm:px-4"
        >
            <div className="mx-auto flex min-h-[52px] w-full items-center gap-2">
                <button
                    type="button"
                    onClick={onOpenQueue}
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 text-[12px] font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                    aria-label={`Open Live Queue${model?.queueTotalCount ? `, ${model.queueTotalCount} ready` : ''}`}
                >
                    <i className="fa-solid fa-list-ol" aria-hidden="true"></i>
                    <span className={compact ? 'hidden sm:inline' : 'hidden md:inline'}>Live Queue</span>
                </button>

                <div className="min-w-0 flex-1 sm:hidden">
                    {mobilePrimarySegment ? (
                        <HorizonSegment
                            segment={mobilePrimarySegment}
                            onSelect={onSelectSegment}
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={onOpenQueue}
                            className="flex min-h-[44px] w-full min-w-0 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-left text-sm font-semibold text-zinc-300 transition hover:border-cyan-300/30 hover:text-white"
                        >
                            No singer ready — add the first performance
                        </button>
                    )}
                </div>

                <div className="hidden min-w-0 flex-1 gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                    {primarySegments.length ? primarySegments.map((segment, index) => (
                        <HorizonSegment
                            key={`${segment.key}-${segment.item?.id || index}`}
                            segment={segment}
                            onSelect={onSelectSegment}
                            className={index > 1 ? 'sm:hidden lg:flex' : ''}
                        />
                    )) : (
                        <button
                            type="button"
                            onClick={onOpenQueue}
                            className="flex min-h-[44px] min-w-0 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-left text-sm font-semibold text-zinc-300 transition hover:border-cyan-300/30 hover:text-white"
                        >
                            No singer ready — open the Queue to add the first performance
                        </button>
                    )}
                </div>

                {remainingCount > 0 ? (
                    <button
                        type="button"
                        onClick={onOpenQueue}
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-white transition hover:border-cyan-300/35 hover:bg-cyan-500/10"
                        aria-label={`Open ${remainingCount} more queued performance${remainingCount === 1 ? '' : 's'}`}
                    >
                        +{remainingCount}
                    </button>
                ) : null}

                {attentionCount > 0 ? (
                    <button
                        type="button"
                        onClick={onOpenAttention || onOpenQueue}
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-300/35 bg-amber-500/12 px-3 text-[12px] font-black uppercase tracking-[0.1em] text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-500/18"
                        aria-label={`${attentionCount} Queue item${attentionCount === 1 ? '' : 's'} need attention`}
                    >
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                        <span>{attentionCount}</span>
                        <span className="hidden xl:inline">Need Attention</span>
                    </button>
                ) : null}

                <button
                    type="button"
                    onClick={onOpenAutomation || onOpenQueue}
                    className={`hidden min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-black uppercase tracking-[0.1em] transition sm:inline-flex ${
                        automationEnabled
                            ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-200/55'
                            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-cyan-300/30 hover:text-white'
                    }`}
                    aria-label={automationEnabled
                        ? 'Auto-DJ is on. Turn it off to require the Host to start and advance every performance.'
                        : 'Auto-DJ is off. Turn it on to start ready performances and advance the Queue after the configured delay.'}
                    title={automationEnabled
                        ? 'ON: BeauRocks starts ready performances and advances the Queue after the configured delay. Click for manual control.'
                        : 'OFF: the Host starts and advances each performance. Click to let BeauRocks move through ready Queue entries.'}
                >
                    <i className={`fa-solid ${automationEnabled ? 'fa-wand-magic-sparkles' : 'fa-hand'} text-[11px]`} aria-hidden="true"></i>
                    {model?.automation?.label || 'Manual'}
                </button>
            </div>
        </section>
    );
};

export default HostQueueHorizon;
