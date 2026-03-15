import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import {
  MARKETING_BRAND_BADGE_URL,
  MARKETING_DJ_BEAUROCKS_AVATAR_URL,
} from "./shared";

const FAN_BADGES = [
  "TV-led room flow",
  "Phone join in seconds",
  "Host stays in control",
];

const TRUST_SIGNALS = [
  {
    label: "Official event",
    title: "AAHF Karaoke Kick-Off",
    copy: "A real public event where the TV, host deck, and audience phones all stay in sync.",
  },
  {
    label: "Private events",
    title: "Birthday parties",
    copy: "A better fit for mixed groups that need faster join, clearer turns, and less confusion.",
  },
  {
    label: "Team nights",
    title: "Corporate events",
    copy: "One clean host flow helps larger mixed crowds feel coordinated instead of improvised.",
  },
  {
    label: "Community rooms",
    title: "Fundraisers and school nights",
    copy: "Clear public prompts and easy guest participation work better when the room is bigger.",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "The TV gives the room one place to look",
    copy: "The start screen, join code, and stage state make the room feel hosted before the first song starts.",
    imageUrl: "/images/marketing/tv-start-aahf-current.png",
  },
  {
    step: "02",
    title: "Guests join with a name, emoji, and one clear next step",
    copy: "The audience app gets people into the room quickly instead of making them figure out an account flow first.",
    imageUrl: "/images/marketing/audience-join-aahf-current.png",
  },
  {
    step: "03",
    title: "The host runs queue, TV, and room control from one deck",
    copy: "Search, queue, audio, and TV controls stay together so the room keeps moving.",
    imageUrl: "/images/marketing/BeauRocks-HostPanel.png",
  },
];

const HERO_PROOF_STRIP = [
  {
    title: "Phones join fast",
    copy: "Guests can enter the room without passing paper or waiting for directions.",
  },
  {
    title: "The TV leads the night",
    copy: "Join prompts, queue state, and stage context stay visible to the whole room.",
  },
  {
    title: "The host keeps control",
    copy: "One deck manages search, queue, TV layout, and the room's next move.",
  },
];

const EXPERIENCE_BENEFITS = [
  {
    title: "Cleaner room starts",
    copy: "People know where to look, how to join, and what happens next.",
  },
  {
    title: "Better between-song energy",
    copy: "The room stays active through reactions, prompts, and smoother handoffs.",
  },
  {
    title: "More sellable than basic karaoke software",
    copy: "It feels like a hosted system across the room, not just lyrics on a screen.",
  },
];

const FINAL_PATHS = [
  {
    title: "See live nights",
    copy: "If you want to find real rooms and upcoming karaoke nights, start in discovery.",
    cta: "Open Discovery",
    route: "discover",
  },
  {
    title: "See the host story",
    copy: "If you are evaluating BeauRocks as an operator tool, go straight to the host overview.",
    cta: "Open Host Overview",
    route: "for_hosts",
  },
  {
    title: "Watch the product demo",
    copy: "If you want to see the synchronized product story across host, TV, and audience, open the demo.",
    cta: "Open Demo",
    route: "demo_auto",
  },
];

const EVENT_TYPE_CARDS = [
  {
    title: "Birthday parties",
    copy: "Easy guest join, faster turns, and a room that feels hosted instead of improvised.",
    imageUrl: "/images/marketing/bross-ent-eventtype-birthdayparty.png",
  },
  {
    title: "Corporate team events",
    copy: "Keep the room organized, visible, and fun for mixed groups.",
    imageUrl: "/images/marketing/bross-ent-eventtype-corpteam.png",
  },
  {
    title: "Fundraisers",
    copy: "Run a cleaner show while keeping more of the crowd involved.",
    imageUrl: "/images/marketing/bross-ent-eventtype-fundraiser.png",
  },
  {
    title: "Karaoke parties",
    copy: "The core BeauRocks flow: host, TV, and audience all stay in sync.",
    imageUrl: "/images/marketing/bross-ent-eventtype-karaokeparty.png",
  },
  {
    title: "School and community nights",
    copy: "Clear room entry and visible stage flow make larger groups easier to run.",
    imageUrl: "/images/marketing/bross-ent-eventtype-schoolcommunity.png",
  },
  {
    title: "Custom events",
    copy: "Private parties, themed rooms, and one-off nights still get the same cleaner host flow.",
    imageUrl: "/images/marketing/bross-ent-eventtype-somethingelse.png",
  },
];

