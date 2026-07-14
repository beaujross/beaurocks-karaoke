import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const launcherSource = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');

test('Host live-game drawer requests the compact switcher without changing the standard launcher', () => {
  assert.match(hostSource, /compactLiveSwitcher=\{hostHasLiveGameModeForDrawer\}/);
  assert.match(hostSource, /Games[\s\S]*Open Launcher Drawer/);
  assert.match(hostSource, /hostHasLiveGameModeForDrawer && !liveGameLauncherDrawerOpen \? 'hidden'/);
});

test('compact live-switcher cards expose at most Configure plus one primary action', () => {
  const compactStart = launcherSource.indexOf('if (compactLiveSwitcher) {');
  const standardStart = launcherSource.indexOf('data-game-card-variant="standard"', compactStart);
  assert.ok(compactStart >= 0 && standardStart > compactStart, 'compact branch should precede the standard card return');
  const compactBranch = launcherSource.slice(compactStart, standardStart);

  assert.match(compactBranch, /data-game-card-variant="live-switcher"/);
  assert.match(compactBranch, /data-game-configure=\{game\.id\}/);
  assert.match(compactBranch, /data-game-quick-launch=\{game\.id\}/);
  assert.match(compactBranch, /nextQuestionAction/);
  assert.doesNotMatch(compactBranch, /Preview on TV/);
  assert.doesNotMatch(compactBranch, /participantConfig\.mode/);
  assert.doesNotMatch(compactBranch, /visualPills\.map/);
});

test('standard cards retain their deeper setup and preview controls', () => {
  assert.match(launcherSource, /data-game-card-variant="standard"/);
  assert.match(launcherSource, /Preview on TV/);
  assert.match(launcherSource, /participantConfig\.mode === 'selected'/);
  assert.match(launcherSource, /visualPills\.map/);
});

test('live switcher explains that the current moment remains live until a safe start succeeds', () => {
  assert.match(launcherSource, /data-feature-id="host-game-live-switcher-cue"/);
  assert.match(launcherSource, /current moment stays live until a compatible start succeeds/i);
});
