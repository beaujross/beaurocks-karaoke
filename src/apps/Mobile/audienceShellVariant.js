export const AUDIENCE_SHELL_VARIANTS = Object.freeze({
    classic: 'classic',
    streamlined: 'streamlined'
});

export const STREAMLINED_TAKEOVER_LIGHT_MODES = new Set([
    'ballad',
    'banger',
    'guitar',
    'storm',
    'strobe'
]);

export const normalizeAudienceShellVariant = (value = '') => {
    const token = String(value || '').trim().toLowerCase();
    return token === AUDIENCE_SHELL_VARIANTS.streamlined
        ? AUDIENCE_SHELL_VARIANTS.streamlined
        : AUDIENCE_SHELL_VARIANTS.classic;
};

export const deriveAudienceTakeoverKind = ({ activeMode = '', lightMode = '' } = {}) => {
    const normalizedActiveMode = String(activeMode || '').trim().toLowerCase();
    if (normalizedActiveMode && normalizedActiveMode !== 'karaoke') {
        return `active:${normalizedActiveMode}`;
    }

    const normalizedLightMode = String(lightMode || '').trim().toLowerCase();
    if (STREAMLINED_TAKEOVER_LIGHT_MODES.has(normalizedLightMode)) {
        return `light:${normalizedLightMode}`;
    }

    return '';
};

export const getAudienceTakeoverLabel = (takeoverKind = '') => {
    const raw = String(takeoverKind || '').trim().toLowerCase();
    if (!raw) return 'Live Mode';
    const [, value = ''] = raw.split(':');
    if (!value) return 'Live Mode';
    return value
        .split('_')
        .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : '')
        .filter(Boolean)
        .join(' ');
};

