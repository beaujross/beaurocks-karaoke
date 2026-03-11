import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { buildSurfaceUrl as buildCanonicalSurfaceUrl } from "../../../lib/surfaceDomains";

const DEMO_SCENES = [
  {
    id: "karaoke_kickoff",
    label: "Karaoke Kickoff",
    mode: "karaoke",
    durationMs: 28000,
    title: "Lyrics lead the room while audience joins in",
    description: "Karaoke stays front and center with a Sweet Caroline-style singalong moment.",
    songTitle: "Sweet Caroline",
    artist: "Classic Singalong (Demo Adaptation)",
    lyrics: [
      "Hands up high now, the whole room sways in time",
      "Voices rising, every table joins the line",
      "Call and answer, crowd glow left and right",
      "Big singalong energy all through the night"
    ],
    hostActions: [
      {
        id: "host_karaoke_mode",
        at: 0.14,
        control: "karaoke",
        label: "Host taps Karaoke Mode",
        explain: "Keep TV lyrics primary so new guests instantly understand what to do.",
        result: "TV locks into lyric-first mode with clear sing-along prompts.",
        pauseCue: true
      },
      {
        id: "host_wave_prompt",
        at: 0.58,
        control: "wave",
        label: "Host calls a Wave Tunnel warm-up",
        explain: "Invite everyone to send quick wave taps while the first verse builds.",
        result: "Audience reactions form a stabilizing energy bed for the next segment."
      }
    ],
    reactions: [
      { type: "clap", label: "Clap", seed: 2 },
      { type: "fire", label: "Fire", seed: 1 },
      { type: "heart", label: "Heart", seed: 1 },
      { type: "wow", label: "Wow", seed: 1 },
    ],
  },
  {
    id: "karaoke_singalong",
    label: "Karaoke Singalong",
    mode: "karaoke",
    durationMs: 24000,
    title: "Second karaoke pass with call-and-response",
    description: "This shows high-participation karaoke before switching into games.",
    songTitle: "Sweet Caroline",
    artist: "Classic Singalong (Demo Adaptation)",
    lyrics: [
      "One more chorus, crowd response in stereo",
      "Host keeps cadence while the phone reactions grow",
      "Verse to hook and everybody knows the cue",
      "Shared room anthem with a modern social view"
    ],
    hostActions: [
      {
        id: "host_queue_lock",
        at: 0.24,
        control: "queue",
        label: "Host bumps next singer into the queue",
        explain: "Queue movement is visible so people know their turn is coming.",
        result: "Audience sees momentum, not dead air."
      },
      {
        id: "host_echo_link",
        at: 0.64,
        control: "echo",
        label: "Host asks for Echo Ring links",
        explain: "Echo extends relay windows and keeps interaction chains alive.",
        result: "Relay timer stretches so more guests can join each pass."
      }
    ],
    reactions: [
      { type: "clap", label: "Clap", seed: 2 },
      { type: "fire", label: "Fire", seed: 2 },
      { type: "party", label: "Party", seed: 1 },
      { type: "cheer", label: "Cheer", seed: 2 },
    ],
  },
  {
    id: "guitar_vibe_sync",
    label: "Guitar Vibe Sync",
    mode: "guitar",
    durationMs: 22000,
    title: "Lyrics drop, crowd drives guitar mode",
    description: "When the solo hits, lyrics step back and audience strumming takes over.",
    songTitle: "Instrumental Break",
    artist: "BeauRocks Demo Band",
    hostActions: [
      {
        id: "host_guitar_toggle",
        at: 0.18,
        control: "guitar",
        label: "Host launches Guitar Vibe Sync",
        explain: "This flips from lyric mode to crowd strum gameplay instantly.",
        result: "Audience viewport shows strum controls and TV enters solo visuals.",
        pauseCue: true
      },
      {
        id: "host_laser_call",
        at: 0.62,
        control: "laser",
        label: "Host calls Laser Pop for power spikes",
        explain: "Laser gives the orb an aggressive energy jump mid-solo.",
        result: "TV effects punch harder while multiplier climbs."
      }
    ],
    reactions: [
      { type: "strum", label: "Strum", seed: 2 },
      { type: "fire", label: "Fire", seed: 1 },
      { type: "clap", label: "Clap", seed: 1 },
      { type: "cheer", label: "Cheer", seed: 1 },
    ],
  },
  {
    id: "vocal_game_challenge",
    label: "Vocal Game Challenge",
    mode: "vocal",
    durationMs: 22000,
    title: "Quick vocal mini-game between songs",
    description: "Shows game mode variety without losing the karaoke backbone.",
    songTitle: "Pitch Duel Interlude",
    artist: "BeauRocks Demo Band",
    lyrics: [
      "Hold the note and ride the line",
      "Pitch and timing, right on time",
      "Win the round then back to songs",
      "Game moments that still feel like karaoke"
    ],
    hostActions: [
      {
        id: "host_vocal_game",
        at: 0.22,
        control: "vocal",
        label: "Host triggers Vocal Game mode",
        explain: "A fast challenge keeps crowd attention during transitions.",
        result: "TV shows vocal objective while audience chases combo points."
      },
      {
        id: "host_confetti_push",
        at: 0.67,
        control: "confetti",
        label: "Host cues Confetti momentum burst",
        explain: "Confetti pushes streak steps so tiers climb visibly.",
        result: "Audience gets faster progression and bigger reward moments."
      }
    ],
    reactions: [
      { type: "vote", label: "Vote", seed: 1 },
      { type: "clap", label: "Clap", seed: 2 },
      { type: "party", label: "Party", seed: 2 },
      { type: "cheer", label: "Cheer", seed: 2 },
    ],
  },
  {
    id: "trivia_showdown",
    label: "Trivia Showdown",
    mode: "trivia",
    durationMs: 22000,
    title: "Switch from music to crowd trivia",
    description: "Audience votes pile up live, then the answer reveal lands.",
    songTitle: "Trivia Break",
    artist: "BeauRocks Demo Band",
    hostActions: [
      {
        id: "host_trivia_launch",
        at: 0.16,
        control: "trivia",
        label: "Host launches Trivia Showdown",
        explain: "Mid-show trivia keeps phones active without killing room energy.",
        result: "Audience votes stream in and reveal animates on TV."
      }
    ],
    trivia: {
      question: "Which surface keeps host, TV, and audience in sync?",
      options: ["Public TV", "Host Deck", "Audience App", "All three"],
      correctIndex: 3,
      votes: [18, 12, 14, 26],
    },
    reactions: [
      { type: "vote", label: "Vote", seed: 2 },
      { type: "wow", label: "Wow", seed: 1 },
      { type: "clap", label: "Clap", seed: 1 },
      { type: "cheer", label: "Cheer", seed: 1 },
    ],
  },
  {
    id: "wyr_split_decision_one",
    label: "Would You Rather I",
    mode: "wyr",
    durationMs: 18000,
    title: "Would You Rather starts with a fast crowd split",
    description: "Audience chooses sides live, then the winning side expands on reveal.",
    songTitle: "Would You Rather Pulse",
    artist: "BeauRocks Demo Band",
    hostActions: [
      {
        id: "host_wyr_launch_one",
        at: 0.18,
        control: "wyr",
        label: "Host launches Would You Rather",
        explain: "The question runs while music stays moving so the room never stalls.",
        result: "Audience picks A or B, then TV reveals the crowd split."
      },
      {
        id: "host_wyr_reveal_one",
        at: 0.7,
        control: "wyr",
        label: "Host reveals the first result",
        explain: "Reveal phase resolves the question and spotlights the larger side.",
        result: "Percentages lock in and the room gets instant payoff."
      }
    ],
    wyr: {
      question: "Would you rather open with a duet or start solo with the crowd singing backup?",
      optionA: "Open with a duet",
      optionB: "Start solo, crowd backup",
      votes: [28, 34],
      revealAt: 0.62,
      points: 50,
      durationSec: 18
    },
    reactions: [
      { type: "vote", label: "Vote", seed: 2 },
      { type: "party", label: "Party", seed: 1 },
      { type: "wow", label: "Wow", seed: 1 },
      { type: "cheer", label: "Cheer", seed: 1 },
    ],
  },
  {
    id: "wyr_split_decision_two",
    label: "Would You Rather II",
    mode: "wyr",
    durationMs: 18000,
    title: "Second Would You Rather proves repeatable format",
    description: "A fresh question shows this can run repeatedly between songs.",
    songTitle: "Would You Rather Pulse",
    artist: "BeauRocks Demo Band",
    hostActions: [
      {
        id: "host_wyr_launch_two",
        at: 0.16,
        control: "wyr",
        label: "Host fires a second WYR question",
        explain: "Running two rounds demonstrates variety, not a one-off gimmick.",
        result: "Audience re-engages instantly with a new social prompt."
      },
      {
        id: "host_wyr_reveal_two",
        at: 0.7,
        control: "wyr",
        label: "Host resolves the second result",
        explain: "Resolution keeps pace and closes the question with clarity.",
        result: "TV shows final split before returning to music-forward flow."
      }
    ],
    wyr: {
      question: "Would you rather control song order by crowd vote or let the host curate the full set?",
      optionA: "Crowd votes each round",
      optionB: "Host curates the full set",
      votes: [36, 30],
      revealAt: 0.62,
      points: 50,
      durationSec: 18
    },
    reactions: [
      { type: "vote", label: "Vote", seed: 2 },
      { type: "clap", label: "Clap", seed: 1 },
      { type: "party", label: "Party", seed: 1 },
      { type: "cheer", label: "Cheer", seed: 1 },
    ],
  },
  {
    id: "finale_drop",
    label: "Finale Drop",
    mode: "finale",
    durationMs: 24000,
    title: "Back to karaoke for the close",
    description: "Finish with lyrics, crowd effects, and one clear call to join a real room.",
    songTitle: "Sweet Caroline",
    artist: "Classic Singalong (Demo Adaptation)",
    lyrics: [
      "Final round now, everybody lean in close",
      "Host and audience lock into the biggest moment",
      "Find your next night and bring your whole crew back",
      "Sing it louder, then run that room right back"
    ],
    hostActions: [
      {
        id: "host_finale_fire",
        at: 0.2,
        control: "finale",
        label: "Host fires Finale mode",
        explain: "Stack visual energy while keeping the last hook singable.",
        result: "TV pushes high-energy finish and wraps with a join CTA.",
        pauseCue: true
      }
    ],
    reactions: [
      { type: "fire", label: "Fire", seed: 3 },
      { type: "cheer", label: "Cheer", seed: 3 },
      { type: "clap", label: "Clap", seed: 2 },
      { type: "party", label: "Party", seed: 2 },
    ],
  },
];

