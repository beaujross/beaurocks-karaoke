import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import {
  MARKETING_BRAND_BADGE_URL,
  MARKETING_BRAND_NEON_URL,
} from "./shared";
import { PersonaSurfaceMock } from "./PersonaMarketingBlocks";

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
    visualType: "tv",
    visualLabel: "Public TV",
  },
  {
    step: "02",
    title: "Guests join with a name, emoji, and one clear next step",
    copy: "The audience app gets people into the room quickly instead of making them figure out an account flow first.",
    visualType: "audience",
    visualLabel: "Audience app",
  },
  {
    step: "03",
    title: "The host runs queue, TV, and room control from one deck",
    copy: "Search, queue, audio, and TV controls stay together so the room keeps moving.",
    visualType: "host",
    visualLabel: "Host deck",
  },
];

const HERO_PROOF_STRIP = [
  {
    label: "Speed",
    title: "Phones join fast",
    copy: "Guests can enter the room without passing paper or waiting for directions.",
  },
  {
    label: "Room lead",
    title: "The TV leads the night",
    copy: "Join prompts, queue state, and stage context stay visible to the whole room.",
  },
  {
    label: "Control",
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
    <section className="mk3-page mk3-fans-flagship">
      <article className="mk3-fans-flagship-hero mk3-fans-flagship-stageband">
        <div className="mk3-fans-flagship-copy">
          <div className="mk3-fans-flagship-kicker">BeauRocks Karaoke Overview</div>
          <div className="mk3-fans-flagship-brandline">
            <img src={MARKETING_BRAND_BADGE_URL} alt="BeauRocks logo" loading="lazy" />
            <span>Hosted karaoke software built for rooms that should feel smoother, louder, and easier to join.</span>
          </div>
          <h1>Modern karaoke nights that feel better on every screen in the room.</h1>
          <p>
            The TV leads the room, guests join from their phones, and the host runs the night from one deck
            instead of juggling disconnected tools.
          </p>
          <div className="mk3-fans-flagship-actions">
            <button
              type="button"
              className="mk3-rebuild-button is-primary"
              onClick={() => {
                trackPersonaCta("primary_open_discover");
                navigate("discover");
              }}
            >
              Explore Live Nights
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-secondary"
              onClick={() => {
                trackPersonaCta("secondary_open_host_overview");
                navigate("for_hosts");
              }}
            >
              See Host Tools
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-ghost"
              onClick={() => {
                trackPersonaCta("tertiary_open_demo_auto");
                navigate("demo_auto");
              }}
            >
              Watch Auto Demo
            </button>
          </div>
          <div className="mk3-fans-flagship-badges">
            {FAN_BADGES.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        </div>

        <div className="mk3-fans-flagship-stage">
          <article className="mk3-fans-flagship-tv">
            <PersonaSurfaceMock
              type="tv"
              label="Public TV"
              title="The TV becomes the public room state, not just a passive lyrics screen."
              copy="Room code, stage state, queue context, and visible activity make the room easier to follow from the start."
              className="mk3-fans-stage-mock is-hero-tv"
            />
          </article>

          <div className="mk3-fans-flagship-surface-rail">
            <article>
              <PersonaSurfaceMock
                type="audience"
                label="Audience app"
                title="Get guests in fast"
                copy="Name, emoji, and one obvious next step keep the room moving."
                className="mk3-fans-stage-mock"
              />
            </article>
            <article>
              <PersonaSurfaceMock
                type="host"
                label="Host deck"
                title="Keep the room ahead"
                copy="Search, queue, TV, and room control live in one operator surface."
                className="mk3-fans-stage-mock"
              />
            </article>
          </div>
        </div>
      </article>

      <section className="mk3-fans-proof-band mk3-fans-open-band">
        <div className="mk3-fans-proof-head">
          <div>
            <div className="mk3-fans-flagship-kicker">Why the room feels different</div>
            <h2>One clear signal for the room. One cleaner flow for everybody in it.</h2>
          </div>
          <img src={MARKETING_BRAND_NEON_URL} alt="" aria-hidden="true" />
        </div>
        <div className="mk3-fans-proof-grid">
          {HERO_PROOF_STRIP.map((item) => (
            <article key={item.title} className="mk3-fans-proof-note">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-fans-system-band mk3-fans-open-band">
        <div className="mk3-fans-system-head">
          <div className="mk3-fans-flagship-kicker">How BeauRocks works</div>
          <h2>Three surfaces. One room signal.</h2>
          <p>The product should feel like one hosted system across the room, not separate tools stitched together.</p>
        </div>
        <div className="mk3-fans-system-grid">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <article key={item.step} className="mk3-fans-system-card">
              <div className="mk3-fans-system-card-index">{item.step}</div>
              <img src={item.imageUrl} alt={item.title} loading="lazy" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-fans-credibility-band mk3-fans-open-band">
        <div className="mk3-fans-credibility-story">
          <div className="mk3-fans-flagship-kicker">Why this feels credible</div>
          <h2>Built for real rooms, public events, and private nights that need structure.</h2>
          <p>
            The payoff should feel obvious before someone learns every deeper feature:
            faster room starts, stronger between-song energy, and a system that feels more sellable than basic karaoke software.
          </p>
          <div className="mk3-fans-benefit-stack">
          {EXPERIENCE_BENEFITS.map((item) => (
              <article key={item.title} className="mk3-fans-benefit-note">
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="mk3-fans-credibility-grid">
          {TRUST_SIGNALS.map((item) => (
            <article key={item.title} className="mk3-fans-credibility-note">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-fans-fit-band mk3-fans-open-band">
        <div className="mk3-fans-fit-head">
          <div className="mk3-fans-flagship-kicker">What BeauRocks is perfect for</div>
          <h2>Use BeauRocks for nights that need clearer room flow and easier guest participation.</h2>
        </div>
        <div className="mk3-fans-fit-grid">
          {EVENT_TYPE_CARDS.map((item) => (
            <article key={item.title} className="mk3-fans-fit-card">
              <img src={item.imageUrl} alt={item.title} loading="lazy" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-fans-closing-band mk3-fans-open-band">
        <div className="mk3-fans-closing-head">
          <div className="mk3-fans-flagship-kicker">Pick your next step</div>
          <h2>Start with the path that matches why you're here.</h2>
        </div>
        <div className="mk3-fans-closing-grid">
          {FINAL_PATHS.map((item, index) => (
            <article key={item.title} className="mk3-fans-closing-note">
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
              <button
                type="button"
                className={`mk3-rebuild-button ${index === 0 ? "is-primary" : "is-secondary"}`}
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
