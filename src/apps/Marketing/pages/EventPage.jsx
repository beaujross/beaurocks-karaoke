import React, { useEffect, useState } from "react";
import {
  db,
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from "../../../lib/firebase";
import EntityActionsCard from "./EntityActionsCard";
import { formatDateTime } from "./shared";

const EventPage = ({ id, navigate, session }) => {
  const [eventItem, setEventItem] = useState(null);
  const [venue, setVenue] = useState(null);
  const [hostProfile, setHostProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return () => {};
    const eventQuery = query(
      collection(db, "karaoke_events"),
      where("__name__", "==", id),
      limit(1)
    );
    return onSnapshot(
      eventQuery,
      (snap) => setEventItem(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      (err) => setError(String(err?.message || "Failed to load event."))
    );
  }, [id]);

  useEffect(() => {
    if (!eventItem?.venueId) return () => {};
    return onSnapshot(
      query(collection(db, "venues"), where("__name__", "==", eventItem.venueId), limit(1)),
      (snap) => setVenue(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setVenue(null)
    );
  }, [eventItem?.venueId]);

  useEffect(() => {
    if (!eventItem?.hostUid) return () => {};
    return onSnapshot(
      query(collection(db, "directory_profiles"), where("__name__", "==", eventItem.hostUid), limit(1)),
      (snap) => setHostProfile(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setHostProfile(null)
    );
  }, [eventItem?.hostUid]);

  if (error) {
    return <section className="mk3-page"><div className="mk3-status mk3-status-error">{error}</div></section>;
  }
  if (!eventItem) {
    return <section className="mk3-page"><div className="mk3-status">Event not found.</div></section>;
  }

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">event</div>
        <h2>{eventItem.title}</h2>
        <div className="mk3-detail-meta">
          {formatDateTime(eventItem.startsAtMs)}
          {eventItem.endsAtMs ? ` -> ${formatDateTime(eventItem.endsAtMs)}` : ""}
        </div>
        <p>{eventItem.description || "No event description yet."}</p>
        <div className="mk3-sub-list">
          {venue && (
            <button type="button" className="mk3-list-row" onClick={() => navigate("venue", venue.id)}>
              <span>Venue</span>
              <span>{venue.title}</span>
            </button>
          )}
          {hostProfile && (
            <button type="button" className="mk3-list-row" onClick={() => navigate("host", hostProfile.id)}>
              <span>Host</span>
              <span>{hostProfile.displayName || hostProfile.handle || hostProfile.id}</span>
            </button>
          )}
        </div>
      </article>
      <EntityActionsCard targetType="event" targetId={eventItem.id} session={session} />
    </section>
  );
};

export default EventPage;
