export const buildOfficialListingSummary = ({
  listings = [],
  nowMs = 0,
  liveLookbackMs = 0,
  sortListings = (left, right) => String(left?.title || "").localeCompare(String(right?.title || "")),
  limit = 3,
} = {}) => {
  let officialBeauRocksListingCount = 0;
  let officialBeauRocksRoomCount = 0;
  let beauRocksElevatedCount = 0;
  const officialUpcomingCandidates = [];

  const nowFloor = Number(nowMs || 0) - Number(liveLookbackMs || 0);

  (Array.isArray(listings) ? listings : []).forEach((entry) => {
    if (entry?.isOfficialBeauRocksListing) {
      officialBeauRocksListingCount += 1;

      const startsAtMs = Number(entry?.startsAtMs || 0);
      if (startsAtMs <= 0 || startsAtMs >= nowFloor) {
        officialUpcomingCandidates.push(entry);
      }
    }

    if (entry?.isOfficialBeauRocksRoom) {
      officialBeauRocksRoomCount += 1;
    }

    if (entry?.isBeauRocksElevated) {
      beauRocksElevatedCount += 1;
    }
  });

  officialUpcomingCandidates.sort(sortListings);

  return {
    officialBeauRocksListingCount,
    officialBeauRocksRoomCount,
    beauRocksElevatedCount,
    officialUpcomingListings: officialUpcomingCandidates.slice(0, Math.max(0, Number(limit || 0))),
  };
};
