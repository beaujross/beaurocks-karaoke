import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ASSETS } from '../../lib/assets';
import { submitMarketingWaitlist, trackEvent } from '../../lib/firebase';
import './marketing.css';

const NAV_SECTIONS = [
    { id: 'experience', label: 'Signal' },
    { id: 'surfaces', label: 'System' },
    { id: 'games', label: 'Ritual' },
    { id: 'signup', label: 'Access' }
];

const SHOW_DNA = [
    {
        title: 'One Brain',
        body: 'Host decisions propagate everywhere instantly.',
        accent: 'cyan'
    },
    {
        title: 'Infinite Roles',
        body: 'Singer, lurker, hype unit, strategist. Everyone plays.',
        accent: 'pink'
    },
    {
        title: 'Living Display',
        body: 'The TV behaves like a stage organism, not a slideshow.',
        accent: 'gold'
    }
];

const SIGNAL_METRICS = [
    { label: 'Join Friction', value: 'Near-zero' },
    { label: 'Host Actions', value: 'Single Surface' },
    { label: 'Room State', value: 'Always Shared' }
];

const SURFACES = [
    {
        id: 'host',
        title: 'Host Panel',
        subtitle: 'Control signal source',
        image: '/images/marketing/BeauRocks-HostPanel.png',
        bullets: [
            'Queue and pacing without context switching',
            'Mode launch + moderation queue in one frame',
            'Audience policy controls with immediate effect'
        ]
    },
    {
        id: 'tv',
        title: 'Public TV',
        subtitle: 'Shared perception layer',
        image: '/images/marketing/tv-surface-live.png',
        bullets: [
            'Distance-readable by design',
            'Host actions appear as instant room feedback',
            'Idle states still push participation'
        ]
    },
    {
        id: 'audience',
        title: 'Audience App',
        subtitle: 'Pocket control for guests',
        image: '/images/marketing/BeauRocks-Audienceapp.png',
        bullets: [
            'Fast join without install drag',
            'Chat, reactions, games, and social loops',
            'Identity memory for recurring crowds'
        ]
    }
];

const GAME_VIBE = [
    {
        title: 'Karaoke Core',
        note: 'The spine. Everything else plugs in.'
    },
    {
        title: 'Doodle-oke',
        note: 'Sketch signal, crowd decode, host reveal.'
    },
    {
        title: 'Trivia + WYR',
        note: 'Timed choices. Hard reveals.'
    },
    {
        title: 'Bingo + Bracket',
        note: 'Long-form room arcs with crowd investment.'
    },
    {
        title: 'Voice Arcade',
        note: 'Pitch and volume become control input.'
    }
];

const ACCESS_TIERS = [
    {
        title: 'Private Hosts',
        detail: 'High-energy rooms without operational mess.'
    },
    {
        title: 'Community Nights',
        detail: 'Fundraisers and local events that need participation density.'
    },
    {
        title: 'Recurring Operators',
        detail: 'Hosts building repeat behavior and recognizable show identity.'
    }
];

const FAQ_ITEMS = [
    {
        q: 'Is this invite-only right now?',
        a: 'Yes. Controlled wave releases. Fast onboarding. No bloated rollout.'
    },
    {
        q: 'Do guests need to install anything?',
        a: 'No install wall. Join is web-first and immediate.'
    },
    {
        q: 'Can non-singers still participate?',
        a: 'Yes. Non-singers are core to the design, not an afterthought.'
    },
    {
        q: 'What happens after I sign up?',
        a: 'You receive wave status + exact next steps. No generic drip spam.'
    }
];

const emailLooksValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const getAppBase = () => {
    if (typeof window === 'undefined') return '/';
    return `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
};

const saveWaitlistFallbackLocally = ({ name, email, useCase }) => {
    if (typeof window === 'undefined') return 1;
    const raw = window.localStorage.getItem('beaurocks_waitlist');
    const existing = raw ? JSON.parse(raw) : [];
    const entry = {
        id: `wl_${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        useCase,
        submittedAt: Date.now()
    };
    const next = [...existing.filter((item) => item.email !== entry.email), entry];
    window.localStorage.setItem('beaurocks_waitlist', JSON.stringify(next));
    return next.length;
};

