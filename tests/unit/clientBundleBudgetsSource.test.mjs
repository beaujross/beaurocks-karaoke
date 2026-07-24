import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const budgetSource = readFileSync('scripts/check-client-bundle-budgets.mjs', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

test('production builds enforce client entry and game-cartridge budgets', () => {
  for (const prefix of ['HostApp-', 'SingerApp-', 'gameRegistry-', 'UnifiedGameLauncher-']) {
    assert.match(budgetSource, new RegExp(prefix));
  }
  assert.match(budgetSource, /GAME_CARTRIDGE_MAX_BYTES/);
  assert.match(packageJson.scripts.build, /npm run qa:bundle-budgets/);
  assert.equal(
    packageJson.scripts['qa:bundle-budgets'],
    'node scripts/check-client-bundle-budgets.mjs',
  );
});
