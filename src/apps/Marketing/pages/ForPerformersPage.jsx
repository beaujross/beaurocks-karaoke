import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const PERFORMER_BADGES = [
  "Find Better Rooms Fast",
  "Plan Weekly Performances",
  "Build Repeat Presence",
];

const PERFORMER_STEPS = [
  {
    title: "Discover quality rooms",
    detail: "Filter by host signal and consistent schedules.",
  },
  {
    title: "Commit and show up",
    detail: "Use reminders so strong nights do not slip.",
  },
  {
    title: "Track what works",
    detail: "Use profile history to repeat your best environments.",
  },
];

const ForPerformersPage = ({ navigate, session, authFlow }) => {
  const canUseDashboard = !!session?.uid && !session?.isAnonymous;
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "performer",
      page: "for_performers",
      cta: String(cta || ""),
    });
  };

  return (
    <section className="mk3-page mk3-persona-command is-performer">
      <article className="mk3-detail-card mk3-persona-hero mk3-zone">
        <div className="mk3-persona-kicker">for performers</div>
        <h1>Build your karaoke routine around better rooms.</h1>
        <p>Skip random nights. Focus on hosts and venues with reliable energy and cadence.</p>
        <div className="mk3-persona-badge-row">
          {PERFORMER_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("primary_find_spotlight_nights");
              navigate("discover");
            }}
          >
            Open Discover Map
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta(canUseDashboard ? "secondary_open_dashboard" : "secondary_create_account");
              if (canUseDashboard) {
                navigate("profile");
                return;
              }
              authFlow?.requireFullAuth?.({
                intent: "profile",
                targetType: "profile",
                targetId: "",
                returnRoute: { page: "profile" },
              });
            }}
          >
            {canUseDashboard ? "Open Performer Dashboard" : "Create Performer Account"}
          </button>
        </div>
      </article>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-persona-flow mk3-zone" aria-label="Performer flow overview">
          <h2>Performer Loop In 3 Steps</h2>
          <div className="mk3-persona-flow-grid">
            {PERFORMER_STEPS.map((step, index) => (
              <article key={step.title}>
                <span>{`Step ${index + 1}`}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>Performer Checklist</h4>
          <div className="mk3-status">
            <strong>Before your next run</strong>
            <span>Pick a room, set reminders, and show up consistently.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            <span>Target rooms shortlisted</span>
            <span>RSVP/reminders configured</span>
            <span>Next-week plan set</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForPerformersPage;
