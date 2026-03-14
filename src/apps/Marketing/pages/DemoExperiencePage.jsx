import React, { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import {
  DemoAudienceRoomShell,
  DemoHostRoomShell,
  DemoTvRoomShell,
} from "../components/DemoProductShells";

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
      title: "Host primes the room.",
      detail: "The first scroll beat should feel like ignition: the host creates the first meaningful state change.",
      signalIndex: 0,
      host: "Host sends the opener cue into the system.",
      tv: "TV is still waiting for the room command.",
      audience: "Phones have not been pulled into the moment yet.",
      singer: "Singer is still waiting for a clear go signal.",
    },
    {
      id: "arrival_tv_wake",
      kicker: "moment 02",
      title: "The TV wakes up and becomes legible.",
      detail: "The room sees the cue land on the biggest surface first.",
      signalIndex: 0,
      host: "Host action is now visibly affecting the room.",
      tv: "TV flips from idle into a readable join state.",
      audience: "Phones are about to receive the same room instruction.",
      singer: "Singer sees the room orient around one source of truth.",
    },
    {
      id: "arrival_audience_join",
      kicker: "moment 03",
      title: "Audience identity ripples into the room.",
      detail: "The audience should feel like a visible response loop, not a silent side channel.",
      signalIndex: 1,
      host: "Host now sees the room filling in behind the cue.",
      tv: "TV starts reflecting the room joining in.",
      audience: "Audience gets the low-friction join prompt instantly.",
      singer: "Singer can feel that the room is arriving with them.",
    },
    {
      id: "arrival_singer_ready",
      kicker: "moment 04",
      title: "Singer readiness lands before the first lyric.",
      detail: "The scene resolves when the singer gets a clear place in the room flow.",
      signalIndex: 2,
      host: "Host has staged the room and the singer in one pass.",
      tv: "TV has the room warm and pointed in the same direction.",
      audience: "Audience is now ready to react, sing, and follow along.",
      singer: "Singer gets an unmistakable 'you are up' cue.",
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

const getHostResults = (scene, typedSearch = "") => {
  switch (scene.id) {
    case "join_identity":
      return [
        { title: "Fresh room for tonight", meta: "Broadcast join code to every phone", state: "Room setup" },
        { title: "Identity prompt", meta: "Name + vibe picker enabled", state: "Live" },
        { title: `${scene.singer.name} on deck`, meta: scene.singer.prompt, state: "Singer staged" },
      ];
    case "karaoke_launch":
      return [
        {
          title: "Sweet Caroline",
          meta: typedSearch.length >= scene.host.search.length ? "Classic singalong - match ready" : "Searching catalog...",
          state: typedSearch.length >= scene.host.search.length ? "Cue now" : "Typing",
        },
        { title: "Sweet Child O' Mine", meta: "High-energy alt pick", state: "Preview" },
        { title: "Sweet Home Alabama", meta: "Crowd-familiar fallback", state: "Hold" },
      ];
    case "crowd_hype":
      return [
        { title: "Reaction burst", meta: "Fire, cheer, heart, clap", state: "Armed" },
        { title: "Spotlight cue", meta: `${scene.audience.metricValue} already landing`, state: "Queued" },
        { title: "Room pulse", meta: "TV overlay mirrors the crowd", state: "Live" },
      ];
    case "guitar_vibe_sync":
      return [
        { title: "Guitar Vibe Sync", meta: "Phones become instruments", state: "Mode live" },
        { title: "Confetti pop", meta: "Accent the solo break", state: "Optional" },
        { title: "Laser pulse", meta: "TV mood shift on command", state: "Standby" },
      ];
    case "trivia_break":
      return [
        { title: "Quick trivia", meta: "Fast room-wide vote", state: "Go live" },
        { title: "Would you rather", meta: "Longer split-room prompt", state: "Next" },
        { title: "Queue cover", meta: `${scene.singer.name} gets staging time`, state: "Benefit" },
      ];
    case "auto_dj_handoff":
      return [
        { title: "Auto DJ bridge", meta: "Audio fills the handoff gap", state: "Running" },
        { title: `${scene.singer.name} ready`, meta: scene.singer.prompt, state: "Next singer" },
        { title: "Room pulse", meta: "Momentum stays visible", state: "Continuous" },
      ];
    default:
      return [];
  }
};

const getSceneQueue = (scene, nextScene) => [
  {
    title: scene.tv.title,
    meta: `${scene.singer.name} live now`,
  },
  nextScene
    ? {
      title: nextScene.tv.title,
      meta: `${nextScene.singer.name} on deck`,
    }
    : {
      title: "Encore hold",
      meta: "Room pulse ready",
    },
  {
    title: scene.host.actionLabel,
    meta: scene.host.status,
  },
];

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
      return { left: "63%", top: "60%", width: "25%", height: "22%", label: "Join cue lands on TV" };
    case "guitar_vibe_sync":
      return { left: "32%", top: "27%", width: "36%", height: "28%", label: "TV flips into Vibe Sync" };
    case "trivia_break":
      return { left: "18%", top: "23%", width: "64%", height: "42%", label: "Live vote reveal" };
    case "auto_dj_handoff":
      return { left: "15%", top: "25%", width: "50%", height: "24%", label: "Next singer handoff" };
    case "crowd_hype":
      return { left: "18%", top: "62%", width: "64%", height: "16%", label: "Reactions hit the room" };
    case "karaoke_launch":
    default:
      return { left: "18%", top: "50%", width: "64%", height: "20%", label: "Lyrics take over" };
  }
};

