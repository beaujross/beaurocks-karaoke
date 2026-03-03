export const toMillis = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === "function") {
    const ms = Number(value.toMillis());
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value && typeof value === "object") {
    const seconds = Number(value.seconds ?? value._seconds ?? 0);
    const nanos = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
    if (Number.isFinite(seconds)) {
      return Math.max(0, Math.round((seconds * 1000) + (nanos / 1e6)));
    }
  }
  return 0;
};

export const toRoomManagerEntryFromData = ({ id = "", data = {} } = {}) => {
  const safeData = data && typeof data === "object" ? data : {};
  const code = String(id || "").trim().toUpperCase();
  const createdAtMs = toMillis(safeData.createdAt);
  const closedAtMs = toMillis(safeData.closedAt);
  const archivedAtMs = toMillis(safeData.archivedAt);
  const updatedAtMs = toMillis(safeData.updatedAt) || closedAtMs || archivedAtMs || createdAtMs;
  const recap = safeData.recap && typeof safeData.recap === "object" ? safeData.recap : null;
  const recapAtMs = toMillis(recap?.generatedAtMs) || toMillis(recap?.generatedAt) || toMillis(recap?.timestamp) || 0;
  const hasRecap = !!recap && Object.keys(recap).length > 0;
  const isArchived = !!archivedAtMs || String(safeData.archivedStatus || "").trim().toLowerCase() === "archived";
  const isClosed = !!closedAtMs || String(safeData.status || "").trim().toLowerCase() === "closed";
  const title = String(safeData.title || safeData.name || "").trim() || `Room ${code}`;
  return {
    id,
    code,
    title,
    hostName: String(safeData.hostName || "").trim() || "Host",
    activeMode: String(safeData.activeMode || "karaoke").trim() || "karaoke",
    createdAtMs,
    updatedAtMs,
    closedAtMs,
    archivedAtMs,
    recapAtMs,
    hasRecap,
    isClosed,
    isArchived,
  };
};
