import React, { useEffect, useMemo, useState } from 'react';
import { controlPromptSession, finalizePromptVoteRound } from '../../../lib/firebase.js';
import { TRIVIA_BANK, WYR_BANK } from '../../../lib/gameDataConstants.js';
import { NIGHT_EXPERIENCE_IDS, deriveNightExperienceId } from '../../../lib/nightPlan.js';
import { useToast } from '../../../context/ToastContext';

const buildStarterPrompts = (kind, count = 10) => {
    if (kind === 'would_you_rather') {
        return WYR_BANK.slice(0, count).map((item, index) => ({
            id: `wyr_${index + 1}`,
            q: item.q || 'Would you rather?',
            a: item.a,
            b: item.b,
            points: item.points || 50,
        }));
    }
    return TRIVIA_BANK.slice(0, count).map((item, index) => {
        const options = [item.correct, item.w1, item.w2, item.w3].filter(Boolean);
        return {
            id: `trivia_${index + 1}`,
            q: item.q,
            options,
            answer: item.correct,
            correct: Math.max(0, options.indexOf(item.correct)),
            points: item.points || 50,
        };
    });
};

const PromptNightSessionPanel = ({ roomCode = '', room = {} }) => {
    const toast = useToast() || console.log;
    const experienceId = deriveNightExperienceId(room);
    const kind = experienceId === NIGHT_EXPERIENCE_IDS.wouldYouRather ? 'would_you_rather' : 'trivia';
    const label = kind === 'trivia' ? 'Trivia Night' : 'Would You Rather';
    const itemLabel = kind === 'trivia' ? 'question' : 'prompt';
    const session = room?.promptSession && typeof room.promptSession === 'object' ? room.promptSession : null;
    const [draftPrompts, setDraftPrompts] = useState(() => buildStarterPrompts(kind));
    const [roundSec, setRoundSec] = useState(20);
    const [busyAction, setBusyAction] = useState('');
    const [privateDraftLoading, setPrivateDraftLoading] = useState(false);
    const [privateDraftError, setPrivateDraftError] = useState('');

    useEffect(() => {
        let cancelled = false;
        if (session?.kind === kind && Array.isArray(session.prompts) && session.prompts.length) {
            setDraftPrompts(session.prompts);
            setRoundSec(Math.max(5, Number(session.roundSec || 20)));
            const privateAnswersAlreadyPresent = kind !== 'trivia' || session.prompts.some((prompt) => (
                Number.isInteger(prompt?.correct) || !!String(prompt?.answer || '').trim()
            ));
            if (privateAnswersAlreadyPresent) return () => { cancelled = true; };
            setPrivateDraftLoading(true);
            setPrivateDraftError('');
            controlPromptSession({ roomCode, action: 'read' })
                .then((result) => {
                    const privateSession = result?.session;
                    if (cancelled || privateSession?.id !== session.id || !Array.isArray(privateSession?.prompts)) return;
                    setDraftPrompts(privateSession.prompts);
                    setRoundSec(Math.max(5, Number(privateSession.roundSec || 20)));
                })
                .catch(() => {
                    if (!cancelled) setPrivateDraftError('Correct answers could not be loaded. Refresh before editing this set.');
                })
                .finally(() => {
                    if (!cancelled) setPrivateDraftLoading(false);
                });
            return () => { cancelled = true; };
        }
        setDraftPrompts(buildStarterPrompts(kind));
        setPrivateDraftLoading(false);
        setPrivateDraftError('');
        // Reinitialize only when the session identity changes so room snapshots do not erase in-progress host edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, session?.id]);

    const currentIndex = Math.max(0, Number(session?.currentIndex || 0) || 0);
    const currentPrompt = session?.prompts?.[currentIndex] || null;
    const sessionStatus = String(session?.status || 'not_configured').trim().toLowerCase();
    const configured = !!session?.id && session?.kind === kind && Array.isArray(session?.prompts) && session.prompts.length > 0;
    const progressLabel = configured ? `${Math.min(currentIndex + 1, session.prompts.length)} of ${session.prompts.length}` : `${draftPrompts.length} ${itemLabel}s`;
    const statusLabel = sessionStatus === 'not_configured' ? 'Needs setup' : sessionStatus.replaceAll('_', ' ');
    const canEdit = !configured || ['draft', 'complete'].includes(sessionStatus);

    const runAction = async (action, extra = {}) => {
        if (!roomCode || busyAction) return;
        setBusyAction(action);
        try {
            const result = await controlPromptSession({
                roomCode,
                action,
                expectedRevision: configured ? Number(session?.revision || 0) : undefined,
                roundSec,
                ...extra,
            });
            if (action === 'configure' && Array.isArray(result?.session?.prompts)) {
                setDraftPrompts(result.session.prompts);
                setRoundSec(Math.max(5, Number(result.session.roundSec || roundSec)));
                setPrivateDraftError('');
            }
            if (action === 'reveal' && currentPrompt?.id) {
                await finalizePromptVoteRound({
                    roomCode,
                    questionId: currentPrompt.id,
                    voteType: kind === 'trivia' ? 'vote_trivia' : 'vote_wyr',
                }).catch(() => null);
            }
            toast(action === 'configure' ? `${label} session saved.` : `${label}: ${action}.`);
        } catch (error) {
            toast(error?.message || `Could not ${action} the session.`);
        } finally {
            setBusyAction('');
        }
    };

    useEffect(() => {
        const deadline = Math.max(0, Number(session?.roundEndsAtMs || 0) || 0);
        if (!configured || sessionStatus !== 'live' || !deadline) return undefined;
        if (session?.hostingLevel === 'host_led') return undefined;
        const waitMs = Math.max(100, deadline - Date.now());
        const timer = window.setTimeout(() => {
            controlPromptSession({
                roomCode,
                action: 'reveal',
                expectedRevision: Number(session?.revision || 0),
                roundSec,
            }).then(() => {
                if (!currentPrompt?.id) return null;
                return finalizePromptVoteRound({
                    roomCode,
                    questionId: currentPrompt.id,
                    voteType: kind === 'trivia' ? 'vote_trivia' : 'vote_wyr',
                }).catch(() => null);
            }).catch(() => null);
        }, waitMs);
        return () => window.clearTimeout(timer);
    }, [configured, currentPrompt?.id, kind, roomCode, roundSec, session?.hostingLevel, session?.revision, session?.roundEndsAtMs, sessionStatus]);

    const updateDraftPrompt = (index, patch) => setDraftPrompts((current) => current.map((entry, entryIndex) => (
        entryIndex === index ? { ...entry, ...patch } : entry
    )));
    const updateTriviaOption = (promptIndex, optionIndex, value) => setDraftPrompts((current) => current.map((entry, entryIndex) => {
        if (entryIndex !== promptIndex) return entry;
        const options = [...(Array.isArray(entry.options) ? entry.options : [])];
        options[optionIndex] = value;
        const correct = Math.max(0, Math.min(options.length - 1, Number(entry.correct || 0) || 0));
        return { ...entry, options, correct, answer: options[correct] || '' };
    }));
    const setTriviaCorrect = (promptIndex, optionIndex) => setDraftPrompts((current) => current.map((entry, entryIndex) => (
        entryIndex === promptIndex
            ? { ...entry, correct: optionIndex, answer: entry.options?.[optionIndex] || '' }
            : entry
    )));
    const addDraftPrompt = () => setDraftPrompts((current) => [
        ...current,
        kind === 'would_you_rather'
            ? { id: `wyr_${Date.now()}`, q: 'Would you rather?', a: '', b: '', points: 50 }
            : { id: `trivia_${Date.now()}`, q: 'New question', options: ['Answer A', 'Answer B', 'Answer C', 'Answer D'], answer: 'Answer A', correct: 0, points: 50 },
    ].slice(0, 100));
    const removeDraftPrompt = (index) => setDraftPrompts((current) => current.filter((_, entryIndex) => entryIndex !== index));

    const currentPromptTitle = useMemo(() => {
        if (!currentPrompt) return `No ${itemLabel} live`;
        return currentPrompt.q || currentPrompt.question || `${label} ${itemLabel}`;
    }, [currentPrompt, itemLabel, label]);

    if (![NIGHT_EXPERIENCE_IDS.trivia, NIGHT_EXPERIENCE_IDS.wouldYouRather].includes(experienceId)) return null;

    return (
        <section data-feature-id="prompt-night-session" className="mb-3 overflow-hidden rounded-2xl border border-amber-300/20 bg-[linear-gradient(135deg,rgba(54,31,7,0.88),rgba(26,17,39,0.94)_52%,rgba(9,35,43,0.9))] shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-200/25 bg-amber-400/15 text-amber-200"><i className={`fa-solid ${kind === 'trivia' ? 'fa-lightbulb' : 'fa-code-compare'}`} /></span>
                    <div className="min-w-0"><div className="text-xs font-black uppercase tracking-[0.14em] text-amber-100/65">Tonight's session</div><div className="truncate text-lg font-black text-white">{label}</div></div>
                </div>
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] text-zinc-300">{progressLabel}</span><span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] text-amber-100">{statusLabel}</span></div>
            </div>

            {canEdit ? (
                <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="max-h-[min(52vh,520px)] space-y-2 overflow-y-auto pr-1">
                        {draftPrompts.map((prompt, index) => (
                            <div key={prompt.id || index} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                                <div className="flex items-start gap-2">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/8 text-xs font-black text-zinc-300">{index + 1}</span>
                                    <label className="sr-only" htmlFor={`prompt-question-${index}`}>{itemLabel} {index + 1}</label>
                                    <input id={`prompt-question-${index}`} value={prompt.q || ''} onChange={(event) => updateDraftPrompt(index, { q: event.target.value })} className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-semibold text-white outline-none focus:border-amber-300/45" />
                                    {draftPrompts.length > 1 ? <button type="button" onClick={() => removeDraftPrompt(index)} aria-label={`Remove ${itemLabel} ${index + 1}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-rose-300/15 bg-rose-500/8 text-rose-100 hover:bg-rose-500/15"><i className="fa-solid fa-trash-can" /></button> : null}
                                </div>
                                {kind === 'would_you_rather' ? (
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        <input aria-label={`Prompt ${index + 1} option A`} value={prompt.a || ''} onChange={(event) => updateDraftPrompt(index, { a: event.target.value })} placeholder="Option A" className="min-h-[44px] rounded-lg border border-cyan-300/15 bg-cyan-500/8 px-3 text-sm text-white outline-none focus:border-cyan-300/45" />
                                        <input aria-label={`Prompt ${index + 1} option B`} value={prompt.b || ''} onChange={(event) => updateDraftPrompt(index, { b: event.target.value })} placeholder="Option B" className="min-h-[44px] rounded-lg border border-fuchsia-300/15 bg-fuchsia-500/8 px-3 text-sm text-white outline-none focus:border-fuchsia-300/45" />
                                    </div>
                                ) : (
                                    <fieldset className="mt-2 grid gap-2 sm:grid-cols-2">
                                        <legend className="sr-only">Answers for question {index + 1}; select the correct answer</legend>
                                        {(Array.isArray(prompt.options) ? prompt.options : []).map((option, optionIndex) => (
                                            <label key={`${prompt.id || index}-option-${optionIndex}`} className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 ${Number(prompt.correct || 0) === optionIndex ? 'border-emerald-300/45 bg-emerald-500/12' : 'border-white/10 bg-black/20'}`}>
                                                <input type="radio" name={`correct-answer-${prompt.id || index}`} checked={Number(prompt.correct || 0) === optionIndex} onChange={() => setTriviaCorrect(index, optionIndex)} className="h-4 w-4 accent-emerald-400" />
                                                <span className="sr-only">Mark option {optionIndex + 1} correct</span>
                                                <input aria-label={`Question ${index + 1} option ${optionIndex + 1}`} value={option || ''} onChange={(event) => updateTriviaOption(index, optionIndex, event.target.value)} className="min-h-[44px] min-w-0 flex-1 bg-transparent text-sm text-white outline-none" />
                                            </label>
                                        ))}
                                    </fieldset>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addDraftPrompt} disabled={draftPrompts.length >= 100} className="min-h-[44px] w-full rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 text-xs font-black uppercase tracking-[0.1em] text-zinc-200 hover:border-amber-300/35 hover:text-white disabled:opacity-45"><i className="fa-solid fa-plus mr-2" />Add {itemLabel}</button>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <label className="text-xs font-black uppercase tracking-[0.12em] text-zinc-300">Answer window<input type="number" min="5" max="180" value={roundSec} onChange={(event) => setRoundSec(Math.max(5, Math.min(180, Number(event.target.value || 20))))} className="mt-1 min-h-[44px] w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm font-black text-white" /></label>
                        <div className="mt-1 text-xs text-zinc-400">Seconds before guided hosting reveals the result.</div>
                        {privateDraftLoading ? <div className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-500/8 p-2 text-xs text-cyan-100"><i className="fa-solid fa-spinner fa-spin mr-2" />Loading private answer key…</div> : null}
                        {privateDraftError ? <div role="alert" className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 text-xs font-semibold text-rose-100">{privateDraftError}</div> : null}
                        <button type="button" disabled={!!busyAction || privateDraftLoading || !!privateDraftError || !draftPrompts.length} onClick={() => runAction('configure', { kind, title: label, prompts: draftPrompts })} className="mt-3 min-h-[46px] w-full rounded-xl bg-gradient-to-r from-amber-400 to-fuchsia-500 px-3 text-xs font-black uppercase tracking-[0.12em] text-slate-950 disabled:opacity-45">{busyAction === 'configure' ? 'Saving…' : `Save ${itemLabel} set`}</button>
                        {configured && sessionStatus === 'draft' ? <button type="button" disabled={!!busyAction} onClick={() => runAction('start')} className="mt-2 min-h-[44px] w-full rounded-xl bg-emerald-400 px-3 text-xs font-black uppercase tracking-[0.12em] text-slate-950 disabled:opacity-45">Start session</button> : null}
                    </div>
                </div>
            ) : (
                <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Current {itemLabel}</div><div className="mt-1 text-base font-black text-white">{currentPromptTitle}</div>{kind === 'would_you_rather' && currentPrompt ? <div className="mt-2 text-xs text-cyan-100/70">A: {currentPrompt.a} <span className="mx-2 text-white/20">/</span> B: {currentPrompt.b}</div> : null}</div>
                    <div className="flex flex-wrap gap-2">
                        {sessionStatus === 'draft' ? <button type="button" onClick={() => runAction('start')} disabled={!!busyAction} className="min-h-[44px] rounded-xl bg-emerald-400 px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-950">Start session</button> : null}
                        {sessionStatus === 'live' ? <><button type="button" onClick={() => runAction('reveal')} disabled={!!busyAction} className="min-h-[44px] rounded-xl bg-amber-400 px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-950">Reveal</button><button type="button" onClick={() => runAction('pause')} disabled={!!busyAction} className="min-h-[44px] rounded-xl border border-white/15 bg-black/25 px-4 text-xs font-black uppercase text-white">Pause</button></> : null}
                        {sessionStatus === 'reveal' ? <button type="button" onClick={() => runAction('next')} disabled={!!busyAction} className="min-h-[44px] rounded-xl bg-cyan-300 px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-950">Next {itemLabel}</button> : null}
                        {sessionStatus === 'paused' ? <button type="button" onClick={() => runAction('resume')} disabled={!!busyAction} className="min-h-[44px] rounded-xl bg-emerald-400 px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-950">Resume</button> : null}
                        <button type="button" onClick={() => runAction('end')} disabled={!!busyAction} className="min-h-[44px] rounded-xl border border-rose-300/25 bg-rose-500/10 px-4 text-xs font-black uppercase text-rose-100">End session</button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default PromptNightSessionPanel;
