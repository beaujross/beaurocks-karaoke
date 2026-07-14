"use strict";

const followCanonicalSongRedirect = async ({ initialSongId = "", loadSongData, maxDepth = 6 } = {}) => {
  let songId = String(initialSongId || "").trim();
  if (!songId || typeof loadSongData !== "function") return null;
  const visited = new Set();
  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (!songId || visited.has(songId)) return null;
    visited.add(songId);
    const songData = await loadSongData(songId);
    if (!songData) return null;
    const mergedIntoSongId = String(songData.mergedIntoSongId || "").trim();
    if (!mergedIntoSongId || mergedIntoSongId === songId) {
      return { songId, songData, redirected: depth > 0, depth };
    }
    songId = mergedIntoSongId;
  }
  return null;
};

module.exports = { followCanonicalSongRedirect };
