export const shouldShowStreamlinedIdleRequestCard = ({
    tab = 'home',
    noSingerOnStage = false,
    lobbyVolleySceneActive = false,
    isStreamlinedAudienceShell = false,
} = {}) => (
    tab === 'home'
    && !!noSingerOnStage
    && !lobbyVolleySceneActive
    && !!isStreamlinedAudienceShell
);