const getAudienceFocusFrame = (sceneId = "", activeIndex = 0) => {
  if (sceneId === "join_identity") {
    const joinFrames = [
      { left: "10%", top: "16%", width: "23%", height: "15%" },
      { left: "39%", top: "16%", width: "23%", height: "15%" },
      { left: "67%", top: "16%", width: "23%", height: "15%" },
      { left: "39%", top: "33%", width: "23%", height: "15%" },
    ];
    return {
      ...joinFrames[activeIndex] || joinFrames[0],
      label: "Pick name + emoji",
    };
  }
  const actionFrames = [
    { left: "10%", top: "58%", width: "22%", height: "14%" },
    { left: "39%", top: "58%", width: "22%", height: "14%" },
    { left: "68%", top: "58%", width: "22%", height: "14%" },
    { left: "10%", top: "74%", width: "22%", height: "14%" },
  ];
  return {
    ...actionFrames[activeIndex] || actionFrames[0],
    label: sceneId === "guitar_vibe_sync" ? "Phone becomes an instrument" : "Audience taps in",
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

const DemoExperiencePage = ({ navigate, demoMode = "abstract" }) => {
  const isAutoPage = String(demoMode || "").trim().toLowerCase() === "auto";
  const [timelineMs, setTimelineMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [activeAbstractEventId, setActiveAbstractEventId] = useState(ABSTRACT_SCROLL_EVENTS[0]?.id || "");
  const abstractMomentRefs = useRef([]);

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
    const nodes = abstractMomentRefs.current.filter(Boolean);
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
      threshold: [0.22, 0.48, 0.72],
      rootMargin: "-12% 0px -18% 0px",
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
  const activeAbstractMoments = ABSTRACT_MOMENTS[activeBeat.id] || [];
  const activeAbstractSignal = activeBeat.signals[activeAbstractEvent?.signalIndex ?? 0] || activeBeat.signals[0];
  const activeAbstractSource = activeAbstractSignal?.from || activeBeat.activeSurface;
  const activeAbstractTarget = activeAbstractSignal?.to || activeBeat.activeSurface;
  const activeActionIndex = useMemo(
    () => getActiveIndex(activeScene.audience.actions, sceneProgress + 0.12),
    [activeScene.audience.actions, sceneProgress]
  );
  const activeFeedIndex = useMemo(
    () => getActiveIndex(activeScene.audience.feed, sceneProgress + 0.26),
    [activeScene.audience.feed, sceneProgress]
  );
  const activeTvLineIndex = useMemo(
    () => getActiveIndex(activeScene.tv.lines, sceneProgress + 0.18),
    [activeScene.tv.lines, sceneProgress]
  );
  const hostTypedSearch = useMemo(
    () => getTypedText(activeScene.host.search, sceneProgress),
    [activeScene.host.search, sceneProgress]
  );
  const hostControlProgress = clampNumber((sceneProgress - 0.22) / 0.62, 0, 1, 0);
  const roomEnergy = 28 + Math.round(sceneProgress * 58);
  const scenePercent = Math.round(sceneProgress * 100);
  const nextScene = useMemo(() => {
    const index = WALKTHROUGH_TIMELINE.findIndex((entry) => entry.id === activeScene.id);
    if (index < 0 || index >= WALKTHROUGH_TIMELINE.length - 1) return null;
    return WALKTHROUGH_TIMELINE[index + 1];
  }, [activeScene.id]);
  const sceneIndex = useMemo(
    () => WALKTHROUGH_TIMELINE.findIndex((entry) => entry.id === activeScene.id),
    [activeScene.id]
  );
  const sceneNumber = String(Math.max(0, sceneIndex) + 1).padStart(2, "0");
  const tvSurfaceVariant = useMemo(() => getTvSurfaceVariant(activeScene.id), [activeScene.id]);
  const hostResults = useMemo(
    () => getHostResults(activeScene, hostTypedSearch),
    [activeScene, hostTypedSearch]
  );
  const queueSnapshot = useMemo(
    () => getSceneQueue(activeScene, nextScene),
    [activeScene, nextScene]
  );
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
  const activeLyric = activeScene.tv.lines[activeTvLineIndex] || activeScene.tv.lines[0] || "";
  const nextLyric = activeScene.tv.lines[Math.min(activeScene.tv.lines.length - 1, activeTvLineIndex + 1)] || "";
  const totalConnectedLabel = activeScene.id === "join_identity" ? "08 joined" : activeScene.audience.metricValue;

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

  const totalSceneElapsedMs = Math.max(0, Math.round(timelineMs));

  return (
    <section className="mk3-page mk3-demo-page mk3-demo-sales-page">
      <article className="mk3-demo-sales-hero">
        <div>
          <div className="mk3-chip">{isAutoPage ? "auto demo" : "abstract demo"}</div>
          <h1>{isAutoPage ? "Auto-play the product story across the room." : "Show the system logic before the product UI."}</h1>
          <p>
            {isAutoPage
              ? "This page is the deterministic sales walkthrough: local-only host, TV, and audience shells with simulated taps, typing, and mode shifts."
              : "This page stays conceptual on purpose. It sells how host, TV, audience, and singer influence one another without pretending to be the live product."}
          </p>
        </div>
        <div className="mk3-demo-sales-hero-pills">
          <span>{isAutoPage ? "Dedicated auto demo page" : "Dedicated abstract page"}</span>
          <span>{isAutoPage ? "Real room shells" : "Concept-first motion"}</span>
          <span>Zero live reads or writes</span>
          {typeof navigate === "function" && (
            <button type="button" onClick={() => navigate(isAutoPage ? "demo" : "demo_auto")}>
              {isAutoPage ? "Open Abstract Demo" : "Open Auto Demo"}
            </button>
          )}
        </div>
      </article>

      {!isAutoPage && (
      <article className="mk3-demo-story">
        <div className="mk3-demo-story-intro">
          <div className="mk3-chip">abstract demo</div>
          <h2>Show the system logic before viewers start parsing product screens.</h2>
          <p>
            This layer should feel like motion design, not like someone paused a live room. Scroll through each scene
            in multiple beats so the interaction direction is obvious before anyone sees a literal product screen.
          </p>
        </div>
        <div className="mk3-demo-story-grid">
          <div className="mk3-demo-story-steps">
            {ABSTRACT_BEATS.map((beat) => (
              <section
                key={beat.id}
                className={`mk3-demo-story-step${activeBeat.id === beat.id ? " is-active" : ""}`}
              >
                <span>{beat.kicker}</span>
                <h3>{beat.title}</h3>
                <p>{beat.body}</p>
                <div className="mk3-demo-story-bullets">
                  {beat.bullets.map((item) => (
                    <strong key={`${beat.id}_${item}`}>{item}</strong>
                  ))}
                </div>
                <div className="mk3-demo-story-events">
                  {(ABSTRACT_MOMENTS[beat.id] || []).map((moment, momentIndex) => (
                    <article
                      key={moment.id}
                      ref={(node) => {
                        abstractMomentRefs.current[ABSTRACT_SCROLL_EVENTS.findIndex((entry) => entry.id === moment.id)] = node;
                      }}
                      data-story-event={moment.id}
                      className={`mk3-demo-story-event${activeAbstractEvent?.id === moment.id ? " is-active" : ""}`}
                    >
                      <span>{moment.kicker}</span>
                      <strong>{moment.title}</strong>
                      <p>{moment.detail}</p>
                      <div className="mk3-demo-story-event-meta">
                        <i />
                        <b>{momentIndex + 1}/4</b>
                        <small>{beat.signals[moment.signalIndex]?.label || "Room flow"}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="mk3-demo-story-stage">
            <div className={`mk3-demo-story-stage-frame is-${activeBeat.stageVariant}`}>
              <div className="mk3-demo-story-glow mk3-demo-story-glow-one" />
              <div className="mk3-demo-story-glow mk3-demo-story-glow-two" />
              <div className={`mk3-demo-story-sweep is-${activeBeat.mood || "cyan"}`} />
              <div className="mk3-demo-story-orbit mk3-demo-story-orbit-one" />
              <div className="mk3-demo-story-orbit mk3-demo-story-orbit-two" />
              <div className="mk3-demo-story-stage-header">
                <div>
                  <span>Conceptual system map</span>
                  <strong>{activeAbstractEvent?.title || activeBeat.title}</strong>
                </div>
                <div className="mk3-demo-story-stage-meta">
                  <span>Scene step</span>
                  <strong>{activeAbstractMomentIndex + 1} of {activeAbstractMoments.length || 4}</strong>
                </div>
              </div>
              <div className="mk3-demo-story-stage-callout">
                <span>{activeAbstractEvent?.kicker || "moment 01"}</span>
                <strong>{activeAbstractEvent?.detail || activeBeat.body}</strong>
              </div>
              <div className="mk3-demo-story-signal-layer" aria-hidden="true">
                {activeBeat.signals.map((signal) => (
                  <div
                    key={`${activeBeat.id}_${signal.from}_${signal.to}_${signal.label}`}
                    className={`mk3-demo-story-signal mk3-demo-story-signal-${signal.from}-${signal.to}${activeAbstractSignal?.label === signal.label ? " is-active" : ""}`}
                  >
                    <i />
                    <span>{signal.label}</span>
                  </div>
                ))}
              </div>
              <div className="mk3-demo-story-scene-progress">
                {activeAbstractMoments.map((moment) => (
                  <b key={moment.id} className={activeAbstractEvent?.id === moment.id ? "is-active" : ""} />
                ))}
              </div>

              <article className={`mk3-demo-story-screen mk3-demo-story-screen-host${activeAbstractSource === "host" ? " is-source" : ""}${activeAbstractTarget === "host" ? " is-target" : ""}`}>
                <span>Host Deck</span>
                <strong>{activeAbstractEvent?.host || activeBeat.notes.host}</strong>
                <div className="mk3-demo-story-host-search">
                  <span>Origin move</span>
                  <strong>{activeAbstractSignal?.label || "Room cue"}</strong>
                </div>
                <div className="mk3-demo-story-host-queue">
                  <span>What the host changes</span>
                  <div className="mk3-demo-story-host-queue-list">
                    {activeBeat.signals.map((signal) => (
                      <article key={`${activeBeat.id}_${signal.label}`} className={activeAbstractSignal?.label === signal.label ? "is-active" : ""}>
                        <strong>{signal.label}</strong>
                        <span>{ABSTRACT_SURFACES[signal.to]?.label || signal.to}</span>
                      </article>
                    ))}
                  </div>
                </div>
                <p className="mk3-demo-story-surface-note">One deliberate input changes the whole room state.</p>
              </article>

              <article className={`mk3-demo-story-screen mk3-demo-story-screen-tv${activeAbstractSource === "tv" ? " is-source" : ""}${activeAbstractTarget === "tv" ? " is-target" : ""}`}>
                <div className="mk3-demo-story-tv-stage">
                  <div className="mk3-demo-story-tv-badge">
                    <span>Public TV</span>
                    <strong>{activeAbstractEvent?.kicker || activeBeat.kicker}</strong>
                  </div>
                  <div className="mk3-demo-story-tv-headline">
                    <strong>{activeAbstractEvent?.tv || activeBeat.notes.tv}</strong>
                  </div>
                  <div className="mk3-demo-story-tv-lyrics">
                    {activeBeat.signals.slice(0, 3).map((signal) => (
                      <p key={`${activeBeat.id}_tv_${signal.label}`} className={activeAbstractSignal?.label === signal.label ? "is-active" : ""}>{signal.label}</p>
                    ))}
                  </div>
                  <div className="mk3-demo-story-tv-meter">
                    <span>Shared room state</span>
                    <i style={{ width: `${36 + activeAbstractBeatIndex * 10 + activeAbstractMomentIndex * 11}%` }} />
                  </div>
                </div>
                <p className="mk3-demo-story-surface-note">TV translates system changes into one visible room moment.</p>
              </article>

              <article className={`mk3-demo-story-screen mk3-demo-story-screen-phone${activeAbstractSource === "audience" ? " is-source" : ""}${activeAbstractTarget === "audience" ? " is-target" : ""}`}>
                <span>Audience App</span>
                <strong>{activeAbstractEvent?.audience || activeBeat.notes.audience}</strong>
                <p className="mk3-demo-story-phone-copy">
                  Lightweight prompts, reactions, and mode-specific controls make the crowd part of the night.
                </p>
                <div className="mk3-demo-story-phone-votes" aria-hidden="true">
                  {activeBeat.bullets.map((item, index) => (
                    <button key={`${activeBeat.id}_${item}`} type="button" tabIndex={-1} className={index === activeAbstractMomentIndex % activeBeat.bullets.length ? "is-active" : ""}>{item}</button>
                  ))}
                </div>
                <div className="mk3-demo-story-phone-request">
                  <span>Audience effect</span>
                  <strong>{activeAbstractSignal?.to === "audience" || activeAbstractSignal?.from === "audience" ? activeAbstractSignal?.label : activeBeat.signals[1]?.label || "Shared response"}</strong>
                </div>
                <div className="mk3-demo-story-phone-score">
                  <span>Collective role</span>
                  <strong>{ABSTRACT_SURFACES.audience.label}</strong>
                </div>
              </article>

              <article className={`mk3-demo-story-screen mk3-demo-story-screen-singer${activeAbstractSource === "singer" ? " is-source" : ""}${activeAbstractTarget === "singer" ? " is-target" : ""}`}>
                <span>Singer Cue</span>
                <strong>{activeAbstractEvent?.singer || activeBeat.notes.singer}</strong>
                <div className="mk3-demo-story-singer-meter">
                  <span>Confidence</span>
                  <i style={{ width: `${42 + activeAbstractBeatIndex * 8 + activeAbstractMomentIndex * 9}%` }} />
                </div>
                <p className="mk3-demo-story-surface-note">
                  The performer always knows whether to lead, wait, or hand off.
                </p>
              </article>
            </div>

            <div className="mk3-demo-story-flow-grid">
              {activeBeat.signals.map((signal) => (
                <article key={`${activeBeat.id}_${signal.from}_${signal.to}_${signal.label}`} className={`mk3-demo-story-flow-card${activeAbstractSignal?.label === signal.label ? " is-active" : ""}`}>
                  <span>{ABSTRACT_SURFACES[signal.from]?.short} to {ABSTRACT_SURFACES[signal.to]?.short}</span>
                  <strong>{signal.label}</strong>
                  <p>
                    {ABSTRACT_SURFACES[signal.from]?.label} pushes a change that lands on {ABSTRACT_SURFACES[signal.to]?.label}.
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </article>
      )}

      {isAutoPage && (
      <article className="mk3-demo-guided">
        <div className="mk3-demo-guided-intro">
          <div className="mk3-chip">auto demo</div>
          <h2>Auto-play six sellable moments across the actual host, TV, and audience UI.</h2>
          <p>Use one obvious tap prompt at a time so viewers can follow the action without participating.</p>
        </div>

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
          <span>{formatClock(totalSceneElapsedMs)} / {formatClock(WALKTHROUGH_TOTAL_MS)}</span>
        </div>

        <div className="mk3-demo-guided-status">
          <div>
            <span>{activeScene.kicker}</span>
            <strong>{activeScene.label}</strong>
          </div>
          <div>
            <span>scene progress</span>
            <strong>{scenePercent}%</strong>
          </div>
          <div>
            <span>next scene</span>
            <strong>{nextScene?.label || "Loop to Scene 01"}</strong>
          </div>
        </div>

        <div className="mk3-demo-guided-progress">
          <i style={{ width: `${Math.min(100, (totalSceneElapsedMs / WALKTHROUGH_TOTAL_MS) * 100)}%` }} />
        </div>

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

        <div className="mk3-demo-guided-summary">
          <strong>{activeScene.headline}</strong>
          <div className="mk3-demo-guided-summary-pills">
            {activeScene.callouts.map((callout) => (
              <span key={`${activeScene.id}_${callout.title}`}>{callout.title}</span>
            ))}
          </div>
        </div>
        <div className="mk3-demo-guided-tap-coach">
          <span>{tapCoach.title}</span>
          <strong>{tapCoach.prompt}</strong>
          <p>{tapCoach.detail}</p>
        </div>

        <div className="mk3-demo-shell mk3-demo-shell-testing">
          <article className="mk3-demo-surface mk3-demo-host">
            <header>
              <span>Host Deck</span>
              <strong>{activeScene.host.panel}</strong>
            </header>
            <div className="mk3-demo-surface-kicker">
              <span>{activeScene.host.status}</span>
              <strong>{activeScene.host.actionLabel}</strong>
            </div>
            <div className="mk3-demo-surface-pill-row">
              <span>Actual host UI</span>
              <span>Scene {sceneNumber}</span>
              <span>{activeScene.kicker}</span>
            </div>
            <div className="mk3-demo-frame-wrap mk3-demo-host-frame-wrap">
              <DemoHostRoomShell
                roomCode={DEMO_ROOM_CODE}
                activeScene={activeScene}
                hostTypedSearch={hostTypedSearch}
                hostResults={hostResults}
                queueSnapshot={queueSnapshot}
                hostControlProgress={hostControlProgress}
                hostFocusFrame={hostFocusFrame}
                hostCursorStyle={hostCursorStyle}
                tapCoach={tapCoach}
              />
            </div>
            <div className="mk3-demo-surface-status">
              <span>The host action stays legible, so every downstream change feels caused.</span>
              <strong>{activeScene.host.actionLabel}</strong>
            </div>
          </article>

          <article className={`mk3-demo-surface mk3-demo-tv is-${tvSurfaceVariant}`}>
            <header>
              <span>Public TV</span>
              <strong>{activeScene.tv.mode}</strong>
            </header>
            <div className="mk3-demo-surface-kicker">
              <span>{activeScene.tv.footer}</span>
              <strong>{activeScene.tv.title}</strong>
            </div>
            <div className="mk3-demo-surface-pill-row">
              <span>Actual TV UI</span>
              <span>{activeScene.singer.name} live context</span>
              <span>{totalConnectedLabel}</span>
            </div>
            <div className="mk3-demo-frame-wrap mk3-demo-tv-frame-wrap">
              <DemoTvRoomShell
                roomCode={DEMO_ROOM_CODE}
                activeScene={activeScene}
                activeLyric={activeLyric}
                nextLyric={nextLyric}
                totalConnectedLabel={totalConnectedLabel}
                reactionItems={reactionItems}
                triviaRows={triviaRows}
                roomEnergy={roomEnergy}
                tvFocusFrame={tvFocusFrame}
                formatClockLabel={formatClock(totalSceneElapsedMs)}
                tvSurfaceVariant={tvSurfaceVariant}
                tapCoach={tapCoach}
              />
            </div>
            <div className="mk3-demo-surface-status">
              <span>The TV makes the shared moment obvious for the whole room.</span>
              <strong>{activeScene.tv.mode}</strong>
            </div>
          </article>

          <article className="mk3-demo-surface mk3-demo-audience">
            <header>
              <span>Audience App</span>
              <strong>{activeScene.audience.title}</strong>
            </header>
            <div className="mk3-demo-surface-kicker">
              <span>{activeScene.audience.subtitle}</span>
              <strong>{activeScene.audience.metricValue}</strong>
            </div>
            <div className="mk3-demo-surface-pill-row">
              <span>Room code ready</span>
              <span>{activeScene.kicker}</span>
              <span>{activeScene.audience.metricLabel}</span>
            </div>
            <div className="mk3-demo-frame-wrap mk3-demo-audience-frame-wrap">
              <div className="mk3-demo-phone-shell">
                <div className="mk3-demo-phone-notch" />
                <div className="mk3-demo-phone-screen">
                  <DemoAudienceRoomShell
                    roomCode={DEMO_ROOM_CODE}
                    activeScene={activeScene}
                    activeActionIndex={activeActionIndex}
                    activeFeedIndex={activeFeedIndex}
                    audienceTapStyle={audienceTapStyle}
                    audienceFocusFrame={audienceFocusFrame}
                    tapCoach={tapCoach}
                  />
                </div>
              </div>
            </div>
            <div className="mk3-demo-surface-status">
              <span>Audience input stays lightweight, but the room reacts visibly.</span>
              <strong>{activeScene.audience.metricValue}</strong>
            </div>
          </article>
        </div>

        <div className="mk3-demo-guided-callouts">
          {activeScene.callouts.map((callout) => (
            <article key={`${activeScene.id}_${callout.title}`}>
              <span>{callout.title}</span>
              <strong>{callout.detail}</strong>
            </article>
          ))}
        </div>

        <div className="mk3-demo-guided-outro">
          <div>
            <span>Positioning note</span>
            <strong>This auto demo is simulated product choreography, not a live room embed.</strong>
          </div>
          <p>
            That keeps the sales story stable, removes sizing and layering failures from real iframes, and avoids
            the continuous reads and writes the current implementation creates.
          </p>
          <div className="mk3-demo-guided-outro-actions">
            {typeof navigate === "function" && (
              <>
                <button type="button" onClick={() => navigate("for_hosts")}>See Host Story</button>
                <button type="button" onClick={() => navigate("discover")}>Explore Discovery</button>
              </>
            )}
          </div>
        </div>
      </article>
      )}
    </section>
  );
};

export default DemoExperiencePage;
