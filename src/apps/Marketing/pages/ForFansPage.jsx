import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const FAN_BADGES = [
  "Find Better Nights Quickly",
  "Join Rooms With Real Energy",
  "Stay In The Loop",
];

const FAN_STEPS = [
  {
    title: "Find the right room",
    detail: "Use map + timing + host signal to avoid low-energy nights.",
  },
  {
    title: "Commit early",
    detail: "Set RSVP/reminders for your top picks.",
  },
  {
    title: "Participate live",
    detail: "Use audience tools and build repeat routines.",
  },
];

const ForFansPage = ({ navigate }) => {
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "fan",
      page: "for_fans",
      cta: String(cta || ""),
    });
  };

  return (
    <section className="mk3-page mk3-persona-command is-fan">
      <article className="mk3-detail-card mk3-persona-hero mk3-zone">
        <div className="mk3-persona-kicker">for guests</div>
        <h1>Find premium karaoke nights without guesswork.</h1>
        <p>Open the map, pick the strongest room, and actually enjoy the night.</p>
        <div className="mk3-persona-badge-row">
          {FAN_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("primary_open_discover");
              navigate("discover");
            }}
          >
            Open Discover Map
          </button>
        </div>
      </article>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-persona-flow mk3-zone" aria-label="Guest flow overview">
          <h2>Guest Loop In 3 Steps</h2>
          <div className="mk3-persona-flow-grid">
            {FAN_STEPS.map((step, index) => (
              <article key={step.title}>
                <span>{`Step ${index + 1}`}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>Guest Checklist</h4>
          <div className="mk3-status">
            <strong>Tonight ready</strong>
            <span>Pick room, set reminder, invite friends.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            <span>Room selected</span>
            <span>RSVP/reminder set</span>
            <span>Audience app ready</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForFansPage;
