import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    LIVE_STAGE_CAMERA_CORNERS,
    LIVE_STAGE_CAMERA_DEVICE_STORAGE_KEY,
    LIVE_STAGE_CAMERA_MODES,
    buildLiveStageCameraVideoConstraints,
    isLiveStageCameraDeviceFallbackError,
    normalizeLiveStageCameraMode,
    resolveLiveStageCameraCorner,
} from '../lib/liveStageCamera';

const readStoredCameraDeviceId = () => {
    try {
        if (typeof window === 'undefined') return '';
        return String(window.localStorage.getItem(LIVE_STAGE_CAMERA_DEVICE_STORAGE_KEY) || '').trim();
    } catch {
        return '';
    }
};

const storeCameraDeviceId = (deviceId = '') => {
    try {
        if (typeof window === 'undefined') return;
        const normalized = String(deviceId || '').trim();
        if (normalized) window.localStorage.setItem(LIVE_STAGE_CAMERA_DEVICE_STORAGE_KEY, normalized);
        else window.localStorage.removeItem(LIVE_STAGE_CAMERA_DEVICE_STORAGE_KEY);
    } catch {
        // Camera selection remains session-functional when storage is blocked.
    }
};

const getCornerPositionClass = ({
    corner,
    topHudVisible,
    scoreVisible,
    checkpointVisible,
    stageInfoVisible,
}) => {
    if (corner === LIVE_STAGE_CAMERA_CORNERS.topLeft) {
        return topHudVisible
            ? 'left-4 top-16 md:left-6 md:top-[4.75rem] 2xl:left-8'
            : 'left-4 top-4 md:left-6 md:top-6 2xl:left-8 2xl:top-8';
    }
    if (corner === LIVE_STAGE_CAMERA_CORNERS.bottomLeft) {
        return stageInfoVisible
            ? 'bottom-[12rem] left-4 md:bottom-[14rem] md:left-6 2xl:left-8'
            : 'bottom-4 left-4 md:bottom-6 md:left-6 2xl:bottom-8 2xl:left-8';
    }
    if (corner === LIVE_STAGE_CAMERA_CORNERS.bottomRight) {
        return checkpointVisible
            ? 'bottom-[7.5rem] right-4 md:bottom-[9rem] md:right-6 2xl:right-8'
            : 'bottom-4 right-4 md:bottom-6 md:right-6 2xl:bottom-8 2xl:right-8';
    }
    return scoreVisible
        ? 'right-4 top-[11rem] md:right-6 md:top-[13rem] 2xl:right-8 2xl:top-[15rem]'
        : topHudVisible
            ? 'right-4 top-16 md:right-6 md:top-[4.75rem] 2xl:right-8'
            : 'right-4 top-4 md:right-6 md:top-6 2xl:right-8 2xl:top-8';
};

const getCornerSizeClass = (presentationProfile = 'room') => {
    if (presentationProfile === 'cinema') {
        return 'w-[min(38vw,36rem)] min-w-[12rem]';
    }
    if (presentationProfile === 'simple') {
        return 'w-[min(34vw,28rem)] min-w-[11rem]';
    }
    return 'w-[min(36vw,30rem)] min-w-[11rem]';
};

