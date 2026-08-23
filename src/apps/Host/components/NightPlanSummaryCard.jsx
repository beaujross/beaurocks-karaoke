import React, { useMemo } from 'react';
import { buildNightPlanSummary } from '../../../lib/nightPlan.js';

const STATUS_STYLES = Object.freeze({
    ready: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
    ready_with_notes: 'border-amber-300/30 bg-amber-500/10 text-amber-100',
    needs_attention: 'border-rose-300/35 bg-rose-500/10 text-rose-100',
});

const NightPlanSummaryCard = ({
    room = {},
    songs = [],
    appleMusicAuthorized = false,
    promptCount = null,
    publicTvConnected = null,
    compact = false,
    className = '',
}) => {
    const summary = useMemo(() => buildNightPlanSummary({
        room,
        songs,
        appleMusicAuthorized,
        promptCount,
        publicTvConnected,
    }), [appleMusicAuthorized, promptCount, publicTvConnected, room, songs]);
    const readiness = summary.readiness;
    const statusClass = STATUS_STYLES[readiness.status] || STATUS_STYLES.ready;
    const attentionItems = readiness.blockers.length ? readiness.blockers : readiness.warnings;

    return (
        <section
            data-feature-id="night-plan-summary"
            data-night-experience={summary.plan.experienceId}
            data-night-hosting-level={summary.plan.hostingLevel}
            className={`overflow-hidden rounded-2xl border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(8,31,48,0.92),rgba(16,14,30,0.94)_52%,rgba(62,18,61,0.72))] shadow-[0_16px_38px_rgba(0,0,0,0.2)] ${className}`}
        >
            <div className={`flex flex-col gap-3 ${compact ? 'p-3 sm:flex-row sm:items-center sm:justify-between' : 'p-4 sm:p-5'}`}>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/58">
                        <span>Tonight</span>
                        <span className="text-white/20">/</span>
                        <span>Room Experience</span>
                    </div>
                    <div className={`mt-1 flex items-center gap-2 font-black text-white ${compact ? 'text-base' : 'text-xl sm:text-2xl'}`}>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-200/25 bg-cyan-400/12 text-cyan-200">
                            <i className={`fa-solid ${summary.experience.icon}`} />
                        </span>
                        <span className="truncate">{summary.headline}</span>
                    </div>
                    {!compact ? <div className="mt-2 max-w-3xl text-sm leading-5 text-cyan-50/72">{summary.experience.summary}</div> : null}
                </div>

                <div className={`flex shrink-0 flex-wrap items-center gap-2 ${compact ? '' : 'mt-1'}`}>
                    <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass}`}>
                        {summary.readinessLabel}
                    </span>
                    {readiness.counts.lineup > 0 ? (
                        <span className="rounded-full border border-white/12 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                            {readiness.counts.lineup} in lineup
                        </span>
                    ) : null}
                </div>
            </div>

            {!compact && summary.plan.experienceId === 'original_tracks' ? (
                <div className="grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3">
                    <div className="bg-black/35 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Original recordings</div>
                        <div className="mt-1 text-sm font-black text-white">{readiness.counts.originalReady} of {readiness.counts.lineup} ready</div>
                    </div>
                    <div className="bg-black/35 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Big-screen lyrics</div>
                        <div className="mt-1 text-sm font-black text-white">{readiness.counts.lyricsReady} of {readiness.counts.lineup} ready</div>
                    </div>
                    <div className="bg-black/35 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Apple Music</div>
                        <div className={`mt-1 text-sm font-black ${appleMusicAuthorized ? 'text-emerald-200' : 'text-amber-200'}`}>{appleMusicAuthorized ? 'Connected' : 'Connect when needed'}</div>
                    </div>
                </div>
            ) : null}

            {!compact && attentionItems.length ? (
                <div className={`border-t px-4 py-3 text-xs leading-5 ${readiness.blockers.length ? 'border-rose-300/15 bg-rose-500/[0.06] text-rose-100' : 'border-amber-300/15 bg-amber-500/[0.05] text-amber-100'}`}>
                    <span className="mr-2 font-black uppercase tracking-[0.12em]">{readiness.blockers.length ? 'Before launch' : 'Heads up'}</span>
                    {attentionItems.join(' · ')}
                </div>
            ) : null}
        </section>
    );
};

export default NightPlanSummaryCard;
