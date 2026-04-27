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
  if (item.listingType !== 'venue' && String(item.visibility || 'public') !== 'public') return false;
  const sourceType = String(item.sourceType || '').trim().toLowerCase();
  const isHostRoomSession = item.listingType === 'room_session' && sourceType === 'host_room';
  if (isHostRoomSession && !item.isOfficialBeauRocksListing) return false;
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