const ForFansPage = ({ navigate }) => {
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
            <span>Hosted karaoke software built for rooms that should feel smoother, louder, and easier to join.</span>
          </div>
          <h1>Modern karaoke nights that feel better on every screen in the room.</h1>
          <p>The TV leads the room, guests join from their phones, and the host runs the night from one deck instead of juggling disconnected tools.</p>
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
            <button
              type="button"
              className="mk3-secondary-ghost"
              onClick={() => {
                trackPersonaCta("tertiary_open_demo_auto");
                navigate("demo_auto");
              }}
            >
              Watch Auto Demo
            </button>
          </div>
          <div className="mk3-persona-badge-row">
            {FAN_BADGES.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
          <div className="mk3-fans-home-proof-strip">
            {HERO_PROOF_STRIP.map((item) => (
              <article key={item.title} className="mk3-fans-home-proof-pill">
                <strong>{item.title}</strong>
                <span>{item.copy}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="mk3-fans-home-visual">
          <article className="mk3-fans-home-surface-feature">
            <img
              className="mk3-fans-home-surface-feature-image"
              src="/images/marketing/tv-live-aahf-current.png"
              alt="BeauRocks Public TV live room state"
              loading="lazy"
            />
            <div className="mk3-fans-home-surface-feature-overlay">
              <div className="mk3-fans-home-stage-topline">
                <div className="mk3-chip mk3-chip-elevated">
                  <img className="mk3-chip-icon" src={MARKETING_BRAND_BADGE_URL} alt="BeauRocks badge" loading="lazy" />
                  <span>Public TV</span>
                </div>
                <div className="mk3-fans-home-host-pill">
                  <img src={MARKETING_DJ_BEAUROCKS_AVATAR_URL} alt="DJ BeauRocks" loading="lazy" />
                  <span>Start the show on the room screen</span>
                </div>
              </div>
              <div className="mk3-fans-home-stage-copy">
                <strong>The TV becomes the public room state, not just a passive lyrics screen.</strong>
                <span>Room code, stage state, queue context, and visible activity make the room easier to follow from the start.</span>
              </div>
            </div>
          </article>
          <div className="mk3-fans-home-stage-stack">
            <article className="mk3-fans-home-stage-panel is-audience">
              <span>Audience App</span>
              <img src="/images/marketing/audience-join-aahf-current.png" alt="Audience app join screen" loading="lazy" />
            </article>
            <article className="mk3-fans-home-stage-panel">
              <span>Public TV</span>
              <img src="/images/marketing/tv-start-aahf-current.png" alt="Public TV room start screen" loading="lazy" />
            </article>
            <article className="mk3-fans-home-stage-panel is-host">
              <span>Host Deck</span>
              <img src="/images/marketing/BeauRocks-HostPanel.png" alt="Host dashboard" loading="lazy" />
            </article>
          </div>
        </div>
      </article>

      <section className="mk3-detail-card mk3-zone mk3-fans-home-trust-band">
        <div>
          <div className="mk3-persona-kicker">why this feels credible</div>
          <h2>Built for real rooms, public events, and private nights that need structure.</h2>
        </div>
        <div className="mk3-fans-home-trust-grid">
          {TRUST_SIGNALS.map((item) => (
            <article key={item.title} className="mk3-fans-home-trust-card">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-fans-home-how-band">
        <div>
          <div className="mk3-persona-kicker">how beaurocks works</div>
          <h2>Three screens. One cleaner karaoke flow.</h2>
        </div>
        <div className="mk3-fans-home-how-grid">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <article key={item.step} className="mk3-fans-home-how-card">
              <img src={item.imageUrl} alt={item.title} loading="lazy" />
              <div>
                <span>{item.step}</span>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-fans-home-benefit-band">
        <div>
          <div className="mk3-persona-kicker">why the room feels better</div>
          <h2>The payoff should feel obvious before someone learns every deeper feature.</h2>
        </div>
        <div className="mk3-fans-home-proof-grid">
          {EXPERIENCE_BENEFITS.map((item) => (
            <article key={item.title} className="mk3-detail-card mk3-zone">
              <strong>{item.title}</strong>
              <span>{item.copy}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-fans-home-event-band">
        <div>
          <div className="mk3-persona-kicker">what beaurocks karaoke is perfect for</div>
          <h2>Use BeauRocks for the kinds of nights that need clearer room flow and easier guest participation.</h2>
        </div>
        <div className="mk3-fans-home-event-grid">
          {EVENT_TYPE_CARDS.map((item) => (
            <article key={item.title} className="mk3-fans-home-event-card">
              <img src={item.imageUrl} alt={item.title} loading="lazy" />
              <div>
                <strong>{item.title}</strong>
                <span>{item.copy}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-fans-home-closing-band">
        <div>
          <div className="mk3-persona-kicker">pick your next step</div>
          <h2>Start with the path that matches why you're here.</h2>
        </div>
        <div className="mk3-fans-home-closing-grid">
          {FINAL_PATHS.map((item) => (
            <article key={item.title} className="mk3-fans-home-closing-card">
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
              <button
                type="button"
                onClick={() => {
                  trackPersonaCta(`closing_${item.route}`);
                  navigate(item.route);
                }}
              >
                {item.cta}
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
};

export default ForFansPage;
