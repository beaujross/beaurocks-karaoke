import React, { useEffect, useMemo, useState } from "react";
import { subscribePublicCharts } from "../api/directoryApi";
import { trackEvent } from "../lib/marketingAnalytics";

const TABS = Object.freeze([
  { id: "members", label: "Global" },
  { id: "songs", label: "Songs" },
  { id: "nights", label: "Public Rooms" },
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

const ChartsPage = ({ navigate }) => {
  const [activeTab, setActiveTab] = useState("members");
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

  const activeItems = useMemo(
    () => (Array.isArray(charts[activeTab]) ? charts[activeTab] : []),
    [activeTab, charts]
  );

  const openTab = (tabId) => {
    setActiveTab(tabId);
    trackEvent("mk_public_chart_tab_opened", { chart: tabId });
  };

  return (
    <section className="mk3-page mk3-charts-page">
      <header className="mk3-charts-hero">
        <div>
          <div className="mk3-rebuild-kicker">BeauRocks Charts</div>
          <h1>The room makes the score. Your account makes the charts.</h1>
          <p>Signed-in performances from approved BeauRocks hosts. One canonical song, any backing track.</p>
        </div>
        <div className="mk3-charts-hero-stats" aria-label="Chart totals">
          <article><strong>{charts.members.length}</strong><span>Singers</span></article>
          <article><strong>{charts.songs.length}</strong><span>Songs</span></article>
          <article><strong>{charts.nights.length}</strong><span>Public rooms</span></article>
        </div>
      </header>

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

      {loading && <div className="mk3-status">Loading charts...</div>}
      {error && <div className="mk3-status mk3-status-warning">{error}</div>}
      {!loading && !error && activeItems.length === 0 && (
        <div className="mk3-charts-empty">
          <strong>First score is still up for grabs.</strong>
          <span>Join a BeauRocks night, sign in, and sing.</span>
          <button type="button" onClick={() => navigate("discover")}>Find a Night</button>
        </div>
      )}

      {!loading && !error && activeItems.length > 0 && (
        <div className="mk3-chart-list">
          {activeItems.map((item, index) => {
            const rank = index + 1;
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
                    <span>{item.artist || "Unknown artist"} · {item.displayName || "BeauRocks Singer"}</span>
                  </div>
                  <div className="mk3-chart-score"><strong>{formatScore(item.bestScore)}</strong><span>best</span></div>
                  {!!item.resultId && (
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

      <footer className="mk3-charts-footnote">
        Guests still appear in their live room. Public charts require a BeauRocks account and an approved host night.
      </footer>
    </section>
  );
};

export default ChartsPage;
