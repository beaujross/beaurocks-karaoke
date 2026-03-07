import React, { useEffect, useState } from "react";
import {
  db,
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from "../../../lib/firebase";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import EntityActionsCard from "./EntityActionsCard";
import CadenceUpdateCard from "./CadenceUpdateCard";
import DirectoryExperienceSpotlight from "./DirectoryExperienceSpotlight";
import EmptyStatePanel from "./EmptyStatePanel";
import {
  buildGoogleMapsSearchUrl,
  buildPublicLocationImageUrl,
  extractCadenceBadges,
  formatDateTime,
  getInitials,
  resolveListingImageCandidates,
  resolveProfileAvatarUrl,
  toTelephoneHref,
} from "./shared";

const applyImageFallback = (event, fallbackUrl = "/images/marketing/venue-location-fallback.svg") => {
  const target = event?.currentTarget;
  if (!target) return;
  target.onerror = null;
  target.src = fallbackUrl;
};

const EventPage = ({ id, route, navigate, session, authFlow }) => {
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
    return (
      <section className="mk3-page">
        <EmptyStatePanel
          {...getEmptyStateConfig({ context: EMPTY_STATE_CONTEXT.EVENT_MISSING, session })}
          onAction={(action) => {
            if (action.intent === "for_hosts") navigate("for_hosts");
            else navigate("discover");
          }}
        />
      </section>
    );
  }

  const hostLabel = hostProfile?.displayName
    || hostProfile?.handle
    || eventItem.hostName
    || "Unassigned Host";
  const hostAvatarUrl = resolveProfileAvatarUrl(hostProfile || eventItem);
  const eventImageCandidates = [
    ...resolveListingImageCandidates(eventItem, "event"),
    ...resolveListingImageCandidates(venue || {}, "venue"),
  ].filter((value, index, arr) => arr.indexOf(value) === index);
  const fallbackEventImage = buildPublicLocationImageUrl(eventItem) || buildPublicLocationImageUrl(venue || {})
    || "/images/marketing/venue-location-fallback.svg";
  const heroImage = eventImageCandidates[0] || fallbackEventImage;
  const listingGallery = eventImageCandidates.slice(0, 3);
  const cadenceBadges = extractCadenceBadges({
    recurringRule: eventItem.recurringRule,
    startsAtMs: eventItem.startsAtMs,
    max: 7,
  });
  const websiteUrl = String(eventItem.websiteUrl || venue?.websiteUrl || "").trim();
  const bookingUrl = String(eventItem.bookingUrl || venue?.bookingUrl || "").trim();
  const mapsUrl = String(eventItem?.externalSources?.google?.mapsUrl || venue?.externalSources?.google?.mapsUrl || "").trim()
    || buildGoogleMapsSearchUrl([
      venue?.address1 || eventItem?.address1,
      venue?.city || eventItem?.city,
      venue?.state || eventItem?.state,
      venue?.postalCode || eventItem?.postalCode,
    ]);
  const phoneLabel = String(venue?.phone || eventItem?.phone || "").trim();
  const phoneHref = toTelephoneHref(phoneLabel);
  const addressLabel = [
    venue?.address1 || eventItem?.address1,
    venue?.city || eventItem?.city,
    venue?.state || eventItem?.state,
    venue?.postalCode || eventItem?.postalCode,
  ].filter(Boolean).join(", ");
  const eventExperienceSource = {
    ...eventItem,
    ...(venue || {}),
    ...(hostProfile || {}),
    title: eventItem.title,
    hostName: hostLabel,
    venueName: venue?.title || eventItem.venueName || "",
    imageUrl: heroImage,
  };

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-listing-hero">
          <img
            src={heroImage}
            alt={`${eventItem.title} listing visual`}
            loading="lazy"
            onError={(event) => applyImageFallback(event, fallbackEventImage)}
          />
          <div className="mk3-listing-hero-content">
            <div className="mk3-chip">event</div>
            <h2>{eventItem.title}</h2>
            <div className="mk3-detail-meta">
              {formatDateTime(eventItem.startsAtMs)}
              {eventItem.endsAtMs ? ` -> ${formatDateTime(eventItem.endsAtMs)}` : ""}
            </div>
          </div>
        </div>

        <div className="mk3-profile-pill">
          <div className="mk3-profile-avatar" aria-hidden="true">
            {hostAvatarUrl
              ? <img src={hostAvatarUrl} alt={`${hostLabel} avatar`} loading="lazy" />
              : <span>{getInitials(hostLabel)}</span>}
          </div>
          <div className="mk3-profile-copy">
            <strong>Host</strong>
            <span>{hostLabel}</span>
          </div>
        </div>

        <div className="mk3-info-module">
          <strong>Karaoke Times</strong>
          {!!cadenceBadges.length && (
            <div className="mk3-day-badge-row">
              {cadenceBadges.map((label) => (
                <span key={`event-day-${label}`} className="mk3-day-badge">{label}</span>
              ))}
            </div>
          )}
          {eventItem.recurringRule && <span className="mk3-info-note">{eventItem.recurringRule}</span>}
          {!cadenceBadges.length && !eventItem.recurringRule && (
            <span className="mk3-info-note">Cadence pending.</span>
          )}
        </div>
        <div className="mk3-venue-gallery" aria-label="Event media gallery">
          {listingGallery.map((imageUrl, index) => (
            <figure key={`${imageUrl}-${index}`}>
              <img
                src={imageUrl}
                alt={`${eventItem.title} visual ${index + 1}`}
                loading="lazy"
                onError={(event) => applyImageFallback(event, fallbackEventImage)}
              />
            </figure>
          ))}
        </div>
        <p>{eventItem.description || "No event description yet."}</p>
        <DirectoryExperienceSpotlight
          entry={eventExperienceSource}
          title="Why This Event Feels Different"
          eyebrow="event experience"
          showUpgradePrompt={false}
        />
        <div className="mk3-info-module">
          <strong>Venue / Host / Links</strong>
          <div className="mk3-sub-list">
            {eventItem.venueName && !venue && (
              <div className="mk3-list-row static">
                <span>Venue</span>
                <span>{eventItem.venueName}</span>
              </div>
            )}
            {venue && (
              <button type="button" className="mk3-list-row" onClick={() => navigate("venue", venue.id)}>
                <span>Venue</span>
                <span>{venue.title}</span>
              </button>
            )}
            {eventItem.hostName && !hostProfile && (
              <div className="mk3-list-row static">
                <span>Host</span>
                <span>{eventItem.hostName}</span>
              </div>
            )}
            {hostProfile && (
              <button type="button" className="mk3-list-row" onClick={() => navigate("host", hostProfile.id)}>
                <span>Host</span>
                <span>{hostProfile.displayName || hostProfile.handle || hostProfile.id}</span>
              </button>
            )}
          </div>
          <div className="mk3-info-link-row">
            {websiteUrl && (
              <a className="mk3-venue-link" href={websiteUrl} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
            {bookingUrl && (
              <a className="mk3-venue-link" href={bookingUrl} target="_blank" rel="noreferrer">
                Booking
              </a>
            )}
            {mapsUrl && (
              <a className="mk3-venue-link" href={mapsUrl} target="_blank" rel="noreferrer">
                Maps
              </a>
            )}
          </div>
          <div className="mk3-info-kv-grid">
            {phoneLabel && (
              <div className="mk3-info-kv">
                <span className="mk3-info-kv-label">Phone</span>
                {phoneHref
                  ? <a className="mk3-info-kv-value-link" href={phoneHref}>{phoneLabel}</a>
                  : <span className="mk3-info-kv-value">{phoneLabel}</span>}
              </div>
            )}
            {addressLabel && (
              <div className="mk3-info-kv">
                <span className="mk3-info-kv-label">Address</span>
                <span className="mk3-info-kv-value">{addressLabel}</span>
              </div>
            )}
          </div>
        </div>
      </article>
      <div className="mk3-side-stack">
        <CadenceUpdateCard
          listingType="event"
          listing={eventItem}
          session={session}
          authFlow={authFlow}
        />
        <EntityActionsCard
          targetType="event"
          targetId={eventItem.id}
          session={session}
          navigate={navigate}
          authFlow={authFlow}
          conversionSource={String(route?.params?.src || "event_page")}
        />
      </div>
    </section>
  );
};

export default EventPage;
