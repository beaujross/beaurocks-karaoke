import { useEffect, useMemo, useState } from "react";
import { subscribeApprovedListings } from "../api/directoryApi";

const normalizeSearch = (value = "") => String(value || "").trim().toLowerCase();
const isIndexError = (message = "") => /requires an index|create_composite/i.test(String(message || ""));

const toDiscoverErrorMessage = (error) => {
  const raw = String(error?.message || "Failed to load directory.");
  if (isIndexError(raw)) {
    return "Directory data is still indexing. Please retry in about a minute.";
  }
  return raw.replace(/https?:\/\/\S+/g, "").trim();
};

export const useDirectoryDiscover = ({ search = "", region = "" } = {}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    venues: [],
    events: [],
    sessions: [],
  });

  useEffect(() => {
    const stop = subscribeApprovedListings({
      onData: (next) => {
        setData(next);
        setError("");
        setLoading(false);
      },
      onError: (err) => {
        setError(toDiscoverErrorMessage(err));
        setLoading(false);
      },
    });
    return () => stop();
  }, []);

  const searchToken = normalizeSearch(search);
  const regionToken = normalizeSearch(region);

  const filtered = useMemo(() => {
    const applyFilters = (items) =>
      items.filter((item) => {
        const text = normalizeSearch([
          item.title,
          item.venueName,
          item.hostName,
          item.city,
          item.state,
          item.description,
        ].filter(Boolean).join(" "));
        const itemRegion = normalizeSearch(item.region || "");
        const searchOk = !searchToken || text.includes(searchToken);
        const regionOk = !regionToken || itemRegion.includes(regionToken);
        return searchOk && regionOk;
      });

    const venues = applyFilters(data.venues);
    const events = applyFilters(data.events);
    const sessions = applyFilters(data.sessions);
    return {
      venues,
      events,
      sessions,
      combined: [...events, ...sessions, ...venues],
    };
  }, [data, searchToken, regionToken]);

  return {
    loading,
    error,
    data: filtered,
    rawData: data,
  };
};
