import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ASSETS } from '../../lib/assets';
import { submitMarketingWaitlist, trackEvent } from '../../lib/firebase';
import './marketing.css';

const GAMES_PAGE = 'games';

const IA_GROUPS = [
    {
        id: 'product',
        label: 'Product',
        targetId: 'surfaces',
        summary: '3 surfaces, one synchronized system',
        links: [
            { id: 'visuals', label: 'Live Visuals' },
            { id: 'screens', label: 'Screen Deep Dive' },
            { id: 'surfaces', label: 'Three Surfaces' },
            { id: 'host-features', label: 'Host Feature Stack' }
        ]
    },
    {
        id: 'games',
        label: 'Games',
        targetId: 'modes',
        summary: 'Voice modes + social game formats',
        links: [
            { id: 'voice-games', label: 'Voice Games' },
            { id: 'modes', label: 'All Modes' },
            { page: GAMES_PAGE, label: 'Games Hub' }
        ]
    },
    {
        id: 'business',
        label: 'Business',
        targetId: 'plans',
        summary: 'Fundraisers, VIP, plans, FAQ',
        links: [
            { id: 'fundraisers', label: 'Fundraisers' },
            { id: 'vip', label: 'VIP' },
            { id: 'plans', label: 'Host Plans' },
            { id: 'faq', label: 'FAQ' }
        ]
    },
    {
        id: 'access',
        label: 'Access',
        targetId: 'waitlist',
        summary: 'Join early access waves',
        links: [
            { id: 'waitlist', label: 'Early Access' }
        ]
    }
];

const SURFACES = [
    {
        title: 'Public Screen',
        subtitle: 'The room narrative in real time',
        body: 'Songs, overlays, prompts, and tournament states stay unified on one visual canvas the whole crowd can follow.',
        stat: 'Shared context for every guest'
    },
    {
        title: 'Host Panel',
        subtitle: 'The operator cockpit',
        body: 'Run queue, presets, overlays, games, and pacing from one place without tab-hopping or second-guessing state.',
        stat: 'One control surface, full command'
    },
    {
        title: 'Audience App',
        subtitle: 'Participation on every phone',
        body: 'Guests can vote, play, react, and track the night even when they are not performing.',
        stat: 'Every guest has a role'
    }
];

const PRODUCT_VISUALS = [
    {
        id: 'host',
        title: 'Host Panel: Live Capture',
        image: '/images/marketing/BeauRocks-HostPanel.png',
        caption: 'Queue, overlays, presets, and game flow managed from one command surface.',
        href: '?mode=host'
    },
    {
        id: 'tv',
        title: 'Public Screen: Live Capture',
        image: '/images/marketing/tv-surface-live.png',
        caption: 'Audience-facing display for lyrics, visualizers, and live game overlays.',
        href: '?mode=tv&room=DEMO'
    },
    {
        id: 'audience',
        title: 'Audience App: Live Capture',
        image: '/images/marketing/BeauRocks-Audienceapp.png',
        caption: 'Fast phone join flow where guests react, vote, and play.',
        href: '?room=DEMO',
        kind: 'phone'
    }
];

const SCREEN_DEEP_DIVES = [
    {
        id: 'screen-host',
        title: 'Host Panel',
        image: '/images/marketing/BeauRocks-HostPanel.png',
        detail: 'Mission control for queue, overlays, game orchestration, and room policy without workflow clutter.',
        points: [
            'Queue manager with rotation controls and first-time singer boost rules',
            'Night presets for Casual, Competition, Bingo, and Trivia formats',
            'Live TV preview tile so hosts always see audience-facing state',
            'One-click game launch and preview from the Games tab'
        ]
    },
    {
        id: 'screen-tv',
        title: 'Public Screen',
        image: '/images/marketing/tv-surface-live.png',
        detail: 'Shared room canvas for lyrics, visualizer states, game overlays, and crowd momentum.',
        points: [
            'Visualizer and lyric overlays can run together',
            'Game overlays for Trivia, Bingo, and bracket transitions',
            'Spotlight moments and recap previews controlled by host',
            'Audience-facing state stays synchronized to host actions'
        ]
    },
    {
        id: 'screen-audience',
        title: 'Audience App',
        image: '/images/marketing/BeauRocks-Audienceapp.png',
        detail: 'Low-friction mobile participation for singers, supporters, and game-first guests.',
        points: [
            'Quick room entry with simple profile identity',
            'Vote, react, and join game rounds from your phone',
            'Tight 15 and bracket interactions for recurring guests',
            'Participation model built for family and friend events, not just stage performers'
        ]
    }
];

const VOICE_GAME_MODES = [
    {
        id: 'voice-doodle',
        name: 'Doodle-oke',
        tagline: 'Draw the clue. Hum the answer.',
        details: 'Draw clue cards and let the room decode lyric hints in a fast, voice-first party format.'
    },
    {
        id: 'voice-flappy',
        name: 'Flappy Bird (Voice)',
        tagline: 'Pitch controls flight.',
        details: 'Crowd mic or solo singer mode turns vocal control into live arcade input.'
    },
    {
        id: 'voice-vocal',
        name: 'Vocal Challenge',
        tagline: 'Hit target ranges and keep streak.',
        details: 'Timed vocal rounds with host-controlled difficulty, guide tones, and streak pressure.'
    },
    {
        id: 'voice-scales',
        name: 'Riding Scales',
        tagline: 'Repeat and survive the pattern.',
        details: 'Scale memory and pitch precision mode with strike pressure, spotlight turns, and clutch finishes.'
    }
];

