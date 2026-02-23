import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASSETS } from "../../lib/assets";
import { trackEvent } from "../../lib/firebase";
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
import DiscoverPage from "./pages/DiscoverPage";
import VenuePage from "./pages/VenuePage";
import EventPage from "./pages/EventPage";
import HostPage from "./pages/HostPage";
import PerformerPage from "./pages/PerformerPage";
import RoomSessionPage from "./pages/RoomSessionPage";
import ProfileDashboardPage from "./pages/ProfileDashboardPage";
import ListingSubmissionPage from "./pages/ListingSubmissionPage";
import AdminModerationPage from "./pages/AdminModerationPage";
import ForHostsPage from "./pages/ForHostsPage";
import ForVenuesPage from "./pages/ForVenuesPage";
import ForPerformersPage from "./pages/ForPerformersPage";
import ForFansPage from "./pages/ForFansPage";
import JoinPage from "./pages/JoinPage";
import GeoLandingPage from "./pages/GeoLandingPage";
import GoldenPathRail from "./pages/GoldenPathRail";
import "./marketing.css";

const PAGE_OPTIONS = [
  { id: MARKETING_ROUTE_PAGES.discover, label: "Discover" },
  { id: MARKETING_ROUTE_PAGES.forHosts, label: "For Hosts" },
  { id: MARKETING_ROUTE_PAGES.forVenues, label: "For Venues" },
  { id: MARKETING_ROUTE_PAGES.forPerformers, label: "For Performers" },
  { id: MARKETING_ROUTE_PAGES.forFans, label: "For Fans" },
  { id: MARKETING_ROUTE_PAGES.submit, label: "Submit Listing" },
  { id: MARKETING_ROUTE_PAGES.profile, label: "My Dashboard" },
  { id: MARKETING_ROUTE_PAGES.admin, label: "Marketing Admin" },
];
const KITSAP_SCHEDULE_IMAGE_PATH = "/images/marketing/kitsap-karaoke-schedule.jpg";
const KITSAP_SCHEDULE_CSV_PATH = "/data/kitsap_karaoke_schedule.csv";

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
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const authPanelRef = useRef(null);
  const { session, actions } = useDirectorySession();
  const isAuthed = !!session?.isAuthed;
  const isAnonymous = !!session?.isAnonymous;

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const onPopState = () => setRoute(readRouteFromWindow());
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
    if (!email || !password) return;
    if (authMode === "signup") {
      const result = await actions.signUpWithEmail({ email, password });
      if (result?.ok) {
        trackEvent("marketing_account_signup", { source: "marketing_directory" });
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
  const visiblePageOptions = useMemo(
    () => PAGE_OPTIONS.filter((item) => item.id !== MARKETING_ROUTE_PAGES.admin || session.isModerator),
    [session.isModerator]
  );

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
        <div className="mk3-shell mk3-nav-inner">
          <button type="button" className="mk3-brand" onClick={() => navigate(MARKETING_ROUTE_PAGES.discover)}>
            <img src={ASSETS.logo} alt="BeauRocks" />
            <div>
              <strong>BeauRocks Directory</strong>
              <span>Nationwide Karaoke Discovery</span>
            </div>
          </button>
          <nav className="mk3-links">
            {visiblePageOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activePage === item.id ? "active" : ""}
                onClick={() => navigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mk3-account">
            {!session.ready && <span>Initializing account...</span>}
            {session.ready && !session.isAuthed && <span>Guest browsing enabled</span>}
            {session.ready && session.isAuthed && session.isAnonymous && <span>Create an account to save activity</span>}
            {session.ready && session.isAuthed && !session.isAnonymous && (
              <span>{session.email || `UID ${session.uid.slice(0, 8)}`}</span>
            )}
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
              <h1>Find karaoke nights fast.</h1>
              <p>
                Browse public listings without login. Create an account to save favorites, check in, and manage your karaoke history in one place.
              </p>
              <div className="mk3-value-points">
                <span>Live map + synced discovery rail</span>
                <span>Host, venue, and performer profiles</span>
                <span>One account across directory features</span>
              </div>
            </div>
            <div className="mk3-auth-box">
              {session.isAuthed && !session.isAnonymous ? (
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
                      onClick={() => setAuthMode("signin")}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      className={authMode === "signup" ? "active" : ""}
                      onClick={() => setAuthMode("signup")}
                    >
                      Create Account
                    </button>
                  </div>
                  <label>
                    Email
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                      required
                      minLength={6}
                    />
                  </label>
                  <button type="submit" disabled={session.authLoading}>
                    {session.authLoading
                      ? "Working..."
                      : authMode === "signup"
                        ? "Create BeauRocks Account"
                        : "Sign In"}
                  </button>
                  {session.authError && <div className="mk3-status mk3-status-error">{session.authError}</div>}
                </form>
              )}
            </div>
          </section>
          <section className="mk3-kitsap-resource">
            <img src={KITSAP_SCHEDULE_IMAGE_PATH} alt="Kitsap karaoke weekly schedule screenshot" />
            <div className="mk3-kitsap-resource-content">
              <div className="mk3-chip">kitsap local guide</div>
              <h3>Local Kitsap Karaoke Schedule</h3>
              <p>
                Screenshot and spreadsheet for local karaoke nights across Kitsap regions.
              </p>
              <div className="mk3-actions-inline">
                <a href={KITSAP_SCHEDULE_IMAGE_PATH} target="_blank" rel="noreferrer">
                  Open Screenshot
                </a>
                <a href={KITSAP_SCHEDULE_CSV_PATH} download>
                  Download Spreadsheet
                </a>
                <a href={KITSAP_SCHEDULE_CSV_PATH} target="_blank" rel="noreferrer">
                  Open Spreadsheet
                </a>
              </div>
            </div>
          </section>

          {pageNode}
        </div>
      </main>
      <GoldenPathRail navigate={navigate} />
    </div>
  );
};

export default MarketingSite;
