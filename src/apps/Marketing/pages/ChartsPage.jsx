import React, { useEffect, useMemo, useState } from "react";
import { subscribePublicCharts } from "../api/directoryApi";
import { trackEvent } from "../lib/marketingAnalytics";
import { mergePublicSongChart, PUBLIC_CHART_VISIBLE_LIMIT } from "./publicChartModel.js";
import "./charts.css";

const TABS = Object.freeze([
  { id: "members", label: "Singers" },
  { id: "songs", label: "Songs" },
  { id: "nights", label: "Karaoke Nights" },
]);

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
      scoreLabel: "night pts",
    };
  }
  return {
    title: item.displayName || "BeauRocks Singer",
    subtitle: `${formatScore(item.performanceCount)} performances · best ${formatScore(item.bestScore)}`,
    context: item.latestSongTitle
      ? `Latest: ${item.latestSongTitle}${item.latestArtist ? ` · ${item.latestArtist}` : ""}`
      : "Qualified BeauRocks performances",
    score: item.rankScore,
    scoreLabel: "chart pts",
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

  const activeItems = useMemo(
    () => (activeTab === "songs"
      ? chartSongs
      : (Array.isArray(charts[activeTab]) ? charts[activeTab].slice(0, PUBLIC_CHART_VISIBLE_LIMIT) : [])),
    [activeTab, chartSongs, charts]
  );

  const chartRows = activeItems.slice(3);
  const hasOpeningScores = activeTab === "songs" && activeItems.some((item) => item.isOpeningScore);

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
          <li><b>01</b><div><strong>Pick the song</strong><span>Every backing version rolls up to the same song leaderboard.</span></div></li>
          <li><b>02</b><div><strong>Move the room</strong><span>Hype, applause, and host bonus become your performance score.</span></div></li>
          <li><b>03</b><div><strong>Take the crown</strong><span>The top qualified score holds the song until somebody beats it.</span></div></li>
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
              <strong>Opening scores start the chase.</strong>
              <span>These deliberately low catalog marks are not singer performances. The first qualified score on a song replaces its opening score.</span>
            </div>
          )}
          <ChartPodium items={activeItems} activeTab={activeTab} navigate={navigate} />
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
                      <div className="mk3-chart-score"><strong>{formatScore(item.rankScore)}</strong><span>chart pts</span></div>
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
                    <div className="mk3-chart-score"><strong>{formatScore(item.rankScore)}</strong><span>night pts</span></div>
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

      <footer className="mk3-charts-footnote">
        Guests still appear in their live room. Public crowns require a BeauRocks account and an approved BeauRocks host night.
      </footer>
    </section>
  );
};

export default ChartsPage;
