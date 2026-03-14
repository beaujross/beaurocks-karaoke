import React from "react";

const BTN = "rounded-2xl border px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] transition-all";
const QR = ["1111011110001111","1001010010101001","1011011110101111","1001000010101001","1111011110001111","0000010001110000","1110111110101110","1000100010100010","1110111011101110","0010001000101000","1111011110101111","1001010010101001","1011011110101111","1001000010101001","1111011110001111"];

const singerIcon = (v = "") => String(v).toLowerCase().includes("crown") ? "fa-crown" : String(v).toLowerCase().includes("heart") ? "fa-heart" : "fa-fire-flame-curved";
const controlIcon = (label = "") => {
  const token = String(label || "").toLowerCase();
  if (token.includes("search")) return "fa-magnifying-glass";
  if (token.includes("preview")) return "fa-play";
  if (token.includes("cue")) return "fa-microphone-lines";
  if (token.includes("lyrics")) return "fa-align-left";
  if (token.includes("reaction")) return "fa-bolt";
  if (token.includes("spotlight")) return "fa-crosshairs";
  if (token.includes("queue")) return "fa-list-ol";
  if (token.includes("guitar")) return "fa-guitar";
  if (token.includes("trivia")) return "fa-circle-question";
  if (token.includes("auto")) return "fa-compact-disc";
  return "fa-circle";
};
const reactionStyle = (index = 0) => ([
  ["fa-fire-flame-curved", "border-orange-300 bg-orange-500/20 text-orange-100 shadow-[0_0_24px_rgba(249,115,22,0.22)]", "bg-orange-500/25 text-orange-100"],
  ["fa-heart", "border-pink-300 bg-pink-500/20 text-pink-100 shadow-[0_0_24px_rgba(236,72,153,0.22)]", "bg-pink-500/25 text-pink-100"],
  ["fa-hands-clapping", "border-cyan-300 bg-cyan-500/20 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.22)]", "bg-cyan-500/25 text-cyan-100"],
  ["fa-champagne-glasses", "border-blue-300 bg-blue-500/20 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.2)]", "bg-blue-500/25 text-blue-100"],
][index] || ["fa-star", "border-white/20 bg-white/10 text-white", "bg-white/10 text-white"]);
const hostTab = (id = "") => id === "join_identity" ? "Stage" : id === "trivia_break" ? "Games" : id === "karaoke_launch" ? "Browse" : "Stage";
const audienceTab = (id = "") => id === "karaoke_launch" ? "Songs" : "Party";
const queueLabel = (id = "", title = "") => id === "join_identity" ? "Ready to join the room" : id === "trivia_break" ? "Next singer stays staged" : id === "auto_dj_handoff" ? "Bridge is live" : (title || "Song queued");
const actionPts = (value = "", fallback = 12) => `${String(value).match(/x(\d+)/i)?.[1] || fallback} pts`;

const QrBlock = () => <div className="mx-auto grid w-full max-w-[146px] grid-cols-[repeat(16,minmax(0,1fr))] gap-1 rounded-[22px] bg-white p-4 shadow-[0_14px_36px_rgba(0,0,0,0.28)]">{QR.join("").split("").map((cell, i) => <i key={`qr_${i}`} className={`aspect-square rounded-[2px] ${cell === "1" ? "bg-black" : "bg-transparent"}`} />)}</div>;
const Metric = ({ label, value, accent = "cyan" }) => <div className={`rounded-2xl border px-3 py-3 ${accent === "amber" ? "border-amber-300/25 bg-amber-500/10" : accent === "pink" ? "border-pink-300/25 bg-pink-500/10" : "border-cyan-300/20 bg-cyan-500/10"}`}><div className="text-[10px] uppercase tracking-[0.22em] text-zinc-300">{label}</div><div className="mt-1 text-lg font-black text-white">{value}</div></div>;
const isJoinScene = (id = "") => id === "join_identity";

