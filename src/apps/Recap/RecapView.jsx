import React, { useEffect, useMemo, useState } from 'react';
import { collection, db, doc, getDocs, onSnapshot, query, where } from '../../lib/firebase';
import { APP_ID, ASSETS } from '../../lib/assets';
import { normalizeAudienceBrandTheme, withAudienceBrandAlpha } from '../../lib/audienceBrandTheme';
import { getSongArtworkUrl } from '../../lib/roomRecap';
import { resolveRecapBranding, toAbsoluteRecapUrl } from '../../lib/recapBranding';

const n = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const fmt = (value) => new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(n(value, 0))));
const pct = (value, digits = 0) => `${Number(n(value, 0)).toFixed(digits)}%`;
const normalizeText = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const labelFor = (value = '', fallback = 'Guest') => String(value || '').trim() || fallback;
const firstName = (value = '', fallback = 'Guest') => {
    const safe = String(value || '').trim();
    return safe ? safe.split(/\s+/)[0] || fallback : fallback;
};
const firstNameKey = (value = '') => normalizeText(firstName(value, ''));
const dt = (value) => {
    const ts = n(value, 0);
    return ts ? new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
};
const dateLabel = (value) => {
    const ts = n(value, 0);
    return ts ? new Date(ts).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '';
};
const timeRange = (startMs, endMs) => {
    if (!n(startMs, 0) || !n(endMs, 0)) return '';
    const start = new Date(startMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const end = new Date(endMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${start} - ${end}`;
};
const sumReactionCount = (entry = {}) => Math.max(0, n(entry?.count, 1) || 1);
const firstFinite = (...values) => {
    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};
const reactionMeta = (type = '') => ({
    clap: ['👏', 'Claps'],
    crown: ['👑', 'Crowns'],
    fire: ['🔥', 'Fire'],
    heart: ['❤️', 'Hearts'],
    rocket: ['🚀', 'Rockets'],
    applause: ['👏', 'Applause'],
    diamond: ['💎', 'Diamonds'],
    money: ['💸', 'Money'],
    drink: ['🥤', 'Drinks'],
})[String(type || '').trim().toLowerCase()] || ['✨', 'Reaction'];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const ensureMetaTag = ({ name = '', property = '', content = '' }) => {
    if (typeof document === 'undefined') return;
    const attr = property ? 'property' : 'name';
    const key = property || name;
    if (!key) return;
    let node = document.querySelector(`meta[${attr}="${key}"]`);
    if (!node) {
        node = document.createElement('meta');
        node.setAttribute(attr, key);
        document.head.appendChild(node);
    }
    node.setAttribute('content', String(content || ''));
};

const ensureCanonicalLink = (href = '') => {
    if (typeof document === 'undefined') return;
    let node = document.querySelector("link[rel='canonical']");
    if (!node) {
        node = document.createElement('link');
        node.setAttribute('rel', 'canonical');
        document.head.appendChild(node);
    }
    node.setAttribute('href', href);
};

const buildParticipantLookup = (users = [], songs = []) => {
    const byUid = new Map();
    const byName = new Map();
    const firstNameBuckets = new Map();

    const register = ({ uid = '', name = '', avatar = '', includeFirstName = true } = {}) => {
        const normalizedUid = String(uid || '').trim().toLowerCase();
        const normalizedName = normalizeText(name);
        const key = normalizedUid || normalizedName;
        if (!key) return;
        const profile = {
            key,
            uid: normalizedUid,
            name: labelFor(name, 'Guest'),
            avatar: labelFor(avatar, ''),
        };
        const current = byUid.get(normalizedUid) || byName.get(normalizedName) || null;
        const merged = {
            key,
            uid: normalizedUid || current?.uid || '',
            name: labelFor(current?.name, profile.name),
            avatar: labelFor(current?.avatar, profile.avatar),
        };
        if (normalizedUid) byUid.set(normalizedUid, merged);
        if (normalizedName) byName.set(normalizedName, merged);
        if (!includeFirstName) return;
        const shortKey = firstNameKey(name);
        if (!shortKey) return;
        const bucket = firstNameBuckets.get(shortKey) || [];
        if (!bucket.some((entry) => entry.key === merged.key)) bucket.push(merged);
        firstNameBuckets.set(shortKey, bucket);
    };

    users.forEach((entry) => register({
        uid: entry?.uid,
        name: entry?.name,
        avatar: entry?.avatar,
        includeFirstName: true,
    }));
    songs.forEach((entry) => register({
        uid: entry?.singerUid,
        name: entry?.singerName,
        avatar: entry?.avatar || entry?.emoji,
        includeFirstName: true,
    }));
    const uniqueFirstNames = new Map();
    firstNameBuckets.forEach((entries, shortKey) => {
        if (entries.length === 1) uniqueFirstNames.set(shortKey, entries[0]);
    });

    return { byUid, byName, uniqueFirstNames };
};

const resolveParticipantMeta = (lookup, { uid = '', name = '', avatar = '' } = {}) => {
    const normalizedUid = String(uid || '').trim().toLowerCase();
    const normalizedName = normalizeText(name);
    const shortKey = firstNameKey(name);
    const matched = (
        (normalizedUid ? lookup.byUid.get(normalizedUid) : null)
        || (normalizedName ? lookup.byName.get(normalizedName) : null)
        || (shortKey ? lookup.uniqueFirstNames.get(shortKey) : null)
        || null
    );
    const fullName = labelFor(matched?.name, labelFor(name, 'Guest'));
    return {
        key: matched?.key || normalizedUid || normalizedName,
        uid: matched?.uid || normalizedUid,
        fullName,
        displayName: firstName(fullName, 'Guest'),
        avatar: labelFor(matched?.avatar, labelFor(avatar, '')),
    };
};

const buildTopReactorsFromReactions = (reactions = [], lookup, limit = 5) => {
    const totals = new Map();
    reactions.forEach((entry) => {
        const type = String(entry?.type || '').trim().toLowerCase();
        if (!type || type === 'photo') return;
        const participant = resolveParticipantMeta(lookup, {
            uid: entry?.uid,
            name: entry?.userName || entry?.name,
            avatar: entry?.avatar,
        });
        if (!participant.key) return;
        const current = totals.get(participant.key) || {
            key: participant.key,
            fullName: participant.fullName,
            displayName: participant.displayName,
            avatar: participant.avatar,
            count: 0,
        };
        current.count += sumReactionCount(entry);
        current.avatar = labelFor(current.avatar, participant.avatar);
        totals.set(participant.key, current);
    });
    return [...totals.values()]
        .sort((a, b) => n(b?.count, 0) - n(a?.count, 0))
        .slice(0, limit > 0 ? limit : undefined);
};

const buildTopPerformersFromSongs = (songs = [], lookup) => {
    const totals = new Map();
    songs.forEach((song) => {
        const participant = resolveParticipantMeta(lookup, {
            uid: song?.singerUid,
            name: song?.singerName,
            avatar: song?.avatar || song?.emoji,
        });
        if (!participant.key) return;
        const current = totals.get(participant.key) || {
            key: participant.key,
            fullName: participant.fullName,
            name: participant.displayName,
            avatar: participant.avatar,
            performances: 0,
            loudest: 0,
        };
        current.performances += 1;
        current.loudest = Math.max(current.loudest, Math.max(0, n(song?.applauseScore, 0)));
        current.avatar = labelFor(current.avatar, participant.avatar);
        totals.set(participant.key, current);
    });
    return [...totals.values()]
        .sort((a, b) => (
            n(b?.performances, 0) - n(a?.performances, 0)
            || n(b?.loudest, 0) - n(a?.loudest, 0)
            || String(a?.fullName || '').localeCompare(String(b?.fullName || ''))
        ))
        .slice(0, 5);
};

const buildTopPerformancesFromSongs = (songs = [], lookup) => songs
    .map((song, index) => {
        const participant = resolveParticipantMeta(lookup, {
            uid: song?.singerUid,
            name: song?.singerName,
            avatar: song?.avatar || song?.emoji,
        });
        const hypeScore = Math.max(0, n(song?.hypeScore, 0));
        const applauseScore = Math.max(0, n(song?.applauseScore, 0));
        const hostBonus = Math.max(0, n(song?.hostBonus, 0));
        return {
            id: song?.id || `top-${index}`,
            singerName: participant.displayName,
            singerAvatar: participant.avatar,
            songTitle: labelFor(song?.songTitle, 'Song'),
            artist: labelFor(song?.artist, ''),
            albumArtUrl: getSongArtworkUrl(song),
            totalPoints: Math.max(0, n(song?.totalPoints, hypeScore + applauseScore + hostBonus)),
            hypeScore,
            applauseScore,
            hostBonus,
        };
    })
    .sort((a, b) => (
        n(b?.totalPoints, 0) - n(a?.totalPoints, 0)
        || n(b?.hypeScore, 0) - n(a?.hypeScore, 0)
        || n(b?.applauseScore, 0) - n(a?.applauseScore, 0)
    ))
    .slice(0, 8);

const MetricCard = ({ label, value, icon, rotate = '', glow }) => (
    <article className={`relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(8,13,23,0.9))] px-4 py-4 shadow-[0_20px_38px_rgba(0,0,0,0.26)] ${rotate}`} style={{ boxShadow: `0 20px 38px rgba(0,0,0,0.26), 0 0 0 1px ${glow} inset` }}>
        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-[1.2rem] bg-white/8 [transform:rotate(22deg)]"></div>
        <div className="relative z-10 text-[1.8rem] leading-none">{icon}</div>
        <div className="relative z-10 mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58">{label}</div>
        <div className="relative z-10 mt-2 font-['Bebas_Neue'] text-[3.35rem] uppercase leading-[0.82] text-white sm:text-[4.2rem]">{value}</div>
    </article>
);

const Sticker = ({ value, label, detail, rotate = '', bg }) => (
    <article className={`relative overflow-hidden rounded-[1.9rem] border border-white/10 px-5 py-4 shadow-[0_26px_44px_rgba(0,0,0,0.28)] ${rotate}`} style={{ background: bg }}>
        <div className="absolute -right-5 -top-4 h-20 w-20 rounded-[1.3rem] bg-white/8 [transform:rotate(18deg)]"></div>
        <div className="relative z-10 font-['Bebas_Neue'] text-[3.8rem] uppercase leading-[0.82] text-white sm:text-[4.8rem]">{value}</div>
        <div className="relative z-10 mt-1 font-['Bebas_Neue'] text-[1.55rem] uppercase leading-none text-white">{label}</div>
        <div className="relative z-10 mt-2 text-[10px] uppercase tracking-[0.16em] text-white/58">{detail}</div>
    </article>
);

const BoardRow = ({ rank, title, subhead, score, width, accent, artworkUrl = '', avatar = '' }) => (
    <div className={`grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-4 py-3 ${rank % 2 ? '-rotate-[0.35deg]' : 'rotate-[0.35deg]'}`}>
        <div className="grid h-12 w-12 place-items-center rounded-[1rem] font-['Bebas_Neue'] text-[2.05rem] leading-none text-white" style={{ background: `linear-gradient(145deg, ${withAudienceBrandAlpha(accent, 0.28)}, rgba(255,255,255,0.05))` }}>{rank}</div>
        <div className="min-w-0 flex items-center gap-3">
            <div className="grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-[1rem] border border-white/10 bg-black/35 text-2xl">
                {artworkUrl ? <img src={artworkUrl} alt={subhead || title} className="h-full w-full object-cover" loading="lazy" /> : <span>{avatar || '*'}</span>}
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate font-['Bebas_Neue'] text-[1.55rem] uppercase leading-none text-white">{avatar ? `${avatar} ${title}` : title}</div>
                <div className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-white/50">{subhead}</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full" style={{ width: `${clamp(width, 10, 100)}%`, background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.82))` }}></div>
                </div>
            </div>
        </div>
        <div className="font-['Bebas_Neue'] text-[2.2rem] uppercase leading-none text-white">{fmt(score)}</div>
    </div>
);

