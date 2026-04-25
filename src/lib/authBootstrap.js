const normalizeToken = (value = "") => String(value || "").trim().toLowerCase();

const isMarketingLikeLocation = (locationLike = null) => {
  if (!locationLike) return false;
  const pathname = String(locationLike.pathname || "/").trim().replace(/\/+$/, "") || "/";
  const search = String(locationLike.search || "");
  const params = new URLSearchParams(search);
  const mode = normalizeToken(params.get("mode"));
  const roomCode = String(params.get("room") || "").trim();

  if (roomCode) return false;
  if (mode && mode !== "marketing") return false;
  if (mode === "marketing") return true;

  const hostname = normalizeToken(locationLike.hostname);
  const marketingHostnames = new Set([
    "beaurocks.app",
    "www.beaurocks.app",
    "localhost",
    "127.0.0.1",
    "[::1]",
  ]);
  const marketingPaths = new Set([
    "/",
    "/discover",
    "/for-hosts",
    "/for-venues",
    "/for-performers",
    "/for-fans",
    "/join",
    "/submit",
    "/host-access",
    "/marketing",
  ]);

  return marketingHostnames.has(hostname) && marketingPaths.has(pathname);
};

export const shouldBootstrapAnonymousAuth = ({
  customToken = "",
  currentUser = null,
  viewHint = "",
  locationLike = null,
} = {}) => {
  const token = String(customToken || "").trim();
  if (token) return false;
  if (currentUser?.uid) return false;

  const normalizedViewHint = normalizeToken(viewHint);
  if (normalizedViewHint === "marketing") return false;

  const resolvedLocation = locationLike || (typeof window !== "undefined" ? window.location : null);
  if (isMarketingLikeLocation(resolvedLocation)) return false;

  return true;
};
