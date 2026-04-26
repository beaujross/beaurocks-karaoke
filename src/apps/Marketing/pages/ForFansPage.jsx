import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { formatDateTime } from "./shared";
import { PersonaPageFrame } from "./PersonaMarketingBlocks";

const HERO_SIGNAL_PILLS = [
  "TV-led room",
  "Join by code",
  "Hosts join by waitlist",
];

const ROOM_FLOW_STEPS = [
  {
    label: "1. One screen leads",
    title: "The whole room follows the same moment.",
    copy: "Lyrics, prompts, games, and crowd cues stay big enough to read from across the bar.",
  },
  {
    label: "2. Phones join in",
    title: "Guests add energy without hijacking the room.",
    copy: "People join by code, send requests, react, and play along from their phones while the night stays coherent.",
  },
  {
    label: "3. The host keeps it moving",
    title: "Technology backs up the party instead of interrupting it.",
    copy: "Queue control, pacing, and surprise moments stay ready when the room needs a push.",
  },
];

const PERSONA_PATHS = [
  {
    label: "For hosts",
    title: "Run the room from one deck.",
    copy: "Queue, pacing, audience moments, and TV cues stay in one operating surface.",
    cta: "See host access",
    route: "for_hosts",
    ctaId: "persona_hosts",
  },
  {
    label: "For performers",
    title: "Find rooms that already feel alive.",
    copy: "Look for strong rooms, clear schedules, and nights worth returning to.",
    cta: "See performer view",
    route: "for_performers",
    ctaId: "persona_performers",
  },
  {
    label: "For venues",
    title: "Make the night easy to trust.",
    copy: "Claim the listing, post the real schedule, and help the room show up clearly online.",
    cta: "See venue view",
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
      <p>
        The TV carries the moment, phones feed the energy, and the host deck keeps the night from stalling.
      </p>
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
      <strong>The room sees the same thing</strong>
      <p>Lyrics, countdowns, and crowd prompts stay public.</p>
    </article>
    <article className="mk3-fans-room-flow-surface is-audience">
      <span>Phone</span>
      <strong>Guests join the action fast</strong>
      <p>Name, emoji, request, react.</p>
    </article>
    <article className="mk3-fans-room-flow-surface is-host">
      <span>Host</span>
      <strong>The night stays under control</strong>
      <p>Search, pacing, moments, recovery.</p>
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
  const discoverUpdatedLabel = heroStats?.generatedAtMs
    ? `Updated ${formatDateTime(heroStats.generatedAtMs)}`
    : "Live rooms refresh through the day.";
  const queueLabel = pendingHostApplicationsCount > 0
    ? `${pendingHostApplicationsCount} host applications in review`
    : "Host access opens in reviewed batches";

  const proofCards = [
    {
      label: "Party signal",
      title: "One room, one shared moment",
      copy: "The big screen keeps the room readable so crowd energy goes up instead of sideways.",
    },
    {
      label: "Guest flow",
      title: "Phones add to the night",
      copy: "Requests, reactions, and audience prompts stay lightweight enough to feel social instead of technical.",
    },
    {
      label: "Host access",
      title: "Hosts come in through a waitlist",
      copy: "New host access opens in waves so live rooms launch with a real operator behind them.",
    },
  ];

  return (
    <PersonaPageFrame theme="fan">
      <section className="mk3-fans-home-minimal">
        <section className="mk3-fans-hero-simplified">
          <div className="mk3-fans-hero-simplified-copy">
            <div className="mk3-rebuild-kicker">Live party tech for karaoke rooms</div>
            <h1>Turn karaoke night into a room-wide party game.</h1>
            <p>
              BeauRocks keeps the TV, host, and crowd working together so people sing more,
              react faster, and stay connected to the same moment.
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

        <section className="mk3-persona-simple-band mk3-fans-home-proof-band">
                <div className="mk3-persona-simple-card-grid is-three">
            {proofCards.map((item) => (
              <article key={item.label} className="mk3-persona-simple-card">
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mk3-fans-room-flow-band">
          <div className="mk3-fans-room-flow-head">
            <div className="mk3-rebuild-kicker">How the room works</div>
            <h2>Technology should connect the room, not split it up.</h2>
            <p>
              BeauRocks works best when the public screen does the heavy lifting,
              phones stay quick, and the host deck only surfaces what the night needs next.
            </p>
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
            <div className="mk3-rebuild-kicker">Go deeper</div>
            <h2>Start with the room, then choose your role.</h2>
            <p>
              Hosts, performers, and venues all plug into the same shared-night system.
              The persona pages stay available when someone wants the details.
            </p>
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
            <div className="mk3-rebuild-kicker">Waitlist</div>
            <h2>The next host release starts with the line.</h2>
            <p>
              If you want to run nights with BeauRocks, join the waitlist now.
              Everyone else can still explore what is live tonight or enter by room code.
            </p>
          </div>
          <div className="mk3-fans-home-cta-meta" aria-label="Live status">
            <span>{queueLabel}</span>
            <span>{discoverSnapshot}</span>
            <span>{discoverUpdatedLabel}</span>
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
