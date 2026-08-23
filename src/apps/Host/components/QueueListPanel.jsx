import React from 'react';
import { HOST_LIVE_OPS_LANGUAGE } from '../hostLiveOpsLanguage';
import { deleteDoc, doc, db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { getQueueEntryPerformanceReadiness } from '../../../lib/playbackSource';
import ContentSourceBadge from '../../../components/ContentSourceBadge';
import {
    buildSelfServeModePresentation,
    buildSelfServeTransitionMoment,
    SELF_SERVE_FORMATS,
} from '../../../lib/selfServeKaraoke';
import QueueSongCard from './QueueSongCard';
import QueueSongInspector from './QueueSongInspector';

const QueueSectionHeader = ({
    label,
    count,
    toneClass,
    detail = '',
    open = null,
    onToggle = null,
    featureId = '',
}) => {
    const content = (
        <>
            <span className="min-w-0">
                <span className="block truncate text-xs font-bold uppercase tracking-[0.16em]">{label}</span>
                {detail && open ? <span className="mt-0.5 block text-[11px] leading-4 text-zinc-400">{detail}</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                    {count}
                </span>
                {onToggle ? <i className={`fa-solid ${open ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] text-zinc-400`}></i> : null}
            </span>
        </>
    );
    const className = `mb-1 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left ${toneClass}`;
    if (!onToggle) return <div className={className}>{content}</div>;
    return (
        <button
            type="button"
            className={`${className} transition hover:border-white/20 hover:bg-white/[0.04]`}
            aria-expanded={!!open}
            title={detail}
            data-feature-id={featureId || undefined}
            onClick={onToggle}
        >
            {content}
        </button>
    );
};

export const QueueSummaryBar = ({
    showQueueSummaryBar = true,
    onToggleQueueSummaryBar,
    reviewRequiredCount = 0,
    pending = [],
    queue = [],
    assigned = [],
    held = [],
    queueSurfaceCounts = null,
    runOfShowOpenSlots = [],
    onFillRunOfShowOpenSlotsFromQueue,
    onAddQuickRunOfShowMoment,
    protectedReadyQueueCount = 0,
    protectedReadyQueueTarget = 0,
    lineupHasCurrentPerformer = false,
    styles,
    compactViewport = false,
    embedded = false,
}) => {
    const counts = queueSurfaceCounts || {};
    const needsAttentionCount = Number.isFinite(Number(counts.needsAttention))
        ? Number(counts.needsAttention)
        : (Number(reviewRequiredCount || 0) + Number(pending.length || 0));
    const readyCount = Number.isFinite(Number(counts.ready)) ? Number(counts.ready) : queue.length;
    const assignedCount = Number.isFinite(Number(counts.assigned)) ? Number(counts.assigned) : assigned.length;
    const heldCount = Number.isFinite(Number(counts.held)) ? Number(counts.held) : held.length;
    const safeProtectedReadyQueueCount = Math.max(0, Math.min(queue.length, Number(protectedReadyQueueCount || 0)));
    const safeProtectedReadyQueueTarget = Math.max(safeProtectedReadyQueueCount, Number(protectedReadyQueueTarget || 0));
    const lockedLineupCount = Number(lineupHasCurrentPerformer ? 1 : 0) + safeProtectedReadyQueueCount;
    const lockedLineupTarget = Number(lineupHasCurrentPerformer ? 1 : 0) + safeProtectedReadyQueueTarget;
    const laterReadyQueueCount = Math.max(0, readyCount - safeProtectedReadyQueueCount);
    const queueSummaryChips = [
        needsAttentionCount
            ? {
                key: 'needsAttention',
                className: 'rounded-full border border-orange-300/30 bg-orange-500/10 px-2 py-1 text-orange-100',
                label: `Needs Attention ${needsAttentionCount}`
            }
            : null,
        reviewRequiredCount
            ? {
                key: 'reviewRequired',
                className: 'rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-amber-100',
                label: `Track Check ${reviewRequiredCount}`
            }
            : null,
        pending.length
            ? {
                key: 'pending',
                className: 'rounded-full border border-orange-300/30 bg-orange-500/10 px-2 py-1 text-orange-100',
                label: `Pending ${pending.length}`
            }
            : null,
        {
            key: 'ready',
            className: 'rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100',
            label: `Ready ${readyCount}`
        },
        assignedCount
            ? {
                key: 'assigned',
                className: 'rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-violet-100',
                label: `Assigned ${assignedCount}`
            }
            : null,
        heldCount
            ? {
                key: 'held',
                className: 'rounded-full border border-zinc-300/25 bg-zinc-500/10 px-2 py-1 text-zinc-200',
                label: `Held ${heldCount}`
            }
            : null,
        runOfShowOpenSlots.length
            ? {
                key: 'openSlots',
                className: 'rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100',
                label: `Open Slots ${runOfShowOpenSlots.length}`
            }
            : null
    ].filter(Boolean);
    const showQueueSummaryChips = (queueSummaryChips.length > 1 || queueSummaryChips.some((chip) => chip.key !== 'ready')) && !embedded;

    const queueSummary = lockedLineupCount < lockedLineupTarget
        ? {
            eyebrow: 'Lock the lineup',
            title: `${lockedLineupCount}/${lockedLineupTarget} live spots protected`,
            detail: lineupHasCurrentPerformer
                ? 'Keep the current singer, next singer, and one more ready performer protected before doing anything else.'
                : 'Lock the next three performers first so the host can stop reshuffling and run the room.',
            toneClass: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
            accentClass: 'text-amber-100'
        }
        : needsAttentionCount > 0
            ? {
                eyebrow: 'Queue needs attention',
                title: `${needsAttentionCount} request${needsAttentionCount === 1 ? '' : 's'} waiting on host action`,
                detail: reviewRequiredCount > 0 && pending.length > 0
                    ? `${reviewRequiredCount} track pick${reviewRequiredCount === 1 ? '' : 's'} and ${pending.length} approval${pending.length === 1 ? '' : 's'} are holding the room.`
                    : reviewRequiredCount > 0
                        ? `${reviewRequiredCount} request${reviewRequiredCount === 1 ? '' : 's'} still need a host track pick.`
                    : 'Clear these first so the live lane reflects what can actually go on stage.',
                toneClass: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
                accentClass: 'text-amber-100'
            }
            : readyCount === 0 && assignedCount === 0 && heldCount === 0
                ? {
                    eyebrow: 'Queue status',
                    title: 'Queue is empty',
                    detail: 'Add songs or approve requests to keep the room moving.',
                    toneClass: 'border-white/10 bg-black/25 text-zinc-300',
                    accentClass: 'text-zinc-100'
                }
                : runOfShowOpenSlots.length > 0 && readyCount > 0
                    ? {
                        eyebrow: 'Show Plan ready',
                        title: `${runOfShowOpenSlots.length} open slot${runOfShowOpenSlots.length === 1 ? '' : 's'} can pull from queue`,
                        detail: runOfShowOpenSlots.length === 1
                            ? 'One tap can drop the next ready song straight into the open performance slot.'
                            : 'Use Fill Next Slot or Fill All Suggested to absorb queued singers into open performance slots.',
                        toneClass: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
                        accentClass: 'text-cyan-100'
                    }
                    : readyCount > 0
                        ? {
                            eyebrow: 'Lineup protected',
                            title: `${lockedLineupCount}/${lockedLineupTarget} live spots locked`,
                            detail: laterReadyQueueCount > 0
                                ? `${laterReadyQueueCount} more ready performance${laterReadyQueueCount === 1 ? '' : 's'} are waiting behind the protected lineup.`
                                : 'Stage can advance without touching review or slot assignment.',
                            toneClass: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100',
                            accentClass: 'text-emerald-100'
                        }
                        : {
                            eyebrow: heldCount > 0 ? 'Singers held' : 'Show Plan linked',
                            title: heldCount > 0
                                ? `${heldCount} singer${heldCount === 1 ? '' : 's'} temporarily held`
                                : `${assignedCount} song${assignedCount === 1 ? '' : 's'} already assigned`,
                            detail: heldCount > 0
                                ? 'Held singers stay recoverable but will not be picked by Start Next or Auto-DJ.'
                                : `These performances are tied to Show Plan slots and will move through ${HOST_LIVE_OPS_LANGUAGE.lineup}.`,
                            toneClass: heldCount > 0 ? 'border-zinc-300/20 bg-zinc-500/10 text-zinc-200' : 'border-violet-300/25 bg-violet-500/10 text-violet-100',
                            accentClass: heldCount > 0 ? 'text-zinc-100' : 'text-violet-100'
                        };

    const canFillRunOfShowFromQueue = runOfShowOpenSlots.length > 0 && readyCount > 0 && typeof onFillRunOfShowOpenSlotsFromQueue === 'function';
    const compactEmbedded = embedded;
    const showExpandedSummaryDetail = !compactEmbedded;
    const showExpandedRunOfShowActions = !compactEmbedded && canFillRunOfShowFromQueue;
    const showExpandedQuickMoments = !compactEmbedded && typeof onAddQuickRunOfShowMoment === 'function';

    return showQueueSummaryBar ? (
        <div className={`${embedded ? '' : 'mb-3 '}rounded-2xl border px-3 shadow-[0_10px_26px_rgba(0,0,0,0.18)] ${queueSummary.toneClass} ${compactEmbedded ? 'py-2' : compactViewport ? 'py-2.5' : 'py-3'}`}>
            <div className={`flex justify-between gap-3 ${compactEmbedded ? 'items-center' : 'items-start'}`}>
                <div className="min-w-0 flex-1">
                    <div className={`text-[10px] uppercase tracking-[0.22em] ${queueSummary.accentClass}`}>{queueSummary.eyebrow}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{queueSummary.title}</div>
                    {showExpandedSummaryDetail ? (
                        <div className="mt-1 text-xs text-zinc-300">{queueSummary.detail}</div>
                    ) : null}
                </div>
                {typeof onToggleQueueSummaryBar === 'function' ? (
                    <button
                        type="button"
                        onClick={onToggleQueueSummaryBar}
                        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-cyan-300/35 hover:text-white ${compactEmbedded ? 'min-h-[30px] px-2.5' : 'min-h-[34px] px-3'}`}
                    >
                        Hide Bar
                    </button>
                ) : null}
            </div>
            {showQueueSummaryChips ? (
                <div className={`flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] ${compactEmbedded ? 'mt-1.5' : 'mt-2'}`}>
                    {queueSummaryChips.map((chip) => (
                        <span key={chip.key} className={chip.className}>{chip.label}</span>
                    ))}
                </div>
            ) : null}
            {showExpandedRunOfShowActions ? (
                <div className="mt-3 flex flex-wrap items-center gap-2" data-feature-id="queue-open-slot-actions">
                    <button
                        type="button"
                        onClick={() => onFillRunOfShowOpenSlotsFromQueue?.({ limit: 1 })}
                        className={`${styles.btnStd} ${styles.btnPrimary} min-h-[38px] px-3 text-[11px]`}
                    >
                        Fill Next Slot
                    </button>
                    {Math.min(runOfShowOpenSlots.length, readyCount) > 1 ? (
                        <button
                            type="button"
                            onClick={() => onFillRunOfShowOpenSlotsFromQueue?.()}
                            className={`${styles.btnStd} ${styles.btnNeutral} min-h-[38px] px-3 text-[11px]`}
                        >
                            Fill All Suggested
                        </button>
                    ) : null}
                </div>
            ) : null}
            {showExpandedQuickMoments ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onAddQuickRunOfShowMoment?.('trivia_break', { destination: 'queue', placement: 'append' })}
                        className={`${styles.btnStd} ${styles.btnNeutral} min-h-[38px] px-3 text-[11px]`}
                    >
                        Add Trivia to Queue
                    </button>
                    <button
                        type="button"
                        onClick={() => onAddQuickRunOfShowMoment?.('winner_declaration', { destination: 'queue', placement: 'append' })}
                        className={`${styles.btnStd} ${styles.btnNeutral} min-h-[38px] px-3 text-[11px]`}
                    >
                        Add Winner to Queue
                    </button>
                    <button
                        type="button"
                        onClick={() => onAddQuickRunOfShowMoment?.('would_you_rather', { destination: 'queue', placement: 'append' })}
                        className={`${styles.btnStd} ${styles.btnNeutral} min-h-[38px] px-3 text-[11px]`}
                    >
                        Add Vote to Queue
                    </button>
                </div>
            ) : null}
        </div>
    ) : (
        typeof onToggleQueueSummaryBar === 'function' ? (
            <div className={`${embedded ? '' : 'mb-3 '}flex ${embedded ? '' : 'justify-end'}`}>
                <button
                    type="button"
                    onClick={onToggleQueueSummaryBar}
                    className="inline-flex min-h-[34px] items-center justify-center rounded-full border border-white/10 bg-black/20 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-cyan-300/35 hover:text-white"
                >
                    Show Queue Bar
                </button>
            </div>
        ) : null
    );
};

const getPlannedLineupTypeMeta = (item = {}) => {
    const type = String(item?.type || '').trim().toLowerCase();
    if (type === 'performance') return { label: 'Performance', icon: 'fa-microphone', tone: 'cyan' };
    if (type === 'trivia_break') return { label: 'Trivia Moment', icon: 'fa-circle-question', tone: 'violet' };
    if (type === 'would_you_rather_break') return { label: 'Would You Rather', icon: 'fa-scale-balanced', tone: 'emerald' };
    if (type === 'game_break') return { label: 'Game Moment', icon: 'fa-gamepad', tone: 'amber' };
    if (type === 'announcement') return { label: 'Announcement', icon: 'fa-bullhorn', tone: 'rose' };
    return { label: 'Show Moment', icon: 'fa-clapperboard', tone: 'zinc' };
};

const plannedLineupToneClasses = {
    cyan: {
        accent: 'bg-cyan-300',
        icon: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
        detail: 'text-cyan-100/65',
        expanded: 'border-cyan-300/14 bg-cyan-500/[0.035]',
    },
    violet: {
        accent: 'bg-violet-300',
        icon: 'border-violet-300/25 bg-violet-500/10 text-violet-100',
        detail: 'text-violet-100/65',
        expanded: 'border-violet-300/14 bg-violet-500/[0.035]',
    },
    emerald: {
        accent: 'bg-emerald-300',
        icon: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100',
        detail: 'text-emerald-100/65',
        expanded: 'border-emerald-300/14 bg-emerald-500/[0.035]',
    },
    amber: {
        accent: 'bg-amber-300',
        icon: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
        detail: 'text-amber-100/65',
        expanded: 'border-amber-300/14 bg-amber-500/[0.035]',
    },
    rose: {
        accent: 'bg-rose-300',
        icon: 'border-rose-300/25 bg-rose-500/10 text-rose-100',
        detail: 'text-rose-100/65',
        expanded: 'border-rose-300/14 bg-rose-500/[0.035]',
    },
    zinc: {
        accent: 'bg-zinc-400',
        icon: 'border-white/12 bg-white/[0.04] text-zinc-200',
        detail: 'text-zinc-400',
        expanded: 'border-white/10 bg-white/[0.025]',
    },
};

const formatLineupDuration = (seconds = 0) => {
    const durationSec = Math.max(0, Math.round(Number(seconds || 0) || 0));
    if (!durationSec) return '';
    if (durationSec < 60) return `${durationSec}s`;
    const minutes = Math.floor(durationSec / 60);
    const remainingSeconds = durationSec % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const readTriviaOptions = (item = {}) => {
    const config = item?.modeLaunchPlan?.launchConfig || {};
    const source = Array.isArray(config.options)
        ? config.options
        : String(config.optionsCsv || '').split(',');
    const options = source.map((entry) => String(entry || '').trim()).slice(0, 4);
    while (options.length < 4) options.push('');
    return options;
};

const InlineTriviaMomentEditor = ({ item, onUpdateItem, onGenerate }) => {
    const config = item?.modeLaunchPlan?.launchConfig || {};
    const [draft, setDraft] = React.useState(() => ({
        question: String(config.question || ''),
        options: readTriviaOptions(item),
        correctIndex: Math.max(0, Math.min(3, Number(config.correctIndex || 0))),
    }));
    const [generating, setGenerating] = React.useState(false);

    React.useEffect(() => {
        setDraft({
            question: String(config.question || ''),
            options: readTriviaOptions(item),
            correctIndex: Math.max(0, Math.min(3, Number(config.correctIndex || 0))),
        });
    }, [config.correctIndex, config.options, config.optionsCsv, config.question, item]);

    const save = () => onUpdateItem?.(item.id, {
        modeLaunchPlan: {
            ...(item.modeLaunchPlan || {}),
            modeKey: 'trivia_pop',
            launchConfig: {
                ...config,
                question: draft.question.trim(),
                options: draft.options.map((entry) => String(entry || '').trim()),
                optionsCsv: draft.options.map((entry) => String(entry || '').trim()).filter(Boolean).join(', '),
                correctIndex: draft.correctIndex,
                contentSource: 'host_custom',
            },
        },
        automationOccurrence: item.automationOccurrence
            ? { ...item.automationOccurrence, contentOwnership: 'host', contentState: 'manual_ready' }
            : null,
    });

    const generate = async () => {
        if (generating || typeof onGenerate !== 'function') return;
        setGenerating(true);
        try {
            await onGenerate(item.id);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <section className="mt-3 rounded-xl border border-violet-300/16 bg-black/25 p-3" data-feature-id="lineup-trivia-question-editor">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-violet-100">Question setup</div>
            <div className="mt-2 space-y-3">
                <div className="rounded-xl border border-cyan-300/16 bg-cyan-500/[0.06] px-3 py-2 text-xs leading-5 text-cyan-50/78">
                    This is a full-screen Trivia Moment between performances. Pop-Up Trivia is a separate in-song companion and is not edited here.
                </div>
                <label className="block text-xs font-bold text-zinc-300">Question
                    <input value={draft.question} onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))} className="mt-1 min-h-[42px] w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-300/45" />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                    {draft.options.map((option, optionIndex) => (
                        <label key={`${item.id}-inline-answer-${optionIndex}`} className="block text-xs font-bold text-zinc-300">Answer {optionIndex + 1}
                            <input value={option} onChange={(event) => setDraft((current) => ({ ...current, options: current.options.map((entry, index) => index === optionIndex ? event.target.value : entry) }))} className="mt-1 min-h-[40px] w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-300/45" />
                        </label>
                    ))}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[150px] text-xs font-bold text-zinc-300">Correct answer
                        <select value={draft.correctIndex} onChange={(event) => setDraft((current) => ({ ...current, correctIndex: Number(event.target.value || 0) }))} className="mt-1 min-h-[40px] w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white">
                            {draft.options.map((_, optionIndex) => <option key={`${item.id}-inline-correct-${optionIndex}`} value={optionIndex}>Answer {optionIndex + 1}</option>)}
                        </select>
                    </label>
                    <button type="button" onClick={save} className="min-h-[40px] rounded-xl border border-violet-300/30 bg-violet-500/14 px-3 text-xs font-black text-violet-50">Save question</button>
                    <button type="button" disabled={generating || typeof onGenerate !== 'function'} onClick={generate} className="min-h-[40px] rounded-xl border border-cyan-300/24 bg-cyan-500/10 px-3 text-xs font-black text-cyan-50 disabled:opacity-45">
                        <i className={`fa-solid ${generating ? 'fa-circle-notch animate-spin' : 'fa-wand-magic-sparkles'} mr-1.5`}></i>{generating ? 'Generating…' : 'Generate from previous performances'}
                    </button>
                </div>
            </div>
        </section>
    );
};

const InlineWyrMomentEditor = ({ item, onUpdateItem, onGenerate }) => {
    const config = item?.modeLaunchPlan?.launchConfig || {};
    const readOptions = React.useCallback(() => {
        const source = Array.isArray(config.options) ? config.options : String(config.optionsCsv || '').split(',');
        const options = source.map((entry) => String(entry || '').trim()).slice(0, 2);
        while (options.length < 2) options.push('');
        return options;
    }, [config.options, config.optionsCsv]);
    const [draft, setDraft] = React.useState(() => ({ question: String(config.question || ''), options: readOptions() }));
    const [generating, setGenerating] = React.useState(false);
    React.useEffect(() => {
        setDraft({ question: String(config.question || ''), options: readOptions() });
    }, [config.question, readOptions]);
    const save = () => onUpdateItem?.(item.id, {
        modeLaunchPlan: {
            ...(item.modeLaunchPlan || {}),
            modeKey: 'wyr',
            launchConfig: {
                ...config,
                question: draft.question.trim(),
                options: draft.options.map((entry) => String(entry || '').trim()),
                optionsCsv: draft.options.map((entry) => String(entry || '').trim()).filter(Boolean).join(', '),
                contentSource: 'host_custom',
            },
        },
        automationOccurrence: item.automationOccurrence
            ? { ...item.automationOccurrence, contentOwnership: 'host', contentState: 'manual_ready' }
            : null,
    });
    const generate = async () => {
        if (generating || typeof onGenerate !== 'function') return;
        setGenerating(true);
        try {
            await onGenerate(item.id);
        } finally {
            setGenerating(false);
        }
    };
    return (
        <section className="mt-3 rounded-xl border border-emerald-300/16 bg-black/25 p-3" data-feature-id="lineup-wyr-question-editor">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-100">Choice setup</div>
            <div className="mt-2 space-y-3">
                <div className="rounded-xl border border-emerald-300/16 bg-emerald-500/[0.06] px-3 py-2 text-xs leading-5 text-emerald-50/78">This is a full-screen Would You Rather moment between performances.</div>
                <label className="block text-xs font-bold text-zinc-300">Prompt
                    <input value={draft.question} onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))} className="mt-1 min-h-[42px] w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-emerald-300/45" />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                    {draft.options.map((option, optionIndex) => (
                        <label key={`${item.id}-inline-wyr-${optionIndex}`} className="block text-xs font-bold text-zinc-300">Choice {optionIndex === 0 ? 'A' : 'B'}
                            <input value={option} onChange={(event) => setDraft((current) => ({ ...current, options: current.options.map((entry, index) => index === optionIndex ? event.target.value : entry) }))} className="mt-1 min-h-[40px] w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-emerald-300/45" />
                        </label>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={save} className="min-h-[40px] rounded-xl border border-emerald-300/30 bg-emerald-500/14 px-3 text-xs font-black text-emerald-50">Save choices</button>
                    <button type="button" disabled={generating || typeof onGenerate !== 'function'} onClick={generate} className="min-h-[40px] rounded-xl border border-cyan-300/24 bg-cyan-500/10 px-3 text-xs font-black text-cyan-50 disabled:opacity-45"><i className={`fa-solid ${generating ? 'fa-circle-notch animate-spin' : 'fa-wand-magic-sparkles'} mr-1.5`}></i>{generating ? 'Generating…' : 'Generate from previous performances'}</button>
                </div>
            </div>
        </section>
    );
};

const PlannedLineupCard = ({
    item,
    index,
    total,
    expanded = false,
    queueIndex = -1,
    queueTotal = 0,
    positionLabel = '',
    locked = false,
    onMoveItem,
    onMoveQueueItem,
    onFocusItem,
    onSkipItem,
    onUpdateItem,
    onDeleteItem,
    onGenerateTrivia,
    onGenerateWyr,
    onOpenPerformance,
    onToggleExpanded,
}) => {
    const [confirmingRemove, setConfirmingRemove] = React.useState(false);
    const meta = getPlannedLineupTypeMeta(item);
    const typeTone = plannedLineupToneClasses[meta.tone] || plannedLineupToneClasses.zinc;
    const performance = String(item?.type || '').trim().toLowerCase() === 'performance';
    const queueProjection = item?.projectionSource === 'queue_song';
    const trivia = String(item?.type || '').trim().toLowerCase() === 'trivia_break';
    const wyr = String(item?.type || '').trim().toLowerCase() === 'would_you_rather_break';
    const status = String(item?.status || 'planned').trim().toLowerCase();
    const automatedOccurrence = item?.automationOccurrence?.source === 'between_song_rule';
    const automatedContentState = String(item?.automationOccurrence?.contentState || '').trim().toLowerCase();
    const itemIsLive = status === 'live';
    const durationLabel = formatLineupDuration(
        item?.plannedDurationSec
        || item?.durationSec
        || item?.trackDurationSec
        || item?.queueSong?.durationSec
        || item?.queueSong?.duration
    );
    const title = performance
        ? (item?.assignedPerformerName || 'Open performance slot')
        : (item?.title || meta.label);
    const detail = performance
        ? [item?.songTitle || 'Song not assigned', item?.artistName].filter(Boolean).join(' · ')
        : automatedContentState === 'waiting_for_context'
            ? `${trivia ? 'Question' : 'Choices'} prepare after the preceding performance.`
            : automatedContentState === 'generation_failed'
                ? `${trivia ? 'Question' : 'Choices'} could not be prepared. Edit, regenerate, skip, or remove this moment.`
        : trivia
            ? (item?.modeLaunchPlan?.launchConfig?.question || 'Question ready for customization')
            : wyr
                ? (item?.modeLaunchPlan?.launchConfig?.question || 'Choice ready for customization')
            : (item?.presentationPlan?.headline || item?.notes || `${Math.max(0, Number(item?.plannedDurationSec || 0)) || 'Open'} sec`);
    const overviewState = automatedContentState === 'generation_failed'
        ? { label: 'Needs review', className: 'border-rose-300/28 bg-rose-500/12 text-rose-100', icon: 'fa-triangle-exclamation' }
        : automatedContentState === 'waiting_for_context'
            ? { label: 'Waiting', className: 'border-amber-300/28 bg-amber-500/12 text-amber-100', icon: 'fa-clock' }
            : itemIsLive
                ? { label: 'Live', className: 'border-rose-300/32 bg-rose-500/16 text-rose-50', icon: 'fa-circle' }
                : automatedOccurrence
                    ? { label: 'Auto', className: 'border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100', icon: 'fa-wand-magic-sparkles' }
                    : locked
                        ? { label: 'Protected', className: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100', icon: 'fa-lock' }
                        : queueProjection
                            ? { label: 'Ready', className: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100', icon: 'fa-check' }
                            : { label: status, className: 'border-white/12 bg-black/20 text-zinc-300', icon: 'fa-circle' };
    const focusItem = () => {
        if (performance && item?.queueSongId && typeof onOpenPerformance === 'function') {
            onOpenPerformance(item.queueSongId);
            return;
        }
        onFocusItem?.(item.id);
    };

    return (
        <article
            className={`relative overflow-hidden border-b border-white/10 bg-black/10 transition last:border-b-0 ${expanded ? typeTone.expanded : 'hover:bg-white/[0.025]'}`}
            data-lineup-plan-item-id={item.id}
            data-lineup-plan-item-type={item.type}
            data-lineup-plan-item-expanded={expanded ? 'true' : 'false'}
        >
            <span className={`absolute inset-y-0 left-0 w-1 ${typeTone.accent}`} aria-hidden="true"></span>
            <div className="flex min-h-[60px] items-stretch pl-2 pr-1 sm:pl-3">
                <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left sm:gap-2.5"
                    aria-expanded={expanded}
                    aria-controls={`lineup-item-details-${item.id}`}
                    aria-label={`${expanded ? 'Close' : 'Open'} ${meta.label}: ${title}`}
                    onClick={() => {
                        if (expanded && confirmingRemove) setConfirmingRemove(false);
                        onToggleExpanded?.(item.id);
                    }}
                >
                    <span className="min-w-[34px] shrink-0 rounded-md border border-white/10 bg-black/25 px-1.5 py-1 text-center text-[9px] font-black uppercase tracking-[0.1em] text-zinc-300 sm:min-w-[40px]">
                        {positionLabel || `#${index + 1}`}
                    </span>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs ${typeTone.icon}`} title={meta.label}>
                        <i className={`fa-solid ${meta.icon}`} aria-hidden="true"></i>
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-black leading-4 text-white">{title}</span>
                        <span className={`mt-0.5 block truncate text-[11px] leading-4 ${typeTone.detail}`}>{detail}</span>
                    </span>
                    {durationLabel ? (
                        <span className="hidden shrink-0 text-[10px] font-bold tabular-nums text-zinc-400 sm:inline">{durationLabel}</span>
                    ) : null}
                    <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${overviewState.className}`}>
                        <i className={`fa-solid ${overviewState.icon} mr-1 text-[7px]`} aria-hidden="true"></i>{overviewState.label}
                    </span>
                    <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} w-3 shrink-0 text-center text-[10px] text-zinc-500`} aria-hidden="true"></i>
                </button>
                <span className="grid min-h-[44px] w-9 shrink-0 place-items-center self-center text-zinc-500" title="Drag to reorder" data-lineup-drag-handle="true">
                    <i className="fa-solid fa-grip-lines" aria-hidden="true"></i>
                </span>
            </div>
            {expanded ? (
                <div id={`lineup-item-details-${item.id}`} className="border-t border-white/8 px-3 pb-3 pt-2.5 sm:pl-[92px]" data-feature-id="lineup-item-expanded-actions">
                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-black uppercase tracking-[0.13em] text-zinc-400">
                        <span>{meta.label}</span>
                        {automatedOccurrence ? <span className="text-fuchsia-200">Planned by automation</span> : null}
                        {durationLabel ? <span className="sm:hidden">{durationLabel}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {queueProjection ? (
                            <>
                                <button type="button" disabled={queueIndex <= 0 || typeof onMoveQueueItem !== 'function'} onClick={() => onMoveQueueItem?.(item.queueSongId, -1)} className="min-h-[44px] flex-1 rounded-xl border border-white/12 bg-black/20 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200 disabled:opacity-30 sm:flex-none"><i className="fa-solid fa-arrow-up mr-1"></i>Earlier</button>
                                <button type="button" disabled={queueIndex < 0 || queueIndex >= queueTotal - 1 || typeof onMoveQueueItem !== 'function'} onClick={() => onMoveQueueItem?.(item.queueSongId, 1)} className="min-h-[44px] flex-1 rounded-xl border border-white/12 bg-black/20 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200 disabled:opacity-30 sm:flex-none"><i className="fa-solid fa-arrow-down mr-1"></i>Later</button>
                                <button type="button" onClick={focusItem} className="min-h-[44px] flex-1 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50 sm:flex-none">Performance details</button>
                            </>
                        ) : (
                            <>
                                <button type="button" disabled={itemIsLive || index === 0 || typeof onMoveItem !== 'function'} onClick={() => onMoveItem?.(item.id, -1)} className="min-h-[44px] flex-1 rounded-xl border border-white/12 bg-black/20 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200 disabled:opacity-30 sm:flex-none"><i className="fa-solid fa-arrow-up mr-1"></i>Earlier</button>
                                <button type="button" disabled={itemIsLive || index >= total - 1 || typeof onMoveItem !== 'function'} onClick={() => onMoveItem?.(item.id, 1)} className="min-h-[44px] flex-1 rounded-xl border border-white/12 bg-black/20 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200 disabled:opacity-30 sm:flex-none"><i className="fa-solid fa-arrow-down mr-1"></i>Later</button>
                                <button type="button" disabled={performance ? !item?.queueSongId || typeof onOpenPerformance !== 'function' : typeof onFocusItem !== 'function'} onClick={focusItem} className="min-h-[44px] flex-1 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50 disabled:opacity-30 sm:flex-none">{performance ? 'Performance details' : 'Open details'}</button>
                                <button type="button" disabled={typeof onSkipItem !== 'function' || ['complete', 'skipped'].includes(status)} onClick={() => onSkipItem?.(item.id, { manualAdvance: true })} className="min-h-[44px] flex-1 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-amber-50 disabled:opacity-30 sm:flex-none">Skip</button>
                                <button type="button" disabled={itemIsLive || typeof onDeleteItem !== 'function'} onClick={() => setConfirmingRemove(true)} className="min-h-[44px] flex-1 rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-rose-50 disabled:opacity-30 sm:flex-none">Remove</button>
                            </>
                        )}
                    </div>
                    {confirmingRemove ? (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-300/22 bg-rose-500/[0.08] px-3 py-2" role="alert">
                            <span className="text-xs leading-5 text-rose-50/82">Remove this item from Tonight&apos;s Lineup? This cannot be undone.</span>
                            <span className="flex gap-2">
                                <button type="button" onClick={() => setConfirmingRemove(false)} className="min-h-[34px] rounded-lg border border-white/12 bg-black/20 px-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-100">Keep</button>
                                <button type="button" onClick={() => onDeleteItem?.(item.id)} className="min-h-[34px] rounded-lg border border-rose-300/28 bg-rose-500/18 px-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-rose-50">Remove now</button>
                            </span>
                        </div>
                    ) : null}
                    {trivia ? <InlineTriviaMomentEditor item={item} onUpdateItem={onUpdateItem} onGenerate={onGenerateTrivia} /> : null}
                    {wyr ? <InlineWyrMomentEditor item={item} onUpdateItem={onUpdateItem} onGenerate={onGenerateWyr} /> : null}
                </div>
            ) : null}
        </article>
    );
};

const QueueListPanel = ({
    showQueueList,
    showQueueSummaryBar = true,
    onToggleQueueSummaryBar,
    reviewRequiredCount = 0,
    pending,
    queue,
    assigned = [],
    held = [],
    reviewRequired = [],
    onApprovePending,
    onDeletePending,
    onMoveNext,
    onHoldSinger,
    onRestoreSinger,
    dragQueueId,
    dragOverId,
    setDragQueueId,
    setDragOverId,
    reorderQueue,
    touchReorderEnabled,
    touchReorderMode = false,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    updateStatus,
    startEdit,
    onRetryLyrics,
    onFetchTimedLyrics,
    onApproveAudienceBacking,
    onAvoidAudienceBacking,
    backingDecisionBusyKey = '',
    statusPill,
    styles,
    compactViewport = false,
    runOfShowAssignableSlots = [],
    runOfShowOpenSlots = [],
    queueSurfaceCounts = null,
    onAssignQueueSongToRunOfShowItem,
    onAssignQueueSongToNextOpenRunOfShowSlot,
    onFillRunOfShowOpenSlotsFromQueue,
    onAddQuickRunOfShowMoment,
    renderSummaryBarInline = true,
    protectedReadyQueueCount = 0,
    protectedReadyQueueTarget = 0,
    lineupHasCurrentPerformer = false,
    selfServeMode = null,
    selfServeAuctionLeaderboard = [],
    nextQueueReasonLabel = '',
    nextQueueReasonDetail = '',
    performanceMode = 'karaoke',
    appleMusicEnabled = false,
    autoDjEnabled = false,
    lineupPlanItems = [],
    crowdMomentAutomation = null,
    onFocusRunOfShowItem,
    onMoveRunOfShowItem,
    onSkipRunOfShowItem,
    onUpdateRunOfShowItem,
    onDeleteRunOfShowItem,
    onGenerateRunOfShowTrivia,
    onGenerateRunOfShowWyr,
}) => {
    const [selectedSongId, setSelectedSongId] = React.useState('');
    const [expandedSections, setExpandedSections] = React.useState({
        pending: false,
        assigned: false,
        held: false,
    });
    const [plannedDragId, setPlannedDragId] = React.useState('');
    const [expandedLineupItemId, setExpandedLineupItemId] = React.useState('');
    const activeLineupPlanItems = React.useMemo(
        () => (Array.isArray(lineupPlanItems) ? lineupPlanItems : [])
            .filter((item) => item?.destination !== 'planner' && !['complete', 'skipped'].includes(String(item?.status || '').trim().toLowerCase()))
            .sort((left, right) => Number(left?.projectedSequence || left?.sequence || 0) - Number(right?.projectedSequence || right?.sequence || 0)),
        [lineupPlanItems]
    );
    const projectedQueueSongIds = React.useMemo(
        () => new Set(activeLineupPlanItems
            .map((item) => String(item?.queueSongId || item?.preparedQueueSongId || '').trim())
            .filter(Boolean)),
        [activeLineupPlanItems]
    );
    const unprojectedQueue = React.useMemo(
        () => queue.filter((song) => !projectedQueueSongIds.has(String(song?.id || '').trim())),
        [projectedQueueSongIds, queue]
    );
    const unprojectedAssigned = React.useMemo(
        () => assigned.filter((song) => !projectedQueueSongIds.has(String(song?.id || '').trim())),
        [assigned, projectedQueueSongIds]
    );
    const crowdAutomationEnabled = crowdMomentAutomation?.autoCrowdMomentsEnabled === true;
    const crowdAutomationCadence = Math.max(1, Math.min(12, Number(crowdMomentAutomation?.autoCrowdMomentEverySongs || 3) || 3));
    const crowdAutomationTypes = Array.isArray(crowdMomentAutomation?.autoCrowdMomentPreferredTypes)
        ? crowdMomentAutomation.autoCrowdMomentPreferredTypes.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)
        : [];
    const triviaAutomationEnabled = crowdAutomationEnabled && crowdAutomationTypes.includes('trivia');
    const wyrAutomationEnabled = crowdAutomationEnabled && crowdAutomationTypes.includes('would_you_rather');
    const allSongs = React.useMemo(
        () => [...reviewRequired, ...pending, ...queue, ...assigned, ...held],
        [assigned, held, pending, queue, reviewRequired]
    );
    const selectedSong = React.useMemo(
        () => allSongs.find((song) => song.id === selectedSongId) || null,
        [allSongs, selectedSongId]
    );
    const autoDjFormatReview = React.useMemo(() => {
        if (!autoDjEnabled || !queue[0]) return null;
        const readiness = getQueueEntryPerformanceReadiness(queue[0], {
            performanceMode,
            appleMusicEnabled,
        });
        if (readiness.autopilotReady || !readiness.manuallyPlayable) return null;
        return {
            song: queue[0],
            readiness,
            formatLabel: readiness.performanceMode === 'sing_along' ? 'Sing-Along' : 'Lip Sync',
        };
    }, [appleMusicEnabled, autoDjEnabled, performanceMode, queue]);
    const selfServePresentation = React.useMemo(
        () => (selfServeMode?.enabled ? buildSelfServeModePresentation(selfServeMode) : null),
        [selfServeMode]
    );
    const selfServeTransitionMoment = React.useMemo(
        () => buildSelfServeTransitionMoment(selfServeMode, { songs: allSongs }),
        [allSongs, selfServeMode]
    );
    const selfServeFormat = String(selfServePresentation?.formatId || '').trim().toLowerCase();
    const spotlightAuctionLive = selfServePresentation?.stateKey === 'auction_live';
    const spotlightAuctionComplete = selfServeFormat === SELF_SERVE_FORMATS.spotlightAuction && selfServePresentation?.stateKey === 'auction_complete';
    const crowdLockedSongId = String(selfServeTransitionMoment?.songId || '').trim();
    const auctionRankBySongId = React.useMemo(() => {
        const nextMap = new Map();
        (Array.isArray(selfServeAuctionLeaderboard) ? selfServeAuctionLeaderboard : []).forEach((entry, index) => {
            const songId = String(entry?.songId || '').trim();
            if (!songId) return;
            nextMap.set(songId, {
                rank: index + 1,
                amountCents: Math.max(0, Number(entry?.amountCents || 0) || 0),
            });
        });
        return nextMap;
    }, [selfServeAuctionLeaderboard]);

    React.useEffect(() => {
        if (!selectedSong?.id && selectedSongId) {
            setSelectedSongId('');
        }
    }, [selectedSong?.id, selectedSongId]);
    React.useEffect(() => {
        if (expandedLineupItemId && !activeLineupPlanItems.some((item) => item?.id === expandedLineupItemId)) {
            setExpandedLineupItemId('');
        }
    }, [activeLineupPlanItems, expandedLineupItemId]);
    const toggleSection = React.useCallback((sectionKey) => {
        setExpandedSections((current) => ({
            ...current,
            [sectionKey]: !current[sectionKey],
        }));
    }, []);
    React.useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const focusQueueSong = (event) => {
            const requestedSongId = String(event?.detail?.songId || '').trim();
            if (!requestedSongId) return;
            const requestedSong = allSongs.find((song) => String(song?.id || '').trim() === requestedSongId);
            if (!requestedSong) return;
            const requestedStatus = String(requestedSong?.status || '').trim().toLowerCase();
            if (requestedStatus === 'pending') {
                setExpandedSections((current) => ({ ...current, pending: true }));
            } else if (requestedStatus === 'assigned') {
                setExpandedSections((current) => ({ ...current, assigned: true }));
            } else if (requestedStatus === 'held') {
                setExpandedSections((current) => ({ ...current, held: true }));
            }
            setSelectedSongId(requestedSongId);
            window.requestAnimationFrame(() => {
                const row = Array.from(document.querySelectorAll('[data-queue-id]'))
                    .find((node) => String(node.getAttribute('data-queue-id') || '').trim() === requestedSongId);
                row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const focusTarget = row?.querySelector('button, [tabindex]:not([tabindex="-1"])');
                focusTarget?.focus?.({ preventScroll: true });
            });
        };
        window.addEventListener('beaurocks:focus-queue-song', focusQueueSong);
        return () => window.removeEventListener('beaurocks:focus-queue-song', focusQueueSong);
    }, [allSongs]);
    const buildSelfServeRowState = React.useCallback((song, { lockedIndex = -1 } = {}) => {
        if (!song?.id || !selfServeMode?.enabled) return null;
        const songId = String(song.id || '').trim();
        if (!songId) return null;
        if (crowdLockedSongId && songId === crowdLockedSongId && selfServeTransitionMoment) {
            return {
                toneKey: selfServeTransitionMoment.toneKey || selfServePresentation?.toneKey || 'cyan',
                badgeLabel: selfServeTransitionMoment.badgeLabel || 'Locked',
                detail: selfServeTransitionMoment.detail || 'This next moment is locked and ready.',
                icon: selfServeFormat === SELF_SERVE_FORMATS.spotlightAuction ? 'fa-bolt' : 'fa-stars',
            };
        }
        if (spotlightAuctionLive) {
            const auctionRank = auctionRankBySongId.get(songId);
            if (auctionRank) {
                return {
                    toneKey: 'amber',
                    badgeLabel: auctionRank.rank === 1 ? 'Auction Lead' : `Priority #${auctionRank.rank}`,
                    detail: auctionRank.rank === 1
                        ? `${(auctionRank.amountCents / 100).toFixed(2)} in verified support is leading the opening block.`
                        : `${(auctionRank.amountCents / 100).toFixed(2)} in verified support keeps this singer in the opening block race.`,
                    icon: auctionRank.rank === 1 ? 'fa-trophy' : 'fa-arrow-trend-up',
                };
            }
        }
        if (lockedIndex === 0 && nextQueueReasonLabel) {
            return {
                toneKey: selfServePresentation?.toneKey || 'cyan',
                badgeLabel: nextQueueReasonLabel,
                detail: nextQueueReasonDetail || 'This singer is currently holding the next safe slot.',
                icon: selfServeFormat === SELF_SERVE_FORMATS.spotlightAuction ? 'fa-circle-play' : 'fa-microphone-lines',
            };
        }
        return null;
    }, [
        auctionRankBySongId,
        crowdLockedSongId,
        nextQueueReasonDetail,
        nextQueueReasonLabel,
        selfServeFormat,
        selfServeMode?.enabled,
        selfServePresentation?.toneKey,
        selfServeTransitionMoment,
        spotlightAuctionLive,
    ]);
    if (!showQueueList) return null;
    const safeProtectedReadyQueueCount = Math.max(0, Math.min(queue.length, Number(protectedReadyQueueCount || 0)));
    const lockedLineupCount = Number(lineupHasCurrentPerformer ? 1 : 0) + safeProtectedReadyQueueCount;
    const lockedLineupTarget = Number(lineupHasCurrentPerformer ? 1 : 0) + Math.max(safeProtectedReadyQueueCount, Number(protectedReadyQueueTarget || 0));
    const lockedLineupComplete = lockedLineupTarget > 0 && lockedLineupCount >= lockedLineupTarget;
    const readyQueueHeaderLabel = spotlightAuctionLive
        ? 'Live Showcase Queue'
        : spotlightAuctionComplete
            ? 'Fair Queue'
            : selfServeFormat === SELF_SERVE_FORMATS.openStage
                ? 'Open Stage Queue'
                : `${HOST_LIVE_OPS_LANGUAGE.lineup} Order`;
    const readyQueueHeaderDetail = lineupHasCurrentPerformer
        ? 'On Stage is separate. The first row here is Next, followed by Then and the rest of the queue.'
        : 'No one is on stage. The first row is the next performance to start.';
    const getReadyQueuePositionLabel = (index = 0) => {
        const safeIndex = Math.max(0, Number(index || 0));
        if (lineupHasCurrentPerformer) {
            if (safeIndex === 0) return 'Next';
            if (safeIndex === 1) return 'Then';
            return `Q${safeIndex + 1}`;
        }
        if (safeIndex === 0) return 'Start';
        if (safeIndex === 1) return 'Next';
        if (safeIndex === 2) return 'Then';
        return `Q${safeIndex + 1}`;
    };
    const selectedReadyIndex = selectedSong
        ? queue.findIndex((song) => song.id === selectedSong.id)
        : -1;
    const selectedAssignedIndex = selectedSong
        ? assigned.findIndex((song) => song.id === selectedSong.id)
        : -1;
    const selectedStatus = String(selectedSong?.status || '').trim().toLowerCase();
    const selectedInspectorIndex = selectedReadyIndex >= 0
        ? selectedReadyIndex
        : selectedAssignedIndex >= 0
            ? queue.length + selectedAssignedIndex
            : 0;
    const selectedInspectorPosition = selectedReadyIndex >= 0
        ? getReadyQueuePositionLabel(selectedReadyIndex)
        : selectedStatus === 'assigned'
            ? 'Linked'
            : selectedStatus === 'held' ? 'Held' : 'Check';
    const selectedLockedInLineup = selectedReadyIndex >= 0 && selectedReadyIndex < safeProtectedReadyQueueCount;
    const moveProjectedQueueSong = (songId, delta) => {
        if (typeof reorderQueue !== 'function') return;
        const fromIndex = queue.findIndex((song) => song.id === songId);
        const toIndex = Math.max(0, Math.min(queue.length - 1, fromIndex + Number(delta || 0)));
        if (fromIndex < 0 || fromIndex === toIndex || !queue[toIndex]?.id) return;
        reorderQueue(songId, queue[toIndex].id);
    };
    const automationTypeLabel = crowdAutomationTypes.map((type) => (
        type === 'trivia' ? 'Trivia Moment'
            : type === 'would_you_rather' ? 'Would You Rather'
                : type === 'ready_check' ? 'Ready Check'
                    : type === 'volley' ? 'Volley Orb'
                        : type.replaceAll('_', ' ')
    )).join(' · ');

    return (
        <>
            {renderSummaryBarInline ? (
                <QueueSummaryBar
                    showQueueSummaryBar={showQueueSummaryBar}
                    onToggleQueueSummaryBar={onToggleQueueSummaryBar}
                    reviewRequiredCount={reviewRequiredCount}
                    pending={pending}
                    queue={queue}
                    assigned={assigned}
                    held={held}
                    queueSurfaceCounts={queueSurfaceCounts}
                    runOfShowOpenSlots={runOfShowOpenSlots}
                    onFillRunOfShowOpenSlotsFromQueue={onFillRunOfShowOpenSlotsFromQueue}
                    onAddQuickRunOfShowMoment={onAddQuickRunOfShowMoment}
                    protectedReadyQueueCount={protectedReadyQueueCount}
                    protectedReadyQueueTarget={protectedReadyQueueTarget}
                    lineupHasCurrentPerformer={lineupHasCurrentPerformer}
                    styles={styles}
                    compactViewport={compactViewport}
                />
            ) : null}
            {(activeLineupPlanItems.length > 0 || crowdAutomationEnabled) ? (
                <section className="mb-3 overflow-hidden rounded-xl border border-cyan-300/18 bg-[linear-gradient(145deg,rgba(8,24,34,0.72),rgba(22,12,35,0.72))]" data-feature-id="unified-tonights-lineup-plan">
                    <div className="flex min-h-[48px] items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
                        <div className="min-w-0">
                            <div className="truncate text-xs font-black text-white">Performances + planned moments</div>
                            <div className="mt-0.5 truncate text-[10px] leading-4 text-zinc-400">One reorderable show order</div>
                        </div>
                        <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-cyan-100">{activeLineupPlanItems.length} items</span>
                    </div>

                    {crowdAutomationEnabled ? (
                        <div className="flex min-h-[42px] items-center gap-2 border-b border-fuchsia-300/14 bg-fuchsia-500/[0.055] px-3 py-1.5" data-feature-id="lineup-crowd-moment-automation">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-fuchsia-300/20 bg-fuchsia-500/10 text-[10px] text-fuchsia-100"><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></span>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-fuchsia-100">{automationTypeLabel || 'Crowd Moment'} every {crowdAutomationCadence} performance{crowdAutomationCadence === 1 ? '' : 's'}</div>
                                {(triviaAutomationEnabled || wyrAutomationEnabled) ? <div className="truncate text-[10px] leading-4 text-fuchsia-100/60">Upcoming prompts appear below and can be opened to review.</div> : null}
                            </div>
                            <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-emerald-100">Active</span>
                        </div>
                    ) : null}

                    {activeLineupPlanItems.map((item, itemIndex) => (
                        <div
                            key={item.id}
                            draggable={item?.projectionSource === 'queue_song'
                                ? typeof reorderQueue === 'function'
                                : typeof onMoveRunOfShowItem === 'function'}
                            onDragStart={() => setPlannedDragId(item.id)}
                            onDragEnd={() => setPlannedDragId('')}
                            onDragOver={(event) => {
                                if (!plannedDragId || plannedDragId === item.id) return;
                                event.preventDefault();
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                const fromIndex = activeLineupPlanItems.findIndex((entry) => entry.id === plannedDragId);
                                const draggedItem = activeLineupPlanItems[fromIndex];
                                if (draggedItem?.projectionSource === 'queue_song' && item?.projectionSource === 'queue_song') {
                                    reorderQueue?.(draggedItem.queueSongId, item.queueSongId);
                                } else if (draggedItem?.projectionSource !== 'queue_song' && fromIndex >= 0 && fromIndex !== itemIndex) {
                                    onMoveRunOfShowItem?.(plannedDragId, itemIndex - fromIndex);
                                }
                                setPlannedDragId('');
                            }}
                            className={plannedDragId === item.id ? 'opacity-45' : ''}
                        >
                            <PlannedLineupCard
                                item={item}
                                index={itemIndex}
                                total={activeLineupPlanItems.length}
                                expanded={expandedLineupItemId === item.id}
                                queueIndex={item?.projectionSource === 'queue_song'
                                    ? queue.findIndex((song) => song.id === item.queueSongId)
                                    : -1}
                                queueTotal={queue.length}
                                positionLabel={item?.projectionSource === 'queue_song'
                                    ? getReadyQueuePositionLabel(queue.findIndex((song) => song.id === item.queueSongId))
                                    : `#${itemIndex + 1}`}
                                locked={item?.projectionSource === 'queue_song'
                                    && queue.findIndex((song) => song.id === item.queueSongId) >= 0
                                    && queue.findIndex((song) => song.id === item.queueSongId) < safeProtectedReadyQueueCount}
                                onMoveItem={onMoveRunOfShowItem}
                                onMoveQueueItem={moveProjectedQueueSong}
                                onFocusItem={onFocusRunOfShowItem}
                                onSkipItem={onSkipRunOfShowItem}
                                onUpdateItem={onUpdateRunOfShowItem}
                                onDeleteItem={onDeleteRunOfShowItem}
                                onGenerateTrivia={onGenerateRunOfShowTrivia}
                                onGenerateWyr={onGenerateRunOfShowWyr}
                                onOpenPerformance={setSelectedSongId}
                                onToggleExpanded={(itemId) => setExpandedLineupItemId((current) => current === itemId ? '' : itemId)}
                            />
                        </div>
                    ))}
                </section>
            ) : null}
            <div className="mb-3">
                {touchReorderMode ? (
                    <div className="mb-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                        Reorder mode is live. Drag a song by its handle, then tap Done Reordering.
                    </div>
                ) : null}
                {autoDjFormatReview ? (
                    <div
                        className="mb-2 rounded-xl border border-amber-300/30 bg-amber-500/[0.08] px-3 py-2.5"
                        data-autodj-format-review="true"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <span className="min-w-0">
                                <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">
                                    Auto-DJ waiting · {autoDjFormatReview.formatLabel}
                                </span>
                                <span className="mt-1 block truncate text-xs font-black text-white">
                                    {autoDjFormatReview.song.songTitle || 'Next song'}
                                    {autoDjFormatReview.song.singerName ? ` · ${autoDjFormatReview.song.singerName}` : ''}
                                </span>
                            </span>
                            {autoDjFormatReview.readiness.provider ? (
                                <ContentSourceBadge source={autoDjFormatReview.readiness.provider} compact />
                            ) : null}
                        </div>
                        <div className="mt-1 text-[11px] leading-4 text-amber-100/75">
                            {autoDjFormatReview.readiness.title}. Select this song and use Edit to choose an original recording, or start it manually.
                        </div>
                    </div>
                ) : null}
                {(selfServePresentation || unprojectedQueue.length > 0) ? (
                    <QueueSectionHeader
                        label={activeLineupPlanItems.length > 0 ? 'Unplaced performance queue' : readyQueueHeaderLabel}
                        count={unprojectedQueue.length}
                        toneClass={spotlightAuctionLive ? 'text-amber-200' : 'text-cyan-200'}
                        detail={activeLineupPlanItems.length > 0 ? 'These ready performances have not appeared in the shared lineup yet.' : readyQueueHeaderDetail}
                    />
                ) : null}
                {unprojectedQueue.map((s) => {
                    const i = queue.findIndex((song) => song.id === s.id);
                    const lockedInLiveLineup = i < safeProtectedReadyQueueCount;
                    return (
                        <QueueSongCard
                            key={s.id}
                            song={s}
                            index={i}
                            queuePositionLabel={getReadyQueuePositionLabel(i)}
                            dragQueueId={dragQueueId}
                            dragOverId={dragOverId}
                            setDragQueueId={setDragQueueId}
                            setDragOverId={setDragOverId}
                            reorderQueue={reorderQueue}
                            touchReorderEnabled={touchReorderEnabled}
                            touchReorderMode={touchReorderMode}
                            handleTouchStart={handleTouchStart}
                            handleTouchMove={handleTouchMove}
                            handleTouchEnd={handleTouchEnd}
                            updateStatus={updateStatus}
                            startEdit={startEdit}
                            onRetryLyrics={onRetryLyrics}
                            onFetchTimedLyrics={onFetchTimedLyrics}
                            onApproveAudienceBacking={onApproveAudienceBacking}
                            onAvoidAudienceBacking={onAvoidAudienceBacking}
                            onMoveNext={lockedLineupComplete ? null : onMoveNext}
                            onHoldSinger={onHoldSinger}
                            onRestoreSinger={onRestoreSinger}
                            onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                            backingDecisionBusyKey={backingDecisionBusyKey}
                            statusPill={statusPill}
                            styles={styles}
                            compactViewport={compactViewport}
                            selected={selectedSong?.id === s.id}
                            expandSelectedInline={false}
                            onSelect={(song) => setSelectedSongId((prev) => prev === song?.id ? '' : (song?.id || ''))}
                            runOfShowAssignableSlots={runOfShowAssignableSlots}
                            runOfShowOpenSlots={runOfShowOpenSlots}
                            onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                            onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                            onApprovePending={onApprovePending}
                            onDeletePending={onDeletePending}
                            lockedInLineup={lockedInLiveLineup}
                            lineupSlotLabel={lockedInLiveLineup ? getReadyQueuePositionLabel(i) : ''}
                            selfServeState={buildSelfServeRowState(s, { lockedIndex: lockedInLiveLineup ? i : -1 })}
                        />
                    );
                })}
            </div>
            {pending.length > 0 ? (
                <div className={`mb-3 border-t border-white/10 ${compactViewport ? 'pt-2' : 'pt-3'}`}>
                    <QueueSectionHeader
                        label="Awaiting Approval"
                        count={pending.length}
                        toneClass="text-orange-300"
                        detail={`Approve or review these before they enter ${HOST_LIVE_OPS_LANGUAGE.lineup}.`}
                        open={expandedSections.pending}
                        onToggle={() => toggleSection('pending')}
                        featureId="queue-section-pending-toggle"
                    />
                    {expandedSections.pending ? pending.map((s, i) => (
                            <QueueSongCard
                                key={s.id}
                                song={s}
                                index={i}
                                queuePositionLabel="Check"
                                dragQueueId={dragQueueId}
                                dragOverId={dragOverId}
                                setDragQueueId={setDragQueueId}
                                setDragOverId={setDragOverId}
                                reorderQueue={reorderQueue}
                                touchReorderEnabled={false}
                                touchReorderMode={false}
                                handleTouchStart={handleTouchStart}
                                handleTouchMove={handleTouchMove}
                                handleTouchEnd={handleTouchEnd}
                                updateStatus={updateStatus}
                                onApproveAudienceBacking={onApproveAudienceBacking}
                                onAvoidAudienceBacking={onAvoidAudienceBacking}
                                onMoveNext={onMoveNext}
                                onRestoreSinger={onRestoreSinger}
                                onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                                backingDecisionBusyKey={backingDecisionBusyKey}
                                statusPill={statusPill}
                                styles={styles}
                                compactViewport={compactViewport}
                                selected={selectedSong?.id === s.id}
                                expandSelectedInline={false}
                                onSelect={(song) => setSelectedSongId((prev) => prev === song?.id ? '' : (song?.id || ''))}
                                runOfShowAssignableSlots={runOfShowAssignableSlots}
                                runOfShowOpenSlots={runOfShowOpenSlots}
                                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                                onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                                onApprovePending={onApprovePending}
                                onDeletePending={onDeletePending}
                            />
                        )) : null}
                </div>
            ) : null}
            {unprojectedAssigned.length > 0 ? (
                <div className={`mt-3 border-t border-white/10 ${compactViewport ? 'pt-2' : 'pt-3'}`}>
                    <QueueSectionHeader
                        label="Tied To Show"
                        count={unprojectedAssigned.length}
                        toneClass="text-violet-200"
                        detail={`Linked performances are controlled by Show Plan slots, not the order in ${HOST_LIVE_OPS_LANGUAGE.lineup}.`}
                        open={expandedSections.assigned}
                        onToggle={() => toggleSection('assigned')}
                        featureId="queue-section-assigned-toggle"
                    />
                    {expandedSections.assigned ? unprojectedAssigned.map((s) => {
                        const i = assigned.findIndex((song) => song.id === s.id);
                        return (
                            <QueueSongCard
                                key={s.id}
                                song={s}
                                index={queue.length + i}
                                queuePositionLabel="Linked"
                                dragQueueId={dragQueueId}
                                dragOverId={dragOverId}
                                setDragQueueId={setDragQueueId}
                                setDragOverId={setDragOverId}
                                reorderQueue={reorderQueue}
                                touchReorderEnabled={touchReorderEnabled}
                                touchReorderMode={touchReorderMode}
                                handleTouchStart={handleTouchStart}
                                handleTouchMove={handleTouchMove}
                                handleTouchEnd={handleTouchEnd}
                                updateStatus={updateStatus}
                                startEdit={startEdit}
                                onRetryLyrics={onRetryLyrics}
                                onFetchTimedLyrics={onFetchTimedLyrics}
                                onApproveAudienceBacking={onApproveAudienceBacking}
                                onAvoidAudienceBacking={onAvoidAudienceBacking}
                                onMoveNext={onMoveNext}
                                onHoldSinger={onHoldSinger}
                                onRestoreSinger={onRestoreSinger}
                                onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                                backingDecisionBusyKey={backingDecisionBusyKey}
                                statusPill={statusPill}
                                styles={styles}
                                compactViewport={compactViewport}
                                selected={selectedSong?.id === s.id}
                                expandSelectedInline={false}
                                onSelect={(song) => setSelectedSongId((prev) => prev === song?.id ? '' : (song?.id || ''))}
                                runOfShowAssignableSlots={runOfShowAssignableSlots}
                                runOfShowOpenSlots={runOfShowOpenSlots}
                                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                                onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                                onApprovePending={onApprovePending}
                                onDeletePending={onDeletePending}
                            />
                        );
                    }) : null}
                </div>
            ) : null}
            {held.length > 0 ? (
                <div className={`mt-3 border-t border-white/10 ${compactViewport ? 'pt-2' : 'pt-3'}`}>
                    <QueueSectionHeader
                        label="Held"
                        count={held.length}
                        toneClass="text-zinc-200"
                        detail="Held singers are parked until they are restored."
                        open={expandedSections.held}
                        onToggle={() => toggleSection('held')}
                        featureId="queue-section-held-toggle"
                    />
                    {expandedSections.held ? held.map((s, i) => (
                        <QueueSongCard
                            key={s.id}
                            song={s}
                            index={i}
                            queuePositionLabel="Held"
                            dragQueueId={dragQueueId}
                            dragOverId={dragOverId}
                            setDragQueueId={setDragQueueId}
                            setDragOverId={setDragOverId}
                            reorderQueue={reorderQueue}
                            touchReorderEnabled={false}
                            touchReorderMode={false}
                            handleTouchStart={handleTouchStart}
                            handleTouchMove={handleTouchMove}
                            handleTouchEnd={handleTouchEnd}
                            updateStatus={updateStatus}
                            startEdit={startEdit}
                            onRetryLyrics={onRetryLyrics}
                            onFetchTimedLyrics={onFetchTimedLyrics}
                            onApproveAudienceBacking={onApproveAudienceBacking}
                            onAvoidAudienceBacking={onAvoidAudienceBacking}
                            onMoveNext={onMoveNext}
                            onHoldSinger={onHoldSinger}
                            onRestoreSinger={onRestoreSinger}
                            onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                            backingDecisionBusyKey={backingDecisionBusyKey}
                            statusPill={statusPill}
                            styles={styles}
                            compactViewport={compactViewport}
                            selected={selectedSong?.id === s.id}
                            expandSelectedInline={false}
                            onSelect={(song) => setSelectedSongId((prev) => prev === song?.id ? '' : (song?.id || ''))}
                            runOfShowAssignableSlots={runOfShowAssignableSlots}
                            runOfShowOpenSlots={runOfShowOpenSlots}
                            onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                            onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                            onApprovePending={onApprovePending}
                            onDeletePending={onDeletePending}
                        />
                    )) : null}
                </div>
            ) : null}
            <QueueSongInspector
                song={selectedSong}
                compactViewport={compactViewport}
                onClose={() => setSelectedSongId('')}
            >
                {selectedSong ? (
                    <QueueSongCard
                        song={selectedSong}
                        index={selectedInspectorIndex}
                        queuePositionLabel={selectedInspectorPosition}
                        dragQueueId={null}
                        dragOverId={null}
                        setDragQueueId={() => {}}
                        setDragOverId={() => {}}
                        reorderQueue={() => {}}
                        touchReorderEnabled={false}
                        touchReorderMode={false}
                        handleTouchStart={() => {}}
                        handleTouchMove={() => {}}
                        handleTouchEnd={() => {}}
                        updateStatus={updateStatus}
                        startEdit={startEdit}
                        onRetryLyrics={onRetryLyrics}
                        onFetchTimedLyrics={onFetchTimedLyrics}
                        onApproveAudienceBacking={onApproveAudienceBacking}
                        onAvoidAudienceBacking={onAvoidAudienceBacking}
                        onMoveNext={lockedLineupComplete ? null : onMoveNext}
                        onHoldSinger={onHoldSinger}
                        onRestoreSinger={onRestoreSinger}
                        onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                        backingDecisionBusyKey={backingDecisionBusyKey}
                        statusPill={statusPill}
                        styles={styles}
                        compactViewport
                        selected
                        inspectorMode
                        onSelect={() => setSelectedSongId('')}
                        runOfShowAssignableSlots={runOfShowAssignableSlots}
                        runOfShowOpenSlots={runOfShowOpenSlots}
                        onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                        onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                        onApprovePending={onApprovePending}
                        onDeletePending={onDeletePending}
                        lockedInLineup={selectedLockedInLineup}
                        lineupSlotLabel={selectedLockedInLineup ? selectedInspectorPosition : ''}
                        selfServeState={buildSelfServeRowState(selectedSong, {
                            lockedIndex: selectedLockedInLineup ? selectedReadyIndex : -1,
                        })}
                    />
                ) : null}
            </QueueSongInspector>
        </>
    );
};

export default QueueListPanel;
