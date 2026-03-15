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

const VENUE_TRUST_SIGNALS = [
  {
    label: "Attendance",
    title: "Regular nights win over random nights",
    copy: "A clear recurring schedule gives guests a reason to come back on purpose.",
  },
  {
    label: "Trust",
    title: "A venue page should answer the basics fast",
    copy: "Date, host, room style, and venue details should line up without guesswork.",
  },
  {
    label: "Room feel",
    title: "A better screen flow makes the venue feel more organized",
    copy: "The TV, host deck, and audience join flow help the room feel intentional from the start.",
  },
];

const VENUE_SURFACE_STEPS = [
  {
    step: "01",
    title: "The TV tells the room where to look",
    copy: "A public join prompt and live room state make karaoke feel easier to understand in a busy venue.",
    imageUrl: "/images/marketing/tv-live-aahf-current.png",
  },
  {
    step: "02",
    title: "Guest phones lower the friction",
    copy: "People join, react, and request without crowding the host stand or asking what to do next.",
    imageUrl: "/images/marketing/audience-surface-live.png",
  },
  {
    step: "03",
    title: "The host keeps the venue night moving",
    copy: "Search, queue, and TV controls stay in one place so the room keeps its pace.",
    imageUrl: "/images/marketing/BeauRocks-HostPanel.png",
  },
];

const VENUE_FINAL_PATHS = [
  {
    title: "Claim your venue",
    copy: "Start the venue ownership flow if you want to manage listing details and schedule visibility.",
    cta: "Claim Your Venue",
    action: "claim",
  },
  {
    title: "Browse live nights",
    copy: "See how current venue and room listings appear publicly in discovery.",
    cta: "Open Discover",
    action: "discover",
  },
  {
    title: "Watch the product story",
    copy: "Open the demo to see how host, TV, and audience work together across the room.",
    cta: "Open Demo",
    action: "demo_auto",
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
              <img src="/images/marketing/tv-live-aahf-current.png" alt="BeauRocks Public TV room state with QR join prompt" loading="lazy" />
              <div className="mk3-persona-visual-overlay">
                <div className="mk3-persona-kicker">for venues</div>
                <strong>Show the room code, stage prompt, and queue on one clean screen.</strong>
                <span>When the TV clearly says Stage Open and Scan to Sing, the room feels organized fast.</span>
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

      <section className="mk3-detail-card mk3-zone mk3-marketing-rich-band">
        <div>
          <div className="mk3-persona-kicker">why venues care</div>
          <h2>Better karaoke nights become part of a guest's routine.</h2>
        </div>
        <div className="mk3-marketing-signal-grid">
          {VENUE_TRUST_SIGNALS.map((item) => (
            <article key={item.title} className="mk3-marketing-signal-card">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-marketing-how-band">
        <div>
          <div className="mk3-persona-kicker">how the venue experience improves</div>
          <h2>The room gets easier to understand on every screen.</h2>
        </div>
        <div className="mk3-marketing-step-grid">
          {VENUE_SURFACE_STEPS.map((item) => (
            <article key={item.step} className="mk3-marketing-step-card">
              <img src={item.imageUrl} alt={item.title} loading="lazy" />
              <div>
                <span>{item.step}</span>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-marketing-outcome-band">
        <div>
          <div className="mk3-persona-kicker">venue outcomes</div>
          <h2>Each improvement removes one more source of guest confusion.</h2>
        </div>
        <div className="mk3-marketing-outcome-grid">
          {VENUE_OUTCOME_POINTS.map((point, index) => (
            <article key={point}>
              <span>{`Outcome 0${index + 1}`}</span>
              <strong>{point}</strong>
              <p>{VENUE_STORY_POINTS[index] || "One less question before a guest decides to show up."}</p>
            </article>
          ))}
        </div>
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

      <section className="mk3-detail-card mk3-zone mk3-marketing-closing-band">
        <div>
          <div className="mk3-persona-kicker">pick the next step</div>
          <h2>Start with venue ownership, discovery, or the product demo.</h2>
        </div>
        <div className="mk3-marketing-closing-grid">
          {VENUE_FINAL_PATHS.map((item) => (
            <article key={item.title} className="mk3-marketing-closing-card">
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
              <button
                type="button"
                onClick={() => {
                  trackPersonaCta(`closing_${item.action}`);
                  if (item.action === "claim") {
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
                    return;
                  }
                  navigate(item.action);
                }}
              >
                {item.cta}
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
};

export default ForVenuesPage;