const DEMO_TOTAL_MS = DEMO_SCENES.reduce((sum, scene) => sum + scene.durationMs, 0);
const DEMO_ROOM_STORAGE_KEY = "mk_demo_room_code_v2";
const DEMO_VIEW_STORAGE_KEY = "mk_demo_view_mode_v1";
const DEMO_VIEW_MODES = Object.freeze({
  interactive: "interactive",
  autoplay: "autoplay",
});
const DEMO_HOST_BASE_PARAMS = Object.freeze({
  mode: "host",
  mkDemoEmbed: "1",
  hostUiVersion: "v2",
});
const DEMO_HOST_WORKSPACE_PRESETS = Object.freeze({
  catalog: Object.freeze({
    view: "queue",
    section: "queue.catalog",
    tab: "browse",
  }),
  stage: Object.freeze({
    view: "queue",
    section: "queue.live_run",
    tab: "stage",
  }),
  games: Object.freeze({
    view: "games",
    section: "games.live_controls",
    tab: "games",
  }),
});

const buildDemoHostParams = (workspace = "stage", extras = {}) => ({
  ...DEMO_HOST_BASE_PARAMS,
  ...(DEMO_HOST_WORKSPACE_PRESETS[workspace] || DEMO_HOST_WORKSPACE_PRESETS.stage),
  ...(extras || {}),
});
const DEMO_SCENE_SURFACE_PLANS = Object.freeze({
  karaoke_kickoff: {
    hostFocus: "Search and cue the opener",
    hostStatus: "The real host deck opens in Browse with a seeded search so the room starts with an actual catalog moment.",
    hostParams: buildDemoHostParams("catalog", {
      catalogue: "1",
      demo_search: "sweet caroline karaoke",
    }),
    audienceFocus: "Guests join and react",
    audienceStatus: "Audience phones join the room, warm up with reactions, and catch the first lyric prompt immediately.",
    tvFocus: "Lyrics and backing video lock in",
    tvStatus: "Public TV opens straight into lyric-first karaoke with backing media already rolling."
  },
  karaoke_singalong: {
    hostFocus: "Queue and now playing",
    hostStatus: "The host deck shifts to the live queue so the next singer handoff feels visible instead of hidden.",
    hostParams: buildDemoHostParams("stage"),
    audienceFocus: "Crowd singalong momentum",
    audienceStatus: "Audience reactions keep stacking while the room settles into the main singalong groove.",
    tvFocus: "Chorus energy on the big screen",
    tvStatus: "TV stays centered on the active singer, lyrics, and a room that already feels in motion."
  },
  guitar_vibe_sync: {
    hostFocus: "Live effects on deck",
    hostStatus: "The host stays on the live deck while Guitar Vibe Sync takes over and the room flips from lyrics to crowd play.",
    hostParams: buildDemoHostParams("stage"),
    audienceFocus: "Phones become instruments",
    audienceStatus: "Audience phones switch from passive viewing into strum controls and power spikes.",
    tvFocus: "Solo visuals replace lyrics",
    tvStatus: "The TV proves the room can pivot from karaoke into a crowd-driven instrument moment without losing energy."
  },
  vocal_game_challenge: {
    hostFocus: "Games workspace",
    hostStatus: "The host moves into the real Games view for a quick vocal challenge between songs.",
    hostParams: buildDemoHostParams("games"),
    audienceFocus: "Combo chase between singers",
    audienceStatus: "Audience players trade reaction spam for score chasing while the queue keeps moving.",
    tvFocus: "Mini-game interlude",
    tvStatus: "The TV shows a short game beat instead of dead air, then hands the room back to music."
  },
  trivia_showdown: {
    hostFocus: "Trivia round control",
    hostStatus: "The real host deck stays in Games and opens the trivia context so the scene reads like an intentional mode switch.",
    hostParams: buildDemoHostParams("games", {
      game: "trivia",
    }),
    audienceFocus: "Fast live voting",
    audienceStatus: "Audience phones turn into voting pads while the room keeps the same code and the same momentum.",
    tvFocus: "Question, votes, reveal",
    tvStatus: "The TV shows the voting window first, then pays it off with a proper reveal instead of a static card."
  },
  wyr_split_decision_one: {
    hostFocus: "Would You Rather round",
    hostStatus: "The host keeps the Games view open so the WYR round feels like a repeatable show tool, not a one-off stunt.",
    hostParams: buildDemoHostParams("games", {
      game: "wyr",
    }),
    audienceFocus: "Pick a side live",
    audienceStatus: "Audience phones split the room in real time while the music stays moving under the prompt.",
    tvFocus: "Crowd split in motion",
    tvStatus: "The TV turns a simple question into a live room poll with visible percentages and reveal timing."
  },
  wyr_split_decision_two: {
    hostFocus: "Repeatable social beat",
    hostStatus: "The host stays in the same WYR tool so the second round reads as fast, reusable format instead of setup work.",
    hostParams: buildDemoHostParams("games", {
      game: "wyr",
    }),
    audienceFocus: "Instant re-engagement",
    audienceStatus: "The second prompt proves people will jump back in quickly when the room flow is tight.",
    tvFocus: "Second reveal lands faster",
    tvStatus: "The TV shortens the payoff cycle so the repeated format still feels punchy instead of repetitive."
  },
  finale_drop: {
    hostFocus: "Back to the live deck",
    hostStatus: "The host returns to the live deck for the final singalong and a clean handoff into a real-room CTA.",
    hostParams: buildDemoHostParams("stage"),
    audienceFocus: "Encore reactions and join CTA",
    audienceStatus: "Audience phones come back to easy participation, bigger reactions, and a final push toward the join moment.",
    tvFocus: "Big singalong finish",
    tvStatus: "The TV closes on a familiar chorus, visible energy, and a clear sense of what the room feels like live."
  },
});

const getDemoSceneSurfacePlan = (scene = null) => {
  const sceneId = String(scene?.id || "").trim().toLowerCase();
  return DEMO_SCENE_SURFACE_PLANS[sceneId] || {
    hostFocus: "Live host deck",
    hostStatus: "The host surface stays on the real control deck for the current room state.",
    hostParams: buildDemoHostParams("stage"),
    audienceFocus: "Audience interaction live",
    audienceStatus: "Audience phones stay connected to the live room state for this scene.",
    tvFocus: "Public TV live",
    tvStatus: "The TV surface reflects the current room mode and media state."
  };
};

