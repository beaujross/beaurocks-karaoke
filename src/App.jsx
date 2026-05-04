import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { auth, onAuthStateChanged, initAuth } from './lib/firebase';
import { ASSETS } from './lib/assets';
import { marketingFlags } from './apps/Marketing/featureFlags';
import { MARKETING_ROUTE_PAGES, isMarketingPath } from './apps/Marketing/routing';
import { buildSurfaceUrl, inferSurfaceFromHostname } from './lib/surfaceDomains';

// App Views
const PublicTV = lazy(() => import('./apps/TV/PublicTV'));
const SingerApp = lazy(() => import('./apps/Mobile/SingerApp'));
const AudienceQaHarness = lazy(() => import('./apps/Mobile/AudienceQaHarness'));
const VoiceGamesQaHarness = lazy(() => import('./apps/Mobile/VoiceGamesQaHarness'));
const RecapView = lazy(() => import('./apps/Recap/RecapView'));
const HostApp = lazy(() => import('./apps/Host/HostApp'));
const HostRunOfShowQaHarness = lazy(() => import('./apps/Host/HostRunOfShowQaHarness'));
const MarketingSite = lazy(() => import('./apps/Marketing/MarketingSite'));

const ViewLoader = () => (
    <div className="h-screen w-screen bg-black flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
    </div>
);

const DEFAULT_CANONICAL_MARKETING_ORIGIN = 'https://beaurocks.app';
const MANAGED_HOST_PATTERN = /\.(web\.app|firebaseapp\.com)$/i;
const LEGAL_CONTACT_EMAIL = 'hello@beaurocks.app';
const YOUTUBE_TERMS_URL = 'https://www.youtube.com/t/terms';
const GOOGLE_PRIVACY_URL = 'https://policies.google.com/privacy';

const normalizeOrigin = (value = '') => String(value || '').trim().replace(/\/+$/, '');
const getLegalRoutePath = (slug = 'terms') => {
    const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    return `${base || ''}/karaoke/${String(slug || 'terms').trim().replace(/^\/+|\/+$/g, '')}`.replace(/\/{2,}/g, '/');
};

const getCanonicalManagedHostRedirectUrl = (locationLike = null) => {
    if (!locationLike) return '';
    const hostname = String(locationLike.hostname || '').trim().toLowerCase();
    if (!MANAGED_HOST_PATTERN.test(hostname)) return '';

    const configuredOrigin = normalizeOrigin(
        import.meta.env.VITE_CANONICAL_MARKETING_ORIGIN
        || import.meta.env.VITE_MARKETING_ORIGIN
        || DEFAULT_CANONICAL_MARKETING_ORIGIN
    );
    if (!configuredOrigin) return '';

    try {
        const destination = new URL(configuredOrigin);
        if (destination.hostname.trim().toLowerCase() === hostname) return '';
        destination.pathname = locationLike.pathname || '/';
        destination.search = locationLike.search || '';
        destination.hash = locationLike.hash || '';
        return destination.toString();
    } catch {
        return '';
    }
};

const getCanonicalSurfaceRedirectUrl = (locationLike = null) => {
    if (!locationLike) return '';
    const pathname = String(locationLike.pathname || '/').trim() || '/';
    const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(locationLike.search || '');
    const detectedSurface = inferSurfaceFromHostname(locationLike.hostname, locationLike);
    const explicitMode = String(params.get('mode') || '').trim().toLowerCase();
    const interactiveModeRequested = explicitMode === 'host'
        || explicitMode === 'tv'
        || explicitMode === 'recap'
        || !!String(params.get('room') || '').trim();
    const legacyPage = String(params.get('page') || '').trim().toLowerCase();
    const isHostAccessRoute = normalizedPathname === '/host-access'
        || legacyPage === 'host_access'
        || legacyPage === 'host-access';
    if (interactiveModeRequested) return '';
    const marketingRouteRequested = (
        explicitMode === 'marketing'
        || isMarketingPath(normalizedPathname)
        || /\/marketing(\/.*)?$/i.test(pathname)
    );
    if (!marketingRouteRequested) return '';
    if (isHostAccessRoute) return '';
    if (detectedSurface === 'marketing') return '';

    try {
        const targetUrl = new URL(buildSurfaceUrl({ surface: 'marketing' }, locationLike));
        targetUrl.pathname = pathname;
        targetUrl.search = locationLike.search || '';
        targetUrl.hash = locationLike.hash || '';
        if (targetUrl.origin === normalizeOrigin(locationLike.origin || '')) return '';
        return targetUrl.toString();
    } catch {
        return '';
    }
};

