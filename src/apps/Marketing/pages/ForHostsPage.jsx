import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { buildSurfaceUrl, inferSurfaceFromHostname } from "../../../lib/surfaceDomains";
import { MARKETING_ROUTE_PAGES } from "../routing";
import { marketingFlags } from "../featureFlags";
import { PersonaPageFrame } from "./PersonaMarketingBlocks";

const deriveWaitlistName = (email = "") => {
  const local = String(email || "").split("@")[0] || "";
  const normalized = local
    .replace(/[._+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return normalized || "Early Host Applicant";
};

const ForHostsPage = ({
  route,
  session,
  authFlow,
  heroStats,
  pendingHostApplicationsCount = 0,
  onHostApplicationsChanged,
}) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const autoLaunchIntentRef = useRef("");
  const intakeFormRef = useRef(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestNotice, setRequestNotice] = useState("");
  const [requestEmail, setRequestEmail] = useState(() => String(session?.email || "").trim().toLowerCase());
  const hostApplicationStatus = String(session?.applicationStatus || "").trim().toLowerCase();
  const liveListingsCount = Math.max(0, Number(heroStats?.total || 0));
  const queueCount = Math.max(0, Number(pendingHostApplicationsCount || 0));
  const heroSignals = [
    {
      label: "At home",
      title: "Run it yourself",
      copy: "Manage the queue, TV, and guest phones from one place.",
    },
    {
      label: "Private events",
      title: "Keep the party moving",
      copy: "Turn on Assisted Host when you want help with pacing and what comes next.",
    },
    {
      label: "Host access",
      title: queueCount > 0 ? `${queueCount} requests in line` : "Join the waitlist",
      copy: liveListingsCount > 0 ? `${liveListingsCount.toLocaleString()} karaoke listings are already live.` : "We will email you when your account is approved.",
    },
  ];

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
      setRequestNotice(String(payload?.message || "You are in the review queue."));
      onHostApplicationsChanged?.();
      trackEvent("mk_host_application_submitted", {
        source: "for_hosts_early_access_2026",
        authed: canSubmit ? 1 : 0,
      });
    } catch (error) {
      setRequestNotice(String(error?.message || "Could not submit right now."));
    } finally {
      setRequestBusy(false);
    }
  }, [canSubmit, onHostApplicationsChanged, requestEmail]);

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
          <div className="mk3-rebuild-kicker">Karaoke for home and private parties</div>
          <h1>Host karaoke your way.</h1>
          <p>
            Run the queue, TV, and guest phones yourself, or turn on Assisted Host for help keeping the party moving.
          </p>
          <div className="mk3-demand-pill-row" aria-label="Host access signals">
            <span>Home parties</span>
            <span>Private events</span>
            <span>One Host Dashboard</span>
          </div>
          <div className="mk3-rebuild-action-row">
            <button
              type="button"
              className="mk3-rebuild-button is-primary"
              onClick={() => {
                trackPersonaCta("hero_apply");
                scrollToIntake();
              }}
            >
              Join the Host Waitlist
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-secondary"
              onClick={() => {
                trackPersonaCta(canSubmit ? "hero_sign_in" : "hero_sign_in_gate");
                openHostLogin();
              }}
            >
              Host Sign In
            </button>
          </div>
        </div>

        <article ref={intakeFormRef} className="mk3-persona-simple-form-card">
          <div className="mk3-persona-simple-form-topline">
            <span>Host access</span>
            <b>Join the waitlist</b>
          </div>

          {hostApplicationStatus === "pending" && (
            <div className="mk3-status">
              <strong>Your request is in.</strong>
              <span>We will email you if your account is approved.</span>
            </div>
          )}

          {session?.hasHostWorkspaceAccess ? (
            <div className="mk3-status">
              <strong>Your Host access is ready.</strong>
              <span>Open the dashboard to set up a room.</span>
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
                Use the email you want tied to your Host account.
              </div>
              <button className="mk3-rebuild-button is-primary" type="submit" disabled={requestBusy}>
                {requestBusy ? "Joining..." : "Join the Waitlist"}
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
                {session?.hasHostWorkspaceAccess ? "Open Host Dashboard" : "Check Host Sign-In"}
              </button>
            </form>
          )}
        </article>
      </article>

      <section className="mk3-persona-simple-band">
        <div className="mk3-rebuild-kicker">What you can run</div>
        <div className="mk3-persona-simple-card-grid is-three">
          {heroSignals.map((item) => (
            <article key={item.label} className="mk3-persona-simple-card">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </PersonaPageFrame>
  );
};

export default ForHostsPage;
