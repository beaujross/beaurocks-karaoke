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

const MAPS_CONFIG_CACHE_KEY = "mk3_maps_config_cache_v1";
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
  if (safe === "home") return MARKETING_ROUTE_PAGES.discover;
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

const MarketingSite = () => {
  const [route, setRoute] = useState(() => readRouteFromWindow());
  const [mapsConfig, setMapsConfig] = useState(() => readCachedMapsConfig());
  const [mapsConfigError, setMapsConfigError] = useState("");
  const [heroStats, setHeroStats] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [authLocalError, setAuthLocalError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const authPanelRef = useRef(null);
  const { session, actions } = useDirectorySession();
  const isAuthed = !!session?.isAuthed;
  const isAnonymous = !!session?.isAnonymous;
  const hasFullAccount = isAuthed && !isAnonymous;

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
    applyMarketingSeo({
      page: route.page,
      id: route.id,
      params: route.params,
    });
  }, [route.page, route.id, route.params]);

  const navigate = useCallback((pageOrRoute = MARKETING_ROUTE_PAGES.discover, id = "", params = {}, options = {}) => {
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
    trackEvent("marketing_directory_navigate", { page: nextRoute.page || MARKETING_ROUTE_PAGES.discover });
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

  useEffect(() => {
    if (!isHostAccessPage) return;
    if (!route.params?.intent) return;
    scrollAuthPanelIntoView();
  }, [isHostAccessPage, route.params?.intent, scrollAuthPanelIntoView]);

  useEffect(() => {
    const intent = String(route.params?.intent || "").trim().toLowerCase();
    if (!hasFullAccount) return;
    if (intent !== "host_dashboard_resume") return;
    openHostDashboard("host_resume_after_login");
  }, [hasFullAccount, openHostDashboard, route.params?.intent]);

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
        const returnTo = String(route.params?.return_to || "").trim();
        if (isHostAccessPage && !returnTo) {
          openHostDashboard("host_access_direct_signup");
          return;
        }
        resolvePostAuthReturn();
      }
      return;
    }
    const result = await actions.signInWithEmail({ email, password });
    if (result?.ok) {
      trackEvent("marketing_account_signin", { source: "marketing_directory" });
      const returnTo = String(route.params?.return_to || "").trim();
      if (isHostAccessPage && !returnTo) {
        openHostDashboard("host_access_direct_signin");
        return;
      }
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
    return <DiscoverPage {...pageProps} />;
  }, [activePage, requireFullAuth, route, navigate, mapsConfig, heroStats, session]);

  return (
    <div className="mk3-site">
      <header className="mk3-nav">
        <div className="mk3-shell">
          <div className="mk3-nav-inner">
            <button
              type="button"
              className="mk3-brand"
              onClick={() => navigate(MARKETING_ROUTE_PAGES.discover, "", withCampaignParams({ utm_content: "nav_brand" }))}
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
                    openHostDashboard("marketing_nav_host_dashboard_primary");
                    return;
                  }
                  trackEvent("mk_nav_host_access_click", { source: "nav_primary_host_access" });
                  requireFullAuth({
                    intent: "host_dashboard_resume",
                    targetType: "session",
                    returnRoute: {
                      page: MARKETING_ROUTE_PAGES.hostAccess,
                      params: {
                        ...withCampaignParams({ utm_content: "nav_primary_host_access" }),
                        intent: "host_dashboard_resume",
                        targetType: "session",
                      },
                    },
                  });
                }}
              >
                {hasFullAccount ? "Host Dashboard" : "Host Access"}
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
            </div>
          </div>
        </div>
      </header>

      <main className="mk3-main">
        <div className="mk3-shell">
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
              <h1 className="mk3-host-canon-title is-xl">Host Login + Direct App Entry</h1>
              <p className="mk3-host-canon-copy">
                Keep host entry simple: log in once, then go straight into Host Dashboard for room setup, room manager, and live controls.
              </p>
              <div className="mk3-private-pill-row mk3-host-canon-chip-row">
                <span className="mk3-private-pill mk3-host-canon-chip">BeauRocks account required</span>
                <span className="mk3-private-pill mk3-host-canon-chip">Direct Host Dashboard entry</span>
                <span className="mk3-private-pill mk3-host-canon-chip">Room history built into Host</span>
              </div>
              <div className="mk3-permission-grid">
                <article className="mk3-host-canon-step">
                  <strong className="mk3-host-canon-step-kicker">Step 1</strong>
                  <span className="mk3-host-canon-step-copy">Log in with your BeauRocks account.</span>
                </article>
                <article className="mk3-host-canon-step">
                  <strong className="mk3-host-canon-step-kicker">Step 2</strong>
                  <span className="mk3-host-canon-step-copy">Open Host Dashboard and create a room or resume one there.</span>
                </article>
                <article className="mk3-host-canon-step">
                  <strong className="mk3-host-canon-step-kicker">Step 3</strong>
                  <span className="mk3-host-canon-step-copy">Run your show in Host Dashboard with TV and audience links.</span>
                </article>
                <article className="mk3-host-canon-step">
                  <strong className="mk3-host-canon-step-kicker">Step 4</strong>
                  <span className="mk3-host-canon-step-copy">Review room history and open recap links after the show.</span>
                </article>
              </div>
              {heroStats?.total > 0 && (
                <div className="mk3-status mk3-hero-proof">
                  <strong>{heroStats.total.toLocaleString()} live listings and counting</strong>
                  <span>Updated {formatDateTime(heroStats.generatedAtMs)}</span>
                </div>
              )}
              <div className="mk3-value-points">
                <span>Guests can still join with a room code, but hosting always stays account-backed.</span>
                <span>Host Dashboard is now the single entry point for create, resume, and room management.</span>
              </div>
              {hasFullAccount && (
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
                  <div className="mk3-actions-inline">
                    <button className="mk3-host-canon-button is-primary" type="button" onClick={() => openHostDashboard("host_access_signed_in_open_dashboard")}>Open Host Dashboard</button>
                  </div>
                  <div className="mk3-auth-support-row">
                    <button className="mk3-auth-link" type="button" onClick={actions.signOutAccount} disabled={session.authLoading}>
                      {session.authLoading ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onAuthSubmit}>
                  <div className="mk3-auth-mode-label">Account mode</div>
                  <div className="mk3-toggle-row" role="tablist" aria-label="Account mode">
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
            <Suspense fallback={<PageShellLoader />}>
              {pageNode}
            </Suspense>
          )}

          {!isHostAccessPage && (
            <footer className="mk3-site-footer mk3-zone" aria-label="Marketing quick links">
              <div className="mk3-actions-inline">
                <button
                  type="button"
                  onClick={() => {
                    if (hasFullAccount) {
                      openHostDashboard("marketing_footer_host_dashboard");
                      return;
                    }
                    navigate(MARKETING_ROUTE_PAGES.hostAccess, "", withCampaignParams({ utm_content: "footer_host_access" }));
                  }}
                >
                  {hasFullAccount ? "Open Host Dashboard" : "Host Access"}
                </button>
              </div>
            </footer>
          )}

        </div>
      </main>
      {!isHostProductPage && activePage !== MARKETING_ROUTE_PAGES.discover && (
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

