import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');
const addSource = readFileSync('src/apps/Host/components/AddToQueueFormBody.jsx', 'utf8');

const languageSource = readFileSync('src/apps/Host/hostLiveOpsLanguage.js', 'utf8');
test('Queue workspace separates performance and moment preparation without adding another top-level system', () => {
  assert.match(languageSource, /lineup: "Tonight's Lineup"/);
  assert.match(languageSource, /showPlan: 'Show Plan'/);
  assert.match(languageSource, /addPerformance: 'Add Performance'/);
  assert.match(languageSource, /autoAdvance: 'Auto-Advance'/);
  assert.match(queueSource, /label: HOST_LIVE_OPS_LANGUAGE\.addPerformance/);
  assert.match(queueSource, /label: HOST_LIVE_OPS_LANGUAGE\.showPlan/);
  assert.match(queueSource, /data-feature-id="host-performance-prep-header"/);
  assert.match(queueSource, /data-feature-id="host-moment-prep-header"/);
  assert.match(queueSource, /adding the performance to \{HOST_LIVE_OPS_LANGUAGE\.lineup\}/);
  assert.match(queueSource, /Build moments and arrange tonight/);
  assert.match(queueSource, /data-feature-id="moment-prep-timeline"/);
  assert.match(queueSource, /HOST_LIVE_OPS_LANGUAGE\.lineup/);
  assert.match(queueSource, /momentPrepTimelineItems\.slice\(0, 6\)/);
  assert.match(queueSource, /HOST_LIVE_OPS_LANGUAGE\.advancedShowControls/);
  assert.match(queueSource, /data-feature-id="moment-prep-live-handoff"/);
  assert.match(queueSource, /HOST_LIVE_OPS_LANGUAGE\.startNext/);
  assert.match(queueSource, /HOST_LIVE_OPS_LANGUAGE\.autoDj\} runs performances only/);
  assert.notMatch(queueSource, /Live Queue|Moment Prep|Performance Prep|Take Next Live|Add to Flow/);
  assert.match(queueSource, /destination: 'planner'/);
  assert.match(queueSource, /onPromotePreparedRunOfShowItems\?\.\(\[item\.id\]\)/);
  assert.match(queueSource, /data-moment-prep-scroll-owner="true"[\s\S]*overflow-y-auto overscroll-y-contain/);
  assert.equal(
    [...queueSource.matchAll(/className="flex min-h-0 flex-1 flex-col overflow-hidden bg-emerald-500\/\[0\.03\]"/g)].length,
    2,
    'Desktop and compact Show Plan wrappers should both bound the shared scroll owner',
  );
  assert.match(queueSource, /const momentPrepWorkspaceActive =/);
  assert.notMatch(queueSource, /momentPrepWorkspaceActive \? 'flex min-h-0 flex-col overflow-hidden'/);
  assert.notMatch(queueSource, /momentPrepWorkspaceActive \? 'hidden'/);
  assert.match(queueSource, /data-feature-id="moment-prep-full-director"/);
  assert.match(queueSource, /runOfShowDirectorPanel/);
  assert.notMatch(queueSource, /<RunOfShowQueueHud/);
});

test('compact Queue navigation uses short performance and moment labels', () => {
  assert.match(queueSource, /id: 'add-mobile',\s*label: HOST_LIVE_OPS_LANGUAGE\.addPerformance/);
  assert.match(queueSource, /id: 'show-mobile',\s*label: HOST_LIVE_OPS_LANGUAGE\.showPlan/);
  assert.match(addSource, /aria-label="Performance and moment types"/);
});
