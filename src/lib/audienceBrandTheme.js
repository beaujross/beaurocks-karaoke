const DEFAULT_PRIMARY_COLOR = '#00C4D9';
const DEFAULT_SECONDARY_COLOR = '#FF67B6';
const DEFAULT_ACCENT_COLOR = '#FACC15';

export const DEFAULT_AUDIENCE_BRAND_THEME = Object.freeze({
    appTitle: '',
    primaryColor: DEFAULT_PRIMARY_COLOR,
    secondaryColor: DEFAULT_SECONDARY_COLOR,
    accentColor: DEFAULT_ACCENT_COLOR,
});

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{6})$/i;

export const normalizeAudienceBrandColor = (value = '', fallback = DEFAULT_PRIMARY_COLOR) => {
    const fallbackMatch = String(fallback || '').trim().match(HEX_COLOR_PATTERN);
    const safeFallback = fallbackMatch ? `#${fallbackMatch[1].toUpperCase()}` : DEFAULT_PRIMARY_COLOR;
    const match = String(value || '').trim().match(HEX_COLOR_PATTERN);
    return match ? `#${match[1].toUpperCase()}` : safeFallback;
};

const AUDIENCE_BRAND_THEME_PRESET_DEFS = Object.freeze([
    {
        id: 'beaurocks',
        label: 'BeauRocks Default',
        description: 'Original BeauRocks karaoke neon.',
        primaryColor: DEFAULT_PRIMARY_COLOR,
        secondaryColor: DEFAULT_SECONDARY_COLOR,
        accentColor: DEFAULT_ACCENT_COLOR,
    },
    {
        id: 'festival_sunburst',
        label: 'Festival Sunburst',
        description: 'Warm headliner marquee colors.',
        primaryColor: '#E05A44',
        secondaryColor: '#F4C94A',
        accentColor: '#8F2D2A',
    },
    {
        id: 'evergreen_stage',
        label: 'Evergreen Stage',
        description: 'Fresh outdoor festival greens.',
        primaryColor: '#0EA5A4',
        secondaryColor: '#A3E635',
        accentColor: '#FACC15',
    },
    {
        id: 'sunset_lights',
        label: 'Sunset Lights',
        description: 'Golden-hour oranges with a pink punch.',
        primaryColor: '#F97316',
        secondaryColor: '#FB7185',
        accentColor: '#FDBA74',
    },
    {
        id: 'night_market',
        label: 'Night Market',
        description: 'Electric blue and magenta after-dark mix.',
        primaryColor: '#38BDF8',
        secondaryColor: '#FB7185',
        accentColor: '#A78BFA',
    },
]);

export const AUDIENCE_BRAND_THEME_PRESETS = Object.freeze(
    AUDIENCE_BRAND_THEME_PRESET_DEFS.map((preset) => Object.freeze({
        id: String(preset.id || '').trim().toLowerCase(),
        label: String(preset.label || '').trim() || 'Theme',
        description: String(preset.description || '').trim(),
        primaryColor: normalizeAudienceBrandColor(preset.primaryColor, DEFAULT_PRIMARY_COLOR),
        secondaryColor: normalizeAudienceBrandColor(preset.secondaryColor, DEFAULT_SECONDARY_COLOR),
        accentColor: normalizeAudienceBrandColor(preset.accentColor, DEFAULT_ACCENT_COLOR),
    }))
);

const AUDIENCE_BRAND_THEME_PRESET_MAP = new Map(
    AUDIENCE_BRAND_THEME_PRESETS.map((preset) => [preset.id, preset])
);

export const normalizeAudienceBrandTheme = (value = null) => {
    const source = value && typeof value === 'object' ? value : {};
    return {
        appTitle: String(source.appTitle || '').trim().slice(0, 48),
        primaryColor: normalizeAudienceBrandColor(source.primaryColor, DEFAULT_PRIMARY_COLOR),
        secondaryColor: normalizeAudienceBrandColor(source.secondaryColor, DEFAULT_SECONDARY_COLOR),
        accentColor: normalizeAudienceBrandColor(source.accentColor, DEFAULT_ACCENT_COLOR),
    };
};

export const getAudienceBrandThemePreset = (presetId = 'beaurocks', overrides = null) => {
    const safePresetId = String(presetId || '').trim().toLowerCase();
    const preset = AUDIENCE_BRAND_THEME_PRESET_MAP.get(safePresetId)
        || AUDIENCE_BRAND_THEME_PRESET_MAP.get('beaurocks')
        || AUDIENCE_BRAND_THEME_PRESETS[0]
        || DEFAULT_AUDIENCE_BRAND_THEME;
    const source = overrides && typeof overrides === 'object' ? overrides : {};
    return normalizeAudienceBrandTheme({
        appTitle: source.appTitle,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        accentColor: preset.accentColor,
    });
};

