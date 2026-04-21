export const AUDIENCE_FEATURE_ACCESS_LEVELS = Object.freeze({
    open: 'open',
    accountRequired: 'account_required',
    supportOrAccount: 'support_or_account',
    disabled: 'disabled',
});

export const AUDIENCE_FEATURE_KEYS = Object.freeze({
    customEmoji: 'customEmoji',
});

const DEFAULT_AUDIENCE_FEATURE_ACCESS = Object.freeze({
    [AUDIENCE_FEATURE_KEYS.customEmoji]: AUDIENCE_FEATURE_ACCESS_LEVELS.open,
});

const VALID_ACCESS_LEVELS = new Set(Object.values(AUDIENCE_FEATURE_ACCESS_LEVELS));
const VALID_FEATURE_KEYS = new Set(Object.values(AUDIENCE_FEATURE_KEYS));

const normalizeAccessLevel = (value = '', fallback = AUDIENCE_FEATURE_ACCESS_LEVELS.open) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (VALID_ACCESS_LEVELS.has(normalized)) return normalized;
    return fallback;
};

export const normalizeAudienceFeatureAccess = (input = {}) => {
    const source = input && typeof input === 'object' && !Array.isArray(input)
        ? input
        : {};
    const rawFeatures = source.features && typeof source.features === 'object' && !Array.isArray(source.features)
        ? source.features
        : source;
    const features = { ...DEFAULT_AUDIENCE_FEATURE_ACCESS };

    Object.keys(features).forEach((key) => {
        features[key] = normalizeAccessLevel(rawFeatures[key], DEFAULT_AUDIENCE_FEATURE_ACCESS[key]);
    });

    return {
        version: 1,
        features,
    };
};

export const resolveAudienceFeatureAccess = ({
    policy = {},
    featureKey = '',
    isSignedIn = false,
    hasSupporterAccess = false,
    isVipAccount = false,
} = {}) => {
    const normalizedPolicy = normalizeAudienceFeatureAccess(policy);
    const safeFeatureKey = VALID_FEATURE_KEYS.has(featureKey) ? featureKey : AUDIENCE_FEATURE_KEYS.customEmoji;
    const level = normalizeAccessLevel(
        normalizedPolicy.features?.[safeFeatureKey],
        DEFAULT_AUDIENCE_FEATURE_ACCESS[safeFeatureKey] || AUDIENCE_FEATURE_ACCESS_LEVELS.open,
    );

    if (level === AUDIENCE_FEATURE_ACCESS_LEVELS.disabled) {
        return {
            featureKey: safeFeatureKey,
            level,
            allowed: false,
            blocked: true,
            unlockPath: 'disabled',
            reasonLabel: 'Disabled in this room',
        };
    }

    if (level === AUDIENCE_FEATURE_ACCESS_LEVELS.accountRequired) {
        return {
            featureKey: safeFeatureKey,
            level,
            allowed: !!isSignedIn,
            blocked: !isSignedIn,
            unlockPath: isSignedIn ? null : 'account',
            reasonLabel: isSignedIn ? 'Available' : 'BeauRocks account required',
        };
    }

    if (level === AUDIENCE_FEATURE_ACCESS_LEVELS.supportOrAccount) {
        const allowed = !!isSignedIn || !!hasSupporterAccess || !!isVipAccount;
        return {
            featureKey: safeFeatureKey,
            level,
            allowed,
            blocked: !allowed,
            unlockPath: allowed ? null : 'support_or_account',
            reasonLabel: allowed ? 'Available' : 'Support or BeauRocks account required',
        };
    }

    return {
        featureKey: safeFeatureKey,
        level: AUDIENCE_FEATURE_ACCESS_LEVELS.open,
        allowed: true,
        blocked: false,
        unlockPath: null,
        reasonLabel: 'Open',
    };
};
