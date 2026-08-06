import React from 'react';
import { getHostRoomLaunchProgress } from '../hostRoomQuickStartModel';

const EssentialAction = ({
  completed = false,
  disabled = false,
  icon,
  label,
  repeatLabel,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${
      completed
        ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-50 hover:bg-emerald-500/18'
        : 'border-cyan-300/32 bg-cyan-500/12 text-cyan-50 hover:border-fuchsia-300/45 hover:bg-cyan-500/18'
    } ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
  >
    <i className={`fa-solid ${completed ? 'fa-check' : icon}`} aria-hidden="true" />
    {completed ? repeatLabel : label}
  </button>
);

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
  const progress = getHostRoomLaunchProgress({ tvOpened, joinLinkCopied });

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
            {progress.complete ? 'Room launch essentials complete' : 'Open your Room to guests'}
          </div>
          <div className="mt-0.5 text-xs text-cyan-50/68">
            {progress.complete
              ? 'Public TV is open and the Join Link is ready to share. Keep running the Room from the Live Queue.'
              : 'Open Public TV, then copy the Join Link. Everything else can wait.'}
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
          <EssentialAction
            completed={tvOpened}
            disabled={!tvReady}
            icon="fa-tv"
            label="Open Public TV"
            repeatLabel="Open TV Again"
            onClick={onOpenTv}
          />
          <EssentialAction
            completed={joinLinkCopied}
            disabled={!joinLinkReady}
            icon="fa-link"
            label="Copy Join Link"
            repeatLabel="Copy Link Again"
            onClick={onCopyJoinLink}
          />
          <details className="group relative">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-white/12 bg-black/20 px-3 py-2.5 text-xs font-bold text-cyan-50/72 hover:border-cyan-300/28 hover:text-white">
              <i className="fa-solid fa-sliders" aria-hidden="true" />
              Optional setup
              <i className="fa-solid fa-chevron-down text-[9px] transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-white/12 bg-slate-950/98 p-2 shadow-2xl">
              <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/48">Fine-tune only if needed</div>
              <button type="button" onClick={onOpenRoomSetup} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-cyan-50/78 hover:bg-cyan-500/10 hover:text-white">
                <i className={`fa-solid ${roomSetupReviewed ? 'fa-check text-emerald-300' : 'fa-sliders text-cyan-300'}`} aria-hidden="true" />
                {roomSetupReviewed ? 'Review Room Setup Again' : 'Adjust Room Setup'}
              </button>
              <button type="button" onClick={onConnectAppleMusic} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-cyan-50/78 hover:bg-cyan-500/10 hover:text-white">
                <i className={`fa-solid ${appleMusicConnected ? 'fa-check text-emerald-300' : 'fa-music text-fuchsia-300'}`} aria-hidden="true" />
                {appleMusicConnected ? 'Apple Music Connected' : 'Connect Apple Music'}
              </button>
            </div>
          </details>
          <button type="button" onClick={onDismiss} className="min-h-11 rounded-xl px-3 py-2 text-xs font-bold text-cyan-100/58 hover:bg-white/5 hover:text-white" aria-label="Dismiss Room launch guide">
            {progress.complete ? 'Done' : 'Hide'}
          </button>
        </div>
      </div>

      <div className="relative mt-2 flex items-center gap-2" aria-label={`${progress.completedCount} of ${progress.totalCount} essential launch steps complete`}>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/52">{progress.completedCount} of 2 essential</span>
      </div>
    </section>
  );
};

export default HostRoomQuickStart;
