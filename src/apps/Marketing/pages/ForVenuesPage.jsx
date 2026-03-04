import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const VENUE_BADGES = [
  "Claim + Control Listing",
  "Publish Reliable Schedule",
  "Grow Repeat Attendance",
];

const VENUE_STEPS = [
  {
    title: "Claim your venue",
    detail: "Own profile updates and publishing access.",
  },
  {
    title: "Set weekly cadence",
    detail: "Make karaoke timing predictable for regulars.",
  },
  {
    title: "Track outcomes",
    detail: "Use follows, RSVPs, and check-ins to guide programming.",
  },
];

const ForVenuesPage = ({ navigate, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "venue_owner",
      page: "for_venues",
      cta: String(cta || ""),
    });
  };

  return (
    <section className="mk3-page mk3-persona-command is-venue">
      <article className="mk3-detail-card mk3-persona-hero mk3-zone">
        <div className="mk3-persona-kicker">for venues</div>
        <h1>Turn karaoke into a dependable weekly draw.</h1>
        <p>Claim your venue, publish a clear cadence, and keep room quality consistent.</p>
        <div className="mk3-persona-badge-row">
          {VENUE_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta(canSubmit ? "primary_claim_venue" : "primary_claim_venue_auth_gate");
              if (canSubmit) {
                navigate("submit");
                return;
              }
              authFlow?.requireFullAuth?.({
                intent: "listing_submit",
                targetType: "venue",
                targetId: "",
                returnRoute: { page: "submit", params: { intent: "listing_submit", targetType: "venue" } },
              });
            }}
          >
            Claim Your Venue
          </button>
        </div>
      </article>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-persona-flow mk3-zone" aria-label="Venue flow overview">
          <h2>Venue Loop In 3 Steps</h2>
          <div className="mk3-persona-flow-grid">
            {VENUE_STEPS.map((step, index) => (
              <article key={step.title}>
                <span>{`Step ${index + 1}`}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>Venue Checklist</h4>
          <div className="mk3-status">
            <strong>Before promotion</strong>
            <span>Publish only after ownership, schedule, and host operations are aligned.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            <span>Ownership verified</span>
            <span>Recurring schedule published</span>
            <span>Host workflow confirmed</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForVenuesPage;
