import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    ROOM_SETUP_BEHAVIOR_DOMAINS,
    resolveRoomSetupEffectiveBehavior,
} from '../../src/apps/Host/roomSetupEffectiveBehavior.js';

const BASE_BEHAVIOR = {
    autoDj: false,
    autoDjDelaySec: 10,
    autoPlayMedia: true,
    autoBgMusic: false,
    showScoring: true,
    chatShowOnTv: false,
    marqueeEnabled: false,
    popTriviaEnabled: false,
    requestMode: 'canonical_open',
    allowSingerTrackSelect: false,
    hideNonEmbeddableYouTube: true,
    queueSettings: {
        limitMode: 'none',
        limitCount: 0,
        rotation: 'round_robin',
        firstTimeBoost: true,
    },
    hostNightPresetConfig: {
        searchSources: { local: true, youtube: true, itunes: true },
    },
    eventCredits: {
        enabled: false,
        generalAdmissionPoints: 0,
    },
};

test('room setup behavior resolves the five Host-facing domains in their canonical order', () => {
    const contract = resolveRoomSetupEffectiveBehavior({ effectiveRoom: BASE_BEHAVIOR });

    assert.equal(contract.version, 1);
    assert.deepEqual(
        contract.domains.map((domain) => domain.key),
        ROOM_SETUP_BEHAVIOR_DOMAINS.map((domain) => domain.key),
    );
    assert.match(contract.domains.find((domain) => domain.key === 'operating_style').summary, /Host-led flow/i);
    assert.match(contract.domains.find((domain) => domain.key === 'economics').summary, /Participation points/i);
    assert.match(contract.domains.find((domain) => domain.key === 'media').summary, /YouTube/i);
    assert.match(contract.domains.find((domain) => domain.key === 'media').summary, /Apple catalog/i);
});

test('crowd domain explains the effective guest entry policy', () => {
    const contract = resolveRoomSetupEffectiveBehavior({
        effectiveRoom: {
            ...BASE_BEHAVIOR,
            audienceJoinPolicy: { accessMode: 'email_capture' },
        },
    });
    const crowd = contract.domains.find((domain) => domain.key === 'crowd_experience');

    assert.equal(crowd.details.find((detail) => detail.label === 'Guest entry').value, 'Email entry');
});

test('room setup behavior applies provisioning, mission, and direct exceptions in order with provenance', () => {
    const room = structuredClone(BASE_BEHAVIOR);
    const mission = {
        autoDj: true,
        showScoring: false,
        queueSettings: {
            limitMode: 'per_night',
            limitCount: 2,
            rotation: 'round_robin',
            firstTimeBoost: false,
        },
    };
    const exception = { showScoring: true, chatShowOnTv: true };
    const contract = resolveRoomSetupEffectiveBehavior({
        layers: [
            { id: 'provisioning', label: 'Room defaults', type: 'provisioning', values: room },
            { id: 'mission', label: 'Casual + Smart Assist', type: 'mission', values: mission },
            { id: 'direct', label: 'Tonight exceptions', type: 'direct_edit', values: exception },
        ],
        exceptionCount: 2,
    });

    assert.equal(contract.effective.autoDj, true);
    assert.equal(contract.effective.showScoring, true);
    assert.equal(contract.effective.chatShowOnTv, true);
    assert.equal(contract.effective.queueSettings.limitCount, 2);
    assert.equal(contract.domains.find((domain) => domain.key === 'crowd_experience').provenance.sourceId, 'direct');
    assert.equal(contract.domains.find((domain) => domain.key === 'advanced_exceptions').provenance.sourceId, 'direct');
    assert.match(contract.domains.find((domain) => domain.key === 'advanced_exceptions').summary, /2 confirmed exceptions/i);
    assert.deepEqual(room, BASE_BEHAVIOR);
});

test('equivalent choices have the same behavior key regardless of their authoring path', () => {
    const fromPreset = resolveRoomSetupEffectiveBehavior({
        layers: [{ id: 'preset', label: 'Casual Night', type: 'preset', values: BASE_BEHAVIOR }],
    });
    const fromProfile = resolveRoomSetupEffectiveBehavior({
        layers: [{ id: 'profile', label: 'Event profile', type: 'event_profile', values: structuredClone(BASE_BEHAVIOR) }],
    });

    assert.equal(fromPreset.behaviorKey, fromProfile.behaviorKey);
    assert.deepEqual(
        fromPreset.domains.map(({ key, summary }) => ({ key, summary })),
        fromProfile.domains.map(({ key, summary }) => ({ key, summary })),
    );
    assert.equal(fromPreset.domains[0].provenance.sourceLabel, 'Casual Night');
    assert.equal(fromProfile.domains[0].provenance.sourceLabel, 'Event profile');
});

test('economics domain distinguishes BeauBucks from participation points and explains support', () => {
    const contract = resolveRoomSetupEffectiveBehavior({
        effectiveRoom: {
            ...BASE_BEHAVIOR,
            eventCredits: {
                enabled: true,
                presetId: 'ticketed_event',
                generalAdmissionPoints: 2000,
                timedLobbyEnabled: false,
                supportProvider: 'givebutter',
                supportLabel: 'Support tonight\'s performers',
            },
        },
    });
    const economics = contract.domains.find((domain) => domain.key === 'economics');

    assert.match(economics.summary, /2000 BeauBucks at entry/i);
    assert.equal(economics.details.find((detail) => detail.label === 'Real-money support').value, 'Support tonight\'s performers');
});

test('media domain remains content agnostic while describing YouTube embed protection', () => {
    const contract = resolveRoomSetupEffectiveBehavior({
        effectiveRoom: {
            ...BASE_BEHAVIOR,
            requestMode: 'guest_backing_optional',
            allowSingerTrackSelect: true,
            autoBgMusic: true,
        },
    });
    const media = contract.domains.find((domain) => domain.key === 'media');

    assert.match(media.summary, /BeauRocks \+ local files/i);
    assert.match(media.summary, /YouTube/i);
    assert.match(media.summary, /Apple catalog/i);
    assert.equal(media.details.find((detail) => detail.label === 'YouTube safety').value, 'Non-embeddable results stay hidden');
    assert.equal(media.details.find((detail) => detail.label === 'Background audio').value, 'Enabled between performances');
});
