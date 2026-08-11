import React, { useMemo } from 'react';
import ContentSourceBadge from '../../../../components/ContentSourceBadge';
import {
    buildRoomSetupRecipePreflight,
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
    sourceContext = {},
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
            className="overflow-hidden rounded-[24px] border border-cyan-200/35 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_40%),linear-gradient(145deg,rgba(25,48,73,0.97),rgba(55,30,64,0.95))] p-3 shadow-[0_22px_70px_rgba(8,15,34,0.3),inset_0_1px_0_rgba(207,250,254,0.08)] md:p-4"
            data-room-setup-recipes="true"
        >
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">1 · Pick a vibe</div>
                    <div className="mt-1 text-xl font-black text-white">Start with what sounds fun.</div>
                    <div className="mt-1 text-sm text-zinc-400">One choice sets the night. You can fine-tune it later.</div>
                </div>
                <button
                    type="button"
                    onClick={onSaveRecipe}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-fuchsia-200/40 hover:bg-fuchsia-500/10 hover:text-fuchsia-50"
                >
                    <i className="fa-solid fa-bookmark" />
                    Save current recipe
                </button>
            </div>

            <div className="mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 pr-2 [scrollbar-color:rgba(34,211,238,0.35)_transparent]">
                {recipes.map((recipe) => {
                    const selected = isRoomSetupRecipeSelected(recipe, selection);
                    const sameBase = !selected && selectedArchetype === recipe.presetId;
                    const preflight = selected ? buildRoomSetupRecipePreflight(recipe, sourceContext) : null;
                    return (
                        <button
                            key={recipe.id}
                            type="button"
                            data-room-recipe-card={recipe.id}
                            aria-pressed={selected}
                            onClick={() => onApplyRecipe(recipe)}
                            className={`relative h-[264px] w-[min(78vw,256px)] shrink-0 snap-start overflow-hidden rounded-2xl border p-3 text-left transition-all md:w-[248px] ${selected
                                ? 'border-cyan-300/60 bg-cyan-500/14 shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_16px_34px_rgba(0,0,0,0.22)]'
                                : 'border-white/15 bg-slate-800/55 hover:border-pink-300/36 hover:bg-slate-700/60'}`}
                        >
                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${recipe.accent}`} />
                            <div className="relative flex h-full flex-col">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex min-w-0 items-start gap-3">
                                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${selected ? 'border-cyan-200/40 bg-cyan-300 text-slate-950' : 'border-white/10 bg-white/[0.06] text-cyan-100'}`}>
                                            <i className={`fa-solid ${recipe.icon}`} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/58">{recipe.eyebrow}</span>
                                            <span className="mt-0.5 block text-base font-black text-white">{recipe.label}</span>
                                        </span>
                                    </span>
                                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${selected
                                        ? 'border-cyan-200/35 bg-cyan-300/14 text-cyan-50'
                                        : sameBase
                                            ? 'border-amber-300/30 bg-amber-500/10 text-amber-100'
                                            : 'border-white/10 bg-black/20 text-zinc-400'}`}>
                                        {selected ? 'Selected' : sameBase ? 'Adjusted' : 'Choose'}
                                    </span>
                                </div>
                                <span className="mt-2 line-clamp-2 block text-xs leading-5 text-zinc-300">{recipe.description}</span>
                                <span className={`mt-3 flex min-h-[58px] items-start gap-2 rounded-xl border px-2.5 py-2 ${preflight?.status === 'ready'
                                        ? 'border-emerald-300/25 bg-emerald-500/8'
                                        : preflight?.status === 'review'
                                            ? 'border-amber-300/25 bg-amber-500/8'
                                            : selected
                                                ? 'border-fuchsia-300/25 bg-fuchsia-500/8'
                                                : 'border-white/8 bg-black/12'}`}>
                                        {preflight?.provider ? (
                                            <ContentSourceBadge source={preflight.provider} compact />
                                        ) : selected ? (
                                            <i className="fa-solid fa-link mt-1 text-[10px] text-fuchsia-200" />
                                        ) : (
                                            <i className="fa-solid fa-hand-pointer mt-1 text-[10px] text-cyan-100/35" />
                                        )}
                                        <span className="min-w-0">
                                            <span className="block text-[10px] font-black text-white">{preflight?.title || 'Preview this plan'}</span>
                                            <span className="mt-0.5 line-clamp-2 block text-[10px] leading-4 text-zinc-400">{preflight?.detail || 'Tap once to see how this recipe fits your connected media.'}</span>
                                        </span>
                                </span>
                                <span className="mt-auto grid grid-cols-2 gap-1.5 pt-3">
                                    {recipe.facts
                                        .filter((fact) => ['Format', 'Between songs'].includes(fact.label))
                                        .map((fact) => (
                                        <span key={fact.label} className="rounded-lg border border-white/8 bg-black/20 px-2 py-1.5">
                                            <span className="block text-[8px] font-black uppercase tracking-[0.14em] text-zinc-500">{fact.label}</span>
                                            <span className="mt-0.5 block truncate text-[11px] font-semibold text-zinc-100">{fact.value}</span>
                                        </span>
                                    ))}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3 text-xs text-zinc-500">
                <span>Want exact control? Fine-tune queue, scoring, screens, and guardrails below.</span>
                <span>{savedRecipeSummary}</span>
            </div>
        </section>
    );
};

export default MissionSetupPrimaryPicks;
