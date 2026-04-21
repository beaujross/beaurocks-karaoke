import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    AUDIENCE_FEATURE_ACCESS_LEVELS,
    AUDIENCE_FEATURE_KEYS,
    normalizeAudienceFeatureAccess,
    resolveAudienceFeatureAccess,
} from '../../src/lib/audienceFeatureAccess.js';

test('normalizeAudienceFeatureAccess keeps safe defaults and accepts feature overrides', () => {
    const normalized = normalizeAudienceFeatureAccess({
        features: {
            customEmoji: AUDIENCE_FEATURE_ACCESS_LEVELS.accountRequired,
        },
    });

    assert.equal(normalized.version, 1);
    assert.equal(
        normalized.features.customEmoji,
        AUDIENCE_FEATURE_ACCESS_LEVELS.accountRequired,
    );
});

test('resolveAudienceFeatureAccess blocks account-gated features for signed-out guests', () => {
    const access = resolveAudienceFeatureAccess({
        policy: {
            features: {
                customEmoji: AUDIENCE_FEATURE_ACCESS_LEVELS.accountRequired,
            },
        },
        featureKey: AUDIENCE_FEATURE_KEYS.customEmoji,
        isSignedIn: false,
    });

    assert.equal(access.allowed, false);
    assert.equal(access.unlockPath, 'account');
    assert.match(access.reasonLabel, /account required/i);
});

test('resolveAudienceFeatureAccess allows support-or-account features with supporter access', () => {
    const access = resolveAudienceFeatureAccess({
        policy: {
            features: {
                customEmoji: AUDIENCE_FEATURE_ACCESS_LEVELS.supportOrAccount,
            },
        },
        featureKey: AUDIENCE_FEATURE_KEYS.customEmoji,
        isSignedIn: false,
        hasSupporterAccess: true,
    });

    assert.equal(access.allowed, true);
    assert.equal(access.blocked, false);
    assert.equal(access.unlockPath, null);
});
