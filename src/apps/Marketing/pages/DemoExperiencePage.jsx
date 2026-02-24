import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";

const DEMO_SCENES = [
  {
    id: "karaoke_intro",
    label: "Karaoke Intro",
    mode: "karaoke",
    durationMs: 24000,
    title: "Warm open with lyrics + crowd energy",
    description: "Reactions climb while TV keeps the room synced on lyrics.",
    lyrics: ["Lights up, mic check, crowd in motion", "Hands up now, set the room in motion"],
    reactions: [
      { type: "clap", label: "Clap", seed: 2 },
      { type: "fire", label: "Fire", seed: 1 },
      { type: "heart", label: "Heart", seed: 1 },
      { type: "wow", label: "Wow", seed: 1 },
    ],
  },
  {
    id: "reaction_surge",
    label: "Reaction Surge",
    mode: "karaoke",
    durationMs: 22000,
    title: "Burst reactions across audience + TV",
    description: "Reaction bursts stack in waves instead of one lonely pulse.",
    lyrics: ["Call and response, side to side", "Energy climbs, no one stays quiet"],
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
    durationMs: 25000,
    title: "Lyrics drop, crowd drives guitar mode",
    description: "Lyrics drop out and the crowd takes over rhythm with taps and strums.",
    reactions: [
      { type: "strum", label: "Strum", seed: 2 },
      { type: "fire", label: "Fire", seed: 1 },
      { type: "clap", label: "Clap", seed: 1 },
      { type: "cheer", label: "Cheer", seed: 1 },
    ],
  },
  {
    id: "trivia_showdown",
    label: "Trivia Showdown",
    mode: "trivia",
    durationMs: 26000,
    title: "Switch from music to crowd trivia",
    description: "Audience votes pile up live, then the answer reveal lands.",
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
    id: "finale_drop",
    label: "Finale Drop",
    mode: "finale",
    durationMs: 23000,
    title: "Finale handoff + call to launch real room",
    description: "Close with synchronized hype, then jump into a real session.",
    lyrics: ["Final round, whole room together", "Host, TV, audience locked in forever"],
    reactions: [
      { type: "fire", label: "Fire", seed: 3 },
      { type: "cheer", label: "Cheer", seed: 3 },
      { type: "clap", label: "Clap", seed: 2 },
      { type: "party", label: "Party", seed: 2 },
    ],
  },
];

const DEMO_TOTAL_MS = DEMO_SCENES.reduce((sum, scene) => sum + scene.durationMs, 0);
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

const AUDIENCE_NAMES = [
  "Alex",
  "Jordan",
  "Taylor",
  "Casey",
  "Riley",
  "Quinn",
  "Parker",
  "Morgan",
  "Avery",
  "Harper",
  "Reese",
  "Kai",
  "Sawyer",
  "Finley",
  "Drew",
  "Blake",
];

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
  const token = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
  return token || "DEMO001";
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

