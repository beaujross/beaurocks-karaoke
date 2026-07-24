import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const launchPadSource = readFileSync('src/apps/Host/components/HostRoomLaunchPadBrowser.jsx', 'utf8');
const primaryPicksSource = readFileSync('src/apps/Host/components/setup/MissionSetupPrimaryPicks.jsx', 'utf8');

describe('recipe-first room setup source', () => {
  it('makes recipe setup the host default while retaining an explicit legacy QA override', () => {
    expect(hostSource).toMatch(
      /const nextCohort = missionQueryOverride === false \? 'legacy' : 'mission'/,
    );
    expect(hostSource).not.toMatch(/Math\.random\(\) < 0\.5 \? 'mission' : 'legacy'/);
  });

  it('keeps the visible setup flow free of nested room-type and queue-pace prompts', () => {
    expect(primaryPicksSource).toContain('data-room-setup-recipes="true"');
    expect(primaryPicksSource).not.toMatch(/Event Shortcut|Pick the queue pace|Change room package/);
    expect(launchPadSource).toContain('data-launch-room-recipe={option.id}');
    expect(launchPadSource).toContain('data-branded-room-sort="true"');
  });

  it('uses cached YouTube entries instead of the local library for setup fallback songs', () => {
    expect(hostSource).toContain('buildCachedYouTubeDeadAirSongs');
    expect(hostSource).toContain('sourceSongs: missionDeadAirSourceSongs');
    expect(hostSource).not.toContain('buildDeadAirFillerSongPlan({ sourceSongs: localLibrary })');
  });
});
