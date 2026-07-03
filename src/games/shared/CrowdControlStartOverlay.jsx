/* eslint-disable react-refresh/only-export-components -- shared game module exports a pure launch-state helper used by tests and runtime. */
import React from 'react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));

export const buildCrowdControlLaunchState = ({
    nowMs = Date.now(),
    launchAtMs = 0,
    warmupMs = 6200,
    micReady = false,
    requireMic = true,
    live = false,
    liveHoldMs = 2400
} = {}) => {
    const safeNow = Number(nowMs || Date.now());
    const safeLaunchAt = Math.max(0, Number(launchAtMs || 0));
    const safeWarmup = Math.max(1, Number(warmupMs || 6200));
    const countdownMs = safeLaunchAt ? Math.max(0, safeLaunchAt - safeNow) : 0;
    const countdownActive = countdownMs > 0;
    const needsMic = !!requireMic && !micReady;
    const liveAgeMs = safeLaunchAt ? Math.max(0, safeNow - safeLaunchAt) : 0;
    const liveBurst = !countdownActive && !needsMic && !!live && liveAgeMs <= liveHoldMs;
    if (countdownActive) {
        return {
            visible: true,
            stage: 'countdown',
            label: 'WARMUP',
            status: micReady ? 'TV feed live' : 'Waiting for Host mic',
            countdownSec: Math.max(1, Math.ceil(countdownMs / 1000)),
            progressPct: clamp(100 - ((countdownMs / safeWarmup) * 100), 0, 100)
        };
    }
    if (needsMic && !live) {
        return {
            visible: true,
            stage: 'mic_needed',
            label: 'MIC CHECK',
            status: 'Waiting for Host mic telemetry',
            countdownSec: 0,
            progressPct: 12
        };
    }
    if (liveBurst) {
        return {
            visible: true,
            stage: 'live',
            label: 'CROWD IS LIVE',
            status: 'Crowd is live now',
            countdownSec: 0,
            progressPct: 100
        };
    }
    return {
        visible: false,
        stage: 'running',
        label: 'LIVE',
        status: micReady ? 'TV feed live' : 'Running',
        countdownSec: 0,
        progressPct: 100
    };
};

const toneClasses = {
    cyan: 'border-cyan-200/45 bg-cyan-400/14 text-cyan-100 shadow-[0_0_70px_rgba(34,211,238,0.24)]',
    pink: 'border-pink-200/45 bg-pink-400/14 text-pink-100 shadow-[0_0_70px_rgba(244,114,182,0.24)]',
    emerald: 'border-emerald-200/45 bg-emerald-400/14 text-emerald-100 shadow-[0_0_70px_rgba(52,211,153,0.24)]',
    amber: 'border-amber-200/45 bg-amber-400/14 text-amber-100 shadow-[0_0_70px_rgba(251,191,36,0.24)]'
};

export const CrowdControlStartOverlay = ({
    modeTitle = 'Voice Game',
    nowMs = Date.now(),
    launchAtMs = 0,
    warmupMs = 6200,
    micReady = false,
    requireMic = true,
    live = false,
    controlLabel = 'The audience is driving this round now.',
    instruction = 'Sing together and watch the TV for the next cue.',
    accent = 'cyan',
    className = '',
    enabled = true
}) => {
    if (!enabled) return null;
    const state = buildCrowdControlLaunchState({ nowMs, launchAtMs, warmupMs, micReady, requireMic, live });
    if (!state.visible) return null;
    const tone = state.stage === 'mic_needed' ? toneClasses.amber : (toneClasses[accent] || toneClasses.cyan);
    const displayNumber = state.stage === 'countdown' ? state.countdownSec : 'GO';
    const mainLine = state.stage === 'live'
        ? controlLabel
        : state.stage === 'mic_needed'
            ? 'Host mic signal is idle. Keep watching the game and sing on the next cue.'
            : instruction;
    return (
        <div className={'pointer-events-none absolute inset-x-[6%] top-[10%] z-[80] flex justify-center ' + className} role="status" aria-live="polite">
            <div className={'w-[min(92vw,1120px)] overflow-hidden rounded-[30px] border bg-black/78 backdrop-blur-md ' + tone}>
                <div className="grid grid-cols-[minmax(96px,14vw)_1fr] items-stretch">
                    <div className="flex min-h-[160px] items-center justify-center border-r border-white/12 bg-white/10">
                        <div className="relative flex h-[clamp(5.5rem,10vw,8.5rem)] w-[clamp(5.5rem,10vw,8.5rem)] items-center justify-center rounded-full border border-white/20 bg-black/40">
                            <div className="absolute inset-2 rounded-full border-4 border-white/10" />
                            <div className="absolute inset-2 rounded-full border-4 border-current" style={{ clipPath: 'inset(' + (100 - state.progressPct) + '% 0 0 0)' }} />
                            <div className="text-[clamp(2.2rem,6vw,5.5rem)] font-black leading-none text-white">{displayNumber}</div>
                        </div>
                    </div>
                    <div className="px-6 py-5 md:px-8 md:py-6">
                        <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/70">
                            <span>{modeTitle}</span>
                            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1">{state.status}</span>
                        </div>
                        <div className="mt-2 text-[clamp(2.6rem,7vw,6.8rem)] font-black leading-none text-white">{state.label}</div>
                        {state.stage === 'live' && (
                            <div className="mt-3 inline-flex rounded-full border border-white/20 bg-white/12 px-4 py-1 text-[11px] font-black uppercase tracking-[0.28em] text-white shadow-[0_0_28px_rgba(255,255,255,0.16)]">Crowd is in control now</div>
                        )}
                        <div className="mt-3 max-w-4xl text-[clamp(1rem,2vw,1.65rem)] font-black uppercase tracking-[0.12em] text-white/86">{mainLine}</div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white/72">
                            <div className="rounded-2xl border border-white/10 bg-black/28 px-3 py-2">Watch TV cues</div>
                            <div className="rounded-2xl border border-white/10 bg-black/28 px-3 py-2">Sing together</div>
                            <div className="rounded-2xl border border-white/10 bg-black/28 px-3 py-2">Crowd controls now</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CrowdControlStartOverlay;
