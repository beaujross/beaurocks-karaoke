import React, { useState, createContext, useContext } from 'react';
import { EMOJI } from '../lib/emoji';

export const ToastContext = createContext(null);

const inferToastTone = (message = '') => {
    const text = String(message || '').trim();
    if (!text) return 'default';
    if (/\+\s*\d[\d,]*\s*(pts?|points?)/i.test(text)) return 'reward';
    if (/(failed|error|denied|invalid|unavailable|blocked|could not|not found|expired|missing|retry)/i.test(text)) return 'error';
    if (/(slow|wait|paused|already|off right now|capped|full|spectating)/i.test(text)) return 'warning';
    if (/(sent|saved|updated|copied|submitted|enabled|disabled|started|queued|unlocked|ready|launched|complete|added)/i.test(text)) return 'success';
    return 'default';
};

const normalizeToastPayload = (input, options = {}) => {
    const incoming = input && typeof input === 'object'
        ? input
        : { msg: input };
    const msg = String(incoming.msg ?? incoming.message ?? '').trim();
    const tone = String(incoming.tone || options.tone || inferToastTone(msg)).trim().toLowerCase() || 'default';
    const icon = incoming.icon || options.icon || '';
    const durationMsRaw = Number(incoming.durationMs ?? options.durationMs);
    const defaultDuration = tone === 'reward' || tone === 'error' ? 3200 : tone === 'warning' ? 2900 : 2500;
    const durationMs = Number.isFinite(durationMsRaw) ? Math.max(1200, durationMsRaw) : defaultDuration;
    return {
        msg,
        tone,
        icon,
        durationMs,
    };
};

const toneStyles = {
    default: 'bg-zinc-900/92 border-zinc-500/50 text-white',
    success: 'bg-emerald-950/88 border-emerald-400/45 text-emerald-100',
    warning: 'bg-amber-950/88 border-amber-400/45 text-amber-100',
    error: 'bg-rose-950/88 border-rose-400/50 text-rose-100',
    reward: 'bg-gradient-to-r from-fuchsia-900/92 via-violet-900/90 to-cyan-900/88 border-cyan-300/55 text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,0.28)]',
};

const toneIcons = {
    default: EMOJI.bell,
    success: EMOJI.check,
    warning: EMOJI.hourglass,
    error: EMOJI.cross,
    reward: EMOJI.coin,
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = (input, options = {}) => {
        const payload = normalizeToastPayload(input, options);
        if (!payload.msg) return;
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, ...payload }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), payload.durationMs);
    };

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed top-24 left-0 w-full flex flex-col items-center gap-2 pointer-events-none z-[200]">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`${toneStyles[t.tone] || toneStyles.default} border px-6 py-3 rounded-2xl shadow-2xl font-bold animate-pop text-center backdrop-blur-sm`}
                    >
                        <span className="inline-flex items-center gap-2">
                            <span>{t.icon || toneIcons[t.tone] || EMOJI.bell}</span>
                            <span>{t.msg}</span>
                        </span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => useContext(ToastContext);
