import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostQueueTabPath = path.resolve(__dirname, '../../src/apps/Host/components/HostQueueTab.jsx');

test('track check review actions follow admin search source settings and prefer YouTube when enabled', () => {
  const source = readFileSync(hostQueueTabPath, 'utf8');

  assert.match(
    source,
    /const youtubeTrackCheckEnabled = searchSources\?\.youtube !== false;/,
    'Track Check should read the YouTube search-source toggle before choosing a lead action',
  );
  assert.match(
    source,
    /const appleTrackCheckEnabled = searchSources\?\.itunes !== false;/,
    'Track Check should respect the Apple search-source toggle from admin settings',
  );
  assert.match(
    source,
    /const prioritizeYouTubeReview = youtubeTrackCheckEnabled \|\| !appleTrackCheckEnabled;/,
    'Track Check should keep YouTube in the lead whenever YouTube search is enabled',
  );
  assert.match(
    source,
    /Find a YouTube backing first\. Apple sing-along stays available as fallback\./,
    'Track Check should explain the new YouTube-first posture when both sources are available',
  );
  assert.match(
    source,
    /label: 'Find YouTube Backing'[\s\S]*className: prioritizeYouTubeReview \? STYLES\.btnPrimary : STYLES\.btnHighlight,/,
    'Track Check should render the YouTube action as the primary button when YouTube is preferred',
  );
  assert.match(
    source,
    /label: 'Apple Sing-Along'[\s\S]*className: prioritizeYouTubeReview \? STYLES\.btnSecondary : STYLES\.btnPrimary,/,
    'Track Check should demote Apple to a fallback when YouTube is preferred',
  );
});
