import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import {
  MARKETING_BRAND_BADGE_URL,
  MARKETING_DJ_BEAUROCKS_AVATAR_URL,
} from "./shared";

const FAN_BADGES = [
  "Audience joins fast",
  "Playback your way",
  "Host control on demand",
];

const VISUAL_CARDS = [
  {
    title: "Playback that fits the room",
    copy: "Run the night with YouTube, Apple Music, local media, web video, and Spotify soon.",
    imageUrl: "/images/marketing/tv-surface-live.png",
  },
  {
    title: "Guests join fast",
    copy: "The crowd can react, vote, and jump in without creating an account first.",
    imageUrl: "/images/marketing/BeauRocks-Audienceapp.png",
  },
  {
    title: "Host control when you need it",
    copy: "When the room needs steering, the host panel is there for queue, TV, overlays, and flow.",
    imageUrl: "/images/marketing/BeauRocks-HostPanel.png",
  },
];

const QUICK_PROOF = [
  {
    title: "Built for the night itself",
    copy: "People show up, the room wakes up fast, and the night feels hosted instead of improvised.",
  },
  {
    title: "The room stays in it",
    copy: "Reactions, games, lyrics, TV visuals, and host cues keep the whole room involved.",
  },
  {
    title: "Simple first, deeper when needed",
    copy: "Keep it lightweight for casual nights or open the full host panel when you want more control.",
  },
];

const HERO_SIGNAL_CARDS = [
  {
    title: "Guests do not need accounts",
    copy: "Joining should feel instant, not like signing up for another platform.",
    imageUrl: "/images/marketing/BeauRocks-Audienceapp.png",
    imageAlt: "BeauRocks audience app",
  },
  {
    title: "Hosts still get a real command center",
    copy: "When the room needs direction, the host panel is ready.",
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
            <span>Easy to host. Easy to join. Built for full-room energy.</span>
          </div>
          <h1>Host the kind of karaoke night people want to stay late for.</h1>
          <p>
            Music starts fast, guests jump in without friction, and the night feels hosted instead
            of improvised.
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
              <strong>Playback flexibility</strong>
              <span>YouTube, Apple Music, local files, web video</span>
            </div>
            <div className="mk3-fans-home-stat-card">
              <strong>Audience-first flow</strong>
              <span>Guests react and play along without account friction</span>
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
              <span>Hosted, crowd-forward, and bigger than a shared playlist</span>
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
          <h2>Start simple. Go deeper only when you want to.</h2>
        </div>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_open_host_overview");
              navigate("for_hosts");
            }}
          >
            Open Host Overview
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_open_discover");
              navigate("discover");
            }}
          >
            Open Discover
          </button>
        </div>
      </section>
    </section>
  );
};

export default ForFansPage;
