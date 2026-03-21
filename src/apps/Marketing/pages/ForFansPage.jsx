import React, { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { formatDateTime } from "./shared";
import { PersonaPageFrame } from "./PersonaMarketingBlocks";

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

const HOST_SEARCH_PILLS = ["Journey", "ABBA", "Whitney"];

const HOST_QUEUE_ITEMS = [
  { phase: "Now", title: "Dont Stop Believin'" },
  { phase: "Next", title: "Valerie" },
  { phase: "Later", title: "Man! I Feel Like A Woman" },
];

const AUDIENCE_ACTIONS = ["Name", "Emoji", "Request"];
const HERO_LYRIC_LINE = "\"DON'T STOP BELIEVIN'\"";

const HOMEPAGE_STORY_BEATS = [
  {
    id: "lyrics",
    kicker: "Scroll-led lyrics",
    title: "The lyric wall keeps moving with the room.",
    body: "Start the scroll by dragging the song across the TV, like the room is still mid-chorus instead of resetting between sections.",
    tvMode: "Lyrics drifting live",
    tvDetail: "Scroll pushes the chorus across the wall",
    tvPill: "Verse flow active",
    captionTitle: "The TV keeps the room in the song.",
    captionBody: "Lyrics stay huge, visible, and alive while the room keeps moving.",
    bridgeLabel: "Stage-led momentum",
    bridgeValue: "Lyrics + queue + join live together",
    hostLabel: "Queue pacing",
    hostValue: "Song handoff stays visible",
    phoneLabel: "Fast join",
    phoneValue: "Guests scan in without breaking the moment",
  },
  {
    id: "queue",
    kicker: "Queue clarity",
    title: "Everyone can see what is now, next, and coming later.",
    body: "Once the lyric motion lands, the board turns into a shared room map so nobody loses the thread between performers.",
    tvMode: "Queue visible",
    tvDetail: "Now, next, and up next stay public",
    tvPill: "Up next: Sarah J.",
    captionTitle: "The TV becomes the shared board for the whole room.",
    captionBody: "Lyrics, queue state, and room moments stay visible instead of getting lost between songs.",
    bridgeLabel: "One connected room",
    bridgeValue: "TV + host deck + audience app",
    hostLabel: "Queue live",
    hostValue: "Host sees now / next / later in one pass",
    phoneLabel: "Join this room",
    phoneValue: "Room code stays simple and obvious",
  },
  {
    id: "reactions",
    kicker: "Crowd response",
    title: "Guest phones feed energy back into the room.",
    body: "The homepage story should prove that phones are not a side tool. They change what the wall feels like in real time.",
    tvMode: "Crowd reactions live",
    tvDetail: "Phone taps bounce back onto the wall",
    tvPill: "Room pulse rising",
    captionTitle: "Phone taps create room-sized feedback.",
    captionBody: "Reactions, votes, and prompts land back on the big screen fast enough to feel live.",
    bridgeLabel: "Audience in the loop",
    bridgeValue: "Reactions + prompts + crowd play",
    hostLabel: "Room controls",
    hostValue: "Host can steer energy without stopping the song",
    phoneLabel: "Tap to react",
    phoneValue: "Guests stay active without learning a system",
  },
  {
    id: "handoff",
    kicker: "Clean handoff",
    title: "The room resets into the next singer without losing momentum.",
    body: "End the homepage story by showing that the system carries people through the handoff instead of making the room start over.",
    tvMode: "Next singer ready",
    tvDetail: "The next moment is already staged",
    tvPill: "Autodj bridge live",
    captionTitle: "The next moment is already staged.",
    captionBody: "Up next, room code, and host controls stay ready before the current song fully clears.",
    bridgeLabel: "Continuous room flow",
    bridgeValue: "Now singing -> next singer -> next room beat",
    hostLabel: "Next up",
    hostValue: "Queue keeps the room warm",
    phoneLabel: "Stay connected",
    phoneValue: "Guests can rejoin the next moment instantly",
  },
];

const FansRoomFlowBoard = ({ activeBeat = HOMEPAGE_STORY_BEATS[0], lyricProgress = 0, boardProgress = 0 }) => {
  const lyricTrackPan = `${20 - lyricProgress * 68}%`;
  const lyricOpacity = 0.74 + lyricProgress * 0.26;
  const lyricScale = 1 + lyricProgress * 0.08;
  const lyricSweep = `${Math.max(6, Math.min(94, 8 + lyricProgress * 84))}%`;
  const lyricFill = `${Math.max(4, Math.min(100, 4 + lyricProgress * 96))}%`;
  const topLineShift = `${-8 + lyricProgress * 14}px`;
  const detailShift = `${10 + lyricProgress * -18}px`;
  const pillShift = `${16 + lyricProgress * -28}px`;
  const boardScale = 0.9 + boardProgress * 0.16;
  const boardLift = 28 - boardProgress * 40;
  const boardDepth = -88 + boardProgress * 132;
  const boardTilt = 7 - boardProgress * 8;
  const boardGlow = 0.42 + boardProgress * 0.5;

  return (
  <div
    className="mk3-fans-roomflow-board"
    style={{
      "--mk3-roomflow-board-scale": boardScale,
      "--mk3-roomflow-board-lift": `${boardLift}px`,
      "--mk3-roomflow-board-depth": `${boardDepth}px`,
      "--mk3-roomflow-board-tilt": `${boardTilt}deg`,
      "--mk3-roomflow-board-glow": boardGlow,
    }}
  >
    <div className="mk3-fans-roomflow-board-head">
      <span>Simulated UI</span>
      <b>Room flow</b>
    </div>

    <div className="mk3-fans-roomflow-shell">
      <section className="mk3-fans-roomflow-tv-panel">
        <div className="mk3-fans-roomflow-surface-head">
          <span>Public TV</span>
          <b>Stage live</b>
        </div>
        <div className="mk3-fans-roomflow-tv-screen">
          <div className="mk3-fans-roomflow-tv-topline" style={{ "--mk3-tv-topline-shift": topLineShift }}>
            <span>beaurocks.app</span>
            <i>{activeBeat.tvMode}</i>
          </div>
          <strong
            className="mk3-fans-roomflow-tv-lyric"
            style={{
              "--mk3-lyric-pan": lyricTrackPan,
              "--mk3-lyric-opacity": lyricOpacity,
              "--mk3-lyric-scale": lyricScale,
              "--mk3-lyric-sweep": lyricSweep,
              "--mk3-lyric-fill": lyricFill,
            }}
          >
            <span className="mk3-fans-roomflow-tv-lyric-viewport">
              <span className="mk3-fans-roomflow-tv-lyric-track">
                <span className="mk3-fans-roomflow-tv-lyric-base">{HERO_LYRIC_LINE}</span>
                <span className="mk3-fans-roomflow-tv-lyric-fill" aria-hidden="true">{HERO_LYRIC_LINE}</span>
              </span>
              <i aria-hidden="true" />
            </span>
            <span className="mk3-fans-roomflow-tv-lyric-meter" aria-hidden="true">
              <b />
            </span>
          </strong>
          <p className="mk3-fans-roomflow-tv-detail" style={{ "--mk3-tv-detail-shift": detailShift }}>
            <span>{activeBeat.tvDetail}</span>
          </p>
          <div className="mk3-fans-roomflow-tv-pill" style={{ "--mk3-tv-pill-shift": pillShift }}>{activeBeat.tvPill}</div>
        </div>
        <div className="mk3-fans-roomflow-caption">
          <strong>{activeBeat.captionTitle}</strong>
          <p>{activeBeat.captionBody}</p>
        </div>
      </section>

      <div className="mk3-fans-roomflow-mobile-bridge">
        <span>{activeBeat.bridgeLabel}</span>
        <b>{activeBeat.bridgeValue}</b>
      </div>

      <div className="mk3-fans-roomflow-lower">
        <section className="mk3-fans-roomflow-host-panel">
          <div className="mk3-fans-roomflow-surface-head">
            <span>Host deck</span>
            <b>{activeBeat.hostLabel}</b>
          </div>
          <div className="mk3-fans-roomflow-host-grid">
            <article>
              <strong>Search</strong>
              <div className="mk3-fans-roomflow-pill-row">
                {HOST_SEARCH_PILLS.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
            <article>
              <strong>{activeBeat.hostValue}</strong>
              <ul>
                {HOST_QUEUE_ITEMS.map((item) => (
                  <li key={item.phase}>
                    <span>{item.phase}</span>
                    <b>{item.title}</b>
                  </li>
                ))}
              </ul>
            </article>
            <article>
              <strong>Room controls</strong>
              <div className="mk3-fans-roomflow-meter">
                <span>TV</span>
                <i />
              </div>
              <div className="mk3-fans-roomflow-meter">
                <span>Audio</span>
                <i />
              </div>
              <div className="mk3-fans-roomflow-meter">
                <span>Join</span>
                <i />
              </div>
            </article>
          </div>
        </section>

        <section className="mk3-fans-roomflow-audience-panel">
          <div className="mk3-fans-roomflow-phone">
            <div className="mk3-fans-roomflow-phone-notch" />
            <div className="mk3-fans-roomflow-phone-screen">
              <span>Audience app</span>
              <strong>{activeBeat.phoneLabel}</strong>
              <div className="mk3-fans-roomflow-code">DJBEAU</div>
              <div className="mk3-fans-roomflow-pill-row is-audience">
                {AUDIENCE_ACTIONS.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <button type="button">{activeBeat.phoneValue}</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
  );
};

const ForFansPage = ({ navigate, heroStats }) => {
  const storyRailRef = useRef(null);
  const stepRefs = useRef([]);
  const [activeBeatId, setActiveBeatId] = useState(HOMEPAGE_STORY_BEATS[0].id);
  const [heroScrollProgress, setHeroScrollProgress] = useState(0);

  useEffect(() => {
    const measureProgress = () => {
      const node = storyRailRef.current;
      if (!node || typeof window === "undefined") return;
      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 0;
      const travel = Math.max(node.offsetHeight - viewportHeight * 0.74, 1);
      const distance = Math.max(0, -rect.top + viewportHeight * 0.12);
      const next = Math.max(0, Math.min(1, distance / travel));
      setHeroScrollProgress(next);
    };

    measureProgress();
    window.addEventListener("scroll", measureProgress, { passive: true });
    window.addEventListener("resize", measureProgress);
    return () => {
      window.removeEventListener("scroll", measureProgress);
      window.removeEventListener("resize", measureProgress);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const nodes = stepRefs.current.filter(Boolean);
    if (!nodes.length) return undefined;
    let frameId = 0;
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (!visible.length) return;
      const nextId = String(visible[0].target.dataset.storyBeat || "").trim();
      if (!nextId) return;
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setActiveBeatId((prev) => (prev === nextId ? prev : nextId));
      });
    }, {
      threshold: [0.35, 0.65],
      rootMargin: "-18% 0px -30% 0px",
    });
    nodes.forEach((node) => observer.observe(node));
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

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
  const activeBeat = useMemo(
    () => HOMEPAGE_STORY_BEATS.find((beat) => beat.id === activeBeatId) || HOMEPAGE_STORY_BEATS[0],
    [activeBeatId]
  );
  const lyricProgress = Math.max(0, Math.min(1, heroScrollProgress * 6.2));
  const boardProgress = Math.max(0, Math.min(1, heroScrollProgress * 2.2));

  return (
    <PersonaPageFrame theme="fan">
      <article ref={storyRailRef} className="mk3-fans-cinematic-hero">
        <div className="mk3-fans-cinematic-copy">
          <div className="mk3-fans-cinematic-copy-top">
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
            <div className="mk3-fans-cinematic-pill-row" aria-label="Core features">
              {HERO_SIGNAL_PILLS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="mk3-fans-cinematic-story-rail">
            {HOMEPAGE_STORY_BEATS.map((beat, index) => (
              <section
                key={beat.id}
                ref={(node) => {
                  stepRefs.current[index] = node;
                }}
                data-story-beat={beat.id}
                className={`mk3-fans-cinematic-story-step${activeBeat.id === beat.id ? " is-active" : ""}`}
              >
                <span>{beat.kicker}</span>
                <strong>{beat.title}</strong>
                <p>{beat.body}</p>
              </section>
            ))}
          </div>
        </div>

        <div className="mk3-fans-cinematic-object">
          <div className="mk3-fans-cinematic-object-sticky">
            <FansRoomFlowBoard
              activeBeat={activeBeat}
              lyricProgress={lyricProgress}
              boardProgress={boardProgress}
            />
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
