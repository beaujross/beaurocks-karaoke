import React, { useMemo, useState } from 'react';
import { ASSETS } from '../../lib/assets';

const HELP_SECTIONS = Object.freeze([
    {
        id: 'audience',
        label: 'Audience',
        eyebrow: 'Guest app',
        title: 'Help guests join, search, queue, and follow the night.',
        summary: 'Use this when someone asks what to do on their phone. Keep the answer short: join the room, open Songs, search, request, then watch the queue.',
        steps: [
            ['Join the room', 'Scan the room QR or open the audience link. If asked for a code, enter the room code shown by the host.'],
            ['Add a song', 'Open Songs and type in the search field. Pick the song or backing option that fits, then submit it to the queue.'],
            ['Watch the queue', 'The phone becomes the guest queue screen. Guests should stay nearby as they move closer to the top.'],
            ['React and vote', 'Party moments, reactions, votes, and games appear when the host opens them. Guests can participate without leaving the room.']
        ],
        tips: [
            'Search by song plus artist when possible.',
            'If YouTube search is enabled, only embeddable results can be added.',
            'If a request needs review, the host will see it before it reaches the stage.'
        ]
    },
    {
        id: 'cohost',
        label: 'Co-Host',
        eyebrow: 'Helper lane',
        title: 'Give helpers a clear job without turning them into a second host.',
        summary: 'Co-hosts reduce friction: they help guests join, add clean queue entries, and send concise signals when the host needs context.',
        steps: [
            ['Start with the person', 'Find or create the singer first so every song lands on the right guest.'],
            ['Use the helper catalog', 'Search, browse, or add known backing tracks without taking over stage control.'],
            ['Signal once', 'Use Tell Host for real issues like wrong track, confused guest, dead air, or pacing trouble.'],
            ['Respect host control', 'Co-host votes and notes help the host decide. They do not automatically reorder the room.']
        ],
        tips: [
            'One useful note beats repeated chatter.',
            'If a guest is stuck, explain the next tap instead of the whole app.',
            'Keep the queue clean before the rush hits.'
        ]
    },
    {
        id: 'host',
        label: 'Host',
        eyebrow: 'Control panel',
        title: 'Run the room from one control surface.',
        summary: 'The host panel should answer the live questions fast: who is next, what is playing, what needs approval, and what should happen after this performance.',
        steps: [
            ['Launch surfaces', 'Open the audience app and public TV from Quick Launch. Use Incognito or a separate browser profile for public display windows.'],
            ['Keep the queue moving', 'Use the persistent Next strip, Queue tab, and Auto-DJ controls to avoid dead air between performances.'],
            ['Manage media', 'Use Audio for background music, Apple Music playlists, and mix controls. Use queue search and review tools for backing tracks.'],
            ['Use automation carefully', 'Flow controls can help with pacing, but the host still owns final stage decisions and guest experience.']
        ],
        tips: [
            'Connect Apple Music before the room gets busy if you plan to use it for background playback.',
            'Use YouTube search intentionally on event days because API quota is limited.',
            'Keep the TV display simple: current performer, next-up context, and audience moments.'
        ]
    }
]);

const getInitialRole = () => {
    if (typeof window === 'undefined') return 'host';
    const parts = String(window.location.pathname || '').split('/').filter(Boolean);
    const role = String(parts[1] || '').trim().toLowerCase();
    return HELP_SECTIONS.some((section) => section.id === role) ? role : 'host';
};

const getRoomCode = () => {
    if (typeof window === 'undefined') return '';
    return String(new URLSearchParams(window.location.search || '').get('room') || '').trim().toUpperCase();
};

const buildHref = (path, roomCode = '') => {
    const safePath = String(path || '/').trim() || '/';
    const query = roomCode ? `?room=${encodeURIComponent(roomCode)}` : '';
    return `${safePath}${query}`;
};

