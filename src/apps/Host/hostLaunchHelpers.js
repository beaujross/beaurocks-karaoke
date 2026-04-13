export const fromDateTimeLocalInput = (value = '') => {
    const token = String(value || '').trim();
    if (!token) return 0;
    const parsed = Date.parse(token);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
};

export const buildHostProvisionRequestId = (prefix = 'host_launch') => {
    const safePrefix = String(prefix || 'host_launch')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 24) || 'host_launch';
    const nonce = Math.random().toString(36).slice(2, 10);
    return `${safePrefix}_${Date.now().toString(36)}_${nonce}`.slice(0, 80);
};

export const DEFAULT_QUICK_LAUNCH_DISCOVERY = Object.freeze({
    publicRoom: false,
    virtualOnly: false,
    roomStartsAtLocal: '',
    title: '',
    venueName: '',
    venueId: '',
    venueSource: '',
    description: '',
    startsAtLocal: '',
    address1: '',
    city: '',
    state: '',
    lat: '',
    lng: ''
});

export const DEFAULT_EVENT_CREDITS_CONFIG = Object.freeze({
    enabled: false,
    presetId: 'custom_event_credits',
    eventId: '',
    eventLabel: '',
    sourceProvider: '',
    sourceCampaignCode: '',
    generalAdmissionPoints: 0,
    vipBonusPoints: 0,
    skipLineBonusPoints: 0,
    websiteCheckInPoints: 0,
    socialPromoPoints: 0,
    supportProvider: '',
    supportLabel: '',
    supportUrl: '',
    supportEmbedUrl: '',
    supportCampaignCode: '',
    supportPoints: 0,
    supportBadge: true,
    promoCampaigns: [],
    claimCodes: {
        vip: '',
        skipLine: '',
        websiteCheckIn: '',
        socialPromo: '',
    },
});

export const EVENT_CREDITS_PRESETS = Object.freeze({
    off: {
        id: 'off',
        label: 'Off',
        description: 'No custom event credits or promo campaigns.',
        values: {
            enabled: false,
            presetId: 'off',
            eventId: '',
            eventLabel: '',
            sourceProvider: '',
            sourceCampaignCode: '',
            generalAdmissionPoints: 0,
            vipBonusPoints: 0,
            skipLineBonusPoints: 0,
            websiteCheckInPoints: 0,
            socialPromoPoints: 0,
            supportProvider: '',
            supportLabel: '',
            supportUrl: '',
            supportEmbedUrl: '',
            supportCampaignCode: '',
            supportPoints: 0,
            supportBadge: true,
            promoCampaigns: [],
        },
    },
    ticketed_event: {
        id: 'ticketed_event',
        label: 'Ticketed Event',
        description: 'Recommended. One flat ticket-linked credit grant for everybody.',
        values: {
            enabled: true,
            presetId: 'ticketed_event',
            eventId: 'ticketed_event',
            eventLabel: 'Ticketed Event',
            sourceProvider: 'givebutter',
            sourceCampaignCode: '',
            generalAdmissionPoints: 200,
            vipBonusPoints: 0,
            skipLineBonusPoints: 0,
            websiteCheckInPoints: 0,
            socialPromoPoints: 0,
            supportProvider: '',
            supportLabel: '',
            supportUrl: '',
            supportEmbedUrl: '',
            supportCampaignCode: '',
            supportPoints: 0,
            supportBadge: true,
            promoCampaigns: [],
        },
    },
    custom_event_credits: {
        id: 'custom_event_credits',
        label: 'Advanced Credits',
        description: 'Use ticket tiers, bonus paths, and custom point rules.',
        values: {
            enabled: true,
            presetId: 'custom_event_credits',
            eventId: '',
            eventLabel: 'Custom Event Credits',
            sourceProvider: '',
            sourceCampaignCode: '',
            generalAdmissionPoints: 100,
            vipBonusPoints: 200,
            skipLineBonusPoints: 300,
            websiteCheckInPoints: 100,
            socialPromoPoints: 150,
            supportProvider: '',
            supportLabel: '',
            supportUrl: '',
            supportEmbedUrl: '',
            supportCampaignCode: '',
            supportPoints: 0,
            supportBadge: true,
            promoCampaigns: [],
        },
    },
    promo_campaigns: {
        id: 'promo_campaigns',
        label: 'Promo Campaigns',
        description: 'Run QR drops and capped promo campaigns without ticket-linked credits.',
        values: {
            enabled: true,
            presetId: 'promo_campaigns',
            eventId: 'promo_campaigns',
            eventLabel: 'Promo Campaigns',
            sourceProvider: '',
            sourceCampaignCode: '',
            generalAdmissionPoints: 0,
            vipBonusPoints: 0,
            skipLineBonusPoints: 0,
            websiteCheckInPoints: 0,
            socialPromoPoints: 150,
            supportProvider: '',
            supportLabel: '',
            supportUrl: '',
            supportEmbedUrl: '',
            supportCampaignCode: '',
            supportPoints: 0,
            supportBadge: true,
            promoCampaigns: [
                {
                    id: 'promo_drop',
                    label: 'Promo Drop',
                    type: 'multi_use_capped',
                    codeMode: 'random',
                    code: '',
                    pointsReward: 150,
                    safePerk: '',
                    maxRedemptions: 250,
                    perUserLimit: 1,
                    requiresRoomJoin: true,
                    enabled: true,
                    validFromMs: 0,
                    validUntilMs: 0,
                },
            ],
        },
    },
    aahf_kickoff: {
        id: 'aahf_kickoff',
        label: 'AAHF Kick-Off Preset',
        description: 'AAHF defaults with simple Givebutter ticket matching.',
        values: {
            enabled: true,
            presetId: 'aahf_kickoff',
            eventId: 'aahf_kickoff',
            eventLabel: 'AAHF Karaoke Kick-Off',
            sourceProvider: 'givebutter',
            sourceCampaignCode: '',
            generalAdmissionPoints: 200,
            vipBonusPoints: 0,
            skipLineBonusPoints: 0,
            websiteCheckInPoints: 0,
            socialPromoPoints: 0,
            supportProvider: '',
            supportLabel: '',
            supportUrl: '',
            supportEmbedUrl: '',
            supportCampaignCode: '',
            supportPoints: 0,
            supportBadge: true,
            promoCampaigns: [],
        },
    },
});

