import { expect, test } from 'vitest';

import { resolveInitialHostWorkspaceRoute } from '../../src/apps/Host/workspace/initialRoute.js';

test('Host initial route preserves canonical Show deep links before URL synchronization', () => {
    expect(
        resolveInitialHostWorkspaceRoute('?view=show&section=show.timeline&tab=run_of_show'),
    ).toEqual({
        tab: 'run_of_show',
        view: 'show',
        section: 'show.timeline',
        settingsTab: 'general',
    });
});

test('Host initial route preserves canonical Admin media deep links', () => {
    expect(
        resolveInitialHostWorkspaceRoute('?view=media&section=media.playback&tab=admin'),
    ).toEqual({
        tab: 'admin',
        view: 'media',
        section: 'media.playback',
        settingsTab: 'media',
    });
});

test('Host initial route derives a catalog tab when only canonical view and section are present', () => {
    expect(
        resolveInitialHostWorkspaceRoute('?view=queue&section=queue.catalog'),
    ).toEqual({
        tab: 'browse',
        view: 'queue',
        section: 'queue.catalog',
        settingsTab: 'general',
    });
});

test('Host initial route keeps the existing Night Setup default', () => {
    expect(resolveInitialHostWorkspaceRoute('')).toEqual({
        tab: 'admin',
        view: 'ops',
        section: 'ops.room_setup',
        settingsTab: 'general',
    });
});
