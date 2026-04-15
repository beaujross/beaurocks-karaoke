import React, { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { buildSurfaceUrl } from "../../../lib/surfaceDomains";
import {
  applyLobbyInteraction,
  createLobbyVolleyState,
} from "../../TV/lobbyPlaygroundEngine";

const clampNumber = (value, min, max, fallback = min) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
};

const formatClock = (ms = 0) => {
  const safeMs = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const ABSTRACT_SURFACES = {
  host: { label: "Host Deck", short: "Host", accent: "amber" },
  tv: { label: "Public TV", short: "TV", accent: "cyan" },
  audience: { label: "Audience Phones", short: "Audience", accent: "pink" },
  singer: { label: "Singer View", short: "Singer", accent: "lime" },
};

const ABSTRACT_INTRO_SURFACE_FEATURES = {
  host: [
    { title: "Cue opener", subtitle: "Set the first room beat" },
    { title: "Pick room mode", subtitle: "Karaoke, game, or crowd mode" },
    { title: "Stage the next move", subtitle: "Keep the room ahead of the drop" },
  ],
  tv: [
    "Join prompt lands big",
    "Stage state stays public",
    "Lyrics or games can take over cleanly",
  ],
  audience: ["Join fast", "Tap prompts", "Vote or react"],
  singer: ["Mic identity", "Up next cue", "Lead / wait / handoff"],
};

const ABSTRACT_BEATS = [
  {
    id: "arrival",
    kicker: "abstract system map",
    title: "Four surfaces wake up around one room moment.",
    body: "This top section should read like motion design, not a literal product capture. It establishes who is driving the room and where the energy lands next.",
    bullets: [
      "Host steers the moment",
      "TV broadcasts the shared state",
      "Audience and singer respond instantly",
    ],
    activeSurface: "host",
    mood: "amber",
    stageVariant: "host",
    signals: [
      { from: "host", to: "tv", label: "Cue opener" },
      { from: "host", to: "audience", label: "Join prompt" },
      { from: "host", to: "singer", label: "You are up" },
    ],
    notes: {
      host: "Host selects the first room beat.",
      tv: "TV waits for the first cue.",
      audience: "Audience joins with low-friction prompts.",
      singer: "Singer claims the mic identity.",
    },
  },
  {
    id: "singalong",
    kicker: "shared room energy",
    title: "The room becomes a loop, not a one-way broadcast.",
    body: "The TV leads the room, the audience feeds momentum back in, and the singer gets visible support instead of dead air.",
    bullets: [
      "Lyrics stay readable",
      "Audience reactions visibly matter",
      "Singer confidence rises with crowd support",
    ],
    activeSurface: "tv",
    mood: "cyan",
    stageVariant: "karaoke",
    signals: [
      { from: "tv", to: "audience", label: "Sing along cue" },
      { from: "audience", to: "tv", label: "Reaction burst" },
      { from: "audience", to: "singer", label: "Backup energy" },
    ],
    notes: {
      host: "Host monitors momentum instead of scrambling.",
      tv: "The main room state is big and legible.",
      audience: "Phones feel participatory, not passive.",
      singer: "Singer gets timing and crowd reassurance.",
    },
  },
  {
    id: "mode_shift",
    kicker: "sellable mode switch",
    title: "A host-triggered mode shift can repurpose every surface at once.",
    body: "This is where the abstract layer should sell the system power: one input from the host can flip TV visuals, phone controls, and singer expectations without looking chaotic.",
    bullets: [
      "Single host action",
      "Multi-surface reaction",
      "No explanation-heavy UI needed",
    ],
    activeSurface: "audience",
    mood: "pink",
    stageVariant: "audience",
    signals: [
      { from: "host", to: "tv", label: "Launch Vibe Sync" },
      { from: "host", to: "audience", label: "Phones become instruments" },
      { from: "tv", to: "singer", label: "Instrumental handoff" },
    ],
    notes: {
      host: "Host flips the room from karaoke into a crowd mode.",
      tv: "TV swaps lyrics for a playable scene.",
      audience: "Audience gets a new interaction model instantly.",
      singer: "Singer knows when to lean back in or hand off.",
    },
  },
  {
    id: "handoff",
    kicker: "continuous momentum",
    title: "The room hands off cleanly between moments and between performers.",
    body: "The sales story should end on continuity: a room that can keep moving through handoffs, reveals, and the next singer without awkward resets.",
    bullets: [
      "Auto DJ bridges the gap",
      "Next singer is already staged",
      "Audience never loses the thread",
    ],
    activeSurface: "singer",
    mood: "lime",
    stageVariant: "autodj",
    signals: [
      { from: "host", to: "singer", label: "Next singer ready" },
      { from: "singer", to: "tv", label: "New lead arrives" },
      { from: "audience", to: "host", label: "Room stays hot" },
    ],
    notes: {
      host: "Host stays ahead of the room handoff.",
      tv: "TV resolves one scene and tees up the next.",
      audience: "Audience attention stays in rhythm.",
      singer: "Singer enters with context, not confusion.",
    },
  },
];

const ABSTRACT_MOMENTS = {
  arrival: [
    {
      id: "arrival_host_prime",
      kicker: "moment 01",
      title: "Start with the host deck.",
      detail: "Introduce the control surface first. It decides the room mode, cues the opener, and tells every other screen what kind of moment is about to happen.",
      signalIndex: 0,
      host: "The host deck is the deliberate control surface for the whole room.",
      tv: "The TV stays quiet until the host gives it a job.",
      audience: "Phones should stay out of the way until the room asks something of them.",
      singer: "The singer role has not been introduced yet.",
    },
    {
      id: "arrival_tv_wake",
      kicker: "moment 02",
      title: "Then reveal the Public TV.",
      detail: "Show the TV as the shared wall-sized room state. It is where the whole room looks to understand what is happening before lyrics, prompts, or games begin.",
      signalIndex: 0,
      host: "The host action now has one big public place to land.",
      tv: "The TV is the visible shared state for the whole room.",
      audience: "Phones still have not become the main event.",
      singer: "The singer can now read where the room focus lives.",
    },
    {
      id: "arrival_audience_join",
      kicker: "moment 03",
      title: "Then bring in the audience app.",
      detail: "Introduce phones as a low-friction sidekick: quick join, obvious taps, and lightweight prompts. Show the product role before showing any multi-surface choreography.",
      signalIndex: 1,
      host: "The host can now pull the audience into the room without extra explanation.",
      tv: "The TV remains the public state while phones become the personal controller.",
      audience: "Audience phones should feel casual, tappable, and immediate.",
      singer: "The singer can feel the room forming around them.",
    },
    {
      id: "arrival_singer_ready",
      kicker: "moment 04",
      title: "Finally stage the singer view.",
      detail: "Only after the four surfaces are clear should the audience understand the performer role. The singer screen explains whether to lead, wait, or hand off before the system starts showing interplay.",
      signalIndex: 2,
      host: "The host now has all four surfaces staged around the same room moment.",
      tv: "The TV has a room-sized context for what happens next.",
      audience: "The audience is ready, but the cross-surface interplay can wait until the next scene.",
      singer: "The singer always knows when to lead, wait, or hand off.",
    },
  ],
  singalong: [
    {
      id: "singalong_tv_lead",
      kicker: "moment 01",
      title: "The TV takes over as the room lead.",
      detail: "The first karaoke beat should make the TV feel big, shared, and impossible to miss.",
      signalIndex: 0,
      host: "Host can step back once the lyric moment locks in.",
      tv: "TV becomes the obvious room lead.",
      audience: "Phones are primed to support the singalong.",
      singer: "Singer gets a giant, readable room anchor.",
    },
    {
      id: "singalong_audience_cue",
      kicker: "moment 02",
      title: "The crowd gets a clear singalong cue.",
      detail: "The audience should understand exactly when to participate.",
      signalIndex: 0,
      host: "Host is steering momentum instead of micromanaging.",
      tv: "TV pushes the crowd cue outward.",
      audience: "Audience phones move into active support mode.",
      singer: "Singer feels backup energy gathering behind them.",
    },
    {
      id: "singalong_reaction_return",
      kicker: "moment 03",
      title: "Reactions bounce back to the TV.",
      detail: "This is where the loop closes and the room starts feeling alive.",
      signalIndex: 1,
      host: "Host can see crowd energy arrive without extra work.",
      tv: "TV reflects the reaction burst in real time.",
      audience: "Audience taps matter immediately.",
      singer: "Singer gets visual proof the room is with them.",
    },
    {
      id: "singalong_confidence_lift",
      kicker: "moment 04",
      title: "Singer confidence becomes visible.",
      detail: "The room should end this scene feeling fuller and louder than it started.",
      signalIndex: 2,
      host: "Host stays ahead because the room is self-reinforcing.",
      tv: "TV now shows a fully connected room state.",
      audience: "Audience attention stays on the same beat.",
      singer: "Singer confidence rises with the crowd support.",
    },
  ],
  mode_shift: [
    {
      id: "mode_shift_trigger",
      kicker: "moment 01",
      title: "The host throws the switch.",
      detail: "The dramatic part is the clarity: one host move starts the transformation.",
      signalIndex: 0,
      host: "Host launches the new mode from one obvious control.",
      tv: "TV is about to give up lyric-first behavior.",
      audience: "Phones are waiting for a role change.",
      singer: "Singer is about to hand off to the room mechanic.",
    },
    {
      id: "mode_shift_tv_flip",
      kicker: "moment 02",
      title: "The TV visibly changes role.",
      detail: "This should feel sweeping and theatrical, not like a tab change.",
      signalIndex: 0,
      host: "Host sees the full room respond to one input.",
      tv: "TV swaps from lyrics into a mode scene.",
      audience: "Audience can now read that the room logic changed.",
      singer: "Singer understands the room is moving into a new phase.",
    },
    {
      id: "mode_shift_phone_instruments",
      kicker: "moment 03",
      title: "Audience phones become instruments.",
      detail: "This is the sellable surprise beat: phones stop being passive.",
      signalIndex: 1,
      host: "Host has repurposed the crowd without added setup.",
      tv: "TV is now waiting for crowd input instead of lyrics.",
      audience: "Audience gets a new interaction model instantly.",
      singer: "Singer can lean out while the crowd carries the beat.",
    },
    {
      id: "mode_shift_handoff",
      kicker: "moment 04",
      title: "The singer gets a clean instrumental handoff.",
      detail: "The scene resolves when everyone understands the new room contract.",
      signalIndex: 2,
      host: "Host has turned one room into a multi-surface instrument.",
      tv: "TV is now broadcasting the new room role clearly.",
      audience: "Audience is actively driving the scene.",
      singer: "Singer knows exactly when to hand off and re-enter.",
    },
  ],
  handoff: [
    {
      id: "handoff_bridge",
      kicker: "moment 01",
      title: "The bridge starts before the drop.",
      detail: "The room should feel carried into the handoff, not paused between performers.",
      signalIndex: 2,
      host: "Host starts the bridge before energy can collapse.",
      tv: "TV still feels alive during the transition.",
      audience: "Audience keeps feeding the room through the gap.",
      singer: "Next singer is still offstage but already in the flow.",
    },
    {
      id: "handoff_next_ready",
      kicker: "moment 02",
      title: "The next singer gets staged early.",
      detail: "A good handoff feels prepared before the reveal happens.",
      signalIndex: 0,
      host: "Host stages the next singer with breathing room.",
      tv: "TV is about to announce the new lead.",
      audience: "Audience never loses the thread of who is next.",
      singer: "Singer enters with context, not confusion.",
    },
    {
      id: "handoff_tv_resolve",
      kicker: "moment 03",
      title: "The TV resolves one moment and tees up the next.",
      detail: "This is where continuity becomes visible to the whole room.",
      signalIndex: 1,
      host: "Host can trust the room to stay coherent through the handoff.",
      tv: "TV bridges one scene into the next performer cleanly.",
      audience: "Audience gets a visible next-moment reveal.",
      singer: "Singer arrives into a room that is already with them.",
    },
    {
      id: "handoff_loop_close",
      kicker: "moment 04",
      title: "Audience energy closes the loop back to the host.",
      detail: "The final scroll beat should feel like the room can sustain itself through the whole night.",
      signalIndex: 2,
      host: "Host gets confirmation that the room stayed hot.",
      tv: "TV now carries a fully reset, continuous room state.",
      audience: "Audience attention never dropped during the handoff.",
      singer: "Singer steps into momentum instead of rebuilding it.",
    },
  ],
};

const ABSTRACT_SCROLL_EVENTS = ABSTRACT_BEATS.flatMap((beat, beatIndex) =>
  (ABSTRACT_MOMENTS[beat.id] || []).map((moment, momentIndex) => ({
    ...moment,
    beatId: beat.id,
    beatIndex,
    momentIndex,
  }))
);

const DEMO_YOUTUBE_URL = "https://www.youtube.com/watch?v=M7lc1UVf-VE";
const DEMO_TIMED_LYRICS = [
  { startMs: 0, text: "Hands up now, the room is waking." },
  { startMs: 4200, text: "Phones light up and the crowd starts taking." },
  { startMs: 8600, text: "One big screen keeps the whole room moving." },
  { startMs: 12800, text: "Host plus audience, same beat proving." },
  { startMs: 17000, text: "Vote, react, then send it higher." },
  { startMs: 21400, text: "Lyrics, games, and neon fire." },
];

const GUIDED_SCENES = [
  {
    id: "karaoke_video_lyrics",
    label: "YouTube + Lyrics",
    durationMs: 10000,
    accent: "amber",
    kicker: "scene 01",
    headline: "A YouTube-backed song and synced lyrics can land across the room fast.",
    summary: "Lead with the practical proof: host cues a track, the TV shows lyrics, and the audience phone can stay synced to the same media moment.",
    host: {
      panel: "Stage cue",
      status: "Launching a YouTube-backed opener",
      search: "room anthem karaoke youtube",
      actionLabel: "Cue lyrics + video",
      actionCopy: "The host moves from search to live playback without a messy handoff.",
      controls: ["Search", "Cue song", "Video live", "Lyrics on"],
      activeControl: 2,
    },
    audience: {
      title: "Audience sees synced media",
      subtitle: "Phone video and room lyrics stay on the same beat",
      actions: ["Video", "Lyrics", "Clap", "Heart"],
      feed: ["Video synced", "Lyrics readable", "Crowd locked in"],
      metricLabel: "sync drift",
      metricValue: "~0 sec",
    },
    singer: {
      name: "Jordan",
      emoji: "fire",
      status: "Singer in the chorus",
      note: "Media and lyrics are already aligned before the crowd interaction starts.",
      prompt: "Stay with the TV lead",
    },
    tv: {
      mode: "Video + lyrics",
      title: "ROOM ANTHEM DEMO",
      lines: ["Hands up now, the room is waking", "One big screen keeps the whole room moving", "Lyrics stay legible while media runs"],
      footer: "The media path should feel coordinated, not bolted on.",
    },
    callouts: [
      { title: "Host -> TV", detail: "The same host cue can bring in media and TV lyrics together." },
      { title: "TV -> Audience", detail: "The room has one public lyric anchor while phones stay in sync." },
      { title: "Audience -> Song", detail: "Phone video support should feel like part of the room, not a separate app." },
    ],
  },
  {
    id: "crowd_vote_burst",
    label: "Live Reactions",
    durationMs: 8500,
    accent: "cyan",
    kicker: "scene 02",
    headline: "Audience votes in real time and the Public TV answers in sync.",
    summary: "The phone asks for one obvious crowd action, then the room immediately sees that vote show up as a public visual moment on the TV.",
    host: {
      panel: "Live room",
      status: "Calling for a reaction burst",
      search: "",
      actionLabel: "Trigger room hype",
      actionCopy: "A light host cue can turn the audience from passive watchers into visible participants.",
      controls: ["Stage", "Reactions", "Spotlight", "Queue peek"],
      activeControl: 1,
    },
    audience: {
      title: "Audience votes with taps",
      subtitle: "One button press becomes a visible room moment",
      actions: ["Fire", "Clap", "Heart", "Cheer"],
      feed: ["Fire streak rising", "Clap wave landed", "Heart burst mirrored on TV"],
      metricLabel: "reaction burst",
      metricValue: "53 taps",
    },
    singer: {
      name: "Jordan",
      emoji: "fire",
      status: "Singer backed by the crowd",
      note: "The performer sees proof that the room is actually with them.",
      prompt: "Crowd glow climbing",
    },
    tv: {
      mode: "Crowd support",
      title: "ROOM ENERGY RISING",
      lines: ["Votes land on the TV instantly", "The room watches the reaction loop", "Audience input changes the feel instantly"],
      footer: "Audience participation should feel visible, not hidden in the phone.",
    },
    callouts: [
      { title: "Audience -> TV", detail: "The same taps on the phone should feel present on the big screen." },
      { title: "TV -> Singer", detail: "The singer gets a confidence signal, not just background noise." },
      { title: "Host -> Crowd", detail: "The host only needs one prompt to lift the room." },
    ],
  },
  {
    id: "guitar_vibe_sync",
    label: "Guitar Vibe Sync",
    durationMs: 9500,
    accent: "violet",
    kicker: "scene 03",
    headline: "Guitar Vibe Sync should look like a room game, not just a visualizer.",
    summary: "The audience phone becomes a rhythm surface, the TV turns into a crowd scoreboard, and the host only has to launch the mode once.",
    host: {
      panel: "Mode trigger",
      status: "Launching Guitar Vibe Sync",
      search: "",
      actionLabel: "Start guitar mode",
      actionCopy: "One host action should make the crowd phones feel instantly playable.",
      controls: ["Karaoke", "Guitar", "Confetti", "Return"],
      activeControl: 1,
    },
    audience: {
      title: "Phones become rhythm pads",
      subtitle: "Hit the target lane and build combo",
      actions: ["Lane I", "Lane III", "Lane V", "Perfect"],
      feed: ["Combo up", "Perfect hit", "Top jammer changed"],
      metricLabel: "live strummers",
      metricValue: "14 active",
    },
    singer: {
      name: "Jordan",
      emoji: "fire",
      status: "Instrumental handoff",
      note: "The room carries the solo beat while the singer waits for the next vocal return.",
      prompt: "Re-enter after the break",
    },
    tv: {
      mode: "Guitar mode",
      title: "JAMMERS TAKE OVER",
      lines: ["Phones stop being passive", "The TV spotlights top jammers", "Crowd hits become the show"],
      footer: "This should read like a playable crowd moment, not a side effect.",
    },
    callouts: [
      { title: "Host -> All", detail: "The host triggers the mode once and the whole room changes role." },
      { title: "Audience -> TV", detail: "Player effort becomes visible on the shared gameboard." },
      { title: "TV -> Crowd", detail: "The room can tell who is actually jamming the hardest." },
    ],
  },
  {
    id: "volley_vibe_sync",
    label: "Volley Sync",
    durationMs: 9000,
    accent: "teal",
    kicker: "scene 04",
    headline: "Volley Sync should look like a shared relay with active crowd support.",
    summary: "The phone should show Save / Lift / Pass / Burst while the TV orb and participant cloud react to the same simulated crowd relay.",
    host: {
      panel: "Auto party",
      status: "Launching Volley Sync",
      search: "",
      actionLabel: "Start volley relay",
      actionCopy: "The room can switch into a short team relay without losing clarity.",
      controls: ["Auto party", "Volley", "Pause", "Reset"],
      activeControl: 1,
    },
    audience: {
      title: "Crowd relay is live",
      subtitle: "Save, lift, pass, and burst the orb together",
      actions: ["Save", "Lift", "Pass", "Burst"],
      feed: ["Relay target changed", "Crowd kept it airborne", "Burst extended the streak"],
      metricLabel: "relay streak",
      metricValue: "11 saves",
    },
    singer: {
      name: "Casey",
      emoji: "crown",
      status: "Stage waiting",
      note: "The singer can wait while the crowd handles a quick shared mini-mode.",
      prompt: "Room relay in progress",
    },
    tv: {
      mode: "Volley relay",
      title: "KEEP IT AIRBORNE",
      lines: ["The TV becomes the shared gameboard", "Crowd inputs keep the relay alive", "Each phone helps the same room objective"],
      footer: "Volley needs to look coordinated, not random.",
    },
    callouts: [
      { title: "Audience -> TV", detail: "The orb and participant network should react to the crowd taps immediately." },
      { title: "TV -> Crowd", detail: "The whole room can read the current relay target." },
      { title: "Host -> Night", detail: "The host can drop in a short crowd mode without losing control." },
    ],
  },
  {
    id: "trivia_break",
    label: "Trivia",
    durationMs: 9000,
    accent: "teal",
    kicker: "scene 05",
    headline: "Trivia should feel like a real live side game, not a dead-air filler.",
    summary: "Phones should show real answer choices while the TV becomes the public question board and tally surface.",
    host: {
      panel: "Games workspace",
      status: "Launching a fast trivia round",
      search: "",
      actionLabel: "Start trivia",
      actionCopy: "Between-song moments stay active if the prompt is fast and room-sized.",
      controls: ["Queue", "Trivia", "WYR", "Auto DJ"],
      activeControl: 1,
    },
    audience: {
      title: "Audience answers on phone",
      subtitle: "A/B/C/D votes land quickly",
      actions: ["Host Deck", "Public TV", "Audience App", "All three"],
      feed: ["Votes locked", "Reveal incoming", "Crowd split tightening"],
      metricLabel: "answers in",
      metricValue: "24 votes",
    },
    singer: {
      name: "Casey",
      emoji: "crown",
      status: "Next singer staged",
      note: "The queue can reset while the room stays busy.",
      prompt: "Mic check in progress",
    },
    tv: {
      mode: "Trivia board",
      title: "WHICH SURFACE RUNS THE NIGHT?",
      lines: ["Phones lock answers", "TV becomes the public reveal", "The room stays active between songs"],
      footer: "Trivia keeps the room warm while the next performance is staging.",
    },
    callouts: [
      { title: "Host -> Audience", detail: "The host can launch a fast room-wide vote from the same deck." },
      { title: "Audience -> TV", detail: "The TV turns the private answer into a shared reveal." },
      { title: "Trivia -> Queue", detail: "A side round buys setup time without killing momentum." },
    ],
  },
  {
    id: "would_you_rather",
    label: "Would You Rather",
    durationMs: 9000,
    accent: "pink",
    kicker: "scene 06",
    headline: "Would You Rather should read like a room split with personality.",
    summary: "Phones pick a side, the TV shows the split, and the host gets an easy crowd moment that feels social instead of filler.",
    host: {
      panel: "Games workspace",
      status: "Launching Would You Rather",
      search: "",
      actionLabel: "Start WYR",
      actionCopy: "This is the quickest way to force the room to pick a side and react together.",
      controls: ["Queue", "Trivia", "Would You Rather", "Resume karaoke"],
      activeControl: 2,
    },
    audience: {
      title: "Audience picks a side",
      subtitle: "Two big buttons, one room split",
      actions: ["Glow stick chorus", "Confetti drop"],
      feed: ["Split forming", "The room picked a side", "Reveal is easy to read"],
      metricLabel: "crowd split",
      metricValue: "62 / 38",
    },
    singer: {
      name: "Casey",
      emoji: "crown",
      status: "Singer waiting in the wings",
      note: "The room stays socially engaged before the next song comes back in.",
      prompt: "Next vocal return after reveal",
    },
    tv: {
      mode: "Would You Rather",
      title: "PICK YOUR SIDE",
      lines: ["Two options, one loud room split", "Phones make the choice clear", "The TV turns it into a shared moment"],
      footer: "WYR should feel quick, playful, and big on the TV.",
    },
    callouts: [
      { title: "Audience -> TV", detail: "A binary phone vote should become a visible room split." },
      { title: "Host -> Crowd", detail: "The host gets a social reset without a long explanation." },
      { title: "WYR -> Night", detail: "The room stays engaged before sliding back into karaoke." },
    ],
  },
];

const WALKTHROUGH_TOTAL_MS = GUIDED_SCENES.reduce((sum, scene) => sum + scene.durationMs, 0);

const WALKTHROUGH_TIMELINE = (() => {
  let cursor = 0;
  return GUIDED_SCENES.map((scene) => {
    const startMs = cursor;
    const endMs = startMs + scene.durationMs;
    cursor = endMs;
    return { ...scene, startMs, endMs };
  });
})();

const getSceneAtMs = (timelineMs = 0) => {
  const safeMs = clampNumber(timelineMs, 0, WALKTHROUGH_TOTAL_MS, 0);
  const scene = WALKTHROUGH_TIMELINE.find((entry) => safeMs >= entry.startMs && safeMs < entry.endMs)
    || WALKTHROUGH_TIMELINE[WALKTHROUGH_TIMELINE.length - 1];
  const sceneMs = Math.max(0, safeMs - scene.startMs);
  const progress = scene.durationMs > 0 ? sceneMs / scene.durationMs : 0;
  return { scene, sceneMs, progress };
};

const getTypedText = (value = "", progress = 0) => {
  const source = String(value || "");
  if (!source) return "";
  const reveal = clampNumber((progress - 0.08) / 0.36, 0, 1, 0);
  return source.slice(0, Math.max(1, Math.round(source.length * reveal)));
};

const getActiveIndex = (items = [], progress = 0) => {
  if (!Array.isArray(items) || !items.length) return 0;
  return clampNumber(Math.floor(progress * items.length), 0, items.length - 1, 0);
};

const TV_VARIANTS_BY_SCENE = {
  guitar_vibe_sync: "guitar",
  trivia_break: "trivia",
  auto_dj_handoff: "finale",
};

const DEMO_ROOM_CODE = "DEMOPEEYV3GWZW";
const _getTvSurfaceVariant = (sceneId = "") => TV_VARIANTS_BY_SCENE[sceneId] || "karaoke";
const DEMO_HOST_NAME = "DJ BeauRocks";

const toFakeTimestamp = (value = Date.now()) => {
  const ms = Math.max(0, Number(value || 0));
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1000000,
  };
};

