import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { buildSurfaceUrl, inferSurfaceFromHostname } from "../../../lib/surfaceDomains";
import { MARKETING_ROUTE_PAGES } from "../routing";
import { marketingFlags } from "../featureFlags";
import { PersonaPageFrame } from "./PersonaMarketingBlocks";

const HOST_UNLOCKS = [
  {
    step: "01",
    title: "Run the queue from one deck",
    copy: "Search, queue, TV, and room controls stay together.",
  },
  {
    step: "02",
    title: "Launch a TV that leads",
    copy: "The room always has one shared signal.",
  },
  {
    step: "03",
    title: "Give guests a cleaner join flow",
    copy: "Phone join is fast and easier to trust.",
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

const ForHostsPage = ({ route, session, authFlow, navigate }) => {
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
      setRequestNotice("Enter your email to apply.");
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
      setRequestNotice(String(payload?.message || "Application received."));
      trackEvent("mk_host_application_submitted", {
        source: "for_hosts_early_access_2026",
        authed: canSubmit ? 1 : 0,
      });
    } catch (error) {
      setRequestNotice(String(error?.message || "Could not submit right now."));
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
    <PersonaPageFrame theme="host">
      <article className="mk3-persona-simple-hero mk3-persona-simple-hero-host">
        <div className="mk3-persona-simple-copy">
          <div className="mk3-rebuild-kicker">Host applications</div>
          <h1>Apply to host karaoke nights with BeauRocks.</h1>
          <p>We review every host application before granting access to the real host tools.</p>
          <div className="mk3-rebuild-action-row">
            <button
              type="button"
              className="mk3-rebuild-button is-primary"
              onClick={() => {
                trackPersonaCta("hero_apply");
                scrollToIntake();
              }}
            >
              Apply For Host Access
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-secondary"
              onClick={() => {
                trackPersonaCta(canSubmit ? "hero_sign_in" : "hero_sign_in_gate");
                openHostLogin();
              }}
            >
              Already Approved? Sign In
            </button>
          </div>
        </div>

        <article ref={intakeFormRef} className="mk3-persona-simple-form-card">
          <div className="mk3-persona-simple-form-topline">
            <span>Host application</span>
            <b>Reviewed by hand</b>
          </div>

          {hostApplicationStatus === "pending" && (
            <div className="mk3-status">
              <strong>Your request is already in review.</strong>
              <span>BeauRocks admins were notified, the application is reviewed by hand, and this same email/account will unlock host sign-in if approved.</span>
            </div>
          )}

          {session?.hasHostWorkspaceAccess ? (
            <div className="mk3-status">
              <strong>You already have host access.</strong>
              <span>Open the real host dashboard.</span>
            </div>
          ) : (
            <form className="mk3-auth-state mk3-host-application-form" onSubmit={requestEarlyHostAccess}>
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
              {!!session?.email && (
                <div className="mk3-auth-hint">Signed in as {session.email}</div>
              )}
              <div className="mk3-auth-hint">
                Next steps: we notify BeauRocks admins, review the request by hand, and if approved this same email/account can sign in on host.beaurocks.app to open Host Dashboard.
              </div>
              <button className="mk3-rebuild-button is-primary" type="submit" disabled={requestBusy}>
                {requestBusy ? "Submitting..." : "Apply For Host Access"}
              </button>
              {!!requestNotice && <div className="mk3-status">{requestNotice}</div>}
              <button
                className="mk3-rebuild-button is-ghost"
                type="button"
                onClick={() => {
                  trackPersonaCta(canSubmit ? "form_open_dashboard" : "form_open_dashboard_gate");
                  if (session?.hasHostWorkspaceAccess) {
                    openHostSetup();
                    return;
                  }
                  openHostLogin();
                }}
              >
                {session?.hasHostWorkspaceAccess ? "Open Host Dashboard" : "Continue to Host Sign-In"}
              </button>
            </form>
          )}
        </article>
      </article>

      <section className="mk3-persona-simple-band">
        <div className="mk3-rebuild-kicker">What approved hosts unlock</div>
        <div className="mk3-persona-simple-card-grid is-three">
          {HOST_UNLOCKS.map((item) => (
            <article key={item.step} className="mk3-persona-simple-card is-numbered">
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-persona-simple-band mk3-persona-simple-band-tight">
        <div className="mk3-rebuild-kicker">Next step</div>
        <div className="mk3-persona-simple-cta-row">
          <button
            type="button"
            className="mk3-rebuild-button is-secondary"
            onClick={() => {
              trackPersonaCta("closing_demo_auto");
              navigate("demo_auto");
            }}
          >
            Open Demo
          </button>
          <button
            type="button"
            className="mk3-rebuild-button is-secondary"
            onClick={() => {
              trackPersonaCta("closing_discover");
              navigate("discover");
            }}
          >
            Browse Discover
          </button>
        </div>
      </section>
    </PersonaPageFrame>
  );
};

export default ForHostsPage;
