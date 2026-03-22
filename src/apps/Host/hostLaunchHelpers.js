export const fromDateTimeLocalInput = (value = '') => {
    const token = String(value || '').trim();
    if (!token) return 0;
    const parsed = Date.parse(token);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
};

export const buildHostProvisionRequestId = (prefix = 'host_launch') => {
    const safePrefix = String(prefix || 'host_launch')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 24) || 'host_launch';
    const nonce = Math.random().toString(36).slice(2, 10);
    return `${safePrefix}_${Date.now().toString(36)}_${nonce}`.slice(0, 80);
};

export const DEFAULT_QUICK_LAUNCH_DISCOVERY = Object.freeze({
    publicRoom: false,
    virtualOnly: false,
    title: '',
    venueName: '',
    description: '',
    startsAtLocal: '',
    address1: '',
    city: '',
    state: '',
    lat: '',
    lng: ''
});

export const createQuickLaunchDiscoveryDraft = (draft = {}) => ({
    ...DEFAULT_QUICK_LAUNCH_DISCOVERY,
    ...(draft && typeof draft === 'object' ? draft : {})
});

export const buildProvisionDiscoveryPayload = (draft = {}) => {
    const nextDraft = createQuickLaunchDiscoveryDraft(draft);
    const startsAtMs = fromDateTimeLocalInput(nextDraft?.startsAtLocal);
    const lat = Number(nextDraft?.lat);
    const lng = Number(nextDraft?.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const virtualOnly = !!nextDraft?.virtualOnly;
    const venueName = String(nextDraft?.venueName || '').trim();
    const title = String(nextDraft?.title || '').trim() || venueName;
    return {
        publicRoom: !!nextDraft?.publicRoom,
        virtualOnly,
        title,
        venueName: virtualOnly ? (venueName || 'Virtual Room') : venueName,
        description: String(nextDraft?.description || '').trim(),
        startsAtMs: startsAtMs || 0,
        startsAtLocal: String(nextDraft?.startsAtLocal || '').trim(),
        address1: virtualOnly ? '' : String(nextDraft?.address1 || '').trim(),
        city: String(nextDraft?.city || '').trim(),
        state: String(nextDraft?.state || '').trim(),
        lat: String(nextDraft?.lat || '').trim(),
        lng: String(nextDraft?.lng || '').trim(),
        location: hasCoords ? { lat, lng } : {},
        sessionMode: virtualOnly ? 'virtual' : 'karaoke',
    };
};

const normalizeLaunchHttpUrl = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const baseOrigin = typeof window !== 'undefined'
            ? window.location.origin
            : 'https://beaurocks.app';
        const parsed = new URL(raw, baseOrigin);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
        return parsed.toString();
    } catch {
        return '';
    }
};

export const normalizeProvisionLaunchUrls = (value = {}) => {
    const input = value && typeof value === 'object' ? value : {};
    return {
        hostUrl: normalizeLaunchHttpUrl(input.hostUrl),
        tvUrl: normalizeLaunchHttpUrl(input.tvUrl),
        audienceUrl: normalizeLaunchHttpUrl(input.audienceUrl),
    };
};

export const isProvisionHostRoomCallableUnavailableError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    if (code.includes('not-found') || code.includes('unimplemented')) return true;
    return (
        message.includes('provisionhostroom')
        && (
            message.includes('does not exist')
            || message.includes('not found')
            || message.includes('not deployed')
            || message.includes('no function')
        )
    );
};