const MarketingSite = () => {
    const scrollerRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [waitlist, setWaitlist] = useState({
        name: '',
        email: '',
        useCase: 'Private Host'
    });
    const [formState, setFormState] = useState({ error: '', success: '' });
    const appBase = useMemo(() => getAppBase(), []);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => setReducedMotion(!!media.matches);
        onChange();
        if (media.addEventListener) {
            media.addEventListener('change', onChange);
            return () => media.removeEventListener('change', onChange);
        }
        media.addListener(onChange);
        return () => media.removeListener(onChange);
    }, []);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return undefined;
        const onScroll = () => setScrollTop(el.scrollTop || 0);
        el.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    const parallaxY = useMemo(() => {
        if (reducedMotion) return 0;
        return Math.min(260, scrollTop * 0.28);
    }, [reducedMotion, scrollTop]);

    const jumpTo = (id) => {
        const target = document.getElementById(id);
        target?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    };

    const openHostLogin = () => {
        trackEvent('marketing_host_login_click', { source: 'marketing_mysterious_efficient' });
        window.location.href = `${appBase}?mode=host`;
    };

    const onSubmit = async (event) => {
        event.preventDefault();
        if (submitting) return;
        if (!emailLooksValid(waitlist.email)) {
            setFormState({ error: 'Enter a valid email address.', success: '' });
            return;
        }
        const fallbackName = waitlist.email.split('@')[0] || 'host';
        const normalizedName = waitlist.name.trim() || fallbackName;

        setSubmitting(true);
        setFormState({ error: '', success: '' });

        try {
            const response = await submitMarketingWaitlist({
                name: normalizedName,
                email: waitlist.email.trim().toLowerCase(),
                useCase: waitlist.useCase,
                source: 'marketing_mysterious_efficient'
            });

            setFormState({
                error: '',
                success: response?.message || 'You are in the access wave queue.'
            });
            setWaitlist((prev) => ({ ...prev, email: '' }));

            trackEvent('marketing_waitlist_submit', {
                source: 'marketing_mysterious_efficient',
                use_case: waitlist.useCase.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
            });
        } catch (error) {
            console.error('waitlist submit failed', error);
            try {
                const linePosition = saveWaitlistFallbackLocally(waitlist);
                setFormState({
                    error: '',
                    success: `Saved in local queue at position #${linePosition}. We will sync your request shortly.`
                });
            } catch (fallbackError) {
                console.error('waitlist fallback failed', fallbackError);
                setFormState({ error: 'Could not submit right now. Try again in a minute.', success: '' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div ref={scrollerRef} className="mk2-site h-full w-full overflow-y-auto">
            <header className="mk2-nav">
                <div className="mk2-shell mk2-nav-inner">
                    <button className="mk2-brand" type="button" onClick={() => jumpTo('top')}>
                        <img src={ASSETS.logo} alt="BeauRocks" className="mk2-brand-logo" />
                        <span className="mk2-brand-word">BeauRocks</span>
                    </button>
                    <nav className="mk2-links">
                        {NAV_SECTIONS.map((section) => (
                            <button key={section.id} type="button" className="mk2-link" onClick={() => jumpTo(section.id)}>
                                {section.label}
                            </button>
                        ))}
                    </nav>
                    <div className="mk2-nav-actions">
                        <button type="button" className="mk2-btn mk2-btn-ghost" onClick={openHostLogin}>
                            Host Login
                        </button>
                        <button type="button" className="mk2-btn mk2-btn-primary" onClick={() => jumpTo('signup')}>
                            Get Access
                        </button>
                    </div>
                </div>
            </header>

            <main>
                <section className="mk2-hero" id="top">
                    <div className="mk2-bg-grid" style={{ transform: `translate3d(0, ${parallaxY}px, 0)` }}></div>
                    <div className="mk2-bg-glow"></div>
                    <div className="mk2-bg-orb mk2-bg-orb-a"></div>
                    <div className="mk2-bg-orb mk2-bg-orb-b"></div>
                    <div className="mk2-shell mk2-hero-layout">
                        <div>
                            <div className="mk2-kicker">Neon Social Karaoke System</div>
                            <h1>
                                Build A Room That Feels <span>Illegal To Leave.</span>
                            </h1>
                            <p>
                                BeauRocks turns host intent into immediate room behavior. Fast joins, live social loops,
                                and game-state transitions that keep the crowd metabolically engaged.
                            </p>
                            <div className="mk2-hero-cta">
                                <button type="button" className="mk2-btn mk2-btn-primary" onClick={() => jumpTo('signup')}>
                                    Enter Access Queue
                                </button>
                                <button type="button" className="mk2-btn mk2-btn-ghost" onClick={() => jumpTo('experience')}>
                                    Decode The System
                                </button>
                            </div>
                            <div className="mk2-metric-strip">
                                {SIGNAL_METRICS.map((metric) => (
                                    <div key={metric.label} className="mk2-metric-chip">
                                        <span>{metric.label}</span>
                                        <strong>{metric.value}</strong>
                                    </div>
                                ))}
                            </div>
                            <div className="mk2-chip-row">
                                {GAME_VIBE.map((mode, index) => (
                                    <div key={mode.title} className="mk2-mode-chip" style={{ animationDelay: `${index * 120}ms` }}>
                                        <strong>{mode.title}</strong>
                                        <span>{mode.note}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <aside className="mk2-hero-panel">
                            <div className="mk2-panel-badge">Access Wave</div>
                            <h3>Next Intake Is Limited</h3>
                            <p>We accept a constrained number of hosts per wave to keep onboarding sharp.</p>
                            <ul>
                                <li>Short setup ritual</li>
                                <li>Priority by use-case fit</li>
                                <li>Fast signal to first show</li>
                            </ul>
                            <button type="button" className="mk2-btn mk2-btn-secondary mk2-btn-block" onClick={() => jumpTo('signup')}>
                                Reserve Slot
                            </button>
                            <button type="button" className="mk2-login-link" onClick={openHostLogin}>
                                Already onboarded? Host login
                            </button>
                        </aside>
                    </div>
                </section>

                <section className="mk2-section" id="experience">
                    <div className="mk2-shell">
                        <div className="mk2-kicker">Experience DNA</div>
                        <h2>Strange Energy, Precise Control</h2>
                        <p className="mk2-lead">
                            The room feels wild. The system stays exact.
                        </p>
                        <div className="mk2-dna-grid">
                            {SHOW_DNA.map((item, index) => (
                                <article
                                    key={item.title}
                                    className={`mk2-dna-card mk2-dna-${item.accent}`}
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <h3>{item.title}</h3>
                                    <p>{item.body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mk2-section mk2-section-dark" id="surfaces">
                    <div className="mk2-shell">
                        <div className="mk2-kicker">Three Surfaces</div>
                        <h2>Three Surfaces, One Nervous System</h2>
                        <div className="mk2-surface-grid">
                            {SURFACES.map((surface, index) => (
                                <article key={surface.id} className="mk2-surface-card" style={{ '--delay': `${index * 120}ms` }}>
                                    <div className="mk2-surface-image-wrap">
                                        <img src={surface.image} alt={surface.title} className="mk2-surface-image" loading="lazy" />
                                    </div>
                                    <div className="mk2-surface-copy">
                                        <h3>{surface.title}</h3>
                                        <div className="mk2-surface-subtitle">{surface.subtitle}</div>
                                        <ul>
                                            {surface.bullets.map((bullet) => (
                                                <li key={bullet}>{bullet}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mk2-section" id="games">
                    <div className="mk2-shell mk2-two-col">
                        <div>
                            <div className="mk2-kicker">Game Energy</div>
                            <h2>Participation Density Stays High</h2>
                            <p className="mk2-lead">
                                Voice input, social voting, and host interventions create a constant next action.
                            </p>
                            <div className="mk2-reel-grid">
                                {GAME_VIBE.map((mode) => (
                                    <div key={mode.title} className="mk2-reel-card">
                                        <strong>{mode.title}</strong>
                                        <span>{mode.note}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <aside className="mk2-callout">
                            <div className="mk2-callout-title">Who We Are Prioritizing</div>
                            <div className="mk2-callout-list">
                                {ACCESS_TIERS.map((tier) => (
                                    <div key={tier.title} className="mk2-callout-item">
                                        <strong>{tier.title}</strong>
                                        <span>{tier.detail}</span>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="mk2-btn mk2-btn-primary mk2-btn-block" onClick={() => jumpTo('signup')}>
                                Request Priority
                            </button>
                        </aside>
                    </div>
                </section>

                <section className="mk2-section mk2-section-dark" id="faq">
                    <div className="mk2-shell">
                        <div className="mk2-kicker">Access Protocol</div>
                        <h2>Low Friction, Clear Answers</h2>
                        <div className="mk2-faq-grid">
                            {FAQ_ITEMS.map((item) => (
                                <article key={item.q} className="mk2-faq-card">
                                    <h3>{item.q}</h3>
                                    <p>{item.a}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mk2-section mk2-signup" id="signup">
                    <div className="mk2-shell mk2-signup-layout">
                        <div>
                            <div className="mk2-kicker">Early Access Signup</div>
                            <h2>Enter The Queue</h2>
                            <p className="mk2-lead">
                                Two inputs. One decision. We do the rest.
                            </p>
                        </div>
                        <form className="mk2-form" onSubmit={onSubmit}>
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
                                Use case
                                <select
                                    value={waitlist.useCase}
                                    onChange={(e) => setWaitlist((prev) => ({ ...prev, useCase: e.target.value }))}
                                >
                                    <option>Private Host</option>
                                    <option>Community Event Organizer</option>
                                    <option>Fundraiser Producer</option>
                                    <option>Recurring Show Operator</option>
                                </select>
                            </label>
                            <label>
                                Codename (optional)
                                <input
                                    type="text"
                                    value={waitlist.name}
                                    onChange={(e) => setWaitlist((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="NeonMayor"
                                />
                            </label>
                            <button type="submit" disabled={submitting} className={`mk2-btn mk2-btn-primary mk2-btn-block ${submitting ? 'mk2-btn-disabled' : ''}`}>
                                {submitting ? 'Transmitting...' : 'Transmit Request'}
                            </button>
                            {formState.error && <div className="mk2-form-error">{formState.error}</div>}
                            {formState.success && <div className="mk2-form-success">{formState.success}</div>}
                        </form>
                    </div>
                </section>
            </main>

            <footer className="mk2-footer">
                <div className="mk2-shell mk2-footer-inner">
                    <div>BeauRocks Marketing Experience</div>
                    <div>Private event platform in staged early access rollout.</div>
                </div>
            </footer>
        </div>
    );
};

export default MarketingSite;
