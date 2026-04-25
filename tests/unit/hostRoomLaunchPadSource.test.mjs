import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const launchPadBrowserPath = 'src/apps/Host/components/HostRoomLaunchPadBrowser.jsx';
const joinPosterModalPath = 'src/apps/Host/components/RoomJoinPosterModal.jsx';

test('AAHF launch flow defaults the requested room code and exposes join poster actions', () => {
  const source = readFileSync(launchPadBrowserPath, 'utf8');

  assert.match(
    source,
    /if \(resolvedLaunchPresetId !== 'aahf'\) return;\s*if \(String\(launchRequestedRoomCode \|\| ''\)\.trim\(\)\) return;\s*setLaunchRequestedRoomCode\('AAHF'\);/s,
    'AAHF preset should prefill the stable AAHF room code when the field is empty',
  );
  assert.match(
    source,
    /placeholder=\{resolvedLaunchPresetId === 'aahf' \? 'AAHF' : 'Optional'\}/,
    'Requested room code input should hint AAHF when the festival preset is selected',
  );
  assert.match(
    source,
    /AAHF rooms default to room code AAHF so posters and QR signage stay stable\./,
    'Launch flow should explain why the AAHF room code is prefilled',
  );
  assert.match(
    source,
    />\s*Join Poster\s*</,
    'Room manager should expose a direct join poster action for the selected room',
  );
  assert.match(
    source,
    /<RoomJoinPosterModal[\s\S]*audienceUrl=\{activeJoinPosterRoom\.audienceUrl\}/,
    'Room manager should render the branded join poster modal with the resolved audience URL',
  );
});

test('join poster modal stays brand-forward and print-ready', () => {
  const source = readFileSync(joinPosterModalPath, 'utf8');

  assert.match(source, /QRCode\.toDataURL/);
  assert.match(source, /window\.open\('', '_blank'/);
  assert.match(source, /window\.print\(\)/);
  assert.match(source, /Check in at the front door\./);
  assert.match(source, /Scan the QR code with your phone\./);
  assert.match(source, /Pick your emoji and join the room\./);
  assert.match(source, /Request songs and watch the queue live\./);
  assert.match(source, /Copy URL/);
  assert.match(source, /Print Poster/);
});
