import { GAME_LIFECYCLE_KINDS, getGameLifecycleContract } from './gameLifecycle';

export const HOST_GAME_MOMENT_BUNDLE_IDS = Object.freeze({
    betweenSongs: 'between_songs',
    alongsideKaraoke: 'alongside_karaoke',
    fullScreenRounds: 'full_screen_rounds',
});

export const HOST_GAME_MOMENT_BUNDLES = Object.freeze([
    Object.freeze({
        id: HOST_GAME_MOMENT_BUNDLE_IDS.betweenSongs,
        label: 'Between songs',
        shortLabel: 'Between songs',
        description: 'Fast crowd resets that take over the screens between performances.',
        hostCue: 'Use when you need a quick energy change before the next singer.',
        icon: 'fa-forward-step',
        lifecycleKinds: Object.freeze([GAME_LIFECYCLE_KINDS.betweenSong]),
    }),
    Object.freeze({
        id: HOST_GAME_MOMENT_BUNDLE_IDS.alongsideKaraoke,
        label: 'Alongside karaoke',
        shortLabel: 'Alongside karaoke',
        description: 'Companions that stay active while performances continue.',
        hostCue: 'Set once, then let the audience participate without stopping the show.',
        icon: 'fa-layer-group',
        lifecycleKinds: Object.freeze([
            GAME_LIFECYCLE_KINDS.performanceCompanion,
            GAME_LIFECYCLE_KINDS.allNightCompanion,
        ]),
    }),
    Object.freeze({
        id: HOST_GAME_MOMENT_BUNDLE_IDS.fullScreenRounds,
        label: 'Full-screen rounds',
        shortLabel: 'Full-screen',
        description: 'Feature games that own the room and need a deliberate start and finish.',
        hostCue: 'Use when the game is the main event for several minutes.',
        icon: 'fa-expand',
        lifecycleKinds: Object.freeze([GAME_LIFECYCLE_KINDS.standalone]),
    }),
]);

const BUNDLE_BY_ID = new Map(HOST_GAME_MOMENT_BUNDLES.map((bundle) => [bundle.id, bundle]));

const MODE_BUNDLE_OVERRIDES = Object.freeze({
    applause_countdown: HOST_GAME_MOMENT_BUNDLE_IDS.betweenSongs,
});

export const getHostGameMomentBundle = (bundleId = '') => (
    BUNDLE_BY_ID.get(String(bundleId || '').trim().toLowerCase())
    || HOST_GAME_MOMENT_BUNDLES[0]
);

export const getHostGameMomentBundleId = (modeId = '') => {
    const normalizedModeId = String(modeId || '').trim().toLowerCase();
    if (MODE_BUNDLE_OVERRIDES[normalizedModeId]) return MODE_BUNDLE_OVERRIDES[normalizedModeId];
    const lifecycle = getGameLifecycleContract(normalizedModeId);
    if (!lifecycle) return '';
    return HOST_GAME_MOMENT_BUNDLES.find((bundle) => bundle.lifecycleKinds.includes(lifecycle.kind))?.id || '';
};

export const filterGamesForHostMomentBundle = (games = [], bundleId = '') => {
    const selectedBundle = getHostGameMomentBundle(bundleId);
    return (Array.isArray(games) ? games : []).filter((game) => (
        getHostGameMomentBundleId(game?.id) === selectedBundle.id
    ));
};

export const summarizeHostGameMomentBundles = (games = []) => HOST_GAME_MOMENT_BUNDLES.map((bundle) => ({
    ...bundle,
    modeCount: filterGamesForHostMomentBundle(games, bundle.id).length,
}));
