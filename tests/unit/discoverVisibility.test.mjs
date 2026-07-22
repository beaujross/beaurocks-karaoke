import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const { shouldIncludeDiscoverListing } = require('../../functions/lib/discoverVisibility.js');

test('discover visibility includes opted-in host rooms and excludes every explicitly private listing type', () => {
  assert.equal(shouldIncludeDiscoverListing({
    item: {
      id: 'host-room-1',
      listingType: 'room_session',
      visibility: 'public',
      sourceType: 'host_room',
      isOfficialBeauRocksListing: false,
    },
  }), true);

  assert.equal(shouldIncludeDiscoverListing({
    item: {
      id: 'aahf-room',
      listingType: 'room_session',
      visibility: 'public',
      sourceType: 'host_room',
      isOfficialBeauRocksListing: true,
    },
    listingTypeFilter: 'event',
  }), true);

  assert.equal(shouldIncludeDiscoverListing({
    item: {
      id: 'kitsap-venue',
      listingType: 'venue',
      visibility: 'private',
    },
  }), false);

  assert.equal(shouldIncludeDiscoverListing({
    item: {
      id: 'kitsap-event',
      listingType: 'event',
      visibility: 'public',
      sourceType: 'directory_seed',
    },
  }), true);
});

test('discover visibility respects host, official, and ancillary match filters', () => {
  const baseItem = {
    id: 'event-1',
    listingType: 'event',
    visibility: 'public',
    hostUid: 'host-1',
    isOfficialBeauRocksListing: true,
  };

  assert.equal(shouldIncludeDiscoverListing({
    item: baseItem,
    hostUidFilter: 'host-2',
  }), false);

  assert.equal(shouldIncludeDiscoverListing({
    item: baseItem,
    officialRoomOnly: true,
    matchesSearch: true,
    matchesTimeWindow: true,
    inBounds: true,
  }), true);

  assert.equal(shouldIncludeDiscoverListing({
    item: baseItem,
    matchesSearch: false,
  }), false);
});

test('discover visibility rejects unapproved and cancelled occurrences defensively', () => {
  assert.equal(shouldIncludeDiscoverListing({
    item: {
      listingType: 'event',
      visibility: 'public',
      status: 'pending',
    },
  }), false);
  assert.equal(shouldIncludeDiscoverListing({
    item: {
      listingType: 'event',
      visibility: 'public',
      status: 'approved',
      occurrenceStatus: 'cancelled',
    },
  }), false);
});
