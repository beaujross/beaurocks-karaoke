import React from 'react';
import { withAudienceBrandAlpha } from '../../../lib/audienceBrandTheme';

export default function HostPlaybackDock({
    playback = {},
    onTogglePlay = null,
    onRestartPlayback = null,
    onOpenBackingWindow = null,
    hasCurrentPerformance = false,
    canOpenBackingWindow = false,
    brandTheme = null,
}) {
    const playing = playback?.playing === true;
    const songTitle = String(playback?.songTitle || '').trim();
    const artistName = String(playback?.artistName || '').trim();
    const elapsedLabel = String(playback?.elapsedLabel || '').trim();
    const durationLabel = String(playback?.durationLabel || '').trim();
    const progressPct = Math.max(0, Math.min(100, Number(playback?.progressPct || 0) || 0));
    const sourceLabel = String(playback?.sourceLabel || '').trim();
    const primaryColor = String(brandTheme?.primaryColor || '#00C4D9').trim() || '#00C4D9';
    const secondaryColor = String(brandTheme?.secondaryColor || '#FF67B6').trim() || '#FF67B6';
    const accentColor = String(brandTheme?.accentColor || '#FACC15').trim() || '#FACC15';
    const elapsedSafe = elapsedLabel || '0:00';
    const durationSafe = durationLabel || '--:--';
    const mainButtonDisabled = !hasCurrentPerformance || typeof onTogglePlay !== 'function';
    const restartDisabled = !hasCurrentPerformance || typeof onRestartPlayback !== 'function';
    const popOutDisabled = !hasCurrentPerformance || !canOpenBackingWindow || typeof onOpenBackingWindow !== 'function';

    return (
        <div
            className="relative overflow-hidden rounded-[22px] border px-3 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
            style={{
                borderColor: withAudienceBrandAlpha(accentColor, 0.24),
                backgroundImage: [
                    `radial-gradient(circle at top left, ${withAudienceBrandAlpha(accentColor, 0.18)}, transparent 30%)`,
                    `radial-gradient(circle at bottom right, ${withAudienceBrandAlpha(secondaryColor, 0.14)}, transparent 35%)`,
                    `linear-gradient(145deg, rgba(18,11,20,0.96), ${withAudienceBrandAlpha(accentColor, 0.18)})`,
                ].join(', '),
                boxShadow: `0 18px 48px ${withAudienceBrandAlpha(accentColor, 0.12)}`,
            }}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                    backgroundImage: `linear-gradient(90deg, transparent, ${withAudienceBrandAlpha('#ffffff', 0.06)}, transparent)`,
                }}
            />
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] lg:items-stretch">
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                        <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border bg-black/30 text-lg"
                            style={{ borderColor: withAudienceBrandAlpha(primaryColor, 0.2) }}
                        >
                            <i className="fa-solid fa-compact-disc text-zinc-200"></i>
                        </div>
                        <div className="min-w-0">
                            <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: accentColor }}>
                                Backing Track
                            </div>
                            <div className="truncate text-[15px] font-black text-white">
                                {songTitle || sourceLabel || 'No source active'}
                            </div>
                            <div className="truncate text-[11px] text-zinc-300">
                                {artistName || sourceLabel || 'Waiting for stage'}
                            </div>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            <span>{sourceLabel || 'No source active'}</span>
                            <span>{hasCurrentPerformance ? (playing ? 'Live' : 'Paused') : 'Idle'}</span>
                        </div>
                        <div
                            className="relative h-2 overflow-hidden rounded-full bg-white/8"
                            style={{
                                boxShadow: `inset 0 0 0 1px ${withAudienceBrandAlpha(primaryColor, 0.08)}`,
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-40"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 12px, rgba(255,255,255,0.08) 12px 13px)',
                                }}
                            />
                            <div
                                className="relative h-full rounded-full transition-[width]"
                                style={{
                                    width: `${progressPct}%`,
                                    backgroundImage: `linear-gradient(90deg, ${withAudienceBrandAlpha(primaryColor, 0.95)}, ${withAudienceBrandAlpha(secondaryColor, 0.85)})`,
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div
                    className="min-w-[360px] rounded-[24px] border px-3 py-3"
                    style={{
                        borderColor: withAudienceBrandAlpha(accentColor, 0.22),
                        backgroundImage: [
                            `radial-gradient(circle at 14% 18%, ${withAudienceBrandAlpha(primaryColor, 0.14)}, transparent 28%)`,
                            `radial-gradient(circle at 84% 22%, ${withAudienceBrandAlpha(accentColor, 0.12)}, transparent 24%)`,
                            `linear-gradient(160deg, rgba(7,9,16,0.98), rgba(17,10,24,0.95))`,
                        ].join(', '),
                        boxShadow: [
                            `inset 0 1px 0 ${withAudienceBrandAlpha('#ffffff', 0.06)}`,
                            `0 18px 40px ${withAudienceBrandAlpha(primaryColor, 0.08)}`,
                        ].join(', '),
                    }}
                    data-host-playback-transport="true"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: accentColor }}>
                                Player
                            </div>
                        </div>
                        <div
                            className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                            style={{
                                borderColor: withAudienceBrandAlpha(primaryColor, 0.18),
                                backgroundColor: withAudienceBrandAlpha(primaryColor, 0.07),
                                color: '#d5f8fd',
                            }}
                        >
                            <i className="fa-solid fa-waveform-lines text-[10px]"></i>
                            <span>{playing ? 'Playing' : 'Paused'}</span>
                        </div>
                    </div>
                    <div
                        className="mt-3 rounded-[22px] border px-4 py-3"
                        style={{
                            borderColor: withAudienceBrandAlpha('#ffffff', 0.09),
                            backgroundImage: [
                                `linear-gradient(180deg, ${withAudienceBrandAlpha('#ffffff', 0.04)}, transparent 38%)`,
                                `linear-gradient(160deg, rgba(3,6,12,0.82), rgba(6,9,15,0.96))`,
                            ].join(', '),
                            boxShadow: `inset 0 1px 0 ${withAudienceBrandAlpha('#ffffff', 0.06)}`,
                        }}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-[12px] font-black text-white">{elapsedSafe}</div>
                            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Position</div>
                            <div className="text-[12px] font-black text-white">{durationSafe}</div>
                        </div>
                        <div
                            className="relative mt-2 h-2.5 overflow-hidden rounded-full"
                            style={{
                                backgroundColor: withAudienceBrandAlpha('#ffffff', 0.06),
                                boxShadow: `inset 0 0 0 1px ${withAudienceBrandAlpha('#ffffff', 0.04)}`,
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-35"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 14px, rgba(255,255,255,0.08) 14px 15px)',
                                }}
                            />
                            <div
                                className="absolute inset-y-0 left-0 rounded-full transition-[width]"
                                style={{
                                    width: `${progressPct}%`,
                                    backgroundImage: `linear-gradient(90deg, ${withAudienceBrandAlpha(primaryColor, 0.95)}, ${withAudienceBrandAlpha(secondaryColor, 0.82)}, ${withAudienceBrandAlpha(accentColor, 0.88)})`,
                                }}
                            />
                            <div
                                className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border"
                                style={{
                                    left: `calc(${progressPct}% - 8px)`,
                                    borderColor: withAudienceBrandAlpha('#ffffff', 0.45),
                                    backgroundColor: '#ffffff',
                                    boxShadow: `0 0 0 4px ${withAudienceBrandAlpha(primaryColor, 0.16)}`,
                                }}
                            />
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[14px] font-black text-white">
                                    {playing ? 'Backing is live' : 'Backing is paused'}
                                </div>
                                <div className="truncate text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                                    {sourceLabel || 'No source active'}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={restartDisabled}
                                    onClick={onRestartPlayback}
                                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${restartDisabled ? 'cursor-not-allowed opacity-45' : ''}`}
                                    style={{
                                        borderColor: withAudienceBrandAlpha(primaryColor, 0.22),
                                        backgroundImage: `linear-gradient(180deg, ${withAudienceBrandAlpha(primaryColor, 0.12)}, ${withAudienceBrandAlpha('#04070d', 0.82)})`,
                                        color: '#E4F7FB',
                                    }}
                                    aria-label="Restart backing track"
                                >
                                    <i className="fa-solid fa-rotate-left text-[15px]"></i>
                                </button>
                                <button
                                    type="button"
                                    disabled={mainButtonDisabled}
                                    onClick={onTogglePlay}
                                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border text-[20px] transition ${mainButtonDisabled ? 'cursor-not-allowed opacity-45' : ''}`}
                                    style={playing
                                        ? {
                                            borderColor: withAudienceBrandAlpha(accentColor, 0.5),
                                            backgroundImage: `linear-gradient(180deg, ${withAudienceBrandAlpha(accentColor, 0.34)}, ${withAudienceBrandAlpha(accentColor, 0.14)})`,
                                            color: '#FEF3C7',
                                            boxShadow: `0 18px 40px ${withAudienceBrandAlpha(accentColor, 0.18)}`,
                                        }
                                        : {
                                            borderColor: withAudienceBrandAlpha(primaryColor, 0.46),
                                            backgroundImage: `linear-gradient(180deg, ${withAudienceBrandAlpha(primaryColor, 0.34)}, ${withAudienceBrandAlpha(primaryColor, 0.12)})`,
                                            color: '#CFFAFE',
                                            boxShadow: `0 18px 40px ${withAudienceBrandAlpha(primaryColor, 0.16)}`,
                                        }}
                                    aria-label={playing ? 'Pause backing track' : 'Play backing track'}
                                >
                                    <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'} ${playing ? '' : 'translate-x-[2px]'}`}></i>
                                </button>
                                <button
                                    type="button"
                                    disabled={popOutDisabled}
                                    onClick={onOpenBackingWindow}
                                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${popOutDisabled ? 'cursor-not-allowed opacity-45' : ''}`}
                                    style={{
                                        borderColor: withAudienceBrandAlpha(primaryColor, 0.22),
                                        backgroundImage: `linear-gradient(180deg, ${withAudienceBrandAlpha(primaryColor, 0.12)}, ${withAudienceBrandAlpha('#04070d', 0.82)})`,
                                        color: '#E4F7FB',
                                    }}
                                    aria-label="Open backing track in pop out"
                                >
                                    <i className="fa-solid fa-up-right-from-square text-[14px]"></i>
                                </button>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-6 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">
                            <span>Restart</span>
                            <span>{playing ? 'Pause' : 'Play'}</span>
                            <span>Pop Out</span>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">
                        <span>{artistName || 'No artist loaded'}</span>
                        <span>{sourceLabel || 'No source active'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
