import FlappyGame from '../games/FlappyBird/Game';
import BingoGame from '../games/Bingo/Game';
import QAGame from '../games/QA/Game'; // The new file
import VocalChallengeGame from '../games/VocalChallenge/Game';
import RidingScalesGame from '../games/RidingScales/Game';

export const GAME_REGISTRY = {
    'flappy_bird': FlappyGame, 
    'vocal_challenge': VocalChallengeGame,
    'riding_scales': RidingScalesGame,
    'bingo': BingoGame,
    // Map multiple modes to the same "Cartridge"
    'trivia_pop': QAGame,
    'trivia_reveal': QAGame,
    'wyr': QAGame,
    'wyr_reveal': QAGame
};

// Comprehensive game metadata for unified UI
export const GAMES_META = [
    {
        id: 'doodle_oke',
        name: 'Doodle-oke',
        description: 'Draw the prompt, hum the answer, let the crowd guess',
        goal: 'Draw the lyric clue and get the room to guess.',
        howToPlay: 'Players draw, audience votes on the best match.',
        playModes: ['Round robin prompts', 'Custom prompt'],
        icon: 'DRAW',
        category: 'voice',
        badge: 'Draw',
        color: 'cyan',
        hasConfig: true,
        needsVoice: true,
    },
    {
        id: 'flappy_bird',
        name: 'Flappy Bird',
        description: 'Navigate obstacles with your voice. Play as crowd or solo singer',
        goal: 'Keep the bird flying and rack up points.',
        howToPlay: 'Sing louder to rise, softer to fall.',
        playModes: ['Crowd mic', 'Solo singer'],
        icon: 'BIRD',
        category: 'voice',
        badge: 'Voice',
        color: 'cyan',
        hasConfig: true,
        needsVoice: true,
    },
    {
        id: 'vocal_challenge',
        name: 'Vocal Challenge',
        description: 'Match vocal ranges and hit targets with your voice',
        goal: 'Collect coins by staying on pitch.',
        howToPlay: 'Match the target notes to keep the streak alive.',
        playModes: ['Crowd mic', 'Solo singer'],
        icon: 'VOCAL',
        category: 'voice',
        badge: 'Voice',
        color: 'pink',
        hasConfig: true,
        needsVoice: true,
    },
    {
        id: 'riding_scales',
        name: 'Riding Scales',
        description: 'Sing musical scales perfectly or face strikes',
        goal: 'Repeat the scale pattern without mistakes.',
        howToPlay: 'Listen to the pattern, then sing it back.',
        playModes: ['Crowd mode', 'Spotlight turns'],
        icon: 'SCALE',
        category: 'voice',
        badge: 'Voice',
        color: 'cyan',
        hasConfig: true,
        needsVoice: true,
    },
    {
        id: 'trivia_pop',
        name: 'Trivia',
        description: 'Multiple choice questions about music, movies, and more',
        goal: 'Answer correctly before time runs out.',
        howToPlay: 'Pick A, B, C, or D on your phone.',
        playModes: ['All players', 'Selected players'],
        icon: 'TRIVIA',
        category: 'brain',
        badge: 'Questions',
        color: 'amber',
        hasConfig: true,
        needsVoice: false,
    },
    {
        id: 'wyr',
        name: 'Would You Rather',
        description: 'Vote on hilarious either/or scenarios',
        goal: 'Choose A or B and see the crowd split.',
        howToPlay: 'Vote once per round.',
        playModes: ['All players', 'Selected players'],
        icon: 'WYR',
        category: 'brain',
        badge: 'Voting',
        color: 'amber',
        hasConfig: true,
        needsVoice: false,
    },
    {
        id: 'bingo',
        name: 'Bingo',
        description: 'Mark squares to complete lines, corners, or blackout',
        goal: 'Complete a line, corners, or blackout first.',
        howToPlay: 'Suggest a tile when it happens on stage.',
        playModes: ['Classic', 'Mystery'],
        icon: 'BINGO',
        category: 'brain',
        badge: 'Marks',
        color: 'emerald',
        hasConfig: true,
        needsVoice: false,
    },
    {
        id: 'selfie_challenge',
        name: 'Selfie Challenge',
        description: 'Photo challenges and crowd votes',
        goal: 'Capture the best reaction and win votes.',
        howToPlay: 'Submit a selfie, then vote on the wall.',
        playModes: ['Approval queue', 'Auto voting'],
        icon: 'SELFIE',
        category: 'social',
        badge: 'Photos',
        color: 'rose',
        hasConfig: true,
        needsVoice: false,
    },
];

export const GAME_CATEGORIES = {
    voice: {
        name: 'Voice Games',
        icon: 'VOICE',
        description: 'Games powered by singing and pitch detection',
    },
    brain: {
        name: 'Brain Games',
        icon: 'BRAIN',
        description: 'Trivia, voting, and strategy games',
    },
    social: {
        name: 'Social Games',
        icon: 'SOCIAL',
        description: 'Photo challenges and crowd interactions',
    },
};

export const getGameById = (id) => GAMES_META.find(g => g.id === id);
export const getGamesByCategory = (category) => GAMES_META.filter(g => g.category === category);
export const getGameCategories = () => Object.values(GAME_CATEGORIES);
