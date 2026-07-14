import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath) => fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

test('Game Launchpad uses the shared lifecycle bundles and keeps Pop Trivia a companion toggle', () => {
  const source = readSource('../../src/components/UnifiedGameLauncher.jsx');
  assert.match(source, /filterGamesForHostMomentBundle\(GAMES_META, selectedGameMomentBundleId\)/);
  assert.match(source, /data-feature-id="host-game-moment-bundles"/);
  assert.match(source, /data-feature-id="host-pop-trivia-companion-toggle"/);
  assert.match(source, /updateRoom\(\{ popTriviaEnabled: !room\?\.popTriviaEnabled \}\)/);
  assert.match(source, /visibleGameModes\.map\(game =>/);
});

test('queue moment picker uses the same bundles and does not queue Pop Trivia companion as a break', () => {
  const source = readSource('../../src/apps/Host/components/AddToQueueFormBody.jsx');
  assert.match(source, /filterGamesForHostMomentBundle\(gameMomentPacks, selectedGameMomentBundleId\)/);
  assert.match(source, /data-feature-id="queue-game-moment-bundles"/);
  assert.match(source, /data-feature-id="queue-pop-trivia-companion-note"/);
  assert.match(source, /enabled from the Game Launchpad rather than queued as a standalone break/);
});
