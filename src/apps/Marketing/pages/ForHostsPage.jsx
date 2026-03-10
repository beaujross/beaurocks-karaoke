import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { buildSurfaceUrl, inferSurfaceFromHostname } from "../../../lib/surfaceDomains";
import { MARKETING_ROUTE_PAGES } from "../routing";
import { marketingFlags } from "../featureFlags";

const HOST_STACK_BADGES = [
  "Approval-based host onboarding",
  "Host Dashboard owns room operations",
  "One login, one control surface",
];

const HOST_CORE_OUTCOMES = [
  "Every host uses the same apply-and-approval flow, so access is clear instead of mysterious.",
  "Room setup, room manager, and live controls all live in Host Dashboard now.",
  "Marketing stays focused on the product story and house-party outcome instead of pretending to be a control panel.",
  "Approved hosts land closer to the real show and farther from unnecessary detours.",
];

const HOST_STORY_POINTS = [
  "Apply once, then head into the real host app when you are approved.",
  "Create rooms, reopen nights, launch TV and audience links, and run the show from the same place.",
  "Cleanup, archive, and recap belong inside Host Dashboard too, not scattered across marketing pages.",
];

const HOST_SIGNAL_CARDS = [
  {
    label: "Host Access",
    title: "Approval-backed, not vague",
    copy: "Future hosts go through one visible path instead of guessing which buttons unlock the real product.",
  },
  {
    label: "Room Control",
    title: "Live deck first",
    copy: "Open rooms, launch TV, share guest entry, and run the night from the dashboard that owns the room.",
  },
  {
    label: "Operations",
    title: "Setup stays inside the host app",
    copy: "Branding, defaults, and room operations stay with the operator surface instead of leaking into marketing.",
  },
];

const ForHostsPage = ({ route, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const autoLaunchIntentRef = useRef("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyNotice, setApplyNotice] = useState("");
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

  const applyForHostAccess = useCallback(async () => {
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "host_apply",
        targetType: "session",
        returnRoute: {
          page: MARKETING_ROUTE_PAGES.hostAccess,
          params: {},
        },
        preferHostSurface: true,
      });
      return;
    }
    setApplyBusy(true);
    setApplyNotice("");
    try {
      const payload = await directoryActions.submitMarketingWaitlist({
        name: session.email || session.uid || "BeauRocks Host Applicant",
        email: session.email || "",
        useCase: "host_application",
        source: "for_hosts_page",
      });
      setApplyNotice(String(payload?.message || "Application submitted. We will review your host request."));
      trackEvent("mk_host_application_submitted", { source: "for_hosts_page" });
    } catch (error) {
      setApplyNotice(String(error?.message || "Could not submit host application right now."));
    } finally {
      setApplyBusy(false);
    }
  }, [authFlow, canSubmit, session.email, session.uid]);

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
            <div className="mk3-host-kicker mk3-host-canon-kicker">host entry simplified</div>
            <h1 className="mk3-host-canon-title is-xl">Apply once. Get approved. Run the room from the real host app.</h1>
            <p className="mk3-host-canon-copy">
              BeauRocks uses one host-access system now: every future host can apply, and approved hosts go
              straight into Host Dashboard for create, resume, launch, and recap without a bunch of ceremonial clicking first.
            </p>
            <div className="mk3-status mk3-status-warning">
              <strong>Account required to host</strong>
              <span>Guests can join with a room code. Host setup and room controls stay account-backed, as they should.</span>
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
                <div className="mk3-sub-list compact">
                  <div className="mk3-status mk3-status-warning">
                    <strong>
                      {hostApplicationStatus === "rejected"
                        ? "Application not approved"
                        : hostApplicationStatus === "pending"
                          ? "Application pending review"
                          : "Apply for host approval"}
                    </strong>
                    <span>
                      {hostApplicationStatus === "rejected"
                        ? "This application is closed for now. Reach out if you want another pass."
                        : hostApplicationStatus === "pending"
                          ? "A super admin is reviewing your request now."
                          : "Every future host goes through the same approval flow before Host Dashboard opens up."}
                    </span>
                  </div>
                  <button
                    className="mk3-host-canon-button is-primary"
                    type="button"
                    onClick={() => {
                      trackPersonaCta(canSubmit ? "hero_apply_to_host" : "hero_host_auth_gate");
                      applyForHostAccess();
                    }}
                    disabled={applyBusy || hostApplicationStatus === "pending"}
                  >
                    {applyBusy ? "Applying..." : hostApplicationStatus === "pending" ? "Application Submitted" : (canSubmit ? "Apply To Host" : "Create Account To Apply")}
                  </button>
                </div>
              )}
            </div>
            {!!applyNotice && <div className="mk3-status">{applyNotice}</div>}
          </div>
          <aside className="mk3-host-hero-visual">
            <article className="mk3-host-visual-stage">
              <img src="/images/marketing/BeauRocks-HostPanel.png" alt="BeauRocks Host Dashboard" loading="lazy" />
              <div className="mk3-host-visual-overlay">
                <div className="mk3-persona-kicker">host dashboard</div>
                <strong>One room. One operator surface.</strong>
                <span>Create, resume, launch, and tune the room from the app that actually runs the show.</span>
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
          <h2 className="mk3-host-canon-title is-md">Host the night from the app that actually runs the night</h2>
          <p className="mk3-host-setup-subcopy">
            Marketing should explain the value. The host app should handle the room.
            BeauRocks is finally set up that way.
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
          <h4>What Changed</h4>
          <div className="mk3-status">
            <strong>Fewer detours, clearer ownership</strong>
            <span>Approved hosts get pushed toward the real host workflow instead of wandering through extra setup theater.</span>
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
