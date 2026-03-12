import { buildMarketingPath } from "../routing";

export const normalizeListingType = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === "event") return "event";
  if (token === "room_session") return "room_session";
  return "venue";
};

export const normalizeSelectedListingTypes = (values = [], allowedTypes = []) => {
  const normalizedAllowedTypes = Array.isArray(allowedTypes) ? allowedTypes : [];
  const tokens = Array.isArray(values) ? values : [values];
  const allowed = new Set(normalizedAllowedTypes);
  const selected = [];
  tokens.forEach((value) => {
    const token = normalizeListingType(value);
    if (!allowed.has(token) || selected.includes(token)) return;
    selected.push(token);
  });
  if (!selected.length) return [...normalizedAllowedTypes];
  return normalizedAllowedTypes.filter((token) => selected.includes(token));
};

export const toggleSelectedListingType = (values = [], typeId = "", allowedTypes = []) => {
  const normalizedType = normalizeListingType(typeId);
  const current = normalizeSelectedListingTypes(values, allowedTypes);
  if (current.includes(normalizedType)) {
    if (current.length === 1) return current;
    return current.filter((token) => token !== normalizedType);
  }
  return normalizeSelectedListingTypes([...current, normalizedType], allowedTypes);
};

export const setOnlySelectedListingType = (typeId = "", allowedTypes = []) => {
  const normalizedType = normalizeListingType(typeId);
  return normalizeSelectedListingTypes([normalizedType], allowedTypes);
};

export const buildListingActionHref = (listing = null) => {
  if (!listing || typeof listing !== "object") return "";
  const listingType = normalizeListingType(listing?.listingType);
  const roomCode = String(listing?.roomCode || "").trim().toUpperCase();
  if (listingType === "room_session" && roomCode) {
    return buildMarketingPath({ page: "join", id: roomCode, params: { roomCode } });
  }
  if (String(listing?.sourceType || "").trim().toLowerCase() === "official_registry") {
    return "";
  }
  const routePage = String(listing?.routePage || "").trim();
  const listingId = String(listing?.id || "").trim();
  if (!routePage || !listingId) return "";
  return buildMarketingPath({ page: routePage, id: listingId });
};

export const getListingActionMeta = (listing = null) => {
  const href = buildListingActionHref(listing);
  const label = normalizeListingType(listing?.listingType) === "room_session" && String(listing?.roomCode || "").trim()
    ? "Open room"
    : "Open details";
  return { href, label };
};