const getLightModeForScene = (sceneId = "") => {
  switch (sceneId) {
    case "guitar_vibe_sync":
      return "guitar";
    case "crowd_hype":
      return "banger";
    case "auto_dj_handoff":
      return "ballad";
    default:
      return "off";
  }
};

const getHostTabForScene = (sceneId = "") => {
  switch (sceneId) {
    case "join_identity":
      return "lobby";
    case "karaoke_launch":
      return "browse";
    case "trivia_break":
      return "games";
    default:
      return "stage";
  }
};

const getAudienceTabForScene = (sceneId = "") => {
  switch (sceneId) {
    case "karaoke_launch":
      return "request";
    case "trivia_break":
      return "home";
    default:
      return "home";
  }
};

const getAudienceSongsTabForScene = (sceneId = "") => {
  switch (sceneId) {
    case "karaoke_launch":
      return "requests";
    case "auto_dj_handoff":
      return "queue";
    default:
      return "requests";
  }
};

const buildDemoUsers = (scene, nextScene, nowMs) => ([
  {
    uid: "demo_user_jordan",
    roomCode: DEMO_ROOM_CODE,
    name: "Jordan",
    avatar: "🔥",
    points: 184,
    totalEmojis: 61,
    isVip: true,
    vipLevel: 1,
    lastSeen: toFakeTimestamp(nowMs - 4000),
    lastActiveAt: toFakeTimestamp(nowMs - 2000),
  },
  {
    uid: "demo_user_casey",
    roomCode: DEMO_ROOM_CODE,
    name: "Casey",
    avatar: "👑",
    points: 132,
    totalEmojis: 42,
    isVip: false,
    vipLevel: 0,
    lastSeen: toFakeTimestamp(nowMs - 7000),
    lastActiveAt: toFakeTimestamp(nowMs - 5000),
  },
  {
    uid: "demo_user_alex",
    roomCode: DEMO_ROOM_CODE,
    name: "Alex",
    avatar: "💖",
    points: 98,
    totalEmojis: 28,
    isVip: false,
    vipLevel: 0,
    lastSeen: toFakeTimestamp(nowMs - 10000),
    lastActiveAt: toFakeTimestamp(nowMs - 9000),
  },
  {
    uid: "demo_user_taylor",
    roomCode: DEMO_ROOM_CODE,
    name: nextScene?.singer?.name || "Taylor",
    avatar: nextScene?.singer?.emoji === "crown" ? "👑" : "🎤",
    points: 74,
    totalEmojis: 22,
    isVip: false,
    vipLevel: 0,
    lastSeen: toFakeTimestamp(nowMs - 14000),
    lastActiveAt: toFakeTimestamp(nowMs - 12000),
  },
]);

const buildPopTriviaQuestions = () => ([
  {
    id: "demo_trivia_01",
    q: "Which surface keeps the room in sync during a live night?",
    options: ["All three", "Audience App", "Host Deck", "Public TV"],
    correct: 0,
    source: "demo",
  },
  {
    id: "demo_trivia_02",
    q: "What keeps dead air out between singers?",
    options: ["Auto DJ", "Silence", "Paper slips", "Guesswork"],
    correct: 0,
    source: "demo",
  },
]);

