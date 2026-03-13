export const POP_TRIVIA_VOTE_TYPE = 'vote_popup_trivia';
export const DEFAULT_POP_TRIVIA_ROUND_SEC = 16;
export const DEFAULT_POP_TRIVIA_MAX_QUESTIONS = 4;

export const getTimestampMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
};

const cleanText = (value, fallback = '') => {
    const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
    return text;
};

const shuffleOptions = (list = []) => {
    const next = [...list];
    for (let idx = next.length - 1; idx > 0; idx -= 1) {
        const swap = Math.floor(Math.random() * (idx + 1));
        const tmp = next[idx];
        next[idx] = next[swap];
        next[swap] = tmp;
    }
    return next;
};

const normalizeOptionText = (value = '') => cleanText(value).toLowerCase();
const dedupeOptionList = (items = []) => {
    const list = Array.isArray(items) ? items : [];
    return list.filter((optionText, optionIndex) => {
        const key = normalizeOptionText(optionText);
        return list.findIndex((candidate) => normalizeOptionText(candidate) === key) === optionIndex;
    });
};

const getSongDurationSec = (song = null) => {
    if (!song || typeof song !== 'object') return 0;
    const candidates = [
        song?.durationSec,
        song?.duration,
        song?.trackDurationSec,
        song?.currentDurationSec,
        song?.appleDurationSec
    ];
    for (const candidate of candidates) {
        const value = Number(candidate);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
};

export const normalizePopTriviaSeedRows = (rows = [], options = {}) => {
    if (!Array.isArray(rows)) return [];
    const limit = Math.max(1, Number(options?.limit || DEFAULT_POP_TRIVIA_MAX_QUESTIONS));

    const normalized = rows
        .map((entry) => {
            const question = cleanText(entry?.q || entry?.question);
            if (!question) return null;

            const explicitOptions = Array.isArray(entry?.options) ? entry.options : [];
            const fallbackOptions = [entry?.correct, entry?.w1, entry?.w2, entry?.w3];
            const candidateOptions = (explicitOptions.length ? explicitOptions : fallbackOptions)
                .map((item) => cleanText(item))
                .filter(Boolean);
            const dedupedOptions = dedupeOptionList(candidateOptions);
            if (dedupedOptions.length < 2) return null;

            let correctIndex = -1;
            const correctLabel = cleanText(entry?.correct);
            if (correctLabel) {
                const target = normalizeOptionText(correctLabel);
                correctIndex = dedupedOptions.findIndex((item) => normalizeOptionText(item) === target);
            }
            if (correctIndex < 0 && Number.isInteger(entry?.correctIndex)) {
                correctIndex = Math.max(0, Math.min(dedupedOptions.length - 1, Number(entry.correctIndex)));
            }
            if (correctIndex < 0 && Number.isInteger(entry?.correct)) {
                correctIndex = Math.max(0, Math.min(dedupedOptions.length - 1, Number(entry.correct)));
            }
            if (correctIndex < 0) correctIndex = 0;

            return {
                q: question,
                options: dedupedOptions,
                correctIndex,
                source: cleanText(entry?.source || 'ai')
            };
        })
        .filter(Boolean);

    return normalized.slice(0, limit);
};

export const normalizePopTriviaQuestions = (rows = [], options = {}) => {
    if (!Array.isArray(rows)) return [];
    const limit = Math.max(1, Number(options?.limit || DEFAULT_POP_TRIVIA_MAX_QUESTIONS));
    const idPrefix = cleanText(options?.idPrefix || 'poptrivia');
    const createdAt = Date.now();

    const normalized = rows
        .map((entry, index) => {
            const question = cleanText(entry?.q || entry?.question);
            if (!question) return null;

            const explicitOptions = Array.isArray(entry?.options) ? entry.options : [];
            const fallbackOptions = [entry?.correct, entry?.w1, entry?.w2, entry?.w3];
            const candidateOptions = (explicitOptions.length ? explicitOptions : fallbackOptions)
                .map((item) => cleanText(item))
                .filter(Boolean);
            const dedupedOptions = dedupeOptionList(candidateOptions);
            if (dedupedOptions.length < 2) return null;

            const correctLabel = cleanText(entry?.correct);
            const shuffled = shuffleOptions(dedupedOptions);
            let correctIndex = -1;
            if (correctLabel) {
                const target = normalizeOptionText(correctLabel);
                correctIndex = shuffled.findIndex((item) => normalizeOptionText(item) === target);
            } else if (Number.isInteger(entry?.correctIndex) || Number.isInteger(entry?.correct)) {
                const sourceIndex = Number.isInteger(entry?.correctIndex)
                    ? Number(entry.correctIndex)
                    : Number(entry.correct);
                const source = dedupedOptions[Math.max(0, Math.min(dedupedOptions.length - 1, sourceIndex))];
                const target = normalizeOptionText(source);
                correctIndex = shuffled.findIndex((item) => normalizeOptionText(item) === target);
            }
            if (correctIndex < 0) correctIndex = 0;

            return {
                id: `${idPrefix}_${createdAt}_${index}`,
                q: question,
                options: shuffled,
                correct: correctIndex,
                source: cleanText(entry?.source || 'ai')
            };
        })
        .filter(Boolean);

    return normalized.slice(0, limit);
};

export const getActivePopTriviaQuestion = ({ song = null, now = Date.now(), roundSec = DEFAULT_POP_TRIVIA_ROUND_SEC } = {}) => {
    if (!song) return null;
    const questions = Array.isArray(song?.popTrivia) ? song.popTrivia.filter(Boolean) : [];
    if (!questions.length) return null;

    const safeRoundSec = Math.max(8, Number(roundSec || DEFAULT_POP_TRIVIA_ROUND_SEC));
    const songDurationSec = getSongDurationSec(song);
    const startMs = getTimestampMs(song?.performingStartedAt)
        || getTimestampMs(song?.stageStartedAt)
        || getTimestampMs(song?.timestamp)
        || Number(now || Date.now());
    const elapsedMs = Math.max(0, Number(now || Date.now()) - startMs);
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const sequentialDurationSec = questions.length * safeRoundSec;
    const introBufferSec = Math.min(18, Math.max(6, Math.round(safeRoundSec * 0.6)));
    const outroBufferSec = Math.min(18, Math.max(8, Math.round(safeRoundSec * 0.65)));
    const usableSongSec = Math.max(0, songDurationSec - introBufferSec - outroBufferSec);
    const canSpreadAcrossSong = usableSongSec >= sequentialDurationSec && songDurationSec > 0;
    const schedule = canSpreadAcrossSong
        ? questions.map((question, index) => {
            const slotSpanSec = usableSongSec / questions.length;
            const slotStartSec = introBufferSec + (slotSpanSec * index);
            const centeredOffsetSec = Math.max(0, (slotSpanSec - safeRoundSec) / 2);
            const questionStartSec = Math.max(0, Math.floor(slotStartSec + centeredOffsetSec));
            return {
                question,
                index,
                startSec: questionStartSec,
                endSec: questionStartSec + safeRoundSec
            };
        })
        : questions.map((question, index) => ({
            question,
            index,
            startSec: index * safeRoundSec,
            endSec: (index + 1) * safeRoundSec
        }));
    const completedAtSec = schedule.length ? schedule[schedule.length - 1].endSec : sequentialDurationSec;
    const completedAtMs = startMs + (completedAtSec * 1000);
    if (elapsedSec >= completedAtSec) {
        return {
            question: null,
            index: questions.length,
            total: questions.length,
            elapsedSec,
            timeLeftSec: 0,
            roundSec: safeRoundSec,
            songDurationSec,
            startMs,
            status: 'complete',
            completedAtMs
        };
    }
    const activeWindow = schedule.find((entry) => elapsedSec >= entry.startSec && elapsedSec < entry.endSec) || null;
    if (!activeWindow) {
        return {
            question: null,
            index: -1,
            total: questions.length,
            elapsedSec,
            timeLeftSec: 0,
            roundSec: safeRoundSec,
            songDurationSec,
            startMs,
            status: 'gap',
            completedAtMs
        };
    }
    const timeLeftSec = Math.max(0, Math.ceil(activeWindow.endSec - elapsedSec));

    return {
        question: activeWindow.question,
        index: activeWindow.index,
        total: questions.length,
        elapsedSec,
        timeLeftSec,
        roundSec: safeRoundSec,
        songDurationSec,
        startMs,
        status: 'live',
        completedAtMs
    };
};

export const dedupeQuestionVotes = (entries = [], voteType = POP_TRIVIA_VOTE_TYPE) => {
    const latestByVoter = new Map();
    entries.forEach((entry, index) => {
        if (!entry || entry.type !== voteType || !entry.questionId) return;
        const key = entry?.uid
            ? `uid:${entry.uid}`
            : `guest:${cleanText(entry.userName || 'Guest')}:${cleanText(entry.avatar || '')}`;
        const ts = getTimestampMs(entry.timestamp);
        const prev = latestByVoter.get(key);
        if (!prev || ts >= prev._ts) {
            latestByVoter.set(key, { ...entry, _ts: ts, _idx: index });
        }
    });
    return Array.from(latestByVoter.values()).map((entry) => {
        const clean = { ...entry };
        delete clean._ts;
        delete clean._idx;
        return clean;
    });
};
