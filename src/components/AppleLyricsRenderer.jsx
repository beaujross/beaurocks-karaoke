import React, { useEffect, useRef, useMemo, useState } from 'react';
import { ASSETS } from '../lib/assets';

const TIME_TAG_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

const parseEmbeddedTimedLyrics = (rawLyrics) => {
    if (typeof rawLyrics !== 'string' || !rawLyrics.trim()) return [];
    const entries = [];
    rawLyrics.split(/\r?\n/).forEach((line) => {
        const tags = Array.from(line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g));
        if (!tags.length) return;
        const text = line.replace(TIME_TAG_RE, '').trim();
        if (!text) return;
        tags.forEach((tag) => {
            const mins = Number(tag[1] || 0);
            const secs = Number(tag[2] || 0);
            const fractionRaw = String(tag[3] || '');
            const fractionMs = fractionRaw
                ? (fractionRaw.length === 3 ? Number(fractionRaw) : fractionRaw.length === 2 ? Number(fractionRaw) * 10 : Number(fractionRaw) * 100)
                : 0;
            if (!Number.isFinite(mins) || !Number.isFinite(secs) || !Number.isFinite(fractionMs)) return;
            entries.push({
                startMs: Math.max(0, mins * 60000 + secs * 1000 + fractionMs),
                text
            });
        });
    });
    return entries.sort((a, b) => a.startMs - b.startMs);
};

