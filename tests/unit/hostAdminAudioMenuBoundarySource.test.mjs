import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const hostSource = readFileSync(new URL('../../src/apps/Host/HostApp.jsx', import.meta.url), 'utf8');

test('full-screen host workspaces close the desktop audio popover', () => {
    expect(hostSource).toMatch(
        /if \(tab !== 'run_of_show' && tab !== 'admin'\) return;\s+setAudioPanelOpen\(false\);/,
    );
});