const getCanonicalInteractiveSurfaceRedirectUrl = (locationLike = null) => {
    if (!locationLike) return '';
    const params = new URLSearchParams(locationLike.search || '');
    const pathname = String(locationLike.pathname || '/').trim() || '/';
    const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
    const detectedSurface = inferSurfaceFromHostname(locationLike.hostname, locationLike);
    const roomCode = String(params.get('room') || '').trim();
    const mode = String(params.get('mode') || '').trim().toLowerCase();

    let expectedSurface = '';
    if (mode === 'host' || normalizedPathname === '/host' || normalizedPathname === '/host-dashboard') {
        expectedSurface = 'host';
    } else if (mode === 'tv') {
        expectedSurface = 'tv';
    } else if (roomCode || mode === 'recap') {
        expectedSurface = 'app';
    }

    if (!expectedSurface || expectedSurface === detectedSurface) return '';

    try {
        const targetUrl = new URL(buildSurfaceUrl({ surface: expectedSurface }, locationLike));
        targetUrl.pathname = pathname;
        targetUrl.search = locationLike.search || '';
        targetUrl.hash = locationLike.hash || '';
        if (targetUrl.origin === normalizeOrigin(locationLike.origin || '')) return '';
        return targetUrl.toString();
    } catch {
        return '';
    }
};

const getInitialRouteState = () => {
    if (typeof window === 'undefined') {
        return { view: 'landing', roomCode: '' };
    }
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const detectedSurface = inferSurfaceFromHostname(window.location.hostname, window.location);
    const r = params.get('room');
    const m = params.get('mode');
    const qaHostFixture = String(params.get('qaHostFixture') || '').trim();
    const qaAudienceFixture = String(params.get('qaAudienceFixture') || '').trim();
    const hostRouteRequested = m === 'host' || pathname === '/host' || pathname === '/host-dashboard';
    if (qaHostFixture && !hostRouteRequested) {
        return { view: 'host_qa', roomCode: r ? r.toUpperCase() : '' };
    }
    if (m === 'audience-qa' && qaAudienceFixture) {
        return { view: 'audience_qa', roomCode: r ? r.toUpperCase() : '' };
    }
    if (m === 'voice-games-qa') {
        return { view: 'voice_games_qa', roomCode: r ? r.toUpperCase() : '' };
    }
    if (m === 'host') {
        return { view: 'host', roomCode: r ? r.toUpperCase() : '' };
    }
    if (m === 'recap') {
        return { view: 'recap', roomCode: r ? r.toUpperCase() : '' };
    }
    if (m === 'tv') {
        return { view: 'tv', roomCode: r ? r.toUpperCase() : '' };
    }
    if (pathname === '/host' || pathname === '/host-dashboard') {
        return { view: 'host', roomCode: r ? r.toUpperCase() : '' };
    }
    // Interactive room launches can be server-redirected to marketing-looking paths
    // (for example "/" -> "/for-fans") on custom surfaces, so room intent must win.
    if (r) {
        return { view: 'mobile', roomCode: r.toUpperCase() };
    }
    if (m === 'marketing') {
        return { view: 'marketing', roomCode: '' };
    }
    if (marketingFlags.routePathsEnabled && isMarketingPath(pathname)) {
        return { view: 'marketing', roomCode: '' };
    }
    if (/\/marketing(\/.*)?$/.test(pathname)) {
        return { view: 'marketing', roomCode: '' };
    }
    if (detectedSurface === 'marketing') {
        return { view: 'marketing', roomCode: '' };
    }
    if (detectedSurface === 'host') {
        return { view: 'host', roomCode: '' };
    }
    if (detectedSurface === 'tv') {
        return { view: 'tv', roomCode: '' };
    }
    return { view: 'landing', roomCode: '' };
};

