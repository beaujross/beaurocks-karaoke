import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (path) => readFileSync(path, 'utf8');

describe('shared Host tab language', () => {
  it('keeps the public-inspired active, focus, and touch treatments centralized', () => {
    const css = readSource('src/apps/Host/hostBrandTabs.css');

    expect(css).toContain('.host-brand-tabs');
    expect(css).toContain('.host-brand-tab[aria-selected="true"]');
    expect(css).toContain('linear-gradient(90deg, rgba(255, 208, 124, 0.96), rgba(255, 108, 190, 0.92))');
    expect(css).toContain('.host-brand-tab:focus-visible');
    expect(css).toMatch(/@media \(max-width: 760px\), \(hover: none\) and \(pointer: coarse\)/);
  });

  it('uses the shared tabs for Room Setup and the primary Host workspace', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');
    const roomSetup = readSource('src/apps/Host/components/HostRoomLaunchPadBrowser.jsx');
    const topChrome = readSource('src/apps/Host/components/HostTopChrome.jsx');

    expect(host).toContain("import './hostBrandTabs.css';");
    expect(host).not.toContain('host-brand-tabs--steps');
    expect(roomSetup).toContain('host-brand-tabs host-brand-tabs--fill host-brand-tabs--workspace');
    expect(topChrome).toContain('host-brand-tabs host-brand-tabs--compact');
    expect(topChrome).toContain('aria-label="Host workspace"');
  });

  it('uses the same treatment for queue, moment, and media-library tablists', () => {
    const queue = readSource('src/apps/Host/components/HostQueueTab.jsx');
    const addMoment = readSource('src/apps/Host/components/AddToQueueFormBody.jsx');

    expect(queue).toContain('host-brand-tabs host-brand-tabs--workspace');
    expect(queue).toContain('host-brand-tab inline-flex');
    expect(addMoment).toContain('host-brand-tabs host-brand-tabs--workspace');
    expect(addMoment).toContain('host-brand-tab inline-flex');
  });

  it('uses lifted teal and pink surfaces instead of stacking near-black host chrome', () => {
    const css = readSource('src/apps/Host/hostBrandTabs.css');
    const host = readSource('src/apps/Host/HostApp.jsx');
    const topChrome = readSource('src/apps/Host/components/HostTopChrome.jsx');
    const horizon = readSource('src/apps/Host/components/HostQueueHorizon.jsx');
    const setupShell = readSource('src/apps/Host/components/setup/MissionSetupShell.jsx');
    assert.match(horizon, /Planned moments use Tonight\\'s Flow controls/);
    assert.match(horizon, /model\?\.automation\?\.label/);

    expect(host).toContain('host-app host-vivid-shell');
    expect(host).toContain('panel: "host-vivid-panel');
    expect(host).toContain('input: "host-vivid-field');
    expect(css).toContain('.host-vivid-shell');
    expect(css).toContain('--host-vivid-surface: rgba(28, 43, 70, 0.96)');
    expect(css).toContain('radial-gradient(circle at 94% 4%, rgba(244, 114, 182, 0.3)');
    expect(css).toContain('.host-vivid-shell [data-host-main-scroll="true"]');
    expect(topChrome).toContain('rgba(244,114,182,0.18)');
    expect(horizon).toContain('rgba(71,27,66,0.96)');
    expect(setupShell).toContain('rgba(34,211,238,0.42)');
    expect(setupShell).not.toContain('#06070d');
    expect(host).not.toContain('from-[#0f2d39] via-[#17263d] to-[#26172e]');
  });
});
