import FlappyGame from '../games/FlappyBird/Game';
import BingoGame from '../games/Bingo/Game';
import QAGame from '../games/QA/Game'; // The new file
import VocalChallengeGame from '../games/VocalChallenge/Game';
import RidingScalesGame from '../games/RidingScales/Game';
import KaraokeBracketGame from '../games/KaraokeBracket/Game';

export const GAME_REGISTRY = {
    'flappy_bird': FlappyGame, 
    'vocal_challenge': VocalChallengeGame,
    'riding_scales': RidingScalesGame,
    'bingo': BingoGame,
    'karaoke_bracket': KaraokeBracketGame,
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
        description: 'Sketch the lyric clue, let the room guess, then vote.',
        goal: 'Get the best guess and most votes.',
        howToPlay: 'Draw fast, reveal later, crowd picks a winner.',
        playModes: ['Round robin', 'Custom prompt'],
        icon: 'fa-solid fa-pen-ruler',
        category: 'voice',
        badge: 'Draw',
        color: 'cyan',
        hasConfig: true,
        needsVoice: true,
    },
    {
        id: 'flappy_bird',
        name: 'Flappy Bird',
        description: 'Voice volume steers flight through obstacle runs.',
        goal: 'Stay alive and climb score.',
        howToPlay: 'Louder rises, softer drops.',
        playModes: ['Crowd mic', 'Solo singer'],
        icon: 'fa-solid fa-feather-pointed',
        category: 'voice',
        badge: 'Voice',
        color: 'cyan',
        hasConfig: true,
        needsVoice: true,
    },
    {
        id: 'vocal_challenge',
        name: 'Vocal Challenge',
        description: 'Hit moving pitch targets to stack streak points.',
        goal: 'Keep pitch lock and collect points.',
        howToPlay: 'Match note lanes before they pass.',
        playModes: ['Crowd mic', 'Solo singer'],
        icon: 'fa-solid fa-wave-square',
        category: 'voice',
        badge: 'Voice',
        color: 'pink',
        hasConfig: true,
        needsVoice: true,
    },
    {
        id: 'riding_scales',
        name: 'Riding Scales',
        description: 'Repeat scale patterns cleanly before strikes end your run.',
        goal: 'Survive rounds with clean scale repeats.',
        howToPlay: 'Hear pattern, sing it back, avoid strikeouts.',
        playModes: ['Crowd mode', 'Spotlight turns'],
        icon: 'fa-solid fa-music',
        category: 'voice',
        badge: 'Voice',
        color: 'cyan',
        hasConfig: true,
        needsVoice: true,
    },
    {
        id: 'trivia_pop',
        name: 'Trivia',
        description: 'Timed A/B/C/D rounds with fast scoreboard swings.',
        goal: 'Lock correct answers before timer hits zero.',
        howToPlay: 'Choose A, B, C, or D each round.',
        playModes: ['All players', 'Selected players'],
        icon: 'fa-solid fa-circle-question',
        category: 'brain',
        badge: 'Questions',
        color: 'amber',
        hasConfig: true,
        needsVoice: false,
    },
    {
        id: 'wyr',
        name: 'Would You Rather',
        description: 'Instant A vs B crowd votes for big room reactions.',
        goal: 'Force the room to pick a side.',
        howToPlay: 'Vote once, then watch the split.',
        playModes: ['All players', 'Selected players'],
        icon: 'fa-solid fa-scale-balanced',
        category: 'brain',
        badge: 'Voting',
        color: 'amber',
        hasConfig: true,
        needsVoice: false,
    },
    {
        id: 'bingo',
        name: 'Bingo',
        description: 'Mark live stage moments and chase line/corners/blackout.',
        goal: 'Complete the selected win pattern first.',
        howToPlay: 'Tap matching moments as they happen.',
        playModes: ['Classic', 'Mystery'],
        icon: 'fa-solid fa-table-cells-large',
        category: 'brain',
        badge: 'Marks',
        color: 'emerald',
        hasConfig: true,
        needsVoice: false,
    },
    {
        id: 'karaoke_bracket',
        name: 'Sweet 16 Bracket',
        description: 'Head-to-head elimination from singer Tight 15 match picks.',
        goal: 'Advance rounds and crown one champion.',
        howToPlay: 'Seed bracket, run matches, set winners.',
        playModes: ['Auto seed', '1v1 matches'],
        icon: 'fa-solid fa-trophy',
        category: 'social',
        badge: 'Tournament',
        color: 'rose',
        hasConfig: true,
        needsVoice: false,
    },
    {
        id: 'selfie_challenge',
        name: 'Selfie Challenge',
        description: 'Prompted selfie rounds with crowd voting and reveal.',
        goal: 'Capture the best shot and win votes.',
        howToPlay: 'Submit photo, then vote the wall.',
        playModes: ['Approval queue', 'Auto voting'],
        icon: 'fa-solid fa-camera-retro',
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
