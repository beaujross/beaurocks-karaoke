import { describe, expect, it } from 'vitest';
import {
  buildMissionDraftFromRoom,
  buildMissionPartyFromRoom,
} from '../../src/apps/Host/missionControl.js';

describe('room recipe launch handoff', () => {
  it('carries the launch recipe into Room Readiness', () => {
    const room = {
      hostNightPreset: 'casual',
      queueSettings: {
        limitMode: 'none',
        rotation: 'round_robin',
        firstTimeBoost: true,
      },
      hostNightPresetConfig: {
        recipe: {
          flowRule: 'balanced',
          assistLevel: 'smart_assist',
          spotlightMode: 'karaoke',
          party: {
            autoCrowdMomentsEnabled: true,
            autoCrowdMomentEverySongs: 3,
            autoCrowdMomentPreferredTypes: ['trivia', 'would_you_rather'],
          },
        },
      },
    };

    expect(buildMissionDraftFromRoom(room)).toEqual({
      archetype: 'casual',
      flowRule: 'balanced',
      assistLevel: 'smart_assist',
      spotlightMode: 'karaoke',
    });
    expect(buildMissionPartyFromRoom(room)).toMatchObject({
      autoCrowdMomentsEnabled: true,
      autoCrowdMomentEverySongs: 3,
      autoCrowdMomentPreferredTypes: ['trivia', 'would_you_rather'],
    });
  });

  it('lets live mission-control choices override the original launch recipe', () => {
    const room = {
      hostNightPreset: 'casual',
      hostNightPresetConfig: {
        recipe: {
          flowRule: 'balanced',
          assistLevel: 'smart_assist',
          spotlightMode: 'karaoke',
          party: { autoCrowdMomentsEnabled: true },
        },
      },
      missionControl: {
        setupDraft: {
          archetype: 'competition',
          flowRule: 'fair_turns',
          assistLevel: 'manual_first',
          spotlightMode: 'karaoke',
        },
        party: {
          autoCrowdMomentsEnabled: false,
        },
      },
    };

    expect(buildMissionDraftFromRoom(room)).toMatchObject({
      archetype: 'competition',
      flowRule: 'fair_turns',
      assistLevel: 'manual_first',
    });
    expect(buildMissionPartyFromRoom(room).autoCrowdMomentsEnabled).toBe(false);
  });
});
