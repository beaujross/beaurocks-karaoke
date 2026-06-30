const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));
const isBrowserAudioAvailable = () => typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);

const AUDIO_CONTEXTS = new Map();
const ASSET_AUDIO_CACHE = new Map();

export const VOICE_GAME_SOUND_PACK_SCHEMA_VERSION = 1;

export const VOICE_GAME_SOUND_PACK_MANIFEST_TEMPLATE = Object.freeze({
    schemaVersion: VOICE_GAME_SOUND_PACK_SCHEMA_VERSION,
    id: 'voice-games-produced-v1',
    label: 'Voice Games Produced Pack',
    basePath: '/audio/voice-games',
    assetsAvailable: false,
    modes: Object.freeze({})
});

export const VOICE_GAME_ROOM_TUNING_PRESETS = Object.freeze({
    forgiving_room: Object.freeze({
        id: 'forgiving_room',
        label: 'Forgiving Room',
        cueIntensity: 1.08,
        cueVolume: 0.92,
        guideIntensity: 1.06,
        guideDurationMultiplier: 1.12,
        pitchWindowMultiplier: 1.18,
        confidenceFloorOffset: -0.035,
        staleInputGraceMs: 420,
        latencyOffsetMs: 0
    }),
    loud_room: Object.freeze({
        id: 'loud_room',
        label: 'Loud Room',
        cueIntensity: 1.16,
        cueVolume: 1,
        guideIntensity: 1.1,
        guideDurationMultiplier: 1.06,
        pitchWindowMultiplier: 1.28,
        confidenceFloorOffset: -0.055,
        staleInputGraceMs: 620,
        latencyOffsetMs: 80
    }),
    tight_stage: Object.freeze({
        id: 'tight_stage',
        label: 'Tight Stage',
        cueIntensity: 1,
        cueVolume: 0.88,
        guideIntensity: 1,
        guideDurationMultiplier: 1,
        pitchWindowMultiplier: 1,
        confidenceFloorOffset: 0,
        staleInputGraceMs: 260,
        latencyOffsetMs: 0
    })
});
export const VOICE_GAME_SOUND_CUE_LIBRARY = Object.freeze({
    pitch_runner: Object.freeze({
        higher: Object.freeze({ family: 'motion', label: 'Sing Higher', assetNames: ['pitch-runner-higher.webm', 'pitch-runner-higher.mp3'], layers: [[392, 0.22, 0, 0.028, 'sine', 587], [784, 0.26, 0.07, 0.018, 'triangle', 988]], delay: 0.13, feedback: 0.18, noise: 0.012 }),
        lower: Object.freeze({ family: 'motion', label: 'Sing Lower', assetNames: ['pitch-runner-lower.webm', 'pitch-runner-lower.mp3'], layers: [[587, 0.22, 0, 0.026, 'sine', 392], [294, 0.3, 0.07, 0.019, 'triangle', 196]], delay: 0.14, feedback: 0.16, noise: 0.01 }),
        hold: Object.freeze({ family: 'stability', label: 'Hold Steady', assetNames: ['pitch-runner-hold.webm', 'pitch-runner-hold.mp3'], layers: [[494, 0.5, 0, 0.022, 'sine'], [988, 0.42, 0.02, 0.01, 'sine']], delay: 0.2, feedback: 0.2 }),
        shield: Object.freeze({ family: 'rescue', label: 'Shield Run', assetNames: ['pitch-runner-shield.webm', 'pitch-runner-shield.mp3'], layers: [[659, 0.58, 0, 0.03, 'triangle'], [880, 0.62, 0.08, 0.024, 'sine'], [1318, 0.35, 0.17, 0.012, 'triangle']], delay: 0.19, feedback: 0.28, noise: 0.018 }),
        checkpoint: Object.freeze({ family: 'reward', label: 'Gate Checkpoint', assetNames: ['pitch-runner-checkpoint.webm', 'pitch-runner-checkpoint.mp3'], layers: [[523, 0.45, 0, 0.04, 'triangle'], [659, 0.5, 0.04, 0.034, 'triangle'], [784, 0.55, 0.08, 0.03, 'sine'], [1046, 0.32, 0.15, 0.015, 'sine']], delay: 0.16, feedback: 0.26, noise: 0.02 }),
        recovery: Object.freeze({ family: 'recovery', label: 'Recover Lane', assetNames: ['pitch-runner-recovery.webm', 'pitch-runner-recovery.mp3'], layers: [[220, 0.28, 0, 0.03, 'triangle', 330], [330, 0.36, 0.12, 0.024, 'sine', 440]], delay: 0.11, feedback: 0.14, noise: 0.014 })
    }),
    team_pong: Object.freeze({
        save: Object.freeze({ family: 'defense', label: 'Save', assetNames: ['team-pong-save.webm', 'team-pong-save.mp3'], layers: [[330, 0.22, 0, 0.036, 'triangle', 440], [660, 0.28, 0.07, 0.028, 'triangle']], delay: 0.1, feedback: 0.18, noise: 0.026 }),
        spike: Object.freeze({ family: 'attack', label: 'Spike', assetNames: ['team-pong-spike.webm', 'team-pong-spike.mp3'], layers: [[130, 0.16, 0, 0.045, 'sawtooth', 98], [523, 0.26, 0.02, 0.03, 'square', 1046], [1568, 0.18, 0.1, 0.018, 'triangle']], delay: 0.08, feedback: 0.16, noise: 0.05 }),
        shield: Object.freeze({ family: 'defense', label: 'Shield', assetNames: ['team-pong-shield.webm', 'team-pong-shield.mp3'], layers: [[392, 0.62, 0, 0.028, 'sine'], [523, 0.62, 0.05, 0.024, 'triangle'], [784, 0.42, 0.12, 0.016, 'sine']], delay: 0.18, feedback: 0.26, noise: 0.014 }),
        slowmo: Object.freeze({ family: 'time', label: 'Slow-Mo', assetNames: ['team-pong-slowmo.webm', 'team-pong-slowmo.mp3'], layers: [[294, 0.62, 0, 0.022, 'sawtooth', 196], [147, 0.7, 0.08, 0.018, 'sine', 110]], delay: 0.24, feedback: 0.3, noise: 0.012 }),
        redirect: Object.freeze({ family: 'counter', label: 'Redirect', assetNames: ['team-pong-redirect.webm', 'team-pong-redirect.mp3'], layers: [[880, 0.2, 0, 0.032, 'triangle', 659], [659, 0.22, 0.08, 0.03, 'triangle', 988], [988, 0.25, 0.16, 0.024, 'sine']], delay: 0.12, feedback: 0.2, noise: 0.02 }),
        charge: Object.freeze({ family: 'build', label: 'Charge', assetNames: ['team-pong-charge.webm', 'team-pong-charge.mp3'], layers: [[165, 0.55, 0, 0.018, 'sine', 220], [330, 0.55, 0.08, 0.016, 'sine', 392], [494, 0.44, 0.16, 0.012, 'triangle']], delay: 0.18, feedback: 0.24 }),
        danger: Object.freeze({ family: 'warning', label: 'Danger', assetNames: ['team-pong-danger.webm', 'team-pong-danger.mp3'], layers: [[196, 0.18, 0, 0.032, 'sawtooth'], [147, 0.2, 0.16, 0.026, 'sawtooth'], [98, 0.22, 0.32, 0.022, 'triangle']], delay: 0.07, feedback: 0.12, noise: 0.03 })
    }),
    vocal_challenge: Object.freeze({
        guide: Object.freeze({ family: 'guide', label: 'Target Ribbon', assetNames: ['vocal-challenge-guide.webm', 'vocal-challenge-guide.mp3'], layers: [[440, 0.42, 0, 0.026, 'sine'], [880, 0.34, 0.02, 0.01, 'sine']], delay: 0.16, feedback: 0.18 }),
        lock: Object.freeze({ family: 'reward', label: 'Ribbon Lock', assetNames: ['vocal-challenge-lock.webm', 'vocal-challenge-lock.mp3'], layers: [[523, 0.34, 0, 0.036, 'triangle'], [659, 0.38, 0.04, 0.028, 'sine'], [784, 0.34, 0.1, 0.018, 'triangle']], delay: 0.14, feedback: 0.22, noise: 0.012 }),
        close: Object.freeze({ family: 'near', label: 'Close Lane', assetNames: ['vocal-challenge-close.webm', 'vocal-challenge-close.mp3'], layers: [[392, 0.22, 0, 0.026, 'triangle'], [523, 0.24, 0.1, 0.02, 'sine']], delay: 0.12, feedback: 0.14 }),
        save: Object.freeze({ family: 'rescue', label: 'Crowd Save', assetNames: ['vocal-challenge-save.webm', 'vocal-challenge-save.mp3'], layers: [[330, 0.46, 0, 0.03, 'sine', 392], [494, 0.5, 0.05, 0.024, 'triangle', 659], [784, 0.28, 0.18, 0.012, 'sine']], delay: 0.18, feedback: 0.26, noise: 0.014 })
    }),
    riding_scales: Object.freeze({
        guide: Object.freeze({ family: 'guide', label: 'Scale Guide', assetNames: ['riding-scales-guide.webm', 'riding-scales-guide.mp3'], layers: [[440, 0.62, 0, 0.026, 'sine'], [660, 0.5, 0.04, 0.012, 'sine']], delay: 0.18, feedback: 0.22 }),
        breath: Object.freeze({ family: 'rest', label: 'Breath Window', assetNames: ['riding-scales-breath.webm', 'riding-scales-breath.mp3'], layers: [[330, 0.28, 0, 0.018, 'sine', 294], [220, 0.34, 0.08, 0.014, 'triangle']], delay: 0.2, feedback: 0.18, noise: 0.008 }),
        lock: Object.freeze({ family: 'reward', label: 'Note Lock', assetNames: ['riding-scales-lock.webm', 'riding-scales-lock.mp3'], layers: [[392, 0.34, 0, 0.03, 'triangle'], [523, 0.38, 0.06, 0.026, 'sine'], [659, 0.42, 0.12, 0.02, 'triangle']], delay: 0.16, feedback: 0.24 }),
        checkpoint: Object.freeze({ family: 'reward', label: 'Phrase Checkpoint', assetNames: ['riding-scales-checkpoint.webm', 'riding-scales-checkpoint.mp3'], layers: [[262, 0.46, 0, 0.034, 'sine'], [392, 0.5, 0.05, 0.03, 'triangle'], [523, 0.56, 0.1, 0.024, 'sine'], [784, 0.32, 0.2, 0.014, 'triangle']], delay: 0.18, feedback: 0.28, noise: 0.012 }),
        save: Object.freeze({ family: 'rescue', label: 'Scale Save', assetNames: ['riding-scales-save.webm', 'riding-scales-save.mp3'], layers: [[196, 0.44, 0, 0.026, 'sine', 262], [330, 0.48, 0.07, 0.022, 'triangle', 440]], delay: 0.2, feedback: 0.26 })
    }),    musical_moments: Object.freeze({
        nailed: Object.freeze({ family: 'reward', label: 'Nailed It', assetNames: ['musical-moments-nailed.webm', 'musical-moments-nailed.mp3'], layers: [[523, 0.5, 0, 0.052, 'triangle'], [659, 0.56, 0.04, 0.046, 'triangle'], [784, 0.62, 0.08, 0.04, 'sine'], [1046, 0.34, 0.16, 0.022, 'sine']], delay: 0.15, feedback: 0.24, noise: 0.025 }),
        lift: Object.freeze({ family: 'lift', label: 'Vocal Lift', assetNames: ['musical-moments-lift.webm', 'musical-moments-lift.mp3'], layers: [[196, 0.72, 0, 0.035, 'sine', 247], [294, 0.78, 0.02, 0.034, 'triangle', 392], [440, 0.8, 0.06, 0.028, 'sine', 587]], delay: 0.22, feedback: 0.22, noise: 0.012 }),
        close: Object.freeze({ family: 'near', label: 'Close Moment', assetNames: ['musical-moments-close.webm', 'musical-moments-close.mp3'], layers: [[392, 0.26, 0, 0.038, 'triangle'], [523, 0.3, 0.1, 0.034, 'triangle'], [659, 0.34, 0.2, 0.028, 'sine']], delay: 0.15, feedback: 0.16 }),
        early: Object.freeze({ family: 'timing', label: 'Too Early', assetNames: ['musical-moments-early.webm', 'musical-moments-early.mp3'], layers: [[440, 0.18, 0, 0.034, 'sawtooth', 330], [330, 0.2, 0.12, 0.026, 'triangle']], delay: 0.1, feedback: 0.12, noise: 0.018 }),
        late: Object.freeze({ family: 'timing', label: 'Too Late', assetNames: ['musical-moments-late.webm', 'musical-moments-late.mp3'], layers: [[330, 0.18, 0, 0.03, 'triangle', 440], [494, 0.2, 0.12, 0.028, 'triangle']], delay: 0.12, feedback: 0.13, noise: 0.014 }),
        countdown: Object.freeze({ family: 'countdown', label: 'Get Ready', assetNames: ['musical-moments-countdown.webm', 'musical-moments-countdown.mp3'], layers: [[220, 0.12, 0, 0.018, 'triangle'], [294, 0.12, 0.18, 0.02, 'triangle'], [392, 0.14, 0.36, 0.024, 'triangle']], delay: 0.09, feedback: 0.1 })
    }),
    vocal_rocket: Object.freeze({
        inflate: Object.freeze({ family: 'launch', label: 'Inflate Air', assetNames: ['vocal-rocket-ignition.webm', 'vocal-rocket-ignition.mp3'], layers: [[82, 0.86, 0, 0.028, 'sine', 110], [164, 0.78, 0.05, 0.018, 'triangle', 196]], delay: 0.26, feedback: 0.24, noise: 0.026 }),
        ignition: Object.freeze({ family: 'launch', label: 'Rumble Low', assetNames: ['vocal-rocket-ignition.webm', 'vocal-rocket-ignition.mp3'], layers: [[82, 0.86, 0, 0.028, 'sine', 110], [164, 0.78, 0.05, 0.018, 'triangle', 196]], delay: 0.26, feedback: 0.24, noise: 0.026 }),
        lift: Object.freeze({ family: 'launch', label: 'Lift Off', assetNames: ['vocal-rocket-lift.webm', 'vocal-rocket-lift.mp3'], layers: [[110, 0.72, 0, 0.028, 'sine', 220], [330, 0.74, 0.08, 0.022, 'triangle', 660], [990, 0.32, 0.24, 0.012, 'sine']], delay: 0.2, feedback: 0.28, noise: 0.032 }),
        climb: Object.freeze({ family: 'climb', label: 'Climb Higher', assetNames: ['vocal-rocket-climb.webm', 'vocal-rocket-climb.mp3'], layers: [[330, 0.44, 0, 0.024, 'triangle', 440], [440, 0.48, 0.08, 0.022, 'triangle', 660], [660, 0.52, 0.16, 0.018, 'sine', 880]], delay: 0.17, feedback: 0.22 }),
        orbit: Object.freeze({ family: 'sustain', label: 'Hold Orbit', assetNames: ['vocal-rocket-orbit.webm', 'vocal-rocket-orbit.mp3'], layers: [[392, 0.7, 0, 0.018, 'sine'], [587, 0.74, 0.03, 0.015, 'sine'], [880, 0.58, 0.11, 0.01, 'triangle']], delay: 0.24, feedback: 0.3 }),
        hit: Object.freeze({ family: 'lift', label: 'Orb Hit', assetNames: ['vocal-rocket-hit.webm', 'vocal-rocket-hit.mp3'], layers: [[220, 0.16, 0, 0.024, 'sine'], [330, 0.2, 0.04, 0.02, 'triangle'], [660, 0.18, 0.1, 0.012, 'sine']], delay: 0.12, feedback: 0.16, noise: 0.01 }),
        warning: Object.freeze({ family: 'warning', label: 'Stall Warning', assetNames: ['vocal-rocket-warning.webm', 'vocal-rocket-warning.mp3'], layers: [[174, 0.18, 0, 0.02, 'sawtooth'], [130, 0.22, 0.16, 0.016, 'triangle']], delay: 0.08, feedback: 0.12, noise: 0.018 }),
        reset: Object.freeze({ family: 'recovery', label: 'Rocket Reset', assetNames: ['vocal-rocket-reset.webm', 'vocal-rocket-reset.mp3'], layers: [[392, 0.16, 0, 0.018, 'triangle', 262], [196, 0.34, 0.1, 0.022, 'sine', 130]], delay: 0.16, feedback: 0.18, noise: 0.012 })
    })
});

