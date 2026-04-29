export const normalizeAutocompleteSearchValue = (value = '') => String(value || '').trim().toLowerCase();

export const matchesAutocompleteQuery = (parts = [], query = '') => {
    const normalizedQuery = normalizeAutocompleteSearchValue(query);
    if (!normalizedQuery) return true;
    const haystack = (Array.isArray(parts) ? parts : [])
        .map((part) => normalizeAutocompleteSearchValue(part))
        .filter(Boolean)
        .join(' ');
    return normalizedQuery
        .split(/\s+/)
        .filter(Boolean)
        .every((token) => haystack.includes(token));
};

export const buildLocalLibraryAutocompleteEntries = (entries = [], query = '') => (
    (Array.isArray(entries) ? entries : [])
        .map((entry, index) => {
            const trackName = String(entry?.trackName || entry?.title || entry?.songTitle || entry?.fileName || `Room Media ${index + 1}`).trim() || `Room Media ${index + 1}`;
            const artistName = String(entry?.artistName || entry?.artist || '').trim();
            return {
                ...entry,
                source: entry?.source || 'local',
                trackName,
                artistName,
                artworkUrl100: String(entry?.artworkUrl100 || entry?.artworkUrl || '').trim()
            };
        })
        .filter((entry) => matchesAutocompleteQuery(
            [entry?.trackName, entry?.artistName, entry?.fileName, entry?.id, entry?.url],
            query
        ))
);

export const buildIndexedYouTubeAutocompleteEntries = (entries = [], query = '') => (
    (Array.isArray(entries) ? entries : [])
        .map((entry, index) => ({
            ...entry,
            source: entry?.source || 'youtube',
            trackName: String(entry?.trackName || entry?.title || `YouTube Track ${index + 1}`).trim() || `YouTube Track ${index + 1}`,
            artistName: String(entry?.artistName || entry?.channelTitle || entry?.channel || 'YouTube').trim() || 'YouTube'
        }))
        .filter((entry) => matchesAutocompleteQuery(
            [entry?.trackName, entry?.artistName, entry?.videoId, entry?.url],
            query
        ))
);
