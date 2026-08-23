import { CurrencyAmount } from '../../../components/CurrencyToken';
import { REACTION_COSTS } from '../../../lib/reactionConstants';
import { getReactionDefinition } from '../../../lib/reactionCatalog';
import { CORE_REACTION_TYPES } from '../../../lib/reactionLoadout';

const BONUS_REACTION_ACCENTS = Object.freeze({
    rocket: 'border-pink-400/80 text-pink-200 bg-pink-500/10 shadow-[0_0_24px_rgba(236,72,153,0.45)]',
    diamond: 'border-cyan-300/80 text-cyan-200 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.45)]',
    money: 'border-rose-300/80 text-rose-100 bg-rose-500/10 shadow-[0_0_26px_rgba(251,113,133,0.45)]',
    crown: 'border-[#00C4D9]/60 text-cyan-100 bg-[#00C4D9]/10 shadow-[0_0_26px_rgba(0,196,217,0.4)]',
});

const AudienceReactionSlotGrid = ({
    bonusReactionTypes = [],
    bonusReactionCapacity = 0,
    reactionSlotCount = 4,
    fifthReactionSlotPointsCost = 0,
    fifthReactionSlotPurchasesEnabled = false,
    sixthReactionSlotProduct = null,
    isReactionCoolingDown = () => false,
    renderReactionCooldownFill = () => null,
    getReactionOptionIconClass = () => '',
    getEmojiChar = () => '',
    reactionCostLabel = () => '',
    onReact = () => {},
    onBrowseLibrary = () => {},
    onUnlockFifth = () => {},
    onUnlockSixth = () => {},
}) => (
    <>
        <div className="grid grid-cols-2 gap-4" data-feature-id="audience-reaction-slot-grid">
            {bonusReactionTypes.map((reactionType) => {
                const accent = BONUS_REACTION_ACCENTS[reactionType] || 'border-violet-300/70 text-violet-100 bg-violet-500/10';
                const cost = REACTION_COSTS[reactionType];
                return (
                    <button key={reactionType} disabled={isReactionCoolingDown(reactionType)} onClick={() => onReact(reactionType, cost)} className={`relative min-h-[148px] overflow-hidden p-3 rounded-2xl flex flex-col items-center justify-center border transition-all bg-gradient-to-b from-white/5 via-black/40 to-black/70 ${accent} ${isReactionCoolingDown(reactionType) ? 'cursor-not-allowed opacity-75' : 'active:scale-95'}`}>
                        {renderReactionCooldownFill(reactionType, 'bg-cyan-300/18', 'border-white/15 bg-black/55 text-cyan-50')}
                        <span className={`${getReactionOptionIconClass(reactionType)} mb-2`}>{getEmojiChar(reactionType)}</span>
                        <span className="font-bold text-base uppercase">{getReactionDefinition(reactionType)?.label || reactionType}</span>
                        <div className={`mt-1 px-2 py-0.5 rounded-full text-[12px] font-bold ${accent} border-none`}>{reactionCostLabel(cost)}</div>
                    </button>
                );
            })}
            {Array.from({ length: Math.max(0, bonusReactionCapacity - bonusReactionTypes.length) }).map((_, index) => {
                const slotNumber = CORE_REACTION_TYPES.length + bonusReactionTypes.length + index + 1;
                return (
                    <button key={`empty-reaction-slot-${slotNumber}`} type="button" onClick={onBrowseLibrary} className="relative min-h-[148px] overflow-hidden rounded-2xl border-2 border-dashed border-violet-300/35 bg-gradient-to-b from-violet-500/12 via-zinc-900/55 to-black/70 p-3 text-center active:scale-95">
                        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-violet-200/25 bg-violet-400/12 text-xl text-violet-100"><i className="fa-solid fa-plus" aria-hidden="true"></i></span>
                        <span className="mt-2 block text-sm font-black text-white">Choose reaction</span>
                        <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-violet-200/70">Slot {slotNumber}</span>
                    </button>
                );
            })}
            {reactionSlotCount < 5 ? (
                <button
                    type="button"
                    data-feature-id="locked-reaction-slot-5"
                    onClick={onUnlockFifth}
                    disabled={!fifthReactionSlotPurchasesEnabled}
                    className="relative min-h-[148px] overflow-hidden rounded-2xl border-2 border-zinc-500/65 bg-gradient-to-b from-zinc-500/14 via-zinc-900/70 to-black/80 p-3 text-center shadow-[0_10px_24px_rgba(0,0,0,0.42)] enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-65"
                >
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-zinc-500/50 bg-zinc-800/90 text-2xl text-zinc-500 grayscale"><i className="fa-solid fa-lock" aria-hidden="true"></i></span>
                    <span className="mt-2 block text-sm font-black text-zinc-200">Unlock 5th voting emoji</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">{fifthReactionSlotPurchasesEnabled ? `${fifthReactionSlotPointsCost} points · this room` : 'Ask your host to enable this'}</span>
                    {fifthReactionSlotPurchasesEnabled ? <span className="mt-2 inline-flex rounded-full border border-cyan-200/45 bg-cyan-300/18 px-3 py-1 shadow-[0_0_18px_rgba(34,211,238,0.24)]"><CurrencyAmount currency="points" amount={fifthReactionSlotPointsCost} size="sm" /></span> : null}
                </button>
            ) : null}
            {reactionSlotCount < 6 && sixthReactionSlotProduct ? (
                <button
                    type="button"
                    data-feature-id="locked-reaction-slot-6"
                    onClick={onUnlockSixth}
                    className="relative min-h-[148px] overflow-hidden rounded-2xl border-2 border-zinc-500/65 bg-gradient-to-b from-zinc-500/14 via-zinc-900/70 to-black/80 p-3 text-center shadow-[0_10px_24px_rgba(0,0,0,0.42)] active:scale-95"
                >
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-zinc-500/50 bg-zinc-800/90 text-2xl text-zinc-500 grayscale"><i className="fa-solid fa-lock" aria-hidden="true"></i></span>
                    <span className="mt-2 block text-sm font-black text-zinc-300">Reaction slot 6</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{reactionSlotCount < 5 ? 'Slot 5 required' : 'Permanent + Royal'}</span>
                    <span className="mt-2 inline-flex rounded-full border border-fuchsia-200/50 bg-fuchsia-400/20 px-3 py-1 shadow-[0_0_20px_rgba(217,70,239,0.3)]"><CurrencyAmount currency="beaubucks" amount={sixthReactionSlotProduct.cost} size="sm" /></span>
                </button>
            ) : null}
        </div>
        <button
            type="button"
            data-feature-id="browse-reaction-emoji-library"
            onClick={onBrowseLibrary}
            className="flex min-h-[68px] w-full items-center justify-between gap-3 rounded-2xl border-2 border-violet-300/35 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/14 to-cyan-500/14 px-4 text-left shadow-[0_0_26px_rgba(139,92,246,0.14)] active:scale-[0.99]"
        >
            <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-300/16 text-2xl"><i className="fa-solid fa-icons" aria-hidden="true"></i></span>
                <span><span className="block text-base font-black text-white">Reaction Emoji Library</span><span className="block text-[11px] font-bold text-violet-100/70">Browse, compare, unlock, and equip reactions</span></span>
            </span>
            <i className="fa-solid fa-chevron-right text-violet-200" aria-hidden="true"></i>
        </button>
    </>
);

export default AudienceReactionSlotGrid;
