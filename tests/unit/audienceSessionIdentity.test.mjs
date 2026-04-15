import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { resolveAudienceSessionUid } from '../../src/lib/audienceSessionIdentity.js';

describe('audienceSessionIdentity', () => {
    test('prefers current auth uid first', () => {
        assert.equal(resolveAudienceSessionUid({
            authCurrentUid: 'auth-current',
            authReadyUid: 'auth-ready',
            joinResultUid: 'join-result',
            routeUid: 'route-uid'
        }), 'auth-current');
    });

    test('uses join result uid when auth state has not propagated yet', () => {
        assert.equal(resolveAudienceSessionUid({
            authCurrentUid: '',
            authReadyUid: '',
            joinResultUid: 'join-result',
            routeUid: ''
        }), 'join-result');
    });

    test('falls back to route uid when nothing else is available', () => {
        assert.equal(resolveAudienceSessionUid({
            authCurrentUid: '',
            authReadyUid: '',
            joinResultUid: '',
            routeUid: 'route-uid'
        }), 'route-uid');
    });
});
