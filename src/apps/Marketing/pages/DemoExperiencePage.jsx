import React, { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { buildSurfaceUrl } from "../../../lib/surfaceDomains";

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

const GUIDED_SCENES = [
  {
    id: "join_identity",
    label: "Join + Identity",
    durationMs: 9000,
    accent: "pink",
    kicker: "scene 01",
    headline: "Guests join fast, pick a vibe, and the singer claims the mic.",
    summary: "Use this to sell the low-friction start: a guest picks a name and emoji, while the singer stakes out the next moment before the room is even fully warmed up.",
    host: {
      panel: "Room launch",
      status: "Opening room and sharing join prompt",
      search: "",
      actionLabel: "Broadcast room code",
      actionCopy: "Host opens the night and pushes one clean join path.",
      controls: ["Room live", "Join prompt", "Queue open", "Singer ready"],
      activeControl: 1,
    },
    audience: {
      title: "Audience picks an identity",
      subtitle: "Name, emoji, join, react",
      actions: ["Alex + crown", "Jordan + fire", "Taylor + heart", "Casey + wow"],
      feed: ["Alex joined", "Jordan tapped fire", "Taylor picked heart"],
      metricLabel: "joined in under",
      metricValue: "08 sec",
    },
    singer: {
      name: "Jordan",
      emoji: "fire",
      status: "Singer selected",
      note: "Claiming the mic before the opener starts.",
      prompt: "You are up second",
    },
    tv: {
      mode: "Room intro",
      title: "JOIN THE ROOM",
      lines: ["Scan or type the room code", "Pick your icon", "Watch the room light up"],
      footer: "The room state gets legible before the first lyric even lands.",
    },
    callouts: [
      { title: "Host -> Audience", detail: "One clear join action creates the first shared moment." },
      { title: "Audience -> TV", detail: "Identity picks give the room visible life right away." },
      { title: "Singer -> Host", detail: "The next performer is already accounted for." },
    ],
  },
  {
    id: "karaoke_launch",
    label: "Karaoke Launch",
    durationMs: 9000,
    accent: "amber",
    kicker: "scene 02",
    headline: "Host search and cueing is visible, then lyrics take over the room.",
    summary: "This is the direct karaoke sell: people can see the host doing something concrete, then instantly understand what changed on the TV and on the singer side.",
    host: {
      panel: "Catalog search",
      status: "Typing and cueing the opener",
      search: "sweet caroline karaoke",
      actionLabel: "Cue song",
      actionCopy: "The host action is readable enough that the switch to karaoke feels earned.",
      controls: ["Search", "Preview", "Cue song", "Go live"],
      activeControl: 2,
    },
    audience: {
      title: "Audience settles into singalong mode",
      subtitle: "Phones move from join to lightweight support",
      actions: ["Clap", "Fire", "Heart", "Cheer"],
      feed: ["Crowd synced", "Phones ready", "Encore energy building"],
      metricLabel: "ready phones",
      metricValue: "17 connected",
    },
    singer: {
      name: "Jordan",
      emoji: "fire",
      status: "Singer on deck",
      note: "Singer sees confidence-building context, not chaos.",
      prompt: "Sweet Caroline queued",
    },
    tv: {
      mode: "Lyrics live",
      title: "HANDS UP HIGH NOW",
      lines: ["The whole room sways in time", "Voices rise from left to right", "Big singalong, easy cue"],
      footer: "The room instantly understands what to do next.",
    },
    callouts: [
      { title: "Host -> TV", detail: "Typing and cueing become a visible switch to lyric-first mode." },
      { title: "TV -> Audience", detail: "The TV tells the audience when to sing and when to react." },
      { title: "TV -> Singer", detail: "Singer sees the exact room moment they are stepping into." },
    ],
  },
  {
    id: "crowd_hype",
    label: "Crowd Hype",
    durationMs: 8500,
    accent: "cyan",
    kicker: "scene 03",
    headline: "Audience reactions visibly feed the moment instead of sitting off to the side.",
    summary: "This is the social proof beat. The crowd is not just watching the singer. The crowd is part of the room logic and that shows up on the big screen.",
    host: {
      panel: "Live run",
      status: "Calling for a reaction burst",
      search: "",
      actionLabel: "Trigger hype prompt",
      actionCopy: "A lightweight host prompt is enough to push the room into a louder state.",
      controls: ["Lyrics", "Reaction burst", "Spotlight", "Queue peek"],
      activeControl: 1,
    },
    audience: {
      title: "Audience fires off quick reactions",
      subtitle: "Fast taps, no setup tax",
      actions: ["Clap x12", "Fire x18", "Heart x09", "Cheer x14"],
      feed: ["Fire streak rising", "Cheer combo linked", "Heart wave crossed the room"],
      metricLabel: "reaction burst",
      metricValue: "53 taps",
    },
    singer: {
      name: "Jordan",
      emoji: "fire",
      status: "Singer backed by the room",
      note: "The performer feels the room support visually and rhythmically.",
      prompt: "Crowd glow climbing",
    },
    tv: {
      mode: "Crowd support",
      title: "ROOM ENERGY RISING",
      lines: ["Reactions stack in real time", "Momentum pushes the chorus", "The crowd becomes visible"],
      footer: "Audience input is not decorative. It changes the feel of the room.",
    },
    callouts: [
      { title: "Audience -> TV", detail: "The crowd produces a visible shared payoff." },
      { title: "Audience -> Singer", detail: "The singer gets a confidence signal, not just noise." },
      { title: "Host -> Crowd", detail: "A simple cue amplifies the room without adding friction." },
    ],
  },
  {
    id: "guitar_vibe_sync",
    label: "Guitar Vibe Sync",
    durationMs: 9500,
    accent: "violet",
    kicker: "scene 04",
    headline: "One host trigger repurposes every surface into a playable mode switch.",
    summary: "This is the most sellable systems moment on the page. The host launches Guitar Vibe Sync, the TV drops into solo visuals, audience phones become instruments, and the singer gets a clean handoff.",
    host: {
      panel: "Mode trigger",
      status: "Launching Guitar Vibe Sync",
      search: "",
      actionLabel: "Activate Vibe Sync",
      actionCopy: "The host presses one button and every surface immediately changes role.",
      controls: ["Karaoke", "Guitar Vibe Sync", "Confetti", "Laser pop"],
      activeControl: 1,
    },
    audience: {
      title: "Phones become instruments",
      subtitle: "Tap, hold, strum, power spike",
      actions: ["Strum", "Power chord", "Pulse", "Cheer"],
      feed: ["Strum lane synced", "Power spike ready", "Crowd chain extended"],
      metricLabel: "active strummers",
      metricValue: "14 live",
    },
    singer: {
      name: "Jordan",
      emoji: "fire",
      status: "Instrumental handoff",
      note: "The singer can step back while the room carries the solo moment.",
      prompt: "Re-enter on the next vocal cue",
    },
    tv: {
      mode: "Vibe Sync",
      title: "SOLO MODE LIVE",
      lines: ["Lyrics step away", "Phones drive the groove", "The TV becomes a crowd instrument"],
      footer: "A mode switch feels dramatic without feeling confusing.",
    },
    callouts: [
      { title: "Host -> All", detail: "One action updates host, TV, audience, and singer expectations." },
      { title: "Audience -> TV", detail: "Phones stop being passive and start driving the scene." },
      { title: "TV -> Singer", detail: "The singer knows exactly when the room is carrying the moment." },
    ],
  },
  {
    id: "trivia_break",
    label: "Trivia Break",
    durationMs: 8500,
    accent: "teal",
    kicker: "scene 05",
    headline: "Between-song moments stay active with a fast room-wide prompt.",
    summary: "This beat proves the room can stay alive between singers. It sells the app as a night-running system, not just a lyric renderer.",
    host: {
      panel: "Games workspace",
      status: "Launching a quick trivia beat",
      search: "",
      actionLabel: "Start trivia",
      actionCopy: "A short interlude keeps the room engaged while the queue resets.",
      controls: ["Queue", "Trivia", "Would you rather", "Auto DJ"],
      activeControl: 1,
    },
    audience: {
      title: "Audience votes live",
      subtitle: "Phones become voting pads",
      actions: ["Public TV", "Host Deck", "Audience App", "All three"],
      feed: ["Votes rising", "Reveal almost ready", "Crowd split still moving"],
      metricLabel: "votes in",
      metricValue: "70 total",
    },
    singer: {
      name: "Casey",
      emoji: "crown",
      status: "Next singer staged",
      note: "The next singer can get ready while the room stays occupied.",
      prompt: "Mic check in progress",
    },
    tv: {
      mode: "Trivia reveal",
      title: "WHICH SURFACE RUNS THE NIGHT?",
      lines: ["The room keeps moving", "Votes stream in live", "Reveal lands without dead air"],
      footer: "This sells continuity, not just novelty.",
    },
    callouts: [
      { title: "Host -> Audience", detail: "The host can repurpose the room without losing momentum." },
      { title: "Audience -> TV", detail: "Voting becomes a visible shared reveal." },
      { title: "Trivia -> Queue", detail: "The next singer gets cover while the room stays active." },
    ],
  },
  {
    id: "auto_dj_handoff",
    label: "Auto DJ Handoff",
    durationMs: 9000,
    accent: "lime",
    kicker: "scene 06",
    headline: "Auto DJ and queue awareness make the handoff feel intentional, not awkward.",
    summary: "This closes the sales walkthrough on a practical operator value prop: smoother transitions, less dead time, and a room that feels continuously run.",
    host: {
      panel: "Handoff control",
      status: "Bridging to the next singer",
      search: "",
      actionLabel: "Auto DJ bridge live",
      actionCopy: "The host gets breathing room while the next performer steps in cleanly.",
      controls: ["Auto DJ", "Next singer", "Room pulse", "Finale cue"],
      activeControl: 0,
    },
    audience: {
      title: "Audience stays with the room",
      subtitle: "No awkward reset between performers",
      actions: ["Clap through bridge", "Cheer next singer", "Heart the handoff", "Stay locked in"],
      feed: ["Bridge audio carrying", "Next singer visible", "Room never drops"],
      metricLabel: "handoff gap",
      metricValue: "near zero",
    },
    singer: {
      name: "Casey",
      emoji: "crown",
      status: "Now stepping on stage",
      note: "The next performer inherits a live room, not a cold restart.",
      prompt: "Chorus re-entry in 3...",
    },
    tv: {
      mode: "Smooth handoff",
      title: "NEXT SINGER READY",
      lines: ["Bridge audio keeps the room warm", "The queue handoff stays visible", "Momentum carries into the next lead"],
      footer: "The room feels managed, not improvised.",
    },
    callouts: [
      { title: "Auto DJ -> Room", detail: "Transitions stop feeling like operational dead space." },
      { title: "Host -> Singer", detail: "The next singer enters with timing and context." },
      { title: "Audience -> Night", detail: "Attention stays continuous between performers." },
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
const getTvSurfaceVariant = (sceneId = "") => TV_VARIANTS_BY_SCENE[sceneId] || "karaoke";
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
  logoUrl: "/images/logo-library/beaurocks-karaoke-logo-2.png",
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

const buildAudienceFixture = ({ scene, nextScene, sceneProgress, activeActionIndex, hostTypedSearch }) => {
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

const buildTvFixture = ({ scene, nextScene, sceneProgress, reactionItems, triviaRows }) => {
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

const buildHostFixture = ({ scene, nextScene, sceneProgress, reactionItems }) => {
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

const getReactionItems = (scene, progress = 0) => {
  const labels = scene.audience.actions.slice(0, 4).map((entry) => entry.split(" x")[0]);
  const baselines = [12, 18, 24, 30];
  return labels.map((label, index) => ({
    label,
    count: baselines[index] + Math.round(progress * (14 + index * 5)),
  }));
};

const getTriviaRows = (scene, progress = 0) => {
  const baselines = [14, 18, 16, 22];
  const growth = [8, 12, 10, 24];
  return scene.audience.actions.map((label, index) => ({
    label,
    value: baselines[index] + Math.round(progress * growth[index]),
    highlight: index === scene.audience.actions.length - 1,
  }));
};

const getHostFocusFrame = (sceneId = "") => {
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

const getTvFocusFrame = (sceneId = "") => {
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

const getAudienceFocusFrame = (sceneId = "", activeIndex = 0) => {
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

const getTapCoach = (scene, activeIndex = 0) => {
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

const getSceneSequence = (scene, tapCoach) => {
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

const getSequenceIndex = (sceneId = "", progress = 0) => {
  if (sceneId === "trivia_break") {
    if (progress < 0.26) return 0;
    if (progress < 0.7) return 1;
    return 2;
  }
  if (progress < 0.34) return 0;
  if (progress < 0.66) return 1;
  return 2;
};

const DemoExperiencePage = ({ navigate, demoMode = "abstract" }) => {
  const isAutoPage = String(demoMode || "").trim().toLowerCase() === "auto";
  const [timelineMs, setTimelineMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [activeAbstractEventId, setActiveAbstractEventId] = useState(ABSTRACT_SCROLL_EVENTS[0]?.id || "");
  const abstractBeatRefs = useRef([]);
  const hostFrameRef = useRef(null);
  const tvFrameRef = useRef(null);
  const audienceFrameRef = useRef(null);

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

  const sceneState = useMemo(() => getSceneAtMs(timelineMs), [timelineMs]);
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
  const stageCalloutKicker = isArrivalIntroBeat
    ? activeAbstractEvent?.kicker || activeBeat.kicker
    : activeBeat.kicker;
  const stageCalloutBody = isArrivalIntroBeat
    ? activeAbstractEvent?.detail || activeBeat.body
    : activeBeat.body;
  const visibleSignals = isArrivalIntroBeat ? [] : activeBeat.signals;
  const hostFeatureList = isArrivalIntroBeat
    ? ABSTRACT_INTRO_SURFACE_FEATURES.host.map((item) => item.title)
    : [activeBeat.signals[0]?.label, activeBeat.bullets[0], activeBeat.bullets[1]].filter(Boolean);
  const tvFeatureList = isArrivalIntroBeat
    ? ABSTRACT_INTRO_SURFACE_FEATURES.tv
    : activeBeat.signals.map((signal) => signal.label).slice(0, 3);
  const audienceFeatureList = isArrivalIntroBeat
    ? ABSTRACT_INTRO_SURFACE_FEATURES.audience
    : activeBeat.bullets.slice(0, 3);
  const singerFeatureList = isArrivalIntroBeat
    ? ABSTRACT_INTRO_SURFACE_FEATURES.singer
    : ["Lead clearly", "Wait for cue", "Hand off cleanly"];
  const activeSignalFocusIndex = clampNumber(activeAbstractMomentIndex, 0, Math.max(0, visibleSignals.length - 1), 0);
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
  const nextScene = useMemo(() => {
    const index = WALKTHROUGH_TIMELINE.findIndex((entry) => entry.id === activeScene.id);
    if (index < 0 || index >= WALKTHROUGH_TIMELINE.length - 1) return null;
    return WALKTHROUGH_TIMELINE[index + 1];
  }, [activeScene.id]);
  const tvSurfaceVariant = useMemo(() => getTvSurfaceVariant(activeScene.id), [activeScene.id]);
  const reactionItems = useMemo(
    () => getReactionItems(activeScene, sceneProgress),
    [activeScene, sceneProgress]
  );
  const triviaRows = useMemo(
    () => getTriviaRows(activeScene, sceneProgress),
    [activeScene, sceneProgress]
  );
  const hostCursorStyle = useMemo(() => {
    switch (activeScene.id) {
      case "karaoke_launch":
        return { left: `${24 + sceneProgress * 18}%`, top: "18%" };
      case "crowd_hype":
        return { left: "42%", top: `${54 - sceneProgress * 12}%` };
      case "guitar_vibe_sync":
        return { left: "44%", top: "57%" };
      case "trivia_break":
        return { left: "33%", top: "57%" };
      case "auto_dj_handoff":
        return { left: "12%", top: "57%" };
      case "join_identity":
      default:
        return { left: "72%", top: `${30 + sceneProgress * 14}%` };
    }
  }, [activeScene.id, sceneProgress]);
  const audienceTapStyle = useMemo(() => {
    const positions = [
      { left: "18%", top: "58%" },
      { left: "50%", top: "58%" },
      { left: "82%", top: "58%" },
      { left: "18%", top: "71%" },
    ];
    const sceneOnePositions = [
      { left: "22%", top: "24%" },
      { left: "52%", top: "24%" },
      { left: "78%", top: "24%" },
      { left: "52%", top: "38%" },
    ];
    const source = activeScene.id === "join_identity" ? sceneOnePositions : positions;
    return source[activeActionIndex] || source[0];
  }, [activeActionIndex, activeScene.id]);
  const hostFocusFrame = useMemo(() => getHostFocusFrame(activeScene.id), [activeScene.id]);
  const tvFocusFrame = useMemo(() => getTvFocusFrame(activeScene.id), [activeScene.id]);
  const audienceFocusFrame = useMemo(
    () => getAudienceFocusFrame(activeScene.id, activeActionIndex),
    [activeActionIndex, activeScene.id]
  );
  const tapCoach = useMemo(
    () => getTapCoach(activeScene, activeActionIndex),
    [activeActionIndex, activeScene]
  );
  const sceneSequence = useMemo(
    () => getSceneSequence(activeScene, tapCoach),
    [activeScene, tapCoach]
  );
  const activeSequenceIndex = useMemo(
    () => getSequenceIndex(activeScene.id, sceneProgress),
    [activeScene.id, sceneProgress]
  );
  const activeSequenceStep = sceneSequence[activeSequenceIndex] || sceneSequence[0];
  const audienceFixture = useMemo(
    () => buildAudienceFixture({
      scene: activeScene,
      nextScene,
      sceneProgress,
      activeActionIndex,
      hostTypedSearch,
    }),
    [activeActionIndex, activeScene, hostTypedSearch, nextScene, sceneProgress]
  );
  const tvFixture = useMemo(
    () => buildTvFixture({
      scene: activeScene,
      nextScene,
      sceneProgress,
      reactionItems,
      triviaRows,
    }),
    [activeScene, nextScene, reactionItems, sceneProgress, triviaRows]
  );
  const hostFixture = useMemo(
    () => buildHostFixture({
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

  const jumpToScene = (sceneId = "") => {
    const nextSceneTarget = WALKTHROUGH_TIMELINE.find((scene) => scene.id === sceneId);
    if (!nextSceneTarget) return;
    setTimelineMs(nextSceneTarget.startMs);
    setPlaying(true);
    trackEvent("mk_demo_scene_jump", { scene: nextSceneTarget.id });
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

  const totalSceneElapsedMs = Math.max(0, Math.round(timelineMs));

  return (
    <section className="mk3-page mk3-demo-page mk3-demo-sales-page">
      <article className="mk3-demo-sales-hero">
        <div>
          <div className="mk3-chip">{isAutoPage ? "auto demo" : "abstract demo"}</div>
          <h1>{isAutoPage ? "Auto-play the actual room UI across the surfaces." : "Scroll to change the primary abstract scene."}</h1>
          <p>
            {isAutoPage
              ? "This page is the deterministic sales walkthrough: the host, TV, and audience surfaces mount the native app UI, then the timeline simulates taps, typing, and handoffs."
              : "This page stays conceptual on purpose. Scroll advances one scene at a time while the main stage shows host, TV, audience, and singer reacting together."}
          </p>
        </div>
        <div className="mk3-demo-sales-hero-pills">
          <span>{isAutoPage ? "Dedicated auto demo page" : "Dedicated abstract page"}</span>
          <span>{isAutoPage ? "Native app surfaces" : "Concept-first motion"}</span>
          <span>{isAutoPage ? "Timeline-driven overlays" : "Scene-by-scene scroll"}</span>
          {typeof navigate === "function" && (
            <button type="button" onClick={() => navigate(isAutoPage ? "demo" : "demo_auto")}>
              {isAutoPage ? "Open Abstract Demo" : "Open Auto Demo"}
            </button>
          )}
        </div>
      </article>

      {!isAutoPage && (
      <article className="mk3-demo-story mk3-demo-story-immersive">
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
                  <span>{isArrivalIntroBeat ? "Primary job" : "Origin move"}</span>
                  <strong>{isArrivalIntroBeat ? "Drive the first room change" : activeBeat.signals[0]?.label || "Room cue"}</strong>
                  <p>{isArrivalIntroBeat ? "The host decides what kind of room moment starts first." : "One deliberate host action changes the rest of the room."}</p>
                </div>
                <div className="mk3-demo-story-chip-row">
                  {hostFeatureList.map((item) => (
                    <b key={`${activeBeat.id}_host_${item}`}>{item}</b>
                  ))}
                </div>
                <p className="mk3-demo-story-surface-note">
                  {isArrivalIntroBeat
                    ? "Start with the one deliberate control surface before you show the whole network."
                    : "One deliberate input changes the whole room state."}
                </p>
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
                <p className="mk3-demo-story-surface-note">
                  {isArrivalIntroBeat
                    ? "Introduce the TV as the public room state before you ask the user to parse arrows or game modes."
                    : "TV should make each room change feel sweeping and public."}
                </p>
              </article>

              <article className={`mk3-demo-story-screen mk3-demo-story-screen-phone${activeBeat.signals.some((signal) => signal.from === "audience" || signal.to === "audience") ? " is-source is-target" : ""}${getStorySurfaceClasses("audience")}`}>
                <span>Audience App</span>
                <strong>{activeBeat.notes.audience}</strong>
                <p className="mk3-demo-story-phone-copy">
                  Audience interaction should read instantly, even when the phone UI is shown abstractly.
                </p>
                <div className="mk3-demo-story-phone-votes mk3-demo-story-phone-votes-simple" aria-hidden="true">
                  {audienceFeatureList.map((item, index) => (
                    <button key={`${activeBeat.id}_${item}`} type="button" tabIndex={-1} className={index === activeSignalFocusIndex % Math.max(1, audienceFeatureList.length) ? "is-active" : ""}>{item}</button>
                  ))}
                </div>
                <div className="mk3-demo-story-phone-request">
                  <span>{isArrivalIntroBeat ? "Primary job" : "Audience effect"}</span>
                  <strong>{isArrivalIntroBeat ? "Join + react" : activeBeat.signals.find((signal) => signal.from === "audience" || signal.to === "audience")?.label || "Shared response"}</strong>
                  <p>{isArrivalIntroBeat ? "Keep the first audience action obvious and low-friction." : "Show one room-sized response instead of tiny tap choreography."}</p>
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
                  <span>{isArrivalIntroBeat ? "Performer readiness" : "Confidence"}</span>
                  <i style={{ width: `${42 + activeAbstractBeatIndex * 11}%` }} />
                </div>
                <div className="mk3-demo-story-singer-points">
                  {singerFeatureList.map((item) => (
                    <b key={`${activeBeat.id}_${item}`}>{item}</b>
                  ))}
                </div>
                <p className="mk3-demo-story-surface-note">
                  {isArrivalIntroBeat
                    ? "Only after the singer role is clear should the system start showing interplay."
                    : "The performer always knows whether to lead, wait, or hand off."}
                </p>
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
              style={{ minHeight: "54vh" }}
            >
              <div className="mk3-demo-story-beat-anchor">
                <span>{event.kicker}</span>
                <strong>{event.title}</strong>
                <div className="mk3-demo-story-bullets">
                  <strong>Scene {event.beatIndex + 1}</strong>
                  <strong>Step {event.momentIndex + 1} of {(ABSTRACT_MOMENTS[event.beatId] || []).length}</strong>
                </div>
              </div>
            </section>
          ))}
        </div>
      </article>
      )}

      {isAutoPage && (
      <article className="mk3-demo-guided">
        <div className="mk3-demo-guided-toolbar">
          <button type="button" className={playing ? "active" : ""} onClick={() => setPlaying((prev) => !prev)}>
            {playing ? "Pause Walkthrough" : "Resume Walkthrough"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTimelineMs(0);
              setPlaying(true);
              trackEvent("mk_demo_walkthrough_restart", { source: "toolbar" });
            }}
          >
            Restart From Scene 01
          </button>
          <span>{activeScene.label}</span>
        </div>

        <div className="mk3-demo-shell mk3-demo-shell-testing">
          <article className="mk3-demo-surface mk3-demo-host">
            <header>
              <span>Host Deck</span>
              <strong>Actual host room UI</strong>
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
              {activeSequenceStep?.surface === "host" ? (
                <>
                  <div className="mk3-demo-focus-ring is-host" style={hostFocusFrame}><span>{activeSequenceStep.title}</span></div>
                  <div className="mk3-demo-sim-cursor is-host" style={hostCursorStyle}><span>{activeScene.host.search ? "type" : "click"}</span></div>
                </>
              ) : null}
            </div>
          </article>

          <article className={`mk3-demo-surface mk3-demo-tv is-${tvSurfaceVariant}`}>
            <header>
              <span>Public TV</span>
              <strong>Actual TV room UI</strong>
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
              {activeSequenceStep?.surface === "tv" ? (
                <div className="mk3-demo-focus-ring is-tv" style={tvFocusFrame}><span>{activeSequenceStep.title}</span></div>
              ) : null}
            </div>
          </article>

          <article className="mk3-demo-surface mk3-demo-audience">
            <header>
              <span>Audience App</span>
              <strong>Actual audience room UI</strong>
            </header>
            <div className="mk3-demo-frame-wrap mk3-demo-audience-frame-wrap">
              <div className="mk3-demo-phone-shell">
                <div className="mk3-demo-phone-notch" />
                <div className="mk3-demo-phone-screen">
                  <iframe
                    ref={audienceFrameRef}
                    title="BeauRocks Audience Demo"
                    src={audienceDemoUrl}
                    className="mk3-demo-iframe mk3-demo-native-surface"
                    loading="eager"
                    onLoad={() => handleDemoFrameLoad("audience")}
                  />
                  {activeSequenceStep?.surface === "audience" ? (
                    <>
                      <div className="mk3-demo-focus-ring is-phone-target" style={audienceFocusFrame} />
                      <div className="mk3-demo-sim-tap is-phone" style={audienceTapStyle}>
                        <i />
                        <i />
                        <span>{tapCoach.prompt}</span>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="mk3-demo-guided-stage-rail">
          <div className="mk3-demo-guided-stage-rail-head">
            <div>
              <span>{activeScene.kicker}</span>
              <strong>{activeScene.headline}</strong>
            </div>
            <div className="mk3-demo-guided-stage-rail-meta">
              <span>{formatClock(totalSceneElapsedMs)} / {formatClock(WALKTHROUGH_TOTAL_MS)}</span>
              <strong>{scenePercent}%</strong>
            </div>
          </div>
          <div className="mk3-demo-guided-progress">
            <i style={{ width: `${Math.min(100, (totalSceneElapsedMs / WALKTHROUGH_TOTAL_MS) * 100)}%` }} />
          </div>
          <div className="mk3-demo-guided-sequence">
            {sceneSequence.map((step, index) => (
              <article key={`${activeScene.id}_${step.surface}_${step.title}`} className={index === activeSequenceIndex ? "is-active" : ""}>
                <span>{step.surface}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
          <div className="mk3-demo-guided-stage-rail-footer">
            <div className="mk3-demo-guided-scene-nav">
              {WALKTHROUGH_TIMELINE.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={activeScene.id === scene.id ? "active" : ""}
                  onClick={() => jumpToScene(scene.id)}
                >
                  {scene.label}
                </button>
              ))}
            </div>
            <div className="mk3-demo-guided-stage-prompt">
              <span>{activeSequenceStep.surface} active now</span>
              <strong>{activeSequenceStep.surface === "audience" ? tapCoach.prompt : activeSequenceStep.title}</strong>
              <p>{activeSequenceStep.surface === "audience" ? tapCoach.detail : activeSequenceStep.detail}</p>
            </div>
          </div>
        </div>
      </article>
      )}
    </section>
  );
};

export default DemoExperiencePage;
