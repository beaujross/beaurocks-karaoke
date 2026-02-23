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
import "./marketing.css";

const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
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
  tagline: "Voice-first party game platform",
  finder: "Setlist Finder",
  tv: "Spotlight TV",
  audience: "Party Mic",
  host: "Host Deck",
};

const PRIMARY_PAGE_OPTIONS = [
  { id: MARKETING_ROUTE_PAGES.discover, label: "Setlist Finder" },
  { id: MARKETING_ROUTE_PAGES.forHosts, label: "For Hosts" },
  { id: MARKETING_ROUTE_PAGES.forVenues, label: "For Venues" },
];

const SECONDARY_PAGE_OPTIONS = [
  { id: MARKETING_ROUTE_PAGES.forPerformers, label: "For Performers" },
  { id: MARKETING_ROUTE_PAGES.forFans, label: "For Fans" },
  { id: MARKETING_ROUTE_PAGES.submit, label: "Submit Listing" },
  { id: MARKETING_ROUTE_PAGES.profile, label: "Dashboard" },
  { id: MARKETING_ROUTE_PAGES.join, label: "Join By Code" },
  { id: MARKETING_ROUTE_PAGES.admin, label: "Marketing Admin" },
];

const PageShellLoader = () => (
  <div className="mk3-status">
    <strong>Loading page...</strong>
    <span>Preparing the next surface.</span>
  </div>
);

