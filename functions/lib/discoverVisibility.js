'use strict';

const shouldIncludeDiscoverListing = ({
  item = {},
  listingTypeFilter = 'all',
  hostUidFilter = '',
  officialRoomOnly = false,
  matchesSearch = true,
  matchesTimeWindow = true,
  inBounds = true,
} = {}) => {
  if (String(item.visibility || 'public') !== 'public') return false;
  const status = String(item.status || 'approved').trim().toLowerCase();
  if (status !== 'approved') return false;
  const occurrenceStatus = String(item.occurrenceStatus || '').trim().toLowerCase();
  if (['cancelled', 'canceled', 'removed'].includes(occurrenceStatus)) return false;
  if (
    listingTypeFilter !== 'all'
    && item.listingType !== listingTypeFilter
    && !(listingTypeFilter === 'event' && item.isOfficialBeauRocksListing && item.listingType === 'room_session')
  ) return false;
  if (hostUidFilter && String(item.hostUid || '') !== hostUidFilter) return false;
  if (officialRoomOnly && !item.isOfficialBeauRocksListing) return false;
  if (!matchesSearch) return false;
  if (!matchesTimeWindow) return false;
  if (!inBounds) return false;
  return true;
};

module.exports = {
  shouldIncludeDiscoverListing,
};
