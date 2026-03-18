import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { buildSurfaceUrl, inferSurfaceFromHostname } from "../../../lib/surfaceDomains";
import { MARKETING_ROUTE_PAGES } from "../routing";
import { marketingFlags } from "../featureFlags";
import {
  PersonaClosingSection,
  PersonaFeatureSection,
  PersonaHeroScaffold,
  PersonaOutcomeSection,
  PersonaPageFrame,
  PersonaSignalSection,
  PersonaSurfaceMock,
} from "./PersonaMarketingBlocks";

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
  "Deliberate onboarding keeps the first live nights cleaner and better supported.",
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

const HOST_TRUST_SIGNALS = [
  {
    label: "Access model",
    title: "Approved before launch",
    copy: "Host access is reviewed before someone starts creating live rooms under the BeauRocks flow.",
  },
  {
    label: "Product",
    title: "Real room controls",
    copy: "Approved hosts get the actual host dashboard for queue, TV, and room operations.",
  },
  {
    label: "Support",
    title: "Deliberate onboarding",
    copy: "New hosts are onboarded in stages so the first live nights are cleaner and better supported.",
  },
];

const HOST_SURFACE_STEPS = [
  {
    step: "01",
    title: "Run the night from one host deck",
    copy: "Queue, TV controls, audio, and room actions stay together instead of getting spread across tools.",
    visualType: "host",
    visualLabel: "Host deck",
  },
  {
    step: "02",
    title: "Launch a TV that actually leads the room",
    copy: "The public screen carries join prompts, stage state, and room energy instead of acting like a passive display.",
    visualType: "tv",
    visualLabel: "Public TV",
  },
  {
    step: "03",
    title: "Give guests a cleaner join and request flow",
    copy: "Audience phones become part of the room flow without making the night feel complicated.",
    visualType: "audience",
    visualLabel: "Audience app",
  },
];

