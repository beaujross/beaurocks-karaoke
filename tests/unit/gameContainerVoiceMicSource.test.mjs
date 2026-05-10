import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const source = readFileSync('src/components/GameContainer.jsx', 'utf8');

test('GameContainer gates TV-controlled voice cartridges behind an explicit mic enable prompt', () => {
  assert.match(
    source,
    /const wantsLocalVoiceMic = view === 'tv'[\s\S]*\['flappy_bird', 'vocal_challenge', 'riding_scales'\]\.includes\(normalizedMode\)[\s\S]*\['ambient', 'crowd', 'local'\]\.includes\(props\.inputSource\);/,
    'GameContainer should detect when the TV itself must control a voice game with the room mic',
  );
  assert.match(
    source,
    /TV_VOICE_MIC_READY_KEY = 'beaurocks_tv_voice_mic_ready'/,
    'GameContainer should persist a granted TV voice-mic session across cartridge remounts',
  );
  assert.match(
    source,
    /Enable room mic to start this voice game/,
    'GameContainer should tell the operator exactly why the voice game is paused before launch',
  );
  assert.match(
    source,
    /await navigator\.mediaDevices\.getUserMedia\(\{ audio: true \}\);/,
    'GameContainer should prime the room mic with a direct TV-side gesture before mounting live pitch controls',
  );
});
