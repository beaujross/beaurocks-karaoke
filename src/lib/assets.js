import { emoji } from './emoji';

export const APP_ID = 'bross-app';
const BASE_URL = import.meta.env.BASE_URL || '/';
const localAsset = (path) => `${BASE_URL}${String(path || '').replace(/^\/+/, '')}`;

export const ASSETS = { 
    logo: "https://beauross.com/wp-content/uploads/Icon-Reversed-gradient-small.png", 
    venmoQr: "https://beauross.com/wp-content/uploads/2025/08/MyVenmoQRCode-2.png" 
};

export const GAME_ASSETS = { 
    coin: "https://beauross.com/wp-content/uploads/audio_121db7b43f.mp3", 
    fail: "https://beauross.com/wp-content/uploads/fail-trumpet-242645.mp3" 
};

export const AVATARS = [
    emoji(0x1F600),
    emoji(0x1F60E),
    emoji(0x1F920),
    emoji(0x1F47D),
    emoji(0x1F916),
    emoji(0x1F47B),
    emoji(0x1F984),
    emoji(0x1F42F),
    emoji(0x1F436),
    emoji(0x1F3A4),
    emoji(0x1F3A7),
    emoji(0x1F3B8),
    emoji(0x1F3B9),
    emoji(0x1F941),
    emoji(0x1F3B7),
    emoji(0x1F3BA),
    emoji(0x1F98A),
    emoji(0x1F43B),
    emoji(0x1F428),
    emoji(0x1F981)
];

export const STORM_SOUND_URL = localAsset('audio/storm/rain-and-thunder-ambience.mp3');
export const STORM_SFX = {
    lightRain: localAsset('audio/storm/rain-and-thunder-ambience.mp3'),
    stormLoop: localAsset('audio/storm/rain-and-thunder-ambience.mp3'),
    thunder: localAsset('audio/storm/thunder.mp3'),
    rollingThunder: localAsset('audio/storm/rolling-thunder.mp3'),
    bigDrops: localAsset('audio/storm/big-rain-drops.mp3')
};

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
