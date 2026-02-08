/**
 * Game Data Constants
 * Extracted from HostApp to prevent recreation on every render
 * 
 * Phase 1: Performance Optimization
 */

// Background music tracks for host
export const BG_TRACKS = [ 
    { name: "Retro Lounge", url: "https://beauross.com/wp-content/uploads/retro-lounge-389644.mp3" }, 
    { name: "Inspiring Synth", url: "https://beauross.com/wp-content/uploads/inspiring-motivation-synthwave-398285.mp3" }, 
    { name: "80s Retro", url: "https://beauross.com/wp-content/uploads/synthwave-80s-retro-background-music-400483.mp3" }, 
    { name: "Synth BG", url: "https://beauross.com/wp-content/uploads/synthwave-background-music-155701.mp3" }, 
    { name: "Classic 80s", url: "https://beauross.com/wp-content/uploads/2023/09/synthwave-80s-110045.mp3" }, 
    { name: "Chill", url: "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3" } 
];

// Sound effects for host control panel
export const SOUNDS = [ 
    { name: "Airhorn", icon: "fa-bullhorn", url: "https://beauross.com/wp-content/uploads/dj-airhorn-sound-39405.mp3" }, 
    { name: "Applause", icon: "fa-hands-clapping", url: "https://beauross.com/wp-content/uploads/1185_applause-02-1.mp3" }, 
    { name: "Fail", icon: "fa-thumbs-down", url: "https://beauross.com/wp-content/uploads/fail-trumpet-242645.mp3" }, 
    { name: "Fail 2", icon: "fa-circle-down", url: "https://beauross.com/wp-content/uploads/whistle-slide-down-02-350715-1-1.mp3" }, 
    { name: "Drumroll", icon: "fa-drum", url: "https://beauross.com/wp-content/uploads/1415_dhol-drums-01.mp3" }, 
    { name: "Crickets", icon: "fa-bug", url: "https://beauross.com/wp-content/uploads/cricket-chirps-331498.mp3" }, 
    { name: "Laugh", icon: "fa-face-laugh-squint", url: "https://beauross.com/wp-content/uploads/1825_laughter-01.mp3" }, 
    { name: "Rimshot", icon: "fa-drum-steelpan", url: "https://beauross.com/wp-content/uploads/ba-dum-tss-8279.mp3" }, 
    { name: "Cheer", icon: "fa-users", url: "https://beauross.com/wp-content/uploads/1194_crowd-cheering-01.mp3" }, 
    { name: "Boo", icon: "fa-thumbs-down", url: "https://beauross.com/wp-content/uploads/boo-6377.mp3" }, 
    { name: "Scratch", icon: "fa-compact-disc", url: "https://beauross.com/wp-content/uploads/1448_record-scratch-01.mp3" }, 
    { name: "My Way", icon: "fa-microphone", url: "https://beauross.com/wp-content/uploads/my-way-2008-remastered-made-with-Voicemod.mp3" }, 
    { name: "Sax Sexy", icon: "fa-music", url: "https://beauross.com/wp-content/uploads/sax-sexy-made-with-Voicemod.mp3" }, 
    { name: "Crowd Cheer", icon: "fa-hands-clapping", url: "https://beauross.com/wp-content/uploads/applause-crowd-cheer-made-with-Voicemod.mp3" }, 
    { name: "Boss Battle", icon: "fa-skull", url: "https://beauross.com/wp-content/uploads/boss-battle-music-made-with-Voicemod.mp3" }, 
    { name: "Cowbell", icon: "fa-bell", url: "https://beauross.com/wp-content/uploads/cowbell-made-with-Voicemod.mp3" }, 
    { name: "I Just Died", icon: "fa-heart", url: "https://beauross.com/wp-content/uploads/i-just-died-in-your-arms-made-with-Voicemod.mp3" }, 
    { name: "Hoa Hoa Hoa", icon: "fa-ghost", url: "https://beauross.com/wp-content/uploads/hoa-hoa-hoa-made-with-Voicemod.mp3" }, 
    { name: "Drowning", icon: "fa-water", url: "https://beauross.com/wp-content/uploads/sonic-drowning-made-with-Voicemod.mp3" } 
];

// Trivia questions for trivia game
export const TRIVIA_BANK = [
    { q: "Who is the 'Queen of Pop'?", correct: "Madonna", w1: "Lady Gaga", w2: "Beyoncé", w3: "Britney Spears" },
    { q: "Which band wrote 'Bohemian Rhapsody'?", correct: "Queen", w1: "The Beatles", w2: "Led Zeppelin", w3: "Pink Floyd" },
    { q: "What is the best-selling album of all time?", correct: "Thriller", w1: "Back in Black", w2: "The Dark Side of the Moon", w3: "The Bodyguard" },
    { q: "Who sang 'I Will Always Love You' first?", correct: "Dolly Parton", w1: "Whitney Houston", w2: "Celine Dion", w3: "Mariah Carey" },
    { q: "Finish the lyric: 'Just a small town girl...'", correct: "Livin' in a lonely world", w1: "Born and raised in South Detroit", w2: "Took the midnight train", w3: "She took the midnight train" }
];

// "Would You Rather" questions
export const WYR_BANK = [
    { q: "Sing every song in falsetto OR Sing every song like a death metal growl?", a: "Falsetto", b: "Death Metal" },
    { q: "Forget the lyrics to your favorite song OR Trip on stage every time you sing?", a: "Forget Lyrics", b: "Trip on Stage" },
    { q: "Have a voice like Mariah Carey but no rhythm OR Have moves like MJ but tone deaf?", a: "Voice", b: "Moves" },
    { q: "Only be able to sing Nickelback OR Only be able to sing Baby Shark?", a: "Nickelback", b: "Baby Shark" }
];
