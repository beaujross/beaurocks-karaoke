import React from 'react';
import { getHostRoomLaunchProgress } from '../hostRoomQuickStartModel';

const ReadinessAction = ({
  completed = false,
  disabled = false,
  icon,
  label,
  repeatLabel,
  detail,
  eyebrow,
  tone = 'cyan',
  onClick,
}) => {
  const toneClasses = {
    cyan: completed
      ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-50'
      : 'border-cyan-300/30 bg-cyan-500/10 text-cyan-50 hover:border-cyan-200/50 hover:bg-cyan-500/16',
    fuchsia: completed
      ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-50'
      : 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-50 hover:border-fuchsia-200/50 hover:bg-fuchsia-500/16',
    amber: completed
      ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-50'
      : 'border-amber-300/30 bg-amber-500/10 text-amber-50 hover:border-amber-200/50 hover:bg-amber-500/16',
  };
  return (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={completed}
    className={`group flex min-h-[92px] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${toneClasses[tone] || toneClasses.cyan} ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
  >
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/12 bg-black/20 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <i className={`fa-solid ${completed ? 'fa-check' : icon}`} aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[9px] font-black uppercase tracking-[0.16em] opacity-55">{completed ? 'Ready' : eyebrow}</span>
      <span className="mt-0.5 block text-sm font-black leading-5">{completed ? repeatLabel : label}</span>
      <span className="mt-0.5 block text-[11px] leading-4 opacity-60">{detail}</span>
    </span>
    <i className="fa-solid fa-arrow-right text-[10px] opacity-35 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
  </button>
  );
};

const HostRoomQuickStart = ({
  roomCode = '',
  tvOpened = false,
  joinLinkCopied = false,
  tvReady = false,
  joinLinkReady = false,
  roomSetupReviewed = false,
  appleMusicConnected = false,
  onOpenTv,
  onCopyJoinLink,
  onOpenRoomSetup,
  onConnectAppleMusic,
  onDismiss,
}) => {
  const progress = getHostRoomLaunchProgress({ tvOpened, joinLinkCopied, roomSetupReviewed });

  return (
    <section
      className="relative rounded-2xl border border-cyan-300/24 bg-[linear-gradient(115deg,rgba(8,47,73,0.92),rgba(16,24,43,0.96)_52%,rgba(65,18,63,0.72))] px-3 py-3 shadow-[0_16px_44px_rgba(0,0,0,0.3)] sm:px-4"
      data-host-room-launch-guide="true"
      aria-label="Room launch essentials"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-fuchsia-400/12 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${progress.complete ? 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100' : 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100'}`}>
          <i className={`fa-solid ${progress.complete ? 'fa-check' : 'fa-door-open'}`} aria-hidden="true" />
        </span>
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/62">
            Room launch
            {roomCode ? <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 tracking-[0.14em] text-white/65">{roomCode}</span> : null}
          </div>
          <div className="mt-0.5 text-base font-black text-white">
            {progress.complete ? 'Your Room is ready for guests' : 'Finish opening your Room'}
          </div>
          <div className="mt-0.5 text-xs text-cyan-50/68">
            {progress.complete
              ? 'The room plan, Public TV, and guest link are ready. Keep running the night from the Live Queue.'
              : 'Complete these three readiness steps. Your soundtrack is an optional finishing touch.'}
          </div>
        </div>
        <button type="button" onClick={onDismiss} className="ml-auto min-h-11 rounded-xl px-3 py-2 text-xs font-bold text-cyan-100/58 hover:bg-white/5 hover:text-white" aria-label="Dismiss Room launch guide">
          {progress.complete ? 'Done' : 'Hide'}
        </button>
      </div>

      <div className="relative mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-room-readiness-actions="true">
        <ReadinessAction completed={roomSetupReviewed} icon="fa-wand-magic-sparkles" eyebrow="1 · Room plan" label="Set the Night" repeatLabel="Review Room Plan" detail="Vibe, pacing, and between-song moments" tone="fuchsia" onClick={onOpenRoomSetup} />
        <ReadinessAction completed={tvOpened} disabled={!tvReady} icon="fa-tv" eyebrow="2 · Stage screen" label="Open Public TV" repeatLabel="Open TV Again" detail="Put the live room on the big screen" tone="cyan" onClick={onOpenTv} />
        <ReadinessAction completed={joinLinkCopied} disabled={!joinLinkReady} icon="fa-link" eyebrow="3 · Guest access" label="Copy Join Link" repeatLabel="Copy Link Again" detail="Share the door your guests will use" tone="cyan" onClick={onCopyJoinLink} />
        <ReadinessAction completed={appleMusicConnected} icon="fa-music" eyebrow="Optional · Soundtrack" label="Connect Apple Music" repeatLabel="Apple Music Connected" detail="Bring music back between performances" tone="amber" onClick={onConnectAppleMusic} />
      </div>

      <div className="relative mt-2 flex items-center gap-2" aria-label={`${progress.completedCount} of ${progress.totalCount} room readiness steps complete`}>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/52">{progress.completedCount} of {progress.totalCount} ready</span>
      </div>
    </section>
  );
};

export default HostRoomQuickStart;
