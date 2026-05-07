import React from 'react';
import { withAudienceBrandAlpha } from '../../../lib/audienceBrandTheme';

const toneClassForItem = (item = {}) => (
    item?.objectRole === 'next'
        ? 'border-cyan-300/30 bg-cyan-500/10'
        : item?.playable === false
            ? 'border-amber-300/25 bg-amber-500/10'
            : 'border-white/10 bg-black/20'
);

export default function HostRotationLane({
    items = [],
    brandTheme = null,
    compact = false,
}) {
    if (!items.length) return null;
    const primaryColor = String(brandTheme?.primaryColor || '#00C4D9').trim() || '#00C4D9';
    const secondaryColor = String(brandTheme?.secondaryColor || '#FF67B6').trim() || '#FF67B6';
    return (
        <div
            className={`border bg-black/25 ${compact ? 'rounded-[20px] px-3.5 py-3' : 'rounded-[24px] px-4 py-4'}`}
            style={{
                borderColor: withAudienceBrandAlpha(primaryColor, 0.18),
                boxShadow: `0 18px 48px ${withAudienceBrandAlpha(primaryColor, 0.08)}`,
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>Rotation Lane</div>
                    <div className="mt-1 text-xs text-zinc-500">
                        {compact ? 'Fairness stays visible.' : 'Keep fairness visible without turning this into the whole queue.'}
                    </div>
                </div>
                <span
                    className="rounded-full border bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200"
                    style={{ borderColor: withAudienceBrandAlpha(secondaryColor, 0.22) }}
                >
                    {items.length} visible
                </span>
            </div>
            <div className={`mt-3 grid gap-2 ${compact ? 'md:grid-cols-3 xl:grid-cols-4' : 'lg:grid-cols-4'}`}>
                {items.map((item, index) => (
                    <div
                        key={item.id || `${item.title}-${index}`}
                        className={`border ${compact ? 'rounded-[18px] px-2.5 py-2.5' : 'rounded-2xl px-3 py-3'} ${toneClassForItem(item)} shadow-[0_12px_30px_rgba(0,0,0,0.16)]`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className={`truncate font-semibold text-white ${compact ? 'text-[13px]' : 'text-sm'}`}>{item.title}</div>
                                <div className="truncate text-xs text-zinc-300">{item.subtitle}</div>
                                <div className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-zinc-500">{item.statusLabel || item.reason}</div>
                            </div>
                            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                {index === 0 ? 'Next' : `+${index}`}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
