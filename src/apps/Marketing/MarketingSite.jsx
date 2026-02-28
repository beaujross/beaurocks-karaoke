import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "./lib/marketingAnalytics";
import { marketingFlags } from "./featureFlags";
import {
  MARKETING_ROUTE_PAGES,
  buildLegacyMarketingQuery,
  buildMarketingSearch,
  buildMarketingUrl,
  buildMarketingPath,
  parseMarketingRouteFromHref,
  parseMarketingRouteFromLocation,
} from "./routing";
import { applyMarketingSeo } from "./seo";
import { directoryActions } from "./api/directoryApi";
import { useDirectorySession } from "./hooks/useDirectorySession";
import { formatDateTime } from "./pages/shared";
import { buildSurfaceUrl } from "../../lib/surfaceDomains";
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
  tagline: "Premium karaoke tech for legendary hosts",
  finder: "Setlist Finder",
  tv: "Spotlight TV",
  audience: "Party Mic",
  host: "Host Deck",
};

const PageShellLoader = () => (
  <div className="mk3-status">
    <strong>Loading page...</strong>
    <span>Warming up the next scene.</span>
  </div>
);

const normalizePage = (value = "") => {
  const safe = String(value || "").trim().toLowerCase();
  if (safe === "home") return MARKETING_ROUTE_PAGES.forHosts;
  if (safe === "discover") return MARKETING_ROUTE_PAGES.discover;
  if (safe === "demo") return MARKETING_ROUTE_PAGES.demo;
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
  return MARKETING_ROUTE_PAGES.forHosts;
};

