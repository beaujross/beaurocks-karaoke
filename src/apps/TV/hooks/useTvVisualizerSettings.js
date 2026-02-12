import { useEffect, useMemo } from 'react';

const LIGHT_PRESET_BY_MODE = Object.freeze({
    banger: 'club',
    strobe: 'club',
    storm: 'neon',
    ballad: 'calm',
    guitar: 'retro'
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const parseBounded = (value, fallback, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return clamp(numeric, min, max);
};

const getSilentLogger = () => ({
    debug: () => {}
});

const useTvVisualizerSettings = ({
    room,
    started,
    bgVisualizerAudioRef,
    logger = null
}) => {
    const activeLogger = logger || getSilentLogger();
    const isHostBgMusicActive = !!room?.bgMusicPlaying && !!room?.bgMusicUrl;
    const visualizerSource = room?.visualizerSource || 'auto';
    const visualizerSensitivity = parseBounded(room?.visualizerSensitivity, 1, 0.5, 2.5);
    const visualizerSmoothing = parseBounded(room?.visualizerSmoothing, 0.35, 0, 0.95);
    const visualizerPreset = room?.visualizerPreset || 'neon';
    const visualizerSyncLightMode = !!room?.visualizerSyncLightMode;

    const visualizerResolvedPreset = useMemo(() => {
        const syncedPreset = LIGHT_PRESET_BY_MODE[room?.lightMode] || '';
        if (visualizerSyncLightMode && syncedPreset) return syncedPreset;
        return visualizerPreset;
    }, [room?.lightMode, visualizerPreset, visualizerSyncLightMode]);

    const visualizerResolvedSource = useMemo(() => {
        if (visualizerSource !== 'auto') return visualizerSource;
        return isHostBgMusicActive ? 'host_bg' : 'stage_mic';
    }, [isHostBgMusicActive, visualizerSource]);

    const visualizerEnabled = visualizerResolvedSource !== 'off';
    const visualizerInputMode = visualizerResolvedSource === 'host_bg'
        ? 'media'
        : visualizerResolvedSource === 'stage_mic'
            ? 'mic'
            : 'none';
    const shouldUseBgMediaElement = visualizerEnabled && visualizerInputMode === 'media';

    const bgVisualizerSimulatedLevel = useMemo(() => {
        if (!room?.bgMusicPlaying) return 0;
        const normalizedVolume = parseBounded(room?.bgMusicVolume, 0.3, 0, 1);
        const normalizedMix = parseBounded(room?.mixFader, 50, 0, 100);
        const bgMixWeight = 1 - (normalizedMix / 100);
        return Math.round(normalizedVolume * bgMixWeight * 100);
    }, [room?.bgMusicPlaying, room?.bgMusicVolume, room?.mixFader]);

    useEffect(() => {
        const audioEl = bgVisualizerAudioRef.current;
        if (!audioEl) return;

        const nextUrl = typeof room?.bgMusicUrl === 'string' ? room.bgMusicUrl.trim() : '';
        if (nextUrl && audioEl.dataset.src !== nextUrl) {
            audioEl.src = nextUrl;
            audioEl.dataset.src = nextUrl;
        }

        audioEl.volume = parseBounded(room?.bgMusicVolume, 0.3, 0, 1);
        audioEl.muted = true;
        audioEl.loop = true;

        if (shouldUseBgMediaElement && started && room?.bgMusicPlaying && nextUrl) {
            audioEl.play().catch((error) => {
                activeLogger.debug('Hidden visualizer media play blocked', error);
            });
            return;
        }

        audioEl.pause();
    }, [room?.bgMusicUrl, room?.bgMusicVolume, room?.bgMusicPlaying, started, shouldUseBgMediaElement, bgVisualizerAudioRef, activeLogger]);

    return {
        bgVisualizerSimulatedLevel,
        shouldUseBgMediaElement,
        visualizerEnabled,
        visualizerInputMode,
        visualizerResolvedPreset,
        visualizerSensitivity,
        visualizerSmoothing
    };
};

export default useTvVisualizerSettings;
