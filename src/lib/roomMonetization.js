export const MONEYBAGS_BADGE_LABEL = 'Moneybags';

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
        title: String(source.title || '').trim(),
        label: String(source.label || '').trim(),
        subtitle: String(source.subtitle || source.subLabel || '').trim(),
        points: Math.max(0, Number(source.points || 0) || 0),
        badgeAwarded: !!source.badgeAwarded,
        badgeLabel: String(source.badgeLabel || '').trim() || MONEYBAGS_BADGE_LABEL,
        sourceProvider: String(source.sourceProvider || '').trim().toLowerCase(),
        rewardScope: String(source.rewardScope || '').trim().toLowerCase(),
        createdAtMs: Math.max(0, Number(source.createdAtMs || 0) || 0),
    };
};

