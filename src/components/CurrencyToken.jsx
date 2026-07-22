import React from 'react';
import { getCurrencyVisual } from '../lib/currencyVisuals';

const sizeClasses = Object.freeze({
    xs: 'h-5 min-w-5 px-1 text-[8px]',
    sm: 'h-7 min-w-7 px-1.5 text-[10px]',
    md: 'h-9 min-w-9 px-2 text-xs',
    lg: 'h-12 min-w-12 px-2.5 text-sm',
});

export function CurrencyIcon({ currency = 'points', size = 'sm', className = '' }) {
    const visual = getCurrencyVisual(currency);
    return (
        <span
            className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border bg-gradient-to-br font-black leading-none ${sizeClasses[size] || sizeClasses.sm} ${visual.borderClass} ${visual.surfaceClass} ${visual.glowClass} ${className}`}
            aria-hidden="true"
        >
            <span className={`absolute inset-[2px] rounded-full bg-gradient-to-br opacity-25 ${visual.gradientClass}`} />
            <span className={`relative ${visual.textClass}`}>{visual.iconText}</span>
        </span>
    );
}

export function CurrencyAmount({ currency = 'points', amount = 0, size = 'sm', showLabel = false, signed = '', className = '' }) {
    const visual = getCurrencyVisual(currency);
    const numericAmount = Math.max(0, Math.floor(Number(amount) || 0));
    return (
        <span className={`inline-flex items-center gap-2 font-black tabular-nums ${visual.textClass} ${className}`}>
            <CurrencyIcon currency={currency} size={size} />
            <span>{signed}{numericAmount.toLocaleString()}</span>
            {showLabel ? <span className={`text-[0.72em] uppercase tracking-[0.16em] ${visual.mutedTextClass}`}>{visual.shortLabel}</span> : null}
        </span>
    );
}

export function CurrencyPill({ currency = 'points', amount = 0, label = '', className = '' }) {
    const visual = getCurrencyVisual(currency);
    return (
        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 ${visual.borderClass} ${visual.surfaceClass} ${visual.glowClass} ${className}`}>
            <CurrencyAmount currency={currency} amount={amount} size="xs" />
            {label ? <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${visual.mutedTextClass}`}>{label}</span> : null}
        </span>
    );
}

export default CurrencyAmount;