const normalizeMode = (mode = '') => String(mode || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
const normalizeCue = (cue = '') => String(cue || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

export const getVoiceGameCueProfile = (mode = '', cue = '') => {
    const modeKey = normalizeMode(mode);
    const cueKey = normalizeCue(cue);
    const modeLibrary = VOICE_GAME_SOUND_CUE_LIBRARY[modeKey] || null;
    if (!modeLibrary) return null;
    return modeLibrary[cueKey] || modeLibrary.close || modeLibrary.hold || modeLibrary.save || Object.values(modeLibrary)[0] || null;
};

const normalizeCueAssetEntry = (entry = null, inheritedBasePath = '') => {
    if (!entry) return null;
    if (typeof entry === 'string') return { url: entry };
    if (Array.isArray(entry)) return normalizeCueAssetEntry(entry[0], inheritedBasePath);
    if (typeof entry !== 'object') return null;
    const rawUrl = entry.url || entry.assetUrl || entry.src || entry.path || '';
    if (!rawUrl) return null;
    const basePath = String(entry.basePath || inheritedBasePath || '').replace(/\/$/, '');
    const url = String(rawUrl).startsWith('/') || /^https?:\/\//i.test(String(rawUrl)) || !basePath
        ? String(rawUrl)
        : `${basePath}/${String(rawUrl).replace(/^\//, '')}`;
    return {
        url,
        volume: Number.isFinite(Number(entry.volume)) ? Number(entry.volume) : undefined,
        playbackRate: Number.isFinite(Number(entry.playbackRate)) ? Number(entry.playbackRate) : undefined,
        trimStartSec: Number.isFinite(Number(entry.trimStartSec)) ? Number(entry.trimStartSec) : 0,
        label: String(entry.label || '').trim()
    };
};

export const normalizeVoiceGameSoundPack = (soundPack = null) => {
    if (!soundPack || typeof soundPack !== 'object') return null;
    const basePath = String(soundPack.basePath || soundPack.baseUrl || '').trim();
    const modes = soundPack.modes && typeof soundPack.modes === 'object' ? soundPack.modes : soundPack;
    const normalizedModes = {};
    Object.entries(modes || {}).forEach(([rawMode, modeValue]) => {
        if (['id', 'label', 'basePath', 'baseUrl', 'schemaVersion', 'assetsAvailable', 'modes', 'cues'].includes(rawMode)) return;
        const modeKey = normalizeMode(rawMode);
        const cues = modeValue?.cues && typeof modeValue.cues === 'object' ? modeValue.cues : modeValue;
        if (!modeKey || !cues || typeof cues !== 'object') return;
        normalizedModes[modeKey] = normalizedModes[modeKey] || {};
        Object.entries(cues).forEach(([rawCue, cueValue]) => {
            const cueKey = normalizeCue(rawCue);
            const entry = normalizeCueAssetEntry(cueValue, modeValue?.basePath || basePath);
            if (cueKey && entry?.url) normalizedModes[modeKey][cueKey] = entry;
        });
    });
    Object.entries(soundPack.cues || {}).forEach(([rawKey, cueValue]) => {
        const [rawMode, rawCue] = String(rawKey).includes('.') ? String(rawKey).split('.') : ['', rawKey];
        const modeKey = normalizeMode(rawMode);
        const cueKey = normalizeCue(rawCue);
        const entry = normalizeCueAssetEntry(cueValue, basePath);
        if (modeKey && cueKey && entry?.url) {
            normalizedModes[modeKey] = normalizedModes[modeKey] || {};
            normalizedModes[modeKey][cueKey] = entry;
        }
    });
    return {
        id: String(soundPack.id || 'custom').trim() || 'custom',
        label: String(soundPack.label || soundPack.name || 'Custom Voice Game Sound Pack').trim(),
        schemaVersion: Number(soundPack.schemaVersion || VOICE_GAME_SOUND_PACK_SCHEMA_VERSION) || VOICE_GAME_SOUND_PACK_SCHEMA_VERSION,
        basePath,
        assetsAvailable: soundPack.assetsAvailable !== false,
        modes: normalizedModes
    };
};

export const getVoiceGameCueAssetCandidates = ({ mode = '', cue = '', soundPack = null, basePath = '/audio/voice-games' } = {}) => {
    const modeKey = normalizeMode(mode);
    const cueKey = normalizeCue(cue);
    const normalizedPack = normalizeVoiceGameSoundPack(soundPack);
    const explicit = normalizedPack?.modes?.[modeKey]?.[cueKey] || null;
    if (normalizedPack?.assetsAvailable === false) return [];
    if (explicit?.url) return [explicit];
    const profile = getVoiceGameCueProfile(modeKey, cueKey);
    const safeBasePath = String(basePath || normalizedPack?.basePath || '/audio/voice-games').replace(/\/$/, '');
    return (profile?.assetNames || []).map((assetName) => ({
        url: `${safeBasePath}/${modeKey}/${assetName}`,
        label: profile.label || cueKey
    }));
};

export const resolveVoiceGameSoundAsset = ({ mode = '', cue = '', soundPack = null, basePath = '/audio/voice-games' } = {}) => {
    const [candidate] = getVoiceGameCueAssetCandidates({ mode, cue, soundPack, basePath });
    return candidate?.url || '';
};

export const listVoiceGameSoundPackCueSlots = () => Object.entries(VOICE_GAME_SOUND_CUE_LIBRARY).flatMap(([mode, cues]) => (
    Object.entries(cues).map(([cue, profile]) => ({
        mode,
        cue,
        family: profile.family,
        label: profile.label,
        assetNames: [...(profile.assetNames || [])]
    }))
));
export const buildVoiceGameSoundPackManifest = ({
    id = 'voice-games-produced-v1',
    label = 'Voice Games Produced Pack',
    basePath = '/audio/voice-games',
    assetsAvailable = false
} = {}) => ({
    schemaVersion: VOICE_GAME_SOUND_PACK_SCHEMA_VERSION,
    id,
    label,
    basePath,
    assetsAvailable,
    modes: Object.fromEntries(Object.entries(VOICE_GAME_SOUND_CUE_LIBRARY).map(([mode, cues]) => [
        mode,
        {
            cues: Object.fromEntries(Object.entries(cues).map(([cue, profile]) => [
                cue,
                {
                    label: profile.label,
                    family: profile.family,
                    assets: [...(profile.assetNames || [])]
                }
            ]))
        }
    ]))
});

const getAudioContext = (modeKey) => {
    if (!isBrowserAudioAvailable()) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AUDIO_CONTEXTS.has(modeKey)) AUDIO_CONTEXTS.set(modeKey, new AudioCtx());
    return AUDIO_CONTEXTS.get(modeKey);
};

const tryPlayAssetCue = (assetUrl, { volume = 0.62, playbackRate = 1 } = {}) => {
    if (typeof window === 'undefined' || !assetUrl) return false;
    try {
        const cacheKey = String(assetUrl);
        const audio = ASSET_AUDIO_CACHE.get(cacheKey) || new Audio(assetUrl);
        ASSET_AUDIO_CACHE.set(cacheKey, audio);
        const player = audio.cloneNode ? audio.cloneNode(true) : audio;
        player.volume = clamp(volume, 0, 1);
        player.playbackRate = clamp(playbackRate, 0.5, 1.8);
        const result = player.play();
        if (result?.catch) result.catch(() => {});
        return true;
    } catch {
        return false;
    }
};

export const normalizeVoiceGameRoomTuning = (tuning = 'forgiving_room') => {
    const preset = typeof tuning === 'string'
        ? VOICE_GAME_ROOM_TUNING_PRESETS[normalizeCue(tuning)]
        : null;
    const source = preset || (tuning && typeof tuning === 'object' ? tuning : VOICE_GAME_ROOM_TUNING_PRESETS.forgiving_room);
    return {
        id: String(source.id || 'custom').trim() || 'custom',
        label: String(source.label || 'Custom Room').trim(),
        cueIntensity: clamp(source.cueIntensity ?? 1, 0.4, 2.4),
        cueVolume: clamp(source.cueVolume ?? 0.9, 0, 1.4),
        guideIntensity: clamp(source.guideIntensity ?? 1, 0.4, 2.2),
        guideDurationMultiplier: clamp(source.guideDurationMultiplier ?? 1, 0.65, 1.8),
        pitchWindowMultiplier: clamp(source.pitchWindowMultiplier ?? 1, 0.75, 1.8),
        confidenceFloorOffset: clamp(source.confidenceFloorOffset ?? 0, -0.18, 0.18),
        staleInputGraceMs: clamp(source.staleInputGraceMs ?? 300, 0, 2000),
        latencyOffsetMs: clamp(source.latencyOffsetMs ?? 0, -1200, 1200)
    };
};

export const getVoiceGameRoomTuning = (tuning = 'forgiving_room') => normalizeVoiceGameRoomTuning(tuning);

export const applyVoiceGameRoomTuning = (base = {}, tuning = 'forgiving_room') => {
    const roomTuning = normalizeVoiceGameRoomTuning(tuning);
    return {
        ...base,
        tuning: roomTuning,
        intensity: clamp((base.intensity ?? 1) * roomTuning.cueIntensity, 0.3, 2.6),
        volume: clamp((base.volume ?? 0.9) * roomTuning.cueVolume, 0, 1.4),
        assetVolume: clamp((base.assetVolume ?? base.volume ?? 0.64) * roomTuning.cueVolume, 0, 1)
    };
};
const scheduleNoiseBurst = (ctx, destination, { at = 0, duration = 0.18, gain = 0.02, frequency = 2600 } = {}) => {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
        const fade = 1 - (i / length);
        data[i] = (Math.random() * 2 - 1) * fade;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(frequency, at);
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.linearRampToValueAtTime(gain, at + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(destination);
    source.start(at);
    source.stop(at + duration + 0.02);
};

export const playVoiceGameCue = (mode = '', cue = '', options = {}) => {
    const modeKey = normalizeMode(mode);
    const cueKey = normalizeCue(cue);
    const profile = getVoiceGameCueProfile(modeKey, cueKey);
    if (!profile) return false;
    const tunedOptions = applyVoiceGameRoomTuning(options, options.voiceRoomTuning || options.tuning || 'forgiving_room');
    const cueAsset = options.assetUrl
        ? { url: options.assetUrl, volume: options.assetVolume, playbackRate: options.playbackRate }
        : (options.soundPack ? getVoiceGameCueAssetCandidates({ mode: modeKey, cue: cueKey, soundPack: options.soundPack, basePath: options.basePath })[0] : null);
    if (cueAsset?.url && tryPlayAssetCue(cueAsset.url, {
        volume: cueAsset.volume ?? tunedOptions.assetVolume ?? tunedOptions.volume ?? 0.64,
        playbackRate: cueAsset.playbackRate ?? tunedOptions.playbackRate ?? 1
    })) {
        if (options.assetOnly) return true;
    }
    const ctx = getAudioContext(modeKey);
    if (!ctx) return false;
    try {
        if (ctx.state === 'suspended') ctx.resume();
        const intensity = clamp(tunedOptions.intensity || 1, 0.35, 2.6);
        const start = ctx.currentTime + clamp(tunedOptions.delaySec || 0, 0, 4);
        const master = ctx.createGain();
        const delay = ctx.createDelay(1.2);
        const feedback = ctx.createGain();
        const wet = ctx.createGain();
        master.gain.setValueAtTime(clamp(tunedOptions.volume ?? 0.9, 0, 1.4), start);
        delay.delayTime.setValueAtTime(clamp(profile.delay || 0.14, 0.03, 0.42), start);
        feedback.gain.setValueAtTime(clamp(profile.feedback || 0.18, 0, 0.5), start);
        wet.gain.setValueAtTime(0.09 * intensity, start);
        master.connect(ctx.destination);
        master.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        wet.connect(ctx.destination);
        (profile.layers || []).forEach(([freq, durationSec, offsetSec = 0, gainScale = 0.03, wave = 'triangle', endFreq = null]) => {
            const at = start + offsetSec;
            const osc = ctx.createOscillator();
            const amp = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            osc.type = wave;
            osc.frequency.setValueAtTime(Math.max(24, Number(freq || 220)), at);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(24, Number(endFreq)), at + Math.max(0.04, Number(durationSec || 0.2)));
            filter.type = profile.family === 'warning' ? 'bandpass' : 'lowpass';
            filter.frequency.setValueAtTime(profile.family === 'attack' ? 5200 : 4200, at);
            amp.gain.setValueAtTime(0.0001, at);
            amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(gainScale || 0.03) * intensity), at + 0.018);
            amp.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.08, Number(durationSec || 0.2)));
            osc.connect(filter);
            filter.connect(amp);
            amp.connect(master);
            osc.start(at);
            osc.stop(at + Math.max(0.1, Number(durationSec || 0.2)) + 0.08);
        });
        if (profile.noise) {
            scheduleNoiseBurst(ctx, master, { at: start, duration: 0.16 + (profile.noise * 2), gain: Number(profile.noise) * intensity, frequency: profile.family === 'attack' ? 1800 : 2800 });
        }
        window.setTimeout(() => {
            try {
                master.disconnect();
                delay.disconnect();
                feedback.disconnect();
                wet.disconnect();
            } catch {
                // Nodes may already be collected/disconnected by the browser.
            }
        }, 1600);
        return true;
    } catch {
        return false;
    }
};


