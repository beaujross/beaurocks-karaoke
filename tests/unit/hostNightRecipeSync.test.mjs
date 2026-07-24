import { describe, expect, it } from 'vitest';
import {
  HOST_NIGHT_RECIPE_MIGRATION_OWNER_KEY,
  MAX_CUSTOM_HOST_NIGHT_RECIPES,
  claimLegacyHostNightRecipeState,
  createHostNightRecipeSyncState,
  deleteHostNightRecipe,
  getHostNightRecipeStorageKey,
  isHostNightRecipeStorageScopeActive,
  loadHostNightRecipeSyncState,
  mergeHostNightRecipeSyncStates,
  persistHostNightRecipeSyncState,
  upsertHostNightRecipe,
} from '../../src/apps/Host/hostNightRecipeSync.js';
import { HOST_NIGHT_PRESET_STORAGE_KEY } from '../../src/apps/Host/hostNightPresets.js';

const createStorage = (seed = {}) => {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    snapshot: () => Object.fromEntries(values),
  };
};

const recipe = (id, updatedAtMs, label = id) => ({
  id,
  label,
  description: `${label} setup`,
  basePresetId: 'casual',
  updatedAtMs,
});

describe('Host Night Setup recipe sync', () => {
  it('loads the legacy array and persists a versioned account-scoped envelope', () => {
    const storage = createStorage({
      [HOST_NIGHT_PRESET_STORAGE_KEY]: JSON.stringify([recipe('legacy_recipe', 100)]),
    });

    const legacyState = loadHostNightRecipeSyncState({ storage });
    expect(legacyState.presets.legacy_recipe?.label).toBe('legacy_recipe');

    const storageKey = getHostNightRecipeStorageKey('host-123');
    expect(storageKey).toContain('account:host-123');
    expect(persistHostNightRecipeSyncState({ state: legacyState, storage, storageKey })).toBe(true);

    const persisted = JSON.parse(storage.snapshot()[storageKey]);
    expect(persisted.schemaVersion).toBe(1);
    expect(persisted.presets).toHaveLength(1);
    expect(persisted.presets[0].id).toBe('legacy_recipe');
  });

  it('uses the newest recipe across devices and retains unrelated recipes', () => {
    const local = createHostNightRecipeSyncState({
      presets: {
        shared: recipe('shared', 100, 'Local old'),
        local_only: recipe('local_only', 150, 'Local only'),
      },
    });
    const remote = createHostNightRecipeSyncState({
      presets: {
        shared: recipe('shared', 200, 'Remote new'),
        remote_only: recipe('remote_only', 175, 'Remote only'),
      },
    });

    const merged = mergeHostNightRecipeSyncStates(local, remote);
    expect(merged.presets.shared.label).toBe('Remote new');
    expect(merged.presets.local_only.label).toBe('Local only');
    expect(merged.presets.remote_only.label).toBe('Remote only');
  });

  it('keeps a deleted recipe deleted when a stale device reconnects', () => {
    const staleDevice = createHostNightRecipeSyncState({
      presets: { movie_night: recipe('movie_night', 100) },
    });
    const deletedOnAnotherDevice = deleteHostNightRecipe(staleDevice, 'movie_night', 200);

    const merged = mergeHostNightRecipeSyncStates(staleDevice, deletedOnAnotherDevice);
    expect(merged.presets.movie_night).toBeUndefined();
    expect(merged.deletedAtById.movie_night).toBe(200);
  });

  it('allows a deliberately re-saved recipe to supersede an older deletion marker', () => {
    const deleted = deleteHostNightRecipe({
      presets: { scored_night: recipe('scored_night', 100) },
    }, 'scored_night', 200);
    const restored = upsertHostNightRecipe(deleted, recipe('scored_night', 300, 'Scored Night Returns'));

    expect(restored.presets.scored_night.label).toBe('Scored Night Returns');
    expect(restored.deletedAtById.scored_night).toBeUndefined();
  });

  it('caps account recipe records before they can bloat private settings', () => {
    const presets = Object.fromEntries(
      Array.from({ length: MAX_CUSTOM_HOST_NIGHT_RECIPES + 5 }, (_, index) => [
        `recipe_${index}`,
        recipe(`recipe_${index}`, index + 1),
      ])
    );

    const state = createHostNightRecipeSyncState({ presets });
    expect(Object.keys(state.presets)).toHaveLength(MAX_CUSTOM_HOST_NIGHT_RECIPES);
    expect(state.presets.recipe_28).toBeDefined();
    expect(state.presets.recipe_0).toBeUndefined();
  });

  it('lets only the first signed-in account claim the unscoped legacy cache', () => {
    const storage = createStorage({
      [HOST_NIGHT_PRESET_STORAGE_KEY]: JSON.stringify([recipe('legacy_recipe', 100)]),
    });

    const firstAccount = claimLegacyHostNightRecipeState({ accountUid: 'host-a', storage });
    const secondAccount = claimLegacyHostNightRecipeState({ accountUid: 'host-b', storage });

    expect(firstAccount.presets.legacy_recipe).toBeDefined();
    expect(secondAccount.presets.legacy_recipe).toBeUndefined();
    expect(storage.snapshot()[HOST_NIGHT_RECIPE_MIGRATION_OWNER_KEY]).toBe('host-a');
  });

  it('does not persist in-memory recipes while an account storage scope is changing', () => {
    expect(isHostNightRecipeStorageScopeActive({
      activeAccountUid: 'host-a',
      signedInAccountUid: 'host-a',
    })).toBe(true);
    expect(isHostNightRecipeStorageScopeActive({
      activeAccountUid: 'host-a',
      signedInAccountUid: 'host-b',
    })).toBe(false);
    expect(isHostNightRecipeStorageScopeActive({
      activeAccountUid: 'host-a',
      signedInAccountUid: '',
    })).toBe(false);
  });
});
