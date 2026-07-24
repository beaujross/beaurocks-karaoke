import React, { useEffect, useMemo, useState } from "react";
import { subscribePublicCharts } from "../api/directoryApi";
import { trackEvent } from "../lib/marketingAnalytics";
import { buildPublicSongItemListJsonLd, mergePublicSongChart, PUBLIC_CHART_VISIBLE_LIMIT } from "./publicChartModel.js";
import "./charts.css";

const TABS = Object.freeze([
  { id: "songs", label: "Song Crowns" },
  { id: "members", label: "Singer Momentum" },
  { id: "nights", label: "Active Nights" },
]);

const CHART_STORIES = Object.freeze({
  songs: {
    eyebrow: "Best score for each song",
    title: "Who holds the Song Crown?",
    copy: "The highest eligible score leads. Every backing version counts toward the same song.",
    ctaKicker: "Host your own night",
    ctaTitle: "Bring BeauRocks to your party.",
    ctaCopy: "Run the queue, TV, guest phones, and games.",
    ctaLabel: "Apply to Host",
    ctaPage: "for_hosts",
  },
  members: {
    eyebrow: "Points across every performance",
    title: "Who is climbing the singer chart?",
    copy: "Singer Momentum adds up the points from your eligible BeauRocks performances.",
    ctaKicker: "Ready to sing?",
    ctaTitle: "Find karaoke near you.",
    ctaCopy: "Sign in before you sing to keep eligible scores on your profile.",
    ctaLabel: "Find Karaoke",
    ctaPage: "discover",
  },
  nights: {
    eyebrow: "Most points earned in one room",
    title: "Where is karaoke busiest?",
    copy: "Active Nights ranks public rooms by total performance points.",
    ctaKicker: "Run a karaoke night?",
    ctaTitle: "Put it on the map.",
    ctaCopy: "Publish the venue, schedule, and host.",
    ctaLabel: "Get on the Map",
    ctaPage: "for_venues",
  },
});

const formatScore = (value = 0) =>
  Math.max(0, Number(value || 0) || 0).toLocaleString();

const buildReportResultHref = (resultId = "") => {
  const safeResultId = String(resultId || "").trim();
  const subject = encodeURIComponent("BeauRocks chart result review");
  const body = encodeURIComponent(
    [
      "Please review this BeauRocks chart result.",
      safeResultId ? `Result ID: ${safeResultId}` : "",
      "",
      "What looks incorrect:",
    ].filter(Boolean).join("\n")
  );
  return `mailto:hello@beaurocks.app?subject=${subject}&body=${body}`;
};

const getChartItemView = (item = {}, tab = "members") => {
  if (tab === "songs") {
    return {
      title: item.songTitle || "Untitled song",
      subtitle: item.artist || "Unknown artist",
      context: item.isOpeningScore
        ? "Opening score · crown unclaimed"
        : `${item.displayName || "BeauRocks Singer"} holds the crown`,
      score: item.bestScore,
      scoreLabel: item.isOpeningScore ? "score to beat" : "top score",
    };
  }
  if (tab === "nights") {
    return {
      title: item.title || "BeauRocks Night",
      subtitle: [item.venueName, item.city, item.state].filter(Boolean).join(" · ") || "Public BeauRocks room",
      context: `${item.topSingerName || "BeauRocks Singer"} · best ${formatScore(item.bestScore)}`,
      score: item.rankScore,
      scoreLabel: "activity pts",
    };
  }
  return {
    title: item.displayName || "BeauRocks Singer",
    subtitle: `${formatScore(item.performanceCount)} performances · best ${formatScore(item.bestScore)}`,
    context: item.latestSongTitle
      ? `Latest: ${item.latestSongTitle}${item.latestArtist ? ` · ${item.latestArtist}` : ""}`
      : "BeauRocks performances",
    score: item.rankScore,
    scoreLabel: "points",
  };
};

const ChartPodium = ({ items = [], activeTab = "members", navigate }) => (
  <div className="mk3-chart-podium" aria-label={`Top ${Math.min(3, items.length)} ${activeTab}`}>
    {items.slice(0, 3).map((item, index) => {
      const rank = index + 1;
      const view = getChartItemView(item, activeTab);
      const isNight = activeTab === "nights";
      return (
        <article key={item.id || item.memberKey || item.songId || item.listingId} className={`mk3-chart-podium-card is-rank-${rank}`}>
          <div className="mk3-chart-podium-rank"><span>Rank</span><strong>{rank}</strong></div>
          <div className="mk3-chart-podium-crown" aria-hidden="true"><i /><i /><i /></div>
          {activeTab === "songs" && (
            <div className="mk3-chart-podium-art">
              {item.albumArtUrl
                ? <img src={item.albumArtUrl} alt="" loading="lazy" />
                : <span aria-hidden="true">♪</span>}
            </div>
          )}
          {isNight ? (
            <button type="button" className="mk3-chart-podium-title is-link" onClick={() => navigate("session", item.listingId || item.id)}>
              {view.title}
            </button>
          ) : (
            <strong className="mk3-chart-podium-title">{view.title}</strong>
          )}
          <span className="mk3-chart-podium-subtitle">{view.subtitle}</span>
          <span className="mk3-chart-podium-context">{view.context}</span>
          <div className="mk3-chart-podium-score"><strong>{formatScore(view.score)}</strong><span>{view.scoreLabel}</span></div>
        </article>
      );
    })}
  </div>
);

