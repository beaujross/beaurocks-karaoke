/* eslint-disable react-refresh/only-export-components -- shared game module exports a pure visualizer model helper used by tests and runtime. */
import React from 'react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));

const BAR_COUNT = 18;

const paletteClasses = {
    cyan: {
        shell: 'border-cyan-200/30 bg-cyan-950/32 text-cyan-100 shadow-[0_0_34px_rgba(34,211,238,0.16)]',
        glow: 'bg-cyan-300',
        meter: 'from-cyan-300 via-sky-300 to-emerald-300',
        ring: 'border-cyan-200/40'
    },
    pink: {
        shell: 'border-pink-200/30 bg-pink-950/28 text-pink-100 shadow-[0_0_34px_rgba(244,114,182,0.16)]',
        glow: 'bg-pink-300',
        meter: 'from-pink-300 via-fuchsia-300 to-cyan-300',
        ring: 'border-pink-200/40'
    },
    emerald: {
        shell: 'border-emerald-200/30 bg-emerald-950/30 text-emerald-100 shadow-[0_0_34px_rgba(52,211,153,0.16)]',
        glow: 'bg-emerald-300',
        meter: 'from-emerald-300 via-cyan-300 to-amber-300',
        ring: 'border-emerald-200/40'
    },
    amber: {
        shell: 'border-amber-200/30 bg-amber-950/28 text-amber-100 shadow-[0_0_34px_rgba(251,191,36,0.16)]',
        glow: 'bg-amber-300',
        meter: 'from-amber-300 via-orange-300 to-pink-300',
        ring: 'border-amber-200/40'
    }
};

const getTelemetryCapturedAtMs = (telemetry = {}) => Number(telemetry?.capturedAtMs || telemetry?.timestampMs || 0);

export const buildCrowdMicVisualizerModel = ({
    telemetry = {},
    nowMs = Date.now(),
    staleMs = 2200,
    activeOverride = null
} = {}) => {
    const capturedAtMs = getTelemetryCapturedAtMs(telemetry);
    const ageMs = capturedAtMs > 0 ? Math.max(0, Number(nowMs || Date.now()) - capturedAtMs) : 0;
    const fresh = capturedAtMs <= 0 ? !!telemetry?.active : ageMs <= staleMs;
    const stale = !!telemetry?.active && !fresh;
    const browserStreamReady = !!telemetry?.streamActive || ['live', 'calibrating', 'starting'].includes(String(telemetry?.micStatus || '').toLowerCase());
    const active = activeOverride === null ? !!telemetry?.active && fresh : !!activeOverride && fresh;
    const rawVolume = telemetry?.volumeNormalized ?? telemetry?.volume ?? telemetry?.rawLift ?? 0;
    const volume = active ? clamp(rawVolume, 0, 1) : 0;
    const confidence = active ? clamp(telemetry?.confidence ?? telemetry?.matchPct ?? 0, 0, 1) : 0;
    const stability = active ? clamp(telemetry?.stability ?? confidence, 0, 1) : 0;
    const energy = clamp((volume * 0.72) + (confidence * 0.18) + (stability * 0.1), 0, 1);
    const note = String(telemetry?.stableNote || telemetry?.note || telemetry?.target?.targetNote || '--').trim() || '--';
    const status = stale
        ? 'Stale mic feed'
        : active
            ? (telemetry?.calibrating ? 'Browser stream ready' : 'TV feed live')
            : telemetry?.armed
                ? (browserStreamReady ? 'Browser stream ready' : 'Mic armed')
                : 'Waiting for mic';
    const command = stale ? 'SIGNAL STALE' : active ? 'CROWD LIVE' : telemetry?.armed ? 'MIC ARMED' : 'WAITING';
    return {
        active,
        fresh,
        ageMs,
        note,
        volume,
        confidence,
        stability,
        energy,
        levelPct: Math.round(energy * 100),
        status,
        stale,
        browserStreamReady,
        command
    };
};

export const CrowdMicInputVisualizer = ({
    telemetry = {},
    nowMs = Date.now(),
    enabled = true,
    label = 'Room Mic',
    helper = 'Host mic input',
    accent = 'cyan',
    className = '',
    compact = false,
    activeOverride = null
}) => {
    if (!enabled) return null;
    const model = buildCrowdMicVisualizerModel({ telemetry, nowMs, activeOverride });
    const palette = paletteClasses[accent] || paletteClasses.cyan;
    const pulseScale = 0.82 + (model.energy * 0.38);
    const ringOpacity = model.active ? 0.28 + (model.energy * 0.42) : 0.16;
    return (
        <div className={'pointer-events-none z-40 rounded-[24px] border backdrop-blur-md ' + palette.shell + ' ' + className} role="status" aria-live="polite">
            <div className={compact ? 'px-3 py-2' : 'px-4 py-3'}>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{label}</div>
                        <div className={compact ? 'text-lg font-black leading-none text-white' : 'text-2xl font-black leading-none text-white'}>{model.note}</div>
                        <div className="mt-1 inline-flex rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/85">{model.command}</div>
                    </div>
                    <div className="relative h-12 w-12 shrink-0">
                        <div
                            className={'absolute inset-0 rounded-full border ' + palette.ring}
                            style={{ opacity: ringOpacity, transform: `scale(${pulseScale})` }}
                        />
                        <div
                            className={'absolute inset-[-18%] rounded-full border ' + palette.ring}
                            style={{ opacity: model.active ? 0.18 + (model.energy * 0.25) : 0.07, transform: `scale(${1 + (model.energy * 0.5)})` }}
                        />
                        <div className={'absolute inset-[27%] rounded-full ' + palette.glow} style={{ opacity: model.active ? 0.82 : 0.28 }} />
                    </div>
                </div>
                <div className="mt-3 flex h-12 items-end gap-1.5">
                    {Array.from({ length: BAR_COUNT }).map((_, index) => {
                        const wave = 0.48 + (Math.sin((index * 1.18) + (model.energy * 5.7)) * 0.28);
                        const barHeight = model.active ? clamp(12 + (model.energy * 72 * wave) + (model.volume * 18), 10, 96) : 10;
                        return (
                            <div
                                key={index}
                                className={'w-full rounded-full bg-gradient-to-t ' + palette.meter}
                                style={{
                                    height: `${barHeight}%`,
                                    opacity: model.active ? 0.42 + (model.energy * 0.52) : 0.18,
                                    transition: 'height 180ms ease, opacity 180ms ease'
                                }}
                            />
                        );
                    })}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full border border-white/10 bg-black/35">
                    <div className={'h-full rounded-full bg-gradient-to-r ' + palette.meter} style={{ width: `${model.levelPct}%`, transition: 'width 180ms ease' }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] opacity-75">
                    <span>{model.status}</span>
                    <span>{helper}</span>
                    <span>{model.levelPct}%</span>
                </div>
            </div>
        </div>
    );
};

export default CrowdMicInputVisualizer;
