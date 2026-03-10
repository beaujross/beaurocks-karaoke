import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const PERFORMER_BADGES = [
  "Find Better Rooms Fast",
  "Plan Weekly Performances",
  "Build Repeat Presence",
];

const PERFORMER_STORY_POINTS = [
  "Better rooms make it easier to sing well, settle in, and actually enjoy being on stage.",
  "Reliable cadence beats random karaoke roulette every time.",
  "Your best songs deserve rooms with good energy, decent flow, and a crowd that is there for it.",
];

const PERFORMER_PROOF_POINTS = [
  "Hosts with signal, not mystery",
  "Schedules that stay current",
  "Rooms you can build into a weekly run",
];

const PERFORMER_SIGNAL_CARDS = [
  {
    label: "Signal",
    title: "Find rooms with real operator energy",
    copy: "Good nights usually have visible hosts, clear flow, and enough room signal to tell what you are walking into.",
  },
  {
    label: "Cadence",
    title: "Build a weekly run",
    copy: "Better karaoke habits come from repeatable nights, not random roulette across inconsistent rooms.",
  },
  {
    label: "Fit",
    title: "Save your best songs for rooms that earn them",
    copy: "A better room means better focus, better energy, and a stronger reason to keep coming back.",
  },
];

const PERFORMER_FLOW_STEPS = [
  {
    step: "01",
    title: "Scan the map",
    copy: "Start with rooms that already show live signal, current schedule, and clear host identity.",
  },
  {
    step: "02",
    title: "Check cadence",
    copy: "Look for nights that are dependable enough to become part of your routine instead of a gamble.",
  },
  {
    step: "03",
    title: "Test the fit",
    copy: "Choose rooms with the flow, crowd, and energy that actually support the songs you want to bring.",
  },
  {
    step: "04",
    title: "Come back on purpose",
    copy: "The goal is not one lucky night. It is a short list of rooms worth repeating.",
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
            <h1>Build your karaoke routine around rooms that deserve your best songs.</h1>
            <p>Skip random nights. Find hosts and venues with reliable energy, a real crowd, and a cadence you can actually build around.</p>
            <div className="mk3-persona-badge-row">
              {PERFORMER_BADGES.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
            <div className="mk3-persona-stat-row">
              <article className="mk3-persona-stat-card">
                <strong>Cleaner signal</strong>
                <span>See which rooms look intentional before you spend the night guessing.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Better cadence</strong>
                <span>Find rooms that can become part of a weekly loop instead of a one-off gamble.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Stronger fit</strong>
                <span>Bring your best songs to nights with the crowd and flow to support them.</span>
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
                <div className="mk3-persona-kicker">performer signal</div>
                <strong>Stop gambling your best songs on random rooms.</strong>
                <span>Use the directory to find nights with enough consistency, crowd energy, and host clarity to be worth repeating.</span>
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
            <span>{`Signal 0${index + 1}`}</span>
            <strong>{point}</strong>
            <p>The more visible the room signal is before you go, the easier it is to build an actual routine around it.</p>
          </article>
        ))}
      </section>

      <section className="mk3-detail-card mk3-zone mk3-persona-flow">
        <h2>How performers turn discovery into a real run</h2>
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
          <h2>Stop leaving your best karaoke nights up to chance.</h2>
          <p className="mk3-card-story">
            BeauRocks helps performers find rooms with the right energy and the right cadence,
            so the night feels like part of a routine instead of a random gamble.
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
          <h4>What To Optimize For</h4>
          <div className="mk3-status">
            <strong>Pick rooms worth repeating</strong>
            <span>Find the hosts, schedules, and room feel that make you want to come back next week too.</span>
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
