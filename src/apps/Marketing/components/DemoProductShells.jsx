import React from "react";

const surfaceFrameClass = "relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-[#050811] text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]";

const sectionHeaderClass = "w-full flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/90 px-3 py-2 text-left text-sm font-black uppercase tracking-[0.18em] text-cyan-200";

const joinAvatarOptions = [
  { icon: "fa-fire", label: "Hype" },
  { icon: "fa-crown", label: "VIP" },
  { icon: "fa-heart", label: "Love" },
  { icon: "fa-sparkles", label: "Glow" },
];

const fauxQrCells = [
  1, 1, 1, 1, 1, 0, 1, 1, 1,
  1, 0, 0, 0, 1, 0, 1, 0, 1,
  1, 0, 1, 0, 1, 0, 1, 0, 1,
  1, 0, 0, 0, 1, 0, 0, 0, 1,
  1, 1, 1, 1, 1, 0, 1, 1, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 0, 1, 1, 1, 0, 1,
  1, 0, 1, 0, 0, 0, 1, 0, 1,
  1, 1, 1, 0, 1, 1, 1, 1, 1,
];

const getActionLabel = (value = "") => String(value || "").split(" x")[0].trim();

const HostSectionHeader = ({ label }) => (
  <div className={sectionHeaderClass}>
    <span>{label}</span>
    <i className="fa-solid fa-chevron-down text-[11px] text-zinc-500" />
  </div>
);

const FauxQr = () => (
  <div className="grid grid-cols-9 gap-[3px] rounded-[18px] bg-white p-3 shadow-[0_0_45px_rgba(255,255,255,0.18)]">
    {fauxQrCells.map((cell, index) => (
      <span
        key={`qr_${index}`}
        className={`h-[11px] w-[11px] rounded-[2px] ${cell ? "bg-black" : "bg-white"}`}
      />
    ))}
  </div>
);

const HostTopBar = ({ roomCode }) => (
  <div className="flex items-center justify-between border-b border-white/10 bg-zinc-950/95 px-4 py-3 backdrop-blur-md">
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Host deck</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
        <span className="rounded-full border border-cyan-300/35 bg-cyan-500/12 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
          Room {roomCode}
        </span>
        <span className="truncate text-zinc-300">Live room controls</span>
      </div>
    </div>
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
      <span className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2.5 py-1 text-emerald-100">Live</span>
      <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-zinc-300">Queue</span>
      <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-zinc-300">TV</span>
    </div>
  </div>
);

