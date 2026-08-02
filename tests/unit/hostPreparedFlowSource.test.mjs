import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const directorPanelSource = readFileSync('src/apps/Host/components/RunOfShowDirectorPanel.jsx', 'utf8');
const addMomentSource = readFileSync('src/apps/Host/components/AddToQueueFormBody.jsx', 'utf8');
const liveOpsSource = readFileSync('src/apps/Host/components/HostLiveOpsPanel.jsx', 'utf8');

test("moment drafts have individual and bulk paths into Tonight's Lineup", () => {
  assert.match(
    hostAppSource,
    /onPromotePreparedItems=\{promotePreparedRunOfShowItems\}/,
    'HostApp should provide a single-write promotion path to the planning surface',
  );
  assert.match(
    directorPanelSource,
    /data-feature-id="host-prepared-items-tray"/,
    'The planning surface should expose prepared work as a visible tray',
  );
  assert.match(
    directorPanelSource,
    /Add All \$\{nightFlowBuckets\.preparedItems\.length\} to Lineup/,
    'Prepared work should support ordered bulk promotion',
  );
  assert.match(
    directorPanelSource,
    /label: HOST_LIVE_OPS_LANGUAGE\.addToLineup/,
    'Each prepared item should have a direct promotion action',
  );
  assert.match(directorPanelSource, /data-feature-id="host-prepared-moment-cadence"/);
  assert.match(directorPanelSource, /Space moments through \{HOST_LIVE_OPS_LANGUAGE\.lineup\}/);
  assert.match(hostAppSource, /schedulePreparedMomentsByPerformanceCadence/);
  assert.match(hostAppSource, /onSchedulePreparedItems=\{schedulePreparedRunOfShowMoments\}/);
});

test('host-facing planning language describes the job instead of the implementation', () => {
  assert.match(directorPanelSource, /HOST_LIVE_OPS_LANGUAGE\.advancedShowControls/);
  assert.match(directorPanelSource, />\s*Prepare\s*</);
  assert.match(directorPanelSource, />\s*Review\s*</);
  assert.match(directorPanelSource, /HOST_LIVE_OPS_LANGUAGE\.lineup\} status/);
  assert.match(addMomentSource, /label: HOST_LIVE_OPS_LANGUAGE\.momentDrafts/);
  assert.match(addMomentSource, /actionLabel: HOST_LIVE_OPS_LANGUAGE\.saveDraft/);
  assert.match(liveOpsSource, /label="Next Moment"/);

  assert.notMatch(directorPanelSource, /Live Queue|Tonight's Flow|Add to Live Queue/);
  assert.equal(/>Show Conveyor</.test(directorPanelSource), false);
  assert.equal(/label="Flighted"/.test(directorPanelSource), false);
  assert.equal(/label: 'Full Night Builder'/.test(addMomentSource), false);
});
