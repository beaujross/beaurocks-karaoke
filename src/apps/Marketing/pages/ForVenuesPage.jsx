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

const VENUE_SIGNAL_CARDS = [
  {
    label: "Cadence",
    title: "Weekly routine beats random hype",
    copy: "The nights that grow are the ones guests can count on without checking three social feeds first.",
  },
  {
    label: "Trust",
    title: "A clean listing removes guesswork",
    copy: "Date, host, room identity, and venue details should line up before you ask anyone to show up.",
  },
  {
    label: "Demand",
    title: "Repeat guests start with clear signal",
    copy: "Reliable discovery turns karaoke into a place people return to, not a lucky one-off find.",
  },
];

const VENUE_FLOW_STEPS = [
  {
    step: "01",
    title: "Claim the venue",
    copy: "Tie the page to the real room owner so schedule changes and host details have an accountable home.",
  },
  {
    step: "02",
    title: "Publish cadence",
    copy: "Make the recurring night obvious so regulars and first-timers know when the room is actually alive.",
  },
  {
    step: "03",
    title: "Align host operations",
    copy: "Make the listing, host identity, and room workflow agree so the public signal stays honest.",
  },
  {
    step: "04",
    title: "Grow repeat attendance",
    copy: "Use follows, RSVPs, and check-ins as proof that the night is becoming part of someone’s weekly plan.",
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
      <article className="mk3-detail-card mk3-persona-hero mk3-zone mk3-venue-hero-shell">
        <div className="mk3-persona-hero-grid">
          <div className="mk3-persona-hero-copy">
            <div className="mk3-persona-kicker">for venues</div>
            <h1>Turn karaoke into the weekly night people already know they are going to.</h1>
            <p>Claim your venue, publish a clear cadence, and make it easy for regulars, new guests, and future big personalities to find you.</p>
            <div className="mk3-persona-badge-row">
              {VENUE_BADGES.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
            <div className="mk3-persona-stat-row">
              <article className="mk3-persona-stat-card">
                <strong>Reliable cadence</strong>
                <span>Help guests trust the schedule enough to build it into their week.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Ownership clarity</strong>
                <span>Make venue, host, and public listing signal agree.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Repeat demand</strong>
                <span>Turn discovery into return attendance instead of random drop-ins.</span>
              </article>
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
              <button
                type="button"
                onClick={() => {
                  trackPersonaCta("secondary_open_discover");
                  navigate("discover");
                }}
              >
                Explore Discover
              </button>
            </div>
          </div>
          <aside className="mk3-persona-hero-visual">
            <article className="mk3-persona-visual-stage is-venue">
              <img src="/images/marketing/tv-surface-live.png" alt="BeauRocks venue night presentation" loading="lazy" />
              <div className="mk3-persona-visual-overlay">
                <div className="mk3-persona-kicker">venue signal</div>
                <strong>Make the night look real before guests even arrive.</strong>
                <span>A strong listing, a clear cadence, and aligned host details create the kind of trust repeat nights are built on.</span>
              </div>
            </article>
            <div className="mk3-persona-signal-grid">
              {VENUE_SIGNAL_CARDS.map((card) => (
                <article key={card.title} className="mk3-persona-signal-card">
                  <span>{card.label}</span>
                  <strong>{card.title}</strong>
                  <p>{card.copy}</p>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </article>

      <section className="mk3-persona-proof-grid">
        {VENUE_OUTCOME_POINTS.map((point, index) => (
          <article key={point} className="mk3-detail-card mk3-zone">
            <span>{`Outcome 0${index + 1}`}</span>
            <strong>{point}</strong>
            <p>One less thing the guest has to guess about before deciding whether your night is worth the trip.</p>
          </article>
        ))}
      </section>

      <section className="mk3-detail-card mk3-zone mk3-persona-flow">
        <h2>How a karaoke night becomes part of someone’s week</h2>
        <div className="mk3-persona-flow-grid">
          {VENUE_FLOW_STEPS.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-zone mk3-persona-playbook">
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