export const playVoiceGameGuideTone = ({ mode = 'vocal_challenge', cue = 'guide', frequency = 440, durationSec = 0.7, intensity = 1, wave = 'sine', voiceRoomTuning = 'forgiving_room', tuning = null } = {}) => {
    const modeKey = normalizeMode(mode);
    const cueKey = normalizeCue(cue || 'guide');
    const profile = getVoiceGameCueProfile(modeKey, cueKey) || getVoiceGameCueProfile(modeKey, 'guide');
    const ctx = getAudioContext(modeKey);
    if (!ctx) return false;
    try {
        if (ctx.state === 'suspended') ctx.resume();
        const safeFrequency = Math.max(32, Number(frequency || 440));
        const roomTuning = normalizeVoiceGameRoomTuning(tuning || voiceRoomTuning);
        const safeDurationSec = clamp(durationSec * roomTuning.guideDurationMultiplier, 0.12, 2.8);
        const gainBoost = clamp(intensity * roomTuning.guideIntensity, 0.35, 2.2);
        const startAt = ctx.currentTime;
        const master = ctx.createGain();
        const delay = ctx.createDelay(1.4);
        const feedback = ctx.createGain();
        const wet = ctx.createGain();
        delay.delayTime.setValueAtTime(clamp(profile?.delay || 0.18, 0.04, 0.42), startAt);
        feedback.gain.setValueAtTime(clamp(profile?.feedback || 0.2, 0, 0.5), startAt);
        wet.gain.setValueAtTime(0.12 * gainBoost, startAt);
        master.connect(ctx.destination);
        master.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        wet.connect(ctx.destination);
        const layers = [
            [safeFrequency, safeDurationSec, 0, 0.052, wave],
            [safeFrequency * 2, Math.max(0.18, safeDurationSec * 0.68), 0.025, 0.015, 'sine']
        ];
        layers.forEach(([freq, layerDuration, offset, gainScale, type]) => {
            const at = startAt + offset;
            const osc = ctx.createOscillator();
            const amp = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(Math.max(32, freq), at);
            amp.gain.setValueAtTime(0.0001, at);
            amp.gain.linearRampToValueAtTime(Math.max(0.0002, gainScale * gainBoost), at + 0.035);
            amp.gain.setValueAtTime(Math.max(0.0002, gainScale * gainBoost), at + Math.max(0.04, layerDuration));
            amp.gain.exponentialRampToValueAtTime(0.0008, at + Math.max(0.08, layerDuration) + 0.5);
            osc.connect(amp);
            amp.connect(master);
            osc.start(at);
            osc.stop(at + Math.max(0.1, layerDuration) + 0.62);
        });
        window.setTimeout(() => {
            try {
                master.disconnect();
                delay.disconnect();
                feedback.disconnect();
                wet.disconnect();
            } catch {
                // Nodes may already be disconnected by the browser.
            }
        }, Math.ceil((safeDurationSec + 0.8) * 1000));
        return true;
    } catch {
        return false;
    }
};
export const buildWaveformLevelGeometry = (samples = [], options = {}) => {
    const source = Array.from(samples || []).map((value) => Number(value) || 0);
    const segmentCount = Math.max(4, Math.min(256, Math.round(Number(options.segmentCount || 48))));
    const minGateHeight = clamp(options.minGateHeight ?? 12, 0, 100);
    const maxGateHeight = clamp(options.maxGateHeight ?? 72, minGateHeight, 96);
    const smoothing = clamp(options.smoothing ?? 0.42, 0, 0.92);
    const length = source.length || 1;
    let previousEnergy = 0;
    return Array.from({ length: segmentCount }, (_, index) => {
        const start = Math.floor((index / segmentCount) * length);
        const end = Math.max(start + 1, Math.floor(((index + 1) / segmentCount) * length));
        let sum = 0;
        let peak = 0;
        let crossings = 0;
        let lastSign = 0;
        for (let i = start; i < end; i += 1) {
            const sample = source[i] || 0;
            const abs = Math.abs(sample);
            sum += abs * abs;
            peak = Math.max(peak, abs);
            const sign = sample >= 0 ? 1 : -1;
            if (lastSign && sign !== lastSign) crossings += 1;
            lastSign = sign;
        }
        const rms = Math.sqrt(sum / Math.max(1, end - start));
        const rawEnergy = clamp((rms * 0.74) + (peak * 0.26), 0, 1);
        const energy = (previousEnergy * smoothing) + (rawEnergy * (1 - smoothing));
        previousEnergy = energy;
        const gateHeight = Math.round(minGateHeight + ((maxGateHeight - minGateHeight) * energy));
        const centerY = Math.round(50 - ((energy - 0.5) * 42));
        return {
            index,
            startRatio: start / length,
            endRatio: end / length,
            energy: Number(energy.toFixed(4)),
            peak: Number(clamp(peak, 0, 1).toFixed(4)),
            density: Number(clamp(crossings / Math.max(1, end - start), 0, 1).toFixed(4)),
            gateHeight,
            centerY,
            topY: clamp(centerY - (gateHeight / 2), 2, 94),
            bottomY: clamp(centerY + (gateHeight / 2), 6, 98),
            command: energy > 0.72 ? 'HIT' : energy > 0.46 ? 'RIDE' : 'BREATHE'
        };
    });
};