const Landing = ({ onJoin, hasBeauRocksAccount = false }) => {
    const [code, setCode] = useState('');
    const marketingHref = typeof window !== 'undefined'
        ? (
            marketingFlags.routePathsEnabled
                ? buildSurfaceUrl({ surface: 'marketing' }, window.location)
                : buildSurfaceUrl({ surface: 'marketing', params: { mode: 'marketing' } }, window.location)
        )
        : '/';
    const hostAccessHref = typeof window !== 'undefined'
        ? (
            marketingFlags.routePathsEnabled
                ? buildSurfaceUrl({ surface: 'marketing', path: 'host-access' }, window.location)
                : buildSurfaceUrl({ surface: 'marketing', params: { mode: 'marketing', page: 'host_access' } }, window.location)
        )
        : '/';
    const handleOpenHostControls = () => {
        if (!hasBeauRocksAccount) {
            window.location.href = hostAccessHref;
            return;
        }
        window.location.href = code
            ? buildSurfaceUrl({ surface: 'host', params: { room: code, mode: 'host' } }, window.location)
            : buildSurfaceUrl({ surface: 'host', params: { mode: 'host' } }, window.location);
    };
    return ( 
        <div className="h-full w-full overflow-y-auto bg-black relative font-saira text-white">
            <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-zinc-900/90 p-8 rounded-3xl border border-zinc-700 backdrop-blur-md max-w-md w-full shadow-2xl relative z-10">
                    <img src={ASSETS.logo} className="w-96 mx-auto mb-6 drop-shadow-xl rounded-3xl" alt="BeauRocks Karaoke"/>
                    <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" className="w-full bg-zinc-800 border-2 border-zinc-600 p-4 text-center text-3xl font-mono tracking-widest rounded-xl text-white uppercase mb-4 focus:border-pink-500 outline-none transition-colors"/>
                    
                    <button onClick={()=>code && onJoin(code)} className="w-full bg-pink-600 py-4 rounded-xl font-bold text-xl mb-4 text-white shadow-lg hover:bg-pink-500 transition-colors">
                        JOIN PARTY (MOBILE)
                    </button>
                    
                    <button
                        onClick={() => code && (window.location.href = buildSurfaceUrl({ surface: 'tv', params: { room: code, mode: 'tv' } }, window.location))}
                        className="w-full bg-cyan-600 py-3 rounded-xl font-bold text-lg text-white mb-2 hover:bg-cyan-500 transition-colors"
                    >
                        LAUNCH TV DISPLAY
                    </button>
                    
                    <button onClick={handleOpenHostControls} className="w-full bg-zinc-700 py-3 rounded-xl font-bold text-base text-zinc-300 hover:bg-zinc-600 hover:text-white transition-colors mt-2">
                        {hasBeauRocksAccount ? 'HOST CONTROLS' : 'HOST CONTROLS (BEAUROCKS LOGIN)'}
                    </button>
                    <button
                        onClick={() => { window.location.href = marketingHref; }}
                        className="w-full bg-zinc-800 py-3 rounded-xl font-bold text-base text-cyan-200 hover:bg-zinc-700 transition-colors mt-2 border border-cyan-500/30"
                    >
                        VIEW MARKETING SITE
                    </button>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-zinc-400">
                        <a href={getLegalRoutePath('terms')} className="underline underline-offset-4 hover:text-zinc-200">Terms</a>
                        <a href={getLegalRoutePath('privacy')} className="underline underline-offset-4 hover:text-zinc-200">Privacy</a>
                        <a href={getLegalRoutePath('data-deletion')} className="underline underline-offset-4 hover:text-zinc-200">Data deletion</a>
                    </div>
                </div>
            </div>
        </div> 
    );
};

