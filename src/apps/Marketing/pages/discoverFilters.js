export const isJoinableRoomListing = (entry = {}) =>
  String(entry?.listingType || "").trim().toLowerCase() === "room_session"
  && !!String(entry?.roomCode || "").trim();

export const countJoinableRoomListings = (entries = []) =>
  (Array.isArray(entries) ? entries : []).filter((entry) => isJoinableRoomListing(entry)).length;
