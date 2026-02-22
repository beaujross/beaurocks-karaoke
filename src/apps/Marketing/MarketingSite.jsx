import React, { useEffect, useMemo, useState } from "react";
import { ASSETS } from "../../lib/assets";
import { trackEvent } from "../../lib/firebase";
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
import "./marketing.css";

const PAGE_OPTIONS = [
  { id: "discover", label: "Discover" },
  { id: "submit", label: "Submit Listing" },
  { id: "profile", label: "My Dashboard" },
  { id: "admin", label: "Marketing Admin" },
];

const normalizePage = (value = "") => {
  const safe = String(value || "").trim().toLowerCase();
  if (
    [
      "discover",
      "venue",
      "event",
      "host",
      "performer",
      "session",
      "profile",
      "submit",
      "admin",
    ].includes(safe)
  ) {
    return safe;
  }
  return "discover";
};

const readRouteFromWindow = () => {
  if (typeof window === "undefined") return { page: "discover", id: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    page: normalizePage(params.get("page") || "discover"),
    id: String(params.get("id") || "").trim(),
  };
};

const MarketingSite = () => {
  const [route, setRoute] = useState(() => readRouteFromWindow());
  const [mapsConfig, setMapsConfig] = useState(null);
  const [mapsConfigError, setMapsConfigError] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const { session, actions } = useDirectorySession();

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const onPopState = () => setRoute(readRouteFromWindow());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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

  const navigate = (page = "discover", id = "") => {
    if (typeof window === "undefined") return;
    const nextPage = normalizePage(page);
    const params = new URLSearchParams(window.location.search);
    params.set("mode", "marketing");
    params.set("page", nextPage);
    if (id) {
      params.set("id", id);
    } else {
      params.delete("id");
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ""}`;
    window.history.pushState({}, "", nextUrl);
    setRoute({ page: nextPage, id: id || "" });
    trackEvent("marketing_directory_navigate", { page: nextPage });
  };

  const onAuthSubmit = async (event) => {
    event.preventDefault();
    const email = String(authForm.email || "").trim();
    const password = String(authForm.password || "");
    if (!email || !password) return;
    if (authMode === "signup") {
      const result = await actions.signUpWithEmail({ email, password });
      if (result?.ok) trackEvent("marketing_account_signup", { source: "marketing_directory" });
      return;
    }
    const result = await actions.signInWithEmail({ email, password });
    if (result?.ok) trackEvent("marketing_account_signin", { source: "marketing_directory" });
  };

  const activePage = useMemo(() => normalizePage(route.page), [route.page]);
  const visiblePageOptions = useMemo(
    () => PAGE_OPTIONS.filter((item) => item.id !== "admin" || session.isModerator),
    [session.isModerator]
  );

  const pageNode = useMemo(() => {
    const pageProps = { id: route.id, navigate, session, mapsConfig };
    if (activePage === "discover") return <DiscoverPage {...pageProps} />;
    if (activePage === "venue") return <VenuePage {...pageProps} />;
    if (activePage === "event") return <EventPage {...pageProps} />;
    if (activePage === "host") return <HostPage {...pageProps} />;
    if (activePage === "performer") return <PerformerPage {...pageProps} />;
    if (activePage === "session") return <RoomSessionPage {...pageProps} />;
    if (activePage === "profile") return <ProfileDashboardPage {...pageProps} />;
    if (activePage === "submit") return <ListingSubmissionPage {...pageProps} />;
    if (activePage === "admin") return <AdminModerationPage {...pageProps} />;
    return <DiscoverPage {...pageProps} />;
  }, [activePage, route.id, mapsConfig, session]);

  return (
    <div className="mk3-site">
      <header className="mk3-nav">
        <div className="mk3-shell mk3-nav-inner">
          <button type="button" className="mk3-brand" onClick={() => navigate("discover")}>
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
            {session.ready && session.isAuthed && session.isAnonymous && <span>Anonymous quick-join active</span>}
            {session.ready && session.isAuthed && !session.isAnonymous && (
              <span>{session.email || `UID ${session.uid.slice(0, 8)}`}</span>
            )}
          </div>
        </div>
      </header>

      <main className="mk3-main">
        <div className="mk3-shell">
          {mapsConfigError && <div className="mk3-status mk3-status-error">{mapsConfigError}</div>}

          <section className="mk3-auth-panel">
            <div>
              <h1>Find karaoke nights fast.</h1>
              <p>
                Browse public listings without login. Sign in to save favorites, check in, and manage your karaoke history in one place.
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
                    <button type="button" onClick={() => navigate("profile")}>Open Dashboard</button>
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
                      {session.isAnonymous ? "Upgrade Account" : "Create Account"}
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
                        ? session.isAnonymous ? "Upgrade Anonymous Account" : "Create BeauRocks Account"
                        : "Sign In"}
                  </button>
                  {session.authError && <div className="mk3-status mk3-status-error">{session.authError}</div>}
                </form>
              )}
            </div>
          </section>

          {pageNode}
        </div>
      </main>
    </div>
  );
};

export default MarketingSite;