const PersonRow = ({ badge, title, subhead, value, accent, index, avatar = '' }) => (
    <div className={`grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.35rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-4 py-3 ${index % 2 === 0 ? '-rotate-[0.3deg]' : 'rotate-[0.3deg]'}`}>
        <div className="relative grid h-14 w-14 place-items-center rounded-[1rem] font-['Bebas_Neue'] text-[1.55rem] text-white" style={{ background: `linear-gradient(145deg, ${withAudienceBrandAlpha(accent, 0.3)}, rgba(255,255,255,0.05))` }}>
            <span className={avatar ? 'text-[1.85rem] leading-none' : ''}>{avatar || badge}</span>
            {avatar ? <span className="absolute -bottom-1 rounded-full border border-white/10 bg-black/70 px-1.5 py-0.5 text-[10px] leading-none text-white">{badge}</span> : null}
        </div>
        <div className="min-w-0">
            <div className="truncate font-['Bebas_Neue'] text-[1.45rem] uppercase leading-none text-white">{title}</div>
            <div className="mt-1 truncate text-[10px] uppercase tracking-[0.18em] text-white/50">{subhead}</div>
        </div>
        <div className="font-['Bebas_Neue'] text-[2rem] uppercase leading-none text-white">{value}</div>
    </div>
);

