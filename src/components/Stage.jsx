import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import AppleLyricsRenderer from './AppleLyricsRenderer';
import { EMOJI } from '../lib/emoji';

const nowMs = () => Date.now();

const Stage = ({ room, current, minimalUI = false, fitToWindow = false, showVideo = true, runOfShowHud = null, onPlaybackEvent = null }) => {
    const mediaUrl = current?.mediaUrl || room?.mediaUrl;
    const isBackingAudioOnly = current?.backingAudioOnly || false;
    const applePlayback = room?.appleMusicPlayback || null;
    const applePlaybackActive = !!applePlayback?.id;
    const roomCode = String(room?.roomCode || room?.code || '').trim().toUpperCase();
    const joinUrlLabel = String(room?.joinUrlLabel || '').trim();
    const showVisualizerTv = !!room?.showVisualizerTv;
    const hideVideoVisuals = showVisualizerTv;
    const hasLyrics = !!(current?.lyrics && String(current.lyrics).trim()) || (Array.isArray(current?.lyricsTimed) && current.lyricsTimed.length > 0);
    
    const isAudioOnly = !!(current?.audioOnly) || (mediaUrl && /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(mediaUrl));
    // Detect Native Video (mp4, webm, ogg)
    const isNativeVideo = mediaUrl && /\.(mp4|webm|ogg)$/i.test(mediaUrl);
    // Detect YouTube (fallback)
    const isYoutube = mediaUrl && mediaUrl.includes('youtube');
    const youtubeId = isYoutube ? mediaUrl.split('v=')[1]?.split('&')[0] : null;
    const nowPlayingLabel = useMemo(() => {
        if (applePlaybackActive) {
            return {
                source: 'Apple Music',
                title: applePlayback?.title || 'Apple Music',
                state: applePlayback?.status === 'paused' ? 'Paused' : 'Live',
                sourceKey: 'apple',
            };
        }
        if (mediaUrl) {
            const state = room?.videoPlaying ? 'Playing' : 'Paused';
            const source = isYoutube ? 'YouTube' : isNativeVideo ? 'Local Video' : isAudioOnly ? 'Local Audio' : 'Media';
            const title = current?.songTitle || 'Now Playing';
            const sourceKey = isYoutube ? 'youtube' : (isNativeVideo || isAudioOnly) ? 'local' : 'media';
            return { source, title, state, sourceKey };
        }
        return null;
    }, [applePlaybackActive, applePlayback?.title, applePlayback?.status, mediaUrl, room?.videoPlaying, isYoutube, isNativeVideo, isAudioOnly, current?.songTitle]);
    
    const layout = room?.layoutMode || 'standard';
    const iframeSrc = useMemo(() => {
        const start = room?.videoStartTimestamp ? (nowMs() - room.videoStartTimestamp) / 1000 : 0;
        const pageOrigin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=0&start=${Math.floor(Math.max(0, start))}&enablejsapi=1&playsinline=1&origin=${pageOrigin}&rel=0&modestbranding=1`;
    }, [youtubeId, room?.videoStartTimestamp]);

    const iframeRef = useRef(null);
    const nativeVideoRef = useRef(null);
    const audioRef = useRef(null);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    const nativeHeartbeatBucketRef = useRef('');
    const youtubeHeartbeatBucketRef = useRef('');
    const youtubeEndedEventRef = useRef('');
    const reportPlaybackEvent = useCallback((event = {}) => {
        if (typeof onPlaybackEvent !== 'function') return;
        onPlaybackEvent(event);
    }, [onPlaybackEvent]);
    const idleMicSizeClass = fitToWindow ? 'text-[clamp(4.5rem,15vw,8.5rem)]' : 'text-[12rem]';
    const idleHeadingSizeClass = fitToWindow ? 'text-[clamp(2.75rem,8vw,6rem)]' : 'text-8xl';
    const idleCtaSizeClass = fitToWindow ? 'text-[clamp(1rem,3vw,2rem)] px-5 py-2 md:px-7' : 'text-4xl px-8 py-2';
    const autoDjHeadingSizeClass = fitToWindow ? 'text-[clamp(3.5rem,10vw,7rem)]' : 'text-9xl';
    const autoDjCtaSizeClass = fitToWindow ? 'text-[clamp(1.1rem,3vw,2rem)] px-5 py-2 md:px-8' : 'text-4xl px-8 py-2';
    const heroWrapClass = fitToWindow ? 'max-w-[min(90vw,68rem)]' : 'max-w-5xl';
    const artSizeClass = fitToWindow
        ? 'w-[min(20vh,18vw)] h-[min(20vh,18vw)] min-w-[6.5rem] min-h-[6.5rem] max-w-[13rem] max-h-[13rem]'
        : 'w-[30vh] h-[30vh]';
    const titleSizeClass = fitToWindow
        ? (minimalUI ? 'text-[clamp(2.25rem,6.8vw,5.4rem)]' : 'text-[clamp(2.8rem,7.5vw,6.6rem)]')
        : (minimalUI ? 'text-[8vw]' : 'text-[10vw]');
    const artistSizeClass = fitToWindow
        ? (minimalUI ? 'text-[clamp(1rem,2.7vw,2.25rem)]' : 'text-[clamp(1.25rem,3.6vw,3.2rem)]')
        : (minimalUI ? 'text-[3vw]' : 'text-[5vw]');
    const cornerWrapClass = fitToWindow
        ? 'absolute bottom-4 left-4 md:bottom-6 md:left-6 z-50 bg-black/65 p-4 md:p-5 rounded-2xl border border-white/20 flex gap-4 md:gap-5 items-start animate-slide-in-from-bottom max-w-[min(92vw,46rem)] pointer-events-none'
        : 'absolute bottom-8 left-8 z-50 bg-black/65 p-6 rounded-2xl border border-white/20 flex gap-6 items-start animate-slide-in-from-bottom max-w-[86vw] pointer-events-none';
    const cornerArtClass = fitToWindow
        ? 'w-20 h-20 md:w-24 md:h-24 rounded-xl shadow-lg object-cover'
        : 'w-24 h-24 sm:w-32 sm:h-32 rounded-xl shadow-lg';
    const cornerSingerSizeClass = fitToWindow
        ? 'text-[clamp(1.9rem,5.6vw,4.75rem)]'
        : 'text-5xl sm:text-8xl';
    const cornerSongSizeClass = fitToWindow
        ? 'text-[clamp(1.05rem,2.8vw,2.3rem)]'
        : 'text-2xl sm:text-4xl';

    useEffect(() => {
        const resetTimer = setTimeout(() => setAutoplayBlocked(false), 0);
        return () => clearTimeout(resetTimer);
    }, [mediaUrl]);
    
    useEffect(() => {
        if (iframeRef.current && room?.videoVolume !== undefined) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ "event": "command", "func": "setVolume", "args": [room.videoVolume] }), "*");
        }
    }, [room?.videoVolume]);

    useEffect(() => {
        if (nativeVideoRef.current && room?.videoVolume !== undefined) {
            nativeVideoRef.current.volume = room.videoVolume / 100;
        }
    }, [room?.videoVolume]);
    
    useEffect(() => {
        if (audioRef.current && room?.videoVolume !== undefined) {
            audioRef.current.volume = room.videoVolume / 100;
        }
    }, [room?.videoVolume]);

    useEffect(() => {
        nativeHeartbeatBucketRef.current = '';
        youtubeHeartbeatBucketRef.current = '';
        youtubeEndedEventRef.current = '';
    }, [mediaUrl, room?.videoStartTimestamp]);

    useEffect(() => {
        const mediaElement = isAudioOnly ? audioRef.current : nativeVideoRef.current;
        if (!mediaElement || isYoutube || isBackingAudioOnly) return undefined;

        const getDurationSec = () => {
            const duration = Number(mediaElement.duration || 0);
            return Number.isFinite(duration) && duration > 0 ? duration : 0;
        };
        const emit = (type, extra = {}) => {
            reportPlaybackEvent({
                type,
                currentTimeSec: Math.max(0, Number(mediaElement.currentTime || 0)),
                durationSec: getDurationSec(),
                ...extra
            });
        };
        const handleLoadedMetadata = () => emit('ready');
        const handlePlay = () => emit('playing');
        const handlePause = () => {
            if (!mediaElement.ended) emit('paused');
        };
        const handleEnded = () => emit('ended', { completionReason: 'player_ended' });
        const handleError = () => emit('error', { error: 'media_error', completionReason: 'player_error' });
        const handleTimeUpdate = () => {
            const heartbeatBucket = `${String(mediaUrl || '')}:${Math.floor(Math.max(0, Number(mediaElement.currentTime || 0)) / 5)}`;
            if (nativeHeartbeatBucketRef.current === heartbeatBucket) return;
            nativeHeartbeatBucketRef.current = heartbeatBucket;
            emit('heartbeat');
        };

        mediaElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        mediaElement.addEventListener('play', handlePlay);
        mediaElement.addEventListener('pause', handlePause);
        mediaElement.addEventListener('ended', handleEnded);
        mediaElement.addEventListener('error', handleError);
        mediaElement.addEventListener('timeupdate', handleTimeUpdate);
        return () => {
            mediaElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            mediaElement.removeEventListener('play', handlePlay);
            mediaElement.removeEventListener('pause', handlePause);
            mediaElement.removeEventListener('ended', handleEnded);
            mediaElement.removeEventListener('error', handleError);
            mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [isAudioOnly, isBackingAudioOnly, isYoutube, mediaUrl, reportPlaybackEvent]);

    useEffect(() => {
        if (!isYoutube || !youtubeId) return undefined;
        const handleMessage = (event) => {
            const origin = String(event?.origin || '').toLowerCase();
            if (!origin.includes('youtube.com')) return;
            let payload = event?.data;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch {
                    return;
                }
            }
            if (!payload || typeof payload !== 'object') return;

            const safeDurationSec = Number(payload?.info?.duration || payload?.info?.videoData?.duration || 0);
            const safeCurrentTimeSec = Number(payload?.info?.currentTime || 0);
            if (payload.event === 'onReady') {
                reportPlaybackEvent({ type: 'ready', durationSec: safeDurationSec });
                return;
            }
            if (payload.event === 'onStateChange') {
                const stateCode = Number(payload.info);
                if (stateCode === 1) reportPlaybackEvent({ type: 'playing', currentTimeSec: safeCurrentTimeSec, durationSec: safeDurationSec });
                else if (stateCode === 2) reportPlaybackEvent({ type: 'paused', currentTimeSec: safeCurrentTimeSec, durationSec: safeDurationSec });
                else if (stateCode === 0) {
                    const endedKey = `${youtubeId}:${room?.videoStartTimestamp || 0}`;
                    if (youtubeEndedEventRef.current === endedKey) return;
                    youtubeEndedEventRef.current = endedKey;
                    reportPlaybackEvent({ type: 'ended', currentTimeSec: safeCurrentTimeSec, durationSec: safeDurationSec, completionReason: 'player_ended' });
                } else if (stateCode === 3) {
                    reportPlaybackEvent({ type: 'heartbeat', currentTimeSec: safeCurrentTimeSec, durationSec: safeDurationSec });
                }
                return;
            }
            if (payload.event === 'infoDelivery' && payload.info && typeof payload.info === 'object') {
                if (safeCurrentTimeSec > 0 || safeDurationSec > 0) {
                    const heartbeatBucket = `${youtubeId}:${Math.floor(Math.max(0, safeCurrentTimeSec) / 5)}`;
                    if (youtubeHeartbeatBucketRef.current !== heartbeatBucket) {
                        youtubeHeartbeatBucketRef.current = heartbeatBucket;
                        reportPlaybackEvent({ type: 'heartbeat', currentTimeSec: safeCurrentTimeSec, durationSec: safeDurationSec });
                    }
                }
                if (Number(payload.info.playerState) === 0) {
                    const endedKey = `${youtubeId}:${room?.videoStartTimestamp || 0}`;
                    if (youtubeEndedEventRef.current === endedKey) return;
                    youtubeEndedEventRef.current = endedKey;
                    reportPlaybackEvent({ type: 'ended', currentTimeSec: safeCurrentTimeSec, durationSec: safeDurationSec, completionReason: 'player_ended' });
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [isYoutube, room?.videoStartTimestamp, reportPlaybackEvent, youtubeId]);

    useEffect(() => {
        if (!isYoutube || !youtubeId || !iframeRef.current?.contentWindow) return undefined;
        const sendListening = () => {
            if (!iframeRef.current?.contentWindow) return;
            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                event: 'listening',
                id: youtubeId,
                channel: 'widget'
            }), '*');
        };
        const first = setTimeout(sendListening, 100);
        const second = setTimeout(sendListening, 900);
        const third = setTimeout(sendListening, 1800);
        return () => {
            clearTimeout(first);
            clearTimeout(second);
            clearTimeout(third);
        };
    }, [iframeSrc, isYoutube, youtubeId]);

    // Open backing audio window for non-embeddable videos
    useEffect(() => {
        if (isBackingAudioOnly && isYoutube && youtubeId && room?.videoPlaying && !window.backingAudioWindow) {
            const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
            window.backingAudioWindow = window.open(youtubeUrl, 'backingAudio', 'width=400,height=300,menubar=no,location=no');
        }
    }, [isBackingAudioOnly, isYoutube, youtubeId, room?.videoPlaying]);
    
    useEffect(() => {
        if (!window.backingAudioWindow) return;
        if (!isBackingAudioOnly || !room?.videoPlaying) {
            try {
                window.backingAudioWindow.close();
            } catch (e) {
                console.warn('Failed to close backing audio window', e);
            }
            window.backingAudioWindow = null;
        }
    }, [isBackingAudioOnly, room?.videoPlaying, mediaUrl]);

    // Smart Sync
    useEffect(() => {
        if (!isNativeVideo || !nativeVideoRef.current || !room?.videoStartTimestamp || isAudioOnly) return;
        const syncInterval = setInterval(() => {
            const video = nativeVideoRef.current;
            if (!video) return;
            if (room.videoPlaying) {
                 const targetTime = (nowMs() - room.videoStartTimestamp) / 1000;
                 if (Math.abs(video.currentTime - targetTime) > 0.5) video.currentTime = targetTime;
                 if (video.paused) {
                    video.play().then(() => setAutoplayBlocked(false)).catch(e => {
                        setAutoplayBlocked(true);
                        console.log("Auto-play blocked", e);
                    });
                 }
            } else {
                if (!video.paused) video.pause();
            }
        }, 1000);
        return () => clearInterval(syncInterval);
    }, [isNativeVideo, room?.videoPlaying, room?.videoStartTimestamp, isAudioOnly]);
    
    useEffect(() => {
        if (!isAudioOnly || !audioRef.current || !room?.videoStartTimestamp) return;
        const syncInterval = setInterval(() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (room.videoPlaying) {
                 const targetTime = (nowMs() - room.videoStartTimestamp) / 1000;
                 if (Math.abs(audio.currentTime - targetTime) > 0.5) audio.currentTime = targetTime;
                 if (audio.paused) audio.play().catch(() => {});
            } else {
                if (!audio.paused) audio.pause();
            }
        }, 1000);
        return () => clearInterval(syncInterval);
    }, [isAudioOnly, room?.videoPlaying, room?.videoStartTimestamp]);

    // 1. Idle State (No song)
    if (!current && !room?.mediaUrl) { 
        if (showVisualizerTv) {
            return null;
        }
        if (minimalUI) {
            return null;
        }
        if (room?.autoDjMode) { 
            return (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-50 bg-gradient-to-r from-purple-900 to-blue-900 animate-gradient">
                    <h1 className={`${autoDjHeadingSizeClass} font-bebas text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-pink-200 drop-shadow-xl animate-pulse`}>AUTO DJ</h1>
                    <div className={`${autoDjCtaSizeClass} font-bold text-white mt-4 tracking-widest bg-black/50 rounded-full animate-bounce`}>SCAN QR TO REQUEST!</div>
                </div>
            ); 
        } 
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-80">
                <div className={`${idleMicSizeClass} mb-4 animate-bounce`}>{EMOJI.mic}</div>
                <div className={`${idleHeadingSizeClass} font-bebas text-white drop-shadow-xl`}>STAGE OPEN</div>
                <div className={`${idleCtaSizeClass} font-black text-white bg-fuchsia-700 border-2 border-fuchsia-300/70 rounded-full mt-4 shadow-[0_0_24px_rgba(232,121,249,0.45)] animate-pulse`}>SCAN TO SING</div>
            </div>
        ); 
    }

    return (
        <React.Fragment> 
            {/* LAYER 1: VIDEO PLAYER (Always mounted to keep audio playing) */}
            <div className="absolute inset-0 z-0">
                {showVideo && !isBackingAudioOnly && layout !== 'cinema' && (
                    isAudioOnly ? (
                        <div className={`absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-zinc-900 ${hideVideoVisuals ? 'opacity-0' : ''}`}></div>
                    ) : isNativeVideo ? (
                        <video
                            ref={nativeVideoRef}
                            src={mediaUrl}
                            className={`absolute inset-0 w-full h-full object-cover ${hideVideoVisuals ? 'opacity-0' : 'opacity-70'}`}
                            muted={false}
                            playsInline
                            preload="auto"
                        />
                    ) : (isYoutube && youtubeId ? (
                        room?.videoPlaying ? 
                            <iframe ref={iframeRef} className={`absolute inset-0 w-full h-full pointer-events-none ${hideVideoVisuals ? 'opacity-0' : 'opacity-70'}`} src={iframeSrc} allow="autoplay" title="YT" frameBorder="0"></iframe> 
                        : <div className={`absolute inset-0 w-full h-full bg-black/50 flex items-center justify-center text-2xl font-bold ${hideVideoVisuals ? 'opacity-0' : 'opacity-50'}`}>VIDEO PAUSED</div>
                    ) : null)
                )}
                {!isBackingAudioOnly && isAudioOnly && (
                    <audio ref={audioRef} src={mediaUrl} preload="auto" />
                )}
                
                {showVideo && !isBackingAudioOnly && layout === 'cinema' && (
                     isAudioOnly ? (
                        <div className={`absolute inset-0 bg-black flex items-center justify-center text-white text-4xl font-bebas ${hideVideoVisuals ? 'opacity-0' : ''}`}>AUDIO ONLY</div>
                    ) : isNativeVideo ? (
                        <video
                            ref={nativeVideoRef}
                            src={mediaUrl}
                            className={`absolute inset-0 w-full h-full object-contain bg-black ${hideVideoVisuals ? 'opacity-0' : ''}`}
                            playsInline
                            preload="auto"
                        />
                    ) : (isYoutube && youtubeId && (
                        room?.videoPlaying ? 
                            <iframe ref={iframeRef} className={`absolute inset-0 w-full h-full pointer-events-none ${hideVideoVisuals ? 'opacity-0' : ''}`} src={iframeSrc} allow="autoplay" title="YT" frameBorder="0"></iframe> 
                        : <div className={`absolute inset-0 bg-black flex items-center justify-center text-4xl font-bold ${hideVideoVisuals ? 'opacity-0' : ''}`}>WAITING FOR HOST...</div>
                    ))
                )}

                {isBackingAudioOnly && (
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-900 via-blue-900 to-cyan-900 flex flex-col items-center justify-center text-center z-50">
                        <div className="text-8xl mb-8 animate-pulse">{EMOJI.radio}</div>
                        <h1 className="text-6xl font-bebas text-white mb-4 drop-shadow-lg">BACKING AUDIO</h1>
                        <p className="text-2xl text-cyan-200 font-bold">Opening in popup window...</p>
                        <p className="text-lg text-zinc-300 mt-8">The audio is playing in a separate window.</p>
                        <p className="text-lg text-zinc-300">Lyrics will show here on stage.</p>
                    </div>
                )}
            </div>

            {/* LAYER 2: LYRICS OVERLAY (Z-Index 40 - Above Video, Below HUD) */}
            {room?.showLyricsTv && hasLyrics && (
                <div className="absolute inset-0 z-40">
                    <AppleLyricsRenderer 
                        lyrics={current.lyrics} 
                        timedLyrics={current.lyricsTimed}
                        duration={current.duration || 180} 
                        art={current.albumArtUrl} 
                        title={current.songTitle}
                        artist={current.artist}
                        isActive={true} 
                        startTime={room.videoStartTimestamp}
                        pausedAt={room.pausedAt}
                        isPlaying={room.videoPlaying}
                        showAll={room?.lyricsMode === 'full'}
                        overlayMode={showVisualizerTv}
                        roomCode={roomCode}
                        joinUrlLabel={joinUrlLabel}
                    />
                </div>
            )}
            
            {/* LAYER 3: HUD / INFO (Z-Index 50+) */}
            {!room?.hideOverlay && current && layout !== 'cinema' && !room?.showLyricsTv && !showVisualizerTv && ( 
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center z-10 p-4 sm:p-6 md:p-8 lg:p-10">
                    {!minimalUI && <div className={`${fitToWindow ? 'bg-pink-600 text-white px-4 py-2 md:px-5 rounded-full font-bold tracking-[0.18em] text-xs md:text-sm inline-block mb-5 md:mb-7 shadow-lg' : 'bg-pink-600 text-white px-6 py-2 rounded-full font-bold tracking-widest inline-block mb-8 shadow-lg'}`}>NOW PERFORMING</div>}
                    <div className={`flex flex-col items-center gap-3 md:gap-4 ${heroWrapClass} mx-auto w-full`}>
                        {current.albumArtUrl && !minimalUI && <img src={current.albumArtUrl} className={`${artSizeClass} rounded-2xl shadow-2xl border-4 border-white/20 object-cover`} alt="Art"/>}
                        <div className="text-center relative z-20 w-full">
                            <h1 className={`${titleSizeClass} font-bebas text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 leading-[0.92] mb-2 drop-shadow-xl px-4 truncate`}>{current.songTitle}</h1>
                            <h2 className={`${artistSizeClass} text-zinc-300 font-light truncate px-4`}>{current.artist}</h2>
                        </div>
                    </div>
                </div> 
            )} 
            
            {autoplayBlocked && room?.videoPlaying && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center pointer-events-auto">
                    <button
                        onClick={() => {
                            if (nativeVideoRef.current) {
                                nativeVideoRef.current.play().then(() => setAutoplayBlocked(false)).catch(() => {});
                            }
                        }}
                        className="px-6 py-3 rounded-full bg-black/80 border border-cyan-400/50 text-cyan-200 font-bold uppercase tracking-widest shadow-[0_0_25px_rgba(34,211,238,0.35)]"
                    >
                        Tap to Start Video
                    </button>
                </div>
            )}
            
            {/* CORNER INFO */}
            {!room?.hideCornerOverlay && current && !layout.includes('cinema') && !room?.showLyricsTv && (
                <div className={cornerWrapClass}>
                    {current.albumArtUrl && <img src={current.albumArtUrl} className={cornerArtClass} alt="Corner Art"/>}
                    <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="text-xl sm:text-2xl text-zinc-300 uppercase tracking-[0.14em] font-bold mb-1">On Stage</div>
                            {runOfShowHud && (
                                <div className="shrink-0 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">
                                    Run Of Show
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            {room?.showLyricsTv && (
                                <div className="text-sm text-cyan-200 bg-black/60 border border-cyan-400/30 inline-flex px-2.5 py-1 rounded-full">
                                    Lyrics Live
                                </div>
                            )}
                            {nowPlayingLabel && (
                                <div className="text-sm text-zinc-100 bg-black/65 border border-white/20 inline-flex px-2.5 py-1 rounded-full max-w-[82vw]">
                                    <span className={`${
                                        nowPlayingLabel.sourceKey === 'apple'
                                            ? 'text-emerald-300'
                                            : nowPlayingLabel.sourceKey === 'youtube'
                                                ? 'text-red-300'
                                                : 'text-cyan-200'
                                    }`}>{nowPlayingLabel.source}</span>
                                </div>
                            )}
                        </div>
                        <div className={`${cornerSingerSizeClass} font-black text-white leading-none mb-1 truncate`}>{current.singerName}</div>
                        <div className={`${cornerSongSizeClass} text-fuchsia-400 leading-none truncate`}>{current.songTitle}</div>
                        {runOfShowHud && (
                            <div className="mt-3 border-t border-white/12 pt-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/85">
                                            {runOfShowHud.eyebrow || 'Run Of Show'}
                                        </div>
                                        {runOfShowHud.nextLabel ? (
                                            <div className="mt-1 text-[0.8rem] font-semibold leading-snug text-zinc-200/78">
                                                {runOfShowHud.nextLabel}
                                            </div>
                                        ) : null}
                                    </div>
                                    {runOfShowHud.remainingMs > 0 ? (
                                        <div className="shrink-0 rounded-[1rem] border border-white/10 bg-black/35 px-3 py-2 text-right">
                                            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/58">
                                                {runOfShowHud.countdownLabel || 'Remaining'}
                                            </div>
                                            <div className="mt-1 text-[1.05rem] font-black leading-none text-white">
                                                {Math.max(0, Math.floor(runOfShowHud.remainingMs / 1000 / 60))}:{String(Math.max(0, Math.floor(runOfShowHud.remainingMs / 1000) % 60)).padStart(2, '0')}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

export default Stage;
