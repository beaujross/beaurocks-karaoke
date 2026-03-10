const ROOM_CODE_BLOCKLIST = new Set([
  "ROOM",
  "CODE",
  "LIKE",
  "OPEN",
  "HOST",
  "SETUP",
  "FIRST",
  "START",
  "GUIDED",
  "LAUNCH",
  "READY",
]);

export const sanitizeRoomCode = (value) =>
  String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export const isLikelyRoomCode = (value) => {
  const code = sanitizeRoomCode(value);
  return code.length >= 4 && code.length <= 10 && !ROOM_CODE_BLOCKLIST.has(code);
};

export const extractRoomCodeFromUrl = (value = "") => {
  try {
    const parsed = new URL(String(value || "").trim());
    const fromQuery = sanitizeRoomCode(parsed.searchParams.get("room") || "");
    return isLikelyRoomCode(fromQuery) ? fromQuery : "";
  } catch {
    return "";
  }
};

export const extractRoomCodeFromBodyText = (value = "") => {
  const text = String(value || "");
  const patterns = [
    /\broom\s+([A-Z0-9]{4,10})\s+(?:ready|created|opened|live|launched)\b/i,
    /\b([A-Z0-9]{4,10})\s+(?:created|ready|opened|live)\b/i,
    /\broom\s+code[:\s]+([A-Z0-9]{4,10})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = sanitizeRoomCode(match?.[1] || "");
    if (isLikelyRoomCode(candidate)) {
      return candidate;
    }
  }

  const urlMatches = text.match(/https?:\/\/[^\s]+/gi) || [];
  for (const entry of urlMatches) {
    const fromUrl = extractRoomCodeFromUrl(entry);
    if (fromUrl) {
      return fromUrl;
    }
  }

  return "";
};
