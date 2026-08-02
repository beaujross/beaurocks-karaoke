import React from 'react';
import { HOST_LIVE_OPS_LANGUAGE } from '../hostLiveOpsLanguage';
import HostPlaybackDock from './HostPlaybackDock';
import HostPerformerRing from './HostPerformerRing';
import buildHostRuntimeShellTheme from '../lib/hostRuntimeShellTheme';
import { withAudienceBrandAlpha } from '../../../lib/audienceBrandTheme';
import { isAudienceSelectedUnverifiedResolution } from '../../../lib/requestModes';

const toQueueDeckItem = (item = {}, index = 0) => ({
    id: String(item?.id || `${item?.title || item?.songTitle || 'queue'}-${index}`),
    singer: String(item?.title || item?.singerName || item?.performerName || item?.displayName || 'Guest').trim() || 'Guest',
    song: String(item?.subtitle || item?.songTitle || item?.title || 'Song').trim() || 'Song',
    artist: String(item?.detail || item?.artist || item?.artistName || item?.reason || '').trim(),
    sourceLabel: String(item?.sourceLabel || '').trim(),
    statusLabel: String(item?.statusLabel || item?.status || '').trim(),
    statusKey: String(item?.status || item?.statusKey || '').trim().toLowerCase(),
    priorityLabel: index === 0 ? 'Next' : `#${index + 1}`,
});

const QUEUE_SECTION_META = {
    ready: {
        label: 'Ready Queue',
        accentClass: 'text-cyan-200',
        chipClass: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
    },
    review: {
        label: 'Needs Review',
        accentClass: 'text-amber-200',
        chipClass: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
    },
    assigned: {
        label: 'Assigned',
        accentClass: 'text-fuchsia-200',
        chipClass: 'border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100',
    },
    held: {
        label: 'Held',
        accentClass: 'text-zinc-200',
        chipClass: 'border-white/10 bg-white/5 text-zinc-200',
    },
    pending: {
        label: 'Pending',
        accentClass: 'text-violet-200',
        chipClass: 'border-violet-300/25 bg-violet-500/10 text-violet-100',
    },
};

const toQueueSection = (section = {}, fallbackKey = '', maxItems = 8) => {
    const key = String(section?.key || fallbackKey || 'queue').trim().toLowerCase() || 'queue';
    const meta = QUEUE_SECTION_META[key] || {
        label: String(section?.label || 'Queue').trim() || 'Queue',
        accentClass: 'text-cyan-200',
        chipClass: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
    };
    return {
        key,
        label: String(section?.label || meta.label).trim() || meta.label,
        accentClass: meta.accentClass,
        chipClass: meta.chipClass,
        items: (Array.isArray(section?.items) ? section.items : [])
            .slice(0, maxItems)
            .map((item, index) => toQueueDeckItem(item, index)),
    };
};

function FlowItems({ title = '', items = [], tone = 'queue', actionLabel = '', onAction = null }) {
    const titleClass = tone === 'beat' ? 'text-fuchsia-200' : 'text-cyan-200';
    const chipClass = tone === 'beat' ? 'border-fuchsia-300/20 text-fuchsia-100' : 'border-cyan-300/20 text-cyan-100';
    return (
        <div className="rounded-[24px] border border-white/10 bg-black/18 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
                <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${titleClass}`}>{title}</div>
                {actionLabel && typeof onAction === 'function' ? (
                    <button
                        type="button"
                        onClick={onAction}
                        className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-100 transition hover:border-white/25"
                    >
                        {actionLabel}
                    </button>
                ) : null}
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
                {items.length ? items.map((item, index) => (
                    <button
                        key={item.id || `${item.title}-${index}`}
                        type="button"
                        onClick={onAction || undefined}
                        className="flex min-w-[220px] items-start gap-3 rounded-[20px] border border-white/10 bg-black/22 px-3 py-3 text-left transition hover:border-white/25"
                    >
                        <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${chipClass}`}>
                            {index === 0 ? 'Next' : `+${index}`}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-black text-white">{item.title}</span>
                            <span className="mt-1 block truncate text-[12px] text-zinc-300">{item.subtitle || item.detail || item.reason}</span>
                        </span>
                    </button>
                )) : (
                    <div className="rounded-[20px] border border-white/10 bg-black/22 px-3 py-3 text-[12px] text-zinc-400">
                        Nothing staged.
                    </div>
                )}
            </div>
        </div>
    );
}

