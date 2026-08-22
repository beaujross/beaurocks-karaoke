const cleanText = (value = '', maxLength = 500) => String(value || '').trim().slice(0, maxLength);

const uniqueChoices = (values = [], maxLength = 180) => {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).reduce((choices, value) => {
        const choice = cleanText(value, maxLength);
        const key = choice.toLowerCase();
        if (!choice || seen.has(key)) return choices;
        seen.add(key);
        choices.push(choice);
        return choices;
    }, []);
};

export const buildEmptyPromptNightDraft = (kind = 'trivia', idSeed = Date.now()) => (
    kind === 'would_you_rather'
        ? { id: `wyr_${idSeed}`, q: 'Would you rather?', a: '', b: '', points: 50 }
        : { id: `trivia_${idSeed}`, q: 'New question', options: ['Answer A', 'Answer B', 'Answer C', 'Answer D'], answer: 'Answer A', correct: 0, points: 50 }
);

export const normalizeAiPromptNightDrafts = ({
    kind = 'trivia',
    rows = [],
    idSeed = Date.now(),
    limit = 10,
} = {}) => (Array.isArray(rows) ? rows : [])
    .slice(0, Math.max(1, Math.min(10, Number(limit || 10) || 10)))
    .map((row, index) => {
        const source = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
        const q = cleanText(source.q || source.question, 500);
        if (!q) return null;
        if (kind === 'would_you_rather') {
            const [a = '', b = ''] = uniqueChoices([
                source.a || source.optionA,
                source.b || source.optionB,
            ], 240);
            if (!a || !b) return null;
            return {
                id: `wyr_ai_${idSeed}_${index + 1}`,
                q,
                a,
                b,
                points: 50,
                contentSource: 'ai_host_brief',
            };
        }

        const suppliedOptions = Array.isArray(source.options) ? source.options : [];
        const suppliedCorrectIndex = Number.isInteger(source.correct) ? source.correct : -1;
        const correctAnswer = cleanText(
            typeof source.correct === 'string'
                ? source.correct
                : suppliedOptions[suppliedCorrectIndex] || source.answer,
            180,
        );
        const options = uniqueChoices([
            correctAnswer,
            source.w1,
            source.w2,
            source.w3,
            ...suppliedOptions,
        ], 180).slice(0, 4);
        if (!correctAnswer || options.length < 2) return null;
        const shift = (Math.max(0, Number(idSeed || 0)) + index) % options.length;
        const rotatedOptions = [...options.slice(shift), ...options.slice(0, shift)];
        const correct = rotatedOptions.findIndex((option) => option.toLowerCase() === correctAnswer.toLowerCase());
        if (correct < 0) return null;
        return {
            id: `trivia_ai_${idSeed}_${index + 1}`,
            q,
            options: rotatedOptions,
            answer: correctAnswer,
            correct,
            points: 50,
            contentSource: 'ai_host_brief',
        };
    })
    .filter(Boolean);
