const normalizeText = (value = '') => String(value || '').trim();

const toMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
};

const getRoomUserLastActiveMs = (roomUser = {}) => (
    toMs(roomUser?.lastActiveAt)
    || toMs(roomUser?.lastSeen)
    || 0
);

const getActivityActorKey = (activity = {}) => {
    const uid = normalizeText(activity?.uid || activity?.userId || activity?.actorUid);
    if (uid) return `uid:${uid}`;
    const user = normalizeText(activity?.user || activity?.userName || activity?.name);
    return user ? `guest:${user.toLowerCase()}` : '';
};

const pct = (part = 0, whole = 0) => (
    whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0
);

const toneMeta = Object.freeze({
    hot: {
        chipClass: 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100',
        panelClass: 'border-emerald-300/16 bg-emerald-500/8',
    },
    steady: {
        chipClass: 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100',
        panelClass: 'border-cyan-300/16 bg-cyan-500/8',
    },
    softening: {
        chipClass: 'border-amber-300/30 bg-amber-500/12 text-amber-100',
        panelClass: 'border-amber-300/16 bg-amber-500/8',
    },
    reset: {
        chipClass: 'border-rose-300/30 bg-rose-500/12 text-rose-100',
        panelClass: 'border-rose-300/16 bg-rose-500/8',
    },
    quiet: {
        chipClass: 'border-white/10 bg-black/25 text-zinc-200',
        panelClass: 'border-white/10 bg-black/20',
    }
});

const alignmentToneMeta = Object.freeze({
    with_you: {
        alignmentChipClass: 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100',
        alignmentPanelClass: 'border-emerald-300/16 bg-emerald-500/8',
    },
    holding: {
        alignmentChipClass: 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100',
        alignmentPanelClass: 'border-cyan-300/16 bg-cyan-500/8',
    },
    drifting: {
        alignmentChipClass: 'border-amber-300/30 bg-amber-500/12 text-amber-100',
        alignmentPanelClass: 'border-amber-300/16 bg-amber-500/8',
    },
    lost: {
        alignmentChipClass: 'border-rose-300/30 bg-rose-500/12 text-rose-100',
        alignmentPanelClass: 'border-rose-300/16 bg-rose-500/8',
    }
});

