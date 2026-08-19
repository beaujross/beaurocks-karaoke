import React, { useEffect, useMemo, useState } from 'react';

import { CurrencyAmount, CurrencyIcon } from '../../../components/CurrencyToken';
import { getReactionCooldownMs } from '../../../lib/reactionCatalog';
import { CORE_REACTION_TYPES } from '../../../lib/reactionLoadout';

const FILTERS = Object.freeze([
    { id: 'all', label: 'All' },
    { id: 'owned', label: 'Mine' },
    { id: 'fame', label: 'Fame' },
    { id: 'premium', label: 'Premium' },
]);

const getReactionTone = (reaction = {}) => {
    if (reaction.premiumFlourish) {
        return {
            stage: 'from-violet-600/55 via-fuchsia-500/35 to-pink-500/30',
            button: 'border-fuchsia-300/55 bg-fuchsia-500/20 text-fuchsia-50',
            glow: 'shadow-[0_0_38px_rgba(217,70,239,0.38)]',
            badge: 'bg-fuchsia-300/18 text-fuchsia-50',
        };
    }
    if (reaction.rarity === 'fame') {
        return {
            stage: 'from-amber-500/45 via-orange-500/22 to-cyan-500/18',
            button: 'border-amber-300/50 bg-amber-400/16 text-amber-50',
            glow: 'shadow-[0_0_32px_rgba(251,191,36,0.26)]',
            badge: 'bg-amber-300/16 text-amber-50',
        };
    }
    return {
        stage: 'from-cyan-500/35 via-sky-500/18 to-violet-500/20',
        button: 'border-cyan-300/45 bg-cyan-400/14 text-cyan-50',
        glow: 'shadow-[0_0_28px_rgba(34,211,238,0.22)]',
        badge: 'bg-cyan-300/14 text-cyan-50',
    };
};

const getPremiumProduct = ({ reaction, reactionSkinProducts, sixthSlotProduct }) => (
    reactionSkinProducts.find((product) => product.id === reaction?.unlock?.productId)
    || (reaction?.id === 'crown' ? sixthSlotProduct : null)
);

const getReactionPreviewClass = (reaction = {}) => `reaction-library-preview-${String(reaction?.visualStyle || 'default').trim().toLowerCase().replace(/_/g, '-')}`;

