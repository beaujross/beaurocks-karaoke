import React from 'react';
import { HOST_LIVE_OPS_LANGUAGE } from '../hostLiveOpsLanguage';

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
    const primarySegments = segments.slice(0, 4);
    const mobilePrimarySegment = primarySegments.find((segment) => segment?.key !== 'on-stage') || primarySegments[0] || null;
    const attentionCount = Math.max(0, Number(model?.attentionCount || 0));
    const remainingCount = Math.max(0, Number(model?.remainingCount || 0));
    const automationEnabled = model?.automation?.enabled === true;

    return (
        <section
            data-feature-id="host-queue-horizon"
            aria-label={`${HOST_LIVE_OPS_LANGUAGE.lineup} horizon`}
            className="host-queue-horizon shrink-0 border-b border-pink-200/20 bg-[linear-gradient(100deg,rgba(18,60,76,0.96),rgba(30,42,75,0.97)_48%,rgba(71,27,66,0.96))] px-3 py-1.5 shadow-[0_12px_30px_rgba(8,15,34,0.3),inset_0_1px_0_rgba(165,243,252,0.08)] sm:px-4"
        >
            <div className="mx-auto flex min-h-[52px] w-full items-center gap-2">
                <button
                    type="button"
                    onClick={onOpenQueue}
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-cyan-200/45 bg-cyan-300/16 px-3 text-[12px] font-black uppercase tracking-[0.14em] text-cyan-50 shadow-[0_8px_22px_rgba(34,211,238,0.12)] transition hover:border-cyan-100/75 hover:bg-cyan-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                    aria-label={`Open ${HOST_LIVE_OPS_LANGUAGE.lineup}${model?.queueTotalCount ? `, ${model.queueTotalCount} ready` : ''}`}
                >
                    <i className="fa-solid fa-list-ol" aria-hidden="true"></i>
                    <span className={compact ? 'hidden sm:inline' : 'hidden md:inline'}>{HOST_LIVE_OPS_LANGUAGE.lineup}</span>
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

                <div className="hidden min-w-0 flex-1 gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {primarySegments.length ? primarySegments.map((segment, index) => (
                        <HorizonSegment
                            key={`${segment.key}-${segment.item?.id || index}`}
                            segment={segment}
                            onSelect={onSelectSegment}
                            className={index > 2 ? 'sm:hidden xl:flex' : index > 1 ? 'sm:hidden lg:flex' : ''}
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
                        aria-label={`Open ${remainingCount} more ${HOST_LIVE_OPS_LANGUAGE.lineupShort.toLowerCase()} item${remainingCount === 1 ? '' : 's'}`}
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
                        ? 'Song auto advance is on. Planned moments use separate Tonight\'s Flow controls.'
                        : 'Song auto advance is off. The Host starts and advances each performance.'}
                    title={automationEnabled
                        ? 'Songs only: BeauRocks starts ready performances and advances after the configured delay. Planned moments use Tonight\'s Flow controls.'
                        : 'Songs only: the Host starts and advances each performance. Planned moments use Tonight\'s Flow controls.'}
                >
                    <i className={`fa-solid ${automationEnabled ? 'fa-wand-magic-sparkles' : 'fa-hand'} text-[11px]`} aria-hidden="true"></i>
                    {model?.automation?.label || 'Songs: Manual'}
                </button>
            </div>
        </section>
    );
};

export default HostQueueHorizon;