const buildDemoSongs = (scene, nextScene, sceneProgress = 0, nowMs = Date.now()) => {
  const currentDuration = scene.id === "trivia_break" ? 155 : 192;
  const elapsedMs = Math.round(currentDuration * 1000 * clampNumber(sceneProgress, 0, 0.96, 0.4));
  const currentSong = {
    id: `demo_song_${scene.id}`,
    roomCode: DEMO_ROOM_CODE,
    singerUid: `demo_user_${scene.singer.name.toLowerCase()}`,
    singerName: scene.singer.name,
    emoji: scene.singer.emoji === "crown" ? "👑" : "🔥",
    songTitle: scene.id === "join_identity" ? "Room Intro" : scene.label,
    artist: "BeauRocks Demo",
    albumArtUrl: "/images/marketing/tv-live-aahf-current.png",
    mediaUrl: "https://beaurocks.app/demo",
    lyrics: scene.tv.lines.join("\n"),
    duration: currentDuration,
    durationSec: currentDuration,
    currentDurationSec: currentDuration,
    appleDurationSec: currentDuration,
    performanceId: `demo_perf_${scene.id}`,
    timestamp: toFakeTimestamp(nowMs - elapsedMs),
    performingStartedAt: toFakeTimestamp(nowMs - elapsedMs),
    stageStartedAt: toFakeTimestamp(nowMs - elapsedMs),
    status: scene.id === "join_identity" ? "requested" : "performing",
    applauseScore: 83,
    hypeScore: 164,
    hostBonus: scene.id === "auto_dj_handoff" ? 20 : 10,
    popTrivia: scene.id === "trivia_break" ? buildPopTriviaQuestions() : [],
  };
  const nextSong = {
    id: `demo_song_next_${scene.id}`,
    roomCode: DEMO_ROOM_CODE,
    singerUid: `demo_user_${(nextScene?.singer?.name || "casey").toLowerCase()}`,
    singerName: nextScene?.singer?.name || "Casey",
    emoji: nextScene?.singer?.emoji === "crown" ? "👑" : "🎤",
    songTitle: nextScene?.label || "Encore queue",
    artist: "BeauRocks Demo",
    albumArtUrl: "/images/marketing/tv-start-aahf-current.png",
    mediaUrl: "https://beaurocks.app/demo-next",
    duration: 188,
    durationSec: 188,
    status: "requested",
    priorityScore: 1,
    timestamp: toFakeTimestamp(nowMs - 18000),
  };
  const thirdSong = {
    id: `demo_song_hold_${scene.id}`,
    roomCode: DEMO_ROOM_CODE,
    singerUid: "demo_user_alex",
    singerName: "Alex",
    emoji: "💖",
    songTitle: "Crowd Favorite",
    artist: "BeauRocks Demo",
    duration: 176,
    durationSec: 176,
    status: "requested",
    priorityScore: 2,
    timestamp: toFakeTimestamp(nowMs - 26000),
  };
  return [currentSong, nextSong, thirdSong];
};

const buildDemoRoom = (scene, sceneProgress = 0, nowMs = Date.now()) => ({
  roomCode: DEMO_ROOM_CODE,
  hostName: DEMO_HOST_NAME,
  logoUrl: "/images/logo-library/beaurocks-logo-neon trasnparent.png",
  activeMode: scene.id === "trivia_break" ? "karaoke" : "karaoke",
  lightMode: getLightModeForScene(scene.id),
  showLyricsTv: scene.id !== "guitar_vibe_sync",
  showVisualizerTv: scene.id === "crowd_hype" || scene.id === "guitar_vibe_sync" || scene.id === "auto_dj_handoff",
  popTriviaEnabled: scene.id === "trivia_break",
  popTriviaRoundSec: 16,
  layoutMode: "standard",
  showScoring: true,
  showFameLevel: true,
  marqueeEnabled: scene.id === "auto_dj_handoff",
  marqueeItems: scene.id === "auto_dj_handoff"
    ? [{ text: "Next singer ready • Room stays hot" }]
    : [],
  chatShowOnTv: scene.id === "crowd_hype",
  chatAudienceMode: "all",
  tvPresentationProfile: "room",
  autoDj: scene.id === "auto_dj_handoff",
  autoPlayMedia: true,
  autoBonusEnabled: true,
  autoLyricsOnQueue: true,
  audienceVideoMode: "off",
  visualizerMode: scene.id === "guitar_vibe_sync" ? "comet" : "ribbon",
  visualizerPreset: scene.id === "guitar_vibe_sync" ? "neon" : "glow",
  visualizerSource: "auto",
  crowdPrompt: {
    title: scene.audience.title,
    detail: scene.audience.subtitle,
    prompt: getActionDisplayLabel(scene.audience.actions[0] || ""),
  },
  multiplier: scene.id === "crowd_hype" ? 4 : scene.id === "guitar_vibe_sync" ? 2 : 1,
  queueSettings: {
    limitMode: "none",
    limitCount: 0,
    rotation: "round_robin",
    firstTimeBoost: true,
  },
  readyCheckDurationSec: 12,
  timestamp: toFakeTimestamp(nowMs - Math.round(sceneProgress * 10000)),
});

const _buildAudienceFixture = ({ scene, nextScene, sceneProgress, activeActionIndex, hostTypedSearch }) => {
  const nowMs = Date.now();
  const room = buildDemoRoom(scene, sceneProgress, nowMs);
  const songs = buildDemoSongs(scene, nextScene, sceneProgress, nowMs);
  const allUsers = buildDemoUsers(scene, nextScene, nowMs);
  if (scene.id === "join_identity") {
    return {
      room,
      songs,
      allUsers,
      user: null,
      form: {
        name: `Jordan`,
        emoji: ["🔥", "👑", "💖", "👏"][activeActionIndex] || "🔥",
        song: "",
        artist: "",
      },
      termsAccepted: true,
      showReturningPrompt: false,
      searchQ: "",
      results: [],
      tab: "home",
      songsTab: "requests",
    };
  }
  return {
    room,
    songs,
    allUsers,
    user: {
      uid: "demo_user_jordan",
      roomCode: DEMO_ROOM_CODE,
      name: "Jordan",
      avatar: "🔥",
      points: 184,
      totalEmojis: 61,
      isVip: false,
      vipLevel: 0,
      lastSeen: toFakeTimestamp(nowMs - 2000),
      lastActiveAt: toFakeTimestamp(nowMs - 1000),
    },
    profile: null,
    form: {
      name: "Jordan",
      emoji: "🔥",
      song: scene.id === "karaoke_launch" ? hostTypedSearch : "",
      artist: scene.id === "karaoke_launch" ? "BeauRocks Demo" : "",
    },
    tab: getAudienceTabForScene(scene.id),
    songsTab: getAudienceSongsTabForScene(scene.id),
    showReturningPrompt: false,
    termsAccepted: true,
    searchQ: scene.id === "karaoke_launch" ? hostTypedSearch : "",
    results: [],
  };
};

const _buildTvFixture = ({ scene, nextScene, sceneProgress, reactionItems, triviaRows }) => {
  const nowMs = Date.now();
  const room = buildDemoRoom(scene, sceneProgress, nowMs);
  const songs = buildDemoSongs(scene, nextScene, sceneProgress, nowMs);
  const roomUsers = buildDemoUsers(scene, nextScene, nowMs);
  return {
    room,
    songs,
    roomUsers,
    started: true,
    activities: reactionItems.map((item, index) => ({
      id: `activity_${scene.id}_${index}`,
      roomCode: DEMO_ROOM_CODE,
      type: "reaction_burst",
      text: `${item.label} x${item.count}`,
      timestamp: toFakeTimestamp(nowMs - (index * 900)),
    })),
    messages: scene.id === "crowd_hype"
      ? [
          { id: "msg_1", user: "Alex", userName: "Alex", avatar: "💖", text: "That chorus hit", timestamp: toFakeTimestamp(nowMs - 2000) },
          { id: "msg_2", user: DEMO_HOST_NAME, userName: DEMO_HOST_NAME, avatar: "🎤", text: "Keep the room loud", timestamp: toFakeTimestamp(nowMs - 1500), isHost: true },
        ]
      : [],
    reactions: reactionItems.map((item, index) => ({
      id: `reaction_${scene.id}_${index}`,
      roomCode: DEMO_ROOM_CODE,
      type: item.label.toLowerCase(),
      userName: roomUsers[index % roomUsers.length]?.name || "Guest",
      avatar: roomUsers[index % roomUsers.length]?.avatar || "🔥",
      count: item.count,
      timestamp: toFakeTimestamp(nowMs - (index * 500)),
    })),
    popTriviaVotes: scene.id === "trivia_break"
      ? triviaRows.map((row, index) => ({
          id: `vote_${index}`,
          questionId: "demo_trivia_01",
          uid: roomUsers[index % roomUsers.length]?.uid,
          val: index,
          timestamp: toFakeTimestamp(nowMs - (index * 700)),
        }))
      : [],
  };
};

const _buildHostFixture = ({ scene, nextScene, sceneProgress, reactionItems }) => {
  const nowMs = Date.now();
  const room = buildDemoRoom(scene, sceneProgress, nowMs);
  return {
    roomCode: DEMO_ROOM_CODE,
    view: "workspace",
    tab: getHostTabForScene(scene.id),
    lobbyTab: "users",
    room,
    songs: buildDemoSongs(scene, nextScene, sceneProgress, nowMs),
    users: buildDemoUsers(scene, nextScene, nowMs),
    activities: reactionItems.map((item, index) => ({
      id: `host_activity_${scene.id}_${index}`,
      roomCode: DEMO_ROOM_CODE,
      text: `${item.label} burst landed`,
      timestamp: toFakeTimestamp(nowMs - (index * 1000)),
    })),
    contacts: [],
  };
};

const _getReactionItems = (scene, progress = 0) => {
  const labels = scene.audience.actions.slice(0, 4).map((entry) => entry.split(" x")[0]);
  const baselines = [12, 18, 24, 30];
  return labels.map((label, index) => ({
    label,
    count: baselines[index] + Math.round(progress * (14 + index * 5)),
  }));
};

const _getTriviaRows = (scene, progress = 0) => {
  const baselines = [14, 18, 16, 22];
  const growth = [8, 12, 10, 24];
  return scene.audience.actions.map((label, index) => ({
    label,
    value: baselines[index] + Math.round(progress * growth[index]),
    highlight: index === scene.audience.actions.length - 1,
  }));
};

const _getHostFocusFrame = (sceneId = "") => {
  switch (sceneId) {
    case "join_identity":
      return { left: "61%", top: "20%", width: "28%", height: "16%", label: "Share room code" };
    case "karaoke_launch":
      return { left: "17%", top: "17%", width: "42%", height: "14%", label: "Search + cue song" };
    case "crowd_hype":
      return { left: "35%", top: "50%", width: "28%", height: "13%", label: "Reaction burst" };
    case "guitar_vibe_sync":
      return { left: "35%", top: "49%", width: "32%", height: "14%", label: "Mode trigger" };
    case "trivia_break":
      return { left: "27%", top: "49%", width: "28%", height: "14%", label: "Launch trivia" };
    case "auto_dj_handoff":
      return { left: "9%", top: "49%", width: "27%", height: "14%", label: "Auto DJ bridge" };
    default:
      return { left: "18%", top: "17%", width: "34%", height: "14%", label: "Host action" };
  }
};

const _getTvFocusFrame = (sceneId = "") => {
  switch (sceneId) {
    case "join_identity":
      return { left: "69%", top: "45%", width: "27%", height: "38%", label: "Join card lands on TV" };
    case "guitar_vibe_sync":
      return { left: "18%", top: "16%", width: "62%", height: "50%", label: "TV flips into Vibe Sync" };
    case "trivia_break":
      return { left: "69%", top: "12%", width: "27%", height: "42%", label: "Live vote reveal" };
    case "auto_dj_handoff":
      return { left: "69%", top: "63%", width: "27%", height: "18%", label: "Next singer handoff" };
    case "crowd_hype":
      return { left: "66%", top: "68%", width: "30%", height: "18%", label: "Reactions hit the room" };
    case "karaoke_launch":
    default:
      return { left: "10%", top: "57%", width: "58%", height: "16%", label: "Lyrics take over" };
  }
};

const _getAudienceFocusFrame = (sceneId = "", activeIndex = 0) => {
  if (sceneId === "join_identity") {
    const joinFrames = [
      { left: "15%", top: "16%", width: "20%", height: "10%" },
      { left: "40%", top: "16%", width: "20%", height: "10%" },
      { left: "65%", top: "16%", width: "20%", height: "10%" },
      { left: "34%", top: "33%", width: "32%", height: "12%" },
    ];
    return {
      ...joinFrames[activeIndex] || joinFrames[0],
      label: "Pick name + emoji",
    };
  }
  if (sceneId === "trivia_break") {
    const triviaFrames = [
      { left: "10%", top: "43%", width: "80%", height: "10%" },
      { left: "10%", top: "55%", width: "80%", height: "10%" },
      { left: "10%", top: "67%", width: "80%", height: "10%" },
      { left: "10%", top: "79%", width: "80%", height: "10%" },
    ];
    return {
      ...triviaFrames[activeIndex] || triviaFrames[0],
      label: "Vote on the phone",
    };
  }
  if (sceneId === "guitar_vibe_sync" || sceneId === "auto_dj_handoff") {
    return {
      left: "18%",
      top: sceneId === "auto_dj_handoff" ? "74%" : "58%",
      width: "64%",
      height: "14%",
      label: sceneId === "guitar_vibe_sync" ? "Phone becomes an instrument" : "Keep the handoff alive",
    };
  }
  const actionFrames = [
    { left: "13%", top: "56%", width: "32%", height: "16%" },
    { left: "55%", top: "56%", width: "32%", height: "16%" },
    { left: "13%", top: "74%", width: "32%", height: "16%" },
    { left: "55%", top: "74%", width: "32%", height: "16%" },
  ];
  return {
    ...actionFrames[activeIndex] || actionFrames[0],
    label: "Audience taps in",
  };
};

const getActionDisplayLabel = (value = "") => String(value || "").split(" x")[0].trim();

const DEMO_AUTO_AVATARS = {
  jordan: String.fromCodePoint(0x1f525),
  casey: String.fromCodePoint(0x1f451),
  alex: String.fromCodePoint(0x1f49c),
  taylor: String.fromCodePoint(0x1f389),
  mic: String.fromCodePoint(0x1f3a4),
};

const buildAutoTimedLyrics = () => DEMO_TIMED_LYRICS.map((entry, index) => ({
  ...entry,
  endMs: DEMO_TIMED_LYRICS[index + 1]?.startMs || (entry.startMs + 3800),
}));

const buildAutoLyricsText = () => DEMO_TIMED_LYRICS.map((entry) => entry.text).join("\n");

const getTvSurfaceVariantAuto = (sceneId = "") => (
  ({
    guitar_vibe_sync: "guitar",
    trivia_break: "trivia",
    would_you_rather: "trivia",
  }[sceneId] || "karaoke")
);

const getLightModeForSceneAuto = (sceneId = "") => (
  ({
    crowd_vote_burst: "banger",
    guitar_vibe_sync: "guitar",
    volley_vibe_sync: "volley",
  }[sceneId] || "off")
);

const getHostTabForSceneAuto = (sceneId = "") => (
  ({
    karaoke_video_lyrics: "browse",
    trivia_break: "games",
    would_you_rather: "games",
  }[sceneId] || "stage")
);