export const getCrowdPulseSnapshot = ({
    roomUsers = [],
    activities = [],
    queueDepth = 0,
    liveSceneType = '',
    runOfShowEnabled = false,
    now = Date.now(),
} = {}) => {
    const lobbyUsers = Array.isArray(roomUsers) ? roomUsers : [];
    const lobbyCount = lobbyUsers.length;
    const safeNow = Number(now || Date.now()) || Date.now();
    const liveWindowMs = 90 * 1000;
    const warmWindowMs = 5 * 60 * 1000;
    const activityWindowMs = 2 * 60 * 1000;

    const livePhoneCount = lobbyUsers.filter((user) => getRoomUserLastActiveMs(user) >= safeNow - liveWindowMs).length;
    const warmLobbyCount = lobbyUsers.filter((user) => getRoomUserLastActiveMs(user) >= safeNow - warmWindowMs).length;
    const recentActivities = (Array.isArray(activities) ? activities : []).filter((entry) => toMs(entry?.timestamp) >= safeNow - activityWindowMs);
    const recentParticipantKeys = new Set(
        recentActivities
            .map((entry) => getActivityActorKey(entry))
            .filter(Boolean)
    );
    const recentRequestCount = recentActivities.filter((entry) => /requested\b/i.test(normalizeText(entry?.text))).length;
    const recentAudienceActionCount = recentActivities.length;
    const recentParticipantCount = recentParticipantKeys.size;
    const engagedAudiencePct = pct(Math.max(livePhoneCount, recentParticipantKeys.size), lobbyCount);
    const livePhonePct = pct(livePhoneCount, lobbyCount);
    const warmLobbyPct = pct(warmLobbyCount, lobbyCount);
    const recentParticipantPct = pct(recentParticipantCount, lobbyCount);
    const queuePressure = Math.max(0, Number(queueDepth || 0));
    const weightedScore = Math.round((livePhonePct * 0.5) + (warmLobbyPct * 0.2) + (engagedAudiencePct * 0.3));

    let level = 'quiet';
    let label = 'Quiet room';
    let summary = 'No audience signal yet.';
    let recommendationTitle = 'Drive the next beat from the host side';
    let recommendationDetail = 'Use the conveyor as a planning tool until more phones join the room.';
    let alignmentLevel = 'lost';
    let alignmentLabel = 'Waiting On Phones';
    let alignmentTitle = 'Build the room before you ask it to follow';
    let alignmentDetail = 'Very little audience signal is live yet. Use fast prompts and clear calls to action until more phones join.';
    let hostDirective = 'Start with a simple host cue and get phones into the room.';

    if (lobbyCount <= 0) {
        return {
            level,
            label,
            summary,
            recommendationTitle,
            recommendationDetail,
            alignmentLevel,
            alignmentLabel,
            alignmentTitle,
            alignmentDetail,
            alignmentSummary: 'No audience signal yet.',
            hostDirective,
            alignmentWindowOpen: true,
            metrics: {
                lobbyCount: 0,
                livePhoneCount: 0,
                livePhonePct: 0,
                warmLobbyCount: 0,
                warmLobbyPct: 0,
                engagedAudiencePct: 0,
                recentParticipantCount: 0,
                recentParticipantPct: 0,
                recentAudienceActionCount: 0,
                recentRequestCount: 0,
                queueDepth: queuePressure,
                alignmentPct: 0,
            },
            ...toneMeta[level],
            ...alignmentToneMeta[alignmentLevel],
        };
    }

    summary = `${livePhoneCount}/${lobbyCount} lobby members are active right now. ${recentAudienceActionCount} audience actions landed in the last 2 minutes.`;

    if (weightedScore >= 72) {
        level = 'hot';
        label = 'Crowd with you';
        recommendationTitle = queuePressure >= 3
            ? 'Keep singers moving'
            : 'Good window for a short optional beat';
        recommendationDetail = queuePressure >= 3
            ? 'Phones are live and the queue is healthy. Keep optional conveyor scenes on deck unless you need a specific reset.'
            : 'Phones are engaged. You can slot a short conveyor scene without losing the room, but keep it tight.';
    } else if (weightedScore >= 52) {
        level = 'steady';
        label = 'Steady signal';
        recommendationTitle = queuePressure >= 2
            ? 'Stay queue-first'
            : 'Keep the next scene light';
        recommendationDetail = queuePressure >= 2
            ? 'The room is with you enough to keep the night moving. Use short conveyor scenes only when they clearly help the pacing.'
            : 'Signal is healthy but not hot. If you slot something from the conveyor, favor quick hits over longer takeovers.';
    } else if (weightedScore >= 32) {
        level = 'softening';
        label = 'Softening';
        recommendationTitle = queuePressure >= 2
            ? 'Tighten transitions'
            : 'Prep a short reset on deck';
        recommendationDetail = queuePressure >= 2
            ? 'Phones are cooling a bit. Keep the handoffs clean and save longer optional scenes for later.'
            : 'Phones are cooling and the queue is not deep. Put a short reset scene on deck so you can wake the room up if needed.';
    } else {
        level = 'reset';
        label = 'Needs reset';
        recommendationTitle = queuePressure <= 1
            ? 'Slot a short conveyor scene now'
            : 'Keep it moving, but use the next reset well';
        recommendationDetail = queuePressure <= 1
            ? 'Very few phones are active. Use a quick trivia hit, WYR, or hype beat from the conveyor to re-engage the room.'
            : 'Signal is weak, but you still have singers ready. Keep the queue moving and use the next optional conveyor window as a reset.';
    }

    if (weightedScore >= 72) {
        alignmentLevel = 'with_you';
        alignmentLabel = 'With You';
        alignmentTitle = queuePressure >= 3
            ? 'The room is tracking the host beat'
            : 'The room is ready for a short lift';
        alignmentDetail = queuePressure >= 3
            ? 'Most live phones are still moving with the current moment. Keep the singer lane clean and avoid long detours.'
            : 'The room is with the host and the queue is light enough for a short optional moment if you want one.';
        hostDirective = queuePressure >= 3
            ? 'Keep singer flow moving.'
            : 'Take one short beat, then return to singers.';
    } else if (weightedScore >= 52) {
        alignmentLevel = 'holding';
        alignmentLabel = 'Holding';
        alignmentTitle = queuePressure >= 2
            ? 'The room is holding the line'
            : 'The room is steady but not fully lit';
        alignmentDetail = queuePressure >= 2
            ? 'The audience is still with the host, but the energy can slip if transitions run long.'
            : 'The room is responsive enough to follow, but it needs clean cues and short handoffs.';
        hostDirective = queuePressure >= 2
            ? 'Stay queue-first and keep transitions short.'
            : 'Use one fast beat, then get back to action.';
    } else if (weightedScore >= 32) {
        alignmentLevel = 'drifting';
        alignmentLabel = 'Drifting';
        alignmentTitle = queuePressure >= 2
            ? 'The room is starting to peel away'
            : 'You have a pivot window open';
        alignmentDetail = queuePressure >= 2
            ? 'Phones are cooling. Cut down talk and make the next move feel immediate.'
            : 'Attention is slipping and the queue is not deep. A short format change can still pull the room back.';
        hostDirective = queuePressure >= 2
            ? 'Shorten the next transition.'
            : 'Change the energy within one beat.';
    } else {
        alignmentLevel = 'lost';
        alignmentLabel = 'Lost';
        alignmentTitle = queuePressure <= 1
            ? 'The room needs a reset now'
            : 'Keep the lane moving and reset on the next handoff';
        alignmentDetail = queuePressure <= 1
            ? 'Only a small slice of the room is still moving with the current beat. Trigger a fast reset or hype move now.'
            : 'The audience is mostly off the current moment. Avoid extra talk and use the next handoff to re-open the room.';
        hostDirective = queuePressure <= 1
            ? 'Trigger a reset now.'
            : 'Use the next handoff as a reset.';
    }

    if (runOfShowEnabled && normalizeText(liveSceneType).toLowerCase() === 'performance' && level !== 'quiet') {
        recommendationDetail = `${recommendationDetail} Current live scene is a performance, so keep the next optional scene short and easy to flight.`;
        if (alignmentLevel === 'drifting' || alignmentLevel === 'lost') {
            alignmentDetail = `${alignmentDetail} Because a performance is live, tighten the handoff instead of breaking the lane too early.`;
            hostDirective = alignmentLevel === 'lost'
                ? 'Finish the singer cleanly, then reset fast.'
                : 'Wrap the transition quickly after this singer.';
        }
    }
    if (recentRequestCount >= 2 && queuePressure < 2) {
        recommendationDetail = `${recommendationDetail} New requests are still landing, so keep a singer-ready slot open on deck.`;
        if (alignmentLevel === 'drifting' || alignmentLevel === 'lost') {
            alignmentDetail = `${alignmentDetail} Fresh requests are still coming in, so keep the next singer-ready move obvious.`;
        }
    }

    return {
        level,
        label,
        summary,
        recommendationTitle,
        recommendationDetail,
        alignmentLevel,
        alignmentLabel,
        alignmentTitle,
        alignmentDetail,
        alignmentSummary: `${weightedScore}% of the room is moving with the host right now.`,
        hostDirective,
        alignmentWindowOpen: alignmentLevel === 'drifting' || alignmentLevel === 'lost',
        metrics: {
            lobbyCount,
            livePhoneCount,
            livePhonePct,
            warmLobbyCount,
            warmLobbyPct,
            engagedAudiencePct,
            recentParticipantCount,
            recentParticipantPct,
            recentAudienceActionCount,
            recentRequestCount,
            queueDepth: queuePressure,
            alignmentPct: weightedScore,
        },
        ...toneMeta[level],
        ...alignmentToneMeta[alignmentLevel],
    };
};
