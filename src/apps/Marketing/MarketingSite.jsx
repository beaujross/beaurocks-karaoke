import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ASSETS } from '../../lib/assets';
import { submitMarketingWaitlist, trackEvent } from '../../lib/firebase';
import './marketing.css';

const NAV_ITEMS = [
    { id: 'visuals', label: 'Visuals' },
    { id: 'screens', label: 'Screens' },
    { id: 'surfaces', label: 'Surfaces' },
    { id: 'voice-games', label: 'Voice Games' },
    { id: 'host-features', label: 'Host Features' },
    { id: 'modes', label: 'Modes' },
    { id: 'fundraisers', label: 'Fundraisers' },
    { id: 'vip', label: 'VIP' },
    { id: 'plans', label: 'Host Plans' },
    { id: 'waitlist', label: 'Get Access' }
];

const GAMES_PAGE = 'games';

const SURFACES = [
    {
        title: 'Public Screen',
        subtitle: 'What the whole room feels',
        body: 'Show songs, overlays, game prompts, and tournament moments in one polished visual layer that everyone can follow.',
        stat: 'Room-wide shared context'
    },
    {
        title: 'Host Panel',
        subtitle: 'The control center',
        body: 'Run queue, presets, overlays, games, and pacing without juggling five apps or hunting through complicated controls.',
        stat: 'One host, full command'
    },
    {
        title: 'Audience App',
        subtitle: 'Participation without pressure',
        body: 'Guests vote, play bingo/trivia, react, and stay involved even when they are not the singer on stage.',
        stat: 'Everyone has a role'
    }
];

const PRODUCT_VISUALS = [
    {
        id: 'host',
        title: 'Host Panel - Live Capture',
        image: '/images/marketing/BeauRocks-HostPanel.png',
        caption: 'The host control center for queue, overlays, presets, and game flow.',
        href: '?mode=host'
    },
    {
        id: 'tv',
        title: 'Public Screen - Live Capture',
        image: '/images/marketing/tv-surface-live.png',
        caption: 'The room-facing display with visualizer and game overlays.',
        href: '?mode=tv&room=DEMO'
    },
    {
        id: 'audience',
        title: 'Audience App - Live Capture',
        image: '/images/marketing/BeauRocks-Audienceapp.png',
        caption: 'Phone-first join flow where guests react and participate.',
        href: '?room=DEMO',
        kind: 'phone'
    }
];

const SCREEN_DEEP_DIVES = [
    {
        id: 'screen-host',
        title: 'Host Panel',
        image: '/images/marketing/BeauRocks-HostPanel.png',
        detail: 'Mission control for queue, overlays, game orchestration, and room policy.',
        callouts: [
            { label: 'Rotation Queue', note: 'Keep turns fair while prioritizing first-timers.', x: 22, y: 28 },
            { label: 'Now Playing + Actions', note: 'Advance, hold, and adjust stage state quickly.', x: 52, y: 20 },
            { label: 'Host Shortcuts', note: 'One-tap presets for night tone and game pacing.', x: 81, y: 13 },
            { label: 'Audience TV Preview', note: 'Live mirror of what guests are seeing right now.', x: 82, y: 74 }
        ],
        points: [
            'Queue manager with rotation and first-time boost rules',
            'Host night presets (Casual, Competition, Bingo, Trivia)',
            'Live audience preview thumbnail so host sees what TV sees',
            'One-click game launch + game preview from Games tab'
        ]
    },
    {
        id: 'screen-tv',
        title: 'Public Screen',
        image: '/images/marketing/tv-surface-live.png',
        detail: 'The shared room canvas for lyrics, visualizer, game states, and crowd energy.',
        callouts: [
            { label: 'Hero Visual Layer', note: 'Big-room color and motion that keeps attention high.', x: 22, y: 24 },
            { label: 'Prompt / Lyrics Zone', note: 'Game prompts and lyric overlays stay legible from distance.', x: 53, y: 45 },
            { label: 'Live Status Rail', note: 'Audience always knows what phase the night is in.', x: 78, y: 74 }
        ],
        points: [
            'Visualizer + lyrics can run together',
            'Game overlays for trivia, bingo, and bracket transitions',
            'Host-controlled spotlight moments and recap previews',
            'Audience-facing state is always synchronized from host controls'
        ]
    },
    {
        id: 'screen-audience',
        title: 'Audience App',
        image: '/images/marketing/BeauRocks-Audienceapp.png',
        detail: 'Low-friction mobile participation for singing and non-singing guests.',
        callouts: [
            { label: 'Identity Picker', note: 'Guests pick a vibe before they even sing.', x: 49, y: 52 },
            { label: 'Fast Join Form', note: 'Room-ready in seconds with minimal friction.', x: 48, y: 73 },
            { label: 'Primary CTA', note: 'Single clear action to join the active party.', x: 49, y: 86 }
        ],
        points: [
            'Join quickly with room code + profile identity',
            'Vote, react, and participate in game rounds from phone',
            'Tight 15 and bracket interactions for recurring guests',
            'Family/friend event-friendly participation model beyond stage singing'
        ]
    }
];

