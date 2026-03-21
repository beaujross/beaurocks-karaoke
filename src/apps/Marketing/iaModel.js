import { MARKETING_ROUTE_PAGES } from "./routing";

export const MARKETING_IA_ZONES = Object.freeze({
  market: "market",
  utility: "utility",
  app: "app",
});

const navItem = (id, label) => ({ id, label });
const cloneItems = (items = []) => items.map((item) => ({ ...item }));

export const MARKETING_CANONICAL_ROUTE_MAP = Object.freeze({
  [MARKETING_ROUTE_PAGES.forFans]: "/",
  [MARKETING_ROUTE_PAGES.forHosts]: "/for-hosts",
  [MARKETING_ROUTE_PAGES.hostAccess]: "/host-access",
  [MARKETING_ROUTE_PAGES.demo]: "/demo",
  [MARKETING_ROUTE_PAGES.demoAuto]: "/demo-auto",
  [MARKETING_ROUTE_PAGES.changelog]: "/changelog",
  [MARKETING_ROUTE_PAGES.discover]: "/discover",
  [MARKETING_ROUTE_PAGES.join]: "/join",
  [MARKETING_ROUTE_PAGES.forVenues]: "/for-venues",
  [MARKETING_ROUTE_PAGES.forPerformers]: "/for-performers",
  [MARKETING_ROUTE_PAGES.venue]: "/venues/:id",
  [MARKETING_ROUTE_PAGES.event]: "/events/:id",
  [MARKETING_ROUTE_PAGES.host]: "/hosts/:id",
  [MARKETING_ROUTE_PAGES.performer]: "/performers/:id",
  [MARKETING_ROUTE_PAGES.session]: "/sessions/:id",
  [MARKETING_ROUTE_PAGES.profile]: "/profile",
  [MARKETING_ROUTE_PAGES.submit]: "/submit",
  [MARKETING_ROUTE_PAGES.admin]: "/admin/moderation",
  [MARKETING_ROUTE_PAGES.geoRegion]: "/karaoke/:region",
  [MARKETING_ROUTE_PAGES.geoCity]: "/karaoke/us/:state/:city",
});

export const MARKETING_ROUTE_OWNERSHIP = Object.freeze({
  [MARKETING_ROUTE_PAGES.forHosts]: {
    zone: MARKETING_IA_ZONES.market,
    owner: "Marketing/Product",
    audience: "public",
    intent: "Host acquisition narrative",
  },
  [MARKETING_ROUTE_PAGES.hostAccess]: {
    zone: MARKETING_IA_ZONES.market,
    owner: "Marketing/Growth",
    audience: "public",
    intent: "Host onboarding access gate",
  },
  [MARKETING_ROUTE_PAGES.demo]: {
    zone: MARKETING_IA_ZONES.market,
    owner: "Marketing/Product",
    audience: "public",
    intent: "Conceptual product proof",
  },
  [MARKETING_ROUTE_PAGES.demoAuto]: {
    zone: MARKETING_IA_ZONES.market,
    owner: "Marketing/Product",
    audience: "public",
    intent: "Auto-play product walkthrough",
  },
  [MARKETING_ROUTE_PAGES.changelog]: {
    zone: MARKETING_IA_ZONES.market,
    owner: "Marketing/Product",
    audience: "public",
    intent: "Release history and product updates",
  },
  [MARKETING_ROUTE_PAGES.discover]: {
    zone: MARKETING_IA_ZONES.utility,
    owner: "Directory",
    audience: "public",
    intent: "Find public karaoke listings",
  },
  [MARKETING_ROUTE_PAGES.join]: {
    zone: MARKETING_IA_ZONES.utility,
    owner: "Session Entry",
    audience: "public",
    intent: "Join private room by code",
  },
  [MARKETING_ROUTE_PAGES.forVenues]: {
    zone: MARKETING_IA_ZONES.market,
    owner: "Marketing/Partners",
    audience: "public",
    intent: "Venue partner positioning",
  },
  [MARKETING_ROUTE_PAGES.forPerformers]: {
    zone: MARKETING_IA_ZONES.market,
    owner: "Marketing/Community",
    audience: "public",
    intent: "Performer messaging",
  },
  [MARKETING_ROUTE_PAGES.forFans]: {
    zone: MARKETING_IA_ZONES.market,
    owner: "Marketing/Community",
    audience: "public",
    intent: "Guest messaging",
  },
  [MARKETING_ROUTE_PAGES.venue]: {
    zone: MARKETING_IA_ZONES.utility,
    owner: "Directory",
    audience: "public",
    intent: "Venue detail",
  },
  [MARKETING_ROUTE_PAGES.event]: {
    zone: MARKETING_IA_ZONES.utility,
    owner: "Directory",
    audience: "public",
    intent: "Event detail",
  },
  [MARKETING_ROUTE_PAGES.host]: {
    zone: MARKETING_IA_ZONES.utility,
    owner: "Directory",
    audience: "public",
    intent: "Host detail",
  },
  [MARKETING_ROUTE_PAGES.performer]: {
    zone: MARKETING_IA_ZONES.utility,
    owner: "Directory",
    audience: "public",
    intent: "Performer detail",
  },
  [MARKETING_ROUTE_PAGES.session]: {
    zone: MARKETING_IA_ZONES.utility,
    owner: "Directory",
    audience: "public",
    intent: "Session detail",
  },
  [MARKETING_ROUTE_PAGES.profile]: {
    zone: MARKETING_IA_ZONES.app,
    owner: "Accounts",
    audience: "authenticated",
    intent: "Personal dashboard",
  },
  [MARKETING_ROUTE_PAGES.submit]: {
    zone: MARKETING_IA_ZONES.app,
    owner: "Directory Ops",
    audience: "authenticated",
    intent: "Listing creation and submission",
  },
  [MARKETING_ROUTE_PAGES.admin]: {
    zone: MARKETING_IA_ZONES.app,
    owner: "Moderation",
    audience: "moderator",
    intent: "Moderation tooling",
  },
  [MARKETING_ROUTE_PAGES.geoRegion]: {
    zone: MARKETING_IA_ZONES.utility,
    owner: "Directory/SEO",
    audience: "public",
    intent: "Geo landing index",
  },
  [MARKETING_ROUTE_PAGES.geoCity]: {
    zone: MARKETING_IA_ZONES.utility,
    owner: "Directory/SEO",
    audience: "public",
    intent: "Geo city landing",
  },
});

