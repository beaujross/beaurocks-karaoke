import React from 'react';
import {
    getRunOfShowHudActionKey,
    getRunOfShowHudState,
    getRunOfShowHudToneClass,
    getRunOfShowItemCategoryLabel,
    getRunOfShowItemLabel,
    normalizeRunOfShowDirector
} from '../../../lib/runOfShowDirector';

const getItemDurationSec = (item = {}) => Math.max(
    0,
    Math.round(Number(
        String(item?.plannedDurationSource || '').trim().toLowerCase() === 'backing'
            ? (item?.backingPlan?.durationSec || item?.plannedDurationSec || 0)
            : (item?.plannedDurationSec || item?.backingPlan?.durationSec || 0)
    ) || 0)
);

const formatDuration = (value = 0) => {
    const totalSec = Math.max(0, Math.round(Number(value || 0) || 0));
    if (!totalSec) return 'TBD';
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    }
    if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}`;
    return `${secs}s`;
};

const formatTotalDuration = (value = 0) => {
    const totalSec = Math.max(0, Math.round(Number(value || 0) || 0));
    if (!totalSec) return '0m';
    const mins = Math.ceil(totalSec / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    return `${mins}m`;
};

const formatItemSummary = (item = {}) => {
    const type = String(item?.type || '').trim().toLowerCase();
    if (type === 'performance') {
        return [item?.assignedPerformerName || '', item?.songTitle || '', item?.artistName || '']
            .filter(Boolean)
            .join(' | ') || 'Performance setup still open';
    }
    if (type === 'announcement' || type === 'intro' || type === 'closing') {
        return String(item?.presentationPlan?.headline || item?.notes || '').trim() || 'Show cue';
    }
    if (type === 'trivia_break' || type === 'game_break' || type === 'would_you_rather_break') {
        return String(item?.modeLaunchPlan?.modeKey || item?.notes || '').trim() || 'Audience moment';
    }
    return String(item?.notes || '').trim() || getRunOfShowItemLabel(type);
};

const getItemExecutionMeta = (item = {}) => {
    const type = String(item?.type || '').trim().toLowerCase();
    const modeKey = String(item?.modeLaunchPlan?.modeKey || item?.roomMomentPlan?.activeMode || '').trim().toLowerCase();
    if (type === 'performance') {
        return {
            lane: getRunOfShowItemCategoryLabel(type),
            icon: 'fa-microphone-lines',
            launchLabel: 'Performance',
            nowLabel: 'Live',
            nextLabel: 'Next'
        };
    }
    if (type === 'trivia_break' || type === 'would_you_rather_break' || type === 'game_break') {
        return {
            lane: getRunOfShowItemCategoryLabel(type),
            icon: modeKey === 'bingo'
                ? 'fa-table-cells-large'
                : modeKey === 'team_pong'
                    ? 'fa-table-tennis-paddle-ball'
                    : modeKey === 'selfie_challenge'
                        ? 'fa-camera-retro'
                        : 'fa-dice',
            launchLabel: modeKey ? `Launches ${modeKey.replaceAll('_', ' ')}` : 'Interactive launch',
            nowLabel: 'Live',
            nextLabel: 'Next'
        };
    }
    return {
        lane: getRunOfShowItemCategoryLabel(type),
        icon: type === 'announcement'
            ? 'fa-bullhorn'
            : type === 'winner_declaration'
                ? 'fa-trophy'
                : type === 'intermission'
                    ? 'fa-martini-glass-citrus'
                    : 'fa-layer-group',
        launchLabel: item?.presentationPlan?.publicTvTakeoverEnabled ? 'TV takeover' : 'Host scene',
        nowLabel: 'Live',
        nextLabel: 'Next'
    };
};

const buildHudItems = ({ items = [], liveItemId = '', stagedItemId = '', nextItemId = '' } = {}) => (
    items.map((item, index) => {
        const status = String(item?.status || '').trim().toLowerCase();
        const type = String(item?.type || '').trim().toLowerCase();
        const executionMeta = getItemExecutionMeta(item);
        const isLive = !!item?.id && item.id === liveItemId;
        const isStaged = !!item?.id && item.id === stagedItemId;
        const isNext = !!item?.id && item.id === nextItemId;
        const isComplete = status === 'complete' || status === 'skipped';
        return {
            id: item?.id || `run-of-show-${index}`,
            title: String(item?.title || '').trim() || getRunOfShowItemLabel(type),
            summary: formatItemSummary(item),
            durationLabel: formatDuration(getItemDurationSec(item)),
            typeLabel: executionMeta.lane,
            icon: executionMeta.icon,
            launchLabel: executionMeta.launchLabel,
            nowLabel: executionMeta.nowLabel,
            nextLabel: executionMeta.nextLabel,
            badgeLabel: isLive ? 'Live' : isStaged ? 'Staged' : isNext ? 'Next' : status === 'blocked' ? 'Blocked' : `#${Number(item?.sequence || index + 1)}`,
            toneClass: isLive
                ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
                : isStaged
                    ? 'border-sky-300/35 bg-sky-500/12 text-sky-100'
                    : isNext
                        ? 'border-amber-300/35 bg-amber-500/12 text-amber-100'
                        : isComplete
                            ? 'border-zinc-700 bg-zinc-900/75 text-zinc-400'
                            : status === 'blocked'
                                ? 'border-rose-300/35 bg-rose-500/12 text-rose-100'
                                : 'border-white/10 bg-black/25 text-zinc-200',
            isLive,
            isStaged,
            isNext,
            isComplete
        };
    })
);

