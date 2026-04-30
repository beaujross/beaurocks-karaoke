import assert from 'node:assert/strict';
import { test } from 'vitest';

import { buildCurrentRoomRunOfShowDraft } from '../../src/apps/Host/lib/currentRoomRunOfShowDraft.js';
import { AAHF_KICKOFF_EVENT_PROFILE_ID } from '../../src/apps/Host/roomEventProfiles.js';

test('buildCurrentRoomRunOfShowDraft fills AAHF performance slots and appends room scenes', () => {
    const result = buildCurrentRoomRunOfShowDraft({
        eventProfileId: AAHF_KICKOFF_EVENT_PROFILE_ID,
        queueSongs: [
            {
                id: 'song_1',
                status: 'requested',
                singerName: 'Taylor',
                singerUid: 'user_1',
                songTitle: 'Valerie',
                artist: 'Amy Winehouse',
                songId: 'valerie',
                mediaUrl: 'https://www.youtube.com/watch?v=def456xyz89',
                duration: 220,
            },
            {
                id: 'song_2',
                status: 'requested',
                singerName: 'Jordan',
                singerUid: 'user_2',
                songTitle: 'Dreams',
                artist: 'Fleetwood Mac',
                songId: 'dreams',
                mediaUrl: 'https://www.youtube.com/watch?v=ghi456xyz89',
                duration: 215,
            },
        ],
        scenePresets: [
            {
                id: 'scene_1',
                title: 'Festival Flyer',
                mediaUrl: 'https://example.com/flyer.png',
                durationSec: 20,
            },
        ],
        now: Date.parse('2026-05-01T19:00:00-07:00'),
    });

    assert.equal(result.label, 'AAHF Kick-Off from current room');
    assert.ok(result.runOfShowPolicy);
    assert.ok(result.items.length > 2);
    assert.equal(result.items[0].type, 'intro');

    const firstPerformance = result.items.find((item) => item.type === 'performance');
    assert.equal(firstPerformance?.assignedPerformerName, 'Taylor');
    assert.equal(firstPerformance?.songTitle, 'Valerie');
    assert.equal(firstPerformance?.preparedQueueSongId, 'song_1');
    assert.equal(firstPerformance?.queueLinkState, 'linked');

    const secondPerformance = result.items.filter((item) => item.type === 'performance')[1];
    assert.equal(secondPerformance?.assignedPerformerName, 'Jordan');

    const sceneItem = result.items.find((item) => item.presentationPlan?.mediaSceneUrl === 'https://example.com/flyer.png');
    assert.ok(sceneItem);
    assert.equal(sceneItem?.type, 'announcement');
    assert.equal(sceneItem?.presentationPlan?.takeoverScene, 'media_scene');
}
);

test('buildCurrentRoomRunOfShowDraft falls back to a simple queue-and-scene draft outside AAHF', () => {
    const result = buildCurrentRoomRunOfShowDraft({
        eventProfileId: 'generic_night',
        queueSongs: [
            {
                id: 'song_1',
                status: 'requested',
                singerName: 'Alex',
                songTitle: 'Mr. Brightside',
                artist: 'The Killers',
                songId: 'mr_brightside',
                mediaUrl: 'https://example.com/backing.mp4',
            },
        ],
        scenePresets: [
            {
                id: 'scene_1',
                title: 'Sponsor Slide',
                mediaUrl: 'https://example.com/sponsor.png',
                durationSec: 15,
            },
        ],
    });

    assert.equal(result.label, 'Current room draft');
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].type, 'performance');
    assert.equal(result.items[0].assignedPerformerName, 'Alex');
    assert.equal(result.items[1].type, 'announcement');
    assert.equal(result.items[1].presentationPlan?.mediaSceneUrl, 'https://example.com/sponsor.png');
});
