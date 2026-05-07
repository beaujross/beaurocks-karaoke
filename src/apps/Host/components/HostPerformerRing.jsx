import React from 'react';
import { withAudienceBrandAlpha } from '../../../lib/audienceBrandTheme';

const POSITION_LAYOUTS = {
    default: [
        { angle: -90 },
        { angle: -28 },
        { angle: 24 },
        { angle: 90 },
        { angle: 180 },
        { angle: -152 },
    ],
    stage: [
        { x: 0, y: -112 },
        { x: 126, y: -50 },
        { x: 144, y: 22 },
        { x: 0, y: 108 },
        { x: -144, y: 16 },
        { x: -126, y: -44 },
    ],
};

const SIZE_CONFIG = {
    default: {
        wrapper: 'px-8 py-10',
        frameHeight: 'min-h-[26rem]',
        outerRing: 'h-72 w-72',
        middleRing: 'h-56 w-56',
        guideRing: 'h-64 w-64',
        centerDisc: 'h-44 w-44',
        actionButton: 'min-h-[52px] min-w-[96px] rounded-2xl px-3 py-2 text-[11px]',
        artwork: 'h-16 w-16',
        title: 'text-lg',
        orbitRadius: 150,
    },
    stage: {
        wrapper: 'px-5 py-6',
        frameHeight: 'min-h-[18.5rem]',
        outerRing: 'h-48 w-48',
        middleRing: 'h-36 w-36',
        guideRing: 'h-[10.5rem] w-[10.5rem]',
        centerDisc: 'h-32 w-32',
        actionButton: 'min-h-[40px] min-w-[74px] rounded-[16px] px-2 py-1.5 text-[9px]',
        artwork: 'h-12 w-12',
        title: 'text-[15px]',
        orbitRadius: 102,
    },
};

