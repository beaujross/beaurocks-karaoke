import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  AUDIENCE_DISPLAY_MODES,
  AUDIENCE_DISPLAY_ROLE_SOURCES,
  buildAudienceDisplayPatch,
  getAudienceDisplayCommentatorReactionEmoji,
  getAudienceDisplayCommentatorReactionMeta,
  getAudienceDisplayCommentatorReactions,
  normalizeAudienceDisplay,
} from '../../src/lib/audienceDisplay.js';

test('audienceDisplay normalizes commentator row state', () => {
  const display = normalizeAudienceDisplay({
    mode: 'commentator_row',
    sessionId: 'row_1',
    selectedUids: ['u1', 'u1', '', 'u2', 'u3'],
    roleSource: 'cohosts',
    maxVisible: 2,
    showReactions: true,
    startedAtMs: 1000,
  }, { nowMs: 2000 });

  assert.equal(display.mode, AUDIENCE_DISPLAY_MODES.commentatorRow);
  assert.deepEqual(display.selectedUids, ['u1', 'u2']);
  assert.equal(display.roleSource, AUDIENCE_DISPLAY_ROLE_SOURCES.coHosts);
  assert.equal(display.maxVisible, 2);
  assert.equal(display.showReactions, true);
});

test('audienceDisplay expires back to off', () => {
  const display = normalizeAudienceDisplay({
    mode: 'lobby_wall',
    selectedUids: ['u1'],
    expiresAtMs: 1500,
  }, { nowMs: 2000 });

  assert.equal(display.mode, AUDIENCE_DISPLAY_MODES.off);
  assert.deepEqual(display.selectedUids, []);
  assert.equal(display.showReactions, false);
});

test('buildAudienceDisplayPatch preserves mode on partial behavior updates', () => {
  const patch = buildAudienceDisplayPatch({
    current: {
      mode: 'commentator_row',
      sessionId: 'row_1',
      selectedUids: ['u1', 'u2'],
      maxVisible: 4,
      showReactions: true,
      startedAtMs: 1000,
    },
    showReactions: false,
    nowMs: 3000,
  });

  assert.equal(patch.audienceDisplay.mode, AUDIENCE_DISPLAY_MODES.commentatorRow);
  assert.deepEqual(patch.audienceDisplay.selectedUids, ['u1', 'u2']);
  assert.equal(patch.audienceDisplay.showReactions, false);
});

test('commentator reactions use a distinct vocabulary from standard vote reactions', () => {
  const reactions = getAudienceDisplayCommentatorReactions();
  assert.deepEqual(reactions.map((reaction) => reaction.type), [
    'commentator_hot_take',
    'commentator_callback',
    'commentator_vibe_check',
    'commentator_wow',
  ]);
  assert.ok(getAudienceDisplayCommentatorReactionEmoji('commentator_hot_take'));
  assert.equal(getAudienceDisplayCommentatorReactionMeta('commentator_hot_take')?.tvToken, 'TAKE');
  assert.equal(getAudienceDisplayCommentatorReactionMeta('commentator_vibe_check')?.iconClass, 'fa-wave-square');
  assert.ok(reactions.every((reaction) => reaction.type.startsWith('commentator_')));
  assert.ok(reactions.every((reaction) => reaction.tvToken && reaction.iconClass));
});
