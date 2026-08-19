import { describe, expect, it } from 'vitest';
import {
  HOSTING_LEVEL_IDS,
  NIGHT_EXPERIENCE_IDS,
  ORIGINAL_TRACK_LYRICS_POLICIES,
  buildNightPlanSummary,
  buildNightReadiness,
  compileNightPlanToLegacySettings,
  deriveNightPlan,
} from '../../src/lib/nightPlan.js';

describe('nightPlan compatibility model', () => {
  it('consolidates legacy sing-along and lip-sync modes into Original Track Party', () => {
    expect(deriveNightPlan({ performanceMode: 'sing_along' }).experienceId).toBe(NIGHT_EXPERIENCE_IDS.originalTracks);
    expect(deriveNightPlan({ performanceMode: 'lip_sync' }).experienceId).toBe(NIGHT_EXPERIENCE_IDS.originalTracks);
    expect(deriveNightPlan({ performanceMode: 'lip_sync' }).experienceConfig.originalTracks.lyricsPolicy)
      .toBe(ORIGINAL_TRACK_LYRICS_POLICIES.off);
  });

  it('derives a single Hosting Level from legacy automation fields', () => {
    expect(deriveNightPlan({ autoDj: false }).hostingLevel).toBe(HOSTING_LEVEL_IDS.hostLed);
    expect(deriveNightPlan({ autoDj: true }).hostingLevel).toBe(HOSTING_LEVEL_IDS.assisted);
    expect(deriveNightPlan({ autoDj: true, oneMinuteMicEnabled: true }).hostingLevel).toBe(HOSTING_LEVEL_IDS.selfServe);
  });

  it('keeps playback and lyric readiness independent', () => {
    const room = {
      nightPlan: {
        experienceId: 'original_tracks',
        hostingLevel: 'assisted',
        experienceConfig: { originalTracks: { lyricsPolicy: 'required' } },
      },
    };
    const readiness = buildNightReadiness({
      room,
      appleMusicAuthorized: true,
      songs: [
        { status: 'requested', appleMusicId: 'apple-1', lyricsTimed: [{ startMs: 0, text: 'Ready' }] },
        { status: 'requested', appleMusicId: 'apple-2', lyrics: '' },
      ],
    });
    expect(readiness.counts.originalReady).toBe(2);
    expect(readiness.counts.lyricsReady).toBe(1);
    expect(readiness.blockers).toContain('1 lineup item need verified lyrics');
  });

  it('compiles the consolidated experience to legacy fields without creating another runtime mode', () => {
    const patch = compileNightPlanToLegacySettings({
      experienceId: 'original_tracks',
      hostingLevel: 'assisted',
      experienceConfig: { originalTracks: { lyricsPolicy: 'off' } },
    });
    expect(patch.performanceMode).toBe('lip_sync');
    expect(patch.autoDj).toBe(true);
    expect(patch.showLyricsTv).toBe(false);
    expect(patch.nightPlan.experienceId).toBe(NIGHT_EXPERIENCE_IDS.originalTracks);
  });

  it('produces one host-facing summary sentence', () => {
    const summary = buildNightPlanSummary({ room: { hostNightPreset: 'trivia', autoDj: false } });
    expect(summary.headline).toBe('Trivia Night · Host-Led');
    expect(summary.sentence).toContain('Tonight is Trivia Night with Host-Led.');
  });
});
