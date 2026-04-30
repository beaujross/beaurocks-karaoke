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
        return String(item?.presentationPlan?.headline || item?.notes || '').trim() || 'Show moment';
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
            status,
            sequence: Number(item?.sequence || index + 1),
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
                label: 'Planner',
                onClick: onOpenShowWorkspace,
                className: styles?.btnNeutral,
                disabled: typeof onOpenShowWorkspace !== 'function'
            };
        }
        if (hudActionKey === 'go_live_check') {
            return {
                label: 'Review',
                onClick: onOpenIssue || onOpenShowWorkspace,
                className: styles?.btnHighlight,
                disabled: typeof (onOpenIssue || onOpenShowWorkspace) !== 'function'
            };
        }
        if (hudActionKey === 'start_show') {
            return {
                label: 'Start',
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
                label: 'Fix Next 3',
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
    const thirdVisibleItem = hudItems.find((item) => (
        item.id !== nowItem?.id
        && item.id !== nextVisibleItem?.id
        && !item.isComplete
    )) || hudItems[nowIndex >= 0 ? nowIndex + 2 : 2] || null;
    const previewItem = hudItems.find((item) => item.id === previewItemId) || null;
    const previewIssue = previewItem ? issueMap.get(previewItem.id) || null : null;
    const previewCanSkip = !!previewItem && !previewItem.isComplete;
    const actualTotalDurationSec = (Array.isArray(normalizedDirector.items) ? normalizedDirector.items : [])
        .reduce((sum, item) => sum + getItemDurationSec(item), 0);
    const horizonItems = [nowItem, nextVisibleItem, thirdVisibleItem].filter(Boolean);
    const filledHorizonCount = horizonItems.filter((item) => item?.id).length;
    const issueHorizonCount = horizonItems.filter((item) => item?.id && issueMap.has(item.id)).length;
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
                    <div className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/80">Moment Plan</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${hudToneClass}`}>
                            {hudState.title}
                        </span>
                        {hasPlan ? (
                            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200">
                                {Math.max(1, nowIndex + 1)} of {hudItems.length}
                            </span>
                        ) : null}
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                            filledHorizonCount >= 3 && issueHorizonCount === 0
                                ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100'
                                : 'border-amber-300/25 bg-amber-500/10 text-amber-100'
                        }`}>
                            Next 3 set {filledHorizonCount}/3
                        </span>
                    </div>
                    <div className="mt-2 text-sm text-zinc-300">{hudState.detail}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                        <span>Plan {formatTotalDuration(actualTotalDurationSec)}</span>
                        <span>{hudItems.length} item{hudItems.length === 1 ? '' : 's'}</span>
                        {enabled ? <span>Live queue runs the room</span> : <span>Ready</span>}
                    </div>
                    <div className="mt-2 text-xs text-zinc-400">Order can flex.</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {primaryAction?.label ? (
                        <button
                            type="button"
                            onClick={() => {
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
                                onOpenShowWorkspace();
                            }}
                            className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                        >
                            Planner
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setLaterOpen((value) => !value)}
                        className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                    >
                        {laterOpen ? 'Hide List' : 'Show List'}
                    </button>
                    {enabled && typeof onRewind === 'function' ? (
                        <button
                            type="button"
                            onClick={() => {
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
                                onStop();
                            }}
                            className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                        >
                            Stop
                        </button>
                    ) : null}
                    {typeof onClear === 'function' ? (
                        <button
                            type="button"
                            onClick={() => {
                                onClear();
                            }}
                            className={`${styles?.btnStd} ${styles?.btnDanger || styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                        >
                            Clear
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="mt-3 grid gap-2 xl:grid-cols-3">
                {renderSlotCard(
                    nowItem,
                    nowItem?.nowLabel || 'Now',
                    enabled ? 'Nothing live yet' : 'Plan not started',
                )}
                {renderSlotCard(
                    nextVisibleItem,
                    nextVisibleItem?.nextLabel || 'Next',
                    'Nothing set',
                )}
                {renderSlotCard(
                    thirdVisibleItem,
                    'Then',
                    'Keep one more ready',
                )}
            </div>

            {previewItem ? (
                <div className="mt-3 rounded-2xl border border-cyan-300/18 bg-black/25 px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/80">Actions</div>
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
                            Done
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
                                Fix
                            </button>
                        ) : null}
                        {typeof onMoveItem === 'function' ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onMoveItem(previewItem.id, -1)}
                                    className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                                >
                                    Earlier
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onMoveItem(previewItem.id, 1)}
                                    className={`${styles?.btnStd} ${styles?.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                                >
                                    Later
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
                            Fix now or skip.
                        </div>
                    ) : null}
                </div>
            ) : null}

            {laterOpen && hudItems.length ? (
                <div className="mt-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Full List</div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                            {issueHorizonCount > 0 ? `${issueHorizonCount} issue${issueHorizonCount === 1 ? '' : 's'}` : 'Clear'}
                        </div>
                    </div>
                    <div className="max-h-[18rem] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                        {hudItems.map((item) => (
                            <button
                                type="button"
                                onClick={() => handlePreviewToggle(item.id)}
                                key={item.id}
                                className={`w-full rounded-xl border px-3 py-2 text-left transition hover:border-cyan-300/28 ${item.toneClass}`}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-100">
                                            {item.sequence}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="truncate text-[12px] font-black text-white">{item.title}</div>
                                            <div className="truncate text-[11px] text-zinc-300">{item.summary}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                                        <span>{item.badgeLabel}</span>
                                        <span>{item.durationLabel}</span>
                                        {issueMap.has(item.id) ? (
                                            <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-amber-100">
                                                Issue
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