const VOICE_GAME_MODES = [
    {
        id: 'voice-doodle',
        name: 'Doodle-oke',
        tagline: 'Draw the clue. Hum the answer.',
        details: 'Draw prompts and let the crowd decode lyric hints in a voice-first party format.'
    },
    {
        id: 'voice-flappy',
        name: 'Flappy Bird (Voice)',
        tagline: 'Pitch controls flight.',
        details: 'Crowd mic or solo singer mode turns volume/pitch into arcade control input.'
    },
    {
        id: 'voice-vocal',
        name: 'Vocal Challenge',
        tagline: 'Hit target ranges and keep streak.',
        details: 'Timed vocal rounds with difficulty and guide-tone options managed by host.'
    },
    {
        id: 'voice-scales',
        name: 'Riding Scales',
        tagline: 'Repeat and survive the pattern.',
        details: 'Scale memory and pitch precision mode with strike pressure and spotlight turns.'
    }
];

const HOST_FEATURE_STACK = [
    'Host presets that apply queue rules, overlays, and game defaults in one click.',
    'Queue policy controls: limit modes, rotation strategy, and first-time singer boost.',
    'Audience-facing preview panel inside host view to reduce state confusion.',
    'TV Dashboard: visualizer source/mode/preset, lyrics mode, and sensitivity controls.',
    'Auto-lyrics on queue for missing lyric data + manual lyric edit paths.',
    'Tight 15 spotlight queue tools + Sweet 16 bracket seeding and no-show resolution.',
    'Close-room recap generation with tournament time capsule support.',
    'Billing/workspace controls for host subscriptions and usage visibility.'
];

const GAMES_PAGE_GUIDES = [
    {
        id: 'games-karaoke',
        mode: 'Karaoke Flow',
        modePage: 'mode-karaoke',
        tone: 'Casual + Competition presets',
        clipLabel: 'Host queue and TV state sync',
        clipImage: '/images/marketing/BeauRocks-HostPanel.png',
        clipKind: 'desktop',
        hostSteps: [
            'Open preset to lock pacing, queue limits, and overlay defaults.',
            'Advance singer flow with next-up context shown on TV.',
            'Use recap markers during standout moments.'
        ],
        audienceSteps: [
            'Join from phone and react without interrupting stage flow.',
            'Track current/next singer on the public surface.',
            'Stay engaged between songs with visible room state.'
        ]
    },
    {
        id: 'games-bingo',
        mode: 'Karaoke Bingo',
        modePage: 'mode-bingo',
        tone: 'Crowd-observation mode',
        clipLabel: 'Audience board + host event triggers',
        clipImage: '/images/marketing/BeauRocks-Audienceapp.png',
        clipKind: 'phone',
        hostSteps: [
            'Select board pack and keep bingo reopenable all night.',
            'Trigger board events from host panel without pausing queue.',
            'Resolve winners with clear TV confirmation moments.'
        ],
        audienceSteps: [
            'Check off observed moments from any table in-room.',
            'Compete without needing to sing or approach stage.',
            'Reopen board anytime while karaoke continues.'
        ]
    },
    {
        id: 'games-trivia',
        mode: 'Trivia Rounds',
        modePage: 'mode-trivia',
        tone: 'Structured timed reveals',
        clipLabel: 'Round timer + answer reveal rhythm',
        clipImage: '/images/marketing/tv-surface-live.png',
        clipKind: 'desktop',
        hostSteps: [
            'Queue a timed round and set auto-reveal behavior.',
            'Move between question, lock, reveal, and summary states.',
            'Return to karaoke flow without losing audience context.'
        ],
        audienceSteps: [
            'Answer from phone in synced windows.',
            'Watch reveal and score movement on public screen.',
            'Re-enter the next round immediately.'
        ]
    },
    {
        id: 'games-tight15',
        mode: 'Tight 15',
        modePage: 'mode-tight15',
        tone: 'Identity + recurring guests',
        clipLabel: 'Singer profile spotlight moment',
        clipImage: '/images/marketing/audience-surface-live.png',
        clipKind: 'desktop',
        hostSteps: [
            'Use Tight 15 picks for spotlight and matchup selection.',
            'Keep singer identity visible while rotating queue.',
            'Bridge regulars across multiple events and rooms.'
        ],
        audienceSteps: [
            'Learn singer style and recurring favorites quickly.',
            'Vote/react around familiar songs and rivalry arcs.',
            'Track progression across recap moments.'
        ]
    },
    {
        id: 'games-bracket',
        mode: 'Sweet 16 Bracket',
        modePage: 'mode-bracket',
        tone: 'Tournament event arc',
        clipLabel: 'Bracket progression + matchup transitions',
        clipImage: '/images/marketing/tv-surface-live.png',
        clipKind: 'desktop',
        hostSteps: [
            'Seed participants manually or from eligible singer pool.',
            'Handle no-shows with forfeit and replacement controls.',
            'Finalize winners with full timeline + recap export.'
        ],
        audienceSteps: [
            'Follow bracket status from the public display.',
            'React and vote during head-to-head matchups.',
            'Stay oriented through round transitions.'
        ]
    },
    {
        id: 'games-voice',
        mode: 'Voice Arcade Modes',
        tone: 'Doodle-oke + Flappy Voice + Vocal Challenge + Riding Scales',
        clipLabel: 'Voice input drives gameplay outcomes',
        clipImage: '/images/marketing/app-landing-live.png',
        clipKind: 'phone',
        hostSteps: [
            'Choose a voice mode and set difficulty or timer profile.',
            'Control turn order and challenge escalation from host panel.',
            'Inject quick rounds between songs to keep momentum high.'
        ],
        audienceSteps: [
            'Participate live from phone or shared mic moments.',
            'Stay active even when not on stage.',
            'Build room energy with low-friction mini-competitions.'
        ]
    }
];

