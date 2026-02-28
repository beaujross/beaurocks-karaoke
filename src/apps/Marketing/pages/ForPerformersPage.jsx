import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const PERFORMER_BADGES = [
  "Find Better Rooms Faster",
  "Track Your Karaoke Identity",
  "Build A Repeat Presence",
  "Move From Guest To Standout",
];

const PERFORMER_FLOW = [
  {
    title: "Discover Strong Rooms",
    detail: "Filter by host quality, venue consistency, and timing that fits your schedule.",
  },
  {
    title: "Plan Your Week",
    detail: "Use reminders and follows so your next performance is already lined up.",
  },
  {
    title: "Perform + Engage",
    detail: "Show up ready and contribute to rooms where crowd energy is consistently high.",
  },
  {
    title: "Track Progress",
    detail: "Keep your song history and room momentum visible over time.",
  },
];

const PERFORMER_PROOF = [
  {
    label: "Discovery",
    title: "Less roulette, more signal",
    note: "Prioritize rooms where host quality and venue cadence are proven.",
  },
  {
    label: "Consistency",
    title: "Recurring performance habit",
    note: "RSVP and reminders reduce missed high-value nights.",
  },
  {
    label: "Growth",
    title: "Stronger performer identity",
    note: "Your room history becomes an asset, not scattered memory.",
  },
];

const PERFORMER_PLAYBOOK = [
  "Follow hosts who run tight queue flow and consistent room energy.",
  "Anchor your week around recurring rooms, not one-off random nights.",
  "Use profile history to double down on your best-performing environments.",
  "Turn attendance consistency into real local recognition.",
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
        <h1>Find the right rooms and build your karaoke legacy.</h1>
        <p>
          Stop relying on random nights. BeauRocks helps performers target rooms with real signal,
          stay consistent, and grow a repeatable presence.
        </p>
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
            Find Spotlight Nights
          </button>
          {canUseDashboard ? (
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("secondary_open_performer_dashboard");
                navigate("profile");
              }}
            >
              Open Performer Dashboard
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("secondary_create_account_for_dashboard");
                authFlow?.requireFullAuth?.({
                  intent: "profile",
                  targetType: "profile",
                  targetId: "",
                  returnRoute: { page: "profile" },
                });
              }}
            >
              Create Performer Account
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_watch_demo");
              navigate("demo");
            }}
          >
            Watch Demo
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_start_hosting");
              navigate("for_hosts");
            }}
          >
            Start Hosting
          </button>
        </div>
        <div className="mk3-persona-proof-grid" aria-label="Performer proof points">
          {PERFORMER_PROOF.map((entry) => (
            <article key={entry.title}>
              <span>{entry.label}</span>
              <strong>{entry.title}</strong>
              <p>{entry.note}</p>
            </article>
          ))}
        </div>
      </article>

      <section className="mk3-detail-card mk3-persona-flow mk3-zone" aria-label="Performer flow overview">
        <h2>Performer Loop</h2>
        <div className="mk3-persona-flow-grid">
          {PERFORMER_FLOW.map((step, index) => (
            <article key={step.title}>
              <span>{`Step ${index + 1}`}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mk3-two-col mk3-persona-late-grid">
        <article className="mk3-detail-card mk3-persona-playbook">
          <h2>Performer Playbook</h2>
          <p>
            The fastest route to performer growth is consistency in high-quality rooms. Build your schedule around
            reliable hosts and keep your performance footprint intentional.
          </p>
          <ul className="mk3-plain-list">
            {PERFORMER_PLAYBOOK.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>Performer Checklist</h4>
          <div className="mk3-status">
            <strong>Before your next run</strong>
            <span>Confirm the room signal, your plan, and your follow-through path.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            <span>Target rooms shortlisted</span>
            <span>RSVP/reminders configured</span>
            <span>Profile updated</span>
            <span>Next-week plan set</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForPerformersPage;
