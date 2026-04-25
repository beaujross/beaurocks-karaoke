import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('admin settings frame queue and automation as defaults rather than live controls', () => {
  assert.match(hostAppSource, /Queue defaults/);
  assert.match(hostAppSource, /These are room defaults\. Use Queue Controls in the queue tab for live pacing changes\./);
  assert.match(hostAppSource, /Screens \+ Overlays/);
  assert.match(hostAppSource, /Default TV chat, marquee, scoring, and audience-facing screen behavior\./);
  assert.match(hostAppSource, /Automation Defaults \+ Policy/);
  assert.match(hostAppSource, /Queue Controls in the queue tab are for live changes\./);
  assert.match(hostAppSource, /Use Queue Controls for live automation changes during the show\./);
  assert.match(hostAppSource, /Auto Party Policy/);
  assert.doesNotMatch(hostAppSource, /Trigger Ready Check/);
  assert.doesNotMatch(hostAppSource, /Now In Night Setup/);
});

test('admin automation labels distinguish defaults from live actions', () => {
  assert.match(hostAppSource, /Default Auto-DJ On|Default Auto-DJ Off/);
  assert.match(hostAppSource, /Default BG Music On|Default BG Music Off/);
  assert.match(hostAppSource, /Default Auto Playback On|Default Auto Playback Off/);
  assert.match(hostAppSource, /Default Auto End On|Default Auto End Off/);
  assert.match(hostAppSource, /Default Auto Bonus On|Default Auto Bonus Off/);
  assert.match(hostAppSource, /Default Pop Trivia On|Default Pop Trivia Off/);
  assert.match(hostAppSource, /Default Auto Party On|Default Auto Party Off/);
});
