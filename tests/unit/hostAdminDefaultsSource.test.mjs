import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const navConfigSource = readFileSync('src/apps/Host/workspace/navConfig.js', 'utf8');

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

test('admin room settings own the detailed post-performance timing controls', () => {
  assert.match(hostAppSource, /Post-performance sequence/);
  assert.match(hostAppSource, /The live stage rail only controls the overall pace slider\./);
  assert.match(hostAppSource, /Applause warm-up/);
  assert.match(hostAppSource, /Default warm-up is off, so TV can roll straight into the applause countdown\./);
  assert.match(hostAppSource, /Warm-up extension/);
  assert.match(hostAppSource, /Leaderboard beat/);
  assert.match(hostAppSource, /Next up beat/);
  assert.match(hostAppSource, /Show post-performance recap sequence on TV/);
});

test('admin navigation keeps core config sections wired into the workspace registry', () => {
  assert.match(
    navConfigSource,
    /defaultSection: 'audience\.roster'/,
    'Audience workspace should default to the primary roster surface instead of dropping hosts into chat',
  );
  assert.match(
    navConfigSource,
    /\{ id: 'audience\.chat', view: 'audience', label: 'Chat', legacyTab: 'chat' \}/,
    'Audience chat should exist in the workspace section registry',
  );
  assert.match(
    hostAppSource,
    /where\('roomCode', '==', roomCode\),\s*limit\(200\)/,
    'Host activity feed should stay bounded on the server instead of subscribing to the full room activity collection',
  );
  assert.match(
    hostAppSource,
    /\.sort\(\(a, b\) => toMs\(b\?\.timestamp\) - toMs\(a\?\.timestamp\)\)/,
    'Host activity feed should still normalize newest-first ordering before rendering the bounded activity slice',
  );
  assert.match(
    hostAppSource,
    /Open main inbox/,
    'Host moderation settings should route back to the primary inbox pattern',
  );
  assert.match(
    hostAppSource,
    /beaurocks:focus-host-inbox/,
    'Host inbox routing should use the shared focus event instead of a separate drawer surface',
  );
  assert.doesNotMatch(
    hostAppSource,
    /ModerationInboxDrawer|showModerationInbox|setShowModerationInbox/,
    'Host should no longer keep a separate moderation drawer state or render path',
  );
  assert.match(
    hostAppSource,
    /key: 'automations',[\s\S]*?ownership: 'config',\s*description: 'Auto-DJ, host assist, auto-advance, and other room automation rules\.'/,
    'Automation should remain a first-class admin navigation section',
  );
  assert.match(
    hostAppSource,
    /key: 'marquee',[\s\S]*?ownership: 'config',\s*description: 'Marquee timing, overlay messaging, and idle-screen content\.'/,
    'Overlays should remain a first-class admin navigation section',
  );
});