const getAutoplayHostSurfaceParams = (scene = null) => {
  return getDemoSceneSurfacePlan(scene).hostParams;
};
const REACTION_TOKENS = {
  clap: "CLAP",
  fire: "FIRE",
  heart: "HEART",
  wow: "WOW",
  party: "PARTY",
  cheer: "CHEER",
  strum: "STRUM",
  vote: "VOTE",
};

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

const normalizeRoomCode = (value = "") => {
  let token = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
  if (!token) return "DEMO001";
  if (!token.startsWith("DEMO")) {
    token = `DEMO${token}`.slice(0, 24);
  }
  return token;
};

const createDemoRoomCode = () => {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return normalizeRoomCode(`DEMO${stamp}${random}`);
};

const normalizeDemoViewMode = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === DEMO_VIEW_MODES.autoplay) return DEMO_VIEW_MODES.autoplay;
  return DEMO_VIEW_MODES.interactive;
};

const getInitialDemoViewMode = () => {
  if (typeof window === "undefined") return DEMO_VIEW_MODES.autoplay;
  try {
    const params = new URLSearchParams(window.location.search);
    const queryModeRaw = params.get("demo_view") || params.get("demoView") || "";
    if (queryModeRaw) return normalizeDemoViewMode(queryModeRaw);
    if (params.get("autoplay") === "1") return DEMO_VIEW_MODES.autoplay;
    const storedRaw = window.sessionStorage.getItem(DEMO_VIEW_STORAGE_KEY) || "";
    if (storedRaw) return normalizeDemoViewMode(storedRaw);
    return DEMO_VIEW_MODES.autoplay;
  } catch {
    return DEMO_VIEW_MODES.autoplay;
  }
};

const getInitialDemoRoomCode = () => {
  if (typeof window === "undefined") return "DEMO001";
  try {
    const stored = window.sessionStorage.getItem(DEMO_ROOM_STORAGE_KEY);
    if (stored) {
      const existing = normalizeRoomCode(stored);
      if (existing.startsWith("DEMO")) return existing;
    }
  } catch {
    // Ignore storage failures and generate a fresh code.
  }
  const generated = createDemoRoomCode();
  try {
    window.sessionStorage.setItem(DEMO_ROOM_STORAGE_KEY, generated);
  } catch {
    // Ignore storage failures in private mode.
  }
  return generated;
};

const TIMELINE = (() => {
  let cursor = 0;
  return DEMO_SCENES.map((scene) => {
    const startMs = cursor;
    const endMs = startMs + scene.durationMs;
    cursor = endMs;
    return { ...scene, startMs, endMs };
  });
})();

const getSceneAtMs = (timelineMs = 0) => {
  const safeMs = clampNumber(timelineMs, 0, DEMO_TOTAL_MS, 0);
  const scene = TIMELINE.find((entry) => safeMs >= entry.startMs && safeMs < entry.endMs) || TIMELINE[TIMELINE.length - 1];
  const sceneMs = Math.max(0, safeMs - scene.startMs);
  const sceneProgress = scene.durationMs > 0 ? sceneMs / scene.durationMs : 0;
  return {
    scene,
    sceneMs,
    sceneProgress,
  };
};

const buildReactionEvents = (scene, sceneProgress = 0) => {
  if (!scene || !Array.isArray(scene.reactions)) return [];
  return scene.reactions.map((entry, index) => ({
    type: String(entry.type || "clap").toLowerCase(),
    label: String(entry.label || entry.type || "Reaction"),
    token: REACTION_TOKENS[String(entry.type || "clap").toLowerCase()] || "HYPE",
    count: Math.max(1, Math.round(Number(entry.seed || 1) + (sceneProgress * 4) + ((index % 2) * 0.8))),
  }));
};

const getDemoAudienceStateLabel = (scene = null) => {
  const mode = String(scene?.mode || "karaoke").toLowerCase();
  if (mode === "guitar") return "Signed in and strumming";
  if (mode === "trivia") return "Signed in and voting";
  if (mode === "vocal") return "Signed in and chasing combo";
  if (mode === "wyr") return "Signed in and picking a side";
  if (mode === "finale") return "Signed in for the encore";
  return "Signed in and ready";
};

const getDemoAudienceActionLabel = (scene = null) => {
  const mode = String(scene?.mode || "karaoke").toLowerCase();
  if (mode === "guitar") return "Phones act like instruments";
  if (mode === "trivia") return "Phones become live vote pads";
  if (mode === "vocal") return "Phones react around the mini-game";
  if (mode === "wyr") return "Phones split the room instantly";
  if (mode === "finale") return "Phones push reactions to the finish";
  return "Phones join, react, and follow lyrics";
};

const getDemoHostWorkspaceLabel = (hostParams = {}) => {
  const section = String(hostParams?.section || "").trim().toLowerCase();
  if (section === "queue.catalog") return "Host panel in catalog";
  if (section === "games.live_controls") return "Host panel in games";
  return "Host panel in live run";
};

const buildSceneSignalFlows = ({
  scene = null,
  activeHostAction = null,
  surfacePlan = null,
  crowdSize = 0,
  interactionTotal = 0,
}) => {
  const mode = String(scene?.mode || "karaoke").toLowerCase();
  const sceneLabel = String(scene?.label || "Demo scene").trim();
  const defaultHostLabel = String(activeHostAction?.label || surfacePlan?.hostFocus || "Host steers the next beat").trim();
  const defaultHostDetail = String(activeHostAction?.result || surfacePlan?.hostStatus || "Host pushes the room into the next visible state.").trim();
  const audienceDetail = `${Math.max(1, interactionTotal)} scripted audience interactions from ${Math.max(1, crowdSize)} connected guests shape the room in this scene.`;
  const tvFeedback = String(surfacePlan?.tvStatus || "The TV reflects the room mode, prompts, and reveals live.").trim();

  if (mode === "guitar") {
    return [
      { lane: "Host -> TV", title: defaultHostLabel, detail: defaultHostDetail },
      { lane: "Audience -> TV", title: "Strums drive the solo visuals", detail: audienceDetail },
      { lane: "TV -> Audience", title: "The big screen cues the next input", detail: tvFeedback },
    ];
  }
  if (mode === "trivia" || mode === "wyr") {
    return [
      { lane: "Host -> Audience", title: defaultHostLabel, detail: defaultHostDetail },
      { lane: "Audience -> TV", title: `${sceneLabel} results build live`, detail: audienceDetail },
      { lane: "TV -> Audience", title: "Reveal timing comes from the shared screen", detail: tvFeedback },
    ];
  }
  if (mode === "vocal") {
    return [
      { lane: "Host -> TV", title: defaultHostLabel, detail: defaultHostDetail },
      { lane: "Audience -> Audience", title: "Phones feed combo pressure back into the room", detail: audienceDetail },
      { lane: "TV -> Audience", title: "The objective stays visible while scores move", detail: tvFeedback },
    ];
  }
  return [
    { lane: "Host -> TV", title: defaultHostLabel, detail: defaultHostDetail },
    { lane: "Audience -> TV", title: "Reactions and singalong energy stay visible", detail: audienceDetail },
    { lane: "TV -> Audience", title: "Lyrics and prompts tell phones what happens next", detail: tvFeedback },
  ];
};

