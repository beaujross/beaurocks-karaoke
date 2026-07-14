import { describe, expect, test } from 'vitest';
import { buildYouTubeEventReadiness } from '../../src/lib/youtubeEventReadiness.js';

const readyInput = {
  telemetry: {
    todaySearchListCallsRemaining: 72,
    recentSearches: 6,
    liveSharePct: 17,
    quotaBlocked: false,
  },
  knownEmbeddableCount: 80,
  freshRoomIndexCount: 12,
  provenRoomIndexCount: 5,
  localFallbackCount: 2,
};

describe('youtubeEventReadiness', () => {
  test('marks a diversified catalog and healthy estimated reserve event-ready', () => {
    const result = buildYouTubeEventReadiness(readyInput);
    expect(result.key).toBe('ready');
    expect(result.checks.every((check) => check.pass)).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.caveat).toMatch(/Google Cloud Quotas is the source of truth/);
  });

  test('keeps a quota-blocked room operable only when known and local fallbacks exist', () => {
    const protectedResult = buildYouTubeEventReadiness({
      ...readyInput,
      telemetry: { ...readyInput.telemetry, quotaBlocked: true, todaySearchListCallsRemaining: 0 },
    });
    expect(protectedResult.key).toBe('fallback_ready');
    expect(protectedResult.actions.join(' ')).toMatch(/pause live discovery/i);

    const gapResult = buildYouTubeEventReadiness({
      ...readyInput,
      telemetry: { ...readyInput.telemetry, quotaBlocked: true, todaySearchListCallsRemaining: 0 },
      localFallbackCount: 0,
    });
    expect(gapResult.key).toBe('fallback_gap');
  });

  test('prioritizes catalog depth, local fallback, reserve, and room proof without blocking mechanics', () => {
    expect(buildYouTubeEventReadiness({ ...readyInput, knownEmbeddableCount: 8 }).key).toBe('catalog_gap');
    expect(buildYouTubeEventReadiness({ ...readyInput, localFallbackCount: 0 }).key).toBe('fallback_gap');
    expect(buildYouTubeEventReadiness({
      ...readyInput,
      telemetry: { ...readyInput.telemetry, todaySearchListCallsRemaining: 8 },
    }).key).toBe('reserve_guard');
    expect(buildYouTubeEventReadiness({ ...readyInput, provenRoomIndexCount: 1 }).key).toBe('watch');
  });

  test('flags sustained live-heavy search even when nominal reserve remains', () => {
    const result = buildYouTubeEventReadiness({
      ...readyInput,
      telemetry: { ...readyInput.telemetry, recentSearches: 8, liveSharePct: 75 },
    });
    expect(result.key).toBe('watch');
    expect(result.liveHeavy).toBe(true);
    expect(result.summary).toMatch(/live-heavy/i);
  });
});
