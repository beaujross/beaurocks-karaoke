export const normalizeComparableMarketingUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "/";
  const [pathAndSearch = "/", hash = ""] = raw.split("#");
  const [pathname = "/", search = ""] = pathAndSearch.split("?");
  const comparablePath = pathname === "/"
    ? "/"
    : String(pathname || "/").replace(/\/+$/, "") || "/";
  return `${comparablePath}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
};
