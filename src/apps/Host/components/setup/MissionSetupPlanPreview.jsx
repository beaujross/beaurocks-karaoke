import React from 'react';

const MissionSetupPlanPreview = ({
    missionPresetLabel = 'Casual Night',
    flowRuleLabel = 'Balanced Flow',
    assistLabel = 'Smart Assist',
    spotlightLabel = 'Karaoke Flow',
    readinessScore = 0,
    readinessMissing = [],
    overrideCount = 0,
    planImpactItems = []
}) => (
    <>
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tonight&apos;s Plan</div>
        <div className="mt-2 rounded-2xl border border-cyan-500/30 bg-zinc-900/80 p-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">Canonical Summary</div>
            <div className="text-sm text-zinc-200 mt-2"><span className="text-zinc-500">Archetype:</span> {missionPresetLabel}</div>
            <div className="text-sm text-zinc-200 mt-1"><span className="text-zinc-500">Constraint:</span> {flowRuleLabel}</div>
            <div className="text-sm text-zinc-200 mt-1"><span className="text-zinc-500">Host Style:</span> {assistLabel}</div>
            <div className="text-sm text-zinc-200 mt-1"><span className="text-zinc-500">Spotlight:</span> {spotlightLabel}</div>
            {overrideCount > 0 && (
                <div className="text-xs text-amber-200 mt-2">
                    {overrideCount} advanced override{overrideCount === 1 ? '' : 's'} active
                </div>
            )}
        </div>

        <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">What This Changes</div>
            <div className="mt-2 space-y-1.5">
                {planImpactItems.map((item) => (
                    <div key={`plan-impact-${item.label}`} className="flex items-start justify-between gap-3 text-xs text-zinc-200">
                        <span className="text-zinc-400 uppercase tracking-[0.15em]">{item.label}</span>
                        <span className="text-right">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Readiness</div>
            <div className="text-white font-bold mt-1">{readinessScore}%</div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all" style={{ width: `${readinessScore}%` }}></div>
            </div>
            {readinessMissing.length > 0 && (
                <div className="text-[11px] text-zinc-400 mt-2">Missing: {readinessMissing.join(', ')}</div>
            )}
        </div>
    </>
);

export default MissionSetupPlanPreview;
