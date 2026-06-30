import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const source = readFileSync('src/games/Bingo/Game.jsx', 'utf8');

test('Bingo win overlay stays passive on public TV while mobile can dismiss it', () => {
  assert.match(
    source,
    /onClick=\{isMobile \? \(\) => setShowWin\(false\) : undefined\}/,
    'Bingo TV win overlay should not require tapping the public display',
  );
  assert.match(
    source,
    /role=\{isMobile \? "button" : "status"\}/,
    'Bingo TV win overlay should be status-only while mobile remains dismissible',
  );
  assert.match(
    source,
    /isMobile \? 'Tap to continue' : 'Continuing automatically'/,
    'Bingo TV win overlay should use automatic progression copy',
  );
});