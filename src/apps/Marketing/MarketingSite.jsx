import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "./lib/marketingAnalytics";
import { marketingFlags } from "./featureFlags";
import {
  MARKETING_ROUTE_PAGES,
  buildLegacyMarketingQuery,
  buildMarketingSearch,
  buildMarketingUrl,
  parseMarketingRouteFromHref,
  parseMarketingRouteFromLocation,
} from "./routing";
import { applyMarketingSeo } from "./seo";
import { directoryActions } from "./api/directoryApi";
import { useDirectorySession } from "./hooks/useDirectorySession";
import { normalizeComparableMarketingUrl } from "./marketingCanonicalization";
import { formatDateTime, MARKETING_BRAND_NEON_URL } from "./pages/shared";
import { buildSurfaceUrl, inferSurfaceFromHostname } from "../../lib/surfaceDomains";
import { getMarketingNavModel } from "./iaModel";
import "./marketing.css";

const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const DemoExperiencePage = lazy(() => import("./pages/DemoExperiencePage"));
const ChangelogPage = lazy(() => import("./pages/ChangelogPage"));
const VenuePage = lazy(() => import("./pages/VenuePage"));
const EventPage = lazy(() => import("./pages/EventPage"));
const HostPage = lazy(() => import("./pages/HostPage"));
const PerformerPage = lazy(() => import("./pages/PerformerPage"));
const RoomSessionPage = lazy(() => import("./pages/RoomSessionPage"));
const ProfileDashboardPage = lazy(() => import("./pages/ProfileDashboardPage"));
const ListingSubmissionPage = lazy(() => import("./pages/ListingSubmissionPage"));
const AdminModerationPage = lazy(() => import("./pages/AdminModerationPage"));
const ForHostsPage = lazy(() => import("./pages/ForHostsPage"));
const ForVenuesPage = lazy(() => import("./pages/ForVenuesPage"));
const ForPerformersPage = lazy(() => import("./pages/ForPerformersPage"));
const ForFansPage = lazy(() => import("./pages/ForFansPage"));
const JoinPage = lazy(() => import("./pages/JoinPage"));
const GeoLandingPage = lazy(() => import("./pages/GeoLandingPage"));
const GoldenPathRail = lazy(() => import("./pages/GoldenPathRail"));

const PRODUCT_BRAND = {
  name: "BeauRocks Karaoke",
  tagline: "Karaoke that keeps the room together",
  finder: "Setlist Finder",
  tv: "Spotlight TV",
  audience: "Party Mic",
  host: "Host Deck",
};

const PageShellLoader = () => (
  <div className="mk3-status">
    <strong>Loading page...</strong>
    <span>Getting the next page ready.</span>
  </div>
);

const MAPS_CONFIG_CACHE_KEY = "mk3_maps_config_cache_v2";
const MAPS_CONFIG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const readCachedMapsConfig = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MAPS_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const fetchedAtMs = Number(parsed?.fetchedAtMs || 0);
    const data = parsed?.data && typeof parsed.data === "object" ? parsed.data : null;
    if (!data) return null;
    if (!Number.isFinite(fetchedAtMs) || (Date.now() - fetchedAtMs) > MAPS_CONFIG_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
};

const cacheMapsConfig = (config = null) => {
  if (typeof window === "undefined" || !config || typeof config !== "object") return;
  try {
    window.localStorage.setItem(MAPS_CONFIG_CACHE_KEY, JSON.stringify({
      fetchedAtMs: Date.now(),
      data: config,
    }));
  } catch {
    // Ignore storage write failures.
  }
};

const normalizePage = (value = "") => {
  const safe = String(value || "").trim().toLowerCase();
  if (safe === "home") return MARKETING_ROUTE_PAGES.forFans;
  if (safe === "discover") return MARKETING_ROUTE_PAGES.discover;
  if (safe === "demo") return MARKETING_ROUTE_PAGES.forFans;
  if (safe === "demo_auto" || safe === "demo-auto" || safe === "auto-demo") return MARKETING_ROUTE_PAGES.forFans;
  if (safe === "changelog") return MARKETING_ROUTE_PAGES.changelog;
  if (safe === "host_access" || safe === "host-access") return MARKETING_ROUTE_PAGES.hostAccess;
  if (safe === "venue") return MARKETING_ROUTE_PAGES.venue;
  if (safe === "event") return MARKETING_ROUTE_PAGES.event;
  if (safe === "host") return MARKETING_ROUTE_PAGES.host;
  if (safe === "performer") return MARKETING_ROUTE_PAGES.performer;
  if (safe === "session") return MARKETING_ROUTE_PAGES.session;
  if (safe === "profile") return MARKETING_ROUTE_PAGES.profile;
  if (safe === "submit") return MARKETING_ROUTE_PAGES.submit;
  if (safe === "admin") return MARKETING_ROUTE_PAGES.admin;
  if (safe === "for_hosts" || safe === "for-hosts") return MARKETING_ROUTE_PAGES.forHosts;
  if (safe === "for_venues" || safe === "for-venues") return MARKETING_ROUTE_PAGES.forVenues;
  if (safe === "for_performers" || safe === "for-performers") return MARKETING_ROUTE_PAGES.forPerformers;
  if (safe === "for_fans" || safe === "for-fans") return MARKETING_ROUTE_PAGES.forFans;
  if (safe === "join") return MARKETING_ROUTE_PAGES.join;
  if (safe === "geo_city") return MARKETING_ROUTE_PAGES.geoCity;
  if (safe === "geo_region") return MARKETING_ROUTE_PAGES.geoRegion;
  return MARKETING_ROUTE_PAGES.discover;
};

const normalizeRouteInput = (pageOrRoute = MARKETING_ROUTE_PAGES.discover, id = "", params = {}) => {
  if (typeof pageOrRoute === "object" && pageOrRoute) {
    return {
      page: normalizePage(pageOrRoute.page || MARKETING_ROUTE_PAGES.discover),
      id: String(pageOrRoute.id || "").trim(),
      params: pageOrRoute.params && typeof pageOrRoute.params === "object" ? pageOrRoute.params : {},
    };
  }
  return {
    page: normalizePage(pageOrRoute),
    id: String(id || "").trim(),
    params: params && typeof params === "object" ? params : {},
  };
};

const readRouteFromWindow = () => {
  if (typeof window === "undefined") return normalizeRouteInput();
  return normalizeRouteInput(parseMarketingRouteFromLocation(window.location));
};

const stripIntentParams = (params = {}) => {
  const next = { ...(params || {}) };
  delete next.intent;
  delete next.targetType;
  delete next.targetId;
  delete next.next;
  delete next.return_to;
  return next;
};

