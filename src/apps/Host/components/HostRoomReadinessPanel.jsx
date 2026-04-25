import React from 'react';

const STATUS_TONES = {
    ready: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
    waiting: 'border-cyan-300/24 bg-cyan-500/10 text-cyan-100',
    optional: 'border-white/10 bg-white/[0.04] text-zinc-200',
    blocked: 'border-amber-300/30 bg-amber-500/10 text-amber-100',
};

const ReadinessPill = ({ item }) => {
    const tone = STATUS_TONES[item.tone] || STATUS_TONES.optional;
    return (
        <button
            type="button"
            onClick={item.onClick}
            disabled={typeof item.onClick !== 'function' || item.disabled}
            className={`min-w-0 rounded-2xl border px-3 py-2 text-left transition ${tone} ${typeof item.onClick === 'function' && !item.disabled ? 'hover:brightness-110' : 'cursor-default'} ${item.disabled ? 'opacity-60' : ''}`}
        >
            <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-white">
                    <i className={`fa-solid ${item.icon || 'fa-circle-check'} text-xs`}></i>
                </span>
                <div className="min-w-0">
                    <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-current/70">{item.label}</div>
                    <div className="truncate text-sm font-semibold text-white">{item.value}</div>
                </div>
            </div>
        </button>
    );
};

const HostRoomReadinessPanel = ({
    roomCode = '',
    roomName = '',
    queueSummary = '',
    automationLabel = 'Smart Assist',
    tvReady = false,
    tvOpened = false,
    joinLinkReady = false,
    joinLinkCopied = false,
    appleMusicConnected = false,
    hasRunOfShowPlan = false,
    runOfShowEnabled = false,
    launchBusy = false,
    onLaunchRoom,
    onOpenTv,
    onCopyJoinLink,
    onOpenSetup,
    onOpenShowPlan,
    onConnectAppleMusic,
    collapsed = false,
    onToggleCollapsed,
}) => {
    const hasRoom = !!String(roomCode || '').trim();
    const readinessItems = [
        {
            id: 'room',
            label: 'Room',
            value: hasRoom ? String(roomCode).toUpperCase() : 'Create first',
            icon: 'fa-door-open',
            tone: hasRoom ? 'ready' : 'blocked',
        },
        {
            id: 'tv',
            label: 'TV',
            value: tvOpened ? 'Opened' : tvReady ? 'Ready' : 'Missing link',
            icon: 'fa-tv',
            tone: tvOpened ? 'ready' : tvReady ? 'waiting' : 'blocked',
            onClick: tvReady ? onOpenTv : undefined,
            disabled: !tvReady,
        },
        {
            id: 'guests',
            label: 'Guests',
            value: joinLinkCopied ? 'Link copied' : joinLinkReady ? 'Link ready' : 'Missing link',
            icon: 'fa-link',
            tone: joinLinkCopied ? 'ready' : joinLinkReady ? 'waiting' : 'blocked',
            onClick: joinLinkReady ? onCopyJoinLink : undefined,
            disabled: !joinLinkReady,
        },
        {
            id: 'queue',
            label: 'Queue',
            value: queueSummary || 'Default pace',
            icon: 'fa-list-check',
            tone: 'ready',
            onClick: onOpenSetup,
        },
        {
            id: 'automation',
            label: 'Automation',
            value: automationLabel,
            icon: 'fa-wand-magic-sparkles',
            tone: 'ready',
            onClick: onOpenSetup,
        },
        {
            id: 'show',
            label: 'Show Plan',
            value: runOfShowEnabled ? 'Live' : hasRunOfShowPlan ? 'Draft ready' : 'Optional',
            icon: 'fa-timeline',
            tone: runOfShowEnabled || hasRunOfShowPlan ? 'ready' : 'optional',
            onClick: onOpenShowPlan,
        },
        {
            id: 'media',
            label: 'Media',
            value: appleMusicConnected ? 'Apple ready' : 'Optional',
            icon: 'fa-music',
            tone: appleMusicConnected ? 'ready' : 'optional',
            onClick: onConnectAppleMusic,
        },
    ];
    const blockedCount = readinessItems.filter((item) => item.tone === 'blocked').length;
    const waitingCount = readinessItems.filter((item) => item.tone === 'waiting').length;
    const headline = blockedCount > 0
        ? 'Room needs a link before launch.'
        : waitingCount > 0
            ? 'Room is ready to launch.'
            : 'Room is live-ready.';
    const compactSummary = blockedCount > 0
        ? `${blockedCount} blocker${blockedCount === 1 ? '' : 's'}`
        : waitingCount > 0
            ? `${waitingCount} ready step${waitingCount === 1 ? '' : 's'}`
            : 'Ready to launch';

    if (collapsed) {
        return (
            <section className="mb-4 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(8,13,24,0.88),rgba(15,23,42,0.86))] px-3 py-2.5 shadow-[0_14px_42px_rgba(0,0,0,0.24)]" aria-label="Room readiness">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Room Readiness</div>
                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                {compactSummary}
                            </span>
                        </div>
                        <div className="mt-1 text-sm text-zinc-300">
                            {roomName ? `${roomName} · ${String(roomCode || '').toUpperCase() || 'No room code yet'}` : (String(roomCode || '').toUpperCase() || 'No room code yet')}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onToggleCollapsed}
                            className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-200 hover:border-cyan-300/25"
                        >
                            Show
                        </button>
                        <button
                            type="button"
                            onClick={onLaunchRoom}
                            disabled={!hasRoom || launchBusy}
                            className={`rounded-full border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${hasRoom && !launchBusy ? 'border-cyan-300/45 bg-cyan-500/16 text-cyan-50 hover:border-cyan-200/55' : 'border-white/10 bg-white/5 text-zinc-400 opacity-60'}`}
                        >
                            {launchBusy ? 'Launching...' : 'Launch Room'}
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="mb-4 rounded-3xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(8,13,24,0.94),rgba(15,23,42,0.92))] p-3 shadow-[0_18px_54px_rgba(0,0,0,0.28)] sm:p-4" aria-label="Room readiness">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Room Readiness</div>
                    <div className="mt-1 text-lg font-black text-white sm:text-xl">{headline}</div>
                    <div className="mt-1 text-sm text-zinc-400">
                        {roomName ? `${roomName} is using ${queueSummary || 'the default queue pace'}.` : 'Confirm the room, then launch the guest and TV surfaces together.'}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        className="rounded-full border border-white/10 bg-black/25 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-200 hover:border-cyan-300/25"
                    >
                        Hide
                    </button>
                    <button
                        type="button"
                        onClick={onOpenSetup}
                        className="rounded-full border border-white/10 bg-black/25 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-200 hover:border-cyan-300/25"
                    >
                        Adjust
                    </button>
                    <button
                        type="button"
                        onClick={onLaunchRoom}
                        disabled={!hasRoom || launchBusy}
                        className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] ${hasRoom && !launchBusy ? 'border-cyan-300/45 bg-cyan-500/16 text-cyan-50 hover:border-cyan-200/55' : 'border-white/10 bg-white/5 text-zinc-400 opacity-60'}`}
                    >
                        {launchBusy ? 'Launching...' : 'Launch Room'}
                    </button>
                </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
                {readinessItems.map((item) => (
                    <ReadinessPill key={item.id} item={item} />
                ))}
            </div>
        </section>
    );
};

export default HostRoomReadinessPanel;