const LegalPageShell = ({ eyebrow = 'BeauRocks Karaoke', title = '', children }) => (
    <div className="min-h-screen w-full bg-black text-white font-saira flex items-center justify-center p-6">
        <div className="w-full max-w-4xl bg-zinc-900/90 border border-zinc-700 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
                <img src={ASSETS.logo} className="h-16 w-auto drop-shadow-[0_0_18px_rgba(255,103,182,0.7)]" alt="BeauRocks Karaoke" />
                <div>
                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">{eyebrow}</div>
                    <h1 className="text-3xl font-bebas text-pink-300">{title}</h1>
                </div>
            </div>
            <div className="mb-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.22em] text-cyan-200/80">
                <a href={getLegalRoutePath('terms')} className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 hover:text-white">Terms</a>
                <a href={getLegalRoutePath('privacy')} className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 hover:text-white">Privacy</a>
                <a href={getLegalRoutePath('data-deletion')} className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 hover:text-white">Data Deletion</a>
            </div>
            <div className="space-y-5 text-base text-zinc-200 leading-relaxed">{children}</div>
            <button
                onClick={() => window.history.back()}
                className="mt-6 w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold text-base"
            >
                Back to the party
            </button>
        </div>
    </div>
);

const KaraokeTerms = () => (
    <LegalPageShell title="Terms Of Service">
        <p>Last updated: 2026-05-02</p>
        <p>This application uses YouTube API Services. By using BeauRocks Karaoke, you also agree to the <a href={YOUTUBE_TERMS_URL} target="_blank" rel="noreferrer" className="text-cyan-200 underline underline-offset-4">YouTube Terms of Service</a>.</p>
        <p>These terms apply to the BeauRocks Karaoke experience, including host, singer, and TV surfaces of the Service. By using the Service, you agree to these terms and our <a href={getLegalRoutePath('privacy')} className="text-cyan-200 underline underline-offset-4">Privacy Policy</a>.</p>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">Use Of The Service</h2>
            <p className="mt-2">You may use the Service to host or participate in karaoke events. You must use the Service lawfully, respect other participants, and only submit content you own or have permission to use.</p>
        </div>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">User Content And Conduct</h2>
            <p className="mt-2">You are responsible for names, messages, photos, drawings, and other content you submit. BeauRocks may remove content or restrict access if needed to keep the Service safe, lawful, and operational.</p>
        </div>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">Third-Party Services</h2>
            <p className="mt-2">The Service may rely on third-party platforms including YouTube, Firebase, Apple Music, Stripe, and Twilio. Third-party availability, policies, and content restrictions may affect Service behavior.</p>
        </div>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">Disclaimers</h2>
            <p className="mt-2">The Service is provided on an as-is basis. We do not guarantee uninterrupted availability, permanent access to third-party content, or compatibility with every device or venue environment.</p>
        </div>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">Contact</h2>
            <p className="mt-2">Questions about these terms or the Service can be sent to <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-cyan-200 underline underline-offset-4">{LEGAL_CONTACT_EMAIL}</a>.</p>
        </div>
    </LegalPageShell>
);

const KaraokePrivacy = () => (
    <LegalPageShell title="Privacy Policy">
        <p>Last updated: 2026-05-02</p>
        <p>This application uses YouTube API Services. Google may collect and process data as described in the <a href={GOOGLE_PRIVACY_URL} target="_blank" rel="noreferrer" className="text-cyan-200 underline underline-offset-4">Google Privacy Policy</a>.</p>
        <p>We collect only the information needed to operate BeauRocks Karaoke, including room participation data, host setup data, submitted content, and limited operational analytics.</p>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">What We Collect</h2>
            <p className="mt-2">Depending on how you use the Service, we may collect account identifiers, room codes, display names, host settings, karaoke requests, uploaded media, moderation data, and basic operational telemetry.</p>
        </div>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">YouTube API Data</h2>
            <p className="mt-2">For YouTube-backed karaoke search and indexing, we may temporarily store limited YouTube metadata such as video ID, title, channel name, thumbnail URL, and playability status. Room-scoped indexed entries are retained temporarily and refreshed or pruned according to our YouTube data lifecycle.</p>
            <p className="mt-2">We do not use YouTube OAuth for these flows and do not act on behalf of a user's YouTube channel.</p>
        </div>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">Retention And Deletion</h2>
            <p className="mt-2">Operational data is retained according to product needs and deletion requests. Temporary room-scoped YouTube index entries are retained for up to 30 days from validation unless refreshed sooner, and expired or unusable entries are removed.</p>
            <p className="mt-2">For deletion instructions, visit the <a href={getLegalRoutePath('data-deletion')} className="text-cyan-200 underline underline-offset-4">Data Deletion</a> page.</p>
        </div>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">Contact</h2>
            <p className="mt-2">Privacy questions or deletion requests can be sent to <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-cyan-200 underline underline-offset-4">{LEGAL_CONTACT_EMAIL}</a>.</p>
        </div>
    </LegalPageShell>
);