export const DemoHostRoomShell = ({ roomCode, activeScene, hostTypedSearch, hostResults, queueSnapshot, hostControlProgress, hostFocusFrame, hostCursorStyle, sequenceStep, totalConnectedLabel }) => (
  <div className="relative h-full overflow-hidden rounded-[24px] bg-[#050914] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,196,217,0.15),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.12),transparent_28%)]" />
    <div className="relative flex h-full flex-col">
      <div className="border-b border-white/10 bg-black/50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5"><span className="text-[10px] uppercase tracking-[0.26em] text-cyan-100">Room</span><span className="font-bebas text-[1.28rem] leading-none tracking-[0.22em] text-cyan-200">{roomCode}</span></div>
            <div className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-100">Live</div>
            <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-200">Host deck</div>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400"><span>{totalConnectedLabel}</span><span className="rounded-full border border-white/10 bg-black/35 px-2 py-1">{activeScene.label}</span></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{["Stage", "Queue", "Browse", "Games", "Lobby"].map((label) => <div key={label} className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${label === hostTab(activeScene.id) ? "border-cyan-300/40 bg-cyan-500/14 text-cyan-100" : "border-white/10 bg-black/35 text-zinc-300"}`}>{label}</div>)}</div>
      </div>
      <div className="grid flex-1 grid-cols-[1.24fr_0.92fr] gap-3 p-4">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="rounded-[24px] border border-indigo-400/25 bg-gradient-to-br from-indigo-900/70 via-[#10172a] to-[#070d18] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.32)]">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[11px] uppercase tracking-[0.26em] text-indigo-200">{isJoinScene(activeScene.id) ? "Queue + audience" : "Now performing"}</div><div className="mt-2 truncate text-2xl font-black text-white">{isJoinScene(activeScene.id) ? `Room ${roomCode} is ready` : activeScene.singer.name}</div><div className="mt-1 truncate text-sm italic text-indigo-100/85">{isJoinScene(activeScene.id) ? "Guests join with the room code you share." : activeScene.tv.title}</div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100">{activeScene.host.status}</span><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-200">{activeScene.singer.prompt}</span></div></div><div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-amber-300/35 bg-amber-500/18 text-amber-100 shadow-md"><i className={`fa-solid ${singerIcon(activeScene.singer.emoji)} text-xl`} /></div></div>
            <div className="mt-4 grid grid-cols-4 gap-3"><Metric label="Queue" value={queueSnapshot.length} /><Metric label="Audience" value={activeScene.audience.metricValue} /><Metric label="Pending Mod" value={isJoinScene(activeScene.id) ? "0" : String(Math.max(0, activeScene.audience.feed.length - 1))} accent="amber" /><Metric label="Mode" value={activeScene.tv.mode} accent="pink" /></div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-black/35 p-4">
            <div className="flex items-center justify-between gap-3"><div className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">{isJoinScene(activeScene.id) ? "Quick start" : activeScene.host.search ? "Search + add to queue" : "Live controls"}</div><div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100">{activeScene.host.actionLabel}</div></div>
            {isJoinScene(activeScene.id) ? (
              <div className="mt-3 grid gap-2">
                {[
                  ["Open Public TV", "Guests instantly understand the room.", "Ready"],
                  ["Copy Join Link", "Share one clean entry point.", "Ready"],
                  ["Open Room Setup", "Tune branding or defaults.", "Optional"],
                ].map(([title, meta, state], index) => <div key={title} className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 ${index === 1 ? "border-amber-300/35 bg-amber-500/10" : "border-white/10 bg-white/5"}`}><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{title}</div><div className="truncate text-xs text-zinc-300">{meta}</div></div><span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-cyan-100">{state}</span></div>)}
              </div>
            ) : (
              <>
                <div className="mt-3 rounded-2xl border border-cyan-300/25 bg-[#0a1322] px-4 py-3"><div className="flex items-center gap-3"><i className={`fa-solid ${activeScene.host.search ? "fa-magnifying-glass" : controlIcon(activeScene.host.actionLabel)} text-cyan-200/80`} /><div className="min-w-0 flex-1"><div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200">{activeScene.host.search ? "Catalog search" : "Primary room action"}</div><div className="mt-1 text-base font-black text-white">{activeScene.host.search ? (hostTypedSearch || " ") : activeScene.host.actionLabel}</div></div></div></div>
                <div className="mt-3 grid gap-2">{hostResults.map((result, index) => <div key={`${activeScene.id}_${result.title}`} className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 ${index === 0 ? "border-amber-300/35 bg-amber-500/10" : "border-white/10 bg-white/5"}`}><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{result.title}</div><div className="truncate text-xs text-zinc-300">{result.meta}</div></div><span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-cyan-100">{result.state}</span></div>)}</div>
              </>
            )}
          </div>
          <div className="min-h-0 rounded-[24px] border border-white/10 bg-black/30 p-4"><div className="flex items-center justify-between gap-3"><div className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">{isJoinScene(activeScene.id) ? "Lobby guests" : "Incoming queue snapshot"}</div><div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Live</div></div><div className="mt-3 grid gap-2">{(isJoinScene(activeScene.id) ? activeScene.audience.feed : queueSnapshot.map((entry) => `${entry.title} • ${entry.meta}`)).map((item, index) => <div key={`${activeScene.id}_${item}`} className={`rounded-2xl border px-3 py-3 ${index === 0 ? "border-emerald-300/30 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}><div className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">{index === 0 ? "Latest room update" : isJoinScene(activeScene.id) ? "Guest" : "Queue item"}</div><div className="mt-1 text-sm font-bold text-white">{item}</div></div>)}</div></div>
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <div className="rounded-[22px] border border-zinc-800 bg-zinc-950/90 p-3"><div className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Room status</div><div className="mt-2 space-y-1.5 text-sm text-zinc-300"><div className="flex items-center justify-between"><span>Queue</span><span className="font-semibold text-white">{queueSnapshot.length}</span></div><div className="flex items-center justify-between"><span>Audience</span><span className="font-semibold text-white">{activeScene.audience.metricValue}</span></div><div className="flex items-center justify-between"><span>Mode</span><span className="font-semibold uppercase text-white">{activeScene.tv.mode}</span></div></div></div>
          {sequenceStep?.surface === "host" && <div className="rounded-[22px] border border-amber-300/25 bg-amber-500/10 p-3"><div className="text-[10px] uppercase tracking-[0.22em] text-amber-100">Current host action</div><div className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-white">{sequenceStep.title}</div><div className="mt-1 text-xs text-amber-50/85">{sequenceStep.detail}</div></div>}
          <div className="grid grid-cols-2 gap-2">{activeScene.host.controls.map((control, index) => <button key={`${activeScene.id}_${control}`} type="button" tabIndex={-1} className={`${BTN} ${index === activeScene.host.activeControl && hostControlProgress > 0.22 ? "border-cyan-300/55 bg-cyan-500/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)]" : "border-white/10 bg-white/5 text-zinc-200"}`}><span className="flex items-center gap-2"><i className={`fa-solid ${controlIcon(control)}`} />{control}</span></button>)}</div>
          <div className="min-h-0 flex-1 rounded-[22px] border border-white/10 bg-black/30 p-3"><div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-400">Queue snapshot</div><div className="space-y-2">{queueSnapshot.map((entry, index) => <div key={`${activeScene.id}_${entry.title}`} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2"><div className="w-6 text-center font-bebas text-xl text-zinc-500">#{index + 1}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">{entry.title}</div><div className="truncate text-xs text-zinc-400">{entry.meta}</div></div>{index === 0 && <span className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100">Live</span>}</div>)}</div></div>
        </div>
      </div>
      {sequenceStep?.surface === "host" && <div className="mk3-demo-focus-ring" style={hostFocusFrame}><span>{hostFocusFrame.label}</span></div>}
      {sequenceStep?.surface === "host" && <div className="mk3-demo-sim-cursor is-host" style={hostCursorStyle}><span>{activeScene.host.search ? "type" : "click"}</span></div>}
    </div>
  </div>
);

export const DemoTvRoomShell = ({ roomCode, activeScene, activeLyric, nextLyric, totalConnectedLabel, reactionItems, triviaRows, roomEnergy, tvFocusFrame, formatClockLabel, tapCoach, sequenceStep }) => (
  <div className="relative h-full overflow-hidden rounded-[28px] border border-white/12 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_32%),linear-gradient(180deg,#16071a_0%,#090d18_42%,#04070f_100%)] text-white shadow-[0_30px_70px_rgba(0,0,0,0.42)]">
    <div className="relative grid h-full grid-cols-[0.92fr_1.34fr_0.96fr] gap-3 p-3">
      <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-900/90 to-purple-900/85 p-3 text-center shadow-lg">
        <div className="text-xl font-black uppercase tracking-[0.16em] text-cyan-100">JOIN</div>
        <div className="mt-3"><QrBlock /></div>
        <div className="mt-3 font-bebas text-3xl tracking-[0.12em] text-white">{roomCode}</div>
        <div className="mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-zinc-100">Scan QR to join this room</div>
        <div className="mt-3 rounded-2xl border border-white/15 bg-black/35 px-3 py-2 text-left"><div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200">Room</div><div className="mt-1 text-sm font-bold text-white">{totalConnectedLabel}</div></div>
      </div>
      <div className="relative flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/15 bg-black/35">
        <div className="border-b border-white/10 bg-black/40 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><div className="text-[12px] uppercase tracking-[0.26em] text-cyan-200">{activeScene.tv.mode}</div><div className="mt-1 font-bebas text-[2.2rem] leading-none text-white">{activeScene.tv.title}</div></div><div className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-200">{formatClockLabel}</div></div></div>
        <div className={`relative flex-1 overflow-hidden px-5 py-5 ${activeScene.id === "trivia_break" ? "bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.16),transparent_32%),linear-gradient(180deg,rgba(5,8,20,0.86),rgba(9,14,24,0.95))]" : "bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_26%),linear-gradient(180deg,rgba(28,12,34,0.84),rgba(8,11,18,0.94))]"}`}>
          {activeScene.id === "trivia_break" ? (
            <div className="rounded-[28px] border border-cyan-300/35 bg-black/34 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
              <div className="text-[12px] uppercase tracking-[0.24em] text-cyan-100/90">Vote live</div>
              <div className="mt-2 text-2xl font-black leading-tight text-white">{activeScene.tv.title}</div>
              <div className="mt-4 grid gap-2.5">{triviaRows.map((row, index) => <div key={`${activeScene.id}_${row.label}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-black/32 px-4 py-3 text-white"><span className="text-cyan-300 font-black text-sm tracking-[0.16em]">{String.fromCharCode(65 + index)}</span><span className="min-w-0 flex-1 text-base font-bold leading-tight">{row.label}</span><span className="font-mono text-sm text-zinc-300">{row.value}</span></div>)}</div>
              <div className="mt-4 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-zinc-200"><span>{activeScene.audience.metricValue} answers locked</span><span className="text-cyan-100">Vote in Party app</span></div>
            </div>
          ) : (
            <div className="relative flex h-full flex-col justify-between rounded-[30px] border border-white/10 bg-gradient-to-b from-white/5 via-black/15 to-black/55 p-5">
              <div className="flex items-center gap-2"><span className="rounded-full border border-cyan-300/25 bg-cyan-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">Lyrics live</span><span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-200">{activeScene.singer.name}</span></div>
              <div className="py-6 text-center"><div className="font-bebas text-[3rem] leading-[0.9] text-white">{activeLyric}</div><div className="mt-3 font-bebas text-[2rem] leading-none text-zinc-400">{nextLyric}</div><div className="mx-auto mt-5 max-w-[320px] rounded-full border border-pink-400/35 bg-pink-500/12 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-pink-100">Crowd prompt: {tapCoach.prompt}</div></div>
              <div className="rounded-[24px] border border-white/10 bg-black/38 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">Now performing</div><div className="mt-1 text-xl font-black text-white">{activeScene.singer.name}</div><div className="text-sm text-zinc-300">{activeScene.host.status}</div></div>
            </div>
          )}
        </div>
        <div className="border-t border-white/10 bg-black/35 px-4 py-3"><div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-zinc-200"><span>Room energy</span><span>{roomEnergy}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full border border-white/15 bg-black/40"><div className="h-full bg-gradient-to-r from-red-300 via-amber-300 to-emerald-300" style={{ width: `${roomEnergy}%` }} /></div></div>
      </div>
      <div className="flex min-h-0 flex-col rounded-[28px] border border-white/10 bg-zinc-800/80 p-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2"><h3 className="font-bebas text-2xl text-cyan-400">UP NEXT</h3><span className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">{reactionItems.length} reactions</span></div>
        <div className="mt-2 space-y-2">{activeScene.audience.actions.slice(0, 3).map((action, index) => <div key={`${activeScene.id}_${action}`} className="flex items-center gap-3 rounded-xl border-l-4 border-pink-500 bg-zinc-700/50 p-2"><div className="font-bebas text-2xl text-zinc-400">#{index + 1}</div><div className="min-w-0"><div className="truncate text-base font-bold leading-none text-white">{action.split(" x")[0]}</div><div className="truncate text-sm text-zinc-400">{activeScene.audience.feed[index] || activeScene.audience.subtitle}</div></div></div>)}</div>
        <h3 className="mt-4 border-b border-white/10 pb-2 font-bebas text-2xl text-green-400">ACTIVITY</h3>
        <div className="mt-2 flex-1 space-y-2">{reactionItems.map((item) => <div key={`${activeScene.id}_${item.label}`} className="rounded-xl border border-white/8 bg-black/30 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-white">{item.label}</span><span className="text-sm font-mono text-cyan-200">{item.count}</span></div></div>)}</div>
      </div>
      {sequenceStep?.surface === "tv" && <div className="mk3-demo-focus-ring" style={tvFocusFrame}><span>{tvFocusFrame.label}</span></div>}
    </div>
  </div>
);

export const DemoAudienceRoomShell = ({ roomCode, activeScene, activeActionIndex, activeFeedIndex, audienceTapStyle, audienceFocusFrame, tapCoach, sequenceStep }) => (
  <div className="relative h-full overflow-hidden rounded-[24px] bg-gradient-to-b from-[#16061d] via-[#0d1121] to-[#050914] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_28%),radial-gradient(circle_at_bottom,rgba(0,196,217,0.12),transparent_32%)]" />
    <div className="relative flex h-full flex-col">
      <div className="border-b border-white/10 bg-black/45 px-4 py-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-black/50 px-3 py-1.5"><span className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">ROOM</span><span className="font-bebas text-[1.2rem] tracking-[0.25em] text-cyan-200">{roomCode}</span></div><button type="button" tabIndex={-1} className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-bold text-white/85"><i className="fa-solid fa-users text-white/70" />17</button><button type="button" tabIndex={-1} className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-bold text-white/85"><i className="fa-solid fa-list text-white/70" />04</button></div><div className="flex items-center gap-2"><button type="button" tabIndex={-1} className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-bold text-white/85"><i className="fa-solid fa-crown text-white/70" />DJ BeauRocks</button><button type="button" tabIndex={-1} className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-bold text-white/85"><i className="fa-solid fa-link text-white/70" />Share</button></div></div></div>
      <div className="border-b border-white/10 bg-black/25 px-4 py-2"><div className="grid grid-cols-3 gap-2 text-center">{[["Party", "fa-champagne-glasses"], ["Songs", "fa-music"], ["Social", "fa-comments"]].map(([label, icon]) => <div key={label} className={`rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] ${audienceTab(activeScene.id) === label ? "border-cyan-300/35 bg-cyan-500/14 text-cyan-100" : "border-white/10 bg-white/5 text-zinc-300"}`}><i className={`fa-solid ${icon} mr-2`} />{label}</div>)}</div></div>
      <div className="flex-1 overflow-hidden p-4">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-indigo-500/30 bg-indigo-900/70 shadow-lg backdrop-blur-md">
            <div className="border-b border-white/10 bg-gradient-to-r from-black/70 via-black/30 to-black/70 px-4 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="text-[12px] uppercase tracking-widest text-indigo-300 font-bold mb-1">NOW PERFORMING</div><div className="font-bold text-xl leading-none truncate text-white">{activeScene.singer.name}</div><div className="text-sm text-indigo-200 italic truncate">{activeScene.tv.title}</div></div><div className="flex h-14 w-14 items-center justify-center rounded-lg bg-indigo-700/50 text-3xl shadow-md flex-shrink-0"><i className={`fa-solid ${singerIcon(activeScene.singer.emoji)}`} /></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" tabIndex={-1} className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-xs font-bold text-fuchsia-200"><i className="fa-solid fa-tv mr-1" />Video</button><button type="button" tabIndex={-1} className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-200"><i className="fa-solid fa-align-left mr-1" />Lyrics</button><button type="button" tabIndex={-1} className="rounded-full border border-pink-400/30 bg-pink-500/20 px-3 py-1 text-xs font-bold text-pink-200">+ Tight 15</button></div></div>
            <div className="p-4">
              {sequenceStep?.surface === "audience" && <div className="rounded-2xl border border-cyan-300/35 bg-cyan-500/12 px-3 py-3"><div className="text-[10px] uppercase tracking-[0.2em] text-cyan-100">{sequenceStep.title}</div><div className="mt-1 text-base font-black uppercase tracking-[0.14em] text-white">{tapCoach.prompt}</div><div className="mt-1 text-xs leading-relaxed text-cyan-50/85">{sequenceStep.detail}</div></div>}
              {activeScene.id === "join_identity" ? (
                <div className="mt-4 rounded-3xl border-2 border-cyan-300/55 bg-gradient-to-br from-[#070b1a]/95 via-[#11162b]/95 to-[#180a1f]/95 p-4 shadow-[0_16px_44px_rgba(0,0,0,0.45)]"><div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.22em] text-cyan-100"><span>Join the room</span><span className="font-bold">Name + emoji</span></div><div className="mt-3 grid grid-cols-2 gap-2.5">{activeScene.audience.actions.map((action, index) => <button key={`${activeScene.id}_${action}`} type="button" tabIndex={-1} className={`rounded-2xl border-2 px-3 py-3 text-left transition-all min-h-[72px] ${index === activeActionIndex ? "border-cyan-300 bg-cyan-500/20 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.25)]" : "border-white/20 bg-black/45 text-white"}`}><div className="text-xs font-black tracking-[0.24em] text-cyan-300">{String.fromCharCode(65 + index)}</div><div className="mt-1.5 text-sm font-bold leading-snug">{action}</div></button>)}</div><button type="button" tabIndex={-1} className="mt-3 w-full rounded-2xl bg-[#00C4D9] py-3 text-sm font-black uppercase tracking-[0.2em] text-black">Join room</button></div>
              ) : activeScene.id === "trivia_break" ? (
                <div className="mt-4 rounded-3xl border-2 border-cyan-300/55 bg-gradient-to-br from-[#070b1a]/95 via-[#11162b]/95 to-[#180a1f]/95 shadow-[0_16px_44px_rgba(0,0,0,0.45)] backdrop-blur p-4"><div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.22em] text-cyan-100"><span>Pop-up Trivia</span><span className="font-bold">{activeScene.audience.metricValue}</span></div><div className="mt-2 text-base font-black text-white leading-snug">{activeScene.tv.title}</div><div className="mt-3 grid grid-cols-1 gap-2.5">{activeScene.audience.actions.map((action, index) => <button key={`${activeScene.id}_${action}`} type="button" tabIndex={-1} className={`rounded-2xl border-2 px-3 py-3 text-left transition-all min-h-[72px] ${index === activeActionIndex ? "border-cyan-300 bg-cyan-500/20 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.25)]" : "border-white/20 bg-black/45 text-white hover:border-cyan-300/75 hover:bg-black/60"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-black tracking-[0.24em] text-cyan-300">{String.fromCharCode(65 + index)}</span><span className="text-xs font-mono text-zinc-300">{12 + index * 7}</span></div><div className="mt-1.5 text-sm font-bold leading-snug">{action}</div></button>)}</div><div className="mt-2 text-xs uppercase tracking-[0.22em] text-zinc-300">Tap an answer to join the recap</div></div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2.5">{activeScene.audience.actions.slice(0, 4).map((action, index) => { const [icon, activeShell, activePill] = reactionStyle(index); const isActive = index <= activeActionIndex; return <button key={`${activeScene.id}_${action}`} type="button" tabIndex={-1} className={`rounded-2xl border-2 px-3 py-3 text-left transition-all min-h-[90px] ${isActive ? activeShell : "border-white/20 bg-black/45 text-white"}`}><div className="flex items-center justify-between gap-2"><i className={`fa-solid ${icon} text-lg`} /><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${isActive ? activePill : "bg-white/10 text-zinc-300"}`}>{actionPts(action, 8 + index * 4)}</span></div><div className="mt-3 text-sm font-bold leading-snug">{action.split(" x")[0]}</div></button>; })}</div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><div className="text-[11px] uppercase tracking-[0.22em] text-zinc-300">{activeScene.audience.metricLabel}</div><div className="mt-1 text-2xl font-black text-white">{activeScene.audience.metricValue}</div></div><div className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100">{queueLabel(activeScene.id, activeScene.tv.title)}</div></div><div className="mt-3 space-y-2">{activeScene.audience.feed.map((item, index) => <div key={`${activeScene.id}_${item}`} className={`rounded-xl border px-3 py-2 ${index === activeFeedIndex ? "border-emerald-300/40 bg-emerald-500/12" : "border-white/10 bg-black/35"}`}><div className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">{index === activeFeedIndex ? "Live update" : "Queued"}</div><div className="mt-1 text-sm font-bold text-white">{item}</div></div>)}</div></div>
        </div>
      </div>
      <div className="border-t border-white/10 bg-black/35 px-3 py-2"><div className="grid grid-cols-4 gap-2 text-center">{[["fa-champagne-glasses", "PARTY", audienceTab(activeScene.id) === "Party"], ["fa-music", "SONGS", audienceTab(activeScene.id) === "Songs"], ["fa-comments", "SOCIAL", false], ["fa-crown", "VIP", false]].map(([icon, label, active]) => <div key={label} className={`rounded-xl px-2 py-2 ${active ? "text-[#46D7E8] drop-shadow-[0_0_12px_rgba(70,215,232,0.55)]" : "text-zinc-300"}`}><i className={`fa-solid ${icon} text-lg`} /><div className="mt-1 text-[10px] font-semibold">{label}</div></div>)}</div></div>
      {sequenceStep?.surface === "audience" && <div className="mk3-demo-focus-ring is-phone" style={audienceFocusFrame}><span>{audienceFocusFrame.label}</span></div>}
      {sequenceStep?.surface === "audience" && <div className="mk3-demo-sim-tap" style={audienceTapStyle}><i /><span>tap</span></div>}
    </div>
  </div>
);
