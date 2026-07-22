const AUDIENCE_DECISION_TYPES = Object.freeze({
  continueOrRotate: "continue_or_rotate",
  skipPerformance: "skip_performance",
});

const SELF_SERVE_FORMATS = Object.freeze({
  openStage: "open_stage",
  spotlightAuction: "spotlight_auction",
});

const RELEASE_WINDOW_CHOICES = Object.freeze(["slot_scene", "keep_queue_moving"]);

const AUDIENCE_DECISION_STATUS = Object.freeze({
  open: "open",
  resolved: "resolved",
});

const AUDIENCE_DECISION_POLICIES = Object.freeze({
  [AUDIENCE_DECISION_TYPES.continueOrRotate]: {
    minimumVotes: 1,
    thresholdMode: "choice_threshold",
    thresholdChoiceId: "next_singer",
    thresholdPct: 55,
    fallbackChoiceId: "keep_singing",
    actionsByChoice: Object.freeze({
      keep_singing: "continue_song",
      next_singer: "wrap_and_rotate",
    }),
  },
  [AUDIENCE_DECISION_TYPES.skipPerformance]: {
    minimumVotes: 8,
    thresholdMode: "choice_threshold",
    thresholdChoiceId: "next_singer",
    thresholdPct: 70,
    fallbackChoiceId: "keep_singing",
    minElapsedSec: 90,
    actionsByChoice: Object.freeze({
      keep_singing: "continue_song",
      next_singer: "graceful_early_wrap",
    }),
  },
});

const getAudienceDecisionPolicy = (type = "") => (
  AUDIENCE_DECISION_POLICIES[String(type || "").trim().toLowerCase()]
  || AUDIENCE_DECISION_POLICIES[AUDIENCE_DECISION_TYPES.continueOrRotate]
);

const cleanText = (value = "", max = 240) => String(value || "").trim().slice(0, max);

const toNumber = (value = 0, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const clampNumber = (value = 0, min = 0, max = 100, fallback = 0) => {
  const next = toNumber(value, fallback);
  return Math.max(min, Math.min(max, next));
};

const normalizeChoiceId = (value = "") => cleanText(value, 80)
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, "_");

const normalizeVotesByUid = (votesByUid = {}, choiceIds = new Set()) => {
  if (!votesByUid || typeof votesByUid !== "object" || Array.isArray(votesByUid)) return {};
  return Object.fromEntries(
    Object.entries(votesByUid)
      .map(([uid, choice]) => [cleanText(uid, 180), normalizeChoiceId(choice)])
      .filter(([uid, choice]) => uid && (!choiceIds.size || choiceIds.has(choice)))
  );
};

const buildContinueOrRotateDecision = ({
  songId = "",
  songTitle = "",
  singerName = "",
  artistName = "",
  performanceSessionId = "",
  openedAtMs = Date.now(),
  openingWindowSec = 60,
  voteWindowSec = 12,
} = {}) => {
  const safeSongId = cleanText(songId, 180);
  const safeSessionId = cleanText(performanceSessionId, 180);
  const safeOpenedAtMs = Math.max(0, Math.round(toNumber(openedAtMs, Date.now())));
  const safeVoteWindowSec = clampNumber(Math.round(toNumber(voteWindowSec, 12)), 5, 45, 12);
  const safeOpeningWindowSec = clampNumber(Math.round(toNumber(openingWindowSec, 60)), 15, 180, 60);
  const decisionKey = `${safeSongId || "song"}_${safeSessionId || safeOpenedAtMs}_${safeOpeningWindowSec}`;
  return {
    id: `one_minute_mic_${decisionKey}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180),
    type: AUDIENCE_DECISION_TYPES.continueOrRotate,
    status: AUDIENCE_DECISION_STATUS.open,
    active: true,
    displayMode: "glass_overlay",
    prompt: "Keep singing or next singer?",
    subprompt: `Vote now for ${cleanText(singerName, 80) || "the singer"}. A tie keeps the singer.`,
    subjectSongId: safeSongId,
    subjectSessionId: safeSessionId,
    subjectTitle: cleanText(songTitle, 140) || "Current song",
    subjectSubtitle: cleanText(artistName, 140),
    openedAtMs: safeOpenedAtMs,
    closesAtMs: safeOpenedAtMs + (safeVoteWindowSec * 1000),
    openingWindowSec: safeOpeningWindowSec,
    voteWindowSec: safeVoteWindowSec,
    threshold: 0.55,
    minimumVotes: 1,
    thresholdMode: "choice_threshold",
    thresholdChoiceId: "next_singer",
    thresholdPct: 55,
    fallbackChoiceId: "keep_singing",
    choices: [
      {
        id: "keep_singing",
        label: "Keep Singing",
        detail: "Unlock the rest of the song.",
        action: "continue_song",
      },
      {
        id: "next_singer",
        label: "Next Singer",
        detail: "Wrap this one and rotate.",
        action: "wrap_and_rotate",
      },
    ],
    votesByUid: {},
  };
};

const buildSkipPerformanceDecision = ({
  songId = "",
  songTitle = "",
  singerName = "",
  artistName = "",
  performanceSessionId = "",
  openedAtMs = Date.now(),
  voteWindowSec = 15,
  minElapsedSec = 90,
} = {}) => {
  const safeSongId = cleanText(songId, 180);
  const safeSessionId = cleanText(performanceSessionId, 180);
  const safeOpenedAtMs = Math.max(0, Math.round(toNumber(openedAtMs, Date.now())));
  const safeVoteWindowSec = clampNumber(Math.round(toNumber(voteWindowSec, 15)), 8, 45, 15);
  const safeMinElapsedSec = clampNumber(Math.round(toNumber(minElapsedSec, 90)), 0, 3600, 90);
  const decisionKey = `${safeSongId || "song"}_${safeSessionId || safeOpenedAtMs}_${safeMinElapsedSec}`;
  return {
    id: `skip_performance_${decisionKey}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180),
    type: AUDIENCE_DECISION_TYPES.skipPerformance,
    status: AUDIENCE_DECISION_STATUS.open,
    active: true,
    displayMode: "glass_overlay",
    prompt: "Keep going or move on?",
    subprompt: `${cleanText(singerName, 80) || "The singer"} is on the mic. Moving on requires a strong crowd signal.`,
    subjectSongId: safeSongId,
    subjectSessionId: safeSessionId,
    subjectTitle: cleanText(songTitle, 140) || "Current song",
    subjectSubtitle: cleanText(artistName, 140),
    openedAtMs: safeOpenedAtMs,
    closesAtMs: safeOpenedAtMs + (safeVoteWindowSec * 1000),
    voteWindowSec: safeVoteWindowSec,
    minimumVotes: 8,
    thresholdMode: "choice_threshold",
    thresholdChoiceId: "next_singer",
    thresholdPct: 70,
    fallbackChoiceId: "keep_singing",
    minElapsedSec: safeMinElapsedSec,
    sensitive: true,
    choices: [
      {
        id: "keep_singing",
        label: "Keep Going",
        detail: "Let them finish the moment.",
        action: "continue_song",
      },
      {
        id: "next_singer",
        label: "Move To Next",
        detail: "Rotate kindly and keep the room moving.",
        action: "graceful_early_wrap",
      },
    ],
    votesByUid: {},
  };
};
const normalizeAudienceDecision = (decision = {}) => {
  const rawType = cleanText(decision?.type || "", 80).toLowerCase();
  const policy = getAudienceDecisionPolicy(rawType);
  const choices = Array.isArray(decision?.choices)
    ? decision.choices
      .map((choice) => {
        const id = normalizeChoiceId(choice?.id || choice?.key || "");
        return {
          id,
          label: cleanText(choice?.label || "", 140),
          action: cleanText(choice?.action || choice?.resultAction || policy.actionsByChoice?.[id] || "", 80),
        };
      })
      .filter((choice) => choice.id)
    : [];
  const choiceIds = new Set(choices.map((choice) => choice.id));
  const rawThresholdPct = hasValue(decision?.thresholdPct)
    ? decision.thresholdPct
    : hasValue(decision?.threshold)
      ? toNumber(decision.threshold, policy.thresholdPct / 100) * 100
      : policy.thresholdPct;
  const thresholdPct = clampNumber(rawThresholdPct, 0, 100, policy.thresholdPct);
  return {
    ...decision,
    id: cleanText(decision?.id || "", 180),
    type: rawType,
    status: cleanText(decision?.status || "", 40).toLowerCase(),
    subjectSongId: cleanText(decision?.subjectSongId || decision?.songId || "", 180),
    subjectSessionId: cleanText(decision?.subjectSessionId || decision?.sessionId || "", 180),
    openedAtMs: Math.max(0, Math.round(toNumber(decision?.openedAtMs, 0))),
    closesAtMs: Math.max(0, Math.round(toNumber(decision?.closesAtMs, 0))),
    resolvedAtMs: Math.max(0, Math.round(toNumber(decision?.resolvedAtMs, 0))),
    minimumVotes: Math.max(0, Math.round(hasValue(decision?.minimumVotes) ? toNumber(decision.minimumVotes, policy.minimumVotes) : policy.minimumVotes)),
    thresholdMode: cleanText(decision?.thresholdMode || policy.thresholdMode || "plurality", 80).toLowerCase(),
    thresholdChoiceId: normalizeChoiceId(decision?.thresholdChoiceId || policy.thresholdChoiceId || ""),
    thresholdPct,
    fallbackChoiceId: normalizeChoiceId(decision?.fallbackChoiceId || policy.fallbackChoiceId || ""),
    minElapsedSec: Math.max(0, Math.round(hasValue(decision?.minElapsedSec) ? toNumber(decision.minElapsedSec, policy.minElapsedSec || 0) : (policy.minElapsedSec || 0))),
    threshold: thresholdPct / 100,
    choices,
    votesByUid: normalizeVotesByUid(decision?.votesByUid, choiceIds),
  };
};