const DemoExperiencePage = () => {
  const [timelineMs, setTimelineMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loopPlayback, setLoopPlayback] = useState(true);
  const [roomCode, setRoomCode] = useState("DEMO001");
  const [liveSync, setLiveSync] = useState(false);
  const [syncState, setSyncState] = useState({ tone: "muted", message: "Live sync is off." });

  const latestStateRef = useRef(null);
  const inFlightRef = useRef(false);
  const lastTickBucketRef = useRef(-1);
  const lastSceneIdRef = useRef("");
  const lastSequenceRef = useRef(0);

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

  const reactionRail = useMemo(() => (
    reactionEvents.flatMap((entry, index) => ([
      {
        id: `${entry.type}_${index}_a`,
        token: entry.token,
        label: `${entry.label} wave`,
        count: entry.count,
      },
      {
        id: `${entry.type}_${index}_b`,
        token: entry.token,
        label: `${entry.label} pulse`,
        count: entry.count + Math.max(1, Math.round(sceneProgress * 2)),
      },
    ])).slice(0, 8)
  ), [reactionEvents, sceneProgress]);

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

  const audienceCards = useMemo(
    () => AUDIENCE_NAMES
      .slice(0, crowdSize)
      .map((name, index) => ({
        id: `${name}_${index + 1}`,
        label: `${name} ${index + 1}`,
        online: index <= Math.round(sceneProgress * crowdSize) || index < 6,
      })),
    [crowdSize, sceneProgress]
  );

  const sanitizedRoomCode = useMemo(() => normalizeRoomCode(roomCode), [roomCode]);
  const baseHref = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return `${window.location.origin}${import.meta.env.BASE_URL || "/"}`;
  }, []);

  const launchLinks = useMemo(() => ({
    audience: `${baseHref}?room=${encodeURIComponent(sanitizedRoomCode)}`,
    tv: `${baseHref}?room=${encodeURIComponent(sanitizedRoomCode)}&mode=tv`,
    host: `${baseHref}?room=${encodeURIComponent(sanitizedRoomCode)}&mode=host`,
  }), [baseHref, sanitizedRoomCode]);

  latestStateRef.current = {
    timelineMs,
    activeScene,
    sceneProgress,
    crowdSize,
    reactionEvents,
    triviaModel,
    playing,
    roomCode: sanitizedRoomCode,
  };

  const sendDirectorAction = useCallback(async (action = "tick", overrides = null) => {
    const snapshot = latestStateRef.current;
    if (!snapshot) return;
    if (inFlightRef.current && action === "tick") return;
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
        ...(overrides && typeof overrides === "object" ? overrides : {}),
      };
      const result = await directoryActions.runDemoDirectorAction(payload);
      if (result?.stale) {
        setSyncState({ tone: "muted", message: `Skipped stale ${action} action.` });
        return;
      }
      setSyncState({ tone: "ok", message: `Synced ${action} at ${formatClock(snapshot.timelineMs)}.` });
    } catch (error) {
      setSyncState({ tone: "error", message: String(error?.message || "Live sync failed.") });
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!liveSync) return;
    const snapshot = latestStateRef.current;
    const seedSceneId = snapshot?.activeScene?.id || TIMELINE[0].id;
    const seedTimelineMs = Number(snapshot?.timelineMs || 0);
    lastSceneIdRef.current = seedSceneId;
    lastTickBucketRef.current = Math.floor(seedTimelineMs / 4000);
    sendDirectorAction("bootstrap");
  }, [liveSync, sanitizedRoomCode, sendDirectorAction]);

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
      <article className="mk3-demo-hero">
        <div className="mk3-chip">live demo arena</div>
        <h2>Scripted Multi-Surface Demo</h2>
        <p>
          Karaoke has felt dated for a long time. This demo shows a better formula: TV, audience, and host in one synced flow.
        </p>
        <div className="mk3-demo-toolbar">
          <button type="button" onClick={onTogglePlayback}>
            {playing ? "Pause Demo" : "Play Demo"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTimelineMs(0);
              setPlaying(true);
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
          <button
            type="button"
            onClick={() => {
              const next = !liveSync;
              setLiveSync(next);
              trackEvent("mk_demo_live_sync_toggle", { enabled: next ? 1 : 0 });
              if (!next) setSyncState({ tone: "muted", message: "Live sync is off." });
            }}
          >
            Live Sync: {liveSync ? "On" : "Off"}
          </button>
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

      <div className="mk3-demo-shell">
        <article className={`mk3-demo-surface mk3-demo-tv is-${activeScene.mode}`}>
          <header>
            <span>Public TV</span>
            <strong>{activeScene.label}</strong>
          </header>
          <div className="mk3-demo-tv-stage">
            <h3>{activeScene.title}</h3>
            <p>{activeScene.description}</p>
            {activeScene.mode === "karaoke" || activeScene.mode === "finale" ? (
              <div className="mk3-demo-lyrics">
                <div className="mk3-demo-lyric-meta">
                  <span>Lyrics On</span>
                  <span>{Math.round(sceneProgress * 100)}% through scene</span>
                </div>
                <strong>{activeScene.lyrics?.[0] || "Lyric line one"}</strong>
                <span>{activeScene.lyrics?.[1] || "Lyric line two"}</span>
              </div>
            ) : null}
            {activeScene.mode === "guitar" ? (
              <div className="mk3-demo-vibe-meter">
                <span>Vibe Sync Active - lyrics hidden</span>
                <div>
                  <i style={{ width: `${Math.max(12, Math.round(sceneProgress * 100))}%` }} />
                </div>
                <small>{Math.round(sceneProgress * 100)}% crowd rhythm lock</small>
              </div>
            ) : null}
            {activeScene.mode === "trivia" && triviaModel ? (
              <div className="mk3-demo-trivia">
                <strong>{triviaModel.question}</strong>
                <div className="mk3-demo-trivia-options">
                  {triviaModel.options.map((option, index) => {
                    const total = triviaModel.votes.reduce((sum, count) => sum + count, 0);
                    const votes = triviaModel.votes[index] || 0;
                    const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                    return (
                      <div key={`${option}_${index}`} className="mk3-demo-trivia-option">
                        <span>{option}</span>
                        <div className="mk3-demo-trivia-bar">
                          <div style={{ width: `${pct}%` }} />
                        </div>
                        <b>
                          {votes} votes
                          {triviaModel.status === "reveal" && index === triviaModel.correctIndex ? " | Correct" : ""}
                        </b>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <div className="mk3-demo-reaction-rail">
            {reactionRail.map((entry) => (
              <div key={entry.id} className="mk3-demo-reaction-item">
                <span>{entry.token}</span>
                <small>
                  {entry.label} x{entry.count}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article className="mk3-demo-surface mk3-demo-audience">
          <header>
            <span>Audience View</span>
            <strong>{crowdSize} connected</strong>
          </header>
          <div className="mk3-demo-surface-body">
            <h4>Mobile audience feed</h4>
            <p>Phones stay useful, but now they help people react together instead of scroll alone.</p>
            <div className="mk3-demo-audience-grid">
              {audienceCards.map((entry) => (
                <div key={entry.id} className={entry.online ? "online" : ""}>
                  {entry.label}
                </div>
              ))}
            </div>
            <div className="mk3-demo-mini-actions">
              <button type="button">React Burst</button>
              <button type="button">Vote</button>
              <button type="button">Join Queue</button>
            </div>
          </div>
        </article>

        <article className="mk3-demo-surface mk3-demo-host">
          <header>
            <span>Host Deck</span>
            <strong>Scene control + timing</strong>
          </header>
          <div className="mk3-demo-surface-body">
            <h4>Host-led sequence</h4>
            <p>Host can steer the full flow remotely, even when they cannot physically touch the public TV.</p>
            <div className="mk3-demo-host-stats">
              <div>
                <span>Current Scene</span>
                <strong>{activeScene.label}</strong>
              </div>
              <div>
                <span>Reaction Rate</span>
                <strong>{reactionEvents.reduce((sum, entry) => sum + entry.count, 0)}/tick</strong>
              </div>
              <div>
                <span>Sync Status</span>
                <strong>{syncState.tone === "ok" ? "Healthy" : syncState.tone === "error" ? "Issue" : "Local"}</strong>
              </div>
            </div>
          </div>
        </article>
      </div>

      <article className="mk3-demo-launch">
        <h3>Launch Real Surfaces From This Room Code</h3>
        <p>Use a `DEMO*` room code, then open each surface on separate tabs or devices.</p>
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
