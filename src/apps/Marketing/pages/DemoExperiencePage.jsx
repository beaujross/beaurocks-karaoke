import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { STORM_SOUND_URL } from "../../../lib/assets";
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
const DEMO_DEFAULT_LYRICS = [
  "Sweet Caroline singalong demo adaptation",
  "Find each other, then sing together in real rooms"
];
const HOST_CONTROL_BUTTONS = Object.freeze([
  { id: "karaoke", label: "Karaoke", icon: "fa-microphone-lines", sceneId: "karaoke_kickoff" },
  { id: "queue", label: "Queue", icon: "fa-list", sceneId: "karaoke_singalong" },
  { id: "guitar", label: "Guitar", icon: "fa-guitar", sceneId: "guitar_vibe_sync" },
  { id: "vocal", label: "Vocal Game", icon: "fa-wave-square", sceneId: "vocal_game_challenge" },
  { id: "trivia", label: "Trivia", icon: "fa-circle-question", sceneId: "trivia_showdown" },
  { id: "wyr", label: "Would You Rather", icon: "fa-left-right", sceneId: "wyr_split_decision_one" },
  { id: "finale", label: "Finale", icon: "fa-bolt", sceneId: "finale_drop" },
  { id: "wave", label: "Wave", icon: "fa-water", sceneId: "karaoke_kickoff" },
  { id: "echo", label: "Echo", icon: "fa-circle-notch", sceneId: "karaoke_singalong" },
  { id: "laser", label: "Laser", icon: "fa-wand-magic-sparkles", sceneId: "guitar_vibe_sync" },
  { id: "confetti", label: "Confetti", icon: "fa-cake-candles", sceneId: "vocal_game_challenge" }
]);
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
  if (typeof window === "undefined") return DEMO_VIEW_MODES.interactive;
  try {
    const params = new URLSearchParams(window.location.search);
    const queryModeRaw = params.get("demo_view") || params.get("demoView") || "";
    if (queryModeRaw) return normalizeDemoViewMode(queryModeRaw);
    if (params.get("autoplay") === "1") return DEMO_VIEW_MODES.autoplay;
    const storedRaw = window.sessionStorage.getItem(DEMO_VIEW_STORAGE_KEY) || "";
    if (storedRaw) return normalizeDemoViewMode(storedRaw);
    return DEMO_VIEW_MODES.interactive;
  } catch {
    return DEMO_VIEW_MODES.interactive;
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

const DemoExperiencePage = ({ session = {} }) => {
  const isSessionReady = !!session?.ready;
  const hasCallableAuth = !!session?.isAuthed;
  const [demoViewMode, setDemoViewMode] = useState(() => getInitialDemoViewMode());
  const [timelineMs, setTimelineMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loopPlayback, setLoopPlayback] = useState(true);
  const [roomCode, setRoomCode] = useState(() => getInitialDemoRoomCode());
  const [liveSync, setLiveSync] = useState(() => getInitialDemoViewMode() !== DEMO_VIEW_MODES.autoplay);
  const [autoPauseCues, setAutoPauseCues] = useState(false);
  const [audioBedEnabled, setAudioBedEnabled] = useState(true);
  const [beatPulseTick, setBeatPulseTick] = useState(0);
  const [surfaceReloadToken, setSurfaceReloadToken] = useState(0);
  const [syncState, setSyncState] = useState({ tone: "muted", message: "Scripted sync warming up." });

  const latestStateRef = useRef(null);
  const inFlightRef = useRef(false);
  const lastTickBucketRef = useRef(-1);
  const lastSceneIdRef = useRef("");
  const lastSequenceRef = useRef(0);
  const demoShellRef = useRef(null);
  const autoRoomRetryRef = useRef(false);
  const cuePauseHistoryRef = useRef(new Set());
  const ambienceAudioRef = useRef(null);
  const beatTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const previousTimelineMsRef = useRef(0);
  const [iframeMountReady, setIframeMountReady] = useState(false);
  const isAutoplayShowcase = demoViewMode === DEMO_VIEW_MODES.autoplay;
  const canRunLiveSync = isSessionReady && hasCallableAuth;
  const isInteractiveTestingLayout = !isAutoplayShowcase;

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
    const timeoutId = window.setTimeout(reveal, 2500);
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        reveal();
      }
    }, { root: null, rootMargin: "400px 0px", threshold: 0.01 });
    observer.observe(node);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [iframeMountReady]);

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

  const crowdSize = useMemo(() => {
    const base = activeScene.mode === "finale" ? 22 : activeScene.mode === "guitar" ? 18 : 16;
    return Math.round(base + (sceneProgress * 6));
  }, [activeScene.mode, sceneProgress]);

  const reactionEvents = useMemo(
    () => buildReactionEvents(activeScene, sceneProgress),
    [activeScene, sceneProgress]
  );

  const lyricLines = useMemo(() => {
    const fromScene = Array.isArray(activeScene?.lyrics)
      ? activeScene.lyrics.map((line) => String(line || "").trim()).filter(Boolean)
      : [];
    return fromScene.length ? fromScene : DEMO_DEFAULT_LYRICS;
  }, [activeScene]);
  const lyricLineIndex = useMemo(() => {
    if (!lyricLines.length) return 0;
    const base = Math.floor(sceneProgress * lyricLines.length);
    return Math.max(0, Math.min(lyricLines.length - 1, base));
  }, [lyricLines, sceneProgress]);
  const currentLyricLine = lyricLines[Math.max(0, lyricLineIndex)] || DEMO_DEFAULT_LYRICS[0];
  const nextLyricLine = lyricLines[Math.min(lyricLines.length - 1, lyricLineIndex + 1)] || "";
  const lyricOverlayEnabled = ["karaoke", "finale", "vocal"].includes(String(activeScene?.mode || ""));

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

  const launchLinks = useMemo(() => ({
    audience: buildSceneSurfaceUrl("app", { mobile_layout: "native" }),
    tv: buildSceneSurfaceUrl("tv", { mode: "tv" }),
    host: buildSceneSurfaceUrl("host", {
      mode: "host",
      mkDemoEmbed: "1",
      hostUiVersion: "v2",
      view: "ops",
      section: "ops.room_setup",
      tab: "admin",
    }),
  }), [buildSceneSurfaceUrl]);

  const sceneInteractionTotal = useMemo(
    () => reactionEvents.reduce((sum, entry) => sum + Math.max(0, Number(entry.count || 0)), 0),
    [reactionEvents]
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
    if (!isAutoplayShowcase) return;
    if (!liveSync) return;
    setLiveSync(false);
    setSyncState({ tone: "muted", message: "Autoplay Showcase uses local scripted playback only." });
  }, [isAutoplayShowcase, liveSync]);

  useEffect(() => {
    if (isAutoplayShowcase) return;
    if (!canRunLiveSync && liveSync) {
      setLiveSync(false);
      setSyncState({ tone: "muted", message: "Interactive surfaces are live. Sign in to enable scripted sync controls." });
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
    if (!isSessionReady || !hasCallableAuth) {
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
  }, [hasCallableAuth, isSessionReady]);

  useEffect(() => {
    if (!liveSync) return;
    if (!isSessionReady || !hasCallableAuth) {
      setSyncState({ tone: "muted", message: "Waiting for secure session..." });
      return;
    }
    const snapshot = latestStateRef.current;
    const seedSceneId = snapshot?.activeScene?.id || TIMELINE[0].id;
    const seedTimelineMs = Number(snapshot?.timelineMs || 0);
    lastSceneIdRef.current = seedSceneId;
    lastTickBucketRef.current = Math.floor(seedTimelineMs / 4000);
    sendDirectorAction("bootstrap");
  }, [hasCallableAuth, isSessionReady, liveSync, sanitizedRoomCode, sendDirectorAction]);

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
    oscillator.frequency.setValueAtTime(mode === "guitar" ? 196 : mode === "vocal" ? 247 : mode === "wyr" ? 262 : 220, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(mode === "finale" ? 0.08 : 0.055, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }, [activeScene]);

  useEffect(() => {
    const ambienceNode = ambienceAudioRef.current;
    if (!ambienceNode) return;
    const mode = String(activeScene?.mode || "karaoke").toLowerCase();
    ambienceNode.volume = mode === "trivia" ? 0.08 : mode === "wyr" ? 0.09 : mode === "guitar" ? 0.16 : 0.12;
    if (!audioBedEnabled) {
      ambienceNode.pause();
      ambienceNode.currentTime = 0;
      return;
    }
    ambienceNode.play().catch(() => {});
  }, [audioBedEnabled, activeScene]);

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
    if (ambienceAudioRef.current) ambienceAudioRef.current.pause();
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
      <article className="mk3-demo-overview">
        <div className="mk3-chip">demo brief</div>
        <h2>One room, three synced surfaces</h2>
        <p>
          BeauRocks ties the Public TV, Audience phone view, and Host deck into one shared karaoke flow.
          The scripted run below starts with karaoke, moves through game moments, includes two Would You Rather rounds with reveals, then lands on a sing-along finale.
        </p>
        <div className="mk3-demo-overview-grid">
          <article>
            <span>Surface 01</span>
            <strong>Public TV</strong>
            <p>Big-screen lyrics, mode shifts, and room-level calls to action.</p>
          </article>
          <article>
            <span>Surface 02</span>
            <strong>Audience Mobile</strong>
            <p>Reaction bursts, strumming, trivia votes, and live participation from any phone.</p>
          </article>
          <article>
            <span>Surface 03</span>
            <strong>Host Control Deck</strong>
            <p>Host cues drive mode changes so every audience action has visible cause and effect.</p>
          </article>
        </div>
        <div className="mk3-demo-overview-flow">
          <span>Demo flow</span>
          <strong>Karaoke kickoff, guitar vibe sync, vocal game, trivia, two Would You Rather reveals, then finale chorus.</strong>
          <p>Use the controls below to play, pause, scrub the timeline, or jump directly to any scene.</p>
        </div>
      </article>

      <article className="mk3-demo-controls">
        <header>
          <h3>Demo Controls</h3>
          <p>
            Interactive surfaces are native by default. Switch to on-rails autoplay only when you want a deterministic walkthrough.
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
                setSyncState({ tone: "muted", message: "Interactive surfaces are live. Sign in to enable scripted sync controls." });
              }
              trackEvent("mk_demo_view_mode", { mode: DEMO_VIEW_MODES.interactive });
            }}
          >
            Interactive Surfaces (Recommended)
          </button>
          <button
            type="button"
            className={isAutoplayShowcase ? "active" : ""}
            onClick={() => {
              setDemoViewMode(DEMO_VIEW_MODES.autoplay);
              trackEvent("mk_demo_view_mode", { mode: DEMO_VIEW_MODES.autoplay });
            }}
          >
            Demo On Rails
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
            Music + Ambience: {audioBedEnabled ? "On" : "Off"}
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
              if (liveSync && !isAutoplayShowcase) sendDirectorAction("seek");
            }}
            onTouchEnd={() => {
              if (liveSync && !isAutoplayShowcase) sendDirectorAction("seek");
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
        <audio
          ref={ambienceAudioRef}
          src={STORM_SOUND_URL}
          preload="auto"
          loop
          aria-hidden="true"
        />
      </article>

      <div ref={demoShellRef} className={`mk3-demo-shell ${isInteractiveTestingLayout ? "mk3-demo-shell-testing" : ""}`}>
        <article className={`mk3-demo-surface mk3-demo-tv is-${activeScene.mode}`}>
          <header>
            <span>Public TV</span>
            <strong>{activeScene.label}</strong>
            <a href={launchLinks.tv} target="_blank" rel="noreferrer">
              Open
            </a>
          </header>
          <div className="mk3-demo-frame-wrap mk3-demo-tv-frame-wrap">
            <iframe
              title="Public TV surface"
              src={iframeMountReady ? launchLinks.tv : "about:blank"}
              className="mk3-demo-iframe"
              loading="lazy"
              allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone"
            />
            {isAutoplayShowcase && (
            <div className={`mk3-demo-tv-overlay is-${activeScene.mode}`}>
              <div className="mk3-demo-tv-badges">
                <span>Now Playing</span>
                <strong>{activeScene.songTitle || "Demo Track"} • {activeScene.artist || "BeauRocks"}</strong>
              </div>
              <div className={`mk3-demo-beat-light ${audioBedEnabled ? "is-live" : ""}`} data-beat={beatPulseTick % 8} />
              {lyricOverlayEnabled ? (
                <div className="mk3-demo-tv-lyrics">
                  <p className="mk3-demo-tv-lyric-active">{currentLyricLine}</p>
                  <p className="mk3-demo-tv-lyric-next">{nextLyricLine || currentLyricLine}</p>
                </div>
              ) : (
                <div className="mk3-demo-tv-lyrics is-instrumental">
                  <p className="mk3-demo-tv-lyric-active">{stageModeLabel}</p>
                  <p className="mk3-demo-tv-lyric-next">{activeScene.description}</p>
                </div>
              )}
              <div className="mk3-demo-tv-mode-note">
                {activeScene.mode === "guitar" && "Solo mode: audience strums drive sync meter."}
                {activeScene.mode === "vocal" && "Vocal game: timing + pitch challenge runs between songs."}
                {activeScene.mode === "trivia" && "Trivia mode: votes in real-time, reveal on countdown."}
                {activeScene.mode === "wyr" && "Would You Rather: live A/B voting with automatic reveal and crowd split."}
                {activeScene.mode === "karaoke" && "Karaoke first: lyrics stay dominant so anyone can jump in."}
                {activeScene.mode === "finale" && "Finale: return to karaoke hook with full crowd effects."}
              </div>
            </div>
            )}
          </div>
          <div className="mk3-demo-surface-status">
            <span>{activeScene.title}</span>
            <strong>{Math.round(sceneProgress * 100)}% through scene</strong>
          </div>
        </article>

        <article className="mk3-demo-surface mk3-demo-audience">
          <header>
            <span>Audience View</span>
            <strong>{crowdSize} connected</strong>
            <a href={launchLinks.audience} target="_blank" rel="noreferrer">
              Open
            </a>
          </header>
          <div className="mk3-demo-frame-wrap mk3-demo-audience-frame-wrap">
            <div className="mk3-demo-phone-shell">
              <div className="mk3-demo-phone-notch" />
              <div className="mk3-demo-phone-screen">
                <iframe
                  title="Audience phone viewport"
                  src={iframeMountReady ? launchLinks.audience : "about:blank"}
                  className="mk3-demo-iframe mk3-demo-iframe-mobile"
                  loading="lazy"
                  allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone"
                />
              </div>
            </div>
          </div>
          <div className="mk3-demo-surface-status">
            <span>{`Mobile-framed audience client for room ${sanitizedRoomCode}`}</span>
            <strong>{sceneInteractionTotal} interactions per cycle</strong>
          </div>
        </article>

        <article className="mk3-demo-surface mk3-demo-host">
          <header>
            <span>Host Deck</span>
            <strong>{isAutoplayShowcase ? "Autopilot host deck" : "Live host deck"}</strong>
            <a href={launchLinks.host} target="_blank" rel="noreferrer">
              Open
            </a>
          </header>
          <div className="mk3-demo-frame-wrap mk3-demo-host-frame-wrap mk3-demo-host-frame-wrap-live">
            <iframe
              title="Host deck surface"
              src={iframeMountReady ? launchLinks.host : "about:blank"}
              className="mk3-demo-iframe"
              loading="lazy"
              allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone"
            />
          </div>
          {isAutoplayShowcase && activeHostAction && (
            <div className="mk3-demo-host-tooltip">
              <div className="mk3-demo-host-tooltip-kicker">
                Autopilot cue {Math.max(1, Number(activeHostAction.index || 0) + 1)}/{Math.max(1, Number(activeHostAction.total || 1))}
              </div>
              <strong>{activeHostAction.label || "Scripted host transition"}</strong>
              <p>{activeHostAction.explain || "Scene timeline drives host controls while native surfaces stay visible."}</p>
              <div className="mk3-demo-host-tooltip-result">Scripted controls in rotation: {HOST_CONTROL_BUTTONS.length}</div>
            </div>
          )}
          <div className="mk3-demo-surface-status">
            <span>{isAutoplayShowcase ? "Native host deck running scripted cues" : "Native host surface for room control and queue management"}</span>
            <strong>
              {isAutoplayShowcase
                ? "On-rails native view"
                : syncState.tone === "ok"
                  ? "Sync healthy"
                  : syncState.tone === "error"
                    ? "Sync issue"
                    : "Interactive live view"}
            </strong>
          </div>
        </article>
      </div>

      <article className="mk3-demo-launch">
        <h3>{isAutoplayShowcase ? "Demo On Rails Is Running" : "Launch Real Surfaces From This Room Code"}</h3>
        <p>
          {isAutoplayShowcase
            ? "This deterministic run keeps native TV, audience, and host surfaces on autopilot so real gameplay is always visible."
            : "Runs an ambient multi-surface loop with karaoke first, game moments in sequence, two Would You Rather resolutions, and a finale reset."}
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
