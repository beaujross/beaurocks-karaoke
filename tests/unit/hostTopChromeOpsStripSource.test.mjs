import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('host top chrome keeps the vibe meter but drops the redundant ops strip', () => {
  assert.match(source, /data-feature-id="top-chrome-system-status"/);
  assert.match(source, /const topStatusItems = \[/);
  assert.match(source, /Apple Music[\s\S]*AI Tools[\s\S]*YouTube Search[\s\S]*Host Session[\s\S]*Vibe/);
  assert.match(source, /System Status/);
  assert.match(source, /topStatusIssueCount/);
  assert.match(source, /topStatusAllGreen/);
  assert.match(source, /Open Media Setup to connect Apple Music/);
  assert.match(source, /actionLabel: 'Audience'/);
  assert.doesNotMatch(source, /<NavStatusLight[\s\S]*label="Apple"/);
  assert.doesNotMatch(source, /data-feature-id="top-chrome-youtube-budget"/);
  assert.match(source, /const crowdPulseLabel = crowdPulseMeta\?\.alignmentLabel/);
  assert.match(source, /const crowdPulseSummary = crowdPulseMeta\?\.alignmentSummary/);
  assert.match(source, /<div className="hidden xl:flex items-center gap-2">[\s\S]*\[\s*\{ key: 'stage', label: 'Queue' \},[\s\S]*\{ key: 'lobby', label: 'Audience' \}\s*\]\.map/);
  assert.match(source, /\[\s*\{ key: 'stage', label: 'Queue', description: 'Run singers and song order', icon: 'fa-list-ol' \},[\s\S]*\{ key: 'admin', label: 'Admin', description: 'Room setup and controls', icon: 'fa-sliders' \}\s*\]\.map/);
  assert.match(source, /title="Open Admin"/);
  assert.match(source, /fa-solid fa-gear text-base lg:text-lg/);
  assert.doesNotMatch(source, /OpsStatusPill/);
  assert.doesNotMatch(source, /data-feature-id="top-chrome-ops-strip"/);
  assert.doesNotMatch(source, /Ops Strip/);
  assert.match(hostAppSource, /const hostOpsStatus = useMemo/);
  assert.match(hostAppSource, /const topChromeYouTubeBudget = useMemo/);
  assert.match(hostAppSource, /freshSearchesLeft/);
  assert.match(hostAppSource, /todayLiveCalls/);
  assert.match(hostAppSource, /dailyQuotaUnits/);
  assert.match(hostAppSource, /getYouTubeQuotaBlockedUntilMs/);
  assert.match(hostAppSource, /refreshYouTubeProviderQuotaStatus/);
  assert.match(hostAppSource, /This-device estimate only/);
  assert.match(hostAppSource, /shared provider paused/);
  assert.match(hostAppSource, /value: quotaPaused \? 0 : freshSearchesLeft/);
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
    /data-feature-id="deck-queue-stage-start-toggle"[\s\S]*Stage Start[\s\S]*quickRoomControls\.autoPlayMedia !== false \? 'Auto' : 'Manual'/,
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

test('host flow dropdown exposes One-Minute Mic live pacing controls', () => {
  assert.match(source, /data-feature-id="deck-automation-menu-toggle"[\s\S]*text-\[12px\] font-black leading-none text-zinc-100[\s\S]*Auto \{automationActiveCount\}/);
  assert.match(source, /data-feature-id="deck-automation-menu-toggle"[\s\S]*aria-expanded=\{showAutomationQuickMenu\}/);
  assert.match(source, /data-feature-id="deck-automation-menu"[\s\S]*data-feature-id=\{`deck-automation-\$\{item\.key\}`\}/);
  assert.match(source, /data-feature-id="deck-automation-menu-toggle"[\s\S]*Flow & Automation[\s\S]*data-host-one-minute-mic-controls/);
  assert.doesNotMatch(source, /data-feature-id="deck-queue-menu-toggle"[\s\S]*data-host-one-minute-mic-controls/);
  assert.match(source, /Song length[\s\S]*One-Minute Mic[\s\S]*Full Songs/);
  assert.match(source, /ONE_MINUTE_MIC_OPENING_PRESETS = Object\.freeze\(\[45, 60, 90\]\)/);
  assert.match(source, /ONE_MINUTE_MIC_VOTE_WINDOW_PRESETS = Object\.freeze\(\[8, 12, 15, 20\]\)/);
  assert.match(source, /quickRoomControls\.onSetOneMinuteMic\?\.\(true\)/);
  assert.match(source, /quickRoomControls\.onSetOneMinuteMicTiming\?\.\(\{ openingWindowSec: event\.target\.value \}\)/);
  assert.match(source, /data-host-one-minute-mic-live-status/);
  assert.match(source, /Live crowd status/);
  assert.match(source, /oneMinuteMicStatusToneClass/);
  assert.match(source, /oneMinuteMicLiveStatus\.subject/);
  assert.match(hostAppSource, /const setOneMinuteMicQuick = async \(enabled = false\) => \{/);
  assert.match(hostAppSource, /performanceProgressionMode: nextEnabled \? 'one_minute_mic' : 'full_song'/);
  assert.match(hostAppSource, /String\(room\?\.audienceDecision\?\.type \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'continue_or_rotate'[\s\S]*roomPatch\.audienceDecision = null/);
  assert.match(hostAppSource, /oneMinuteMicEnabledQuick = room\?\.oneMinuteMicEnabled === true \|\| String\(room\?\.performanceProgressionMode \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'one_minute_mic'/);
  assert.match(hostAppSource, /const oneMinuteMicLiveStatus = \(\(\) => \{/);
  assert.match(hostAppSource, /Crowd rescue vote is live/);
  assert.match(hostAppSource, /One-Minute Mic vote is live/);
  assert.match(hostAppSource, /Tie — singer stays/);
  assert.match(hostAppSource, /The backing track is fading before applause starts/);
  assert.match(hostAppSource, /Rotation won, but the transition has not started/);
  assert.match(hostAppSource, /oneMinuteMicLiveStatus,/);
  assert.match(hostAppSource, /onSetOneMinuteMic: setOneMinuteMicQuick/);
  assert.match(hostAppSource, /onSetOneMinuteMicTiming: setOneMinuteMicTimingQuick/);
});

test('top-level host navigation dismisses transient menus before changing workspaces', () => {
  assert.match(source, /data-host-tab=\{t\.key\}[\s\S]*onClick=\{\(\) => \{[\s\S]*closeAllTopMenus\(\);[\s\S]*setTab\(t\.key\)/);
  assert.match(source, /data-host-tab="admin"[\s\S]*onClick=\{\(\) => \{[\s\S]*closeAllTopMenus\(\);[\s\S]*openAdminWorkspace\('ops\.room_setup'\)/);
});

test('host flow dropdown exposes room control model choices above detailed pacing controls', () => {
  assert.match(source, /ROOM_CONTROL_MODEL_OPTIONS = Object\.freeze\(\[[\s\S]*Host-Led[\s\S]*Assisted Host[\s\S]*Crowd-Driven/);
  assert.match(source, /data-feature-id="deck-automation-menu-toggle"[\s\S]*data-host-room-control-model/);
  assert.doesNotMatch(source, /data-feature-id="deck-queue-menu-toggle"[\s\S]*data-host-room-control-model/);
  assert.match(source, /Room control model[\s\S]*host-driven, host-assisted, or crowd-driven/);
  assert.match(source, /Tonight's effective controls/);
  assert.match(source, /Start the next singer automatically/);
  assert.match(source, /Start backing media automatically/);
  assert.match(source, /Fill breaks with audience activities/);
  assert.match(source, /Let the crowd extend or rotate singers/);
  assert.match(source, /Direct changes here override any preset or starting point/);
  assert.match(source, /activeRoomControlModel = quickRoomControls\?\.oneMinuteMicEnabled[\s\S]*'crowd_driven'[\s\S]*quickAutomationControls\?\.autoDj[\s\S]*'assisted_host'[\s\S]*'host_led'/);
  assert.match(source, /quickRoomControls\.onApplyRoomControlModel\?\.\(option\.id\)/);
  assert.match(hostAppSource, /const applyRoomControlModelQuick = async \(modelId = 'host_led'\) => \{/);
  assert.match(hostAppSource, /autoDj: nextAutoDj[\s\S]*oneMinuteMicEnabled: nextOneMinuteMic[\s\S]*performanceProgressionMode: nextOneMinuteMic \? 'one_minute_mic' : 'full_song'/);
  assert.match(hostAppSource, /!nextOneMinuteMic && \['continue_or_rotate', 'skip_performance'\]\.includes\(activeAudienceDecisionType\)[\s\S]*roomPatch\.audienceDecision = null/);
  assert.match(hostAppSource, /onApplyRoomControlModel: applyRoomControlModelQuick/);
});
