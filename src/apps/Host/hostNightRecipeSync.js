import {
    BUILTIN_HOST_NIGHT_PRESETS,
    HOST_NIGHT_PRESET_STORAGE_KEY,
    normalizeHostNightPresetRecord,
} from './hostNightPresets.js';

export const HOST_NIGHT_RECIPE_SCHEMA_VERSION = 1;
export const MAX_CUSTOM_HOST_NIGHT_RECIPES = 24;
export const MAX_HOST_NIGHT_RECIPE_TOMBSTONES = 64;
export const HOST_NIGHT_RECIPE_MIGRATION_OWNER_KEY = `${HOST_NIGHT_PRESET_STORAGE_KEY}:migration-owner`;

const normalizeRecipeId = (value = '') => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

const normalizeRecipeEntries = (presets = {}) => {
    const entries = Array.isArray(presets) ? presets : Object.values(presets || {});
    return entries
        .map((entry) => normalizeHostNightPresetRecord(
            entry,
            BUILTIN_HOST_NIGHT_PRESETS[entry?.basePresetId] || BUILTIN_HOST_NIGHT_PRESETS.casual
        ))
        .filter((entry) => entry && !entry.isBuiltIn && !BUILTIN_HOST_NIGHT_PRESETS[entry.id])
        .sort((left, right) => {
            const timeDelta = Number(right?.updatedAtMs || 0) - Number(left?.updatedAtMs || 0);
            if (timeDelta !== 0) return timeDelta;
            return String(left?.id || '').localeCompare(String(right?.id || ''));
        })
        .slice(0, MAX_CUSTOM_HOST_NIGHT_RECIPES);
};

const normalizeRecipeTombstones = (deletedAtById = {}) =>
    Object.entries(deletedAtById && typeof deletedAtById === 'object' ? deletedAtById : {})
        .map(([id, deletedAtMs]) => [
            normalizeRecipeId(id),
            Math.max(0, Number(deletedAtMs || 0) || 0),
        ])
        .filter(([id, deletedAtMs]) => id && deletedAtMs > 0 && !BUILTIN_HOST_NIGHT_PRESETS[id])
        .sort((left, right) => {
            const timeDelta = right[1] - left[1];
            if (timeDelta !== 0) return timeDelta;
            return left[0].localeCompare(right[0]);
        })
        .slice(0, MAX_HOST_NIGHT_RECIPE_TOMBSTONES)
        .reduce((acc, [id, deletedAtMs]) => {
            acc[id] = deletedAtMs;
            return acc;
        }, {});

export const createHostNightRecipeSyncState = ({
    presets = {},
    deletedAtById = {},
} = {}) => {
    const normalizedDeletedAtById = normalizeRecipeTombstones(deletedAtById);
    const normalizedPresets = normalizeRecipeEntries(presets).reduce((acc, entry) => {
        const deletedAtMs = Number(normalizedDeletedAtById[entry.id] || 0);
        if (deletedAtMs >= Number(entry.updatedAtMs || 0)) return acc;
        acc[entry.id] = entry;
        return acc;
    }, {});
    return {
        schemaVersion: HOST_NIGHT_RECIPE_SCHEMA_VERSION,
        presets: normalizedPresets,
        deletedAtById: normalizedDeletedAtById,
    };
};

export const mergeHostNightRecipeSyncStates = (...stateInputs) => {
    const latestPresetById = {};
    const latestDeletedAtById = {};
    stateInputs
        .map((state) => createHostNightRecipeSyncState(state || {}))
        .forEach((state) => {
            Object.values(state.presets).forEach((preset) => {
                const current = latestPresetById[preset.id];
                if (!current || Number(preset.updatedAtMs || 0) > Number(current.updatedAtMs || 0)) {
                    latestPresetById[preset.id] = preset;
                }
            });
            Object.entries(state.deletedAtById).forEach(([id, deletedAtMs]) => {
                latestDeletedAtById[id] = Math.max(
                    Number(latestDeletedAtById[id] || 0),
                    Number(deletedAtMs || 0)
                );
            });
        });
    return createHostNightRecipeSyncState({
        presets: latestPresetById,
        deletedAtById: latestDeletedAtById,
    });
};

export const serializeHostNightRecipeSyncState = (state = {}) => {
    const normalized = createHostNightRecipeSyncState(state);
    return {
        schemaVersion: HOST_NIGHT_RECIPE_SCHEMA_VERSION,
        presets: Object.values(normalized.presets),
        deletedAtById: normalized.deletedAtById,
    };
};

