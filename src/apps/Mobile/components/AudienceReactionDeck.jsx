import { getReactionDefinition } from '../../../lib/reactionCatalog';
import { CurrencyAmount } from '../../../components/CurrencyToken';

const REACTION_TONES = Object.freeze({
    fire: 'border-orange-300/45 bg-orange-500/16 text-orange-50',
    heart: 'border-pink-300/45 bg-pink-500/16 text-pink-50',
    clap: 'border-cyan-300/45 bg-cyan-500/16 text-cyan-50',
    drink: 'border-blue-300/45 bg-blue-500/16 text-blue-50',
});

const AudienceReactionDeck = ({
    active = false,
    reactionTypes = [],
    isCoolingDown = () => false,
    renderCooldownFill = () => null,
    getIconClass = () => '',
    getEmoji = () => '',
    onReact = () => {},
    onEdit = () => {},
}) => (
    <section
        className="relative z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(8,15,28,0.96),rgba(3,7,18,0.94))] px-3 py-3"
        data-feature-id="persistent-audience-reaction-deck"
        data-reactions-active={active ? 'true' : 'false'}
    >
        <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
                <div className={`text-[9px] font-black uppercase tracking-[0.18em] ${active ? 'text-cyan-200' : 'text-zinc-500'}`}>
                    {active ? 'Voting is live' : 'Your voting emojis'}
                </div>
                <div className="truncate text-[11px] font-bold text-zinc-300">
                    {active ? 'Tap to react on the public TV' : 'Ready for the next performance'}
                </div>
            </div>
            <button
                type="button"
                onClick={onEdit}
                className="min-h-[40px] shrink-0 rounded-full border border-violet-300/35 bg-violet-400/12 px-3 text-[10px] font-black uppercase tracking-[0.13em] text-violet-100 active:scale-95"
                data-feature-id="edit-voting-emojis"
            >
                <i className="fa-solid fa-sliders mr-1.5" aria-hidden="true"></i>Edit
            </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label={active ? 'Voting reaction buttons' : 'Inactive voting reaction preview'}>
            {reactionTypes.map((reactionType, index) => {
                const reaction = getReactionDefinition(reactionType) || {};
                const coolingDown = isCoolingDown(reactionType);
                const disabled = !active || coolingDown;
                const tone = REACTION_TONES[reactionType] || (reaction.premiumFlourish
                    ? 'border-fuchsia-300/50 bg-fuchsia-500/16 text-fuchsia-50'
                    : reaction.rarity === 'fame'
                        ? 'border-amber-300/45 bg-amber-500/14 text-amber-50'
                        : 'border-violet-300/45 bg-violet-500/14 text-violet-50');
                return (
                    <button
                        key={`${reactionType}-${index}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => onReact(reactionType, reaction.pointCost)}
                        className={`relative flex h-[68px] w-[66px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border transition ${tone} ${disabled ? 'cursor-default opacity-60' : 'shadow-[0_0_20px_rgba(34,211,238,0.12)] active:scale-95'}`}
                        aria-label={`${reaction.label || reactionType}${active ? '' : ', available during performances'}`}
                        data-reaction-deck-type={reactionType}
                    >
                        {renderCooldownFill(reactionType, 'bg-cyan-300/18', 'border-white/15 bg-black/60 text-cyan-50')}
                        <span className={`${getIconClass(reactionType)} text-2xl leading-none`}>{getEmoji(reactionType)}</span>
                        <span className="mt-1 max-w-[58px] truncate text-[8px] font-black uppercase tracking-[0.08em]">{reaction.label || reactionType}</span>
                        {active && Number(reaction.pointCost || 0) > 0 ? (
                            <CurrencyAmount currency="points" amount={reaction.pointCost} size="xs" className="absolute right-1 top-1 scale-75 origin-top-right" />
                        ) : null}
                    </button>
                );
            })}
        </div>
    </section>
);

export default AudienceReactionDeck;