export const buildAudioBufferLevelMap = (audioBuffer, options = {}) => {
    if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function') return [];
    const channel = clamp(options.channel || 0, 0, Math.max(0, Number(audioBuffer.numberOfChannels || 1) - 1));
    return buildWaveformLevelGeometry(audioBuffer.getChannelData(channel), options);
};

export const buildDynamicAudioScapePlan = ({ mode = '', cue = '', audioBuffer = null, samples = null, durationSec = 0, segmentCount = 48 } = {}) => {
    const geometry = audioBuffer
        ? buildAudioBufferLevelMap(audioBuffer, { segmentCount })
        : buildWaveformLevelGeometry(samples || [], { segmentCount });
    const profile = getVoiceGameCueProfile(mode, cue);
    const safeDurationSec = Math.max(1, Number(durationSec || audioBuffer?.duration || 12));
    return {
        mode: normalizeMode(mode),
        cue: normalizeCue(cue),
        family: profile?.family || 'dynamic',
        durationSec: safeDurationSec,
        segments: geometry.map((segment) => ({
            ...segment,
            atSec: Number((segment.startRatio * safeDurationSec).toFixed(3)),
            durationSec: Number(((segment.endRatio - segment.startRatio) * safeDurationSec).toFixed(3))
        })),
        peaks: geometry.filter((segment) => segment.energy >= 0.72).map((segment) => segment.index),
        breathWindows: geometry.filter((segment) => segment.energy <= 0.24).map((segment) => segment.index)
    };
};