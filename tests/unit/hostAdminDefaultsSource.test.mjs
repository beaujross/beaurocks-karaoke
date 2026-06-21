import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const navConfigSource = readFileSync('src/apps/Host/workspace/navConfig.js', 'utf8');
const workspaceNavigationSource = readFileSync('src/apps/Host/hooks/useHostWorkspaceNavigation.js', 'utf8');
const getAdminSection = (startKey, nextKey) => {
  const startMarker = `{settingsTab === '${startKey}' && (`;
  const endMarker = `{settingsTab === '${nextKey}' && (`;
  const startIndex = hostAppSource.indexOf(startMarker);
  const endIndex = hostAppSource.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(startIndex, -1, `Expected to find admin section ${startKey}`);
  assert.notEqual(endIndex, -1, `Expected to find following admin section ${nextKey}`);
  return hostAppSource.slice(startIndex, endIndex);
};

test('admin settings frame queue and automation as defaults rather than live controls', () => {
  assert.match(hostAppSource, /Queue defaults/);
  assert.match(hostAppSource, /These are room defaults\. Use the top Room and Automation menus for live pacing changes\./);
  assert.match(hostAppSource, /Screens \+ Overlays/);
  assert.match(hostAppSource, /Default TV chat, marquee, scoring, and audience-facing screen behavior\./);
  assert.match(hostAppSource, /Automation Defaults \+ Policy/);
  assert.match(hostAppSource, /Top-chrome Room and Automation menus are for live changes during the show\./);
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

test('admin keeps preview, chat, and moderation controls in their canonical homes', () => {
  const generalSection = getAdminSection('general', 'gamepad');
  const moderationSection = getAdminSection('moderation', 'billing');
  const chatSection = getAdminSection('chat', 'live_effects');

  assert.match(generalSection, /Open Live Display Controls/);
  assert.match(generalSection, /Preview Surfaces/);
  assert.match(generalSection, /Open TV/);
  assert.doesNotMatch(generalSection, /Audience Preview On|Public TV Preview On/);
  assert.match(generalSection, /Open Main Inbox/);
  assert.match(generalSection, /Moderation Policy/);

  assert.match(moderationSection, /Policy snapshot/);
  assert.match(moderationSection, /Open chat policy/);
  assert.match(moderationSection, /Open main inbox/);
  assert.doesNotMatch(moderationSection, /TV chat enabled|TV chat fullscreen|Open full chat controls/);

  assert.match(chatSection, /Chat Policy \+ Routing/);
  assert.match(chatSection, /Open Main Inbox/);
  assert.match(chatSection, /Open Live Display Controls/);
  assert.doesNotMatch(chatSection, /<HostChatPanel/);
});

test('admin navigation keeps core config sections wired into the workspace registry', () => {
  assert.match(
    navConfigSource,
    /\{ id: 'audience', label: 'Audience'[\s\S]*defaultSection: 'audience\.roster'/,
    'The host Audience surface should keep roster as its explicit host-tab handoff',
  );
  assert.match(
    navConfigSource,
    /\{ id: 'audience\.chat', view: 'audience', label: 'Chat', legacyTab: 'chat' \}/,
    'Audience chat should exist in the workspace section registry',
  );
  assert.match(
    hostAppSource,
    /settingsTabToSection: SETTINGS_TAB_TO_SECTION/,
    'Workspace navigation should be able to resolve settings tab keys into admin sections',
  );
  assert.match(
    workspaceNavigationSource,
    /forceAdmin && directSectionMeta\.hostTab && !sectionToSettingsTab\[requested\][\s\S]*hostWorkspaceSections\.find\(\(section\) => section\.view === directSectionMeta\.view/,
    'Forced admin navigation should turn host-tab handoffs like audience.roster into settings sections',
  );
  assert.match(
    workspaceNavigationSource,
    /if \(settingsTabToSection\[requested\]\) return settingsTabToSection\[requested\];/,
    'Workspace navigation should accept settings tab keys such as chat or moderation directly',
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
  assert.match(
    hostAppSource,
    /const slimAdminRail = tab !== 'admin' && viewportWidth <= 900;/,
    'Full Admin should not collapse into the slim icon-only rail',
  );
  assert.match(
    hostAppSource,
    /!\s*inAdminWorkspace && \(\s*<button[\s\S]*data-admin-sections-toggle/s,
    'The compact sections toggle should only exist outside the full Admin workspace',
  );
  assert.match(
    hostAppSource,
    /\$\{\(inAdminWorkspace \|\| settingsNavOpen\) \? 'block' : 'hidden'\} md:block border-b md:border-b-0 md:border-r border-white\/10 bg-zinc-950 overflow-y-auto custom-scrollbar/,
    'The full Admin workspace should keep the settings rail visible instead of hiding it behind the drawer state',
  );
  assert.match(
    hostAppSource,
    /data-feature-id="admin-host-panel-mode-toggle"/,
    'Full Admin should expose a visible host panel mode toggle in the workspace header',
  );
  assert.match(
    hostAppSource,
    /data-feature-id="admin-audience-host-layout-card"[\s\S]*data-feature-id="admin-host-panel-mode-toggle"/,
    'Admin should keep the host panel mode toggle visible with the audience and host layout controls',
  );
  assert.match(
    hostAppSource,
    /Host Panel[\s\S]*Classic[\s\S]*Experimental/s,
    'Admin should let hosts switch directly between classic and experimental panel modes',
  );
  assert.match(
    hostAppSource,
    /if \(experimentalHostPanelActive\) \{\s*void toggleRuntimeShellModeQuick\(\);\s*\}/s,
    'Classic mode button should restore the classic panel when the experimental shell is active',
  );
  assert.match(
    hostAppSource,
    /if \(!experimentalHostPanelActive\) \{\s*void toggleRuntimeShellModeQuick\(\);\s*\}/s,
    'Experimental mode button should enable the experimental shell when classic mode is active',
  );
  assert.match(
    hostAppSource,
    /tab === 'admin'\s*\?\s*settingsNavigationGroups\s*:\s*settingsNavigationGroups\.filter\(\(section\) => section\.id === activeWorkspaceView\)/,
    'Full Admin should show the complete grouped settings directory instead of scoping the rail to the active workspace only',
  );
  assert.match(
    hostAppSource,
    /tab === 'admin' \? 'All Settings' : `Sections In \$\{activeWorkspaceMeta\?\.label \|\| 'Workspace'\}`/,
    'The admin rail should clearly indicate when it is showing the full settings directory',
  );
  assert.match(
    hostAppSource,
    /data-admin-section-group=\{section\.id\}/,
    'Admin settings navigation should render grouped section buckets so sections do not disappear behind view filtering',
  );
});
