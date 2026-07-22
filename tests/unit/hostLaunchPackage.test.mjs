import assert from 'node:assert/strict';
import { test } from 'vitest';
import { runRoomLaunchPackage } from '../../src/apps/Host/hostLaunchPackage.js';

test('Room launch opens Public TV, applies Tonight Setup, and copies the Audience App link', async () => {
    const calls = [];
    const result = await runRoomLaunchPackage({
        roomCode: 'party',
        tvUrl: 'https://example.test/tv?room=PARTY',
        audienceUrl: 'https://example.test/join?room=PARTY',
        openPublicTv: async () => {
            calls.push('tv');
            return true;
        },
        applySetup: async () => {
            calls.push('setup');
            return true;
        },
        copyAudienceLink: async () => {
            calls.push('audience');
            return true;
        },
    });

    assert.deepEqual(calls, ['tv', 'setup', 'audience']);
    assert.equal(result.ok, true);
    assert.equal(result.applied, true);
    assert.equal(result.tvOpened, true);
    assert.equal(result.joinLinkCopied, true);
    assert.equal(result.needsRecovery, false);
    assert.match(result.message, /Room launched/);
});

test('Room launch reports partial success so Host Dashboard can recover blocked handoffs', async () => {
    const result = await runRoomLaunchPackage({
        roomCode: 'PARTY',
        tvUrl: 'https://example.test/tv?room=PARTY',
        audienceUrl: 'https://example.test/join?room=PARTY',
        openPublicTv: async () => false,
        applySetup: async () => true,
        copyAudienceLink: async () => false,
    });

    assert.equal(result.ok, true);
    assert.equal(result.applied, true);
    assert.equal(result.tvOpened, false);
    assert.equal(result.joinLinkCopied, false);
    assert.equal(result.needsRecovery, true);
    assert.match(result.message, /Open Public TV and copy the Audience App link/);
});

test('Room launch does not copy the join link when Tonight Setup fails', async () => {
    let copyAttempts = 0;
    const result = await runRoomLaunchPackage({
        roomCode: 'PARTY',
        tvUrl: 'https://example.test/tv?room=PARTY',
        audienceUrl: 'https://example.test/join?room=PARTY',
        openPublicTv: async () => true,
        applySetup: async () => false,
        copyAudienceLink: async () => {
            copyAttempts += 1;
            return true;
        },
    });

    assert.equal(copyAttempts, 0);
    assert.equal(result.ok, false);
    assert.equal(result.applied, false);
    assert.match(result.message, /Tonight Setup/);
});

test('Room launch identifies missing surface links without claiming full success', async () => {
    const result = await runRoomLaunchPackage({
        roomCode: 'PARTY',
        applySetup: async () => true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.tvReady, false);
    assert.equal(result.joinLinkReady, false);
    assert.equal(result.needsRecovery, true);
    assert.match(result.message, /links are unavailable/);
});
