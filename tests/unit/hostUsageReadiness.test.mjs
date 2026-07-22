import { describe, expect, it } from 'vitest';
import { buildHostUsageReadiness, getMeterWarningLevelBps } from '../../src/lib/hostUsageReadiness.js';

const meter = (overrides = {}) => ({
  meterId: 'youtube_data_request',
  label: 'Workspace YouTube request allowance',
  used: 100,
  hardLimit: 1000,
  warningLevelBps: 1000,
  hardLimitReached: false,
  ...overrides,
});

describe('Host usage readiness', () => {
  it('gives an on-track answer without claiming the next Room is guaranteed', () => {
    const result = buildHostUsageReadiness({ meters: [meter()] });
    expect(result.status).toBe('ready');
    expect(result.label).toBe('On track');
    expect(result.summary).toContain('Plan a Room');
    expect(result.summary).not.toContain('guarantee');
  });

  it('turns the 80 percent warning into one planning action', () => {
    const result = buildHostUsageReadiness({ meters: [meter({ used: 820, warningLevelBps: 8200 })] });
    expect(result.status).toBe('watch');
    expect(result.nextAction).toBe('Plan a Room');
    expect(result.maxUsagePercent).toBe(82);
    expect(result.attentionMeterLabels).toEqual(['Workspace YouTube request allowance']);
  });

  it('protects the karaoke-night story when a hard limit is reached', () => {
    const result = buildHostUsageReadiness({ meters: [meter({ used: 1000, warningLevelBps: 10000, hardLimitReached: true })] });
    expect(result.status).toBe('action_needed');
    expect(result.nextAction).toBe('Review safety limits');
    expect(result.summary).toContain('local media');
    expect(result.summary).toContain('Public TV');
  });

  it('treats a paused live-search circuit as action needed without inventing meter trouble', () => {
    const result = buildHostUsageReadiness({ meters: [meter()], liveSearchState: 'blocked' });
    expect(result.status).toBe('action_needed');
    expect(result.attentionMeterLabels).toEqual([]);
  });

  it('does not show a false ready state without finite Host plan limits', () => {
    const result = buildHostUsageReadiness({ meters: [meter({ hardLimit: 0, warningLevelBps: 0 })] });
    expect(result.status).toBe('setup_required');
    expect(result.label).toBe('Host plan needed');
  });

  it('derives a warning ratio when older summaries omit warningLevelBps', () => {
    expect(getMeterWarningLevelBps(meter({ used: 850, warningLevelBps: 0 }))).toBe(8500);
  });
});
