import React from 'react';
import { HOST_LIVE_OPS_LANGUAGE } from '../hostLiveOpsLanguage';
import { NIGHT_EXPERIENCES } from '../../../lib/nightPlan.js';
import { getHostLineupItemDurationSec } from '../lib/hostQueueHorizonModel.js';

const SEGMENT_TONES = Object.freeze({
    live: 'border-pink-300/30 bg-pink-500/10 text-pink-100',
    next: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100',
    then: 'border-white/10 bg-white/[0.04] text-zinc-200',
    moment: 'border-violet-300/30 bg-violet-500/10 text-violet-100',
});

const formatDuration = (value = 0) => {
    const totalSec = Math.max(0, Math.round(Number(value || 0) || 0));
    if (!totalSec) return '';
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}:${String(secs).padStart(2, '0')}`;
};

const HorizonSegment = ({ segment, onSelect, className = '' }) => {
    const item = segment?.item || {};
    const isMoment = item.objectType !== 'performance';
    const title = String(item.title || (isMoment ? 'Planned moment' : 'Guest')).trim();
    const subtitle = String(item.subtitle || (isMoment ? 'Room moment' : 'Song')).trim();
    const artworkUrl = String(item.artworkUrl || '').trim();
    const avatarEmoji = String(item.avatarEmoji || '').trim();
    const durationLabel = formatDuration(getHostLineupItemDurationSec(item));
    return (
        <button
            type="button"
            onClick={() => onSelect?.(segment)}
            className={`group flex min-h-[44px] min-w-0 items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-1.5 text-left transition hover:border-white/30 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${SEGMENT_TONES[segment?.tone] || SEGMENT_TONES.then} ${className}`}
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
                <span className="flex items-center justify-between gap-2 text-[12px] font-black uppercase tracking-[0.12em] opacity-80">
                    <span>{segment?.label}</span>
                    {durationLabel ? <span className="text-[10px] tabular-nums text-white/75"><i className="fa-regular fa-clock mr-1" aria-hidden="true"></i>{durationLabel}</span> : null}
                </span>
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
    onToggleAutomation,
    experienceId = 'karaoke',
    onChangeExperience,
    experiencePending = false,
    compact = false,
}) => {
    const segments = Array.isArray(model?.segments) ? model.segments : [];
    const primarySegments = segments.slice(0, 4);
    const mobilePrimarySegment = primarySegments.find((segment) => segment?.key !== 'on-stage') || primarySegments[0] || null;
    const attentionCount = Math.max(0, Number(model?.attentionCount || 0));
    const remainingCount = Math.max(0, Number(model?.remainingCount || 0));
    const automationEnabled = model?.automation?.enabled === true;
    const automationPaused = model?.automation?.paused === true;
    const automationLimited = model?.automation?.limited === true;
    const automationPending = model?.automation?.pending === true;
    const automationState = model?.automation?.state || 'off';
    const automationNeedsAttention = ['repair', 'blocked', 'manual', 'paused_playback'].includes(automationState);
    const automationLabel = model?.automation?.label || 'Auto-Advance Off';
    const automationDetail = model?.automation?.detail || 'Turn on Auto-Advance to play the full lineup in order.';
    const [showTimeNow, setShowTimeNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        const timer = window.setInterval(() => setShowTimeNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    const showTimeLabel = React.useMemo(() => new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
    }).format(showTimeNow), [showTimeNow]);
    const plannedRemainingSec = (Array.isArray(model?.timelineItems) ? model.timelineItems : [])
        .filter((item) => !['complete', 'skipped'].includes(String(item?.status || item?.raw?.status || '').trim().toLowerCase()))
        .reduce((sum, item) => sum + getHostLineupItemDurationSec(item), 0);
    const plannedRemainingLabel = formatDuration(plannedRemainingSec);

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

                <div
                    className="relative h-11 w-[132px] shrink-0 sm:w-[168px]"
                    data-feature-id="host-lineup-night-mode"
                    title="Change the room experience without leaving Tonight's Lineup"
                >
                    <i className={`fa-solid ${NIGHT_EXPERIENCES.find((entry) => entry.id === experienceId)?.icon || 'fa-microphone-lines'} pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-[11px] text-violet-200`} aria-hidden="true"></i>
                    <select
                        value={experienceId}
                        disabled={experiencePending}
                        onChange={(event) => onChangeExperience?.(event.target.value)}
                        className="h-full w-full cursor-pointer appearance-none rounded-xl border border-violet-200/40 bg-violet-950/55 py-0 pl-7 pr-7 text-[10px] font-black uppercase tracking-[0.04em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition [color-scheme:dark] hover:border-violet-100/65 hover:bg-violet-900/60 focus-visible:border-violet-200/80 focus-visible:ring-2 focus-visible:ring-violet-300/70 disabled:cursor-wait disabled:opacity-60 sm:text-[11px] sm:tracking-[0.07em]"
                        aria-label="Room experience"
                        aria-busy={experiencePending}
                    >
                        {NIGHT_EXPERIENCES.map((experience) => <option key={experience.id} value={experience.id}>{experience.shortLabel}</option>)}
                    </select>
                    <i className={`fa-solid ${experiencePending ? 'fa-spinner fa-spin' : 'fa-chevron-down'} pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-violet-200`} aria-hidden="true"></i>
                </div>

                <div
                    className="hidden min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-cyan-200/25 bg-black/25 px-2.5 md:flex"
                    data-feature-id="host-lineup-show-time"
                    title={plannedRemainingLabel ? `${plannedRemainingLabel} of known lineup time remains` : 'Current show time'}
                >
                    <i className="fa-solid fa-clock text-cyan-200" aria-hidden="true"></i>
                    <span className="min-w-0">
                        <span className="block text-[8px] font-black uppercase tracking-[0.15em] text-cyan-200/75">Show Time</span>
                        <span className="block whitespace-nowrap text-[12px] font-black leading-tight tabular-nums text-white">{showTimeLabel}</span>
                        {plannedRemainingLabel ? <span className="block whitespace-nowrap text-[9px] font-bold leading-tight text-zinc-300">{plannedRemainingLabel} planned</span> : null}
                    </span>
                </div>

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
                        className="hidden min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-white transition hover:border-cyan-300/35 hover:bg-cyan-500/10 sm:inline-flex"
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
                    onClick={automationNeedsAttention ? onOpenQueue : (onToggleAutomation || onOpenQueue)}
                    data-feature-id="tonights-lineup-auto-advance"
                    disabled={automationPending}
                    className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-black uppercase tracking-[0.08em] transition disabled:cursor-wait disabled:opacity-65 sm:px-3 sm:text-[12px] sm:tracking-[0.1em] ${
                        automationState === 'repair'
                            ? 'border-rose-300/45 bg-rose-500/15 text-rose-100 hover:border-rose-200/70'
                            : automationEnabled && !automationNeedsAttention
                            ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-200/55'
                            : automationPaused || automationLimited || automationNeedsAttention
                                ? 'border-amber-300/35 bg-amber-500/12 text-amber-100 hover:border-amber-200/60'
                                : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-cyan-300/30 hover:text-white'
                    }`}
                    aria-pressed={automationEnabled}
                    aria-busy={automationPending}
                    aria-label={`${automationLabel}. ${automationDetail}`}
                    title={automationDetail}
                >
                    <i className={`fa-solid ${automationPending ? 'fa-spinner fa-spin' : automationState === 'repair' ? 'fa-screwdriver-wrench' : automationNeedsAttention ? 'fa-triangle-exclamation' : automationEnabled ? 'fa-forward-step' : automationPaused ? 'fa-pause' : automationLimited ? 'fa-triangle-exclamation' : 'fa-play'} text-[11px]`} aria-hidden="true"></i>
                    <span className="sm:hidden">{automationPending ? 'Saving' : automationState === 'repair' ? 'Repair' : automationState === 'running' ? 'Running' : automationState === 'armed' ? 'Armed' : automationState === 'starting' ? 'Starting' : automationState === 'ready' ? 'Ready' : automationState === 'finished' ? 'Finished' : automationPaused ? 'Paused' : automationLimited ? 'Songs only' : automationNeedsAttention ? 'Blocked' : 'Auto'}</span>
                    <span className="hidden sm:inline">{automationPending ? 'Updating…' : automationLabel}</span>
                </button>
            </div>
        </section>
    );
};

export default HostQueueHorizon;
