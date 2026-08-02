import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('Host Auto Party only consumes current-session performances', () => {
    assert.match(hostAppSource, /const partyFlowBaselineRoomRef = useRef\(''\);/);
    assert.match(hostAppSource, /const lastPartyAutoEligiblePerfTsRef = useRef\(0\);/);
    assert.match(hostAppSource, /partyFlowBaselineRoomRef\.current !== roomCode[\s\S]*lastPartyAutoEligiblePerfTsRef\.current = 0/);
    assert.match(hostAppSource, /lastPartyAutoBreakTsRef\.current !== lastPerformanceTs[\s\S]*autoPartyEligiblePerformanceTs/);
});

test('Auto Party completion clears its TV mode and hands the stage back to the queue', () => {
    assert.match(hostAppSource, /const startNextFromQueue = useCallback\(async \(options = \{\}\) =>/);
    assert.match(hostAppSource, /completedAutoMomentKey[\s\S]*autoMomentHandoff/);
    assert.match(hostAppSource, /lobbyVolleyEnabled: false/);
    assert.match(hostAppSource, /startNextFromQueue\(\{ completedAutoMomentKey: momentKey \}\)/);
    assert.match(hostAppSource, /partyPatch:[\s\S]*lastGroupMode: recommendedMoment\.type/);
});