const HelpCenter = () => {
    const [activeRole, setActiveRole] = useState(getInitialRole);
    const roomCode = getRoomCode();
    const activeSection = useMemo(
        () => HELP_SECTIONS.find((section) => section.id === activeRole) || HELP_SECTIONS[2],
        [activeRole]
    );
    const audienceHref = roomCode ? `/?room=${encodeURIComponent(roomCode)}` : '/join';
    const hostHref = roomCode ? `/host?room=${encodeURIComponent(roomCode)}` : '/host';
    const tvHref = roomCode ? `/?room=${encodeURIComponent(roomCode)}&mode=tv` : '/?mode=tv';

    const selectRole = (role) => {
        setActiveRole(role);
        if (typeof window === 'undefined') return;
        const nextPath = buildHref(`/help/${role}`, roomCode);
        window.history.replaceState({}, '', nextPath);
    };

    return (
        <main className="min-h-screen bg-[#070a12] text-white print:bg-white print:text-zinc-950">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
                <header className="rounded-3xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(0,196,217,0.16),rgba(236,72,153,0.12),rgba(8,12,24,0.96))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] print:border-zinc-300 print:bg-white print:shadow-none">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <img src={ASSETS.logo} alt="BeauRocks Karaoke" className="h-14 w-14 rounded-2xl border border-white/10 bg-black/35 object-contain p-1 print:border-zinc-200 print:bg-white" />
                            <div className="min-w-0">
                                <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-100/80 print:text-zinc-500">BeauRocks Karaoke Help</div>
                                <h1 className="mt-1 text-2xl font-black leading-tight sm:text-4xl">Run the room with less explaining.</h1>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 print:hidden">
                            <a href={hostHref} className="rounded-full border border-white/12 bg-black/30 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-zinc-100 hover:border-cyan-300/50">Host</a>
                            <a href={audienceHref} className="rounded-full border border-white/12 bg-black/30 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-zinc-100 hover:border-cyan-300/50">Audience</a>
                            <a href={tvHref} className="rounded-full border border-white/12 bg-black/30 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-zinc-100 hover:border-cyan-300/50">TV</a>
                            <button type="button" onClick={() => window.print()} className="rounded-full border border-cyan-300/30 bg-cyan-500/14 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-cyan-50">Print</button>
                        </div>
                    </div>
                    {roomCode ? (
                        <div className="mt-4 inline-flex rounded-full border border-white/12 bg-black/25 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 print:border-zinc-300 print:bg-white print:text-zinc-700">
                            Room {roomCode}
                        </div>
                    ) : null}
                </header>

                <nav className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 sm:grid-cols-3 print:hidden">
                    {HELP_SECTIONS.map((section) => {
                        const selected = section.id === activeSection.id;
                        return (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => selectRole(section.id)}
                                className={`rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-cyan-300/50 bg-cyan-500/14 text-white' : 'border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.04]'}`}
                            >
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/75">{section.eyebrow}</div>
                                <div className="mt-1 text-lg font-black">{section.label}</div>
                            </button>
                        );
                    })}
                </nav>

                <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] print:grid-cols-1">
                    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 print:border-zinc-300 print:bg-white">
                        <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-100/80 print:text-zinc-500">{activeSection.eyebrow}</div>
                        <h2 className="mt-2 text-3xl font-black leading-tight print:text-2xl">{activeSection.title}</h2>
                        <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-300 print:text-zinc-700">{activeSection.summary}</p>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {activeSection.steps.map(([title, copy], index) => (
                                <div key={title} className="rounded-2xl border border-white/10 bg-black/24 p-4 print:border-zinc-200 print:bg-white">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/12 text-sm font-black text-cyan-100 print:text-zinc-900">{index + 1}</span>
                                        <h3 className="text-lg font-black">{title}</h3>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-zinc-300 print:text-zinc-700">{copy}</p>
                                </div>
                            ))}
                        </div>
                    </article>

                    <aside className="rounded-3xl border border-white/10 bg-black/30 p-5 print:border-zinc-300 print:bg-white">
                        <div className="text-xs font-black uppercase tracking-[0.24em] text-pink-100/80 print:text-zinc-500">Quick Notes</div>
                        <ul className="mt-4 space-y-3">
                            {activeSection.tips.map((tip) => (
                                <li key={tip} className="flex gap-3 text-sm leading-6 text-zinc-300 print:text-zinc-700">
                                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-cyan-300 print:bg-zinc-500"></span>
                                    <span>{tip}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 print:border-zinc-200 print:bg-zinc-50">
                            <div className="text-sm font-black text-white print:text-zinc-950">Best default explanation</div>
                            <p className="mt-2 text-sm leading-6 text-cyan-50/82 print:text-zinc-700">
                                Join the room, search for a song, request it, and keep your phone open so you know when you are close to the stage.
                            </p>
                        </div>
                    </aside>
                </section>
            </div>
        </main>
    );
};

export default HelpCenter;