import React, { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";

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

const getAudienceRoster = (activeIndex = 0, singerName = "") => {
  const names = ["Alex", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Sky", "Jules"];
  return names.map((name, index) => ({
    label: name,
    live: index <= activeIndex + 3 || name === singerName,
  }));
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

const DemoExperiencePage = ({ navigate }) => {
  const [timelineMs, setTimelineMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [activeAbstractBeat, setActiveAbstractBeat] = useState(0);
  const abstractStepRefs = useRef([]);

  useEffect(() => {
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
  }, [playing]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") return undefined;
    const nodes = abstractStepRefs.current.filter(Boolean);
    if (!nodes.length) return undefined;
    let frameId = 0;
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
      if (!visible.length) return;
      const nextIndex = clampNumber(visible[0].target.dataset.storyIndex, 0, ABSTRACT_BEATS.length - 1, 0);
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setActiveAbstractBeat((prev) => (prev === nextIndex ? prev : nextIndex));
      });
    }, {
      threshold: [0.28, 0.5, 0.72],
      rootMargin: "-12% 0px -18% 0px",
    });
    nodes.forEach((node) => observer.observe(node));
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  const sceneState = useMemo(() => getSceneAtMs(timelineMs), [timelineMs]);
  const activeScene = sceneState.scene;
  const sceneProgress = sceneState.progress;
  const activeBeat = ABSTRACT_BEATS[activeAbstractBeat] || ABSTRACT_BEATS[0];
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
  const singerMeter = 42 + Math.round(sceneProgress * 44);
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
  const audienceRoster = useMemo(
    () => getAudienceRoster(activeActionIndex, activeScene.singer.name),
    [activeActionIndex, activeScene.singer.name]
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
  const activeLyric = activeScene.tv.lines[activeTvLineIndex] || activeScene.tv.lines[0] || "";
  const nextLyric = activeScene.tv.lines[Math.min(activeScene.tv.lines.length - 1, activeTvLineIndex + 1)] || "";
  const totalConnectedLabel = activeScene.id === "join_identity" ? "08 joined" : activeScene.audience.metricValue;

  useEffect(() => {
    trackEvent("mk_demo_scene_view", {
      scene: activeScene.id,
      label: activeScene.label,
    });
  }, [activeScene.id, activeScene.label]);

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
          <div className="mk3-chip">demo redesign</div>
          <h1>Concept first. Product choreography second.</h1>
          <p>
            The top section stays conceptual so the system is easy to read. The section below uses local-only UI
            simulations to auto-play six synchronized product moments without touching the live app or the database.
          </p>
        </div>
        <div className="mk3-demo-sales-hero-pills">
          <span>Abstract story</span>
          <span>Auto demo</span>
          <span>Actual-looking product UI</span>
          <span>Zero live reads or writes</span>
        </div>
      </article>

      <article className="mk3-demo-story">
        <div className="mk3-demo-story-intro">
          <div className="mk3-chip">abstract demo</div>
          <h2>Show the system logic before viewers start parsing product screens.</h2>
          <p>
            This layer should feel like motion design, not like someone paused a live room. The job is to show how
            one host move ripples through TV, audience, and singer.
          </p>
        </div>
        <div className="mk3-demo-story-grid">
          <div className="mk3-demo-story-steps">
            {ABSTRACT_BEATS.map((beat, index) => (
              <article
                key={beat.id}
                ref={(node) => {
                  abstractStepRefs.current[index] = node;
                }}
                data-story-index={index}
                className={`mk3-demo-story-step${activeAbstractBeat === index ? " is-active" : ""}`}
              >
                <span>{beat.kicker}</span>
                <h3>{beat.title}</h3>
                <p>{beat.body}</p>
                <div className="mk3-demo-story-bullets">
                  {beat.bullets.map((item) => (
                    <strong key={`${beat.id}_${item}`}>{item}</strong>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="mk3-demo-story-stage">
            <div className={`mk3-demo-story-stage-frame is-${activeBeat.stageVariant}`}>
              <div className="mk3-demo-story-glow mk3-demo-story-glow-one" />
              <div className="mk3-demo-story-glow mk3-demo-story-glow-two" />
              <div className="mk3-demo-story-stage-header">
                <div>
                  <span>Conceptual system map</span>
                  <strong>{activeBeat.title}</strong>
                </div>
                <div className="mk3-demo-story-stage-meta">
                  <span>Active emphasis</span>
                  <strong>{ABSTRACT_SURFACES[activeBeat.activeSurface]?.label || "Host Deck"}</strong>
                </div>
              </div>

              <article className="mk3-demo-story-screen mk3-demo-story-screen-host">
                <span>Host Deck</span>
                <strong>{activeBeat.notes.host}</strong>
                <div className="mk3-demo-story-host-search">
                  <span>Origin move</span>
                  <strong>{activeBeat.signals[0]?.label || "Room cue"}</strong>
                </div>
                <div className="mk3-demo-story-host-queue">
                  <span>What the host changes</span>
                  <div className="mk3-demo-story-host-queue-list">
                    {activeBeat.signals.map((signal) => (
                      <article key={`${activeBeat.id}_${signal.label}`}>
                        <strong>{signal.label}</strong>
                        <span>{ABSTRACT_SURFACES[signal.to]?.label || signal.to}</span>
                      </article>
                    ))}
                  </div>
                </div>
                <p className="mk3-demo-story-surface-note">One deliberate input changes the whole room state.</p>
              </article>

              <article className="mk3-demo-story-screen mk3-demo-story-screen-tv">
                <div className="mk3-demo-story-tv-stage">
                  <div className="mk3-demo-story-tv-badge">
                    <span>Public TV</span>
                    <strong>{activeBeat.kicker}</strong>
                  </div>
                  <div className="mk3-demo-story-tv-headline">
                    <strong>{activeBeat.notes.tv}</strong>
                  </div>
                  <div className="mk3-demo-story-tv-lyrics">
                    {activeBeat.signals.slice(0, 3).map((signal) => (
                      <p key={`${activeBeat.id}_tv_${signal.label}`}>{signal.label}</p>
                    ))}
                  </div>
                  <div className="mk3-demo-story-tv-meter">
                    <span>Shared room state</span>
                    <i style={{ width: `${38 + activeAbstractBeat * 18}%` }} />
                  </div>
                </div>
                <p className="mk3-demo-story-surface-note">TV translates system changes into one visible room moment.</p>
              </article>

              <article className="mk3-demo-story-screen mk3-demo-story-screen-phone">
                <span>Audience App</span>
                <strong>{activeBeat.notes.audience}</strong>
                <p className="mk3-demo-story-phone-copy">
                  Lightweight prompts, reactions, and mode-specific controls make the crowd part of the night.
                </p>
                <div className="mk3-demo-story-phone-votes" aria-hidden="true">
                  {activeBeat.bullets.map((item) => (
                    <button key={`${activeBeat.id}_${item}`} type="button" tabIndex={-1}>{item}</button>
                  ))}
                </div>
                <div className="mk3-demo-story-phone-request">
                  <span>Audience effect</span>
                  <strong>{activeBeat.signals[1]?.label || "Shared response"}</strong>
                </div>
                <div className="mk3-demo-story-phone-score">
                  <span>Collective role</span>
                  <strong>{ABSTRACT_SURFACES.audience.label}</strong>
                </div>
              </article>

              <article className="mk3-demo-story-screen mk3-demo-story-screen-singer">
                <span>Singer Cue</span>
                <strong>{activeBeat.notes.singer}</strong>
                <div className="mk3-demo-story-singer-meter">
                  <span>Confidence</span>
                  <i style={{ width: `${48 + activeAbstractBeat * 11}%` }} />
                </div>
                <p className="mk3-demo-story-surface-note">
                  The performer always knows whether to lead, wait, or hand off.
                </p>
              </article>
            </div>

            <div className="mk3-demo-story-flow-grid">
              {activeBeat.signals.map((signal) => (
                <article key={`${activeBeat.id}_${signal.from}_${signal.to}_${signal.label}`} className="mk3-demo-story-flow-card">
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

      <article className="mk3-demo-guided">
        <div className="mk3-demo-guided-intro">
          <div className="mk3-chip">auto demo</div>
          <h2>Auto-play six sellable moments with simulated typing, clicks, taps, and mode shifts.</h2>
          <p>
            This is a deterministic sales tool, not a live lab. The screen shells below are local-only simulations
            of the product UI, driven by the same six-scene script every time.
          </p>
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
          <p>{activeScene.summary}</p>
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
              <span>Simulated host UI</span>
              <span>Scene {sceneNumber}</span>
              <span>{activeScene.kicker}</span>
            </div>
            <div className="mk3-demo-frame-wrap mk3-demo-host-frame-wrap">
              <div className="mk3-demo-host-sim mk3-demo-host-stage">
                <div className="mk3-demo-host-top-row">
                  <span>room live</span>
                  <span>{activeScene.label}</span>
                  <span>{activeScene.singer.name} on deck</span>
                </div>
                <div className="mk3-demo-host-search-panel">
                  <span>Workspace</span>
                  <strong>{activeScene.host.panel}</strong>
                  <div className="mk3-demo-host-search-input">
                    <span>{activeScene.host.search ? "Catalog search" : "Primary action"}</span>
                    <strong>{activeScene.host.search ? (hostTypedSearch || " ") : activeScene.host.actionLabel}</strong>
                    {activeScene.host.search && <i />}
                  </div>
                </div>
                <div className="mk3-demo-host-result-list">
                  {hostResults.map((result, index) => (
                    <article key={`${activeScene.id}_${result.title}`} className={index === 0 ? "is-primary" : ""}>
                      <div>
                        <strong>{result.title}</strong>
                        <span>{result.meta}</span>
                      </div>
                      <b>{result.state}</b>
                    </article>
                  ))}
                </div>
                <div className="mk3-demo-host-queue-stack">
                  <span>Live queue</span>
                  <div className="mk3-demo-story-host-queue-list">
                    {queueSnapshot.map((entry) => (
                      <article key={`${activeScene.id}_${entry.title}`}>
                        <strong>{entry.title}</strong>
                        <span>{entry.meta}</span>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="mk3-demo-host-controls">
                  {activeScene.host.controls.map((control, index) => (
                    <button
                      key={`${activeScene.id}_${control}`}
                      type="button"
                      className={index === activeScene.host.activeControl && hostControlProgress > 0.22 ? "active" : ""}
                      tabIndex={-1}
                    >
                      {control}
                    </button>
                  ))}
                </div>
                <div className="mk3-demo-host-tooltip">
                  <span className="mk3-demo-host-tooltip-kicker">Viewer takeaway</span>
                  <strong>{activeScene.host.actionCopy}</strong>
                  <p>{activeScene.summary}</p>
                  <div className="mk3-demo-host-tooltip-result">{activeScene.callouts[0]?.detail}</div>
                </div>
                <div className="mk3-demo-host-actions-mini">
                  <span className="active">Host</span>
                  <span className={roomEnergy > 44 ? "active" : ""}>TV</span>
                  <span className={activeActionIndex > 0 ? "active" : ""}>Audience</span>
                  <span className={singerMeter > 58 ? "active" : ""}>Singer</span>
                </div>
                <div className="mk3-demo-host-stats">
                  <div>
                    <span>scene progress</span>
                    <strong>{scenePercent}%</strong>
                  </div>
                  <div>
                    <span>room energy</span>
                    <strong>{roomEnergy}</strong>
                  </div>
                  <div>
                    <span>singer ready</span>
                    <strong>{singerMeter}%</strong>
                  </div>
                </div>
                <div className="mk3-demo-sim-cursor is-host" style={hostCursorStyle}>
                  <span>{activeScene.host.search ? "type" : "click"}</span>
                </div>
              </div>
            </div>
            <div className="mk3-demo-surface-status">
              <span>Host action remains readable, so every downstream change feels caused instead of random.</span>
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
              <span>Shared room state</span>
              <span>{activeScene.singer.name} live context</span>
              <span>{totalConnectedLabel}</span>
            </div>
            <div className="mk3-demo-frame-wrap mk3-demo-tv-frame-wrap">
              <div className="mk3-demo-tv-overlay">
                <div className="mk3-demo-tv-badges">
                  <span>Public TV</span>
                  <strong>{activeScene.label}</strong>
                </div>
                <div className={`mk3-demo-beat-light${sceneProgress > 0.22 ? " is-live" : ""}`} />
                <div className="mk3-demo-tv-stage">
                  <div className="mk3-demo-tv-singer-card">
                    <span>{activeScene.singer.name}</span>
                    <strong>{activeScene.singer.prompt}</strong>
                  </div>
                  {activeScene.id === "trivia_break" ? (
                    <div className="mk3-demo-trivia">
                      <span>{activeScene.tv.mode}</span>
                      <strong>{activeScene.tv.title}</strong>
                      <div className="mk3-demo-trivia-options">
                        {triviaRows.map((row) => (
                          <div key={`${activeScene.id}_${row.label}`} className={`mk3-demo-trivia-option${row.highlight ? " is-highlight" : ""}`}>
                            <span>{row.label}</span>
                            <div className="mk3-demo-trivia-bar">
                              <div style={{ width: `${Math.min(100, row.value)}%` }} />
                            </div>
                            <b>{row.value}%</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={`mk3-demo-lyrics${activeScene.id === "guitar_vibe_sync" ? " is-instrumental" : ""}`}>
                      <div className="mk3-demo-lyric-meta">
                        <span>{activeScene.tv.mode}</span>
                        <span>{formatClock(totalSceneElapsedMs)}</span>
                      </div>
                      <p className="mk3-demo-tv-lyric-active">{activeLyric}</p>
                      <p className="mk3-demo-tv-lyric-next">{nextLyric}</p>
                      <p className="mk3-demo-tv-mode-note">{activeScene.tv.footer}</p>
                    </div>
                  )}
                  <div className="mk3-demo-vibe-meter">
                    <span>Room energy</span>
                    <div>
                      <i style={{ width: `${roomEnergy}%` }} />
                    </div>
                  </div>
                  <div className="mk3-demo-reaction-rail">
                    {reactionItems.map((item) => (
                      <div key={`${activeScene.id}_${item.label}`} className="mk3-demo-reaction-item">
                        <span>{item.label.slice(0, 1)}</span>
                        <small>{item.count}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mk3-demo-surface-status">
              <span>TV makes the shared moment obvious for the whole room.</span>
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
                  <div className="mk3-demo-surface-body mk3-demo-audience-sim">
                    <div className="mk3-demo-phone-appbar">
                      <span>Audience App</span>
                      <strong>{activeScene.label}</strong>
                    </div>
                    <div className="mk3-demo-audience-identity-card">
                      <span>Signed in</span>
                      <strong>{activeScene.singer.name}</strong>
                      <p>{activeScene.singer.status}</p>
                    </div>
                    <div className="mk3-demo-audience-grid">
                      {audienceRoster.map((entry) => (
                        <div key={`${activeScene.id}_${entry.label}`} className={entry.live ? "online" : ""}>
                          {entry.label}
                        </div>
                      ))}
                    </div>
                    <div className="mk3-demo-mini-actions">
                      {activeScene.audience.actions.map((action, index) => (
                        <button
                          key={`${activeScene.id}_${action}`}
                          type="button"
                          className={index <= activeActionIndex ? "active" : ""}
                          tabIndex={-1}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                    <div className="mk3-demo-audience-feed">
                      {activeScene.audience.feed.map((item, index) => (
                        <div key={`${activeScene.id}_${item}`} className={index === activeFeedIndex ? "is-active" : ""}>
                          <strong>{index === activeFeedIndex ? "Live update" : "Queued"}</strong>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mk3-demo-audience-banner">
                      <span>{activeScene.audience.metricLabel}</span>
                      <strong>{activeScene.audience.metricValue}</strong>
                      <p>{activeScene.callouts[1]?.detail}</p>
                    </div>
                  </div>
                  <div className="mk3-demo-sim-tap" style={audienceTapStyle}>
                    <i />
                    <span>tap</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mk3-demo-surface-status">
              <span>Audience input looks lightweight, but it changes the room state visibly.</span>
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
    </section>
  );
};

export default DemoExperiencePage;
