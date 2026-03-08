import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import {
  MARKETING_BRAND_BADGE_URL,
  MARKETING_DJ_BEAUROCKS_AVATAR_URL,
} from "./shared";

const FAN_BADGES = [
  "Fast rotation",
  "Good host energy",
  "Live join",
];

const VISUAL_CARDS = [
  {
    title: "See the room before you go",
    copy: "Map picks, host faces, and real event art beat mystery flyers every time.",
    imageUrl: "/images/marketing/bross-discovery.png",
  },
  {
    title: "Look for the BeauRocks badge",
    copy: "It means the night is tied to a live host setup, not just a stale listing.",
    imageUrl: "/images/marketing/beaurocks-karaoke-logo 2.png",
  },
  {
    title: "Follow the hosts worth repeating",
    copy: "Featured events and venue pages now point back to the host behind the night.",
    imageUrl: "/images/marketing/bross-host-beaurocks.png",
  },
];

const QUICK_PROOF = [
  {
    title: "Good nights feel obvious",
    copy: "You should know the room vibe before the first drink and parking headache.",
  },
  {
    title: "Hosts matter more than flyers",
    copy: "The best karaoke nights feel like somebody is actually running the party.",
  },
  {
    title: "Modern rooms show receipts",
    copy: "Live join, TV energy, and recap-ready nights should look alive before you walk in.",
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
          <div className="mk3-persona-kicker">karaoke night finder</div>
          <div className="mk3-fans-home-brand-pill">
            <img src={MARKETING_BRAND_BADGE_URL} alt="BeauRocks badge" />
            <span>BeauRocks-powered nights show the fun part first.</span>
          </div>
          <h1>Find a karaoke night that already looks fun.</h1>
          <p>
            Skip the mystery post. BeauRocks helps you spot the hosts, crowds, and rooms that
            actually feel alive before you leave the house.
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
              <strong>Featured hosts</strong>
              <span>Look for the badge and the face behind the room</span>
            </div>
            <div className="mk3-fans-home-stat-card">
              <strong>Less roulette</strong>
              <span>More signal, less guessing</span>
            </div>
          </div>
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
              <span>Bainbridge Island | crowd-ready, host-led, and easy to spot</span>
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
          <div className="mk3-persona-kicker">start here</div>
          <h2>Start with the map. Follow the host. Skip the dud night.</h2>
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
      </section>
    </section>
  );
};

export default ForFansPage;
