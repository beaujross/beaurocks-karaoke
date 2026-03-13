import React from "react";

const DEMO_SHELL_BUTTON_BASE = "rounded-2xl border px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] transition-all";

export const DemoHostRoomShell = ({
  roomCode,
  activeScene,
  hostTypedSearch,
  hostResults,
  queueSnapshot,
  hostControlProgress,
  hostFocusFrame,
  hostCursorStyle,
  tapCoach,
}) => (
  <div className="relative h-full overflow-hidden rounded-[24px] bg-[#050914] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,196,217,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.14),transparent_28%)]" />
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 bg-black/45">
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-100">
            Room {roomCode}
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-200">
            Host live
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-200">
            Queue {queueSnapshot.length}
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">{activeScene.label}</div>
      </div>

      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.25em] text-[#00C4D9]/80">Stage Operations</div>
      <section className="border-b border-white/10 px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm uppercase tracking-[0.3em] text-zinc-400">Now Playing</div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-300">
            {activeScene.host.status}
          </div>
        </div>
        <div className="rounded-[22px] border border-indigo-500/30 bg-indigo-900/45 p-4 shadow-[0_14px_28px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 text-[12px] font-bold uppercase tracking-[0.28em] text-indigo-300">Now Performing</div>
              <div className="truncate text-xl font-bold text-white">{activeScene.singer.name}</div>
              <div className="truncate text-sm italic text-indigo-100/90">{activeScene.tv.title}</div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-700/60 text-3xl shadow-md">
              {activeScene.singer.emoji}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
              {activeScene.host.actionLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-200">
              {activeScene.singer.prompt}
            </span>
            <span className="rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-pink-100">
              Audience cue: {tapCoach.prompt}
            </span>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-4 py-4">
        <div className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-400">Queue + Search</div>
        <div className="rounded-[22px] border border-white/10 bg-black/35 p-3">
          <div className="rounded-2xl border border-cyan-300/25 bg-[#0a1322] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200">
              {activeScene.host.search ? "Catalog search" : "Primary action"}
            </div>
            <div className="mt-1 text-base font-black text-white">
              {activeScene.host.search ? (hostTypedSearch || " ") : activeScene.host.actionLabel}
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {hostResults.map((result, index) => (
              <div
                key={`${activeScene.id}_${result.title}`}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 ${
                  index === 0
                    ? "border-amber-300/35 bg-amber-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{result.title}</div>
                  <div className="truncate text-xs text-zinc-300">{result.meta}</div>
                </div>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-cyan-100">{result.state}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.25em] text-[#00C4D9]/80">Broadcast Controls</div>
      <section className="flex-1 px-4 py-4">
        <div className="mb-3 rounded-[22px] border border-amber-300/25 bg-amber-500/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-amber-100">Audience prompt live</div>
          <div className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-white">{tapCoach.prompt}</div>
          <div className="mt-1 text-xs text-amber-50/85">{tapCoach.detail}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {activeScene.host.controls.map((control, index) => (
            <button
              key={`${activeScene.id}_${control}`}
              type="button"
              tabIndex={-1}
              className={`${DEMO_SHELL_BUTTON_BASE} ${
                index === activeScene.host.activeControl && hostControlProgress > 0.22
                  ? "border-cyan-300/55 bg-cyan-500/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)]"
                  : "border-white/10 bg-white/5 text-zinc-200"
              }`}
            >
              {control}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-[22px] border border-white/10 bg-black/30 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-400">Queue snapshot</div>
          <div className="space-y-2">
            {queueSnapshot.map((entry, index) => (
              <div key={`${activeScene.id}_${entry.title}`} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2">
                <div className="w-6 text-center font-bebas text-xl text-zinc-500">#{index + 1}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{entry.title}</div>
                  <div className="truncate text-xs text-zinc-400">{entry.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mk3-demo-focus-ring" style={hostFocusFrame}>
        <span>{hostFocusFrame.label}</span>
      </div>
      <div className="mk3-demo-sim-cursor is-host" style={hostCursorStyle}>
        <span>{activeScene.host.search ? "type" : "click"}</span>
      </div>
    </div>
  </div>
);

export const DemoTvRoomShell = ({
  roomCode,
  activeScene,
  activeLyric,
  nextLyric,
  totalConnectedLabel,
  reactionItems,
  triviaRows,
  roomEnergy,
  tvFocusFrame,
  formatClockLabel,
  tapCoach,
}) => (
  <div className="relative h-full overflow-hidden rounded-[28px] border border-white/12 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_32%),linear-gradient(180deg,#170a1c_0%,#090d18_42%,#04070f_100%)] text-white shadow-[0_30px_70px_rgba(0,0,0,0.42)]">
    <div className="relative grid h-full grid-cols-[0.88fr_1.28fr_0.92fr] gap-3 p-3">
      <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-900/85 to-purple-900/85 p-3 text-center shadow-lg">
        <div className="text-xl font-black uppercase tracking-[0.16em] text-cyan-100">JOIN</div>
        <div className="mt-3 rounded-2xl bg-white/95 p-5 text-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
          QR
        </div>
        <div className="mt-2 font-bebas text-3xl tracking-[0.12em] text-white">{roomCode}</div>
        <div className="mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-zinc-100">Scan QR to join this room</div>
        <div className="mt-3 rounded-2xl border border-white/15 bg-black/35 px-3 py-2 text-left">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200">Room</div>
          <div className="mt-1 text-sm font-bold text-white">{totalConnectedLabel}</div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-[28px] border border-white/15 bg-black/35 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="text-[12px] uppercase tracking-[0.26em] text-cyan-200">{activeScene.tv.mode}</div>
            <div className="mt-1 font-bebas text-[2.2rem] leading-none text-white">{activeScene.tv.title}</div>
          </div>
          <div className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-200">
            {formatClockLabel}
          </div>
        </div>

        {activeScene.id === "trivia_break" ? (
          <div className="mt-4 flex-1 rounded-[26px] border border-cyan-300/35 bg-black/30 p-4">
            <div className="text-[12px] uppercase tracking-[0.24em] text-cyan-100/90">Vote live</div>
            <div className="mt-2 text-2xl font-black leading-tight text-white">{activeScene.tv.title}</div>
            <div className="mt-4 grid gap-2.5">
              {triviaRows.map((row, index) => (
                <div key={`${activeScene.id}_${row.label}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-black/32 px-4 py-3 text-white">
                  <span className="text-cyan-300 font-black text-sm tracking-[0.16em]">{String.fromCharCode(65 + index)}</span>
                  <span className="min-w-0 flex-1 text-base font-bold leading-tight">{row.label}</span>
                  <span className="font-mono text-sm text-zinc-300">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-zinc-200">
              <span>{activeScene.audience.metricValue} answers locked</span>
              <span className="text-cyan-100">Vote in Party app</span>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex-1 rounded-[28px] border border-white/10 bg-gradient-to-b from-black/15 via-black/35 to-black/60 p-5 text-center">
            <div className="text-[11px] uppercase tracking-[0.26em] text-cyan-200">Now performing</div>
            <div className="mt-2 text-2xl font-black text-white">{activeScene.singer.name}</div>
            <div className="mt-6 font-bebas text-[3rem] leading-[0.9] text-white">{activeLyric}</div>
            <div className="mt-3 font-bebas text-[2rem] leading-none text-zinc-400">{nextLyric}</div>
            <div className="mx-auto mt-6 max-w-[240px] rounded-full border border-white/15 bg-black/40 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-100">
              {activeScene.tv.footer}
            </div>
            <div className="mx-auto mt-3 max-w-[300px] rounded-full border border-pink-400/35 bg-pink-500/12 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-pink-100">
              Crowd prompt: {tapCoach.prompt}
            </div>
          </div>
        )}

        <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-zinc-200">
            <span>Room energy</span>
            <span>{roomEnergy}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full border border-white/15 bg-black/40">
            <div className="h-full bg-gradient-to-r from-red-300 via-amber-300 to-emerald-300" style={{ width: `${roomEnergy}%` }} />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-[28px] border border-white/10 bg-zinc-800/80 p-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
          <h3 className="font-bebas text-2xl text-cyan-400">UP NEXT</h3>
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">{reactionItems.length} reactions</span>
        </div>
        <div className="mt-2 space-y-2">
          {activeScene.audience.actions.slice(0, 3).map((action, index) => (
            <div key={`${activeScene.id}_${action}`} className="flex items-center gap-3 rounded-xl border-l-4 border-pink-500 bg-zinc-700/50 p-2">
              <div className="font-bebas text-2xl text-zinc-400">#{index + 1}</div>
              <div className="min-w-0">
                <div className="truncate text-base font-bold leading-none text-white">{action.split(" x")[0]}</div>
                <div className="truncate text-sm text-zinc-400">{activeScene.audience.feed[index] || activeScene.audience.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
        <h3 className="mt-4 border-b border-white/10 pb-2 font-bebas text-2xl text-green-400">ACTIVITY</h3>
        <div className="mt-2 flex-1 space-y-2">
          {reactionItems.map((item) => (
            <div key={`${activeScene.id}_${item.label}`} className="rounded-xl border border-white/8 bg-black/30 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">{item.label}</span>
                <span className="text-sm font-mono text-cyan-200">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mk3-demo-focus-ring" style={tvFocusFrame}>
        <span>{tvFocusFrame.label}</span>
      </div>
    </div>
  </div>
);

export const DemoAudienceRoomShell = ({
  roomCode,
  activeScene,
  activeActionIndex,
  activeFeedIndex,
  audienceTapStyle,
  audienceFocusFrame,
  tapCoach,
}) => (
  <div className="relative h-full overflow-hidden rounded-[24px] bg-gradient-to-b from-[#16061d] via-[#0d1121] to-[#050914] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_28%),radial-gradient(circle_at_bottom,rgba(0,196,217,0.12),transparent_32%)]" />
    <div className="relative flex h-full flex-col">
      <div className="border-b border-white/10 bg-black/45 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-black/50 px-3 py-1.5">
              <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">ROOM</span>
              <span className="font-bebas text-[1.2rem] tracking-[0.25em] text-cyan-200">{roomCode}</span>
            </div>
            <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-sm font-black uppercase tracking-[0.18em] text-white">
              Lobby
            </div>
            <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-black uppercase tracking-[0.18em] text-white">
              17
            </div>
            <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-black uppercase tracking-[0.18em] text-white">
              06m
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-black uppercase tracking-[0.18em] text-white">
            Share
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="rounded-full border border-amber-300/30 bg-amber-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-100">
            Host: DJ BeauRocks
          </div>
          <div className="rounded-full border border-cyan-400/35 bg-cyan-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
            {activeScene.audience.metricValue}
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 p-4">
        <div className="overflow-hidden rounded-2xl border border-indigo-500/30 bg-indigo-900/70 shadow-lg backdrop-blur-md">
          <div className="border-b border-white/10 bg-gradient-to-r from-black/70 via-black/30 to-black/70 px-4 py-3">
            <div className="text-[12px] font-bold uppercase tracking-widest text-indigo-300">NOW PERFORMING</div>
            <div className="mt-1 text-xl font-bold leading-none text-white">{activeScene.singer.name}</div>
            <div className="mt-1 text-sm italic text-indigo-200">{activeScene.tv.title}</div>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" tabIndex={-1} className="rounded border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-xs font-bold text-fuchsia-200">
                Video
              </button>
              <button type="button" tabIndex={-1} className="rounded border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-200">
                Lyrics
              </button>
              <button type="button" tabIndex={-1} className="rounded border border-pink-400/30 bg-pink-500/20 px-3 py-1 text-xs font-bold text-pink-200">
                + Tight 15
              </button>
            </div>
            <div className="mt-3 rounded-2xl border border-cyan-300/35 bg-cyan-500/12 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-100">{tapCoach.title}</div>
              <div className="mt-1 text-base font-black uppercase tracking-[0.14em] text-white">{tapCoach.prompt}</div>
              <div className="mt-1 text-xs leading-relaxed text-cyan-50/85">{tapCoach.detail}</div>
            </div>
            <div className="mt-4 rounded-3xl border-2 border-cyan-300/55 bg-gradient-to-br from-[#070b1a]/95 via-[#11162b]/95 to-[#180a1f]/95 p-4 shadow-[0_16px_44px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.22em] text-cyan-100">
                <span>{activeScene.id === "trivia_break" ? "Pop-up Trivia" : activeScene.audience.title}</span>
                <span className="font-bold">{activeScene.audience.metricValue}</span>
              </div>
              {activeScene.id === "trivia_break" ? (
                <>
                  <div className="mt-3 text-base font-black leading-snug text-white">{activeScene.tv.title}</div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5">
                    {activeScene.audience.actions.map((action, index) => (
                      <button
                        key={`${activeScene.id}_${action}`}
                        type="button"
                        tabIndex={-1}
                        className={`rounded-2xl border-2 px-3 py-3 text-left transition-all min-h-[72px] ${
                          index === activeActionIndex
                            ? "border-cyan-300 bg-cyan-500/20 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
                            : "border-white/20 bg-black/45 text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black tracking-[0.24em] text-cyan-300">{String.fromCharCode(65 + index)}</span>
                          <span className="text-xs font-mono text-zinc-300">{12 + index * 7}</span>
                        </div>
                        <div className="mt-1.5 text-sm font-bold leading-snug">{action}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.22em] text-zinc-300">Tap an answer to join the recap</div>
                </>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {activeScene.audience.actions.map((action, index) => (
                      <button
                        key={`${activeScene.id}_${action}`}
                        type="button"
                        tabIndex={-1}
                        className={`rounded-2xl border-2 p-3 text-center transition-all ${
                          index <= activeActionIndex
                            ? "border-cyan-300/80 bg-cyan-500/18 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.2)]"
                            : "border-white/14 bg-black/35 text-zinc-200"
                        }`}
                      >
                        <div className="text-lg leading-none mb-2">
                          {index === 0 ? "🔥" : index === 1 ? "💖" : index === 2 ? "👏" : "🎉"}
                        </div>
                        <div className="text-xs font-black uppercase tracking-[0.18em]">{action.split(" x")[0]}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                          {index === activeActionIndex ? "Tap now" : "Ready"}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    {activeScene.audience.feed.map((item, index) => (
                      <div
                        key={`${activeScene.id}_${item}`}
                        className={`rounded-xl border px-3 py-2 ${
                          index === activeFeedIndex
                            ? "border-emerald-300/40 bg-emerald-500/12"
                            : "border-white/10 bg-black/35"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">{index === activeFeedIndex ? "Live update" : "Queued"}</div>
                        <div className="mt-1 text-sm font-bold text-white">{item}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-300">{activeScene.audience.metricLabel}</div>
          <div className="mt-1 text-2xl font-black text-white">{activeScene.audience.metricValue}</div>
          <div className="mt-2 text-sm text-zinc-300">{activeScene.audience.subtitle}</div>
        </div>
      </div>

      <div className="mk3-demo-focus-ring is-phone" style={audienceFocusFrame}>
        <span>{audienceFocusFrame.label}</span>
      </div>
      <div className="mk3-demo-sim-tap" style={audienceTapStyle}>
        <i />
        <span>tap</span>
      </div>
    </div>
  </div>
);
