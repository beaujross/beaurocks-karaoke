import React, { useEffect, useRef, useMemo, useState } from 'react';
import AppleLyricsRenderer from './AppleLyricsRenderer';
import { EMOJI } from '../lib/emoji';

const Stage = ({ room, current, minimalUI = false, showVideo = true }) => {
    const mediaUrl = current?.mediaUrl || room?.mediaUrl;
    const isBackingAudioOnly = current?.backingAudioOnly || false;
    const applePlayback = room?.appleMusicPlayback || null;
    const applePlaybackActive = !!applePlayback?.id;
    const showVisualizerTv = !!room?.showVisualizerTv;
    const hideVideoVisuals = showVisualizerTv;
    
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
        const start = room?.videoStartTimestamp ? (Date.now() - room.videoStartTimestamp) / 1000 : 0;
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=0&start=${Math.floor(Math.max(0, start))}&enablejsapi=1`;
    }, [youtubeId, room?.videoStartTimestamp]);

    const iframeRef = useRef(null);
    const nativeVideoRef = useRef(null);
    const audioRef = useRef(null);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);

    useEffect(() => {
        setAutoplayBlocked(false);
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
                 const targetTime = (Date.now() - room.videoStartTimestamp) / 1000;
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
                 const targetTime = (Date.now() - room.videoStartTimestamp) / 1000;
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
        if (room?.autoDjMode) { 
            return (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-50 bg-gradient-to-r from-purple-900 to-blue-900 animate-gradient">
                    <h1 className="text-9xl font-bebas text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-pink-200 drop-shadow-xl animate-pulse">AUTO DJ</h1>
                    <div className="text-4xl font-bold text-white mt-4 tracking-widest bg-black/50 px-8 py-2 rounded-full animate-bounce">SCAN QR TO REQUEST!</div>
                </div>
            ); 
        } 
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-80">
                <div className="text-[12rem] mb-4 animate-bounce">{EMOJI.mic}</div>
                <div className="text-8xl font-bebas text-white drop-shadow-xl">STAGE OPEN</div>
                <div className="text-4xl font-bold text-pink-500 bg-white px-8 py-2 rounded-full mt-4 animate-pulse">SCAN TO SING</div>
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
            {room?.showLyricsTv && !showVisualizerTv && current?.lyrics && (
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
                    />
                </div>
            )}
            
            {/* LAYER 3: HUD / INFO (Z-Index 50+) */}
            {!room?.hideOverlay && current && layout !== 'cinema' && !room?.showLyricsTv && !showVisualizerTv && ( 
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center z-10 p-8">
                    {!minimalUI && <div className="bg-pink-600 text-white px-6 py-2 rounded-full font-bold tracking-widest inline-block mb-8 shadow-lg">NOW PERFORMING</div>}
                    <div className="flex flex-col items-center gap-4 max-w-5xl mx-auto w-full">
                        {current.albumArtUrl && !minimalUI && <img src={current.albumArtUrl} className="w-[30vh] h-[30vh] rounded-2xl shadow-2xl border-4 border-white/20 object-cover" alt="Art"/>}
                        <div className="text-center relative z-20 w-full">
                            <h1 className={`${minimalUI ? 'text-[8vw]' : 'text-[10vw]'} font-bebas text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 leading-none mb-2 drop-shadow-xl px-4 truncate`}>{current.songTitle}</h1>
                            <h2 className={`${minimalUI ? 'text-[3vw]' : 'text-[5vw]'} text-zinc-300 font-light truncate`}>{current.artist}</h2>
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
            {!room?.hideCornerOverlay && current && !layout.includes('cinema') && (
                <div className="absolute bottom-8 left-8 z-50 bg-black/60 p-6 rounded-2xl border border-white/20 flex gap-6 items-center animate-slide-in-from-bottom max-w-[80vw] pointer-events-none">
                    {current.albumArtUrl && <img src={current.albumArtUrl} className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl shadow-lg" alt="Corner Art"/>}
                    <div className="min-w-0">
                        <div className="text-lg text-zinc-400 uppercase tracking-widest font-bold mb-1">On Stage</div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            {room?.showLyricsTv && (
                                <div className="text-[10px] text-cyan-300 bg-black/50 border border-cyan-400/30 inline-flex px-2 py-0.5 rounded-full">
                                    Lyrics Live
                                </div>
                            )}
                            {nowPlayingLabel && (
                                <div className="text-[10px] text-zinc-100 bg-black/60 border border-white/20 inline-flex px-2 py-0.5 rounded-full max-w-[80vw]">
                                    <span className={`mr-2 ${
                                        nowPlayingLabel.sourceKey === 'apple'
                                            ? 'text-emerald-300'
                                            : nowPlayingLabel.sourceKey === 'youtube'
                                                ? 'text-red-300'
                                                : 'text-cyan-200'
                                    }`}>{nowPlayingLabel.source}</span>
                                    <span className="text-zinc-400 mr-2">•</span>
                                    <span className="truncate">{nowPlayingLabel.title}</span>
                                    <span className="text-zinc-400 ml-2">({nowPlayingLabel.state})</span>
                                </div>
                            )}
                        </div>
                        <div className="text-5xl sm:text-8xl font-black text-white leading-none mb-1 truncate">{current.singerName}</div>
                        <div className="text-2xl sm:text-4xl text-fuchsia-400 leading-none truncate">{current.songTitle}</div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

export default Stage;