const HOST_FEATURE_STACK = [
    'One-click host presets that apply queue policy, overlays, and game defaults.',
    'Queue policy controls for limits, rotation strategy, and first-time singer boosts.',
    'Audience preview panel in host view to reduce state confusion.',
    'TV dashboard controls for visualizer source/mode/preset, lyrics, and sensitivity.',
    'Auto-lyrics generation on queue for missing tracks plus manual edit fallback.',
    'Tight 15 spotlight tools and Sweet 16 bracket seeding with no-show handling.',
    'Post-show recap generation for highlights and time-capsule moments.',
    'Workspace billing controls with plan, usage, and overage visibility.'
];

const GAMES_PAGE_GUIDES = [
    {
        id: 'games-karaoke',
        mode: 'Karaoke Flow',
        modePage: 'mode-karaoke',
        tone: 'Casual + Competition presets',
        surfaces: ['Host Panel', 'Public Screen', 'Audience App'],
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
        surfaces: ['Audience App', 'Host Panel', 'Public Screen'],
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
        surfaces: ['Host Panel', 'Audience App', 'Public Screen'],
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
        surfaces: ['Audience App', 'Host Panel', 'Public Screen'],
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
        surfaces: ['Public Screen', 'Host Panel', 'Audience App'],
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
        surfaces: ['Audience App', 'Public Screen', 'Host Panel'],
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
        blurb: 'Fast queue, smooth handoffs, cleaner performer flow.',
        headline: 'Private-Party Karaoke Without The Chaos',
        summary: 'Move beyond awkward open-mic rhythm. Hosts keep the night moving while performers and crowd stay energized.',
        surfaces: ['Host Panel', 'Public Screen', 'Audience App'],
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
        surfaces: ['Audience App', 'Host Panel', 'Public Screen'],
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
        headline: 'Trivia Rounds That Match Party Rhythm',
        summary: 'Layer timed rounds into karaoke nights without losing momentum or overloading the host.',
        surfaces: ['Host Panel', 'Audience App', 'Public Screen'],
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
        headline: 'Sweet 16 Tournament Night, End To End',
        summary: 'Bracket mode turns the room into a full event arc with seeding, rounds, and a clear final crown moment.',
        surfaces: ['Public Screen', 'Host Panel', 'Audience App'],
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
        headline: 'Tight 15 Builds Identity Across Nights',
        summary: 'Give regulars a portable setlist identity so each new room feels connected to the last.',
        surfaces: ['Audience App', 'Host Panel', 'Public Screen'],
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
    'Bingo card sales with sponsored squares',
    'Trivia team entries with sponsored bonus rounds',
    'Sweet 16 donation voting during matchups',
    'Live donor-goal overlays and stretch milestone callouts',
    'Shareable room recap artifact after the event closes'
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
        a: 'Guests join from iPhone and Android browsers, while hosts run a dedicated control surface and cast to a shared TV/public display.'
    },
    {
        q: 'Can this work for non-singing guests?',
        a: 'Yes. Games, reactions, voting, and live participation flows are built for guests who never step on stage.'
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

const SurfacePills = ({ items = [] }) => (
    <div className="mk-surface-pill-row">
        {items.map((item) => (
            <span key={item} className="mk-surface-pill">{item}</span>
        ))}
    </div>
);

const ScreenPreviewCard = ({ screen }) => (
    <article className="mk-screen-card">
        <div className="mk-screen-art">
            <img src={screen.image} alt={screen.title} className="mk-screen-image" loading="lazy" />
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
                <h1>Game Modes, Clearly Explained</h1>
                <p>
                    This is the host playbook view. Each mode maps host controls, audience participation,
                    and where momentum builds during the night.
                </p>
                <div className="mk-hero-cta">
                    <button type="button" onClick={onJoin} className="mk-btn mk-btn-primary">Join Early Access</button>
                    <a href="?mode=host" className="mk-btn mk-btn-ghost">Open Host App</a>
                </div>
            </div>
            <div className="mk-games-guide-grid">
                {GAMES_PAGE_GUIDES.map((guide) => (
                    <article key={guide.id} className="mk-games-guide-card">
                        <div className="mk-games-guide-content">
                            <div className="mk-games-guide-head">
                                <div className="mk-card-subtitle">{guide.tone}</div>
                                <SurfacePills items={guide.surfaces || []} />
                            </div>
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
            <div className="mk-mode-surface-map">
                <div className="mk-games-guide-title">Primary Surfaces In This Mode</div>
                <SurfacePills items={mode.surfaces || []} />
            </div>
        </div>
    </section>
);

const MarketingSite = () => {
    const scrollerRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [activePage, setActivePage] = useState(getInitialPage);
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
                        {isHomePage && IA_GROUPS.map((group) => (
                            <div key={group.id} className="mk-nav-group">
                                <a href={`#${group.targetId}`} className="mk-nav-group-trigger">{group.label}</a>
                                <div className="mk-nav-group-menu">
                                    {group.links.map((link) => (
                                        link.page ? (
                                            <button
                                                key={`${group.id}_${link.label}`}
                                                type="button"
                                                className="mk-nav-menu-btn"
                                                onClick={() => navigateMarketingPage(link.page)}
                                            >
                                                {link.label}
                                            </button>
                                        ) : (
                                            <a key={`${group.id}_${link.id}`} href={`#${link.id}`}>{link.label}</a>
                                        )
                                    ))}
                                </div>
                            </div>
                        ))}
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
                                <div className="mk-pill">Private Party Platform Powered By Karaoke</div>
                                <h1>Run A Better Party Night At Home.</h1>
                                <p>
                                    BeauRocks turns private gatherings into structured, high-energy party nights with
                                    three coordinated surfaces: a public screen, a host panel, and an audience app that
                                    keeps guests engaged from start to finish.
                                </p>
                                <div className="mk-hero-cta">
                                    <button type="button" onClick={jumpToWaitlist} className="mk-btn mk-btn-primary">Join The Waitlist</button>
                                    <button type="button" onClick={() => navigateMarketingPage(GAMES_PAGE)} className="mk-btn mk-btn-ghost">Explore Games Hub</button>
                                    <a href="#surfaces" className="mk-btn mk-btn-ghost">See The 3 Surfaces</a>
                                    <a href={appBase} className="mk-btn mk-btn-ghost">Open Live App</a>
                                </div>
                                <div className="mk-ia-strip">
                                    {IA_GROUPS.map((group) => (
                                        <a key={`ia_${group.id}`} href={`#${group.targetId}`} className="mk-ia-chip">
                                            <strong>{group.label}</strong>
                                            <span>{group.summary}</span>
                                        </a>
                                    ))}
                                </div>
                                <div className="mk-hero-note">
                                    Rolling access waves for home hosts, private events, and fundraiser nights.
                                </div>
                            </div>
                        </section>

                        <section id="visuals" className="mk-section mk-section-dark">
                            <div className="mk-container">
                                <div className="mk-kicker">Product In Action</div>
                                <h2>Real Surface Captures, Not Mockups</h2>
                                <p className="mk-lead">
                                    Live captures from production so hosts can evaluate the actual in-room experience.
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
                                    BeauRocks works best when host, TV, and audience surfaces are treated as one coordinated system.
                                </p>
                                <div className="mk-screen-stack">
                                    {SCREEN_DEEP_DIVES.map((screen) => (
                                        <ScreenPreviewCard key={screen.id} screen={screen} />
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section id="surfaces" className="mk-section">
                            <div className="mk-container">
                                <div className="mk-kicker">Three Surfaces</div>
                                <h2>One Night. Three Surfaces. Zero Chaos.</h2>
                                <p className="mk-lead">
                                    Every party role gets a purpose-built interface, so singing is not the only path to fun.
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
                                <h2>Signature Voice Games Worth Highlighting</h2>
                                <p className="mk-lead">
                                    These are not side features. They are core reasons hosts can run richer nights than standard karaoke.
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
                                        BeauRocks supports full fundraiser nights where participation moments map directly
                                        to sponsor visibility, donations, and crowd momentum.
                                    </p>
                                    <ul className="mk-list">
                                        {FUNDRAISER_MECHANICS.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                </div>
                                <div className="mk-callout">
                                    <h3>Fundraiser Night Formats</h3>
                                    <p>Community challenge nights, school booster events, and neighborhood cause nights all map to the same host workflow.</p>
                                    <p>Use host presets to switch between social pacing and donation-driven competition pacing.</p>
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
                                        VIP unlocks continuity for frequent participants so each night builds on the last.
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
                                    <p>Hosts set the strategy and controls. VIP gives regular guests continuity and identity.</p>
                                    <p>Together, they turn one-off parties into recurring event communities.</p>
                                </div>
                            </div>
                        </section>

                        <section id="host-features" className="mk-section">
                            <div className="mk-container">
                                <div className="mk-kicker">Host Feature Stack</div>
                                <h2>Host Controls Go Way Beyond Song Queue</h2>
                                <p className="mk-lead">
                                    New hosts need clear visibility into everything they can run from one panel. This is the operational core.
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
                                    Pricing is placeholder copy for planning. Final tiers and usage units will be set before launch.
                                </div>
                            </div>
                        </section>

                        <section id="faq" className="mk-section mk-section-dark">
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
                            <h2>Join The Early Access Line</h2>
                            <p className="mk-lead">
                                We onboard hosts in waves. Share your event type and we will prioritize the right onboarding path.
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
                                {submittingWaitlist ? 'Submitting...' : 'Request Early Access'}
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
                    <div>Built for private gatherings. Hosts remain responsible for music-rights compliance based on local rules.</div>
                </div>
            </footer>
        </div>
    );
};

export default MarketingSite;

