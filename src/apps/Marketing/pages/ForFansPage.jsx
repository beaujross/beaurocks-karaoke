import React, { useEffect, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { formatDateTime } from "./shared";
import { PersonaPageFrame } from "./PersonaMarketingBlocks";

const ROOM_SIGNAL_CARDS = [
  {
    label: "Public TV",
    title: "One focal point",
    copy: "The room sees the same lyrics, queue, prompts, and next move on one shared screen.",
  },
  {
    label: "Audience phones",
    title: "Join in seconds",
    copy: "Guests scan in, react, request songs, and stay involved without learning a system.",
  },
  {
    label: "Host deck",
    title: "Run it or autopilot it",
    copy: "The host can guide the room manually or kick on autopilot and let the night keep moving.",
  },
];

const HERO_SIGNAL_PILLS = [
  "TV-led karaoke",
  "Phones join fast",
  "Host or autopilot",
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
  { title: "Watch Demo", route: "demo_auto" },
];

const FAN_SYSTEM_STEPS = [
  {
    id: "tv",
    kicker: "TV first",
    title: "Start with one screen the whole room can follow.",
    body: "The homepage should lead with the TV, because that is the shared focal point that makes the room feel organized instead of fragmented.",
    tvMode: "Karaoke live",
    tvHeadline: "KARAOKE FOR THE WHOLE ROOM",
    tvDetail: "Lyrics, queue, and room prompts stay giant on the wall.",
    tvPill: "Shared room view",
    tvFeatures: ["Karaoke", "Lyric wall", "Crowd cues"],
    audienceTitle: "Phones join next",
    audienceCopy: "Guests scan in fast when the room is ready.",
    hostTitle: "Host deck waits below",
    hostCopy: "Controls stay out of the way until the room needs them.",
    hostPills: ["Queue", "Audio", "Prompts"],
  },
  {
    id: "audience",
    kicker: "Audience joins",
    title: "Phones pop in without stealing the room from the TV.",
    body: "Once the TV has the room, audience screens can join the sequence. They should feel like supporting surfaces that zoom into the moment, not a second homepage fighting for attention.",
    tvMode: "Audience connected",
    tvHeadline: "GUESTS JOIN ON THEIR PHONES",
    tvDetail: "Room code, reactions, and requests land back on the big screen fast.",
    tvPill: "Room code live",
    tvFeatures: ["Join by code", "React", "Request songs"],
    audienceTitle: "Join + react",
    audienceCopy: "Scan in, send reactions, request a song, and stay in the loop.",
    hostTitle: "Host sees the room filling",
    hostCopy: "The room stays coordinated because the TV remains the anchor.",
    hostPills: ["Queue live", "Room code", "Crowd energy"],
  },
  {
    id: "host",
    kicker: "Host control",
    title: "The host panel rises only when it has something useful to say.",
    body: "After the audience joins, the host deck can surface from below and prove that one operator can steer karaoke, pacing, prompts, and lyric flow without a messy control stack.",
    tvMode: "Host in command",
    tvHeadline: "ONE HOST CAN RUN THE WHOLE NIGHT",
    tvDetail: "Queue handoff, lyrics, and crowd pacing stay coordinated from one deck.",
    tvPill: "Host steering live",
    tvFeatures: ["Queue control", "Lyric timing", "Room prompts"],
    audienceTitle: "Guests stay active",
    audienceCopy: "Phones keep feeding requests and reactions back into the room.",
    hostTitle: "Host deck up",
    hostCopy: "Search, queue, prompts, and room controls stay in one place.",
    hostPills: ["Search", "Queue", "Prompts", "Autopilot"],
  },
  {
    id: "autopilot",
    kicker: "Autopilot",
    title: "Run it hands-on, or tap autopilot and step away for a minute.",
    body: "End the sequence by showing the host can stay in control or hand the night to autopilot. That is where we punctuate lyric generation and playback flexibility without cluttering the hero.",
    tvMode: "Autopilot ready",
    tvHeadline: "AUTOPILOT KEEPS THE NIGHT MOVING",
    tvDetail: "Lyrics, handoffs, and playback stay smooth while the host works the room.",
    tvPill: "Autopilot active",
    tvFeatures: ["Lyric generation", "YouTube", "Apple Music", "Spotify"],
    audienceTitle: "The room keeps singing",
    audienceCopy: "Guests keep joining and reacting while the flow stays automatic.",
    hostTitle: "Tap autopilot",
    hostCopy: "Choose hands-on control, or let the deck manage the pacing for a stretch.",
    hostPills: ["Autopilot on", "YouTube", "Apple Music", "Spotify"],
  },
];

const clamp01 = (value = 0) => Math.max(0, Math.min(1, Number(value || 0)));
const getSegmentProgress = (value = 0, start = 0, end = 1) => {
  const span = Math.max(0.0001, end - start);
  return clamp01((value - start) / span);
};

const resolveScrollRoot = (node) => {
  if (!node || typeof document === "undefined") return null;
  return node.closest(".mk3-site") || document.scrollingElement || document.documentElement || null;
};

const FansHeroTvStage = () => (
  <div className="mk3-fans-hero-tv-card">
    <div className="mk3-fans-hero-tv-head">
      <span>Public TV</span>
      <b>Core room view</b>
    </div>
    <div className="mk3-fans-hero-tv-screen">
      <div className="mk3-fans-hero-tv-topline">
        <span>BeauRocks Karaoke</span>
        <i>TV-led room flow</i>
      </div>
      <strong>THE WHOLE ROOM STAYS IN THE SONG.</strong>
      <p>
        One big screen keeps karaoke, lyrics, queue, and crowd moments visible
        while phones and host controls stay connected around it.
      </p>
      <div className="mk3-fans-hero-tv-pill-row">
        <span>Karaoke</span>
        <span>Lyrics</span>
        <span>Shared queue</span>
      </div>
    </div>
  </div>
);

const FansCinematicSystemStage = ({
  activeStep = FAN_SYSTEM_STEPS[0],
  audienceReveal = 0,
  hostReveal = 0,
  autopilotReveal = 0,
  useStatic = false,
}) => {
  const audienceOpacity = useStatic ? 1 : audienceReveal;
  const audienceScale = useStatic ? 1 : 0.76 + audienceReveal * 0.24;
  const audienceOffset = useStatic ? "0px" : `${56 - audienceReveal * 56}px`;
  const hostOpacity = useStatic ? 1 : hostReveal;
  const hostLift = useStatic ? "0px" : `${60 - hostReveal * 60}px`;
  const autopilotGlow = 0.18 + autopilotReveal * 0.82;
  const hostModeLabel = autopilotReveal > 0.52 ? "Autopilot on" : "Host ready";

  return (
    <div
      className={`mk3-fans-system-stage${useStatic ? " is-static" : ""}`}
      style={{
        "--mk3-fans-audience-opacity": audienceOpacity,
        "--mk3-fans-audience-scale": audienceScale,
        "--mk3-fans-audience-offset": audienceOffset,
        "--mk3-fans-audience-path-opacity": useStatic ? 1 : audienceReveal,
        "--mk3-fans-host-opacity": hostOpacity,
        "--mk3-fans-host-lift": hostLift,
        "--mk3-fans-host-path-opacity": useStatic ? 1 : hostReveal,
        "--mk3-fans-autopilot-glow": autopilotGlow,
      }}
    >
      <div className="mk3-fans-cinematic-paths" aria-hidden="true">
        <em className="is-left-top" />
        <em className="is-left-bottom" />
        <em className="is-right-top" />
        <em className="is-right-bottom" />
        <em className="is-host-tv" />
      </div>

      <article className="mk3-fans-system-tv">
        <div className="mk3-fans-system-tv-head">
          <span>Public TV</span>
          <b>{activeStep.tvMode}</b>
        </div>
        <div className="mk3-fans-system-tv-screen">
          <strong>{activeStep.tvHeadline}</strong>
          <p>{activeStep.tvDetail}</p>
          <div className="mk3-fans-system-tv-pill">{activeStep.tvPill}</div>
          <div className="mk3-fans-system-tv-feature-row">
            {activeStep.tvFeatures.map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>
        </div>
      </article>

      <aside className="mk3-fans-system-audience is-left">
        <div className="mk3-fans-system-phone">
          <div className="mk3-fans-system-phone-notch" />
          <div className="mk3-fans-system-phone-screen">
            <span>Audience app</span>
            <strong>{activeStep.audienceTitle}</strong>
            <div className="mk3-fans-system-code">DJBEAU</div>
            <p>{activeStep.audienceCopy}</p>
            <button type="button">Join + react</button>
          </div>
        </div>
      </aside>

      <aside className="mk3-fans-system-audience is-right">
        <div className="mk3-fans-system-phone is-secondary">
          <div className="mk3-fans-system-phone-notch" />
          <div className="mk3-fans-system-phone-screen">
            <span>Audience app</span>
            <strong>Requests stay live</strong>
            <div className="mk3-fans-system-mini-pill-row">
              <span>Name</span>
              <span>Emoji</span>
              <span>Request</span>
            </div>
            <p>Guests join the room without pulling focus away from the TV.</p>
          </div>
        </div>
      </aside>

      <article className="mk3-fans-system-host">
        <div className="mk3-fans-system-host-head">
          <span>Host deck</span>
          <b>{hostModeLabel}</b>
        </div>
        <strong>{activeStep.hostTitle}</strong>
        <p>{activeStep.hostCopy}</p>
        <div className="mk3-fans-system-host-pill-row">
          {activeStep.hostPills.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="mk3-fans-system-host-actions">
          <button type="button" className={autopilotReveal > 0.52 ? "is-active" : ""}>Autopilot</button>
          <button type="button">Manual</button>
        </div>
      </article>
    </div>
  );
};

const ForFansPage = ({ navigate, heroStats }) => {
  const systemTrackRef = useRef(null);
  const [systemScrollProgress, setSystemScrollProgress] = useState(0);
  const [useStaticMotion, setUseStaticMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const queries = [
      window.matchMedia("(max-width: 900px)"),
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(prefers-reduced-motion: reduce)"),
    ];
    const updateStaticMotion = () => {
      setUseStaticMotion(queries.some((query) => query.matches));
    };
    updateStaticMotion();
    queries.forEach((query) => {
      if (typeof query.addEventListener === "function") query.addEventListener("change", updateStaticMotion);
      else if (typeof query.addListener === "function") query.addListener(updateStaticMotion);
    });
    return () => {
      queries.forEach((query) => {
        if (typeof query.removeEventListener === "function") query.removeEventListener("change", updateStaticMotion);
        else if (typeof query.removeListener === "function") query.removeListener(updateStaticMotion);
      });
    };
  }, []);

  useEffect(() => {
    if (useStaticMotion) {
      setSystemScrollProgress(0);
      return undefined;
    }
    const node = systemTrackRef.current;
    const scrollRoot = resolveScrollRoot(node);

    const measureProgress = () => {
      const trackNode = systemTrackRef.current;
      if (!trackNode || typeof window === "undefined") return;
      const viewportHeight = window.innerHeight || 0;
      const containerTop = scrollRoot && scrollRoot !== document.documentElement && scrollRoot !== document.body
        ? scrollRoot.getBoundingClientRect().top
        : 0;
      const rect = trackNode.getBoundingClientRect();
      const relativeTop = rect.top - containerTop;
      const travel = Math.max(trackNode.offsetHeight - viewportHeight, 1);
      const distance = Math.max(0, -relativeTop);
      setSystemScrollProgress(clamp01(distance / travel));
    };

    measureProgress();
    if (scrollRoot && scrollRoot.addEventListener) {
      scrollRoot.addEventListener("scroll", measureProgress, { passive: true });
    } else {
      window.addEventListener("scroll", measureProgress, { passive: true });
    }
    window.addEventListener("resize", measureProgress);
    return () => {
      if (scrollRoot && scrollRoot.removeEventListener) {
        scrollRoot.removeEventListener("scroll", measureProgress);
      } else {
        window.removeEventListener("scroll", measureProgress);
      }
      window.removeEventListener("resize", measureProgress);
    };
  }, [useStaticMotion]);

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

  const flowStepCount = Math.max(1, FAN_SYSTEM_STEPS.length);
  const activeFlowIndex = useStaticMotion
    ? FAN_SYSTEM_STEPS.length - 1
    : Math.min(flowStepCount - 1, Math.floor(clamp01(systemScrollProgress) * flowStepCount));
  const activeFlowStep = FAN_SYSTEM_STEPS[activeFlowIndex] || FAN_SYSTEM_STEPS[0];
  const flowStepStart = activeFlowIndex / flowStepCount;
  const flowStepEnd = (activeFlowIndex + 1) / flowStepCount;
  const activeFlowProgress = useStaticMotion
    ? 1
    : getSegmentProgress(systemScrollProgress, flowStepStart, flowStepEnd);
  const audienceReveal = useStaticMotion
    ? 1
    : activeFlowIndex === 0
      ? 0
      : activeFlowIndex === 1
        ? activeFlowProgress
        : 1;
  const hostReveal = useStaticMotion
    ? 1
    : activeFlowIndex <= 1
      ? 0
      : activeFlowIndex === 2
        ? activeFlowProgress
        : 1;
  const autopilotReveal = useStaticMotion
    ? 1
    : activeFlowIndex < 3
      ? 0
      : activeFlowProgress;

  return (
    <PersonaPageFrame theme="fan">
      <section className="mk3-fans-hero-simplified">
        <div className="mk3-fans-hero-simplified-copy">
          <div className="mk3-rebuild-kicker">Live Karaoke, Better Connected</div>
          <h1>The TV leads. The whole room follows.</h1>
          <p>
            BeauRocks keeps karaoke, lyrics, queue, and guest phones moving
            together so the room feels like one experience instead of three disconnected tools.
          </p>
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
              Watch Demo
            </button>
          </div>
          <div className="mk3-fans-cinematic-pill-row" aria-label="Core features">
            {HERO_SIGNAL_PILLS.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="mk3-fans-hero-simplified-visual">
          <FansHeroTvStage />
        </div>
      </section>

      <article
        ref={systemTrackRef}
        className={`mk3-fans-system-story${useStaticMotion ? " is-static" : ""}`}
      >
        <div className="mk3-fans-system-story-head">
          <div className="mk3-rebuild-kicker">Room flow sequence</div>
          <h2>Scroll through how the room builds around the TV.</h2>
          <p>
            Start with the shared screen. Then let audience phones zoom into the moment.
            Then bring up the host deck and prove the host can either run the room or tap autopilot.
          </p>
        </div>

        <div className="mk3-fans-system-story-grid">
          <div className={`mk3-fans-system-stage-sticky${useStaticMotion ? " is-static" : ""}`}>
            <FansCinematicSystemStage
              activeStep={activeFlowStep}
              audienceReveal={audienceReveal}
              hostReveal={hostReveal}
              autopilotReveal={autopilotReveal}
              useStatic={useStaticMotion}
            />
          </div>

          <div className="mk3-fans-cinematic-story-rail">
            {FAN_SYSTEM_STEPS.map((step, index) => (
              <section
                key={step.id}
                className={`mk3-fans-cinematic-story-step${index === activeFlowIndex ? " is-active" : ""}`}
              >
                <span>{step.kicker}</span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </section>
            ))}
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
        </div>
        <button
          type="button"
          className="mk3-fans-inline-link"
          onClick={() => {
            trackPersonaCta("discover_section_join");
            navigate("join");
          }}
        >
          Already have a room code? Join here.
        </button>
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
