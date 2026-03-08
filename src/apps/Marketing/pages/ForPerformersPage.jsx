import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const PERFORMER_BADGES = [
  "Find Better Rooms Fast",
  "Plan Weekly Performances",
  "Build Repeat Presence",
];

const PERFORMER_STEPS = [
  {
    title: "Discover quality rooms",
    detail: "Filter by host signal, room energy, and schedules that do not disappear into the void.",
  },
  {
    title: "Commit and show up",
    detail: "Use reminders so the good nights stop slipping past while you say “we should go sometime.”",
  },
  {
    title: "Track what works",
    detail: "Use your profile history to find the rooms where you sounded great and felt even better.",
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
        <section className="mk3-detail-card mk3-persona-flow mk3-zone" aria-label="Performer flow overview">
          <h2>How To Build A Better Karaoke Run</h2>
          <div className="mk3-persona-flow-grid">
            {PERFORMER_STEPS.map((step, index) => (
              <article key={step.title}>
                <span>{`Step ${index + 1}`}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>Performer Checklist</h4>
          <div className="mk3-status">
            <strong>Before your next run</strong>
            <span>Pick a room, set the reminder, and stop leaving your best karaoke nights up to chance.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            <span>Target rooms shortlisted</span>
            <span>Reminders ready</span>
            <span>Next-week plan locked</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForPerformersPage;
