import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { auth, onAuthStateChanged, initAuth } from './lib/firebase';
import { ASSETS } from './lib/assets';
import { marketingFlags } from './apps/Marketing/featureFlags';
import { MARKETING_ROUTE_PAGES, isMarketingPath } from './apps/Marketing/routing';
import { buildSurfaceUrl, inferSurfaceFromHostname } from './lib/surfaceDomains';

// App Views
const PublicTV = lazy(() => import('./apps/TV/PublicTV'));
const SingerApp = lazy(() => import('./apps/Mobile/SingerApp'));
const RecapView = lazy(() => import('./apps/Recap/RecapView'));
const HostApp = lazy(() => import('./apps/Host/HostApp'));
const MarketingSite = lazy(() => import('./apps/Marketing/MarketingSite'));

const ViewLoader = () => (
    <div className="h-screen w-screen bg-black flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
    </div>
);

const DEFAULT_CANONICAL_MARKETING_ORIGIN = 'https://beaurocks.app';
const MANAGED_HOST_PATTERN = /\.(web\.app|firebaseapp\.com)$/i;

const normalizeOrigin = (value = '') => String(value || '').trim().replace(/\/+$/, '');

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
    const legacyPage = String(params.get('page') || '').trim().toLowerCase();
    const isHostAccessRoute = normalizedPathname === '/host-access'
        || legacyPage === 'host_access'
        || legacyPage === 'host-access';
    const marketingRouteRequested = (
        params.get('mode') === 'marketing'
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

const getInitialRouteState = () => {
    if (typeof window === 'undefined') {
        return { view: 'landing', roomCode: '' };
    }
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const detectedSurface = inferSurfaceFromHostname(window.location.hostname, window.location);
    const r = params.get('room');
    const m = params.get('mode');
    if (m === 'host') {
        return { view: 'host', roomCode: r ? r.toUpperCase() : '' };
    }
    if (m === 'recap') {
        return { view: 'recap', roomCode: r ? r.toUpperCase() : '' };
    }
    if (pathname === '/host' || pathname === '/host-dashboard') {
        return { view: 'host', roomCode: r ? r.toUpperCase() : '' };
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
    if (r) {
        return { view: m === 'tv' ? 'tv' : 'mobile', roomCode: r.toUpperCase() };
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
                ? buildSurfaceUrl({ surface: 'marketing', path: 'discover' }, window.location)
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
                </div>
            </div>
        </div> 
    );
};

const KaraokeTerms = () => (
    <div className="min-h-screen w-full bg-black text-white font-saira flex items-center justify-center p-6">
        <div className="w-full max-w-3xl bg-zinc-900/90 border border-zinc-700 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
                <img src={ASSETS.logo} className="h-16 w-auto drop-shadow-[0_0_18px_rgba(255,103,182,0.7)]" alt="BeauRocks Karaoke" />
                <div>
                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">BeauRocks Karaoke</div>
                    <h1 className="text-3xl font-bebas text-pink-300">Party Rules + Terms</h1>
                </div>
            </div>
            <div className="space-y-4 text-base text-zinc-200 leading-relaxed">
                <p>We want this room loud, joyful, and safe. By joining, you agree to play nice and keep the vibe respectful.</p>
                <ul className="space-y-3">
                    <li className="flex gap-2"><span className="text-cyan-300">&bull;</span>No harassment, hate speech, threats, or illegal content. Keep it fun.</li>
                    <li className="flex gap-2"><span className="text-cyan-300">&bull;</span>Only share content you own or have permission to use.</li>
                    <li className="flex gap-2"><span className="text-cyan-300">&bull;</span>BeauRocks can remove content or users to keep the room safe and on-beat.</li>
                    <li className="flex gap-2"><span className="text-cyan-300">&bull;</span>You're responsible for your content and conduct.</li>
                </ul>
                <p className="text-sm text-zinc-400">Questions? Reach out to support for the full legal terms and policies.</p>
            </div>
            <button
                onClick={() => window.history.back()}
                className="mt-6 w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold text-base"
            >
                Back to the party
            </button>
        </div>
    </div>
);

const App = () => {
    const [canonicalRedirectUrl] = useState(() => {
        if (typeof window === 'undefined') return '';
        return getCanonicalManagedHostRedirectUrl(window.location)
            || getCanonicalSurfaceRedirectUrl(window.location);
    });
    const initialRoute = getInitialRouteState();
    const [view, setView] = useState(() => initialRoute.view);
    const [roomCode, setRoomCode] = useState(() => initialRoute.roomCode);
    const [uid, setUid] = useState(null);
    const [hasBeauRocksAccount, setHasBeauRocksAccount] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const isKaraokeTerms = typeof window !== 'undefined'
        && window.location.pathname.replace(/\/+$/, '').endsWith('/karaoke/terms');

    useEffect(() => {
        if (!canonicalRedirectUrl || typeof window === 'undefined') return;
        window.location.replace(canonicalRedirectUrl);
    }, [canonicalRedirectUrl]);

    // 1. Initialize Auth
    useEffect(() => {
        initAuth().then((res) => {
            if (!res?.ok && res?.error) {
                setAuthError(res.error);
            }
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
        if (!authReady || hasBeauRocksAccount || typeof window === 'undefined') return;

        const resumeIntent = 'host_dashboard_resume';
        const baseHref = marketingFlags.routePathsEnabled
            ? buildSurfaceUrl({ surface: 'host', path: 'host-access' }, window.location)
            : buildSurfaceUrl({
                surface: 'host',
                params: { mode: 'marketing', page: MARKETING_ROUTE_PAGES.hostAccess },
            }, window.location);
        const returnToUrl = new URL(baseHref);
        returnToUrl.searchParams.set('intent', resumeIntent);
        const authGateUrl = new URL(baseHref);
        authGateUrl.searchParams.set('intent', resumeIntent);
        authGateUrl.searchParams.set('targetType', 'host_dashboard');
        authGateUrl.searchParams.set('return_to', `${returnToUrl.pathname}${returnToUrl.search}`);
        window.location.replace(`${authGateUrl.pathname}${authGateUrl.search}`);
    }, [authReady, hasBeauRocksAccount, view]);
    if (canonicalRedirectUrl) return <ViewLoader />;
    if (isKaraokeTerms) return <KaraokeTerms />;
    if (view === 'landing') return <Landing hasBeauRocksAccount={hasBeauRocksAccount} onJoin={(c) => { setRoomCode(c); setView('mobile'); }} />;
    if (view === 'tv') return (
        <Suspense fallback={<ViewLoader />}>
            <PublicTV roomCode={roomCode} />
        </Suspense>
    );
    const retryAuth = async () => {
        setAuthError(null);
        const res = await initAuth();
        if (!res?.ok && res?.error) {
            setAuthError(res.error);
        }
    };

    if (view === 'host') {
        if (!authReady || !hasBeauRocksAccount) return <ViewLoader />;
        return (
            <Suspense fallback={<ViewLoader />}>
                <ToastProvider>
                    <HostApp roomCode={roomCode} uid={uid} authError={authError} retryAuth={retryAuth} />
                </ToastProvider>
            </Suspense>
        );
    }
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
    if (view === 'mobile') return uid ? (
        <Suspense fallback={<ViewLoader />}>
            <ToastProvider>
                <SingerApp roomCode={roomCode} uid={uid} />
            </ToastProvider>
        </Suspense>
    ) : <ViewLoader />;

    return null;
};

export default App;