const ReactionTile = ({ icon, label, value, rotate = '', bg }) => (
    <article className={`rounded-[1.45rem] border border-white/10 px-3 py-4 text-center shadow-[0_18px_34px_rgba(0,0,0,0.22)] ${rotate}`} style={{ background: bg }}>
        <div className="text-[2.3rem] leading-none sm:text-[2.8rem]">{icon}</div>
        <div className="mt-2 font-['Bebas_Neue'] text-[2rem] uppercase leading-none text-white sm:text-[2.35rem]">{fmt(value)}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/56">{label}</div>
    </article>
);

const FeatureCard = ({ eyebrow, title, value, detail, accent, icon = '' }) => (
    <aside className="relative overflow-hidden rounded-[2rem] border border-white/10 p-4 shadow-[0_28px_50px_rgba(0,0,0,0.3)]" style={{ background: `linear-gradient(155deg, ${withAudienceBrandAlpha(accent, 0.18)}, rgba(7,12,22,0.78) 48%, rgba(7,12,22,0.94))` }}>
        <div className="inline-flex rounded-full border border-white/10 bg-black/45 px-3 py-1.5 font-['Bebas_Neue'] text-xl uppercase tracking-[0.08em] text-white">{eyebrow}</div>
        <div className="relative mt-4 overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/35 p-4">
            <div className="pointer-events-none absolute right-4 top-4 text-[2.1rem] opacity-95">{icon}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/54">{title}</div>
            <div className="mt-3 font-['Bebas_Neue'] text-[4.2rem] uppercase leading-[0.82] text-white">{value}</div>
            <div className="mt-2 text-xs uppercase tracking-[0.14em] text-white/64">{detail}</div>
        </div>
    </aside>
);

