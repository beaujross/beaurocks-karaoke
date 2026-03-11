import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { buildSurfaceUrl, inferSurfaceFromHostname } from "../../../lib/surfaceDomains";
import { MARKETING_ROUTE_PAGES } from "../routing";
import { marketingFlags } from "../featureFlags";

const HOST_STACK_BADGES = [
  "Early host partner intake",
  "Limited 2026 invite waves",
  "Approved hosts unlock the real dashboard",
];

const HOST_CORE_OUTCOMES = [
  "New host access should feel earned, not like another open signup form.",
  "We are inviting a small set of early host partners in 2026 instead of opening the floodgates all at once.",
  "Approved partners go straight into the real Host Dashboard for room setup, launch, and nightly operations.",
  "The queue helps us onboard the right hosts, markets, and event formats in deliberate waves.",
];

const HOST_STORY_POINTS = [
  "Join the early-access line with your email so we know who to invite first.",
  "We are prioritizing hosts who can run standout karaoke nights, fundraisers, venue programs, and repeatable community events.",
  "When your invite wave opens in 2026, hosting happens in the real Host Dashboard instead of a marketing-side fake panel.",
];

const HOST_SIGNAL_CARDS = [
  {
    label: "Invite Model",
    title: "Deliberately scarce",
    copy: "We are onboarding a limited number of early host partners in 2026 so the product and partner support stay tight.",
  },
  {
    label: "Operator Fit",
    title: "Built for serious hosts",
    copy: "The queue is for hosts who want to run real rooms, build repeat nights, and help shape the operator product.",
  },
  {
    label: "Post-Invite",
    title: "Real host tools only",
    copy: "Approved partners unlock Host Dashboard for room manager, live deck launch, TV links, and nightly controls.",
  },
];

