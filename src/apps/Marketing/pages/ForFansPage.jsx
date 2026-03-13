import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import {
  MARKETING_BRAND_BADGE_URL,
  MARKETING_DJ_BEAUROCKS_AVATAR_URL,
} from "./shared";

const FAN_BADGES = [
  "Start in minutes",
  "Guests join from their phones",
  "Keep the room engaged",
];

const HERO_PROOF_POINTS = [
  "Start faster",
  "Keep guests involved",
  "Run a cleaner room",
];

const VISUAL_CARDS = [
  {
    title: "Playback that fits the room",
    copy: "Stream, local media, or both.",
    imageUrl: "/images/marketing/tv-surface-live.png",
  },
  {
    title: "Guests join fast",
    copy: "Join, react, vote, and play from a phone.",
    imageUrl: "/images/marketing/BeauRocks-Audienceapp.png",
  },
  {
    title: "Real host controls when you want them",
    copy: "Keep the queue and TV moving without losing the room.",
    imageUrl: "/images/marketing/BeauRocks-HostPanel.png",
  },
];

const QUICK_PROOF = [
  {
    title: "Feels organized from the start",
    copy: "Guests know how to join. The music starts fast.",
  },
  {
    title: "More people stay involved",
    copy: "The whole room stays in it, not just the singer.",
  },
  {
    title: "Simple when you want it, deeper when you need it",
    copy: "Keep it simple or open up the full host tools.",
  },
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
      <article className="mk3-detail-card mk3-fans-home-hero mk3-zone">
        <div className="mk3-fans-home-copy">
          <div className="mk3-persona-kicker">beaurocks karaoke overview</div>
          <div className="mk3-fans-home-brand-pill">
            <img src={MARKETING_BRAND_BADGE_URL} alt="BeauRocks badge" />
            <span>Easy to host. Easy to join. Built for a room that stays engaged.</span>
          </div>
          {heroStats?.total > 0 && (
            <div className="mk3-fans-home-live-proof">
              <strong>{heroStats.total.toLocaleString()} live listings tracked</strong>
            </div>
          )}
          <h1>Karaoke nights that are easier to run and more fun to join.</h1>
          <p>Start faster, let guests join from their phones, and keep the room moving.</p>
          <div className="mk3-actions-inline">
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("primary_open_discover");
                navigate("discover");
              }}
            >
              Explore Live Nights
            </button>
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("secondary_open_host_overview");
                navigate("for_hosts");
              }}
            >
              See Host Tools
            </button>
          </div>
          <div className="mk3-persona-badge-row">
            {FAN_BADGES.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
          <div className="mk3-fans-home-proof-list">
            {HERO_PROOF_POINTS.map((item) => (
              <article key={item}>
                <strong>{item}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="mk3-fans-home-visual">
          <article className="mk3-fans-home-stage">
            <img
              className="mk3-fans-home-stage-poster"
              src="/images/marketing/aahf-karaoke-kickoff-2026.png"
              alt="AAHF Karaoke Kickoff event poster"
              loading="lazy"
            />
            <div className="mk3-fans-home-stage-overlay">
              <div className="mk3-fans-home-stage-topline">
                <div className="mk3-chip mk3-chip-elevated">
                  <img className="mk3-chip-icon" src={MARKETING_BRAND_BADGE_URL} alt="BeauRocks badge" loading="lazy" />
                  <span>Hosted with BeauRocks</span>
                </div>
                <div className="mk3-fans-home-host-pill">
                  <img src={MARKETING_DJ_BEAUROCKS_AVATAR_URL} alt="DJ BeauRocks" loading="lazy" />
                  <span>DJ BeauRocks</span>
                </div>
              </div>
              <div className="mk3-fans-home-stage-copy">
                <strong>One night. Three synchronized views. A room that feels fully hosted.</strong>
                <span>TV leads. Phones join in. The host stays in control.</span>
              </div>
              <div className="mk3-fans-home-stage-stack" aria-hidden="true">
                <article className="mk3-fans-home-stage-panel is-audience">
                  <span>Audience App</span>
                  <img src="/images/marketing/BeauRocks-Audienceapp.png" alt="" loading="lazy" />
                </article>
                <article className="mk3-fans-home-stage-panel is-tv">
                  <span>Public TV</span>
                  <img src="/images/marketing/tv-surface-live.png" alt="" loading="lazy" />
                </article>
                <article className="mk3-fans-home-stage-panel is-host">
                  <span>Host Dashboard</span>
                  <img src="/images/marketing/BeauRocks-HostPanel.png" alt="" loading="lazy" />
                </article>
              </div>
            </div>
          </article>

          <div className="mk3-fans-home-system-grid">
            {VISUAL_CARDS.map((card) => (
              <article key={card.title} className="mk3-fans-home-system-card">
                <img src={card.imageUrl} alt={card.title} loading="lazy" />
                <div>
                  <strong>{card.title}</strong>
                  <span>{card.copy}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </article>

      <section className="mk3-fans-home-proof-grid">
        {QUICK_PROOF.map((item) => (
          <article key={item.title} className="mk3-detail-card mk3-zone">
            <strong>{item.title}</strong>
            <span>{item.copy}</span>
          </article>
        ))}
      </section>

      <section className="mk3-detail-card mk3-fans-home-action-band mk3-zone">
        <div>
          <div className="mk3-persona-kicker">what beaurocks is for</div>
          <h2>Start with karaoke basics. Add more when your night is ready for it.</h2>
        </div>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_open_discover");
              navigate("discover");
            }}
          >
            Browse Karaoke Nights
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_open_host_overview");
              navigate("for_hosts");
            }}
          >
            See Host Tools
          </button>
        </div>
      </section>
    </section>
  );
};

export default ForFansPage;