const DEMO_STORY_BEATS = Object.freeze([
  {
    id: "host",
    kicker: "Step 01",
    title: "Start with the host panel.",
    body: "The night begins with one control surface that searches, queues, and lines up the room before the TV ever lights up.",
    bullets: [
      "Search songs and cue the first singer fast.",
      "Keep the queue visible instead of ad-hoc.",
      "Launch the room without extra setup friction."
    ],
    flows: [
      { lane: "Host -> Room", title: "One person sets the pace", detail: "The host decides what goes live first, so the room feels intentional immediately." },
      { lane: "Host -> Queue", title: "The next move stays visible", detail: "Guests can see momentum building instead of waiting for a mystery handoff." }
    ]
  },
  {
    id: "launch",
    kicker: "Step 02",
    title: "Then the host launches the public TV.",
    body: "As you move down the page, the host deck hands the spotlight to the big screen. That is the room handoff.",
    bullets: [
      "The TV becomes the shared focal point.",
      "Lyrics and media take over the wall.",
      "The host fades back into a steering role."
    ],
    flows: [
      { lane: "Host -> TV", title: "Launch the room", detail: "A host action changes what everyone sees together." },
      { lane: "TV -> Room", title: "The room understands the prompt", detail: "Big-screen lyrics make the next move obvious without explanation." }
    ]
  },
  {
    id: "perform",
    kicker: "Step 03",
    title: "Karaoke lands on the big screen.",
    body: "This is the singalong moment: clear lyrics, visible energy, and a room that feels more like an event than a playlist handoff.",
    bullets: [
      "Lyrics stay readable from across the room.",
      "Media and prompts keep the room in sync.",
      "The TV keeps everyone following the same beat."
    ],
    flows: [
      { lane: "TV -> Audience", title: "The screen cues the room", detail: "People know when to sing, clap, or jump in because the shared prompt is obvious." },
      { lane: "Audience -> TV", title: "Reaction energy feeds back", detail: "The shared screen reflects the room getting louder and more engaged." }
    ]
  },
  {
    id: "audience",
    kicker: "Step 04",
    title: "Audience phones push the moment higher.",
    body: "Once phones join the room, voting, reactions, and mini-games stop being side features and start shaping what happens on the TV.",
    bullets: [
      "Vote from the phone without breaking the song.",
      "See the score rise on the shared screen.",
      "Keep the whole room participating, not just the singer."
    ],
    flows: [
      { lane: "Audience -> TV", title: "Phone input changes the room live", detail: "Votes and reactions show up on the public screen instead of disappearing into a private app." },
      { lane: "TV -> Audience", title: "The TV rewards participation", detail: "The bigger screen makes every input feel public and worth doing." }
    ]
  },
  {
    id: "scale",
    kicker: "Step 05",
    title: "Then the ecosystem scales across the room.",
    body: "One host, one room code, many guests, and multiple displays. The point is not more UI. The point is a karaoke night that grows without getting harder to run.",
    bullets: [
      "Multiple phones can join at once.",
      "More than one display can echo the room state.",
      "The whole setup still feels simple from the couch."
    ],
    flows: [
      { lane: "Host -> Screens", title: "One control deck fans out", detail: "The same host panel can drive the main TV and supporting displays." },
      { lane: "Audience -> Screens", title: "Many guests feed one shared atmosphere", detail: "The room feels bigger as more people join the same live loop." }
    ]
  }
]);

const DEMO_STORY_SCENE_BY_BEAT = Object.freeze({
  host: "karaoke_kickoff",
  launch: "karaoke_kickoff",
  perform: "karaoke_singalong",
  audience: "trivia_showdown",
  scale: "finale_drop",
});