const FeaturedSongLadder = ({ song = {} }) => {
  const leaders = Array.isArray(song?.leaders) ? song.leaders.slice(0, 3) : [];
  if (song?.isOpeningScore || !leaders.length) return null;
  return (
    <section className="mk3-song-challenger-ladder" aria-labelledby="mk3-song-challenger-title">
      <header>
        <div>
          <div className="mk3-rebuild-kicker">King of the hill · real performances</div>
          <h2 id="mk3-song-challenger-title">Top performances for {song.songTitle || "this song"}</h2>
          <p>{song.artist || "Unknown artist"} · Beat the current score to take the Song Crown.</p>
        </div>
        <span>{leaders.length}/3 places claimed</span>
      </header>
      <ol>
        {leaders.map((leader, index) => (
          <li key={leader.resultId}>
            <b>#{index + 1}</b>
            <div><strong>{leader.displayName || "BeauRocks Singer"}</strong><span>{leader.qualifiedNightLabel || "BeauRocks night"}</span></div>
            <em>{formatScore(leader.score)}</em>
            <a href={buildReportResultHref(leader.resultId)}>Report</a>
          </li>
        ))}
      </ol>
    </section>
  );
};

const ChartsPage = ({ navigate }) => {
  const [activeTab, setActiveTab] = useState("songs");
  const [charts, setCharts] = useState({ members: [], songs: [], nights: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => subscribePublicCharts({
    limitCount: 50,
    onData: (nextCharts) => {
      setCharts(nextCharts);
      setLoading(false);
      setError("");
    },
    onError: (nextError) => {
      setLoading(false);
      setError(String(nextError?.message || "Charts are temporarily unavailable."));
    },
  }), []);

  const chartSongs = useMemo(
    () => mergePublicSongChart(charts.songs, PUBLIC_CHART_VISIBLE_LIMIT),
    [charts.songs]
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const nodeId = "mk3-charts-itemlist-jsonld";
    document.getElementById(nodeId)?.remove();
    const payload = buildPublicSongItemListJsonLd(charts.songs);
    if (!payload) return undefined;
    const node = document.createElement("script");
    node.id = nodeId;
    node.type = "application/ld+json";
    node.textContent = JSON.stringify(payload);
    document.head.appendChild(node);
    return () => node.remove();
  }, [charts.songs]);

  const activeItems = useMemo(
    () => (activeTab === "songs"
      ? chartSongs
      : (Array.isArray(charts[activeTab]) ? charts[activeTab].slice(0, PUBLIC_CHART_VISIBLE_LIMIT) : [])),
    [activeTab, chartSongs, charts]
  );

  const chartRows = activeItems.slice(3);
  const hasOpeningScores = activeTab === "songs" && activeItems.some((item) => item.isOpeningScore);
  const activeStory = CHART_STORIES[activeTab] || CHART_STORIES.songs;
  const featuredRealSong = activeTab === "songs"
    ? activeItems.find((item) => !item.isOpeningScore && Array.isArray(item.leaders) && item.leaders.length)
    : null;

  const openTab = (tabId) => {
    setActiveTab(tabId);
    trackEvent("mk_public_chart_tab_opened", { chart: tabId });
  };

  return (
    <section className="mk3-page mk3-charts-page">
      <header className="mk3-charts-hero">
        <div>
          <div className="mk3-rebuild-kicker">The BeauRocks charts</div>
          <h1>Every song has a score to beat.</h1>
          <p>One song, one leaderboard. Choose any backing track, sing it your way, and take the crown.</p>
        </div>
        <div className="mk3-charts-hero-stats" aria-label="Chart totals">
          <article><strong>{charts.members.length}</strong><span>Singers</span></article>
          <article><strong>{chartSongs.length}</strong><span>Songs to beat</span></article>
          <article><strong>{charts.nights.length}</strong><span>Karaoke nights</span></article>
        </div>
      </header>

      <section className="mk3-chart-story" aria-labelledby="mk3-chart-story-title">
        <div className="mk3-chart-story-heading">
          <div className="mk3-rebuild-kicker">How a song crown works</div>
          <h2 id="mk3-chart-story-title">Different versions. One record.</h2>
        </div>
        <ol>
          <li><b>01</b><div><strong>Choose a song</strong><span>Every version shares one leaderboard.</span></div></li>
          <li><b>02</b><div><strong>Earn a score</strong><span>Reactions, applause, and host awards add to your total.</span></div></li>
          <li><b>03</b><div><strong>Beat the leader</strong><span>The highest eligible score holds the crown.</span></div></li>
        </ol>
      </section>

      <nav className="mk3-charts-tabs" aria-label="Leaderboard views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => openTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="mk3-chart-view-explainer" aria-live="polite">
        <span>{activeStory.eyebrow}</span>
        <div><h2>{activeStory.title}</h2><p>{activeStory.copy}</p></div>
      </section>

      {loading && <div className="mk3-status">Syncing live crowns...</div>}
      {error && <div className="mk3-status mk3-status-warning">{error}</div>}
      {!loading && !error && activeItems.length === 0 && (
        <div className="mk3-charts-empty">
          <strong>First score is still up for grabs.</strong>
          <span>Join a BeauRocks night, sign in, and sing.</span>
          <button type="button" onClick={() => navigate("discover")}>Find a Night</button>
        </div>
      )}

      {activeItems.length > 0 && (!error || activeTab === "songs") && (
        <>
          {hasOpeningScores && (
            <div className="mk3-chart-opening-note">
              <strong>Every song starts with a score to beat.</strong>
              <span>Opening scores are placeholders. The first eligible singer score replaces them.</span>
            </div>
          )}
          <ChartPodium items={activeItems} activeTab={activeTab} navigate={navigate} />
          {featuredRealSong && <FeaturedSongLadder song={featuredRealSong} />}
          {!!chartRows.length && (
            <div className="mk3-chart-list" aria-label={`${TABS.find((tab) => tab.id === activeTab)?.label || "Chart"} ranks 4 through ${activeItems.length}`}>
              {chartRows.map((item, index) => {
                const rank = index + 4;
                if (activeTab === "members") {
                  return (
                    <article key={item.id || item.memberKey} className="mk3-chart-row">
                      <div className="mk3-chart-rank">{rank}</div>
                      <div className="mk3-chart-identity">
                        <strong>{item.displayName || "BeauRocks Singer"}</strong>
                        <span>{formatScore(item.performanceCount)} performances · best {formatScore(item.bestScore)}</span>
                      </div>
                      <div className="mk3-chart-score"><strong>{formatScore(item.rankScore)}</strong><span>points</span></div>
                      {!!item.latestResultId && (
                        <a className="mk3-chart-report" href={buildReportResultHref(item.latestResultId)}>Report</a>
                      )}
                    </article>
                  );
                }
                if (activeTab === "songs") {
                  return (
                    <article key={item.id || item.songId} className="mk3-chart-row is-song">
                      <div className="mk3-chart-rank">{rank}</div>
                      <div className="mk3-chart-art">
                        {item.albumArtUrl
                          ? <img src={item.albumArtUrl} alt="" loading="lazy" />
                          : <span aria-hidden="true">♪</span>}
                      </div>
                      <div className="mk3-chart-identity">
                        <strong>{item.songTitle || "Untitled song"}</strong>
                        <span>{item.artist || "Unknown artist"} · {item.isOpeningScore ? "crown unclaimed" : `${item.displayName || "BeauRocks Singer"} holds the crown`}</span>
                      </div>
                      <div className="mk3-chart-score"><strong>{formatScore(item.bestScore)}</strong><span>{item.isOpeningScore ? "score to beat" : "top score"}</span></div>
                      {!!item.resultId && !item.isOpeningScore && (
                        <a className="mk3-chart-report" href={buildReportResultHref(item.resultId)}>Report</a>
                      )}
                    </article>
                  );
                }
                return (
                  <article key={item.id || item.listingId} className="mk3-chart-row is-night">
                    <div className="mk3-chart-rank">{rank}</div>
                    <button
                      type="button"
                      className="mk3-chart-identity mk3-chart-night-link"
                      onClick={() => navigate("session", item.listingId || item.id)}
                    >
                      <strong>{item.title || "BeauRocks Night"}</strong>
                      <span>{[item.venueName, item.city, item.state].filter(Boolean).join(" · ") || "Public BeauRocks room"}</span>
                    </button>
                    <div className="mk3-chart-night-best">
                      <span>Top performance</span>
                      <strong>{item.topSingerName || "BeauRocks Singer"} · {formatScore(item.bestScore)}</strong>
                    </div>
                    <div className="mk3-chart-score"><strong>{formatScore(item.rankScore)}</strong><span>activity pts</span></div>
                    {!!item.topResultId && (
                      <a className="mk3-chart-report" href={buildReportResultHref(item.topResultId)}>Report</a>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <section className={`mk3-chart-persona-cta is-${activeTab}`}>
        <div><span>{activeStory.ctaKicker}</span><h2>{activeStory.ctaTitle}</h2><p>{activeStory.ctaCopy}</p></div>
        <button type="button" onClick={() => { trackEvent("mk_public_chart_persona_cta", { chart: activeTab, destination: activeStory.ctaPage }); navigate(activeStory.ctaPage); }}>{activeStory.ctaLabel}</button>
      </section>

      <footer className="mk3-charts-footnote">
        Sign in before you sing to appear on public charts. Scores must come from a public BeauRocks night.
      </footer>
    </section>
  );
};

export default ChartsPage;