export default function HostPerformerRing({
    focusObject = null,
    actions = [],
    brandTheme = null,
    size = 'default',
}) {
    if (!focusObject) return null;
    const primaryColor = String(brandTheme?.primaryColor || '#00C4D9').trim() || '#00C4D9';
    const secondaryColor = String(brandTheme?.secondaryColor || '#FF67B6').trim() || '#FF67B6';
    const accentColor = String(brandTheme?.accentColor || '#FACC15').trim() || '#FACC15';
    const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG.default;
    const orbitRadius = Number(sizeConfig.orbitRadius || 122);
    const avatarEmoji = String(focusObject.avatarEmoji || '').trim();
    const avatarUrl = String(focusObject.avatarUrl || '').trim();
    const initials = String(focusObject.title || 'G')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'G';

    return (
        <div className={`relative flex items-center justify-center ${sizeConfig.wrapper} ${sizeConfig.frameHeight}`}>
            <div className="absolute inset-0 flex items-center justify-center">
                <div
                    className="absolute h-[84%] w-[84%] rounded-full blur-3xl opacity-90"
                    style={{
                        background: `radial-gradient(circle, ${withAudienceBrandAlpha(primaryColor, 0.18)} 0%, ${withAudienceBrandAlpha(secondaryColor, 0.14)} 38%, transparent 72%)`,
                    }}
                />
                <div
                    className={`${sizeConfig.outerRing} rounded-full border`}
                    style={{
                        borderColor: withAudienceBrandAlpha(accentColor, 0.3),
                        backgroundImage: `radial-gradient(circle at center, ${withAudienceBrandAlpha(accentColor, 0.18)}, rgba(9,14,23,0.02) 55%, transparent 72%)`,
                        boxShadow: `0 0 80px ${withAudienceBrandAlpha(secondaryColor, 0.18)}`,
                    }}
                />
                <div
                    className={`absolute ${sizeConfig.middleRing} rounded-full border`}
                    style={{
                        borderColor: withAudienceBrandAlpha(primaryColor, 0.26),
                        boxShadow: `0 0 36px ${withAudienceBrandAlpha(primaryColor, 0.16)}`,
                    }}
                />
                <div className={`absolute ${sizeConfig.guideRing} rounded-full border border-white/8 [mask-image:radial-gradient(circle,transparent_58%,black_60%)] opacity-60`} />
                <div
                    className={`absolute ${sizeConfig.guideRing} rounded-full border border-dashed opacity-40`}
                    style={{ borderColor: withAudienceBrandAlpha(secondaryColor, 0.22) }}
                />
            </div>
            <div
                className={`relative z-10 flex ${sizeConfig.centerDisc} flex-col items-center justify-center rounded-full border p-5 text-center shadow-[0_24px_70px_rgba(0,0,0,0.45)]`}
                style={{
                    borderColor: withAudienceBrandAlpha(primaryColor, 0.2),
                    backgroundImage: [
                        `radial-gradient(circle at 30% 30%, ${withAudienceBrandAlpha(secondaryColor, 0.22)}, transparent 46%)`,
                        `radial-gradient(circle at 65% 72%, ${withAudienceBrandAlpha(primaryColor, 0.18)}, transparent 42%)`,
                        'linear-gradient(180deg, rgba(12,16,26,0.96), rgba(5,8,14,0.98))',
                    ].join(', '),
                    boxShadow: `0 24px 70px ${withAudienceBrandAlpha(primaryColor, 0.18)}`,
                }}
            >
                <div
                    className="absolute inset-[8px] rounded-full border opacity-70"
                    style={{ borderColor: withAudienceBrandAlpha(accentColor, 0.14) }}
                />
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={focusObject.subtitle || focusObject.title}
                        className={`mb-3 ${sizeConfig.artwork} rounded-2xl border border-white/10 object-cover shadow-[0_12px_24px_rgba(0,0,0,0.35)]`}
                    />
                ) : avatarEmoji ? (
                    <div
                        className={`mb-3 flex ${sizeConfig.artwork} items-center justify-center rounded-2xl border text-2xl`}
                        style={{
                            borderColor: withAudienceBrandAlpha(secondaryColor, 0.24),
                            backgroundColor: withAudienceBrandAlpha(secondaryColor, 0.12),
                        }}
                    >
                        <span className="leading-none">{avatarEmoji}</span>
                    </div>
                ) : focusObject.artworkUrl ? (
                    <img
                        src={focusObject.artworkUrl}
                        alt={focusObject.subtitle || focusObject.title}
                        className={`mb-3 ${sizeConfig.artwork} rounded-2xl border border-white/10 object-cover shadow-[0_12px_24px_rgba(0,0,0,0.35)]`}
                    />
                ) : (
                    <div
                        className={`mb-3 flex ${sizeConfig.artwork} items-center justify-center rounded-2xl border text-2xl`}
                        style={{
                            borderColor: withAudienceBrandAlpha(secondaryColor, 0.24),
                            backgroundColor: withAudienceBrandAlpha(secondaryColor, 0.12),
                            color: '#FEF3C7',
                            fontWeight: 900,
                        }}
                    >
                        {focusObject.objectType === 'scene' ? <i className="fa-solid fa-tv"></i> : <span>{initials}</span>}
                    </div>
                )}
                <div
                    className="text-[10px] font-black uppercase tracking-[0.22em]"
                    style={{ color: secondaryColor }}
                >
                    {focusObject.objectRole === 'live' ? 'Live Now' : focusObject.objectRole === 'next' ? 'Next Up' : 'Focused'}
                </div>
                <div className={`mt-1 max-w-full truncate font-black text-white ${sizeConfig.title}`}>{focusObject.title}</div>
                <div className="max-w-full truncate text-sm text-zinc-300">{focusObject.subtitle}</div>
                <div className="mt-1 max-w-full truncate text-[11px] uppercase tracking-[0.14em] text-zinc-500">{focusObject.detail}</div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                    {focusObject.sourceLabel ? (
                        <span
                            className="rounded-full border bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200"
                            style={{ borderColor: withAudienceBrandAlpha(primaryColor, 0.24) }}
                        >
                            {focusObject.sourceLabel}
                        </span>
                    ) : null}
                    {focusObject.statusLabel ? (
                        <span
                            className="rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]"
                            style={{
                                borderColor: withAudienceBrandAlpha(secondaryColor, 0.24),
                                backgroundColor: withAudienceBrandAlpha(secondaryColor, 0.12),
                                color: '#FEF3C7',
                            }}
                        >
                            {focusObject.statusLabel}
                        </span>
                    ) : null}
                </div>
            </div>
            {actions.slice(0, 6).map((action, index) => {
                const positions = POSITION_LAYOUTS[size] || POSITION_LAYOUTS.default;
                const position = positions[index] || positions[index % positions.length];
                const hasCartesianPosition = Number.isFinite(position?.x) && Number.isFinite(position?.y);
                const radians = (Number(position?.angle || 0) * Math.PI) / 180;
                const x = hasCartesianPosition ? Number(position.x) : Math.cos(radians) * orbitRadius;
                const y = hasCartesianPosition ? Number(position.y) : Math.sin(radians) * orbitRadius;
                return (
                    <button
                        key={action.id || `${action.label}-${index}`}
                        type="button"
                        disabled={action.disabled}
                        onClick={action.onClick}
                        className={`absolute z-20 inline-flex items-center justify-center border text-center font-black uppercase tracking-[0.14em] shadow-[0_18px_38px_rgba(0,0,0,0.34)] backdrop-blur-md transition ${sizeConfig.actionButton} ${action.toneClass || 'border-white/15 bg-black/45 text-white hover:border-cyan-300/35 hover:bg-cyan-500/10'} ${action.disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                        style={{
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            transform: 'translate(-50%, -50%)',
                            backgroundImage: action.disabled
                                ? undefined
                                : `linear-gradient(145deg, ${withAudienceBrandAlpha('#ffffff', 0.06)}, ${withAudienceBrandAlpha(primaryColor, 0.04)})`,
                        }}
                    >
                        <span className="flex flex-col items-center gap-1">
                            {action.icon ? <i className={`fa-solid ${action.icon} text-[11px]`}></i> : null}
                            <span>{action.label}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