const AppleLyricsRenderer = ({
    lyrics,
    timedLyrics,
    duration,
    art,
    title,
    artist,
    isActive,
    startTime,
    pausedAt,
    isPlaying,
    showAll = false,
    overlayMode = false,
    roomCode = '',
    joinUrlLabel = ''
}) => {
    const containerRef = useRef(null);
    const lineRefs = useRef([]);
    const parsedTimedLyrics = useMemo(() => parseEmbeddedTimedLyrics(lyrics), [lyrics]);
    const effectiveTimedLyrics = useMemo(() => {
        if (Array.isArray(timedLyrics) && timedLyrics.length) return timedLyrics;
        return parsedTimedLyrics;
    }, [timedLyrics, parsedTimedLyrics]);
    const lines = useMemo(() => {
        if (Array.isArray(effectiveTimedLyrics) && effectiveTimedLyrics.length) {
            return effectiveTimedLyrics.map(l => l.text).filter(l => l.trim());
        }
        return lyrics ? lyrics.split('\n').filter(l => l.trim()) : ["(Instrumental)", "Enjoy the music!"];
    }, [lyrics, effectiveTimedLyrics]);

    const [currentLine, setCurrentLine] = useState(0);
    const [currentMs, setCurrentMs] = useState(0);
    const currentLineRef = useRef(0);
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const userScrollTimeout = useRef(null);

    const handleInteraction = () => {
        if (!isPlaying) return;
        setIsUserScrolling(true);
        if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
        userScrollTimeout.current = setTimeout(() => setIsUserScrolling(false), 3000);
    };

    const lineTimeline = useMemo(() => {
        if (Array.isArray(effectiveTimedLyrics) && effectiveTimedLyrics.length) {
            return effectiveTimedLyrics.map((l, idx) => {
                const start = Number(l.startMs || 0);
                const nextStart = effectiveTimedLyrics[idx + 1]?.startMs;
                const end = Number(l.endMs || (nextStart ? Math.max(nextStart, start + 500) : start + 4000));
                return { start, end };
            });
        }
        const totalMs = (duration || 180) * 1000;
        const weights = lines.map(l => Math.max(1, l.length / 12));
        const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
        let acc = 0;
        return weights.map(w => {
            const span = (w / totalWeight) * totalMs;
            const start = acc;
            acc += span;
            return { start, end: acc };
        });
    }, [lines, duration, effectiveTimedLyrics]);

    useEffect(() => {
        if (!isActive || !startTime || !containerRef.current) return;
        let rafId;
        const totalMs = lineTimeline.length ? lineTimeline[lineTimeline.length - 1].end : (duration || 180) * 1000;

        const animate = () => {
            const now = Date.now();
            const elapsed = isPlaying
                ? now - startTime
                : (pausedAt && startTime ? pausedAt - startTime : 0);
            const clamped = Math.max(0, Math.min(totalMs, elapsed));
            setCurrentMs(clamped);
            const index = lineTimeline.findIndex(t => clamped >= t.start && clamped < t.end);
            const nextLine = index === -1 ? Math.max(0, lineTimeline.length - 1) : index;
            if (nextLine !== currentLineRef.current) {
                currentLineRef.current = nextLine;
                setCurrentLine(nextLine);
            }

            if (!showAll && !isUserScrolling && lineRefs.current[nextLine]) {
                const el = lineRefs.current[nextLine];
                const container = containerRef.current;
                const targetTop = el.offsetTop - container.clientHeight * 0.45;
                const currentTop = container.scrollTop;
                const dist = targetTop - currentTop;
                if (Math.abs(dist) > 500) {
                    container.scrollTop = targetTop;
                } else {
                    container.scrollTop = currentTop + dist * 0.08;
                }
            }

            if (clamped < totalMs + 1200) rafId = requestAnimationFrame(animate);
        };

        rafId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId);
    }, [isActive, duration, startTime, pausedAt, isPlaying, showAll, isUserScrolling, lineTimeline]);

    return (
        <div
            className={`absolute inset-0 z-50 overflow-hidden flex items-center justify-center font-bebas animate-in fade-in ${overlayMode ? 'bg-gradient-to-b from-black/35 via-black/10 to-black/50' : 'bg-black'}`}
            onTouchStart={handleInteraction}
            onWheel={handleInteraction}
        >
            {!overlayMode && (
                <div className="absolute inset-0 z-0 scale-110">
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-60 blur-[80px] animate-pulse-slow scale-150"
                        style={{ backgroundImage: `url(${art || ASSETS.logo})` }}
                    ></div>
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-30 blur-[40px] mix-blend-overlay"
                        style={{ backgroundImage: `url(${art || ASSETS.logo})` }}
                    ></div>
                    <div className="absolute inset-0 bg-black/40"></div>
                </div>
            )}

            <div className={`absolute left-5 bottom-5 md:left-7 md:bottom-7 z-30 border border-white/15 backdrop-blur-md shadow-[0_0_28px_rgba(0,0,0,0.28)] pointer-events-none ${
                overlayMode
                    ? 'rounded-2xl bg-black/58 px-4 py-3 max-w-[min(44vw,540px)]'
                    : 'rounded-[24px] bg-black/66 px-5 py-4 max-w-[min(48vw,680px)]'
            }`}>
                <div className="flex items-start gap-3 md:gap-4">
                    <img
                        src={art || ASSETS.logo}
                        alt="Album art"
                        className={`${overlayMode ? 'w-12 h-12 md:w-14 md:h-14' : 'w-14 h-14 md:w-20 md:h-20'} rounded-2xl object-cover border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]`}
                    />
                    <div className="min-w-0 flex-1">
                        <div className={`${overlayMode ? 'text-[10px] md:text-[11px]' : 'text-[11px] md:text-[13px]'} uppercase tracking-[0.28em] text-zinc-300`}>Now Playing</div>
                        <div className={`${overlayMode ? 'text-lg md:text-2xl' : 'text-2xl md:text-4xl'} font-black text-white leading-tight truncate`}>
                            {title || 'Now Playing'}
                        </div>
                        <div className={`${overlayMode ? 'text-sm md:text-base' : 'text-base md:text-xl'} text-zinc-300 truncate`}>
                            {artist || 'Stay synced with the track'}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className={`inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 ${overlayMode ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px] md:text-xs'} font-bold uppercase tracking-[0.18em] text-cyan-100`}>
                                <span className={`inline-block rounded-full ${isPlaying ? 'bg-emerald-400' : 'bg-amber-300'} ${overlayMode ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}></span>
                                {isPlaying ? 'Synced' : 'Paused'}
                            </div>
                            {!!roomCode && (
                                <div className={`inline-flex rounded-full border border-white/15 bg-black/40 ${overlayMode ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px] md:text-xs'} font-bold uppercase tracking-[0.18em] text-white`}>
                                    Room {roomCode}
                                </div>
                            )}
                        </div>
                        {!!joinUrlLabel && (
                            <div className="mt-2">
                                <div className={`${overlayMode ? 'text-[10px]' : 'text-[11px] md:text-xs'} uppercase tracking-[0.24em] text-zinc-400`}>Join On Your Phone</div>
                                <div className={`${overlayMode ? 'text-sm md:text-base' : 'text-lg md:text-2xl'} font-black text-cyan-100 tracking-[0.06em] leading-tight break-all`}>
                                    {joinUrlLabel}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div
                ref={containerRef}
                className={`relative z-20 w-full h-full overflow-y-auto px-6 md:px-20 text-center space-y-12 no-scrollbar ${showAll ? 'py-16' : 'py-[40vh]'}`}
                style={{
                    maskImage: showAll ? 'none' : 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                    WebkitMaskImage: showAll ? 'none' : 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
                }}
            >
                {lines.map((l, i) => {
                    const timeline = lineTimeline[i] || { start: 0, end: 1 };
                    const span = Math.max(1, timeline.end - timeline.start);
                    const progress = Math.min(1, Math.max(0, (currentMs - timeline.start) / span));
                    const percent = Math.round(progress * 100);
                    const isActive = i === currentLine;
                    const fillStyle = isActive ? {
                        backgroundImage: `linear-gradient(90deg, #00C4D9 0%, #EC4899 ${percent}%, rgba(255,255,255,0.6) ${percent}%, rgba(255,255,255,0.6) 100%)`,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                        WebkitTextFillColor: 'transparent'
                    } : {};
                    return (
                    <div
                        key={i}
                        ref={el => { lineRefs.current[i] = el; }}
                        className={`text-4xl md:text-8xl font-black leading-tight transition-all duration-300 transform origin-center cursor-pointer ${
                            isActive
                                ? 'drop-shadow-2xl scale-[1.02]'
                                : 'text-white/70 opacity-80'
                        }`}
                        style={fillStyle}
                    >
                        {l}
                    </div>
                );
                })}
                {!showAll && <div className="h-[50vh]"></div>}
            </div>

            <div className="absolute top-6 right-6 z-30 flex flex-col gap-2 items-end">
                <div className={`px-4 py-1 rounded-full border border-white/20 text-xs font-bold text-white flex items-center gap-2 backdrop-blur-md ${isPlaying ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    {isPlaying ? 'SYNCED' : 'PAUSED'}
                </div>
                <div className="text-[10px] text-zinc-300 uppercase tracking-[0.3em]">{showAll ? 'Full View' : 'Auto Scroll'}</div>
            </div>
        </div>
    );
};

export default AppleLyricsRenderer;
