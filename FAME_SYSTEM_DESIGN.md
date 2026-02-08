/**
 * Fame System Design - Karaoke App
 * 
 * Objective: Create a progression system that makes playing valuable
 * and subscriptions worth purchasing
 */

// ============================================
// FAME POINTS CALCULATION
// ============================================

/**
 * When a performance ends, calculate total Fame Points:
 * 
 * Fame Points = Hype Points + Decibel Score + Host Bonus
 * 
 * Example:
 * - Flappy Bird: 150 hype points
 * - Decibel level: 85dB = 50 decibel score
 * - Host gave 1.5x bonus = +225 fame points
 * = 150 + 50 + 225 = 425 Fame Points
 */

export const FAME_CALCULATION = {
    hypePoints: "Points earned from game performance",
    decibelScore: "Score based on vocal volume (40dB = 0, 100dB = 100)",
    hostBonus: "Multiplier applied by host (0.5x to 3.0x)",
    formula: "fame = hype + decibel + (hype * hostBonus)"
};

// ============================================
// FAME LEVELS - 0 to 20
// ============================================

export const FAME_LEVELS = {
    0: {
        name: "Newcomer",
        minFame: 0,
        maxFame: 100,
        unlock: "Profile creation",
        reward: "Avatar selection",
        description: "Just getting started"
    },
    1: {
        name: "Performer",
        minFame: 100,
        maxFame: 300,
        unlock: "First performance complete",
        reward: "🎤 Performer badge",
        description: "First song under your belt"
    },
    2: {
        name: "Rising Star",
        minFame: 300,
        maxFame: 600,
        unlock: null,
        reward: "Custom username color (blue)",
        description: "Building momentum"
    },
    3: {
        name: "Hot Shot",
        minFame: 600,
        maxFame: 1000,
        unlock: null,
        reward: "Exclusive avatar: 'Star'",
        description: "People are noticing"
    },
    4: {
        name: "Crowd Favorite",
        minFame: 1000,
        maxFame: 1500,
        unlock: null,
        reward: "⭐ Crowd Favorite badge",
        description: "Everyone knows your name"
    },
    5: {
        name: "Legend",
        minFame: 1500,
        maxFame: 2200,
        unlock: "VIP-exclusive avatar: 'Crown'",
        reward: "VIP status visible",
        description: "You're a legend now"
    },
    6: {
        name: "Icon",
        minFame: 2200,
        maxFame: 3000,
        unlock: null,
        reward: "Custom nickname color (gold)",
        description: "Icon status unlocked"
    },
    7: {
        name: "Superstar",
        minFame: 3000,
        maxFame: 4000,
        unlock: null,
        reward: "Exclusive avatar: 'Superstar'",
        description: "Fame is calling"
    },
    8: {
        name: "Phenomenon",
        minFame: 4000,
        maxFame: 5200,
        unlock: null,
        reward: "🌟 Hall of Fame eligibility",
        description: "You're a phenomenon"
    },
    9: {
        name: "Cosmic Force",
        minFame: 5200,
        maxFame: 6500,
        unlock: null,
        reward: "Exclusive avatar: 'Cosmic'",
        description: "Beyond the stars"
    },
    10: {
        name: "Master",
        minFame: 6500,
        maxFame: 8000,
        unlock: "Unlock custom profile colors",
        reward: "Master badge + leaderboard rank",
        description: "You've mastered the stage"
    },
    11: {
        name: "Virtuoso",
        minFame: 8000,
        maxFame: 9500,
        unlock: null,
        reward: "Exclusive avatar: 'Virtuoso'",
        description: "Technical excellence"
    },
    12: {
        name: "Immortal",
        minFame: 9500,
        maxFame: 11000,
        unlock: null,
        reward: "Custom stat display (personalized)",
        description: "Your legend lives on"
    },
    13: {
        name: "Deity",
        minFame: 11000,
        maxFame: 12500,
        unlock: null,
        reward: "Exclusive avatar: 'Deity'",
        description: "You are a karaoke deity"
    },
    14: {
        name: "Titan",
        minFame: 12500,
        maxFame: 14200,
        unlock: null,
        reward: "Titan status badge + 2x points multiplier",
        description: "Among the greats"
    },
    15: {
        name: "Legendary Icon",
        minFame: 14200,
        maxFame: 16000,
        unlock: "Unlock: Private party hosting (VIP only)",
        reward: "Legendary icon status",
        description: "Your name lives in legend"
    },
    16: {
        name: "Supreme",
        minFame: 16000,
        maxFame: 18000,
        unlock: null,
        reward: "Exclusive avatar: 'Supreme'",
        description: "Supreme excellence"
    },
    17: {
        name: "Infinite",
        minFame: 18000,
        maxFame: 20000,
        unlock: null,
        reward: "Custom profile banner",
        description: "Your fame is infinite"
    },
    18: {
        name: "Eternal",
        minFame: 20000,
        maxFame: 22500,
        unlock: null,
        reward: "Exclusive avatar: 'Eternal'",
        description: "Eternal stardom"
    },
    19: {
        name: "Transcendent",
        minFame: 22500,
        maxFame: 25000,
        unlock: null,
        reward: "Hall of Fame status (permanent)",
        description: "You've transcended"
    },
    20: {
        name: "Ultimate Legend",
        minFame: 25000,
        maxFame: Infinity,
        unlock: "MAX LEVEL - All unlocks",
        reward: "🏆 Ultimate Legend badge + 3x multiplier",
        description: "The absolute peak"
    }
};

