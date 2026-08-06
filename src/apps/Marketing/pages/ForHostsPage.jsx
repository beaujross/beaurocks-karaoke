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
  return normalized || "Host Applicant";
};

const getHostApplicationErrorMessage = (error) => {
  const code = String(error?.code || "").trim().toLowerCase();
  if (code.includes("resource-exhausted")) {
    return "Too many attempts were made from this device. Wait a few minutes, then try again.";
  }
  if (code.includes("invalid-argument")) {
    return "Check your name and email, then try again.";
  }
  if (code.includes("failed-precondition")) {
    return "We could not verify this browser. Refresh the page and try again.";
  }
  if (code.includes("unavailable") || code.includes("network")) {
    return "We could not connect right now. Check your internet connection and try again.";
  }
  return "We could not add you to the waitlist right now. Please try again.";
};

const ForHostsPage = ({
  route,
  session,
  authFlow,
  heroStats,
  onHostApplicationsChanged,
}) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const autoLaunchIntentRef = useRef("");
  const intakeFormRef = useRef(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestNotice, setRequestNotice] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestEmail, setRequestEmail] = useState(() => String(session?.email || "").trim().toLowerCase());
  const [requestName, setRequestName] = useState(() => String(session?.user?.displayName || "").trim());
  const [requestHostType, setRequestHostType] = useState("home_party");

  const [requestGoal, setRequestGoal] = useState("");
  const hostApplicationStatus = String(session?.applicationStatus || "").trim().toLowerCase();
  const waitlistConfirmed = requestSubmitted || hostApplicationStatus === "pending";
  const goldenTicketState = session?.hasHostWorkspaceAccess
    ? "issued"
    : waitlistConfirmed
      ? "held"
      : "open";
  const goldenTicketTitle = goldenTicketState === "issued"
    ? "Host Access Granted"
    : goldenTicketState === "held"
      ? "Application Received"
      : "Invitation Request";
  const goldenTicketStamp = goldenTicketState === "issued"
    ? "Admit One"
    : goldenTicketState === "held"
      ? "In Review"
      : "Apply";
  const onboardingSteps = Array.isArray(session?.hostOnboarding?.steps) ? session.hostOnboarding.steps : [];
  const liveListingsCount = Math.max(0, Number(heroStats?.total || 0));
  const heroSignals = [
    {
      label: "At home",
      title: "Run it yourself",
      copy: "Run the queue, TV, and guest phones from one place.",
    },
    {
      label: "Private events",
      title: "Keep the party moving",
      copy: "Turn on Assisted Host when you want help with pacing and what comes next.",
    },
    {
      label: "Host access",
      title: "Invitations open a few at a time",
      copy: liveListingsCount > 0 ? `${liveListingsCount.toLocaleString()} karaoke listings are already live.` : "Join now to be considered for a future opening.",
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
    setRequestName((current) => current || String(session?.user?.displayName || "").trim());
  }, [session?.email, session?.user?.displayName]);

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
    const name = String(requestName || "").trim();
    if (!name) {
      setRequestNotice("Enter the name you want us to use for your Host application.");
      return;
    }
    if (!email) {
      setRequestNotice("Enter your email to apply.");
      return;
    }
    setRequestBusy(true);
    setRequestNotice("");
    try {
      const payload = await directoryActions.submitMarketingWaitlist({
        name: name || deriveWaitlistName(email),
        email,
        useCase: "host_application",
        source: "for_hosts_limited_host_testing_2026",
        hostType: requestHostType,

        hostingGoal: requestGoal,
      });
      setRequestNotice(String(payload?.message || "You are on the Host waitlist. We will email you if an invitation becomes available."));
      setRequestSubmitted(true);
      onHostApplicationsChanged?.();
      trackEvent("mk_host_application_submitted", {
        source: "for_hosts_early_access_2026",
        authed: canSubmit ? 1 : 0,
      });
    } catch (error) {
      setRequestNotice(getHostApplicationErrorMessage(error));
    } finally {
      setRequestBusy(false);
    }
  }, [canSubmit, onHostApplicationsChanged, requestEmail, requestGoal, requestHostType, requestName]);

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
          <div className="mk3-rebuild-kicker">Invite-only Host access</div>
          <h1>Host karaoke your way.</h1>
          <p>
            Apply for a limited Host invitation. If selected, the invitation in your email is your golden ticket into Host access. No account or payment is needed to apply.
          </p>
          <div className="mk3-demand-pill-row" aria-label="Host access signals">
            <span>No account to apply</span>
            <span>Invitations in small batches</span>
            <span>No charge to join</span>
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
              Join Host Waitlist
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-secondary"
              onClick={() => {
                trackPersonaCta(canSubmit ? "hero_sign_in" : "hero_sign_in_gate");
                openHostLogin();
              }}
            >
              Already a Host? Sign In
            </button>
          </div>
        </div>

        <article ref={intakeFormRef} className="mk3-persona-simple-form-card">
          <div className="mk3-persona-simple-form-topline">
            <span>Next invitation batch</span>
            <b>Limited invitation release</b>
          </div>

          <div className={`mk3-host-golden-ticket is-${goldenTicketState}`} aria-label={`BeauRocks Host ${goldenTicketTitle}`}>
            <span className="mk3-host-ticket-notch is-left" aria-hidden="true" />
            <span className="mk3-host-ticket-notch is-right" aria-hidden="true" />
            <div className="mk3-host-ticket-kicker">
              <span>BeauRocks Karaoke</span>
              <b>Host invitation series</b>
            </div>
            <div className="mk3-host-ticket-main">
              <div>
                <small>Neon golden ticket</small>
                <strong>{goldenTicketTitle}</strong>
                <p>
                  {goldenTicketState === "issued"
                    ? "Your invitation unlocks the Host Dashboard and Room setup."
                    : goldenTicketState === "held"
                      ? "Your application is in the pool for a future invitation batch."
                      : "Apply below to be considered for one of the next limited invitations."}
                </p>
              </div>
              <span className="mk3-host-ticket-stamp">{goldenTicketStamp}</span>
            </div>
            <div className="mk3-host-ticket-footer">
              <span>{requestName || session?.user?.displayName || "Future Host"}</span>
              <b>BR · HOST · 2026</b>
            </div>
          </div>

          <div className="mk3-status">
            <strong>New Host applications are open.</strong>
            <span>We are accepting applicants now and releasing only a few invitations at a time. Join the waitlist to be considered for a future opening.</span>
          </div>


          {session?.hasHostWorkspaceAccess ? (
            <div className="mk3-status">
              <strong>Your Host invitation is ready.</strong>
              <span>Sign in with the email that received the invitation, finish your Host setup, and try your first Room.</span>
              {onboardingSteps.length > 0 && (
                <div className="mk3-host-onboarding-steps" aria-label="Host onboarding progress">
                  {onboardingSteps.map((step) => (
                    <span key={step.id} className={step.complete ? "is-complete" : ""}>
                      {step.complete ? "Complete" : "Next"}: {step.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : waitlistConfirmed ? (
            <div className="mk3-host-ticket-confirmation" aria-live="polite">
              <strong>Your application is in the invitation pool.</strong>
              <span>Invitations are selected in small batches—not first come, first served. We will email you if there is a fit for an upcoming opening.</span>
              {!!requestNotice && <span>{requestNotice}</span>}
              <button
                className="mk3-rebuild-button is-ghost"
                type="button"
                onClick={openHostLogin}
              >
                Already Invited? Sign In
              </button>
            </div>
          ) : (
            <form className="mk3-auth-state mk3-host-application-form" onSubmit={requestEarlyHostAccess}>
              <label>
                Name
                <input
                  type="text"
                  autoComplete="name"
                  value={requestName}
                  onChange={(event) => {
                    setRequestName(event.target.value);
                    if (requestNotice) setRequestNotice("");
                  }}
                  placeholder="What should we call you?"
                  maxLength={80}
                  required
                />
              </label>
              <label>
                What do you plan to host?
                <select value={requestHostType} onChange={(event) => setRequestHostType(event.target.value)}>
                  <option value="home_party">Home parties</option>
                  <option value="private_events">Private or paid events</option>
                  <option value="venue_kj">Venue or professional KJ nights</option>
                  <option value="fundraiser_community">Fundraisers or community events</option>
                  <option value="testing_learning">Learning and product testing</option>
                </select>
              </label>
              <label>
                Anything we should know? <span className="mk3-optional">Optional</span>
                <textarea
                  value={requestGoal}
                  onChange={(event) => setRequestGoal(event.target.value)}
                  placeholder="Tell us about the event or crowd you hope to host."
                  maxLength={500}
                  rows={3}
                />
              </label>
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
              <div className="mk3-auth-hint">
                No account is needed. We will use this email only for your application and invitation updates.
              </div>
              <div className="mk3-auth-hint">
                Applying is free and does not start a subscription. If invited, you will see the access terms before you begin.
              </div>
              <button className="mk3-rebuild-button is-primary" type="submit" disabled={requestBusy}>
                {requestBusy ? "Submitting..." : "Submit My Host Application"}
              </button>
              {!!requestNotice && <div className="mk3-status" aria-live="polite">{requestNotice}</div>}
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
                {session?.hasHostWorkspaceAccess ? "Open Host Dashboard" : "Already Invited? Sign In"}
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

      <section className="mk3-persona-simple-band">
        <div className="mk3-persona-simple-band-intro">
          <div className="mk3-rebuild-kicker">Testing access and future pricing</div>
          <h2>Apply for free. Approved testing is $0. You choose before any future payment.</h2>
          <p>
            Approved testing access is $0 while your invitation is active. No card is required, no subscription was started,
            and there are no automatic charges. Future paid access never starts unless you explicitly choose it.
          </p>
        </div>
        <div className="mk3-persona-simple-card-grid is-three">
          <article className="mk3-persona-simple-card">
            <span>Join the waitlist</span>
            <strong>$0</strong>
            <p>Apply with your name and email. No account, card, or subscription is required.</p>
          </article>
          <article className="mk3-persona-simple-card">
            <span>Approved testing access</span>
            <strong>Complimentary</strong>
            <p>$0 while your invitation is active, with no card, subscription, or automatic charge.</p>
          </article>
          <article className="mk3-persona-simple-card">
            <span>Future paid access</span>
            <strong>Your choice first</strong>
            <p>You will see the price, what is included, and the terms before deciding. Access will not convert automatically; you must explicitly opt in before any charge.</p>
          </article>
        </div>
        <div className="mk3-host-pricing-details">
          <article>
            <strong>Your Host plan includes</strong>
            <p>Room creation, queue control, guest phones, Public TV, Assisted Host tools, shared setup templates, and included allowances for AI and music-data lookups.</p>
          </article>
          <article>
            <strong>You stay in control</strong>
            <p>Billing & Usage shows metered product usage and limits for transparency; testing counters are not a bill.</p>
          </article>
          <article>
            <strong>Not included</strong>
            <p>Event hardware, venue costs, and any separate third-party music or content subscription you choose to connect.</p>
          </article>
        </div>
      </section>
    </PersonaPageFrame>
  );
};

export default ForHostsPage;
