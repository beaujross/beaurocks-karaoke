import React from 'react';

const MissionSetupPlanPreview = ({
    missionPresetLabel = 'Casual Night',
    flowRuleLabel = 'Balanced Flow',
    assistLabel = 'Smart Assist',
    spotlightLabel = 'Karaoke Flow',
    readinessScore = 0,
    readinessMissing = [],
    overrideCount = 0,
    planImpactItems = [],
    effectiveBehaviorDomains = []
}) => (
    <>
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Setup Summary</div>
        <div className="mt-2 rounded-2xl border border-cyan-500/30 bg-zinc-900/80 p-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">Your plan</div>
            <div className="text-sm text-zinc-200 mt-2"><span className="text-zinc-500">Night feel:</span> {missionPresetLabel}</div>
            <div className="text-sm text-zinc-200 mt-1"><span className="text-zinc-500">Queue:</span> {flowRuleLabel}</div>
            <div className="text-sm text-zinc-200 mt-1"><span className="text-zinc-500">Host help:</span> {assistLabel}</div>
            <div className="text-sm text-zinc-200 mt-1"><span className="text-zinc-500">Format:</span> {spotlightLabel}</div>
            {overrideCount > 0 && (
                <div className="text-xs text-amber-200 mt-2">
                    {overrideCount} advanced override{overrideCount === 1 ? '' : 's'} active
                </div>
            )}
        </div>

        <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">What happens tonight</div>
            {effectiveBehaviorDomains.length > 0 ? (
                <div className="mt-2 space-y-2" data-room-setup-effective-behavior="true">
                    {effectiveBehaviorDomains.map((domain) => (
                        <div
                            key={`effective-domain-${domain.key}`}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                            data-room-setup-effective-domain={domain.key}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="text-[10px] uppercase tracking-[0.17em] text-cyan-100/70">{domain.label}</div>
                                <div className="max-w-[48%] truncate text-[9px] uppercase tracking-[0.12em] text-zinc-500" title={domain.provenance?.sourceLabel || 'Current room'}>
                                    From {domain.provenance?.sourceLabel || 'current room'}
                                </div>
                            </div>
                            <div className="mt-1 text-xs leading-5 text-zinc-200">{domain.summary}</div>
                            {Array.isArray(domain.warnings) && domain.warnings.length > 0 ? (
                                <div className="mt-1 text-[10px] leading-4 text-amber-200">Check: {domain.warnings.join(' ')}</div>
                            ) : null}
                            {Array.isArray(domain.details) && domain.details.length > 0 ? (
                                <div className="mt-2 space-y-1 border-t border-white/5 pt-2" aria-label={`${domain.label} details`}>
                                        {domain.details.slice(0, 3).map((detail) => (
                                            <div key={`${domain.key}-${detail.label}`} className="flex items-start justify-between gap-3 text-[10px] leading-4">
                                                <span className="text-zinc-500">{detail.label}</span>
                                                <span className="text-right text-zinc-300">{detail.value}</span>
                                            </div>
                                        ))}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mt-2 space-y-1.5">
                    {planImpactItems.map((item) => (
                        <div key={`plan-impact-${item.label}`} className="flex items-start justify-between gap-3 text-xs text-zinc-200">
                            <span className="text-zinc-400 uppercase tracking-[0.15em]">{item.label}</span>
                            <span className="text-right">{item.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Before You Save</div>
            <div className="text-white font-bold mt-1">{readinessScore}%</div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all" style={{ width: `${readinessScore}%` }}></div>
            </div>
            {readinessMissing.length > 0 && (
                <div className="text-[11px] text-zinc-400 mt-2">Still missing: {readinessMissing.join(', ')}</div>
            )}
        </div>
    </>
);

export default MissionSetupPlanPreview;
