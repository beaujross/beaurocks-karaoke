import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createHostSupportThread } from '../../../lib/firebase';

const FEEDBACK_TYPES = [
    { id: 'bug', label: 'Something broke', icon: 'fa-bug' },
    { id: 'feature_request', label: 'I have an idea', icon: 'fa-lightbulb' },
    { id: 'other', label: 'General feedback', icon: 'fa-comment-dots' },
];

const cleanError = (error) => String(error?.message || 'Feedback could not be sent. Please try again.')
    .replace(/^FirebaseError:\s*/i, '');

const labelFromToken = (value) => String(value || '')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const HostFeedbackDrawer = ({ open, onClose, context = null }) => {
    const [category, setCategory] = useState('bug');
    const [body, setBody] = useState('');
    const [includeContext, setIncludeContext] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sentThreadId, setSentThreadId] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
        const onKeyDown = (event) => {
            if (event.key === 'Escape' && !busy) onClose?.();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [busy, onClose, open]);

    useEffect(() => {
        if (!open) {
            setBody('');
            setError('');
            setSentThreadId('');
            setCategory('bug');
            setIncludeContext(true);
        }
    }, [open]);

    const contextItems = useMemo(() => {
        if (!context) return [];
        return [
            context.roomCode ? `Room ${context.roomCode}` : '',
            context.workspaceSection ? labelFromToken(context.workspaceSection) : labelFromToken(context.tab),
            Number.isFinite(Number(context.queueCount)) ? `${Number(context.queueCount)} queued` : '',
            context.performanceTitle ? `Live: ${context.performanceTitle}` : 'No performance live',
        ].filter(Boolean);
    }, [context]);

    if (!open) return null;

    const submit = async (event) => {
        event.preventDefault();
        const message = body.trim();
        if (!message || busy) return;
        const type = FEEDBACK_TYPES.find((item) => item.id === category) || FEEDBACK_TYPES[2];
        const location = labelFromToken(context?.workspaceSection || context?.tab || 'Host Panel');
        setBusy(true);
        setError('');
        try {
            const payload = await createHostSupportThread({
                title: `${type.label} · ${location}`,
                category,
                body: message,
                context: includeContext ? { ...context, capturedAtMs: Date.now() } : null,
            });
            setSentThreadId(String(payload?.item?.threadId || 'sent'));
        } catch (submitError) {
            setError(cleanError(submitError));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[260] flex items-end justify-end bg-black/55 p-0 backdrop-blur-[2px] sm:p-3" role="presentation" data-host-feedback-drawer>
            <button type="button" aria-label="Close feedback" className="absolute inset-0 cursor-default" onClick={() => !busy && onClose?.()} />
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="host-feedback-title"
                className="relative z-10 flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-cyan-200/20 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.16),transparent_35%),linear-gradient(145deg,rgba(19,31,51,0.99),rgba(25,18,41,0.99))] shadow-[0_30px_100px_rgba(0,0,0,0.7)] sm:max-h-[calc(100dvh-1.5rem)] sm:max-w-[480px] sm:rounded-3xl"
            >
                <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-300">Private to BeauRocks</div>
                        <h2 id="host-feedback-title" className="mt-1 text-xl font-black text-white">Send feedback without leaving the show</h2>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">Your place in the Host Panel stays exactly where it is.</p>
                    </div>
                    <button type="button" onClick={() => !busy && onClose?.()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white" aria-label="Close feedback">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </header>

                {sentThreadId ? (
                    <div className="grid min-h-[360px] place-items-center overflow-y-auto p-7 text-center">
                        <div>
                            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-300/30 bg-emerald-500/12 text-2xl text-emerald-200"><i className="fa-solid fa-check" /></div>
                            <h3 className="mt-5 text-xl font-black text-white">Feedback sent</h3>
                            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">It is now a private conversation with the BeauRocks team. You can keep running the Room or follow replies in Host Hub.</p>
                            <div className="mt-6 grid gap-2 sm:grid-cols-2">
                                <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl border border-cyan-200/35 bg-cyan-400/15 px-4 py-2 text-sm font-black text-cyan-50 transition hover:bg-cyan-400/25">Back to the show</button>
                                <a href="/hub?tab=support" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:bg-white/10">View in Host Hub</a>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
                        <fieldset>
                            <legend className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">What kind of feedback?</legend>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                                {FEEDBACK_TYPES.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setCategory(item.id)}
                                        aria-pressed={category === item.id}
                                        className={`min-h-[74px] rounded-2xl border px-2 py-3 text-center transition ${category === item.id ? 'border-cyan-300/45 bg-cyan-500/14 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.08)]' : 'border-white/10 bg-black/20 text-zinc-400 hover:border-white/20 hover:text-white'}`}
                                    >
                                        <i className={`fa-solid ${item.icon} block text-base`} />
                                        <span className="mt-1.5 block text-[11px] font-black leading-4">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <label className="mt-5 block">
                            <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Tell us what happened or what would help</span>
                            <textarea
                                ref={textareaRef}
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                maxLength={6000}
                                rows={6}
                                placeholder="A short note is enough. What were you trying to do?"
                                className="mt-2 min-h-[140px] w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-base leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-400/10"
                            />
                            <span className="mt-1 block text-right text-[10px] text-zinc-600">{body.length}/6000</span>
                        </label>

                        <div className="mt-3 rounded-2xl border border-pink-300/15 bg-pink-500/[0.06] p-3">
                            <label className="flex cursor-pointer items-start gap-3">
                                <input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} className="mt-1 accent-cyan-400" />
                                <span>
                                    <span className="block text-sm font-black text-white">Include current Room context</span>
                                    <span className="mt-0.5 block text-xs leading-5 text-zinc-400">Helps us reproduce the issue. No chat messages, audience details, or credentials are attached.</span>
                                </span>
                            </label>
                            {includeContext && contextItems.length ? <div className="mt-3 flex flex-wrap gap-1.5">{contextItems.map((item) => <span key={item} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-bold text-zinc-300">{item}</span>)}</div> : null}
                        </div>

                        {error ? <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm leading-5 text-rose-100" role="alert">{error}</div> : null}

                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button type="button" onClick={onClose} disabled={busy} className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/10 disabled:opacity-50">Cancel</button>
                            <button type="submit" disabled={busy || !body.trim()} className="min-h-[44px] rounded-xl border border-cyan-200/35 bg-gradient-to-r from-cyan-500/25 to-pink-500/20 px-5 py-2 text-sm font-black text-white transition hover:border-cyan-100/55 hover:from-cyan-500/35 hover:to-pink-500/30 disabled:cursor-not-allowed disabled:opacity-45">
                                {busy ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Sending...</> : <><i className="fa-solid fa-paper-plane mr-2" />Send feedback</>}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
};

export default HostFeedbackDrawer;
