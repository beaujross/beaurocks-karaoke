import React, { useEffect, useMemo, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import { marketingFlags } from "../featureFlags";
import EmptyStatePanel from "./EmptyStatePanel";
import InlineConversionActions from "./InlineConversionActions";
import { extractCadenceBadges, formatDateTime } from "./shared";

const toLabel = (value = "") =>
  String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

const GeoLandingPage = ({ route = {}, navigate, session, authFlow }) => {
  const state = String(route?.params?.state || "").toLowerCase();
  const city = String(route?.params?.city || "").toLowerCase();
  const regionToken = String(route?.params?.regionToken || route?.id || "").toLowerCase();
  const [dateWindow, setDateWindow] = useState("this_week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  const label = useMemo(() => {
    if (state && city) return `${toLabel(city)}, ${String(state).toUpperCase()}`;
    if (regionToken) return toLabel(regionToken);
    return "Nationwide";
  }, [state, city, regionToken]);

  useEffect(() => {
    if (!marketingFlags.geoPagesEnabled) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const next = await directoryActions.listDirectoryGeoLanding({
          state: state || undefined,
          city: city || undefined,
          regionToken: regionToken || undefined,
          dateWindow,
        });
        if (!cancelled) {
          setPayload(next || null);
          trackEvent("mk_geo_page_view", {
            token: next?.token || regionToken || `${state}_${city}`,
            dateWindow,
          });
        }
      } catch (err) {
        if (!cancelled) setError(String(err?.message || "Could not load geo listings."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, city, regionToken, dateWindow]);

  const entries = useMemo(() => {
    if (!payload) return [];
    const venues = (payload.venues || []).map((item) => ({ ...item, routePage: "venue" }));
    const events = (payload.events || []).map((item) => ({ ...item, routePage: "event" }));
    const sessions = (payload.sessions || []).map((item) => ({ ...item, routePage: "session" }));
    return [...events, ...sessions, ...venues];
  }, [payload]);

  const onEmptyAction = (action = {}) => {
    const intent = String(action.intent || "");
    if (intent === "auth") {
      authFlow?.requireFullAuth?.({
        intent: "listing_submit",
        targetType: "geo",
        targetId: "",
        returnRoute: { page: "submit", params: { intent: "listing_submit", targetType: "geo" } },
      });
      return;
    }
    if (intent === "submit_listing") {
      navigate("submit", "", { intent: "listing_submit", targetType: "geo" });
      return;
    }
    if (intent === "discover") {
      navigate("discover");
      return;
    }
    navigate("discover");
  };

  if (!marketingFlags.geoPagesEnabled) {
    return (
      <section className="mk3-page">
        <div className="mk3-status">Geo pages are off right now.</div>
      </section>
    );
  }

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <nav className="mk3-breadcrumb" aria-label="Geo landing breadcrumb">
          <button type="button" onClick={() => navigate("for-fans")}>Home</button>
          <span className="mk3-breadcrumb-sep">/</span>
          <button type="button" onClick={() => navigate("discover")}>Discover</button>
          <span className="mk3-breadcrumb-sep">/</span>
          <span>Karaoke</span>
          {state && city && (
            <>
              <span className="mk3-breadcrumb-sep">/</span>
              <span>United States</span>
            </>
          )}
          <span className="mk3-breadcrumb-sep">/</span>
          <span className="mk3-breadcrumb-current">{label}</span>
        </nav>
        <div className="mk3-chip">geo landing</div>
        <h2>{label}</h2>
        <p>Public karaoke nights and upcoming sessions in this area.</p>
        <div className="mk3-filter-row">
          <label>
            Date Window
            <select value={dateWindow} onChange={(e) => setDateWindow(e.target.value)}>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="14d">14 Days</option>
            </select>
          </label>
        </div>
        {loading && <div className="mk3-status">Loading local listings...</div>}
        {error && <div className="mk3-status mk3-status-error">{error}</div>}
        {!loading && !error && (
          <div className="mk3-status">
            <strong>{payload?.counts?.total || 0}</strong>
            <span>{payload?.counts?.events || 0} events | {payload?.counts?.sessions || 0} sessions | {payload?.counts?.venues || 0} venues</span>
          </div>
        )}
        <div className="mk3-sub-list">
          {!loading && !error && entries.length === 0 && (
            <EmptyStatePanel
              {...getEmptyStateConfig({
                context: EMPTY_STATE_CONTEXT.GEO_NO_RESULTS,
                session,
                hasFilters: false,
              })}
              onAction={onEmptyAction}
            />
          )}
          {entries.map((entry) => {
            const cadenceBadges = extractCadenceBadges({
              karaokeNightsLabel: entry.karaokeNightsLabel,
              recurringRule: entry.recurringRule,
              startsAtMs: entry.startsAtMs,
              max: 4,
            });
            return (
            <article key={`${entry.routePage}_${entry.id}`} className="mk3-review-card">
              <button
                type="button"
                className="mk3-list-row"
                onClick={() => navigate(entry.routePage, entry.id)}
              >
                <span>{entry.title || "Untitled listing"}</span>
                <span>{entry.startsAtMs ? formatDateTime(entry.startsAtMs) : [entry.city, entry.state].filter(Boolean).join(", ")}</span>
              </button>
              {!!cadenceBadges.length && (
                <div className="mk3-day-badge-row">
                  {cadenceBadges.map((badge) => (
                    <span key={`${entry.id}_${badge}`} className="mk3-day-badge">{badge}</span>
                  ))}
                </div>
              )}
              <InlineConversionActions
                entry={entry}
                session={session}
                navigate={navigate}
                authFlow={authFlow}
              />
            </article>
            );
          })}
        </div>
      </article>
      <aside className="mk3-actions-card">
        <h4>Explore</h4>
        <p>Need map view and deeper filters? Jump to Discover.</p>
        <button type="button" onClick={() => navigate("submit", "", { intent: "listing_submit", targetType: "geo" })}>
          Add Karaoke Night
        </button>
        <button type="button" onClick={() => navigate("discover")}>
          Open Discover
        </button>
      </aside>
    </section>
  );
};

export default GeoLandingPage;

