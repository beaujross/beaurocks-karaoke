import React from 'react';
import { HOST_MOMENT_CUES } from '../../../lib/hostMomentCues';

const MOMENT_BUTTONS = Object.freeze(HOST_MOMENT_CUES.map((cue) => ({
    ...cue,
    cooldownMs: cue.id === 'celebrate'
        ? 12000
        : cue.id === 'hype'
            ? 10000
            : cue.id === 'reveal'
                ? 8000
                : cue.id === 'next_up'
                    ? 7000
                    : 6000
})));

const formatCooldownLabel = (remainingMs = 0) => {
    const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return `${seconds}s`;
};

const HostMomentsStrip = ({
    onTriggerMoment,
    compactViewport = false,
    sfxMuted = false,
    activeMomentId = ''
}) => {
    const [busyMomentId, setBusyMomentId] = React.useState('');
    const [lastTriggeredId, setLastTriggeredId] = React.useState('');
    const [cooldownUntilMap, setCooldownUntilMap] = React.useState({});
    const [, forceTick] = React.useState(0);

    React.useEffect(() => {
        const timer = window.setInterval(() => {
            forceTick((tick) => (tick + 1) % 1000);
        }, 500);
        return () => window.clearInterval(timer);
    }, []);

    React.useEffect(() => {
        if (activeMomentId) {
            setLastTriggeredId(activeMomentId);
        }
    }, [activeMomentId]);

    const handleTrigger = async (button) => {
        const now = Date.now();
        const cooldownUntil = Number(cooldownUntilMap?.[button.id] || 0);
        if (busyMomentId || cooldownUntil > now || typeof onTriggerMoment !== 'function') return;
        setBusyMomentId(button.id);
        try {
            await onTriggerMoment(button.id);
            setLastTriggeredId(button.id);
            setCooldownUntilMap((current) => ({
                ...current,
                [button.id]: Date.now() + Number(button.cooldownMs || 0)
            }));
        } finally {
            setBusyMomentId('');
        }
    };

    const lastTriggeredLabel = MOMENT_BUTTONS.find((button) => button.id === lastTriggeredId)?.label || '';

    return (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f1728]/92 via-[#111827]/92 to-[#160f25]/92 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Moments</div>
                    <div className="mt-1 text-sm font-semibold text-white">Quick room cues</div>
                    <div className="mt-1 text-xs text-zinc-400">Use short, high-confidence cues without opening the full soundboard.</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]">
                    {lastTriggeredLabel ? (
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                            Last: {lastTriggeredLabel}
                        </span>
                    ) : null}
                    {sfxMuted ? (
                        <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-amber-100">
                            SFX muted
                        </span>
                    ) : null}
                </div>
            </div>
            <div className={`mt-3 grid gap-2 ${compactViewport ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5'}`}>
                {MOMENT_BUTTONS.map((button) => {
                    const cooldownUntil = Number(cooldownUntilMap?.[button.id] || 0);
                    const remainingMs = cooldownUntil - Date.now();
                    const coolingDown = remainingMs > 0;
                    const busy = busyMomentId === button.id;
                    const active = activeMomentId === button.id;
                    return (
                        <button
                            key={button.id}
                            type="button"
                            disabled={busy || coolingDown}
                            onClick={() => {
                                void handleTrigger(button);
                            }}
                            className={`group flex min-h-[78px] flex-col items-start justify-between rounded-2xl border px-3 py-2 text-left transition ${
                                busy || coolingDown
                                    ? 'cursor-not-allowed border-white/10 bg-black/30 text-zinc-500'
                                    : `${button.toneClass} hover:border-white/35 hover:bg-white/10`
                            } ${active ? 'shadow-[0_0_0_1px_rgba(255,255,255,0.24),0_0_24px_rgba(34,211,238,0.18)]' : ''}`}
                        >
                            <div className="flex w-full items-start justify-between gap-2">
                                <span className="text-base">
                                    <i className={`fa-solid ${button.icon}`}></i>
                                </span>
                                {busy ? (
                                    <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">Live</span>
                                ) : active ? (
                                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/90">Cue live</span>
                                ) : coolingDown ? (
                                    <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">{formatCooldownLabel(remainingMs)}</span>
                                ) : null}
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-white">{button.label}</div>
                                <div className="mt-1 text-[11px] text-current/80">{button.detail}</div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default HostMomentsStrip;
