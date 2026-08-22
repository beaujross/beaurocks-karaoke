import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (path) => readFileSync(path, 'utf8');

describe('Host workspace UX pass', () => {
  it('gives the embedded Catalog one bounded scroll owner', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');
    const queue = readSource('src/apps/Host/components/HostQueueTab.jsx');

    expect(host).toMatch(/data-feature-id="host-catalog-scroll-region"[\s\S]*activeBrowseList \? 'overflow-hidden' : 'overflow-y-auto overscroll-y-contain touch-scroll-y'/);
    expect(host).toMatch(/data-feature-id="host-catalog-category-scroll-content"[^>]*min-h-0 flex-1 overflow-y-auto/);
    expect(queue).toMatch(/data-feature-id="panel-catalog"[^>]*flex h-full flex-1 min-h-0 flex-col overflow-hidden/);
  });

  it('keeps Host tabs top-rounded and moves Show Time into Tonight\'s Lineup', () => {
    const css = readSource('src/apps/Host/hostBrandTabs.css');
    const chrome = readSource('src/apps/Host/components/HostTopChrome.jsx');
    const horizon = readSource('src/apps/Host/components/HostQueueHorizon.jsx');

    expect(css).toContain('border-radius: 15px 15px 0 0');
    expect(css).toContain('border-radius: 11px 11px 0 0');
    expect(css).toContain('border-radius: 12px 12px 0 0');
    expect(chrome).not.toContain('Show Time');
    expect(horizon).toContain('data-feature-id="host-lineup-show-time"');
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
    expect(launchPad).toContain('Return to {normalizedActiveRoomCode}');
    expect(launchPad).toContain("openExistingRoomWorkspace(normalizedActiveRoomCode, 'queue.live_run')");
  });
});