const resolveAudienceDecision = (decision = {}, nowMs = Date.now()) => {
  const normalized = normalizeAudienceDecision(decision);
  const policy = getAudienceDecisionPolicy(normalized.type);
  const countsByChoice = Object.fromEntries((normalized.choices || []).map((choice) => [choice.id, 0]));
  Object.values(normalized.votesByUid || {}).forEach((choiceId) => {
    if (countsByChoice[choiceId] !== undefined) countsByChoice[choiceId] += 1;
  });
  const totalVotes = Object.values(countsByChoice).reduce((sum, count) => sum + count, 0);
  const sortedChoices = (normalized.choices || [])
    .map((choice) => ({
      ...choice,
      count: countsByChoice[choice.id] || 0,
      pct: totalVotes > 0 ? ((countsByChoice[choice.id] || 0) / totalVotes) * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count);
  const leader = sortedChoices[0] || null;
  const runnerUp = sortedChoices[1] || null;
  const tied = !!(leader && runnerUp && leader.count === runnerUp.count);
  const thresholdChoiceId = normalized.thresholdChoiceId || leader?.id || "";
  const thresholdChoiceCount = countsByChoice[thresholdChoiceId] || 0;
  const thresholdChoicePct = totalVotes > 0 ? (thresholdChoiceCount / totalVotes) * 100 : 0;
  let resultChoice = normalizeChoiceId(normalized.resultChoice || "");

  if (!resultChoice && totalVotes >= normalized.minimumVotes) {
    if (normalized.thresholdMode === "choice_threshold") {
      resultChoice = thresholdChoicePct >= normalized.thresholdPct
        ? thresholdChoiceId
        : normalized.fallbackChoiceId;
    } else {
      resultChoice = !tied && leader?.pct >= normalized.thresholdPct
        ? leader.id
        : normalized.fallbackChoiceId;
    }
  }

  if (!resultChoice && normalized.fallbackChoiceId) resultChoice = normalized.fallbackChoiceId;
  const choiceById = Object.fromEntries((normalized.choices || []).map((choice) => [choice.id, choice]));
  if (!choiceById[resultChoice]) resultChoice = "";
  const resolutionAction = choiceById[resultChoice]?.action || policy.actionsByChoice?.[resultChoice] || "";
  const resolutionReason = cleanText(normalized.resolutionReason || "", 80) || (
    totalVotes < normalized.minimumVotes
      ? "insufficient_votes"
      : tied
        ? "tie_keeps_singer"
        : resultChoice === normalized.thresholdChoiceId
          ? "threshold_met"
          : "threshold_not_met"
  );
  const resolvedAtMs = Math.max(Math.round(toNumber(nowMs, Date.now())), normalized.closesAtMs || 0);
  return {
    resultChoice,
    resolutionAction,
    resolutionReason,
    decision: {
      ...decision,
      active: false,
      status: AUDIENCE_DECISION_STATUS.resolved,
      resolvedAtMs,
      resultChoice,
      resolutionAction,
      resolutionReason,
      votesSummary: {
        total: totalVotes,
        ...countsByChoice,
      },
    },
  };
};
const isOneMinuteMicRoomEnabled = (room = {}) => (
  room?.oneMinuteMicEnabled === true
  || cleanText(room?.performanceProgressionMode || "", 80).toLowerCase() === "one_minute_mic"
);

const getActivePerformance = (room = {}) => {
  const session = room?.currentPerformanceSession && typeof room.currentPerformanceSession === "object"
    ? room.currentPerformanceSession
    : {};
  const meta = room?.currentPerformanceMeta && typeof room.currentPerformanceMeta === "object"
    ? room.currentPerformanceMeta
    : {};
  const songId = cleanText(session?.songId || meta?.songId || "", 180);
  const startedAtMs = Math.max(
    songId && cleanText(session?.songId || "", 180) === songId ? Math.round(toNumber(session?.startedAtMs, 0)) : 0,
    songId && cleanText(meta?.songId || "", 180) === songId ? Math.round(toNumber(meta?.startedAtMs, 0)) : 0
  );
  if (!songId || !startedAtMs) return null;
  return {
    songId,
    sessionId: cleanText(session?.sessionId || "", 180),
    startedAtMs,
    songTitle: cleanText(meta?.songTitle || session?.songTitle || "Current song", 140),
    singerName: cleanText(meta?.singerName || session?.singerName || "Singer", 80),
    artistName: cleanText(meta?.artist || meta?.artistName || session?.artist || "", 140),
  };
};

const getRoomApplauseTiming = (room = {}) => {
  const warmupSec = clampNumber(Math.round(toNumber(room?.applauseWarmupSec, 0)), 0, 8, 0);
  const countdownSec = clampNumber(Math.round(toNumber(room?.applauseCountdownSec, 0)), 0, 8, 0);
  const measureSec = clampNumber(Math.round(toNumber(room?.applauseMeasureSec, 5)), 2, 10, 5);
  return {
    warmupSec,
    countdownSec,
    measureSec,
    resultSec: 5,
    graceSec: 3,
  };
};

const getApplauseAutoFinalizeDelayMs = (room = {}) => {
  const timing = getRoomApplauseTiming(room);
  return (timing.warmupSec + timing.countdownSec + timing.measureSec + timing.resultSec + timing.graceSec) * 1000;
};

const ONE_MINUTE_MIC_ROTATE_FADE_MS = 3500;

const buildAutomationCommand = ({ decision = {}, room = {}, roomCode = "", nowMs = Date.now() } = {}) => {
  const subjectSongId = cleanText(decision?.subjectSongId || decision?.songId || "", 180);
  const subjectSessionId = cleanText(decision?.subjectSessionId || decision?.sessionId || "", 180);
  const resolvedAtMs = Math.max(0, Math.round(toNumber(decision?.resolvedAtMs, nowMs)));
  const createdAtMs = resolvedAtMs || Math.round(toNumber(nowMs, Date.now()));
  return {
    id: `one_minute_mic_rotate_${roomCode}_${subjectSongId}_${subjectSessionId || createdAtMs}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180),
    source: "one_minute_mic",
    action: "finish_performance",
    status: "server_started",
    songId: subjectSongId,
    sessionId: subjectSessionId,
    createdAtMs,
    finalizeAfterMs: createdAtMs + getApplauseAutoFinalizeDelayMs(room),
  };
};

const buildApplauseSubject = ({ room = {}, decision = {}, command = {}, nowMs = Date.now() } = {}) => {
  const songId = cleanText(command?.songId || decision?.subjectSongId || decision?.songId || "", 180);
  const sessionId = cleanText(command?.sessionId || decision?.subjectSessionId || "", 180);
  const meta = room?.currentPerformanceMeta && typeof room.currentPerformanceMeta === "object" ? room.currentPerformanceMeta : {};
  const createdAtMs = Math.max(0, Math.round(toNumber(command?.createdAtMs, nowMs)));
  const finalizeAfterMs = Math.max(createdAtMs, Math.round(toNumber(command?.finalizeAfterMs, createdAtMs + getApplauseAutoFinalizeDelayMs(room))));
  return {
    id: songId,
    songId,
    songDocId: songId,
    performanceSessionId: sessionId || null,
    songTitle: cleanText(meta?.songTitle || decision?.subjectTitle || "Current song", 140),
    title: cleanText(meta?.songTitle || decision?.subjectTitle || "Current song", 140),
    artist: cleanText(meta?.artist || meta?.artistName || decision?.subjectSubtitle || "", 140),
    singerName: cleanText(meta?.singerName || decision?.singerName || "Singer", 80),
    performerName: cleanText(meta?.singerName || decision?.singerName || "Singer", 80),
    albumArtUrl: cleanText(meta?.albumArtUrl || "", 500),
    autoFinalize: true,
    autoFinalizeSongId: songId,
    autoFinalizeStartedAtMs: createdAtMs,
    autoFinalizeDeadlineMs: finalizeAfterMs,
    source: "one_minute_mic_server",
  };
};

const buildServerApplauseStartPatch = ({ room = {}, decision = {}, roomCode = "", nowMs = Date.now() } = {}) => {
  const command = buildAutomationCommand({ decision, room, roomCode, nowMs });
  return {
    activeMode: "applause_countdown",
    activeScreen: "stage",
    applausePeak: 0,
    currentApplauseLevel: 0,
    applauseSubject: buildApplauseSubject({ room, decision, command, nowMs }),
    audienceAutomationCommand: command,
    announcement: null,
    tvPreviewOverlay: null,
    roundWinnersMoment: null,
    oneMinuteMicWrapCue: null,
    howToPlay: { active: false, id: Math.round(toNumber(nowMs, Date.now())) },
    "readyCheck.active": false,
  };
};

const buildOneMinuteMicRotateFadePatch = ({ room = {}, decision = {}, roomCode = "", nowMs = Date.now() } = {}) => {
  const command = buildAutomationCommand({ decision, room, roomCode, nowMs });
  const fadeStartedAtMs = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  const fadeEndsAtMs = fadeStartedAtMs + ONE_MINUTE_MIC_ROTATE_FADE_MS;
  return {
    activeMode: "karaoke",
    activeScreen: "stage",
    audienceAutomationCommand: {
      ...command,
      status: "fade_pending",
      fadeStartedAtMs,
      fadeEndsAtMs,
      finalizeAfterMs: fadeEndsAtMs + getApplauseAutoFinalizeDelayMs(room),
    },
    oneMinuteMicWrapCue: {
      active: true,
      type: "rotate_fade",
      songId: cleanText(command?.songId || decision?.subjectSongId || decision?.songId || "", 180),
      sessionId: cleanText(command?.sessionId || decision?.subjectSessionId || "", 180),
      startedAtMs: fadeStartedAtMs,
      endsAtMs: fadeEndsAtMs,
    },
  };
};

const buildOneMinuteMicRoomPatch = ({ room = {}, roomCode = "", nowMs = Date.now() } = {}) => {
  const nowValue = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  if (!isOneMinuteMicRoomEnabled(room)) return null;
  if (cleanText(room?.activeMode || "", 40).toLowerCase() !== "karaoke") return null;
  const performance = getActivePerformance(room);
  if (!performance) return null;

  const existingDecision = room?.audienceDecision && typeof room.audienceDecision === "object"
    ? normalizeAudienceDecision(room.audienceDecision)
    : null;
  const existingCommand = room?.audienceAutomationCommand && typeof room.audienceAutomationCommand === "object"
    ? room.audienceAutomationCommand
    : null;
  if (
    cleanText(existingCommand?.source || "", 80) === "one_minute_mic"
    && cleanText(existingCommand?.action || "", 80) === "finish_performance"
    && cleanText(existingCommand?.status || "", 80) === "fade_pending"
  ) {
    const commandSongId = cleanText(existingCommand?.songId || "", 180);
    const fadeEndsAtMs = Math.max(0, Math.round(toNumber(existingCommand?.fadeEndsAtMs, 0)));
    if (commandSongId && commandSongId === performance.songId && fadeEndsAtMs > 0 && nowValue >= fadeEndsAtMs) {
      return buildServerApplauseStartPatch({
        room,
        decision: existingDecision || {
          subjectSongId: commandSongId,
          subjectSessionId: cleanText(existingCommand?.sessionId || "", 180),
          resolvedAtMs: nowValue,
        },
        roomCode,
        nowMs: nowValue,
      });
    }
    return null;
  }
  if ([AUDIENCE_DECISION_TYPES.continueOrRotate, AUDIENCE_DECISION_TYPES.skipPerformance].includes(existingDecision?.type)) {
    const sameSong = existingDecision.subjectSongId === performance.songId;
    if (!sameSong) return null;
    const minimumElapsedMs = existingDecision.type === AUDIENCE_DECISION_TYPES.skipPerformance
      ? Math.max(0, Math.round(toNumber(existingDecision.minElapsedSec, 0))) * 1000
      : 0;
    if (minimumElapsedMs > 0 && nowValue < performance.startedAtMs + minimumElapsedMs) return null;
    if (existingDecision.status === AUDIENCE_DECISION_STATUS.open && existingDecision.closesAtMs > 0 && nowValue >= existingDecision.closesAtMs) {
      const resolution = resolveAudienceDecision(room.audienceDecision, nowValue);
      const patch = {
        audienceDecision: resolution.decision,
      };
      if (["wrap_and_rotate", "graceful_early_wrap"].includes(resolution.resolutionAction)) {
        Object.assign(patch, buildOneMinuteMicRotateFadePatch({
          room,
          decision: resolution.decision,
          roomCode,
          nowMs: nowValue,
        }));
      }
      return patch;
    }
    return null;
  }

  const openingWindowSec = clampNumber(Math.round(toNumber(room?.oneMinuteMicOpeningWindowSec, 60)), 15, 180, 60);
  const voteWindowSec = clampNumber(Math.round(toNumber(room?.oneMinuteMicVoteWindowSec, 12)), 5, 45, 12);
  const openAtMs = performance.startedAtMs + (openingWindowSec * 1000);
  const decisionKey = `${performance.songId}:${performance.sessionId || performance.startedAtMs}:${openAtMs}`;
  if (cleanText(room?.oneMinuteMicLastDecisionKey || "", 240) === decisionKey) return null;
  if (nowValue < openAtMs) return null;

  return {
    audienceDecision: buildContinueOrRotateDecision({
      songId: performance.songId,
      songTitle: performance.songTitle,
      singerName: performance.singerName,
      artistName: performance.artistName,
      performanceSessionId: performance.sessionId,
      openedAtMs: nowValue,
      openingWindowSec,
      voteWindowSec,
    }),
    oneMinuteMicLastDecisionKey: decisionKey,
  };
};

const normalizeSelfServeFormat = (value = "") => {
  const token = cleanText(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (["support_surge", "fundraiser_surge", "donor_surge"].includes(token)) return SELF_SERVE_FORMATS.spotlightAuction;
  if (token === SELF_SERVE_FORMATS.spotlightAuction) return SELF_SERVE_FORMATS.spotlightAuction;
  return token === SELF_SERVE_FORMATS.openStage ? SELF_SERVE_FORMATS.openStage : "";
};

const getReleaseWindow = (room = {}) => (
  room?.runOfShowDirector?.releaseWindow && typeof room.runOfShowDirector.releaseWindow === "object"
    ? room.runOfShowDirector.releaseWindow
    : null
);

const isReleaseWindowOpen = (releaseWindow = null, nowMs = Date.now()) => {
  if (!releaseWindow || releaseWindow?.active !== true) return false;
  if (toNumber(releaseWindow?.resolvedAtMs, 0) > 0) return false;
  const closesAtMs = Math.max(0, Math.round(toNumber(releaseWindow?.closesAtMs, 0)));
  return closesAtMs <= 0 || Math.max(0, Math.round(toNumber(nowMs, Date.now()))) < closesAtMs;
};

const hasOpenAudienceDecision = (room = {}, nowMs = Date.now()) => {
  const decision = room?.audienceDecision && typeof room.audienceDecision === "object"
    ? normalizeAudienceDecision(room.audienceDecision)
    : null;
  if (!decision) return false;
  if (decision.status !== AUDIENCE_DECISION_STATUS.open) return false;
  return !decision.closesAtMs || Math.max(0, Math.round(toNumber(nowMs, Date.now()))) < decision.closesAtMs;
};

const isSelfServeOpenStageRoom = (room = {}) => {
  const selfServeMode = room?.selfServeMode && typeof room.selfServeMode === "object" ? room.selfServeMode : null;
  if (selfServeMode?.enabled !== true) return false;
  return normalizeSelfServeFormat(selfServeMode?.format || "") === SELF_SERVE_FORMATS.openStage;
};

const formatDurationLabel = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.round(toNumber(seconds, 0)));
  if (!safeSeconds) return "";
  const mins = Math.floor(safeSeconds / 60);
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

const getSongArtworkUrl = (song = {}) => cleanText(
  song?.albumArtUrl
  || song?.artworkUrl100
  || song?.artworkUrl
  || song?.imageUrl
  || song?.coverUrl
  || song?.artUrl
  || "",
  500
);

const getQueueSongLabel = (song = {}) => cleanText(song?.songTitle || song?.title || "Song", 140);
const getQueueSongSinger = (song = {}) => cleanText(song?.singerName || song?.name || "Singer", 80);
const getQueueSongArtist = (song = {}) => cleanText(song?.artist || song?.artistName || "", 140);

const getReleaseWindowTally = (releaseWindow = {}) => {
  const counts = { slot_scene: 0, keep_queue_moving: 0 };
  const votesByUid = releaseWindow?.votesByUid && typeof releaseWindow.votesByUid === "object" && !Array.isArray(releaseWindow.votesByUid)
    ? releaseWindow.votesByUid
    : {};
  Object.values(votesByUid).forEach((choice) => {
    const safeChoice = cleanText(choice, 80).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, safeChoice)) counts[safeChoice] += 1;
  });
  const totalVotes = counts.slot_scene + counts.keep_queue_moving;
  const tied = totalVotes > 0 && counts.slot_scene === counts.keep_queue_moving;
  const leadingChoice = !totalVotes || tied
    ? ""
    : counts.slot_scene > counts.keep_queue_moving ? "slot_scene" : "keep_queue_moving";
  return { ...counts, totalVotes, tied, leadingChoice };
};

const selectAudienceLedQueueFaceOffCandidates = (songs = [], room = {}, limit = 2) => {
  const currentPerformance = getActivePerformance(room);
  const currentSongId = cleanText(currentPerformance?.songId || "", 180);
  const eligibleStatuses = new Set(["assigned", "pending", "requested"]);
  const statusRank = { assigned: 0, pending: 1, requested: 2 };
  return (Array.isArray(songs) ? songs : [])
    .filter((song) => {
      const songId = cleanText(song?.id || song?.songDocId || "", 180);
      if (!songId || songId === currentSongId) return false;
      if (!eligibleStatuses.has(cleanText(song?.status || "", 40).toLowerCase())) return false;
      return !!getBackingMediaUrl(song);
    })
    .sort((left, right) => {
      const leftStatus = cleanText(left?.status || "requested", 40).toLowerCase();
      const rightStatus = cleanText(right?.status || "requested", 40).toLowerCase();
      const leftPriority = toTimestampMs(left?.priorityScore) || toTimestampMs(left?.timestamp) || 0;
      const rightPriority = toTimestampMs(right?.priorityScore) || toTimestampMs(right?.timestamp) || 0;
      return (statusRank[leftStatus] ?? 2) - (statusRank[rightStatus] ?? 2) || leftPriority - rightPriority;
    })
    .slice(0, limit);
};

const buildAudienceLedQueueFaceOffWindow = ({ firstSong = null, secondSong = null, openedAtMs = Date.now(), durationSec = 18, hasCurrentPerformance = false } = {}) => {
  const firstSongId = cleanText(firstSong?.id || firstSong?.songDocId || "", 180);
  const secondSongId = cleanText(secondSong?.id || secondSong?.songDocId || "", 180);
  if (!firstSongId || !secondSongId || firstSongId === secondSongId) return null;
  const safeOpenedAtMs = Math.max(1, Math.round(toNumber(openedAtMs, Date.now())));
  const safeDurationSec = clampNumber(Math.round(toNumber(durationSec, 18)), 10, 30, 18);
  const firstDurationLabel = formatDurationLabel(getSongDurationSec(firstSong));
  const secondDurationLabel = formatDurationLabel(getSongDurationSec(secondSong));
  const firstArtist = getQueueSongArtist(firstSong);
  const secondArtist = getQueueSongArtist(secondSong);
  return {
    active: true,
    itemId: `self_serve_queue_faceoff:${firstSongId}:${secondSongId}:${safeOpenedAtMs}`,
    itemTitle: "BeauRocks Open Stage Crowd Pick",
    subjectType: "queue_faceoff",
    governanceMode: "crowd_vote",
    releasePolicy: "auto_flight_winner",
    origin: "self_serve_open_stage_auto",
    selfServeFormat: SELF_SERVE_FORMATS.openStage,
    prompt: "Crowd pick the next spotlight.",
    promptDetail: hasCurrentPerformance
      ? "Vote while the current song is live."
      : "Vote between ready songs before the next singer starts.",
    durationSec: safeDurationSec,
    openedAtMs: safeOpenedAtMs,
    closesAtMs: safeOpenedAtMs + (safeDurationSec * 1000),
    choiceLabels: {
      slot_scene: getQueueSongLabel(firstSong),
      keep_queue_moving: getQueueSongLabel(secondSong),
    },
    choiceDetails: {
      slot_scene: getQueueSongSinger(firstSong),
      keep_queue_moving: getQueueSongSinger(secondSong),
    },
    choiceSublines: {
      slot_scene: [firstArtist, firstDurationLabel].filter(Boolean).join(" - "),
      keep_queue_moving: [secondArtist, secondDurationLabel].filter(Boolean).join(" - "),
    },
    choiceArtworkUrls: {
      slot_scene: getSongArtworkUrl(firstSong),
      keep_queue_moving: getSongArtworkUrl(secondSong),
    },
    choiceMetadata: {
      slot_scene: { durationLabel: firstDurationLabel, artist: firstArtist, singerName: getQueueSongSinger(firstSong) },
      keep_queue_moving: { durationLabel: secondDurationLabel, artist: secondArtist, singerName: getQueueSongSinger(secondSong) },
    },
    choiceSongIds: {
      slot_scene: firstSongId,
      keep_queue_moving: secondSongId,
    },
    votesByUid: {},
    resultChoice: "",
    resolvedAtMs: 0,
  };
};

const getAudienceLedFaceOffContextKey = (room = {}, candidates = []) => {
  const performance = getActivePerformance(room);
  if (performance?.songId) return `current:${performance.songId}:${performance.sessionId || performance.startedAtMs}`;
  const lastPerformanceTs = toTimestampMs(room?.lastPerformance?.timestamp || room?.lastPerformance?.performedAtMs || room?.lastPerformance?.endedAtMs);
  if (lastPerformanceTs) return `between:${lastPerformanceTs}`;
  return `idle:${cleanText(candidates?.[0]?.id || candidates?.[0]?.songDocId || "", 80)}:${cleanText(candidates?.[1]?.id || candidates?.[1]?.songDocId || "", 80)}`;
};

const buildRunOfShowDirectorPatch = (room = {}, releaseWindow = {}) => ({
  ...(room?.runOfShowDirector && typeof room.runOfShowDirector === "object" ? room.runOfShowDirector : {}),
  releaseWindow,
});

const buildAudienceLedWinnerSongPatches = ({ songs = [], winnerSongId = "", nowMs = Date.now() } = {}) => {
  const targetSongId = cleanText(winnerSongId, 180);
  if (!targetSongId) return [];
  const orderedQueue = selectAudienceLedQueueFaceOffCandidates(songs, {}, Number.POSITIVE_INFINITY)
    .filter((song) => cleanText(song?.id || song?.songDocId || "", 180) !== targetSongId);
  const targetSong = (Array.isArray(songs) ? songs : []).find((song) => cleanText(song?.id || song?.songDocId || "", 180) === targetSongId) || null;
  if (!targetSong) return [];
  const base = Math.max(1, Math.round(toNumber(nowMs, Date.now())));
  return [targetSong, ...orderedQueue]
    .map((song, idx) => {
      const songId = cleanText(song?.id || song?.songDocId || "", 180);
      if (!songId) return null;
      return {
        songId,
        patch: {
          priorityScore: base + idx,
          ...(songId === targetSongId ? {
            status: "requested",
            holdReason: null,
            heldAt: null,
            restoredAtMs: base,
          } : {}),
        },
      };
    })
    .filter(Boolean);
};

const buildAudienceLedQueueFaceOffPlan = ({ room = {}, songs = [], nowMs = Date.now() } = {}) => {
  const nowValue = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  if (!isSelfServeOpenStageRoom(room)) return null;
  const releaseWindow = getReleaseWindow(room);
  const releaseOrigin = cleanText(releaseWindow?.origin || "", 120).toLowerCase();
  const releaseType = cleanText(releaseWindow?.subjectType || "", 80).toLowerCase();
  const isSelfServeQueueFaceOff = releaseType === "queue_faceoff" && releaseOrigin === "self_serve_open_stage_auto";
  if (releaseWindow?.active === true && !isSelfServeQueueFaceOff) {
    return { holdAdvance: true, reason: "another_decision_open" };
  }

  if (isSelfServeQueueFaceOff && releaseWindow?.active === true && toNumber(releaseWindow?.resolvedAtMs, 0) <= 0) {
    if (isReleaseWindowOpen(releaseWindow, nowValue)) return { holdAdvance: true, reason: "audience_faceoff_open" };
    const tally = getReleaseWindowTally(releaseWindow);
    const resultChoice = tally.leadingChoice || "";
    const winnerSongId = resultChoice ? cleanText(releaseWindow?.choiceSongIds?.[resultChoice] || "", 180) : "";
    const resolvedWindow = {
      ...releaseWindow,
      active: false,
      resultChoice,
      resolvedAtMs: nowValue,
      votesSummary: tally,
    };
    return {
      holdAdvance: false,
      roomPatch: {
        runOfShowDirector: buildRunOfShowDirectorPatch(room, resolvedWindow),
        selfServeMode: {
          ...(room?.selfServeMode || {}),
          phase: winnerSongId ? "winner_locked" : "live",
          lastCrowdWinnerSongId: winnerSongId,
          lastCrowdVoteResolvedAtMs: nowValue,
        },
      },
      songPatches: winnerSongId ? buildAudienceLedWinnerSongPatches({ songs, winnerSongId, nowMs: nowValue }) : [],
      resolved: true,
      winnerSongId,
    };
  }

  if (isReleaseWindowOpen(releaseWindow, nowValue) || hasOpenAudienceDecision(room, nowValue)) {
    return { holdAdvance: true, reason: "another_decision_open" };
  }

  const currentPerformance = getActivePerformance(room);
  if (currentPerformance?.songId) return null;
  const candidates = selectAudienceLedQueueFaceOffCandidates(songs, room);
  if (candidates.length < 2) return null;
  const contextKey = getAudienceLedFaceOffContextKey(room, candidates);
  if (cleanText(room?.selfServeMode?.lastAutoFaceOffForCurrentId || "", 240) === contextKey) return null;
  const releaseWindowPatch = buildAudienceLedQueueFaceOffWindow({
    firstSong: candidates[0],
    secondSong: candidates[1],
    openedAtMs: nowValue,
    durationSec: room?.selfServeMode?.queueFaceOffDurationSec || 18,
    hasCurrentPerformance: false,
  });
  if (!releaseWindowPatch) return null;
  return {
    holdAdvance: true,
    roomPatch: {
      runOfShowDirector: buildRunOfShowDirectorPatch(room, releaseWindowPatch),
      selfServeMode: {
        ...(room?.selfServeMode || {}),
        phase: "crowd_vote",
        lastAutoFaceOffForCurrentId: contextKey,
      },
    },
    opened: true,
  };
};
const toTimestampMs = (value = 0) => {
  if (!value) return 0;
  if (typeof value === "number") return Math.max(0, Math.round(value));
  if (typeof value?.toMillis === "function") return Math.max(0, Math.round(value.toMillis()));
  if (typeof value?.seconds === "number") return Math.max(0, Math.round(value.seconds * 1000));
  return 0;
};

const getOneMinuteMicFinalizeCandidate = (room = {}, nowMs = Date.now()) => {
  const command = room?.audienceAutomationCommand && typeof room.audienceAutomationCommand === "object"
    ? room.audienceAutomationCommand
    : null;
  if (!command) return null;
  if (cleanText(command?.source || "", 80) !== "one_minute_mic") return null;
  if (cleanText(command?.action || "", 80) !== "finish_performance") return null;
  if (cleanText(command?.status || "", 80) !== "server_started") return null;
  const songId = cleanText(command?.songId || "", 180);
  if (!songId) return null;
  const finalizeAfterMs = Math.max(0, Math.round(toNumber(command?.finalizeAfterMs, 0)));
  const nowValue = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  if (finalizeAfterMs > 0 && nowValue < finalizeAfterMs) return null;
  return {
    command,
    songId,
    nowMs: nowValue,
  };
};

const buildNextUpSnapshot = ({ songs = [], completedSongId = "" } = {}) => (
  (Array.isArray(songs) ? songs : [])
    .filter((song) => {
      const id = cleanText(song?.id || song?.songDocId || "", 180);
      if (completedSongId && id === completedSongId) return false;
      const status = cleanText(song?.status || "", 40).toLowerCase();
      return ["assigned", "pending", "requested"].includes(status);
    })
    .sort((left, right) => {
      const leftPriority = toTimestampMs(left?.priorityScore) || toTimestampMs(left?.timestamp) || 0;
      const rightPriority = toTimestampMs(right?.priorityScore) || toTimestampMs(right?.timestamp) || 0;
      return leftPriority - rightPriority;
    })
    .slice(0, 3)
    .map((song) => ({
      id: cleanText(song?.id || song?.songDocId || "", 180),
      songTitle: cleanText(song?.songTitle || song?.title || "Song", 140),
      artist: cleanText(song?.artist || "", 140),
      singerName: cleanText(song?.singerName || "Singer", 80),
      albumArtUrl: cleanText(song?.albumArtUrl || "", 500),
      status: cleanText(song?.status || "requested", 40),
    }))
);

const getBackingMediaUrl = (song = {}) => cleanText(
  song?.mediaUrl
  || song?.backingPlan?.mediaUrl
  || song?.selectedBacking?.mediaUrl
  || song?.approvedBacking?.mediaUrl
  || song?.approvedBrowseBacking?.mediaUrl
  || "",
  1000
);

const getSongDurationSec = (song = {}) => {
  const candidates = [
    song?.performanceStartedDurationSec,
    song?.backingPlan?.durationSec,
    song?.selectedBacking?.durationSec,
    song?.approvedBacking?.durationSec,
    song?.approvedBrowseBacking?.durationSec,
    song?.mediaDurationSec,
    song?.backingDurationSec,
    song?.trackDurationSec,
    song?.durationSec,
    song?.duration,
  ];
  for (const candidate of candidates) {
    const durationSec = Math.max(0, Math.round(toNumber(candidate, 0)));
    if (durationSec > 0) return durationSec;
  }
  return 180;
};

const getPerformanceSessionSourceType = (mediaUrl = "") => {
  const safeMediaUrl = cleanText(mediaUrl, 1000).toLowerCase();
  if (!safeMediaUrl) return "none";
  if (/youtu\.?be|youtube\.com/i.test(safeMediaUrl)) return "youtube";
  if (/\.(mp3|m4a|wav|ogg|aac|flac)(\?|$)/i.test(safeMediaUrl)) return "native_audio";
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(safeMediaUrl)) return "native_video";
  return "backing_media";
};

const isRoomReadyForServerAdvance = (room = {}, nowMs = Date.now()) => {
  if (!isOneMinuteMicRoomEnabled(room)) return false;
  if (room?.autoDj === false) return false;
  const activeMode = cleanText(room?.activeMode || "", 40).toLowerCase();
  if (!["", "karaoke"].includes(activeMode)) return false;
  const currentSession = room?.currentPerformanceSession && typeof room.currentPerformanceSession === "object" ? room.currentPerformanceSession : null;
  const currentMeta = room?.currentPerformanceMeta && typeof room.currentPerformanceMeta === "object" ? room.currentPerformanceMeta : null;
  if (cleanText(currentSession?.songId || "", 180) || cleanText(currentMeta?.songId || "", 180)) return false;
  const lastPerformanceTs = toTimestampMs(room?.lastPerformance?.timestamp);
  if (!lastPerformanceTs) return false;
  const delaySec = clampNumber(Math.round(toNumber(room?.autoDjDelaySec, 10)), 2, 45, 10);
  const holdMs = delaySec * 1000;
  return Math.max(0, Math.round(toNumber(nowMs, Date.now()))) >= lastPerformanceTs + holdMs;
};

const selectNextServerAdvanceSong = (songs = []) => {
  const eligibleStatuses = new Set(["assigned", "pending", "requested"]);
  return (Array.isArray(songs) ? songs : [])
    .filter((song) => eligibleStatuses.has(cleanText(song?.status || "", 40).toLowerCase()))
    .filter((song) => getBackingMediaUrl(song))
    .sort((left, right) => {
      const statusRank = { assigned: 0, pending: 1, requested: 2 };
      const leftStatus = cleanText(left?.status || "requested", 40).toLowerCase();
      const rightStatus = cleanText(right?.status || "requested", 40).toLowerCase();
      const leftPriority = toTimestampMs(left?.priorityScore) || toTimestampMs(left?.timestamp) || 0;
      const rightPriority = toTimestampMs(right?.priorityScore) || toTimestampMs(right?.timestamp) || 0;
      return (statusRank[leftStatus] ?? 2) - (statusRank[rightStatus] ?? 2) || leftPriority - rightPriority;
    })[0] || null;
};

const buildOneMinuteMicAdvancePlan = ({ room = {}, songs = [], nowMs = Date.now() } = {}) => {
  const nowValue = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  if (!isRoomReadyForServerAdvance(room, nowValue)) return null;
  const nextSong = selectNextServerAdvanceSong(songs);
  if (!nextSong?.id) return null;
  const songId = cleanText(nextSong.id || nextSong.songDocId || "", 180);
  const mediaUrl = getBackingMediaUrl(nextSong);
  if (!songId || !mediaUrl) return null;
  const durationSec = Math.max(30, Math.round(getSongDurationSec(nextSong)) || 180);
  const autoStartMedia = room?.autoPlayMedia !== false;
  const performanceSessionId = `perf_${songId}_${nowValue}`;
  const sourceType = getPerformanceSessionSourceType(mediaUrl);
  return {
    songId,
    roomPatch: {
      activeMode: "karaoke",
      "announcement.active": false,
      mediaUrl,
      singAlongMode: false,
      videoPlaying: autoStartMedia,
      videoStartTimestamp: autoStartMedia ? nowValue : null,
      pausedAt: null,
      currentPerformanceMeta: {
        songId,
        startedAtMs: nowValue,
        durationSec,
        backingDurationSec: durationSec,
        durationSource: "server_queue_metadata",
        durationConfidence: "medium",
        autoEndSafe: false,
        source: mediaUrl ? "backing_media" : "none",
        mediaUrl,
        songTitle: cleanText(nextSong?.songTitle || nextSong?.title || "Current song", 140),
        artist: cleanText(nextSong?.artist || "", 140),
        singerName: cleanText(nextSong?.singerName || "Singer", 80),
        albumArtUrl: cleanText(nextSong?.albumArtUrl || "", 500),
      },
      currentPerformanceSession: {
        sessionId: performanceSessionId,
        songId,
        sourceType,
        appleMusicId: "",
        mediaUrl,
        startedAtMs: nowValue,
        playbackState: autoStartMedia ? "starting" : "idle",
        playerReportedDurationSec: 0,
        expectedDurationSec: durationSec,
        lastHeartbeatAtMs: 0,
        lastReportedAtMs: nowValue,
        completionReason: "",
        watchdogDeadlineMs: nowValue + ((durationSec + 90) * 1000),
      },
      videoVolume: 100,
      appleMusicPlayback: null,
      audienceAutomationCommand: null,
    },
    songPatch: {
      status: "performing",
      performingStartedAtMs: nowValue,
      performanceStartedDurationSec: durationSec,
      duration: durationSec,
      backingDurationSec: durationSec,
      durationSource: "server_queue_metadata",
      durationConfidence: "medium",
      autoEndSafe: false,
    },
  };
};
const buildOneMinuteMicFinalizePlan = ({ room = {}, song = {}, nextSongs = [], nowMs = Date.now() } = {}) => {
  const candidate = getOneMinuteMicFinalizeCandidate(room, nowMs);
  if (!candidate) return null;
  const songId = candidate.songId;
  const session = room?.currentPerformanceSession && typeof room.currentPerformanceSession === "object" ? room.currentPerformanceSession : {};
  const meta = room?.currentPerformanceMeta && typeof room.currentPerformanceMeta === "object" ? room.currentPerformanceMeta : {};
  const nowValue = candidate.nowMs;
  const startedAtMs = Math.max(
    cleanText(session?.songId || "", 180) === songId ? toTimestampMs(session?.startedAtMs) : 0,
    cleanText(meta?.songId || "", 180) === songId ? toTimestampMs(meta?.startedAtMs) : 0,
    toTimestampMs(song?.performingStartedAt),
    toTimestampMs(song?.timestamp)
  );
  const endedAtMs = Math.max(startedAtMs || 0, nowValue);
  const applauseScore = Math.max(0, Math.round(toNumber(room?.applausePeak ?? room?.currentApplauseLevel, 0)));
  const hypeScore = Math.max(0, Math.round(toNumber(song?.hypeScore, 0)));
  const autoBonusActive = room?.autoBonusEnabled !== false;
  const autoBonusValue = clampNumber(Math.round(toNumber(room?.autoBonusPoints, 25)), 0, 1000, 25);
  const hostBonus = Math.max(0, Math.round(toNumber(song?.hostBonus, autoBonusActive ? autoBonusValue : 0)));
  const duration = startedAtMs > 0 ? Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000)) : Math.max(0, Math.round(toNumber(song?.duration, 0)));
  const songTitle = cleanText(song?.songTitle || meta?.songTitle || "Current song", 140);
  const artist = cleanText(song?.artist || meta?.artist || meta?.artistName || "", 140);
  const singerName = cleanText(song?.singerName || meta?.singerName || "Singer", 80);
  const lastPerformance = {
    ...song,
    id: songId,
    songDocId: songId,
    songTitle,
    title: songTitle,
    artist,
    singerName,
    displaySongTitle: songTitle,
    displayArtist: artist,
    sourceSongTitle: cleanText(song?.sourceSongTitle || songTitle, 140),
    hypeScore,
    applauseScore,
    hostBonus,
    totalPoints: hypeScore + applauseScore + hostBonus,
    duration,
    timestamp: endedAtMs,
    albumArtUrl: cleanText(song?.albumArtUrl || meta?.albumArtUrl || "", 500),
    mediaUrl: cleanText(song?.mediaUrl || meta?.mediaUrl || "", 1000),
    nextUpSnapshot: buildNextUpSnapshot({ songs: nextSongs, completedSongId: songId }),
    nextUpSnapshotCreatedAtMs: endedAtMs,
    recapScoreFinalized: true,
    performanceSessionId: cleanText(session?.sessionId || candidate.command?.sessionId || "", 180) || null,
    playbackCompletionReason: "one_minute_mic_rotate",
    recapLedgerSource: "one_minute_mic_server",
    recapEventCount: 0,
  };
  return {
    songId,
    roomPatch: {
      lastPerformance,
      activeMode: "karaoke",
      applauseSubject: null,
      mediaUrl: "",
      currentPerformanceMeta: null,
      currentPerformanceSession: null,
      singAlongMode: false,
      videoPlaying: false,
      videoStartTimestamp: null,
      pausedAt: null,
      showLyricsTv: false,
      showVisualizerTv: false,
      showLyricsSinger: false,
      appleMusicPlayback: null,
      audienceAutomationCommand: {
        ...candidate.command,
        status: "server_consumed",
        consumedAtMs: nowValue,
        consumedBy: "one_minute_mic_automation",
      },
    },
    songPatch: {
      status: "performed",
      applauseScore,
      hypeScore,
      hostBonus,
      performedAtMs: endedAtMs,
      recapScoreFinalized: true,
    },
    performanceLog: {
      roomCode: cleanText(room?.roomCode || "", 80),
      songId: cleanText(song?.songId || "", 180) || null,
      performanceId: songId,
      trackId: cleanText(song?.trackId || "", 180) || null,
      singerName,
      singerUid: cleanText(song?.singerUid || "", 180) || null,
      songTitle,
      artist,
      score: hypeScore + applauseScore + hostBonus,
      totalScore: hypeScore + applauseScore + hostBonus,
      applauseScore,
      hypeScore,
      hostBonus,
      source: "one_minute_mic_server",
      timestampMs: endedAtMs,
    },
  };
};
module.exports = {
  AUDIENCE_DECISION_TYPES,
  buildAutomationCommand,
  buildContinueOrRotateDecision,
  buildSkipPerformanceDecision,
  buildAudienceLedQueueFaceOffPlan,
  buildOneMinuteMicAdvancePlan,
  buildOneMinuteMicFinalizePlan,
  buildOneMinuteMicRoomPatch,
  getOneMinuteMicFinalizeCandidate,
  isOneMinuteMicRoomEnabled,
  normalizeAudienceDecision,
  resolveAudienceDecision,
};
