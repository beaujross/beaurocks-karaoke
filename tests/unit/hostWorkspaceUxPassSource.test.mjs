import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (path) => readFileSync(path, 'utf8');

describe('Host workspace UX pass', () => {
  it('gives the embedded Catalog one bounded scroll owner', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');
    const queue = readSource('src/apps/Host/components/HostQueueTab.jsx');

    expect(host).toContain('flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-y-contain pb-8');
    expect(queue).toMatch(/data-feature-id="panel-catalog"[\s\S]*flex flex-1 min-h-0 flex-col overflow-hidden/);
  });

  it('keeps Host tabs top-rounded and prevents Show Time from shifting navigation', () => {
    const css = readSource('src/apps/Host/hostBrandTabs.css');
    const chrome = readSource('src/apps/Host/components/HostTopChrome.jsx');

    expect(css).toContain('border-radius: 15px 15px 0 0');
    expect(css).toContain('border-radius: 11px 11px 0 0');
    expect(css).toContain('border-radius: 12px 12px 0 0');
    expect(chrome).toContain("showTimeClockEnabled ? '' : 'invisible pointer-events-none'");
  });

  it('keeps audience preview opt-in and reachable from Quick Navigation', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');
    const chrome = readSource('src/apps/Host/components/HostTopChrome.jsx');

    expect(host).toContain("localStorage.getItem('bross_host_audience_preview_visible_v2') === '1'");
    expect(host).toContain("localStorage.setItem('bross_host_audience_preview_visible_v2'");
    expect(chrome).toContain('Audience Preview');
    expect(chrome).toContain('Show only when you need the phone view');
  });

  it('exposes background-loop membership and a direct return to the active room', () => {
    const queue = readSource('src/apps/Host/components/HostQueueTab.jsx');
    const launchPad = readSource('src/apps/Host/components/HostRoomLaunchPadBrowser.jsx');

    expect(queue).toContain('data-feature-id="host-background-loop-manager"');
    expect(queue).toContain('bgLoopExcludedTrackIds');
    expect(queue).toContain('Included with BeauRocks');
    expect(queue).toContain('Use each track&apos;s checkbox below.');
    expect(launchPad).toContain('Back to Live Room');
    expect(launchPad).toContain("openExistingRoomWorkspace(activeRoomCode, 'queue.live_run')");
  });
});
