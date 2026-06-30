import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const source = readFileSync('src/components/GameContainer.jsx', 'utf8');

test('GameContainer keeps public TV game rules passive while mobile can dismiss instructions', () => {
  assert.match(
    source,
    /const isTv = view === 'tv';/,
    'GameContainer should derive a TV display branch for rules and controls',
  );
  assert.match(
    source,
    /Launch Countdown/,
    'Public TV rules should show a clear launch countdown instead of an ambiguous tap-to-continue prompt',
  );
  assert.match(
    source,
    /pointer-events-none absolute inset-x-6 top-20/,
    'Public TV launch instructions should not require tapping the display or block the game surface',
  );
  assert.match(
    source,
    /Game visible now/,
    'Public TV countdown should make clear that gameplay is visible underneath the launch prompt',
  );
  assert.match(
    source,
    /role="status"/,
    'Public TV rules should announce as a passive status',
  );
  assert.match(
    source,
    /onClick=\{\(\) => setShowRules\(false\)\}/,
    'Mobile rules should remain tappable to dismiss',
  );
  assert.match(
    source,
    /role="button"/,
    'Mobile rules should remain dismissible as a button surface',
  );
});

test('GameContainer no longer asks the public TV to prime the room microphone directly', () => {
  assert.match(
    source,
    /const voiceInputMode = String[\s\S]*const wantsLocalVoiceMic = voiceInputMode !== 'host'[\s\S]*view === 'tv'[\s\S]*\['flappy_bird', 'vocal_challenge', 'riding_scales'\]\.includes\(normalizedMode\)[\s\S]*\['ambient', 'crowd', 'local'\]\.includes\(props\.inputSource\);/,
    'GameContainer should still detect legacy TV-controlled voice cartridges while exempting host-mic launches',
  );
  assert.match(
    source,
    /Room mic is waiting for host setup/,
    'GameContainer should point operators toward host-side room mic setup',
  );
  assert.match(
    source,
    /Voice games should be armed from the host controls so the public TV can stay display-only/,
    'GameContainer should keep the public TV display-only in its microphone guidance',
  );
  assert.doesNotMatch(
    source,
    /navigator\.mediaDevices\.getUserMedia|requestTvVoiceMic|Enable Room Mic/,
    'GameContainer should not provide direct TV-side microphone permission controls',
  );
});