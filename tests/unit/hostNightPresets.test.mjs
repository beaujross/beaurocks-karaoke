import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    BUILTIN_HOST_NIGHT_PRESETS,
    buildHostNightPresetConfig,
    mergeHostNightPresets,
    normalizeHostNightPresetRecord,
} from '../../src/apps/Host/hostNightPresets.js';

test('AAHF preset carries streamlined audience defaults', () => {
    const config = buildHostNightPresetConfig(BUILTIN_HOST_NIGHT_PRESETS.aahf);

    assert.ok(config);
    assert.equal(config.id, 'aahf');
    assert.equal(config.settings.audienceShellVariant, 'streamlined');
    assert.equal(config.settings.marqueeEnabled, false);
    assert.equal(config.settings.popTriviaEnabled, false);
    assert.equal(config.settings.audienceFeatureAccess.features.customEmoji, 'open');
    assert.equal(config.audienceBrandTheme.appTitle, 'AAHF Festival');
});

test('custom preset normalization preserves queue and request policy fields', () => {
    const preset = normalizeHostNightPresetRecord({
        id: 'festival_custom',
        label: 'Festival Custom',
        description: 'Dialed in for a festival room.',
        basePresetId: 'competition',
        settings: {
            requestMode: 'guest_backing_optional',
            allowSingerTrackSelect: true,
            audienceShellVariant: 'streamlined',
            queueSettings: {
                limitMode: 'per_night',
                limitCount: 3,
                rotation: 'fifo',
                firstTimeBoost: false,
            },
        },
    }, BUILTIN_HOST_NIGHT_PRESETS.competition);

    assert.ok(preset);
    assert.equal(preset.id, 'festival_custom');
    assert.equal(preset.basePresetId, 'competition');
    assert.equal(preset.settings.requestMode, 'guest_backing_optional');
    assert.equal(preset.settings.allowSingerTrackSelect, true);
    assert.equal(preset.settings.queueSettings.limitCount, 3);
    assert.equal(preset.settings.queueSettings.rotation, 'fifo');
    assert.equal(preset.settings.queueSettings.firstTimeBoost, false);
});

test('mergeHostNightPresets exposes custom presets and room-scoped preset configs', () => {
    const merged = mergeHostNightPresets(
        {
            house_special: normalizeHostNightPresetRecord({
                id: 'house_special',
                label: 'House Special',
                basePresetId: 'casual',
            }),
        },
        {
            id: 'room_only',
            label: 'Room Only',
            basePresetId: 'competition',
            settings: {
                audienceShellVariant: 'streamlined',
            },
        }
    );

    assert.ok(merged.casual);
    assert.ok(merged.house_special);
    assert.ok(merged.room_only);
    assert.equal(merged.room_only.settings.audienceShellVariant, 'streamlined');
});
