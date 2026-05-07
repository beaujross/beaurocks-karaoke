import {
    normalizeAudienceBrandTheme,
    withAudienceBrandAlpha,
} from '../../../lib/audienceBrandTheme';

export const buildHostRuntimeShellTheme = (room = null) => {
    const roomTheme = room?.audienceBrandTheme && typeof room.audienceBrandTheme === 'object'
        ? room.audienceBrandTheme
        : {};
    const theme = normalizeAudienceBrandTheme({
        ...roomTheme,
        appTitle: roomTheme?.appTitle || 'BeauRocks Karaoke',
    });
    return {
        theme,
        shellStyle: {
            borderColor: withAudienceBrandAlpha(theme.secondaryColor, 0.22),
            backgroundImage: [
                `radial-gradient(circle at top right, ${withAudienceBrandAlpha(theme.secondaryColor, 0.2)} 0%, transparent 28%)`,
                `radial-gradient(circle at top left, ${withAudienceBrandAlpha(theme.primaryColor, 0.14)} 0%, transparent 34%)`,
                `linear-gradient(145deg, ${withAudienceBrandAlpha(theme.accentColor, 0.24)} 0%, rgba(17,12,21,0.98) 30%, rgba(9,15,25,0.96) 100%)`,
            ].join(', '),
            boxShadow: `0 24px 70px ${withAudienceBrandAlpha(theme.primaryColor, 0.18)}`,
        },
        panelStyle: {
            borderColor: withAudienceBrandAlpha(theme.primaryColor, 0.18),
            backgroundColor: withAudienceBrandAlpha(theme.accentColor, 0.08),
            boxShadow: `0 18px 48px ${withAudienceBrandAlpha(theme.primaryColor, 0.1)}`,
        },
        primaryCardStyle: {
            borderColor: withAudienceBrandAlpha(theme.secondaryColor, 0.22),
            backgroundColor: withAudienceBrandAlpha(theme.secondaryColor, 0.08),
        },
        secondaryCardStyle: {
            borderColor: withAudienceBrandAlpha(theme.primaryColor, 0.22),
            backgroundColor: withAudienceBrandAlpha(theme.primaryColor, 0.08),
        },
        accentCardStyle: {
            borderColor: withAudienceBrandAlpha(theme.accentColor, 0.26),
            backgroundColor: withAudienceBrandAlpha(theme.accentColor, 0.1),
        },
        primaryChipStyle: {
            borderColor: withAudienceBrandAlpha(theme.primaryColor, 0.34),
            backgroundColor: withAudienceBrandAlpha(theme.primaryColor, 0.16),
            color: '#ECFEFF',
        },
        secondaryChipStyle: {
            borderColor: withAudienceBrandAlpha(theme.secondaryColor, 0.34),
            backgroundColor: withAudienceBrandAlpha(theme.secondaryColor, 0.16),
            color: '#FDF2F8',
        },
        accentChipStyle: {
            borderColor: withAudienceBrandAlpha(theme.accentColor, 0.34),
            backgroundColor: withAudienceBrandAlpha(theme.accentColor, 0.16),
            color: '#FEFCE8',
        },
        primaryGlowStyle: {
            boxShadow: `0 0 36px ${withAudienceBrandAlpha(theme.primaryColor, 0.16)}`,
        },
        secondaryGlowStyle: {
            boxShadow: `0 0 36px ${withAudienceBrandAlpha(theme.secondaryColor, 0.16)}`,
        },
    };
};

export default buildHostRuntimeShellTheme;