const normalizeRouteInput = (pageOrRoute = MARKETING_ROUTE_PAGES.forHosts, id = "", params = {}) => {
  if (typeof pageOrRoute === "object" && pageOrRoute) {
    return {
      page: normalizePage(pageOrRoute.page || MARKETING_ROUTE_PAGES.forHosts),
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

const PRIVATE_TEST_USE_CASE_OPTIONS = [
  "Home Party Host",
  "Fundraiser Organizer",
  "Community Event Host",
  "Venue / KJ Operator",
];

const HOME_INTEREST_USE_CASE_OPTIONS = [
  "Founding Host",
  "Venue Partner",
  "Performer Creator",
  "Guest / Fan",
];

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

const parsePrivateInviteCodes = (value = "") => {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(/[,\n;|]/g);
  const seen = new Set();
  const list = [];
  source.forEach((entry) => {
    const code = String(entry || "").trim();
    if (!code) return;
    const normalized = normalizePrivateInviteToken(code);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    list.push(normalized);
  });
  return list;
};

const readPrivateInviteCodes = () => {
  const envCodes = typeof import.meta !== "undefined" && import.meta?.env
    ? String(
      import.meta.env.VITE_MARKETING_PRIVATE_INVITE_CODES
      || import.meta.env.VITE_MARKETING_PRIVATE_INVITE_CODE
      || ""
    )
    : "";
  const overrideRaw = typeof window !== "undefined"
    ? (
      window?.__marketingFlags?.privateInviteCodes
      || window?.__marketingFlags?.privateInviteCode
      || ""
    )
    : "";
  return parsePrivateInviteCodes(overrideRaw || envCodes || "");
};

const normalizePrivateInviteToken = (value = "") =>
  String(value || "").trim().toUpperCase().replace(/[^A-Z0-9@]/g, "");

const PRIVATE_UNLOCK_MAX_LENGTH = 12;

const MarketingSite = () => {
  const [route, setRoute] = useState(() => readRouteFromWindow());
  const [mapsConfig, setMapsConfig] = useState(null);
  const [mapsConfigError, setMapsConfigError] = useState("");
  const [heroStats, setHeroStats] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [authLocalError, setAuthLocalError] = useState("");
  const [privateApplyForm, setPrivateApplyForm] = useState({
    name: "",
    email: "",
    useCase: PRIVATE_TEST_USE_CASE_OPTIONS[0],
  });
  const [privateApplyState, setPrivateApplyState] = useState({
    submitting: false,
    success: "",
    error: "",
    linePosition: 0,
  });
  const [privateAccessError, setPrivateAccessError] = useState("");
  const [privateAccessNotice, setPrivateAccessNotice] = useState("");
  const [privateInviteCodes] = useState(() => readPrivateInviteCodes());
  const [privateCodeEntry, setPrivateCodeEntry] = useState("");
  const [homeInterestForm, setHomeInterestForm] = useState({
    name: "",
    email: "",
    useCase: HOME_INTEREST_USE_CASE_OPTIONS[0],
  });
  const [homeInterestState, setHomeInterestState] = useState({
    submitting: false,
    success: "",
    error: "",
    linePosition: 0,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const authPanelRef = useRef(null);
  const { session, actions } = useDirectorySession();
  const isAuthed = !!session?.isAuthed;
  const isAnonymous = !!session?.isAnonymous;
  const hasFullAccount = isAuthed && !isAnonymous;
  const privateTestModeEnabled = !!marketingFlags.privateTestModeEnabled;
  const privateInviteRequired = privateTestModeEnabled && privateInviteCodes.length > 0;
  const privateInviteStorageKey = "mk3_private_test_invite:global_unlock";
  const normalizedPrivateInviteCodes = useMemo(
    () => parsePrivateInviteCodes(privateInviteCodes),
    [privateInviteCodes]
  );
  const privateUnlockLength = useMemo(() => {
    const longest = normalizedPrivateInviteCodes.reduce((max, code) => Math.max(max, code.length), 0);
    return Math.max(4, Math.min(PRIVATE_UNLOCK_MAX_LENGTH, longest || 6));
  }, [normalizedPrivateInviteCodes]);

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const onPopState = () => {
      setRoute(readRouteFromWindow());
      setMobileMenuOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!marketingFlags.routePathsEnabled) return;
    const params = new URLSearchParams(window.location.search);
    const hasLegacyQuery = params.get("mode") === "marketing" || params.has("page");
    const hasLegacyPath = /^\/marketing(?:\/|$)/i.test(String(window.location.pathname || ""));
    if (!hasLegacyQuery && !hasLegacyPath) return;

    const parsed = normalizeRouteInput(parseMarketingRouteFromLocation(window.location));
    const canonicalUrl = `${buildMarketingUrl(parsed)}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (currentUrl !== canonicalUrl) {
      window.location.replace(canonicalUrl);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await directoryActions.getDirectoryMapsConfig();
        if (!cancelled) setMapsConfig(config || null);
      } catch (error) {
        if (!cancelled) setMapsConfigError(String(error?.message || "Map config unavailable."));
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
    const routeToken = String(route.page || MARKETING_ROUTE_PAGES.forHosts)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");
    trackEvent(`mk_page_view_${routeToken}`, {
      route: route.page || MARKETING_ROUTE_PAGES.forHosts,
      id: route.id || "",
    });
  }, [route.page, route.id]);

  useEffect(() => {
    applyMarketingSeo({
      page: route.page,
      id: route.id,
      params: route.params,
    });
  }, [route.page, route.id, route.params]);

  const navigate = useCallback((pageOrRoute = MARKETING_ROUTE_PAGES.forHosts, id = "", params = {}, options = {}) => {
    if (typeof window === "undefined") return;
    const nextRoute = normalizeRouteInput(pageOrRoute, id, params);

    let nextUrl = "";
    if (marketingFlags.routePathsEnabled) {
      nextUrl = `${buildMarketingUrl(nextRoute)}${window.location.hash || ""}`;
    } else {
      const legacyBase = buildLegacyMarketingQuery(nextRoute);
      const legacySearch = buildMarketingSearch(nextRoute);
      const separator = legacyBase.includes("?") && legacySearch ? "&" : "";
      nextUrl = `${legacyBase}${legacySearch ? `${separator}${legacySearch.replace(/^\?/, "")}` : ""}${window.location.hash || ""}`;
    }

    if (options?.replace) {
      window.history.replaceState({}, "", nextUrl);
    } else {
      window.history.pushState({}, "", nextUrl);
    }
    setRoute(nextRoute);
    setMobileMenuOpen(false);
    trackEvent("marketing_directory_navigate", { page: nextRoute.page || MARKETING_ROUTE_PAGES.forHosts });
  }, []);

  const scrollAuthPanelIntoView = useCallback(() => {
    authPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

  const requireFullAuth = useCallback(({ intent = "", targetType = "", targetId = "", returnRoute = null } = {}) => {
    if (isAuthed && !isAnonymous) return true;
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
    trackEvent("mk_persona_cta_click", {
      persona: "auth_gate",
      cta: `auth_required_${String(intent || "continue").toLowerCase()}`,
      targetType: String(targetType || ""),
      targetId: String(targetId || ""),
    });
    return false;
  }, [isAnonymous, isAuthed, navigate, route, scrollAuthPanelIntoView]);

  const resolvePostAuthReturn = useCallback(() => {
    const currentRoute = normalizeRouteInput(readRouteFromWindow());
    const returnToHref = String(currentRoute.params?.return_to || "").trim();
    const intent = String(currentRoute.params?.intent || "").trim();
    const targetType = String(currentRoute.params?.targetType || "").trim();
    const targetId = String(currentRoute.params?.targetId || "").trim();
    if (!returnToHref) {
      const fallbackRoute = currentRoute.page === MARKETING_ROUTE_PAGES.hostAccess
        ? { page: MARKETING_ROUTE_PAGES.profile, id: "", params: {} }
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
  const goToCampaignRoute = useCallback((page, { cta = "", source = "", utmContent = "" } = {}) => {
    const params = withCampaignParams({
      utm_content: utmContent || cta || source,
    });
    trackEvent("mk_home_launch_cta_click", {
      cta: String(cta || "unknown"),
      source: String(source || "marketing_home"),
      campaign_variant: campaignContext.variant,
      utm_source: params.utm_source,
      utm_medium: params.utm_medium,
      utm_campaign: params.utm_campaign,
      utm_content: params.utm_content,
    });
    navigate(page, "", params);
  }, [campaignContext.variant, navigate, withCampaignParams]);
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
  const openHostDashboard = useCallback((source = "marketing_nav") => {
    if (typeof window === "undefined") return;
    trackEvent("mk_nav_host_dashboard_click", {
      source: String(source || "marketing_nav"),
      authed: hasFullAccount ? 1 : 0,
    });
    const nextHref = hostDashboardHref
      || buildSurfaceUrl({ surface: "host", params: { mode: "host" } }, window.location);
    window.location.href = nextHref;
  }, [hasFullAccount, hostDashboardHref]);
  const openHostPanelDirect = useCallback((source = "marketing_home_host_panel") => {
    if (typeof window === "undefined") return;
    trackEvent("mk_nav_host_dashboard_click", {
      source: String(source || "marketing_home_host_panel"),
      authed: hasFullAccount ? 1 : 0,
    });
    const nextHref = hostDashboardHref
      || buildSurfaceUrl({
        surface: "host",
        params: {
          mode: "host",
          hostUiVersion: "v2",
          view: "ops",
          section: "ops.room_setup",
          tab: "admin",
        },
      }, window.location);
    window.location.href = nextHref;
  }, [hasFullAccount, hostDashboardHref]);
  const trackHomeConversionAction = useCallback((cta = "", surface = "home") => {
    trackEvent("mk_home_conversion_click", {
      cta: String(cta || "unknown"),
      surface: String(surface || "home"),
      campaign_variant: campaignContext.variant,
    });
  }, [campaignContext.variant]);
  const homeHeroPrimaryLabel = campaignContext.variant === "paid"
    ? "Start Founding Host Application"
    : campaignContext.variant === "social"
      ? "Join The Founding Host Wave"
      : "Request Founding Access";
  const homeHeroSubhead = campaignContext.variant === "paid"
    ? "You found us through launch media. Claim your seat in the founding host cohort."
    : campaignContext.variant === "social"
      ? "You found us through the social buzz. Step into the founding host wave."
      : "Most karaoke software helps manage songs. BeauRocks helps you command the whole room.";

  useEffect(() => {
    if (!isHostAccessPage) return;
    if (!route.params?.intent) return;
    scrollAuthPanelIntoView();
  }, [isHostAccessPage, route.params?.intent, scrollAuthPanelIntoView]);

  useEffect(() => {
    if (!marketingFlags.routePathsEnabled) return;
    if (activePage !== MARKETING_ROUTE_PAGES.hostAccess) return;
    const hasAuthIntent = Boolean(
      String(route.params?.intent || "").trim()
      || String(route.params?.return_to || "").trim()
      || String(route.params?.targetType || "").trim()
      || String(route.params?.targetId || "").trim()
    );
    if (hasAuthIntent) return;
    navigate({ page: MARKETING_ROUTE_PAGES.forHosts, id: "", params: {} }, "", {}, { replace: true });
  }, [activePage, navigate, route.params?.intent, route.params?.return_to, route.params?.targetId, route.params?.targetType]);

  const onAuthSubmit = async (event) => {
    event.preventDefault();
    const email = String(authForm.email || "").trim();
    const password = String(authForm.password || "");
    const confirmPassword = String(authForm.confirmPassword || "");
    setAuthLocalError("");
    if (!email || !password) return;
    if (authMode === "signup") {
      if (!canCreatePrivateHostAccount) {
        setAuthLocalError("Unlock private host access first using your access code.");
        return;
      }
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
        if (
          privateTestModeEnabled
          && canCreatePrivateHostAccount
          && (!privateInviteRequired || !!String(privateCodeEntry || "").trim())
        ) {
          await redeemPrivateHostAccess({
            code: privateInviteRequired ? privateCodeEntry : "",
            source: "marketing_signup",
          });
        }
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

  const storePrivateInviteAccess = useCallback((granted = false) => {
    if (typeof window === "undefined" || !privateInviteStorageKey) return;
    try {
      if (granted) {
        window.localStorage.setItem(privateInviteStorageKey, "1");
      } else {
        window.localStorage.removeItem(privateInviteStorageKey);
      }
    } catch {
      // Ignore storage failures for private invite persistence.
    }
  }, [privateInviteStorageKey]);

  const storedPrivateInviteAccess = useMemo(() => {
    if (typeof window === "undefined" || !privateInviteStorageKey) return false;
    try {
      return window.localStorage.getItem(privateInviteStorageKey) === "1";
    } catch {
      return false;
    }
  }, [privateInviteStorageKey]);
  const privateCodeUnlocked = !privateTestModeEnabled || storedPrivateInviteAccess;
  const canCreatePrivateHostAccount = !privateTestModeEnabled || privateCodeUnlocked;

  const redeemPrivateHostAccess = useCallback(async ({ code = "", source = "marketing_site" } = {}) => {
    try {
      await directoryActions.redeemMarketingPrivateHostAccess({
        code: String(code || "").trim(),
        source: String(source || "marketing_site"),
      });
      setPrivateAccessError("");
      setPrivateAccessNotice("Server access granted. Host onboarding is now authorized for this account.");
      return { ok: true };
    } catch (error) {
      const message = String(error?.message || "Could not complete server unlock.");
      setPrivateAccessError(message);
      setPrivateAccessNotice("");
      return { ok: false, error: message };
    }
  }, []);

  const onPrivateApplySubmit = async (event) => {
    event.preventDefault();
    const name = String(privateApplyForm.name || "").trim();
    const email = String(privateApplyForm.email || "").trim().toLowerCase();
    const useCase = String(privateApplyForm.useCase || PRIVATE_TEST_USE_CASE_OPTIONS[0]).trim();
    if (!name || !email) {
      setPrivateApplyState((prev) => ({
        ...prev,
        error: "Name and email are required.",
        success: "",
      }));
      return;
    }
    setPrivateApplyState({ submitting: true, success: "", error: "", linePosition: 0 });
    try {
      const result = await directoryActions.submitMarketingWaitlist({
        name,
        email,
        useCase,
        source: `marketing_private_test:${String(activePage || "discover")}`,
      });
      const linePosition = Number(result?.linePosition || 0) || 0;
      const message = String(result?.message || "Thanks. Your private test application was received.");
      setPrivateApplyState({
        submitting: false,
        success: message,
        error: "",
        linePosition,
      });
      trackEvent("mk_private_test_apply_submit", {
        ok: true,
        isNewSignup: !!result?.isNewSignup,
        linePosition,
        useCase,
      });
    } catch (error) {
      const message = String(error?.message || "Unable to submit your application right now.");
      setPrivateApplyState({
        submitting: false,
        success: "",
        error: message,
        linePosition: 0,
      });
      trackEvent("mk_private_test_apply_submit", {
        ok: false,
        error: message.slice(0, 80),
      });
    }
  };

  const onPrivateAccessSubmit = async (event) => {
    event.preventDefault();
    setPrivateAccessNotice("");
    if (!privateInviteRequired) {
      setPrivateAccessError("");
      if (hasFullAccount) {
        const redeemed = await redeemPrivateHostAccess({ code: "", source: "marketing_unlock_open" });
        if (!redeemed?.ok) return;
        storePrivateInviteAccess(true);
      } else {
        storePrivateInviteAccess(true);
        setPrivateAccessNotice("Unlock staged. Create or sign in to finalize server access.");
      }
      trackEvent("mk_private_test_unlock", { ok: true, method: "no_pin_required" });
      return;
    }

    const supplied = normalizePrivateInviteToken(privateCodeEntry);
    if (!supplied) {
      setPrivateAccessError("Enter your unlock code.");
      return;
    }
    if (!normalizedPrivateInviteCodes.includes(supplied)) {
      setPrivateAccessError("That code did not match. Try again.");
      trackEvent("mk_private_test_unlock", { ok: false, method: "pin_code" });
      return;
    }

    if (hasFullAccount) {
      const redeemed = await redeemPrivateHostAccess({ code: supplied, source: "marketing_unlock_pin" });
      if (!redeemed?.ok) return;
      storePrivateInviteAccess(true);
      setPrivateCodeEntry("");
      setPrivateAccessError("");
    } else {
      storePrivateInviteAccess(true);
      setPrivateAccessNotice("Code accepted. Create or sign in to finalize server access.");
    }
    trackEvent("mk_private_test_unlock", { ok: true, method: "pin_code" });
  };

  const onHomeInterestSubmit = async (event) => {
    event.preventDefault();
    const name = String(homeInterestForm.name || "").trim();
    const email = String(homeInterestForm.email || "").trim().toLowerCase();
    const useCase = String(homeInterestForm.useCase || HOME_INTEREST_USE_CASE_OPTIONS[0]).trim();
    if (!name || !email) {
      setHomeInterestState((prev) => ({
        ...prev,
        error: "Name and email are required.",
        success: "",
      }));
      return;
    }
    setHomeInterestState({
      submitting: true,
      success: "",
      error: "",
      linePosition: 0,
    });
    try {
      const result = await directoryActions.submitMarketingWaitlist({
        name,
        email,
        useCase,
        source: "marketing_home_interest_2026",
      });
      const linePosition = Number(result?.linePosition || 0) || 0;
      const message = String(result?.message || "You are on the priority list.");
      setHomeInterestState({
        submitting: false,
        success: message,
        error: "",
        linePosition,
      });
      trackEvent("mk_home_interest_submit", {
        ok: true,
        useCase,
        linePosition,
      });
    } catch (error) {
      const message = String(error?.message || "Could not submit your interest right now.");
      setHomeInterestState({
        submitting: false,
        success: "",
        error: message,
        linePosition: 0,
      });
      trackEvent("mk_home_interest_submit", {
        ok: false,
        error: message.slice(0, 80),
      });
    }
  };

  const privateAccessUnlocked = !privateTestModeEnabled
    || (hasFullAccount && privateCodeUnlocked);
  const privateAccessLocked = privateTestModeEnabled && !privateAccessUnlocked;
  const navModel = useMemo(
    () => getMarketingNavModel({
      isGuestsHomePage,
      privateAccessLocked,
      hasFullAccount,
      isModerator: !!session.isModerator,
    }),
    [hasFullAccount, isGuestsHomePage, privateAccessLocked, session.isModerator]
  );
  const navPrimaryOptions = navModel.primary;
  const navSecondaryOptions = navModel.secondary;
  const moreMenuActive = useMemo(
    () => navSecondaryOptions.some((item) => item.id === activePage),
    [activePage, navSecondaryOptions]
  );

  const postAuthHint = useMemo(() => {
    if (isHostAccessPage && privateAccessLocked) {
      return privateInviteRequired
        ? "Got a host code? Enter it, then create your account."
        : "Unlock host onboarding to create new private-test accounts.";
    }
    if (authMode === "signup") {
      return "Quick signup: email, password, confirm, done.";
    }
    if (route.params?.intent) {
      return "Sign in and we will drop you right back to what you were doing.";
    }
    if (activePage === MARKETING_ROUTE_PAGES.profile) {
      return "After sign in, you will land back on your dashboard.";
    }
    return "Create an account to save follows, RSVPs, and check-ins.";
  }, [activePage, authMode, isHostAccessPage, privateAccessLocked, privateInviteRequired, route.params?.intent]);
  const pageNode = useMemo(() => {
    const pageProps = {
      id: route.id,
      route,
      navigate,
      session,
      mapsConfig,
      changelogEntries: MARKETING_PUBLIC_CHANGELOG,
      releaseLabel: MARKETING_RELEASE_LABEL,
      authFlow: {
        requireFullAuth,
      },
    };
    if (activePage === MARKETING_ROUTE_PAGES.discover) return <DiscoverPage {...pageProps} />;
    if (activePage === MARKETING_ROUTE_PAGES.demo) return <DemoExperiencePage {...pageProps} />;
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
    return <ForHostsPage {...pageProps} />;
  }, [activePage, requireFullAuth, route, navigate, mapsConfig, session]);

  return (
    <div className="mk3-site">
      <header className="mk3-nav">
        <div className="mk3-shell">
          <div className="mk3-nav-inner">
            <button
              type="button"
              className="mk3-brand"
              onClick={() => navigate(MARKETING_ROUTE_PAGES.forHosts, "", withCampaignParams({ utm_content: "nav_brand" }))}
            >
              <img src="/images/logo-library/beaurocks-karaoke-logo-2.png" alt="BeauRocks Karaoke logo" />
              <div>
                <strong>{PRODUCT_BRAND.name}</strong>
                <span>{PRODUCT_BRAND.tagline}</span>
              </div>
            </button>
            <nav className="mk3-links" aria-label="Primary">
              {navPrimaryOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activePage === item.id ? "active" : ""}
                  onClick={() => navigate(item.id, "", withCampaignParams({ utm_content: `nav_primary_${item.id}` }))}
                >
                  {item.label}
                </button>
              ))}
              {navSecondaryOptions.length > 0 && (
                <details className={`mk3-more-menu ${moreMenuActive ? "is-active" : ""}`}>
                  <summary>More</summary>
                  <div className="mk3-more-list">
                    {navSecondaryOptions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={activePage === item.id ? "active" : ""}
                        onClick={() => navigate(item.id, "", withCampaignParams({ utm_content: `nav_secondary_${item.id}` }))}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </nav>
            <div className="mk3-account">
              <button
                type="button"
                className="mk3-account-action"
                onClick={() => {
                  if (hasFullAccount) {
                    navigate(MARKETING_ROUTE_PAGES.profile);
                    return;
                  }
                  trackEvent("mk_persona_cta_click", { persona: "all", cta: "nav_explore_live_map" });
                  navigate(MARKETING_ROUTE_PAGES.discover, "", withCampaignParams({ utm_content: "nav_explore" }));
                }}
              >
                {hasFullAccount ? "Dashboard" : "Explore"}
              </button>
              <button
                type="button"
                className="mk3-account-link"
                onClick={() => openHostDashboard("marketing_nav_host_dashboard")}
              >
                Host Dashboard
              </button>
              <button
                type="button"
                className="mk3-account-link"
                onClick={() => {
                  if (hasFullAccount) {
                    actions.signOutAccount();
                    return;
                  }
                  trackEvent("mk_nav_host_access_click", { source: "nav_start_hosting" });
                  navigate(MARKETING_ROUTE_PAGES.forHosts, "", withCampaignParams({ utm_content: "nav_start_hosting" }));
                }}
              >
                {hasFullAccount ? "Sign out" : "Start Hosting"}
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
                <button
                  key={item.id}
                  type="button"
                  className={activePage === item.id ? "active" : ""}
                  onClick={() => navigate(item.id, "", withCampaignParams({ utm_content: `mobile_primary_${item.id}` }))}
                >
                  {item.label}
                </button>
              ))}
              {navSecondaryOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activePage === item.id ? "active" : ""}
                  onClick={() => navigate(item.id, "", withCampaignParams({ utm_content: `mobile_secondary_${item.id}` }))}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => openHostDashboard("marketing_mobile_menu_host_dashboard")}
              >
                Host Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mk3-main">
        <div className="mk3-shell">
          {mapsConfigError && <div className="mk3-status mk3-status-error">{mapsConfigError}</div>}

          {!!route.params?.intent && (!session?.isAuthed || session?.isAnonymous) && (
            <div className="mk3-status mk3-status-warning">
              <strong>Sign in to keep going.</strong>
              <span>We will bounce you right back to the action you picked.</span>
            </div>
          )}

          {isHostAccessPage ? (
          <section className={`mk3-auth-panel${privateAccessLocked ? " is-private-focus" : ""}`} ref={authPanelRef}>
            <div>
              <h1>Founding Host Access</h1>
              <p>
                This is where new party leaders enter. We are onboarding hosts in controlled waves so every room
                launches at premium quality from day one.
              </p>
              <div className="mk3-private-pill-row">
                <span className="mk3-private-pill">Invite-only</span>
                <span className="mk3-private-pill">Founding host cohort</span>
                <span className="mk3-private-pill">Quality over scale</span>
              </div>
              <div className="mk3-permission-grid">
                <article>
                  <strong>Step 1</strong>
                  <span>Apply for pilot access or enter your founding code.</span>
                </article>
                <article>
                  <strong>Step 2</strong>
                  <span>Create your account and claim your host identity.</span>
                </article>
                <article>
                  <strong>Step 3</strong>
                  <span>Launch your room across TV, audience, and host control surfaces.</span>
                </article>
                <article>
                  <strong>Not hosting?</strong>
                  <span>Use Live Listings to find premium karaoke nights by host, venue, or vibe.</span>
                </article>
              </div>
              {heroStats?.total > 0 && (
                <div className="mk3-status mk3-hero-proof">
                  <strong>{heroStats.total.toLocaleString()} live listings and counting</strong>
                  <span>Updated {formatDateTime(heroStats.generatedAtMs)}</span>
                </div>
              )}
              <div className="mk3-value-points">
                <span>Technology got us here. We use it to bring people back together in real rooms.</span>
                <span>Your phone stays useful, but now it upgrades connection instead of replacing it.</span>
              </div>
              <div className="mk3-auth-cta-row">
                <button
                  type="button"
                  className="mk3-auth-cta-primary"
                  onClick={() => {
                    if (hasFullAccount) {
                      openHostDashboard("host_access_primary");
                      return;
                    }
                    navigate(
                      MARKETING_ROUTE_PAGES.discover,
                      "",
                      withCampaignParams({ utm_content: "host_access_primary" })
                    );
                  }}
                >
                  {hasFullAccount ? "Open Host Dashboard" : "Back to Live Listings"}
                </button>
                <button
                  type="button"
                  className="mk3-auth-cta-secondary"
                  onClick={() => navigate(MARKETING_ROUTE_PAGES.demo, "", withCampaignParams({ utm_content: "host_access_demo" }))}
                >
                  Watch Demo Walkthrough
                </button>
              </div>
              {privateAccessLocked && (
                <form className="mk3-private-apply-form mk3-private-apply-form-compact" onSubmit={onPrivateApplySubmit}>
                  <h2>Apply for founding host pilot</h2>
                  <div className="mk3-private-apply-grid">
                    <label>
                      Name
                      <input
                        type="text"
                        value={privateApplyForm.name}
                        onChange={(event) => {
                          const next = event.target.value;
                          setPrivateApplyForm((prev) => ({ ...prev, name: next }));
                          setPrivateApplyState((prev) => ({ ...prev, error: "", success: "" }));
                        }}
                        required
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={privateApplyForm.email}
                        onChange={(event) => {
                          const next = event.target.value;
                          setPrivateApplyForm((prev) => ({ ...prev, email: next }));
                          setPrivateApplyState((prev) => ({ ...prev, error: "", success: "" }));
                        }}
                        required
                      />
                    </label>
                    <label>
                      Use case
                      <select
                        value={privateApplyForm.useCase}
                        onChange={(event) => {
                          const next = event.target.value;
                          setPrivateApplyForm((prev) => ({ ...prev, useCase: next }));
                        }}
                      >
                        {PRIVATE_TEST_USE_CASE_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mk3-private-apply-actions">
                    <button type="submit" disabled={privateApplyState.submitting}>
                      {privateApplyState.submitting ? "Sending..." : "Apply"}
                    </button>
                    <button
                      type="button"
                      className="mk3-auth-cta-secondary"
                      onClick={() => navigate(MARKETING_ROUTE_PAGES.forHosts, "", withCampaignParams({ utm_content: "host_access_details" }))}
                    >
                      Host Pilot Details
                    </button>
                  </div>
                  {privateApplyState.success && (
                    <div className="mk3-status">
                      <strong>{privateApplyState.success}</strong>
                      {privateApplyState.linePosition > 0 && (
                        <span>{`You are in line at #${privateApplyState.linePosition}`}</span>
                      )}
                    </div>
                  )}
                  {privateApplyState.error && <div className="mk3-status mk3-status-error">{privateApplyState.error}</div>}
                </form>
              )}
            </div>
            <div className="mk3-auth-box">
              {hasFullAccount ? (
                <div className="mk3-auth-state">
                  <div>Signed in as {session.email || session.uid}.</div>
                  <div className="mk3-actions-inline">
                    <button type="button" onClick={() => navigate(MARKETING_ROUTE_PAGES.profile)}>Open Dashboard</button>
                    <button type="button" onClick={actions.signOutAccount} disabled={session.authLoading}>
                      {session.authLoading ? "Signing out..." : "Sign Out"}
                    </button>
                  </div>
                </div>
              ) : (
                privateAccessLocked && !canCreatePrivateHostAccount ? (
                  <div className="mk3-status mk3-status-warning">
                    <strong>Host login is hidden until access unlock.</strong>
                    <span>Enter a valid founding code below to enable sign in and host account creation.</span>
                  </div>
                ) : (
                  <form onSubmit={onAuthSubmit}>
                    <div className="mk3-toggle-row">
                      <button
                        type="button"
                        className={authMode === "signin" ? "active" : ""}
                        onClick={() => {
                          setAuthMode("signin");
                          setAuthLocalError("");
                          actions.clearAuthError?.();
                        }}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        className={authMode === "signup" ? "active" : ""}
                        disabled={!canCreatePrivateHostAccount}
                        onClick={() => {
                          if (!canCreatePrivateHostAccount) {
                            setAuthMode("signin");
                            setAuthLocalError("Unlock private host access with your access code first.");
                            return;
                          }
                          setAuthMode("signup");
                          setAuthLocalError("");
                          actions.clearAuthError?.();
                        }}
                      >
                        Create Account
                      </button>
                    </div>
                    <label>
                      Email
                      <input
                        type="email"
                        value={authForm.email}
                        onChange={(e) => {
                          setAuthForm((prev) => ({ ...prev, email: e.target.value }));
                          setAuthLocalError("");
                          actions.clearAuthError?.();
                        }}
                        required
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        value={authForm.password}
                        onChange={(e) => {
                          setAuthForm((prev) => ({ ...prev, password: e.target.value }));
                          setAuthLocalError("");
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
                          value={authForm.confirmPassword}
                          onChange={(e) => {
                            setAuthForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                            setAuthLocalError("");
                            actions.clearAuthError?.();
                          }}
                          required
                          minLength={6}
                        />
                      </label>
                    )}
                    <button
                      type="submit"
                      disabled={session.authLoading || (authMode === "signup" && !canCreatePrivateHostAccount)}
                    >
                      {session.authLoading
                        ? "Working..."
                        : authMode === "signup"
                          ? "Create Account"
                          : "Sign In"}
                    </button>
                    <div className="mk3-auth-hint">{postAuthHint}</div>
                    {authLocalError && <div className="mk3-status mk3-status-error">{authLocalError}</div>}
                    {session.authError && <div className="mk3-status mk3-status-error">{session.authError}</div>}
                  </form>
                )
              )}
              {privateTestModeEnabled && (
                <div className="mk3-private-invite-box">
                  <h3>Founding Host Code</h3>
                  <p>
                    {privateInviteRequired
                      ? "Invited to the cohort? Enter your code to unlock founding host onboarding."
                      : "Host onboarding is currently open for invited founding testers."}
                  </p>
                  {canCreatePrivateHostAccount ? (
                    <div className="mk3-status mk3-private-unlocked">
                      <strong>Access unlocked.</strong>
                      <span>You are clear to create a host account.</span>
                    </div>
                  ) : (
                    <form className="mk3-private-invite-form" onSubmit={onPrivateAccessSubmit}>
                      {privateInviteRequired && (
                        <>
                          <label className="mk3-private-pin-input-row">
                            Enter access code
                            <input
                              type="text"
                              value={privateCodeEntry}
                              onChange={(event) => {
                                const normalized = normalizePrivateInviteToken(event.target.value || "");
                                setPrivateCodeEntry(normalized.slice(0, privateUnlockLength));
                                setPrivateAccessError("");
                                setPrivateAccessNotice("");
                              }}
                              maxLength={privateUnlockLength}
                              placeholder="ENTER CODE"
                              autoComplete="off"
                              autoCapitalize="characters"
                              spellCheck={false}
                            />
                          </label>
                          <div className="mk3-private-invite-caption">
                            Codes are not case-sensitive. If yours is stale, ask us for a fresh one.
                          </div>
                        </>
                      )}
                      <button type="submit" className="mk3-private-invite-submit">
                        {privateInviteRequired ? "Unlock Host Onboarding" : "Unlock Access"}
                      </button>
                      {privateAccessNotice && <div className="mk3-status">{privateAccessNotice}</div>}
                      {privateAccessError && <div className="mk3-status mk3-status-error">{privateAccessError}</div>}
                    </form>
                  )}
                </div>
              )}
            </div>
          </section>
          ) : isGuestsHomePage ? (
            <>
              <section className="mk3-home-premium-shell mk3-zone" aria-label="BeauRocks premium launch">
                <div className="mk3-home-premium-main">
                  <div className="mk3-home-premium-kicker">Launch Focus: Founding Host Wave</div>
                  <h1>Launch-Ready Karaoke Nights Start Here.</h1>
                  <p>
                    {homeHeroSubhead}
                    {" "}Primary conversion flow: request host access or jump straight into host controls.
                  </p>
                  <div className="mk3-home-premium-stats">
                    <span>{heroStats?.total > 0 ? `${heroStats.total.toLocaleString()} live listings` : "Live listings updating"}</span>
                    <span>Interest queue drives rollout priority</span>
                    <span>Tester host access is one click away</span>
                  </div>
                  <div className="mk3-auth-cta-row mk3-home-primary-cta">
                    <button
                      type="button"
                      className="mk3-auth-cta-primary"
                      onClick={() => {
                        goToCampaignRoute(MARKETING_ROUTE_PAGES.forHosts, {
                          cta: "hero_request_founding_access",
                          source: "premium_home_hero",
                          utmContent: "home_hero_primary",
                        });
                      }}
                    >
                      {homeHeroPrimaryLabel}
                    </button>
                    <button
                      type="button"
                      className="mk3-auth-cta-secondary"
                      onClick={() => {
                        trackHomeConversionAction("hero_open_host_panel", "premium_home_hero");
                        openHostPanelDirect("home_hero_host_panel");
                      }}
                    >
                      Open Host Panel
                    </button>
                  </div>
                  <div className="mk3-actions-inline">
                    <button
                      type="button"
                      onClick={() => {
                        trackHomeConversionAction("home_secondary_browse_live_listings", "home_primary_actions");
                        navigate(MARKETING_ROUTE_PAGES.discover, "", withCampaignParams({ utm_content: "home_discover_quick" }));
                      }}
                    >
                      Browse Live Listings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        trackHomeConversionAction("home_secondary_view_host_product", "home_primary_actions");
                        navigate(MARKETING_ROUTE_PAGES.forHosts, "", withCampaignParams({ utm_content: "home_host_access_quick" }));
                      }}
                    >
                      View Host Product
                    </button>
                  </div>
                </div>
                <aside className="mk3-home-premium-side" aria-label="Tester fast lane">
                  <strong>Tester Fast Lane</strong>
                  <p>If you are already testing, jump directly into host controls and skip the long path.</p>
                  <div className="mk3-home-premium-side-list">
                    <span>Open host panel instantly</span>
                    <span>Use your room code and begin host flow</span>
                    <span>Return here to submit launch feedback</span>
                  </div>
                  <div className="mk3-auth-cta-row">
                    <button
                      type="button"
                      className="mk3-auth-cta-primary"
                      onClick={() => {
                        trackHomeConversionAction("home_tester_fast_lane_open_host_panel", "home_fast_lane");
                        openHostPanelDirect("home_tester_fast_lane");
                      }}
                    >
                      Open Host Panel
                    </button>
                  </div>
                </aside>
              </section>

              <section className="mk3-home-launch-stack mk3-zone" aria-label="2026 launch path">
                <article className="mk3-home-launch-timeline">
                  <h2>Launch Plan</h2>
                  <p>
                    We are keeping launch scope tight: capture high-intent host interest, onboard qualified testers, and expand only when quality stays high.
                  </p>
                  <div className="mk3-home-launch-steps">
                    <article>
                      <span>Now</span>
                      <strong>Capture Interest + Qualify Hosts</strong>
                      <p>Collect launch intent and prioritize serious hosts for onboarding waves.</p>
                    </article>
                    <article>
                      <span>Next</span>
                      <strong>Scale By Quality Signals</strong>
                      <p>Expand city-by-city using usage, retention, and host outcomes as gates.</p>
                    </article>
                  </div>
                  <div className="mk3-actions-inline">
                    <button
                      type="button"
                      onClick={() => {
                        trackHomeConversionAction("home_launch_plan_open_host_panel", "home_launch_plan");
                        openHostPanelDirect("home_launch_plan_host_panel");
                      }}
                    >
                      Open Host Panel Now
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        trackHomeConversionAction("home_launch_plan_view_host_product", "home_launch_plan");
                        navigate(MARKETING_ROUTE_PAGES.forHosts, "", withCampaignParams({ utm_content: "home_launch_plan_host_access" }));
                      }}
                    >
                      View Host Product Page
                    </button>
                  </div>
                </article>
                <aside className="mk3-home-interest-card">
                  <h3>Get Priority Launch Updates</h3>
                  <p>Join the launch queue. We prioritize outreach based on fit, readiness, and region.</p>
                  <form onSubmit={onHomeInterestSubmit}>
                    <label>
                      Name
                      <input
                        type="text"
                        value={homeInterestForm.name}
                        onChange={(event) => {
                          const next = event.target.value;
                          setHomeInterestForm((prev) => ({ ...prev, name: next }));
                          setHomeInterestState((prev) => ({ ...prev, error: "", success: "" }));
                        }}
                        required
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={homeInterestForm.email}
                        onChange={(event) => {
                          const next = event.target.value;
                          setHomeInterestForm((prev) => ({ ...prev, email: next }));
                          setHomeInterestState((prev) => ({ ...prev, error: "", success: "" }));
                        }}
                        required
                      />
                    </label>
                    <label>
                      I am joining as
                      <select
                        value={homeInterestForm.useCase}
                        onChange={(event) => {
                          const next = event.target.value;
                          setHomeInterestForm((prev) => ({ ...prev, useCase: next }));
                        }}
                      >
                        {HOME_INTEREST_USE_CASE_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" disabled={homeInterestState.submitting}>
                      {homeInterestState.submitting ? "Saving..." : "Join Priority Queue"}
                    </button>
                  </form>
                  {homeInterestState.success && (
                    <div className="mk3-status">
                      <strong>{homeInterestState.success}</strong>
                      {homeInterestState.linePosition > 0 && (
                        <span>{`Queue position: #${homeInterestState.linePosition}`}</span>
                      )}
                    </div>
                  )}
                  {homeInterestState.error && (
                    <div className="mk3-status mk3-status-error">{homeInterestState.error}</div>
                  )}
                </aside>
              </section>
            </>
          ) : null}

          {!isGuestsHomePage && (
            <Suspense fallback={<PageShellLoader />}>
              {pageNode}
            </Suspense>
          )}

          {isHostAccessPage && privateAccessLocked && (
            <section className="mk3-private-locked-panel mk3-zone" aria-label="Private test locked">
              <h2>Live listings are open. Founding host onboarding is invite-only.</h2>
              <p>
                Anyone can browse nights by host, venue, and location. Creating host accounts stays private while we scale quality.
              </p>
              <div className="mk3-private-locked-grid">
                <article>
                  <strong>For guests</strong>
                  <span>Use Live Listings to find the strongest rooms nearby.</span>
                </article>
                <article>
                  <strong>For hosts</strong>
                  <span>Apply here or unlock with a founding host code.</span>
                </article>
              </div>
            </section>
          )}

          <footer className="mk3-site-footer mk3-zone" aria-label="Marketing quick links">
            <div className="mk3-actions-inline">
              <button type="button" onClick={() => navigate(MARKETING_ROUTE_PAGES.forVenues)}>
                For Venues
              </button>
              <button type="button" onClick={() => navigate(MARKETING_ROUTE_PAGES.forPerformers)}>
                For Performers
              </button>
              <button type="button" onClick={() => navigate(MARKETING_ROUTE_PAGES.forFans)}>
                For Guests
              </button>
              <button type="button" onClick={() => navigate(MARKETING_ROUTE_PAGES.changelog)}>
                Product Changelog
              </button>
            </div>
          </footer>

        </div>
      </main>
      {!isHostProductPage && !isGuestsHomePage && (
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