function CommandButton({ label = '', onClick = null, tone = 'neutral', disabled = false, icon = '' }) {
    const toneClass = tone === 'primary'
        ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100'
        : tone === 'accent'
            ? 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100'
            : tone === 'danger'
                ? 'border-rose-300/30 bg-rose-500/10 text-rose-100'
                : tone === 'success'
                    ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-white/10 bg-black/20 text-zinc-100';
    return (
        <button
            type="button"
            onClick={onClick || undefined}
            disabled={disabled}
            className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] border px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition ${toneClass} ${disabled ? 'cursor-not-allowed opacity-45' : 'hover:border-white/30'}`}
        >
            {icon ? <i className={`fa-solid ${icon}`}></i> : null}
            {label}
        </button>
    );
}

function QueueDeck({
    sections = [],
    attentionCount = 0,
    onOpenQueue = null,
    onOpenAdd = null,
    onOpenInbox = null,
    onOpenPlanner = null,
    onStartNextPerformance = null,
}) {
    const visibleSections = Array.isArray(sections) ? sections.filter((section) => Array.isArray(section?.items) && section.items.length) : [];
    const allItems = visibleSections.flatMap((section) => section.items);
    const onDeck = allItems[0] || null;
    const counts = {
        total: allItems.length,
        ready: visibleSections.find((section) => section.key === 'ready')?.items.length || 0,
        review: visibleSections.find((section) => section.key === 'review')?.items.length || 0,
        assigned: visibleSections.find((section) => section.key === 'assigned')?.items.length || 0,
        held: visibleSections.find((section) => section.key === 'held')?.items.length || 0,
    };
    const summaryChips = [
        counts.ready > 0 ? { key: 'ready', label: `Ready ${counts.ready}`, className: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100' } : null,
        counts.review > 0 ? { key: 'review', label: `Review ${counts.review}`, className: 'border-amber-300/25 bg-amber-500/10 text-amber-100' } : null,
        counts.assigned > 0 ? { key: 'assigned', label: `Assigned ${counts.assigned}`, className: 'border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100' } : null,
        counts.held > 0 ? { key: 'held', label: `Held ${counts.held}`, className: 'border-white/10 bg-white/5 text-zinc-200' } : null,
        attentionCount > 0 ? { key: 'attention', label: `Needs Attention ${attentionCount}`, className: 'border-rose-300/25 bg-rose-500/10 text-rose-100' } : null,
    ].filter(Boolean);

    return (
        <div className="grid min-h-[42rem] grid-rows-[auto_auto_minmax(0,1fr)] gap-4 rounded-[28px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(5,20,28,0.86),rgba(5,8,14,0.96))] px-4 py-4 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Queue Command Deck</div>
                    <div className="mt-2 flex items-end gap-3">
                        <div className="text-[34px] font-black leading-none text-white">{counts.total}</div>
                        <div className="pb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-400">Upcoming in view</div>
                    </div>
                    {summaryChips.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.15em]">
                            {summaryChips.map((chip) => (
                                <span key={chip.key} className={`rounded-full border px-2.5 py-1 ${chip.className}`}>
                                    {chip.label}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <CommandButton label="Queue" icon="fa-list-check" onClick={onOpenQueue} tone="primary" />
                    <CommandButton label="Add" icon="fa-plus" onClick={onOpenAdd} tone="neutral" />
                    <CommandButton label="Inbox" icon="fa-inbox" onClick={onOpenInbox} tone="neutral" />
                    <CommandButton label={HOST_LIVE_OPS_LANGUAGE.showPlan} icon="fa-clapperboard" onClick={onOpenPlanner} tone="accent" />
                </div>
            </div>

            <div className="rounded-[22px] border border-cyan-300/18 bg-cyan-500/[0.06] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">On Deck</div>
                        <div className="mt-1 text-[19px] font-black text-white">{onDeck?.singer || 'Nobody queued'}</div>
                        <div className="text-[13px] text-zinc-200">{onDeck?.song || 'Add a performer or promote a beat.'}</div>
                    </div>
                    <div className="min-w-[170px]">
                        <CommandButton
                            label="Start Next"
                            icon="fa-play"
                            onClick={onStartNextPerformance}
                            disabled={!onDeck}
                            tone="success"
                        />
                    </div>
                </div>
            </div>

            <div className="min-h-0 overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
                <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
                    <div className="border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                        Live order
                    </div>
                    <div className="min-h-0 overflow-y-auto px-3 py-3 custom-scrollbar">
                        {visibleSections.length ? (
                            <div className="space-y-4">
                                {visibleSections.map((section) => (
                                    <div key={section.key}>
                                        <div className="mb-2 flex items-center gap-2">
                                            <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${section.accentClass}`}>{section.label}</div>
                                            <div className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${section.chipClass}`}>
                                                {section.items.length}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {section.items.map((item, index) => (
                                                <button
                                                    key={`${section.key}-${item.id}`}
                                                    type="button"
                                                    onClick={section.key === 'ready' && index === 0 ? onStartNextPerformance || undefined : onOpenQueue || undefined}
                                                    className="grid w-full grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] border border-white/10 bg-black/22 px-3 py-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-500/6"
                                                >
                                                    <div className={`rounded-[14px] border px-2 py-2 text-center text-[9px] font-black uppercase tracking-[0.14em] ${section.chipClass}`}>
                                                        {section.key === 'ready' && index === 0 ? 'Next' : item.priorityLabel}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-[15px] font-black text-white">{item.singer}</div>
                                                        <div className="truncate text-[12px] text-zinc-200">{item.song}</div>
                                                        {item.artist ? <div className="truncate text-[10px] uppercase tracking-[0.16em] text-zinc-500">{item.artist}</div> : null}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        {item.statusLabel ? (
                                                            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                                                {item.statusLabel}
                                                            </span>
                                                        ) : null}
                                                        {item.sourceLabel ? (
                                                            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
                                                                {item.sourceLabel}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-[18px] border border-white/10 bg-black/22 px-3 py-3 text-[13px] text-zinc-400">
                                No queue visible yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function HostNightPilotPrototype({
    runtimeModel = {},
    room = null,
    roomCode = '',
    queueItems = [],
    queueSections = [],
    styles = {},
    customBonus = '',
    onCustomBonusChange = null,
    onTogglePlay = null,
    onRestartPlayback = null,
    onOpenBackingWindow = null,
    onEndPerformance = null,
    onStartApplause = null,
    onReturnCurrentToQueue = null,
    onAddBonusToCurrent = null,
    onEditCurrentPerformance = null,
    onToggleAudienceSync = null,
    audienceSyncActive = false,
    audienceSyncDisabled = false,
    onApproveCurrentAudienceBacking = null,
    onAvoidCurrentAudienceBacking = null,
    onRateCurrentBackingUp = null,
    onRateCurrentBackingDown = null,
    onOpenQueue = null,
    onOpenAdd = null,
    onOpenInbox = null,
    onOpenPlanner = null,
    onOpenSceneLibrary = null,
    onStartNextPerformance = null,
    onExitPrototype = null,
}) {
    const runtimeTheme = buildHostRuntimeShellTheme(room);
    const brandTheme = runtimeTheme.theme;
    const currentPerformance = runtimeModel?.currentPerformance || null;
    const nextPerformance = runtimeModel?.nextPerformance || null;
    const focusObject = currentPerformance || nextPerformance || null;
    const queueDeckSections = (Array.isArray(queueSections) && queueSections.length
        ? queueSections.map((section, index) => toQueueSection(section, `section_${index}`, 8))
        : [
            toQueueSection({ key: 'ready', items: Array.isArray(queueItems) && queueItems.length ? queueItems : (runtimeModel?.queuePreview || runtimeModel?.rotationFlow || []) }, 'ready', 10),
        ]).filter((section) => section.items.length);
    const beatItems = (runtimeModel?.showBeatFlow || []).slice(0, 4);
    const attentionItems = (runtimeModel?.attentionItems || []).slice(0, 3);
    const trackCheckState = runtimeModel?.trackCheckState || {};
    const hasTrackCheckAction = trackCheckState?.hasPendingPrompt || trackCheckState?.deferredCount > 0;
    const currentMediaUrl = String(currentPerformance?.raw?.mediaUrl || '').trim();
    const currentHasYouTubeBacking = /youtu\.?be|youtube\.com/i.test(currentMediaUrl);
    const currentAudienceSelectedUnverified = isAudienceSelectedUnverifiedResolution(currentPerformance?.raw?.resolutionStatus);
    const parsedCustomBonus = Number.parseInt(customBonus, 10);
    const safeCustomBonus = Number.isFinite(parsedCustomBonus) ? parsedCustomBonus : 0;
    const primaryColor = String(brandTheme?.primaryColor || '#00C4D9').trim() || '#00C4D9';
    const secondaryColor = String(brandTheme?.secondaryColor || '#FF67B6').trim() || '#FF67B6';
    const accentColor = String(brandTheme?.accentColor || '#FACC15').trim() || '#FACC15';

    const ringActions = currentPerformance ? [
        {
            id: 'end-song',
            label: 'End Song',
            icon: 'fa-stop',
            onClick: () => onEndPerformance?.(currentPerformance.raw?.id),
            toneClass: 'border-rose-300/35 bg-rose-500/12 text-rose-100 hover:border-rose-200/55',
        },
        {
            id: 'applause',
            label: 'Applause',
            icon: 'fa-hands-clapping',
            onClick: () => onStartApplause?.(),
            toneClass: 'border-amber-300/35 bg-amber-500/12 text-amber-100 hover:border-amber-200/55',
        },
        {
            id: 'track-check',
            label: 'Track Check',
            icon: 'fa-clipboard-check',
            onClick: () => onOpenInbox?.(),
            disabled: !hasTrackCheckAction,
            toneClass: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/55',
        },
        {
            id: 'return',
            label: 'Return',
            icon: 'fa-rotate-left',
            onClick: () => onReturnCurrentToQueue?.(currentPerformance.raw?.id),
        },
    ] : [
        {
            id: 'start-next',
            label: 'Start Next',
            icon: 'fa-play',
            onClick: () => onStartNextPerformance?.(),
            disabled: !nextPerformance,
            toneClass: 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100 hover:border-emerald-200/55',
        },
    ];

    return (
        <div
            data-host-night-pilot="true"
            className="min-h-screen w-full overflow-hidden bg-[#05070c] text-white font-saira"
            style={{
                backgroundImage: [
                    `radial-gradient(circle at 10% 8%, ${withAudienceBrandAlpha(primaryColor, 0.16)}, transparent 24%)`,
                    `radial-gradient(circle at 92% 10%, ${withAudienceBrandAlpha(secondaryColor, 0.14)}, transparent 24%)`,
                    `radial-gradient(circle at 56% 100%, ${withAudienceBrandAlpha(accentColor, 0.09)}, transparent 30%)`,
                    'linear-gradient(180deg, #04070b 0%, #080b12 100%)',
                ].join(', '),
            }}
        >
            <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 py-5">
                <div className="flex items-center justify-between gap-4 pb-4">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: primaryColor }}>Night Pilot</div>
                        <div className="mt-1 flex items-center gap-2 text-[15px] font-black text-white">
                            <span>{String(brandTheme?.appTitle || 'BeauRocks Karaoke').trim() || 'BeauRocks Karaoke'}</span>
                            {roomCode ? (
                                <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-200">
                                    {roomCode}
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <CommandButton label="Queue" icon="fa-list-check" onClick={onOpenQueue} tone="neutral" />
                        <CommandButton label="Add" icon="fa-plus" onClick={onOpenAdd} tone="neutral" />
                        <CommandButton label="Inbox" icon="fa-inbox" onClick={onOpenInbox} tone="neutral" />
                        <CommandButton label={HOST_LIVE_OPS_LANGUAGE.showPlan} icon="fa-clapperboard" onClick={onOpenPlanner} tone="neutral" />
                        <CommandButton label="Classic" icon="fa-arrow-left" onClick={onExitPrototype} tone="accent" />
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(460px,0.95fr)_minmax(0,1.25fr)]">
                    <div className="space-y-4">
                        <div className="min-h-0 overflow-hidden rounded-[30px] border border-white/10 bg-black/20 p-4">
                            <QueueDeck
                                sections={queueDeckSections}
                                attentionCount={attentionItems.length}
                                onOpenQueue={onOpenQueue}
                                onOpenAdd={onOpenAdd}
                                onOpenInbox={onOpenInbox}
                                onOpenPlanner={onOpenPlanner}
                                onStartNextPerformance={onStartNextPerformance}
                            />
                        </div>
                        <FlowItems
                            title="Show Beats"
                            items={beatItems}
                            tone="beat"
                            actionLabel={HOST_LIVE_OPS_LANGUAGE.showPlan}
                            onAction={onOpenPlanner}
                        />
                    </div>

                    <div className="min-h-0 overflow-hidden rounded-[30px] border border-white/10 bg-black/20 p-4">
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
                            <div className="min-h-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>Live Performance</div>
                                <div
                                    className="mt-3 overflow-hidden rounded-[28px] border"
                                    style={{
                                        borderColor: withAudienceBrandAlpha(primaryColor, 0.24),
                                        backgroundImage: `linear-gradient(180deg, ${withAudienceBrandAlpha(primaryColor, 0.08)}, rgba(5,10,18,0.88))`,
                                    }}
                                >
                                    <HostPerformerRing
                                        focusObject={focusObject}
                                        actions={ringActions}
                                        brandTheme={brandTheme}
                                        size="stage"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: accentColor }}>Backing Player</div>
                                    <div className="mt-3">
                                        <HostPlaybackDock
                                            playback={runtimeModel?.playback}
                                            onTogglePlay={onTogglePlay}
                                            onRestartPlayback={onRestartPlayback}
                                            onOpenBackingWindow={onOpenBackingWindow}
                                            hasCurrentPerformance={!!currentPerformance}
                                            canOpenBackingWindow={!!currentMediaUrl}
                                            brandTheme={brandTheme}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-white/10 bg-black/18 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: secondaryColor }}>Command Rail</div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        <CommandButton label="Edit Current" icon="fa-pen" onClick={onEditCurrentPerformance} tone="neutral" />
                                        <CommandButton label={`Audience Sync ${audienceSyncActive ? 'On' : 'Off'}`} icon="fa-link" onClick={onToggleAudienceSync} disabled={audienceSyncDisabled} tone="primary" />
                                        <CommandButton label="Apply Bonus" icon="fa-sparkles" onClick={() => onAddBonusToCurrent?.(safeCustomBonus)} tone="accent" />
                                        <CommandButton label="Scenes" icon="fa-photo-film" onClick={onOpenSceneLibrary} tone="neutral" />
                                    </div>

                                    <div className="mt-3 grid gap-2">
                                        {attentionItems.length ? attentionItems.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={onOpenInbox}
                                                className="rounded-[18px] border border-rose-300/20 bg-rose-500/10 px-3 py-3 text-left transition hover:border-rose-200/40"
                                            >
                                                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-100">Needs Attention</div>
                                                <div className="mt-1 text-[14px] font-semibold text-white">{item.title}</div>
                                                <div className="text-[12px] text-zinc-300">{item.subtitle}</div>
                                            </button>
                                        )) : (
                                            <div className="rounded-[18px] border border-emerald-300/20 bg-emerald-500/10 px-3 py-3 text-[13px] font-semibold text-emerald-100">
                                                No active blockers.
                                            </div>
                                        )}
                                    </div>

                                    {currentPerformance ? (
                                        <div className="mt-3 space-y-3">
                                            {currentHasYouTubeBacking && currentAudienceSelectedUnverified ? (
                                                <div className="rounded-[18px] border border-cyan-300/20 bg-cyan-500/10 px-3 py-3">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Guest Track</div>
                                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                        <CommandButton label="Works" icon="fa-thumbs-up" onClick={onApproveCurrentAudienceBacking} tone="success" />
                                                        <CommandButton label="Bad Track" icon="fa-thumbs-down" onClick={onAvoidCurrentAudienceBacking} tone="danger" />
                                                    </div>
                                                </div>
                                            ) : currentHasYouTubeBacking ? (
                                                <div className="rounded-[18px] border border-white/10 bg-black/22 px-3 py-3">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">Backing Verdict</div>
                                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                        <CommandButton label="Use Again" icon="fa-arrow-up" onClick={onRateCurrentBackingUp} tone="success" />
                                                        <CommandButton label="Skip" icon="fa-arrow-down" onClick={onRateCurrentBackingDown} tone="danger" />
                                                    </div>
                                                </div>
                                            ) : null}

                                            <div className="rounded-[18px] border border-white/10 bg-black/22 px-3 py-3">
                                                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-100">Custom Bonus</div>
                                                <input
                                                    type="number"
                                                    value={customBonus}
                                                    onChange={(event) => onCustomBonusChange?.(event.target.value)}
                                                    className={`${styles?.input || ''} mt-3 w-full`}
                                                    placeholder="Pts"
                                                />
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
