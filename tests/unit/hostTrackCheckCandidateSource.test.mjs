import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostQueueSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');

test('Host track-check candidates are thumbnail-first and ranked by BeauScore', () => {
  assert.match(hostQueueSource, /const getReviewCandidateBeauScore = \(candidate = \{\}\) => \{/);
  assert.match(hostQueueSource, /getReviewCandidateArtworkUrl\(candidate\)/);
  assert.match(hostQueueSource, /BeauScore/);
  assert.match(hostQueueSource, /candidateSourceMeta\.label/);
  assert.match(hostQueueSource, /candidateDurationLabel/);
  assert.match(hostQueueSource, />\s*Use Track\s*</);
  assert.doesNotMatch(hostQueueSource, />\s*Queue This\s*</);
});