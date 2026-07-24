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
    onApplyRecipe = () => {},
    onSaveRecipe = () => {},
}) => {
    const recipes = useMemo(
        () => buildRoomSetupRecipeCards({ presets }),
        [presets],
    );
    const savedRecipeCount = recipes.filter((recipe) => recipe.isSaved).length;
    const selection = {
        archetype: selectedArchetype,
        flowRule: selectedFlowRule,
        assistLevel: selectedAssistLevel,
        spotlightMode: selectedSpotlightMode,
    };

    return (
        <section
            className="rounded-2xl border border-cyan-300/25 bg-zinc-950/80 p-3 md:p-4"
            data-room-setup-recipes="true"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Night recipes</div>
                    <div className="mt-1 text-xl font-black text-white">Pick the night you want</div>
                    <div className="mt-1 text-sm text-zinc-400">Each card sets the queue, host help, scoring, media, and between-song plan together.</div>
                </div>
                <button
                    type="button"
                    onClick={onSaveRecipe}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-black text-fuchsia-50 transition hover:border-fuchsia-200/50 hover:bg-fuchsia-500/16"
                >
                    <i className="fa-solid fa-bookmark" />
                    Save current recipe
                </button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
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
                            className={`relative overflow-hidden rounded-2xl border p-3 text-left transition-all ${selected
                                ? 'border-cyan-300/60 bg-cyan-500/14 shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_16px_34px_rgba(0,0,0,0.22)]'
                                : 'border-white/10 bg-black/24 hover:border-cyan-300/28 hover:bg-white/[0.045]'}`}
                        >
                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${recipe.accent}`} />
                            <div className="relative">
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
                                <span className="mt-2 block text-xs leading-5 text-zinc-300">{recipe.description}</span>
                                <span className="mt-3 grid grid-cols-2 gap-1.5">
                                    {recipe.facts.map((fact) => (
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
                <span>Fine-tune any recipe in Advanced. Your changes stay visible as an adjusted recipe.</span>
                <span>{savedRecipeCount > 0 ? `${savedRecipeCount} saved recipe${savedRecipeCount === 1 ? '' : 's'}` : 'Save one setup on this Host browser and reuse it next time.'}</span>
            </div>
        </section>
    );
};

export default MissionSetupPrimaryPicks;
