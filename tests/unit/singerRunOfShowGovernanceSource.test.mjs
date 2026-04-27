import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');

test('audience app exposes run-of-show release-window controls for crowd and co-host voters', () => {
  assert.match(source, /getRunOfShowOperatorRole/);
  assert.match(source, /getRunOfShowReleaseWindowTally/);
  assert.match(source, /const canSeeAudienceReleaseWindow = useMemo/);
  assert.match(source, /const castRunOfShowReleaseVote = async/);
  assert.match(source, /runOfShowDirector\.releaseWindow\.votesByUid\.\$\{activeUid\}/);
  assert.match(source, /Co-Host Song Face-Off/);
  assert.match(source, /Audience Song Face-Off/);
  assert.match(source, /Co-Host Slot Fill/);
  assert.match(source, /Audience Slot Fill/);
  assert.match(source, /Co-hosts are helping steer what happens next\./);
  assert.match(source, /Pick one\. Host confirms the winner\./);
  assert.match(source, /Pick who should fill this slot\. Host confirms\./);
  assert.match(source, /Promoted Co-Host/);
  assert.match(source, /getAudienceSongArtworkUrl/);
  assert.match(source, /max-w-\[26rem\]/);
  assert.match(source, /COHOST_SIGNAL_OPTIONS/);
  assert.match(source, /const canUseCoHostQuickSignals = useMemo/);
  assert.match(source, /const sendCoHostQuickSignal = async/);
  assert.match(source, /type: 'cohost_signal'/);
  assert.match(source, /signalId: meta\.id/);
  assert.match(source, /signalScope: performanceMeta\.performanceId \? 'performance' : 'room'/);
  assert.match(source, /performanceSongTitle: performanceSongTitle \|\| null/);
  assert.match(source, /performanceArtistName: performanceArtistName \|\| null/);
  assert.match(source, /performanceAlbumArtUrl: performanceAlbumArtUrl \|\| null/);
  assert.match(source, /performanceElapsedSec: performanceElapsedSec \|\| 0/);
  assert.match(source, /data-feature-id="cohost-quick-signals"/);
  assert.match(source, /Tell Host/);
  assert.match(source, /No live performance\. Signals still carry a timestamp\./);
  assert.match(source, /Audio-only notes\. The app timestamps them and ties them to the live performance when one is up\./);
  assert.match(source, /const audioCoHostSignals = useMemo/);
  assert.match(source, /const currentPerformanceSignalContext = useMemo/);
  assert.match(source, /formatElapsedClock/);
  assert.match(source, /COHOST_SIGNAL_COOLDOWN_MS/);
  assert.match(source, /canSeeAudienceReleaseWindow && isAudienceSongFaceOffDecision/);
  assert.match(source, /const isAudienceSlotFillDecision = audienceReleaseSubjectType === 'slot_fill_choice';/);
  assert.match(source, /choiceLabels\?\.slot_scene/);
  assert.match(source, /choiceDetails\?\.keep_queue_moving/);
  assert.match(source, /You voted for \$\{voteLabel\}\./);
  assert.match(source, /authCurrentUid: isQaAudienceFixture \? '' : auth\.currentUser\?\.uid/);
  assert.match(source, /authReadyUid: isQaAudienceFixture \? '' : authReadyUid/);
});