export const getHostNightRecipeSyncFingerprint = (state = {}) =>
    JSON.stringify(serializeHostNightRecipeSyncState(state));

export const getHostNightRecipeStorageKey = (accountUid = '') => {
    const safeUid = String(accountUid || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
    return safeUid
        ? `${HOST_NIGHT_PRESET_STORAGE_KEY}:account:${safeUid}`
        : HOST_NIGHT_PRESET_STORAGE_KEY;
};

export const isHostNightRecipeStorageScopeActive = ({
    activeAccountUid = '',
    signedInAccountUid = '',
} = {}) =>
    String(activeAccountUid || '').trim() === String(signedInAccountUid || '').trim();

export const loadHostNightRecipeSyncState = ({
    storage = globalThis?.localStorage,
    storageKey = HOST_NIGHT_PRESET_STORAGE_KEY,
} = {}) => {
    if (!storage?.getItem) return createHostNightRecipeSyncState();
    try {
        const raw = storage.getItem(storageKey);
        if (!raw) return createHostNightRecipeSyncState();
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return createHostNightRecipeSyncState({ presets: parsed });
        }
        if (parsed?.presets || parsed?.deletedAtById || parsed?.schemaVersion) {
            return createHostNightRecipeSyncState(parsed);
        }
        return createHostNightRecipeSyncState({ presets: parsed });
    } catch {
        return createHostNightRecipeSyncState();
    }
};

export const persistHostNightRecipeSyncState = ({
    state = {},
    storage = globalThis?.localStorage,
    storageKey = HOST_NIGHT_PRESET_STORAGE_KEY,
} = {}) => {
    if (!storage?.setItem) return false;
    try {
        storage.setItem(storageKey, JSON.stringify(serializeHostNightRecipeSyncState(state)));
        return true;
    } catch {
        return false;
    }
};

export const claimLegacyHostNightRecipeState = ({
    accountUid = '',
    storage = globalThis?.localStorage,
} = {}) => {
    const safeUid = String(accountUid || '').trim();
    if (!safeUid || !storage?.getItem || !storage?.setItem) {
        return createHostNightRecipeSyncState();
    }
    try {
        const migrationOwner = String(storage.getItem(HOST_NIGHT_RECIPE_MIGRATION_OWNER_KEY) || '').trim();
        if (migrationOwner && migrationOwner !== safeUid) {
            return createHostNightRecipeSyncState();
        }
        const legacyState = loadHostNightRecipeSyncState({ storage });
        if (
            !migrationOwner
            && (Object.keys(legacyState.presets).length > 0 || Object.keys(legacyState.deletedAtById).length > 0)
        ) {
            storage.setItem(HOST_NIGHT_RECIPE_MIGRATION_OWNER_KEY, safeUid);
        }
        return legacyState;
    } catch {
        return createHostNightRecipeSyncState();
    }
};

export const upsertHostNightRecipe = (state = {}, presetInput = {}) => {
    const current = createHostNightRecipeSyncState(state);
    const normalized = normalizeHostNightPresetRecord(
        presetInput,
        BUILTIN_HOST_NIGHT_PRESETS[presetInput?.basePresetId] || BUILTIN_HOST_NIGHT_PRESETS.casual
    );
    if (!normalized || normalized.isBuiltIn) return current;
    const deletedAtById = { ...current.deletedAtById };
    delete deletedAtById[normalized.id];
    return createHostNightRecipeSyncState({
        presets: {
            ...current.presets,
            [normalized.id]: normalized,
        },
        deletedAtById,
    });
};

export const deleteHostNightRecipe = (state = {}, presetId = '', deletedAtMs = Date.now()) => {
    const current = createHostNightRecipeSyncState(state);
    const safePresetId = normalizeRecipeId(presetId);
    if (!safePresetId || BUILTIN_HOST_NIGHT_PRESETS[safePresetId]) return current;
    const presets = { ...current.presets };
    delete presets[safePresetId];
    return createHostNightRecipeSyncState({
        presets,
        deletedAtById: {
            ...current.deletedAtById,
            [safePresetId]: Math.max(
                Number(current.deletedAtById[safePresetId] || 0),
                Math.max(1, Number(deletedAtMs || 0) || Date.now())
            ),
        },
    });
};
