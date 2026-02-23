const readEnvBool = (name, fallback = false) => {
  if (typeof import.meta === "undefined" || !import.meta?.env) return fallback;
  const raw = String(import.meta.env[name] || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
};

const readWindowOverride = (key, fallback = false) => {
  if (typeof window === "undefined") return fallback;
  const raw = window?.__marketingFlags?.[key];
  if (typeof raw === "boolean") return raw;
  return fallback;
};

const resolveFlag = (envName, key, fallback = false) =>
  readWindowOverride(key, readEnvBool(envName, fallback));

export const marketingFlags = {
  routePathsEnabled: resolveFlag("VITE_MARKETING_ROUTE_PATHS_ENABLED", "routePathsEnabled", true),
  claimFlowEnabled: resolveFlag("VITE_MARKETING_CLAIM_FLOW_ENABLED", "claimFlowEnabled", true),
  rsvpEnabled: resolveFlag("VITE_MARKETING_RSVP_ENABLED", "rsvpEnabled", true),
  smsRemindersEnabled: resolveFlag("VITE_MARKETING_SMS_REMINDERS_ENABLED", "smsRemindersEnabled", false),
  geoPagesEnabled: resolveFlag("VITE_MARKETING_GEO_PAGES_ENABLED", "geoPagesEnabled", true),
};