const HOST_FINAL_PATHS = [
  {
    title: "See the live room story",
    copy: "Watch the deterministic demo if you want to see how host, TV, and audience stay synchronized.",
    cta: "Open Auto Demo",
    route: "demo_auto",
  },
  {
    title: "See public discovery",
    copy: "Browse how BeauRocks nights appear publicly before you apply to run one yourself.",
    cta: "Browse Discover",
    route: "discover",
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

  const closingCards = [
    !session?.hasHostWorkspaceAccess
      ? {
        title: "Apply for host access",
        copy: "Tell us about your room, venue, or event and we will review it before launch.",
        cta: "Apply For Host Access",
        onClick: () => {
          trackPersonaCta("closing_apply_for_host_access");
          scrollToIntake();
        },
      }
      : {
        title: "Open Host Dashboard",
        copy: "Go straight into the real host deck if your account is already approved.",
        cta: canSubmit ? "Open Host Dashboard" : "Host Log In",
        onClick: () => {
          trackPersonaCta("closing_open_host_dashboard");
          openHostSetup();
        },
      },
    ...HOST_FINAL_PATHS.map((item) => ({
      ...item,
      onClick: () => {
        trackPersonaCta(`closing_${item.route}`);
        navigate(item.route);
      },
    })),
  ];

  return (
    <PersonaPageFrame theme="host">
      <PersonaHeroScaffold
        theme="host"
        className="mk3-host-hero"
        railClassName="mk3-host-hero-rail-wrap"
        proofClassName="mk3-host-proof-strip"
        kicker="Host applications | BeauRocks Karaoke"
        brandLine="We review every host application before granting access to the real host tools."
        title="Apply to host karaoke nights with BeauRocks."
        subtitle="Best fit is recurring nights, venue programs, fundraisers, and private events that need cleaner room control and stronger guest flow."
        actions={session?.hasHostWorkspaceAccess
          ? [{
            label: canSubmit ? "Open Host Dashboard" : "Host Log In",
            variant: "primary",
            onClick: () => {
              trackPersonaCta(canSubmit ? "hero_open_host_dashboard" : "hero_host_auth_gate");
              openHostSetup();
            },
          }]
          : [
            {
              label: "Apply For Host Access",
              variant: "primary",
              onClick: () => {
                trackPersonaCta("hero_scroll_early_access");
                scrollToIntake();
              },
            },
            {
              label: "Already Approved? Sign In",
              variant: "secondary",
              onClick: () => {
                trackPersonaCta(canSubmit ? "hero_host_login_existing" : "hero_host_login_gate");
                openHostLogin();
              },
            },
          ]}
        badges={HOST_STACK_BADGES}
        proofItems={HOST_VIP_SIGNALS.map((item) => ({ eyebrow: item.label, title: item.title, copy: item.copy }))}
        rightRail={(
          <div className="mk3-host-rebuild-rail">
            <article ref={intakeFormRef} className="mk3-host-rebuild-queue">
              <div className="mk3-host-rebuild-queue-topline">
                <span>Host application queue</span>
                <b>Reviewed by hand</b>
              </div>
              <strong>Tell us you want to host with BeauRocks.</strong>
              <p>Leave your email and we will place you in the host application queue. Approved hosts go straight into Host Dashboard.</p>

              {hostApplicationStatus === "pending" && (
                <div className="mk3-status">
                  <strong>Your request is already in review.</strong>
                  <span>We will follow up if we need more information.</span>
                </div>
              )}

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
                  <button className="mk3-rebuild-button is-primary" type="submit" disabled={requestBusy}>
                    {requestBusy ? "Submitting..." : "Apply For Host Access"}
                  </button>
                  {!!requestNotice && <div className="mk3-status">{requestNotice}</div>}
                  <button
                    className="mk3-rebuild-button is-ghost"
                    type="button"
                    onClick={() => {
                      trackPersonaCta(canSubmit ? "intake_host_login_existing" : "intake_host_login_gate");
                      openHostLogin();
                    }}
                  >
                    Already approved? Continue to host sign-in
                  </button>
                </form>
              )}
            </article>

            <article className="mk3-host-rebuild-screen">
              <PersonaSurfaceMock
                type="host"
                label="Host dashboard"
                title="Approved hosts go straight into the real host tools."
                copy="Create rooms, launch TV, manage the queue, and run the night."
                className="mk3-host-hero-mock"
              />
            </article>

            <div className="mk3-host-rebuild-mini-grid">
              {HOST_SIGNAL_CARDS.map((card) => (
                <article key={card.title}>
                  <span>{card.label}</span>
                  <strong>{card.title}</strong>
                  <p>{card.copy}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      />

      <PersonaSignalSection
        theme="host"
        className="mk3-host-signal-band"
        kicker="Why host access feels premium"
        title="We do not hand out host tools casually."
        cards={HOST_TRUST_SIGNALS}
      />

      <PersonaFeatureSection
        theme="host"
        className="mk3-host-feature-band"
        kicker="What approved hosts actually unlock"
        title="One system across host, TV, and guest phones."
        steps={HOST_SURFACE_STEPS}
      />

      <PersonaOutcomeSection
        theme="host"
        className="mk3-host-outcome-band"
        kicker="What host access is for"
        title="Better room control, cleaner guest flow, and stronger live nights."
        aside={(
          <div className="mk3-rebuild-aside-copy">
            <span>Approval logic</span>
            <strong>Applications move faster with a real room behind them.</strong>
            <p>Recurring shows, fundraisers, venue programs, and standout private events are the clearest fit for BeauRocks host access.</p>
          </div>
        )}
        items={HOST_CORE_OUTCOMES.map((title, index) => ({
          label: `Host 0${index + 1}`,
          title,
          copy: HOST_STORY_POINTS[index] || "Real host operations.",
        }))}
      />

      <PersonaClosingSection
        theme="host"
        className="mk3-host-closing-band"
        kicker="Pick the next step"
        title="Start with access, the demo, or the public-facing product story."
        cards={closingCards}
      />
    </PersonaPageFrame>
  );
};

export default ForHostsPage;
