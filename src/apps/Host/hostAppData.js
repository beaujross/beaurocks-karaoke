import { ASSETS } from '../../lib/assets';
import { HOST_SUBSCRIPTION_PLANS } from '../../billing/hostPlans';

export const DEFAULT_MARQUEE_ITEMS = Object.freeze([
    'Welcome to BROSS Karaoke - scan the QR to join!',
    'Send reactions to hype the singer and light up the stage.',
    'Request a song anytime - the host will pull you up next.',
    'Tip the host to unlock bonus points and VIP perks.',
    'Ready Check incoming - tap READY to earn points.',
    'Share the room code with friends and fill the queue.'
]);

export const DEFAULT_TIP_CRATES = Object.freeze([
    { id: 'crate_small', label: 'Quick Boost', amount: 5, points: 1000, rewardScope: 'buyer', awardBadge: false },
    { id: 'crate_mid', label: 'Crowd Energy', amount: 10, points: 2500, rewardScope: 'room', awardBadge: false },
    { id: 'crate_big', label: 'Room Rager', amount: 20, points: 6000, rewardScope: 'room', awardBadge: true }
]);

export const DEFAULT_LOGO_PRESETS = Object.freeze([
    { id: 'default-bross', label: 'BROSS Default', url: ASSETS.logo },
    { id: 'bross-entertainment', label: 'Bross Entertainment', url: '/images/logo-library/bross-entertainment.png' },
    { id: 'bross-entertainment-chrome', label: 'Bross Chrome', url: '/images/logo-library/bross-entertainment-chrome.png' },
    { id: 'beaurocks-karaoke-logo-2', label: 'Beaurocks Logo 2', url: '/images/logo-library/beaurocks-karaoke-logo-2.png' },
    { id: 'icon-reversed-gradient', label: 'Icon Reversed Gradient', url: '/images/logo-library/icon-reversed-gradient.png' },
    { id: 'bross-ent-favicon-1', label: 'Bross Favicon 1', url: '/images/logo-library/bross-ent-favicon-1.png' },
    { id: 'chatgpt-2026-02-08-032254pm', label: 'ChatGPT Concept 03:22 PM', url: '/images/logo-library/chatgpt-2026-02-08-032254pm.png' },
    { id: 'chatgpt-2026-02-08-103037pm', label: 'ChatGPT Concept 10:30 PM', url: '/images/logo-library/chatgpt-2026-02-08-103037pm.png' },
    { id: 'chatgpt-2026-02-08-115558pm', label: 'ChatGPT Concept 11:55 PM', url: '/images/logo-library/chatgpt-2026-02-08-115558pm.png' }
]);

export const HOST_ONBOARDING_STEPS = Object.freeze([
    { key: 'identity', label: 'Identity' },
    { key: 'plan', label: 'Plan' },
    { key: 'branding', label: 'Branding' },
    { key: 'launch', label: 'Launch' }
]);

export const HOST_ONBOARDING_PLAN_OPTIONS = Object.freeze([
    ...HOST_SUBSCRIPTION_PLANS.map((plan) => ({
        id: plan.id,
        label: plan.label,
        price: plan.priceLabel,
        note: plan.note
    }))
]);

export const SAMPLE_ART = Object.freeze({
    neon: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80',
    crowd: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=200&q=80',
    mic: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=200&q=80',
    stage: 'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=200&q=80',
    guitar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=200&q=80',
    disco: 'https://images.unsplash.com/photo-1504805572947-34fad45aed93?auto=format&fit=crop&w=200&q=80',
    vinyl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=200&q=80',
    lights: 'https://images.unsplash.com/photo-1485579149621-3123dd979885?auto=format&fit=crop&w=200&q=80'
});

