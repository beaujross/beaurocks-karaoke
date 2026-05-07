import React from 'react';
import HostCandidatePool from './HostCandidatePool';
import HostPerformerRing from './HostPerformerRing';
import HostPlaybackDock from './HostPlaybackDock';
import HostRotationLane from './HostRotationLane';
import { isAudienceSelectedUnverifiedResolution } from '../../../lib/requestModes';
import buildHostRuntimeShellTheme from '../lib/hostRuntimeShellTheme';

const infoChipClass = 'rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]';

const toneClassByAttention = {
    danger: 'border-rose-300/30 bg-rose-500/12 text-rose-100',
    warning: 'border-amber-300/30 bg-amber-500/12 text-amber-100',
    info: 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100',
};

export default function HostRuntimeShellExperimental({
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
    onAdvanceToNext = null,
    canAdvanceToNext = false,
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
}) {
    const runtimeTheme = buildHostRuntimeShellTheme(room);
    const brandTheme = runtimeTheme.theme;
    const brandTitle = String(brandTheme?.appTitle || 'BeauRocks Karaoke').trim() || 'BeauRocks Karaoke';
    const currentPerformance = runtimeModel?.currentPerformance || null;
    const nextPerformance = runtimeModel?.nextPerformance || null;
    const focusObject = currentPerformance || nextPerformance || null;
    const hasTrackCheckAction = runtimeModel?.trackCheckState?.hasPendingPrompt || runtimeModel?.trackCheckState?.deferredCount > 0;
    const topQuestions = runtimeModel?.topQuestions || {};
    const candidateGroups = runtimeModel?.candidateGroups || [];
    const currentMediaUrl = String(currentPerformance?.raw?.mediaUrl || '').trim();
    const currentHasYouTubeBacking = /youtu\.?be|youtube\.com/i.test(currentMediaUrl);
    const currentAudienceSelectedUnverified = isAudienceSelectedUnverifiedResolution(currentPerformance?.raw?.resolutionStatus);
    const parsedCustomBonus = Number.parseInt(customBonus, 10);
    const safeCustomBonus = Number.isFinite(parsedCustomBonus) ? parsedCustomBonus : 0;

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
        {
            id: 'bonus',
            label: 'Bonus',
            icon: 'fa-sparkles',
            onClick: () => onAddBonusToCurrent?.(),
            toneClass: 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100 hover:border-fuchsia-200/55',
        },
        {
            id: 'details',
            label: 'Details',
            icon: 'fa-list-check',
            onClick: () => onOpenQueue?.(),
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
            onClick: () => onOpenQueue?.(),
        },
        {
            id: 'add',
            label: 'Add',
            icon: 'fa-plus',
            onClick: () => onOpenAdd?.(),
        },
        {
            id: 'inbox',
            label: 'Inbox',
            icon: 'fa-inbox',
            onClick: () => onOpenInbox?.(),
        },
        {
            id: 'planner',
            label: 'Planner',
            icon: 'fa-clapperboard',
            onClick: () => onOpenPlanner?.(),
        },
        {
            id: 'scenes',
            label: 'Scenes',
            icon: 'fa-tv',
            onClick: () => onOpenSceneLibrary?.(),
        },
    ];

    return (
        <div className="space-y-3 px-3 py-3">
            <div
                className="rounded-[28px] border p-4 before:pointer-events-none before:absolute before:inset-0 before:hidden before:rounded-[28px]"
                style={runtimeTheme.shellStyle}
                data-host-runtime-brand-title={brandTitle}
                data-host-runtime-brand-primary={brandTheme.primaryColor}
                data-host-runtime-brand-secondary={brandTheme.secondaryColor}
                data-host-runtime-brand-accent={brandTheme.accentColor}
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: brandTheme.secondaryColor }}>{brandTitle}</div>
                        <div className="mt-1 text-lg font-black text-white">Runtime Shell Experiment</div>
                        <div className="mt-1 text-xs text-zinc-400">Keep the eye-line on who is live, what is next, and what needs intervention.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={infoChipClass} style={runtimeTheme.secondaryChipStyle}>{runtimeModel?.runtimeModeEmphasis || 'hostLed'}</span>
                        <span className={infoChipClass} style={runtimeModel?.roomControlsSummary?.autoDj ? runtimeTheme.primaryChipStyle : null}>Auto DJ {runtimeModel?.roomControlsSummary?.autoDj ? 'On' : 'Off'}</span>
                        <span className={infoChipClass} style={runtimeModel?.roomControlsSummary?.readyCheckActive ? runtimeTheme.accentChipStyle : null}>Ready Check {runtimeModel?.roomControlsSummary?.readyCheckActive ? 'Live' : 'Idle'}</span>
                    </div>
                </div>

                <div className="mt-4 grid gap-3">
                    <div className="grid gap-3 lg:grid-cols-3">
                        <div className="rounded-[22px] border px-4 py-4" style={runtimeTheme.secondaryCardStyle}>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: brandTheme.secondaryColor }}>Live Now</div>
                            <div className="mt-2 truncate text-base font-black text-white">{topQuestions?.liveNow?.title || 'No live performance'}</div>
                            <div className="truncate text-sm text-zinc-300">{topQuestions?.liveNow?.subtitle || 'The room is between performances.'}</div>
                        </div>
                        <div className="rounded-[22px] border px-4 py-4" style={runtimeTheme.primaryCardStyle}>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: brandTheme.primaryColor }}>Next Committed</div>
                            <div className="mt-2 truncate text-base font-black text-white">{topQuestions?.nextCommitted?.title || 'No next object committed'}</div>
                            <div className="truncate text-sm text-zinc-300">{topQuestions?.nextCommitted?.subtitle || 'Queue or show can fill this next.'}</div>
                        </div>
                        <div className="rounded-[22px] border px-4 py-4" style={runtimeTheme.accentCardStyle}>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-200">Needs Intervention</div>
                            <div className="mt-2 truncate text-base font-black text-white">{topQuestions?.needsIntervention?.title || 'No active blocker'}</div>
                            <div className="truncate text-sm text-zinc-300">{topQuestions?.needsIntervention?.subtitle || 'The runtime lane is clear.'}</div>
                        </div>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
                        <div className="rounded-[24px] border bg-black/25" style={runtimeTheme.panelStyle}>
                            <HostPerformerRing focusObject={focusObject} actions={ringActions} brandTheme={brandTheme} />
                        </div>
                        <div className="space-y-3">
                            <div className="rounded-[24px] border bg-black/25 px-4 py-4" style={runtimeTheme.panelStyle}>
                                <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: brandTheme.primaryColor }}>Next Up</div>
                                <div className="mt-3 rounded-2xl border px-3 py-3" style={runtimeTheme.primaryCardStyle}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-base font-black text-white">{nextPerformance?.title || 'No next object committed'}</div>
                                            <div className="truncate text-sm text-zinc-300">{nextPerformance?.subtitle || 'Queue or show can fill this next'}</div>
                                        </div>
                                        {nextPerformance?.statusLabel ? (
                                            <span className="rounded-full border bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]" style={runtimeTheme.primaryChipStyle}>
                                                {nextPerformance.statusLabel}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
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
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button type="button" onClick={onOpenQueue} className={`${styles?.btnStd || ''} ${styles?.btnSecondary || ''} px-3 py-2 text-[11px]`}>
                                        Open Queue
                                    </button>
                                    <button type="button" onClick={onOpenAdd} className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} px-3 py-2 text-[11px]`}>
                                        Add
                                    </button>
                                    <button type="button" onClick={onOpenPlanner} className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} px-3 py-2 text-[11px]`}>
                                        Planner
                                    </button>
                                </div>
                            </div>
                            {currentPerformance ? (
                                <div className="rounded-[24px] border border-white/10 bg-black/25 px-4 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">Current Performance Tools</div>
                                            <div className="mt-1 text-xs text-zinc-400">Keep the live-only host controls nearby without overloading the ring.</div>
                                        </div>
                                        {currentHasYouTubeBacking ? (
                                            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                                YouTube backing
                                            </span>
                                        ) : null}
                                    </div>
                                    {currentHasYouTubeBacking && currentAudienceSelectedUnverified ? (
                                        <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/8 px-3 py-3">
                                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Guest Track</div>
                                            <div className="mt-1 text-xs text-zinc-300">Mark whether this audience-selected backing should be trusted next time.</div>
                                            <div className="mt-3 flex flex-wrap gap-2">
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
                                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">Track Note</div>
                                            <div className="mt-1 text-xs text-zinc-400">Save whether you would use this backing again.</div>
                                            <div className="mt-3 flex flex-wrap gap-2">
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
                                            onClick={onAdvanceToNext}
                                            disabled={!canAdvanceToNext}
                                            className={`${styles?.btnStd || ''} border-cyan-300/35 bg-cyan-500/12 px-3 py-2 text-[11px] text-cyan-100 hover:border-cyan-200/55 ${!canAdvanceToNext ? 'cursor-not-allowed opacity-45' : ''}`}
                                        >
                                            Advance Next
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
                                            onClick={onOpenQueue}
                                            className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} px-3 py-2 text-[11px]`}
                                        >
                                            Open Queue Details
                                        </button>
                                    </div>
                                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-100">Custom Bonus</div>
                                        <div className="mt-1 text-xs text-zinc-400">Award extra points for this specific performance without leaving the live shell.</div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={customBonus}
                                                onChange={(event) => onCustomBonusChange?.(event.target.value)}
                                                className={`${styles?.input || ''} w-24`}
                                                placeholder="Pts"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => onAddBonusToCurrent?.(safeCustomBonus)}
                                                className={`${styles?.btnStd || ''} border-fuchsia-300/35 bg-fuchsia-500/12 px-3 py-2 text-[11px] text-fuchsia-100 hover:border-fuchsia-200/55`}
                                            >
                                                Apply Bonus
                                            </button>
                                        </div>
                                    </div>
                                    {(room?.applausePeak !== undefined && room?.applausePeak !== null) ? (
                                        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-zinc-300">
                                            <span className="font-black uppercase tracking-[0.16em] text-zinc-500">Last Applause</span>
                                            <span className="text-sm font-black text-cyan-200">{Math.round(room.applausePeak)} dB</span>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            <div className="rounded-[24px] border bg-black/25 px-4 py-4" style={runtimeTheme.panelStyle}>
                                <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: brandTheme.primaryColor }}>Attention</div>
                                <div className="mt-3 space-y-2">
                                    {(runtimeModel?.attentionItems || []).length > 0 ? (runtimeModel.attentionItems || []).map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={onOpenInbox}
                                            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${toneClassByAttention[item.tone] || 'border-white/10 bg-black/20 text-white'}`}
                                        >
                                            <div className="text-sm font-semibold text-white">{item.title}</div>
                                            <div className="mt-1 text-xs text-white/80">{item.subtitle}</div>
                                        </button>
                                    )) : (
                                        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
                                            No active blockers in the main runtime lane.
                                        </div>
                                    )}
                                </div>
                            </div>
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

                    <div className="grid gap-3 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
                        <HostRotationLane items={runtimeModel?.rotationFlow || []} brandTheme={brandTheme} />
                        <HostCandidatePool items={runtimeModel?.candidatePool || []} groups={candidateGroups} brandTheme={brandTheme} />
                    </div>
                </div>
            </div>
        </div>
    );
}
