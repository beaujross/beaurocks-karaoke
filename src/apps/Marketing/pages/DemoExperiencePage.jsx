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
    title: "Start with a host deck that already feels live.",
    body: "The demo should open on music intent, not setup friction. Search, queue, and room sharing need to read instantly so the host looks ready from the first second.",
    bullets: [
      "Show search and queue movement immediately.",
      "Bring the room code and audience join path in right away.",
      "Keep the host focused on the first singer, not room creation."
    ],
    flows: [
      { lane: "Host -> Queue", title: "The opener gets lined up fast", detail: "The host searches, picks a song, and makes the first singer visible before the TV takes over." },
      { lane: "Host -> Audience", title: "Phones get the room code immediately", detail: "Guests do not wait for a later reveal. They see the room, now playing, and request path from the start." }
    ],
    host: {
      workspace: "Browse + queue",
      title: "Search feeds a real queue, not a setup screen",
      search: "sweet caroline karaoke",
      queue: [
        { title: "Sweet Caroline", meta: "Amy | Ready now" },
        { title: "Mr. Brightside", meta: "Chris | Next up" },
        { title: "Dancing Queen", meta: "Maya | In line" }
      ],
      footer: "The first singer is ready before the big screen takes the room."
    },
    tv: {
      badge: "Room warming up",
      headline: "The TV stays calm until the queue is ready",
      lyrics: [
        "Room code on screen first",
        "Lyrics step up only when the room is ready to sing"
      ],
      note: "No visual storm. Just one clear invitation and one obvious next step.",
      progressLabel: "Room ready",
      progressValue: 28
    },
    phone: {
      title: "Audience app shows up immediately",
      subtitle: "Guests join early enough to matter: room code, now playing, and request lane are already visible.",
      chips: ["Join room", "See queue", "Request song"],
      request: "Phones are connected before the first chorus begins.",
      metricLabel: "Connected guests",
      metricValue: "12"
    }
  },
  {
    id: "karaoke",
    kicker: "Step 02",
    title: "Then let karaoke own the page.",
    body: "The public screen should become the star, but it needs to stay readable. Bigger lyrics, less clutter, and just enough movement to prove the room is alive.",
    bullets: [
      "Give the TV the most visual weight.",
      "Keep the host visible but secondary.",
      "Let phones react without hijacking the song."
    ],
    flows: [
      { lane: "Host -> TV", title: "The host hands the room to karaoke", detail: "Once the opener is ready, the TV becomes the focal point and the host shifts into steering the next beat." },
      { lane: "TV -> Audience", title: "The chorus teaches the room what to do", detail: "Readable lyrics and clear timing cues tell guests when to sing, clap, and lean in together." }
    ],
    host: {
      workspace: "Live run",
      title: "Host keeps the next singer ready without stealing focus",
      search: "",
      queue: [
        { title: "Sweet Caroline", meta: "Now singing | Amy" },
        { title: "Mr. Brightside", meta: "Queued next | Chris" },
        { title: "Dancing Queen", meta: "Audience request | Maya" }
      ],
      footer: "The host is still active, but the room is watching the TV now."
    },
    tv: {
      badge: "Karaoke live",
      headline: "Big lyrics and timing carry the room",
      lyrics: [
        "Sweet Caroline",
        "Good times never felt so good"
      ],
      note: "The TV feels energetic because the crowd is engaged, not because the screen is overloaded.",
      progressLabel: "Room energy",
      progressValue: 67
    },
    phone: {
      title: "Phones stay light during the chorus",
      subtitle: "Audience reactions stay available, but the song never loses its center of gravity on the big screen.",
      chips: ["Clap", "Cheer", "Fire"],
      request: "Phones support the moment without pulling eyes off the lyrics.",
      metricLabel: "Room energy",
      metricValue: "67%"
    }
  },
  {
    id: "audience",
    kicker: "Step 03",
    title: "Show the audience app actually feeding the host.",
    body: "The value of the phone is not just reactions. It is the handoff: a guest submits a song, the host sees it fast, and the current karaoke moment keeps running cleanly.",
    bullets: [
      "Bring the phone into the sequence earlier.",
      "Make the request-to-host handoff explicit.",
      "Keep the TV on the current singer while the next song lines up."
    ],
    flows: [
      { lane: "Audience -> Host", title: "A phone request lands in the queue fast", detail: "The guest submits a song, the host sees it, and the night keeps moving without a separate explanation." },
      { lane: "Host -> TV", title: "The current song stays intact while the next one lines up", detail: "Audience input changes what happens next, not the lyric readability of the song already on stage." }
    ],
    host: {
      workspace: "Queue intake",
      title: "New audience requests show up right inside the host flow",
      search: "",
      queue: [
        { title: "Sweet Caroline", meta: "Now singing | Amy" },
        { title: "Shallow", meta: "Jamie | Requested from audience app" },
        { title: "Mr. Brightside", meta: "Queued next | Chris" }
      ],
      incoming: {
        label: "Fresh request received",
        detail: "Jamie just sent “Shallow” from the audience app."
      },
      footer: "The host sees the request without leaving the live queue."
    },
    tv: {
      badge: "Current singer live",
      headline: "The TV keeps the chorus readable while the next request lands",
      lyrics: [
        "Hands touching hands",
        "Reaching out, touching me, touching you"
      ],
      note: "The room stays in the song that is live now, even while the queue updates underneath it.",
      progressLabel: "Queue response",
      progressValue: 74
    },
    phone: {
      title: "A guest submits the next song from the phone",
      subtitle: "This is the audience moment to show first: request, confirm, and see it reach the host queue in seconds.",
      chips: ["Request song", "Attach backing", "View queue"],
      request: "Request sent: Shallow | Jamie",
      metricLabel: "Host response",
      metricValue: "Seen live"
    }
  },
  {
    id: "autodj",
    kicker: "Step 04",
    title: "Then show what Auto DJ actually fixes.",
    body: "Skip the side-trip into extra modes here. The better comparison is practical: when Auto DJ is off the room sags, and when it is on the night keeps moving between singers.",
    bullets: [
      "Compare dead air against continuous momentum.",
      "Keep the host in control of the room flow.",
      "Let audience requests keep feeding the queue while Auto DJ bridges transitions."
    ],
    flows: [
      { lane: "Host -> Room", title: "Auto DJ fills the gap between singers", detail: "Instead of a reset between songs, the host can keep the room warm while the next singer gets ready." },
      { lane: "Audience -> Queue", title: "Phones keep feeding the next handoff", detail: "Audience requests stay useful because Auto DJ buys the room time without losing momentum." }
    ],
    host: {
      workspace: "Stage + Auto DJ",
      title: "Host toggles Auto DJ to keep the room moving",
      search: "",
      queue: [
        { title: "Sweet Caroline", meta: "Ending now" },
        { title: "Shallow", meta: "Jamie | Up next" },
        { title: "Auto DJ bridge", meta: "Warm transition | 18 sec" }
      ],
      footer: "Auto DJ reduces dead air, but the host still owns the room."
    },
    tv: {
      badge: "Auto DJ live",
      headline: "The public screen never drops into silence between singers",
      lyrics: [
        "Bridge music keeps the room warm",
        "Next singer steps in without a hard stop"
      ],
      note: "This is the useful demo contrast: manual gap versus smooth continuity.",
      progressLabel: "Transition gap",
      progressValue: 88
    },
    phone: {
      title: "Audience keeps submitting while Auto DJ carries transitions",
      subtitle: "Phones keep the next queue items coming while Auto DJ prevents the room from falling flat.",
      chips: ["Request next song", "Track queue", "Stay engaged"],
      request: "Auto DJ bridge active | next singer loading",
      metricLabel: "Transition gap",
      metricValue: "Near zero"
    },
    autoDj: {
      off: "Auto DJ off: the song ends, the room waits, and the host has to rebuild momentum.",
      on: "Auto DJ on: bridge audio and queue logic carry the room until the next singer is ready."
    }
  }
]);

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
    if (!isAutoplayShowcase) return;
    setSyncState((prev) => {
      if (prev.message === "Focused story mode active. Open Live Lab to inspect the real room surfaces.") {
        return prev;
      }
      return {
        tone: "muted",
        message: "Focused story mode active. Open Live Lab to inspect the real room surfaces."
      };
    });
  }, [isAutoplayShowcase]);

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
          <h2>Watch one karaoke night move from host to TV to phone.</h2>
          <p>
            This version stays focused on the core night: host setup, readable karaoke on the public screen, audience submission to the queue, and the difference Auto DJ makes between singers.
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
              <div className="mk3-demo-story-stage-header">
                <div>
                  <span>Focused Demo</span>
                  <strong>{storyBeat.title}</strong>
                </div>
                <div className="mk3-demo-story-stage-meta">
                  <span>{sanitizedRoomCode}</span>
                  <strong>{storyBeat.host.workspace}</strong>
                </div>
              </div>

              <article className="mk3-demo-story-screen mk3-demo-story-screen-host">
                <span>Host Panel</span>
                <strong>{storyBeat.host.title}</strong>
                {!!storyBeat.host.search && (
                  <div className="mk3-demo-story-host-search">
                    <span>Search</span>
                    <strong>{storyBeat.host.search}</strong>
                  </div>
                )}
                <div className="mk3-demo-story-host-queue">
                  <span>Live queue</span>
                  <div className="mk3-demo-story-host-queue-list">
                    {storyBeat.host.queue.map((entry) => (
                      <article key={`${storyBeat.id}_${entry.title}`}>
                        <strong>{entry.title}</strong>
                        <span>{entry.meta}</span>
                      </article>
                    ))}
                  </div>
                </div>
                {storyBeat.host.incoming && (
                  <div className="mk3-demo-story-host-incoming">
                    <span>{storyBeat.host.incoming.label}</span>
                    <strong>{storyBeat.host.incoming.detail}</strong>
                  </div>
                )}
                <p className="mk3-demo-story-surface-note">{storyBeat.host.footer}</p>
              </article>

              <article className="mk3-demo-story-screen mk3-demo-story-screen-tv">
                <div className="mk3-demo-story-tv-stage">
                  <div className="mk3-demo-story-tv-badge">
                    <span>Public TV</span>
                    <strong>{storyBeat.tv.badge}</strong>
                  </div>
                  <div className="mk3-demo-story-tv-headline">
                    <strong>{storyBeat.tv.headline}</strong>
                  </div>
                  <div className="mk3-demo-story-tv-lyrics">
                    {storyBeat.tv.lyrics.map((line, index) => (
                      <p key={`${storyBeat.id}_tv_${index}`}>{line}</p>
                    ))}
                  </div>
                  <div className="mk3-demo-story-tv-meter">
                    <span>{storyBeat.tv.progressLabel}</span>
                    <i style={{ width: `${Math.min(100, Number(storyBeat.tv.progressValue || 0))}%` }} />
                  </div>
                </div>
                <p className="mk3-demo-story-surface-note">{storyBeat.tv.note}</p>
              </article>

              <article className="mk3-demo-story-screen mk3-demo-story-screen-phone">
                <span>Audience App</span>
                <strong>{storyBeat.phone.title}</strong>
                <p className="mk3-demo-story-phone-copy">{storyBeat.phone.subtitle}</p>
                <div className="mk3-demo-story-phone-votes" aria-hidden="true">
                  {storyBeat.phone.chips.map((chip) => (
                    <button key={`${storyBeat.id}_${chip}`} type="button" tabIndex={-1}>{chip}</button>
                  ))}
                </div>
                <div className="mk3-demo-story-phone-request">
                  <span>Phone state</span>
                  <strong>{storyBeat.phone.request}</strong>
                </div>
                <div className="mk3-demo-story-phone-score">
                  <span>{storyBeat.phone.metricLabel}</span>
                  <strong>{storyBeat.phone.metricValue}</strong>
                </div>
              </article>

              {storyBeat.autoDj && (
                <div className="mk3-demo-story-autodj-compare" aria-hidden="true">
                  <article>
                    <span>Auto DJ Off</span>
                    <strong>Manual gap</strong>
                    <p>{storyBeat.autoDj.off}</p>
                  </article>
                  <article className="is-on">
                    <span>Auto DJ On</span>
                    <strong>Continuous momentum</strong>
                    <p>{storyBeat.autoDj.on}</p>
                  </article>
                </div>
              )}
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

      {!isAutoplayShowcase && (
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
      )}

      <article className="mk3-demo-controls">
        <header>
          <h3>Demo Controls</h3>
          <p>
            {isAutoplayShowcase
              ? "Guided Demo is now a focused scroll story. Switch to Live Lab when you want the full embedded surfaces and timeline controls."
              : "Live Lab keeps the same real surfaces but lets you poke around directly with the timeline and room controls."}
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
              setSyncState({ tone: "muted", message: "Focused story mode active. Open Live Lab to inspect the real room surfaces." });
              trackEvent("mk_demo_view_mode", { mode: DEMO_VIEW_MODES.autoplay });
            }}
          >
            Guided Demo (Recommended)
          </button>
          {!isAutoplayShowcase && (
            <button type="button" onClick={onTogglePlayback}>
              {playing ? "Pause Demo" : "Play Demo"}
            </button>
          )}
          {!isAutoplayShowcase && (
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
          )}
          {!isAutoplayShowcase && (
            <button
              type="button"
              onClick={() => setLoopPlayback((prev) => !prev)}
            >
              Loop: {loopPlayback ? "On" : "Off"}
            </button>
          )}
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
        {!isAutoplayShowcase && (
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
        )}
        {!isAutoplayShowcase && (
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
        )}
      </article>

      {!isAutoplayShowcase && (
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
      )}

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
        <h3>{isAutoplayShowcase ? "Open The Real Surfaces Behind This Story" : "Launch Real Surfaces From This Room Code"}</h3>
        <p>
          {isAutoplayShowcase
            ? "The scroll story is the focused pitch. These links still open the real BeauRocks host, TV, and audience surfaces if you want to inspect the live product underneath it."
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