export const EVENT_CREDITS_PRESET_OPTIONS = Object.freeze([
    EVENT_CREDITS_PRESETS.off,
    EVENT_CREDITS_PRESETS.ticketed_event,
    EVENT_CREDITS_PRESETS.aahf_kickoff,
    EVENT_CREDITS_PRESETS.custom_event_credits,
    EVENT_CREDITS_PRESETS.promo_campaigns,
]);

export const createQuickLaunchDiscoveryDraft = (draft = {}) => ({
    ...DEFAULT_QUICK_LAUNCH_DISCOVERY,
    ...(draft && typeof draft === 'object' ? draft : {})
});

export const createEventCreditsDraft = (draft = {}) => {
    const source = draft && typeof draft === 'object' ? draft : {};
    const claimCodes = source.claimCodes && typeof source.claimCodes === 'object'
        ? source.claimCodes
        : {};
    const promoCampaigns = Array.isArray(source.promoCampaigns) ? source.promoCampaigns : [];
    return {
        ...DEFAULT_EVENT_CREDITS_CONFIG,
        ...source,
        promoCampaigns: promoCampaigns.map((campaign, index) => ({
            id: String(campaign?.id || `promo_${index + 1}`).trim() || `promo_${index + 1}`,
            label: String(campaign?.label || campaign?.name || `Promo ${index + 1}`).trim() || `Promo ${index + 1}`,
            type: String(campaign?.type || 'multi_use_capped').trim().toLowerCase() || 'multi_use_capped',
            codeMode: String(campaign?.codeMode || 'vanity').trim().toLowerCase() || 'vanity',
            code: String(campaign?.code || '').trim(),
            pointsReward: clampWholeNumber(campaign?.pointsReward),
            safePerk: String(campaign?.safePerk || '').trim().toLowerCase(),
            maxRedemptions: clampWholeNumber(campaign?.maxRedemptions ?? 1, { min: 1, max: 100000 }),
            perUserLimit: clampWholeNumber(campaign?.perUserLimit ?? 1, { min: 1, max: 100 }),
            requiresRoomJoin: campaign?.requiresRoomJoin !== false,
            enabled: campaign?.enabled !== false,
            validFromMs: clampWholeNumber(campaign?.validFromMs ?? 0, { min: 0, max: 9999999999999 }),
            validUntilMs: clampWholeNumber(campaign?.validUntilMs ?? 0, { min: 0, max: 9999999999999 }),
        })),
        claimCodes: {
            ...DEFAULT_EVENT_CREDITS_CONFIG.claimCodes,
            ...claimCodes,
        },
        supportProvider: String(source.supportProvider || '').trim().toLowerCase(),
        supportLabel: String(source.supportLabel || '').trim(),
        supportUrl: String(source.supportUrl || '').trim(),
        supportEmbedUrl: String(source.supportEmbedUrl || '').trim(),
        supportCampaignCode: String(source.supportCampaignCode || '').trim(),
        supportPoints: clampWholeNumber(source.supportPoints ?? 0),
        supportBadge: source.supportBadge !== false,
    };
};