const resolveHostDashboardReturnHref = (returnToHref = "", locationLike = null) => {
  const raw = String(returnToHref || "").trim();
  if (!raw || !locationLike) return "";
  try {
    const parsed = new URL(raw, locationLike.origin || "https://host.beaurocks.app");
    const normalizedPathname = (parsed.pathname || "/").replace(/\/+$/, "") || "/";
    const params = new URLSearchParams(parsed.search || "");
    const legacyPage = String(params.get("page") || "").trim().toLowerCase();
    const isHostAccessReturn = normalizedPathname === "/host-access"
      || legacyPage === "host_access"
      || legacyPage === "host-access";
    if (isHostAccessReturn) return "";

    const sameOrigin = parsed.origin === locationLike.origin;
    const targetSurface = inferSurfaceFromHostname(parsed.hostname, locationLike);
    const targetsHostApp = String(params.get("mode") || "").trim().toLowerCase() === "host"
      || !!String(params.get("view") || "").trim()
      || !!String(params.get("tab") || "").trim()
      || !!String(params.get("game") || "").trim();
    if (!targetsHostApp) return "";
    if (!sameOrigin && targetSurface !== "host") return "";
    return sameOrigin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString();
  } catch {
    return "";
  }
};

const APP_VERSION = typeof import.meta !== "undefined" && import.meta?.env
  ? String(import.meta.env.VITE_APP_VERSION || "")
  : "";
const APP_BUILD = typeof import.meta !== "undefined" && import.meta?.env
  ? String(import.meta.env.VITE_APP_BUILD || "")
  : "";
const MARKETING_RELEASE_VERSION = APP_VERSION ? `v${APP_VERSION}` : "v0.0.0";
const MARKETING_RELEASE_LABEL = APP_BUILD ? `${MARKETING_RELEASE_VERSION}+${APP_BUILD}` : MARKETING_RELEASE_VERSION;
const MARKETING_PUBLIC_CHANGELOG = [
  {
    title: "Host Review + Event Ops Hardening",
    date: "March 27, 2026",
    tag: "Host Ops",
    bullets: [
      "Unresolved audience requests now have a clearer host-review path with direct YouTube host search and request editing.",
      "Auto end on finish now prefers the backing duration captured at performance start instead of relying on stale request timing.",
      "Credits & Funds, promo campaigns, and Givebutter-linked attendee matching continue replacing fragile shared-code event flows.",
    ],
  },
  {
    title: "Show Workspace Studio Pass",
    date: "March 27, 2026",
    tag: "Run Of Show",
    bullets: [
      "The Show workspace now keeps moving toward a studio-style sequence builder with clearer Build, Run, and Review modes.",
      "Hosts can see more of the room plan directly in the main operating surfaces instead of digging through admin-only settings.",
      "The timeline direction remains focused on feeling more like a visual sequence tool than a traditional web form.",
    ],
  },
  {
    title: "Audience Email-Link Recovery",
    date: "March 25, 2026",
    tag: "Audience",
    bullets: [
      "Expired or already-spent sign-in links now fail cleanly instead of getting stuck in a retry loop.",
      "Audience email-link verification now runs once per link URL and clears dead auth params after terminal errors.",
      "Sign-in emails were refreshed with higher-contrast copy and a clearer fallback link block.",
    ],
  },
  {
    title: "Homepage + Demo Cleanup",
    date: "March 25, 2026",
    tag: "Marketing",
    bullets: [
      "The fan homepage hero now falls back to a stable static layout on many mobile and touch devices.",
      "Competing call-to-action clusters were reduced so the homepage reads like a clearer single journey.",
      "The demo walkthrough now uses lighter controls, cleaner scene navigation, and smaller surface framing for easier scanning.",
    ],
  },
  {
    title: "Launch Access + Routing",
    date: "February 27, 2026",
    tag: "Release",
    bullets: [
      "Root domain now prioritizes launch-intent capture and tester fast-lane actions.",
      "Primary host panel calls-to-action now route directly to host.beaurocks.app.",
      "Cross-surface links for audience, host, and TV were revalidated for production.",
    ],
  },
  {
    title: "Host Setup Reliability",
    date: "February 27, 2026",
    tag: "Host Ops",
    bullets: [
      "Host landing now exposes an always-visible create-room path with fewer hidden dependencies.",
      "Share-and-launch actions for audience join and TV open were streamlined on setup flows.",
      "Setup smoke tests were updated to track current split-domain production behavior.",
    ],
  },
  {
    title: "Quality + Safeguards",
    date: "February 27, 2026",
    tag: "QA",
    bullets: [
      "Marketing golden-loop tests were aligned to current labels, routing, and auth intents.",
      "Persona/admin test coverage now reflects modern host setup and fallback UI behavior.",
      "Release gate checks continue to include host join, users profile, and app-check smoke paths.",
    ],
  },
];

const CAMPAIGN_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "campaign_variant",
];

const normalizeCampaignVariant = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === "paid" || token === "social" || token === "organic") return token;
  return "";
};

const inferCampaignVariant = (params = {}) => {
  const explicit = normalizeCampaignVariant(params?.campaign_variant);
  if (explicit) return explicit;
  const medium = String(params?.utm_medium || "").trim().toLowerCase();
  const source = String(params?.utm_source || "").trim().toLowerCase();
  if (medium.includes("paid") || medium === "cpc" || medium === "ppc") return "paid";
  if (medium.includes("social")) return "social";
  if (
    source.includes("meta")
    || source.includes("instagram")
    || source.includes("facebook")
    || source.includes("tiktok")
    || source.includes("x")
    || source.includes("youtube")
    || source.includes("linkedin")
  ) {
    return "social";
  }
  return "organic";
};

const pickCampaignParams = (params = {}) => {
  const next = {};
  CAMPAIGN_PARAM_KEYS.forEach((key) => {
    const value = String(params?.[key] || "").trim();
    if (value) next[key] = value;
  });
  return next;
};

