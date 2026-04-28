import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('PublicTV promotes Givebutter support URLs ahead of legacy personal tip links when fundraiser support is configured', () => {
  assert.match(
    source,
    /const getRoomSupportSurface = \(room = \{\}\) => \(\{/,
    'PublicTV should normalize room-level support label and URL through a small helper',
  );
  assert.match(
    source,
    /buildGivebutterSupportLaunchUrl\(baseUrl\)/,
    'Givebutter support surfaces should be normalized to a donate-ready URL before QR generation',
  );
  assert.match(
    source,
    /const getTipOverlaySurface = \(room = \{\}\) => \{/,
    'PublicTV should route QR selection through one helper so fundraiser support can override stale personal tip links',
  );
  assert.match(
    source,
    /headline: supportSurface\.label \|\| 'Support the fundraiser'/,
    'Fundraiser support should keep the overlay headline contextual',
  );
  assert.match(
    source,
    /subhead: 'Scan to donate to the cause'/,
    'Fundraiser support should use generic donation copy instead of personal tip copy',
  );
  assert.match(
    source,
    /if \(!tipSurface\.qrValue && !tipSurface\.qrImageUrl\) return;/,
    'Tip pulse trigger should still work when a room only has fundraiser support configured',
  );
  assert.match(
    source,
    /getTipOverlaySurface\(room\)\.usesFundraiserSupport \? \(getRoomSupportSurface\(room\)\.label \|\| 'Support the room'\) : 'Show some love'/,
    'Pulse badge headline should reuse the support label when fundraiser support is active',
  );
  assert.match(
    source,
    /getTipOverlaySurface\(room\)\.usesFundraiserSupport \? 'Scan to donate to the cause' : `Tip the host \$\{EMOJI\.tip\}`/,
    'Pulse badge body should switch to donation guidance when using fundraiser support',
  );
});

test('PublicTV exposes a standalone leaderboard stack overlay state', () => {
  assert.match(source, /const LeaderboardStackOverlay = \(\{ users, songs, premiumBadgeLabel = 'VIP' \}\) => \{/);
  assert.match(source, /LEADERBOARD STACK/);
  assert.match(source, /room\?\.activeScreen === 'leaderboard_stack'/);
  assert.match(source, /leaderboard_stack: 'Leaderboard Stack'/);
});

test('PublicTV extends the post-performance flow with a branded next-up beat', () => {
  assert.match(source, /const PerformanceNextUpOverlay = \(\{/);
  assert.match(source, /Next Up On Stage/);
  assert.match(source, /performanceRecapNextUpMs/);
  assert.match(source, /<PerformanceNextUpOverlay/);
  assert.match(source, /brandTheme=\{tvAudienceBrandTheme\}/);
  assert.match(source, /logoUrl=\{room\?\.logoUrl \|\| ASSETS\.logo\}/);
});