const normalizePage = (value = "") => {
  const safe = String(value || "").trim().toLowerCase();
  if (safe === "discover") return MARKETING_ROUTE_PAGES.discover;
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

const MarketingSite = () => {
  const [route, setRoute] = useState(() => readRouteFromWindow());
  const [mapsConfig, setMapsConfig] = useState(null);
  const [mapsConfigError, setMapsConfigError] = useState("");
  const [heroStats, setHeroStats] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [authLocalError, setAuthLocalError] = useState("");
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
    if (!hasLegacyQuery) return;

    const parsed = normalizeRouteInput(parseMarketingRouteFromLocation(window.location));
    const canonicalPath = buildMarketingPath(parsed);
    const nextUrl = `${canonicalPath}${window.location.hash || ""}`;
    if (window.location.pathname !== canonicalPath || window.location.search) {
      window.history.replaceState({}, "", nextUrl);
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
      ...currentRoute,
      params: {
        ...currentRoute.params,
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
      const cleared = {
        ...currentRoute,
        params: stripIntentParams(currentRoute.params),
      };
      navigate(cleared, "", {}, { replace: true });
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

  const onAuthSubmit = async (event) => {
    event.preventDefault();
    const email = String(authForm.email || "").trim();
    const password = String(authForm.password || "");
    const confirmPassword = String(authForm.confirmPassword || "");
    setAuthLocalError("");
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

  const activePage = useMemo(() => normalizePage(route.page), [route.page]);
  const visibleSecondaryOptions = useMemo(
    () => SECONDARY_PAGE_OPTIONS.filter((item) => item.id !== MARKETING_ROUTE_PAGES.admin || session.isModerator),
    [session.isModerator]
  );
  const moreMenuActive = useMemo(
    () => visibleSecondaryOptions.some((item) => item.id === activePage),
    [activePage, visibleSecondaryOptions]
  );

  const postAuthHint = useMemo(() => {
    if (authMode === "signup") {
      return "Create account uses email + password + confirm password. No duplicate email entry needed.";
    }
    if (route.params?.intent) {
      return "After sign in, we'll return you to your selected action.";
    }
    if (activePage === MARKETING_ROUTE_PAGES.profile) {
      return "After sign in, you'll return to your dashboard.";
    }
    return "Create an account to save favorites, RSVPs, and check-ins.";
  }, [activePage, authMode, route.params?.intent]);

  const pageNode = useMemo(() => {
    const pageProps = {
      id: route.id,
      route,
      navigate,
      session,
      mapsConfig,
      authFlow: {
        requireFullAuth,
      },
    };
    if (activePage === MARKETING_ROUTE_PAGES.discover) return <DiscoverPage {...pageProps} />;
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
  }, [activePage, requireFullAuth, route, navigate, mapsConfig, session]);

  return (
    <div className="mk3-site">
      <header className="mk3-nav">
        <div className="mk3-shell">
          <div className="mk3-nav-inner">
            <button type="button" className="mk3-brand" onClick={() => navigate(MARKETING_ROUTE_PAGES.discover)}>
              <img src="/images/logo-library/beaurocks-karaoke-logo-2.png" alt="BeauRocks Karaoke logo" />
              <div>
                <strong>{PRODUCT_BRAND.name}</strong>
                <span>{PRODUCT_BRAND.tagline}</span>
              </div>
            </button>
            <nav className="mk3-links" aria-label="Primary">
              {PRIMARY_PAGE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activePage === item.id ? "active" : ""}
                  onClick={() => navigate(item.id)}
                >
                  {item.label}
                </button>
              ))}
              <details className={`mk3-more-menu ${moreMenuActive ? "is-active" : ""}`}>
                <summary>More</summary>
                <div className="mk3-more-list">
                  {visibleSecondaryOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={activePage === item.id ? "active" : ""}
                      onClick={() => navigate(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </details>
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
                  setAuthMode("signup");
                  scrollAuthPanelIntoView();
                }}
              >
                {hasFullAccount ? "Dashboard" : "Create Account"}
              </button>
              <button
                type="button"
                className="mk3-account-link"
                onClick={() => {
                  if (hasFullAccount) {
                    actions.signOutAccount();
                    return;
                  }
                  setAuthMode("signin");
                  scrollAuthPanelIntoView();
                }}
              >
                {hasFullAccount ? "Sign out" : "Sign in"}
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
              {PRIMARY_PAGE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activePage === item.id ? "active" : ""}
                  onClick={() => navigate(item.id)}
                >
                  {item.label}
                </button>
              ))}
              {visibleSecondaryOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activePage === item.id ? "active" : ""}
                  onClick={() => navigate(item.id)}
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
              <strong>Create an account or sign in to continue your action.</strong>
              <span>After sign-in, we will return you to your selected CTA.</span>
            </div>
          )}

          <section className="mk3-auth-panel" ref={authPanelRef}>
            <div>
              <h1>{PRODUCT_BRAND.name}</h1>
              <p>
                One platform for social singing and voice-driven party play: discover live karaoke, run interactive
                TV moments, join from mobile, and keep the room connected with host controls.
              </p>
              <div className="mk3-surface-grid">
                <article>
                  <strong>{PRODUCT_BRAND.finder}</strong>
                  <span>Discover venues and events</span>
                </article>
                <article>
                  <strong>{PRODUCT_BRAND.tv}</strong>
                  <span>Main room display surface</span>
                </article>
                <article>
                  <strong>{PRODUCT_BRAND.audience}</strong>
                  <span>Singer + audience mobile app</span>
                </article>
                <article>
                  <strong>{PRODUCT_BRAND.host}</strong>
                  <span>Host control surface</span>
                </article>
              </div>
              {heroStats?.total > 0 && (
                <div className="mk3-status mk3-hero-proof">
                  <strong>{heroStats.total.toLocaleString()} public listings available now</strong>
                  <span>Updated {formatDateTime(heroStats.generatedAtMs)}</span>
                </div>
              )}
              <div className="mk3-value-points">
                <span>Setlist Finder pairs a live map with a synced listing rail for fast navigation.</span>
                <span>Profiles stay linked across hosts, venues, singers, sessions, and party moments.</span>
              </div>
              <div className="mk3-permission-grid">
                <article>
                  <strong>No account needed</strong>
                  <span>Browse the {PRODUCT_BRAND.finder} listings, geo pages, and event details.</span>
                </article>
                <article>
                  <strong>With account</strong>
                  <span>Save follows, RSVP reminders, check-ins, and dashboard history.</span>
                </article>
              </div>
              <div className="mk3-auth-cta-row">
                {!hasFullAccount ? (
                  <>
                    <button
                      type="button"
                      className="mk3-auth-cta-primary"
                      onClick={() => navigate(MARKETING_ROUTE_PAGES.discover)}
                    >
                      Find Karaoke Near Me
                    </button>
                    <button
                      type="button"
                      className="mk3-auth-cta-secondary"
                      onClick={() => {
                        setAuthMode("signup");
                        scrollAuthPanelIntoView();
                      }}
                    >
                      Create Account
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="mk3-auth-cta-primary"
                      onClick={() => navigate(MARKETING_ROUTE_PAGES.profile)}
                    >
                      Open Dashboard
                    </button>
                    <button
                      type="button"
                      className="mk3-auth-cta-secondary"
                      onClick={() => navigate(MARKETING_ROUTE_PAGES.discover)}
                    >
                      Open Setlist Finder
                    </button>
                  </>
                )}
              </div>
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
                      onClick={() => {
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
                  <button type="submit" disabled={session.authLoading}>
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
              )}
            </div>
          </section>
          <Suspense fallback={<PageShellLoader />}>
            {pageNode}
          </Suspense>
        </div>
      </main>
      <Suspense fallback={null}>
        <GoldenPathRail
          navigate={navigate}
          muted={activePage === MARKETING_ROUTE_PAGES.profile && !hasFullAccount}
        />
      </Suspense>
    </div>
  );
};

export default MarketingSite;

