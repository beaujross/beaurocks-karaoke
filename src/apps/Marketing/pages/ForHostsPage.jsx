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

const HOST_FLOW_STEPS = [
  "Log in with your BeauRocks account.",
  "Apply for host access so a super admin can review your request.",
  "Approved hosts open Host Dashboard and create or resume rooms there.",
  "Launch TV and audience links from the same control surface.",
  "Run the show, then review recap and room history there.",
];

const HOST_CORE_OUTCOMES = [
  "All host applicants use the same apply-and-approval system.",
  "Room setup, room manager, and live controls now live in Host Dashboard.",
  "Marketing stays focused on discovery and conversion, not host operations.",
  "Hosts do not need a separate launcher page before entering the real app.",
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
        <div className="mk3-host-kicker mk3-host-canon-kicker">host entry simplified</div>
        <h1 className="mk3-host-canon-title is-xl">Apply once. Approved hosts run the room from the real app.</h1>
        <p className="mk3-host-canon-copy">
          BeauRocks now uses a single host-access system: every prospective host can apply, and approved hosts go
          straight into Host Dashboard for create, resume, launch, and recap.
        </p>
        <div className="mk3-status mk3-status-warning">
          <strong>Account required to host</strong>
          <span>Guests can join with a room code, but host setup and room operations stay account-backed.</span>
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
                    ? "This application is currently closed. Reach out if you need another review."
                    : hostApplicationStatus === "pending"
                      ? "A super admin is reviewing your request now."
                      : "Every prospective host uses the same approval flow before Host Dashboard is enabled."}
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
      </article>

      <section className="mk3-detail-card mk3-host-manager-card mk3-host-canon-surface is-muted">
        <h2 className="mk3-host-canon-title is-md">What happens now</h2>
        <p className="mk3-host-setup-subcopy">
          The core host app now owns room creation, recent rooms, cleanup, archive, launch links, and live controls.
        </p>
        <div className="mk3-sub-list compact">
          {HOST_FLOW_STEPS.map((step, index) => (
            <article key={step} className="mk3-review-card">
              <div className="mk3-review-head">
                <strong>Step {index + 1}</strong>
              </div>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-host-canon-surface is-muted">
        <h2 className="mk3-host-canon-title is-md">Why this is simpler</h2>
        <div className="mk3-sub-list compact">
          {HOST_CORE_OUTCOMES.map((item) => (
            <article key={item} className="mk3-review-card">
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
};

export default ForHostsPage;
