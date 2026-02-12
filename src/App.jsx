import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { auth, onAuthStateChanged, initAuth } from './lib/firebase';
import { ASSETS } from './lib/assets';

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

const getInitialRouteState = () => {
    if (typeof window === 'undefined') {
        return { view: 'landing', roomCode: '' };
    }
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const r = params.get('room');
    const m = params.get('mode');
    if (m === 'marketing' || /\/marketing(\/.*)?$/.test(pathname)) {
        return { view: 'marketing', roomCode: '' };
    }
    if (m === 'host') {
        return { view: 'host', roomCode: r ? r.toUpperCase() : '' };
    }
    if (m === 'recap') {
        return { view: 'recap', roomCode: r ? r.toUpperCase() : '' };
    }
    if (r) {
        return { view: m === 'tv' ? 'tv' : 'mobile', roomCode: r.toUpperCase() };
    }
    return { view: 'landing', roomCode: '' };
};

const Landing = ({ onJoin }) => {
    const [code, setCode] = useState('');
    const [showHostGate, setShowHostGate] = useState(false);
    const [hostPasscode, setHostPasscode] = useState('');
    const [hostPasscodeError, setHostPasscodeError] = useState('');
    const appBase = typeof window !== 'undefined' ? `${window.location.origin}${import.meta.env.BASE_URL || '/'}` : '';
    const hostGateCode = import.meta.env.VITE_HOST_PASSCODE || '';
    const handleOpenHostControls = () => {
        if (hostGateCode) {
            setShowHostGate(true);
            return;
        }
        window.location.href = code ? `${appBase}?room=${code}&mode=host` : `${appBase}?mode=host`;
    };
    const handleSubmitHostGate = () => {
        if (hostPasscode.trim() !== hostGateCode) {
            setHostPasscodeError('Incorrect passcode.');
            return;
        }
        setHostPasscodeError('');
        setShowHostGate(false);
        setHostPasscode('');
        window.location.href = code ? `${appBase}?room=${code}&mode=host` : `${appBase}?mode=host`;
    };
    return ( 
        <div className="h-full w-full overflow-y-auto bg-black relative font-saira text-white">
            <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-zinc-900/90 p-8 rounded-3xl border border-zinc-700 backdrop-blur-md max-w-md w-full shadow-2xl relative z-10">
                    <img src={ASSETS.logo} className="w-96 mx-auto mb-6 drop-shadow-xl rounded-3xl" alt="Bross Karaoke"/>
                    <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" className="w-full bg-zinc-800 border-2 border-zinc-600 p-4 text-center text-3xl font-mono tracking-widest rounded-xl text-white uppercase mb-4 focus:border-pink-500 outline-none transition-colors"/>
                    
                    <button onClick={()=>code && onJoin(code)} className="w-full bg-pink-600 py-4 rounded-xl font-bold text-xl mb-4 text-white shadow-lg hover:bg-pink-500 transition-colors">
                        JOIN PARTY (MOBILE)
                    </button>
                    
                    <button onClick={()=>code && (window.location.href = `${appBase}?room=${code}&mode=tv`)} className="w-full bg-cyan-600 py-3 rounded-xl font-bold text-lg text-white mb-2 hover:bg-cyan-500 transition-colors">
                        LAUNCH TV DISPLAY
                    </button>
                    
                    <button onClick={handleOpenHostControls} className="w-full bg-zinc-700 py-2 rounded-xl font-bold text-sm text-zinc-300 hover:bg-zinc-600 hover:text-white transition-colors mt-2">
                        HOST CONTROLS
                    </button>
                    <button
                        onClick={() => { window.location.href = `${appBase}?mode=marketing`; }}
                        className="w-full bg-zinc-800 py-2 rounded-xl font-bold text-sm text-cyan-200 hover:bg-zinc-700 transition-colors mt-2 border border-cyan-500/30"
                    >
                        VIEW MARKETING SITE
                    </button>
                </div>
                {showHostGate && (
                    <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-6">
                        <div className="w-full max-w-sm bg-gradient-to-br from-[#120b1a] via-[#0f1218] to-[#0a0d12] border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,196,217,0.35)] text-left">
                            <div className="flex items-center gap-4 mb-4">
                                <img src={ASSETS.logo} className="h-16 w-16 rounded-2xl drop-shadow-[0_0_18px_rgba(0,196,217,0.4)]" alt="Beaurocks Karaoke" />
                                <div>
                                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Host Controls</div>
                                    <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] to-[#EC4899]">
                                        Enter Passcode
                                    </div>
                                </div>
                            </div>
                            <input
                                type="password"
                                value={hostPasscode}
                                onChange={(e) => {
                                    setHostPasscode(e.target.value);
                                    if (hostPasscodeError) setHostPasscodeError('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSubmitHostGate();
                                }}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-lg text-white mb-3"
                                placeholder="Passcode"
                                autoFocus
                            />
                            {hostPasscodeError && (
                                <div className="text-sm text-pink-300 mb-3">{hostPasscodeError}</div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowHostGate(false); setHostPasscode(''); setHostPasscodeError(''); }}
                                    className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-200 py-3 rounded-xl font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitHostGate}
                                    className="flex-1 bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black py-3 rounded-xl font-black"
                                >
                                    Unlock
                                </button>
                            </div>
                            <div className="text-xs text-zinc-500 mt-3">Need access? Ask the host for the code.</div>
                        </div>
                    </div>
                )}
            </div>
        </div> 
    );
};

const KaraokeTerms = () => (
    <div className="min-h-screen w-full bg-black text-white font-saira flex items-center justify-center p-6">
        <div className="w-full max-w-3xl bg-zinc-900/90 border border-zinc-700 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
                <img src={ASSETS.logo} className="h-16 w-auto drop-shadow-[0_0_18px_rgba(255,103,182,0.7)]" alt="BROSS Karaoke" />
                <div>
                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">BROSS Karaoke</div>
                    <h1 className="text-3xl font-bebas text-pink-300">Party Rules + Terms</h1>
                </div>
            </div>
            <div className="space-y-4 text-base text-zinc-200 leading-relaxed">
                <p>We want this room loud, joyful, and safe. By joining, you agree to play nice and keep the vibe respectful.</p>
                <ul className="space-y-3">
                    <li className="flex gap-2"><span className="text-cyan-300">&bull;</span>No harassment, hate speech, threats, or illegal content. Keep it fun.</li>
                    <li className="flex gap-2"><span className="text-cyan-300">&bull;</span>Only share content you own or have permission to use.</li>
                    <li className="flex gap-2"><span className="text-cyan-300">&bull;</span>BROSS can remove content or users to keep the room safe and on-beat.</li>
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
    const initialRoute = getInitialRouteState();
    const [view, setView] = useState(() => initialRoute.view);
    const [roomCode, setRoomCode] = useState(() => initialRoute.roomCode);
    const [uid, setUid] = useState(null);
    const [authError, setAuthError] = useState(null);
    const isKaraokeTerms = typeof window !== 'undefined'
        && window.location.pathname.replace(/\/+$/, '').endsWith('/karaoke/terms');

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
                setAuthError(null);
            }
        });
        return () => unsub();
    }, []);
    if (isKaraokeTerms) return <KaraokeTerms />;
    if (view === 'landing') return <Landing onJoin={(c) => { setRoomCode(c); setView('mobile'); }} />;
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

    if (view === 'host') return (
        <Suspense fallback={<ViewLoader />}>
            <ToastProvider>
                <HostApp roomCode={roomCode} uid={uid} authError={authError} retryAuth={retryAuth} />
            </ToastProvider>
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

