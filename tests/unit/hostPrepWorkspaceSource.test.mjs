import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');
const addSource = readFileSync('src/apps/Host/components/AddToQueueFormBody.jsx', 'utf8');

test('Queue workspace separates performance and moment preparation without adding another top-level system', () => {
  assert.match(queueSource, /label: 'Performance Prep'/);
  assert.match(queueSource, /label: 'Moment Prep'/);
  assert.match(queueSource, /data-feature-id="host-performance-prep-header"/);
  assert.match(queueSource, /data-feature-id="host-moment-prep-header"/);
  assert.match(queueSource, /Choose the singer, song, and backing before it reaches the Live Queue\./);
  assert.match(queueSource, /Build the beats between performances/);
  assert.match(queueSource, /data-feature-id="moment-prep-timeline"/);
  assert.match(queueSource, /Tonight&apos;s Timeline/);
  assert.match(queueSource, /momentPrepTimelineItems\.slice\(0, 6\)/);
  assert.match(queueSource, /Open Timeline Builder/);
  assert.notMatch(queueSource, /data-feature-id="moment-prep-live-queue-handoff"/);
  assert.notMatch(queueSource, /This mirrors the singer lane used by Live Queue\. Reorder singers there\./);
  assert.match(queueSource, /destination: 'planner'/);
  assert.match(queueSource, /onPromotePreparedRunOfShowItems\?\.\(\[item\.id\]\)/);
  assert.match(queueSource, /data-moment-prep-scroll-owner="true"[\s\S]*overflow-y-auto overscroll-y-contain/);
  assert.equal(
    [...queueSource.matchAll(/className="flex min-h-0 flex-1 flex-col overflow-hidden bg-emerald-500\/\[0\.03\]"/g)].length,
    2,
    'Desktop and compact Moment Prep wrappers should both bound the shared scroll owner',
  );
  assert.match(queueSource, /const momentPrepWorkspaceActive =/);
  assert.match(queueSource, /momentPrepWorkspaceActive \? 'flex min-h-0 flex-col overflow-hidden'/);
  assert.match(queueSource, /momentPrepWorkspaceActive \? 'hidden'/);
  assert.notMatch(queueSource, /<RunOfShowQueueHud/);
});

test('compact Queue navigation uses short performance and moment labels', () => {
  assert.match(queueSource, /id: 'add-mobile',\s*label: 'Performances'/);
  assert.match(queueSource, /id: 'show-mobile',\s*label: 'Moments'/);
  assert.match(addSource, /aria-label="Performance and moment types"/);
});
