import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Host onboarding telemetry contract', () => {
  const marketingSource = readSource('src/apps/Marketing/pages/ForHostsPage.jsx');
  const marketingShellSource = readSource('src/apps/Marketing/MarketingSite.jsx');
  const nextActionSource = readSource('src/apps/HostRelations/HostOnboardingNextAction.jsx');
  const hostLaunchSource = readSource('src/apps/Host/hooks/useHostLaunchFlow.js');
  const hostAppSource = readSource('src/apps/Host/HostApp.jsx');

  it('covers the customer journey from application through the first live-room handoff', () => {
    expect(marketingSource).toContain('mk_host_application_submitted');
    expect(marketingShellSource).toContain('mk_host_auth_return');
    expect(nextActionSource).toContain('host_onboarding_next_action_clicked');
    expect(hostLaunchSource).toContain('host_onboarding_profile_started');
    expect(hostLaunchSource).toContain('host_onboarding_profile_saved');
    expect(hostLaunchSource).toContain('host_onboarding_profile_save_failed');
    expect(hostLaunchSource).toContain('host_onboarding_profile_dismissed');
    expect(hostAppSource).toContain('host_onboarding_room_setup_handoff');
    expect(hostLaunchSource).toContain('host_room_created');
    expect(hostAppSource).toContain('host_room_launch_guide_action');
  });

  it('keeps onboarding event parameters operational and free of applicant identity fields', () => {
    expect(nextActionSource).toMatch(/host_onboarding_next_action_clicked[\s\S]*onboarding_stage:[\s\S]*source:[\s\S]*destination:/);
    expect(hostLaunchSource).toMatch(/host_onboarding_profile_save_failed[\s\S]*error_code:/);
    expect(nextActionSource).not.toMatch(/host_onboarding_next_action_clicked[\s\S]{0,240}(email|host_name|workspace_name):/i);
    expect(hostLaunchSource).not.toMatch(/host_onboarding_profile_(?:started|saved|save_failed|dismissed)[\s\S]{0,260}(email|host_name|workspace_name):/i);
  });

  it('does not count a completed profile as an onboarding dismissal', () => {
    expect(hostLaunchSource).toContain("closeOnboardingWizard = useCallback(({ completed = false } = {})");
    expect(hostLaunchSource).toMatch(/if \(!completed\) \{[\s\S]*host_onboarding_profile_dismissed/);
    expect(hostAppSource).toContain('closeOnboardingWizard({ completed: true })');
  });
});
