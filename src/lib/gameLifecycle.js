export const GAME_LIFECYCLE_KINDS = Object.freeze({
    standalone: 'standalone',
    betweenSong: 'between_song',
    performanceCompanion: 'performance_companion',
    allNightCompanion: 'all_night_companion',
});

export const GAME_LIFECYCLE_STAGES = Object.freeze([
    'configure', 'launch', 'collect', 'reveal', 'resolve', 'recap',
]);

const contract = (kind, overrides = {}) => Object.freeze({
    kind,
    hostLaunch: true,
    audienceAction: true,
    tvReveal: true,
    scoring: true,
    recap: false,
    moderation: false,
    requiresPerformance: false,
    exclusiveTakeover: kind !== GAME_LIFECYCLE_KINDS.performanceCompanion && kind !== GAME_LIFECYCLE_KINDS.allNightCompanion,
    ...overrides,
});

export const GAME_LIFECYCLE_CONTRACTS = Object.freeze({
    trivia_pop: contract(GAME_LIFECYCLE_KINDS.betweenSong, { recap: true, sharedStateFamily: 'prompt_vote' }),
    wyr: contract(GAME_LIFECYCLE_KINDS.betweenSong, { recap: true, sharedStateFamily: 'prompt_vote' }),
    pop_trivia_companion: contract(GAME_LIFECYCLE_KINDS.performanceCompanion, { requiresPerformance: true, sharedStateFamily: 'pop_trivia' }),
    bingo: contract(GAME_LIFECYCLE_KINDS.allNightCompanion, { recap: true, moderation: true }),
    doodle_oke: contract(GAME_LIFECYCLE_KINDS.betweenSong, { recap: true, moderation: true }),
    selfie_challenge: contract(GAME_LIFECYCLE_KINDS.betweenSong, { recap: true, moderation: true }),
    karaoke_bracket: contract(GAME_LIFECYCLE_KINDS.standalone, { recap: true, requiresPerformance: true }),
    flappy_bird: contract(GAME_LIFECYCLE_KINDS.standalone),
    vocal_challenge: contract(GAME_LIFECYCLE_KINDS.standalone),
    riding_scales: contract(GAME_LIFECYCLE_KINDS.standalone),
    team_pong: contract(GAME_LIFECYCLE_KINDS.betweenSong),
    musical_moments: contract(GAME_LIFECYCLE_KINDS.betweenSong),
    volley_orb: contract(GAME_LIFECYCLE_KINDS.betweenSong),
});

export const getGameLifecycleContract = (modeId = '') => GAME_LIFECYCLE_CONTRACTS[String(modeId || '').trim().toLowerCase()] || null;

export const auditGameLifecycleCoverage = (gameIds = []) => {
    const ids = [...new Set((Array.isArray(gameIds) ? gameIds : []).map((id) => String(id || '').trim().toLowerCase()).filter(Boolean))];
    return {
        covered: ids.filter((id) => !!getGameLifecycleContract(id)),
        missing: ids.filter((id) => !getGameLifecycleContract(id)),
    };
};

export const getGameCollisionRisks = ({ activeModes = [], performanceActive = false } = {}) => {
    const modes = [...new Set((Array.isArray(activeModes) ? activeModes : []).map((id) => String(id || '').trim().toLowerCase()).filter(Boolean))];
    const contracts = modes.map((id) => ({ id, contract: getGameLifecycleContract(id) })).filter((entry) => entry.contract);
    const risks = [];
    const takeovers = contracts.filter((entry) => entry.contract.exclusiveTakeover);
    if (takeovers.length > 1) risks.push({ code: 'multiple_takeovers', modes: takeovers.map((entry) => entry.id) });
    const orphanedCompanions = contracts.filter((entry) => entry.contract.requiresPerformance && entry.contract.kind === GAME_LIFECYCLE_KINDS.performanceCompanion && !performanceActive);
    if (orphanedCompanions.length) risks.push({ code: 'companion_without_performance', modes: orphanedCompanions.map((entry) => entry.id) });
    const promptVoteModes = contracts.filter((entry) => entry.contract.sharedStateFamily === 'prompt_vote');
    if (promptVoteModes.length > 1) risks.push({ code: 'shared_prompt_vote_collision', modes: promptVoteModes.map((entry) => entry.id) });
    return risks;
};