const RecapView = ({ roomCode }) => {
    const [room, setRoom] = useState(null);
    const [data, setData] = useState({ songs: [], users: [], reactions: [], activities: [], crowdSelfies: [] });
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const { body, documentElement } = document;
        const previousBodyOverflow = body.style.overflow;
        const previousBodyOverflowY = body.style.overflowY;
        const previousBodyTouchAction = body.style.touchAction;
        const previousHtmlOverflow = documentElement.style.overflow;
        const previousHtmlOverflowY = documentElement.style.overflowY;
        body.style.overflow = 'auto';
        body.style.overflowY = 'auto';
        body.style.touchAction = 'pan-y';
        documentElement.style.overflow = 'auto';
        documentElement.style.overflowY = 'auto';
        return () => {
            body.style.overflow = previousBodyOverflow;
            body.style.overflowY = previousBodyOverflowY;
            body.style.touchAction = previousBodyTouchAction;
            documentElement.style.overflow = previousHtmlOverflow;
            documentElement.style.overflowY = previousHtmlOverflowY;
        };
    }, []);

    useEffect(() => {
        if (!roomCode) return undefined;
        const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), (snap) => setRoom(snap.exists() ? snap.data() : null));
        return () => unsub();
    }, [roomCode]);

    useEffect(() => {
        if (!roomCode) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const [songsSnap, usersSnap, reactionsSnap, activitiesSnap, crowdSelfiesSnap] = await Promise.all([
                    getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), where('roomCode', '==', roomCode))),
                    getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode))),
                    getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), where('roomCode', '==', roomCode))),
                    getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), where('roomCode', '==', roomCode))),
                    getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'crowd_selfie_submissions'), where('roomCode', '==', roomCode))),
                ]);
                if (cancelled) return;
                setData({
                    songs: songsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                    users: usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                    reactions: reactionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                    activities: activitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                    crowdSelfies: crowdSelfiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                });
                setError('');
            } catch (nextError) {
                if (!cancelled) setError(String(nextError?.message || nextError || 'Could not load recap.'));
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, [roomCode]);

    const recap = room?.recap || null;
    const summary = useMemo(() => {
        const performed = data.songs.filter((song) => String(song?.status || '').trim().toLowerCase() === 'performed');
        const participantLookup = buildParticipantLookup(data.users, data.songs, data.reactions);
        const theme = normalizeAudienceBrandTheme(room?.audienceBrandTheme || null);
        const roomName = labelFor(room?.discover?.title || room?.roomName || room?.name, `Room ${roomCode}`);
        const totalUsers = Math.max(0, firstFinite(recap?.stats?.totalUsers, recap?.metrics?.estimatedPeople, recap?.totalUsers, data.users.length));
        const totalPerformedSongs = Math.max(0, firstFinite(recap?.stats?.totalPerformedSongs, recap?.totalSongs, performed.length));
        const totalQueuedSongs = Math.max(0, firstFinite(recap?.stats?.totalQueuedSongs, recap?.totalQueuedSongs, data.songs.length));
        const totalEmojiBursts = Math.max(0, firstFinite(recap?.stats?.totalEmojiBursts, recap?.stats?.reactionCount, recap?.totalEmojiBursts, 0));
        const repeatPerformers = Math.max(0, firstFinite(recap?.stats?.repeatPerformers, recap?.repeatPerformers, 0));
        const multiSongGuests = Math.max(0, firstFinite(recap?.stats?.multiSongGuests, recap?.multiSongGuests, 0));
        const loudestPerformance = recap?.loudestPerformance || performed.reduce((best, song) => !best || n(song?.applauseScore, 0) > n(best?.applauseScore, 0) ? { singer: labelFor(song?.singerName, 'Singer'), song: labelFor(song?.songTitle, 'Song'), applauseScore: Math.max(0, n(song?.applauseScore, 0)) } : best, null);

        const topPerformances = (
            performed.length
                ? buildTopPerformancesFromSongs(performed, participantLookup)
                : (Array.isArray(recap?.topPerformances) ? recap.topPerformances : []).slice(0, 8).map((entry, index) => ({
                    ...entry,
                    id: entry?.id || `top-${index}`,
                    singerName: firstName(entry?.singerName, 'Singer'),
                    singerAvatar: labelFor(entry?.singerAvatar, ''),
                    albumArtUrl: labelFor(entry?.albumArtUrl, ''),
                    totalPoints: Math.max(0, n(entry?.totalPoints, 0)),
                }))
        ).sort((a, b) => n(b?.totalPoints, 0) - n(a?.totalPoints, 0));
        const performanceMax = Math.max(...topPerformances.map((entry) => n(entry?.totalPoints, 0)), 1);

        const allReactionParticipants = buildTopReactorsFromReactions(data.reactions, participantLookup, 0);
        const liveTopReactors = allReactionParticipants.slice(0, 5);
        const reactionCountsByParticipant = new Map();
        allReactionParticipants.forEach((entry) => {
            reactionCountsByParticipant.set(entry.key, Math.max(0, n(entry?.count, 0)));
        });

        const topReactors = (liveTopReactors.length ? liveTopReactors : (Array.isArray(recap?.topReactors) ? recap.topReactors : []))
            .map((entry) => {
                const participant = resolveParticipantMeta(participantLookup, {
                    uid: entry?.uid,
                    name: entry?.fullName || entry?.name || entry?.displayName || entry?.key,
                    avatar: entry?.avatar,
                });
                return {
                    ...entry,
                    key: participant.key || String(entry?.key || '').trim().toLowerCase(),
                    fullName: participant.fullName,
                    displayName: participant.displayName,
                    avatar: participant.avatar,
                    count: Math.max(0, n(entry?.count, 0)),
                };
            })
            .sort((a, b) => n(b?.count, 0) - n(a?.count, 0))
            .slice(0, 5);

        const topPerformers = (performed.length ? buildTopPerformersFromSongs(performed, participantLookup) : (Array.isArray(recap?.topPerformers) ? recap.topPerformers : []))
            .map((entry) => {
                const participant = resolveParticipantMeta(participantLookup, {
                    uid: entry?.uid,
                    name: entry?.fullName || entry?.name,
                    avatar: entry?.avatar,
                });
                return {
                    ...entry,
                    key: participant.key || String(entry?.key || '').trim().toLowerCase(),
                    fullName: participant.fullName,
                    name: participant.displayName,
                    avatar: participant.avatar,
                    performances: Math.max(0, n(entry?.performances, 0)),
                    loudest: Math.max(0, n(entry?.loudest, 0)),
                };
            })
            .sort((a, b) => n(b?.performances, 0) - n(a?.performances, 0))
            .slice(0, 5);

        const reactionTypes = (Array.isArray(recap?.topReactionTypes) ? recap.topReactionTypes : [])
            .map((entry) => ({ ...entry, count: Math.max(0, n(entry?.count, 0)) }))
            .sort((a, b) => n(b?.count, 0) - n(a?.count, 0))
            .slice(0, 5);

        const gallery = [...(Array.isArray(recap?.crowdSelfies) ? recap.crowdSelfies : []), ...(Array.isArray(recap?.photos) ? recap.photos : [])].slice(0, 5);
        const highlights = (Array.isArray(recap?.highlights) ? recap.highlights : []).slice(0, 4).map((entry, index) => ({
            id: entry?.id || `highlight-${index}`,
            icon: entry?.icon || ['🎤', '✨', '📣', '🔥'][index % 4],
            text: String(entry?.text || entry?.summary || entry?.message || entry?.detail || entry?.label || 'Room moment').trim(),
            user: firstName(entry?.user || entry?.userName || entry?.actorName || entry?.name || '', ''),
        }));

        const startMs = n(recap?.window?.startMs || recap?.window?.firstEventMs || 0, 0);
        const endMs = n(recap?.window?.lastEventMs || recap?.window?.endMs || 0, 0);
        const openingStarts = performed.map((song) => Math.max(0, n(song?.performingStartedAt, 0), n(song?.completedAt, 0), n(song?.endedAt, 0))).filter(Boolean).sort((a, b) => a - b);
        const openingHourSongs = openingStarts[0] ? openingStarts.filter((value) => value <= openingStarts[0] + 3600000).length : 0;
        const superfanCount = [...reactionCountsByParticipant.values()].filter((count) => count >= 50).length;
        const superfanShare = totalUsers > 0 ? Math.round((superfanCount / totalUsers) * 100) : 0;
        const topReactorShare = totalEmojiBursts > 0 ? Math.round(((topReactors[0]?.count || 0) / totalEmojiBursts) * 100) : 0;
        const queueCarryOver = Math.max(0, totalQueuedSongs - totalPerformedSongs);
        const reactionsPerPerformance = totalPerformedSongs > 0 ? Math.round(totalEmojiBursts / totalPerformedSongs) : 0;
        const performancesPerHour = Math.max(0, firstFinite(recap?.stats?.performancesPerHour, 0));
        const leadImage = String(room?.heroImageUrl || room?.coverImageUrl || room?.discover?.heroImageUrl || gallery[0]?.url || gallery[0]?.photoUrl || '').trim();
        const topPerformance = topPerformances[0] || null;
        const topReactionType = reactionTypes[0] || null;
        const branding = resolveRecapBranding({
            roomCode,
            roomName,
            logoUrl: room?.logoUrl,
            defaultLogoUrl: ASSETS.logo,
            leadImageUrl: leadImage,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
        });

        return {
            title: roomName,
            generatedAt: n(recap?.generatedAt || room?.closedAt, Date.now()),
            startMs,
            endMs,
            theme,
            leadImage,
            partnerLogo: branding.partnerLogo,
            beauLogo: branding.beauLogo,
            hasPartnerLogo: branding.hasPartnerLogo,
            socialImageUrl: branding.socialImageUrl,
            totalUsers,
            totalPerformedSongs,
            totalQueuedSongs,
            totalEmojiBursts,
            repeatPerformers,
            multiSongGuests,
            loudestPerformance,
            topPerformances,
            performanceMax,
            topReactors,
            topPerformers,
            reactionTypes,
            openingHourSongs,
            superfanCount,
            superfanShare,
            topReactorShare,
            queueCarryOver,
            reactionsPerPerformance,
            performancesPerHour,
            gallery,
            highlights,
            topPerformance,
            topReactionType,
        };
    }, [data, recap, room, roomCode]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined' || !summary?.title) return;
        const roomTitle = String(summary.title || roomCode || 'Room').trim();
        const pageTitle = `${roomTitle} Recap | BeauRocks Karaoke`;
        const description = `${roomTitle} crowd recap with ${fmt(summary.totalPerformedSongs)} songs, ${fmt(summary.totalUsers)} guests, and ${fmt(summary.totalEmojiBursts)} reactions.`;
        const canonicalUrl = window.location.href;
        const socialImageUrl = toAbsoluteRecapUrl(summary.socialImageUrl || summary.partnerLogo || summary.beauLogo, window.location.origin);

        document.title = pageTitle;
        ensureCanonicalLink(canonicalUrl);
        ensureMetaTag({ name: 'description', content: description });
        ensureMetaTag({ property: 'og:type', content: 'website' });
        ensureMetaTag({ property: 'og:title', content: pageTitle });
        ensureMetaTag({ property: 'og:description', content: description });
        ensureMetaTag({ property: 'og:url', content: canonicalUrl });
        ensureMetaTag({ property: 'og:image', content: socialImageUrl });
        ensureMetaTag({ property: 'og:image:alt', content: `${roomTitle} recap image` });
        ensureMetaTag({ name: 'twitter:card', content: 'summary_large_image' });
        ensureMetaTag({ name: 'twitter:title', content: pageTitle });
        ensureMetaTag({ name: 'twitter:description', content: description });
        ensureMetaTag({ name: 'twitter:image', content: socialImageUrl });
    }, [roomCode, summary]);

    if (!roomCode) return <div data-recap-state="missing_room" className="flex min-h-screen items-center justify-center bg-[#05060b] px-6 text-center text-white">Missing room code.</div>;
    if (!recap && !loaded) return <div data-recap-state="loading" className="flex min-h-screen items-center justify-center bg-[#05060b] text-white"><div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300"></div></div>;
    if (!recap) {
        return (
            <div data-recap-state="not_ready" className="flex min-h-screen items-center justify-center bg-[#05060b] px-6 text-center text-white">
                <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_28px_70px_rgba(0,0,0,0.4)]">
                    <img src={ASSETS.logo} className="mx-auto h-16 w-auto" alt="BeauRocks Karaoke" />
                    <div className="mt-5 font-['Bebas_Neue'] text-5xl uppercase leading-none text-white">Recap Not Ready</div>
                    <p className="mt-3 text-sm leading-6 text-cyan-50/68">Close the room from host controls and BeauRocks will build the post-show recap board.</p>
                </div>
            </div>
        );
    }

    const { primaryColor: primary, secondaryColor: secondary, accentColor: accent, appTitle } = summary.theme;
    const titleWordmark = summary.title.replace(/\s+karaoke\s+kick-off/i, ' Kick-Off').trim();
    const heroValue = fmt(summary.totalEmojiBursts || summary.totalPerformedSongs);
    const heroLabel = summary.totalEmojiBursts > 0 ? 'Crowd Reactions' : 'Songs Performed';

    return (
        <div data-recap-state="ready" className="min-h-screen overflow-x-hidden text-white" style={{ background: `radial-gradient(circle at 12% 12%, ${withAudienceBrandAlpha(primary, 0.24)} 0%, transparent 24%), radial-gradient(circle at 88% 10%, ${withAudienceBrandAlpha(secondary, 0.22)} 0%, transparent 24%), radial-gradient(circle at 50% 100%, ${withAudienceBrandAlpha(accent, 0.18)} 0%, transparent 30%), linear-gradient(180deg,#05060b 0%,#0c1323 46%,#111c33 100%)` }}>
            <div className="pointer-events-none fixed inset-0 opacity-20 [background-image:linear-gradient(90deg,transparent_0_94%,rgba(255,255,255,0.08)_94%_94.2%,transparent_94.2%_100%),linear-gradient(transparent_0_95%,rgba(255,255,255,0.06)_95%_95.2%,transparent_95.2%_100%)] [background-size:28px_28px]"></div>
            <main className="relative mx-auto w-full max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
                <header className="relative overflow-hidden rounded-[2.4rem] border border-white/10 p-5 sm:p-7" style={{ backgroundImage: `${summary.leadImage ? `linear-gradient(120deg, rgba(3,5,10,0.96) 10%, rgba(3,5,10,0.72) 52%, rgba(3,5,10,0.94) 100%), url(${summary.leadImage}), ` : ''}linear-gradient(180deg, ${withAudienceBrandAlpha(accent, 0.09)}, transparent 34%)`, backgroundSize: summary.leadImage ? 'cover, auto' : 'auto', backgroundPosition: summary.leadImage ? 'center, center' : 'center', boxShadow: `0 34px 110px rgba(0,0,0,0.52), 0 0 0 1px ${withAudienceBrandAlpha(primary, 0.06)} inset` }}>
                    <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl" style={{ background: withAudienceBrandAlpha(primary, 0.22) }}></div>
                    <div className="absolute -left-16 bottom-0 h-80 w-80 rounded-full blur-3xl" style={{ background: withAudienceBrandAlpha(secondary, 0.18) }}></div>
                    <div className="relative z-10 grid gap-6">
                        <div className="flex flex-col items-center gap-3">
                            <div className="flex flex-wrap items-center justify-center gap-4 rounded-full border border-white/10 bg-black/35 px-5 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.24)]">
                                {summary.hasPartnerLogo ? (
                                    <>
                                        <img src={summary.partnerLogo} className="h-16 w-auto max-w-[9rem] object-contain drop-shadow-[0_0_24px_rgba(255,208,89,0.28)] sm:h-20 sm:max-w-[10rem]" alt={`${summary.title} logo`} />
                                        <div className="grid justify-items-center font-['Bebas_Neue'] uppercase leading-none text-white"><strong className="text-[2.2rem] sm:text-[2.8rem]">&lt;3</strong><span className="text-[10px] tracking-[0.22em] text-white/56">with</span></div>
                                    </>
                                ) : null}
                                <img src={summary.beauLogo} className="h-16 w-auto max-w-[14rem] object-contain drop-shadow-[0_0_24px_rgba(97,235,255,0.28)] sm:h-20 sm:max-w-[16rem]" alt="BeauRocks Karaoke" />
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70" style={{ background: `linear-gradient(135deg, ${withAudienceBrandAlpha(accent, 0.18)}, rgba(255,255,255,0.04))` }}>Room Recap</div>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.18fr)_320px] lg:items-end">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/72" style={{ background: `linear-gradient(135deg, ${withAudienceBrandAlpha(accent, 0.16)}, rgba(255,255,255,0.03))` }}><span className="text-amber-300">✦</span>{appTitle || 'BeauRocks Event'}</div>
                                <h1 className="mt-4 max-w-[7ch] font-['Bebas_Neue'] text-[5rem] uppercase leading-[0.84] text-white drop-shadow-[0_16px_30px_rgba(0,0,0,0.28)] sm:text-[6.75rem] xl:text-[7.6rem]">{titleWordmark} Crowd Report</h1>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {summary.startMs ? <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/74">{dateLabel(summary.startMs)}</div> : null}
                                    {summary.startMs && summary.endMs ? <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/74">{timeRange(summary.startMs, summary.endMs)}</div> : null}
                                    <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/74">{roomCode}</div>
                                </div>
                            </div>

                            <FeatureCard
                                eyebrow="Featured Moment"
                                title={summary.topPerformance?.singerName || 'Room Peak'}
                                value={summary.topPerformance ? fmt(summary.topPerformance.totalPoints) : fmt(summary.loudestPerformance?.applauseScore || 0)}
                                detail={summary.topPerformance
                                    ? [summary.topPerformance.songTitle, summary.topPerformance.artist].filter(Boolean).join(' · ')
                                    : [summary.loudestPerformance?.song, summary.loudestPerformance?.singer].filter(Boolean).join(' · ')}
                                accent={secondary}
                                icon={summary.topReactionType ? reactionMeta(summary.topReactionType.type)[0] : '✨'}
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard label="Estimated People" value={fmt(summary.totalUsers)} icon="🫶" rotate="-rotate-[1deg]" glow={withAudienceBrandAlpha(primary, 0.06)} />
                            <MetricCard label="Song Requests" value={fmt(summary.totalQueuedSongs)} icon="🎟️" rotate="rotate-[0.8deg]" glow={withAudienceBrandAlpha(secondary, 0.06)} />
                            <MetricCard label="Songs Performed" value={fmt(summary.totalPerformedSongs)} icon="🎤" rotate="-rotate-[0.7deg]" glow={withAudienceBrandAlpha(accent, 0.08)} />
                            <MetricCard label="Applause Peak" value={fmt(summary.loudestPerformance?.applauseScore || 0)} icon="👏" rotate="rotate-[1deg]" glow={withAudienceBrandAlpha(primary, 0.06)} />
                        </div>
                    </div>
                </header>

                <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_320px]">
                    <article className="relative overflow-hidden rounded-[2.2rem] border border-white/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]" style={{ background: `radial-gradient(circle at 22% 14%, rgba(255,255,255,0.12), transparent 20%), linear-gradient(180deg, rgba(8,10,18,0.2), rgba(8,10,18,0.84)), linear-gradient(145deg, ${withAudienceBrandAlpha(secondary, 0.7)}, ${withAudienceBrandAlpha(primary, 0.48)} 46%, rgba(10,14,24,0.96))` }}>
                        <div className="absolute inset-4 rounded-[1.6rem] border border-dashed border-white/14"></div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70"><span className="text-amber-300">✦</span>Engagement Layer</div>
                            <div className="mt-5 font-['Bebas_Neue'] text-[6rem] uppercase leading-[0.82] text-white sm:text-[8rem] xl:text-[9.5rem]">{heroValue}</div>
                            <div className="font-['Bebas_Neue'] text-[2.2rem] uppercase leading-none text-white sm:text-[2.8rem]">{heroLabel}</div>
                            <div className="mt-3 text-sm uppercase tracking-[0.18em] text-white/66">{summary.reactionsPerPerformance ? `${fmt(summary.reactionsPerPerformance)} cheers per song on average` : `${fmt(summary.totalPerformedSongs)} songs drove the room`}</div>
                        </div>
                    </article>
                    <div className="grid content-start gap-4">
                        <Sticker value={fmt(summary.openingHourSongs)} label="Opening Sprint" detail="songs cleared in hour one" rotate="-rotate-[1.2deg]" bg={`linear-gradient(145deg, ${withAudienceBrandAlpha(accent, 0.24)}, rgba(17,24,40,0.96))`} />
                        <Sticker value={pct(summary.superfanShare)} label="Superfan Layer" detail={`${fmt(summary.superfanCount)} guests hit 50+ reactions`} rotate="rotate-[1deg]" bg={`linear-gradient(145deg, ${withAudienceBrandAlpha(primary, 0.22)}, rgba(17,24,40,0.96))`} />
                        <Sticker value={summary.queueCarryOver ? fmt(summary.queueCarryOver) : fmt(Math.round(summary.performancesPerHour || 0))} label={summary.queueCarryOver ? 'Encore Waiting' : 'Song Pace'} detail={summary.queueCarryOver ? 'requests still in queue at close' : 'songs per hour'} rotate="-rotate-[0.7deg]" bg={`linear-gradient(145deg, ${withAudienceBrandAlpha(secondary, 0.22)}, rgba(17,24,40,0.96))`} />
                    </div>
                </section>

                <section className="mt-8 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                    <article className="rounded-[2.1rem] border border-white/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]" style={{ background: `radial-gradient(circle at 100% 0%, rgba(255,255,255,0.05), transparent 26%), linear-gradient(180deg, rgba(14,22,38,0.92), rgba(8,13,23,0.96))` }}>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/68" style={{ background: `linear-gradient(135deg, ${withAudienceBrandAlpha(accent, 0.14)}, rgba(255,255,255,0.03))` }}><span className="text-amber-300">✦</span>Crowd Core</div>
                        <div className="mt-5 grid justify-items-center gap-4">
                            <div className="grid aspect-square w-[220px] place-items-center rounded-full" style={{ background: `radial-gradient(circle at center, rgba(10,16,28,1) 0 53%, transparent 54%), conic-gradient(${accent} 0 ${clamp(summary.superfanShare, 6, 100)}%, rgba(255,255,255,0.08) ${clamp(summary.superfanShare, 6, 100)}% 100%)`, boxShadow: `inset 0 0 40px rgba(0,0,0,0.22), 0 0 0 1px ${withAudienceBrandAlpha(primary, 0.18)}` }}>
                                <div className="text-center">
                                    <div className="font-['Bebas_Neue'] text-[4.8rem] uppercase leading-[0.82] text-white">{pct(summary.superfanShare)}</div>
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/54">of guests</div>
                                </div>
                            </div>
                            <div className="text-center text-xs uppercase tracking-[0.18em] text-white/56">room-sized cheering core</div>
                        </div>
                    </article>

                    <article className="rounded-[2.1rem] border border-white/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]" style={{ background: `radial-gradient(circle at 100% 0%, rgba(255,255,255,0.05), transparent 26%), linear-gradient(180deg, rgba(14,22,38,0.92), rgba(8,13,23,0.96))` }}>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/68" style={{ background: `linear-gradient(135deg, ${withAudienceBrandAlpha(accent, 0.14)}, rgba(255,255,255,0.03))` }}><span className="text-amber-300">✦</span>Performance Peaks</div>
                        <div className="mt-5 grid gap-3">
                            {summary.topPerformances.map((entry, index) => <BoardRow key={entry.id} rank={index + 1} title={entry.singerName} subhead={[entry.songTitle, entry.artist].filter(Boolean).join(' · ')} score={entry.totalPoints} width={(n(entry.totalPoints, 0) / Math.max(summary.performanceMax, 1)) * 100} accent={index % 3 === 0 ? primary : (index % 3 === 1 ? secondary : accent)} artworkUrl={entry.albumArtUrl} avatar={entry.singerAvatar} />)}
                        </div>
                    </article>
                </section>

                <section className="mt-8 rounded-[2.1rem] border border-white/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]" style={{ background: `radial-gradient(circle at 100% 0%, rgba(255,255,255,0.05), transparent 26%), linear-gradient(180deg, rgba(14,22,38,0.92), rgba(8,13,23,0.96))` }}>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/68" style={{ background: `linear-gradient(135deg, ${withAudienceBrandAlpha(accent, 0.14)}, rgba(255,255,255,0.03))` }}><span className="text-amber-300">✦</span>Emoji Storm</div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {summary.reactionTypes.map((entry, index) => {
                            const [icon, label] = reactionMeta(entry?.type);
                            const tint = [accent, primary, secondary, '#ff9757', '#8f7dff'][index % 5];
                            return <ReactionTile key={`${entry?.type || 'reaction'}-${index}`} icon={icon} label={label} value={entry?.count || 0} rotate={index % 2 === 0 ? '-rotate-[1.2deg]' : 'rotate-[1.2deg]'} bg={`linear-gradient(145deg, ${withAudienceBrandAlpha(tint, 0.22)}, rgba(255,255,255,0.03))`} />;
                        })}
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Sticker value={fmt(Math.round(summary.performancesPerHour || 0))} label="Songs Per Hour" detail="live room pace" rotate="-rotate-[0.6deg]" bg={`linear-gradient(145deg, ${withAudienceBrandAlpha(primary, 0.18)}, rgba(255,255,255,0.03))`} />
                        <Sticker value={fmt(summary.multiSongGuests)} label="Multi-Song Guests" detail="came back with more requests" rotate="rotate-[0.5deg]" bg={`linear-gradient(145deg, ${withAudienceBrandAlpha(accent, 0.18)}, rgba(255,255,255,0.03))`} />
                        <Sticker value={fmt(summary.gallery.length)} label="Gallery Hits" detail="approved room moments" rotate="-rotate-[0.5deg]" bg={`linear-gradient(145deg, ${withAudienceBrandAlpha(secondary, 0.18)}, rgba(255,255,255,0.03))`} />
                        <Sticker value={pct(summary.topReactorShare)} label="Top Fan Share" detail="of all reactions from the loudest tapper" rotate="rotate-[0.5deg]" bg={`linear-gradient(145deg, ${withAudienceBrandAlpha(primary, 0.18)}, rgba(255,255,255,0.03))`} />
                    </div>
                </section>

                <section className="mt-8 grid gap-5 lg:grid-cols-2">
                    <article className="rounded-[2.1rem] border border-white/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]" style={{ background: `radial-gradient(circle at 100% 0%, rgba(255,255,255,0.05), transparent 26%), linear-gradient(180deg, rgba(14,22,38,0.92), rgba(8,13,23,0.96))` }}>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/68" style={{ background: `linear-gradient(135deg, ${withAudienceBrandAlpha(accent, 0.14)}, rgba(255,255,255,0.03))` }}><span className="text-amber-300">✦</span>Cheer Captains</div>
                        <div className="mt-5 grid gap-3">
                            {summary.topReactors.map((entry, index) => <PersonRow key={`${entry.key || entry.displayName}-${index}`} badge={index === 0 ? '👑' : `${index + 1}`} title={entry.displayName} subhead="reaction taps" value={fmt(entry.count)} accent={index % 3 === 0 ? accent : (index % 3 === 1 ? primary : secondary)} index={index} avatar={entry.avatar} />)}
                        </div>
                    </article>

                    <article className="rounded-[2.1rem] border border-white/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]" style={{ background: `radial-gradient(circle at 100% 0%, rgba(255,255,255,0.05), transparent 26%), linear-gradient(180deg, rgba(14,22,38,0.92), rgba(8,13,23,0.96))` }}>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/68" style={{ background: `linear-gradient(135deg, ${withAudienceBrandAlpha(accent, 0.14)}, rgba(255,255,255,0.03))` }}><span className="text-amber-300">✦</span>Repeat Mic Crew</div>
                        <div className="mt-5 grid gap-3">
                            {summary.topPerformers.map((entry, index) => <PersonRow key={`${entry.key || entry.name}-${index}`} badge={index === 0 ? '🎤' : `${index + 1}`} title={entry.name} subhead={`${fmt(entry.performances)} performances`} value={fmt(entry.loudest)} accent={index % 3 === 0 ? primary : (index % 3 === 1 ? secondary : accent)} index={index} avatar={entry.avatar} />)}
                        </div>
                    </article>
                </section>

                {(summary.gallery.length > 0 || summary.highlights.length > 0) ? (
                    <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_340px]">
                        <article className="rounded-[2.1rem] border border-white/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]" style={{ background: `radial-gradient(circle at 100% 0%, rgba(255,255,255,0.05), transparent 26%), linear-gradient(180deg, rgba(14,22,38,0.92), rgba(8,13,23,0.96))` }}>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/68" style={{ background: `linear-gradient(135deg, ${withAudienceBrandAlpha(accent, 0.14)}, rgba(255,255,255,0.03))` }}><span className="text-amber-300">✦</span>Highlight Gallery</div>
                            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                                {summary.gallery.map((entry, index) => {
                                    const src = String(entry?.url || entry?.photoUrl || '').trim();
                                    return src ? <div key={`${src}-${index}`} className={`overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/30 ${index === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}><img src={src} alt="Room moment" className={`w-full object-cover ${index === 0 ? 'h-64 md:h-full' : 'h-36'}`} /></div> : null;
                                })}
                            </div>
                        </article>
                        <article className="rounded-[2.1rem] border border-white/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]" style={{ background: `radial-gradient(circle at 100% 0%, rgba(255,255,255,0.05), transparent 26%), linear-gradient(180deg, rgba(14,22,38,0.92), rgba(8,13,23,0.96))` }}>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/68" style={{ background: `linear-gradient(135deg, ${withAudienceBrandAlpha(accent, 0.14)}, rgba(255,255,255,0.03))` }}><span className="text-amber-300">✦</span>Night Highlights</div>
                            <div className="mt-5 grid gap-3">
                                {summary.highlights.map((entry, index) => <div key={entry.id} className="flex items-center gap-3 rounded-[1.3rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-4 py-3"><div className="grid h-11 w-11 place-items-center rounded-[1rem] text-xl" style={{ background: `linear-gradient(145deg, ${withAudienceBrandAlpha(index % 3 === 0 ? primary : (index % 3 === 1 ? secondary : accent), 0.26)}, rgba(255,255,255,0.05))` }}>{entry.icon}</div><div className="min-w-0"><div className="truncate text-sm text-white">{entry.text}</div>{entry.user ? <div className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-white/46">{entry.user}</div> : null}</div></div>)}
                            </div>
                        </article>
                    </section>
                ) : null}

                <footer className="mt-8 rounded-[2rem] border border-white/10 p-5 shadow-[0_28px_60px_rgba(0,0,0,0.28)]" style={{ background: `linear-gradient(180deg, rgba(13,20,35,0.92), rgba(8,13,23,0.98)), linear-gradient(90deg, ${withAudienceBrandAlpha(secondary, 0.14)}, ${withAudienceBrandAlpha(accent, 0.08)}, ${withAudienceBrandAlpha(primary, 0.12)})` }}>
                    <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
                        <div className="grid min-h-[120px] place-items-center rounded-[1.6rem] border border-white/10 font-['Bebas_Neue'] text-[4.2rem] uppercase leading-[0.82] text-white" style={{ background: `linear-gradient(145deg, ${withAudienceBrandAlpha(accent, 0.18)}, rgba(255,255,255,0.04))` }}>{fmt(summary.repeatPerformers)}</div>
                        <div>
                            <div className="font-['Bebas_Neue'] text-[2rem] uppercase leading-none text-white">Guests Came Back For More</div>
                            <div className="mt-2 text-sm uppercase tracking-[0.18em] text-white/62">repeat turns are where a room stops feeling like a queue and starts feeling like a party</div>
                            <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-white/42">generated {dt(summary.generatedAt)}</div>
                            {error ? <div className="mt-2 text-xs text-amber-200/80">Partial recap load: {error}</div> : null}
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
};

export default RecapView;
