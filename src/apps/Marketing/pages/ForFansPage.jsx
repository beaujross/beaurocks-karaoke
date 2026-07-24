import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { PersonaPageFrame } from "./PersonaMarketingBlocks";

const HERO_SIGNAL_PILLS = [
  "Queue on TV",
  "Songs on phones",
  "Games between singers",
];

const ROOM_FLOW_STEPS = [
  {
    label: "1. TV",
    title: "Everyone sees what is next.",
    copy: "Lyrics, the queue, and games stay on the big screen.",
  },
  {
    label: "2. Phones",
    title: "Guests join from their phones.",
    copy: "Add songs, react, vote, and play.",
  },
  {
    label: "3. Host",
    title: "You run the night.",
    copy: "Control the order or let Assisted Host help.",
  },
];

const PERSONA_PATHS = [
  {
    label: "For hosts",
    title: "Host a karaoke party",
    copy: "Run the queue, TV, and guest phones.",
    cta: "For Hosts",
    route: "for_hosts",
    ctaId: "persona_hosts",
  },
  {
    label: "For singers",
    title: "Find a karaoke night",
    copy: "See tonight's venues, times, and hosts.",
    cta: "For Singers",
    route: "for_performers",
    ctaId: "persona_performers",
  },
  {
    label: "For venues",
    title: "List your karaoke night",
    copy: "Publish the venue and schedule.",
    cta: "For Venues",
    route: "for_venues",
    ctaId: "persona_venues",
  },
];

const FansHeroTvStage = () => (
  <div className="mk3-fans-hero-tv-card">
    <div className="mk3-fans-hero-tv-head">
      <span>Public TV</span>
      <b>Party live</b>
    </div>
    <div className="mk3-fans-hero-tv-screen">
      <div className="mk3-fans-hero-tv-topline">
        <span>BeauRocks Karaoke</span>
        <i>Room code active</i>
      </div>
      <strong>THE ROOM PLAYS TOGETHER.</strong>
      <p>Lyrics, the queue, and party games stay on the big screen.</p>
      <div className="mk3-fans-hero-tv-pill-row">
        <span>Queue</span>
        <span>Lyrics</span>
        <span>Games</span>
      </div>
    </div>
  </div>
);

const FansRoomFlowVisual = () => (
  <div className="mk3-fans-room-flow-visual" aria-hidden="true">
    <article className="mk3-fans-room-flow-surface is-tv">
      <span>TV</span>
      <strong>See what is next</strong>
      <p>Lyrics, queue, and games.</p>
    </article>
    <article className="mk3-fans-room-flow-surface is-audience">
      <span>Phone</span>
      <strong>Join and add a song</strong>
      <p>Name, emoji, song, reaction.</p>
    </article>
    <article className="mk3-fans-room-flow-surface is-host">
      <span>Host</span>
      <strong>Run the party</strong>
      <p>Order, pacing, and activities.</p>
    </article>
  </div>
);

const ForFansPage = ({ navigate, heroStats, pendingHostApplicationsCount = 0, onHostLogin }) => {
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
  const queueLabel = pendingHostApplicationsCount > 0
    ? `${pendingHostApplicationsCount} host applications in review`
    : "Host waitlist open";


  return (
    <PersonaPageFrame theme="fan">
      <section className="mk3-fans-home-minimal">
        <section className="mk3-fans-hero-simplified">
          <div className="mk3-fans-hero-simplified-copy">
            <div className="mk3-rebuild-kicker">Karaoke for home and private parties</div>
            <h1>Your karaoke night, all in one room.</h1>
            <p>
              Run the queue on TV, let guests add songs from their phones, and keep the party moving with games and reactions.
            </p>
            <div className="mk3-rebuild-action-row mk3-fans-home-hero-actions">
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
                  trackPersonaCta("hero_join_by_code");
                  navigate("join");
                }}
              >
                Have a room code? Join
              </button>
              <button
                type="button"
                className="mk3-rebuild-button is-link"
                onClick={() => {
                  trackPersonaCta("hero_host_login");
                  onHostLogin?.();
                }}
              >
                Host Login
              </button>
            </div>
            <div className="mk3-fans-cinematic-pill-row" aria-label="Core signals">
              {HERO_SIGNAL_PILLS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="mk3-fans-hero-simplified-visual">
            <FansHeroTvStage />
          </div>
        </section>


        <section className="mk3-fans-room-flow-band">
          <div className="mk3-fans-room-flow-head">
            <div className="mk3-rebuild-kicker">How it works</div>
            <h2>TV for the room. Phones for the guests.</h2>
          </div>
          <div className="mk3-fans-room-flow-grid">
            <FansRoomFlowVisual />
            <div className="mk3-persona-simple-card-grid">
              {ROOM_FLOW_STEPS.map((step) => (
                <article key={step.label} className="mk3-persona-simple-card is-numbered">
                  <span>{step.label}</span>
                  <strong>{step.title}</strong>
                  <p>{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mk3-fans-persona-band">
          <div className="mk3-fans-room-flow-head">
            <div className="mk3-rebuild-kicker">Start here</div>
            <h2>What are you here to do?</h2>
          </div>
          <div className="mk3-fans-persona-grid">
            {PERSONA_PATHS.map((item) => (
              <article key={item.label} className="mk3-fans-persona-card">
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
                <div className="mk3-fans-persona-card-row">
                  <button
                    type="button"
                    className="mk3-rebuild-button is-secondary"
                    onClick={() => {
                      trackPersonaCta(item.ctaId);
                      navigate(item.route);
                    }}
                  >
                    {item.cta}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mk3-fans-home-cta-band">
          <div className="mk3-fans-home-cta-copy">
            <div className="mk3-rebuild-kicker">Host access</div>
            <h2>Want to host your own night?</h2>
            <p>Join the waitlist for Host access.</p>
          </div>
          <div className="mk3-fans-home-cta-meta" aria-label="Live status">
            <span>{queueLabel}</span>
            <span>{discoverSnapshot}</span>
          </div>
          <div className="mk3-rebuild-action-row mk3-fans-home-hero-actions">
            <button
              type="button"
              className="mk3-rebuild-button is-primary"
              onClick={() => {
                trackPersonaCta("closing_waitlist");
                navigate("for_hosts");
              }}
            >
              Join Host Waitlist
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-link"
              onClick={() => {
                trackPersonaCta("closing_join_link");
                navigate("join");
              }}
            >
              Have a room code? Join
            </button>
          </div>
        </section>
      </section>
    </PersonaPageFrame>
  );
};

export default ForFansPage;
