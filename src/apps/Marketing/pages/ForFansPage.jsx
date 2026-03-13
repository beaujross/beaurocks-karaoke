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

const VISUAL_CARDS = [
  {
    title: "Playback that fits the room",
    copy: "Use the music sources your night already depends on, from streaming picks to local media.",
    imageUrl: "/images/marketing/tv-surface-live.png",
  },
  {
    title: "Guests join fast",
    copy: "Guests can join, react, vote, and play along from their phones in seconds.",
    imageUrl: "/images/marketing/BeauRocks-Audienceapp.png",
  },
  {
    title: "Real host controls when you want them",
    copy: "Keep the queue moving, switch the TV view, and steer the night without losing the room.",
    imageUrl: "/images/marketing/BeauRocks-HostPanel.png",
  },
];

const QUICK_PROOF = [
  {
    title: "Feels organized from the start",
    copy: "Music starts quickly, guests know how to join, and the night feels hosted instead of improvised.",
  },
  {
    title: "More people stay involved",
    copy: "Lyrics, reactions, games, and TV moments keep the whole room engaged, not just the singer on stage.",
  },
  {
    title: "Simple when you want it, deeper when you need it",
    copy: "Run a relaxed karaoke night or open up the full host dashboard when the room needs more control.",
  },
];

const HERO_SIGNAL_CARDS = [
  {
    title: "Easy for guests to join",
    copy: "Guests can get into the room quickly instead of stopping to create another account.",
    imageUrl: "/images/marketing/BeauRocks-Audienceapp.png",
    imageAlt: "BeauRocks audience app",
  },
  {
    title: "Hosts still get a real control center",
    copy: "When the night needs direction, the host dashboard is ready with the tools to keep it moving.",
    imageUrl: MARKETING_BRAND_BADGE_URL,
    imageAlt: "BeauRocks badge",
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
          <h1>Run a karaoke night that feels smooth from the first song to the last encore.</h1>
          <p>
            BeauRocks helps you start quickly, keep guests involved, and give the room a better
            experience than passing around a paper slip and hoping for the best.
          </p>
          <div className="mk3-persona-badge-row">
            {FAN_BADGES.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
          <div className="mk3-fans-home-stat-row">
            {heroStats?.total > 0 && (
              <div className="mk3-fans-home-stat-card">
                <strong>{heroStats.total.toLocaleString()}</strong>
                <span>live listings in the directory</span>
              </div>
            )}
            <div className="mk3-fans-home-stat-card">
              <strong>Flexible playback</strong>
              <span>Streaming, local files, and web video for the kind of night you want to run</span>
            </div>
            <div className="mk3-fans-home-stat-card">
              <strong>Guest-friendly flow</strong>
              <span>People can join and interact without turning the night into a signup process</span>
            </div>
          </div>
          <div className="mk3-actions-inline">
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("primary_open_host_overview");
                navigate("for_hosts");
              }}
            >
              See Host Setup
            </button>
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("secondary_open_discover");
                navigate("discover");
              }}
            >
              Explore Live Nights
            </button>
          </div>
          <div className="mk3-fans-home-signal-row">
            {HERO_SIGNAL_CARDS.map((card) => (
              <article key={card.title} className="mk3-fans-home-signal-card">
                <img src={card.imageUrl} alt={card.imageAlt} loading="lazy" />
                <div>
                  <strong>{card.title}</strong>
                  <span>{card.copy}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mk3-fans-home-visual">
          <article className="mk3-fans-home-feature-card">
            <img
              src="/images/marketing/aahf-karaoke-kickoff-2026.png"
              alt="AAHF Karaoke Kickoff event poster"
              loading="lazy"
            />
            <div className="mk3-fans-home-feature-overlay">
              <div className="mk3-chip mk3-chip-elevated">
                <img className="mk3-chip-icon" src={MARKETING_BRAND_BADGE_URL} alt="BeauRocks badge" loading="lazy" />
                <span>Hosted with BeauRocks</span>
              </div>
              <div className="mk3-fans-home-host-pill">
                <img src={MARKETING_DJ_BEAUROCKS_AVATAR_URL} alt="DJ BeauRocks" loading="lazy" />
                <span>DJ BeauRocks</span>
              </div>
              <strong>AAHF: Karaoke Kickoff</strong>
              <span>A hosted karaoke night built to feel bigger, louder, and more connected</span>
            </div>
          </article>

          <div className="mk3-fans-home-visual-grid">
            {VISUAL_CARDS.map((card) => (
              <article key={card.title} className="mk3-fans-home-visual-card">
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
          <h2>Start with the basics. Add more when your night is ready for it.</h2>
        </div>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_open_host_overview");
              navigate("for_hosts");
            }}
          >
            See Host Tools
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_open_discover");
              navigate("discover");
            }}
          >
            Browse Karaoke Nights
          </button>
        </div>
      </section>
    </section>
  );
};

export default ForFansPage;
