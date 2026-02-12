import React, { useEffect, useState } from 'react';
import { db, doc, onSnapshot } from '../../lib/firebase';
import { APP_ID, ASSETS } from '../../lib/assets';

const nowMs = () => Date.now();

const StatCard = ({ label, value }) => (
    <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-4 text-center">
        <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 mb-2">{label}</div>
        <div className="text-3xl font-bold text-white">{value}</div>
    </div>
);

const RecapView = ({ roomCode }) => {
    const [room, setRoom] = useState(null);

    useEffect(() => {
        if (!roomCode) return undefined;
        const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), snap => {
            setRoom(snap.exists() ? snap.data() : null);
        });
        return () => unsub();
    }, [roomCode]);

    const recap = room?.recap;
    const tournament = recap?.tournament || null;

    if (!roomCode) {
        return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Missing room code.</div>;
    }

    if (!recap) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
                <img src={ASSETS.logo} className="h-20 mb-4" alt="BROSS" />
                <div className="text-2xl font-bold">Recap not ready yet</div>
                <div className="text-sm text-zinc-400 mt-2">Ask the host to close the room to generate the highlight reel.</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-saira p-8">
            <div className="max-w-6xl mx-auto">
                <div className="relative overflow-hidden rounded-[2.5rem] border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-10 mb-10">
                    <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl"></div>
                    <div className="absolute -left-20 bottom-0 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div>
                            <div className="text-xs uppercase tracking-[0.4em] text-zinc-500">BROSS Karaoke Recap</div>
                            <div className="text-4xl md:text-5xl font-bold text-white mt-2">Room {roomCode}</div>
                            <div className="text-sm text-zinc-400 mt-2">Generated {new Date(recap?.generatedAt || nowMs()).toLocaleString()}</div>
                        </div>
                        <img src={room?.logoUrl || ASSETS.logo} className="h-16 md:h-20 object-contain" alt="BROSS" />
                    </div>
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                        <StatCard label="Songs Performed" value={recap.totalSongs || 0} />
                        <StatCard label="Total Singers" value={recap.totalUsers || 0} />
                        <StatCard label="Loudest Applause" value={recap.loudestPerformance?.applauseScore || 0} />
                    </div>
                </div>

                {recap.loudestPerformance && (
                    <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-5 mb-8">
                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-3">Loudest Performance</div>
                        <div className="text-2xl font-bold text-white">{recap.loudestPerformance.singer}</div>
                        <div className="text-sm text-zinc-400">{recap.loudestPerformance.song}</div>
                    </div>
                )}

                {tournament && (
                    <div className="mb-10 rounded-[2rem] border border-rose-400/30 bg-gradient-to-br from-rose-950/40 via-zinc-900 to-black p-6">
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                            <div>
                                <div className="text-xs uppercase tracking-[0.38em] text-rose-300/80">Tournament Time Capsule</div>
                                <div className="text-3xl font-bold text-white mt-2">{tournament?.timeCapsule?.posterTitle || 'Sweet 16 Recap'}</div>
                                <div className="text-sm text-zinc-400 mt-2">{tournament?.timeCapsule?.tagline || 'Bracket highlights from the night.'}</div>
                            </div>
                            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-center min-w-[220px]">
                                <div className="text-xs uppercase tracking-[0.32em] text-emerald-200">Champion</div>
                                <div className="text-5xl mt-2">{tournament?.championAvatar || '🏆'}</div>
                                <div className="text-2xl font-bold text-white mt-2">{tournament?.championName || 'Winner'}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                            <StatCard label="Bracket Size" value={tournament?.size || 0} />
                            <StatCard label="Rounds" value={tournament?.roundsCount || 0} />
                            <StatCard label="Resolved Matches" value={(tournament?.matchHistory || []).length} />
                            <StatCard label="Audit Events" value={(tournament?.auditTrail || []).length} />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                            <div className="rounded-xl border border-zinc-700 bg-black/35 p-4">
                                <div className="text-xs uppercase tracking-[0.32em] text-zinc-500 mb-3">Final Match Trail</div>
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {(tournament?.matchHistory || []).slice().reverse().slice(0, 10).map((entry) => (
                                        <div key={entry.id} className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2">
                                            <div className="text-sm text-white"><span className="font-bold">{entry.winnerName || 'Winner'}</span> defeated {entry.aName || 'A'} vs {entry.bName || 'B'}</div>
                                            <div className="text-[11px] text-zinc-400 mt-1">{entry.roundName || 'Round'} • Match {entry.slot || '-'} • {entry.resolutionType || 'manual'}</div>
                                        </div>
                                    ))}
                                    {!(tournament?.matchHistory || []).length && <div className="text-sm text-zinc-500">No tournament match history captured.</div>}
                                </div>
                            </div>
                            <div className="rounded-xl border border-zinc-700 bg-black/35 p-4">
                                <div className="text-xs uppercase tracking-[0.32em] text-zinc-500 mb-3">Tournament Moments</div>
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {(tournament?.timeCapsule?.moments || []).slice(0, 10).map((moment) => (
                                        <div key={moment.id} className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2">
                                            <div className="text-sm text-zinc-200">{moment.text || 'Tournament moment'}</div>
                                            <div className="text-[11px] text-zinc-500 mt-1">{new Date(moment.at || nowMs()).toLocaleString()}</div>
                                        </div>
                                    ))}
                                    {!(tournament?.timeCapsule?.moments || []).length && <div className="text-sm text-zinc-500">No tournament moments captured.</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-5">
                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-4">Top Performers</div>
                        <div className="space-y-3">
                            {(recap.topPerformers || []).map((p, idx) => (
                                <div key={`${p.name}-${idx}`} className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{p.avatar || 'O'}</span>
                                        <div className="font-bold">{p.name || 'Singer'}</div>
                                    </div>
                                    <div className="text-sm text-zinc-400">{p.performances || 0} perf</div>
                                </div>
                            ))}
                            {(recap.topPerformers || []).length === 0 && <div className="text-sm text-zinc-500">No performers yet.</div>}
                        </div>
                    </div>
                    <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-5">
                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-4">Top Emoji Senders</div>
                        <div className="space-y-3">
                            {(recap.topEmojis || []).map((p, idx) => (
                                <div key={`${p.name}-${idx}`} className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{p.avatar || 'O'}</span>
                                        <div className="font-bold">{p.name || 'Guest'}</div>
                                    </div>
                                    <div className="text-sm text-zinc-400">{p.totalEmojis || 0} emojis</div>
                                </div>
                            ))}
                            {(recap.topEmojis || []).length === 0 && <div className="text-sm text-zinc-500">No emoji stats yet.</div>}
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-5 mb-10">
                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-4">Photo Highlights</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(recap.photos || []).slice(0, 12).map(photo => (
                            <img key={photo.id} src={photo.url} alt={photo.userName} className="w-full h-36 object-cover rounded-xl border border-white/10" />
                        ))}
                        {(recap.photos || []).length === 0 && (
                            <div className="col-span-2 md:col-span-4 text-sm text-zinc-500 text-center py-6">No photos captured yet.</div>
                        )}
                    </div>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-5 mb-10">
                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-4">Moments of the Night</div>
                    <div className="space-y-3">
                        {(recap.highlights || []).slice(0, 12).map((h, idx) => (
                            <div key={`${h.id || h.timestamp || 'moment'}-${idx}`} className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{h.icon || '★'}</span>
                                    <div className="text-sm text-white">{h.text || 'Great moment'}</div>
                                </div>
                                <div className="text-xs text-zinc-500">{h.user || 'Guest'}</div>
                            </div>
                        ))}
                        {(recap.highlights || []).length === 0 && (
                            <div className="text-sm text-zinc-500">No highlights recorded yet.</div>
                        )}
                    </div>
                </div>

                <div className="text-center text-xs text-zinc-500">
                    Share this page with friends or save the recap JSON from the host panel.
                </div>
            </div>
        </div>
    );
};

export default RecapView;
