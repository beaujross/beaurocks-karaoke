import { CurrencyAmount, CurrencyIcon } from '../../../components/CurrencyToken';
import { getReactionCooldownMs } from '../../../lib/reactionCatalog';
import { CORE_REACTION_TYPES } from '../../../lib/reactionLoadout';

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
    onEquip = () => {},
    onPurchasePremium = () => {},
    premiumUnlockPendingId = '',
    onCreateAccount = () => {},
}) => (
    <section className="overflow-hidden rounded-[1.25rem] border border-violet-300/18 bg-[linear-gradient(145deg,rgba(91,33,182,0.12),rgba(12,18,32,0.96))]" data-feature-id="audience-reaction-collection">
        <button
            type="button"
            data-feature-id="reaction-emoji-library-toggle"
            onClick={onToggle}
            className="flex min-h-[72px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={open}
        >
            <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/70">Reaction collection</span>
                <span className="mt-1 block text-base font-black text-white">Compare power. Pick your show.</span>
                <span className="mt-1 block text-xs text-zinc-400">1 Point spent = +1 performance point</span>
            </span>
            <span className="flex items-center gap-2">
                <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-black text-zinc-300">{slotCount}/6 slots</span>
                <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-zinc-400`} aria-hidden="true"></i>
            </span>
        </button>
        {open ? (
            <div className="border-t border-white/10 p-3">
                <div className="grid grid-cols-2 gap-2">
                    {reactions.map((reaction) => {
                        const unlockState = unlockStateByType.get(reaction.id) || { unlocked: false, label: 'Unavailable' };
                        const unlocked = unlockState.unlocked;
                        const isCore = CORE_REACTION_TYPES.includes(reaction.id);
                        const equipped = reactionLoadout.includes(reaction.id);
                        const premiumProduct = reactionSkinProducts.find((product) => product.id === reaction.unlock?.productId)
                            || (reaction.id === 'crown' ? sixthSlotProduct : null);
                        const cooldownMs = getReactionCooldownMs(reaction.id, reactionTapCooldownMs);
                        const cooldownSeconds = (cooldownMs / 1000).toFixed(cooldownMs % 1000 ? 1 : 0);
                        return (
                            <article key={reaction.id} className={`rounded-2xl border p-3 ${reaction.premiumFlourish ? 'border-fuchsia-300/28 bg-fuchsia-500/10' : unlocked ? 'border-white/12 bg-black/24' : 'border-white/8 bg-black/18 opacity-75'}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-4xl">{reaction.emoji}</span>
                                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${reaction.premiumFlourish ? 'bg-fuchsia-400/18 text-fuchsia-100' : reaction.rarity === 'fame' ? 'bg-amber-300/14 text-amber-100' : 'bg-white/8 text-zinc-300'}`}>{reaction.rarity}</span>
                                </div>
                                <div className="mt-2 text-sm font-black text-white">{reaction.label}</div>
                                <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-black">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-300/12 px-2 py-1 text-cyan-50"><CurrencyAmount currency="points" amount={reaction.pointCost} size="xs" /> → +{reaction.scoreValue}</span>
                                    <span className="rounded-full bg-white/8 px-2 py-1 text-zinc-300">{cooldownSeconds}s</span>
                                </div>
                                <div className="mt-2 min-h-[2rem] text-[11px] leading-4 text-zinc-400">{reaction.abilityLabel}{reaction.impactMode === 'visual_only' ? ' · TV only' : ''}</div>
                                {isCore ? (
                                    <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-cyan-200">Core slot</div>
                                ) : unlocked ? (
                                    <button type="button" onClick={() => onEquip(reaction.id)} disabled={equipped || bonusReactionCapacity <= 0} className="mt-2 min-h-[38px] w-full rounded-xl bg-white/10 px-2 text-xs font-black text-white disabled:text-emerald-200 disabled:opacity-75">{equipped ? 'Equipped' : 'Equip'}</button>
                                ) : reaction.unlock?.type === 'entitlement' && premiumProduct ? (
                                    <button type="button" onClick={() => onPurchasePremium(premiumProduct.id)} disabled={premiumUnlockPendingId === premiumProduct.id} className="mt-2 flex min-h-[38px] w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-400/18 px-2 text-xs font-black text-fuchsia-50 disabled:opacity-50"><span>Unlock</span><CurrencyAmount currency="beaubucks" amount={premiumProduct.cost} size="xs" /></button>
                                ) : reaction.unlock?.type === 'account' ? (
                                    <button type="button" onClick={onCreateAccount} className="mt-2 min-h-[38px] w-full rounded-xl bg-cyan-400/14 px-2 text-xs font-black text-cyan-50">Create account</button>
                                ) : (
                                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-100">{reaction.unlock?.type === 'fame' ? <CurrencyIcon currency="fame" size="xs" /> : null}{unlockState.label}</div>
                                )}
                            </article>
                        );
                    })}
                </div>
                <p className="mt-3 text-[11px] leading-4 text-zinc-500">Premium reactions add rare entrances and TV flourishes—not a better score exchange rate. Fame reactions unlock through play on your BeauRocks account.</p>
            </div>
        ) : null}
    </section>
);

export default AudienceReactionCollection;
