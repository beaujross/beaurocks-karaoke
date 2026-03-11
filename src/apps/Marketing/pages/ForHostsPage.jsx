import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { buildSurfaceUrl, inferSurfaceFromHostname } from "../../../lib/surfaceDomains";
import { MARKETING_ROUTE_PAGES } from "../routing";
import { marketingFlags } from "../featureFlags";

const HOST_STACK_BADGES = [
  "VIP host access",
  "Founding 2026 cohort",
  "Reviewed by invite wave",
];

const HOST_CORE_OUTCOMES = [
  "VIP access is reviewed manually. This is not open host registration.",
  "The first 2026 cohort is intentionally small so the product and partner support stay high-touch.",
  "Invited partners skip the fake-tour layer and go directly into the real Host Dashboard.",
  "We are prioritizing operators who can anchor repeat nights, venue programs, and memorable rooms.",
];

const HOST_STORY_POINTS = [
  "Join the private line with your email so we know who to screen first.",
  "We are looking for hosts who can run standout karaoke nights, fundraisers, venue programs, and repeatable community events.",
  "When your invite opens in 2026, you launch from the real Host Dashboard instead of a public demo shell.",
];

const HOST_VIP_SIGNALS = [
  {
    label: "Best Fit",
    title: "Repeatable rooms",
    copy: "Hosts with a clear room concept, recurring calendar, or venue relationship move faster than curiosity signups.",
  },
  {
    label: "Priority",
    title: "Operator polish",
    copy: "We are leaning toward hosts who care about pacing, crowd energy, room control, and a premium guest experience.",
  },
  {
    label: "Access",
    title: "Real controls",
    copy: "Invited partners get the actual operating surface for room setup, live launch, TV links, and nightly tools.",
  },
];

const HOST_SIGNAL_CARDS = [
  {
    label: "Access Type",
    title: "Invitation only",
    copy: "We are not opening host tools to everyone at once. Each 2026 wave is hand-selected and deliberately small.",
  },
  {
    label: "Cohort",
    title: "Founding partners",
    copy: "This line is for hosts who want to help define the operator product, not just try a generic dashboard.",
  },
  {
    label: "After Invite",
    title: "Straight to ops",
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
            <div className="mk3-host-kicker mk3-host-canon-kicker">VIP host access | founding 2026 cohort</div>
            <h1 className="mk3-host-canon-title is-xl">This is the private line for BeauRocks host partners.</h1>
            <p className="mk3-host-canon-copy">
              We are inviting a limited set of early hosts and testers in 2026. Access is reviewed manually,
              cohort by cohort, for operators we believe can run distinctive rooms and help shape the real product.
            </p>
            <div className="mk3-host-vip-brief mk3-host-canon-surface is-muted">
              <div className="mk3-host-vip-brief-head">
                <span className="mk3-host-canon-kicker">Private consideration</span>
                <strong>Not everyone who requests access gets invited in the first wave.</strong>
              </div>
              <div className="mk3-host-vip-brief-grid">
                <article>
                  <span>Wave 01</span>
                  <strong>Selective intake</strong>
                  <p>We are screening for hosts with a real venue, audience, or room concept, not casual interest.</p>
                </article>
                <article>
                  <span>Positioning</span>
                  <strong>VIP partner feel</strong>
                  <p>The experience should feel earned. The first cohort is meant to feel like access to the real room behind the curtain.</p>
                </article>
                <article>
                  <span>Outcome</span>
                  <strong>Direct dashboard entry</strong>
                  <p>Once invited, you do not land in a marketing mockup. You go straight into the actual host operating surface.</p>
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
                <span className="mk3-host-canon-kicker">VIP consideration queue</span>
                <span className="mk3-host-vip-ledger">Limited release</span>
              </div>
              <h2 className="mk3-host-canon-title is-md">Ask to be considered for the first invite waves.</h2>
              <p className="mk3-host-canon-copy is-muted">
                Leave your email and we will place you in the private review line for the early BeauRocks host cohort.
              </p>
              <div className="mk3-host-vip-proof">
                <strong>What this means</strong>
                <span>Your submission reserves consideration, not instant access. We will invite early host partners in deliberate 2026 waves.</span>
              </div>
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
                    <strong>Invitation-only rollout</strong>
                    <span>Submitting here does not unlock the host panel immediately. It puts you into the VIP review queue for 2026 waves.</span>
                  </div>
                  {!!session?.email && (
                    <div className="mk3-auth-hint">Signed in as {session.email}. We will review this email for future host invites.</div>
                  )}
                  <button
                    className="mk3-host-canon-button is-primary"
                    type="submit"
                    disabled={requestBusy}
                  >
                    {requestBusy ? "Saving spot..." : "Request VIP Access"}
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
                <div className="mk3-persona-kicker">behind the velvet rope</div>
                <strong>Approved partners skip the preview and enter the real control room.</strong>
                <span>Create, resume, launch, and run the night from Host Dashboard once your invite clears review.</span>
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
          <h2 className="mk3-host-canon-title is-md">What the private line is actually for</h2>
          <p className="mk3-host-setup-subcopy">
            This is for hosts who want better room command, cleaner guest flow, and a real operating stack once invites open in 2026.
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
          <h4>How VIP Access Works</h4>
          <div className="mk3-status">
            <strong>Small cohort first</strong>
            <span>We are inviting early host partners in controlled 2026 waves instead of opening host access to everyone at once.</span>
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