const HostSearchPanel = ({ activeScene, hostTypedSearch, hostResults }) => (
  <section className="px-4 py-4 border-b border-white/10">
    <HostSectionHeader label="Add to Queue" />
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="rounded-2xl border border-cyan-300/25 bg-black/35 px-3 py-3">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-magnifying-glass text-cyan-200/80" />
          <div className="flex-1 text-base text-white">
            {activeScene.host.search ? (hostTypedSearch || "Search Apple Music songs...") : activeScene.host.actionLabel}
          </div>
          {activeScene.host.search ? <i className="fa-solid fa-wave-square text-cyan-300" /> : null}
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
          {activeScene.host.status}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {(hostResults || []).slice(0, 3).map((result, index) => (
          <div
            key={`${result.title}_${index}`}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 ${
              index === 0
                ? "border-cyan-300/35 bg-cyan-500/10"
                : "border-white/10 bg-zinc-900/65"
            }`}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-white">{result.title}</div>
              <div className="truncate text-xs text-zinc-400">{result.meta}</div>
            </div>
            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
              {result.state || "Live"}
            </span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const HostNowPlayingPanel = ({ activeScene, queueSnapshot, hostControlProgress }) => (
  <section className="px-4 py-4 border-b border-white/10">
    <HostSectionHeader label="Now Playing" />
    <div className="mt-3 rounded-[26px] border border-cyan-400/25 bg-gradient-to-r from-cyan-500/12 via-black/45 to-pink-500/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200">Stage Quick Actions</div>
        <span className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-100">
          Live
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <button type="button" tabIndex={-1} className="rounded-xl bg-white px-2 py-2 text-[11px] font-black text-black">Play</button>
        <button type="button" tabIndex={-1} className="rounded-xl bg-cyan-500/18 px-2 py-2 text-[11px] font-black text-cyan-100">Applause</button>
        <button type="button" tabIndex={-1} className="rounded-xl bg-fuchsia-500/16 px-2 py-2 text-[11px] font-black text-fuchsia-100">End</button>
        <button type="button" tabIndex={-1} className="rounded-xl bg-amber-500/16 px-2 py-2 text-[11px] font-black text-amber-100">Next</button>
      </div>
    </div>
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">Now Performing</div>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-pink-500/30 to-cyan-500/20 text-xl">
          <i className={`fa-solid ${activeScene.singer.emoji === "fire" ? "fa-fire" : activeScene.singer.emoji === "crown" ? "fa-crown" : "fa-microphone-lines"}`} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-black text-white">{queueSnapshot?.[0]?.title || activeScene.tv.title}</div>
          <div className="truncate text-sm text-zinc-300">{activeScene.singer.name}</div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-pink-300 to-amber-300 transition-all"
          style={{ width: `${36 + Math.round(hostControlProgress * 52)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-zinc-400">
        <span>{activeScene.singer.prompt}</span>
        <span>Queue {queueSnapshot?.length || 0}</span>
      </div>
    </div>
  </section>
);

const HostBroadcastPanel = ({ activeScene, queueSnapshot }) => (
  <section className="px-4 py-4 space-y-3">
    <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">Broadcast Controls</div>
    <HostSectionHeader label="TV Dashboard Controls" />
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Lyrics", on: activeScene.id !== "trivia_break" && activeScene.id !== "guitar_vibe_sync" },
          { label: "Visualizer", on: activeScene.id === "guitar_vibe_sync" || activeScene.id === "auto_dj_handoff" },
          { label: "Pop Trivia", on: activeScene.id === "trivia_break" },
          { label: "Chat on TV", on: activeScene.id === "crowd_hype" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{item.label}</div>
            <div className={`mt-2 text-sm font-black ${item.on ? "text-emerald-200" : "text-zinc-400"}`}>
              {item.on ? "ON" : "OFF"}
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-zinc-900/55 p-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h3 className="text-lg font-bebas tracking-[0.08em] text-pink-400">Queue ({queueSnapshot?.length || 0})</h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Live order</span>
      </div>
      <div className="mt-3 space-y-2">
        {(queueSnapshot || []).map((item, index) => (
          <div key={`${item.title}_${index}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="w-7 text-center font-bebas text-xl text-zinc-500">#{index + 1}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{item.title}</div>
              <div className="truncate text-xs text-zinc-400">{item.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const DemoHostRoomShell = ({
  roomCode,
  activeScene,
  hostTypedSearch,
  hostResults,
  queueSnapshot,
  hostControlProgress,
  hostFocusFrame,
  hostCursorStyle,
  sequenceStep,
}) => (
  <div className={surfaceFrameClass}>
    <HostTopBar roomCode={roomCode} />
    <div className="grid h-[calc(100%-72px)] grid-cols-[1.2fr_0.86fr] overflow-hidden">
      <div className="min-h-0 overflow-y-auto border-r border-white/10 custom-scrollbar">
        <HostSearchPanel activeScene={activeScene} hostTypedSearch={hostTypedSearch} hostResults={hostResults} />
        <HostNowPlayingPanel activeScene={activeScene} queueSnapshot={queueSnapshot} hostControlProgress={hostControlProgress} />
        <HostBroadcastPanel activeScene={activeScene} queueSnapshot={queueSnapshot} />
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto bg-black/20 p-3 custom-scrollbar">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-[#141d2b] to-[#0b1020] p-3">
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Audience View</div>
          <div className="mt-1 text-xs text-cyan-200 truncate">{activeScene.tv.mode}</div>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
            <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Now Performing</div>
            <div className="mt-2 text-sm font-bold text-white">{queueSnapshot?.[0]?.title || activeScene.tv.title}</div>
            <div className="text-[11px] text-zinc-300">{activeScene.singer.name}</div>
            <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-emerald-200">Lyrics</span>
              <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-cyan-200">Visualizer</span>
              <span className="rounded-full border border-white/15 px-2 py-1 text-zinc-300">Queue {queueSnapshot?.length || 0}</span>
            </div>
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.24em] text-zinc-500">State-synced thumbnail</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200">Automation</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["Auto DJ", "Auto End", "Bonus", "Room Pulse"].map((label, index) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
                <div className={`mt-2 text-sm font-black ${index === 0 && activeScene.id === "auto_dj_handoff" ? "text-emerald-200" : "text-zinc-300"}`}>
                  {index === 0 && activeScene.id === "auto_dj_handoff" ? "ACTIVE" : "READY"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    {sequenceStep?.surface === "host" ? (
      <>
        <div className="mk3-demo-focus-ring" style={hostFocusFrame}><span>{sequenceStep.title}</span></div>
        <div className="mk3-demo-sim-cursor is-host" style={hostCursorStyle}><span>{activeScene.host.search ? "type" : "click"}</span></div>
      </>
    ) : null}
  </div>
);

const AudienceBottomNav = ({ activeTab = "party" }) => (
  <div className="relative mt-auto border-t border-pink-400/30 bg-[linear-gradient(180deg,rgba(42,12,56,0.95)_0%,rgba(10,10,20,0.98)_100%)]">
    <div className="relative flex py-1.5">
      {[
        ["party", "fa-champagne-glasses", "PARTY", "#FF7AC8"],
        ["songs", "fa-music", "SONGS", "#46D7E8"],
        ["social", "fa-comments", "SOCIAL", "#FF7AC8"],
      ].map(([id, icon, label, color]) => (
        <div
          key={id}
          className={`flex-1 py-3 flex flex-col items-center gap-1.5 leading-tight ${activeTab === id ? "" : "text-zinc-300"}`}
          style={activeTab === id ? { color } : undefined}
        >
          <i className={`fa-solid ${icon} text-[28px]`} />
          <span className="text-base font-semibold">{label}</span>
        </div>
      ))}
    </div>
  </div>
);

const AudienceJoinScreen = ({ roomCode, activeActionIndex }) => (
  <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,#521847_0%,#150b1f_38%,#090612_74%,#3a1b5c_100%)] px-5 py-5">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-300 via-pink-400 to-violet-400 text-2xl font-black text-black shadow-[0_0_30px_rgba(255,255,255,0.25)]">
      BR
    </div>
    <div className="mt-4 text-center text-sm text-zinc-200">Pick the emoji that feels most you.</div>
    <div className="mt-4 grid grid-cols-4 gap-2">
      {joinAvatarOptions.map((item, index) => (
        <button
          key={item.label}
          type="button"
          tabIndex={-1}
          className={`rounded-2xl border px-2 py-3 text-center transition-all ${
            index === activeActionIndex
              ? "border-pink-300/75 bg-pink-500/20 shadow-[0_0_20px_rgba(255,122,200,0.2)]"
              : "border-white/10 bg-black/20"
          }`}
        >
          <div className="text-xl">
            <i className={`fa-solid ${item.icon}`} />
          </div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.label}</div>
        </button>
      ))}
    </div>
    <div className="mt-4 rounded-3xl bg-gradient-to-br from-[#252633] via-[#1b1f2a] to-[#151926] p-3 text-center shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
      <div className="text-xl font-black text-[#00C4D9] drop-shadow">Jordan</div>
      <div className="mt-1.5 text-base font-bold text-zinc-200">Room vibe selected</div>
    </div>
    <div className="mt-4">
      <input
        readOnly
        value="Jordan"
        className="w-full rounded-xl bg-zinc-100/90 p-3 text-center text-lg font-semibold text-zinc-900 outline-none"
      />
    </div>
    <button type="button" tabIndex={-1} className="mt-4 w-full rounded-xl border-[5px] border-white/90 bg-gradient-to-r from-pink-600 to-purple-600 py-3.5 text-lg font-bold text-white shadow-lg">
      JOIN THE PARTY
    </button>
    <div className="mt-3 text-center text-[11px] uppercase tracking-[0.24em] text-zinc-300">Room {roomCode}</div>
  </div>
);

const AudiencePartyScreen = ({ roomCode, activeScene, activeActionIndex, activeFeedIndex, tapCoach }) => (
  <div className="flex h-full flex-col bg-[linear-gradient(180deg,#120a1f_0%,#090612_55%,#120f1d_100%)]">
    <div className="px-4 pt-4">
      <div className="rounded-[26px] border border-cyan-300/18 bg-black/35 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-200">Room {roomCode}</div>
            <div className="mt-1 text-sm font-black text-white">{activeScene.audience.title}</div>
          </div>
          <div className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200">
            {activeScene.audience.metricValue}
          </div>
        </div>
      </div>
    </div>
    <div className="px-4 pt-4">
      <div className="rounded-[28px] border border-violet-300/35 bg-gradient-to-br from-[#16133a] via-[#23144b] to-[#0a1422] p-4 shadow-[0_16px_44px_rgba(0,0,0,0.45)]">
        <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-100/80">Now performing</div>
        <div className="mt-2 text-2xl font-black text-white">{activeScene.singer.name}</div>
        <div className="text-sm uppercase tracking-[0.18em] text-violet-100/75">{activeScene.tv.title}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Video", "Lyrics", "+ Tight 15"].map((chip) => (
            <span key={chip} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
    <div className="px-4 pt-4">
      <div className="rounded-[28px] border border-cyan-300/24 bg-gradient-to-br from-[#10183a] via-[#1b2353] to-[#121830] p-4">
        <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-100/75">Hit the room prompt</div>
        <div className="mt-2 text-2xl font-black text-white">{tapCoach.prompt.toUpperCase()}</div>
        <div className="mt-1 text-sm text-zinc-200">{tapCoach.detail}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {activeScene.audience.actions.slice(0, 4).map((action, index) => (
            <button
              key={action}
              type="button"
              tabIndex={-1}
              className={`rounded-[22px] border px-3 py-4 text-left transition-all ${
                index === activeActionIndex
                  ? "border-amber-300/70 bg-amber-500/16 shadow-[0_0_22px_rgba(251,191,36,0.18)]"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Tap</div>
              <div className="mt-2 text-lg font-black text-white">{getActionLabel(action)}</div>
              <div className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                {12 + (index * 3)} pts
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
    <div className="px-4 pt-4">
      <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Room feed</div>
            <div className="mt-1 text-sm font-black text-white">{activeScene.audience.metricLabel}</div>
          </div>
          <div className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
            {activeScene.audience.metricValue}
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {activeScene.audience.feed.slice(0, 3).map((item, index) => (
            <div
              key={item}
              className={`rounded-2xl border px-3 py-2 ${
                index === activeFeedIndex ? "border-cyan-300/35 bg-cyan-500/12" : "border-white/10 bg-black/20"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                {index === activeFeedIndex ? "Live update" : "Room feed"}
              </div>
              <div className="mt-1 text-sm font-bold text-white">{item}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <AudienceBottomNav activeTab={activeScene.id === "karaoke_launch" ? "songs" : "party"} />
  </div>
);

const AudienceRequestScreen = ({ activeScene, latestRequest }) => (
  <div className="flex h-full flex-col bg-[linear-gradient(180deg,#0f0b18_0%,#090612_60%,#131520_100%)]">
    <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-900/95 px-4 pb-3 pt-4 backdrop-blur">
      <div className="grid grid-cols-4 gap-2 rounded-xl bg-zinc-800 p-2">
        <div className="rounded-lg bg-cyan-600 py-2 text-center text-base font-bold text-white">REQUESTS</div>
        <div className="rounded-lg py-2 text-center text-base font-bold text-zinc-500">BROWSE</div>
        <div className="rounded-lg py-2 text-center text-base font-bold text-zinc-500">QUEUE</div>
        <div className="rounded-lg py-2 text-center text-base font-bold text-zinc-500">TIGHT 15</div>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
      <div className="space-y-4">
        <div className="text-left">
          <div className="text-sm uppercase tracking-[0.35em] text-zinc-400">Requests</div>
          <h2 className="text-2xl font-bebas text-cyan-400">Request Song</h2>
        </div>
        <div className="space-y-2">
          <input
            readOnly
            value={activeScene.host.search || "Search Apple Music songs..."}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 p-2.5 text-base text-white outline-none"
          />
          <div className="text-sm text-zinc-500">
            Search opens a full-screen Apple Music picker so results stay visible above the keyboard.
          </div>
        </div>
        <div className="w-full rounded-2xl border border-pink-400/30 bg-gradient-to-r from-pink-500/18 via-fuchsia-500/12 to-cyan-500/12 px-4 py-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-[0.35em] text-pink-100/75">Manual Entry</div>
              <div className="text-lg font-black text-white">Type it yourself in a full-screen form</div>
              <div className="text-sm text-zinc-300">Better when you already know the exact song and artist.</div>
            </div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/25 text-pink-100">
              <i className="fa-solid fa-keyboard" />
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-800 pt-4">
          <div className="rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-500/18 via-cyan-500/14 to-sky-500/16 p-4 shadow-[0_16px_40px_rgba(16,185,129,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-left">
                <div className="text-[11px] uppercase tracking-[0.35em] text-emerald-100/80">Request sent</div>
                <div className="mt-1 text-xl font-black text-white leading-tight">{latestRequest.title}</div>
                <div className="text-sm text-zinc-200 truncate">{latestRequest.artist}</div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-50">
                  <i className="fa-solid fa-check-circle" />
                  Added to the room queue
                </div>
              </div>
              <button type="button" tabIndex={-1} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/25 text-zinc-200">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" tabIndex={-1} className="rounded-full bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-black">
                View Queue
              </button>
              <button type="button" tabIndex={-1} className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-white">
                Add Another
              </button>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-4 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm uppercase tracking-[0.35em] text-zinc-400">My Requests</h3>
                <div className="mt-2 text-lg font-black text-white">{latestRequest.title}</div>
                <div className="text-sm text-zinc-400">{latestRequest.artist}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bebas text-cyan-300">1</div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Active now</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <AudienceBottomNav activeTab="songs" />
  </div>
);

const AudienceTriviaCard = ({ activeScene, activeActionIndex }) => (
  <div data-feature-id="pop-trivia-card" className="rounded-3xl border-2 border-cyan-300/55 bg-gradient-to-br from-[#070b1a]/95 via-[#11162b]/95 to-[#180a1f]/95 p-4 shadow-[0_16px_44px_rgba(0,0,0,0.45)]">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-200">Pop-up Trivia</div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Vote live</div>
    </div>
    <div className="mt-3 text-lg font-black text-white">Which surface runs the night best?</div>
    <div className="mt-3 space-y-2">
      {activeScene.audience.actions.map((option, index) => (
        <div
          key={option}
          className={`rounded-2xl border px-3 py-3 ${
            index === activeActionIndex
              ? "border-cyan-300/60 bg-cyan-500/12"
              : "border-white/12 bg-black/32"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-cyan-300 font-black text-sm tracking-[0.16em]">
              {String.fromCharCode(65 + index)}
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold leading-snug text-white">{option}</span>
            <span className="font-mono text-sm text-zinc-300">{18 + (index * 7)}</span>
          </div>
        </div>
      ))}
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
  sequenceStep,
}) => {
  const latestRequest = {
    title: activeScene.tv.title,
    artist: activeScene.singer.name,
  };
  const isJoin = activeScene.id === "join_identity";
  const isRequestScene = activeScene.id === "karaoke_launch";
  const isTriviaScene = activeScene.id === "trivia_break";

  return (
    <div className={`${surfaceFrameClass} rounded-[34px]`}>
      {isJoin ? (
        <AudienceJoinScreen roomCode={roomCode} activeActionIndex={activeActionIndex} />
      ) : isRequestScene ? (
        <AudienceRequestScreen activeScene={activeScene} latestRequest={latestRequest} />
      ) : (
        <div className="flex h-full flex-col">
          {isTriviaScene ? (
            <div className="flex h-full flex-col bg-[linear-gradient(180deg,#120a1f_0%,#090612_55%,#120f1d_100%)]">
              <div className="px-4 pt-4">
                <div className="rounded-[26px] border border-cyan-300/18 bg-black/35 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-200">Room {roomCode}</div>
                  <div className="mt-1 text-sm font-black text-white">{activeScene.audience.title}</div>
                </div>
              </div>
              <div className="px-4 pt-4">
                <AudienceTriviaCard activeScene={activeScene} activeActionIndex={activeActionIndex} />
              </div>
              <div className="px-4 pt-4">
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Next up</div>
                  <div className="mt-2 text-xl font-black text-white">{activeScene.singer.name}</div>
                  <div className="text-sm text-zinc-300">{activeScene.singer.prompt}</div>
                </div>
              </div>
              <AudienceBottomNav activeTab="party" />
            </div>
          ) : (
            <AudiencePartyScreen
              roomCode={roomCode}
              activeScene={activeScene}
              activeActionIndex={activeActionIndex}
              activeFeedIndex={activeFeedIndex}
              tapCoach={tapCoach}
            />
          )}
        </div>
      )}
      {sequenceStep?.surface === "audience" ? (
        <>
          <div className="mk3-demo-focus-ring is-phone" style={audienceFocusFrame}><span>{tapCoach.prompt}</span></div>
          <div className="mk3-demo-sim-tap" style={audienceTapStyle}><i /><span>tap</span></div>
        </>
      ) : null}
    </div>
  );
};

const TvStageArea = ({ activeScene, activeLyric, nextLyric, roomEnergy, tvSurfaceVariant }) => (
  <div className="relative min-h-0 overflow-hidden rounded-[30px] border border-white/10 bg-black">
    <div className={`absolute inset-0 ${
      tvSurfaceVariant === "guitar"
        ? "bg-[radial-gradient(circle_at_top,#4c1d95_0%,#111827_42%,#050816_100%)]"
        : tvSurfaceVariant === "finale"
          ? "bg-[radial-gradient(circle_at_top,#14532d_0%,#0f172a_40%,#050816_100%)]"
          : "bg-[radial-gradient(circle_at_top,#1f2937_0%,#111827_40%,#030712_100%)]"
    }`} />
    <div className="absolute inset-x-0 top-0 h-[44%] bg-gradient-to-b from-white/10 to-transparent" />
    <div className="absolute inset-0 flex flex-col justify-between p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
          {activeScene.tv.mode}
        </div>
        <div className="rounded-full border border-emerald-300/25 bg-emerald-500/12 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
          Room energy {roomEnergy}%
        </div>
      </div>
      <div className="max-w-[72%]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-300">Now performing</div>
        <div className="mt-3 text-5xl font-black uppercase leading-[0.95] text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.35)]">
          {activeLyric || activeScene.tv.title}
        </div>
        <div className="mt-3 text-lg text-zinc-200">{nextLyric || activeScene.tv.footer}</div>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="rounded-[28px] border border-white/15 bg-black/38 px-4 py-3 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">On stage</div>
          <div className="mt-2 text-4xl font-black text-white">{activeScene.singer.name}</div>
          <div className="text-sm text-fuchsia-200">{activeScene.tv.title}</div>
        </div>
        <div className="h-5 w-[32%] overflow-hidden rounded-full border border-white/15 bg-black/40">
          <div className="h-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-pink-300" style={{ width: `${roomEnergy}%` }} />
        </div>
      </div>
    </div>
  </div>
);

const TvTriviaCard = ({ activeScene, triviaRows, formatClockLabel }) => (
  <div
    data-feature-id="tv-pop-trivia-card"
    className="rounded-2xl border border-cyan-300/45 bg-gradient-to-br from-[#050916]/96 via-[#0b1220]/96 to-[#160a21]/96 shadow-[0_0_30px_rgba(34,211,238,0.18)] backdrop-blur overflow-hidden"
  >
    <div className="flex items-center justify-between gap-3 border-b border-cyan-300/15 px-4 py-4 text-xs uppercase tracking-[0.2em]">
      <span className="text-cyan-200">Pop-up Trivia</span>
      <span className="text-cyan-100">{formatClockLabel}</span>
    </div>
    <div className="flex max-h-[32vh] min-h-0 flex-col px-4 py-4">
      <div className="text-[1.45rem] font-black leading-[1.06] text-white">
        {activeScene.tv.title}
      </div>
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1">
        {triviaRows.map((row, index) => (
          <div key={`${row.label}_${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-black/32 px-3 py-3 text-white">
            <span className="text-sm font-black tracking-[0.16em] text-cyan-300">{String.fromCharCode(65 + index)}</span>
            <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{row.label}</span>
            <span className="font-mono text-sm text-zinc-300">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-zinc-200">
        <span>{triviaRows.reduce((sum, row) => sum + row.value, 0)} answers locked</span>
        <span className="text-cyan-100">Vote in Party app</span>
      </div>
    </div>
  </div>
);

const TvJoinCard = ({ roomCode }) => (
  <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-900 to-purple-900 p-4 text-center shadow-lg">
    <div className="mb-1 text-xl font-black uppercase tracking-[0.18em] text-cyan-100">JOIN</div>
    <div className="inline-block rounded-3xl bg-white p-3">
      <FauxQr />
    </div>
    <div className="mt-2 text-3xl font-bebas tracking-[0.14em] text-white">{roomCode}</div>
    <div className="mt-1 text-sm font-semibold uppercase tracking-[0.1em] text-zinc-100">
      Scan QR to join this room
    </div>
  </div>
);

const TvSidebarCard = ({ title, body, tone = "cyan" }) => (
  <div className={`rounded-2xl border p-4 ${
    tone === "yellow"
      ? "border-yellow-400/30 bg-black/70"
      : "border-white/10 bg-zinc-800/80"
  }`}>
    <div className={`text-xs uppercase tracking-[0.24em] ${tone === "yellow" ? "text-yellow-300" : "text-zinc-400"}`}>{title}</div>
    <div className="mt-2 text-lg font-bold text-white">{body}</div>
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
  tvSurfaceVariant,
  tapCoach,
  sequenceStep,
}) => {
  const isTrivia = activeScene.id === "trivia_break";
  return (
    <div className={surfaceFrameClass}>
      <div className="flex items-center justify-between border-b border-white/10 bg-zinc-950/95 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Public TV</div>
          <div className="mt-1 text-sm font-semibold text-white">{activeScene.tv.mode}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200">
          {totalConnectedLabel}
        </div>
      </div>
      <div className="grid h-[calc(100%-72px)] grid-cols-[1.55fr_0.9fr] gap-4 p-4">
        <TvStageArea
          activeScene={activeScene}
          activeLyric={activeLyric}
          nextLyric={nextLyric}
          roomEnergy={roomEnergy}
          tvSurfaceVariant={tvSurfaceVariant}
        />
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto custom-scrollbar">
          {isTrivia ? (
            <TvTriviaCard activeScene={activeScene} triviaRows={triviaRows} formatClockLabel={formatClockLabel} />
          ) : (
            <TvSidebarCard title="Spotlight" body={activeScene.singer.note} tone="yellow" />
          )}
          <TvJoinCard roomCode={roomCode} />
          <TvSidebarCard title="Up next" body={`${reactionItems?.[0]?.label || "Crowd support"} - ${reactionItems?.[0]?.count || 0}`} />
          <div className="rounded-2xl border border-pink-500/35 bg-black/70 p-4">
            <h3 className="text-xl font-bebas tracking-[0.08em] text-pink-400">FULL QUEUE</h3>
            <div className="mt-3 space-y-2">
              {[activeScene.tv.title, activeScene.host.actionLabel, tapCoach.prompt].map((item, index) => (
                <div key={`${item}_${index}`} className="rounded-xl border border-white/10 bg-zinc-800/50 p-3">
                  <div className="text-sm font-bold text-white">#{index + 1} {item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {sequenceStep?.surface === "tv" ? (
        <div className="mk3-demo-focus-ring" style={tvFocusFrame}><span>{sequenceStep.title}</span></div>
      ) : null}
    </div>
  );
};
