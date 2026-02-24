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
const DemoExperiencePage = lazy(() => import("./pages/DemoExperiencePage"));
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
  tagline: "Karaoke, but finally built for actual humans",
  finder: "Setlist Finder",
  tv: "Spotlight TV",
  audience: "Party Mic",
  host: "Host Deck",
};

const PUBLIC_CHANGELOG_ENTRIES = [
  {
    id: "demo",
    surfaceLabel: "Demo Arena",
    routePage: MARKETING_ROUTE_PAGES.demo,
    ctaLabel: "Open demo",
    updatedAt: "2026-02-23",
    highlights: [
      "One scripted flow now shows TV, audience, and host working together in real time.",
      "Reaction waves, guitar vibe-sync, and trivia now play in one clean sequence.",
      "Each scene has direct launch links so you can jump into real surfaces fast.",
    ],
  },
  {
    id: "finder",
    surfaceLabel: PRODUCT_BRAND.finder,
    routePage: MARKETING_ROUTE_PAGES.discover,
    ctaLabel: "Open finder",
    updatedAt: "2026-02-23",
    highlights: [
      "Map + rail now stay tighter so nearby karaoke is faster to scan.",
      "Selected listing gets featured with image, timing, and distance at a glance.",
      "Cards lead with visuals and hosts first, not walls of text.",
    ],
  },
  {
    id: "tv",
    surfaceLabel: PRODUCT_BRAND.tv,
    routePage: MARKETING_ROUTE_PAGES.join,
    ctaLabel: "Open TV entry",
    updatedAt: "2026-02-22",
    highlights: [
      "TV launch steps are cleaner, so setup takes less host brainpower.",
      "Join flow language is now consistent across the full experience.",
      "Public display routing got a reliability pass for live rooms.",
    ],
  },
  {
    id: "audience",
    surfaceLabel: PRODUCT_BRAND.audience,
    routePage: MARKETING_ROUTE_PAGES.forFans,
    ctaLabel: "Open audience",
    updatedAt: "2026-02-22",
    highlights: [
      "Audience flow now feels lighter on mobile with bigger taps and fewer dead ends.",
      "Profiles still carry favorites into compatible game modes like Tight 15.",
      "New guests can join faster without needing a full tutorial.",
    ],
  },
  {
    id: "host",
    surfaceLabel: PRODUCT_BRAND.host,
    routePage: MARKETING_ROUTE_PAGES.forHosts,
    ctaLabel: "Open host",
    updatedAt: "2026-02-21",
    highlights: [
      "Host actions now have clearer next steps mid-show, not just in setup.",
      "Cadence and moderation flows were trimmed for real weekly workflows.",
      "Host, venue, performer, and session profiles now connect more naturally.",
    ],
  },
];

const PRIMARY_PAGE_OPTIONS = [
  { id: MARKETING_ROUTE_PAGES.discover, label: "Setlist Finder" },
  { id: MARKETING_ROUTE_PAGES.forHosts, label: "For Hosts" },
  { id: MARKETING_ROUTE_PAGES.forVenues, label: "For Venues" },
];

const SECONDARY_PAGE_OPTIONS = [
  { id: MARKETING_ROUTE_PAGES.demo, label: "Try Live Demo" },
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
    <span>Warming up the next scene.</span>
  </div>
);