// ============================================
// VIP TIERS & BENEFITS
// ============================================

export const VIP_TIERS = {
    free: {
        name: "Performer",
        monthlyPrice: 0,
        features: [
            "✅ Join public parties",
            "✅ Play games",
            "✅ Earn fame points",
            "❌ Host private parties",
            "❌ Custom songs",
            "❌ Analytics dashboard"
        ],
        fameMultiplier: 1.0,
        description: "Free to play"
    },
    vip_monthly: {
        name: "Star Host",
        monthlyPrice: 9.99,
        features: [
            "✅ Join public parties",
            "✅ Play games",
            "✅ Host unlimited private parties",
            "✅ Custom song library (100 songs)",
            "✅ 1.5x fame multiplier",
            "✅ Basic analytics",
            "✅ Priority support"
        ],
        fameMultiplier: 1.5,
        description: "Host your own karaoke parties"
    },
    vip_annual: {
        name: "Legend Host",
        monthlyPrice: 99.99 / 12, // $8.33/month billed annually
        features: [
            "✅ Join public parties",
            "✅ Play games",
            "✅ Host unlimited private parties",
            "✅ Custom song library (500 songs)",
            "✅ 2.0x fame multiplier",
            "✅ Advanced analytics",
            "✅ 24/7 priority support",
            "✅ Custom party branding",
            "✅ Save party presets"
        ],
        fameMultiplier: 2.0,
        description: "Serious hosting power + savings"
    }
};

// ============================================
// PROFILE AUGMENTATION DATA
// ============================================

/**
 * When user completes profile, they unlock bonus fame points
 * Encourages engagement and provides more personalization
 */

export const PROFILE_AUGMENTATION = {
    profilePicture: {
        name: "Profile Picture",
        fameBonus: 25,
        category: "appearance",
        once: true
    },
    bio: {
        name: "Write Bio (50+ chars)",
        fameBonus: 50,
        category: "engagement",
        once: false,
        frequency: "per unique bio"
    },
    musicPreferences: {
        name: "Select 5+ Music Preferences",
        fameBonus: 75,
        category: "personalization",
        once: true
    },
    pronouns: {
        name: "Add Pronouns",
        fameBonus: 10,
        category: "profile",
        once: true
    },
    favoriteGenre: {
        name: "Set Favorite Genre",
        fameBonus: 15,
        category: "personalization",
        once: true
    },
    socialLinks: {
        name: "Add Social Links (Spotify, etc)",
        fameBonus: 20,
        category: "engagement",
        once: false,
        frequency: "per link"
    },
    recordLabel: {
        name: "Set 'Record Label' (artist name)",
        fameBonus: 30,
        category: "engagement",
        once: true
    }
    // Total possible: 225 fame points from profile alone
};

// ============================================
// AUTHENTICATION METHODS
// ============================================

export const AUTH_METHODS = {
    phone_sms: {
        name: "Phone Number",
        provider: "Firebase Phone Auth",
        passwordRequired: false,
        linkRequired: false,
        setup: "User enters phone → Gets SMS code → Logged in",
        security: "High - SMS verification"
    },
    email_link: {
        name: "Email Magic Link",
        provider: "Firebase Email Link Auth",
        passwordRequired: false,
        linkRequired: true,
        setup: "User enters email → Gets link in inbox → Click link → Logged in",
        security: "High - Email verification"
    }
};

// ============================================
// HOSTING (SaaS) FEATURES
// ============================================

export const HOSTING_FEATURES = {
    private_room: {
        description: "Host private karaoke parties",
        tier: "vip_monthly",
        limit: "unlimited"
    },
    custom_songs: {
        description: "Upload/add custom songs to your library",
        tier: "vip_monthly",
        limit: "100 songs (Monthly), 500 songs (Annual)"
    },
    party_presets: {
        description: "Save game/music configurations",
        tier: "vip_annual",
        limit: "unlimited"
    },
    analytics: {
        description: "View party stats, player scores, engagement",
        tier: "vip_monthly",
        limit: "basic (Monthly), advanced (Annual)"
    },
    custom_branding: {
        description: "Customize party room with your branding",
        tier: "vip_annual",
        limit: "unlimited"
    },
    priority_support: {
        description: "Get help faster",
        tier: "vip_monthly",
        limit: "email + chat"
    }
};

// ============================================
// UI DISPLAY RECOMMENDATIONS
// ============================================

export const UI_DISPLAY = {
    playerCard: [
        "Player avatar",
        "Player name",
        "Fame level (0-20) with progress bar",
        "Total fame points",
        "Current session score",
        "Badges earned"
    ],
    lobbyDisplay: [
        "All players listed with fame levels",
        "Leaderboard sorted by fame level",
        "Next performance slot indicator"
    ],
    performanceReview: [
        "Game score breakdown",
        "Decibel score (with visualization)",
        "Host multiplier applied",
        "Total fame points awarded",
        "New level achieved? → Show unlock reward"
    ],
    profileView: [
        "Fame level with fancy visual",
        "Total fame points with progress to next level",
        "List of unlocks/badges",
        "Profile completion percentage",
        "VIP status (if applicable)"
    ]
};
