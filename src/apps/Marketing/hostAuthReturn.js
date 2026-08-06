import { inferSurfaceFromHostname } from "../../lib/surfaceDomains";

const HOST_APP_PATHS = new Set([
  "/host",
  "/host-dashboard",
  "/hub",
  "/host-hub",
  "/ops/hosts",
  "/host-operations",
]);

const HOST_ACCESS_PATHS = new Set(["/host-access"]);

export const resolveHostDashboardReturnHref = (returnToHref = "", locationLike = null) => {
  const raw = String(returnToHref || "").trim();
  if (!raw || !locationLike) return "";

  try {
    const parsed = new URL(raw, locationLike.origin || "https://host.beaurocks.app");
    const normalizedPathname = (parsed.pathname || "/").replace(/\/+$/, "") || "/";
    const params = new URLSearchParams(parsed.search || "");
    const legacyPage = String(params.get("page") || "").trim().toLowerCase();
    const isHostAccessReturn = HOST_ACCESS_PATHS.has(normalizedPathname)
      || legacyPage === "host_access"
      || legacyPage === "host-access";
    if (isHostAccessReturn) return "";

    const sameOrigin = parsed.origin === locationLike.origin;
    const targetSurface = inferSurfaceFromHostname(parsed.hostname, locationLike);
    const targetsHostApp = HOST_APP_PATHS.has(normalizedPathname)
      || String(params.get("mode") || "").trim().toLowerCase() === "host";
    if (!targetsHostApp) return "";
    if (!sameOrigin && targetSurface !== "host") return "";

    return sameOrigin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString();
  } catch {
    return "";
  }
};
