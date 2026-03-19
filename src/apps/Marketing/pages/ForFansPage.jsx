import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { formatDateTime } from "./shared";
import { PersonaPageFrame, PersonaSurfaceMock } from "./PersonaMarketingBlocks";

const ROOM_SIGNAL_CARDS = [
  {
    label: "Public TV",
    title: "The shared board",
    copy: "Lyrics, queue, reactions, and game moments stay visible.",
  },
  {
    label: "Audience phones",
    title: "Fast join",
    copy: "Guests scan in, react, vote, and play from their phones.",
  },
  {
    label: "Host deck",
    title: "One deck runs it",
    copy: "The host can guide the room without juggling tools.",
  },
];

const HERO_SIGNAL_PILLS = [
  "TV-led room flow",
  "Phone join in seconds",
  "Shared games + reactions",
];

const EVENT_TYPE_CARDS = [
  {
    title: "Birthday parties",
    imageUrl: "/images/marketing/bross-ent-eventtype-birthdayparty.png",
  },
  {
    title: "Corporate teams",
    imageUrl: "/images/marketing/bross-ent-eventtype-corpteam.png",
  },
  {
    title: "Fundraisers",
    imageUrl: "/images/marketing/bross-ent-eventtype-fundraiser.png",
  },
  {
    title: "Karaoke parties",
    imageUrl: "/images/marketing/bross-ent-eventtype-karaokeparty.png",
  },
];

const FINAL_PATHS = [
  { title: "Open Discover", route: "discover" },
  { title: "Watch Auto Demo", route: "demo_auto" },
  { title: "See Host Tools", route: "for_hosts" },
];

const ForFansPage = ({ navigate, heroStats }) => {
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "fan",
      page: "for_fans",
      cta: String(cta || ""),
    });
  };
  const discoverSnapshot = heroStats?.total
    ? `${heroStats.total.toLocaleString()} live listings`
    : "Live karaoke directory";
  const discoverUpdatedLabel = heroStats?.generatedAtMs
    ? `Updated ${formatDateTime(heroStats.generatedAtMs)}`
    : "Map and list views keep the latest room mix in one place.";

  return (
    <PersonaPageFrame theme="fan">
      <article className="mk3-fans-cinematic-hero">
        <div className="mk3-fans-cinematic-copy">
          <div className="mk3-rebuild-kicker">Live Karaoke, Better Connected</div>
          <h1>Karaoke that works for the whole room.</h1>
          <p>Find live nights, run better events, and keep the TV, queue, and every guest phone moving together.</p>
          <div className="mk3-rebuild-action-row">
            <button
              type="button"
              className="mk3-rebuild-button is-primary"
              onClick={() => {
                trackPersonaCta("hero_discover");
                navigate("discover");
              }}
            >
              Explore Live Nights
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-secondary"
              onClick={() => {
                trackPersonaCta("hero_demo_auto");
                navigate("demo_auto");
              }}
            >
              Watch Auto Demo
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-ghost"
              onClick={() => {
                trackPersonaCta("hero_hosts");
                navigate("for_hosts");
              }}
            >
              See Host Tools
            </button>
          </div>
          <div className="mk3-fans-cinematic-pill-row">
            {HERO_SIGNAL_PILLS.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="mk3-fans-cinematic-object">
          <div className="mk3-fans-cinematic-stage is-simulated-ui">
            <div className="mk3-fans-cinematic-stage-head">
              <span>Simulated UI</span>
              <b>Room flow</b>
            </div>
            <div className="mk3-fans-cinematic-surface-stack">
              <div className="mk3-fans-cinematic-surface-main">
                <PersonaSurfaceMock
                  type="tv"
                  label="Public TV"
                  title="The TV becomes the shared board for the whole room."
                  copy="Lyrics, queue state, and room moments stay visible instead of getting lost between songs."
                  className="mk3-fans-cinematic-surface-mock is-tv"
                />
              </div>
              <div className="mk3-fans-cinematic-surface-rail">
                <PersonaSurfaceMock
                  type="host"
                  label="Host deck"
                  title="One host can launch the room."
                  copy="Queue, TV, and audience moments stay in one operator surface."
                  className="mk3-fans-cinematic-surface-mock is-host"
                />
                <PersonaSurfaceMock
                  type="audience"
                  label="Audience app"
                  title="Guests join and participate fast."
                  copy="Phone join, reactions, and requests stay simple on arrival."
                  className="mk3-fans-cinematic-surface-mock is-audience"
                />
              </div>
            </div>
          </div>
        </div>
      </article>

      <section className="mk3-persona-simple-band mk3-fans-discover-band">
        <div className="mk3-fans-discover-head">
          <div>
            <div className="mk3-rebuild-kicker">Discover</div>
            <h2>Find karaoke nights on the map first, then switch to the list when you want details.</h2>
            <p>The homepage now points into the finder, and the finder itself stays focused on the map, filters, and results.</p>
          </div>
          <div className="mk3-fans-discover-updated">{discoverUpdatedLabel}</div>
        </div>
        <div className="mk3-fans-discover-grid">
          <article className="mk3-fans-discover-card">
            <span>Live directory</span>
            <strong>{discoverSnapshot}</strong>
            <p>Rooms, events, and venue listings stay on one board instead of being split across pages.</p>
          </article>
          <article className="mk3-fans-discover-card">
            <span>Map first</span>
            <strong>See the room mix fast</strong>
            <p>On mobile, the map is now the primary surface. Switch to list view only when you want to scan cards.</p>
          </article>
          <article className="mk3-fans-discover-card">
            <span>Fast path</span>
            <strong>Join by code or browse nearby</strong>
            <p>Use the map when you are exploring and room codes when you already know where you are headed.</p>
          </article>
        </div>
        <div className="mk3-rebuild-action-row mk3-fans-discover-actions">
          <button
            type="button"
            className="mk3-rebuild-button is-primary"
            onClick={() => {
              trackPersonaCta("discover_section_open_discover");
              navigate("discover");
            }}
          >
            Open Discover
          </button>
          <button
            type="button"
            className="mk3-rebuild-button is-secondary"
            onClick={() => {
              trackPersonaCta("discover_section_join");
              navigate("join");
            }}
          >
            Join With Code
          </button>
        </div>
      </section>

      <section className="mk3-persona-simple-band">
        <div className="mk3-rebuild-kicker">How it works</div>
        <div className="mk3-persona-simple-card-grid is-three">
          {ROOM_SIGNAL_CARDS.map((item) => (
            <article key={item.title} className="mk3-persona-simple-card">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-persona-simple-band">
        <div className="mk3-rebuild-kicker">Best fit</div>
        <div className="mk3-persona-simple-poster-grid">
          {EVENT_TYPE_CARDS.map((item) => (
            <article key={item.title} className="mk3-persona-simple-poster">
              <img src={item.imageUrl} alt={item.title} loading="lazy" />
              <strong>{item.title}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-persona-simple-band mk3-persona-simple-band-tight">
        <div className="mk3-rebuild-kicker">Next step</div>
        <div className="mk3-persona-simple-cta-row">
          {FINAL_PATHS.map((item, index) => (
            <button
              key={item.route}
              type="button"
              className={`mk3-rebuild-button ${index === 0 ? "is-primary" : "is-secondary"}`}
              onClick={() => {
                trackPersonaCta(`closing_${item.route}`);
                navigate(item.route);
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      </section>
    </PersonaPageFrame>
  );
};

export default ForFansPage;