const getAudienceTabForSceneAuto = () => "home";

const getAudienceSongsTabForSceneAuto = (sceneId = "") => (
  sceneId === "volley_vibe_sync" ? "queue" : "requests"
);

const buildDemoUsersAuto = (scene, nextScene, nowMs) => {
  const users = [
    {
      uid: "demo_user_jordan",
      roomCode: DEMO_ROOM_CODE,
      name: "Jordan",
      avatar: DEMO_AUTO_AVATARS.jordan,
      points: 184,
      totalEmojis: 61,
      isVip: true,
      vipLevel: 1,
      lastSeen: toFakeTimestamp(nowMs - 4000),
      lastActiveAt: toFakeTimestamp(nowMs - 2000),
    },
    {
      uid: "demo_user_casey",
      roomCode: DEMO_ROOM_CODE,
      name: "Casey",
      avatar: DEMO_AUTO_AVATARS.casey,
      points: 132,
      totalEmojis: 42,
      isVip: false,
      vipLevel: 0,
      lastSeen: toFakeTimestamp(nowMs - 7000),
      lastActiveAt: toFakeTimestamp(nowMs - 5000),
    },
    {
      uid: "demo_user_alex",
      roomCode: DEMO_ROOM_CODE,
      name: "Alex",
      avatar: DEMO_AUTO_AVATARS.alex,
      points: 98,
      totalEmojis: 28,
      isVip: false,
      vipLevel: 0,
      lastSeen: toFakeTimestamp(nowMs - 10000),
      lastActiveAt: toFakeTimestamp(nowMs - 9000),
    },
    {
      uid: "demo_user_taylor",
      roomCode: DEMO_ROOM_CODE,
      name: nextScene?.singer?.name || "Taylor",
      avatar: nextScene?.singer?.emoji === "crown" ? DEMO_AUTO_AVATARS.casey : DEMO_AUTO_AVATARS.taylor,
      points: 74,
      totalEmojis: 22,
      isVip: false,
      vipLevel: 0,
      lastSeen: toFakeTimestamp(nowMs - 14000),
      lastActiveAt: toFakeTimestamp(nowMs - 12000),
    },
  ];
  if (scene?.id !== "guitar_vibe_sync") return users;
  return users.map((user, index) => ({
    ...user,
    guitarSessionId: "demo_guitar_session",
    guitarHits: [29, 23, 18, 14][index] || 10,
    guitarAccuracy: [0.96, 0.91, 0.88, 0.83][index] || 0.8,
  }));
};

const buildVolleyPreviewStateAuto = (sceneProgress = 0, nowMs = Date.now()) => {
  const interactions = [
    { uid: "demo_user_jordan", userName: "Jordan", avatar: DEMO_AUTO_AVATARS.jordan, type: "wave", count: 1 },
    { uid: "demo_user_casey", userName: "Casey", avatar: DEMO_AUTO_AVATARS.casey, type: "laser", count: 1 },
    { uid: "demo_user_alex", userName: "Alex", avatar: DEMO_AUTO_AVATARS.alex, type: "echo", count: 1 },
    { uid: "demo_user_taylor", userName: "Taylor", avatar: DEMO_AUTO_AVATARS.taylor, type: "confetti", count: 1 },
    { uid: "demo_user_jordan", userName: "Jordan", avatar: DEMO_AUTO_AVATARS.jordan, type: "wave", count: 1 },
    { uid: "demo_user_casey", userName: "Casey", avatar: DEMO_AUTO_AVATARS.casey, type: "laser", count: 1 },
    { uid: "demo_user_alex", userName: "Alex", avatar: DEMO_AUTO_AVATARS.alex, type: "echo", count: 1 },
  ];
  const visibleCount = Math.max(1, Math.min(interactions.length, 2 + Math.round(sceneProgress * (interactions.length - 1))));
  const baseStartMs = nowMs - 3200;
  return interactions.slice(0, visibleCount).reduce(
    (state, event, index) => applyLobbyInteraction(state, event, baseStartMs + (index * 420)),
    createLobbyVolleyState()
  );
};

const buildDemoSongsAuto = (scene, nextScene, sceneProgress = 0, nowMs = Date.now()) => {
  const activePerformanceScene = ["karaoke_video_lyrics", "crowd_vote_burst", "guitar_vibe_sync"].includes(scene?.id);
  const currentDuration = 192;
  const elapsedMs = Math.round(currentDuration * 1000 * clampNumber(sceneProgress, 0.12, 0.82, 0.36));
  const currentSong = {
    id: `demo_song_${scene.id}`,
    roomCode: DEMO_ROOM_CODE,
    singerUid: `demo_user_${String(scene?.singer?.name || "jordan").toLowerCase()}`,
    singerName: scene?.singer?.name || "Jordan",
    emoji: scene?.singer?.emoji === "crown" ? DEMO_AUTO_AVATARS.casey : DEMO_AUTO_AVATARS.jordan,
    songTitle: scene?.id === "karaoke_video_lyrics" ? "Room Anthem Demo" : scene?.label || "BeauRocks Demo",
    artist: scene?.id === "karaoke_video_lyrics" ? "The Shared Moment" : "BeauRocks Demo",
    albumArtUrl: "/images/marketing/tv-live-aahf-current.png",
    mediaUrl: DEMO_YOUTUBE_URL,
    lyrics: buildAutoLyricsText(),
    lyricsTimed: buildAutoTimedLyrics(),
    duration: currentDuration,
    durationSec: currentDuration,
    currentDurationSec: currentDuration,
    appleDurationSec: currentDuration,
    performanceId: `demo_perf_${scene.id}`,
    timestamp: toFakeTimestamp(nowMs - elapsedMs),
    performingStartedAt: toFakeTimestamp(nowMs - elapsedMs),
    stageStartedAt: toFakeTimestamp(nowMs - elapsedMs),
    status: activePerformanceScene ? "performing" : "requested",
    applauseScore: 83,
    hypeScore: 164,
    hostBonus: scene?.id === "crowd_vote_burst" ? 15 : 10,
  };
  const nextSong = {
    id: `demo_song_next_${scene.id}`,
    roomCode: DEMO_ROOM_CODE,
    singerUid: `demo_user_${String(nextScene?.singer?.name || "casey").toLowerCase()}`,
    singerName: nextScene?.singer?.name || "Casey",
    emoji: nextScene?.singer?.emoji === "crown" ? DEMO_AUTO_AVATARS.casey : DEMO_AUTO_AVATARS.taylor,
    songTitle: nextScene?.id === "would_you_rather" ? "Crowd Reset" : (nextScene?.label || "Encore queue"),
    artist: "BeauRocks Demo",
    albumArtUrl: "/images/marketing/tv-start-aahf-current.png",
    mediaUrl: DEMO_YOUTUBE_URL,
    lyrics: buildAutoLyricsText(),
    lyricsTimed: buildAutoTimedLyrics(),
    duration: 188,
    durationSec: 188,
    status: "requested",
    priorityScore: 1,
    timestamp: toFakeTimestamp(nowMs - 18000),
  };
  const thirdSong = {
    id: `demo_song_hold_${scene.id}`,
    roomCode: DEMO_ROOM_CODE,
    singerUid: "demo_user_alex",
    singerName: "Alex",
    emoji: DEMO_AUTO_AVATARS.alex,
    songTitle: "Crowd Favorite",
    artist: "BeauRocks Demo",
    duration: 176,
    durationSec: 176,
    status: "requested",
    priorityScore: 2,
    timestamp: toFakeTimestamp(nowMs - 26000),
  };
  return [currentSong, nextSong, thirdSong];
};

const buildDemoRoomAuto = (scene, sceneProgress = 0, nowMs = Date.now()) => {
  const isVideoScene = scene?.id === "karaoke_video_lyrics";
  const isCrowdVoteScene = scene?.id === "crowd_vote_burst";
  const isGuitarScene = scene?.id === "guitar_vibe_sync";
  const isVolleyScene = scene?.id === "volley_vibe_sync";
  const isTriviaScene = scene?.id === "trivia_break";
  const isWyrScene = scene?.id === "would_you_rather";
  const videoElapsedMs = 24000 + Math.round(sceneProgress * 10000);
  const roundStartedAtMs = nowMs - Math.round(3200 + (sceneProgress * 2800));
  const questionDurationSec = 10;

  return {
    roomCode: DEMO_ROOM_CODE,
    hostName: DEMO_HOST_NAME,
    logoUrl: "/images/logo-library/beaurocks-logo-neon trasnparent.png",
    activeMode: isTriviaScene ? "trivia_pop" : isWyrScene ? "wyr" : "karaoke",
    lightMode: getLightModeForSceneAuto(scene?.id),
    showLyricsTv: isVideoScene,
    showVisualizerTv: isCrowdVoteScene || isGuitarScene || isVolleyScene,
    popTriviaEnabled: isTriviaScene,
    popTriviaRoundSec: questionDurationSec,
    layoutMode: "standard",
    showScoring: true,
    showFameLevel: true,
    marqueeEnabled: isVolleyScene,
    marqueeItems: isVolleyScene ? [{ text: "Volley Sync Live | save, lift, pass, burst" }] : [],
    chatShowOnTv: isCrowdVoteScene,
    chatAudienceMode: "all",
    tvPresentationProfile: isGuitarScene ? "cinema" : isCrowdVoteScene ? "simple" : "room",
    autoDj: false,
    autoPlayMedia: true,
    autoBonusEnabled: true,
    autoLyricsOnQueue: true,
    audienceVideoMode: isVideoScene ? "force" : "off",
    videoPlaying: isVideoScene,
    videoStartTimestamp: isVideoScene ? toFakeTimestamp(nowMs - videoElapsedMs) : null,
    visualizerMode: isGuitarScene ? "comet" : isVolleyScene ? "pulse" : "ribbon",
    visualizerPreset: isGuitarScene ? "neon" : isVolleyScene ? "teal" : "glow",
    visualizerSource: "auto",
    crowdPrompt: {
      title: scene?.audience?.title,
      detail: scene?.audience?.subtitle,
      prompt: getActionDisplayLabel(scene?.audience?.actions?.[0] || ""),
    },
    multiplier: isCrowdVoteScene ? 4 : isGuitarScene ? 3 : isVolleyScene ? 2 : 1,
    queueSettings: {
      limitMode: "none",
      limitCount: 0,
      rotation: "round_robin",
      firstTimeBoost: true,
    },
    readyCheckDurationSec: 12,
    timestamp: toFakeTimestamp(nowMs - Math.round(sceneProgress * 10000)),
    missionControl: isVolleyScene ? {
      autoMoment: {
        status: "live",
        source: "autopilot",
        type: "volley",
        title: "Volley Sync Live",
        detail: "Crowd relay is bouncing across the room.",
      },
    } : null,
    triviaQuestion: isTriviaScene ? {
      id: "demo_trivia_01",
      q: "Which surface keeps the room in sync during a live night?",
      options: ["All three", "Audience App", "Host Deck", "Public TV"],
      correct: 0,
      source: "demo",
      status: "live",
      rewarded: false,
      points: 100,
      startedAt: toFakeTimestamp(roundStartedAtMs),
      durationSec: questionDurationSec,
      autoReveal: true,
      revealAt: toFakeTimestamp(roundStartedAtMs + (questionDurationSec * 1000)),
    } : null,
    wyrData: isWyrScene ? {
      id: "demo_wyr_01",
      question: "Would you rather trigger a glow-stick chorus or a confetti drop?",
      optionA: "Glow stick chorus",
      optionB: "Confetti drop",
      status: "live",
      rewarded: false,
      points: 80,
      startedAt: toFakeTimestamp(roundStartedAtMs),
      durationSec: questionDurationSec,
      autoReveal: true,
      revealAt: toFakeTimestamp(roundStartedAtMs + (questionDurationSec * 1000)),
    } : null,
  };
};

const getReactionItemsAuto = (scene, progress = 0) => {
  const labels = (scene?.audience?.actions || []).map((entry) => getActionDisplayLabel(entry)).filter(Boolean);
  const baselines = [12, 18, 24, 30];
  return labels.map((label, index) => ({
    label,
    count: baselines[index] + Math.round(progress * (14 + index * 5)),
  }));
};

const getTriviaRowsAuto = (scene, progress = 0) => {
  const optionCount = Array.isArray(scene?.audience?.actions) ? scene.audience.actions.length : 0;
  const baselines = optionCount === 2 ? [62, 38] : [14, 18, 16, 22];
  const growth = optionCount === 2 ? [6, 4] : [8, 12, 10, 24];
  return (scene?.audience?.actions || []).map((label, index) => ({
    label,
    value: baselines[index] + Math.round(progress * growth[index]),
    highlight: index === (optionCount === 2 ? 0 : optionCount - 1),
  }));
};

const buildAudienceFixtureAuto = ({ scene, nextScene, sceneProgress, activeActionIndex, hostTypedSearch }) => {
  const nowMs = Date.now();
  const room = buildDemoRoomAuto(scene, sceneProgress, nowMs);
  const songs = buildDemoSongsAuto(scene, nextScene, sceneProgress, nowMs);
  const allUsers = buildDemoUsersAuto(scene, nextScene, nowMs);
  const reactionTypes = ["fire", "clap", "heart", "drink"];
  const localReactionCount = Math.max(1, Math.min(5, 1 + activeActionIndex));
  return {
    room,
    songs,
    allUsers,
    user: {
      uid: "demo_user_jordan",
      roomCode: DEMO_ROOM_CODE,
      name: "Jordan",
      avatar: DEMO_AUTO_AVATARS.jordan,
      points: 184,
      totalEmojis: 61,
      isVip: false,
      vipLevel: 0,
      lastSeen: toFakeTimestamp(nowMs - 2000),
      lastActiveAt: toFakeTimestamp(nowMs - 1000),
    },
    profile: null,
    form: {
      name: "Jordan",
      emoji: DEMO_AUTO_AVATARS.jordan,
      song: scene?.id === "karaoke_video_lyrics" ? hostTypedSearch : "",
      artist: scene?.id === "karaoke_video_lyrics" ? "BeauRocks Demo" : "",
    },
    tab: getAudienceTabForSceneAuto(scene?.id),
    songsTab: getAudienceSongsTabForSceneAuto(scene?.id),
    showReturningPrompt: false,
    termsAccepted: true,
    searchQ: scene?.id === "karaoke_video_lyrics" ? hostTypedSearch : "",
    results: [],
    viewLyrics: false,
    inlineLyrics: false,
    showAudienceVideo: scene?.id === "karaoke_video_lyrics",
    showAudienceVideoFullscreen: false,
    stageHomePanelExpanded: scene?.id === "karaoke_video_lyrics",
    localReactions: scene?.id === "crowd_vote_burst"
      ? Array.from({ length: localReactionCount }, (_, index) => ({
          id: `demo_reaction_${scene.id}_${index}`,
          type: reactionTypes[index % reactionTypes.length],
          left: 18 + (index * 17),
        }))
      : [],
    lobbyVolleyPreview: scene?.id === "volley_vibe_sync" ? buildVolleyPreviewStateAuto(sceneProgress, nowMs) : createLobbyVolleyState(),
  };
};

