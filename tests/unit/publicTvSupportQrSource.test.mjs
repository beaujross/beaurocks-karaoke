import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('PublicTV reuses the existing tip overlay and pulse for fundraiser support fallback', () => {
  assert.match(
    source,
    /const getRoomSupportSurface = \(room = \{\}\) => \(\{/,
    'PublicTV should normalize room-level support label and URL through a small helper',
  );
  assert.match(
    source,
    /const qrValue = String\(room\?\.tipUrl \|\| supportSurface\.url \|\| ''\)\.trim\(\);/,
    'Support fallback should reuse the overlay QR flow when the host has no dedicated tip URL',
  );
  assert.match(
    source,
    /const overlayHeadline = usesSupportFallback \? \(supportSurface\.label \|\| 'Support the Room'\) : 'Show Some Love!';/,
    'Support fallback should keep the overlay copy contextual instead of pretending it is always a tip prompt',
  );
  assert.match(
    source,
    /Scan to support the fundraiser/,
    'Overlay copy should explain the fundraiser fallback clearly',
  );
  assert.match(
    source,
    /if \(!room\?\.tipUrl && !room\?\.tipQrUrl && !getRoomSupportSurface\(room\)\.url\) return;/,
    'Tip pulse trigger should still work when a room only has fundraiser support configured',
  );
  assert.match(
    source,
    /showAmbientFx && tipPulse && \(room\?\.tipUrl \|\| room\?\.tipQrUrl \|\| getRoomSupportSurface\(room\)\.url\)/,
    'The small pulse badge should render for fundraiser-only rooms as well',
  );
  assert.match(
    source,
    /room\?\.tipUrl \|\| room\?\.tipQrUrl \? 'Show some love' : \(getRoomSupportSurface\(room\)\.label \|\| 'Support the room'\)/,
    'Pulse badge headline should reuse the support label when there is no tip surface',
  );
  assert.match(
    source,
    /room\?\.tipUrl \|\| room\?\.tipQrUrl \? `Tip the host \$\{EMOJI\.tip\}` : 'Scan to support the fundraiser'/,
    'Pulse badge body should switch to fundraiser guidance when using the support fallback',
  );
});
