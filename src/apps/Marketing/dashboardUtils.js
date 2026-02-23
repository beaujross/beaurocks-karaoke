export const TIGHT15_MAX = 15;

export const normalizeTight15Text = (value = "") =>
  String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

export const normalizeTight15Entry = (entry = {}) => {
  const songTitle = String(entry.songTitle || entry.song || "").trim();
  const artist = String(entry.artist || "").trim();
  if (!songTitle || !artist) return null;
  return {
    id: String(entry.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    songTitle,
    artist,
    albumArtUrl: String(entry.albumArtUrl || entry.artworkUrl || "").trim(),
    addedAt: Number(entry.addedAt || Date.now()),
  };
};

export const getTight15Key = (entry = {}) =>
  `${normalizeTight15Text(entry.songTitle)}__${normalizeTight15Text(entry.artist)}`;

export const sanitizeTight15List = (list = []) => {
  const seen = new Set();
  const cleaned = [];
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const normalized = normalizeTight15Entry(entry);
    if (!normalized) return;
    const key = getTight15Key(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push(normalized);
  });
  return cleaned.slice(0, TIGHT15_MAX);
};

export const moveTight15Entry = (list = [], fromIndex = -1, toIndex = -1) => {
  const source = Array.isArray(list) ? [...list] : [];
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return source;
  if (fromIndex >= source.length || toIndex >= source.length) return source;
  const [moved] = source.splice(fromIndex, 1);
  source.splice(toIndex, 0, moved);
  return source;
};

export const collectFollowedHostIds = (follows = []) => {
  const seen = new Set();
  const ids = [];
  (Array.isArray(follows) ? follows : []).forEach((entry) => {
    if (String(entry?.targetType || "") !== "host") return;
    const id = String(entry?.targetId || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids;
};