export const TOP100_SEED = Object.freeze([
    { title: "Don't Stop Believin'", artist: 'Journey' },
    { title: 'Bohemian Rhapsody', artist: 'Queen' },
    { title: 'Sweet Caroline', artist: 'Neil Diamond' },
    { title: 'I Will Survive', artist: 'Gloria Gaynor' },
    { title: "Livin' on a Prayer", artist: 'Bon Jovi' },
    { title: 'Billie Jean', artist: 'Michael Jackson' },
    { title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd' },
    { title: 'Friends in Low Places', artist: 'Garth Brooks' },
    { title: 'Uptown Funk', artist: 'Bruno Mars' },
    { title: 'Wonderwall', artist: 'Oasis' },
    { title: 'Hey Jude', artist: 'The Beatles' },
    { title: 'My Girl', artist: 'The Temptations' },
    { title: 'Dancing Queen', artist: 'ABBA' },
    { title: 'Girls Just Want to Have Fun', artist: 'Cyndi Lauper' },
    { title: 'I Wanna Dance with Somebody', artist: 'Whitney Houston' },
    { title: 'Respect', artist: 'Aretha Franklin' },
    { title: 'Rolling in the Deep', artist: 'Adele' },
    { title: 'Firework', artist: 'Katy Perry' },
    { title: 'Shake It Off', artist: 'Taylor Swift' },
    { title: "Don't Stop Me Now", artist: 'Queen' },
    { title: 'Summer of 69', artist: 'Bryan Adams' },
    { title: 'Like a Virgin', artist: 'Madonna' },
    { title: 'Total Eclipse of the Heart', artist: 'Bonnie Tyler' },
    { title: "Sweet Child O' Mine", artist: 'Guns N Roses' },
    { title: 'Eye of the Tiger', artist: 'Survivor' },
    { title: 'September', artist: 'Earth Wind and Fire' },
    { title: 'Celebration', artist: 'Kool and The Gang' },
    { title: 'Brown Eyed Girl', artist: 'Van Morrison' },
    { title: 'Take On Me', artist: 'A-ha' },
    { title: 'Another One Bites the Dust', artist: 'Queen' },
    { title: 'With or Without You', artist: 'U2' },
    { title: 'I Love Rock n Roll', artist: 'Joan Jett' },
    { title: 'You Shook Me All Night Long', artist: 'AC/DC' },
    { title: 'Hotel California', artist: 'Eagles' },
    { title: 'Sweet Dreams (Are Made of This)', artist: 'Eurythmics' },
    { title: 'Stand By Me', artist: 'Ben E King' },
    { title: 'Lean on Me', artist: 'Bill Withers' },
    { title: 'Take Me Home, Country Roads', artist: 'John Denver' },
    { title: 'Shallow', artist: 'Lady Gaga' },
    { title: 'Halo', artist: 'Beyonce' },
    { title: 'Crazy in Love', artist: 'Beyonce' },
    { title: 'Since U Been Gone', artist: 'Kelly Clarkson' },
    { title: 'You Belong with Me', artist: 'Taylor Swift' },
    { title: "Stayin' Alive", artist: 'Bee Gees' },
    { title: 'Let It Be', artist: 'The Beatles' },
    { title: 'I Will Always Love You', artist: 'Whitney Houston' },
    { title: 'Torn', artist: 'Natalie Imbruglia' },
    { title: 'Hit Me with Your Best Shot', artist: 'Pat Benatar' },
    { title: "(I've Had) The Time of My Life", artist: 'Bill Medley and Jennifer Warnes' },
    { title: 'Come Together', artist: 'The Beatles' },
    { title: 'Landslide', artist: 'Fleetwood Mac' },
    { title: 'Go Your Own Way', artist: 'Fleetwood Mac' },
    { title: 'Dreams', artist: 'Fleetwood Mac' },
    { title: 'Crazy', artist: 'Gnarls Barkley' },
    { title: 'Mr. Brightside', artist: 'The Killers' },
    { title: 'Valerie', artist: 'Amy Winehouse' },
    { title: 'Rehab', artist: 'Amy Winehouse' },
    { title: 'All Star', artist: 'Smash Mouth' },
    { title: 'Livin La Vida Loca', artist: 'Ricky Martin' },
    { title: 'Bye Bye Bye', artist: 'NSYNC' },
    { title: 'Wannabe', artist: 'Spice Girls' },
    { title: 'No Scrubs', artist: 'TLC' },
    { title: 'Waterfalls', artist: 'TLC' },
    { title: 'Killing Me Softly', artist: 'Fugees' },
    { title: 'My Heart Will Go On', artist: 'Celine Dion' },
    { title: 'Genie in a Bottle', artist: 'Christina Aguilera' },
    { title: 'Believe', artist: 'Cher' },
    { title: "I'm Yours", artist: 'Jason Mraz' },
    { title: 'Say My Name', artist: "Destiny's Child" },
    { title: 'Single Ladies', artist: 'Beyonce' },
    { title: 'Poker Face', artist: 'Lady Gaga' },
    { title: 'Bad Romance', artist: 'Lady Gaga' },
    { title: 'Somebody to Love', artist: 'Queen' },
    { title: 'Beat It', artist: 'Michael Jackson' },
    { title: 'Man in the Mirror', artist: 'Michael Jackson' },
    { title: 'Smooth', artist: 'Santana' },
    { title: 'Faith', artist: 'George Michael' },
    { title: 'Under the Bridge', artist: 'Red Hot Chili Peppers' },
    { title: 'Losing My Religion', artist: 'REM' },
    { title: 'Creep', artist: 'Radiohead' },
    { title: 'The Middle', artist: 'Jimmy Eat World' },
    { title: 'Sk8er Boi', artist: 'Avril Lavigne' },
    { title: 'Complicated', artist: 'Avril Lavigne' },
    { title: 'Ironic', artist: 'Alanis Morissette' },
    { title: 'Hand in My Pocket', artist: 'Alanis Morissette' },
    { title: 'The Scientist', artist: 'Coldplay' },
    { title: 'Yellow', artist: 'Coldplay' },
    { title: 'Viva La Vida', artist: 'Coldplay' },
    { title: 'Drops of Jupiter', artist: 'Train' },
    { title: 'Hey Ya!', artist: 'OutKast' },
    { title: 'Ms. Jackson', artist: 'OutKast' },
    { title: 'I Gotta Feeling', artist: 'Black Eyed Peas' },
    { title: 'No Diggity', artist: 'Blackstreet' },
    { title: 'Yeah!', artist: 'Usher' },
    { title: 'Enter Sandman', artist: 'Metallica' },
    { title: 'Nothing Else Matters', artist: 'Metallica' },
    { title: 'Purple Rain', artist: 'Prince' },
    { title: 'Tennessee Whiskey', artist: 'Chris Stapleton' },
    { title: 'Before He Cheats', artist: 'Carrie Underwood' },
    { title: 'Take My Breath Away', artist: 'Berlin' }
]);
