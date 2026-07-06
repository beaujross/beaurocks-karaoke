import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const readSource = (relativePath) => readFileSync(resolve(relativePath), 'utf8');

const queueActionsSource = readSource('src/apps/Host/hooks/useQueueSongActions.js');
const queueTabSource = readSource('src/apps/Host/components/HostQueueTab.jsx');
const playbackSource = readSource('src/lib/playbackSource.js');
const autoDjSource = readSource('src/apps/Host/autoDjStateMachine.js');
const roomFlowSource = readSource('src/apps/Host/roomFlowOrchestrator.js');

test('Apple autocomplete queues song intent for host review instead of immediate backing playback', () => {
    assert.match(queueActionsSource, /const appleIntentNeedsBacking = preferAppleDefault && options\?\.queueAppleBacking !== true;/);
    assert.match(queueActionsSource, /resolutionStatus: RESOLUTION_STATUSES\.reviewRequired/);
    assert.match(queueActionsSource, /mediaResolutionStatus: 'pending_youtube_match'/);
    assert.match(queueActionsSource, /playbackReady: false/);
    assert.match(queueActionsSource, /Queued song from Apple Music\. Pick a YouTube backing or approve Apple sing-along\./);
});

test('Apple intent copy tells hosts it is song identity, not karaoke backing', () => {
    assert.match(queueTabSource, /Autocomplete source: Apple Music song intent \+ local library\./);
    assert.match(queueTabSource, /Apple Music song match\. Pick a YouTube backing or approve Apple sing-along\./);
});

test('pending YouTube match is not treated as playable by automation gates', () => {
    assert.match(playbackSource, /status === 'needs_backing' \|\| status === 'pending_youtube_match'/);
    assert.match(autoDjSource, /mediaResolutionStatus === 'needs_backing' \|\| mediaResolutionStatus === 'pending_youtube_match'/);
    assert.match(roomFlowSource, /mediaResolutionStatus === 'needs_backing' \|\| mediaResolutionStatus === 'pending_youtube_match'/);
});