const DemoExperiencePage = ({ session = {} }) => {
  const isSessionReady = !!session?.ready;
  const hasCallableAuth = !!session?.isAuthed;
  const [demoViewMode, setDemoViewMode] = useState(() => getInitialDemoViewMode());
  const [timelineMs, setTimelineMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loopPlayback, setLoopPlayback] = useState(true);
  const [roomCode, setRoomCode] = useState(() => getInitialDemoRoomCode());
  const [liveSync, setLiveSync] = useState(() => getInitialDemoViewMode() === DEMO_VIEW_MODES.autoplay);
  const [autoPauseCues, setAutoPauseCues] = useState(false);
  const [audioBedEnabled, setAudioBedEnabled] = useState(false);
  const [, setBeatPulseTick] = useState(0);
  const [surfaceReloadToken, setSurfaceReloadToken] = useState(0);
  const [syncState, setSyncState] = useState({ tone: "muted", message: "Scripted sync warming up." });
  const [activeStoryBeat, setActiveStoryBeat] = useState(0);

  const latestStateRef = useRef(null);
  const inFlightRef = useRef(false);
  const lastTickBucketRef = useRef(-1);
  const lastSceneIdRef = useRef("");
  const lastSequenceRef = useRef(0);
  const demoShellRef = useRef(null);
  const autoRoomRetryRef = useRef(false);
  const cuePauseHistoryRef = useRef(new Set());
  const beatTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const previousTimelineMsRef = useRef(0);
  const storyStepRefs = useRef([]);
  const [iframeMountReady, setIframeMountReady] = useState(false);
  const [sceneShiftActive, setSceneShiftActive] = useState(true);
  const isAutoplayShowcase = demoViewMode === DEMO_VIEW_MODES.autoplay;
  const canRunLiveSync = isSessionReady && (hasCallableAuth || isAutoplayShowcase);

  useEffect(() => {
    if (iframeMountReady) return;
    const node = demoShellRef.current;
    if (!node || typeof window === "undefined") {
      setIframeMountReady(true);
      return;
    }
    if (typeof window.IntersectionObserver !== "function") {
      setIframeMountReady(true);
      return;
    }
    let cancelled = false;
    const reveal = () => {
      if (cancelled) return;
      setIframeMountReady(true);
    };
    const timeoutId = window.setTimeout(reveal, isAutoplayShowcase ? 900 : 1500);
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        reveal();
      }
    }, { root: null, rootMargin: "700px 0px", threshold: 0.01 });
    observer.observe(node);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [iframeMountReady, isAutoplayShowcase]);

  useEffect(() => {
    if (!playing) return () => {};
    let lastMs = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, now - lastMs);
      lastMs = now;
      setTimelineMs((prev) => {
        const next = prev + delta;
        if (next < DEMO_TOTAL_MS) return next;
        if (loopPlayback) return next % DEMO_TOTAL_MS;
        setPlaying(false);
        return DEMO_TOTAL_MS;
      });
    }, 180);
    return () => clearInterval(timer);
  }, [playing, loopPlayback]);

  const sceneState = useMemo(() => getSceneAtMs(timelineMs), [timelineMs]);
  const activeScene = sceneState.scene;
  const sceneProgress = sceneState.sceneProgress;
  const surfacePlan = useMemo(() => getDemoSceneSurfacePlan(activeScene), [activeScene]);

  useEffect(() => {
    setSceneShiftActive(true);
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => setSceneShiftActive(false), 950);
    return () => window.clearTimeout(timer);
  }, [activeScene.id]);

  const crowdSize = useMemo(() => {
    const base = activeScene.mode === "finale" ? 22 : activeScene.mode === "guitar" ? 18 : 16;
    return Math.round(base + (sceneProgress * 6));
  }, [activeScene.mode, sceneProgress]);

  const reactionEvents = useMemo(
    () => buildReactionEvents(activeScene, sceneProgress),
    [activeScene, sceneProgress]
  );

  const hostActions = useMemo(
    () => (Array.isArray(activeScene?.hostActions) ? activeScene.hostActions : []),
    [activeScene]
  );
  const activeHostAction = useMemo(() => {
    if (!hostActions.length) return null;
    let selected = hostActions[0];
    hostActions.forEach((action) => {
      const at = clampNumber(action?.at, 0, 1, 0);
      if (sceneProgress >= at) selected = action;
    });
    const index = hostActions.findIndex((entry) => entry?.id === selected?.id);
    return {
      ...selected,
      at: clampNumber(selected?.at, 0, 1, 0),
      index: Math.max(0, index),
      total: hostActions.length
    };
  }, [hostActions, sceneProgress]);

  const stageModeLabel = useMemo(() => {
    const mode = String(activeScene?.mode || "karaoke").toLowerCase();
    if (mode === "guitar") return "Guitar Vibe Sync";
    if (mode === "vocal") return "Vocal Game";
    if (mode === "trivia") return "Trivia";
    if (mode === "wyr") return "Would You Rather";
    if (mode === "finale") return "Finale";
    return "Karaoke";
  }, [activeScene]);
  const scenePercent = useMemo(() => Math.round(sceneProgress * 100), [sceneProgress]);
  const nextScene = useMemo(() => {
    const currentIndex = TIMELINE.findIndex((entry) => entry.id === activeScene.id);
    if (currentIndex < 0 || currentIndex >= TIMELINE.length - 1) return null;
    return TIMELINE[currentIndex + 1];
  }, [activeScene.id]);

  const triviaModel = useMemo(() => {
    if (activeScene.mode !== "trivia") return null;
    const model = activeScene.trivia || {
      question: "Which view helps hosts steer the room?",
      options: ["Audience", "TV", "Host", "All"],
      correctIndex: 2,
      votes: [6, 4, 11, 7],
    };
    const reveal = sceneProgress >= 0.72;
    const votes = model.options.map((_, index) => {
      const baseVotes = Number(model.votes?.[index] || 0);
      const scaled = Math.round(baseVotes * (0.35 + (sceneProgress * 0.65)));
      if (index === model.correctIndex) return scaled + Math.round(sceneProgress * 8);
      return scaled;
    });
    return {
      ...model,
      status: reveal ? "reveal" : "live",
      votes,
      questionId: `trivia_${Math.floor(activeScene.startMs / 1000)}`,
    };
  }, [activeScene, sceneProgress]);

  const wyrModel = useMemo(() => {
    if (activeScene.mode !== "wyr") return null;
    const model = activeScene.wyr || {
      question: "Would you rather warm up with a duet or a group chorus?",
      optionA: "Duet",
      optionB: "Group chorus",
      votes: [14, 16],
      revealAt: 0.62,
      points: 50,
      durationSec: 18
    };
    const revealAt = clampNumber(model.revealAt ?? 0.62, 0.5, 0.95, 0.62);
    const reveal = sceneProgress >= revealAt;
    const targetVotes = Array.isArray(model.votes) ? model.votes : [12, 10];
    const votes = [0, 1].map((index) => {
      const baseVotes = Number(targetVotes[index] || 0);
      const scaled = Math.round(baseVotes * (0.35 + (sceneProgress * 0.65)));
      return Math.max(0, scaled);
    });
    return {
      question: String(model.question || "").trim(),
      optionA: String(model.optionA || "Option A").trim(),
      optionB: String(model.optionB || "Option B").trim(),
      status: reveal ? "reveal" : "live",
      votes,
      questionId: `wyr_${Math.floor(activeScene.startMs / 1000)}`,
      points: clampNumber(model.points ?? 50, 10, 250, 50),
      durationSec: clampNumber(model.durationSec ?? 18, 8, 90, 18),
    };
  }, [activeScene, sceneProgress]);

  const sanitizedRoomCode = useMemo(() => normalizeRoomCode(roomCode), [roomCode]);
  const buildSceneSurfaceUrl = useCallback((surface = "app", params = {}) => {
    if (typeof window === "undefined") return "/";
    const url = new URL(buildCanonicalSurfaceUrl({
      surface,
      params: {
        room: sanitizedRoomCode,
        ...params
      }
    }, window.location));
    if (surfaceReloadToken > 0) {
      url.searchParams.set("mkDemoReload", String(surfaceReloadToken));
    } else {
      url.searchParams.delete("mkDemoReload");
    }
    return url.toString();
  }, [sanitizedRoomCode, surfaceReloadToken]);

  const hostLaunchParams = useMemo(() => (
    isAutoplayShowcase
      ? getAutoplayHostSurfaceParams(activeScene)
      : buildDemoHostParams("stage")
  ), [activeScene, isAutoplayShowcase]);

  const launchLinks = useMemo(() => ({
    audience: buildSceneSurfaceUrl("app", { mobile_layout: "native", mkDemoEmbed: "1" }),
    tv: buildSceneSurfaceUrl("tv", { mode: "tv", mkDemoEmbed: "1" }),
    host: buildSceneSurfaceUrl("host", hostLaunchParams),
  }), [buildSceneSurfaceUrl, hostLaunchParams]);

  const sceneInteractionTotal = useMemo(
    () => reactionEvents.reduce((sum, entry) => sum + Math.max(0, Number(entry.count || 0)), 0),
    [reactionEvents]
  );
  const demoSignalFlows = useMemo(() => buildSceneSignalFlows({
    scene: activeScene,
    activeHostAction,
    surfacePlan,
    crowdSize,
    interactionTotal: sceneInteractionTotal,
  }), [activeHostAction, activeScene, crowdSize, sceneInteractionTotal, surfacePlan]);
  const hostWorkspaceLabel = useMemo(
    () => getDemoHostWorkspaceLabel(hostLaunchParams),
    [hostLaunchParams]
  );
  const audienceStateLabel = useMemo(
    () => getDemoAudienceStateLabel(activeScene),
    [activeScene]
  );
  const audienceActionLabel = useMemo(
    () => getDemoAudienceActionLabel(activeScene),
    [activeScene]
  );
  const storyBeat = useMemo(
    () => DEMO_STORY_BEATS[activeStoryBeat] || DEMO_STORY_BEATS[0],
    [activeStoryBeat]
  );
  const storyScene = useMemo(() => {
    const targetSceneId = DEMO_STORY_SCENE_BY_BEAT[storyBeat.id] || TIMELINE[0].id;
    return TIMELINE.find((entry) => entry.id === targetSceneId) || TIMELINE[0];
  }, [storyBeat.id]);
  const storyHostParams = useMemo(() => {
    const baseParams = getAutoplayHostSurfaceParams(storyScene);
    const beatId = String(storyBeat.id || "").trim().toLowerCase();
    if (beatId === "host") {
      return {
        ...baseParams,
        tab: "browse",
        catalogue: "1",
      };
    }
    if (beatId === "audience") {
      return {
        ...buildDemoHostParams("games", { game: "trivia" }),
        tab: "games",
      };
    }
    return {
      ...baseParams,
      tab: baseParams?.tab || (baseParams?.section === "queue.catalog" ? "browse" : baseParams?.section === "games.live_controls" ? "games" : "stage"),
    };
  }, [storyBeat.id, storyScene]);
  const storyLaunchLinks = useMemo(() => ({
    audience: buildSceneSurfaceUrl("app", {
      mobile_layout: "native",
      mkDemoEmbed: "1",
      demoScene: storyScene.id,
    }),
    tv: buildSceneSurfaceUrl("tv", {
      mode: "tv",
      mkDemoEmbed: "1",
      demoScene: storyScene.id,
    }),
    host: buildSceneSurfaceUrl("host", {
      ...storyHostParams,
      demoScene: storyScene.id,
    }),
  }), [buildSceneSurfaceUrl, storyHostParams, storyScene.id]);
  const storyPerformanceScore = 72 + (activeStoryBeat * 9);
  const storyVoteScore = 38 + (activeStoryBeat * 14);
  const storyScaleCount = activeStoryBeat >= 4 ? 4 : activeStoryBeat >= 3 ? 2 : 1;
  const storyLyricLead = storyScene?.lyrics?.[0] || activeScene?.lyrics?.[0] || "Hands up high now, the whole room sways in time";
  const storyLyricNext = storyScene?.lyrics?.[1] || activeScene?.lyrics?.[1] || "Voices rising, every table joins the line";

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DEMO_ROOM_STORAGE_KEY, sanitizedRoomCode);
    } catch {
      // Ignore storage failures in private mode.
    }
  }, [sanitizedRoomCode]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DEMO_VIEW_STORAGE_KEY, demoViewMode);
    } catch {
      // Ignore storage failures in private mode.
    }
  }, [demoViewMode]);

  useEffect(() => {
    if (isAutoplayShowcase) return;
    if (!canRunLiveSync && liveSync) {
      setLiveSync(false);
      setSyncState({ tone: "muted", message: "Live Lab uses the native surfaces. Sign in to enable scripted sync controls." });
    }
  }, [canRunLiveSync, isAutoplayShowcase, liveSync]);

  useEffect(() => {
    autoRoomRetryRef.current = false;
  }, [sanitizedRoomCode]);

  useEffect(() => {
    if (timelineMs + 250 < previousTimelineMsRef.current) {
      cuePauseHistoryRef.current = new Set();
    }
    previousTimelineMsRef.current = timelineMs;
  }, [timelineMs]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const nodes = storyStepRefs.current.filter(Boolean);
    if (!nodes.length || typeof window.IntersectionObserver !== "function") return undefined;
    let frameId = 0;
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
      if (!visible.length) return;
      const nextIndex = clampNumber(visible[0].target.dataset.storyIndex, 0, DEMO_STORY_BEATS.length - 1, 0);
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setActiveStoryBeat((prev) => (prev === nextIndex ? prev : nextIndex));
      });
    }, {
      threshold: [0.32, 0.5, 0.7],
      rootMargin: "-10% 0px -18% 0px",
    });
    nodes.forEach((node) => observer.observe(node));
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  latestStateRef.current = {
    timelineMs,
    activeScene,
    sceneProgress,
    crowdSize,
    reactionEvents,
    triviaModel,
    wyrModel,
    playing,
    roomCode: sanitizedRoomCode,
  };

  const sendDirectorAction = useCallback(async (action = "tick", overrides = null) => {
    const snapshot = latestStateRef.current;
    if (!snapshot) return;
    if (inFlightRef.current && action === "tick") return;
    if (!isSessionReady || (!hasCallableAuth && !isAutoplayShowcase)) {
      setSyncState({ tone: "muted", message: "Waiting for secure session..." });
      return;
    }
    if (!snapshot.roomCode.startsWith("DEMO")) {
      setSyncState({ tone: "error", message: "Use a room code that starts with DEMO." });
      return;
    }
    inFlightRef.current = true;
    setSyncState({ tone: "muted", message: `Syncing ${action}...` });
    try {
      let sequence = Date.now();
      if (sequence <= lastSequenceRef.current) {
        sequence = lastSequenceRef.current + 1;
      }
      lastSequenceRef.current = sequence;
      const actionId = `${action}_${snapshot.activeScene.id}_${Math.round(snapshot.timelineMs)}_${sequence}`;
      const shouldSendReactionBursts = action === "bootstrap" || action === "scene" || action === "seek";
      const payload = {
        roomCode: snapshot.roomCode,
        action,
        actionId,
        sequence,
        sceneId: snapshot.activeScene.id,
        timelineMs: Math.round(snapshot.timelineMs),
        progress: snapshot.sceneProgress,
        playing: !!snapshot.playing,
        crowdSize: snapshot.crowdSize,
        reactionEvents: shouldSendReactionBursts
          ? snapshot.reactionEvents.map((entry, index) => ({
            type: entry.type,
            count: entry.count,
            userName: `Fan ${index + 1}`,
            avatar: ":)",
            uid: `demo_reactor_${index + 1}`,
          }))
          : [],
        trivia: snapshot.triviaModel
          ? {
            question: snapshot.triviaModel.question,
            options: snapshot.triviaModel.options,
            correctIndex: snapshot.triviaModel.correctIndex,
            status: snapshot.triviaModel.status,
            votes: snapshot.triviaModel.votes,
            questionId: snapshot.triviaModel.questionId,
            points: 100,
            durationSec: 22,
          }
          : null,
        wyr: snapshot.wyrModel
          ? {
            question: snapshot.wyrModel.question,
            optionA: snapshot.wyrModel.optionA,
            optionB: snapshot.wyrModel.optionB,
            status: snapshot.wyrModel.status,
            votes: snapshot.wyrModel.votes,
            questionId: snapshot.wyrModel.questionId,
            points: snapshot.wyrModel.points,
            durationSec: snapshot.wyrModel.durationSec,
          }
          : null,
        ...(overrides && typeof overrides === "object" ? overrides : {}),
      };
      const result = await directoryActions.runDemoDirectorAction(payload);
      if (result?.stale) {
        setSyncState({ tone: "muted", message: `Skipped stale ${action} action.` });
        return;
      }
      autoRoomRetryRef.current = false;
      setSyncState({ tone: "ok", message: `Synced ${action} at ${formatClock(snapshot.timelineMs)}.` });
    } catch (error) {
      const message = String(error?.message || "Live sync failed.");
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes("only demo room hosts can drive demo director sync")) {
        if (!autoRoomRetryRef.current) {
          autoRoomRetryRef.current = true;
          const replacement = createDemoRoomCode();
          setRoomCode(replacement);
          setSyncState({ tone: "muted", message: `Switched to ${replacement} to avoid room lock. Retrying sync...` });
          return;
        }
      }
      setSyncState({ tone: "error", message });
    } finally {
      inFlightRef.current = false;
    }
  }, [hasCallableAuth, isAutoplayShowcase, isSessionReady]);

  useEffect(() => {
    if (!liveSync) return;
    if (!isSessionReady || (!hasCallableAuth && !isAutoplayShowcase)) {
      setSyncState({ tone: "muted", message: "Waiting for secure session..." });
      return;
    }
    const snapshot = latestStateRef.current;
    const seedSceneId = snapshot?.activeScene?.id || TIMELINE[0].id;
    const seedTimelineMs = Number(snapshot?.timelineMs || 0);
    lastSceneIdRef.current = seedSceneId;
    lastTickBucketRef.current = Math.floor(seedTimelineMs / 4000);
    sendDirectorAction("bootstrap");
  }, [hasCallableAuth, isAutoplayShowcase, isSessionReady, liveSync, sanitizedRoomCode, sendDirectorAction]);

  useEffect(() => {
    if (!liveSync) return;
    if (lastSceneIdRef.current === activeScene.id) return;
    lastSceneIdRef.current = activeScene.id;
    sendDirectorAction("scene");
  }, [activeScene.id, liveSync, sendDirectorAction]);

  useEffect(() => {
    if (!liveSync || !playing) return;
    const bucket = Math.floor(timelineMs / 4000);
    if (bucket === lastTickBucketRef.current) return;
    lastTickBucketRef.current = bucket;
    sendDirectorAction("tick");
  }, [liveSync, playing, timelineMs, sendDirectorAction]);

  useEffect(() => {
    if (!autoPauseCues || !playing || !activeHostAction?.pauseCue) return;
    if (sceneProgress < Number(activeHostAction.at || 0)) return;
    const cueKey = `${activeScene.id}:${activeHostAction.id || activeHostAction.index || 0}`;
    if (cuePauseHistoryRef.current.has(cueKey)) return;
    cuePauseHistoryRef.current.add(cueKey);
    setPlaying(false);
    setSyncState({
      tone: "muted",
      message: `Paused at host cue: ${activeHostAction.label || "Next scripted step"}.`
    });
    if (liveSync) {
      sendDirectorAction("pause", {
        sceneId: activeScene.id,
        timelineMs: Math.round(timelineMs)
      });
    }
  }, [
    autoPauseCues,
    playing,
    activeHostAction,
    sceneProgress,
    activeScene.id,
    timelineMs,
    liveSync,
    sendDirectorAction
  ]);

  const triggerBeatPulse = useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    const context = audioContextRef.current;
    if (!context) return;
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const mode = String(activeScene?.mode || "karaoke").toLowerCase();
    oscillator.type = mode === "trivia" || mode === "wyr" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(mode === "guitar" ? 164 : mode === "vocal" ? 174 : mode === "wyr" ? 196 : 146, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(mode === "finale" ? 0.026 : 0.018, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }, [activeScene]);

  useEffect(() => {
    if (beatTimerRef.current) {
      clearInterval(beatTimerRef.current);
      beatTimerRef.current = null;
    }
    if (!audioBedEnabled) return () => {};
    const mode = String(activeScene?.mode || "karaoke").toLowerCase();
    const bpm = mode === "trivia" ? 108 : mode === "wyr" ? 112 : mode === "guitar" ? 132 : mode === "vocal" ? 122 : mode === "finale" ? 136 : 118;
    const intervalMs = Math.max(260, Math.round(60000 / bpm));
    const tick = () => {
      setBeatPulseTick((prev) => prev + 1);
      triggerBeatPulse();
    };
    tick();
    beatTimerRef.current = setInterval(tick, intervalMs);
    return () => {
      if (beatTimerRef.current) clearInterval(beatTimerRef.current);
      beatTimerRef.current = null;
    };
  }, [audioBedEnabled, activeScene, triggerBeatPulse]);

  useEffect(() => () => {
    if (beatTimerRef.current) clearInterval(beatTimerRef.current);
    beatTimerRef.current = null;
    if (audioContextRef.current && typeof audioContextRef.current.close === "function") {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  const jumpToScene = (sceneId = "") => {
    const target = TIMELINE.find((entry) => entry.id === sceneId);
    if (!target) return;
    setTimelineMs(target.startMs);
    if (liveSync) sendDirectorAction("seek", { timelineMs: target.startMs, sceneId: target.id });
  };

  const onTogglePlayback = () => {
    const next = !playing;
    setPlaying(next);
    trackEvent("mk_demo_playback_toggle", { state: next ? "play" : "pause" });
    if (liveSync && !next) sendDirectorAction("pause");
  };

  return (
    <section className="mk3-page mk3-demo-page">
      <article className="mk3-demo-story">
        <div className="mk3-demo-story-intro">
          <div className="mk3-chip">scroll story</div>
          <h2>Watch one karaoke night come to life.</h2>
          <p>
            Start with the host deck, hand the room to the TV, pull phones into the moment, then show how the whole system scales without turning into work.
          </p>
        </div>
        <div className="mk3-demo-story-grid">
          <div className="mk3-demo-story-steps">
            {DEMO_STORY_BEATS.map((beat, index) => (
              <article
                key={beat.id}
                ref={(node) => {
                  storyStepRefs.current[index] = node;
                }}
                data-story-index={index}
                className={`mk3-demo-story-step${activeStoryBeat === index ? " is-active" : ""}`}
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
            <div className={`mk3-demo-story-stage-frame is-${storyBeat.id}`}>
              <div className="mk3-demo-story-glow mk3-demo-story-glow-one" />
              <div className="mk3-demo-story-glow mk3-demo-story-glow-two" />

              <article className="mk3-demo-story-screen mk3-demo-story-screen-host">
                <span>Host Panel</span>
                <strong>{storyBeat.id === "host" ? "Catalog and queue live" : activeHostAction?.label || "Queue the room"}</strong>
                <div className="mk3-demo-story-embed mk3-demo-story-embed-host">
                  <iframe
                    title="Demo story host surface"
                    src={iframeMountReady ? storyLaunchLinks.host : "about:blank"}
                    className="mk3-demo-iframe mk3-demo-story-iframe"
                    loading={isAutoplayShowcase ? "eager" : "lazy"}
                    allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone"
                  />
                </div>
                <div className="mk3-demo-story-host-stats-strip">
                  <div>
                    <span>Room</span>
                    <strong>{sanitizedRoomCode}</strong>
                  </div>
                  <div>
                    <span>Workspace</span>
                    <strong>{getDemoHostWorkspaceLabel(storyHostParams)}</strong>
                  </div>
                </div>
              </article>

              <article className="mk3-demo-story-screen mk3-demo-story-screen-tv">
                <span>Public TV</span>
                <strong>{storyScene.songTitle || "Big singalong moment"}</strong>
                <div className="mk3-demo-story-embed mk3-demo-story-embed-tv">
                  <iframe
                    title="Demo story public TV surface"
                    src={iframeMountReady ? storyLaunchLinks.tv : "about:blank"}
                    className="mk3-demo-iframe mk3-demo-story-iframe"
                    loading={isAutoplayShowcase ? "eager" : "lazy"}
                    allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone"
                  />
                </div>
                <div className="mk3-demo-story-tv-lyrics">
                  <p>{storyLyricLead}</p>
                  <small>{storyLyricNext}</small>
                </div>
                <div className="mk3-demo-story-tv-meter">
                  <span>Room energy</span>
                  <i style={{ width: `${Math.min(100, storyPerformanceScore)}%` }} />
                </div>
              </article>

              <article className="mk3-demo-story-screen mk3-demo-story-screen-phone">
                <span>Audience App</span>
                <strong>{activeStoryBeat >= 3 ? "Vote and react live" : audienceStateLabel}</strong>
                <div className="mk3-demo-story-embed mk3-demo-story-embed-phone">
                  <iframe
                    title="Demo story audience surface"
                    src={iframeMountReady ? storyLaunchLinks.audience : "about:blank"}
                    className="mk3-demo-iframe mk3-demo-story-iframe"
                    loading={isAutoplayShowcase ? "eager" : "lazy"}
                    allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone"
                  />
                </div>
                <div className="mk3-demo-story-phone-votes" aria-hidden="true">
                  <button type="button" tabIndex={-1}>Fire</button>
                  <button type="button" tabIndex={-1}>Clap</button>
                  <button type="button" tabIndex={-1}>Vote</button>
                </div>
                <div className="mk3-demo-story-phone-score">
                  <span>TV score</span>
                  <strong>+{storyVoteScore}</strong>
                </div>
              </article>

              <div className="mk3-demo-story-scale-clones" aria-hidden="true">
                {Array.from({ length: storyScaleCount }).map((_, index) => (
                  <div key={`clone_${index}`} className={`mk3-demo-story-clone clone-${index + 1}`} />
                ))}
              </div>
            </div>

            <div className="mk3-demo-story-flow-grid">
              {storyBeat.flows.map((flow) => (
                <article key={`${storyBeat.id}_${flow.lane}`} className="mk3-demo-story-flow-card">
                  <span>{flow.lane}</span>
                  <strong>{flow.title}</strong>
                  <p>{flow.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="mk3-demo-overview">
        <div className="mk3-chip">demo brief</div>
        <h2>See one room move across TV, phone, and host.</h2>
        <p>
          Same room code. Three real BeauRocks surfaces. One guided run from host setup to full-room participation.
        </p>
        <div className="mk3-demo-overview-grid">
          <article>
            <span>Surface 01</span>
            <strong>Public TV</strong>
            <p>Big-screen lyrics, backing media, and live room reveals.</p>
          </article>
          <article>
            <span>Surface 02</span>
            <strong>Audience Mobile</strong>
            <p>Join, react, vote, strum, and play from any phone.</p>
          </article>
          <article>
            <span>Surface 03</span>
            <strong>Host Control Deck</strong>
            <p>Search, queue, launch modes, and steer the room in real time.</p>
          </article>
        </div>
        <div className="mk3-demo-overview-flow">
          <span>Scene flow</span>
          <strong>Search, queue, singalong, games, reveal, finale.</strong>
          <p>The live timeline below shows which surface is driving the room and where the response lands next.</p>
        </div>
      </article>

      <article className="mk3-demo-controls">
        <header>
          <h3>Demo Controls</h3>
          <p>
            Guided Demo runs the sequence for you. Live Lab keeps the same real surfaces but lets you poke around more directly.
          </p>
        </header>
        <div className="mk3-demo-toolbar">
          <button
            type="button"
            className={!isAutoplayShowcase ? "active" : ""}
            onClick={() => {
              setDemoViewMode(DEMO_VIEW_MODES.interactive);
              if (canRunLiveSync) {
                setLiveSync(true);
              } else {
                setLiveSync(false);
                setSyncState({ tone: "muted", message: "Live Lab uses the native surfaces. Sign in to enable scripted sync controls." });
              }
              trackEvent("mk_demo_view_mode", { mode: DEMO_VIEW_MODES.interactive });
            }}
          >
            Live Interactive Lab
          </button>
          <button
            type="button"
            className={isAutoplayShowcase ? "active" : ""}
            onClick={() => {
              setDemoViewMode(DEMO_VIEW_MODES.autoplay);
              setLiveSync(true);
              setPlaying(true);
              setSyncState({ tone: "muted", message: "Guided sequence is driving the real room surfaces." });
              trackEvent("mk_demo_view_mode", { mode: DEMO_VIEW_MODES.autoplay });
            }}
          >
            Guided Demo (Recommended)
          </button>
          <button type="button" onClick={onTogglePlayback}>
            {playing ? "Pause Demo" : "Play Demo"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTimelineMs(0);
              setPlaying(true);
              cuePauseHistoryRef.current = new Set();
              if (liveSync) sendDirectorAction("seek", { timelineMs: 0, sceneId: TIMELINE[0].id });
            }}
          >
            Restart
          </button>
          <button
            type="button"
            onClick={() => setLoopPlayback((prev) => !prev)}
          >
            Loop: {loopPlayback ? "On" : "Off"}
          </button>
          {!isAutoplayShowcase && (
            <button
              type="button"
              disabled={!canRunLiveSync}
              onClick={() => {
                const next = !liveSync;
                setLiveSync(next);
                trackEvent("mk_demo_live_sync_toggle", { enabled: next ? 1 : 0 });
                if (!next) setSyncState({ tone: "muted", message: "Scripted sync is paused." });
              }}
            >
              {canRunLiveSync
                ? `Scripted Sync: ${liveSync ? "On" : "Off"}`
                : "Scripted Sync: Sign-in required"}
            </button>
          )}
          {!isAutoplayShowcase && (
            <button
              type="button"
              onClick={() => {
                const next = !autoPauseCues;
                setAutoPauseCues(next);
                trackEvent("mk_demo_autopause_toggle", { enabled: next ? 1 : 0 });
              }}
            >
              Cue Pause: {autoPauseCues ? "On" : "Off"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !audioBedEnabled;
              setAudioBedEnabled(next);
              trackEvent("mk_demo_audio_bed_toggle", { enabled: next ? 1 : 0 });
            }}
          >
            Subtle Pulse: {audioBedEnabled ? "On" : "Off"}
          </button>
          {!isAutoplayShowcase && (
            <button
              type="button"
              onClick={() => {
                setSurfaceReloadToken((prev) => prev + 1);
                trackEvent("mk_demo_surfaces_refresh", { room_code: sanitizedRoomCode });
              }}
            >
              Refresh Surfaces
            </button>
          )}
        </div>
        <div className="mk3-demo-progress">
          <strong>{formatClock(timelineMs)}</strong>
          <input
            type="range"
            min={0}
            max={DEMO_TOTAL_MS}
            step={200}
            value={Math.round(timelineMs)}
            onChange={(event) => setTimelineMs(clampNumber(event.target.value, 0, DEMO_TOTAL_MS, 0))}
            onMouseUp={() => {
              if (liveSync) sendDirectorAction("seek");
            }}
            onTouchEnd={() => {
              if (liveSync) sendDirectorAction("seek");
            }}
          />
          <span>{formatClock(DEMO_TOTAL_MS)}</span>
        </div>
        <div className="mk3-demo-scene-nav">
          {TIMELINE.map((scene) => (
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
      </article>

      <article className="mk3-demo-director">
        <div className="mk3-demo-director-head">
          <div>
            <span>timeline view</span>
            <strong>{activeScene.label}</strong>
          </div>
          <div>
            <span>scene progress</span>
            <strong>{scenePercent}%</strong>
          </div>
          <div>
            <span>next up</span>
            <strong>{nextScene?.label || "Finale close"}</strong>
          </div>
        </div>
        <div className="mk3-demo-timeline-track" aria-hidden="true">
          {TIMELINE.map((scene) => {
            const isActive = scene.id === activeScene.id;
            const isPast = timelineMs > scene.endMs;
            return (
              <div
                key={scene.id}
                className={`mk3-demo-timeline-stop${isActive ? " active" : ""}${isPast ? " is-past" : ""}`}
              >
                <span>{scene.label}</span>
                <i style={{ width: isActive ? `${scenePercent}%` : isPast ? "100%" : "0%" }} />
              </div>
            );
          })}
        </div>
        <div className="mk3-demo-director-grid">
          <article className="mk3-demo-director-card">
            <span>host move</span>
            <strong>{activeHostAction?.label || surfacePlan.hostFocus}</strong>
            <p>{activeHostAction?.explain || surfacePlan.hostStatus}</p>
          </article>
          <article className="mk3-demo-director-card">
            <span>audience state</span>
            <strong>{audienceStateLabel}</strong>
            <p>{audienceActionLabel}</p>
          </article>
          <article className="mk3-demo-director-card">
            <span>room state</span>
            <strong>{sanitizedRoomCode}</strong>
            <p>{syncState.message}</p>
          </article>
        </div>
        <div className="mk3-demo-direction-grid">
          {demoSignalFlows.map((flow) => (
            <article key={`${activeScene.id}_${flow.lane}_${flow.title}`} className="mk3-demo-direction-card">
              <span>{flow.lane}</span>
              <strong>{flow.title}</strong>
              <p>{flow.detail}</p>
            </article>
          ))}
        </div>
      </article>

      {!isAutoplayShowcase && (
        <div ref={demoShellRef} className="mk3-demo-shell">
          <article className={`mk3-demo-surface mk3-demo-tv is-${activeScene.mode}${sceneShiftActive ? " is-shifting" : ""}`}>
          <header>
            <span>Public TV</span>
            <strong>{activeScene.label}</strong>
            <a href={launchLinks.tv} target="_blank" rel="noreferrer">
              Open
            </a>
          </header>
          <div className="mk3-demo-surface-kicker">
            <span>{surfacePlan.tvFocus}</span>
            <strong>{activeScene.songTitle || stageModeLabel}</strong>
          </div>
          <div className="mk3-demo-surface-pill-row">
            <span>TV receiving host cues</span>
            <span>TV reflecting audience input</span>
          </div>
          <div className="mk3-demo-frame-wrap mk3-demo-tv-frame-wrap">
            <iframe
              title="Public TV surface"
              src={iframeMountReady ? launchLinks.tv : "about:blank"}
              className="mk3-demo-iframe"
              loading={isAutoplayShowcase ? "eager" : "lazy"}
              allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone"
            />
          </div>
          <div className="mk3-demo-surface-status">
            <span>{isAutoplayShowcase ? surfacePlan.tvStatus : activeScene.title}</span>
            <strong>{activeScene.songTitle || stageModeLabel}</strong>
          </div>
          </article>

          <article className={`mk3-demo-surface mk3-demo-audience${sceneShiftActive ? " is-shifting" : ""}`}>
          <header>
            <span>Audience View</span>
            <strong>{crowdSize} connected</strong>
            <a href={launchLinks.audience} target="_blank" rel="noreferrer">
              Open
            </a>
          </header>
          <div className="mk3-demo-surface-kicker">
            <span>{surfacePlan.audienceFocus}</span>
            <strong>{sceneInteractionTotal} scripted interactions</strong>
          </div>
          <div className="mk3-demo-surface-pill-row">
            <span>{audienceStateLabel}</span>
            <span>Joined to {sanitizedRoomCode}</span>
            <span>{audienceActionLabel}</span>
          </div>
          <div className="mk3-demo-frame-wrap mk3-demo-audience-frame-wrap">
            <div className="mk3-demo-phone-shell">
              <div className="mk3-demo-phone-notch" />
              <div className="mk3-demo-phone-screen">
                <iframe
                  title="Audience phone viewport"
                  src={iframeMountReady ? launchLinks.audience : "about:blank"}
                  className="mk3-demo-iframe mk3-demo-iframe-mobile"
                  loading={isAutoplayShowcase ? "eager" : "lazy"}
                  allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone"
                />
              </div>
            </div>
          </div>
          <div className="mk3-demo-surface-status">
            <span>
              {isAutoplayShowcase
                ? surfacePlan.audienceStatus
                : `Mobile-framed audience client for room ${sanitizedRoomCode}`}
            </span>
            <strong>{sceneInteractionTotal} interactions this cycle</strong>
          </div>
          </article>

          <article className={`mk3-demo-surface mk3-demo-host${sceneShiftActive ? " is-shifting" : ""}`}>
          <header>
            <span>Host Deck</span>
            <strong>{isAutoplayShowcase ? surfacePlan.hostFocus : "Live host deck"}</strong>
            <a href={launchLinks.host} target="_blank" rel="noreferrer">
              Open
            </a>
          </header>
          <div className="mk3-demo-surface-kicker">
            <span>{surfacePlan.hostFocus}</span>
            <strong>{activeHostAction?.label || "Room flow in progress"}</strong>
          </div>
          <div className="mk3-demo-surface-pill-row">
            <span>{hostWorkspaceLabel}</span>
            <span>Room attached: {sanitizedRoomCode}</span>
            <span>{activeHostAction?.control || activeScene.mode}</span>
          </div>
          <div className="mk3-demo-frame-wrap mk3-demo-host-frame-wrap mk3-demo-host-frame-wrap-live">
            <iframe
              title="Host deck surface"
              src={iframeMountReady ? launchLinks.host : "about:blank"}
              className="mk3-demo-iframe"
              loading={isAutoplayShowcase ? "eager" : "lazy"}
              allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone"
            />
          </div>
          <div className="mk3-demo-surface-status">
            <span>
              {isAutoplayShowcase
                ? surfacePlan.hostStatus
                : "Native host surface for room control and queue management"}
            </span>
            <strong>
              {syncState.tone === "ok"
                ? "Sync healthy"
                : syncState.tone === "error"
                  ? "Sync issue"
                  : isAutoplayShowcase
                    ? "Script running"
                    : "Interactive live view"}
            </strong>
          </div>
          </article>
        </div>
      )}

      <article className="mk3-demo-launch">
        <h3>{isAutoplayShowcase ? "Guided Demo Is Running" : "Launch Real Surfaces From This Room Code"}</h3>
        <p>
          {isAutoplayShowcase
            ? "This mode runs the actual BeauRocks surfaces in a compact storyboard shell while the script drives search, queue, media, and mode changes."
            : "Live Interactive Lab embeds the native room surfaces so you can inspect the actual product behavior and controls for this demo room."}
        </p>
        <div className={`mk3-inline-status ${syncState.tone === "error" ? "mk3-status-error" : syncState.tone === "ok" ? "mk3-inline-next" : ""}`}>
          {syncState.message}
        </div>
        <div className="mk3-demo-launch-row">
          <label>
            Demo Room Code
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))}
              placeholder="DEMO001"
            />
          </label>
          <a href={launchLinks.audience} target="_blank" rel="noreferrer">
            Open Audience
          </a>
          <a href={launchLinks.tv} target="_blank" rel="noreferrer">
            Open Public TV
          </a>
          <a href={launchLinks.host} target="_blank" rel="noreferrer">
            Open Host Deck
          </a>
        </div>
      </article>
    </section>
  );
};

export default DemoExperiencePage;

