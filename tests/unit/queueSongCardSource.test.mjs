import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueSongCardSource = readFileSync('src/apps/Host/components/QueueSongCard.jsx', 'utf8');

test('QueueSongCard keeps audience backing review actions compact and operational', () => {
  assert.match(
    queueSongCardSource,
    /Guest-picked backing is ready, with optional host review\./,
    'Audience-selected backing copy should read as an operational review note',
  );
  assert.match(
    queueSongCardSource,
    /Track check/,
    'Audience-selected backing actions should be grouped as a compact track-check control',
  );
  assert.match(
    queueSongCardSource,
    />Keep\s*</,
    'Positive backing action should use concise queue language',
  );
  assert.match(
    queueSongCardSource,
    />Review\s*</,
    'Negative backing action should send the item back for review without judgmental copy',
  );
  assert.doesNotMatch(
    queueSongCardSource,
    /Use This|Avoid This|send it back to review/,
    'Old oversized/judgmental action copy should not appear in queue rows',
  );
});
