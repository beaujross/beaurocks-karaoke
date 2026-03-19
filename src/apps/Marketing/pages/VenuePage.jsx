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
import DirectoryExperienceSpotlight from "./DirectoryExperienceSpotlight";
import EmptyStatePanel from "./EmptyStatePanel";
import {
  MARKETING_BRAND_BADGE_URL,
  buildGoogleMapsSearchUrl,
  buildPublicLocationImageUrl,
  extractCadenceBadges,
  formatDateTime,
  getBeauRocksBadgeLabel,
  isBeauRocksPoweredListing,
  resolveListingImageCandidates,
  toTelephoneHref,
} from "./shared";

const applyImageFallback = (event, fallbackUrl = "/images/marketing/venue-location-fallback.svg") => {
  const target = event?.currentTarget;
  if (!target) return;
  target.onerror = null;
  target.src = fallbackUrl;
};

const VenuePage = ({ id, route, navigate, session, authFlow, buildHref, setSeoEntity }) => {
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
    if (typeof setSeoEntity !== "function") return;
    if (!venue) {
      setSeoEntity(null);
      return;
    }
    setSeoEntity({
      ...venue,
      listingType: "venue",
    });
  }, [venue, setSeoEntity]);

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
  const cadenceBadges = extractCadenceBadges({
    karaokeNightsLabel: venue.karaokeNightsLabel,
    startsAtMs: nextEvent?.startsAtMs || 0,
    max: 7,
  });
  const websiteUrl = String(venue.websiteUrl || "").trim();
  const bookingUrl = String(venue.bookingUrl || "").trim();
  const addressLabel = [venue.address1, venue.city, venue.state, venue.postalCode].filter(Boolean).join(", ");
  const mapsUrl = String(venue?.externalSources?.google?.mapsUrl || "").trim()
    || buildGoogleMapsSearchUrl([venue.address1, venue.city, venue.state, venue.postalCode]);
  const phoneLabel = String(venue.phone || "").trim();
  const phoneHref = toTelephoneHref(phoneLabel);
  const venueExperienceSource = {
    ...venue,
    ...(nextEvent || {}),
    title: venue.title,
    description: venue.description || nextEvent?.description || "",
    venueName: venue.title,
    imageUrl: heroImage,
  };
  const venueModernized = !!venueExperienceSource?.isOfficialBeauRocksRoom
    || !!venueExperienceSource?.hasBeauRocksHostAccount
    || (Array.isArray(venueExperienceSource?.beauRocksCapabilities) && venueExperienceSource.beauRocksCapabilities.length > 0);
  const venueBadgeLabel = getBeauRocksBadgeLabel({ ...venueExperienceSource, listingType: "venue" });
  const venueIsBeauRocksPowered = isBeauRocksPoweredListing(venueExperienceSource);

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-listing-title-block">
          <div className="mk3-listing-chip-row">
            <div className="mk3-chip">venue</div>
            {venueIsBeauRocksPowered && (
              <div className="mk3-chip mk3-chip-elevated">
                <img className="mk3-chip-icon" src={MARKETING_BRAND_BADGE_URL} alt="BeauRocks badge" loading="lazy" />
                <span>{venueBadgeLabel}</span>
              </div>
            )}
          </div>
          <h2>{venue.title}</h2>
          <div className="mk3-detail-meta">{[venue.city, venue.state, venue.address1].filter(Boolean).join(" | ")}</div>
        </div>

        <div className="mk3-venue-stat-grid">
          <article>
            <span>Upcoming nights</span>
            <strong>{eventCount}</strong>
          </article>
          <article>
            <span>Next listed time</span>
            <strong>{nextEvent ? formatDateTime(nextEvent.startsAtMs) : "TBD"}</strong>
          </article>
          <article>
            <span>Area</span>
            <strong>{[venue.city, venue.state].filter(Boolean).join(", ") || "Unspecified"}</strong>
          </article>
        </div>

        <div className="mk3-info-module">
          <strong>Schedule</strong>
          {!!cadenceBadges.length && (
            <div className="mk3-day-badge-row">
              {cadenceBadges.map((label) => (
                <span key={`venue-day-${label}`} className="mk3-day-badge">{label}</span>
              ))}
            </div>
          )}
          {venue.karaokeNightsLabel && <span className="mk3-info-note">{venue.karaokeNightsLabel}</span>}
          {!cadenceBadges.length && !venue.karaokeNightsLabel && (
            <span className="mk3-info-note">Schedule not listed yet.</span>
          )}
        </div>
        <div className="mk3-info-module">
          <strong>Plan your visit</strong>
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
        <div className="mk3-venue-hero">
          <img
            src={heroImage}
            alt={`${venue.title} listing visual`}
            loading="lazy"
            onError={(event) => applyImageFallback(event, fallbackVenueImage)}
          />
        </div>
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

        <p>{venue.description || "No venue details yet."}</p>
        <DirectoryExperienceSpotlight
          entry={venueExperienceSource}
          title="What to expect"
          eyebrow="night details"
        />
        <div className="mk3-sub-list">
          <h3>Upcoming karaoke nights</h3>
          {events.length === 0 && <div className="mk3-status">No approved events linked to this venue yet.</div>}
          {events.map((event) => (
            <a
              key={event.id}
              className="mk3-list-row"
              href={buildHref ? buildHref("event", event.id) : "#"}
              onClick={(clickEvent) => {
                clickEvent.preventDefault();
                navigate("event", event.id);
              }}
            >
              <span>{event.title}</span>
              <span>{formatDateTime(event.startsAtMs)}</span>
            </a>
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
          isModernized={venueModernized}
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
