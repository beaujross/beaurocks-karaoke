const HOST_LAUNCH_DRAFT_VERSION = 1;
const HOST_LAUNCH_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const HOST_LAUNCH_DRAFT_MAX_BYTES = 100_000;

export const HOST_LAUNCH_IDENTITY_DRAFT_KEY = 'bross_host_launch_identity_draft_v1';
export const HOST_LAUNCH_OPTIONS_DRAFT_KEY = 'bross_host_launch_options_draft_v1';
export const HOST_LAUNCH_EXPERIENCE_DRAFT_KEY = 'bross_host_launch_experience_draft_v1';

export const HOST_LAUNCH_DRAFT_KEYS = Object.freeze([
    HOST_LAUNCH_IDENTITY_DRAFT_KEY,
    HOST_LAUNCH_OPTIONS_DRAFT_KEY,
    HOST_LAUNCH_EXPERIENCE_DRAFT_KEY,
]);

export const buildHostLaunchDraftKey = (baseKey = '', ownerKey = '') => {
    const safeBaseKey = String(baseKey || '').trim();
    const safeOwnerKey = String(ownerKey || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 180);
    if (!safeBaseKey || !safeOwnerKey) return '';
    return `${safeBaseKey}:${safeOwnerKey}`;
};

const resolveStorage = (storage) => {
    if (storage) return storage;
    try {
        return globalThis?.localStorage || null;
    } catch {
        return null;
    }
};

export const loadHostLaunchDraftPart = (
    key,
    fallback = {},
    { storage = null, nowMs = Date.now() } = {},
) => {
    const targetStorage = resolveStorage(storage);
    if (!targetStorage || !key) return { value: fallback, restored: false, updatedAtMs: 0 };
    try {
        const raw = String(targetStorage.getItem(key) || '');
        if (!raw || raw.length > HOST_LAUNCH_DRAFT_MAX_BYTES) {
            if (raw) targetStorage.removeItem(key);
            return { value: fallback, restored: false, updatedAtMs: 0 };
        }
        const parsed = JSON.parse(raw);
        const updatedAtMs = Math.max(0, Number(parsed?.updatedAtMs || 0) || 0);
        const ageMs = Math.max(0, Number(nowMs || 0) - updatedAtMs);
        if (
            parsed?.version !== HOST_LAUNCH_DRAFT_VERSION
            || !parsed?.value
            || typeof parsed.value !== 'object'
            || !updatedAtMs
            || ageMs > HOST_LAUNCH_DRAFT_MAX_AGE_MS
        ) {
            targetStorage.removeItem(key);
            return { value: fallback, restored: false, updatedAtMs: 0 };
        }
        return {
            value: parsed.value,
            restored: true,
            updatedAtMs,
        };
    } catch {
        try {
            targetStorage.removeItem(key);
        } catch {
            // Storage is optional; recovery failure must never block room setup.
        }
        return { value: fallback, restored: false, updatedAtMs: 0 };
    }
};

export const persistHostLaunchDraftPart = (
    key,
    value = {},
    { storage = null, nowMs = Date.now() } = {},
) => {
    const targetStorage = resolveStorage(storage);
    if (!targetStorage || !key || !value || typeof value !== 'object') return false;
    try {
        targetStorage.setItem(key, JSON.stringify({
            version: HOST_LAUNCH_DRAFT_VERSION,
            updatedAtMs: Math.max(1, Number(nowMs || 0) || Date.now()),
            value,
        }));
        return true;
    } catch {
        return false;
    }
};

export const clearHostLaunchDraftPart = (key, storage = null) => {
    const targetStorage = resolveStorage(storage);
    if (!targetStorage || !key) return false;
    try {
        targetStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
};

export const sanitizeHostLaunchEventCreditsDraft = (config = {}) => ({
    ...(config && typeof config === 'object' ? config : {}),
    claimCodes: {
        vip: '',
        skipLine: '',
        websiteCheckIn: '',
        socialPromo: '',
    },
    promoCampaigns: (Array.isArray(config?.promoCampaigns) ? config.promoCampaigns : [])
        .map((campaign) => ({
            ...(campaign && typeof campaign === 'object' ? campaign : {}),
            code: '',
        })),
});

export const hasRecoverableHostLaunchDraft = ({
    ownerKey = '',
    storage = null,
    nowMs = Date.now(),
} = {}) => HOST_LAUNCH_DRAFT_KEYS
    .map((key) => buildHostLaunchDraftKey(key, ownerKey))
    .filter(Boolean)
    .some((key) => (
    loadHostLaunchDraftPart(key, {}, { storage, nowMs }).restored
));