const MODE_DETAILS = [
    {
        key: 'karaoke',
        page: 'mode-karaoke',
        title: 'Karaoke',
        blurb: 'Fast queue, smooth handoffs, better performer flow.',
        headline: 'Modern Karaoke Flow For Private Parties',
        summary: 'Move beyond awkward bar-style turns. Hosts keep the show moving while performers and crowd stay energized.',
        hostFlow: [
            'Build and reorder queue from one panel.',
            'Run overlays and stage visuals from the same place.',
            'Use host presets for casual or competition pacing.'
        ],
        audienceFlow: [
            'React and engage from phone without taking over the room.',
            'Stay informed with public-screen context and transitions.',
            'Join singing when ready instead of waiting in confusion.'
        ],
        fundraiserFlow: [
            'Sponsor a song slot for premium donors.',
            'Use recap highlights to extend post-event momentum.'
        ]
    },
    {
        key: 'bingo',
        page: 'mode-bingo',
        title: 'Karaoke Bingo',
        blurb: 'Crowd-observed checkoffs that keep every table engaged.',
        headline: 'Bingo Built For The Crowd, Not Just The Stage',
        summary: 'Audience members track what they observe, turning passive watching into active social play.',
        hostFlow: [
            'Launch themed bingo boards from host controls.',
            'Set board style based on the room vibe.',
            'Keep bingo available so audience can reopen during night flow.'
        ],
        audienceFlow: [
            'Check off moments in real time from mobile.',
            'Compete at table-level without interrupting singers.',
            'Participate even if never stepping on stage.'
        ],
        fundraiserFlow: [
            'Sell bingo cards with bonus card upsells.',
            'Add sponsored squares for local partners.'
        ]
    },
    {
        key: 'trivia',
        page: 'mode-trivia',
        title: 'Trivia',
        blurb: 'Host-led rounds with reveal moments and score drama.',
        headline: 'Trivia Rounds That Fit Party Rhythm',
        summary: 'Layer timed rounds into karaoke nights without losing momentum or overloading the host.',
        hostFlow: [
            'Queue questions and rounds with structured reveal moments.',
            'Use host controls for pacing and answer transitions.',
            'Switch between trivia and karaoke without context loss.'
        ],
        audienceFlow: [
            'Answer from phones and stay synced to public reveal.',
            'Track who is rising in score without confusion.',
            'Join instantly without needing separate apps.'
        ],
        fundraiserFlow: [
            'Charge team entry for trivia rounds.',
            'Run sponsored bonus rounds to push donation goals.'
        ]
    },
    {
        key: 'bracket',
        page: 'mode-bracket',
        title: 'Sweet 16 Bracket',
        blurb: 'Head-to-head matchups with finals-night energy.',
        headline: 'Tournament Night With Sweet 16 Momentum',
        summary: 'Bracket mode turns the room into a full event arc with seeding, rounds, and final crown moments.',
        hostFlow: [
            'Seed participants manually or auto-seed from eligible singers.',
            'Handle no-shows with host and auto-forfeit controls.',
            'Capture match history and audit timeline automatically.'
        ],
        audienceFlow: [
            'Follow bracket state from public screen.',
            'Vote and react to matchup energy in real time.',
            'Stay engaged between performances with clear round context.'
        ],
        fundraiserFlow: [
            'Use donation voting to influence matchup moments.',
            'Run finals with prize/sponsor overlays and recap packaging.'
        ]
    },
    {
        key: 'tight15',
        page: 'mode-tight15',
        title: 'Tight 15',
        blurb: 'Singer identity and setlist memory across nights.',
        headline: 'Tight 15 Builds Singer Identity Over Time',
        summary: 'Give regulars a portable setlist identity that makes each new room feel connected to the last.',
        hostFlow: [
            'Use Tight 15 data for spotlight choices and bracket picks.',
            'Keep recurring singers recognizable night-to-night.',
            'Blend discovery and familiarity in queue design.'
        ],
        audienceFlow: [
            'Learn each singer\'s style through recurring picks.',
            'Get stronger storylines in brackets and challenges.',
            'See identity show up in room recap moments.'
        ],
        fundraiserFlow: [
            'Sponsor singer spotlights tied to Tight 15 entries.',
            'Use familiar sets to drive repeat donor engagement.'
        ]
    }
];

const MODE_MAP = Object.fromEntries(MODE_DETAILS.map((mode) => [mode.page, mode]));

const FUNDRAISER_MECHANICS = [
    'Bingo card sales + sponsored squares',
    'Trivia team entries + sponsored rounds',
    'Sweet 16 donation voting during matchups',
    'Host overlays for goals, donor callouts, and stretch milestones',
    'Room-close recap artifact for post-event sharing'
];

