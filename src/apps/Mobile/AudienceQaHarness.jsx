import React, { useMemo } from 'react';
import { buildQaAudienceFixture } from './qaAudienceFixtures';
import {
    AUDIENCE_SHELL_VARIANTS,
    deriveAudienceTakeoverKind,
    getAudienceTakeoverLabel,
    normalizeAudienceShellVariant,
} from './audienceShellVariant';

const formatModeLabel = (value = '') => String(value || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

const panelClassName = 'rounded-[28px] border border-white/10 bg-white/8 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.55)]';

const BottomNav = ({ streamlined = false }) => {
    const items = streamlined
        ? ['Party', 'Songs']
        : ['Party', 'Songs', 'Social', 'Profile'];
    return (
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#060912]/95 px-4 pb-6 pt-3">
            <div className={`grid gap-3 ${streamlined ? 'grid-cols-2' : 'grid-cols-4'}`}>
                {items.map((label, index) => (
                    <div
                        key={label}
                        className={`rounded-2xl px-3 py-2.5 text-center text-xs font-semibold tracking-[0.18em] ${
                            index === 0
                                ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-300/50'
                                : 'bg-white/5 text-zinc-400'
                        }`}
                    >
                        {label}
                    </div>
                ))}
            </div>
        </div>
    );
};

const QueueList = ({ songs = [] }) => {
    const items = songs.filter((entry) => entry.status !== 'performed').slice(0, 3);
    return (
        <div className="space-y-3">
            {items.map((song, index) => (
                <div key={song.id || `${song.songTitle}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                    <div>
                        <div className="text-sm font-semibold text-white">{song.songTitle || song.title}</div>
                        <div className="mt-1 text-xs tracking-[0.18em] text-zinc-400">{song.artist}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{song.status === 'performing' ? 'On stage' : 'Queued'}</div>
                        <div className="mt-1 text-sm font-medium text-cyan-200">{song.singerName}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const TriviaCard = ({ question }) => {
    const options = Array.isArray(question?.options) ? question.options : [];
    return (
        <div className={`${panelClassName} border-fuchsia-400/30 bg-[linear-gradient(135deg,rgba(88,28,135,0.78),rgba(15,23,42,0.92))] p-5`}>
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.32em] text-fuchsia-200/80">Live Mode</div>
                    <div className="mt-1 text-2xl font-black text-white">Trivia Break</div>
                </div>
                <div className="rounded-full border border-fuchsia-300/40 bg-fuchsia-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-fuchsia-100">
                    Classic
                </div>
            </div>
            <div className="mt-5 text-lg font-semibold leading-tight text-white">{question?.q || 'Trivia question'}</div>
            <div className="mt-4 space-y-3">
                {options.map((option, index) => (
                    <div key={`${option}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-medium text-white">
                        {String.fromCharCode(65 + index)}. {option}
                    </div>
                ))}
            </div>
        </div>
    );
};

const StreamlinedTakeover = ({ fixture, label }) => {
    const question = fixture?.room?.triviaQuestion;
    const options = Array.isArray(question?.options) ? question.options : [];
    return (
        <div className="relative flex h-full flex-col overflow-hidden rounded-[40px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.28),transparent_38%),linear-gradient(180deg,#090b13_0%,#111827_58%,#030712_100%)] p-6 text-white shadow-[0_40px_120px_rgba(8,15,35,0.65)]">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.22),transparent_60%)]" />
            <div className="relative z-10 flex items-center justify-between">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.36em] text-cyan-200/80">Streamlined Takeover</div>
                    <div className="mt-2 text-4xl font-black tracking-tight">{label}</div>
                </div>
                <div className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
                    Full Screen
                </div>
            </div>
            <div className="relative z-10 mt-8 rounded-[28px] border border-white/10 bg-black/25 p-6 backdrop-blur-xl">
                <div className="text-xs uppercase tracking-[0.32em] text-zinc-400">Question</div>
                <div className="mt-3 text-[30px] font-black leading-tight text-white">{question?.q || 'Trivia question'}</div>
                <div className="mt-6 space-y-3">
                    {options.map((option, index) => (
                        <div key={`${option}-${index}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-300/14 text-sm font-black text-cyan-100">
                                {String.fromCharCode(65 + index)}
                            </div>
                            <div className="text-base font-semibold text-white">{option}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative z-10 mt-auto flex items-center justify-between pt-6">
                <div className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.28em] text-zinc-300">
                    Navigation hidden during live mode
                </div>
                <div className="rounded-full border border-cyan-300/30 bg-cyan-400/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                    Live Mode Pill
                </div>
            </div>
        </div>
    );
};

export default function AudienceQaHarness({ fixtureId = 'classic-home', roomCode = 'DEMOAUD' }) {
    const fixture = useMemo(() => buildQaAudienceFixture(fixtureId, { roomCode }) || {}, [fixtureId, roomCode]);
    const room = fixture.room || {};
    const songs = Array.isArray(fixture.songs) ? fixture.songs : [];
    const user = fixture.user || { name: 'Audience Guest' };
    const shellVariant = normalizeAudienceShellVariant(room.audienceShellVariant);
    const streamlined = shellVariant === AUDIENCE_SHELL_VARIANTS.streamlined;
    const takeoverKind = deriveAudienceTakeoverKind({ activeMode: room.activeMode, lightMode: room.lightMode });
    const takeoverLabel = getAudienceTakeoverLabel(takeoverKind) || formatModeLabel(room.activeMode);
    const currentSinger = songs.find((entry) => entry.status === 'performing') || songs[0] || null;
    const showTakeover = streamlined && !!takeoverKind;
    const roomLabel = room.hostName || 'Host';
    const openShortcuts = streamlined ? ['Lounge', 'DM Host', 'Profile'] : ['Queue', 'Leaderboard', 'VIP Lounge'];

    if (!fixture?.room) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
                <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-6">
                    Unknown audience QA fixture: {fixtureId}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_58%,#020617_100%)] px-4 py-6 text-white">
            <div className="mx-auto max-w-[430px]" data-audience-qa-ready="true" data-audience-qa-fixture={fixtureId}>
                <div className="mb-4 rounded-[28px] border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/75">Audience UX</div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xl font-black text-white">
                                {streamlined ? 'After: Streamlined shell' : 'Before: Classic shell'}
                            </div>
                            <div className="mt-1 text-sm text-zinc-400">
                                {showTakeover ? 'Live mode opens as a takeover with navigation tucked away.' : 'Persistent navigation and room context stay visible.'}
                            </div>
                        </div>
                        <div className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-300">
                            {room.roomCode}
                        </div>
                    </div>
                </div>

                <div className="relative h-[932px] overflow-hidden rounded-[42px] border border-white/12 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(17,24,39,0.96))] shadow-[0_40px_120px_rgba(2,6,23,0.8)]">
                    <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.18),transparent_55%)]" />
                    {showTakeover ? (
                        <div className="h-full p-4">
                            <StreamlinedTakeover fixture={fixture} label={takeoverLabel} />
                        </div>
                    ) : (
                        <>
                            <div className="relative z-10 px-5 pb-32 pt-6">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/75">{streamlined ? 'Party' : 'Home'}</div>
                                        <div className="mt-2 text-3xl font-black tracking-tight text-white">Hey, {user.name}</div>
                                        <div className="mt-2 text-sm text-zinc-400">
                                            {streamlined
                                                ? 'The room is simplified around the live moment and your song requests.'
                                                : 'The room keeps navigation, social, and profile controls visible at all times.'}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-right">
                                        <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/80">{roomLabel}</div>
                                        <div className="mt-1 text-sm font-semibold text-white">{formatModeLabel(room.activeMode || 'karaoke')}</div>
                                    </div>
                                </div>

                                <div className={`mt-5 p-5 ${panelClassName}`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-400">On Stage</div>
                                            <div className="mt-2 text-2xl font-black text-white">{currentSinger?.songTitle || 'Dreams'}</div>
                                            <div className="mt-1 text-sm text-zinc-300">{currentSinger?.artist || 'Fleetwood Mac'}</div>
                                        </div>
                                        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-right">
                                            <div className="text-[11px] uppercase tracking-[0.26em] text-emerald-100/80">Singer</div>
                                            <div className="mt-1 text-sm font-semibold text-white">{currentSinger?.singerName || 'Taylor Demo'}</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-white/8 bg-black/25 p-3">
                                            <div className="text-[11px] uppercase tracking-[0.26em] text-zinc-500">Applause</div>
                                            <div className="mt-2 text-2xl font-black text-white">{currentSinger?.applauseScore || 91}</div>
                                        </div>
                                        <div className="rounded-2xl border border-white/8 bg-black/25 p-3">
                                            <div className="text-[11px] uppercase tracking-[0.26em] text-zinc-500">Hype</div>
                                            <div className="mt-2 text-2xl font-black text-white">{currentSinger?.hypeScore || 88}</div>
                                        </div>
                                    </div>
                                </div>

                                {room.activeMode === 'trivia_pop' ? (
                                    <div className="mt-5">
                                        <TriviaCard question={room.triviaQuestion} />
                                    </div>
                                ) : null}

                                <div className="mt-5">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Queue</div>
                                        <div className="text-xs font-medium text-zinc-400">
                                            {streamlined ? 'Context lives inside Party' : 'Social and profile stay in the nav'}
                                        </div>
                                    </div>
                                    <QueueList songs={songs} />
                                </div>

                                <div className="mt-5">
                                    <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                                        {streamlined ? 'Contextual shortcuts' : 'Persistent destinations'}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {openShortcuts.map((label) => (
                                            <div key={label} className="rounded-2xl border border-white/8 bg-white/6 px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.22em] text-zinc-200">
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <BottomNav streamlined={streamlined} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
