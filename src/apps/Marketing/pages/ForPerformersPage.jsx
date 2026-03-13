import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const PERFORMER_BADGES = [
  "Find better rooms faster",
  "Plan your next night out",
  "Build a weekly rotation",
];

const PERFORMER_STORY_POINTS = [
  "The best karaoke nights are the ones where you can relax, sing well, and want to come back.",
  "A reliable weekly room beats guessing your way through random listings every time.",
  "Good hosts, a steady crowd, and a clear schedule make it easier to pick the right room for your songs.",
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
    copy: "Good karaoke nights usually have a visible host, a clear format, and enough information to know what you are walking into.",
  },
  {
    label: "Schedule",
    title: "Build a weekly rotation",
    copy: "The best karaoke habits come from dependable nights you can plan around, not one-off guesses.",
  },
  {
    label: "Fit",
    title: "Bring your best songs to the right room",
    copy: "A better room means better energy, a better crowd, and a stronger reason to come back next week.",
  },
];

const PERFORMER_FLOW_STEPS = [
  {
    step: "01",
    title: "Browse the map",
    copy: "Start with rooms that show a current schedule, clear host info, and enough detail to feel trustworthy.",
  },
  {
    step: "02",
    title: "Check the schedule",
    copy: "Look for nights that are dependable enough to become part of your routine instead of a gamble.",
  },
  {
    step: "03",
    title: "Pick the right fit",
    copy: "Choose rooms with the pace, crowd, and feel that match the songs you want to bring.",
  },
  {
    step: "04",
    title: "Come back on purpose",
    copy: "The goal is not one lucky night. It is a short list of karaoke rooms worth repeating.",
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
            <p>Skip the guesswork. Find hosts and venues with a real crowd, a clear schedule, and the kind of room you will actually want to revisit.</p>
            <div className="mk3-persona-badge-row">
              {PERFORMER_BADGES.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
            <div className="mk3-persona-stat-row">
              <article className="mk3-persona-stat-card">
                <strong>Clearer room info</strong>
                <span>See which nights look organized before you commit your evening.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Better planning</strong>
                <span>Find nights that can become part of your weekly rotation instead of a one-off guess.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Better fit</strong>
                <span>Bring your best songs to rooms with the pace and crowd to support them.</span>
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
                <span>Use the directory to find karaoke nights with enough consistency, energy, and clarity to be worth repeating.</span>
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
            <p>The more clearly a room explains itself before you go, the easier it is to build an actual routine around it.</p>
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
          <p className="mk3-card-story">
            BeauRocks helps performers find rooms with the right energy, the right crowd,
            and a schedule reliable enough to build into a routine.
          </p>
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
            <span>Look for the hosts, schedules, and room feel that make you want to come back next week too.</span>
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