const FAQ_ITEMS = [
    {
        q: 'Is this only for bars?',
        a: 'No. BeauRocks is built for private parties, home events, and community gatherings where hosts want a cleaner and more inclusive night format.'
    },
    {
        q: 'Does everyone have to sing?',
        a: 'No. Audience participation is a core feature. Guests can vote, react, and play game modes from their phones.'
    },
    {
        q: 'How does licensing work?',
        a: 'BeauRocks is designed for private gatherings. Hosts remain responsible for music rights and local compliance based on event context.'
    },
    {
        q: 'What devices are supported?',
        a: 'Guests join from iPhone/Android browsers, and hosts run a dedicated control surface while casting to a shared TV/public screen setup.'
    }
];

const getAppBase = () => {
    if (typeof window === 'undefined') return '/';
    return `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
};

const emailLooksValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const getInitialPage = () => {
    if (typeof window === 'undefined') return 'home';
    const path = window.location.pathname.replace(/\/+$/, '');
    if (/\/marketing\/games$/.test(path)) return GAMES_PAGE;
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page') || 'home';
    return page;
};

const updatePageParam = (page) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const path = url.pathname.replace(/\/+$/, '');
    const toMarketingPath = (suffix = '') => {
        if (/\/marketing(\/.*)?$/.test(path)) {
            return path.replace(/\/marketing(\/.*)?$/, `/marketing${suffix}`);
        }
        return `${path || ''}/marketing${suffix}`.replace(/\/{2,}/g, '/');
    };
    if (page === GAMES_PAGE) {
        url.pathname = toMarketingPath('/games');
        url.searchParams.delete('page');
    } else {
        url.pathname = toMarketingPath('');
        if (!page || page === 'home') url.searchParams.delete('page');
        else url.searchParams.set('page', page);
    }
    window.history.pushState({}, '', url.toString());
};

const saveWaitlistFallbackLocally = ({ name, email, useCase, source }) => {
    const raw = window.localStorage.getItem('beaurocks_waitlist');
    const existing = raw ? JSON.parse(raw) : [];
    const entry = {
        id: `wl_${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        useCase,
        source,
        submittedAt: Date.now()
    };
    const next = [...existing.filter((item) => item.email !== entry.email), entry];
    window.localStorage.setItem('beaurocks_waitlist', JSON.stringify(next));
    return next.length;
};

