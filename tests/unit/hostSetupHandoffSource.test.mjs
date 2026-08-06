import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const launchPadSource = readFileSync('src/apps/Host/components/HostRoomLaunchPad.jsx', 'utf8');
const browserSource = readFileSync('src/apps/Host/components/HostRoomLaunchPadBrowser.jsx', 'utf8');
const readySource = readFileSync('src/apps/Host/components/ComplimentaryHostSetupReady.jsx', 'utf8');

test('complimentary Host setup hands off to the existing Room Setup workspace', () => {
  assert.match(hostAppSource, /const \[roomSetupHandoffToken, setRoomSetupHandoffToken\] = useState\(0\);/);
  assert.match(hostAppSource, /const finishComplimentaryHostSetup = useCallback\(\(\) => \{[\s\S]*closeOnboardingWizard\(\{ completed: true \}\);[\s\S]*setRoomSetupHandoffToken\(\(current\) => current \+ 1\);/);
  assert.match(hostAppSource, /onFinish=\{finishComplimentaryHostSetup\}/);
  assert.match(hostAppSource, /roomSetupHandoffToken=\{roomSetupHandoffToken\}/);
  assert.match(launchPadSource, /roomSetupHandoffToken=\{roomSetupHandoffToken\}/);
  assert.match(browserSource, /if \(!roomSetupHandoffToken\) return undefined;[\s\S]*setRoomSetupMode\('create'\);/);
  assert.match(browserSource, /id="launchpad-create-room"[\s\S]*ref=\{createRoomSectionRef\}/);
  assert.match(browserSource, /createRoomSectionRef\.current\?\.scrollIntoView\(\{ block: 'start', behavior: 'smooth' \}\);/);
  assert.match(browserSource, /querySelector\('\[data-launch-room-identity\] input'\)[\s\S]*\.focus\(\);/);
  assert.match(readySource, /Continue to Room Setup/);
});

test('Room Setup handoff records one focused onboarding transition event', () => {
  assert.match(
    hostAppSource,
    /trackEvent\('host_onboarding_room_setup_handoff', \{[\s\S]*source: 'host_profile_complete'[\s\S]*onboarding_stage: 'workspace_ready'[\s\S]*destination: 'room_setup'/,
  );
});

test('handoff reuses the canonical Room creation form instead of introducing another implementation', () => {
  assert.match(browserSource, /data-launch-core-setup="true"/);
  assert.match(browserSource, /data-launch-room-identity="true"/);
  assert.match(browserSource, /data-host-create-room-primary="true"/);
  assert.doesNotMatch(readySource, /<input|<select|<textarea/);
});
