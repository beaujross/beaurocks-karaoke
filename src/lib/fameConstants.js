/**
 * Fame System Constants & Configuration
 * 
 * Defines all levels, tiers, rewards, and unlocks for the Fame system
 */

// ============================================
// FAME LEVELS (0-20)
// ============================================

export const FAME_LEVELS = {
    0: {
        name: "Newcomer",
        minFame: 0,
        nextThreshold: 100,
        unlock: null,
        reward: "Profile creation",
        description: "Just getting started",
        color: "#6B7280" // gray
    },
    1: {
        name: "Performer",
        minFame: 100,
        nextThreshold: 300,
        unlock: null,
        reward: "🎤 Performer badge",
        description: "First song under your belt",
        color: "#3B82F6" // blue
    },
    2: {
        name: "Rising Star",
        minFame: 300,
        nextThreshold: 600,
        unlock: null,
        reward: "Custom username color (blue)",
        description: "Building momentum",
        color: "#60A5FA" // light blue
    },
    3: {
        name: "Hot Shot",
        minFame: 600,
        nextThreshold: 1000,
        unlock: null,
        reward: "Exclusive avatar: 'Star'",
        description: "People are noticing",
        color: "#10B981" // emerald
    },
    4: {
        name: "Crowd Favorite",
        minFame: 1000,
        nextThreshold: 1500,
        unlock: null,
        reward: "⭐ Crowd Favorite badge",
        description: "Everyone knows your name",
        color: "#34D399" // emerald light
    },
    5: {
        name: "Legend",
        minFame: 1500,
        nextThreshold: 2200,
        unlock: "VIP-exclusive avatar: 'Crown'",
        reward: "VIP status visible",
        description: "You're a legend now",
        color: "#FBBF24" // amber
    },
    6: {
        name: "Icon",
        minFame: 2200,
        nextThreshold: 3000,
        unlock: null,
        reward: "Custom nickname color (gold)",
        description: "Icon status unlocked",
        color: "#F59E0B" // amber darker
    },
    7: {
        name: "Superstar",
        minFame: 3000,
        nextThreshold: 4000,
        unlock: null,
        reward: "Exclusive avatar: 'Superstar'",
        description: "Fame is calling",
        color: "#EC4899" // pink
    },
    8: {
        name: "Phenomenon",
        minFame: 4000,
        nextThreshold: 5200,
        unlock: null,
        reward: "🌟 Hall of Fame eligibility",
        description: "You're a phenomenon",
        color: "#F43F5E" // rose
    },
    9: {
        name: "Cosmic Force",
        minFame: 5200,
        nextThreshold: 6500,
        unlock: null,
        reward: "Exclusive avatar: 'Cosmic'",
        description: "Beyond the stars",
        color: "#A855F7" // purple
    },
    10: {
        name: "Master",
        minFame: 6500,
        nextThreshold: 8000,
        unlock: "Unlock custom profile colors",
        reward: "Master badge + leaderboard rank",
        description: "You've mastered the stage",
        color: "#7C3AED" // violet
    },
    11: {
        name: "Virtuoso",
        minFame: 8000,
        nextThreshold: 9500,
        unlock: null,
        reward: "Exclusive avatar: 'Virtuoso'",
        description: "Technical excellence",
        color: "#8B5CF6" // violet
    },
    12: {
        name: "Immortal",
        minFame: 9500,
        nextThreshold: 11000,
        unlock: null,
        reward: "Custom stat display (personalized)",
        description: "Your legend lives on",
        color: "#06B6D4" // cyan
    },
    13: {
        name: "Deity",
        minFame: 11000,
        nextThreshold: 12500,
        unlock: null,
        reward: "Exclusive avatar: 'Deity'",
        description: "You are a karaoke deity",
        color: "#0891B2" // cyan darker
    },
    14: {
        name: "Titan",
        minFame: 12500,
        nextThreshold: 14200,
        unlock: null,
        reward: "Titan status badge + 2x points multiplier",
        description: "Among the greats",
        color: "#EF4444" // red
    },
    15: {
        name: "Legendary Icon",
        minFame: 14200,
        nextThreshold: 16000,
        unlock: "Private party hosting (VIP feature enhanced)",
        reward: "Legendary icon status",
        description: "Your name lives in legend",
        color: "#DC2626" // red darker
    },
    16: {
        name: "Supreme",
        minFame: 16000,
        nextThreshold: 18000,
        unlock: null,
        reward: "Exclusive avatar: 'Supreme'",
        description: "Supreme excellence",
        color: "#E879F9" // fuchsia
    },
    17: {
        name: "Infinite",
        minFame: 18000,
        nextThreshold: 20000,
        unlock: null,
        reward: "Custom profile banner",
        description: "Your fame is infinite",
        color: "#D8B4FE" // purple light
    },
    18: {
        name: "Eternal",
        minFame: 20000,
        nextThreshold: 22500,
        unlock: null,
        reward: "Exclusive avatar: 'Eternal'",
        description: "Eternal stardom",
        color: "#FF6B9D" // pink bright
    },
    19: {
        name: "Transcendent",
        minFame: 22500,
        nextThreshold: 25000,
        unlock: null,
        reward: "Hall of Fame status (permanent)",
        description: "You've transcended",
        color: "#FFB84D" // orange
    },
    20: {
        name: "Ultimate Legend",
        minFame: 25000,
        nextThreshold: Infinity,
        unlock: "ALL UNLOCKS ACHIEVED",
        reward: "🏆 Ultimate Legend badge + 3x multiplier",
        description: "The absolute peak",
        color: "#FFD700" // gold
    }
};