export const applyEventCreditsPreset = (presetId = 'custom_event_credits', draft = {}) => {
    const preset = EVENT_CREDITS_PRESETS[presetId] || EVENT_CREDITS_PRESETS.custom_event_credits;
    const nextDraft = createEventCreditsDraft({
        ...draft,
        ...preset.values,
        presetId: preset.id,
    });
    return nextDraft;
};

const clampWholeNumber = (value = 0, { min = 0, max = 100000 } = {}) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
};

const sanitizeEventCode = (value = '') =>
    String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 64);

export const buildProvisionEventCreditsPayload = (draft = {}) => {
    const nextDraft = createEventCreditsDraft(draft);
    const enabled = !!nextDraft.enabled;
    const eventId = (sanitizeEventCode(nextDraft.eventId || 'custom_event') || 'custom_event').toLowerCase();
    const eventLabel = String(nextDraft.eventLabel || '').trim().slice(0, 120) || 'Custom Event Credits';
    return {
        enabled,
        presetId: sanitizeEventCode(nextDraft.presetId || 'custom_event_credits') || 'custom_event_credits',
        eventId,
        eventLabel,
        sourceProvider: sanitizeEventCode(nextDraft.sourceProvider || '').toLowerCase(),
        sourceCampaignCode: sanitizeEventCode(nextDraft.sourceCampaignCode || ''),
        generalAdmissionPoints: clampWholeNumber(nextDraft.generalAdmissionPoints),
        vipBonusPoints: clampWholeNumber(nextDraft.vipBonusPoints),
        skipLineBonusPoints: clampWholeNumber(nextDraft.skipLineBonusPoints),
        websiteCheckInPoints: clampWholeNumber(nextDraft.websiteCheckInPoints),
        socialPromoPoints: clampWholeNumber(nextDraft.socialPromoPoints),
        supportProvider: sanitizeEventCode(nextDraft.supportProvider || '').toLowerCase(),
        supportLabel: String(nextDraft.supportLabel || '').trim().slice(0, 120),
        supportUrl: normalizeLaunchHttpUrl(nextDraft.supportUrl || ''),
        supportEmbedUrl: normalizeLaunchHttpUrl(nextDraft.supportEmbedUrl || ''),
        supportCampaignCode: sanitizeEventCode(nextDraft.supportCampaignCode || ''),
        supportPoints: clampWholeNumber(nextDraft.supportPoints),
        supportBadge: nextDraft.supportBadge !== false,
        promoCampaigns: nextDraft.promoCampaigns.map((campaign, index) => ({
            id: sanitizeEventCode(campaign?.id || `promo_${index + 1}`) || `promo_${index + 1}`,
            label: String(campaign?.label || `Promo ${index + 1}`).trim().slice(0, 120) || `Promo ${index + 1}`,
            type: sanitizeEventCode(campaign?.type || 'multi_use_capped') || 'multi_use_capped',
            codeMode: sanitizeEventCode(campaign?.codeMode || 'vanity') || 'vanity',
            code: sanitizeEventCode(campaign?.code || ''),
            pointsReward: clampWholeNumber(campaign?.pointsReward),
            safePerk: sanitizeEventCode(campaign?.safePerk || '').toLowerCase(),
            maxRedemptions: clampWholeNumber(campaign?.maxRedemptions ?? 1, { min: 1, max: 100000 }),
            perUserLimit: clampWholeNumber(campaign?.perUserLimit ?? 1, { min: 1, max: 100 }),
            requiresRoomJoin: campaign?.requiresRoomJoin !== false,
            enabled: campaign?.enabled !== false,
            validFromMs: clampWholeNumber(campaign?.validFromMs ?? 0, { min: 0, max: 9999999999999 }),
            validUntilMs: clampWholeNumber(campaign?.validUntilMs ?? 0, { min: 0, max: 9999999999999 }),
        })),
        claimCodes: {
            vip: sanitizeEventCode(nextDraft.claimCodes?.vip),
            skipLine: sanitizeEventCode(nextDraft.claimCodes?.skipLine),
            websiteCheckIn: sanitizeEventCode(nextDraft.claimCodes?.websiteCheckIn),
            socialPromo: sanitizeEventCode(nextDraft.claimCodes?.socialPromo),
        },
    };
};

