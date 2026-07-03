import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');

test('audience points sheet keeps a top close action for high zoom mobile users', () => {
  assert.match(
    source,
    /aria-label="Close points sheet"/,
    'Points sheet should expose a close control in the sticky header, not only after scrollable content',
  );
  assert.match(
    source,
    /sticky top-0 z-20[\s\S]*Fuel the show[\s\S]*Close points sheet/,
    'Close action should live in the sticky points-sheet header',
  );
});

test('base audience points sheet uses room-configured point mechanics instead of festival copy', () => {
  assert.match(
    source,
    /const supportProviderLabel = activeEventCredits\.supportProvider === 'givebutter'/,
    'Support copy should derive from room support provider settings',
  );
  assert.match(
    source,
    /const supportTargetLabel = roomSupportOffer\?\.label/,
    'Support merchandising should use the room support label configured by the host',
  );
  assert.match(
    source,
    /Free ways to earn/,
    'Bonus area should be generic enough for normal rooms and event rooms',
  );
  assert.match(
    source,
    /No bonus promos are posted yet/,
    'Empty promo state should not imply every room is a festival room',
  );
  assert.doesNotMatch(
    source,
    /festival list below|No festival quests are posted yet|Support the Festival<\/div>|Givebutter Donation Form|Donate with Givebutter/,
    'Base points sheet should not hard-code AAHF/festival or Givebutter-only merchandising copy',
  );
});
test('audience points sheet merchandises room boosts and personal packs like a mobile game shop', () => {
  assert.match(
    source,
    /data-feature-id="audience-points-storefront"/,
    'Points sheet should expose a dedicated storefront surface',
  );
  assert.match(
    source,
    /data-feature-id="audience-room-boost-storefront"[\s\S]*Buy points for everyone[\s\S]*Trigger a TV burst and refill the room/,
    'Room-wide point purchases should be promoted as the social hero purchase',
  );
  assert.match(
    source,
    /data-feature-id="audience-personal-pack-storefront"[\s\S]*Grab more points[\s\S]*Personal packs refill reactions/,
    'Personal point packs should remain available but be clearly separate from room boosts',
  );
  assert.match(
    source,
    />TV<|>TV<[^\n]*[\s\S]*MONEYBAGS_BADGE_LABEL/,
    'Room boost cards should show the public-TV supporter badge payoff',
  );
});

test('audience points sheet prevents duplicate checkout launches and shows opening state', () => {
  assert.match(
    source,
    /const \[pointsCheckoutPendingKey, setPointsCheckoutPendingKey\] = useState\(''\)/,
    'Points checkout should track a pending offer so repeated taps cannot create multiple sessions',
  );
  assert.match(
    source,
    /if \(pointsCheckoutPendingKey\) return;/,
    'Checkout handlers should no-op while another checkout is opening',
  );
  assert.match(
    source,
    /Opening/,
    'Offer buttons should visibly show when checkout is opening',
  );
});


test('audience points sheet caps visible SKUs and uses package visuals', () => {
  assert.match(
    source,
    /POINTS_STOREFRONT_ROOM_OFFER_LIMIT = 2/,
    'Room-wide boosts should be capped so the mobile sheet stays short',
  );
  assert.match(
    source,
    /POINTS_STOREFRONT_PERSONAL_OFFER_LIMIT = 3/,
    'Personal packs should be capped to a small mobile game purchase ladder',
  );
  assert.match(
    source,
    /getPointOfferPackageVisual[\s\S]*fa-box-open[\s\S]*fa-coins/,
    'Storefront offers should render as point bundles, stacks, vaults, or crates instead of plain text rows',
  );
  assert.match(
    source,
    /visibleRoomShopOffers\.map[\s\S]*data-feature-id="audience-room-boost-card"/,
    'Room boost cards should render from the capped visible offer list',
  );
  assert.match(
    source,
    /visiblePersonalShopOffers\.map[\s\S]*data-feature-id="audience-personal-pack-card"/,
    'Personal pack cards should render from the capped visible offer list',
  );
});