const LiveStageCamera = ({
    mode = LIVE_STAGE_CAMERA_MODES.off,
    requestedCorner = LIVE_STAGE_CAMERA_CORNERS.auto,
    presentationProfile = 'room',
    mirrored = true,
    lyricsVisible = false,
    topHudVisible = false,
    scoreVisible = false,
    checkpointVisible = false,
    stageInfoVisible = false,
}) => {
    const normalizedMode = normalizeLiveStageCameraMode(mode);
    const enabled = normalizedMode !== LIVE_STAGE_CAMERA_MODES.off;
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const requestRef = useRef(null);
    const enabledRef = useRef(enabled);
    const mountedRef = useRef(false);
    const [cameraStatus, setCameraStatus] = useState('idle');
    const [cameraError, setCameraError] = useState('');
    const [cameraDevices, setCameraDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(readStoredCameraDeviceId);
    const [activeDeviceId, setActiveDeviceId] = useState('');
    const [controlsOpen, setControlsOpen] = useState(false);
    enabledRef.current = enabled;

    const stopCamera = useCallback(() => {
        const stream = streamRef.current;
        stream?.getTracks?.().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    const refreshCameraDevices = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
        try {
            const devices = (await navigator.mediaDevices.enumerateDevices())
                .filter((device) => device.kind === 'videoinput')
                .map((device, index) => ({
                    deviceId: String(device.deviceId || ''),
                    label: String(device.label || '').trim() || `Camera ${index + 1}`,
                }));
            if (mountedRef.current) setCameraDevices(devices);
            return devices;
        } catch {
            return [];
        }
    }, []);

    const startCamera = useCallback(async () => {
        if (!enabled) return false;
        if (streamRef.current?.active) return true;
        if (requestRef.current) return requestRef.current;

        const request = (async () => {
            setCameraStatus('requesting');
            setCameraError('');
            try {
                if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                    throw new Error('This browser cannot open a connected camera.');
                }
                let stream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: buildLiveStageCameraVideoConstraints(selectedDeviceId),
                        audio: false,
                    });
                } catch (error) {
                    if (!selectedDeviceId || !isLiveStageCameraDeviceFallbackError(error)) throw error;
                    storeCameraDeviceId('');
                    if (mountedRef.current) setSelectedDeviceId('');
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: buildLiveStageCameraVideoConstraints(),
                        audio: false,
                    });
                }
                if (!mountedRef.current || !enabledRef.current) {
                    stream.getTracks().forEach((track) => track.stop());
                    return false;
                }
                stopCamera();
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }
                setCameraStatus('live');
                const nextActiveDeviceId = String(stream.getVideoTracks?.()[0]?.getSettings?.()?.deviceId || '').trim();
                setActiveDeviceId(nextActiveDeviceId);
                void refreshCameraDevices();
                return true;
            } catch (error) {
                stopCamera();
                if (mountedRef.current && enabledRef.current) {
                    setCameraStatus('error');
                    setCameraError(
                        String(error?.name || '').toLowerCase().includes('notallowed')
                            ? 'Camera permission is off for this TV.'
                            : 'Camera unavailable on this TV.'
                    );
                }
                return false;
            } finally {
                requestRef.current = null;
            }
        })();

        requestRef.current = request;
        return request;
    }, [enabled, refreshCameraDevices, selectedDeviceId, stopCamera]);

    useEffect(() => {
        if (!enabled) {
            stopCamera();
            return undefined;
        }
        void startCamera();
        return undefined;
    }, [enabled, startCamera, stopCamera]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            stopCamera();
        };
    }, [stopCamera]);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return undefined;
        const handleCameraShortcut = (event) => {
            if (event.key === 'Escape') {
                setControlsOpen(false);
                return;
            }
            const tagName = String(event?.target?.tagName || '').toLowerCase();
            if (['input', 'select', 'textarea'].includes(tagName)) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (String(event.key || '').toLowerCase() === 'c') {
                event.preventDefault();
                setControlsOpen((currentValue) => !currentValue);
            }
        };
        window.addEventListener('keydown', handleCameraShortcut);
        return () => window.removeEventListener('keydown', handleCameraShortcut);
    }, [enabled]);

    const selectCameraDevice = useCallback((deviceId = '') => {
        if (cameraStatus === 'requesting') return;
        const normalized = String(deviceId || '').trim();
        if (normalized === selectedDeviceId) return;
        stopCamera();
        storeCameraDeviceId(normalized);
        setCameraStatus('idle');
        setCameraError('');
        setSelectedDeviceId(normalized);
    }, [cameraStatus, selectedDeviceId, stopCamera]);

    useEffect(() => {
        if (!enabled || cameraStatus !== 'idle') return;
        void startCamera();
    }, [cameraStatus, enabled, selectedDeviceId, startCamera]);

    const resolvedCorner = useMemo(() => resolveLiveStageCameraCorner({
        requestedCorner,
        lyricsVisible,
        scoreVisible,
        checkpointVisible,
        stageInfoVisible,
        cinema: presentationProfile === 'cinema',
    }), [
        checkpointVisible,
        lyricsVisible,
        presentationProfile,
        requestedCorner,
        scoreVisible,
        stageInfoVisible,
    ]);

    if (!enabled) return null;

    const cameraIsLive = cameraStatus === 'live';
    const fullStage = normalizedMode === LIVE_STAGE_CAMERA_MODES.full;
    const positionClass = fullStage
        ? 'absolute inset-0 z-[5]'
        : `absolute z-[45] aspect-video ${getCornerSizeClass(presentationProfile)} ${getCornerPositionClass({
            corner: resolvedCorner,
            topHudVisible,
            scoreVisible,
            checkpointVisible,
            stageInfoVisible,
        })}`;

    return (
        <>
            <div
                data-feature-id="live-stage-camera"
                data-camera-mode={normalizedMode}
                data-camera-corner={resolvedCorner}
                className={`${positionClass} pointer-events-none overflow-hidden transition-opacity duration-300 ${
                    cameraIsLive ? 'opacity-100' : 'opacity-0'
                } ${fullStage ? 'bg-black' : 'rounded-2xl border border-cyan-200/35 bg-black shadow-[0_18px_55px_rgba(0,0,0,0.5)] ring-1 ring-white/10'}`}
            >
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    autoPlay
                    aria-label="Live Stage Cam"
                    className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
                />
                <div className={`absolute inset-0 ${
                    fullStage
                        ? 'bg-gradient-to-b from-black/10 via-transparent to-black/32'
                        : 'ring-1 ring-inset ring-white/10'
                }`} />
                {!fullStage ? (
                    <div className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/62 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.9)]" />
                        Live Cam
                    </div>
                ) : null}
            </div>
            {controlsOpen ? (
                <div
                    data-feature-id="live-stage-camera-controls"
                    className="absolute bottom-4 left-4 z-[190] w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-cyan-200/35 bg-zinc-950/92 p-4 text-left text-white shadow-[0_24px_70px_rgba(0,0,0,0.64)] backdrop-blur-xl"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">This Public TV</div>
                            <div className="mt-1 text-lg font-black">Camera Source</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setControlsOpen(false)}
                            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-200 hover:border-cyan-200/35 hover:text-white"
                            aria-label="Close camera controls"
                        >
                            <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                    </div>
                    <label className="mt-3 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400" htmlFor="live-stage-camera-device">
                        Connected camera
                    </label>
                    <select
                        id="live-stage-camera-device"
                        data-feature-id="live-stage-camera-device-select"
                        value={selectedDeviceId}
                        disabled={cameraStatus === 'requesting'}
                        onChange={(event) => selectCameraDevice(event.target.value)}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-cyan-200/25 bg-black/70 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-200/60"
                    >
                        <option value="">System Default{!selectedDeviceId && activeDeviceId ? ' · Active' : ''}</option>
                        {selectedDeviceId && !cameraDevices.some((device) => device.deviceId === selectedDeviceId) ? (
                            <option value={selectedDeviceId}>
                                Saved camera · permission needed
                            </option>
                        ) : null}
                        {cameraDevices.map((device) => (
                            <option key={device.deviceId || device.label} value={device.deviceId}>
                                {device.label}
                            </option>
                        ))}
                    </select>
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] leading-4 text-zinc-400">Saved on this browser only. Press C to close.</span>
                        <button
                            type="button"
                            onClick={refreshCameraDevices}
                            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            ) : null}
            {cameraStatus === 'error' ? (
                <button
                    type="button"
                    data-feature-id="live-stage-camera-retry"
                    onClick={startCamera}
                    className="absolute bottom-4 right-4 z-[86] inline-flex items-center gap-2 rounded-full border border-amber-200/35 bg-black/78 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100 shadow-lg backdrop-blur-md"
                >
                    <i className="fa-solid fa-camera" aria-hidden="true" />
                    {cameraError} Retry · C for source
                </button>
            ) : null}
        </>
    );
};

export default LiveStageCamera;
