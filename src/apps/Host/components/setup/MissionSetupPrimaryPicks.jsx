import React, { useMemo } from 'react';
import {
    buildRoomSetupRecipeCards,
    isRoomSetupRecipeSelected,
} from '../../roomSetupRecipes';

const MissionSetupPrimaryPicks = ({
    presets = [],
    recipes: recipeOverrides = null,
    selectedRecipeId = '',
    selectedArchetype = '',
    selectedFlowRule = '',
    selectedAssistLevel = '',
    selectedSpotlightMode = 'karaoke',
    selectedPerformanceMode = 'karaoke',
    onApplyRecipe = () => {},
    onSaveRecipe = () => {},
    allowSaveRecipe = true,
    selectedRecipeAdjusted = false,
    wideGrid = false,
    title = 'Room recipe',
    description = 'One compact choice sets format, pacing, and helpful defaults.',
    footerHint = 'Exact queue, scoring, and screen controls remain under Advanced.',
    recipeStorageLabel = 'this Host browser',
    recipeSyncStatus = 'browser',
}) => {
    const recipes = useMemo(
        () => (Array.isArray(recipeOverrides) && recipeOverrides.length
            ? recipeOverrides
            : buildRoomSetupRecipeCards({ presets })),
        [presets, recipeOverrides],
    );
    const savedRecipeCount = recipes.filter((recipe) => recipe.isSaved).length;
    const recipeSyncSuffix = ['loading', 'ready', 'syncing'].includes(recipeSyncStatus)
        ? ' · syncing'
        : recipeSyncStatus === 'error'
            ? ' · saved here, sync retrying'
            : '';
    const savedRecipeSummary = savedRecipeCount > 0
        ? `${savedRecipeCount} saved to ${recipeStorageLabel}${recipeSyncSuffix}`
        : `Save one setup to ${recipeStorageLabel} and reuse it next time${recipeSyncSuffix}.`;
    const selection = {
        archetype: selectedArchetype,
        flowRule: selectedFlowRule,
        assistLevel: selectedAssistLevel,
        spotlightMode: selectedSpotlightMode,
        performanceMode: selectedPerformanceMode,
    };
    const selectedRecipe = recipes.find((recipe) => (
        selectedRecipeId
            ? selectedRecipeId === recipe.id
            : isRoomSetupRecipeSelected(recipe, selection)
    )) || recipes[0];

    return (
        <section
            className="min-w-0 border-b border-cyan-100/12 pb-3"
            data-room-setup-recipes="true"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{title}</div>
                    <div className="mt-0.5 text-sm text-zinc-400">{description}</div>
                </div>
                {allowSaveRecipe ? (
                    <button
                        type="button"
                        onClick={onSaveRecipe}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-fuchsia-200/40 hover:bg-fuchsia-500/10 hover:text-fuchsia-50"
                    >
                        <i className="fa-solid fa-bookmark" />
                        Save current recipe
                    </button>
                ) : null}
            </div>

            {wideGrid ? (
                <label className="mt-3 block sm:hidden">
                    <span className="sr-only">Choose a room recipe</span>
                    <span className="flex min-h-[72px] items-center gap-3 rounded-xl bg-gradient-to-r from-cyan-500/12 to-fuchsia-500/10 p-3 ring-1 ring-cyan-200/22">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-slate-950">
                            <i className={`fa-solid ${selectedRecipe?.icon || 'fa-wand-magic-sparkles'}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <select
                                value={selectedRecipe?.id || ''}
                                onChange={(event) => {
                                    const recipe = recipes.find((item) => item.id === event.target.value);
                                    if (recipe) onApplyRecipe(recipe);
                                }}
                                className="min-h-[44px] w-full rounded-lg border border-cyan-200/20 bg-slate-950 px-3 py-2 text-sm font-black text-white outline-none focus:border-cyan-300/55"
                            >
                                {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}
                            </select>
                            <span className="mt-1 block text-xs leading-4 text-cyan-50/64">{selectedRecipe?.description}</span>
                        </span>
                    </span>
                </label>
            ) : null}

            <div className={`mt-2 max-w-full gap-2 ${wideGrid ? 'hidden sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5' : 'flex snap-x snap-mandatory overflow-x-auto pb-1.5 pr-2 [scrollbar-color:rgba(34,211,238,0.35)_transparent]'}`}>
                {recipes.map((recipe) => {
                    const selected = selectedRecipeId
                        ? selectedRecipeId === recipe.id
                        : isRoomSetupRecipeSelected(recipe, selection);
                    const adjusted = selected && selectedRecipeAdjusted;
                    const sameBase = !selected && selectedArchetype === recipe.presetId;
                    return (
                        <button
                            key={recipe.id}
                            type="button"
                            data-room-recipe-card={recipe.id}
                            aria-pressed={selected}
                            onClick={() => onApplyRecipe(recipe)}
                            className={`relative h-[116px] overflow-hidden rounded-xl border p-3 text-left transition-all ${wideGrid ? 'w-full' : 'w-[min(82vw,250px)] shrink-0 snap-start md:w-[230px]'} ${selected
                                ? 'border-cyan-300/60 bg-cyan-500/14 shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_16px_34px_rgba(0,0,0,0.22)]'
                                : 'border-white/15 bg-slate-800/55 hover:border-pink-300/36 hover:bg-slate-700/60'}`}
                        >
                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${recipe.accent}`} />
                            <div className="relative flex h-full flex-col">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="flex min-w-0 items-start gap-2">
                                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs ${selected ? 'border-cyan-200/40 bg-cyan-300 text-slate-950' : 'border-white/10 bg-white/[0.06] text-cyan-100'}`}>
                                            <i className={`fa-solid ${recipe.icon}`} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-xs font-black uppercase tracking-[0.12em] text-cyan-100/68">{recipe.eyebrow}</span>
                                            <span className="block truncate text-sm font-black text-white">{recipe.label}</span>
                                        </span>
                                    </span>
                                    <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-black uppercase tracking-[0.08em] ${adjusted
                                        ? 'border-amber-300/35 bg-amber-500/12 text-amber-50'
                                        : selected
                                            ? 'border-cyan-200/35 bg-cyan-300/14 text-cyan-50'
                                        : sameBase
                                            ? 'border-amber-300/30 bg-amber-500/10 text-amber-100'
                                            : 'border-white/10 bg-black/20 text-zinc-400'}`}>
                                        {adjusted ? 'Customized' : selected ? 'Selected' : sameBase ? 'Adjusted' : 'Choose'}
                                    </span>
                                </div>
                                <span className="mt-1.5 line-clamp-2 block text-xs leading-4 text-zinc-300">{recipe.description}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                <span>{footerHint}</span>
                {allowSaveRecipe ? <span>{savedRecipeSummary}</span> : null}
            </div>
        </section>
    );
};

export default MissionSetupPrimaryPicks;
