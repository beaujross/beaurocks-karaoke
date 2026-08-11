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
    deadAirSongs = [],
    intermissionEnabled = false,
    intermissionEverySongs = 1,
    intermissionTypes = [],
    onToggleIntermission = () => {},
    onSetIntermissionEverySongs = () => {},
    onToggleIntermissionType = () => {}
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
        <section className="border-b border-fuchsia-100/12 pb-3">
            <div className="hidden border-b border-white/10 bg-gradient-to-r from-cyan-500/14 via-zinc-950 to-fuchsia-500/12 px-4 py-4" aria-hidden="true">
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

            <div>
                <div className="hidden" aria-hidden="true">
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

                <div className="grid items-stretch gap-2.5 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)]">
                    <div className="rounded-xl border border-fuchsia-200/24 bg-fuchsia-500/[0.08] p-3" data-feature-id="setup-intermission-program">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-200">Between performances</div>
                                <div className="mt-0.5 text-sm font-black text-white">Use short activities only when you want them.</div>
                            </div>
                            <button type="button" aria-pressed={intermissionEnabled} onClick={onToggleIntermission} className={`flex min-h-[36px] min-w-[102px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] transition ${intermissionEnabled ? 'border-fuchsia-300/40 bg-fuchsia-500/20 text-fuchsia-50' : 'border-white/10 bg-black/25 text-zinc-300'}`}>
                                <i className={`fa-solid ${intermissionEnabled ? 'fa-wand-magic-sparkles' : 'fa-pause'}`} />
                                {intermissionEnabled ? 'Breaks on' : 'No breaks'}
                            </button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                            {[
                                ['trivia', 'Trivia', 'fa-lightbulb'],
                                ['would_you_rather', 'Would You Rather', 'fa-shuffle'],
                                ['ready_check', 'Ready Check', 'fa-circle-check'],
                                ['volley', 'Volley Orb', 'fa-circle-nodes'],
                            ].map(([id, label, icon]) => {
                                const selected = intermissionTypes.includes(id);
                                return (
                                    <button key={id} type="button" disabled={!intermissionEnabled} aria-pressed={selected} onClick={() => onToggleIntermissionType(id)} className={`flex min-h-[42px] items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[10px] font-bold transition disabled:opacity-45 ${selected ? 'border-fuchsia-300/35 bg-fuchsia-500/15 text-white' : 'border-white/10 bg-black/20 text-zinc-400'}`}>
                                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[10px] ${selected ? 'border-fuchsia-200/35 bg-fuchsia-300 text-slate-950' : 'border-white/10 bg-white/[0.04]'}`}><i className={`fa-solid ${icon}`}></i></span>
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">After singers</div>
                            <div className="grid min-w-[220px] flex-1 grid-cols-5 gap-1" role="group" aria-label="Between-performance cadence">
                                {[1, 2, 3, 4, 5].map((count) => {
                                    const selected = Number(intermissionEverySongs) === count;
                                    return (
                                        <button
                                            key={count}
                                            type="button"
                                            disabled={!intermissionEnabled}
                                            aria-pressed={selected}
                                            onClick={() => onSetIntermissionEverySongs(count)}
                                            className={`min-h-[32px] rounded-md border text-[11px] font-black transition disabled:opacity-40 ${selected ? 'border-fuchsia-300/45 bg-fuchsia-500/20 text-white' : 'border-white/10 bg-black/20 text-zinc-400'}`}
                                        >
                                            {count}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-cyan-200/24 bg-cyan-400/[0.07] p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Host help</div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-400">{activeMeta.detail}</div>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                            {visibleAssistLevels.map((assist) => {
                                const active = selectedAssistLevel === assist.id;
                                return (
                                    <button
                                        key={`autopilot-assist-${assist.id}`}
                                        type="button"
                                        onClick={() => onSelectAssistLevel(assist.id)}
                                        aria-pressed={active}
                                        className={`min-h-[48px] rounded-lg border px-1.5 py-1.5 text-center text-[10px] transition-all ${active ? 'border-cyan-300/55 bg-cyan-500/14 text-white shadow-[0_0_18px_rgba(34,211,238,0.08)]' : 'border-white/10 bg-black/25 text-zinc-300 hover:border-cyan-300/30'}`}
                                    >
                                        <i className={`fa-solid ${assist.id === 'manual_first' ? 'fa-hand' : assist.id === 'autopilot_first' ? 'fa-robot' : 'fa-wand-magic-sparkles'} mb-1 block text-sm`} />
                                        <span className="block font-bold">{assist.label.replace(' First', '')}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="hidden rounded-xl border border-zinc-800 bg-zinc-900/60 p-3" aria-hidden="true">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">If the queue runs dry</div>
                        <div className="mt-2 space-y-2">
                            {visibleSongs.map((song) => (
                                <div key={`${song.title}-${song.artist}`} className="flex items-center justify-between gap-3 text-xs">
                                    <div className="min-w-0">
                                        <div className="truncate font-bold text-white">{song.title}</div>
                                        <div className="truncate text-zinc-400">{song.artist || 'Unknown artist'} · {song.sourceLabel || 'Cached YouTube catalog'}</div>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${song.hasApprovedBacking ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100'}`}>
                                        {song.hasApprovedBacking ? 'Ready' : 'Known'}
                                    </span>
                                </div>
                            ))}
                            {visibleSongs.length === 0 && (
                                <div className="text-xs text-zinc-400">Cached YouTube karaoke picks will appear here when the catalog is ready.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MissionSetupAutopilotPreview;
