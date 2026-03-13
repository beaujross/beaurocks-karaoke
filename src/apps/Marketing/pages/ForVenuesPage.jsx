import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const VENUE_BADGES = [
  "Claim your listing",
  "Publish a reliable schedule",
  "Grow repeat attendance",
];

const VENUE_STORY_POINTS = [
  "The best karaoke nights become part of someone's weekly routine.",
  "Clear listings and schedules help guests trust the plan.",
  "A venue page should answer the basics fast.",
];

const VENUE_OUTCOME_POINTS = [
  "Verified ownership",
  "Published weekly schedule",
  "Clear host and venue details",
  "More repeat intent",
];

const VENUE_SIGNAL_CARDS = [
  {
    label: "Schedule",
    title: "Reliable nights beat random hype",
    copy: "Guests come back to nights they can count on.",
  },
  {
    label: "Trust",
    title: "A clear listing removes guesswork",
    copy: "Date, host, and venue details should all line up.",
  },
  {
    label: "Demand",
    title: "Repeat guests start with a clear plan",
    copy: "Reliable discovery turns drop-ins into regulars.",
  },
];

const VENUE_FLOW_STEPS = [
  {
    step: "01",
    title: "Claim the venue",
    copy: "Keep updates in the right hands.",
  },
  {
    step: "02",
    title: "Publish the schedule",
    copy: "Make the karaoke night easy to find.",
  },
  {
    step: "03",
    title: "Match the host details",
    copy: "Keep the listing, host, and venue aligned.",
  },
  {
    step: "04",
    title: "Grow repeat attendance",
    copy: "Turn discovery into return visits.",
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
            <h1>Turn karaoke into a night guests plan around.</h1>
            <p>Claim your venue, publish a clear schedule, and make the night easy to trust.</p>
            <div className="mk3-persona-badge-row">
              {VENUE_BADGES.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
            <div className="mk3-persona-stat-row">
              <article className="mk3-persona-stat-card">
                <strong>Reliable schedule</strong>
                <span>Help guests build your night into their week.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Clear ownership</strong>
                <span>Keep the venue, host, and public listing aligned.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Repeat demand</strong>
                <span>Turn discovery into return attendance.</span>
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
                Browse Karaoke Nights
              </button>
            </div>
          </div>
          <aside className="mk3-persona-hero-visual">
            <article className="mk3-persona-visual-stage is-venue">
              <img src="/images/marketing/tv-surface-live.png" alt="BeauRocks venue night presentation" loading="lazy" />
              <div className="mk3-persona-visual-overlay">
                <div className="mk3-persona-kicker">for venues</div>
                <strong>Make the night feel real before guests even arrive.</strong>
                <span>A strong listing and a clear schedule build trust fast.</span>
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
            <p>One less question before a guest decides to show up.</p>
          </article>
        ))}
      </section>

      <section className="mk3-detail-card mk3-zone mk3-persona-flow">
        <h2>How a karaoke night becomes part of someone's week</h2>
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
          <p className="mk3-card-story">BeauRocks helps venues make karaoke feel dependable, current, and worth planning around.</p>
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
            <strong>Keep the listing accurate</strong>
            <span>Ownership, schedule, and host details should agree.</span>
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
