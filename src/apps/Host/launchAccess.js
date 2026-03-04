export const normalizeHostPermissionLevel = (role = "") => {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "owner" || normalized === "admin" || normalized === "member") {
    return normalized;
  }
  return "unknown";
};

export const canQuickStartForRole = (role = "") => {
  const normalized = normalizeHostPermissionLevel(role);
  return normalized === "owner" || normalized === "admin";
};