const buildTvFixtureAuto = ({ scene, nextScene, sceneProgress, reactionItems }) => {
  const nowMs = Date.now();
  const room = buildDemoRoomAuto(scene, sceneProgress, nowMs);
  const songs = buildDemoSongsAuto(scene, nextScene, sceneProgress, nowMs);
  const roomUsers = buildDemoUsersAuto(scene, nextScene, nowMs);
  return {
    room,
    songs,
    roomUsers,
    started: true,
    activities: reactionItems.map((item, index) => ({
      id: `activity_${scene.id}_${index}`,
      roomCode: DEMO_ROOM_CODE,
      type: "reaction_burst",
      text: `${item.label} x${item.count}`,
      timestamp: toFakeTimestamp(nowMs - (index * 900)),
    })),
    messages: scene?.id === "crowd_vote_burst" ? [
      { id: "msg_1", user: "Alex", userName: "Alex", avatar: DEMO_AUTO_AVATARS.alex, text: "That chorus hit", timestamp: toFakeTimestamp(nowMs - 2000) },
      { id: "msg_2", user: DEMO_HOST_NAME, userName: DEMO_HOST_NAME, avatar: DEMO_AUTO_AVATARS.mic, text: "Keep the room loud", timestamp: toFakeTimestamp(nowMs - 1500), isHost: true },
    ] : [],
    reactions: reactionItems.map((item, index) => ({
      id: `reaction_${scene.id}_${index}`,
      roomCode: DEMO_ROOM_CODE,
      type: item.label.toLowerCase().replace(/\s+/g, "_"),
      userName: roomUsers[index % roomUsers.length]?.name || "Guest",
      avatar: roomUsers[index % roomUsers.length]?.avatar || DEMO_AUTO_AVATARS.jordan,
      count: item.count,
      timestamp: toFakeTimestamp(nowMs - (index * 500)),
    })),
    lobbyVolleyState: scene?.id === "volley_vibe_sync" ? buildVolleyPreviewStateAuto(sceneProgress, nowMs) : null,
  };
};

const buildHostFixtureAuto = ({ scene, nextScene, sceneProgress, reactionItems }) => {
  const nowMs = Date.now();
  const room = buildDemoRoomAuto(scene, sceneProgress, nowMs);
  return {
    roomCode: DEMO_ROOM_CODE,
    view: "workspace",
    tab: getHostTabForSceneAuto(scene?.id),
    lobbyTab: "users",
    room,
    songs: buildDemoSongsAuto(scene, nextScene, sceneProgress, nowMs),
    users: buildDemoUsersAuto(scene, nextScene, nowMs),
    activities: reactionItems.map((item, index) => ({
      id: `host_activity_${scene.id}_${index}`,
      roomCode: DEMO_ROOM_CODE,
      text: `${item.label} burst landed`,
      timestamp: toFakeTimestamp(nowMs - (index * 1000)),
    })),
    contacts: [],
  };
};

const _getHostFocusFrameAuto = (sceneId = "") => {
  switch (sceneId) {
    case "karaoke_video_lyrics":
      return { left: "17%", top: "17%", width: "42%", height: "14%", label: "Search + cue song" };
    case "crowd_vote_burst":
      return { left: "35%", top: "50%", width: "28%", height: "13%", label: "Prompt reactions" };
    case "guitar_vibe_sync":
      return { left: "35%", top: "49%", width: "32%", height: "14%", label: "Launch guitar mode" };
    case "volley_vibe_sync":
      return { left: "24%", top: "49%", width: "34%", height: "14%", label: "Start volley relay" };
    case "trivia_break":
      return { left: "27%", top: "49%", width: "28%", height: "14%", label: "Launch trivia" };
    case "would_you_rather":
      return { left: "39%", top: "49%", width: "34%", height: "14%", label: "Launch Would You Rather" };
    default:
      return { left: "18%", top: "17%", width: "34%", height: "14%", label: "Host action" };
  }
};

const _getTvFocusFrameAuto = (sceneId = "") => {
  switch (sceneId) {
    case "guitar_vibe_sync":
      return { left: "18%", top: "16%", width: "62%", height: "50%", label: "Crowd jammers take over TV" };
    case "volley_vibe_sync":
      return { left: "18%", top: "18%", width: "62%", height: "46%", label: "Volley relay goes room-wide" };
    case "trivia_break":
      return { left: "69%", top: "12%", width: "27%", height: "42%", label: "Trivia tally" };
    case "would_you_rather":
      return { left: "69%", top: "16%", width: "27%", height: "36%", label: "Crowd split reveal" };
    case "crowd_vote_burst":
      return { left: "66%", top: "68%", width: "30%", height: "18%", label: "Reactions hit the room" };
    case "karaoke_video_lyrics":
    default:
      return { left: "10%", top: "57%", width: "58%", height: "16%", label: "Lyrics take over" };
  }
};

const getAudienceFocusFrameAuto = (sceneId = "", activeIndex = 0) => {
  if (sceneId === "karaoke_video_lyrics") {
    const mediaFrames = [
      { left: "10%", top: "58%", width: "38%", height: "10%" },
      { left: "52%", top: "58%", width: "38%", height: "10%" },
      { left: "10%", top: "72%", width: "38%", height: "10%" },
      { left: "52%", top: "72%", width: "38%", height: "10%" },
    ];
    return {
      ...(mediaFrames[activeIndex] || mediaFrames[0]),
      label: activeIndex === 0 ? "Video toggle" : activeIndex === 1 ? "Lyrics toggle" : "Crowd support",
    };
  }
  if (sceneId === "trivia_break") {
    const triviaFrames = [
      { left: "10%", top: "43%", width: "80%", height: "10%" },
      { left: "10%", top: "55%", width: "80%", height: "10%" },
      { left: "10%", top: "67%", width: "80%", height: "10%" },
      { left: "10%", top: "79%", width: "80%", height: "10%" },
    ];
    return { ...(triviaFrames[activeIndex] || triviaFrames[0]), label: "Vote on the phone" };
  }
  if (sceneId === "would_you_rather") {
    const wyrFrames = [
      { left: "10%", top: "57%", width: "80%", height: "12%" },
      { left: "10%", top: "73%", width: "80%", height: "12%" },
    ];
    return { ...(wyrFrames[activeIndex] || wyrFrames[0]), label: "Pick a side" };
  }
  if (sceneId === "guitar_vibe_sync" || sceneId === "volley_vibe_sync") {
    return {
      left: "18%",
      top: "60%",
      width: "64%",
      height: "14%",
      label: sceneId === "guitar_vibe_sync" ? "Hit the target lane" : "Tap the live relay action",
    };
  }
  const actionFrames = [
    { left: "13%", top: "56%", width: "32%", height: "16%" },
    { left: "55%", top: "56%", width: "32%", height: "16%" },
    { left: "13%", top: "74%", width: "32%", height: "16%" },
    { left: "55%", top: "74%", width: "32%", height: "16%" },
  ];
  return { ...(actionFrames[activeIndex] || actionFrames[0]), label: "Audience taps in" };
};

const getTapCoachAuto = (scene, activeIndex = 0) => {
  const currentAction = getActionDisplayLabel(scene?.audience?.actions?.[activeIndex] || scene?.audience?.actions?.[0] || "");
  switch (scene?.id) {
    case "karaoke_video_lyrics":
      return {
        title: "Open synced media",
        prompt: currentAction || "Video",
        detail: "Show the audience phone reading the same media moment as the TV.",
      };
    case "crowd_vote_burst":
      return {
        title: "Hit the room prompt",
        prompt: currentAction || "Fire",
        detail: "The audience should tap first, then see the TV mirror the burst.",
      };
    case "guitar_vibe_sync":
      return {
        title: "Hit the lane",
        prompt: currentAction || "Lane III",
        detail: "The phone becomes a rhythm surface and the TV rewards the strongest jammers.",
      };
    case "volley_vibe_sync":
      return {
        title: "Keep the relay alive",
        prompt: currentAction || "Save",
        detail: "Show the crowd sharing one live objective instead of isolated taps.",
      };
    case "trivia_break":
      return {
        title: "Vote now",
        prompt: currentAction || "All three",
        detail: "The audience answers on phone while the TV becomes the reveal board.",
      };
    default:
      return {
        title: "Pick your side",
        prompt: currentAction || "Glow stick chorus",
        detail: "Would You Rather should feel immediate, social, and easy to read on TV.",
      };
  }
};

const getSceneSequenceAuto = (scene, tapCoach) => {
  if (scene?.id === "karaoke_video_lyrics") {
    return [
      { surface: "host", title: "Cue video + lyrics", detail: "The host loads one YouTube-backed song and the room locks to it." },
      { surface: "tv", title: "TV shows synced lyrics", detail: "The public screen becomes the lyric anchor while media runs." },
      { surface: "audience", title: `Audience opens ${tapCoach.prompt}`, detail: "The phone can join the same media moment without drifting." },
    ];
  }
  return [
    { surface: "host", title: activeSceneSurfaceLabel(scene, "host"), detail: scene?.host?.actionCopy || "The host causes the shift first." },
    { surface: "audience", title: `${tapCoach.title}: ${tapCoach.prompt}`, detail: tapCoach.detail },
    { surface: "tv", title: activeSceneSurfaceLabel(scene, "tv"), detail: "The public screen makes the result visible to the whole room." },
  ];
};

const getSequenceIndexAuto = (sceneId = "", progress = 0) => {
  if (sceneId === "karaoke_video_lyrics") {
    if (progress < 0.34) return 0;
    if (progress < 0.67) return 1;
    return 2;
  }
  if (progress < 0.3) return 0;
  if (progress < 0.68) return 1;
  return 2;
};

const _getTapCoach = (scene, activeIndex = 0) => {
  const currentAction = getActionDisplayLabel(scene?.audience?.actions?.[activeIndex] || scene?.audience?.actions?.[0] || "");
  switch (scene?.id) {
    case "join_identity":
      return {
        title: "Pick an identity",
        prompt: currentAction || "Alex + crown",
        detail: "Show that joining feels instant before the music even starts.",
      };
    case "karaoke_launch":
      return {
        title: "Tap along",
        prompt: currentAction || "Clap",
        detail: "The prompt stays simple so viewers can track the crowd role immediately.",
      };
    case "crowd_hype":
      return {
        title: "Hit the room prompt",
        prompt: currentAction || "Fire",
        detail: "Use one obvious tap target and let the TV reflect the burst.",
      };
    case "guitar_vibe_sync":
      return {
        title: "Phones become instruments",
        prompt: currentAction || "Strum",
        detail: "The tap cue should feel playful and unmistakable.",
      };
    case "trivia_break":
      return {
        title: "Vote now",
        prompt: currentAction || "Public TV",
        detail: "Push a single answer target and show the live tally.",
      };
    case "auto_dj_handoff":
    default:
      return {
        title: "Keep the handoff alive",
        prompt: currentAction || "Clap through bridge",
        detail: "Encourage one lightweight action while the room bridges to the next singer.",
      };
  }
};

const _getSceneSequence = (scene, tapCoach) => {
  switch (scene?.id) {
    case "join_identity":
      return [
        { surface: "host", title: "Host opens the room", detail: "The live deck pushes the room code and entry path first." },
        { surface: "audience", title: "Guests claim identity", detail: "Name and emoji picks happen before any deeper UI appears." },
        { surface: "tv", title: "Public TV reflects arrivals", detail: "The room can see that people are landing in real time." },
      ];
    case "trivia_break":
      return [
        { surface: "host", title: "Host launches trivia", detail: "One clear host action starts the side round." },
        { surface: "audience", title: `Audience answers ${tapCoach.prompt}`, detail: "The phone prompt only appears while voting is the active thing." },
        { surface: "tv", title: "TV tallies the room", detail: "The public screen becomes the reveal and score surface." },
      ];
    default:
      return [
        { surface: "host", title: activeSceneSurfaceLabel(scene, "host"), detail: scene?.host?.actionCopy || "The host causes the shift first." },
        { surface: "tv", title: activeSceneSurfaceLabel(scene, "tv"), detail: "The public screen makes the change legible to the room." },
        { surface: "audience", title: `${tapCoach.title}: ${tapCoach.prompt}`, detail: tapCoach.detail },
      ];
  }
};

const activeSceneSurfaceLabel = (scene, surface) => {
  if (surface === "host") return scene?.host?.actionLabel || "Host action";
  if (surface === "tv") return scene?.tv?.mode || "TV reaction";
  return scene?.audience?.title || "Audience action";
};

const getAbstractBeatAnchorIndex = (beatId = "") => (
  ABSTRACT_SCROLL_EVENTS.findIndex((entry) => entry.beatId === beatId)
);

const _getSequenceIndex = (sceneId = "", progress = 0) => {
  if (sceneId === "trivia_break") {
    if (progress < 0.26) return 0;
    if (progress < 0.7) return 1;
    return 2;
  }
  if (progress < 0.34) return 0;
  if (progress < 0.66) return 1;
  return 2;
};

const DemoAudienceOverlay = ({ scene, activeActionIndex = 0 }) => {
  const actions = Array.isArray(scene?.audience?.actions) ? scene.audience.actions : [];
  const buttonCount = Math.max(2, Math.min(4, actions.length || 4));
  return (
    <>
      <div className="mk3-demo-phone-appbar is-overlay">
        <div>
          <span>Audience live moment</span>
          <strong>{scene?.audience?.title || "Audience action"}</strong>
        </div>
        <div>
          <span>{scene?.audience?.metricLabel || "live"}</span>
          <strong>{scene?.audience?.metricValue || "active"}</strong>
        </div>
      </div>
      <div
        className="mk3-demo-mini-actions is-overlay"
        style={{ gridTemplateColumns: `repeat(${buttonCount}, minmax(0, 1fr))` }}
      >
        {actions.map((action, index) => (
          <button key={`${scene?.id || "scene"}_${action}`} type="button" tabIndex={-1} className={index === activeActionIndex ? "active" : ""}>
            {action}
          </button>
        ))}
      </div>
      <div className="mk3-demo-audience-banner is-overlay">
        <span>{scene?.label || "Live room moment"}</span>
        <strong>{scene?.audience?.subtitle || "Phones and TV should feel coordinated."}</strong>
        <p>{scene?.audience?.feed?.[activeActionIndex] || scene?.audience?.feed?.[0] || "Audience taps are driving the room."}</p>
      </div>
    </>
  );
};

