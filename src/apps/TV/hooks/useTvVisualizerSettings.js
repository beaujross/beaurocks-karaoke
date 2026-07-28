import { useEffect, useMemo } from 'react';
import {
    getTvVisualizerInputMode,
    resolveTvVisualizerSource,
} from '../../../lib/tvVisualizerInput';

const LIGHT_PRESET_BY_MODE = Object.freeze({
    banger: 'club',
    strobe: 'club',
    storm: 'neon',
    ballad: 'calm',
    guitar: 'retro',
    volley: 'neon'
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
    current,
    started,
    bgVisualizerAudioRef,
    logger = null
}) => {
    const activeLogger = logger || getSilentLogger();
    const isHostBgMusicActive = !!room?.bgMusicPlaying && !!room?.bgMusicUrl;
    const visualizerSource = room?.visualizerSource || 'auto';
    const stageMediaUrl = String(current?.mediaUrl || room?.mediaUrl || '').trim();
    const stageAudioOnly = current?.audioOnly === true;
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
        return resolveTvVisualizerSource({
            activeMode: room?.activeMode,
            configuredSource: visualizerSource,
            hostBgMusicActive: isHostBgMusicActive,
            stageMediaUrl,
            stageAudioOnly,
            stagePlaying: room?.videoPlaying === true,
        });
    }, [isHostBgMusicActive, room?.activeMode, room?.videoPlaying, stageAudioOnly, stageMediaUrl, visualizerSource]);

    const visualizerEnabled = visualizerResolvedSource !== 'off';
    const visualizerInputMode = getTvVisualizerInputMode(visualizerResolvedSource);
    const shouldUseBgMediaElement = visualizerEnabled && visualizerResolvedSource === 'host_bg';
    const shouldUseStageMediaElement = visualizerEnabled && visualizerResolvedSource === 'stage_media';

    const bgVisualizerSimulatedLevel = useMemo(() => {
        if (visualizerResolvedSource === 'stage_media') {
            if (!room?.videoPlaying) return 0;
            const stageVolume = parseBounded(room?.videoVolume, 80, 0, 100) / 100;
            return Math.round(stageVolume * 70);
        }
        if (!room?.bgMusicPlaying) return 0;
        const normalizedVolume = parseBounded(room?.bgMusicVolume, 0.3, 0, 1);
        const normalizedMix = parseBounded(room?.mixFader, 50, 0, 100);
        const bgMixWeight = 1 - (normalizedMix / 100);
        return Math.round(normalizedVolume * bgMixWeight * 100);
    }, [room?.bgMusicPlaying, room?.bgMusicVolume, room?.mixFader, room?.videoPlaying, room?.videoVolume, visualizerResolvedSource]);

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
        shouldUseStageMediaElement,
        visualizerEnabled,
        visualizerInputMode,
        visualizerResolvedSource,
        visualizerResolvedPreset,
        visualizerSensitivity,
        visualizerSmoothing
    };
};

export default useTvVisualizerSettings;
