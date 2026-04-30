const normalizeMode = (value = '') => String(value || '').trim().toLowerCase();

const GAME_GUIDES = [
    {
        id: 'pop_trivia',
        label: 'Pop-Up Trivia',
        detail: 'Quick vote questions can appear during live karaoke songs.',
        isEnabled: (room, mode) => room?.popTriviaEnabled === true || mode.includes('trivia') || mode.includes('wyr')
    },
    {
        id: 'bingo',
        label: 'Mystery Bingo',
        detail: 'Spin, confirm squares, and watch the board flip live with the room.',
        isEnabled: (room, mode) => mode === 'bingo' || Array.isArray(room?.bingoData) || !!room?.bingoMode
    },
    {
        id: 'selfie_challenge',
        label: 'Selfie Challenge',
        detail: 'Selected players submit a selfie, then the crowd votes from their phones.',
        isEnabled: (room, mode) => mode === 'selfie_challenge' || mode === 'selfie_cam' || !!room?.selfieChallenge
    },
    {
        id: 'doodle_oke',
        label: 'Doodle-Oke',
        detail: 'Draw the prompt on your phone, then vote on the best reveal.',
        isEnabled: (room, mode) => mode === 'doodle_oke' || !!room?.doodleOke
    },
    {
        id: 'voice_games',
        label: 'Voice Games',
        detail: 'Jump into voice-controlled mini-games whenever the host launches one.',
        isEnabled: (_room, mode) => ['flappy_bird', 'vocal_challenge', 'riding_scales'].includes(mode)
    },
    {
        id: 'karaoke_bracket',
        label: 'Karaoke Bracket',
        detail: 'Build a Tight 15 list and be ready for bracket round picks.',
        isEnabled: (_room, mode) => mode === 'karaoke_bracket'
    }
];

export const getSingerHowToPlayFeaturedGames = (room = null) => {
    const activeMode = normalizeMode(room?.activeMode);
    return GAME_GUIDES.filter((guide) => guide.isEnabled(room, activeMode)).map(({ id, label, detail }) => ({
        id,
        label,
        detail
    }));
};

export const buildSingerHowToPlay = (room = null) => {
    const featuredGames = getSingerHowToPlayFeaturedGames(room);
    const featuredGameLabels = featuredGames.map((game) => game.label).slice(0, 4);
    const gameItems = featuredGames.length
        ? featuredGames.slice(0, 4).map((game) => `${game.label}: ${game.detail}`)
        : [
            'Karaoke is the main loop: add songs in Songs, then return to Party when a singer starts.',
            'Bonus games take over the room with their own prompts, timers, and vote actions.',
            'Watch both the big screen and your phone so you do not miss live instructions.'
        ];

    return {
        title: 'How the Room Works',
        subtitle: 'Queue first, react during live songs, and jump into room games when they appear.',
        featuredGames,
        sections: [
            {
                eyebrow: 'Start Here',
                title: 'Join and Queue Up',
                items: [
                    'Scan the room QR or open the room link on your phone.',
                    'Pick your emoji avatar and a display name for the queue.',
                    'You land in Songs first so you can search or browse right away.'
                ],
                tip: 'Your name shows in the queue and on the room screen.'
            },
            {
                eyebrow: 'Between Turns',
                title: 'Use Songs While the Stage Is Empty',
                items: [
                    'Search by song or artist in the Songs tab when you are ready to add yourself.',
                    'Use View Queue to track your spot and decide whether to send another pick.',
                    'Keep Tight 15 updated if the room is running bracket or favorite-list play.'
                ],
                tip: 'Party is status-first until the next singer starts.'
            },
            {
                eyebrow: 'Live Stage',
                title: 'Reactions Spend During Performances',
                items: [
                    'Hearts, hype, clap, and cheers are for live singers, not the empty stage.',
                    'Reactions only spend points while someone is performing.',
                    'Premium or supporter access can unlock bigger reaction effects and extras.'
                ],
                tip: 'Save your points while the stage is empty, then spend them when a singer is live.'
            },
            {
                eyebrow: 'Game Night',
                title: featuredGames.length ? 'Tonight\'s Game Deck' : 'Bonus Game Moments',
                items: gameItems,
                tags: featuredGameLabels,
                tip: featuredGames.length
                    ? 'The host can still switch modes, so watch for fresh prompts.'
                    : 'This room is karaoke-first right now, but bonus games can still appear.'
            },
            {
                eyebrow: 'Perks',
                title: 'Keep Your Profile and Perks',
                items: [
                    'Link your email access once to keep your name, emoji, and room balance together.',
                    'Supporter or premium access can unlock saved perks, custom emoji, and bigger reactions.',
                    'Host awards, room bonuses, and game wins can all add to your points during the night.'
                ],
                tip: 'Linking once keeps your identity, points, and unlocked perks together.'
            }
        ]
    };
};

export const HOW_TO_PLAY = buildSingerHowToPlay();
