export const MONEYBAGS_BADGE_LABEL = 'Moneybags';
export const AUDIENCE_ACCESS_MODES = Object.freeze({
    account: 'account',
    email: 'email',
    donation: 'donation',
    emailOrDonation: 'email_or_donation',
});
export const SUPPORT_CELEBRATION_STYLES = Object.freeze({
    standard: 'standard',
    moneybagsBurst: 'moneybags_burst',
});

const AUDIENCE_ACCESS_MODE_VALUES = new Set(Object.values(AUDIENCE_ACCESS_MODES));
const SUPPORT_CELEBRATION_STYLE_VALUES = new Set(Object.values(SUPPORT_CELEBRATION_STYLES));

const normalizeHttpUrl = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^javascript:/i.test(raw) || /^data:/i.test(raw)) return '';
    try {
        const baseOrigin = typeof window !== 'undefined'
            ? window.location.origin
            : 'https://beaurocks.app';
        const parsed = new URL(raw, baseOrigin);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
        return parsed.toString();
    } catch {
        return '';
    }
};

export const normalizeRoomSupportConfig = (input = {}) => {
    const source = input && typeof input === 'object' ? input : {};
    const provider = String(source.supportProvider || '').trim().toLowerCase();
    return {
        supportProvider: provider,
        supportLabel: String(source.supportLabel || '').trim(),
        supportUrl: normalizeHttpUrl(source.supportUrl || ''),
        supportEmbedUrl: normalizeHttpUrl(source.supportEmbedUrl || ''),
        supportCampaignCode: String(source.supportCampaignCode || '').trim(),
        supportPoints: Math.max(0, Number(source.supportPoints || 0) || 0),
        supportBadge: source.supportBadge !== false,
    };
};

export const normalizeAudienceAccessMode = (value = '') => {
    const token = String(value || '').trim().toLowerCase();
    return AUDIENCE_ACCESS_MODE_VALUES.has(token) ? token : AUDIENCE_ACCESS_MODES.account;
};

export const normalizeSupportCelebrationStyle = (value = '') => {
    const token = String(value || '').trim().toLowerCase();
    return SUPPORT_CELEBRATION_STYLE_VALUES.has(token)
        ? token
        : SUPPORT_CELEBRATION_STYLES.standard;
};

export const normalizeAudienceExperience = (input = {}) => {
    const source = input && typeof input === 'object' ? input : {};
    return {
        audienceAccessMode: normalizeAudienceAccessMode(source.audienceAccessMode || ''),
        supportCelebrationStyle: normalizeSupportCelebrationStyle(source.supportCelebrationStyle || ''),
    };
};

export const buildAudienceSupportOffer = (eventCredits = {}) => {
    const support = normalizeRoomSupportConfig(eventCredits);
    const hasSurface = !!support.supportUrl || !!support.supportEmbedUrl;
    const hasCampaign = support.supportProvider === 'givebutter' && !!support.supportCampaignCode;
    if (!hasSurface && !hasCampaign) return null;
    return {
        ...support,
        label: support.supportLabel || 'Support This Room',
        hasEmbed: !!support.supportEmbedUrl,
        launchUrl: support.supportEmbedUrl || support.supportUrl,
    };
};

export const normalizePurchaseCelebration = (input = {}) => {
    const source = input && typeof input === 'object' ? input : {};
    return {
        id: String(source.id || '').trim(),
        buyerName: String(source.buyerName || source.by || '').trim(),
        buyerAvatar: String(source.buyerAvatar || source.avatar || '').trim(),
        title: String(source.title || '').trim(),
        label: String(source.label || '').trim(),
        subtitle: String(source.subtitle || source.subLabel || '').trim(),
        points: Math.max(0, Number(source.points || 0) || 0),
        badgeAwarded: !!source.badgeAwarded,
        badgeLabel: String(source.badgeLabel || '').trim() || MONEYBAGS_BADGE_LABEL,
        sourceProvider: String(source.sourceProvider || '').trim().toLowerCase(),
        rewardScope: String(source.rewardScope || '').trim().toLowerCase(),
        amountCents: Math.max(0, Number(source.amountCents || 0) || 0),
        celebrationStyle: normalizeSupportCelebrationStyle(source.celebrationStyle || ''),
        createdAtMs: Math.max(0, Number(source.createdAtMs || 0) || 0),
    };
};
