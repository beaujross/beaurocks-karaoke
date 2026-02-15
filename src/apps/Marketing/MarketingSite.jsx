import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ASSETS } from '../../lib/assets';
import { HOST_SUBSCRIPTION_PLANS, HOST_USAGE_METER_OVERVIEW, formatHostUsageCount, formatUsdFromCents } from '../../billing/hostPlans';
import { submitMarketingWaitlist, trackEvent } from '../../lib/firebase';
import './marketing.css';

const NAV_SECTIONS = [
    { id: 'experience', label: 'Why It Works' },
    { id: 'surfaces', label: 'How It Works' },
    { id: 'games', label: 'Games' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'signup', label: 'Join' }
];

const SHOW_DNA = [
    {
        title: 'Less Cringe',
        body: 'No dead air, awkward pauses, or confused handoffs.',
        accent: 'cyan'
    },
    {
        title: 'Everyone Plays',
        body: 'Sing, cheer, vote, or stir chaos from your phone.',
        accent: 'pink'
    },
    {
        title: 'Host Stays In Control',
        body: 'One panel runs the whole room without tab panic.',
        accent: 'gold'
    }
];

const SIGNAL_METRICS = [
    { label: 'Join Time', value: 'Under 10s' },
    { label: 'Host Setup', value: 'About 2 mins' },
    { label: 'Crowd Energy', value: 'Always On' }
];

const SURFACES = [
    {
        id: 'host',
        title: 'Host Panel',
        subtitle: 'Control signal source',
        image: '/images/marketing/BeauRocks-HostPanel.png',
        bullets: [
            'Run queue, pacing, and modes in one place',
            'Launch moments without breaking flow',
            'Change room rules instantly'
        ]
    },
    {
        id: 'tv',
        title: 'Public TV',
        subtitle: 'Shared perception layer',
        image: '/images/marketing/tv-surface-live.png',
        bullets: [
            'Readable from the back of the room',
            'Host actions show up right away',
            'Even idle screens keep people engaged'
        ]
    },
    {
        id: 'audience',
        title: 'Audience App',
        subtitle: 'Pocket control for guests',
        image: '/images/marketing/BeauRocks-Audienceapp.png',
        bullets: [
            'No-install join flow',
            'Chat, reactions, and game controls',
            'Keeps regulars coming back'
        ]
    }
];

const GAME_VIBE = [
    {
        title: 'Karaoke Core',
        note: 'The main event, minus the chaos.'
    },
    {
        title: 'Doodle-oke',
        note: 'Draw it, guess it, reveal it.'
    },
    {
        title: 'Trivia + WYR',
        note: 'Fast rounds, big reactions.'
    },
    {
        title: 'Bingo + Bracket',
        note: 'Room-wide games people follow all night.'
    },
    {
        title: 'Voice Arcade',
        note: 'Use your voice as the controller.'
    }
];

const ACCESS_TIERS = [
    {
        title: 'Private Hosts',
        detail: 'Hosts who want a fun room without extra chaos.'
    },
    {
        title: 'Community Nights',
        detail: 'Community events that need real participation.'
    },
    {
        title: 'Recurring Operators',
        detail: 'Weekly hosts building loyal crowds.'
    }
];