export default function RunOfShowQueueHud({
    enabled = false,
    director = null,
    liveItem = null,
    stagedItem = null,
    nextItem = null,
    preflightReport = null,
    onOpenShowWorkspace,
    onOpenIssue,
    onFocusItem,
    onPreviewItem,
    onMoveItem,
    onSkipItem,
    onStartShow,
    onAdvance,
    onRewind,
    onStop,
    onClear,
    onToggleAutomationPause,
    styles,
}) {
    const [moreOpen, setMoreOpen] = React.useState(false);
    const [laterOpen, setLaterOpen] = React.useState(true);
    const [previewItemId, setPreviewItemId] = React.useState('');
    const normalizedDirector = React.useMemo(
        () => normalizeRunOfShowDirector(director || {}),
        [director]
    );
    const hudItems = React.useMemo(
        () => buildHudItems({
            items: Array.isArray(normalizedDirector.items) ? normalizedDirector.items : [],
            liveItemId: String(liveItem?.id || '').trim(),
            stagedItemId: String(stagedItem?.id || '').trim(),
            nextItemId: String(nextItem?.id || '').trim(),
        }),
        [liveItem?.id, nextItem?.id, normalizedDirector.items, stagedItem?.id]
    );
    const hasPlan = hudItems.length > 0;
    if (!enabled && !hasPlan) return null;

    const safeReport = preflightReport && typeof preflightReport === 'object'
        ? preflightReport
        : {
            readyToStart: hasPlan,
            criticalCount: 0,
            riskyCount: 0,
            criticalItems: [],
            riskyItems: [],
            summary: hasPlan ? 'Show plan is loaded.' : 'Add at least one block before the show starts.'
        };
    const automationPaused = normalizedDirector?.automationPaused === true;
    const topCriticalItem = safeReport?.criticalItems?.[0] || null;
    const topRiskyItem = safeReport?.riskyItems?.[0] || null;
    const issueMap = (() => {
        const map = new Map();
        [...(safeReport?.criticalItems || []), ...(safeReport?.riskyItems || [])].forEach((entry) => {
            const itemId = String(entry?.itemId || '').trim();
            if (!itemId || map.has(itemId)) return;
            map.set(itemId, entry);
        });
        return map;
    })();
    const hudState = getRunOfShowHudState({
        hasPlan,
        runEnabled: enabled,
        automationPaused,
        preflightReport: safeReport,
        issueDetail: topCriticalItem?.summary || topRiskyItem?.summary || '',
        liveItemId: liveItem?.id,
        stagedItemId: stagedItem?.id,
        nextItemId: nextItem?.id
    });
    const hudToneClass = getRunOfShowHudToneClass(hudState.tone);
    const hudActionKey = getRunOfShowHudActionKey({
        hasPlan,
        runEnabled: enabled,
        automationPaused,
        preflightReport: safeReport,
        hasIssue: !!(topCriticalItem || topRiskyItem)
    });
    const primaryAction = (() => {
        if (hudActionKey === 'open_show') {
            return {
                label: 'Open Show',
                onClick: onOpenShowWorkspace,
                className: styles?.btnNeutral,
                disabled: typeof onOpenShowWorkspace !== 'function'
            };
        }
        if (hudActionKey === 'go_live_check') {
            return {
                label: 'Go Live Check',
                onClick: onOpenIssue || onOpenShowWorkspace,
                className: styles?.btnHighlight,
                disabled: typeof (onOpenIssue || onOpenShowWorkspace) !== 'function'
            };
        }
        if (hudActionKey === 'start_show') {
            return {
                label: 'Start Show',
                onClick: onStartShow,
                className: styles?.btnHighlight,
                disabled: typeof onStartShow !== 'function'
            };
        }
        if (hudActionKey === 'resume') {
            return {
                label: 'Resume',
                onClick: typeof onToggleAutomationPause === 'function'
                    ? () => onToggleAutomationPause(false)
                    : (onOpenIssue || onOpenShowWorkspace),
                className: styles?.btnHighlight,
                disabled: typeof (onToggleAutomationPause || onOpenIssue || onOpenShowWorkspace) !== 'function'
            };
        }
        if (hudActionKey === 'fix_issue') {
            return {
                label: 'Fix Issue',
                onClick: () => (onOpenIssue || onOpenShowWorkspace)?.({
                    itemId: topCriticalItem?.itemId || topRiskyItem?.itemId || ''
                }),
                className: styles?.btnHighlight,
                disabled: typeof (onOpenIssue || onOpenShowWorkspace) !== 'function'
            };
        }
        return {
            label: 'Advance',
            onClick: onAdvance,
            className: styles?.btnHighlight,
            disabled: typeof onAdvance !== 'function' || !enabled
        };
    })();

    const fallbackNowItem = hudItems[0] || null;
    const fallbackNowIndex = fallbackNowItem ? hudItems.findIndex((item) => item.id === fallbackNowItem.id) : -1;
    const nowItem = hudItems.find((item) => item.isLive) || hudItems.find((item) => item.isStaged) || fallbackNowItem;
    const nowIndex = nowItem ? hudItems.findIndex((item) => item.id === nowItem.id) : fallbackNowIndex;
    const nextVisibleItem = hudItems.find((item) => item.isNext) || hudItems[nowIndex >= 0 ? nowIndex + 1 : 1] || null;
    const laterItems = hudItems.filter((item) => item.id !== nowItem?.id && item.id !== nextVisibleItem?.id).slice(0, 5);
    const previewItem = hudItems.find((item) => item.id === previewItemId) || null;
    const previewIssue = previewItem ? issueMap.get(previewItem.id) || null : null;
    const previewCanSkip = !!previewItem && !previewItem.isComplete;
    const actualTotalDurationSec = (Array.isArray(normalizedDirector.items) ? normalizedDirector.items : [])
        .reduce((sum, item) => sum + getItemDurationSec(item), 0);
    const handlePreviewToggle = (itemId = '') => {
        const safeItemId = String(itemId || '').trim();
        if (!safeItemId) return;
        setPreviewItemId((current) => (current === safeItemId ? '' : safeItemId));
    };
    const renderSlotCard = (item = null, fallbackLabel = '', fallbackSummary = '') => (
        <button
            type="button"
            onClick={() => item?.id && handlePreviewToggle(item.id)}
            disabled={!item?.id}
            className={`rounded-2xl border px-3 py-3 text-left transition ${item?.toneClass || 'border-white/10 bg-black/20 text-zinc-200'} ${item?.id ? 'hover:border-cyan-300/28' : 'cursor-default opacity-90'}`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">{fallbackLabel}</div>
                {item?.typeLabel ? (
                    <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/85">
                        <i className={`fa-solid ${item.icon || 'fa-layer-group'} mr-1`}></i>{item.typeLabel}
                    </span>
                ) : null}
            </div>
            <div className="mt-1 text-sm font-black text-white">{item?.title || fallbackSummary}</div>
            <div className="mt-1 text-xs text-zinc-300">{item?.summary || (item?.id ? 'Tap for item actions.' : 'Nothing is queued here yet.')}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                {item?.badgeLabel ? <span>{item.badgeLabel}</span> : null}
                {item?.durationLabel ? <span>{item.durationLabel}</span> : null}
                {item?.launchLabel ? <span>{item.launchLabel}</span> : null}
                {item?.id && previewItemId === item.id ? (
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-cyan-100">Actions Open</span>
                ) : null}
                {item?.id && issueMap.has(item.id) ? (
                    <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-amber-100">Needs Attention</span>
                ) : null}
            </div>
        </button>
    );

    return (
        <div className="mb-3 rounded-2xl border border-cyan-300/18 bg-gradient-to-r from-cyan-500/[0.08] via-zinc-950 to-fuchsia-500/[0.08] px-3 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/80">Run Of Show</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${hudToneClass}`}>
                            {hudState.title}
                        </span>
                        {hasPlan ? (
                            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200">
                                {Math.max(1, nowIndex + 1)} of {hudItems.length}
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-2 text-sm text-zinc-300">{hudState.detail}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                        <span>Total show {formatTotalDuration(actualTotalDurationSec)}</span>
                        <span>{hudItems.length} item{hudItems.length === 1 ? '' : 's'}</span>
                        {enabled ? <span>Live queue owns execution</span> : <span>Ready for launch</span>}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {primaryAction?.label ? (
                        <button
                            type="button"
                            onClick={() => {
                                setMoreOpen(false);
                                primaryAction.onClick?.();
                            }}
                            disabled={primaryAction.disabled}
                            className={`${styles?.btnStd} ${primaryAction.className} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em] disabled:opacity-40`}
                        >
                            {primaryAction.label}
                        </button>
                    ) : null}
                    {typeof onOpenShowWorkspace === 'function' ? (
                        <button
                            type="button"
                            onClick={() => {
                                setMoreOpen(false);
                                onOpenShowWorkspace();
                            }}
                            className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                        >
                            Show Workspace
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setMoreOpen((value) => !value)}
                        className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                    >
                        {moreOpen ? 'Less' : 'More'}
                    </button>
                </div>
            </div>

            {moreOpen ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
                    <button
                        type="button"
                        onClick={() => setLaterOpen((value) => !value)}
                        className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                    >
                        {laterOpen ? 'Hide Later' : 'Show Later'}
                    </button>
                    {enabled && typeof onRewind === 'function' ? (
                        <button
                            type="button"
                            onClick={() => {
                                setMoreOpen(false);
                                onRewind();
                            }}
                            disabled={hudItems.length < 2}
                            className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em] disabled:opacity-40`}
                        >
                            Previous
                        </button>
                    ) : null}
                    {enabled && typeof onStop === 'function' ? (
                        <button
                            type="button"
                            onClick={() => {
                                setMoreOpen(false);
                                onStop();
                            }}
                            className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                        >
                            Stop Show
                        </button>
                    ) : null}
                    {typeof onClear === 'function' ? (
                        <button
                            type="button"
                            onClick={() => {
                                setMoreOpen(false);
                                onClear();
                            }}
                            className={`${styles?.btnStd} ${styles?.btnDanger || styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                        >
                            Clear Show
                        </button>
                    ) : null}
                    <div className="w-full text-[11px] leading-relaxed text-zinc-400">
                        YouTube only lets the in-app TV/player iframe start videos that allow embedding. When a backing is marked not embeddable, the host can still use it, but playback has to open in the separate backing window instead of the synced TV embed.
                    </div>
                </div>
            ) : null}

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {renderSlotCard(
                    nowItem,
                    nowItem?.nowLabel || 'Now',
                    enabled ? 'Nothing is live yet' : 'Show not started',
                )}
                {renderSlotCard(
                    nextVisibleItem,
                    nextVisibleItem?.nextLabel || 'Next',
                    'Nothing is queued next yet',
                )}
            </div>

            {previewItem ? (
                <div className="mt-3 rounded-2xl border border-cyan-300/18 bg-black/25 px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/80">Item Actions</div>
                            <div className="mt-1 text-sm font-black text-white">{previewItem.title}</div>
                            <div className="mt-1 text-xs text-zinc-300">{previewItem.summary}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                                <span>{previewItem.typeLabel}</span>
                                <span>{previewItem.durationLabel}</span>
                                <span>{previewItem.launchLabel}</span>
                                {previewIssue ? (
                                    <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-amber-100">
                                        {previewIssue.count || 1} issue{Number(previewIssue.count || 1) === 1 ? '' : 's'}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPreviewItemId('')}
                            className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                        >
                            Close
                        </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {typeof onPreviewItem === 'function' ? (
                            <button
                                type="button"
                                onClick={() => onPreviewItem(previewItem.id)}
                                className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                            >
                                Preview
                            </button>
                        ) : null}
                        {typeof onFocusItem === 'function' ? (
                            <button
                                type="button"
                                onClick={() => onFocusItem(previewItem.id)}
                                className={`${styles?.btnStd} ${styles?.btnHighlight} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                            >
                                Edit
                            </button>
                        ) : null}
                        {previewIssue && typeof onOpenIssue === 'function' ? (
                            <button
                                type="button"
                                onClick={() => onOpenIssue({ itemId: previewItem.id })}
                                className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                            >
                                Fix Issue
                            </button>
                        ) : null}
                        {typeof onMoveItem === 'function' ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onMoveItem(previewItem.id, -1)}
                                    className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                                >
                                    Move Earlier
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onMoveItem(previewItem.id, 1)}
                                    className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                                >
                                    Move Later
                                </button>
                            </>
                        ) : null}
                        {typeof onSkipItem === 'function' ? (
                            <button
                                type="button"
                                disabled={!previewCanSkip}
                                onClick={() => onSkipItem(previewItem.id, { manualAdvance: true })}
                                className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em] disabled:opacity-40`}
                            >
                                Skip
                            </button>
                        ) : null}
                    </div>
                    {previewIssue?.summary ? (
                        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-50">
                            {previewIssue.summary}
                        </div>
                    ) : null}
                    {previewIssue ? (
                        <div className="mt-2 text-xs text-zinc-400">
                            Fix it now, or skip it and let the next ready performance keep the room moving.
                        </div>
                    ) : null}
                </div>
            ) : null}

            {laterOpen && laterItems.length ? (
                <div className="mt-3">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">Later</div>
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {laterItems.map((item) => (
                            <button
                                type="button"
                                onClick={() => handlePreviewToggle(item.id)}
                                key={item.id}
                                className={`min-w-[168px] max-w-[220px] shrink-0 rounded-xl border px-3 py-2 text-left transition hover:border-cyan-300/28 ${item.toneClass}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="rounded-full border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]">
                                        {item.badgeLabel}
                                    </span>
                                    <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-300">{item.durationLabel}</span>
                                </div>
                                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-current/75">
                                    <i className={`fa-solid ${item.icon || 'fa-layer-group'} mr-1`}></i>{item.typeLabel} - {item.launchLabel}
                                </div>
                                <div className="mt-1 truncate text-[12px] font-black text-white">{item.title}</div>
                                <div className="mt-1 line-clamp-2 text-[11px] text-zinc-300">{item.summary}</div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
