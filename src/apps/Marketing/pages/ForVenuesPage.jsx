import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const VENUE_BADGES = [
  "Claim + Control Listing",
  "Publish Reliable Schedule",
  "Grow Repeat Attendance",
];

const VENUE_STORY_POINTS = [
  "The best karaoke nights become part of someone’s weekly routine, not a lucky accident.",
  "Clear listings and reliable cadence help regulars return and help new guests trust the plan.",
  "A venue page should answer the basics fast instead of forcing people to play detective.",
];

const VENUE_OUTCOME_POINTS = [
  "Ownership verified",
  "Recurring schedule published",
  "Hosts and venue details aligned",
  "Follows, RSVPs, and check-ins pointing to repeat demand",
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
        <h1>Turn karaoke into the weekly night people already know they are going to.</h1>
        <p>Claim your venue, publish a clear cadence, and make it easy for regulars, new guests, and future big personalities to find you.</p>
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
        <section className="mk3-detail-card mk3-zone">
          <div className="mk3-persona-kicker">why venue pages matter</div>
          <h2>People come back to the nights they can count on.</h2>
          <p className="mk3-card-story">
            BeauRocks helps venues make karaoke feel dependable, current, and worth planning around,
            which is a much better growth strategy than hoping people decode a blurry social post.
          </p>
          <div className="mk3-sub-list compact">
            {VENUE_STORY_POINTS.map((point) => (
              <article key={point} className="mk3-review-card">
                <p>{point}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>What Good Setup Looks Like</h4>
          <div className="mk3-status">
            <strong>Keep the listing honest</strong>
            <span>Ownership, schedule, and host operations should agree before you ask anyone to show up.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            {VENUE_OUTCOME_POINTS.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForVenuesPage;
