import assert from 'node:assert/strict';
import { test } from 'vitest';

import { shouldShowStreamlinedIdleRequestCard } from '../../src/apps/Mobile/lib/singerHomeState.js';

test('streamlined Singer idle request card appears only for the empty home state', () => {
  assert.equal(shouldShowStreamlinedIdleRequestCard({
    tab: 'home',
    noSingerOnStage: true,
    lobbyVolleySceneActive: false,
    isStreamlinedAudienceShell: true,
  }), true);

  assert.equal(shouldShowStreamlinedIdleRequestCard({
    tab: 'request',
    noSingerOnStage: true,
    lobbyVolleySceneActive: false,
    isStreamlinedAudienceShell: true,
  }), false);

  assert.equal(shouldShowStreamlinedIdleRequestCard({
    tab: 'home',
    noSingerOnStage: false,
    lobbyVolleySceneActive: false,
    isStreamlinedAudienceShell: true,
  }), false);

  assert.equal(shouldShowStreamlinedIdleRequestCard({
    tab: 'home',
    noSingerOnStage: true,
    lobbyVolleySceneActive: true,
    isStreamlinedAudienceShell: true,
  }), false);
});
