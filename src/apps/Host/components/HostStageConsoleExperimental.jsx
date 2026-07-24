import React, { useState } from 'react';
import HostCandidatePool from './HostCandidatePool';
import HostPerformerRing from './HostPerformerRing';
import HostPlaybackDock from './HostPlaybackDock';
import HostRotationLane from './HostRotationLane';
import { isAudienceSelectedUnverifiedResolution } from '../../../lib/requestModes';
import buildHostRuntimeShellTheme from '../lib/hostRuntimeShellTheme';
import { withAudienceBrandAlpha } from '../../../lib/audienceBrandTheme';

const toneClassByAttention = {
    danger: 'border-rose-300/30 bg-rose-500/12 text-rose-100',
    warning: 'border-amber-300/30 bg-amber-500/12 text-amber-100',
    info: 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100',
};

const deckButtonClass = 'inline-flex min-h-[40px] items-center justify-center rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition';

function CompactLane({
    title = '',
    items = [],
    emptyLabel = '',
    onAction = null,
    actions = [],
    tone = 'primary',
}) {
    const accentClass = tone === 'accent' ? 'text-amber-200' : tone === 'secondary' ? 'text-fuchsia-200' : 'text-cyan-200';
    return (
        <div className="rounded-[22px] border border-white/10 bg-black/18 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${accentClass}`}>{title}</div>
                {actions.length ? (
                    <div className="flex items-center gap-1.5">
                        {actions.slice(0, 2).map((action) => (
                            <button
                                key={action.id || action.label}
                                type="button"
                                onClick={typeof action.onClick === 'function' ? action.onClick : undefined}
                                className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-cyan-300/30 hover:bg-cyan-500/8"
                            >
                                {action.icon ? <i className={`fa-solid ${action.icon} mr-1`}></i> : null}
                                {action.label}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="mt-2 grid gap-1.5">
                {items.length ? items.map((item, index) => (
                    <button
                        key={item.id || `${item.title}-${index}`}
                        type="button"
                        onClick={onAction || undefined}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-cyan-300/30 hover:bg-cyan-500/8"
                    >
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300">
                                {index === 0 ? 'Next' : `+${index}`}
                            </span>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-black text-white">{item.title}</div>
                                <div className="truncate text-[11px] text-zinc-400">{item.subtitle || item.detail || item.reason}</div>
                            </div>
                        </div>
                        {item.statusLabel ? (
                            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300">
                                {item.statusLabel}
                            </span>
                        ) : null}
                    </button>
                )) : (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] font-semibold text-zinc-400">
                        {emptyLabel}
                    </div>
                )}
            </div>
        </div>
    );
}

function FlowRail({
    queueItems = [],
    beatItems = [],
    onOpenQueue = null,
    onOpenAdd = null,
    onOpenPlanner = null,
    onOpenSceneLibrary = null,
    compact = false,
}) {
    const renderPill = (item, index, tone = 'queue') => (
        <button
            key={`${tone}-${item.id || index}`}
            type="button"
            onClick={tone === 'queue' ? onOpenQueue : onOpenPlanner}
            className="flex min-w-[190px] items-center gap-3 rounded-[18px] border border-white/10 bg-black/22 px-3 py-2.5 text-left transition hover:border-cyan-300/30 hover:bg-cyan-500/8"
        >
            <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${tone === 'queue' ? 'border-cyan-300/20 text-cyan-100' : 'border-fuchsia-300/20 text-fuchsia-100'}`}>
                {index === 0 ? 'Next' : `+${index}`}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-white">{item.title}</span>
                <span className="block truncate text-[11px] text-zinc-400">{item.subtitle || item.detail || item.reason}</span>
            </span>
            {item.statusLabel ? (
                <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300">
                    {item.statusLabel}
                </span>
            ) : null}
        </button>
    );

    return (
        <div className={`${compact ? 'mt-3 grid gap-3' : 'mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]'}`}>
            <div className="rounded-[22px] border border-white/10 bg-black/18 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Tonight Flow</div>
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={onOpenQueue} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-cyan-300/30 hover:bg-cyan-500/8">
                            <i className="fa-solid fa-list-check mr-1"></i>Queue
                        </button>
                        <button type="button" onClick={onOpenAdd} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-cyan-300/30 hover:bg-cyan-500/8">
                            <i className="fa-solid fa-plus mr-1"></i>Add
                        </button>
                    </div>
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {queueItems.length ? queueItems.map((item, index) => renderPill(item, index, 'queue')) : (
                        <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] font-semibold text-zinc-400">Queue is quiet.</div>
                    )}
                </div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-black/18 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200">Show Beats</div>
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={onOpenPlanner} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-fuchsia-300/30 hover:bg-fuchsia-500/8">
                            <i className="fa-solid fa-clapperboard mr-1"></i>Planner
                        </button>
                        <button type="button" onClick={onOpenSceneLibrary} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-fuchsia-300/30 hover:bg-fuchsia-500/8">
                            <i className="fa-solid fa-photo-film mr-1"></i>Scenes
                        </button>
                    </div>
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {beatItems.length ? beatItems.map((item, index) => renderPill(item, index, 'beat')) : (
                        <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] font-semibold text-zinc-400">No beats staged.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PerformanceSatellite({
    title = '',
    value = '',
    helper = '',
    tone = 'neutral',
    icon = '',
    className = '',
    brandTheme = null,
}) {
    const primaryColor = String(brandTheme?.primaryColor || '#00C4D9').trim() || '#00C4D9';
    const secondaryColor = String(brandTheme?.secondaryColor || '#FF67B6').trim() || '#FF67B6';
    const accentColor = String(brandTheme?.accentColor || '#FACC15').trim() || '#FACC15';
    const toneMap = {
        neutral: {
            border: withAudienceBrandAlpha(primaryColor, 0.18),
            wash: withAudienceBrandAlpha(primaryColor, 0.06),
            title: primaryColor,
        },
        secondary: {
            border: withAudienceBrandAlpha(secondaryColor, 0.2),
            wash: withAudienceBrandAlpha(secondaryColor, 0.08),
            title: secondaryColor,
        },
        accent: {
            border: withAudienceBrandAlpha(accentColor, 0.22),
            wash: withAudienceBrandAlpha(accentColor, 0.08),
            title: accentColor,
        },
        warning: {
            border: 'rgba(251, 191, 36, 0.24)',
            wash: 'rgba(251, 191, 36, 0.08)',
            title: '#FDE68A',
        },
    };
    const palette = toneMap[tone] || toneMap.neutral;

    return (
        <div
            className={`absolute z-20 w-[150px] rounded-[18px] border px-3 py-2.5 shadow-[0_18px_34px_rgba(0,0,0,0.24)] backdrop-blur-md ${className}`}
            style={{
                borderColor: palette.border,
                backgroundImage: `linear-gradient(160deg, ${palette.wash}, rgba(5,8,14,0.92))`,
            }}
        >
            <div className="flex items-center gap-2">
                {icon ? <i className={`fa-solid ${icon} text-[10px] text-white/70`}></i> : null}
                <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: palette.title }}>
                    {title}
                </div>
            </div>
            <div className="mt-1 truncate text-sm font-black text-white">{value}</div>
            {helper ? <div className="mt-1 text-[10px] leading-4 text-zinc-400">{helper}</div> : null}
        </div>
    );
}

export default function HostStageConsoleExperimental({
    runtimeModel = {},
    room = null,
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
    onApproveCurrentAudienceBacking = null,
    onAvoidCurrentAudienceBacking = null,
    onRateCurrentBackingUp = null,
    onRateCurrentBackingDown = null,
    onToggleAudienceSync = null,
    audienceSyncActive = false,
    audienceSyncDisabled = false,
    onOpenQueue = null,
    onOpenAdd = null,
    onOpenInbox = null,
    onOpenPlanner = null,
    onOpenSceneLibrary = null,
    onStartNextPerformance = null,
    workspacePanel = null,
    utilityPanel = null,
}) {
    const runtimeTheme = buildHostRuntimeShellTheme(room);
    const brandTheme = runtimeTheme.theme;
    const brandTitle = String(brandTheme?.appTitle || 'BeauRocks Karaoke').trim() || 'BeauRocks Karaoke';
    const currentPerformance = runtimeModel?.currentPerformance || null;
    const nextPerformance = runtimeModel?.nextPerformance || null;
    const focusObject = currentPerformance || nextPerformance || null;
    const hasTrackCheckAction = runtimeModel?.trackCheckState?.hasPendingPrompt || runtimeModel?.trackCheckState?.deferredCount > 0;
    const candidateGroups = runtimeModel?.candidateGroups || [];
    const parsedCustomBonus = Number.parseInt(customBonus, 10);
    const safeCustomBonus = Number.isFinite(parsedCustomBonus) ? parsedCustomBonus : 0;
    const currentMediaUrl = String(currentPerformance?.raw?.mediaUrl || '').trim();
    const currentHasYouTubeBacking = /youtu\.?be|youtube\.com/i.test(currentMediaUrl);
    const currentAudienceSelectedUnverified = isAudienceSelectedUnverifiedResolution(currentPerformance?.raw?.resolutionStatus);
    const attentionItems = runtimeModel?.attentionItems || [];
    const [supportView, setSupportView] = useState('collapsed');
    const workspaceFocusActive = supportView === 'workspace' && !!workspacePanel;
    const openQueueWorkspace = () => {
        onOpenQueue?.();
        setSupportView('workspace');
    };
    const openAddWorkspace = () => {
        onOpenAdd?.();
        setSupportView('workspace');
    };
    const openInboxWorkspace = () => {
        onOpenInbox?.();
        setSupportView('workspace');
    };
    const openPlannerWorkspace = () => {
        onOpenPlanner?.();
        setSupportView('workspace');
    };
    const visibleRotationItems = (runtimeModel?.queuePreview || runtimeModel?.rotationFlow || []).slice(0, 3);
    const visibleShowBeatItems = (runtimeModel?.showBeatFlow || []).slice(0, 3);
    const primaryColor = String(brandTheme?.primaryColor || '#00C4D9').trim() || '#00C4D9';
    const secondaryColor = String(brandTheme?.secondaryColor || '#FF67B6').trim() || '#FF67B6';
    const accentColor = String(brandTheme?.accentColor || '#FACC15').trim() || '#FACC15';
    const shellFrameStyle = {
        ...runtimeTheme.shellStyle,
        backgroundImage: [
            `radial-gradient(circle at 8% 14%, ${withAudienceBrandAlpha(primaryColor, 0.18)}, transparent 24%)`,
            `radial-gradient(circle at 88% 12%, ${withAudienceBrandAlpha(secondaryColor, 0.18)}, transparent 28%)`,
            `radial-gradient(circle at 52% 100%, ${withAudienceBrandAlpha(accentColor, 0.12)}, transparent 36%)`,
            runtimeTheme.shellStyle?.backgroundImage,
        ].filter(Boolean).join(', '),
        boxShadow: `0 32px 90px ${withAudienceBrandAlpha(primaryColor, 0.14)}`,
    };
    const heroStageStyle = {
        ...runtimeTheme.panelStyle,
        backgroundImage: `linear-gradient(145deg, ${withAudienceBrandAlpha('#070b12', 0.92)}, ${withAudienceBrandAlpha(secondaryColor, 0.08)})`,
        boxShadow: `inset 0 1px 0 ${withAudienceBrandAlpha('#ffffff', 0.08)}, 0 20px 60px ${withAudienceBrandAlpha(primaryColor, 0.12)}`,
    };
    const emphasizedCardStyle = {
        ...runtimeTheme.primaryCardStyle,
        backgroundImage: `linear-gradient(160deg, ${withAudienceBrandAlpha(secondaryColor, 0.08)}, ${withAudienceBrandAlpha('#06080f', 0.84)})`,
        boxShadow: `inset 0 1px 0 ${withAudienceBrandAlpha('#ffffff', 0.06)}, 0 16px 40px ${withAudienceBrandAlpha(secondaryColor, 0.12)}`,
    };
    const utilityCardStyle = {
        ...runtimeTheme.secondaryCardStyle,
        backgroundImage: `linear-gradient(160deg, ${withAudienceBrandAlpha(primaryColor, 0.08)}, ${withAudienceBrandAlpha('#06080f', 0.86)})`,
        boxShadow: `inset 0 1px 0 ${withAudienceBrandAlpha('#ffffff', 0.05)}, 0 16px 40px ${withAudienceBrandAlpha(primaryColor, 0.1)}`,
    };
    const accentRailStyle = {
        ...runtimeTheme.accentCardStyle,
        backgroundImage: `linear-gradient(160deg, ${withAudienceBrandAlpha(accentColor, 0.1)}, ${withAudienceBrandAlpha('#06080f', 0.88)})`,
        boxShadow: `inset 0 1px 0 ${withAudienceBrandAlpha('#ffffff', 0.05)}, 0 16px 40px ${withAudienceBrandAlpha(accentColor, 0.08)}`,
    };
    const performanceSatellites = currentPerformance ? [
        {
            id: 'performer',
            title: 'Singer',
            value: currentPerformance.title || 'Guest',
            helper: currentPerformance.subtitle || '',
            tone: 'secondary',
            icon: 'fa-user-microphone',
            className: 'left-4 top-4',
        },
        {
            id: 'source',
            title: 'Source',
            value: currentPerformance.sourceLabel || 'Unknown',
            helper: currentAudienceSelectedUnverified ? 'Guest track' : '',
            tone: currentAudienceSelectedUnverified ? 'warning' : 'neutral',
            icon: currentPerformance.sourceLabel?.toLowerCase() === 'youtube' ? 'fa-youtube' : 'fa-compact-disc',
            className: 'right-4 top-4',
        },
        {
            id: 'crowd',
            title: 'Crowd',
            value: room?.applausePeak !== undefined && room?.applausePeak !== null ? `${Math.round(room.applausePeak)} dB` : (audienceSyncActive ? 'Synced' : 'Ready'),
            helper: '',
            tone: 'accent',
            icon: 'fa-hands-clapping',
            className: 'left-4 bottom-4',
        },
        {
            id: 'follow-up',
            title: 'Follow Up',
            value: hasTrackCheckAction ? 'Track check' : currentHasYouTubeBacking ? 'Backing verdict' : 'No blocker',
            helper: hasTrackCheckAction
                ? `${runtimeModel?.trackCheckState?.deferredCount || 0} deferred`
                : currentHasYouTubeBacking
                    ? 'Save verdict'
                    : '',
            tone: hasTrackCheckAction ? 'warning' : 'neutral',
            icon: hasTrackCheckAction ? 'fa-clipboard-check' : 'fa-waveform-lines',
            className: 'right-4 bottom-4',
        },
    ] : [];

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
        {
            id: 'queue',
            label: 'Queue',
            icon: 'fa-list-check',
            onClick: openQueueWorkspace,
        },
        {
            id: 'add',
            label: 'Add',
            icon: 'fa-plus',
            onClick: openAddWorkspace,
        },
        {
            id: 'inbox',
            label: 'Inbox',
            icon: 'fa-inbox',
            onClick: openInboxWorkspace,
        },
        {
            id: 'planner',
            label: 'Planner',
            icon: 'fa-clapperboard',
            onClick: openPlannerWorkspace,
        },
        {
            id: 'scenes',
            label: 'Scenes',
            icon: 'fa-tv',
            onClick: () => onOpenSceneLibrary?.(),
        },
    ];

    return (
        <div className="flex-1 min-h-0 overflow-hidden">
            <div
                className="flex h-full min-h-0 flex-col gap-4 overflow-hidden"
                data-host-runtime-brand-title={brandTitle}
                data-host-runtime-brand-primary={brandTheme.primaryColor}
                data-host-runtime-brand-secondary={brandTheme.secondaryColor}
                data-host-runtime-brand-accent={brandTheme.accentColor}
            >
                <section
                    className={`${workspaceFocusActive ? 'hidden' : 'relative min-h-0 overflow-hidden rounded-[32px] border'}`}
                    style={shellFrameStyle}
                >
                    <div
                        className="pointer-events-none absolute left-[-8%] top-[-12%] h-64 w-64 rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${withAudienceBrandAlpha(primaryColor, 0.2)} 0%, transparent 70%)` }}
                    />
                    <div
                        className="pointer-events-none absolute bottom-[-16%] right-[-4%] h-72 w-72 rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${withAudienceBrandAlpha(secondaryColor, 0.18)} 0%, transparent 72%)` }}
                    />
                    <div
                        className="pointer-events-none absolute inset-x-10 top-0 h-px"
                        style={{ background: `linear-gradient(90deg, transparent, ${withAudienceBrandAlpha('#ffffff', 0.3)}, transparent)` }}
                    />
                    <div className="flex h-full min-h-0 flex-col overflow-hidden">
                        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 custom-scrollbar lg:px-5">
                            <div className="grid gap-4">
                                <div className="rounded-[28px] border p-3.5 lg:p-4" style={heroStageStyle}>
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <div className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: secondaryColor }}>
                                            {currentPerformance ? 'Live' : 'Stage'}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {runtimeModel?.roomControlsSummary?.autoDj ? (
                                                <span className="rounded-full border bg-black/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]" style={runtimeTheme.primaryChipStyle}>
                                                    Auto DJ
                                                </span>
                                            ) : null}
                                            {runtimeModel?.roomControlsSummary?.readyCheckActive ? (
                                                <span className="rounded-full border bg-black/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]" style={runtimeTheme.accentChipStyle}>
                                                    Ready Check
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
                                        <div>
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>
                                                    Live Performance
                                                </div>
                                            </div>
                                            <div
                                                className="relative overflow-hidden rounded-[26px] border bg-black/20"
                                                style={{
                                                    borderColor: withAudienceBrandAlpha(primaryColor, 0.24),
                                                    backgroundImage: `linear-gradient(180deg, ${withAudienceBrandAlpha(primaryColor, 0.1)}, ${withAudienceBrandAlpha('#06111a', 0.9)})`,
                                                    boxShadow: `0 20px 44px ${withAudienceBrandAlpha(primaryColor, 0.1)}`,
                                                }}
                                                >
                                                    <div
                                                        className="pointer-events-none absolute inset-x-12 top-0 h-px"
                                                        style={{ background: `linear-gradient(90deg, transparent, ${withAudienceBrandAlpha('#ffffff', 0.22)}, transparent)` }}
                                                    />
                                                    {performanceSatellites.map((satellite) => (
                                                        <PerformanceSatellite
                                                            key={satellite.id}
                                                            title={satellite.title}
                                                            value={satellite.value}
                                                            helper={satellite.helper}
                                                            tone={satellite.tone}
                                                            icon={satellite.icon}
                                                            className={satellite.className}
                                                            brandTheme={brandTheme}
                                                        />
                                                    ))}
                                                    <HostPerformerRing
                                                        focusObject={focusObject}
                                                        actions={ringActions}
                                                        brandTheme={brandTheme}
                                                        size="stage"
                                                    />
                                            </div>
                                            <FlowRail
                                                queueItems={visibleRotationItems}
                                                beatItems={visibleShowBeatItems}
                                                onOpenQueue={openQueueWorkspace}
                                                onOpenAdd={openAddWorkspace}
                                                onOpenPlanner={openPlannerWorkspace}
                                                onOpenSceneLibrary={onOpenSceneLibrary}
                                                compact
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accentColor }}>
                                                        Backing
                                                    </div>
                                                </div>
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

                                            <div className="rounded-[30px] border p-4" style={utilityCardStyle}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: secondaryColor }}>Queue + Next</div>
                                                </div>
                                                {room?.applausePeak !== undefined && room?.applausePeak !== null ? (
                                                    <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-100">
                                                        Applause {Math.round(room.applausePeak)} dB
                                                    </span>
                                                ) : null}
                                            </div>

                                                <div className="mt-4 rounded-[24px] border px-4 py-4" style={emphasizedCardStyle}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>Next</div>
                                                        <div className="mt-2 truncate text-xl font-black text-white">{nextPerformance?.title || 'Nothing committed yet'}</div>
                                                        {nextPerformance?.subtitle ? (
                                                            <div className="truncate text-sm text-zinc-300">{nextPerformance.subtitle}</div>
                                                        ) : null}
                                                    </div>
                                                    {nextPerformance?.statusLabel ? (
                                                        <span className="rounded-full border bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]" style={runtimeTheme.primaryChipStyle}>
                                                            {nextPerformance.statusLabel}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {nextPerformance?.sourceLabel ? (
                                                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                                            {nextPerformance.sourceLabel}
                                                        </span>
                                                    ) : null}
                                                    {nextPerformance?.reason ? (
                                                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300">
                                                            {nextPerformance.reason}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-3 grid gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={onStartNextPerformance}
                                                        disabled={!nextPerformance}
                                                        className={`${styles?.btnStd || ''} border-emerald-300/35 bg-emerald-500/12 px-3 py-2 text-[11px] text-emerald-100 hover:border-emerald-200/55 ${!nextPerformance ? 'cursor-not-allowed opacity-45' : ''}`}
                                                    >
                                                        Start Next
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-3 rounded-[24px] border px-4 py-4" style={accentRailStyle}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-200">Intervention Lane</div>
                                                    <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                                        {attentionItems.length} active
                                                    </span>
                                                </div>
                                                <div className="mt-3 space-y-2">
                                                    {attentionItems.length > 0 ? attentionItems.slice(0, 2).map((item) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={openInboxWorkspace}
                                                            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${toneClassByAttention[item.tone] || 'border-white/10 bg-black/20 text-white'}`}
                                                        >
                                                            <div className="text-sm font-semibold text-white">{item.title}</div>
                                                        </button>
                                                    )) : (
                                                        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-3 text-sm font-semibold text-emerald-100">
                                                            Clear
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-3 rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
                                                <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: secondaryColor }}>
                                                    {currentPerformance ? 'Performance Actions' : 'Stage Prep'}
                                                </div>

                                                {currentPerformance ? (
                                                    <>
                                                        {currentHasYouTubeBacking && currentAudienceSelectedUnverified ? (
                                                            <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/8 px-3 py-3">
                                                                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Guest Track</div>
                                                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={onApproveCurrentAudienceBacking}
                                                                        className={`${styles?.btnStd || ''} border-emerald-300/35 bg-emerald-500/12 px-3 py-2 text-[11px] text-emerald-100 hover:border-emerald-200/55`}
                                                                    >
                                                                        Works
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={onAvoidCurrentAudienceBacking}
                                                                        className={`${styles?.btnStd || ''} border-rose-300/35 bg-rose-500/12 px-3 py-2 text-[11px] text-rose-100 hover:border-rose-200/55`}
                                                                    >
                                                                        Bad Track
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : currentHasYouTubeBacking ? (
                                                            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">Backing Note</div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={onRateCurrentBackingUp}
                                                                            className={`${styles?.btnStd || ''} border-emerald-300/35 bg-emerald-500/12 px-3 py-2 text-[11px] text-emerald-100 hover:border-emerald-200/55`}
                                                                        >
                                                                            Use Again
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={onRateCurrentBackingDown}
                                                                            className={`${styles?.btnStd || ''} border-rose-300/35 bg-rose-500/12 px-3 py-2 text-[11px] text-rose-100 hover:border-rose-200/55`}
                                                                        >
                                                                            Skip
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : null}

                                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                            <button
                                                                type="button"
                                                                onClick={onEditCurrentPerformance}
                                                                className={`${styles?.btnStd || ''} ${styles?.btnSecondary || ''} px-3 py-2 text-[11px]`}
                                                            >
                                                                Edit Current
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={onToggleAudienceSync}
                                                                disabled={audienceSyncDisabled}
                                                                className={`${styles?.btnStd || ''} ${audienceSyncActive ? styles?.btnHighlight || '' : styles?.btnNeutral || ''} px-3 py-2 text-[11px] ${audienceSyncDisabled ? 'cursor-not-allowed opacity-45' : ''}`}
                                                            >
                                                                Audience Sync {audienceSyncActive ? 'On' : 'Off'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => onAddBonusToCurrent?.(safeCustomBonus)}
                                                                className={`${styles?.btnStd || ''} border-fuchsia-300/35 bg-fuchsia-500/12 px-3 py-2 text-[11px] text-fuchsia-100 hover:border-fuchsia-200/55`}
                                                            >
                                                                Apply Bonus
                                                            </button>
                                                        </div>

                                                        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                                            <div className="min-w-0 flex-1">
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
                                                    </>
                                                ) : (
                                                    <div className="mt-3 grid gap-2">
                                                        <button type="button" onClick={openQueueWorkspace} className={`${deckButtonClass} bg-black/25 text-zinc-100`} style={{ borderColor: withAudienceBrandAlpha(primaryColor, 0.2) }}>
                                                            <i className="fa-solid fa-list-check"></i>
                                                            Queue
                                                        </button>
                                                        <button type="button" onClick={openAddWorkspace} className={`${deckButtonClass} bg-black/25 text-zinc-100`} style={{ borderColor: withAudienceBrandAlpha(secondaryColor, 0.2) }}>
                                                            <i className="fa-solid fa-plus"></i>
                                                            Add Singer
                                                        </button>
                                                        <button type="button" onClick={openInboxWorkspace} className={`${deckButtonClass} bg-black/25 text-zinc-100`} style={{ borderColor: withAudienceBrandAlpha(accentColor, 0.2) }}>
                                                            <i className="fa-solid fa-inbox"></i>
                                                            Review Inbox
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </section>

                <section
                    className={`${workspaceFocusActive ? 'flex flex-1 flex-col' : ''} min-h-0 overflow-hidden rounded-[22px] border`}
                    style={{
                        ...runtimeTheme.panelStyle,
                        backgroundImage: `linear-gradient(180deg, ${withAudienceBrandAlpha(primaryColor, 0.04)}, rgba(4,7,12,0.76))`,
                        boxShadow: `inset 0 1px 0 ${withAudienceBrandAlpha('#ffffff', 0.04)}, 0 10px 26px ${withAudienceBrandAlpha(primaryColor, 0.05)}`,
                    }}
                >
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>{workspaceFocusActive ? 'Host Workspace' : 'Support Lane'}</div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setSupportView(supportView === 'summary' ? 'collapsed' : 'summary')}
                                className={`${deckButtonClass} ${supportView === 'summary' ? 'text-cyan-100' : 'bg-black/25 text-zinc-300'}`}
                                style={supportView === 'summary' ? runtimeTheme.primaryChipStyle : { borderColor: withAudienceBrandAlpha(primaryColor, 0.18) }}
                            >
                                Summary
                            </button>
                            <button
                                type="button"
                                onClick={() => setSupportView(supportView === 'flow' ? 'collapsed' : 'flow')}
                                className={`${deckButtonClass} ${supportView === 'flow' ? 'text-fuchsia-100' : 'bg-black/25 text-zinc-300'}`}
                                style={supportView === 'flow' ? runtimeTheme.secondaryChipStyle : { borderColor: withAudienceBrandAlpha(secondaryColor, 0.18) }}
                            >
                                Tonight Flow
                            </button>
                            {workspacePanel ? (
                                <button
                                    type="button"
                                    onClick={() => setSupportView(supportView === 'workspace' ? 'collapsed' : 'workspace')}
                                    className={`${deckButtonClass} ${supportView === 'workspace' ? 'text-cyan-100' : 'bg-black/25 text-zinc-300'}`}
                                    style={supportView === 'workspace' ? runtimeTheme.primaryChipStyle : { borderColor: withAudienceBrandAlpha(primaryColor, 0.18) }}
                                >
                                    Workspace
                                </button>
                            ) : null}
                            {utilityPanel ? (
                                <button
                                    type="button"
                                    onClick={() => setSupportView(supportView === 'tools' ? 'collapsed' : 'tools')}
                                    className={`${deckButtonClass} ${supportView === 'tools' ? 'text-amber-100' : 'bg-black/25 text-zinc-300'}`}
                                    style={supportView === 'tools' ? runtimeTheme.accentChipStyle : { borderColor: withAudienceBrandAlpha(accentColor, 0.18) }}
                                >
                                    Tools
                                </button>
                            ) : null}
                        </div>
                    </div>
                    {supportView === 'collapsed' ? (
                        <div className="px-4 py-2.5 text-[11px] text-zinc-400">
                            Deeper queue, planner, inbox, and tools stay collapsed until you call for them.
                        </div>
                    ) : (
                    <div className={`${workspaceFocusActive ? 'flex min-h-0 flex-1 flex-col p-1.5' : 'min-h-0 overflow-hidden p-2.5'}`}>
                        {supportView === 'summary' ? (
                            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.18fr)_minmax(300px,0.82fr)]">
                                <div
                                    className="rounded-[20px] border px-3.5 py-3"
                                    style={{
                                        borderColor: withAudienceBrandAlpha(primaryColor, 0.16),
                                        backgroundImage: `linear-gradient(160deg, ${withAudienceBrandAlpha(primaryColor, 0.08)}, rgba(5,7,12,0.86))`,
                                    }}
                                >
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>Room Deck</div>
                                    <div className="mt-1 text-[12px] text-zinc-300">Use the deeper workspaces only when you need to leave the live lane.</div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                        <button type="button" onClick={openQueueWorkspace} className={`${styles?.btnStd || ''} ${styles?.btnSecondary || ''} px-3 py-2 text-[11px]`}>
                                            Queue
                                        </button>
                                        <button type="button" onClick={openAddWorkspace} className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} px-3 py-2 text-[11px]`}>
                                            Add
                                        </button>
                                        <button type="button" onClick={openInboxWorkspace} className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} px-3 py-2 text-[11px]`}>
                                            Inbox
                                        </button>
                                        <button type="button" onClick={openPlannerWorkspace} className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} px-3 py-2 text-[11px]`}>
                                            Planner
                                        </button>
                                    </div>
                                </div>
                                <div
                                    className="rounded-[20px] border px-3.5 py-3"
                                    style={{
                                        borderColor: withAudienceBrandAlpha(secondaryColor, 0.16),
                                        backgroundImage: `linear-gradient(160deg, ${withAudienceBrandAlpha(secondaryColor, 0.08)}, rgba(5,7,12,0.88))`,
                                    }}
                                >
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: secondaryColor }}>Support Snapshot</div>
                                    <div className="mt-2.5 flex flex-wrap gap-2">
                                        <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                            Attention {attentionItems.length}
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                            Rotation {(runtimeModel?.rotationFlow || []).length}
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                            Candidates {(runtimeModel?.candidatePool || []).length}
                                        </span>
                                    </div>
                                    <div className="mt-3 text-xs text-zinc-400">
                                        Use `Tonight Flow` when you need to shape the order. Use `Workspace` only for deeper queue and inbox work.
                                    </div>
                                </div>
                            </div>
                        ) : supportView === 'flow' ? (
                            <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)]">
                                <HostRotationLane items={runtimeModel?.rotationFlow || []} brandTheme={brandTheme} />
                                <HostCandidatePool items={runtimeModel?.candidatePool || []} groups={candidateGroups} brandTheme={brandTheme} />
                            </div>
                        ) : supportView === 'workspace' && workspacePanel ? (
                            <div data-host-workspace-focus="true" className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-black/18">
                                <div className="h-full min-h-0 flex-1 overflow-hidden rounded-[20px]">
                                    {workspacePanel}
                                </div>
                            </div>
                        ) : supportView === 'tools' && utilityPanel ? (
                            <div className="max-h-[34vh] min-h-0 overflow-y-auto rounded-[22px] bg-black/20 custom-scrollbar">
                                {utilityPanel}
                            </div>
                        ) : (
                            <div className="rounded-[22px] border border-white/10 bg-black/18 px-4 py-4 text-sm text-zinc-400">
                                Nothing else needs the stage right now.
                            </div>
                        )}
                    </div>
                    )}
                </section>
            </div>
        </div>
    );
}