export const MARKETING_NAV_CONFIG = Object.freeze({
  publicPrimary: Object.freeze([
    navItem(MARKETING_ROUTE_PAGES.discover, "Discover"),
    navItem(MARKETING_ROUTE_PAGES.demo, "Demo"),
    navItem(MARKETING_ROUTE_PAGES.join, "Join"),
  ]),
  publicSecondary: Object.freeze([
    navItem(MARKETING_ROUTE_PAGES.forHosts, "For Hosts"),
    navItem(MARKETING_ROUTE_PAGES.forVenues, "For Venues"),
    navItem(MARKETING_ROUTE_PAGES.forPerformers, "For Performers"),
  ]),
  homePrimary: Object.freeze([
    navItem(MARKETING_ROUTE_PAGES.discover, "Discover"),
    navItem(MARKETING_ROUTE_PAGES.demo, "Demo"),
    navItem(MARKETING_ROUTE_PAGES.join, "Join"),
  ]),
  homeSecondary: Object.freeze([
    navItem(MARKETING_ROUTE_PAGES.forHosts, "For Hosts"),
    navItem(MARKETING_ROUTE_PAGES.forVenues, "For Venues"),
    navItem(MARKETING_ROUTE_PAGES.forPerformers, "For Performers"),
  ]),
  authenticatedSecondary: Object.freeze([
    navItem(MARKETING_ROUTE_PAGES.profile, "Dashboard"),
  ]),
  moderatorSecondary: Object.freeze([
    navItem(MARKETING_ROUTE_PAGES.admin, "Marketing Admin"),
  ]),
  ctas: Object.freeze({
    startHosting: Object.freeze({ id: MARKETING_ROUTE_PAGES.forHosts, label: "Request Access" }),
    openHostDashboard: Object.freeze({ id: "host_dashboard", label: "Host Dashboard" }),
  }),
});

const mergeUniqueItems = (...groups) => {
  const seen = new Set();
  const result = [];
  groups.forEach((group) => {
    (group || []).forEach((item) => {
      const id = String(item?.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      result.push({ ...item });
    });
  });
  return result;
};

export const getMarketingNavModel = ({
  isGuestsHomePage = false,
  hasFullAccount = false,
  isModerator = false,
} = {}) => {
  const primary = isGuestsHomePage
    ? cloneItems(MARKETING_NAV_CONFIG.homePrimary)
    : cloneItems(MARKETING_NAV_CONFIG.publicPrimary);

  const baseSecondary = isGuestsHomePage
    ? MARKETING_NAV_CONFIG.homeSecondary
    : MARKETING_NAV_CONFIG.publicSecondary;

  const secondary = mergeUniqueItems(
    hasFullAccount ? MARKETING_NAV_CONFIG.authenticatedSecondary : [],
    baseSecondary,
    isModerator ? MARKETING_NAV_CONFIG.moderatorSecondary : [],
  );

  return { primary, secondary };
};

export const MARKETING_ZERO_BREAK_REDIRECT_PLAN = Object.freeze([
  Object.freeze({ from: "/marketing?page=for_fans", to: "/", strategy: "alias_keep_live" }),
  Object.freeze({ from: "/marketing?page=for_hosts", to: "/for-hosts", strategy: "alias_keep_live" }),
  Object.freeze({ from: "/marketing?page=discover", to: "/discover", strategy: "alias_keep_live" }),
  Object.freeze({ from: "/marketing?page=join", to: "/join", strategy: "alias_keep_live" }),
  Object.freeze({ from: "/marketing?page=host_access", to: "/host-access", strategy: "alias_keep_live" }),
]);
