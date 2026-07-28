const APPLAUSE_MODES = new Set(['applause_countdown', 'applause', 'applause_result']);
const AUDIO_FILE_PATTERN = /\.(mp3|m4a|wav|ogg|aac|flac)(?:$|[?#])/i;

export const isAudioMediaUrl = (value = '') => AUDIO_FILE_PATTERN.test(String(value || '').trim());

export const resolveTvVisualizerSource = ({
    activeMode = '',
    configuredSource = 'auto',
    hostBgMusicActive = false,
    stageMediaUrl = '',
    stageAudioOnly = false,
    stagePlaying = false,
} = {}) => {
    if (APPLAUSE_MODES.has(String(activeMode || '').trim().toLowerCase())) return 'stage_mic';

    const normalizedSource = String(configuredSource || 'auto').trim().toLowerCase();
    if (normalizedSource !== 'auto') return normalizedSource;

    const stageAudioActive = !!stagePlaying && (stageAudioOnly || isAudioMediaUrl(stageMediaUrl));
    if (stageAudioActive) return 'stage_media';
    if (hostBgMusicActive) return 'host_bg';
    return 'stage_mic';
};

export const getTvVisualizerInputMode = (source = '') => {
    const normalizedSource = String(source || '').trim().toLowerCase();
    if (normalizedSource === 'host_bg' || normalizedSource === 'stage_media') return 'media';
    if (normalizedSource === 'stage_mic') return 'mic';
    return 'none';
};

export const isMicrophoneFeatureAllowed = (documentRef = null) => {
    const policy = documentRef?.permissionsPolicy || documentRef?.featurePolicy || null;
    if (!policy || typeof policy.allowsFeature !== 'function') return true;
    try {
        return policy.allowsFeature('microphone') !== false;
    } catch {
        return true;
    }
};

export const canAttemptVisualizerMicrophone = async ({
    documentRef = null,
    navigatorRef = null,
} = {}) => {
    if (!isMicrophoneFeatureAllowed(documentRef)) return false;
    if (!navigatorRef?.mediaDevices?.getUserMedia) return false;

    if (typeof navigatorRef?.permissions?.query === 'function') {
        try {
            const permission = await navigatorRef.permissions.query({ name: 'microphone' });
            if (permission?.state === 'denied') return false;
        } catch {
            // Some browsers do not expose microphone through Permissions API.
        }
    }
    return true;
};

export const isNonRetryableVisualizerMicrophoneError = (error = {}) => {
    const name = String(error?.name || '').trim().toLowerCase();
    return [
        'notallowederror',
        'permissiondeniederror',
        'securityerror',
    ].includes(name);
};
