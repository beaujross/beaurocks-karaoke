import React from 'react';

const MissionSetupPrimaryPicks = ({
    missionPickCount = 0,
    presets = [],
    presetMeta = {},
    selectedArchetype = '',
    onSelectArchetype = () => {},
    flowRules = [],
    selectedFlowRule = '',
    onSelectFlowRule = () => {},
    assistLevels = [],
    selectedAssistLevel = '',
    onSelectAssistLevel = () => {}
}) => (
    <>
        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/8 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Mission Brief</div>
                    <div className="text-sm text-zinc-200 mt-1">Three decisions, then start the night.</div>
                </div>
                <span className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${missionPickCount === 3 ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' : 'border-zinc-600 bg-zinc-900/60 text-zinc-300'}`}>
                    {missionPickCount}/3 Picks Ready
                </span>
            </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Pick 1</div>
            <div className="text-xl font-bold text-white mt-1">Night Archetype</div>
            <div className="text-sm text-zinc-400 mt-1">Defines the baseline room behavior.</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {presets.map((preset) => {
                    const active = selectedArchetype === preset.id;
                    const meta = presetMeta[preset.id] || presetMeta.casual || { icon: 'fa-star', accent: 'from-cyan-500/30 via-sky-500/10 to-transparent' };
                    return (
                        <button
                            key={`mission-archetype-${preset.id}`}
                            onClick={() => onSelectArchetype(preset.id)}
                            className={`relative overflow-hidden text-left rounded-2xl border transition-all ${active ? 'border-[#00C4D9]/70 shadow-[0_0_0_1px_rgba(0,196,217,0.55)]' : 'border-zinc-700 hover:border-zinc-500'}`}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent}`}></div>
                            <div className="relative px-4 py-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="text-lg text-cyan-100"><i className={`fa-solid ${meta.icon}`}></i></div>
                                    {active && <span className="text-[10px] uppercase tracking-[0.25em] px-2 py-1 rounded-full border border-cyan-300/40 bg-cyan-500/20 text-cyan-100">Selected</span>}
                                </div>
                                <div className="text-lg font-bold text-white mt-2">{preset.label}</div>
                                <div className="text-sm text-zinc-300 mt-1">{preset.description}</div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Pick 2</div>
            <div className="text-xl font-bold text-white mt-1">Session Constraint</div>
            <div className="text-sm text-zinc-400 mt-1">How tight the pacing should feel.</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                {flowRules.map((rule) => {
                    const active = selectedFlowRule === rule.id;
                    return (
                        <button
                            key={`mission-flow-${rule.id}`}
                            onClick={() => onSelectFlowRule(rule.id)}
                            className={`text-left rounded-2xl border px-3 py-3 transition-all ${active ? 'border-cyan-400/60 bg-cyan-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                        >
                            <div className="font-bold text-white">{rule.label}</div>
                            <div className="text-xs text-zinc-400 mt-2">{rule.description}</div>
                        </button>
                    );
                })}
            </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Pick 3</div>
            <div className="text-xl font-bold text-white mt-1">Host Involvement</div>
            <div className="text-sm text-zinc-400 mt-1">Sets how much automation carries the room.</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                {assistLevels.map((assist) => {
                    const active = selectedAssistLevel === assist.id;
                    return (
                        <button
                            key={`mission-assist-${assist.id}`}
                            onClick={() => onSelectAssistLevel(assist.id)}
                            className={`text-left rounded-2xl border px-3 py-3 transition-all ${active ? 'border-emerald-400/60 bg-emerald-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                        >
                            <div className="font-bold text-white">{assist.label}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    </>
);

export default MissionSetupPrimaryPicks;
