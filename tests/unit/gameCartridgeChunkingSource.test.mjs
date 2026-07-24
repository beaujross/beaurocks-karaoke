import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const registrySource = readFileSync('src/lib/gameRegistry.js', 'utf8');
const containerSource = readFileSync('src/components/GameContainer.jsx', 'utf8');

const cartridgePaths = [
  'FlappyBird',
  'Bingo',
  'PromptVote',
  'VocalChallenge',
  'RidingScales',
  'KaraokeBracket',
  'TeamPong',
  'MusicalMoments',
];

test('game registry exposes each cartridge through a lazy import boundary', () => {
  assert.match(registrySource, /import \{ lazy \} from 'react';/);
  assert.doesNotMatch(registrySource, /import [A-Za-z]+Game from '\.\.\/games\//);
  for (const cartridge of cartridgePaths) {
    assert.match(
      registrySource,
      new RegExp(`lazy\\(\\(\\) => import\\('\\.\\.\\/games\\/${cartridge}\\/Game'\\)\\)`),
    );
  }
});

test('game container renders lazy cartridges behind a branded loading state', () => {
  assert.match(containerSource, /import React, \{[^}]*Suspense[^}]*\} from 'react';/);
  assert.match(containerSource, /data-feature-id="game-cartridge-loading"/);
  assert.match(
    containerSource,
    /<Suspense fallback=\{<GameCartridgeFallback title=\{rulesConfig\?\.title \|\| 'Loading game'\} view=\{view\} \/>\}>[\s\S]*<GameComponent/,
  );
});
