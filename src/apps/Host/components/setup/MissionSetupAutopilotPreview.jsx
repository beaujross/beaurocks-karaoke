import React from 'react';

const ASSIST_MODE_META = {
    manual_first: {
        eyebrow: 'Manual',
        title: 'Host-led night',
        detail: 'BeauRocks keeps suggestions visible, but never fills gaps on its own.',
        deadAir: 'Suggestions only'
    },
    smart_assist: {
        eyebrow: 'Assist',
        title: 'Smart room assist',
        detail: 'BeauRocks watches pacing and suggests proven songs before the room goes quiet.',
        deadAir: 'Suggest after idle'
    },
    autopilot_first: {
        eyebrow: 'Autopilot',
        title: 'Autopilot keeps momentum',
        detail: 'BeauRocks can bridge empty moments with crowd-tested karaoke picks.',
        deadAir: 'Auto-fill dead air'
    }
};

const FLOW_NODES = [
    { id: 'join', icon: 'fa-qrcode', label: 'Guests Join' },
    { id: 'queue', icon: 'fa-list-check', label: 'Queue Forms' },
    { id: 'stage', icon: 'fa-tv', label: 'Stage / TV' },
    { id: 'bridge', icon: 'fa-wand-magic-sparkles', label: 'Dead-Air Bridge' }
];

const MissionSetupAutopilotPreview = ({
    assistLevels = [],
    selectedAssistLevel = 'smart_assist',
    onSelectAssistLevel = () => {},
    presetLabel = 'Karaoke Night',
    flowRuleLabel = 'Balanced Flow',
    spotlightLabel = 'Karaoke Flow',
    queueSummary = 'Round robin',
    deadAirSongs = []
}) => {
    const activeMeta = ASSIST_MODE_META[selectedAssistLevel] || ASSIST_MODE_META.smart_assist;
    const visibleAssistLevels = assistLevels.length > 0
        ? assistLevels
        : [
            { id: 'manual_first', label: 'Manual First' },
            { id: 'smart_assist', label: 'Smart Assist' },
            { id: 'autopilot_first', label: 'Autopilot First' }
        ];
    const visibleSongs = deadAirSongs.slice(0, 4);

    return (
        <section className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-zinc-950/80">
            <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/14 via-zinc-950 to-fuchsia-500/12 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Tonight&apos;s Autopilot</div>
                        <div className="mt-1 text-2xl font-black text-white">{presetLabel}</div>
                        <div className="mt-1 text-sm text-zinc-300">
                            {flowRuleLabel} · {activeMeta.title} · {spotlightLabel}
                        </div>
                    </div>
                    <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-right">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-100">{activeMeta.eyebrow}</div>
                        <div className="mt-1 text-xs text-zinc-200">{activeMeta.deadAir}</div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
                <div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                        {FLOW_NODES.map((node, index) => (
                            <div key={node.id} className="relative rounded-xl border border-zinc-700/80 bg-zinc-900/70 p-3">
                                {index < FLOW_NODES.length - 1 && (
                                    <div className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 bg-cyan-300/30 md:block" />
                                )}
                                <div className="flex items-center gap-2 text-sm font-bold text-white">
                                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-500/10 text-cyan-100">
                                        <i className={`fa-solid ${node.icon}`}></i>
                                    </span>
                                    <span>{node.label}</span>
                                </div>
                                <div className="mt-2 text-xs text-zinc-400">
                                    {node.id === 'queue'
                                        ? queueSummary
                                        : node.id === 'bridge'
                                            ? activeMeta.deadAir
                                            : node.id === 'stage'
                                                ? spotlightLabel
                                                : 'Room code and join link'}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100">
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                            </span>
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-white">Generated night plan</div>
                                <div className="mt-1 text-sm text-zinc-300">{activeMeta.detail}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Host Control</div>
                        <div className="mt-2 grid grid-cols-1 gap-2">
                            {visibleAssistLevels.map((assist) => {
                                const active = selectedAssistLevel === assist.id;
                                return (
                                    <button
                                        key={`autopilot-assist-${assist.id}`}
                                        type="button"
                                        onClick={() => onSelectAssistLevel(assist.id)}
                                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all ${active ? 'border-emerald-300/55 bg-emerald-500/12 text-white' : 'border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500'}`}
                                    >
                                        <span className="font-bold">{assist.label}</span>
                                        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">{active ? 'Active' : 'Choose'}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Dead-Air Picks</div>
                        <div className="mt-2 space-y-2">
                            {visibleSongs.map((song) => (
                                <div key={`${song.title}-${song.artist}`} className="flex items-center justify-between gap-3 text-xs">
                                    <div className="min-w-0">
                                        <div className="truncate font-bold text-white">{song.title}</div>
                                        <div className="truncate text-zinc-400">{song.artist}</div>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${song.hasApprovedBacking ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100'}`}>
                                        {song.hasApprovedBacking ? 'Ready' : 'Known'}
                                    </span>
                                </div>
                            ))}
                            {visibleSongs.length === 0 && (
                                <div className="text-xs text-zinc-400">Browse catalog picks will appear here when the song list is available.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MissionSetupAutopilotPreview;
