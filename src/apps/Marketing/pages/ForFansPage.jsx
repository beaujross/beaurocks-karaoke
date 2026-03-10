import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import {
  MARKETING_BRAND_BADGE_URL,
  MARKETING_DJ_BEAUROCKS_AVATAR_URL,
} from "./shared";

const FAN_BADGES = [
  "Low-friction audience play",
  "Playback your way",
  "Host control when you want it",
];

const VISUAL_CARDS = [
  {
    title: "Playback that fits the room",
    copy: "Run the night with YouTube, Apple Music, Spotify support soon, local media, and web-hosted video files without forcing one rigid setup.",
    imageUrl: "/images/marketing/tv-surface-live.png",
  },
  {
    title: "Guests join the fun fast",
    copy: "The crowd can react, vote, and jump into the energy without creating an account first.",
    imageUrl: "/images/marketing/BeauRocks-Audienceapp.png",
  },
  {
    title: "Host panel goes deep when needed",
    copy: "When you want to fine-tune the vibe, BeauRocks gives you a serious host control surface for the room, TV, queue, overlays, and live flow.",
    imageUrl: "/images/marketing/BeauRocks-HostPanel.png",
  },
];

const QUICK_PROOF = [
  {
    title: "Built for the night at your place",
    copy: "The real outcome is simple: people come over, the room comes alive fast, and the night feels hosted instead of improvised.",
  },
  {
    title: "Audience energy stays in the loop",
    copy: "Crowd reactions, game moments, lyrics, TV visuals, and host cues are designed to make the room part of the action.",
  },
  {
    title: "Start simple, scale into full control",
    copy: "You can keep it lightweight for casual house parties or open the full host panel when you want to run a sharper, more customized night.",
  },
];

const HERO_SIGNAL_CARDS = [
  {
    title: "Guests do not need accounts",
    copy: "Joining the fun should feel instant, not like onboarding into a new social network.",
    imageUrl: "/images/marketing/BeauRocks-Audienceapp.png",
    imageAlt: "BeauRocks audience app",
  },
  {
    title: "Hosts still get a real command center",
    copy: "When the room needs more direction, the host panel is ready with the knobs, switches, and controls to shape the vibe.",
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
            <span>Easy to host. Easy to join. Built to make the whole room part of the night.</span>
          </div>
          <h1>Host the kind of karaoke night people want to stay late for.</h1>
          <p>
            BeauRocks Karaoke is built for the house-party outcome: people come over, music starts
            fast, the crowd gets involved without friction, and the room feels like a real event
            instead of a hacked-together playlist handoff.
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
                <span>live listings already powered through the directory</span>
              </div>
            )}
            <div className="mk3-fans-home-stat-card">
              <strong>Playback flexibility</strong>
              <span>YouTube, Apple Music, local files, web video, Spotify soon</span>
            </div>
            <div className="mk3-fans-home-stat-card">
              <strong>Audience-first flow</strong>
              <span>Guests can react and play along without account friction</span>
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
              <span>Hosted, crowd-forward, and designed to feel bigger than a shared playlist</span>
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
          <h2>Start with a fun night at home. Add the deeper controls only when you want them.</h2>
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