const normalizePage = (value = "") => {
  const safe = String(value || "").trim().toLowerCase();
  if (safe === "discover") return MARKETING_ROUTE_PAGES.discover;
  if (safe === "demo") return MARKETING_ROUTE_PAGES.demo;
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

const formatReleaseDate = (value = "") => {
  const ms = Date.parse(String(value || ""));
  if (!Number.isFinite(ms)) return "Recent";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(ms);
};

const PRIVATE_TEST_USE_CASE_OPTIONS = [
  "Home Party Host",
  "Fundraiser Organizer",
  "Community Event Host",
  "Venue / KJ Operator",
];

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

  const activePage = useMemo(() => normalizePage(route.page), [route.page]);

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

  const privateAccessUnlocked = !privateTestModeEnabled
    || (hasFullAccount && privateCodeUnlocked);
  const privateAccessLocked = privateTestModeEnabled && !privateAccessUnlocked;
  const visibleSecondaryOptions = useMemo(
    () => SECONDARY_PAGE_OPTIONS.filter((item) => item.id !== MARKETING_ROUTE_PAGES.admin || session.isModerator),
    [session.isModerator]
  );
  const visiblePrimaryOptions = useMemo(
    () => (privateAccessLocked
      ? [{ id: MARKETING_ROUTE_PAGES.discover, label: "Find Karaoke" }]
      : PRIMARY_PAGE_OPTIONS),
    [privateAccessLocked]
  );
  const gatedSecondaryOptions = useMemo(
    () => (privateAccessLocked ? [] : visibleSecondaryOptions),
    [privateAccessLocked, visibleSecondaryOptions]
  );
  const moreMenuActive = useMemo(
    () => gatedSecondaryOptions.some((item) => item.id === activePage),
    [activePage, gatedSecondaryOptions]
  );

  const postAuthHint = useMemo(() => {
    if (privateAccessLocked) {
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
  }, [activePage, authMode, privateAccessLocked, privateInviteRequired, route.params?.intent]);
  const publicChangelog = useMemo(
    () => PUBLIC_CHANGELOG_ENTRIES
      .map((entry) => {
        const updatedAtMs = Date.parse(String(entry.updatedAt || ""));
        return {
          ...entry,
          updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
          updatedLabel: formatReleaseDate(entry.updatedAt),
        };
      })
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs),
    []
  );
  const latestReleaseMs = publicChangelog[0]?.updatedAtMs || 0;

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
    if (activePage === MARKETING_ROUTE_PAGES.demo) return <DemoExperiencePage {...pageProps} />;
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
              {visiblePrimaryOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activePage === item.id ? "active" : ""}
                  onClick={() => navigate(item.id)}
                >
                  {item.label}
                </button>
              ))}
              {gatedSecondaryOptions.length > 0 && (
                <details className={`mk3-more-menu ${moreMenuActive ? "is-active" : ""}`}>
                  <summary>More</summary>
                  <div className="mk3-more-list">
                    {gatedSecondaryOptions.map((item) => (
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
              )}
            </nav>
            <div className="mk3-account">
              <button
                type="button"
                className="mk3-account-action"
                onClick={() => {
                  if (privateAccessLocked) {
                    navigate(MARKETING_ROUTE_PAGES.discover);
                    return;
                  }
                  if (hasFullAccount) {
                    navigate(MARKETING_ROUTE_PAGES.profile);
                    return;
                  }
                  setAuthMode("signup");
                  scrollAuthPanelIntoView();
                }}
              >
                {privateAccessLocked
                  ? "View Listings"
                  : (hasFullAccount ? "Dashboard" : "Create Account")}
              </button>
              <button
                type="button"
                className="mk3-account-link"
                onClick={() => {
                  if (hasFullAccount) {
                    actions.signOutAccount();
                    return;
                  }
                  if (privateAccessLocked && !canCreatePrivateHostAccount) {
                    setPrivateAccessNotice("");
                    setPrivateAccessError("Enter a valid host access code first.");
                    scrollAuthPanelIntoView();
                    return;
                  }
                  setAuthMode("signin");
                  scrollAuthPanelIntoView();
                }}
              >
                {hasFullAccount ? "Sign out" : (privateAccessLocked ? "Host sign in" : "Sign in")}
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
              {visiblePrimaryOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activePage === item.id ? "active" : ""}
                  onClick={() => navigate(item.id)}
                >
                  {item.label}
                </button>
              ))}
              {gatedSecondaryOptions.map((item) => (
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
              <strong>Sign in to keep going.</strong>
              <span>We will bounce you right back to the action you picked.</span>
            </div>
          )}

          <section className={`mk3-auth-panel${privateAccessLocked ? " is-private-focus" : ""}`} ref={authPanelRef}>
            <div>
              {privateAccessLocked ? (
                <>
                  <h1>Public Listings + Private Host Beta</h1>
                  <p>
                    Explore live karaoke listings now. Host account creation stays invite-only while we run private
                    pilot groups.
                  </p>
                  <div className="mk3-private-pill-row">
                    <span className="mk3-private-pill">Invite-only</span>
                    <span className="mk3-private-pill">Friendly host pilots</span>
                    <span className="mk3-private-pill">Human connection first</span>
                  </div>
                  <div className="mk3-auth-cta-row">
                    <button
                      type="button"
                      className="mk3-auth-cta-primary"
                      onClick={() => navigate(MARKETING_ROUTE_PAGES.discover)}
                    >
                      Explore Live Listings
                    </button>
                  </div>
                  <form className="mk3-private-apply-form" onSubmit={onPrivateApplySubmit}>
                    <h2>Apply for private test access</h2>
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
                        onClick={() => {
                          setAuthMode("signin");
                          scrollAuthPanelIntoView();
                        }}
                      >
                        I Have A Code
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
                </>
              ) : (
                <>
                  <h1>{PRODUCT_BRAND.name}</h1>
                  <p>
                    We believe people are what we are missing most right now. BeauRocks helps you find karaoke nights,
                    then turns your phone from passive scrolling into real in-room interaction.
                  </p>
                  <div className="mk3-surface-grid">
                    <article>
                      <strong>{PRODUCT_BRAND.finder}</strong>
                      <span>Find nights by location, host, or vibe</span>
                    </article>
                    <article>
                      <strong>{PRODUCT_BRAND.tv}</strong>
                      <span>Shared room screen for everyone</span>
                    </article>
                    <article>
                      <strong>{PRODUCT_BRAND.audience}</strong>
                      <span>Audience phone controls and reactions</span>
                    </article>
                    <article>
                      <strong>{PRODUCT_BRAND.host}</strong>
                      <span>Host controls without touching TV</span>
                    </article>
                  </div>
                  {heroStats?.total > 0 && (
                    <div className="mk3-status mk3-hero-proof">
                      <strong>{heroStats.total.toLocaleString()} live listings and counting</strong>
                      <span>Updated {formatDateTime(heroStats.generatedAtMs)}</span>
                    </div>
                  )}
                  <div className="mk3-value-points">
                    <span>Yes, your phone is still your pacifier, but now it helps you meet people around you.</span>
                    <span>Profiles link hosts, venues, performers, and sessions so finding your people gets easier each night.</span>
                  </div>
                  <div className="mk3-permission-grid">
                    <article>
                      <strong>No account needed</strong>
                      <span>Browse listings, host pages, and event details right away.</span>
                    </article>
                    <article>
                      <strong>With account</strong>
                      <span>Save follows, RSVP reminders, check-ins, and your activity history.</span>
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
                          Find A Karaoke Night
                        </button>
                        <button
                          type="button"
                          className="mk3-auth-cta-secondary"
                          onClick={() => {
                            setAuthMode("signup");
                            scrollAuthPanelIntoView();
                          }}
                        >
                          Create Free Account
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="mk3-auth-cta-primary"
                          onClick={() => navigate(MARKETING_ROUTE_PAGES.profile)}
                        >
                          Open My Dashboard
                        </button>
                        <button
                          type="button"
                          className="mk3-auth-cta-secondary"
                          onClick={() => navigate(MARKETING_ROUTE_PAGES.discover)}
                        >
                          Back To Finder
                        </button>
                      </>
                    )}
                  </div>
                </>
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
                    <strong>Host login is hidden until invite unlock.</strong>
                    <span>Enter a valid host code below to enable sign in and account creation.</span>
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
                  <h3>Host Access Code</h3>
                  <p>
                    {privateInviteRequired
                      ? "Got invited? Drop your code below to unlock host onboarding."
                      : "Host onboarding is currently open for invited testers."}
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

          {privateAccessLocked ? (
            <>
              <Suspense fallback={<PageShellLoader />}>
                {pageNode}
              </Suspense>
              <section className="mk3-private-locked-panel mk3-zone" aria-label="Private test locked">
                <h2>Browse public listings now. Host onboarding stays invite-only.</h2>
                <p>
                  You can explore the map and listings freely. Host account creation is unlocked by invite code.
                </p>
                <div className="mk3-private-locked-grid">
                  <article>
                    <strong>New applicants</strong>
                    <span>Send the short form and we will review your use case.</span>
                  </article>
                  <article>
                    <strong>Invited hosts</strong>
                    <span>Use your host code above, then create your account.</span>
                  </article>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="mk3-public-changelog mk3-zone mk3-zone-changelog" aria-label="Public changelog">
                <div className="mk3-public-changelog-head">
                  <h2>What We Shipped</h2>
                  <span>Short notes by surface</span>
                </div>
                <div className="mk3-public-changelog-grid">
                  {publicChangelog.map((entry) => (
                    <article key={entry.id} className="mk3-public-changelog-card">
                      <div className="mk3-public-changelog-meta">
                        <strong>{entry.surfaceLabel}</strong>
                        <span>{`Updated ${entry.updatedLabel}`}</span>
                        {entry.updatedAtMs > 0 && entry.updatedAtMs === latestReleaseMs && (
                          <em>Latest</em>
                        )}
                      </div>
                      <ul>
                        {entry.highlights.map((line) => (
                          <li key={`${entry.id}:${line}`}>{line}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => {
                          trackEvent("mk_public_changelog_surface_open", {
                            surface: entry.id,
                            route: entry.routePage,
                          });
                          navigate(entry.routePage);
                        }}
                      >
                        {entry.ctaLabel}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <Suspense fallback={<PageShellLoader />}>
                {pageNode}
              </Suspense>
            </>
          )}
        </div>
      </main>
      {!privateAccessLocked && (
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

