import React, { useMemo } from 'react';
import {
    buildRoomSetupRecipeCards,
    isRoomSetupRecipeSelected,
} from '../../roomSetupRecipes';

const MissionSetupPrimaryPicks = ({
    presets = [],
    selectedArchetype = '',
    selectedFlowRule = '',
    selectedAssistLevel = '',
    selectedSpotlightMode = 'karaoke',
    selectedPerformanceMode = 'karaoke',
    onApplyRecipe = () => {},
    onSaveRecipe = () => {},
    recipeStorageLabel = 'this Host browser',
    recipeSyncStatus = 'browser',
}) => {
    const recipes = useMemo(
        () => buildRoomSetupRecipeCards({ presets }),
        [presets],
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

    return (
        <section
            className="border-b border-cyan-100/12 pb-3"
            data-room-setup-recipes="true"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Room recipe</div>
                    <div className="mt-0.5 text-xs text-zinc-400">One compact choice sets format, pacing, and helpful defaults.</div>
                </div>
                <button
                    type="button"
                    onClick={onSaveRecipe}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 transition hover:border-fuchsia-200/40 hover:bg-fuchsia-500/10 hover:text-fuchsia-50"
                >
                    <i className="fa-solid fa-bookmark" />
                    Save current recipe
                </button>
            </div>

            <div className="mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1.5 pr-2 [scrollbar-color:rgba(34,211,238,0.35)_transparent]">
                {recipes.map((recipe) => {
                    const selected = isRoomSetupRecipeSelected(recipe, selection);
                    const sameBase = !selected && selectedArchetype === recipe.presetId;
                    return (
                        <button
                            key={recipe.id}
                            type="button"
                            data-room-recipe-card={recipe.id}
                            aria-pressed={selected}
                            onClick={() => onApplyRecipe(recipe)}
                            className={`relative h-[96px] w-[min(72vw,220px)] shrink-0 snap-start overflow-hidden rounded-xl border p-2.5 text-left transition-all md:w-[210px] ${selected
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
                                            <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-cyan-100/58">{recipe.eyebrow}</span>
                                            <span className="block truncate text-sm font-black text-white">{recipe.label}</span>
                                        </span>
                                    </span>
                                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${selected
                                        ? 'border-cyan-200/35 bg-cyan-300/14 text-cyan-50'
                                        : sameBase
                                            ? 'border-amber-300/30 bg-amber-500/10 text-amber-100'
                                            : 'border-white/10 bg-black/20 text-zinc-400'}`}>
                                        {selected ? 'Selected' : sameBase ? 'Adjusted' : 'Choose'}
                                    </span>
                                </div>
                                <span className="mt-1 line-clamp-2 block text-[10px] leading-4 text-zinc-300">{recipe.description}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500">
                <span>Exact queue, scoring, and screen controls remain under Advanced.</span>
                <span>{savedRecipeSummary}</span>
            </div>
        </section>
    );
};

export default MissionSetupPrimaryPicks;
