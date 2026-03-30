import { describe, expect, it } from 'vitest';

import {
  REQUEST_MODES,
  allowsGuestBackingSelection,
  isPlayableOnlyRequestMode,
  normalizeRoomRequestMode,
} from '../../src/lib/requestModes.js';

describe('requestModes', () => {
  it('defaults blank rooms to canonical open', () => {
    expect(normalizeRoomRequestMode('', false)).toBe(REQUEST_MODES.canonicalOpen);
  });

  it('maps legacy guest backing rooms to guest backing optional', () => {
    expect(normalizeRoomRequestMode('', true)).toBe(REQUEST_MODES.guestBackingOptional);
  });

  it('detects playable only rooms directly', () => {
    expect(isPlayableOnlyRequestMode(REQUEST_MODES.playableOnly, false)).toBe(true);
    expect(allowsGuestBackingSelection(REQUEST_MODES.playableOnly, false)).toBe(false);
  });

  it('only allows guest backing when the mode and legacy toggle both permit it', () => {
    expect(allowsGuestBackingSelection(REQUEST_MODES.guestBackingOptional, true)).toBe(true);
    expect(allowsGuestBackingSelection(REQUEST_MODES.guestBackingOptional, false)).toBe(false);
  });
});
