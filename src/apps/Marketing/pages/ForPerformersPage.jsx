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
      <article className="mk3-detail-card mk3-persona-hero mk3-zone">
        <div className="mk3-persona-kicker">for performers</div>
        <h1>Build your karaoke routine around rooms that deserve your best songs.</h1>
        <p>Skip random nights. Find hosts and venues with reliable energy, a real crowd, and a cadence you can actually build around.</p>
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
            Open Discover Map
          </button>
        </div>
      </article>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-zone">
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