export const buildProvisionDiscoveryPayload = (draft = {}, options = {}) => {
    const nextDraft = createQuickLaunchDiscoveryDraft(draft);
    const roomName = String(options?.roomName || '').trim();
    const startsAtLocal = String(nextDraft?.startsAtLocal || '').trim() || String(nextDraft?.roomStartsAtLocal || '').trim();
    const startsAtMs = fromDateTimeLocalInput(startsAtLocal);
    const lat = Number(nextDraft?.lat);
    const lng = Number(nextDraft?.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const virtualOnly = !!nextDraft?.virtualOnly;
    const venueName = String(nextDraft?.venueName || '').trim();
    const title = String(nextDraft?.title || '').trim() || venueName || roomName;
    const venueId = String(nextDraft?.venueId || '').trim();
    const venueSource = String(nextDraft?.venueSource || (venueId ? 'selected' : '')).trim().toLowerCase();
    return {
        publicRoom: !!nextDraft?.publicRoom,
        virtualOnly,
        title,
        venueName: virtualOnly ? (venueName || 'Virtual Room') : venueName,
        venueId: venueId || '',
        venueSource: venueSource || (venueId ? 'selected' : (venueName ? 'freeform' : '')),
        description: String(nextDraft?.description || '').trim(),
        startsAtMs: startsAtMs || 0,
        startsAtLocal,
        address1: virtualOnly ? '' : String(nextDraft?.address1 || '').trim(),
        city: String(nextDraft?.city || '').trim(),
        state: String(nextDraft?.state || '').trim(),
        lat: String(nextDraft?.lat || '').trim(),
        lng: String(nextDraft?.lng || '').trim(),
        location: hasCoords ? { lat, lng } : {},
        sessionMode: virtualOnly ? 'virtual' : 'karaoke',
    };
};

export const buildProvisionRoomPlanPayload = (draft = {}) => {
    const nextDraft = createQuickLaunchDiscoveryDraft(draft);
    const startsAtLocal = String(nextDraft?.roomStartsAtLocal || '').trim();
    const startsAtMs = fromDateTimeLocalInput(startsAtLocal);
    return {
        startsAtLocal,
        startsAtMs: startsAtMs || 0,
    };
};

const normalizeLaunchHttpUrl = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
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

export const normalizeProvisionLaunchUrls = (value = {}) => {
    const input = value && typeof value === 'object' ? value : {};
    return {
        hostUrl: normalizeLaunchHttpUrl(input.hostUrl),
        tvUrl: normalizeLaunchHttpUrl(input.tvUrl),
        audienceUrl: normalizeLaunchHttpUrl(input.audienceUrl),
    };
};

export const isProvisionHostRoomCallableUnavailableError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    if (code.includes('not-found') || code.includes('unimplemented')) return true;
    return (
        message.includes('provisionhostroom')
        && (
            message.includes('does not exist')
            || message.includes('not found')
            || message.includes('not deployed')
            || message.includes('no function')
        )
    );
};
