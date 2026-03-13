import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const PERFORMER_BADGES = [
  "Find better rooms faster",
  "Plan your next night out",
  "Build a weekly rotation",
];

const PERFORMER_STORY_POINTS = [
  "Find rooms you actually want to revisit.",
  "Reliable weekly nights beat random guesses.",
  "Good hosts and clear schedules make song choice easier.",
];

const PERFORMER_PROOF_POINTS = [
  "Hosts you can actually evaluate",
  "Schedules that stay current",
  "Rooms worth adding to your routine",
];

const PERFORMER_SIGNAL_CARDS = [
  {
    label: "Hosts",
    title: "See who is running the night",
    copy: "Know who is running the room before you go.",
  },
  {
    label: "Schedule",
    title: "Build a weekly rotation",
    copy: "Find nights worth building into your week.",
  },
  {
    label: "Fit",
    title: "Bring your best songs to the right room",
    copy: "Pick the room that fits your songs and your crowd.",
  },
];

const PERFORMER_FLOW_STEPS = [
  {
    step: "01",
    title: "Browse the map",
    copy: "Start with current schedules and clear host info.",
  },
  {
    step: "02",
    title: "Check the schedule",
    copy: "Look for nights you can count on.",
  },
  {
    step: "03",
    title: "Pick the right fit",
    copy: "Choose the crowd and pace that fit your songs.",
  },
  {
    step: "04",
    title: "Come back on purpose",
    copy: "Build a short list worth repeating.",
  },
];

const ForPerformersPage = ({ navigate }) => {
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "performer",
      page: "for_performers",
      cta: String(cta || ""),
    });
  };

  return (
    <section className="mk3-page mk3-persona-command is-performer">
      <article className="mk3-detail-card mk3-persona-hero mk3-zone mk3-performer-hero-shell">
        <div className="mk3-persona-hero-grid">
          <div className="mk3-persona-hero-copy">
            <div className="mk3-persona-kicker">for performers</div>
            <h1>Find karaoke nights worth making part of your week.</h1>
            <p>Skip the guesswork. Find rooms with a real crowd and a clear schedule.</p>
            <div className="mk3-persona-badge-row">
              {PERFORMER_BADGES.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
            <div className="mk3-persona-stat-row">
              <article className="mk3-persona-stat-card">
                <strong>Clearer room info</strong>
                <span>See which nights look organized before you go.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Better planning</strong>
                <span>Find nights that can become part of your week.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Better fit</strong>
                <span>Bring your best songs to the right room.</span>
              </article>
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
                  trackPersonaCta("secondary_open_fans");
                  navigate("for_fans");
                }}
              >
                See Audience Experience
              </button>
            </div>
          </div>
          <aside className="mk3-persona-hero-visual">
            <article className="mk3-persona-visual-stage is-performer">
              <img src="/images/marketing/BeauRocks-Audienceapp.png" alt="BeauRocks performer and audience surface" loading="lazy" />
              <div className="mk3-persona-visual-overlay">
                <div className="mk3-persona-kicker">for performers</div>
                <strong>Stop wasting your best songs on random rooms.</strong>
                <span>Use the directory to find nights worth repeating.</span>
              </div>
            </article>
            <div className="mk3-persona-signal-grid">
              {PERFORMER_SIGNAL_CARDS.map((card) => (
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
        {PERFORMER_PROOF_POINTS.map((point, index) => (
          <article key={point} className="mk3-detail-card mk3-zone">
            <span>{`Proof 0${index + 1}`}</span>
            <strong>{point}</strong>
            <p>Clearer rooms are easier to come back to.</p>
          </article>
        ))}
      </section>

      <section className="mk3-detail-card mk3-zone mk3-persona-flow">
          <h2>How performers turn discovery into a real routine</h2>
        <div className="mk3-persona-flow-grid">
          {PERFORMER_FLOW_STEPS.map((item) => (
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
          <div className="mk3-persona-kicker">build your run</div>
          <h2>Stop leaving your karaoke nights up to chance.</h2>
          <p className="mk3-card-story">Use BeauRocks to find rooms with the energy, crowd, and schedule you want.</p>
          <div className="mk3-sub-list compact">
            {PERFORMER_STORY_POINTS.map((point) => (
              <article key={point} className="mk3-review-card">
                <p>{point}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>What To Look For</h4>
          <div className="mk3-status">
            <strong>Choose rooms worth repeating</strong>
            <span>Look for hosts, schedules, and room feel that make you want to come back.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            {PERFORMER_PROOF_POINTS.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForPerformersPage;
