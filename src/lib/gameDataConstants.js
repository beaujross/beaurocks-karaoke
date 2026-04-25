/**
 * Game Data Constants
 * Extracted from HostApp to prevent recreation on every render
 * 
 * Phase 1: Performance Optimization
 */

// Background music tracks for host
export const BG_TRACKS = [ 
    { name: "Lantern Circuit", url: "/audio/Lantern%20Circuit.mp3" },
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
    { q: "Who is the 'Queen of Pop'?", correct: "Madonna", w1: "Lady Gaga", w2: "Beyonce", w3: "Britney Spears" },
    { q: "Which band wrote 'Bohemian Rhapsody'?", correct: "Queen", w1: "The Beatles", w2: "Led Zeppelin", w3: "Pink Floyd" },
    { q: "What is the best-selling album of all time?", correct: "Thriller", w1: "Back in Black", w2: "The Dark Side of the Moon", w3: "The Bodyguard" },
    { q: "Who sang 'I Will Always Love You' first?", correct: "Dolly Parton", w1: "Whitney Houston", w2: "Celine Dion", w3: "Mariah Carey" },
    { q: "Which artist released 'Purple Rain' as both an album and a movie?", correct: "Prince", w1: "David Bowie", w2: "George Michael", w3: "Lionel Richie" },
    { q: "Which group made 'Dancing Queen' a karaoke dance-floor staple?", correct: "ABBA", w1: "Fleetwood Mac", w2: "Blondie", w3: "The Go-Go's" },
    { q: "Which singer is widely nicknamed 'The Boss'?", correct: "Bruce Springsteen", w1: "Billy Joel", w2: "Bob Seger", w3: "John Mellencamp" },
    { q: "Which band released the karaoke anthem 'Don't Stop Believin'?", correct: "Journey", w1: "Foreigner", w2: "Boston", w3: "REO Speedwagon" },
    { q: "Which song is the classic internet 'Rickroll'?", correct: "Never Gonna Give You Up", w1: "Take On Me", w2: "Africa", w3: "Sweet Dreams" },
    { q: "Which artist's fans are commonly called Swifties?", correct: "Taylor Swift", w1: "Ariana Grande", w2: "Sabrina Carpenter", w3: "Olivia Rodrigo" },
    { q: "Which rapper starred in the movie '8 Mile'?", correct: "Eminem", w1: "Dr. Dre", w2: "Snoop Dogg", w3: "50 Cent" },
    { q: "Which artist made 'Single Ladies' a hand-wave anthem?", correct: "Beyonce", w1: "Rihanna", w2: "Alicia Keys", w3: "Ciara" },
    { q: "Which country icon is connected to Dollywood?", correct: "Dolly Parton", w1: "Reba McEntire", w2: "Shania Twain", w3: "Faith Hill" },
    { q: "Which instrument has 88 keys?", correct: "Piano", w1: "Guitar", w2: "Saxophone", w3: "Violin" },
    { q: "Which band made 'Mr. Brightside' a forever karaoke closer?", correct: "The Killers", w1: "The Strokes", w2: "Arctic Monkeys", w3: "Franz Ferdinand" }
];

// "Would You Rather" questions
export const WYR_BANK = [
    { q: "Sing every song in falsetto OR Sing every song like a death metal growl?", a: "Falsetto", b: "Death Metal" },
    { q: "Forget the lyrics to your favorite song OR Trip on stage every time you sing?", a: "Forget Lyrics", b: "Trip on Stage" },
    { q: "Have a voice like Mariah Carey but no rhythm OR Have moves like MJ but tone deaf?", a: "Voice", b: "Moves" },
    { q: "Only be able to sing Nickelback OR Only be able to sing Baby Shark?", a: "Nickelback", b: "Baby Shark" },
    { q: "Win every karaoke round OR Own the final encore singalong?", a: "Win Every Round", b: "Own The Encore" },
    { q: "Do a perfect Britney-style choreo routine OR Hit every high note dead-on?", a: "Perfect Choreo", b: "Perfect Notes" },
    { q: "Open the night with a power ballad OR Close the night with a rap verse?", a: "Open With Ballad", b: "Close With Rap" },
    { q: "Be the best duet partner in the room OR Be the best solo closer in the room?", a: "Best Duet Partner", b: "Best Solo Closer" },
    { q: "Sing one iconic 80s anthem OR one huge 2000s pop hit for the rest of the year?", a: "80s Anthem", b: "2000s Pop Hit" },
    { q: "Have the crowd scream your name before you start OR sing every chorus back at you?", a: "Crowd Intro", b: "Crowd Chorus" },
    { q: "Nail the key change OR nail the final pose?", a: "Key Change", b: "Final Pose" },
    { q: "Take a guaranteed standing ovation OR win the loudest applause meter all night?", a: "Standing Ovation", b: "Applause Meter" },
    { q: "Be remembered for one legendary note OR one legendary stage move?", a: "Legendary Note", b: "Legendary Move" },
    { q: "Sing only throwback anthems tonight OR only current chart songs tonight?", a: "Throwback Anthems", b: "Current Charts" },
    { q: "Get first pick of every song OR always get the ideal slot in the lineup?", a: "First Song Pick", b: "Best Lineup Slot" }
];
