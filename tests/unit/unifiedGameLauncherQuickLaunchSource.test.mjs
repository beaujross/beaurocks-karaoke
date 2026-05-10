import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const source = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');

test('UnifiedGameLauncher quick launch keeps voice games in TV-controlled crowd mode', () => {
  assert.match(
    source,
    /if \(gameId === 'flappy_bird'\) \{\s*return startFlappyAmbient\(\{ quick: true \}\);\s*\}/,
    'Quick Pitch Runner should always launch the TV crowd-mic path instead of silently switching to solo phone control',
  );
  assert.match(
    source,
    /if \(gameId === 'vocal_challenge'\) \{\s*return startVocalAmbient\(\{ quick: true \}\);\s*\}/,
    'Quick Vocal Challenge should always launch the TV crowd-mic path instead of depending on a phone-side controller',
  );
});

test('UnifiedGameLauncher game cards keep participant mode inside the metadata pill row', () => {
  assert.match(
    source,
    /participantConfig \? \(\s*<>\s*<button[\s\S]*participantConfig\.setMode\?\.\('all'\)[\s\S]*>\s*<i className="fa-solid fa-users text-\[10px\]"><\/i>\s*All/s,
    'Game cards should expose the all-player mode as an inline metadata pill instead of a separate stacked selector row',
  );
  assert.match(
    source,
    /participantConfig\.setMode\?\.\('selected'\)[\s\S]*playerCount \? `\$\{playerCount\} selected` : 'Pick players'/,
    'Game cards should expose selected-player mode and count directly in the pill row',
  );
  assert.match(
    source,
    /participantConfig\?\.mode === 'selected' && showPicker/,
    'The roster picker should only expand when selected-player mode is active, saving idle vertical space on the launcher cards',
  );
});
