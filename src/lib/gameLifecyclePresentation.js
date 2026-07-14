import { getGameLifecycleContract } from './gameLifecycle';
import { getGameLifecycleLabel } from './gameLaunchCompatibility';
import { resolveGameLifecycleSlots } from './gameLifecycleSlots';

const text = (value = '') => String(value || '').trim();

const resolveModeState = (room = {}, modeId = '') => {
    if (modeId === 'trivia_pop') return room?.triviaQuestion || {};
    if (modeId === 'wyr') return room?.wyrData || {};
    if (modeId === 'doodle_oke') return room?.doodleOke || {};
    if (modeId === 'selfie_challenge') return room?.selfieChallenge || {};
    if (modeId === 'karaoke_bracket') return room?.karaokeBracket || room?.gameData || {};
    if (modeId === 'bingo') return {
        ...(room?.gameData || {}),
        status: room?.bingoWin ? 'ended' : room?.bingoFocus ? 'collecting' : 'live',
    };
    return room?.gameData || {};
};

const normalizePhase = (room = {}, modeId = '', state = {}) => {
    const activeMode = text(room?.activeMode).toLowerCase();
    if (activeMode.endsWith('_reveal')) return 'reveal';
    const raw = text(state?.status || state?.phase || state?.state).toLowerCase();
    if (['ended', 'complete', 'completed', 'winner', 'results', 'result'].includes(raw)) return 'resolved';
    if (['reveal', 'revealing'].includes(raw)) return 'reveal';
    if (['voting', 'vote'].includes(raw)) return 'voting';
    if (['asking', 'live', 'active', 'collecting', 'submission', 'submitting', 'playing', 'running'].includes(raw)) return 'collect';
    if (['setup', 'ready', 'staged', 'waiting', 'countdown'].includes(raw)) return 'ready';
    if (modeId === 'bingo') return room?.bingoWin ? 'resolved' : 'collect';
    return 'collect';
};

const actionFor = (modeId, phase) => {
    if (phase === 'resolved') return 'See the result and get ready for what comes next.';
    if (phase === 'reveal') return 'Watch the main screen for the answer or winner.';
    if (modeId === 'trivia_pop') return 'Choose A, B, C, or D on your phone.';
    if (modeId === 'wyr') return 'Pick one side on your phone.';
    if (modeId === 'bingo') return 'Mark matching moments and send confirmations from your phone.';
    if (modeId === 'doodle_oke') return phase === 'voting' ? 'Vote for one approved drawing.' : 'Draw or guess before time runs out.';
    if (modeId === 'selfie_challenge') return phase === 'voting' ? 'Vote for one approved selfie.' : 'Submit your selfie for this prompt.';
    if (modeId === 'karaoke_bracket') return 'Follow the active match, then perform or vote when prompted.';
    if (['flappy_bird', 'vocal_challenge', 'riding_scales', 'team_pong', 'musical_moments', 'volley_orb'].includes(modeId)) return 'Follow the main-screen cues and use the assigned mic or phone control.';
    return 'Follow the prompt on your phone.';
};

export const getGameLifecyclePresentation = (room = {}) => {
    const lifecycleSlots = resolveGameLifecycleSlots(room);
    const modeId = lifecycleSlots.primaryMode;
    const contract = getGameLifecycleContract(modeId);
    if (!contract) return { visible: false, modeId: '', slot: '', lifecycleSlots };
    const slot = lifecycleSlots.takeoverMode === modeId
        ? 'takeover'
        : lifecycleSlots.performanceCompanionModes.includes(modeId)
            ? 'performance_companion'
            : lifecycleSlots.allNightCompanionModes.includes(modeId)
                ? 'all_night_companion'
                : 'room_moment';
    const state = resolveModeState(room, modeId);
    const phase = normalizePhase(room, modeId, state);
    const phaseLabel = {
        ready: 'Get ready', collect: 'Your turn', voting: 'Vote now', reveal: 'Reveal', resolved: 'Result',
    }[phase] || 'Live';
    const revealOwner = phase === 'reveal' || phase === 'resolved'
        ? 'Main screen shows the official result.'
        : state?.autoReveal === true
            ? 'The result reveals automatically.'
            : 'The host controls the reveal.';
    const nextStep = phase === 'resolved'
        ? 'The host returns the room to karaoke or launches the next planned moment.'
        : phase === 'reveal'
            ? 'The result locks, then the host advances the room.'
            : 'Submit before the phase closes; the reveal follows.';
    return {
        visible: true,
        modeId,
        slot,
        lifecycleSlots,
        lifecycleLabel: getGameLifecycleLabel(modeId),
        phase,
        phaseLabel,
        audienceAction: actionFor(modeId, phase),
        revealOwner,
        nextStep,
    };
};
