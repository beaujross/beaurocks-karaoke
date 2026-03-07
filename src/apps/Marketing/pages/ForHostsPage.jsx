import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { buildSurfaceUrl } from "../../../lib/surfaceDomains";
import { MARKETING_ROUTE_PAGES } from "../routing";

const HOST_STACK_BADGES = [
  "Direct into Host Dashboard",
  "Create or resume inside the app",
  "One login, one control surface",
];

const HOST_FLOW_STEPS = [
  "Log in with your BeauRocks account.",
  "Open Host Dashboard and create a room or resume one.",
  "Launch TV and audience links from the same control surface.",
  "Run the show, then review recap and room history there.",
];

const HOST_CORE_OUTCOMES = [
  "Room setup, room manager, and live controls now live in Host Dashboard.",
  "Marketing stays focused on discovery and conversion, not host operations.",
  "Hosts do not need a separate launcher page before entering the real app.",
];

const ForHostsPage = ({ route, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const autoLaunchIntentRef = useRef("");

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
      });
      return;
    }
    if (!hostSetupHref) return;
    trackEvent("mk_host_setup_redirect", {
      source: "for_hosts_direct_dashboard",
    });
    window.location.href = hostSetupHref;
  }, [authFlow, canSubmit, hostSetupHref]);

  useEffect(() => {
    const intent = String(route?.params?.intent || "").trim().toLowerCase();
    if (!canSubmit) return;
    if (intent !== "host_dashboard_resume") return;
    const runKey = `${intent}:${String(session?.uid || "")}`;
    if (autoLaunchIntentRef.current === runKey) return;
    autoLaunchIntentRef.current = runKey;
    trackEvent("mk_host_setup_redirect", {
      source: "for_hosts_resume_after_login",
    });
    window.location.href = hostSetupHref;
  }, [canSubmit, hostSetupHref, route?.params?.intent, session?.uid]);

  return (
    <section className="mk3-page mk3-host-command mk3-host-rebuild">
      <article className="mk3-detail-card mk3-host-hero mk3-zone mk3-host-hero-rebuild mk3-host-canon-surface">
        <div className="mk3-host-kicker mk3-host-canon-kicker">host entry simplified</div>
        <h1 className="mk3-host-canon-title is-xl">Host once. Enter once. Run the room from the real app.</h1>
        <p className="mk3-host-canon-copy">
          BeauRocks host setup no longer needs a marketing-side room manager. Use this page to understand the workflow,
          then go straight into Host Dashboard for create, resume, launch, and recap.
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
        </div>
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
