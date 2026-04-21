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
    assert.equal(
        normalized.features.premiumReactions,
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

test('normalizeAudienceFeatureAccess allows reaction emoji policy to follow custom emoji policy', () => {
    const openPolicy = normalizeAudienceFeatureAccess({
        features: {
            customEmoji: AUDIENCE_FEATURE_ACCESS_LEVELS.open,
        },
    });
    assert.equal(openPolicy.features.premiumReactions, AUDIENCE_FEATURE_ACCESS_LEVELS.open);

    const explicitPolicy = normalizeAudienceFeatureAccess({
        features: {
            customEmoji: AUDIENCE_FEATURE_ACCESS_LEVELS.open,
            premiumReactions: AUDIENCE_FEATURE_ACCESS_LEVELS.accountRequired,
        },
    });
    assert.equal(explicitPolicy.features.premiumReactions, AUDIENCE_FEATURE_ACCESS_LEVELS.accountRequired);
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
