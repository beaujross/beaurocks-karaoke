export const buildHostFacetOptions = ({
  facets = null,
  listings = [],
  limit = 16,
} = {}) => {
  const normalizedLimit = Math.max(0, Number(limit || 0));
  const fromServer = Array.isArray(facets?.host) ? facets.host : [];
  if (fromServer.length) {
    return fromServer
      .map((entry) => ({
        id: String(entry?.hostUid || "").trim(),
        hostUid: String(entry?.hostUid || "").trim(),
        hostName: String(entry?.hostName || "").trim() || "Host",
        count: Number(entry?.count || 0) || 0,
      }))
      .filter((entry) => !!entry.id)
      .slice(0, normalizedLimit);
  }

  const byHost = new Map();
  (Array.isArray(listings) ? listings : []).forEach((entry) => {
    const hostUid = String(entry?.hostUid || "").trim();
    if (!hostUid) return;
    const existing = byHost.get(hostUid) || {
      id: hostUid,
      hostUid,
      hostName: String(entry?.hostName || "").trim() || "Host",
      count: 0,
    };
    existing.count += 1;
    byHost.set(hostUid, existing);
  });

  return Array.from(byHost.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, normalizedLimit);
};

export const resolveEffectiveHostFilter = ({
  hostFilter = "all",
  hostFacetOptions = [],
} = {}) => {
  if (hostFilter === "all") return "all";
  return (Array.isArray(hostFacetOptions) ? hostFacetOptions : []).some((entry) => entry?.id === hostFilter)
    ? hostFilter
    : "all";
};

export const countEventCadenceListings = (listings = []) => {
  const counts = { total: 0, recurring: 0, one_time: 0 };
  (Array.isArray(listings) ? listings : []).forEach((entry) => {
    if (entry?.listingType !== "event") return;
    counts.total += 1;
    if (entry?.isRecurringEvent) counts.recurring += 1;
    else counts.one_time += 1;
  });
  return counts;
};

export const countListingTypes = ({
  listings = [],
  includeElevated = false,
} = {}) => {
  const counts = includeElevated
    ? { venue: 0, event: 0, room_session: 0, elevated: 0 }
    : { venue: 0, event: 0, room_session: 0 };

  (Array.isArray(listings) ? listings : []).forEach((entry) => {
    if (entry?.listingType === "event") counts.event += 1;
    else if (entry?.listingType === "room_session") counts.room_session += 1;
    else counts.venue += 1;

    if (includeElevated && entry?.isBeauRocksElevated) {
      counts.elevated += 1;
    }
  });

  return counts;
};