const KaraokeDataDeletion = () => (
    <LegalPageShell title="Data Deletion">
        <p>Last updated: 2026-05-02</p>
        <p>You can request deletion of personal data associated with your use of BeauRocks Karaoke by emailing <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-cyan-200 underline underline-offset-4">{LEGAL_CONTACT_EMAIL}</a>.</p>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">What To Include</h2>
            <p className="mt-2">To help us locate the right records, include any relevant email address, room code, event date, display name, and a short description of the data you want removed.</p>
        </div>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">Room Deletion</h2>
            <p className="mt-2">When an authorized host or workspace admin permanently deletes a room, the room record, room-scoped activity data, and the room host library are removed as part of the deletion process.</p>
        </div>
        <div>
            <h2 className="text-xl font-bebas tracking-[0.08em] text-pink-200">YouTube Data</h2>
            <p className="mt-2">This application uses YouTube API Services. We do not store YouTube OAuth account data for these flows. Temporary room-scoped YouTube index entries are refreshed or removed within the retention window and are also removed when the room host library is permanently deleted.</p>
        </div>
    </LegalPageShell>
);

const App = () => {
    const qaAudienceFixtureId = typeof window !== 'undefined'
        ? String(new URLSearchParams(window.location.search || '').get('qaAudienceFixture') || '').trim()
        : '';
    const [canonicalRedirectUrl] = useState(() => {
        if (typeof window === 'undefined') return '';
        return getCanonicalManagedHostRedirectUrl(window.location)
            || getCanonicalSurfaceRedirectUrl(window.location)
            || getCanonicalInteractiveSurfaceRedirectUrl(window.location);
    });
    const initialRoute = getInitialRouteState();
    const initialViewHintRef = useRef(initialRoute.view);
    const [view, setView] = useState(() => initialRoute.view);
    const [roomCode, setRoomCode] = useState(() => initialRoute.roomCode);
    const [uid, setUid] = useState(null);
    const [hasBeauRocksAccount, setHasBeauRocksAccount] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const normalizedPathname = typeof window !== 'undefined'
        ? window.location.pathname.replace(/\/+$/, '')
        : '';
    const isKaraokeTerms = typeof window !== 'undefined'
        && normalizedPathname.endsWith('/karaoke/terms');
    const isKaraokePrivacy = typeof window !== 'undefined'
        && normalizedPathname.endsWith('/karaoke/privacy');
    const isKaraokeDataDeletion = typeof window !== 'undefined'
        && normalizedPathname.endsWith('/karaoke/data-deletion');
    const isDemoRoomCode = String(roomCode || '').trim().toUpperCase().startsWith('DEMO');
    const isDemoHostEmbed = typeof window !== 'undefined'
        && view === 'host'
        && isDemoRoomCode
        && new URLSearchParams(window.location.search || '').get('mkDemoEmbed') === '1';

    useEffect(() => {
        if (!canonicalRedirectUrl || typeof window === 'undefined') return;
        window.location.replace(canonicalRedirectUrl);
    }, [canonicalRedirectUrl]);

    // 1. Initialize Auth
    useEffect(() => {
        initAuth({ viewHint: initialViewHintRef.current }).then((res) => {
            if (!res?.ok && res?.error) {
                setAuthError(res.error);
                setAuthReady(true);
                return;
            }
            const currentUser = auth.currentUser;
            if (currentUser) {
                setUid(currentUser.uid);
                setHasBeauRocksAccount(!currentUser.isAnonymous);
                setAuthError(null);
                setAuthReady(true);
                return;
            }
            setUid(null);
            setHasBeauRocksAccount(false);
            setAuthReady(true);
        });
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUid(user.uid);
                setHasBeauRocksAccount(!user.isAnonymous);
                setAuthError(null);
                setAuthReady(true);
                return;
            }
            setUid(null);
            setHasBeauRocksAccount(false);
            setAuthReady(true);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (view !== 'host') return;
        if (!authReady || hasBeauRocksAccount || isDemoHostEmbed || typeof window === 'undefined') return;

        const resumeIntent = 'host_dashboard_resume';
        const baseHref = marketingFlags.routePathsEnabled
            ? buildSurfaceUrl({ surface: 'marketing', path: 'host-access' }, window.location)
            : buildSurfaceUrl({
                surface: 'marketing',
                params: { mode: 'marketing', page: MARKETING_ROUTE_PAGES.hostAccess },
            }, window.location);
        const returnToUrl = new URL(baseHref);
        returnToUrl.pathname = window.location.pathname || '/';
        returnToUrl.search = window.location.search || '';
        returnToUrl.hash = window.location.hash || '';
        const authGateUrl = new URL(baseHref);
        authGateUrl.searchParams.set('intent', resumeIntent);
        authGateUrl.searchParams.set('targetType', 'host_dashboard');
        authGateUrl.searchParams.set('return_to', `${returnToUrl.pathname}${returnToUrl.search}${returnToUrl.hash}`);
        window.location.replace(`${authGateUrl.pathname}${authGateUrl.search}`);
    }, [authReady, hasBeauRocksAccount, isDemoHostEmbed, view]);
    if (canonicalRedirectUrl) return <ViewLoader />;
    if (isKaraokeTerms) return <KaraokeTerms />;
    if (isKaraokePrivacy) return <KaraokePrivacy />;
    if (isKaraokeDataDeletion) return <KaraokeDataDeletion />;
    if (view === 'landing') return <Landing hasBeauRocksAccount={hasBeauRocksAccount} onJoin={(c) => { setRoomCode(c); setView('mobile'); }} />;
    if (view === 'tv') return (
        <Suspense fallback={<ViewLoader />}>
            <PublicTV roomCode={roomCode} />
        </Suspense>
    );
    const retryAuth = async () => {
        setAuthError(null);
        const res = await initAuth({ viewHint: view });
        if (!res?.ok && res?.error) {
            setAuthError(res.error);
        }
    };

    if (view === 'host') {
        if (!authReady || (!hasBeauRocksAccount && !isDemoHostEmbed)) return <ViewLoader />;
        return (
            <Suspense fallback={<ViewLoader />}>
                <ToastProvider>
                    <HostApp roomCode={roomCode} uid={uid} authError={authError} retryAuth={retryAuth} />
                </ToastProvider>
            </Suspense>
        );
    }
    if (view === 'host_qa') return (
        <Suspense fallback={<ViewLoader />}>
            <ToastProvider>
                <HostRunOfShowQaHarness roomCode={roomCode} fixtureId={typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '').get('qaHostFixture') || 'run-of-show-console' : 'run-of-show-console'} />
            </ToastProvider>
        </Suspense>
    );
    if (view === 'audience_qa') return (
        <Suspense fallback={<ViewLoader />}>
            <AudienceQaHarness
                roomCode={roomCode || 'DEMOAUD'}
                fixtureId={typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '').get('qaAudienceFixture') || 'classic-home' : 'classic-home'}
            />
        </Suspense>
    );
    if (view === 'voice_games_qa') return (
        <Suspense fallback={<ViewLoader />}>
            <VoiceGamesQaHarness roomCode={roomCode || 'DEMOVOICE'} />
        </Suspense>
    );
    if (view === 'recap') return (
        <Suspense fallback={<ViewLoader />}>
            <RecapView roomCode={roomCode} />
        </Suspense>
    );
    if (view === 'marketing') return (
        <Suspense fallback={<ViewLoader />}>
            <MarketingSite />
        </Suspense>
    );
    
    // Mobile View needs Toast Provider
    if (view === 'mobile') return (uid || qaAudienceFixtureId) ? (
        <Suspense fallback={<ViewLoader />}>
            <ToastProvider>
                <SingerApp roomCode={roomCode} uid={qaAudienceFixtureId ? `qa_${qaAudienceFixtureId}` : uid} />
            </ToastProvider>
        </Suspense>
    ) : <ViewLoader />;

    return null;
};

export default App;
