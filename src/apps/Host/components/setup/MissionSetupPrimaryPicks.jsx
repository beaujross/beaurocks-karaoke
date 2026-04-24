import React from 'react';

const MissionSetupPrimaryPicks = ({
    eventProfiles = [],
    activeEventProfileId = '',
    onApplyEventProfile = () => {},
    presets = [],
    presetMeta = {},
    selectedArchetype = '',
    onSelectArchetype = () => {},
    flowRules = [],
    selectedFlowRule = '',
    onSelectFlowRule = () => {}
}) => {
    const selectedPreset = presets.find((preset) => preset.id === selectedArchetype) || presets[0] || null;
    const otherPresets = presets.filter((preset) => preset.id !== selectedPreset?.id);
    const selectedPresetMeta = presetMeta[selectedPreset?.id] || presetMeta.casual || { icon: 'fa-star', accent: 'from-cyan-500/30 via-sky-500/10 to-transparent' };

    return (
    <>
        {eventProfiles.length > 0 && (
            <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/8 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-fuchsia-200">Event Shortcut</div>
                <div className="text-xl font-bold text-white mt-1">Load a named room package</div>
                <div className="text-sm text-zinc-200 mt-1">Use this when the room already has a known format and branding stack.</div>
                <div className="grid grid-cols-1 gap-3 mt-3">
                    {eventProfiles.map((profile) => {
                        const active = activeEventProfileId === profile.id;
                        const highlights = Array.isArray(profile.setupHighlights)
                            ? profile.setupHighlights.filter(Boolean).slice(0, 3)
                            : [];
                        return (
                            <button
                                key={`mission-event-profile-${profile.id}`}
                                onClick={() => onApplyEventProfile(profile.id)}
                                className={`text-left rounded-2xl border px-4 py-4 transition-all ${active ? 'border-fuchsia-300/60 bg-fuchsia-500/15 shadow-[0_0_0_1px_rgba(232,121,249,0.35)]' : 'border-zinc-700 bg-zinc-950/60 hover:border-fuchsia-400/40'}`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <div className="text-lg font-bold text-white">{profile.label}</div>
                                        <div className="text-sm text-zinc-300 mt-1">{profile.description}</div>
                                    </div>
                                    <span className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${active ? 'border-fuchsia-300/40 bg-fuchsia-500/20 text-fuchsia-100' : 'border-zinc-600 bg-zinc-900/70 text-zinc-300'}`}>
                                        {active ? 'Applied' : 'Apply'}
                                    </span>
                                </div>
                                {highlights.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {highlights.map((highlight) => (
                                            <span
                                                key={`${profile.id}-${highlight}`}
                                                className="rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-fuchsia-100"
                                            >
                                                {highlight}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Step 1</div>
            <div className="text-xl font-bold text-white mt-1">Pick the kind of night</div>
            <div className="text-sm text-zinc-400 mt-1">Use the selected package, or change it only when this room needs a different format.</div>
            {selectedPreset && (
                <div className="relative mt-3 overflow-hidden rounded-2xl border border-[#00C4D9]/60 bg-zinc-950/70 shadow-[0_0_0_1px_rgba(0,196,217,0.35)]">
                    <div className={`absolute inset-0 bg-gradient-to-br ${selectedPresetMeta.accent}`}></div>
                    <div className="relative px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/80">Selected room package</div>
                                <div className="mt-1 text-xl font-black text-white">{selectedPreset.label}</div>
                                <div className="mt-1 text-sm text-zinc-200">{selectedPreset.description}</div>
                            </div>
                            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/15 text-cyan-100">
                                <i className={`fa-solid ${selectedPresetMeta.icon}`}></i>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {otherPresets.length > 0 && (
                <details className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                    <summary className="cursor-pointer list-none text-sm font-bold text-cyan-100">
                        Change room package
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {otherPresets.map((preset) => {
                            const meta = presetMeta[preset.id] || presetMeta.casual || { icon: 'fa-star', accent: 'from-cyan-500/30 via-sky-500/10 to-transparent' };
                            return (
                                <button
                                    key={`mission-archetype-${preset.id}`}
                                    onClick={() => onSelectArchetype(preset.id)}
                                    className="relative overflow-hidden text-left rounded-xl border border-zinc-700 transition-all hover:border-zinc-500"
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent}`}></div>
                                    <div className="relative px-3 py-3">
                                        <div className="flex items-center gap-2 text-cyan-100">
                                            <i className={`fa-solid ${meta.icon}`}></i>
                                            <span className="font-bold text-white">{preset.label}</span>
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-300">{preset.description}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </details>
            )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Step 2</div>
            <div className="text-xl font-bold text-white mt-1">Pick the queue pace</div>
            <div className="text-sm text-zinc-400 mt-1">Choose how strict or loose you want turns to feel.</div>
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
    </>
    );
};

export default MissionSetupPrimaryPicks;