export const matchAudienceBrandThemePreset = (value = null) => {
    const theme = normalizeAudienceBrandTheme(value);
    return AUDIENCE_BRAND_THEME_PRESETS.find((preset) => (
        preset.primaryColor === theme.primaryColor
        && preset.secondaryColor === theme.secondaryColor
        && preset.accentColor === theme.accentColor
    )) || null;
};

const hexToRgb = (value = '') => {
    const normalized = normalizeAudienceBrandColor(value, DEFAULT_PRIMARY_COLOR).slice(1);
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
};

const hexToRgbChannels = (value = '') => {
    const { r, g, b } = hexToRgb(value);
    return `${r}, ${g}, ${b}`;
};

export const withAudienceBrandAlpha = (value = '', alpha = 1) => {
    const { r, g, b } = hexToRgb(value);
    const safeAlpha = Math.max(0, Math.min(1, Number(alpha ?? 1)));
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

export const buildAudienceBrandThemePalette = (value = null) => {
    const theme = normalizeAudienceBrandTheme(value);
    return {
        theme,
        rootStyle: {
            '--audience-brand-primary': theme.primaryColor,
            '--audience-brand-secondary': theme.secondaryColor,
            '--audience-brand-accent': theme.accentColor,
            '--audience-brand-primary-rgb': hexToRgbChannels(theme.primaryColor),
            '--audience-brand-secondary-rgb': hexToRgbChannels(theme.secondaryColor),
            '--audience-brand-accent-rgb': hexToRgbChannels(theme.accentColor),
            backgroundColor: '#090612',
            backgroundImage: [
                `radial-gradient(circle at top center, ${withAudienceBrandAlpha(theme.secondaryColor, 0.2)} 0%, transparent 34%)`,
                `radial-gradient(circle at 18% 14%, ${withAudienceBrandAlpha(theme.primaryColor, 0.18)} 0%, transparent 38%)`,
                `linear-gradient(180deg, ${withAudienceBrandAlpha(theme.primaryColor, 0.1)} 0%, rgba(9,6,18,0) 24%)`,
                'linear-gradient(180deg, #090612 0%, #05030a 100%)',
            ].join(', '),
        },
        headerStyle: {
            backgroundImage: `linear-gradient(90deg, ${withAudienceBrandAlpha(theme.secondaryColor, 0.52)} 0%, ${withAudienceBrandAlpha(theme.primaryColor, 0.95)} 50%, ${withAudienceBrandAlpha(theme.secondaryColor, 0.52)} 100%)`,
            boxShadow: `0 18px 48px ${withAudienceBrandAlpha(theme.primaryColor, 0.28)}`,
        },
        stageShellStyle: {
            borderBottomColor: withAudienceBrandAlpha(theme.primaryColor, 0.42),
            boxShadow: `inset 0 -1px 0 ${withAudienceBrandAlpha(theme.primaryColor, 0.14)}`,
        },
        primaryPillStyle: {
            borderColor: withAudienceBrandAlpha(theme.primaryColor, 0.46),
            backgroundColor: withAudienceBrandAlpha(theme.primaryColor, 0.18),
            color: '#ECFEFF',
            boxShadow: `0 0 22px ${withAudienceBrandAlpha(theme.primaryColor, 0.16)}`,
        },
        secondaryPillStyle: {
            borderColor: withAudienceBrandAlpha(theme.secondaryColor, 0.44),
            backgroundColor: withAudienceBrandAlpha(theme.secondaryColor, 0.18),
            color: '#FDF2F8',
            boxShadow: `0 0 20px ${withAudienceBrandAlpha(theme.secondaryColor, 0.14)}`,
        },
        accentPillStyle: {
            borderColor: withAudienceBrandAlpha(theme.accentColor, 0.5),
            backgroundColor: withAudienceBrandAlpha(theme.accentColor, 0.18),
            color: '#FEFCE8',
            boxShadow: `0 0 18px ${withAudienceBrandAlpha(theme.accentColor, 0.14)}`,
        },
        ringStyle: {
            boxShadow: `0 0 0 1px ${withAudienceBrandAlpha(theme.primaryColor, 0.16)}, 0 0 30px ${withAudienceBrandAlpha(theme.primaryColor, 0.14)}`,
        },
    };
};
