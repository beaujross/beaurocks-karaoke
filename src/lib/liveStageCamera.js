export const LIVE_STAGE_CAMERA_MODES = Object.freeze({
    off: 'off',
    full: 'full',
    corner: 'corner',
});

export const LIVE_STAGE_CAMERA_CORNERS = Object.freeze({
    auto: 'auto',
    topLeft: 'top_left',
    topRight: 'top_right',
    bottomLeft: 'bottom_left',
    bottomRight: 'bottom_right',
});

export const LIVE_STAGE_CAMERA_DEVICE_STORAGE_KEY = 'beaurocks_live_stage_camera_device_id';

const VALID_CAMERA_MODES = new Set(Object.values(LIVE_STAGE_CAMERA_MODES));
const VALID_CAMERA_CORNERS = new Set(Object.values(LIVE_STAGE_CAMERA_CORNERS));

export const normalizeLiveStageCameraMode = (value = '') => {
    const normalized = String(value || '').trim().toLowerCase();
    return VALID_CAMERA_MODES.has(normalized) ? normalized : LIVE_STAGE_CAMERA_MODES.off;
};

export const normalizeLiveStageCameraCorner = (value = '') => {
    const normalized = String(value || '').trim().toLowerCase();
    return VALID_CAMERA_CORNERS.has(normalized) ? normalized : LIVE_STAGE_CAMERA_CORNERS.auto;
};

export const resolveLiveStageCameraCorner = ({
    requestedCorner = LIVE_STAGE_CAMERA_CORNERS.auto,
    lyricsVisible = false,
    scoreVisible = false,
    checkpointVisible = false,
    stageInfoVisible = false,
    cinema = false,
} = {}) => {
    const normalized = normalizeLiveStageCameraCorner(requestedCorner);
    if (normalized !== LIVE_STAGE_CAMERA_CORNERS.auto) return normalized;
    if (checkpointVisible || lyricsVisible) return LIVE_STAGE_CAMERA_CORNERS.topLeft;
    if (scoreVisible) return LIVE_STAGE_CAMERA_CORNERS.bottomRight;
    if (stageInfoVisible) return LIVE_STAGE_CAMERA_CORNERS.topRight;
    if (cinema) return LIVE_STAGE_CAMERA_CORNERS.bottomLeft;
    return LIVE_STAGE_CAMERA_CORNERS.topRight;
};

export const getLiveStageCameraModeLabel = (value = '') => {
    const mode = normalizeLiveStageCameraMode(value);
    if (mode === LIVE_STAGE_CAMERA_MODES.full) return 'Full Stage';
    if (mode === LIVE_STAGE_CAMERA_MODES.corner) return 'Corner';
    return 'Off';
};

export const buildLiveStageCameraVideoConstraints = (deviceId = '') => {
    const normalizedDeviceId = String(deviceId || '').trim();
    return {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 },
        ...(normalizedDeviceId ? { deviceId: { exact: normalizedDeviceId } } : {}),
    };
};

export const isLiveStageCameraDeviceFallbackError = (error = {}) => {
    const name = String(error?.name || '').trim().toLowerCase();
    return [
        'notfounderror',
        'overconstrainederror',
        'constraintnotsatisfiederror',
    ].includes(name);
};
