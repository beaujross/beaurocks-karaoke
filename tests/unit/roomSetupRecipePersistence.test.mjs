import { describe, expect, it } from 'vitest';
import {
  BUILTIN_HOST_NIGHT_PRESETS,
  buildHostNightPresetConfig,
  normalizeHostNightPresetRecord,
} from '../../src/apps/Host/hostNightPresets.js';

describe('saved room recipe persistence', () => {
  it('preserves recipe ingredients in custom preset records and room config', () => {
    const recipe = {
      flowRule: 'fair_turns',
      assistLevel: 'manual_first',
      spotlightMode: 'karaoke',
      overrides: { showScoring: true },
      party: { autoCrowdMomentsEnabled: false },
    };
    const normalized = normalizeHostNightPresetRecord({
      id: 'my_scored_night',
      label: 'My Scored Night',
      basePresetId: 'competition',
      recipe,
    }, BUILTIN_HOST_NIGHT_PRESETS.competition);
    const config = buildHostNightPresetConfig(normalized);

    expect(normalized.recipe).toEqual(recipe);
    expect(config.recipe).toEqual(recipe);
  });
});
