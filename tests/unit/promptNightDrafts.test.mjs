import { describe, expect, it } from 'vitest';
import {
  buildEmptyPromptNightDraft,
  normalizeAiPromptNightDrafts,
} from '../../src/apps/Host/lib/promptNightDrafts.js';

describe('prompt-night draft helpers', () => {
  it('builds editable manual drafts for both full-night formats', () => {
    expect(buildEmptyPromptNightDraft('trivia', 12)).toMatchObject({ id: 'trivia_12', correct: 0 });
    expect(buildEmptyPromptNightDraft('would_you_rather', 12)).toMatchObject({ id: 'wyr_12', a: '', b: '' });
  });

  it('normalizes and rotates AI trivia answers instead of always putting the answer first', () => {
    const drafts = normalizeAiPromptNightDrafts({
      kind: 'trivia',
      idSeed: 13,
      rows: [{ q: 'Which artist recorded Jolene?', correct: 'Dolly Parton', w1: 'Reba McEntire', w2: 'Patsy Cline', w3: 'Loretta Lynn' }],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].options).toHaveLength(4);
    expect(drafts[0].options[drafts[0].correct]).toBe('Dolly Parton');
    expect(drafts[0].correct).not.toBe(0);
  });

  it('rejects incomplete AI rows and keeps valid WYR choices distinct', () => {
    const drafts = normalizeAiPromptNightDrafts({
      kind: 'would_you_rather',
      rows: [
        { q: 'Would you rather?', a: 'Sing first', b: 'Sing last' },
        { q: 'Duplicate choices', a: 'Solo', b: 'solo' },
      ],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ a: 'Sing first', b: 'Sing last' });
  });
});
