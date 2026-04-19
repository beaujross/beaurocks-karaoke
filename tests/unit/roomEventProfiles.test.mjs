import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    AAHF_KICKOFF_EVENT_PROFILE_ID,
    AAHF_KICKOFF_STARTS_AT_LOCAL,
    buildAahfKickoffStarterTemplate,
    buildRoomEventProfilePatch,
    getRoomEventProfileMeta,
} from '../../src/apps/Host/roomEventProfiles.js';

test('roomEventProfiles applies AAHF defaults and disables stray overlays', () => {
    const patch = buildRoomEventProfilePatch(AAHF_KICKOFF_EVENT_PROFILE_ID, {
        startsAtLocal: AAHF_KICKOFF_STARTS_AT_LOCAL,
        startsAtMs: Date.parse('2026-05-01T19:00:00-07:00'),
    });

    assert.ok(patch);
    assert.equal(patch.eventProfileId, AAHF_KICKOFF_EVENT_PROFILE_ID);
    assert.equal(patch.hostNightPreset, 'competition');
    assert.equal(patch.marqueeEnabled, false);
    assert.equal(patch.popTriviaEnabled, false);
    assert.equal(patch.programMode, 'run_of_show');
    assert.equal(patch.runOfShowEnabled, true);
    assert.match(patch.logoUrl, /aahf/i);
    assert.match(patch.lobbyOrbSkinUrl, /aahf/i);
    assert.equal(patch.runOfShowPolicy?.defaultAutomationMode, 'auto');

    const items = Array.isArray(patch.runOfShowDirector?.items) ? patch.runOfShowDirector.items : [];
    assert.ok(items.some((item) => item.type === 'trivia_break'));
    assert.ok(items.some((item) => item.type === 'would_you_rather_break'));

    const triviaBreak = items.find((item) => item.type === 'trivia_break');
    assert.equal(triviaBreak?.modeLaunchPlan?.modeKey, 'trivia_pop');
    assert.equal(triviaBreak?.modeLaunchPlan?.launchConfig?.correctIndex, 0);

    const wyrBreaks = items.filter((item) => item.type === 'would_you_rather_break');
    assert.ok(wyrBreaks.length >= 2);
    assert.deepEqual(wyrBreaks[0]?.modeLaunchPlan?.launchConfig?.options, ['Power ballad', 'Singalong anthem']);
});

test('roomEventProfiles exposes AAHF setup highlights and seeded break scenes', () => {
    const profile = getRoomEventProfileMeta(AAHF_KICKOFF_EVENT_PROFILE_ID);
    assert.ok(profile);
    assert.equal(profile?.setupHighlights?.length, 3);

    const template = buildAahfKickoffStarterTemplate(Date.parse('2026-05-01T19:00:00-07:00'));
    assert.equal(template.runOfShowPolicy?.defaultAutomationMode, 'auto');

    const items = Array.isArray(template.runOfShowDirector?.items) ? template.runOfShowDirector.items : [];
    assert.equal(items[0]?.type, 'intro');
    assert.ok(items.some((item) => item.type === 'trivia_break' && /Keep the room engaged/i.test(item?.presentationPlan?.subhead || '')));
    assert.ok(items.some((item) => item.type === 'would_you_rather_break' && /Crowd vote break/i.test(item?.presentationPlan?.headline || '')));
});