// ============================================
// SUBSCRIPTION TIERS (NO MULTIPLIERS - SKILL-BASED PROGRESSION)
// ============================================

export const SUBSCRIPTION_TIERS = {
    free: {
        id: "free",
        name: "Free Player",
        monthlyPrice: 0,
        features: [
            "✅ Play 5 mini-games",
            "✅ Earn fame points (skill-based)",
            "✅ Level up (0-20)",
            "✅ Join public parties",
            "✅ Basic profile",
            "❌ Save progress",
            "❌ Premium currency",
            "❌ Hosting"
        ],
        description: "Play for free forever",
        canHost: false,
        saveProgress: false,
        aiFeatures: false,
        games: ["FlappyBird", "VocalChallenge", "QA", "RidingScales", "Bingo"]
    },
    vip: {
        id: "vip",
        name: "VIP",
        monthlyPrice: 0, // Free - signup convenience
        features: [
            "✅ All FREE features",
            "✅ Save fame level progress",
            "✅ Save performance history",
            "✅ Save tight 15 playlist",
            "✅ Passwordless login (SMS or Email)",
            "✅ Buy premium currency via Stripe",
            "✅ Profile customization",
            "❌ Host parties"
        ],
        description: "Enhanced experience + cosmetics",
        canHost: false,
        saveProgress: true,
        aiFeatures: false,
        games: ["FlappyBird", "VocalChallenge", "QA", "RidingScales", "Bingo"]
    },
    host: {
        id: "host",
        name: "HOST",
        monthlyPrice: 15.00,
        yearlyPrice: 150.00,
        features: [
            "✅ All VIP features",
            "✅ Host unlimited private parties",
            "✅ Hosting dashboard (analytics, player mgmt)",
            "✅ Access to Trivia game",
            "✅ Access to Would You Rather game",
            "✅ Save party configurations",
            "✅ Email support"
        ],
        description: "Host karaoke parties with full control",
        canHost: true,
        saveProgress: true,
        aiFeatures: false,
        games: ["FlappyBird", "VocalChallenge", "QA", "RidingScales", "Bingo", "Trivia", "WYR"]
    },
    host_plus: {
        id: "host_plus",
        name: "HOST Plus",
        monthlyPrice: 23.00,
        yearlyPrice: 230.00,
        features: [
            "✅ All HOST features",
            "✅ Full game library access",
            "✅ AI features enabled (usage quotas)",
            "✅ Advanced party analytics",
            "✅ Priority support (24/7)",
            "✅ Custom branding & themes",
            "✅ Bulk player management tools"
        ],
        description: "Professional hosting + AI-powered features",
        canHost: true,
        saveProgress: true,
        aiFeatures: true,
        aiQuotaPerMonth: 1000,
        games: ["All"]
    }
};

// ============================================
// PREMIUM CURRENCY (In-App Purchase, Cosmetics Only)
// ============================================

export const PREMIUM_CURRENCY = {
    name: "Stars",
    symbol: "⭐",
    canBuyFamePoints: false, // NO pay-to-win
    usesFor: [
        "Cosmetic avatars",
        "Custom profile frames",
        "Special effects during gameplay",
        "Exclusive username colors",
        "Profile badges"
    ],
    pricingPackages: [
        { stars: 100, price: 0.99 },
        { stars: 500, price: 4.99 },
        { stars: 1200, price: 9.99 },
        { stars: 2700, price: 19.99 }
    ]
};

// ============================================
// PROFILE AUGMENTATION BONUSES
// ============================================

