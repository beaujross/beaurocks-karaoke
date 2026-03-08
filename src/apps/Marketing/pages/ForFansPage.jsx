import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const FAN_BADGES = [
  "Fast Rotation",
  "Welcoming Crowd",
  "Live Join + Audience Play",
  "Weekly Nights Worth Repeating",
];

const FAN_STORY_POINTS = [
  "Find the nights that fit your crowd, not just the bars that happen to own a microphone.",
  "See which rooms feel alive before you commit to getting dressed, parking, and singing in public.",
  "Use better signals than a dusty flyer and a vague Facebook post from three months ago.",
];

const FAN_MODERN_SIGNALS = [
  "Live Join",
  "Audience App",
  "Interactive TV",
  "Recap Ready",
];

const FAN_PROOF_POINTS = [
  "Host vibe and crowd energy matter.",
  "Rotation speed changes the whole night.",
  "Beginner-safe rooms and big-voice rooms are not the same thing.",
  "Modern nights show live join, audience play, and recap proof instead of just saying 'karaoke here'.",
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
        <h1>Find the karaoke night that fits your vibe, your voice, and your group chat.</h1>
        <p>
          BeauRocks helps you spot rooms with real crowd energy, humane rotation, strong hosts,
          and modern karaoke features that make the usual stale listings feel a little sleepy.
        </p>
        <div className="mk3-persona-badge-row">
          {FAN_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        {heroStats?.total > 0 && (
          <div className="mk3-status mk3-hero-proof">
            <strong>{heroStats.total.toLocaleString()} karaoke listings live in the directory</strong>
            <span>Use BeauRocks signals to separate the good nights from the “maybe karaoke???” posts.</span>
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
        <section className="mk3-detail-card mk3-zone">
          <div className="mk3-persona-kicker">why this matters</div>
          <h2>Great karaoke nights are weirdly specific, and that is the point.</h2>
          <p className="mk3-card-story">
            Static listings tell you where karaoke technically exists. BeauRocks helps you spot the nights
            with the right crowd, the right host energy, and the kind of room you would happily drag friends to twice.
          </p>
          <div className="mk3-sub-list compact">
            {FAN_STORY_POINTS.map((point) => (
              <article key={point} className="mk3-review-card">
                <p>{point}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card">
          <h4>What BeauRocks Shows</h4>
          <div className="mk3-status">
            <strong>Start with better signals</strong>
            <span>Rotation, host vibe, crowd chemistry, and room tech tell you way more than a generic karaoke flyer ever will.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            {FAN_PROOF_POINTS.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        </aside>
      </div>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-zone">
          <div className="mk3-persona-kicker">modern karaoke</div>
          <h2>The good nights should feel alive before you even walk in.</h2>
          <p className="mk3-card-story">
            BeauRocks nights surface the stuff fans actually care about: live join, audience play,
            interactive TV, and recap-ready proof that the room is doing more than existing on a calendar.
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
            <strong>Pick the right room first</strong>
            <span>Lock the vibe, send the invite, and stop gambling your night on vague karaoke listings.</span>
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