const MarketingSite = () => {
  const [route, setRoute] = useState(() => readRouteFromWindow());
  const [seoEntity, setSeoEntity] = useState(null);
  const [mapsConfig, setMapsConfig] = useState(() => readCachedMapsConfig());
  const [mapsConfigError, setMapsConfigError] = useState("");
  const [heroStats, setHeroStats] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [authLocalError, setAuthLocalError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [hostApplicationBusy, setHostApplicationBusy] = useState(false);
  const [hostApplicationNotice, setHostApplicationNotice] = useState("");
  const [pendingHostApplicationsCount, setPendingHostApplicationsCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const authPanelRef = useRef(null);
  const moreMenuRef = useRef(null);
  const { session, actions } = useDirectorySession();
  const isAuthed = !!session?.isAuthed;
  const isAnonymous = !!session?.isAnonymous;
  const hasFullAccount = isAuthed && !isAnonymous;

  const collapseNavMenus = useCallback(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const onPopState = () => {
      setRoute(readRouteFromWindow());
      collapseNavMenus();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [collapseNavMenus]);

  useEffect(() => {
    collapseNavMenus();
  }, [collapseNavMenus, route.page, route.id]);

  useEffect(() => {
    if (!moreMenuOpen || typeof document === "undefined") return () => {};
    const handlePointerDown = (event) => {
      if (moreMenuRef.current?.contains(event.target)) return;
      setMoreMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!marketingFlags.routePathsEnabled) return;
    const parsed = normalizeRouteInput(parseMarketingRouteFromLocation(window.location));
    const canonicalUrl = `${buildMarketingUrl(parsed)}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (normalizeComparableMarketingUrl(currentUrl) === normalizeComparableMarketingUrl(canonicalUrl)) return;
    window.history.replaceState({}, "", canonicalUrl);
    setRoute(parsed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await directoryActions.getDirectoryMapsConfig();
        if (cancelled) return;
        setMapsConfig(config || null);
        setMapsConfigError("");
        cacheMapsConfig(config || null);
      } catch (error) {
        if (cancelled) return;
        setMapsConfigError(String(error?.message || "Map config unavailable."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await directoryActions.listDirectoryGeoLanding({
          regionToken: "nationwide",
          dateWindow: "this_week",
        });
        if (cancelled) return;
        setHeroStats({
          total: Number(result?.counts?.total || 0) || 0,
          generatedAtMs: Number(result?.generatedAtMs || 0) || 0,
          token: String(result?.token || "nationwide"),
        });
      } catch {
        if (!cancelled) setHeroStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const routeToken = String(route.page || MARKETING_ROUTE_PAGES.discover)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");
    trackEvent(`mk_page_view_${routeToken}`, {
      route: route.page || MARKETING_ROUTE_PAGES.discover,
      id: route.id || "",
    });
  }, [route.page, route.id]);

  useEffect(() => {
    setSeoEntity(null);
  }, [route.page, route.id]);

  useEffect(() => {
    applyMarketingSeo({
      page: route.page,
      id: route.id,
      params: route.params,
    }, {
      entity: seoEntity,
    });
  }, [route.page, route.id, route.params, seoEntity]);

  const buildRelativeHref = useCallback((pageOrRoute = MARKETING_ROUTE_PAGES.discover, id = "", params = {}) => {
    const nextRoute = normalizeRouteInput(pageOrRoute, id, params);
    if (marketingFlags.routePathsEnabled) return buildMarketingUrl(nextRoute);
    const legacyBase = buildLegacyMarketingQuery(nextRoute);
    const legacySearch = buildMarketingSearch(nextRoute);
    const separator = legacyBase.includes("?") && legacySearch ? "&" : "";
    return `${legacyBase}${legacySearch ? `${separator}${legacySearch.replace(/^\?/, "")}` : ""}`;
  }, []);

  const buildHref = useCallback((pageOrRoute = MARKETING_ROUTE_PAGES.discover, id = "", params = {}) => {
    const relativeHref = buildRelativeHref(pageOrRoute, id, params);
    if (typeof window === "undefined") return relativeHref;

    const marketingBase = buildSurfaceUrl({ surface: "marketing" }, window.location);
    const targetUrl = new URL(relativeHref, marketingBase);
    const currentSurface = inferSurfaceFromHostname(window.location.hostname, window.location);
    const targetOrigin = String(targetUrl.origin || "").trim().toLowerCase();
    const currentOrigin = String(window.location.origin || "").trim().toLowerCase();

    if (currentSurface && currentSurface !== "marketing" && targetOrigin && targetOrigin !== currentOrigin) {
      return targetUrl.toString();
    }
    return `${targetUrl.pathname}${targetUrl.search}`;
  }, [buildRelativeHref]);

  const navigate = useCallback((pageOrRoute = MARKETING_ROUTE_PAGES.discover, id = "", params = {}, options = {}) => {
    if (typeof window === "undefined") return;
    const nextRoute = normalizeRouteInput(pageOrRoute, id, params);
    const nextHref = buildHref(nextRoute);
    const nextUrl = new URL(`${nextHref}${window.location.hash || ""}`, window.location.origin);

    if (nextUrl.origin !== window.location.origin) {
      window.location.assign(nextUrl.toString());
      return;
    }

    if (options?.replace) {
      window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    } else {
      window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
    setRoute(nextRoute);
    collapseNavMenus();
    trackEvent("marketing_directory_navigate", { page: nextRoute.page || MARKETING_ROUTE_PAGES.discover });
  }, [buildHref, collapseNavMenus]);

  const onMarketingAnchorClick = useCallback((event, pageOrRoute = MARKETING_ROUTE_PAGES.discover, id = "", params = {}, options = {}) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.altKey
      || event.ctrlKey
      || event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(pageOrRoute, id, params, options);
  }, [navigate]);

  const scrollAuthPanelIntoView = useCallback(() => {
    authPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

  const buildHostSurfaceAuthHref = useCallback(({ intent = "", targetType = "", targetId = "", returnRoute = null } = {}) => {
    if (typeof window === "undefined") return "";
    const currentRoute = normalizeRouteInput(route);
    const plannedReturn = normalizeRouteInput(returnRoute || currentRoute);
    const authParams = {
      ...pickCampaignParams(plannedReturn.params || {}),
      intent: String(intent || "").trim() || "continue",
      targetType: String(targetType || "").trim(),
      targetId: String(targetId || "").trim(),
      return_to: buildMarketingUrl(plannedReturn),
    };
    if (marketingFlags.routePathsEnabled) {
      return buildSurfaceUrl({
        surface: "host",
        path: "host-access",
        params: authParams,
      }, window.location);
    }
    return buildSurfaceUrl({
      surface: "host",
      params: {
        mode: "marketing",
        page: MARKETING_ROUTE_PAGES.hostAccess,
        ...authParams,
      },
    }, window.location);
  }, [route]);

  const requireFullAuth = useCallback(({
    intent = "",
    targetType = "",
    targetId = "",
    returnRoute = null,
    preferHostSurface = false,
  } = {}) => {
    if (isAuthed && !isAnonymous) return true;

    if (preferHostSurface) {
      const nextHref = buildHostSurfaceAuthHref({ intent, targetType, targetId, returnRoute });
      if (nextHref && typeof window !== "undefined") {
        window.location.href = nextHref;
      }
    } else {
      const currentRoute = normalizeRouteInput(route);
      const plannedReturn = normalizeRouteInput(returnRoute || currentRoute);
      const nextRoute = {
        page: MARKETING_ROUTE_PAGES.hostAccess,
        id: "",
        params: {
          intent: String(intent || "").trim() || "continue",
          targetType: String(targetType || "").trim(),
          targetId: String(targetId || "").trim(),
          return_to: buildMarketingUrl(plannedReturn),
        },
      };
      navigate(nextRoute, "", {}, { replace: true });
      scrollAuthPanelIntoView();
    }

    trackEvent("mk_persona_cta_click", {
      persona: "auth_gate",
      cta: `auth_required_${String(intent || "continue").toLowerCase()}`,
      targetType: String(targetType || ""),
      targetId: String(targetId || ""),
    });
    return false;
  }, [buildHostSurfaceAuthHref, isAnonymous, isAuthed, navigate, route, scrollAuthPanelIntoView]);

  const resolvePostAuthReturn = useCallback(() => {
    const currentRoute = normalizeRouteInput(readRouteFromWindow());
    const returnToHref = String(currentRoute.params?.return_to || "").trim();
    const intent = String(currentRoute.params?.intent || "").trim();
    const targetType = String(currentRoute.params?.targetType || "").trim();
    const targetId = String(currentRoute.params?.targetId || "").trim();
    if (!returnToHref) {
      const fallbackRoute = currentRoute.page === MARKETING_ROUTE_PAGES.hostAccess
        ? { page: MARKETING_ROUTE_PAGES.hostAccess, id: "", params: stripIntentParams(currentRoute.params) }
        : {
          ...currentRoute,
          params: stripIntentParams(currentRoute.params),
        };
      navigate(fallbackRoute, "", {}, { replace: true });
      return;
    }
    const parsedReturnRoute = normalizeRouteInput(parseMarketingRouteFromHref(returnToHref));
    const nextRoute = {
      ...parsedReturnRoute,
      params: {
        ...(parsedReturnRoute.params || {}),
        ...(intent ? { intent } : {}),
        ...(targetType ? { targetType } : {}),
        ...(targetId ? { targetId } : {}),
      },
    };
    navigate(nextRoute, "", {}, { replace: true });
  }, [navigate]);

  const activePage = useMemo(() => normalizePage(route.page), [route.page]);
  const isHostAccessPage = activePage === MARKETING_ROUTE_PAGES.hostAccess;
  const isHostProductPage = activePage === MARKETING_ROUTE_PAGES.forHosts || isHostAccessPage;
  const isGuestsHomePage = activePage === MARKETING_ROUTE_PAGES.forFans;
  const campaignContext = useMemo(() => {
    const preserved = pickCampaignParams(route.params || {});
    const variant = inferCampaignVariant(preserved);
    const utmSourceDefault = variant === "paid"
      ? "paid_media"
      : variant === "social"
        ? "social"
        : "owned";
    const utmMediumDefault = variant === "paid"
      ? "paid"
      : variant === "social"
        ? "social"
        : "web";
    return {
      variant,
      params: {
        utm_source: String(preserved.utm_source || utmSourceDefault),
        utm_medium: String(preserved.utm_medium || utmMediumDefault),
        utm_campaign: String(preserved.utm_campaign || "launch_week_2026"),
        utm_content: String(preserved.utm_content || ""),
        utm_term: String(preserved.utm_term || ""),
        utm_id: String(preserved.utm_id || ""),
        campaign_variant: String(preserved.campaign_variant || variant),
      },
    };
  }, [route.params]);
  const withCampaignParams = useCallback((overrides = {}) => {
    const next = {
      ...campaignContext.params,
      ...pickCampaignParams(overrides),
    };
    if (!next.campaign_variant) {
      next.campaign_variant = inferCampaignVariant(next);
    }
    return next;
  }, [campaignContext.params]);
  const hostDashboardHref = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildSurfaceUrl({
      surface: "host",
      params: {
        mode: "host",
        hostUiVersion: "v2",
        view: "ops",
        section: "ops.room_setup",
        tab: "admin",
      },
    }, window.location);
  }, []);
  const hostAccessResumeHref = useMemo(() => {
    if (typeof window === "undefined") return "";
    const returnTo = marketingFlags.routePathsEnabled
      ? "/host-access?intent=host_dashboard_resume"
      : "/?mode=marketing&page=host_access&intent=host_dashboard_resume";
    return marketingFlags.routePathsEnabled
      ? buildSurfaceUrl({
        surface: "host",
        path: "host-access",
        params: {
          intent: "host_dashboard_resume",
          targetType: "host_dashboard",
          return_to: returnTo,
        },
      }, window.location)
      : buildSurfaceUrl({
        surface: "host",
        params: {
          mode: "marketing",
          page: MARKETING_ROUTE_PAGES.hostAccess,
          intent: "host_dashboard_resume",
          targetType: "host_dashboard",
          return_to: returnTo,
        },
      }, window.location);
  }, []);
  const currentSurface = useMemo(() => {
    if (typeof window === "undefined") return "";
    return inferSurfaceFromHostname(window.location.hostname, window.location);
  }, []);
  const isHostSurface = currentSurface === "host";
  const hostAccessHandoffRef = useRef("");
  const openHostDashboard = useCallback((source = "marketing_nav") => {
    if (typeof window === "undefined") return;
    trackEvent("mk_nav_host_dashboard_click", {
      source: String(source || "marketing_nav"),
      authed: hasFullAccount ? 1 : 0,
    });
    const nextHref = currentSurface === "host" && hasFullAccount
      ? (
        hostDashboardHref
        || buildSurfaceUrl({ surface: "host", params: { mode: "host" } }, window.location)
      )
      : (
        hostAccessResumeHref
        || buildSurfaceUrl({ surface: "host", params: { mode: "host" } }, window.location)
      );
    window.location.href = nextHref;
  }, [currentSurface, hasFullAccount, hostAccessResumeHref, hostDashboardHref]);
  const openHostAuthGate = useCallback((options = {}) => {
    if (typeof window === "undefined") return;
    const nextHref = buildHostSurfaceAuthHref(options);
    if (!nextHref) return;
    window.location.href = nextHref;
  }, [buildHostSurfaceAuthHref]);
  const continueToHostLogin = useCallback((source = "host_access_root_handoff") => {
    trackEvent("mk_nav_host_access_click", { source });
    openHostAuthGate({
      intent: String(route.params?.intent || "").trim() || "continue",
      targetType: String(route.params?.targetType || "").trim(),
      targetId: String(route.params?.targetId || "").trim(),
      returnRoute: {
        page: MARKETING_ROUTE_PAGES.hostAccess,
        params: {
          ...withCampaignParams(route.params || {}),
          ...stripIntentParams(route.params || {}),
        },
      },
    });
  }, [openHostAuthGate, route.params, withCampaignParams]);

  const applyForHostAccess = useCallback(async (source = "marketing_host_apply") => {
    if (!hasFullAccount) {
      requireFullAuth({
        intent: "host_apply",
        targetType: "session",
        returnRoute: {
          page: MARKETING_ROUTE_PAGES.hostAccess,
          params: withCampaignParams({ utm_content: source }),
        },
        preferHostSurface: true,
      });
      return;
    }
    setHostApplicationBusy(true);
    setHostApplicationNotice("");
    try {
      const payload = await directoryActions.submitMarketingWaitlist({
        name: session.email || session.uid || "BeauRocks Host Applicant",
        email: session.email || "",
        useCase: "host_application",
        source,
      });
      setHostApplicationNotice(String(payload?.message || "Application submitted. We will review your host request."));
      trackEvent("mk_host_application_submitted", { source });
    } catch (error) {
      setHostApplicationNotice(String(error?.message || "Could not submit host application right now."));
    } finally {
      setHostApplicationBusy(false);
    }
  }, [hasFullAccount, requireFullAuth, session.email, session.uid, withCampaignParams]);

  const hostApplicationStatus = String(session?.applicationStatus || "").trim().toLowerCase();
  const hostAccessLoading = !!session?.hostAccessLoading;
  const hostAccessRetryRequired = !!session?.hostAccessRetryRequired;

  const refreshPendingHostApplicationsCount = useCallback(async () => {
    if (!session?.isAdmin) {
      setPendingHostApplicationsCount(0);
      return 0;
    }
    try {
      const payload = await directoryActions.listHostApplications({
        status: "pending",
        limit: 100,
      });
      const count = Array.isArray(payload?.items) ? payload.items.length : 0;
      setPendingHostApplicationsCount(count);
      return count;
    } catch {
      return 0;
    }
  }, [session?.isAdmin]);

  useEffect(() => {
    if (!isHostAccessPage) return;
    if (!route.params?.intent) return;
    scrollAuthPanelIntoView();
  }, [isHostAccessPage, route.params?.intent, scrollAuthPanelIntoView]);

  useEffect(() => {
    const intent = String(route.params?.intent || "").trim().toLowerCase();
    if (!hasFullAccount || !session.hasHostWorkspaceAccess) return;
    if (intent !== "host_dashboard_resume") return;
    const resumeHref = resolveHostDashboardReturnHref(route.params?.return_to, window.location);
    if (resumeHref) {
      window.location.href = resumeHref;
      return;
    }
    openHostDashboard("host_resume_after_login");
  }, [hasFullAccount, openHostDashboard, route.params?.intent, route.params?.return_to, session.hasHostWorkspaceAccess]);

  useEffect(() => {
    const intent = String(route.params?.intent || "").trim().toLowerCase();
    const targetType = String(route.params?.targetType || "").trim().toLowerCase();
    if (!isHostAccessPage || isHostSurface || hasFullAccount) return;
    if (intent !== "host_dashboard_resume" && targetType !== "host_dashboard" && targetType !== "session") return;
    const runKey = `${intent}:${targetType}:${String(route.params?.return_to || "").trim()}`;
    if (hostAccessHandoffRef.current === runKey) return;
    hostAccessHandoffRef.current = runKey;
    continueToHostLogin("host_access_root_auto_handoff");
  }, [
    continueToHostLogin,
    hasFullAccount,
    isHostAccessPage,
    isHostSurface,
    route.params?.intent,
    route.params?.return_to,
    route.params?.targetType,
  ]);

  useEffect(() => {
    if (!session?.isAdmin) {
      setPendingHostApplicationsCount(0);
      return () => {};
    }
    refreshPendingHostApplicationsCount();
    const timer = setInterval(() => {
      refreshPendingHostApplicationsCount();
    }, 60000);
    return () => clearInterval(timer);
  }, [refreshPendingHostApplicationsCount, session?.isAdmin]);

  const onAuthSubmit = async (event) => {
    event.preventDefault();
    const email = String(authForm.email || "").trim();
    const password = String(authForm.password || "");
    const confirmPassword = String(authForm.confirmPassword || "");
    setAuthLocalError("");
    setAuthNotice("");
    if (!email || !password) return;
    if (authMode === "signup") {
      if (password.length < 6) {
        setAuthLocalError("Use at least 6 characters for your password.");
        return;
      }
      if (password !== confirmPassword) {
        setAuthLocalError("Password and confirmation do not match.");
        return;
      }
      const result = await actions.signUpWithEmail({ email, password });
      if (result?.ok) {
        trackEvent("marketing_account_signup", { source: "marketing_directory" });
        setAuthForm({ email, password: "", confirmPassword: "" });
        resolvePostAuthReturn();
      }
      return;
    }
    const result = await actions.signInWithEmail({ email, password });
    if (result?.ok) {
      trackEvent("marketing_account_signin", { source: "marketing_directory" });
      resolvePostAuthReturn();
    }
  };

  const onPasswordResetRequest = async () => {
    const email = String(authForm.email || "").trim();
    setAuthLocalError("");
    setAuthNotice("");
    if (!email) {
      setAuthLocalError("Enter your account email, then tap Forgot password.");
      return;
    }
    const result = await actions.requestPasswordReset?.({ email });
    if (result?.ok) {
      setAuthNotice(`Password reset sent to ${email}. Check inbox and spam.`);
      trackEvent("marketing_account_password_reset_requested", { source: "marketing_directory" });
    }
  };

  const navModel = useMemo(
    () => getMarketingNavModel({
      isGuestsHomePage,
      hasFullAccount,
      isModerator: !!session.isModerator,
    }),
    [hasFullAccount, isGuestsHomePage, session.isModerator]
  );
  const navPrimaryOptions = navModel.primary;
  const navSecondaryOptions = navModel.secondary;
  const moreMenuActive = useMemo(
    () => navSecondaryOptions.some((item) => item.id === activePage),
    [activePage, navSecondaryOptions]
  );
  const renderNavItemLabel = useCallback((item) => {
    const badgeCount = item?.id === MARKETING_ROUTE_PAGES.admin ? pendingHostApplicationsCount : 0;
    if (!badgeCount) return item.label;
    return (
      <span className="mk3-nav-item-label">
        <span>{item.label}</span>
        <span className="mk3-nav-item-badge">{badgeCount}</span>
      </span>
    );
  }, [pendingHostApplicationsCount]);
  const openMarketingHostAccess = useCallback((source = "marketing_host_access") => {
    collapseNavMenus();
    if (hasFullAccount) {
      openHostDashboard(source);
      return;
    }
    trackEvent("mk_nav_host_access_click", { source });
    openHostAuthGate({
      intent: "host_dashboard_resume",
      targetType: "host_dashboard",
      returnRoute: {
        page: MARKETING_ROUTE_PAGES.hostAccess,
        params: withCampaignParams({ utm_content: source }),
      },
    });
  }, [collapseNavMenus, hasFullAccount, openHostAuthGate, openHostDashboard, withCampaignParams]);
  const handleNavHostAccess = useCallback(() => {
    openMarketingHostAccess(hasFullAccount ? "marketing_nav_host_dashboard_primary" : "nav_primary_host_login");
  }, [hasFullAccount, openMarketingHostAccess]);

  const postAuthHint = useMemo(() => {
    if (authMode === "signup") {
      return "Create your BeauRocks account in under a minute.";
    }
    if (route.params?.intent) {
      return "Log in with your BeauRocks account and we will return you to your flow.";
    }
    if (activePage === MARKETING_ROUTE_PAGES.profile) {
      return "After sign in, you will land back on your dashboard.";
    }
    return "Create or log in with your BeauRocks account to save follows, RSVPs, and check-ins.";
  }, [activePage, authMode, route.params?.intent]);
  const pageNode = useMemo(() => {
    const pageProps = {
      id: route.id,
      route,
      navigate,
      session,
      mapsConfig,
      heroStats,
      changelogEntries: MARKETING_PUBLIC_CHANGELOG,
      releaseLabel: MARKETING_RELEASE_LABEL,
      authFlow: {
        requireFullAuth,
      },
      pendingHostApplicationsCount,
      onHostApplicationsChanged: refreshPendingHostApplicationsCount,
      buildHref,
      setSeoEntity,
      onHostLogin: () => openMarketingHostAccess(hasFullAccount ? "fans_home_host_dashboard" : "fans_home_host_login"),
    };
    if (activePage === MARKETING_ROUTE_PAGES.discover) return <DiscoverPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.demo) return <DemoExperiencePage {...pageProps} demoMode="abstract" />;
    if (activePage === MARKETING_ROUTE_PAGES.demoAuto) return <DemoExperiencePage {...pageProps} demoMode="auto" />;
    if (activePage === MARKETING_ROUTE_PAGES.changelog) return <ChangelogPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.hostAccess) return <ForHostsPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.venue) return <VenuePage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.event) return <EventPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.host) return <HostPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.performer) return <PerformerPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.session) return <RoomSessionPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.profile) return <ProfileDashboardPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.submit) return <ListingSubmissionPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.admin) return <AdminModerationPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.forHosts) return <ForHostsPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.forVenues) return <ForVenuesPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.forPerformers) return <ForPerformersPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.forFans) return <ForFansPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.join) return <JoinPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.geoCity || activePage === MARKETING_ROUTE_PAGES.geoRegion) {
      return <GeoLandingPage {...pageProps} />;
    }
    return <DiscoverPage {...pageProps} />;
  }, [activePage, requireFullAuth, route, navigate, mapsConfig, heroStats, session, pendingHostApplicationsCount, refreshPendingHostApplicationsCount, buildHref, setSeoEntity, openMarketingHostAccess, hasFullAccount]);

  return (
    <div className="mk3-site mk3-site-cinematic mk3-site-synthwave" data-page={activePage}>
      <div className="mk3-cinematic-backdrop" aria-hidden="true">
        <span className="mk3-cinematic-orb is-gold" />
        <span className="mk3-cinematic-orb is-cyan" />
        <span className="mk3-cinematic-orb is-ember" />
        <span className="mk3-cinematic-grid" />
      </div>
      <header className="mk3-nav">
        <div className="mk3-shell mk3-shell-nav">
          <div className="mk3-nav-inner">
            <a
              className="mk3-brand"
              href={buildHref(MARKETING_ROUTE_PAGES.forFans, "", withCampaignParams({ utm_content: "nav_brand" }))}
              onClick={(event) => {
                collapseNavMenus();
                onMarketingAnchorClick(event, MARKETING_ROUTE_PAGES.forFans, "", withCampaignParams({ utm_content: "nav_brand" }));
              }}
            >
              <img src={MARKETING_BRAND_NEON_URL} alt="BeauRocks Karaoke logo" />
              <div>
                <strong>{PRODUCT_BRAND.name}</strong>
                <span>{PRODUCT_BRAND.tagline}</span>
              </div>
            </a>
            <div className="mk3-nav-center">
              <nav className="mk3-links" aria-label="Primary">
                {navPrimaryOptions.map((item) => (
                  <a
                    key={item.id}
                    href={buildHref(item.id, "", withCampaignParams({ utm_content: `nav_primary_${item.id}` }))}
                    className={activePage === item.id ? "active" : ""}
                    onClick={(event) => {
                      collapseNavMenus();
                      onMarketingAnchorClick(event, item.id, "", withCampaignParams({ utm_content: `nav_primary_${item.id}` }));
                    }}
                  >
                    {renderNavItemLabel(item)}
                  </a>
                ))}
                {navSecondaryOptions.length > 0 && (
                  <div
                    ref={moreMenuRef}
                    className={`mk3-more-menu ${moreMenuOpen ? "is-open" : ""} ${moreMenuActive ? "is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="mk3-more-trigger"
                      aria-haspopup="menu"
                      aria-expanded={moreMenuOpen}
                      aria-controls="mk3-more-menu-list"
                      onClick={() => setMoreMenuOpen((open) => !open)}
                    >
                      More
                    </button>
                    <div
                      id="mk3-more-menu-list"
                      className="mk3-more-list"
                      role="menu"
                      hidden={!moreMenuOpen}
                    >
                      {navSecondaryOptions.map((item) => (
                        <a
                          key={item.id}
                          href={buildHref(item.id, "", withCampaignParams({ utm_content: `nav_secondary_${item.id}` }))}
                          className={activePage === item.id ? "active" : ""}
                          role="menuitem"
                          onClick={(event) => {
                            collapseNavMenus();
                            onMarketingAnchorClick(event, item.id, "", withCampaignParams({ utm_content: `nav_secondary_${item.id}` }));
                          }}
                        >
                          {renderNavItemLabel(item)}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </nav>
            </div>
            <div className="mk3-account">
              <button
                type="button"
                className="mk3-account-action"
                onClick={handleNavHostAccess}
              >
                {hasFullAccount ? "Host Dashboard" : "Host Login"}
              </button>
              <button
                type="button"
                className="mk3-mobile-toggle"
                aria-expanded={mobileMenuOpen}
                aria-controls="mk3-mobile-menu"
                onClick={() => setMobileMenuOpen((open) => !open)}
              >
                Menu
              </button>
            </div>
          </div>
          <div id="mk3-mobile-menu" className={mobileMenuOpen ? "mk3-mobile-menu is-open" : "mk3-mobile-menu"}>
            <div className="mk3-mobile-link-grid">
              {navPrimaryOptions.map((item) => (
                <a
                  key={item.id}
                  href={buildHref(item.id, "", withCampaignParams({ utm_content: `mobile_primary_${item.id}` }))}
                  className={activePage === item.id ? "active" : ""}
                  onClick={(event) => {
                    collapseNavMenus();
                    onMarketingAnchorClick(event, item.id, "", withCampaignParams({ utm_content: `mobile_primary_${item.id}` }));
                  }}
                >
                  {renderNavItemLabel(item)}
                </a>
              ))}
              {navSecondaryOptions.map((item) => (
                <a
                  key={item.id}
                  href={buildHref(item.id, "", withCampaignParams({ utm_content: `mobile_secondary_${item.id}` }))}
                  className={activePage === item.id ? "active" : ""}
                  onClick={(event) => {
                    collapseNavMenus();
                    onMarketingAnchorClick(event, item.id, "", withCampaignParams({ utm_content: `mobile_secondary_${item.id}` }));
                  }}
                >
                  {renderNavItemLabel(item)}
                </a>
              ))}
              <button
                type="button"
                className="mk3-account-action mk3-mobile-host-access"
                onClick={handleNavHostAccess}
              >
                {hasFullAccount ? "Open Host Dashboard" : "Host Login"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mk3-main">
        <div className="mk3-shell mk3-shell-main">
          {mapsConfigError && <div className="mk3-status mk3-status-error">{mapsConfigError}</div>}

          {!!route.params?.intent && (!session?.isAuthed || session?.isAnonymous) && (
            <div className="mk3-status mk3-status-warning">
              <strong>Log in with your BeauRocks account to keep going.</strong>
              <span>We will bounce you right back to the action you picked.</span>
            </div>
          )}

          {isHostAccessPage ? (
          <section className="mk3-auth-panel mk3-host-canon-surface" ref={authPanelRef}>
            <div>
              <h1 className="mk3-host-canon-title is-xl">Host Login And Applications</h1>
              <p className="mk3-host-canon-copy">
                Approved hosts sign in here to open Host Dashboard. New hosts can apply for access, and every application is reviewed before approval.
              </p>
              <div className="mk3-private-pill-row mk3-host-canon-chip-row">
                <span className="mk3-private-pill mk3-host-canon-chip">BeauRocks account required</span>
                <span className="mk3-private-pill mk3-host-canon-chip">Application review</span>
                <span className="mk3-private-pill mk3-host-canon-chip">Direct Host Dashboard access</span>
              </div>
              {heroStats?.total > 0 && (
                <div className="mk3-status mk3-hero-proof">
                  <strong>{heroStats.total.toLocaleString()} live listings and counting</strong>
                  <span>Updated {formatDateTime(heroStats.generatedAtMs)}</span>
                </div>
              )}
              <div className="mk3-value-points">
                <span>Guests can still join with a room code, but hosting always stays account-backed.</span>
                <span>Host access is granted through application review, not self-serve unlock codes.</span>
                <span>Once approved, you create rooms and run the night from Host Dashboard.</span>
              </div>
              {hasFullAccount && session.hasHostWorkspaceAccess && (
                <div className="mk3-auth-cta-row">
                  <button
                    type="button"
                    className="mk3-auth-cta-primary mk3-host-canon-button is-primary"
                    onClick={() => openHostDashboard("host_access_left_panel_open_dashboard")}
                  >
                    Open Host Dashboard
                  </button>
                </div>
              )}
            </div>
            <div className="mk3-auth-box mk3-host-canon-surface is-muted">
              {hasFullAccount ? (
                <div className="mk3-auth-state">
                  <div>Signed in as {session.email || session.uid}.</div>
                  {session.hasHostWorkspaceAccess ? (
                    <div className="mk3-actions-inline">
                      <button className="mk3-host-canon-button is-primary" type="button" onClick={() => openHostDashboard("host_access_signed_in_open_dashboard")}>Open Host Dashboard</button>
                    </div>
                  ) : (hostAccessLoading || hostAccessRetryRequired) ? (
                    <>
                      <div className="mk3-status">
                        <strong>{hostAccessLoading ? "Checking host access" : "Secure sign-in still settling"}</strong>
                        <span>
                          {hostAccessLoading
                            ? "We are confirming your host approval before showing application actions."
                            : "Your secure sign-in is still finishing. Check again in a moment instead of reapplying."}
                        </span>
                      </div>
                      <div className="mk3-actions-inline">
                        <button
                          className="mk3-host-canon-button is-primary"
                          type="button"
                          onClick={() => actions.refreshHostAccessStatus?.()}
                          disabled={session.authLoading || session.hostAccessLoading}
                        >
                          {session.hostAccessLoading ? "Checking..." : "Check Host Access Again"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mk3-status mk3-status-warning">
                        <strong>
                          {hostApplicationStatus === "approved"
                            ? "Host approval complete"
                            : hostApplicationStatus === "rejected"
                              ? "Host application not approved"
                              : hostApplicationStatus === "pending"
                                ? "Host application pending review"
                                : "Apply for host access"}
                        </strong>
                        <span>
                          {hostApplicationStatus === "approved"
                            ? "Refresh or reopen Host Dashboard if approval was granted very recently."
                            : hostApplicationStatus === "rejected"
                              ? "This application is currently closed. Reach out if you need another review."
                              : hostApplicationStatus === "pending"
                                ? "Your request is in review. BeauRocks admins were notified, the application is reviewed by hand, and this same email/account will unlock host sign-in if approved."
                                : "Apply now. We notify BeauRocks admins, review the request by hand, and unlock host sign-in on this same email/account if approved."}
                        </span>
                      </div>
                      <div className="mk3-actions-inline">
                        <button
                          className="mk3-host-canon-button is-primary"
                          type="button"
                          onClick={() => applyForHostAccess("host_access_signed_in_apply")}
                          disabled={hostApplicationBusy || hostApplicationStatus === "pending"}
                        >
                          {hostApplicationBusy ? "Saving..." : (hostApplicationStatus === "pending" ? "Request Submitted" : "Join Early Host Queue")}
                        </button>
                      </div>
                      {!!hostApplicationNotice && <div className="mk3-status">{hostApplicationNotice}</div>}
                    </>
                  )}
                  <div className="mk3-auth-support-row">
                    <button className="mk3-auth-link" type="button" onClick={actions.signOutAccount} disabled={session.authLoading}>
                      {session.authLoading ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </div>
              ) : !isHostSurface ? (
                <div className="mk3-auth-state">
                  <div className="mk3-status mk3-status-warning">
                    <strong>Host sign-in continues on the host app.</strong>
                    <span>The marketing site explains the flow, but host authentication finishes on `host.beaurocks.app` so your session can open the real dashboard correctly.</span>
                  </div>
                  <div className="mk3-actions-inline">
                    <button
                      className="mk3-host-canon-button is-primary"
                      type="button"
                      onClick={() => continueToHostLogin("host_access_root_handoff_manual")}
                    >
                      Continue To Host Login
                    </button>
                  </div>
                  <div className="mk3-auth-hint">If you already have host access, sign in there and you will land in Host Dashboard.</div>
                </div>
              ) : (
                <form onSubmit={onAuthSubmit}>
                  <div className="mk3-auth-mode-label">Account mode</div>
                  <div className="mk3-toggle-row mk3-auth-mode-tabs" role="tablist" aria-label="Account mode">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === "signin"}
                      className={authMode === "signin" ? "active" : ""}
                      onClick={() => {
                        setAuthMode("signin");
                        setAuthLocalError("");
                        setAuthNotice("");
                        actions.clearAuthError?.();
                      }}
                    >
                      Log In
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === "signup"}
                      className={authMode === "signup" ? "active" : ""}
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthLocalError("");
                        setAuthNotice("");
                        actions.clearAuthError?.();
                      }}
                    >
                      Create BeauRocks Account
                    </button>
                  </div>
                  <label>
                    Email
                    <input
                      type="email"
                      autoComplete="email"
                      value={authForm.email}
                      onChange={(e) => {
                        setAuthForm((prev) => ({ ...prev, email: e.target.value }));
                        setAuthLocalError("");
                        setAuthNotice("");
                        actions.clearAuthError?.();
                      }}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                      value={authForm.password}
                      onChange={(e) => {
                        setAuthForm((prev) => ({ ...prev, password: e.target.value }));
                        setAuthLocalError("");
                        setAuthNotice("");
                        actions.clearAuthError?.();
                      }}
                      required
                      minLength={6}
                    />
                  </label>
                  {authMode === "signup" && (
                    <label>
                      Confirm Password
                      <input
                        type="password"
                        autoComplete="new-password"
                          value={authForm.confirmPassword}
                          onChange={(e) => {
                            setAuthForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                            setAuthLocalError("");
                            setAuthNotice("");
                            actions.clearAuthError?.();
                          }}
                        required
                        minLength={6}
                      />
                    </label>
                  )}
                  <button
                    type="submit"
                    disabled={session.authLoading}
                  >
                    {session.authLoading
                      ? "Working..."
                      : authMode === "signup"
                        ? "Create BeauRocks Account"
                        : "Log In"}
                  </button>
                  {authMode === "signin" && (
                    <div className="mk3-auth-support-row">
                      <button
                        type="button"
                        className="mk3-auth-link"
                        onClick={onPasswordResetRequest}
                        disabled={session.authLoading}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                  <div className="mk3-auth-hint">{postAuthHint}</div>
                  {authNotice && <div className="mk3-status">{authNotice}</div>}
                  {authLocalError && <div className="mk3-status mk3-status-error">{authLocalError}</div>}
                  {session.authError && <div className="mk3-status mk3-status-error">{session.authError}</div>}
                </form>
              )}
            </div>
          </section>
          ) : null}

          {!isHostAccessPage && (
            <div className="mk3-page-stage">
              <Suspense fallback={<PageShellLoader />}>
                {pageNode}
              </Suspense>
            </div>
          )}

          {!isHostAccessPage && (
            <footer className="mk3-site-footer" aria-label="Marketing quick links">
              <div className="mk3-site-footer-brand">
                <img src={MARKETING_BRAND_NEON_URL} alt="BeauRocks Karaoke logo" loading="lazy" />
                <div>
                  <strong>{PRODUCT_BRAND.name}</strong>
                  <span>Live rooms, real hosts, and one shared room signal.</span>
                </div>
              </div>
              <div className="mk3-site-footer-links">
                <a
                  href={buildHref(MARKETING_ROUTE_PAGES.forFans, "", withCampaignParams({ utm_content: "footer_overview" }))}
                  onClick={(event) => onMarketingAnchorClick(event, MARKETING_ROUTE_PAGES.forFans, "", withCampaignParams({ utm_content: "footer_overview" }))}
                >
                  Overview
                </a>
                <a
                  href={buildHref(MARKETING_ROUTE_PAGES.discover, "", withCampaignParams({ utm_content: "footer_discover" }))}
                  onClick={(event) => onMarketingAnchorClick(event, MARKETING_ROUTE_PAGES.discover, "", withCampaignParams({ utm_content: "footer_discover" }))}
                >
                  Discover
                </a>
                <a
                  href={buildHref(MARKETING_ROUTE_PAGES.join, "", withCampaignParams({ utm_content: "footer_join" }))}
                  onClick={(event) => onMarketingAnchorClick(event, MARKETING_ROUTE_PAGES.join, "", withCampaignParams({ utm_content: "footer_join" }))}
                >
                  Join
                </a>
              </div>
              <div className="mk3-site-footer-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (hasFullAccount) {
                      openHostDashboard("marketing_footer_host_dashboard");
                      return;
                    }
                    openMarketingHostAccess("footer_host_login");
                  }}
                >
                  {hasFullAccount ? "Open Host Dashboard" : "Host Login"}
                </button>
              </div>
            </footer>
          )}

        </div>
      </main>
      {!isHostProductPage
        && activePage !== MARKETING_ROUTE_PAGES.discover
        && activePage !== MARKETING_ROUTE_PAGES.forFans
        && activePage !== MARKETING_ROUTE_PAGES.demo
        && activePage !== MARKETING_ROUTE_PAGES.demoAuto && (
        <Suspense fallback={null}>
          <GoldenPathRail
            navigate={navigate}
            muted={activePage === MARKETING_ROUTE_PAGES.profile && !hasFullAccount}
          />
        </Suspense>
      )}
    </div>
  );
};

export default MarketingSite;
