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
  assert.match(queueSource, /data-feature-id="moment-prep-live-queue-handoff"/);
  assert.match(queueSource, /This mirrors the singer lane used by Live Queue\. Reorder singers there\./);
  assert.match(queueSource, /destination: 'planner'/);
  assert.match(queueSource, /onPromotePreparedRunOfShowItems\?\.\(\[item\.id\]\)/);
  assert.notMatch(queueSource, /<RunOfShowQueueHud/);
});

test('compact Queue navigation uses short performance and moment labels', () => {
  assert.match(queueSource, /id: 'add-mobile',\s*label: 'Performances'/);
  assert.match(queueSource, /id: 'show-mobile',\s*label: 'Moments'/);
  assert.match(addSource, /aria-label="Performance and moment types"/);
});
