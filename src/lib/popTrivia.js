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
            const dedupedOptions = candidateOptions.filter((optionText, optionIndex) => {
                const key = normalizeOptionText(optionText);
                return candidateOptions.findIndex((candidate) => normalizeOptionText(candidate) === key) === optionIndex;
            });
            if (dedupedOptions.length < 2) return null;

            const correctLabel = cleanText(entry?.correct);
            const shuffled = shuffleOptions(dedupedOptions);
            let correctIndex = -1;
            if (correctLabel) {
                const target = normalizeOptionText(correctLabel);
                correctIndex = shuffled.findIndex((item) => normalizeOptionText(item) === target);
            } else if (Number.isInteger(entry?.correctIndex)) {
                const source = dedupedOptions[Math.max(0, Math.min(dedupedOptions.length - 1, Number(entry.correctIndex)))];
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
    const startMs = getTimestampMs(song?.performingStartedAt)
        || getTimestampMs(song?.stageStartedAt)
        || getTimestampMs(song?.timestamp)
        || Number(now || Date.now());
    const elapsedMs = Math.max(0, Number(now || Date.now()) - startMs);
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const rawIndex = Math.floor(elapsedSec / safeRoundSec);
    const index = Math.min(questions.length - 1, Math.max(0, rawIndex));
    const timeLeftSec = Math.max(0, safeRoundSec - (elapsedSec % safeRoundSec));

    return {
        question: questions[index],
        index,
        total: questions.length,
        elapsedSec,
        timeLeftSec,
        roundSec: safeRoundSec,
        startMs
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
