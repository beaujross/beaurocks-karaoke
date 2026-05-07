import React from 'react';
import { withAudienceBrandAlpha } from '../../../lib/audienceBrandTheme';

const iconByType = {
    performance: 'fa-microphone-lines',
    scene: 'fa-tv',
    moment: 'fa-star',
};

export default function HostCandidatePool({
    items = [],
    groups = [],
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
                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>Candidate Pool</div>
                    <div className="mt-1 text-xs text-zinc-400">
                        {compact ? 'Open pulls for the night.' : 'Open candidates stay visible without becoming the main queue.'}
                    </div>
                </div>
                <span
                    className="rounded-full border bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200"
                    style={{ borderColor: withAudienceBrandAlpha(secondaryColor, 0.22) }}
                >
                    {items.length} visible
                </span>
            </div>
            <div className={`mt-3 ${compact ? 'space-y-2.5' : 'space-y-3'}`}>
                {(groups.length ? groups : [{ id: 'all', title: 'Open Candidates', helper: '', items }]).map((group) => (
                    <div
                        key={group.id}
                        className={`${compact ? 'rounded-[18px] p-2.5' : 'rounded-2xl p-3'} border bg-black/18`}
                        style={{ borderColor: withAudienceBrandAlpha(primaryColor, 0.14) }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: secondaryColor }}>{group.title}</div>
                                {group.helper ? <div className="mt-1 text-xs text-zinc-500">{group.helper}</div> : null}
                            </div>
                            <span
                                className="rounded-full border bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200"
                                style={{ borderColor: withAudienceBrandAlpha(secondaryColor, 0.22) }}
                            >
                                {group.items.length}
                            </span>
                        </div>
                        <div className={`mt-3 grid gap-2 ${compact ? 'xl:grid-cols-2' : 'lg:grid-cols-2'}`}>
                            {group.items.map((item, index) => (
                                <div
                                    key={item.id || `${item.title}-${index}`}
                                    className={`${compact ? 'rounded-[18px] px-2.5 py-2.5' : 'rounded-2xl px-3 py-3'} border border-white/10 bg-black/20`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`flex ${compact ? 'h-9 w-9 rounded-[14px]' : 'h-10 w-10 rounded-xl'} shrink-0 items-center justify-center border border-white/10 bg-black/25 text-zinc-100`}>
                                            <i className={`fa-solid ${iconByType[item.objectType] || 'fa-circle'}`}></i>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className={`truncate font-semibold text-white ${compact ? 'text-[13px]' : 'text-sm'}`}>{item.title}</div>
                                                    <div className="truncate text-xs text-zinc-300">{item.subtitle}</div>
                                                </div>
                                                <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                                    {item.statusLabel || item.objectType}
                                                </span>
                                            </div>
                                            <div className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-zinc-500">{item.reason || item.detail}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
