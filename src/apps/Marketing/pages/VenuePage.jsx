import React, { useEffect, useState } from "react";
import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "../../../lib/firebase";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import EntityActionsCard from "./EntityActionsCard";
import CadenceUpdateCard from "./CadenceUpdateCard";
import ClaimOwnershipCard from "./ClaimOwnershipCard";
import EmptyStatePanel from "./EmptyStatePanel";
import { formatDateTime } from "./shared";

const VenuePage = ({ id, navigate, session, authFlow }) => {
  const [venue, setVenue] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return () => {};
    const venueQuery = query(
      collection(db, "venues"),
      where("__name__", "==", id),
      limit(1)
    );
    return onSnapshot(
      venueQuery,
      (snap) => setVenue(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      (err) => setError(String(err?.message || "Failed to load venue."))
    );
  }, [id]);

  useEffect(() => {
    if (!id) return () => {};
    const eventQuery = query(
      collection(db, "karaoke_events"),
      where("venueId", "==", id),
      where("status", "==", "approved"),
      orderBy("startsAtMs", "asc"),
      limit(40)
    );
    return onSnapshot(
      eventQuery,
      (snap) => setEvents(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))),
      () => setEvents([])
    );
  }, [id]);

  if (error) {
    return <section className="mk3-page"><div className="mk3-status mk3-status-error">{error}</div></section>;
  }
  if (!venue) {
    return (
      <section className="mk3-page">
        <EmptyStatePanel
          {...getEmptyStateConfig({ context: EMPTY_STATE_CONTEXT.VENUE_MISSING, session })}
          onAction={(action) => {
            if (action.intent === "auth") {
              authFlow?.requireFullAuth?.({
                intent: "listing_submit",
                targetType: "venue",
                targetId: "",
                returnRoute: { page: "submit", params: { intent: "listing_submit", targetType: "venue" } },
              });
              return;
            }
            if (action.intent === "submit_listing") {
              navigate("submit", "", { intent: "listing_submit", targetType: "venue" });
              return;
            }
            navigate("discover");
          }}
        />
      </section>
    );
  }

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">venue</div>
        <h2>{venue.title}</h2>
        <div className="mk3-detail-meta">{[venue.city, venue.state, venue.address1].filter(Boolean).join(" | ")}</div>
        {venue.karaokeNightsLabel && (
          <div className="mk3-status">
            <strong>Karaoke cadence</strong>
            <span>{venue.karaokeNightsLabel}</span>
          </div>
        )}
        <p>{venue.description || "No venue description provided yet."}</p>
        {venue.websiteUrl && (
          <a href={venue.websiteUrl} target="_blank" rel="noreferrer">
            Venue Website
          </a>
        )}
        <div className="mk3-sub-list">
          <h3>Upcoming Karaoke Events</h3>
          {events.length === 0 && <div className="mk3-status">No approved events linked to this venue yet.</div>}
          {events.map((event) => (
            <button key={event.id} type="button" className="mk3-list-row" onClick={() => navigate("event", event.id)}>
              <span>{event.title}</span>
              <span>{formatDateTime(event.startsAtMs)}</span>
            </button>
          ))}
        </div>
      </article>
      <div className="mk3-side-stack">
        <ClaimOwnershipCard
          listingType="venue"
          listingId={venue.id}
          session={session}
          navigate={navigate}
          authFlow={authFlow}
        />
        <CadenceUpdateCard
          listingType="venue"
          listing={venue}
          session={session}
          authFlow={authFlow}
        />
        <EntityActionsCard
          targetType="venue"
          targetId={venue.id}
          session={session}
          navigate={navigate}
          authFlow={authFlow}
        />
      </div>
    </section>
  );
};

export default VenuePage;