const FAQ_ITEMS = [
    {
        q: 'Is this invite-only right now?',
        a: 'Yes. Small waves so onboarding stays fast and useful.'
    },
    {
        q: 'Do guests need to install anything?',
        a: 'No app install. Guests join from the web in seconds.'
    },
    {
        q: 'Do people even like karaoke?',
        a: 'Not always. For good reason. Beau Ross built BeauRocks Karaoke to remove the painful parts and keep the fun ones.'
    },
    {
        q: 'Can non-singers still participate?',
        a: 'Yes. Non-singers are a core part of the room.'
    },
    {
        q: 'What happens after I sign up?',
        a: 'You get wave status and clear next steps.'
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
    const hostPricingPlans = useMemo(
        () => HOST_SUBSCRIPTION_PLANS.filter((plan) => plan.id !== 'free'),
        []
    );

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

    const openHostOnboarding = (planId = 'host_monthly') => {
        const validPlanId = HOST_SUBSCRIPTION_PLANS.some((plan) => plan.id === planId) ? planId : 'host_monthly';
        trackEvent('marketing_start_hosting_click', {
            source: 'marketing_mysterious_efficient',
            plan_id: validPlanId
        });
        window.location.href = `${appBase}?mode=host&onboarding=1&plan=${encodeURIComponent(validPlanId)}&source=marketing`;
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
                        <button type="button" className="mk2-btn mk2-btn-primary" onClick={() => openHostOnboarding('host_monthly')}>
                            Start Hosting
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
                            <div className="mk2-kicker">Karaoke, But Self-Aware</div>
                            <h1>
                                Most people do not enjoy karaoke. <span>For good reason.</span>
                            </h1>
                            <p>
                                That is exactly why Beau Ross created BeauRocks Karaoke: less cringe, less friction,
                                and more fun for singers and non-singers.
                            </p>
                            <div className="mk2-hero-cta">
                                <button type="button" className="mk2-btn mk2-btn-primary" onClick={() => openHostOnboarding('host_monthly')}>
                                    Start Hosting Now
                                </button>
                                <button type="button" className="mk2-btn mk2-btn-ghost" onClick={() => jumpTo('pricing')}>
                                    View Plans
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
                            <h3>Self-Serve Is Live</h3>
                            <p>Start now, then use waitlist only if you want white-glove onboarding.</p>
                            <ul>
                                <li>Checkout + setup in one flow</li>
                                <li>Host panel and TV controls included</li>
                                <li>Billing portal for invoices and cancellations</li>
                            </ul>
                            <button type="button" className="mk2-btn mk2-btn-secondary mk2-btn-block" onClick={() => openHostOnboarding('host_monthly')}>
                                Start Self-Serve
                            </button>
                            <button type="button" className="mk2-login-link" onClick={openHostLogin}>
                                Already hosting? Log in
                            </button>
                        </aside>
                    </div>
                </section>

                <section className="mk2-section" id="experience">
                    <div className="mk2-shell">
                        <div className="mk2-kicker">Why It Works</div>
                        <h2>Fun Room. Clear Control.</h2>
                        <p className="mk2-lead">
                            It feels loose for guests and simple for hosts.
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
                        <div className="mk2-kicker">How It Works</div>
                        <h2>Three Surfaces, One Shared Room State</h2>
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
                            <div className="mk2-kicker">Game Layer</div>
                            <h2>Keep People In The Room</h2>
                            <p className="mk2-lead">
                                Quick game loops keep non-singers engaged between songs.
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
                            <div className="mk2-callout-title">Best Fit Right Now</div>
                            <div className="mk2-callout-list">
                                {ACCESS_TIERS.map((tier) => (
                                    <div key={tier.title} className="mk2-callout-item">
                                        <strong>{tier.title}</strong>
                                        <span>{tier.detail}</span>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="mk2-btn mk2-btn-primary mk2-btn-block" onClick={() => jumpTo('signup')}>
                                Start Hosting
                            </button>
                        </aside>
                    </div>
                </section>

                <section className="mk2-section mk2-section-dark" id="pricing">
                    <div className="mk2-shell">
                        <div className="mk2-kicker">Pricing</div>
                        <h2>Subscription Matches In-App Billing</h2>
                        <p className="mk2-lead">
                            Canonical host pricing is synchronized with the billing checkout used in the app.
                        </p>
                        <div className="mk2-pricing-grid">
                            {hostPricingPlans.map((plan) => (
                                <article key={plan.id} className="mk2-pricing-card">
                                    <h3>{plan.label}</h3>
                                    <div className="mk2-pricing-price">{plan.priceLabel}</div>
                                    <p>{plan.note}</p>
                                    <button
                                        type="button"
                                        className="mk2-btn mk2-btn-primary mk2-btn-block"
                                        onClick={() => openHostOnboarding(plan.id)}
                                    >
                                        Choose {plan.label}
                                    </button>
                                </article>
                            ))}
                        </div>
                        <div className="mk2-pricing-usage">
                            <h3>Included API usage and overage rates</h3>
                            <div className="mk2-pricing-table-wrap">
                                <table className="mk2-pricing-table">
                                    <thead>
                                        <tr>
                                            <th>Meter</th>
                                            <th>Host Monthly</th>
                                            <th>Host Annual</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {HOST_USAGE_METER_OVERVIEW.map((meter) => (
                                            <tr key={meter.id}>
                                                <td>{meter.label}</td>
                                                <td>
                                                    {formatHostUsageCount(meter.monthlyIncluded)} included, then {formatUsdFromCents(meter.monthlyOverageCents)}/request
                                                </td>
                                                <td>
                                                    {formatHostUsageCount(meter.annualIncluded)} included, then {formatUsdFromCents(meter.annualOverageCents)}/request
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mk2-pricing-footnote">
                                Overage is only billed after included usage is exceeded in the active period.
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mk2-section mk2-section-dark" id="faq">
                    <div className="mk2-shell">
                        <div className="mk2-kicker">FAQ</div>
                        <h2>Short Answers</h2>
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
                            <div className="mk2-kicker">Need Help Onboarding?</div>
                            <h2>Join The Waitlist</h2>
                            <p className="mk2-lead">
                                Self-serve is available now. Use this form if you want hands-on onboarding support.
                            </p>
                            <button type="button" className="mk2-btn mk2-btn-ghost" onClick={() => openHostOnboarding('host_monthly')}>
                                Start Self-Serve Checkout
                            </button>
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
                                {submitting ? 'Sending...' : 'Join Waitlist'}
                            </button>
                            {formState.error && <div className="mk2-form-error">{formState.error}</div>}
                            {formState.success && <div className="mk2-form-success">{formState.success}</div>}
                        </form>
                    </div>
                </section>
            </main>

            <footer className="mk2-footer">
                <div className="mk2-shell mk2-footer-inner">
                    <div>BeauRocks Karaoke</div>
                    <div>Built by Beau Ross for people who thought they hated karaoke.</div>
                </div>
            </footer>
        </div>
    );
};

export default MarketingSite;
