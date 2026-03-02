import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { directoryActions } from "../api/directoryApi";

const isIndexError = (message = "") => /requires an index|create_composite/i.test(String(message || ""));

const toDiscoverErrorMessage = (error) => {
  const raw = String(error?.message || "Failed to load directory.");
  if (isIndexError(raw)) {
    return "Directory data is still indexing. Please retry in about a minute.";
  }
  return raw.replace(/https?:\/\/\S+/g, "").trim();
};

const DEFAULT_FACETS = Object.freeze({
  host: [],
  region: [],
  counts: { venue: 0, event: 0, room_session: 0, total: 0 },
});

const splitByListingType = (items = []) => {
  const venues = [];
  const events = [];
  const sessions = [];
  (Array.isArray(items) ? items : []).forEach((entry) => {
    const type = String(entry?.listingType || "").trim().toLowerCase();
    if (type === "event") {
      events.push(entry);
      return;
    }
    if (type === "room_session") {
      sessions.push(entry);
      return;
    }
    venues.push(entry);
  });
  return { venues, events, sessions };
};

export const useDirectoryDiscover = ({
  search = "",
  region = "",
  listingType = "all",
  timeWindow = "all",
  sortMode = "smart",
  hostUid = "",
  bounds = null,
  limit = 72,
} = {}) => {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState("");
  const [facets, setFacets] = useState(DEFAULT_FACETS);
  const [generatedAtMs, setGeneratedAtMs] = useState(0);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async ({ cursor = "", append = false } = {}) => {
    const reqId = requestIdRef.current + 1;
    requestIdRef.current = reqId;
    if (append) setLoadingMore(true);
    else setLoading(true);
    if (!append) {
      setError("");
      setNextCursor("");
    }

    try {
      const payload = await directoryActions.listDirectoryDiscover({
        search,
        region,
        listingType,
        timeWindow,
        sortMode,
        hostUid,
        bounds,
        limit,
        cursor: append ? cursor : "",
      });
      if (requestIdRef.current !== reqId) return;
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
      setTotal(Number(payload?.total || 0) || 0);
      setNextCursor(String(payload?.nextCursor || "").trim());
      setFacets(payload?.facets && typeof payload.facets === "object" ? payload.facets : DEFAULT_FACETS);
      setGeneratedAtMs(Number(payload?.generatedAtMs || 0) || 0);
      setError("");
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      if (!append) setItems([]);
      setError(toDiscoverErrorMessage(err));
    } finally {
      if (requestIdRef.current === reqId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [bounds, hostUid, limit, listingType, region, search, sortMode, timeWindow]);

  useEffect(() => {
    fetchPage({ cursor: "", append: false });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    const cursor = String(nextCursor || "").trim();
    if (!cursor || loading || loadingMore) return;
    await fetchPage({ cursor, append: true });
  }, [fetchPage, loading, loadingMore, nextCursor]);

  const refresh = useCallback(async () => {
    await fetchPage({ cursor: "", append: false });
  }, [fetchPage]);

  const grouped = useMemo(() => splitByListingType(items), [items]);

  return {
    loading,
    loadingMore,
    error,
    data: {
      ...grouped,
      combined: items,
    },
    rawData: grouped,
    items,
    total,
    facets,
    generatedAtMs,
    nextCursor,
    hasMore: !!String(nextCursor || "").trim(),
    loadMore,
    refresh,
  };
};
