import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const FAN_BADGES = [
  "Fast Rotation",
  "Welcoming Crowd",
  "Live Join",
];

const FAN_SIGNAL_POINTS = [
  "Crowd vibe and host energy",
  "Rotation that does not eat your whole night",
  "Live join, audience play, and modern room features",
];

const FAN_PROOF_POINTS = [
  "Less guessing, fewer dud nights.",
  "A better read on whether the room fits your crew.",
  "Real signals instead of old flyers and mystery Facebook posts.",
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
        <h1>Pick a karaoke night with better signals.</h1>
        <p>
          BeauRocks helps you spot the rooms worth leaving the house for:
          good hosts, better rotation, the right crowd, and nights that already feel alive.
        </p>
        <div className="mk3-persona-badge-row">
          {FAN_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        {heroStats?.total > 0 && (
          <div className="mk3-status mk3-hero-proof">
            <strong>{heroStats.total.toLocaleString()} karaoke listings live</strong>
            <span>Enough to browse with taste, not just luck.</span>
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
            Find Tonight&apos;s Room
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("secondary_open_geo_nationwide");
              navigate("geo_region", "", { regionToken: "nationwide" });
            }}
          >
            Browse Nationwide
          </button>
        </div>
      </article>

      <div className="mk3-two-col mk3-persona-late-grid">
        <section className="mk3-detail-card mk3-zone">
          <div className="mk3-persona-kicker">what beaurocks shows</div>
          <h2>The goal is simple: help you find the good nights faster.</h2>
          <p className="mk3-card-story">
            Not every karaoke room is for every person. BeauRocks helps you spot the difference
            before you commit the drive, the parking, and the first song.
          </p>
          <div className="mk3-persona-checklist-list">
            {FAN_SIGNAL_POINTS.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>
        </section>

        <aside className="mk3-actions-card">
          <h4>Why Use It</h4>
          <div className="mk3-status">
            <strong>Better karaoke picks, less roulette</strong>
            <span>Use the room signals to find the nights that feel fun before you walk in.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            {FAN_PROOF_POINTS.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>
          <div className="mk3-actions-inline">
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("tertiary_open_discover");
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