const ScreenPreviewCard = ({ screen, isVisible }) => (
    <article className="mk-screen-card">
        <div className="mk-screen-art mk-screen-art-callouts">
            <img src={screen.image} alt={screen.title} className="mk-screen-image" loading="lazy" />
            {screen.callouts?.map((callout, index) => (
                <div
                    key={`${screen.id}_${callout.label}`}
                    className={`mk-callout-pin ${isVisible ? 'is-visible' : ''}`}
                    style={{
                        left: `${callout.x}%`,
                        top: `${callout.y}%`,
                        transitionDelay: `${index * 90}ms`
                    }}
                >
                    <span className="mk-callout-dot" />
                    <span className="mk-callout-bubble">
                        <strong>{callout.label}</strong>
                        <span>{callout.note}</span>
                    </span>
                </div>
            ))}
        </div>
        <div className="mk-screen-copy">
            <h3>{screen.title}</h3>
            <p>{screen.detail}</p>
            <ul className="mk-list">
                {screen.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
        </div>
    </article>
);

const GamesCatalogPage = ({ onBack, onJoin, onOpenMode }) => (
    <section className="mk-mode-page">
        <div className="mk-container">
            <button type="button" onClick={onBack} className="mk-btn mk-btn-ghost">Back To Marketing Home</button>
            <div className="mk-mode-hero">
                <div className="mk-kicker">Games Hub</div>
                <h1>Game Modes, Deeply Explained</h1>
                <p>
                    This is the host playbook view: each game shows what the host controls, what the audience does,
                    and where the night gets its momentum.
                </p>
                <div className="mk-hero-cta">
                    <button type="button" onClick={onJoin} className="mk-btn mk-btn-primary">Join Early Access</button>
                    <a href="?mode=host" className="mk-btn mk-btn-ghost">Open Host App</a>
                </div>
            </div>
            <div className="mk-games-guide-grid">
                {GAMES_PAGE_GUIDES.map((guide) => (
                    <article key={guide.id} className="mk-games-guide-card">
                        <div className={`mk-games-clip ${guide.clipKind === 'phone' ? 'mk-games-clip-phone' : ''}`}>
                            <img src={guide.clipImage} alt={`${guide.mode} surface capture`} className="mk-games-clip-image" loading="lazy" />
                            <div className="mk-games-clip-overlay">
                                <div className="mk-games-clip-pill">Walkthrough Capture</div>
                                <div className="mk-games-clip-label">{guide.clipLabel}</div>
                            </div>
                        </div>
                        <div className="mk-games-guide-content">
                            <div className="mk-card-subtitle">{guide.tone}</div>
                            <h3>{guide.mode}</h3>
                            <div className="mk-games-guide-columns">
                                <div>
                                    <div className="mk-games-guide-title">Host Flow</div>
                                    <ul className="mk-list">
                                        {guide.hostSteps.map((step) => <li key={step}>{step}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <div className="mk-games-guide-title">Audience Flow</div>
                                    <ul className="mk-list">
                                        {guide.audienceSteps.map((step) => <li key={step}>{step}</li>)}
                                    </ul>
                                </div>
                            </div>
                            <div className="mk-games-guide-actions">
                                {guide.modePage ? (
                                    <button
                                        type="button"
                                        className="mk-mode-link"
                                        onClick={() => onOpenMode(guide.modePage)}
                                    >
                                        Open Mode Detail
                                    </button>
                                ) : (
                                    <button type="button" className="mk-mode-link" onClick={onJoin}>Request Beta Access</button>
                                )}
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    </section>
);

const ModeDetailPage = ({ mode, onBack, onJoin, onOpenGames }) => (
    <section className="mk-mode-page">
        <div className="mk-container">
            <button type="button" onClick={onBack} className="mk-btn mk-btn-ghost">Back To Marketing Home</button>
            <div className="mk-mode-hero">
                <div className="mk-kicker">Mode Deep Dive</div>
                <h1>{mode.headline}</h1>
                <p>{mode.summary}</p>
                <div className="mk-hero-cta">
                    <button type="button" onClick={onJoin} className="mk-btn mk-btn-primary">Join Early Access</button>
                    <button type="button" onClick={onOpenGames} className="mk-btn mk-btn-ghost">All Game Modes</button>
                    <a href="?mode=host" className="mk-btn mk-btn-ghost">Open Host App</a>
                </div>
            </div>
            <div className="mk-grid mk-grid-3 mk-mode-grid">
                <article className="mk-card">
                    <h3>Host Workflow</h3>
                    <ul className="mk-list">
                        {mode.hostFlow.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                </article>
                <article className="mk-card">
                    <h3>Audience Experience</h3>
                    <ul className="mk-list">
                        {mode.audienceFlow.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                </article>
                <article className="mk-card">
                    <h3>Fundraiser Angles</h3>
                    <ul className="mk-list">
                        {mode.fundraiserFlow.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                </article>
            </div>
            <div className="mk-mode-visual-strip">
                {PRODUCT_VISUALS.map((visual) => (
                    <article key={`${mode.key}_${visual.id}`} className="mk-visual-card mk-visual-card-compact">
                        <div className={`mk-visual-image-wrap ${visual.kind === 'phone' ? 'mk-visual-image-wrap-phone' : ''}`}>
                            <img src={visual.image} alt={visual.title} className="mk-visual-image" loading="lazy" />
                        </div>
                        <div className="mk-visual-meta">
                            <h4>{visual.title}</h4>
                            <p>{visual.caption}</p>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    </section>
);

const MarketingSite = () => {
    const scrollerRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [activePage, setActivePage] = useState(getInitialPage);
    const [revealedScreens, setRevealedScreens] = useState({});
    const [reducedMotion, setReducedMotion] = useState(false);
    const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
    const [waitlist, setWaitlist] = useState({ name: '', email: '', useCase: 'Home Party Host' });
    const [waitlistState, setWaitlistState] = useState({ error: '', success: '' });

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => setReducedMotion(!!mq.matches);
        onChange();
        if (mq.addEventListener) {
            mq.addEventListener('change', onChange);
            return () => mq.removeEventListener('change', onChange);
        }
        mq.addListener(onChange);
        return () => mq.removeListener(onChange);
    }, []);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return undefined;
        const onScroll = () => setScrollTop(el.scrollTop || 0);
        el.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onPop = () => setActivePage(getInitialPage());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return undefined;
        const homePage = !MODE_MAP[activePage] && activePage !== GAMES_PAGE;
        if (!homePage) return undefined;
        const targets = scroller.querySelectorAll('[data-screen-observe="true"]');
        if (!targets.length || typeof window === 'undefined' || !window.IntersectionObserver) {
            setRevealedScreens((prev) => {
                const next = { ...prev };
                SCREEN_DEEP_DIVES.forEach((screen) => { next[screen.id] = true; });
                return next;
            });
            return undefined;
        }
        const observer = new window.IntersectionObserver(
            (entries) => {
                setRevealedScreens((prev) => {
                    let changed = false;
                    const next = { ...prev };
                    entries.forEach((entry) => {
                        const id = entry.target.getAttribute('data-screen-id');
                        if (!id || !entry.isIntersecting || next[id]) return;
                        next[id] = true;
                        changed = true;
                    });
                    return changed ? next : prev;
                });
            },
            {
                root: scroller,
                threshold: 0.5
            }
        );
        targets.forEach((target) => observer.observe(target));
        return () => observer.disconnect();
    }, [activePage]);

    const appBase = useMemo(() => getAppBase(), []);
    const isGamesPage = activePage === GAMES_PAGE;
    const activeMode = isGamesPage ? null : (MODE_MAP[activePage] || null);
    const isHomePage = !activeMode && !isGamesPage;
    const parallax = useMemo(() => {
        if (reducedMotion || !isHomePage) return { gridY: 0, glowY: 0, orbY: 0 };
        return {
            gridY: Math.min(220, scrollTop * 0.18),
            glowY: Math.min(300, scrollTop * 0.3),
            orbY: Math.min(180, scrollTop * 0.12)
        };
    }, [scrollTop, reducedMotion, isHomePage]);

    const navigateMarketingPage = (page) => {
        updatePageParam(page);
        setActivePage(page);
        const el = scrollerRef.current;
        if (!el) return;
        const behavior = reducedMotion ? 'auto' : 'smooth';
        el.scrollTo({ top: 0, behavior });
    };

    const jumpToWaitlist = () => {
        if (!isHomePage) {
            navigateMarketingPage('home');
            setTimeout(() => {
                const target = document.getElementById('waitlist');
                target?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
            }, 60);
            return;
        }
        const target = document.getElementById('waitlist');
        target?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    };

    const onWaitlistSubmit = async (event) => {
        event.preventDefault();
        if (submittingWaitlist) return;
        if (!waitlist.name.trim()) {
            setWaitlistState({ error: 'Add your name so we can personalize your invite.', success: '' });
            return;
        }
        if (!emailLooksValid(waitlist.email)) {
            setWaitlistState({ error: 'Enter a valid email address.', success: '' });
            return;
        }
        setSubmittingWaitlist(true);
        setWaitlistState({ error: '', success: '' });
        const source = activeMode ? `mode_detail_${activeMode.key}` : 'marketing_home';
        try {
            const response = await submitMarketingWaitlist({
                name: waitlist.name.trim(),
                email: waitlist.email.trim().toLowerCase(),
                useCase: waitlist.useCase,
                source
            });
            setWaitlistState({
                error: '',
                success: response?.message || 'You are in line for early access.'
            });
            setWaitlist((prev) => ({ ...prev, email: '' }));
            trackEvent('marketing_waitlist_submit', {
                source,
                use_case: waitlist.useCase.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
            });
        } catch (error) {
            console.error('waitlist backend submit failed', error);
            try {
                const linePosition = saveWaitlistFallbackLocally({
                    name: waitlist.name,
                    email: waitlist.email,
                    useCase: waitlist.useCase,
                    source
                });
                setWaitlistState({
                    error: '',
                    success: `Saved locally at position #${linePosition}. Backend sync is temporarily unavailable.`
                });
            } catch (fallbackError) {
                console.error('waitlist local fallback failed', fallbackError);
                setWaitlistState({ error: 'Could not submit your request. Try again shortly.', success: '' });
            }
        } finally {
            setSubmittingWaitlist(false);
        }
    };

    return (
        <div ref={scrollerRef} className="marketing-site h-full w-full overflow-y-auto">
            <header className="mk-nav">
                <div className="mk-container mk-nav-inner">
                    <div className="mk-brand">
                        <img src={ASSETS.logo} alt="BeauRocks Karaoke" className="mk-brand-logo" />
                        <span className="mk-brand-word">BeauRocks</span>
                    </div>
                    <nav className="mk-nav-links">
                        {isHomePage && NAV_ITEMS.map((item) => (
                            <a key={item.id} href={`#${item.id}`}>{item.label}</a>
                        ))}
                        {isHomePage && (
                            <button type="button" className="mk-nav-inline-btn" onClick={() => navigateMarketingPage(GAMES_PAGE)}>
                                Games Hub
                            </button>
                        )}
                        {!isHomePage && (
                            <button type="button" className="mk-nav-inline-btn" onClick={() => navigateMarketingPage('home')}>
                                Home
                            </button>
                        )}
                    </nav>
                    <button type="button" onClick={jumpToWaitlist} className="mk-btn mk-btn-primary">Join Early Access</button>
                </div>
            </header>

            <main>
                {isHomePage && (
                    <>
                        <section className="mk-hero" id="home">
                            <div className="mk-layer mk-layer-grid" style={{ transform: `translate3d(0, ${parallax.gridY}px, 0)` }} />
                            <div className="mk-layer mk-layer-glow" style={{ transform: `translate3d(0, ${parallax.glowY}px, 0)` }} />
                            <div className="mk-layer mk-layer-orb" style={{ transform: `translate3d(0, ${parallax.orbY}px, 0)` }} />
                            <div className="mk-container mk-hero-content">
                                <div className="mk-pill">Private Party Platform Inspired by Karaoke</div>
                                <h1>Party Night, Rebuilt For Home.</h1>
                                <p>
                                    Bar karaoke can feel dark, narrow, and awkward. BeauRocks turns private gatherings
                                    into full-on shared events with a public screen, host panel, and audience app that
                                    keeps everyone involved.
                                </p>
                                <div className="mk-hero-cta">
                                    <button type="button" onClick={jumpToWaitlist} className="mk-btn mk-btn-primary">Get In Line</button>
                                    <button type="button" onClick={() => navigateMarketingPage(GAMES_PAGE)} className="mk-btn mk-btn-ghost">Explore Games Hub</button>
                                    <a href="#surfaces" className="mk-btn mk-btn-ghost">See The 3 Surfaces</a>
                                    <a href={appBase} className="mk-btn mk-btn-ghost">Open Live App</a>
                                </div>
                                <div className="mk-hero-note">
                                    Rolling access waves. Designed for private events, family gatherings, and fundraiser nights.
                                </div>
                            </div>
                        </section>

                        <section id="visuals" className="mk-section mk-section-dark">
                            <div className="mk-container">
                                <div className="mk-kicker">Product In Action</div>
                                <h2>Real Surface Captures, Not Mockups</h2>
                                <p className="mk-lead">
                                    Live captures from the current deployed product, showing what guests and rooms actually see.
                                </p>
                                <div className="mk-grid mk-grid-3 mk-visual-grid">
                                    {PRODUCT_VISUALS.map((visual) => (
                                        <article key={visual.id} className="mk-visual-card">
                                            <div className={`mk-visual-image-wrap ${visual.kind === 'phone' ? 'mk-visual-image-wrap-phone' : ''}`}>
                                                <img src={visual.image} alt={visual.title} className="mk-visual-image" loading="lazy" />
                                            </div>
                                            <div className="mk-visual-meta">
                                                <h3>{visual.title}</h3>
                                                <p>{visual.caption}</p>
                                                <a href={visual.href} className="mk-mode-link">Open Surface</a>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section id="screens" className="mk-section">
                            <div className="mk-container">
                                <div className="mk-kicker">Screen Deep Dive</div>
                                <h2>Each Screen Has A Different Job</h2>
                                <p className="mk-lead">
                                    BeauRocks is strongest when host, TV, and audience surfaces are understood as a coordinated system.
                                </p>
                                <div className="mk-screen-stack">
                                    {SCREEN_DEEP_DIVES.map((screen) => (
                                        <div key={screen.id} data-screen-observe="true" data-screen-id={screen.id}>
                                            <ScreenPreviewCard
                                                screen={screen}
                                                isVisible={reducedMotion || !!revealedScreens[screen.id]}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section id="surfaces" className="mk-section">
                            <div className="mk-container">
                                <div className="mk-kicker">Three Surfaces</div>
                                <h2>One Night. Three Surfaces. Zero Chaos.</h2>
                                <p className="mk-lead">
                                    Every party role gets a purpose-built interface so singing is not the only path to fun.
                                </p>
                                <div className="mk-grid mk-grid-3">
                                    {SURFACES.map((surface) => (
                                        <article key={surface.title} className="mk-card">
                                            <h3>{surface.title}</h3>
                                            <div className="mk-card-subtitle">{surface.subtitle}</div>
                                            <p>{surface.body}</p>
                                            <div className="mk-card-stat">{surface.stat}</div>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section id="voice-games" className="mk-section mk-section-dark">
                            <div className="mk-container">
                                <div className="mk-kicker">Voice Game Modes</div>
                                <h2>Signature Voice Games Need More Spotlight</h2>
                                <p className="mk-lead">
                                    These modes are not side features. They are core reasons hosts can run richer nights than standard karaoke.
                                </p>
                                <div className="mk-grid mk-grid-2">
                                    {VOICE_GAME_MODES.map((game) => (
                                        <article key={game.id} className="mk-card mk-voice-card">
                                            <h3>{game.name}</h3>
                                            <div className="mk-card-subtitle">{game.tagline}</div>
                                            <p>{game.details}</p>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section id="modes" className="mk-section mk-section-dark">
                            <div className="mk-container">
                                <div className="mk-kicker">Modes</div>
                                <h2>Choose The Tone Of Tonight</h2>
                                <p className="mk-lead">
                                    Karaoke is the spark. Bingo, Trivia, Tight 15, and Sweet 16 Bracket build the full event arc.
                                </p>
                                <div className="mk-hero-cta mk-inline-actions">
                                    <button type="button" onClick={() => navigateMarketingPage(GAMES_PAGE)} className="mk-btn mk-btn-primary">
                                        Open Games Hub
                                    </button>
                                </div>
                                <div className="mk-grid mk-grid-5">
                                    {MODE_DETAILS.map((mode) => (
                                        <article key={mode.key} className="mk-mode-card">
                                            <h3>{mode.title}</h3>
                                            <p>{mode.blurb}</p>
                                            <button type="button" className="mk-mode-link" onClick={() => navigateMarketingPage(mode.page)}>
                                                Open Mode Page
                                            </button>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section id="fundraisers" className="mk-section">
                            <div className="mk-container mk-two-col">
                                <div>
                                    <div className="mk-kicker">Fundraisers</div>
                                    <h2>Built For Donation Energy, Not Just Song Requests</h2>
                                    <p className="mk-lead">
                                        BeauRocks can run an entire fundraiser night where participation moments map directly
                                        to sponsor visibility, contributions, and crowd momentum.
                                    </p>
                                    <ul className="mk-list">
                                        {FUNDRAISER_MECHANICS.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                </div>
                                <div className="mk-callout">
                                    <h3>Fundraiser Night Formats</h3>
                                    <p>Community challenge night, school booster event, and neighborhood cause night all map well to the same host workflow.</p>
                                    <p>Use host presets to switch between casual social pacing and donation-driven competition pacing.</p>
                                    <button type="button" onClick={jumpToWaitlist} className="mk-btn mk-btn-primary">Get Fundraiser Access</button>
                                </div>
                            </div>
                        </section>

                        <section id="vip" className="mk-section mk-section-dark">
                            <div className="mk-container mk-two-col">
                                <div>
                                    <div className="mk-kicker">VIP</div>
                                    <h2>Give Regulars An Identity That Travels Room To Room</h2>
                                    <p className="mk-lead">
                                        VIP unlocks persistence for frequent participants so each night builds on the last.
                                    </p>
                                    <ul className="mk-list">
                                        <li>Saved Tight 15 across rooms</li>
                                        <li>Tournament recognition and recap visibility</li>
                                        <li>Priority onboarding to new game mechanics</li>
                                        <li>More personalized audience and performer experiences</li>
                                    </ul>
                                </div>
                                <div className="mk-callout">
                                    <h3>Host Subscription System</h3>
                                    <p>Hosts set the night strategy. VIP gives regular guests continuity and identity.</p>
                                    <p>Together, they turn one-off parties into recurring event communities.</p>
                                </div>
                            </div>
                        </section>

                        <section id="host-features" className="mk-section">
                            <div className="mk-container">
                                <div className="mk-kicker">Host Feature Stack</div>
                                <h2>Host Controls Go Way Beyond Song Queue</h2>
                                <p className="mk-lead">
                                    New hosts need clarity on everything they can actually run from one panel. This is the operational core.
                                </p>
                                <div className="mk-host-stack">
                                    {HOST_FEATURE_STACK.map((feature) => (
                                        <div key={feature} className="mk-host-feature">
                                            {feature}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section id="plans" className="mk-section">
                            <div className="mk-container">
                                <div className="mk-kicker">Plans + Usage</div>
                                <h2>Simple Host Pricing With Clear Usage</h2>
                                <p className="mk-lead">
                                    Keep it transparent: base plans, included usage, and overage rates with practical nightly examples.
                                </p>
                                <div className="mk-grid mk-grid-3">
                                    <article className="mk-plan-card">
                                        <h3>Casual Host</h3>
                                        <div className="mk-plan-price">$19/mo</div>
                                        <p>Great for occasional private party nights and family events.</p>
                                    </article>
                                    <article className="mk-plan-card mk-plan-card-featured">
                                        <h3>Event Host</h3>
                                        <div className="mk-plan-price">$49/mo</div>
                                        <p>Balanced for recurring nights with Bingo, Trivia, and bracket activity.</p>
                                    </article>
                                    <article className="mk-plan-card">
                                        <h3>Community Host</h3>
                                        <div className="mk-plan-price">$99/mo</div>
                                        <p>High-volume hosts and fundraiser operators with heavier usage profiles.</p>
                                    </article>
                                </div>
                                <div className="mk-legal-note">
                                    Pricing shown as placeholder for marketing planning. Final tiers and usage units can be adjusted during launch prep.
                                </div>
                            </div>
                        </section>

                        <section className="mk-section mk-section-dark">
                            <div className="mk-container">
                                <div className="mk-kicker">FAQ</div>
                                <h2>Common Questions</h2>
                                <div className="mk-grid mk-grid-2">
                                    {FAQ_ITEMS.map((item) => (
                                        <article key={item.q} className="mk-card">
                                            <h3>{item.q}</h3>
                                            <p>{item.a}</p>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {isGamesPage && (
                    <GamesCatalogPage
                        onBack={() => navigateMarketingPage('home')}
                        onJoin={jumpToWaitlist}
                        onOpenMode={navigateMarketingPage}
                    />
                )}

                {!isHomePage && (
                    activeMode && (
                        <ModeDetailPage
                            mode={activeMode}
                            onBack={() => navigateMarketingPage('home')}
                            onJoin={jumpToWaitlist}
                            onOpenGames={() => navigateMarketingPage(GAMES_PAGE)}
                        />
                    )
                )}

                <section id="waitlist" className="mk-section mk-section-waitlist">
                    <div className="mk-container mk-two-col">
                        <div>
                            <div className="mk-kicker">Early Access</div>
                            <h2>Get In Line For Launch Access</h2>
                            <p className="mk-lead">
                                We are onboarding hosts in waves. Tell us your event type and we will prioritize the right build path.
                            </p>
                        </div>
                        <form className="mk-waitlist-form" onSubmit={onWaitlistSubmit}>
                            <label>
                                Name
                                <input
                                    type="text"
                                    value={waitlist.name}
                                    onChange={(e) => setWaitlist((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="Your name"
                                />
                            </label>
                            <label>
                                Email
                                <input
                                    type="email"
                                    value={waitlist.email}
                                    onChange={(e) => setWaitlist((prev) => ({ ...prev, email: e.target.value }))}
                                    placeholder="you@example.com"
                                />
                            </label>
                            <label>
                                Primary use case
                                <select
                                    value={waitlist.useCase}
                                    onChange={(e) => setWaitlist((prev) => ({ ...prev, useCase: e.target.value }))}
                                >
                                    <option>Home Party Host</option>
                                    <option>Fundraiser Organizer</option>
                                    <option>Community Event Host</option>
                                    <option>Venue / KJ Operator</option>
                                </select>
                            </label>
                            <button type="submit" disabled={submittingWaitlist} className={`mk-btn mk-btn-primary mk-btn-block ${submittingWaitlist ? 'mk-btn-disabled' : ''}`}>
                                {submittingWaitlist ? 'Submitting...' : 'Join The Line'}
                            </button>
                            {waitlistState.error && <div className="mk-form-error">{waitlistState.error}</div>}
                            {waitlistState.success && <div className="mk-form-success">{waitlistState.success}</div>}
                        </form>
                    </div>
                </section>
            </main>

            <footer className="mk-footer">
                <div className="mk-container mk-footer-inner">
                    <div>BeauRocks Party Platform</div>
                    <div>Private gatherings focus. Hosts are responsible for music-rights compliance based on local rules.</div>
                </div>
            </footer>
        </div>
    );
};

export default MarketingSite;

