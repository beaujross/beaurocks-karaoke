import premiumCosmeticCatalog from '../../functions/lib/premiumCosmeticCatalog.json';

const normalizeToken = (value = '') => String(value || '').trim().toLowerCase();
const buildEmoji = (codePoints = []) => String.fromCodePoint(...(Array.isArray(codePoints) ? codePoints : []));

export const PREMIUM_COSMETIC_PRODUCTS = Object.freeze(
    Object.values(premiumCosmeticCatalog.products || {})
        .filter((product) => product?.publicOffer === true)
        .map((product) => Object.freeze({
            ...product,
            emoji: Array.isArray(product.emojiCodePoints) ? buildEmoji(product.emojiCodePoints) : '',
        }))
);

export const PREMIUM_PROFILE_EMOJIS = Object.freeze(
    PREMIUM_COSMETIC_PRODUCTS
        .filter((product) => product.kind === 'profile_emoji')
        .map((product) => Object.freeze({
            id: product.avatarId,
            emoji: product.emoji,
            label: product.label,
            flavor: product.flavor,
            unlock: Object.freeze({ type: 'beaubucks', cost: product.cost, productId: product.id }),
        }))
);

export const REACTION_SLOT_PRODUCTS = Object.freeze(
    PREMIUM_COSMETIC_PRODUCTS.filter((product) => product.kind === 'reaction_slot')
);

export const getPremiumCosmeticProduct = (productId = '') => (
    PREMIUM_COSMETIC_PRODUCTS.find((product) => product.id === normalizeToken(productId)) || null
);

export const getOwnedPremiumEntitlementIds = (wallet = null) => new Set(
    (Array.isArray(wallet?.entitlementIds) ? wallet.entitlementIds : []).map(normalizeToken).filter(Boolean)
);

export const getAudienceReactionSlotCount = ({ signedIn = false, wallet = null } = {}) => {
    if (!signedIn) return Number(premiumCosmeticCatalog.defaultReactionSlots || 4);
    const reported = Number(wallet?.reactionSlotCount || 0);
    return Math.min(
        Number(premiumCosmeticCatalog.maxReactionSlots || 6),
        Math.max(Number(premiumCosmeticCatalog.accountReactionSlots || 5), Number.isFinite(reported) ? reported : 0),
    );
};

export const PREMIUM_COSMETIC_CATALOG = Object.freeze({ ...premiumCosmeticCatalog });
