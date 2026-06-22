import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('host top chrome keeps the vibe meter but drops the redundant ops strip', () => {
  assert.match(source, /data-feature-id="top-chrome-vibe-meter"/);
  assert.match(source, /<NavStatusLight[\s\S]*label="Apple"/);
  assert.match(source, /<NavStatusLight[\s\S]*label="AI"/);
  assert.match(source, /data-feature-id="top-chrome-youtube-budget"/);
  assert.match(source, /label=\{youtubeBudgetStatus\.label \|\| 'YT Search'\}/);
  assert.match(source, /<NavStatusLight[\s\S]*label=\{String\(permissionLevel \|\| 'unknown'\)\.toUpperCase\(\)\}/);
  assert.match(source, /inline-flex min-w-0 items-center gap-1\.5 rounded-lg border px-2 py-1 text-\[10px\] uppercase tracking-\[0\.14em\]/);
  assert.match(source, /<span className="text-zinc-100 hidden lg:inline">Vibe<\/span>/);
  assert.match(source, /const crowdPulseLabel = crowdPulseMeta\?\.alignmentLabel/);
  assert.match(source, /const crowdPulseDirective = crowdPulseMeta\?\.hostDirective/);
  assert.match(source, /<div className="hidden xl:flex items-center gap-2">[\s\S]*\[\s*\{ key: 'stage', label: 'Queue' \},[\s\S]*\{ key: 'lobby', label: 'Audience' \}\s*\]\.map/);
  assert.match(source, /\[\s*\{ key: 'stage', label: 'Queue' \},[\s\S]*\{ key: 'admin', label: 'Admin' \}\s*\]\.map/);
  assert.match(source, /title="Open Admin"/);
  assert.match(source, /fa-solid fa-gear text-base lg:text-lg/);
  assert.doesNotMatch(source, /OpsStatusPill/);
  assert.doesNotMatch(source, /data-feature-id="top-chrome-ops-strip"/);
  assert.doesNotMatch(source, /Ops Strip/);
  assert.match(hostAppSource, /const hostOpsStatus = useMemo/);
  assert.match(hostAppSource, /const topChromeYouTubeBudget = useMemo/);
  assert.match(hostAppSource, /todaySearchListCallsRemaining/);
  assert.match(hostAppSource, /dailySearchListCallLimit/);
  assert.match(hostAppSource, /dailyGeneralDataUnitLimit/);
  assert.match(hostAppSource, /getYouTubeQuotaBlockedUntilMs/);
  assert.match(hostAppSource, /youtubeBudgetStatus=\{topChromeYouTubeBudget\}/);
  assert.match(hostAppSource, /hostOpsStatus\?\.summary/);
});

test('host top chrome keeps room preset cards wrapped and the show-time chip compact', () => {
  assert.match(
    source,
    /min-h-\[72px\] min-w-0 items-start justify-start whitespace-normal px-3 py-2\.5 text-left normal-case tracking-\[0\.02em\]/,
    'HostTopChrome preset cards should override the one-line host button shell so long descriptions stay inside the tile',
  );
  assert.match(
    source,
    /whitespace-normal break-words/,
    'HostTopChrome preset descriptions should wrap instead of bleeding outside the button bounds',
  );
  assert.match(
    source,
    /min-w-\[136px\]' : 'min-w-\[152px\][\s\S]*gap-1\.5[\s\S]*px-2\.5 py-1/,
    'HostTopChrome show-time chip should stay more compact so it matches the surrounding nav density',
  );
  assert.match(
    source,
    /denseChrome \? 'h-9 px-2\.5 text-\[12px\]' : 'h-9 px-2\.5 text-sm'[\s\S]*inline-flex shrink-0 items-center/,
    'HostTopChrome primary nav tabs should use a consistent compact height including the active Show tab',
  );
  assert.match(
    source,
    /Stage Start[\s\S]*quickRoomControls\.autoPlayMedia !== false \? 'Auto' : 'Manual'/,
    'HostTopChrome queue controls should keep stage-start mode with live queue governance',
  );
  assert.match(
    source,
    /data-feature-id="deck-queue-menu-toggle"[\s\S]*When guests pick a new track[\s\S]*quickRoomControls\.guestTrackPolicyOptions[\s\S]*quickRoomControls\.onSetGuestTrackPolicy/,
    'HostTopChrome queue controls should expose the full guest new-track policy toggle inside the queue dropdown',
  );
  assert.match(
    hostAppSource,
    /QUICK_GUEST_TRACK_POLICY_OPTIONS = Object\.freeze\(\[[\s\S]*Send to me first[\s\S]*Let it into the queue[\s\S]*Known tracks only/,
    'HostApp should define the three guest new-track policy labels that feed the room dropdown',
  );
  assert.match(
    source,
    /Allowed search sources[\s\S]*quickRoomControls\.onSetSearchSource[\s\S]*Stage Start[\s\S]*Post-Song Track Check[\s\S]*Runtime Shell/,
    'HostTopChrome queue controls should own search sources and former room runtime controls',
  );
  assert.doesNotMatch(source, /data-feature-id="deck-room-settings-menu-toggle"/);
  assert.doesNotMatch(
    source,
    /key: 'autoPlay'[\s\S]*Auto Stage Playback[\s\S]*quickAutomationControls\.onToggleAutoPlayMedia/,
    'HostTopChrome automation controls should stop owning the stage-start toggle once it moves into the room governance menu',
  );
  assert.match(
    hostAppSource,
    /const quickRoomControls = \{[\s\S]*autoPlayMedia: !!autoPlayMedia,[\s\S]*onToggleAutoPlayMedia: toggleAutoPlayMediaQuick,/,
    'HostApp should hand the queue menu the live stage-start toggle state and handler',
  );
  assert.match(
    hostAppSource,
    /const quickRoomControls = \{[\s\S]*guestTrackPolicy: deriveQuickGuestTrackPolicy\({[\s\S]*guestTrackPolicyOptions: QUICK_GUEST_TRACK_POLICY_OPTIONS,[\s\S]*onSetGuestTrackPolicy: setGuestTrackPolicyQuick,/,
    'HostApp should hand the queue menu the derived guest-track policy state and quick setter',
  );
  assert.match(
    source,
    /const queueAttentionBadgeClass = normalizedQueueAttentionNeedsHost[\s\S]*border-pink-100\/70[\s\S]*rgba\(236,72,153,0\.96\)[\s\S]*border-pink-300\/35[\s\S]*text-pink-50/,
    'HostTopChrome queue attention badge should use the branded pink badge treatment for both hot and soft states',
  );
});