const AudienceReactionCollection = ({
    open = false,
    onToggle = () => {},
    reactions = [],
    slotCount = 4,
    unlockStateByType = new Map(),
    reactionLoadout = [],
    reactionSkinProducts = [],
    sixthSlotProduct = null,
    reactionTapCooldownMs = 0,
    bonusReactionCapacity = 0,
    pointsBalance = 0,
    beauBucksBalance = 0,
    beauBucksReady = false,
    onEquip = () => {},
    onPurchasePremium = () => {},
    premiumUnlockPendingId = '',
    onCreateAccount = () => {},
}) => {
    const firstFeaturedId = reactions.find((reaction) => reaction.premiumFlourish)?.id || reactions[0]?.id || '';
    const [filter, setFilter] = useState('all');
    const [selectedReactionId, setSelectedReactionId] = useState(firstFeaturedId);
    const [selectedBonusSlotIndex, setSelectedBonusSlotIndex] = useState(0);
    useEffect(() => {
        setSelectedBonusSlotIndex((current) => Math.max(0, Math.min(Math.max(0, bonusReactionCapacity - 1), current)));
    }, [bonusReactionCapacity]);
    const visibleReactions = useMemo(() => reactions.filter((reaction) => {
        const unlockState = unlockStateByType.get(reaction.id) || { unlocked: false };
        if (filter === 'owned') return unlockState.unlocked;
        if (filter === 'premium') return reaction.premiumFlourish || reaction.rarity === 'premium';
        if (filter === 'fame') return reaction.rarity === 'fame';
        return true;
    }), [filter, reactions, unlockStateByType]);
    const selectedReaction = reactions.find((reaction) => reaction.id === selectedReactionId)
        || visibleReactions[0]
        || reactions[0]
        || null;
    const selectedUnlockState = selectedReaction
        ? (unlockStateByType.get(selectedReaction.id) || { unlocked: false, label: 'Unavailable' })
        : { unlocked: false, label: 'Unavailable' };
    const selectedCooldownMs = selectedReaction ? getReactionCooldownMs(selectedReaction.id, reactionTapCooldownMs) : 0;
    const selectedCooldownSeconds = (selectedCooldownMs / 1000).toFixed(selectedCooldownMs % 1000 ? 1 : 0);
    const selectedTone = getReactionTone(selectedReaction || {});
    const selectedPremiumProduct = selectedReaction
        ? getPremiumProduct({ reaction: selectedReaction, reactionSkinProducts, sixthSlotProduct })
        : null;

    const renderAction = (reaction, unlockState, { prominent = false } = {}) => {
        const unlocked = unlockState.unlocked;
        const isCore = CORE_REACTION_TYPES.includes(reaction.id);
        const equipped = reactionLoadout.includes(reaction.id);
        const equippedSlotIndex = reactionLoadout.indexOf(reaction.id);
        const targetSlotNumber = CORE_REACTION_TYPES.length + selectedBonusSlotIndex + 1;
        const targetReactionType = reactionLoadout[CORE_REACTION_TYPES.length + selectedBonusSlotIndex] || '';
        const premiumProduct = getPremiumProduct({ reaction, reactionSkinProducts, sixthSlotProduct });
        const baseClass = prominent
            ? 'min-h-[48px] rounded-xl px-4 text-sm'
            : 'min-h-[40px] rounded-xl px-3 text-xs';
        if (isCore) {
            return <div className={`${baseClass} flex items-center justify-center bg-cyan-400/10 font-black uppercase tracking-[0.12em] text-cyan-100`}>Fixed voting slot</div>;
        }
        if (unlocked) {
            return (
                <button
                    type="button"
                    onClick={() => onEquip(reaction.id, selectedBonusSlotIndex)}
                    disabled={bonusReactionCapacity <= 0 || equippedSlotIndex === CORE_REACTION_TYPES.length + selectedBonusSlotIndex}
                    className={`${baseClass} w-full bg-white/10 font-black text-white disabled:text-emerald-200 disabled:opacity-75`}
                >
                    {bonusReactionCapacity <= 0
                        ? 'Unlock a voting slot to equip'
                        : equippedSlotIndex === CORE_REACTION_TYPES.length + selectedBonusSlotIndex
                            ? `Equipped in slot ${targetSlotNumber}`
                            : equipped
                                ? `Move to slot ${targetSlotNumber}`
                                : targetReactionType
                                    ? `Replace slot ${targetSlotNumber}`
                                    : `Equip to slot ${targetSlotNumber}`}
                </button>
            );
        }
        if (reaction.unlock?.type === 'entitlement' && premiumProduct) {
            return (
                <button
                    type="button"
                    onClick={() => onPurchasePremium(premiumProduct.id)}
                    disabled={premiumUnlockPendingId === premiumProduct.id}
                    className={`${baseClass} flex w-full items-center justify-center gap-2 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 font-black text-slate-950 disabled:opacity-50`}
                >
                    <span>{premiumUnlockPendingId === premiumProduct.id ? 'Unlocking...' : 'Unlock forever'}</span>
                    <CurrencyAmount currency="beaubucks" amount={premiumProduct.cost} size="xs" />
                </button>
            );
        }
        if (reaction.unlock?.type === 'account') {
            return <button type="button" onClick={onCreateAccount} className={`${baseClass} w-full bg-cyan-300 font-black text-slate-950`}>Create account to unlock</button>;
        }
        return (
            <div className={`${baseClass} flex items-center justify-center gap-2 bg-amber-300/10 font-black uppercase tracking-[0.1em] text-amber-100`}>
                {reaction.unlock?.type === 'fame' ? <CurrencyIcon currency="fame" size="xs" /> : null}
                {unlockState.label}
            </div>
        );
    };

    return (
        <section className="overflow-hidden rounded-[1.5rem] border border-violet-300/24 bg-[linear-gradient(145deg,rgba(91,33,182,0.16),rgba(12,18,32,0.98))]" data-feature-id="audience-reaction-collection">
            <button
                type="button"
                data-feature-id="reaction-emoji-library-toggle"
                onClick={onToggle}
                className="flex min-h-[76px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={open}
            >
                <span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/70">Reaction Bank</span>
                    <span className="mt-1 block text-lg font-black text-white">Voting Reaction Library</span>
                    <span className="mt-1 block text-xs text-zinc-400">These are buttons you tap during performances—not your profile avatar.</span>
                </span>
                <span className="flex items-center gap-2">
                    <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-black text-zinc-300">{slotCount}/6 slots</span>
                    <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-zinc-400`} aria-hidden="true"></i>
                </span>
            </button>
            {open && selectedReaction ? (
                <div className="border-t border-white/10 p-3">
                    <section className="mb-3 grid grid-cols-2 gap-2" data-feature-id="reaction-library-wallet-context">
                        <div className="rounded-2xl border border-cyan-300/22 bg-cyan-500/[0.09] px-3 py-2.5">
                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100/65">Your Points</div>
                            <CurrencyAmount currency="points" amount={pointsBalance} size="xs" className="mt-1 text-base" />
                        </div>
                        <div className="rounded-2xl border border-fuchsia-300/22 bg-fuchsia-500/[0.09] px-3 py-2.5">
                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-fuchsia-100/65">Your BeauBucks</div>
                            {beauBucksReady
                                ? <CurrencyAmount currency="beaubucks" amount={beauBucksBalance} size="xs" className="mt-1 text-base" />
                                : <div className="mt-1 text-xs font-black text-fuchsia-100">Account wallet</div>}
                        </div>
                    </section>
                    <section className="mb-3 rounded-2xl border border-cyan-300/18 bg-cyan-500/7 p-3" data-feature-id="reaction-loadout-slot-picker">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Choose the voting slot to change</div>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                            {CORE_REACTION_TYPES.map((reactionType, index) => {
                                const reaction = reactions.find((entry) => entry.id === reactionType);
                                return <div key={reactionType} className="rounded-xl border border-white/8 bg-black/25 px-2 py-2 text-center opacity-65"><div className="text-2xl">{reaction?.emoji}</div><div className="mt-1 text-[9px] font-black uppercase text-zinc-400">Slot {index + 1} fixed</div></div>;
                            })}
                        </div>
                        {bonusReactionCapacity > 0 ? (
                            <div className={`mt-2 grid gap-2 ${bonusReactionCapacity > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {Array.from({ length: bonusReactionCapacity }).map((_, index) => {
                                    const slotNumber = CORE_REACTION_TYPES.length + index + 1;
                                    const reactionType = reactionLoadout[CORE_REACTION_TYPES.length + index] || '';
                                    const reaction = reactions.find((entry) => entry.id === reactionType);
                                    const selected = index === selectedBonusSlotIndex;
                                    return (
                                        <button key={`reaction-loadout-slot-${slotNumber}`} type="button" onClick={() => setSelectedBonusSlotIndex(index)} className={`min-h-[58px] rounded-xl border px-3 text-left ${selected ? 'border-violet-300/55 bg-violet-500/20 text-white' : 'border-white/10 bg-black/25 text-zinc-300'}`} aria-pressed={selected}>
                                            <span className="flex items-center gap-2"><span className="text-2xl">{reaction?.emoji || '+'}</span><span><span className="block text-xs font-black">Slot {slotNumber}</span><span className="block text-[10px] text-zinc-400">{reaction?.label || 'Empty'} · tap to replace</span></span></span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : <div className="mt-2 rounded-xl border border-dashed border-white/12 px-3 py-2 text-xs text-zinc-400">Unlock slot 5 to add a swappable voting reaction.</div>}
                    </section>
                    <section
                        className={`relative overflow-hidden rounded-[1.35rem] border border-white/14 bg-gradient-to-br ${selectedTone.stage} p-4 ${selectedTone.glow}`}
                        data-feature-id="reaction-merch-preview"
                    >
                        <div className="absolute -right-8 -top-10 text-[8rem] opacity-[0.08]" aria-hidden="true">{selectedReaction.emoji}</div>
                        <div className="relative">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/65">Audience preview</div>
                                    <div className="mt-1 text-2xl font-black text-white">{selectedReaction.label}</div>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${selectedTone.badge}`}>{selectedReaction.rarity}</span>
                            </div>
                            <div className="mt-4 grid grid-cols-[0.9fr_1.1fr] gap-3">
                                <div className="rounded-2xl border border-white/12 bg-black/28 p-3">
                                    <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/55">Your button</div>
                                    <div className={`mt-2 flex min-h-[88px] flex-col items-center justify-center rounded-2xl border-2 ${selectedTone.button}`}>
                                        <span className="text-5xl leading-none">{selectedReaction.emoji}</span>
                                        <span className="mt-2 text-xs font-black uppercase tracking-[0.14em]">{selectedReaction.label}</span>
                                    </div>
                                </div>
                                <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-black/35 p-3">
                                    <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/55">On-screen flourish</div>
                                    <div className="mt-2 flex min-h-[88px] items-center justify-center">
                                        <span className={`text-7xl leading-none ${getReactionPreviewClass(selectedReaction)}`}>{selectedReaction.emoji}</span>
                                        {selectedReaction.premiumFlourish ? (
                                            <>
                                                <span className="absolute left-4 top-1/2 text-lg opacity-70 animate-pulse">✦</span>
                                                <span className="absolute right-5 top-10 text-2xl opacity-80 animate-pulse">✦</span>
                                                <span className="absolute bottom-4 right-10 text-sm opacity-60 animate-pulse">✦</span>
                                            </>
                                        ) : null}
                                    </div>
                                    <div className="text-center text-[11px] font-bold text-white/75">{selectedReaction.abilityLabel}{selectedReaction.impactMode === 'visual_only' ? ' · TV flourish' : ''}</div>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-black/25 px-3 py-2">
                                    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-100/60">Tap value</div>
                                    <div className="mt-1 flex items-center gap-1 text-sm font-black text-cyan-50"><CurrencyAmount currency="points" amount={selectedReaction.pointCost} size="xs" /> <span>→ +{selectedReaction.scoreValue} score</span></div>
                                </div>
                                <div className="rounded-xl bg-black/25 px-3 py-2">
                                    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/55">Recharge</div>
                                    <div className="mt-1 text-sm font-black text-white">{selectedCooldownSeconds} seconds</div>
                                </div>
                            </div>
                            {selectedPremiumProduct && !selectedUnlockState.unlocked ? (
                                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/12 px-3 py-2.5" data-feature-id="reaction-selected-purchase-price">
                                    <span><span className="block text-[9px] font-black uppercase tracking-[0.14em] text-fuchsia-100/65">Permanent cosmetic</span><span className="block text-xs font-black text-white">Unlock once · keep across rooms</span></span>
                                    <CurrencyAmount currency="beaubucks" amount={selectedPremiumProduct.cost} size="sm" />
                                </div>
                            ) : null}
                            <div className="mt-3">{renderAction(selectedReaction, selectedUnlockState, { prominent: true })}</div>
                        </div>
                    </section>

                    <style>{`
                        @keyframes reaction-preview-applause { 0%{opacity:0;transform:translateY(24px) scale(.55) rotate(-12deg)} 45%{opacity:1;transform:translateY(-7px) scale(1.18) rotate(10deg)} 100%{transform:translateY(0) scale(1) rotate(0)} }
                        @keyframes reaction-preview-heart { 0%{opacity:0;transform:translateY(24px) scale(.35)} 55%{opacity:1;transform:translateY(-9px) scale(1.22)} 100%{transform:translateY(0) scale(1)} }
                        @keyframes reaction-preview-ember { 0%{opacity:0;transform:translateY(30px) scale(.5)} 50%{opacity:1;transform:translateY(-12px) scale(1.15) rotate(5deg)} 100%{transform:translateY(0) scale(1)} }
                        @keyframes reaction-preview-cheers { 0%{opacity:0;transform:translateX(-28px) rotate(-18deg)} 55%{opacity:1;transform:translateX(7px) rotate(12deg)} 100%{transform:translateX(0) rotate(0)} }
                        @keyframes reaction-preview-launch { 0%{opacity:0;transform:translate(-24px,34px) scale(.45) rotate(-18deg)} 60%{opacity:1;transform:translate(8px,-12px) scale(1.12) rotate(8deg)} 100%{transform:none} }
                        @keyframes reaction-preview-starburst { 0%{opacity:0;transform:scale(.2) rotate(-70deg)} 58%{opacity:1;transform:scale(1.3) rotate(16deg)} 100%{transform:scale(1) rotate(0)} }
                        @keyframes reaction-preview-prism { 0%{opacity:0;transform:perspective(200px) rotateY(90deg) scale(.5)} 60%{opacity:1;transform:perspective(200px) rotateY(-18deg) scale(1.14)} 100%{transform:rotateY(0) scale(1)} }
                        @keyframes reaction-preview-meteor { 0%{opacity:0;transform:translate(34px,-34px) scale(.35) rotate(30deg)} 65%{opacity:1;transform:translate(-8px,8px) scale(1.18) rotate(-8deg)} 100%{transform:none} }
                        @keyframes reaction-preview-blossom { 0%{opacity:0;transform:translateY(-24px) rotate(-25deg) scale(.45)} 55%{opacity:1;transform:translateY(8px) rotate(14deg) scale(1.15)} 100%{transform:none} }
                        @keyframes reaction-preview-galaxy { 0%{opacity:0;transform:scale(.3) rotate(-140deg)} 65%{opacity:1;transform:scale(1.2) rotate(24deg)} 100%{transform:scale(1) rotate(0)} }
                        @keyframes reaction-preview-royal { 0%{opacity:0;transform:translateY(28px) scale(.55)} 55%{opacity:1;transform:translateY(-8px) scale(1.2)} 100%{transform:none} }
                        @keyframes reaction-preview-tomato-splat { 0%{opacity:0;transform:scale(2.2) rotate(-30deg)} 48%{opacity:1;transform:scale(.82) rotate(10deg)} 72%{transform:scale(1.15)} 100%{transform:scale(1)} }
                        @keyframes reaction-preview-neon-bolt { 0%,25%{opacity:0;transform:translateY(-30px) skewX(-16deg)} 34%{opacity:1;transform:translateY(8px) skewX(8deg) scale(1.25)} 100%{transform:none} }
                        @keyframes reaction-preview-confetti { 0%{opacity:0;transform:translateY(-30px) rotate(-50deg) scale(.45)} 65%{opacity:1;transform:translateY(10px) rotate(20deg) scale(1.2)} 100%{transform:none} }
                        @keyframes reaction-preview-mic-drop { 0%{opacity:0;transform:translateY(-34px) rotate(-55deg)} 58%{opacity:1;transform:translateY(8px) rotate(16deg) scale(1.18)} 100%{transform:none} }
                        @keyframes reaction-preview-ufo-beam { 0%{opacity:0;transform:translateX(-38px) rotate(-12deg) scale(.5)} 55%{opacity:1;transform:translateX(8px) rotate(6deg) scale(1.2)} 100%{transform:none} }
                        @keyframes reaction-preview-dragon-breath { 0%{opacity:0;transform:translateX(38px) scale(.45) rotate(22deg)} 58%{opacity:1;transform:translateX(-8px) scale(1.22) rotate(-8deg)} 100%{transform:none} }
                        [class*="reaction-library-preview-"] { animation-duration: .9s; animation-timing-function: cubic-bezier(.22,.61,.36,1); animation-fill-mode: both; animation-iteration-count: infinite; animation-direction: alternate; }
                        .reaction-library-preview-applause{animation-name:reaction-preview-applause}.reaction-library-preview-heart{animation-name:reaction-preview-heart}.reaction-library-preview-ember{animation-name:reaction-preview-ember}.reaction-library-preview-cheers{animation-name:reaction-preview-cheers}.reaction-library-preview-launch{animation-name:reaction-preview-launch}.reaction-library-preview-starburst{animation-name:reaction-preview-starburst}.reaction-library-preview-prism{animation-name:reaction-preview-prism}.reaction-library-preview-meteor{animation-name:reaction-preview-meteor}.reaction-library-preview-blossom{animation-name:reaction-preview-blossom}.reaction-library-preview-galaxy{animation-name:reaction-preview-galaxy}.reaction-library-preview-royal{animation-name:reaction-preview-royal}.reaction-library-preview-tomato-splat{animation-name:reaction-preview-tomato-splat}.reaction-library-preview-neon-bolt{animation-name:reaction-preview-neon-bolt}.reaction-library-preview-confetti{animation-name:reaction-preview-confetti}.reaction-library-preview-mic-drop{animation-name:reaction-preview-mic-drop}.reaction-library-preview-ufo-beam{animation-name:reaction-preview-ufo-beam}.reaction-library-preview-dragon-breath{animation-name:reaction-preview-dragon-breath}
                        @media (prefers-reduced-motion: reduce) { [class*="reaction-library-preview-"] { animation: none !important; } }
                    `}</style>

                    <div className="mt-3 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/24 p-1" role="tablist" aria-label="Reaction filters" data-feature-id="reaction-bank-filters">
                        {FILTERS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={filter === item.id}
                                onClick={() => setFilter(item.id)}
                                className={`min-h-[38px] min-w-[68px] flex-1 rounded-xl px-3 text-[10px] font-black uppercase tracking-[0.12em] ${filter === item.id ? 'bg-white/14 text-white' : 'text-zinc-400'}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                        {visibleReactions.map((reaction) => {
                            const unlockState = unlockStateByType.get(reaction.id) || { unlocked: false, label: 'Unavailable' };
                            const premiumProduct = getPremiumProduct({ reaction, reactionSkinProducts, sixthSlotProduct });
                            const tone = getReactionTone(reaction);
                            const cooldownMs = getReactionCooldownMs(reaction.id, reactionTapCooldownMs);
                            const cooldownSeconds = (cooldownMs / 1000).toFixed(cooldownMs % 1000 ? 1 : 0);
                            const selected = reaction.id === selectedReaction.id;
                            return (
                                <article key={reaction.id} className={`rounded-2xl border p-3 transition ${selected ? `border-white/40 bg-white/10 ${tone.glow}` : reaction.premiumFlourish ? 'border-fuchsia-300/24 bg-fuchsia-500/8' : 'border-white/10 bg-black/22'}`} data-feature-id={`reaction-product-${reaction.id}`}>
                                    <button type="button" onClick={() => setSelectedReactionId(reaction.id)} className="w-full text-left" aria-label={`Preview ${reaction.label}`}>
                                        <div className="flex items-start gap-3">
                                            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border text-4xl ${tone.button}`}>{reaction.emoji}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-start justify-between gap-2">
                                                    <span className="text-sm font-black text-white">{reaction.label}</span>
                                                    <span className="flex shrink-0 flex-col items-end gap-1">
                                                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] ${tone.badge}`}>{reaction.rarity}</span>
                                                        {!unlockState.unlocked && premiumProduct ? (
                                                            <span className="rounded-full border border-fuchsia-200/45 bg-fuchsia-400/18 px-2 py-0.5 shadow-[0_0_16px_rgba(217,70,239,0.24)]" data-reaction-product-price={premiumProduct.cost}>
                                                                <CurrencyAmount currency="beaubucks" amount={premiumProduct.cost} size="xs" className="text-[10px]" />
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </span>
                                                <span className="mt-1 block text-[11px] leading-4 text-zinc-400">{reaction.abilityLabel}{reaction.impactMode === 'visual_only' ? ' · TV flourish' : ''}</span>
                                            </span>
                                        </div>
                                        <span className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-black">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-300/12 px-2 py-1 text-cyan-50"><CurrencyAmount currency="points" amount={reaction.pointCost} size="xs" /> → +{reaction.scoreValue}</span>
                                            <span className="rounded-full bg-white/8 px-2 py-1 text-zinc-300"><i className="fa-solid fa-rotate mr-1" aria-hidden="true"></i>{cooldownSeconds}s</span>
                                            <span className={`rounded-full px-2 py-1 ${unlockState.unlocked ? 'bg-emerald-300/12 text-emerald-100' : 'bg-white/8 text-zinc-400'}`}>{unlockState.unlocked ? 'Owned' : unlockState.label}</span>
                                        </span>
                                    </button>
                                    <div className="mt-2">{renderAction(reaction, unlockState)}</div>
                                </article>
                            );
                        })}
                    </div>
                    <p className="mt-3 text-[11px] leading-4 text-zinc-500">Premium reactions add collectible entrances and screen flourishes—not a better Point-to-score exchange rate. Fame reactions unlock through play.</p>
                </div>
            ) : null}
        </section>
    );
};

export default AudienceReactionCollection;
