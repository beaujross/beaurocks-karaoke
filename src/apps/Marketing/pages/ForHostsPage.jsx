import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { buildSurfaceUrl, inferSurfaceFromHostname } from "../../../lib/surfaceDomains";
import { MARKETING_ROUTE_PAGES } from "../routing";
import { marketingFlags } from "../featureFlags";

const HOST_STACK_BADGES = [
  "Host applications",
  "Hands-on onboarding",
  "Real dashboard access",
];

const HOST_CORE_OUTCOMES = [
  "Every host application is reviewed.",
  "Approved hosts get the real Host Dashboard.",
  "Best fit: recurring nights, venue programs, and standout private events.",
  "We onboard in stages so support stays strong.",
];

const HOST_STORY_POINTS = [
  "Tell us where you host or what kind of night you run.",
  "We review applications for recurring shows, fundraisers, private events, and venue programs.",
  "Once approved, you can create rooms, launch TV, and run the night from Host Dashboard.",
];

const HOST_VIP_SIGNALS = [
  {
    label: "Best fit",
    title: "Hosts with a real night to run",
    copy: "Applications move faster with a clear venue, event type, or recurring room behind them.",
  },
  {
    label: "What we look for",
    title: "Hosts who care about the room experience",
    copy: "We look for pacing, crowd energy, and a better guest experience.",
  },
  {
    label: "What you get",
    title: "The real host tools",
    copy: "Approved hosts get room setup, launch tools, TV links, and the full Host Dashboard.",
  },
];

const HOST_SIGNAL_CARDS = [
  {
    label: "Approval",
    title: "Application review",
    copy: "We review each application before launch.",
  },
  {
    label: "Onboarding",
    title: "High-touch launch",
    copy: "We onboard in stages instead of pushing a rushed self-serve setup.",
  },
  {
    label: "After approval",
    title: "Straight to Host Dashboard",
    copy: "Once approved, you go straight into the live host tools.",
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
      setRequestNotice("Enter your email to apply for host access.");
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
      setRequestNotice(String(payload?.message || "Application received. We will follow up when host access opens for your account."));
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
            <div className="mk3-host-kicker mk3-host-canon-kicker">host applications | beaurocks karaoke</div>
            <h1 className="mk3-host-canon-title is-xl">Apply to host karaoke nights with BeauRocks.</h1>
            <p className="mk3-host-canon-copy">We review every host application before granting access to the real host tools.</p>
            <div className="mk3-host-vip-brief mk3-host-canon-surface is-muted">
              <div className="mk3-host-vip-brief-head">
                <span className="mk3-host-canon-kicker">How approval works</span>
                <strong>We onboard hosts in stages so each new room gets proper support.</strong>
              </div>
              <div className="mk3-host-vip-brief-grid">
                <article>
                  <span>Applications</span>
                  <strong>Reviewed by hand</strong>
                  <p>We look for hosts with a real venue, event concept, or recurring night.</p>
                </article>
                <article>
                  <span>Launch</span>
                  <strong>Hands-on onboarding</strong>
                  <p>New hosts get a cleaner launch when onboarding stays deliberate.</p>
                </article>
                <article>
                  <span>Access</span>
                  <strong>Real host tools</strong>
                  <p>Once approved, you go straight into Host Dashboard.</p>
                </article>
              </div>
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
                    Apply For Host Access
                  </button>
                  <button
                    className="mk3-host-canon-button"
                    type="button"
                    onClick={() => {
                      trackPersonaCta(canSubmit ? "hero_host_login_existing" : "hero_host_login_gate");
                      openHostLogin();
                    }}
                  >
                    Already Approved? Sign In
                  </button>
                </>
              )}
            </div>
            {hostApplicationStatus === "pending" && (
                <div className="mk3-status">
                  <strong>Your request is already in review.</strong>
                  <span>We will follow up if we need more information.</span>
                </div>
            )}
            <div className="mk3-host-vip-signal-strip">
              {HOST_VIP_SIGNALS.map((signal) => (
                <article key={signal.title} className="mk3-host-vip-signal">
                  <span>{signal.label}</span>
                  <strong>{signal.title}</strong>
                  <p>{signal.copy}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className="mk3-host-hero-visual">
            <article ref={intakeFormRef} className="mk3-detail-card mk3-host-canon-surface is-muted mk3-host-vip-intake">
              <div className="mk3-host-vip-intake-topline">
                <span className="mk3-host-canon-kicker">Host application queue</span>
                <span className="mk3-host-vip-ledger">Application review</span>
              </div>
              <h2 className="mk3-host-canon-title is-md">Tell us you want to host with BeauRocks.</h2>
              <p className="mk3-host-canon-copy is-muted">Leave your email and we will place you in the host application queue.</p>
              <div className="mk3-host-vip-proof">
                <strong>What happens next</strong>
                <span>Your submission starts the review process. We will follow up with next steps.</span>
              </div>
              {session?.hasHostWorkspaceAccess ? (
                <div className="mk3-status">
                  <strong>You already have host access.</strong>
                  <span>Use Host Dashboard for room creation, TV launch, and live night control.</span>
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
                    <strong>Application review required</strong>
                    <span>Submitting here adds your account to the host review queue.</span>
                  </div>
                  {!!session?.email && (
                    <div className="mk3-auth-hint">Signed in as {session.email}. We will review this email for host access.</div>
                  )}
                  <button
                    className="mk3-host-canon-button is-primary"
                    type="submit"
                    disabled={requestBusy}
                  >
                    {requestBusy ? "Submitting..." : "Apply For Host Access"}
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
                      Already approved? Continue to host sign-in
                    </button>
                  </div>
                </form>
              )}
            </article>
            <article className="mk3-host-visual-stage">
              <img src="/images/marketing/BeauRocks-HostPanel.png" alt="BeauRocks Host Dashboard" loading="lazy" />
              <div className="mk3-host-visual-overlay">
                <div className="mk3-persona-kicker">host dashboard</div>
                <strong>Approved hosts go straight into the real host tools.</strong>
                <span>Create rooms, launch TV, manage the queue, and run the night.</span>
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
          <h2 className="mk3-host-canon-title is-md">What host access is for</h2>
          <p className="mk3-host-setup-subcopy">For hosts who want better room control, smoother guest flow, and a stronger night.</p>
          <div className="mk3-sub-list compact">
            {HOST_STORY_POINTS.map((note) => (
              <article key={note} className="mk3-review-card">
                <p>{note}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>How Host Access Works</h4>
          <div className="mk3-status">
            <strong>Reviewed before approval</strong>
            <span>We onboard in stages so setup and support stay strong.</span>
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