const deriveWaitlistName = (email = "") => {
  const local = String(email || "").split("@")[0] || "";
  const normalized = local
    .replace(/[._+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return normalized || "Early Host Applicant";
};

const ForHostsPage = ({ route, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const autoLaunchIntentRef = useRef("");
  const intakeFormRef = useRef(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestNotice, setRequestNotice] = useState("");
  const [requestEmail, setRequestEmail] = useState(() => String(session?.email || "").trim().toLowerCase());
  const hostApplicationStatus = String(session?.applicationStatus || "").trim().toLowerCase();

  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "host",
      page: "for_hosts",
      cta: String(cta || ""),
    });
  };

  const hostSetupHref = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildSurfaceUrl({
      surface: "host",
      params: {
        mode: "host",
        hostUiVersion: "v2",
        view: "ops",
        section: "ops.room_setup",
        tab: "admin",
        source: "marketing_for_hosts",
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

  useEffect(() => {
    if (!session?.email) return;
    setRequestEmail((current) => current || String(session.email || "").trim().toLowerCase());
  }, [session?.email]);

  const scrollToIntake = useCallback(() => {
    intakeFormRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

  const openHostSetup = useCallback(() => {
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "host_dashboard_resume",
        targetType: "session",
        returnRoute: {
          page: MARKETING_ROUTE_PAGES.hostAccess,
          params: {
            intent: "host_dashboard_resume",
            targetType: "session",
          },
        },
        preferHostSurface: true,
      });
      return;
    }
    const nextHref = currentSurface === "host" ? hostSetupHref : hostAccessResumeHref;
    if (!nextHref) return;
    trackEvent("mk_host_setup_redirect", {
      source: "for_hosts_direct_dashboard",
    });
    window.location.href = nextHref;
  }, [authFlow, canSubmit, currentSurface, hostAccessResumeHref, hostSetupHref]);

  const openHostLogin = useCallback(() => {
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "host_dashboard_resume",
        targetType: "session",
        returnRoute: {
          page: MARKETING_ROUTE_PAGES.hostAccess,
          params: {
            intent: "host_dashboard_resume",
            targetType: "session",
          },
        },
        preferHostSurface: true,
      });
      return;
    }
    window.location.href = currentSurface === "host" ? hostSetupHref : hostAccessResumeHref;
  }, [authFlow, canSubmit, currentSurface, hostAccessResumeHref, hostSetupHref]);

  const requestEarlyHostAccess = useCallback(async (event) => {
    event?.preventDefault?.();
    const email = String(requestEmail || "").trim().toLowerCase();
    if (!email) {
      setRequestNotice("Enter your email to join the early host partner line.");
      return;
    }
    setRequestBusy(true);
    setRequestNotice("");
    try {
      const payload = await directoryActions.submitMarketingWaitlist({
        name: deriveWaitlistName(email),
        email,
        useCase: "host_application",
        source: "for_hosts_early_access_2026",
      });
      setRequestNotice(String(payload?.message || "You are in line. We will invite early host partners in 2026."));
      trackEvent("mk_host_application_submitted", {
        source: "for_hosts_early_access_2026",
        authed: canSubmit ? 1 : 0,
      });
    } catch (error) {
      setRequestNotice(String(error?.message || "Could not submit your early host request right now."));
    } finally {
      setRequestBusy(false);
    }
  }, [canSubmit, requestEmail]);

  useEffect(() => {
    const intent = String(route?.params?.intent || "").trim().toLowerCase();
    if (!canSubmit) return;
    if (intent !== "host_dashboard_resume") return;
    if (!session?.hasHostWorkspaceAccess) return;
    const runKey = `${intent}:${String(session?.uid || "")}`;
    if (autoLaunchIntentRef.current === runKey) return;
    autoLaunchIntentRef.current = runKey;
    trackEvent("mk_host_setup_redirect", {
      source: "for_hosts_resume_after_login",
    });
    window.location.href = currentSurface === "host" ? hostSetupHref : hostAccessResumeHref;
  }, [canSubmit, currentSurface, hostAccessResumeHref, hostSetupHref, route?.params?.intent, session?.hasHostWorkspaceAccess, session?.uid]);

  return (
    <section className="mk3-page mk3-host-command mk3-host-rebuild">
      <article className="mk3-detail-card mk3-host-hero mk3-zone mk3-host-hero-rebuild mk3-host-canon-surface">
        <div className="mk3-host-hero-grid">
          <div className="mk3-host-hero-copy">
            <div className="mk3-host-kicker mk3-host-canon-kicker">2026 early host partner intake</div>
            <h1 className="mk3-host-canon-title is-xl">Request access now. We are inviting early host partners in 2026.</h1>
            <p className="mk3-host-canon-copy">
              This is not a mass-market host signup yet. We are building an invite-first line for early testers,
              standout karaoke operators, and host partners we want to onboard in controlled 2026 waves.
            </p>
            <div className="mk3-status mk3-status-warning">
              <strong>Exclusive by design</strong>
              <span>Join the line now. We will review fit, market, and event style before sending early host invites in 2026.</span>
            </div>
            <div className="mk3-host-badge-row mk3-host-canon-chip-row">
              {HOST_STACK_BADGES.map((badge) => (
                <span key={badge} className="mk3-host-canon-chip">{badge}</span>
              ))}
            </div>
            <div className="mk3-host-primary-actions">
              {session?.hasHostWorkspaceAccess ? (
                <button
                  className="mk3-host-canon-button is-primary"
                  type="button"
                  onClick={() => {
                    trackPersonaCta(canSubmit ? "hero_open_host_dashboard" : "hero_host_auth_gate");
                    openHostSetup();
                  }}
                >
                  {canSubmit ? "Open Host Dashboard" : "Host Log In"}
                </button>
              ) : (
                <>
                  <button
                    className="mk3-host-canon-button is-primary"
                    type="button"
                    onClick={() => {
                      trackPersonaCta("hero_scroll_early_access");
                      scrollToIntake();
                    }}
                  >
                    Request Early Access
                  </button>
                  <button
                    className="mk3-host-canon-button"
                    type="button"
                    onClick={() => {
                      trackPersonaCta(canSubmit ? "hero_host_login_existing" : "hero_host_login_gate");
                      openHostLogin();
                    }}
                  >
                    Already Approved? Host Login
                  </button>
                </>
              )}
            </div>
            {hostApplicationStatus === "pending" && (
              <div className="mk3-status">
                <strong>Your request is already in review.</strong>
                <span>We will reach out when your 2026 invite wave opens or when we need more info.</span>
              </div>
            )}
          </div>
          <aside className="mk3-host-hero-visual">
            <article ref={intakeFormRef} className="mk3-detail-card mk3-host-canon-surface is-muted">
              <div className="mk3-host-kicker mk3-host-canon-kicker">Early access queue</div>
              <h2 className="mk3-host-canon-title is-md">Get in line for the 2026 host cohort.</h2>
              <p className="mk3-host-canon-copy is-muted">
                Drop your email and we will use it to line up early testers and host partners for the first invite waves.
              </p>
              {session?.hasHostWorkspaceAccess ? (
                <div className="mk3-status">
                  <strong>You already have host access.</strong>
                  <span>Use Host Dashboard for room creation, room manager, and live controls.</span>
                </div>
              ) : (
                <form className="mk3-auth-state" onSubmit={requestEarlyHostAccess}>
                  <label>
                    Email address
                    <input
                      type="email"
                      autoComplete="email"
                      value={requestEmail}
                      onChange={(event) => {
                        setRequestEmail(event.target.value);
                        if (requestNotice) setRequestNotice("");
                      }}
                      placeholder="host@example.com"
                      required
                    />
                  </label>
                  <div className="mk3-status mk3-status-warning">
                    <strong>Invite-first rollout</strong>
                    <span>Submitting here does not grant instant access. It puts you in the early host partner line for 2026 review waves.</span>
                  </div>
                  {!!session?.email && (
                    <div className="mk3-auth-hint">Signed in as {session.email}. We will review this email for future host invites.</div>
                  )}
                  <button
                    className="mk3-host-canon-button is-primary"
                    type="submit"
                    disabled={requestBusy}
                  >
                    {requestBusy ? "Saving spot..." : "Join The 2026 List"}
                  </button>
                  {!!requestNotice && <div className="mk3-status">{requestNotice}</div>}
                  <div className="mk3-auth-support-row">
                    <button
                      className="mk3-auth-link"
                      type="button"
                      onClick={() => {
                        trackPersonaCta(canSubmit ? "intake_host_login_existing" : "intake_host_login_gate");
                        openHostLogin();
                      }}
                    >
                      Already approved? Continue to host login
                    </button>
                  </div>
                </form>
              )}
            </article>
            <article className="mk3-host-visual-stage">
              <img src="/images/marketing/BeauRocks-HostPanel.png" alt="BeauRocks Host Dashboard" loading="lazy" />
              <div className="mk3-host-visual-overlay">
                <div className="mk3-persona-kicker">approved host surface</div>
                <strong>When invited, you go straight to the real control room.</strong>
                <span>Create, resume, launch, and run the night from Host Dashboard once your partner access is approved.</span>
              </div>
            </article>
            <div className="mk3-host-signal-grid">
              {HOST_SIGNAL_CARDS.map((card) => (
                <article key={card.title} className="mk3-host-signal-card">
                  <span>{card.label}</span>
                  <strong>{card.title}</strong>
                  <p>{card.copy}</p>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </article>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-host-manager-card mk3-host-canon-surface is-muted">
          <h2 className="mk3-host-canon-title is-md">What early host partners are lining up for</h2>
          <p className="mk3-host-setup-subcopy">
            The waitlist is not for casual curiosity clicks. It is for hosts who want a cleaner operator stack,
            tighter room control, and a sharper guest experience once invites open in 2026.
          </p>
          <div className="mk3-sub-list compact">
            {HOST_STORY_POINTS.map((note) => (
              <article key={note} className="mk3-review-card">
                <p>{note}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>How Invites Work</h4>
          <div className="mk3-status">
            <strong>Small cohort first</strong>
            <span>We are inviting early host partners in controlled 2026 waves instead of opening host access all at once.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            {HOST_CORE_OUTCOMES.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForHostsPage;
