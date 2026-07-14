import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  getAudienceGameMembershipGate,
  getAudienceGameMembershipLabel,
} from '../../src/lib/audienceGameMembershipGate.js';

test('membership gate stays hidden for joined guests and deterministic demo fixtures', () => {
  assert.equal(getAudienceGameMembershipGate({ hasRoomUser: true, membershipResolved: true, takeoverKind: 'active:trivia_pop' }).visible, false);
  assert.equal(getAudienceGameMembershipGate({ isDemoFixture: true, takeoverKind: 'active:trivia_pop' }).visible, false);
  assert.equal(getAudienceGameMembershipGate({ membershipResolved: true, takeoverKind: '' }).visible, false);
});

test('membership gate prevents actionable game controls while membership is resolving', () => {
  assert.deepEqual(getAudienceGameMembershipGate({
    membershipResolved: false,
    takeoverKind: 'active:trivia_pop',
    activeMode: 'trivia_pop',
  }), {
    visible: true,
    state: 'connecting',
    modeLabel: 'Trivia',
    headline: 'Connecting you to Trivia',
    detail: 'Checking whether this device is already part of the room.',
  });
});

test('resolved non-members receive a join-first destination that preserves the active game', () => {
  const gate = getAudienceGameMembershipGate({
    membershipResolved: true,
    takeoverKind: 'active:wyr',
    activeMode: 'wyr',
  });
  assert.equal(gate.visible, true);
  assert.equal(gate.state, 'join');
  assert.equal(gate.modeLabel, 'Would You Rather');
  assert.match(gate.detail, /return directly to the live round/i);
});

test('membership labels cover game aliases and light-mode takeovers', () => {
  assert.equal(getAudienceGameMembershipLabel({ activeMode: 'trivia_reveal' }), 'Trivia');
  assert.equal(getAudienceGameMembershipLabel({ activeMode: 'karaoke', lightMode: 'strobe' }), 'Beat Drop');
  assert.equal(getAudienceGameMembershipLabel({ activeMode: 'unknown' }), 'Live Room Moment');
});
