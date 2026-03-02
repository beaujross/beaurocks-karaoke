const classifyJoinPreviewError = (error = null) => {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  if (code.includes("not-found") || message.includes("not found")) return "not_found";
  if (code.includes("permission-denied")) return "permission_denied";
  if (code.includes("unavailable") || message.includes("network")) return "network";
  return "unknown";
};

export const getJoinPreviewFallback = ({ error = null, roomCode = "" } = {}) => {
  const normalizedCode = String(roomCode || "").trim().toUpperCase();
  const kind = classifyJoinPreviewError(error);
  if (kind === "not_found") {
    return {
      tone: "warning",
      message: normalizedCode
        ? `Room ${normalizedCode} preview is unavailable right now. You can still tap Join On Mobile.`
        : "Room preview is unavailable right now. You can still tap Join On Mobile.",
    };
  }
  if (kind === "network") {
    return {
      tone: "warning",
      message: "Network issue loading preview. You can still tap Join On Mobile.",
    };
  }
  if (kind === "permission_denied") {
    return {
      tone: "error",
      message: "Room preview is restricted. Use Join On Mobile if you already have access.",
    };
  }
  return {
    tone: "error",
    message: String(error?.message || "Room code preview failed."),
  };
};