const DemoTvOverlay = ({ scene, reactionItems = [], triviaRows = [] }) => {
  const overlayRows = triviaRows.length ? triviaRows : reactionItems;
  const showLyrics = scene?.id === "karaoke_video_lyrics";
  const showScoreboard = ["crowd_vote_burst", "guitar_vibe_sync", "volley_vibe_sync", "trivia_break", "would_you_rather"].includes(scene?.id);
  return (
    <>
      <div className="mk3-demo-tv-singer-card is-overlay">
        <span>{showLyrics ? "Now playing" : scene?.tv?.mode || "Public TV"}</span>
        <strong>{showLyrics ? "Jordan | Room Anthem Demo" : scene?.tv?.title || "Live room payoff"}</strong>
      </div>
      {showLyrics ? (
        <div className="mk3-demo-real-shot-callout is-tv-lyrics">
          <strong>TV lyrics + video stay in the same moment</strong>
          <p>The screen should feel like one coordinated karaoke beat, not a separate media layer bolted on afterward.</p>
        </div>
      ) : null}
      {showScoreboard ? (
        <div
          className="mk3-demo-reaction-rail is-overlay"
          style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.min(4, overlayRows.length || 4))}, minmax(0, 1fr))` }}
        >
          {overlayRows.map((item) => (
            <div key={`${scene?.id || "scene"}_${item.label}`} className="mk3-demo-reaction-item">
              <span>{scene?.id === "guitar_vibe_sync" ? "🎸" : scene?.id === "volley_vibe_sync" ? "✨" : scene?.id === "would_you_rather" ? "🗳" : "👏"}</span>
              <small>{item.label}</small>
              <small>{item.value ?? item.count}</small>
            </div>
          ))}
        </div>
      ) : null}
      {scene?.id === "trivia_break" ? (
        <div className="mk3-demo-real-shot-callout is-tv-trivia">
          <strong>Trivia answers are landing live</strong>
          <p>The same answer buttons on the phone should read as a shared tally on the Public TV.</p>
        </div>
      ) : null}
      {scene?.id === "would_you_rather" ? (
        <div className="mk3-demo-audience-banner is-overlay" style={{ left: "18px", right: "18px", bottom: "88px", zIndex: 3 }}>
          <span>Would You Rather</span>
          <strong>The room split should be obvious at a glance.</strong>
          <p>Two options, one shared result, and enough contrast for the whole room to react together.</p>
        </div>
      ) : null}
    </>
  );
};

const GuidedAudiencePhone = ({
  scene,
  audienceDemoUrl,
  audienceFrameRef,
  onFrameLoad,
  activeActionIndex = 0,
  showFocus = false,
  focusFrame = null,
  focusLabel = "",
  showNotes = true,
}) => {
  const sceneCallouts = Array.isArray(scene?.callouts) ? scene.callouts.slice(0, 3) : [];

  return (
    <div className="mk3-demo-guided-audience-stack">
      <div className="mk3-demo-phone-shell">
        <div className="mk3-demo-phone-notch" />
        <div className="mk3-demo-phone-screen mk3-demo-phone-screen-guided">
          <iframe
            ref={audienceFrameRef}
            title="BeauRocks Audience Demo"
            src={audienceDemoUrl}
            className="mk3-demo-iframe mk3-demo-native-surface"
            loading="eager"
            onLoad={() => onFrameLoad("audience")}
          />
          <DemoAudienceOverlay scene={scene} activeActionIndex={activeActionIndex} />
          {showFocus && focusFrame ? (
            <div className="mk3-demo-focus-ring is-phone-target" style={focusFrame}>
              <span>{focusLabel}</span>
            </div>
          ) : null}
        </div>
      </div>

      {showNotes ? (
        <div className="mk3-demo-guided-audience-notes">
          <span>Audience scene callouts</span>
          <ul>
            {sceneCallouts.map((callout) => (
              <li key={`${scene?.id || "scene"}_${callout.title}`}>
                <strong>{callout.title}</strong>
                <p>{callout.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

const DemoExperiencePage = ({ navigate, demoMode = "abstract" }) => {
  const isAutoPage = String(demoMode || "").trim().toLowerCase() === "auto";
  const [timelineMs, setTimelineMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [abstractAutoPlay, setAbstractAutoPlay] = useState(false);
  const [isAutoDemoMobile, setIsAutoDemoMobile] = useState(false);
  const [activeMobileSurface, setActiveMobileSurface] = useState("tv");
  const [followMobileSurfaceFocus, setFollowMobileSurfaceFocus] = useState(true);
  const [activeAbstractEventId, setActiveAbstractEventId] = useState(ABSTRACT_SCROLL_EVENTS[0]?.id || "");
  const [activeAutoSceneId, setActiveAutoSceneId] = useState(WALKTHROUGH_TIMELINE[0]?.id || "");
  const [autoSceneScrollProgress, setAutoSceneScrollProgress] = useState(0);
  const abstractBeatRefs = useRef([]);
  const autoSceneRefs = useRef([]);
  const hostFrameRef = useRef(null);
  const tvFrameRef = useRef(null);
  const audienceFrameRef = useRef(null);
  const autoStageRef = useRef(null);

  const hostDemoUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildSurfaceUrl({
      surface: "host",
      params: {
        mode: "host",
        room: DEMO_ROOM_CODE,
        mkDemoEmbed: "1",
      },
    }, window.location);
  }, []);
  const tvDemoUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildSurfaceUrl({
      surface: "tv",
      params: {
        mode: "tv",
        room: DEMO_ROOM_CODE,
        mkDemoEmbed: "1",
      },
    }, window.location);
  }, []);
  const audienceDemoUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildSurfaceUrl({
      surface: "app",
      params: {
        room: DEMO_ROOM_CODE,
        mkDemoEmbed: "1",
      },
    }, window.location);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setIsAutoDemoMobile(media.matches);
    };
    update();
    if (typeof media.addEventListener === "function") media.addEventListener("change", update);
    else if (typeof media.addListener === "function") media.addListener(update);
    return () => {
      if (typeof media.removeEventListener === "function") media.removeEventListener("change", update);
      else if (typeof media.removeListener === "function") media.removeListener(update);
    };
  }, []);

  useEffect(() => {
    if (!isAutoPage) return () => {};
    if (!playing) return () => {};
    let lastMs = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, now - lastMs);
      lastMs = now;
      setTimelineMs((prev) => {
        const next = prev + delta;
        if (next < WALKTHROUGH_TOTAL_MS) return next;
        return next % WALKTHROUGH_TOTAL_MS;
      });
    }, 140);
    return () => window.clearInterval(timer);
  }, [isAutoPage, playing]);

  useEffect(() => {
    if (isAutoPage) return undefined;
    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") return undefined;
    const nodes = abstractBeatRefs.current.filter(Boolean);
    if (!nodes.length) return undefined;
    let frameId = 0;
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
      if (!visible.length) return;
      const nextEventId = String(visible[0].target.dataset.storyEvent || "").trim();
      if (!nextEventId) return;
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setActiveAbstractEventId((prev) => (prev === nextEventId ? prev : nextEventId));
      });
    }, {
      threshold: [0.32, 0.6],
      rootMargin: "-18% 0px -18% 0px",
    });
    nodes.forEach((node) => observer.observe(node));
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [isAutoPage]);

  useEffect(() => {
    if (!isAutoPage) return undefined;
    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") return undefined;
    const nodes = autoSceneRefs.current.filter(Boolean);
    if (!nodes.length) return undefined;
    let frameId = 0;
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
      if (!visible.length) return;
      const nextSceneId = String(visible[0].target.dataset.autoScene || "").trim();
      if (!nextSceneId) return;
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setActiveAutoSceneId((prev) => (prev === nextSceneId ? prev : nextSceneId));
      });
    }, {
      threshold: [0.35, 0.6],
      rootMargin: "-20% 0px -20% 0px",
    });
    nodes.forEach((node) => observer.observe(node));
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [isAutoPage]);

  useEffect(() => {
    if (!isAutoPage || typeof window === "undefined") return undefined;
    let frameId = 0;
    const update = () => {
      const sceneId = playing
        ? (getSceneAtMs(timelineMs).scene?.id || activeAutoSceneId)
        : activeAutoSceneId;
      const sceneIndex = WALKTHROUGH_TIMELINE.findIndex((entry) => entry.id === sceneId);
      const node = autoSceneRefs.current[sceneIndex];
      if (!node) {
        setAutoSceneScrollProgress(0);
        return;
      }
      const rect = node.getBoundingClientRect();
      const viewportHeight = Math.max(1, window.innerHeight || 1);
      const anchor = viewportHeight * 0.42;
      const travel = Math.max(1, rect.height - viewportHeight * 0.18);
      const progress = clampNumber((anchor - rect.top) / travel, 0, 1, 0);
      setAutoSceneScrollProgress((prev) => (Math.abs(prev - progress) < 0.01 ? prev : progress));
    };
    const onScroll = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [activeAutoSceneId, isAutoPage, playing, timelineMs]);

  useEffect(() => {
    if (isAutoPage || !abstractAutoPlay) return undefined;
    const nodes = abstractBeatRefs.current.filter(Boolean);
    if (!nodes.length) return undefined;
    const timer = window.setInterval(() => {
      const currentIndex = ABSTRACT_SCROLL_EVENTS.findIndex((entry) => entry.id === activeAbstractEventId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % nodes.length : 0;
      nodes[nextIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
      trackEvent("mk_demo_abstract_autoplay_step", {
        eventId: ABSTRACT_SCROLL_EVENTS[nextIndex]?.id || "",
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [abstractAutoPlay, activeAbstractEventId, isAutoPage]);

  const autoplaySceneState = useMemo(() => getSceneAtMs(timelineMs), [timelineMs]);
  const scrollDrivenSceneState = useMemo(() => {
    const activeScrollScene = WALKTHROUGH_TIMELINE.find((entry) => entry.id === activeAutoSceneId)
      || WALKTHROUGH_TIMELINE[0];
    const scrollMs = activeScrollScene.startMs + (activeScrollScene.durationMs * autoSceneScrollProgress);
    return getSceneAtMs(scrollMs);
  }, [activeAutoSceneId, autoSceneScrollProgress]);
  const sceneState = isAutoPage
    ? (playing ? autoplaySceneState : scrollDrivenSceneState)
    : autoplaySceneState;
  const activeScene = sceneState.scene;
  const sceneProgress = sceneState.progress;
  const activeAbstractEvent = useMemo(
    () => ABSTRACT_SCROLL_EVENTS.find((entry) => entry.id === activeAbstractEventId) || ABSTRACT_SCROLL_EVENTS[0],
    [activeAbstractEventId]
  );
  const activeBeat = useMemo(
    () => ABSTRACT_BEATS.find((beat) => beat.id === activeAbstractEvent?.beatId) || ABSTRACT_BEATS[0],
    [activeAbstractEvent]
  );
  const activeAbstractMomentIndex = activeAbstractEvent?.momentIndex || 0;
  const activeAbstractBeatIndex = activeAbstractEvent?.beatIndex || 0;
  const isArrivalIntroBeat = activeBeat.id === "arrival";
  const activeArrivalSurface = ["host", "tv", "audience", "singer"][activeAbstractMomentIndex] || "host";
  const visibleArrivalSurfaceCount = clampNumber(activeAbstractMomentIndex + 1, 1, 4, 1);
  const arrivalSurfaceFeatureLead = (() => {
    const firstFeature = (ABSTRACT_INTRO_SURFACE_FEATURES[activeArrivalSurface] || [])[0];
    if (!firstFeature) return "";
    if (typeof firstFeature === "string") return firstFeature;
    return firstFeature.title || "";
  })();
  const stageCalloutKicker = isArrivalIntroBeat
    ? activeAbstractEvent?.kicker || activeBeat.kicker
    : activeBeat.kicker;
  const stageCalloutBody = isArrivalIntroBeat
    ? activeAbstractEvent?.title || activeBeat.title
    : activeBeat.title;
  const visibleSignals = isArrivalIntroBeat ? [] : activeBeat.signals;
  const hostFeatureList = isArrivalIntroBeat
    ? ABSTRACT_INTRO_SURFACE_FEATURES.host.map((item) => item.title).slice(0, 2)
    : [activeBeat.signals[0]?.label, activeBeat.bullets[0]].filter(Boolean);
  const tvFeatureList = isArrivalIntroBeat
    ? ABSTRACT_INTRO_SURFACE_FEATURES.tv.slice(0, 2)
    : activeBeat.signals.map((signal) => signal.label).slice(0, 2);
  const audienceFeatureList = isArrivalIntroBeat
    ? ABSTRACT_INTRO_SURFACE_FEATURES.audience.slice(0, 2)
    : activeBeat.bullets.slice(0, 2);
  const singerFeatureList = isArrivalIntroBeat
    ? ABSTRACT_INTRO_SURFACE_FEATURES.singer.slice(0, 2)
    : ["Lead clearly", "Clean handoff"];
  const activeSignalFocusIndex = clampNumber(activeAbstractMomentIndex, 0, Math.max(0, visibleSignals.length - 1), 0);
  const stageCalloutHighlights = isArrivalIntroBeat
    ? [ABSTRACT_SURFACES[activeArrivalSurface]?.label, arrivalSurfaceFeatureLead].filter(Boolean)
    : [activeBeat.signals[activeSignalFocusIndex]?.label, ...activeBeat.bullets.slice(0, 2)].filter(Boolean).slice(0, 3);
  const interactionCards = visibleSignals.map((signal, index) => ({
    ...signal,
    isActive: index === activeSignalFocusIndex,
  }));
  const getStorySurfaceClasses = (surface = "") => {
    const classes = [];
    if (isArrivalIntroBeat) {
      const orderIndex = ["host", "tv", "audience", "singer"].indexOf(surface);
      if (orderIndex >= 0 && orderIndex < visibleArrivalSurfaceCount) classes.push("is-revealed");
      else classes.push("is-hidden");
      if (surface === activeArrivalSurface) classes.push("is-spotlight");
      else if (orderIndex >= 0 && orderIndex < visibleArrivalSurfaceCount) classes.push("is-resting");
    } else if (surface === activeBeat.activeSurface) {
      classes.push("is-spotlight");
    }
    return classes.length ? ` ${classes.join(" ")}` : "";
  };
  const activeActionIndex = useMemo(
    () => getActiveIndex(activeScene.audience.actions, sceneProgress + 0.12),
    [activeScene.audience.actions, sceneProgress]
  );
  const hostTypedSearch = useMemo(
    () => getTypedText(activeScene.host.search, sceneProgress),
    [activeScene.host.search, sceneProgress]
  );
  const scenePercent = Math.round(sceneProgress * 100);
  const currentSceneIndex = useMemo(
    () => WALKTHROUGH_TIMELINE.findIndex((entry) => entry.id === activeScene.id),
    [activeScene.id]
  );
  const previousScene = useMemo(() => {
    if (currentSceneIndex <= 0) return null;
    return WALKTHROUGH_TIMELINE[currentSceneIndex - 1];
  }, [currentSceneIndex]);
  const nextScene = useMemo(() => {
    const index = WALKTHROUGH_TIMELINE.findIndex((entry) => entry.id === activeScene.id);
    if (index < 0 || index >= WALKTHROUGH_TIMELINE.length - 1) return null;
    return WALKTHROUGH_TIMELINE[index + 1];
  }, [activeScene.id]);
  const tvSurfaceVariant = useMemo(() => getTvSurfaceVariantAuto(activeScene.id), [activeScene.id]);
  const reactionItems = useMemo(
    () => getReactionItemsAuto(activeScene, sceneProgress),
    [activeScene, sceneProgress]
  );
  const triviaRows = useMemo(
    () => getTriviaRowsAuto(activeScene, sceneProgress),
    [activeScene, sceneProgress]
  );
  const audienceFocusFrame = useMemo(
    () => getAudienceFocusFrameAuto(activeScene.id, activeActionIndex),
    [activeActionIndex, activeScene.id]
  );
  const tapCoach = useMemo(
    () => getTapCoachAuto(activeScene, activeActionIndex),
    [activeActionIndex, activeScene]
  );
  const sceneSequence = useMemo(
    () => getSceneSequenceAuto(activeScene, tapCoach),
    [activeScene, tapCoach]
  );
  const activeSequenceIndex = useMemo(
    () => getSequenceIndexAuto(activeScene.id, sceneProgress),
    [activeScene.id, sceneProgress]
  );
  const activeSequenceStep = sceneSequence[activeSequenceIndex] || sceneSequence[0];
  const activeSequenceSurfaceLabel = activeSequenceStep?.surface === "tv"
    ? "Public TV"
    : activeSequenceStep?.surface === "host"
      ? "Host Deck"
      : activeSequenceStep?.surface === "audience"
        ? "Audience App"
        : "Live Surface";
  const autoHeroSummary = useMemo(
    () => activeScene.summary || activeScene.headline || "Three real surfaces autoplay through one room moment at a time.",
    [activeScene.headline, activeScene.summary]
  );
  const activeSceneWatchFor = useMemo(
    () => activeScene.callouts?.[0]?.detail || activeSequenceStep?.detail || "",
    [activeScene.callouts, activeSequenceStep?.detail]
  );
  const activeSceneProofLabel = useMemo(
    () => activeSequenceStep?.surface === "audience"
      ? tapCoach.prompt
      : activeSequenceStep?.title || activeScene.label,
    [activeScene.label, activeSequenceStep?.surface, activeSequenceStep?.title, tapCoach.prompt]
  );
  const activeSceneProofNote = useMemo(() => {
    if (activeSceneWatchFor && activeSceneWatchFor !== activeSceneProofLabel) return activeSceneWatchFor;
    return activeScene.tv?.title || activeScene.summary || "";
  }, [activeScene.summary, activeScene.tv?.title, activeSceneProofLabel, activeSceneWatchFor]);
  const abstractBeatSummary = useMemo(
    () => activeBeat.body || activeAbstractEvent?.detail || "One host move should cause a visible room-wide consequence.",
    [activeAbstractEvent?.detail, activeBeat.body]
  );
  const abstractBeatProof = useMemo(
    () => activeBeat.bullets?.[0] || activeBeat.signals?.[0]?.label || "The room reacts as one system.",
    [activeBeat.bullets, activeBeat.signals]
  );

  const resolvedActiveMobileSurface = isAutoPage && isAutoDemoMobile && followMobileSurfaceFocus
    ? activeSequenceStep?.surface || "tv"
    : activeMobileSurface;

  useEffect(() => {
    if (!isAutoPage || !playing) return undefined;
    const sceneIndex = WALKTHROUGH_TIMELINE.findIndex((entry) => entry.id === activeScene.id);
    const node = autoSceneRefs.current[sceneIndex];
    if (!node) return undefined;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    return undefined;
  }, [activeScene.id, isAutoPage, playing]);
  const audienceFixture = useMemo(
    () => buildAudienceFixtureAuto({
      scene: activeScene,
      nextScene,
      sceneProgress,
      activeActionIndex,
      hostTypedSearch,
    }),
    [activeActionIndex, activeScene, hostTypedSearch, nextScene, sceneProgress]
  );
  const tvFixture = useMemo(
    () => buildTvFixtureAuto({
      scene: activeScene,
      nextScene,
      sceneProgress,
      reactionItems,
      triviaRows,
    }),
    [activeScene, nextScene, reactionItems, sceneProgress, triviaRows]
  );
  const hostFixture = useMemo(
    () => buildHostFixtureAuto({
      scene: activeScene,
      nextScene,
      sceneProgress,
      reactionItems,
    }),
    [activeScene, nextScene, reactionItems, sceneProgress]
  );

  useEffect(() => {
    if (!isAutoPage) return undefined;
    const postFixture = (frameRef, surface, fixture) => {
      try {
        frameRef?.current?.contentWindow?.postMessage({
          type: "beaurocks-demo-fixture",
          surface,
          fixture,
        }, "*");
      } catch (_) {
        // Ignore cross-window race conditions while iframes initialize.
      }
    };
    postFixture(hostFrameRef, "host", hostFixture);
    postFixture(tvFrameRef, "tv", tvFixture);
    postFixture(audienceFrameRef, "audience", audienceFixture);
    return undefined;
  }, [audienceFixture, hostFixture, isAutoPage, tvFixture]);

  useEffect(() => {
    if (!isAutoPage) return undefined;
    trackEvent("mk_demo_scene_view", {
      scene: activeScene.id,
      label: activeScene.label,
    });
    return undefined;
  }, [activeScene.id, activeScene.label, isAutoPage]);

  const jumpToScene = (sceneId = "", options = {}) => {
    const nextSceneTarget = WALKTHROUGH_TIMELINE.find((scene) => scene.id === sceneId);
    if (!nextSceneTarget) return;
    if (options?.scrollTrack === true) {
      const sceneIndex = WALKTHROUGH_TIMELINE.findIndex((scene) => scene.id === sceneId);
      autoSceneRefs.current[sceneIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (options?.snapStage === true) {
      autoStageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setActiveAutoSceneId(nextSceneTarget.id);
    setAutoSceneScrollProgress(0);
    setTimelineMs(nextSceneTarget.startMs);
    trackEvent("mk_demo_scene_jump", { scene: nextSceneTarget.id });
  };
  const jumpToAbstractBeat = (beatId = "") => {
    const beatAnchorIndex = getAbstractBeatAnchorIndex(beatId);
    if (beatAnchorIndex < 0) return;
    abstractBeatRefs.current[beatAnchorIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    trackEvent("mk_demo_abstract_jump", { beatId });
  };
  const handleDemoFrameLoad = (surface = "") => {
    try {
      if (surface === "host") {
        hostFrameRef.current?.contentWindow?.postMessage({ type: "beaurocks-demo-fixture", surface: "host", fixture: hostFixture }, "*");
      } else if (surface === "tv") {
        tvFrameRef.current?.contentWindow?.postMessage({ type: "beaurocks-demo-fixture", surface: "tv", fixture: tvFixture }, "*");
      } else if (surface === "audience") {
        audienceFrameRef.current?.contentWindow?.postMessage({ type: "beaurocks-demo-fixture", surface: "audience", fixture: audienceFixture }, "*");
      }
    } catch (_) {
      // Ignore iframe initialization races.
    }
  };

  const totalSceneElapsedMs = Math.max(0, Math.round((activeScene?.startMs || 0) + (sceneState?.sceneMs || 0)));

  return (
    <section className={`mk3-page mk3-demo-page mk3-demo-sales-page${isAutoPage ? " is-auto" : " is-abstract"}`}>
      <article className="mk3-demo-sales-hero">
          <div className="mk3-demo-sales-hero-copy">
            <div className="mk3-chip">{isAutoPage ? "demo" : "how it works"}</div>
            <h1>{isAutoPage ? "See BeauRocks in action." : "Understand how the room stays in sync."}</h1>
            <p>
              {isAutoPage
                ? "A product-faithful walkthrough across the real host, TV, and audience surfaces."
                : "A conceptual system tour that explains the room model without pretending to be the literal product UI."}
            </p>
          </div>
        <div className="mk3-demo-sales-hero-status">
          {isAutoPage ? (
            <>
              <div className="mk3-demo-sales-hero-stat">
                <span>Current scene</span>
                <strong>{activeScene.label}</strong>
                <p>{activeScene.headline}</p>
              </div>
              <div className="mk3-demo-sales-hero-stat">
                <span>Surface in focus</span>
                <strong>{activeSequenceSurfaceLabel}</strong>
                <p>{activeSequenceStep.surface === "audience" ? tapCoach.prompt : activeSequenceStep.title}</p>
              </div>
            </>
          ) : (
            <>
              <div className="mk3-demo-sales-hero-stat">
                <span>Concept chapter</span>
                <strong>{activeBeat.title}</strong>
                <p>{activeBeat.kicker}</p>
              </div>
              <div className="mk3-demo-sales-hero-stat">
                <span>Why it matters</span>
                <strong>{abstractBeatProof}</strong>
                <p>{abstractBeatSummary}</p>
              </div>
            </>
          )}
          <div className="mk3-demo-sales-hero-pills">
            <span>{isAutoPage ? "Real room surfaces" : "Conceptual system tour"}</span>
            <span>{isAutoPage ? "Product-faithful walkthrough" : "Not the literal UI"}</span>
          </div>
          {typeof navigate === "function" && (
            <button type="button" onClick={() => navigate(isAutoPage ? "demo" : "auto-demo")}>
              {isAutoPage ? "Open How It Works" : "Open Demo"}
            </button>
          )}
        </div>
      </article>

      {!isAutoPage ? (
        <article className="mk3-demo-concept-rail">
          <div className="mk3-demo-concept-rail-head">
            <div>
              <span>How it works chapters</span>
              <strong>Conceptual system tour</strong>
            </div>
            <p>Each chapter isolates one room promise before the page drops into the animated system map. This page explains the model; it is not the literal product interface.</p>
          </div>
          <div className="mk3-demo-concept-grid">
            {ABSTRACT_BEATS.map((beat) => (
              <button
                key={beat.id}
                type="button"
                className={activeBeat.id === beat.id ? "is-active" : ""}
                onClick={() => jumpToAbstractBeat(beat.id)}
              >
                <span>{beat.kicker}</span>
                <strong>{beat.title}</strong>
                <p>{beat.bullets?.[0] || beat.body}</p>
              </button>
            ))}
          </div>
        </article>
      ) : (
        <article className="mk3-demo-chapter-strip">
          <div className="mk3-demo-chapter-strip-head">
            <div>
              <span>Proof chapters</span>
              <strong>Open a chapter directly or play the full sequence</strong>
            </div>
            <p>The page should read like a guided proof, not three independent app previews competing for attention.</p>
          </div>
          <div className="mk3-demo-chapter-strip-grid">
            {WALKTHROUGH_TIMELINE.map((scene) => (
              <button
                key={scene.id}
                type="button"
                className={activeScene.id === scene.id ? "is-active" : ""}
                onClick={() => {
                  setPlaying(false);
                  jumpToScene(scene.id);
                }}
              >
                <span>{scene.kicker}</span>
                <strong>{scene.label}</strong>
                <p>{scene.callouts?.[0]?.detail || scene.summary}</p>
              </button>
            ))}
          </div>
        </article>
      )}

      {!isAutoPage && (
      <article className="mk3-demo-story mk3-demo-story-immersive">
        <div className="mk3-demo-guided-toolbar mk3-demo-abstract-toolbar">
          <div className="mk3-demo-guided-toolbar-main">
            <button type="button" className={abstractAutoPlay ? "active" : ""} onClick={() => setAbstractAutoPlay((prev) => !prev)}>
              {abstractAutoPlay ? "Pause Auto-play" : "Auto-play Scroll"}
            </button>
            <button
              type="button"
              onClick={() => {
                abstractBeatRefs.current[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
                trackEvent("mk_demo_abstract_restart", { source: "toolbar" });
              }}
            >
              Restart
            </button>
          </div>
          <div className="mk3-demo-guided-toolbar-meta">
            <span>{`Chapter ${Math.max(1, activeAbstractBeatIndex + 1)} of ${ABSTRACT_BEATS.length}`}</span>
            <strong>{abstractBeatProof}</strong>
          </div>
        </div>
        <div className="mk3-demo-story-stage mk3-demo-story-stage-full">
            <div className={`mk3-demo-story-stage-frame is-${activeBeat.stageVariant} is-moment-${activeAbstractMomentIndex + 1}${isArrivalIntroBeat ? " is-arrival-intro" : ""}`}>
              <div className="mk3-demo-story-glow mk3-demo-story-glow-one" />
              <div className="mk3-demo-story-glow mk3-demo-story-glow-two" />
              <div className={`mk3-demo-story-sweep is-${activeBeat.mood || "cyan"}`} />
              <div className="mk3-demo-story-orbit mk3-demo-story-orbit-one" />
              <div className="mk3-demo-story-orbit mk3-demo-story-orbit-two" />
              <div className="mk3-demo-story-stage-header">
                <div>
                  <span>Conceptual system map</span>
                  <strong>{activeBeat.title}</strong>
                </div>
                <div className="mk3-demo-story-stage-meta">
                  <span>Scene</span>
                  <strong>{activeAbstractBeatIndex + 1} of {ABSTRACT_BEATS.length}</strong>
                </div>
              </div>
              <div className="mk3-demo-story-stage-callout">
                <span>{stageCalloutKicker}</span>
                <strong>{stageCalloutBody}</strong>
                <div className="mk3-demo-story-stage-callout-chips" aria-hidden="true">
                  {stageCalloutHighlights.map((item) => (
                    <b key={`${activeBeat.id}_${item}`}>{item}</b>
                  ))}
                </div>
              </div>
              <div className={`mk3-demo-story-signal-layer${visibleSignals.length ? "" : " is-suppressed"}`} aria-hidden="true">
                {visibleSignals.map((signal) => (
                  <div
                    key={`${activeBeat.id}_${signal.from}_${signal.to}_${signal.label}`}
                    className={`mk3-demo-story-signal mk3-demo-story-signal-${signal.from}-${signal.to} is-active`}
                  >
                    <i />
                    <span>{signal.label}</span>
                  </div>
                ))}
              </div>
              <div className="mk3-demo-story-scene-progress">
                {ABSTRACT_BEATS.map((beat) => (
                  <b key={beat.id} className={activeBeat.id === beat.id ? "is-active" : ""} />
                ))}
              </div>

              <article className={`mk3-demo-story-screen mk3-demo-story-screen-host${activeBeat.signals.some((signal) => signal.from === "host" || signal.to === "host") ? " is-source is-target" : ""}${getStorySurfaceClasses("host")}`}>
                <span>Host Deck</span>
                <strong>{activeBeat.notes.host}</strong>
                <div className="mk3-demo-story-role-panel">
                  <span>{isArrivalIntroBeat ? "Lead move" : "Origin move"}</span>
                  <strong>{isArrivalIntroBeat ? "Drive the first room change" : activeBeat.signals[0]?.label || "Room cue"}</strong>
                </div>
                <div className="mk3-demo-story-chip-row">
                  {hostFeatureList.map((item) => (
                    <b key={`${activeBeat.id}_host_${item}`}>{item}</b>
                  ))}
                </div>
              </article>

              <article className={`mk3-demo-story-screen mk3-demo-story-screen-tv${activeBeat.signals.some((signal) => signal.from === "tv" || signal.to === "tv") ? " is-source is-target" : ""}${getStorySurfaceClasses("tv")}`}>
                <div className="mk3-demo-story-tv-stage">
                  <div className="mk3-demo-story-tv-badge">
                    <span>Public TV</span>
                    <strong>{isArrivalIntroBeat ? "Shared room state" : activeBeat.kicker}</strong>
                  </div>
                  <div className="mk3-demo-story-tv-headline">
                    <strong>{activeBeat.notes.tv}</strong>
                  </div>
                  <div className="mk3-demo-story-tv-lyrics">
                    {tvFeatureList.map((item) => (
                      <p key={`${activeBeat.id}_tv_${item}`} className="is-active">
                        {item}
                      </p>
                    ))}
                  </div>
                  <div className="mk3-demo-story-tv-meter">
                    <span>{isArrivalIntroBeat ? "Wall-sized context" : "Shared room state"}</span>
                    <i style={{ width: `${46 + activeAbstractBeatIndex * 11}%` }} />
                  </div>
                  <div className="mk3-demo-story-tv-burst" aria-hidden="true">
                    {(isArrivalIntroBeat ? ABSTRACT_INTRO_SURFACE_FEATURES.tv : activeBeat.signals).map((item) => (
                      <span key={`${activeBeat.id}_burst_${typeof item === "string" ? item : item.label}`} className="is-active" />
                    ))}
                  </div>
                </div>
              </article>

              <article className={`mk3-demo-story-screen mk3-demo-story-screen-phone${activeBeat.signals.some((signal) => signal.from === "audience" || signal.to === "audience") ? " is-source is-target" : ""}${getStorySurfaceClasses("audience")}`}>
                <span>Audience App</span>
                <strong>{activeBeat.notes.audience}</strong>
                <div className="mk3-demo-story-phone-votes mk3-demo-story-phone-votes-simple" aria-hidden="true">
                  {audienceFeatureList.map((item, index) => (
                    <button key={`${activeBeat.id}_${item}`} type="button" tabIndex={-1} className={index === activeSignalFocusIndex % Math.max(1, audienceFeatureList.length) ? "is-active" : ""}>{item}</button>
                  ))}
                </div>
                <div className="mk3-demo-story-phone-request">
                  <span>{isArrivalIntroBeat ? "Primary tap" : "Audience effect"}</span>
                  <strong>{isArrivalIntroBeat ? "Join + react" : activeBeat.signals.find((signal) => signal.from === "audience" || signal.to === "audience")?.label || "Shared response"}</strong>
                </div>
                <div className="mk3-demo-story-chip-row is-phone">
                  {audienceFeatureList.map((item) => (
                    <b key={`${activeBeat.id}_audience_chip_${item}`}>{item}</b>
                  ))}
                </div>
                <div className={`mk3-demo-story-phone-touch is-beacon${isArrivalIntroBeat ? " is-guided" : ""}`} aria-hidden="true">
                  <i />
                  <span>{isArrivalIntroBeat ? "guiding the first taps" : "audience interaction pulse"}</span>
                </div>
              </article>

              <article className={`mk3-demo-story-screen mk3-demo-story-screen-singer${activeBeat.signals.some((signal) => signal.from === "singer" || signal.to === "singer") ? " is-source is-target" : ""}${getStorySurfaceClasses("singer")}`}>
                <span>Singer Cue</span>
                <strong>{activeBeat.notes.singer}</strong>
                <div className="mk3-demo-story-singer-meter">
                  <span>{isArrivalIntroBeat ? "Performer ready" : "Confidence"}</span>
                  <i style={{ width: `${42 + activeAbstractBeatIndex * 11}%` }} />
                </div>
                <div className="mk3-demo-story-singer-points">
                  {singerFeatureList.map((item) => (
                    <b key={`${activeBeat.id}_${item}`}>{item}</b>
                  ))}
                </div>
              </article>

              {!isArrivalIntroBeat && activeBeat.id !== "handoff" && (
                <div className="mk3-demo-story-interaction-strip" aria-hidden="true">
                  {interactionCards.map((signal) => (
                    <article key={`${signal.from}_${signal.to}_${signal.label}`} className={signal.isActive ? "is-active" : ""}>
                      <span>{`${ABSTRACT_SURFACES[signal.from]?.short || signal.from} -> ${ABSTRACT_SURFACES[signal.to]?.short || signal.to}`}</span>
                      <strong>{signal.label}</strong>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        <div className="mk3-demo-story-beat-track">
          {ABSTRACT_SCROLL_EVENTS.map((event, eventIndex) => (
            <section
              key={event.id}
              ref={(node) => {
                abstractBeatRefs.current[eventIndex] = node;
              }}
              data-story-event={event.id}
              className={`mk3-demo-story-beat-trigger${activeAbstractEvent?.id === event.id ? " is-active" : ""}`}
              style={{ minHeight: "42vh" }}
            >
              <div className="mk3-demo-story-beat-anchor">
                <span>{event.kicker}</span>
                <strong>{event.title}</strong>
                <small className="mk3-demo-story-beat-meta">
                  {`Scene ${event.beatIndex + 1} / Step ${event.momentIndex + 1} of ${(ABSTRACT_MOMENTS[event.beatId] || []).length}`}
                </small>
              </div>
            </section>
          ))}
        </div>
      </article>
      )}

      {isAutoPage && (
      <article className="mk3-demo-guided">
        <div className="mk3-demo-guided-scroll">
          <div className="mk3-demo-guided-scroll-stage">
            <div ref={autoStageRef} />
            <div className="mk3-demo-guided-scene-lead">
              <div className="mk3-demo-guided-scene-copy">
                <div className="mk3-demo-guided-scene-eyebrow">
                  <span>{activeScene.kicker}</span>
                  <b>{`Scene ${String(Math.max(1, currentSceneIndex + 1)).padStart(2, "0")} / ${String(WALKTHROUGH_TIMELINE.length).padStart(2, "0")}`}</b>
                </div>
                <strong>{activeScene.label}</strong>
                <p>{autoHeroSummary}</p>
              </div>
              <div className="mk3-demo-guided-scene-proof">
                <span>{activeSequenceSurfaceLabel} in focus</span>
                <strong>{activeSceneProofLabel}</strong>
                <p>{activeSceneProofNote}</p>
              </div>
            </div>

            <div className="mk3-demo-guided-toolbar">
              <div className="mk3-demo-guided-toolbar-main">
                <button
                  type="button"
                  className={playing ? "active" : ""}
                  onClick={() => {
                    if (!playing) {
                      setTimelineMs((scrollDrivenSceneState.scene?.startMs || 0) + (scrollDrivenSceneState.sceneMs || 0));
                    }
                    setPlaying((prev) => !prev);
                  }}
                >
                  {playing ? "Pause Auto-play" : "Auto-play Scroll"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimelineMs(0);
                    setActiveAutoSceneId(WALKTHROUGH_TIMELINE[0]?.id || "");
                    setAutoSceneScrollProgress(0);
                    autoStageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    trackEvent("mk_demo_walkthrough_restart", { source: "toolbar" });
                  }}
                >
                  Restart
                </button>
              </div>
              <div className="mk3-demo-guided-toolbar-meta">
                <span>{`Scene ${Math.max(1, currentSceneIndex + 1)} of ${WALKTHROUGH_TIMELINE.length}`}</span>
                <strong>{playing ? "Auto-play running" : "Scroll drives chapters"}</strong>
              </div>
            </div>

            {isAutoDemoMobile ? (
              <div className="mk3-demo-guided-mobile-controls">
                <div className="mk3-demo-guided-surface-picker" role="tablist" aria-label="Auto demo surfaces">
                  {[
                    { id: "tv", label: "TV" },
                    { id: "audience", label: "Audience" },
                    { id: "host", label: "Host" },
                  ].map((surface) => (
                    <button
                      key={surface.id}
                      type="button"
                      role="tab"
                      aria-selected={resolvedActiveMobileSurface === surface.id}
                      className={resolvedActiveMobileSurface === surface.id ? "active" : ""}
                      onClick={() => {
                        setFollowMobileSurfaceFocus(false);
                        setActiveMobileSurface(surface.id);
                        trackEvent("mk_demo_mobile_surface_switch", { surface: surface.id });
                      }}
                    >
                      {surface.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`mk3-demo-mobile-follow-toggle${followMobileSurfaceFocus ? " active" : ""}`}
                  onClick={() => {
                    if (followMobileSurfaceFocus) {
                      setFollowMobileSurfaceFocus(false);
                      return;
                    }
                    setFollowMobileSurfaceFocus(true);
                    setActiveMobileSurface(activeSequenceStep?.surface || "tv");
                  }}
                >
                  {followMobileSurfaceFocus ? "Pin current surface" : "Resume demo focus"}
                </button>
              </div>
            ) : null}

            <div
              className={`mk3-demo-shell mk3-demo-shell-testing is-focus-${activeSequenceStep?.surface || "tv"}${isAutoDemoMobile ? " is-mobile-spotlight" : ""}`}
              data-scene={activeScene.id}
              data-mobile-surface={resolvedActiveMobileSurface}
              data-stage-focus={activeSequenceStep?.surface || "tv"}
            >
              <article className={`mk3-demo-surface mk3-demo-host${resolvedActiveMobileSurface === "host" ? " is-mobile-active" : ""}`}>
                <header>
                  <span>Host Deck</span>
                  <strong>{activeScene.host.actionLabel}</strong>
                </header>
                <div className="mk3-demo-frame-wrap mk3-demo-host-frame-wrap">
                  <iframe
                    ref={hostFrameRef}
                    title="BeauRocks Host Demo"
                    src={hostDemoUrl}
                    className="mk3-demo-iframe mk3-demo-native-surface"
                    loading="eager"
                    onLoad={() => handleDemoFrameLoad("host")}
                  />
                </div>
              </article>

              <article className={`mk3-demo-surface mk3-demo-tv is-${tvSurfaceVariant}${resolvedActiveMobileSurface === "tv" ? " is-mobile-active" : ""}`}>
                <header>
                  <span>Public TV</span>
                  <strong>{activeScene.tv.mode}</strong>
                </header>
                <div className="mk3-demo-frame-wrap mk3-demo-tv-frame-wrap">
                  <iframe
                    ref={tvFrameRef}
                    title="BeauRocks Public TV Demo"
                    src={tvDemoUrl}
                    className="mk3-demo-iframe mk3-demo-native-surface"
                    loading="eager"
                    onLoad={() => handleDemoFrameLoad("tv")}
                  />
                  <DemoTvOverlay scene={activeScene} reactionItems={reactionItems} triviaRows={triviaRows} />
                </div>
              </article>

              <article className={`mk3-demo-surface mk3-demo-audience${resolvedActiveMobileSurface === "audience" ? " is-mobile-active" : ""}`}>
                <header>
                  <span>Audience App</span>
                  <strong>{activeScene.audience.title}</strong>
                </header>
                <div className="mk3-demo-frame-wrap mk3-demo-audience-frame-wrap">
                  <GuidedAudiencePhone
                    scene={activeScene}
                    audienceDemoUrl={audienceDemoUrl}
                    audienceFrameRef={audienceFrameRef}
                    onFrameLoad={handleDemoFrameLoad}
                    activeActionIndex={activeActionIndex}
                    showFocus={false}
                    focusFrame={audienceFocusFrame}
                    focusLabel={tapCoach.prompt}
                    showNotes={false}
                  />
                </div>
              </article>
            </div>

            <div className="mk3-demo-guided-stage-rail is-minimal">
              <div className="mk3-demo-guided-stage-rail-head">
                <div className="mk3-demo-guided-stage-inline is-primary">
                  <span>{activeSequenceSurfaceLabel} in focus</span>
                  <strong>{activeSceneProofLabel}</strong>
                </div>
                <div className="mk3-demo-guided-stage-rail-meta">
                  <span>{formatClock(totalSceneElapsedMs)} / {formatClock(WALKTHROUGH_TOTAL_MS)}</span>
                  <strong>{scenePercent}%</strong>
                </div>
              </div>
              <div className="mk3-demo-guided-progress">
                <i style={{ width: `${Math.min(100, (totalSceneElapsedMs / WALKTHROUGH_TOTAL_MS) * 100)}%` }} />
              </div>
              <div className="mk3-demo-guided-stage-rail-footer">
                <div className="mk3-demo-guided-stage-rail-scene">
                  <span>{`Scene ${Math.max(1, currentSceneIndex + 1)} of ${WALKTHROUGH_TIMELINE.length}`}</span>
                  <strong>{activeSceneProofNote}</strong>
                </div>
                <div className="mk3-demo-guided-stage-rail-controls is-compact">
                  <button type="button" disabled={!previousScene} onClick={() => previousScene && jumpToScene(previousScene.id, { snapStage: true })}>
                    Previous Scene
                  </button>
                  <button type="button" disabled={!nextScene} onClick={() => nextScene && jumpToScene(nextScene.id, { snapStage: true })}>
                    Next Scene
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mk3-demo-guided-track">
            {WALKTHROUGH_TIMELINE.map((scene, sceneIndex) => {
              const isActive = scene.id === activeScene.id;
              const sceneFocus = scene.audience?.title || scene.tv?.mode || scene.label;
              const scenePrompt = scene.callouts?.[0]?.detail || scene.summary;
              const sceneIndexLabel = `Scene ${String(sceneIndex + 1).padStart(2, "0")}`;
              return (
                <section
                  key={scene.id}
                  ref={(node) => {
                    autoSceneRefs.current[sceneIndex] = node;
                  }}
                  data-auto-scene={scene.id}
                  className={`mk3-demo-guided-track-beat${isActive ? " is-active" : ""}`}
                >
                  <article className={`mk3-demo-guided-track-card is-${scene.accent || "cyan"}${isActive ? " is-current" : " is-upcoming"}`}>
                    <span>{isActive ? `${sceneIndexLabel} - current` : sceneIndexLabel}</span>
                    <strong>{scene.headline}</strong>
                    <p>{isActive ? scene.summary : scenePrompt}</p>
                    <div className={`mk3-demo-guided-track-inline${isActive ? " is-current" : ""}`}>
                      <b>{sceneFocus}</b>
                      <strong>{scene.tv.title}</strong>
                    </div>
                     {!isActive ? (
                      <button type="button" onClick={() => { setPlaying(false); jumpToScene(scene.id, { snapStage: true }); }}>
                         Jump to scene
                       </button>
                     ) : null}
                  </article>
                </section>
              );
            })}
          </div>
        </div>
      </article>
      )}
    </section>
  );
};

export default DemoExperiencePage;
