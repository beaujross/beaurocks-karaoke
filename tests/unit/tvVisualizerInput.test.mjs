import { test } from 'vitest';

import {
    canAttemptVisualizerMicrophone,
    getTvVisualizerInputMode,
    isAudioMediaUrl,
    isNonRetryableVisualizerMicrophoneError,
    resolveTvVisualizerSource,
} from '../../src/lib/tvVisualizerInput.js';

test('Auto visualizer prefers active local stage audio over background music and microphone', () => {
    assert.equal(resolveTvVisualizerSource({
        configuredSource: 'auto',
        hostBgMusicActive: true,
        stageMediaUrl: 'https://storage.test/sing-along.m4a?token=1',
        stagePlaying: true,
    }), 'stage_media');
    assert.equal(getTvVisualizerInputMode('stage_media'), 'media');
    assert.equal(isAudioMediaUrl('https://storage.test/sing-along.mp3#play'), true);
});

test('Auto visualizer preserves explicit and applause microphone choices', () => {
    assert.equal(resolveTvVisualizerSource({
        configuredSource: 'off',
        stageMediaUrl: 'https://storage.test/song.mp3',
        stagePlaying: true,
    }), 'off');
    assert.equal(resolveTvVisualizerSource({
        activeMode: 'applause',
        configuredSource: 'auto',
        stageMediaUrl: 'https://storage.test/song.mp3',
        stagePlaying: true,
    }), 'stage_mic');
});

test('Auto visualizer falls back through background music and stage microphone', () => {
    assert.equal(resolveTvVisualizerSource({
        configuredSource: 'auto',
        hostBgMusicActive: true,
    }), 'host_bg');
    assert.equal(resolveTvVisualizerSource({ configuredSource: 'auto' }), 'stage_mic');
});

test('microphone preflight respects permissions policy and denied browser permission', async () => {
    assert.equal(await canAttemptVisualizerMicrophone({
        documentRef: { permissionsPolicy: { allowsFeature: () => false } },
        navigatorRef: { mediaDevices: { getUserMedia: () => {} } },
    }), false);

    assert.equal(await canAttemptVisualizerMicrophone({
        documentRef: { permissionsPolicy: { allowsFeature: () => true } },
        navigatorRef: {
            mediaDevices: { getUserMedia: () => {} },
            permissions: { query: async () => ({ state: 'denied' }) },
        },
    }), false);
});

test('permission and security failures do not enter the visualizer retry loop', () => {
    assert.equal(isNonRetryableVisualizerMicrophoneError({ name: 'NotAllowedError' }), true);
    assert.equal(isNonRetryableVisualizerMicrophoneError({ name: 'SecurityError' }), true);
    assert.equal(isNonRetryableVisualizerMicrophoneError({ name: 'NotReadableError' }), false);
});