export const PROFILE_AUGMENTATION = {
    profilePicture: {
        id: "profilePicture",
        name: "Profile Picture",
        fameBonus: 25,
        category: "appearance",
        once: true,
        description: "Upload a profile photo"
    },
    bio: {
        id: "bio",
        name: "Write Bio",
        fameBonus: 50,
        category: "engagement",
        once: false,
        minLength: 50,
        description: "Write a bio (50+ characters)"
    },
    musicPreferences: {
        id: "musicPreferences",
        name: "Music Preferences",
        fameBonus: 75,
        category: "personalization",
        once: true,
        minSelect: 5,
        description: "Select 5+ favorite music genres"
    },
    pronouns: {
        id: "pronouns",
        name: "Pronouns",
        fameBonus: 10,
        category: "profile",
        once: true,
        description: "Set your pronouns"
    },
    favoriteGenre: {
        id: "favoriteGenre",
        name: "Favorite Genre",
        fameBonus: 15,
        category: "personalization",
        once: true,
        description: "Select your favorite music genre"
    },
    socialLinks: {
        id: "socialLinks",
        name: "Social Links",
        fameBonus: 20,
        category: "engagement",
        once: false,
        maxPerLink: true,
        description: "Add Spotify, Instagram, etc"
    },
    recordLabel: {
        id: "recordLabel",
        name: "Record Label",
        fameBonus: 30,
        category: "branding",
        once: true,
        description: "Set your artist/label name"
    }
    // Total possible: 225 fame points from profile alone
};

// ============================================
// FAME CALCULATION CONFIG (NO PAY-TO-WIN MULTIPLIERS)
// ============================================

export const FAME_CALCULATION = {
    decibelMinimum: 40,  // Quietest measurable
    decibelMaximum: 100, // Loudest measurable
    decibelScoreCap: 100, // Max points for decibel portion
    
    hostBonusMin: 0.5,
    hostBonusMax: 3.0,
    hostBonusDefault: 1.0,
    
    // NO multipliers from subscriptions - skill-based only!
    // fame = hype + decibel + (hype * hostBonus)
    // All players earn at same rate (fair)
};

// ============================================
// HOST BONUS PRESETS
// ============================================

export const HOST_BONUS_PRESETS = [
    { label: "Half Points", value: 0.5 },
    { label: "Normal", value: 1.0 },
    { label: "1.5x Bonus", value: 1.5 },
    { label: "Double", value: 2.0 },
    { label: "Triple", value: 3.0 }
];

// ============================================
// MUSIC PREFERENCES FOR PROFILE
// ============================================

export const MUSIC_GENRES = [
    "Pop",
    "Rock",
    "Hip Hop",
    "R&B",
    "Country",
    "Jazz",
    "Electronic",
    "Soul",
    "Gospel",
    "Folk",
    "Latin",
    "Metal",
    "Indie",
    "K-Pop",
    "Bollywood"
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get fame level from total fame points
 */
export function getLevelFromFame(totalFame) {
    // Iterate from level 20 down to 0 to find the right level
    for (let level = 20; level >= 0; level--) {
        if (totalFame >= FAME_LEVELS[level].minFame) {
            return level;
        }
    }
    return 0;
}

/**
 * Get next level threshold
 */
export function getNextLevelThreshold(currentLevel) {
    return FAME_LEVELS[currentLevel]?.nextThreshold ?? Infinity;
}

/**
 * Calculate progress to next level (0-100%)
 */
export function getProgressToNextLevel(totalFame, currentLevel) {
    const currentLevelData = FAME_LEVELS[currentLevel];
    if (!currentLevelData) return 0;
    
    const nextThreshold = currentLevelData.nextThreshold;
    if (nextThreshold === Infinity) return 100; // Max level
    
    const progress = totalFame - currentLevelData.minFame;
    const needed = nextThreshold - currentLevelData.minFame;
    
    return Math.round((progress / needed) * 100);
}

/**
 * Get all unlocks for a specific level
 */
export function getUnlocksForLevel(level) {
    const unlock = FAME_LEVELS[level]?.unlock;
    return unlock ? [unlock] : [];
}

/**
 * Get total profile completion percentage
 */
export function getProfileCompletionPercentage(augmentation) {
    const total = Object.keys(PROFILE_AUGMENTATION).length;
    let completed = 0;
    
    Object.values(PROFILE_AUGMENTATION).forEach(item => {
        if (augmentation?.[item.id]) {
            completed++;
        }
    });
    
    return Math.round((completed / total) * 100);
}

/**
 * Calculate total fame bonus from profile augmentation
 */
export function calculateProfileBonusTotal(augmentation) {
    let total = 0;
    
    Object.entries(PROFILE_AUGMENTATION).forEach(([key, item]) => {
        if (augmentation?.[key]) {
            total += item.fameBonus;
        }
    });
    
    return total;
}
