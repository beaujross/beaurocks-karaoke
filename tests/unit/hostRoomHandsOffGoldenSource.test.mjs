import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('scripts/qa/host-room-hands-off-golden-playwright.mjs', 'utf8');

test('production host lifecycle QA uses stable automation and stage-start contracts', () => {
  assert.match(source, /data-feature-id="deck-automation-menu"/);
  assert.match(source, /data-feature-id="deck-automation-autoBg"/);
  assert.match(source, /data-feature-id="deck-automation-autoDj"/);
  assert.match(source, /data-feature-id="deck-automation-autoLyrics"/);
  assert.match(source, /data-feature-id="deck-automation-popTrivia"/);
  assert.match(source, /data-feature-id="deck-queue-stage-start-toggle"/);
  assert.doesNotMatch(source, /Live toggles stay here so you can tune pacing/);
  assert.doesNotMatch(source, /Auto Stage Playback/);
});

test('production host lifecycle QA creates an isolated room instead of silently reopening one', () => {
  assert.match(source, /const createFreshHostRoom/);
  assert.match(source, /Back to room manager and room creation/);
  assert.match(source, /getByRole\("tab", \{ name: \/Create Room\/i \}\)/);
  assert.match(source, /requestedRoomCode = `QA\$\{uniqueSuffix\}`/);
  assert.match(source, /roomCode = await createFreshHostRoom/);
});

test('production host lifecycle QA dismisses transient menus before Queue and cleanup navigation', () => {
  assert.match(source, /const closeAutomationMenuIfOpen/);
  assert.match(source, /ensureHostQueueAddWorkspaceOpen[\s\S]*await closeAutomationMenuIfOpen\(page\)/);
  assert.match(source, /closeHostRoomAndWaitForConfirmation[\s\S]*await closeAutomationMenuIfOpen\(page\)/);
  assert.match(source, /data-host-close-room-recap\]:visible/);
  assert.match(source, /details"\)\.filter\(\{ has: anyCloseButton \}\)/);
  assert.match(source, /node\.open = true/);
});

test('production host lifecycle QA targets the visible audience trivia and navigation variants', () => {
  assert.match(source, /button\[aria-label="Hide pop-up trivia"\]:visible/);
  assert.match(source, /data-feature-id="singer-nav-songs"\]:visible/);
  assert.match(source, /data-feature-id="singer-requests-tab"\]:visible/);
  assert.match(source, /data-feature-id="singer-manual-request-open"\]:visible/);
  assert.match(source, /audienceFailureScreenshotPath/);
  assert.match(source, /tvFailureScreenshotPath/);
});

test('production host lifecycle QA closes its room and attempts cleanup after an earlier failure', () => {
  assert.match(source, /const closeHostRoomAndWaitForConfirmation/);
  assert.match(source, /data-host-close-room-recap/);
  assert.match(source, /host_closes_room_and_generates_private_recap/);
  assert.match(source, /scenarioFailure && roomCode && !roomCloseAttempted/);
  assert.match(source, /host_room_cleanup_after_failure/);
});
