import { describe, expect, it } from 'vitest';
import { BUILTIN_HOST_NIGHT_PRESETS } from '../../src/apps/Host/hostNightPresets.js';
import {
  buildRoomSetupRecipePreflight,
  buildRoomSetupRecipeCards,
  isRoomSetupRecipeSelected,
} from '../../src/apps/Host/roomSetupRecipes.js';

describe('room setup recipes', () => {
  it('combines queue, assistance, scoring, media, and break behavior into public recipe cards', () => {
    const cards = buildRoomSetupRecipeCards({
      presets: Object.values(BUILTIN_HOST_NIGHT_PRESETS),
    });

    expect(cards.map((card) => card.id)).toEqual([
      'party_karaoke',
      'crowd_singalong',
      'lip_sync_night',
      'score_challenge',
      'karaoke_trivia',
    ]);
    expect(cards.find((card) => card.id === 'score_challenge')).toMatchObject({
      presetId: 'competition',
      flowRule: 'fair_turns',
      assistLevel: 'manual_first',
      overrides: { showScoring: true },
    });
    expect(cards.find((card) => card.id === 'crowd_singalong')).toMatchObject({
      presetId: 'casual',
      performanceMode: 'sing_along',
      overrides: { showScoring: false, showLyricsTv: true, autoLyricsOnQueue: true },
      requirements: { originalRecording: true, lyrics: 'preferred' },
    });
    expect(cards.find((card) => card.id === 'lip_sync_night')).toMatchObject({
      presetId: 'casual',
      performanceMode: 'lip_sync',
      overrides: { showScoring: false, autoLyricsOnQueue: false },
      requirements: { originalRecording: true, lyrics: 'optional' },
    });
    expect(cards.find((card) => card.id === 'karaoke_trivia')?.party).toMatchObject({
      autoCrowdMomentsEnabled: true,
      autoCrowdMomentEverySongs: 3,
    });
    expect(cards.some((card) => card.presetId === 'aahf')).toBe(false);
  });

  it('turns custom host presets into reusable saved recipes', () => {
    const custom = {
      ...BUILTIN_HOST_NIGHT_PRESETS.casual,
      id: 'my_house_party',
      label: 'My House Party',
      isBuiltIn: false,
      recipe: {
        flowRule: 'rapid_fire',
        assistLevel: 'autopilot_first',
        spotlightMode: 'karaoke',
        party: { autoCrowdMomentsEnabled: true },
      },
    };
    const cards = buildRoomSetupRecipeCards({
      presets: [...Object.values(BUILTIN_HOST_NIGHT_PRESETS), custom],
    });
    const saved = cards.find((card) => card.id === 'saved_my_house_party');

    expect(saved).toMatchObject({
      label: 'My House Party',
      eyebrow: 'Saved recipe',
      flowRule: 'rapid_fire',
      assistLevel: 'autopilot_first',
      isSaved: true,
    });
    expect(isRoomSetupRecipeSelected(saved, {
      archetype: 'my_house_party',
      flowRule: 'rapid_fire',
      assistLevel: 'autopilot_first',
      spotlightMode: 'karaoke',
    })).toBe(true);
  });

  it('keeps formats with the same base preset visually distinct', () => {
    const singAlong = buildRoomSetupRecipeCards({
      presets: Object.values(BUILTIN_HOST_NIGHT_PRESETS),
    }).find((card) => card.id === 'crowd_singalong');

    expect(isRoomSetupRecipeSelected(singAlong, {
      archetype: 'casual',
      flowRule: 'balanced',
      assistLevel: 'smart_assist',
      spotlightMode: 'karaoke',
      performanceMode: 'karaoke',
    })).toBe(false);
    expect(isRoomSetupRecipeSelected(singAlong, {
      archetype: 'casual',
      flowRule: 'balanced',
      assistLevel: 'smart_assist',
      spotlightMode: 'karaoke',
      performanceMode: 'sing_along',
    })).toBe(true);
  });

  it('shows playback source readiness only when the selected format needs it', () => {
    const cards = buildRoomSetupRecipeCards({
      presets: Object.values(BUILTIN_HOST_NIGHT_PRESETS),
    });
    const karaoke = cards.find((card) => card.id === 'party_karaoke');
    const singAlong = cards.find((card) => card.id === 'crowd_singalong');

    expect(buildRoomSetupRecipePreflight(karaoke)).toBeNull();
    expect(buildRoomSetupRecipePreflight(singAlong, {
      searchSources: { itunes: true, youtube: true, local: true },
      appleMusicAuthorized: true,
    })).toMatchObject({ status: 'ready', provider: 'apple' });
    expect(buildRoomSetupRecipePreflight(singAlong, {
      searchSources: { itunes: true, youtube: true, local: true },
    })).toMatchObject({ status: 'review', provider: 'youtube' });
  });
});
