import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePitch } from '../../hooks/usePitch';
import { db, doc, onSnapshot, updateDoc, writeBatch } from '../../lib/firebase';
import { APP_ID, GAME_ASSETS } from '../../lib/assets';
import { playSfx } from '../../lib/utils';
import { EMOJI } from '../../lib/emoji';
import { createProfiler } from '../../lib/profiler';
import VoiceHud from '../../components/VoiceHud';

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const FLAP_THRESHOLD = 0.28;
const FLAP_RESET_THRESHOLD = 0.12;
const SPIKE_THRESHOLD = 0.05;
const GLIDE_THRESHOLD = 0.15;
const SHIELD_THRESHOLD = 0.52;
const BASE_GRAVITY = 0.18;
const FLAP_FORCE = -4.8;
const MIN_SPAWN_MS = 1550;
const START_GRACE_MS = 2600;
const START_COUNTDOWN_MS = 1800;
const WARMUP_FLIGHT_MS = 2200;
const FIRST_OBSTACLE_DELAY_MS = 3200;
const HOST_ASSIST_DEFAULT_MS = 3200;
const HOST_ASSIST_BANNER_MS = 2200;
const HOST_ASSIST_LIFT = 8;

const FlappyGame = ({ isPlayer, roomCode, playerData, onGameOver, inputSource, gameState, view = 'tv' }) => {
    const data = playerData || gameState || {};
    const controlSource = data.inputSource || inputSource || 'remote';
    const isRoomControlled = controlSource === 'ambient' || controlSource === 'crowd' || controlSource === 'local';
    const isController = isPlayer && (isRoomControlled ? view === 'tv' : view !== 'tv');
    const isLocalInput = isController && inputSource !== 'remote';
    const { pitch, note, confidence, volumeNormalized, stableNote, stability, calibrating, isSinging } = usePitch(isLocalInput, {
        smoothingFactor: 0.42,
        confidenceThreshold: 0.46,
        singingThreshold: 0.04,
        stableNoteMs: 220,
        noiseGateMultiplier: 1.4
    }); 
    const startsPlaying = isRoomControlled;
    
    // Create profiler instance
    const profilerRef = useRef(createProfiler('FlappyBird'));
    
    // Game State
    const [birdY, setBirdY] = useState(50); 
    const [score, setScore] = useState(0); 
    const [obstacles, setObstacles] = useState([]); 
    const [coins, setCoins] = useState([]); 
    const [gameStateLocal, setGameStateLocal] = useState(() => (startsPlaying ? 'playing' : 'ready')); 
    const [lives, setLives] = useState(3); 
    const [invincible, setInvincible] = useState(false); 
    const [screechActive, setScreechActive] = useState(false); 
    const [remoteVoice, setRemoteVoice] = useState({ note: '-', confidence: 0, volumeNormalized: 0, stableNote: '-', stability: 0, calibrating: false }); 
    const [hostAssistBanner, setHostAssistBanner] = useState(null);
    
    // Refs for Loop
    const birdYRef = useRef(50); 
    const obstaclesRef = useRef([]); 
    const coinsRef = useRef([]); 
    const scoreRef = useRef(0); 
    const speedRef = useRef(0.6); 
    const voiceRef = useRef({ pitch: 0, confidence: 0, volumeNormalized: 0, stableNote: '-', stability: 0, isSinging: false }); 
    const velocityRef = useRef(0);
    const lastFlapRef = useRef(0);
    const prevVolRef = useRef(0);
    const voiceGateRef = useRef(false);
    const lastObstacleSpawnAtRef = useRef(0);
    const roundStartedAtRef = useRef(0);
    const hostAssistShieldUntilRef = useRef(0);
    const hostAssistBannerTimeoutRef = useRef(null);
    const lastHostAssistIdRef = useRef('');

    const triggerFlap = useCallback(() => {
        if (!isController || gameStateLocal === 'gameover') return;
        const now = performance.now();
        if (now - lastFlapRef.current < 110) return;
        velocityRef.current = FLAP_FORCE;
        lastFlapRef.current = now;
    }, [isController, gameStateLocal]);

    useEffect(() => {
        if (!isController) return undefined;
        const handleKeyDown = (event) => {
            if (event.code !== 'Space' && event.code !== 'ArrowUp' && event.code !== 'KeyW') return;
            event.preventDefault();
            if (gameStateLocal === 'ready') setGameStateLocal('playing');
            triggerFlap();
        };
        window.addEventListener('keydown', handleKeyDown, { passive: false });
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isController, gameStateLocal, triggerFlap]);

    useEffect(() => {
        if (!isController || gameStateLocal !== 'ready' || !startsPlaying) return;
        const t = setTimeout(() => setGameStateLocal('playing'), START_COUNTDOWN_MS);
        return () => clearTimeout(t);
    }, [isController, gameStateLocal, startsPlaying]);

    // 1. SYNC: Player sends state to Firebase
    useEffect(() => { 
        if(!isController) return; 
        let writeInFlight = false;
        const sync = setInterval(async () => { 
            const syncMark = profilerRef.current.markStart('firebaseSync');
            if (writeInFlight) {
                profilerRef.current.markEnd(syncMark);
                return;
            }
            writeInFlight = true;
            try {
                const batch = writeBatch(db);
                const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
                batch.update(roomRef, { 
                    'gameData.birdY': birdYRef.current, 
                    'gameData.score': scoreRef.current, 
                    'gameData.lives': lives, 
                    'gameData.status': gameStateLocal, 
                    'gameData.obstacles': obstaclesRef.current, 
                    'gameData.coins': coinsRef.current,
                    'gameData.voice': {
                        note: voiceRef.current.stableNote !== '-' ? voiceRef.current.stableNote : note,
                        confidence: voiceRef.current.confidence,
                        volumeNormalized: voiceRef.current.volumeNormalized,
                        stableNote: voiceRef.current.stableNote,
                        stability: voiceRef.current.stability
                    }
                });
                await batch.commit();
            } catch (e) {
                console.error("Sync error:", e);
            } finally {
                writeInFlight = false;
                profilerRef.current.markEnd(syncMark);
            }
        }, 200); 
        return () => clearInterval(sync); 
    }, [score, lives, gameStateLocal, isController, roomCode, note]);

    useEffect(() => {
        if (!isController || gameStateLocal !== 'gameover') return;
        updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
            'gameData.birdY': birdYRef.current,
            'gameData.score': scoreRef.current,
            'gameData.lives': lives,
            'gameData.status': 'gameover',
            'gameData.obstacles': obstaclesRef.current,
            'gameData.coins': coinsRef.current,
            'gameData.voice': {
                note: voiceRef.current.stableNote !== '-' ? voiceRef.current.stableNote : note,
                confidence: voiceRef.current.confidence,
                volumeNormalized: voiceRef.current.volumeNormalized,
                stableNote: voiceRef.current.stableNote,
                stability: voiceRef.current.stability
            }
        }).catch((e) => {
            console.error('Final sync error:', e);
        });
    }, [isController, gameStateLocal, roomCode, lives, note]);

    // 2. SYNC: Spectator listens to Firebase
    useEffect(() => { 
        if(isController) return; 
        const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), s => { 
            const d = s.data()?.gameData; 
            if(d) { 
                setBirdY(d.birdY || 50); 
                setScore(d.score || 0); 
                setLives(d.lives || 3); 
                setObstacles(d.obstacles || []); 
                setCoins(d.coins || []); 
                setGameStateLocal(d.status || 'ready');
                if (d.voice) setRemoteVoice(d.voice);
            } 
        }); 
        return () => unsub(); 
    }, [isController, roomCode]);

    useEffect(() => {
        voiceRef.current = { pitch, confidence, volumeNormalized, stableNote, stability, isSinging };
    }, [pitch, confidence, volumeNormalized, stableNote, stability, isSinging]);

    useEffect(() => {
        const hostAssist = data?.hostAssist;
        const assistId = String(hostAssist?.id || '').trim();
        if (!assistId || assistId === lastHostAssistIdRef.current) return;

        const durationMs = Math.max(1200, Number(hostAssist?.durationMs || HOST_ASSIST_DEFAULT_MS));
        const triggeredAt = Number(hostAssist?.triggeredAt || 0);
        if (triggeredAt && Date.now() - triggeredAt > durationMs + HOST_ASSIST_BANNER_MS + 1500) {
            lastHostAssistIdRef.current = assistId;
            return;
        }

        lastHostAssistIdRef.current = assistId;
        hostAssistShieldUntilRef.current = Date.now() + durationMs;
        setHostAssistBanner({
            label: hostAssist?.label || 'HOST RESCUE',
            by: hostAssist?.by || 'Host'
        });
        if (hostAssistBannerTimeoutRef.current) {
            clearTimeout(hostAssistBannerTimeoutRef.current);
        }
        hostAssistBannerTimeoutRef.current = setTimeout(() => setHostAssistBanner(null), HOST_ASSIST_BANNER_MS);

        if (isController && gameStateLocal === 'playing') {
            velocityRef.current = Math.min(velocityRef.current, FLAP_FORCE - 0.4);
            birdYRef.current = clamp(birdYRef.current - HOST_ASSIST_LIFT, 8, 100);
            setBirdY(birdYRef.current);
            setScreechActive(true);
        }
    }, [data, gameStateLocal, isController]);

    useEffect(() => () => {
        if (hostAssistBannerTimeoutRef.current) {
            clearTimeout(hostAssistBannerTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (gameStateLocal !== 'playing') return;
        if (!roundStartedAtRef.current) {
            roundStartedAtRef.current = performance.now();
        }
    }, [gameStateLocal]);

    useEffect(() => {
        if (gameStateLocal !== 'ready') return;
        birdYRef.current = 50;
        velocityRef.current = 0;
        prevVolRef.current = 0;
        voiceGateRef.current = false;
        lastObstacleSpawnAtRef.current = 0;
        roundStartedAtRef.current = 0;
        hostAssistShieldUntilRef.current = 0;
        obstaclesRef.current = [];
        coinsRef.current = [];
        setBirdY(50);
        setObstacles([]);
        setCoins([]);
        setScreechActive(false);
        setHostAssistBanner(null);
    }, [gameStateLocal]);
    
    // 3. GAME LOOP (Player Only)
    useEffect(() => {
        if(!isController || gameStateLocal !== 'playing') return;
        let raf;
        const loop = () => {
            const loopMark = profilerRef.current.markStart('gameLoop');
            const voiceMark = profilerRef.current.markStart('voiceProcess');
            
            const voice = voiceRef.current;
            const stableBoost = voice.volumeNormalized >= 0.48;
            const shieldActive = voice.volumeNormalized >= SHIELD_THRESHOLD;
            const hostAssistShieldActive = hostAssistShieldUntilRef.current > Date.now();

            profilerRef.current.markEnd(voiceMark);

            // Physics
            const now = performance.now();
            const roundElapsedMs = roundStartedAtRef.current ? now - roundStartedAtRef.current : 0;
            const warmupFlightActive = roundElapsedMs < WARMUP_FLIGHT_MS;
            const vol = voice.volumeNormalized || 0;
            const delta = vol - prevVolRef.current;
            prevVolRef.current = vol;
            const voiceActive = voice.isSinging || vol >= GLIDE_THRESHOLD;
            const canFlap = now - lastFlapRef.current > 150;
            const crossedHigh = vol >= FLAP_THRESHOLD && !voiceGateRef.current;
            const voiceSpike = vol >= GLIDE_THRESHOLD && delta >= SPIKE_THRESHOLD;
            if (vol <= FLAP_RESET_THRESHOLD) {
                voiceGateRef.current = false;
            }
            if ((crossedHigh || voiceSpike) && canFlap) {
                velocityRef.current = FLAP_FORCE;
                lastFlapRef.current = now;
                voiceGateRef.current = true;
            }
            const glideAssist = voiceActive ? clamp((vol - GLIDE_THRESHOLD) * 0.28, 0, 0.18) : 0;
            const sustainedLift = voiceActive ? clamp((vol - FLAP_THRESHOLD) * 0.42, 0, 0.24) : 0;
            const warmupLift = warmupFlightActive ? (isRoomControlled ? 0.12 : 0.08) : 0;
            const gravity = clamp((warmupFlightActive ? BASE_GRAVITY * 0.45 : BASE_GRAVITY) - glideAssist, 0.05, BASE_GRAVITY);
            velocityRef.current = clamp(velocityRef.current + gravity - sustainedLift - warmupLift, -4.9, warmupFlightActive ? 2.4 : 3.8);
            let targetY = birdYRef.current + velocityRef.current;

            targetY = clamp(targetY, 0, 100); 
            birdYRef.current = targetY; 
            setBirdY(targetY); 
            setScreechActive(shieldActive || hostAssistShieldActive);

            // Spawning
            if (!lastObstacleSpawnAtRef.current) {
                lastObstacleSpawnAtRef.current = now;
            }
            if (roundElapsedMs >= FIRST_OBSTACLE_DELAY_MS && now - lastObstacleSpawnAtRef.current >= MIN_SPAWN_MS) { 
                const gapHeight = Math.random() * 12 + 38; 
                const gapTop = Math.random() * (100 - gapHeight - 16) + 8; 
                const obstacleId = now;
                obstaclesRef.current.push({ x: 100, gapTop, gapHeight, id: obstacleId }); 
                if(Math.random() > 0.4) coinsRef.current.push({ x: 100, y: gapTop + gapHeight / 2, id: obstacleId + 1 }); 
                lastObstacleSpawnAtRef.current = now;
            }

            // Movement
            speedRef.current = stableBoost ? 0.34 : 0.44;
            obstaclesRef.current = obstaclesRef.current.map(o => ({...o, x: o.x - speedRef.current})).filter(o => o.x > -20);
            coinsRef.current = coinsRef.current.map(c => ({...c, x: c.x - speedRef.current})).filter(c => c.x > -20);
            
            // Cap array sizes to prevent memory growth (Phase 1 optimization)
            if (obstaclesRef.current.length > 100) {
                obstaclesRef.current = obstaclesRef.current.slice(-100);
            }
            if (coinsRef.current.length > 100) {
                coinsRef.current = coinsRef.current.slice(-100);
            }
            
            // Collision: Coins
            const collisionMark = profilerRef.current.markStart('collisionDetection');
            coinsRef.current = coinsRef.current.filter(c => { 
                const collected = c.x < 20 && c.x > 10 && Math.abs(c.y - targetY) < 5; 
                if(collected) { scoreRef.current += stableBoost ? 15 : 10; playSfx(GAME_ASSETS.coin); } 
                return !collected; 
            }); 
            setCoins([...coinsRef.current]);

            // Collision: Obstacles
            if (!invincible && !shieldActive && !hostAssistShieldActive && now - roundStartedAtRef.current > START_GRACE_MS) { 
                let hit = false; 
                const gapForgiveness = isRoomControlled ? 5 : 3;
                obstaclesRef.current.forEach(o => { 
                    if (o.x < 20 && o.x > 0) { 
                        if (targetY < o.gapTop - gapForgiveness || targetY > o.gapTop + o.gapHeight + gapForgiveness) hit = true; 
                    } 
                }); 
                if (hit) { 
                    playSfx(GAME_ASSETS.fail); 
                    setLives(prev => { 
                        const newLives = prev - 1; 
                        if (newLives <= 0) { 
                            setGameStateLocal('gameover'); 
                            setScore(scoreRef.current);
                            if(onGameOver) onGameOver(scoreRef.current); 
                        } else { 
                            birdYRef.current = 50;
                            velocityRef.current = -2.6;
                            setBirdY(50);
                            setInvincible(true); 
                            setTimeout(() => setInvincible(false), 2000); 
                        } 
                        return newLives; 
                    }); 
                } 
            } 
            profilerRef.current.markEnd(collisionMark);
            
            scoreRef.current += 1; 
            if(scoreRef.current % 50 === 0) setScore(scoreRef.current); 
            
            profilerRef.current.markEnd(loopMark);
            profilerRef.current.trackFrameComplete();
            raf = requestAnimationFrame(loop);
        }; 
        raf = requestAnimationFrame(loop); 
        return () => cancelAnimationFrame(raf);
    }, [gameStateLocal, isController, invincible, onGameOver]);

    const spectatorMessage = (() => {
        if (view === 'mobile' && isRoomControlled) {
            return 'Crowd mic mode is running. Bird control is on Public TV. Ask host for Solo Flappy to control from your phone.';
        }
        if (view === 'mobile' && !isRoomControlled) {
            return `Waiting for ${data.playerName || 'the active player'} to play.`;
        }
        return 'WATCHING LIVE FEED';
    })();
    const displayedVolume = clamp(((isController ? volumeNormalized : remoteVoice?.volumeNormalized) || 0) * 100, 0, 100);
    const flapThresholdPct = Math.round(FLAP_THRESHOLD * 100);
    const shieldThresholdPct = Math.round(SHIELD_THRESHOLD * 100);

    const handleControlSurfaceTap = (event) => {
        if (!isController || gameStateLocal === 'gameover') return;
        const tag = String(event?.target?.tagName || '').toLowerCase();
        if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea') return;
        if (gameStateLocal === 'ready') setGameStateLocal('playing');
        triggerFlap();
    };

    return ( 
        <div
            className="relative w-full h-full bg-cyan-900 overflow-hidden font-pixel"
            onPointerDown={handleControlSurfaceTap}
        > 
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-20 scrolling-bg-slow"></div> 
            <div className="absolute inset-0 flex flex-col justify-evenly opacity-30 pointer-events-none">
                {[1,2,3,4,5].map(i => <div key={i} className="w-full h-0.5 bg-white shadow-[0_0_10px_white]"></div>)}
            </div>
            
            {/* HUD */}
            <div className="absolute top-4 left-4 z-20 flex gap-4"> 
                <div className="bg-black/50 p-2 rounded text-yellow-400 border-2 border-white">SCORE: {score}</div> 
                <div className="bg-black/50 p-2 rounded text-red-500 border-2 border-white flex gap-1">{[...Array(3)].map((_,i) => <span key={i}>{i < lives ? EMOJI.heart : EMOJI.skull}</span>)}</div> 
            </div> 
            {hostAssistBanner && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                    <div className="rounded-2xl border border-yellow-200/40 bg-gradient-to-r from-yellow-500/90 via-amber-400/95 to-orange-500/90 px-6 py-3 text-center shadow-[0_0_35px_rgba(251,191,36,0.45)] animate-pulse">
                        <div className="text-xs uppercase tracking-[0.35em] text-black/70">Host Assist</div>
                        <div className="text-2xl md:text-3xl font-black text-black">{hostAssistBanner.label}</div>
                        <div className="text-sm md:text-base font-bold text-black/80">Lift + shield from {hostAssistBanner.by}</div>
                    </div>
                </div>
            )}
            {view === 'tv' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[min(86vw,980px)]">
                    <div className="rounded-2xl border border-white/20 bg-black/58 px-5 py-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
                        <div className="text-[clamp(1rem,1.5vw,1.45rem)] uppercase tracking-[0.14em] text-cyan-100 text-center">
                            Keep an "ahhh" going for lift | Burst above {flapThresholdPct}% to flap | Hold above {shieldThresholdPct}% for shield assist
                        </div>
                        <div className="mt-2 h-3 rounded-full bg-white/10 border border-white/20 relative overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-yellow-300 transition-all duration-120" style={{ width: `${displayedVolume}%` }} />
                            <div className="absolute inset-y-0 w-[2px] bg-cyan-100/80" style={{ left: `${flapThresholdPct}%` }} />
                            <div className="absolute inset-y-0 w-[2px] bg-yellow-100/80" style={{ left: `${shieldThresholdPct}%` }} />
                        </div>
                        <div className="mt-1 text-sm md:text-base text-zinc-200 text-center uppercase tracking-[0.1em]">
                            Live input {Math.round(displayedVolume)}%
                        </div>
                    </div>
                </div>
            )}
            
            {/* Player */}
            <div className={`absolute left-[15%] w-12 h-12 transition-transform duration-75 flex items-center justify-center text-4xl bird-flap ${invincible ? 'opacity-50 animate-pulse' : ''} ${screechActive ? 'drop-shadow-[0_0_15px_rgba(255,255,0,0.8)] scale-125' : ''}`} style={{ top: `${birdY}%`, transform: `translateY(-50%)` }}>
                {playerData?.playerAvatar || gameState?.playerAvatar || 'O'}
            </div> 
            
            {/* Obstacles */}
            {obstacles.map(o => ( 
                <div key={o.id} className="absolute w-[10%] bg-green-800 border-4 border-green-900" style={{ left: `${o.x}%`, top: 0, height: '100%' }}>
                    <div className="absolute w-full bg-cyan-900" style={{ top: `${o.gapTop}%`, height: `${o.gapHeight}%`, left: '-4px', width: 'calc(100% + 8px)', borderTop: '4px solid #14532d', borderBottom: '4px solid #14532d' }}></div>
                </div> 
            ))} 
            {/* Coins */}
            {coins.map(c => (<div key={c.id} className="absolute text-3xl animate-spin" style={{left: `${c.x}%`, top: `${c.y}%`}}>{EMOJI.coin}</div>))} 
            
            {/* Screens */}
            {!isController && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
                    <div className="max-w-2xl text-white/80 bg-black/45 border border-white/15 rounded-2xl px-5 py-4 text-center">
                        {view === 'tv'
                            ? <div className="text-xl animate-pulse">{spectatorMessage}</div>
                            : <div className="text-sm md:text-base">{spectatorMessage}</div>}
                    </div>
                </div>
            )} 
            
            {isController && gameStateLocal === 'ready' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 text-center p-4">
                    <h1 className="text-5xl md:text-7xl text-yellow-400 mb-5">{isRoomControlled ? 'CROWD MIC CONTROL' : 'SOLO CONTROL'}</h1>
                    <div className="max-w-4xl rounded-3xl border border-white/15 bg-black/45 px-8 py-6 space-y-3">
                        <p className="text-2xl md:text-3xl">1. Keep a loud "ahhh" going to keep the bird floating.</p>
                        <p className="text-2xl md:text-3xl">2. Burst above <span className="text-cyan-300 font-black">{flapThresholdPct}%</span> to get a strong flap up.</p>
                        <p className="text-2xl md:text-3xl">3. Hold strong voice above <span className="text-yellow-300 font-black">{shieldThresholdPct}%</span> for shield assist.</p>
                        <p className="text-xl md:text-2xl text-zinc-200">{view === 'tv' ? 'You can also click or press Space to flap.' : 'Tap screen to flap at any time.'}</p>
                    </div>
                    <button onClick={()=>setGameStateLocal('playing')} className="bg-green-600 px-10 py-4 rounded text-white font-bold animate-bounce mt-5 text-3xl">START</button>
                </div>
            )} 
            
            {gameStateLocal === 'gameover' && (
                <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center z-50 text-center">
                    <h1 className="text-4xl text-white mb-4">GAME OVER</h1>
                    <div className="text-2xl text-yellow-400 mb-8">SCORE: {score}</div>
                    {isController && typeof onGameOver === 'function' && <button onClick={()=>onGameOver(score)} className="bg-white text-black px-6 py-2 rounded font-bold">SUBMIT SCORE</button>}
                </div>
            )} 

            <VoiceHud
                note={(isController ? note : remoteVoice.note) || '-'}
                pitch={isController ? pitch : 0}
                confidence={isController ? confidence : remoteVoice.confidence}
                volumeNormalized={isController ? volumeNormalized : remoteVoice.volumeNormalized}
                stableNote={isController ? stableNote : remoteVoice.stableNote}
                stability={isController ? stability : remoteVoice.stability}
                calibrating={isController ? calibrating : remoteVoice.calibrating}
                view={view}
            />
        </div> 
    );
};

export default FlappyGame;
