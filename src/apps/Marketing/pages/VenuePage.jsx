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
import { buildPublicLocationImageUrl, formatDateTime, resolveListingImageCandidates } from "./shared";

const applyImageFallback = (event, fallbackUrl = "/images/marketing/venue-location-fallback.svg") => {
  const target = event?.currentTarget;
  if (!target) return;
  target.onerror = null;
  target.src = fallbackUrl;
};

const VenuePage = ({ id, route, navigate, session, authFlow }) => {
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

  const eventCount = events.length;
  const nextEvent = events[0] || null;
  const venueImages = resolveListingImageCandidates(venue, "venue");
  const fallbackVenueImage = buildPublicLocationImageUrl(venue) || "/images/marketing/venue-location-fallback.svg";
  const allImages = [...venueImages, fallbackVenueImage]
    .filter((value, index, array) => String(value || "").trim() && array.indexOf(value) === index);
  const heroImage = allImages[0] || "/images/marketing/venue-location-fallback.svg";
  const listingGallery = allImages.slice(0, 3);

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-venue-hero">
          <img
            src={heroImage}
            alt={`${venue.title} listing visual`}
            loading="lazy"
            onError={(event) => applyImageFallback(event, fallbackVenueImage)}
          />
          <div className="mk3-venue-hero-content">
            <div className="mk3-chip">venue</div>
            <h2>{venue.title}</h2>
            <div className="mk3-detail-meta">{[venue.city, venue.state, venue.address1].filter(Boolean).join(" | ")}</div>
          </div>
        </div>

        <div className="mk3-venue-stat-grid">
          <article>
            <span>Upcoming Events</span>
            <strong>{eventCount}</strong>
          </article>
          <article>
            <span>Next Karaoke Slot</span>
            <strong>{nextEvent ? formatDateTime(nextEvent.startsAtMs) : "TBD"}</strong>
          </article>
          <article>
            <span>Region</span>
            <strong>{[venue.city, venue.state].filter(Boolean).join(", ") || "Unspecified"}</strong>
          </article>
        </div>

        {venue.karaokeNightsLabel && (
          <div className="mk3-status">
            <strong>Karaoke cadence</strong>
            <span>{venue.karaokeNightsLabel}</span>
          </div>
        )}

        <div className="mk3-venue-gallery" aria-label="Venue gallery">
          {listingGallery.map((imageUrl, index) => (
            <figure key={`${imageUrl}-${index}`}>
              <img
                src={imageUrl}
                alt={`${venue.title} visual ${index + 1}`}
                loading="lazy"
                onError={(event) => applyImageFallback(event, fallbackVenueImage)}
              />
            </figure>
          ))}
        </div>

        <p>{venue.description || "No venue description provided yet."}</p>
        {venue.websiteUrl && (
          <a className="mk3-venue-link" href={venue.websiteUrl} target="_blank" rel="noreferrer">
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
          conversionSource={String(route?.params?.src || "venue_page")}
        />
      </div>
    </section>
  );
};

export default VenuePage;
