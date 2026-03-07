import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const FAN_BADGES = [
  "Fast Rotation",
  "Welcoming Crowd",
  "Live Join + Audience Play",
  "Verified Weekly Nights",
];

const FAN_STEPS = [
  {
    title: "Pick your vibe",
    detail: "Choose between beginner-friendly, big singalong, fast-rotation, or serious-singer rooms.",
  },
  {
    title: "Spot the modern nights",
    detail: "Look for BeauRocks-powered signals like live join, audience play, recap, and fresh schedule proof.",
  },
  {
    title: "Show up ready to sing",
    detail: "Set reminders, invite friends, and walk into a room that fits your energy instead of guessing.",
  },
];

const FAN_FUN_SIGNALS = [
  "Host vibe and crowd energy",
  "Fast or forgiving rotation",
  "Beginner-safe versus big-voice rooms",
  "BeauRocks nights with live join and recap proof",
];

const FAN_MODERN_SIGNALS = [
  "Live Join",
  "Audience App",
  "Interactive TV",
  "Recap Ready",
];

const ForFansPage = ({ navigate, heroStats }) => {
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "fan",
      page: "for_fans",
      cta: String(cta || ""),
    });
  };

  return (
    <section className="mk3-page mk3-persona-command is-fan">
      <article className="mk3-detail-card mk3-persona-hero mk3-zone">
        <div className="mk3-persona-kicker">karaoke night finder</div>
        <h1>Find the karaoke night that fits your vibe tonight.</h1>
        <p>
          BeauRocks helps people find rooms with real crowd energy, humane rotation, strong hosts,
          and modern karaoke features that make older listings feel static.
        </p>
        <div className="mk3-persona-badge-row">
          {FAN_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        {heroStats?.total > 0 && (
          <div className="mk3-status mk3-hero-proof">
            <strong>{heroStats.total.toLocaleString()} karaoke listings live in the directory</strong>
            <span>Use BeauRocks signals to separate modern nights from generic event posts.</span>
          </div>
        )}
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("primary_open_discover");
              navigate("discover");
            }}
          >
            Find Tonight's Room
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("secondary_open_geo_nationwide");
              navigate("geo_region", "", { regionToken: "nationwide" });
            }}
          >
            Browse Karaoke Guides
          </button>
        </div>
      </article>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-persona-flow mk3-zone" aria-label="Guest flow overview">
          <h2>How BeauRocks Helps You Pick Better Nights</h2>
          <div className="mk3-persona-flow-grid">
            {FAN_STEPS.map((step, index) => (
              <article key={step.title}>
                <span>{`Step ${index + 1}`}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>What To Look For</h4>
          <div className="mk3-status">
            <strong>Great karaoke nights are specific</strong>
            <span>Rotation, host vibe, crowd chemistry, and room tech matter more than a generic flyer.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            {FAN_FUN_SIGNALS.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        </aside>
      </div>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-zone">
          <div className="mk3-persona-kicker">modern karaoke</div>
          <h2>Why BeauRocks-powered nights feel different</h2>
          <p className="mk3-card-story">
            Static listings tell you where karaoke exists. BeauRocks helps you see which nights are active,
            interactive, and actually worth showing up for.
          </p>
          <div className="mk3-experience-pill-row is-modern">
            {FAN_MODERN_SIGNALS.map((signal) => (
              <span key={signal} className="mk3-experience-pill is-modern">{signal}</span>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card">
          <h4>Tonight Ready</h4>
          <div className="mk3-status">
            <strong>Start with the right room</strong>
            <span>Pick your vibe, lock the reminder, then look for live-join and recap-ready nights.</span>
          </div>
          <div className="mk3-actions-inline">
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("tertiary_open_discover_modern");
                navigate("discover");
              }}
            >
              Open Discover
            </button>
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("tertiary_submit_listing");
                navigate("submit", "", { intent: "listing_submit", targetType: "fan_tip" });
              }}
            >
              Add A Night
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForFansPage;
