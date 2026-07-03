import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const registrySource = readFileSync('src/lib/gameRegistry.js', 'utf8');
const launcherSource = readFileSync('src/components/UnifiedGameLauncher.jsx', 'utf8');
const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('Volley Orb is exposed on the Games tab and launches the lobby voice mode', () => {
    assert.match(registrySource, /id: 'volley_orb'[\s\S]*name: 'Volley Orb'[\s\S]*category: 'voice'/);
    assert.match(launcherSource, /const startVolleyOrb = async \(\) => \{[\s\S]*hostVoiceMicControl\?\.onArm\?\.\(\)[\s\S]*lightMode: 'volley'[\s\S]*lobbyVolleyEnabled: true/);
    assert.match(launcherSource, /if \(gameId === 'volley_orb'\) return startVolleyOrb\(\)/);
    assert.match(launcherSource, /selectedGame === 'volley_orb'/);
    assert.match(launcherSource, /String\(room\?\.lightMode \|\| ''\)[\s\S]*=== 'volley' \? 'Volley Orb'/);
});

test('Host Audience tab exposes lobby actions and structured spotlight controls', () => {
    assert.match(hostSource, /AUDIENCE_SPOTLIGHT_MODES/);
    assert.match(hostSource, /\['users', 'tv', 'actions', 'history', 'vip', 'tips', 'activity'\]/);
    assert.match(hostSource, /const \[lobbyActionSearch, setLobbyActionSearch\] = useState\(''\)/);
    assert.match(hostSource, /const lobbyActionUsers = useMemo/);
    assert.match(hostSource, /const toggleAudienceSpotlightForUser = async/);
    assert.match(hostSource, /kind: SPOTLIGHT_KINDS\.audience, mode/);
    assert.match(hostSource, /mainstage: options\?\.mainstage === true/);
    assert.match(hostSource, /Spotlight On Stage/);
    assert.match(hostSource, /Stage Cheer/);
    assert.match(hostSource, /Tap a person to lock selection, or use the visible card actions directly\./);
    assert.doesNotMatch(hostSource, /opacity-0 group-hover:opacity-100/);
    assert.match(hostSource, /data-feature-id="host-lobby-actions-panel"/);
    assert.match(hostSource, /Tips \+ Boosts Settings/);
    assert.match(hostSource, /Selected Guest/);
    assert.match(hostSource, /lobbyActionGiftPreviewPoints/);
    assert.match(hostSource, /supportDropReady/);
    assert.match(hostSource, /Spotlight Moment/);
    assert.match(hostSource, /spotlightDurationSec/);
    assert.match(hostSource, /replayAudienceSpotlight/);
    assert.match(hostSource, /pushAudienceSpotlightToMainstage/);
    assert.match(hostSource, /clearAudienceSpotlightMainstage/);
    assert.match(hostSource, /Mainstage/);
    assert.match(hostSource, /mainstage: \{[\s\S]*active: true[\s\S]*expiresAtMs: now \+ durationMs/);
    assert.match(hostSource, /mainstage: null/);
    assert.match(hostSource, /expiresAtMs: createdAtMs \+ spotlightDurationMs/);
    assert.match(hostSource, /autoClear: options\?\.autoClear !== false/);
    assert.match(hostSource, /promptUpdatedAtMs/);
    assert.match(hostSource, /Points \+ Tight 15/);
    assert.match(hostSource, /targetUidOverride/);
    assert.doesNotMatch(hostSource, /sendUserMessage\(selectedLobbyUserUid, selectedLobbyUserIsSpotlight \? null : 'SPOTLIGHT'\)/);
    assert.doesNotMatch(hostSource, /sendUserMessage\(userUid, isSpotlight \? null : 'SPOTLIGHT'\)/);
});

test('Host Games tab keeps active game moderation scrollable and collapses launcher chrome', () => {
    assert.match(hostSource, /data-host-active-game-controlpad/);
    assert.match(hostSource, /max-h-\[calc\(100dvh-8rem\)\]/);
    assert.match(hostSource, /custom-scrollbar flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-4/);
    assert.match(hostSource, /data-host-game-submission-scroll="doodle" className="grid max-h-\[min\(58dvh,34rem\)\] min-h-\[12rem\]/);
    assert.match(hostSource, /data-host-game-submission-scroll="selfie" className="grid max-h-\[min\(58dvh,34rem\)\] min-h-\[12rem\]/);
    assert.match(hostSource, /const \[liveGameLauncherDrawerOpen, setLiveGameLauncherDrawerOpen\] = useState\(false\)/);
    assert.match(hostSource, /hostHasLiveGameModeForDrawer && !liveGameLauncherDrawerOpen \? 'hidden'/);
    assert.match(hostSource, /data-host-game-launcher-drawer="summary"/);
    assert.match(hostSource, /Open Launcher Drawer/);
});
