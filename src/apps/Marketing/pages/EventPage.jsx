import React, { useEffect, useState } from "react";
import { directoryActions } from "../api/directoryApi";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import EntityActionsCard from "./EntityActionsCard";
import CadenceUpdateCard from "./CadenceUpdateCard";
import DirectoryExperienceSpotlight from "./DirectoryExperienceSpotlight";
import EmptyStatePanel from "./EmptyStatePanel";
import {
  MARKETING_BRAND_BADGE_URL,
  buildGoogleMapsSearchUrl,
  buildPublicLocationImageUrl,
  extractCadenceBadges,
  formatDateTime,
  getBeauRocksBadgeLabel,
  getInitials,
  isBeauRocksPoweredListing,
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

const EventPage = ({ id, route, navigate, session, authFlow, buildHref, setSeoEntity }) => {
  const [eventItem, setEventItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadEvent = async () => {
      if (!id) {
        setEventItem(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        let nextCursor = "";
        let match = null;

        for (let pageIndex = 0; pageIndex < 6; pageIndex += 1) {
          const payload = await directoryActions.listDirectoryDiscover({
            listingType: "event",
            timeWindow: "all",
            sortMode: "soonest",
            limit: 60,
            cursor: nextCursor,
          });

          const items = Array.isArray(payload?.items) ? payload.items : [];
          match = items.find((item) => String(item?.id || "") === String(id || "")) || null;
          if (match || !String(payload?.nextCursor || "").trim()) break;
          nextCursor = String(payload?.nextCursor || "").trim();
        }

        if (cancelled) return;
        setEventItem(match);
      } catch (err) {
        if (cancelled) return;
        setError(String(err?.message || "Failed to load event."));
        setEventItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadEvent();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (typeof setSeoEntity !== "function") return;
    if (!eventItem) {
      setSeoEntity(null);
      return;
    }
    setSeoEntity({
      ...eventItem,
      listingType: "event",
    });
  }, [eventItem, setSeoEntity]);

  if (error) {
    return <section className="mk3-page"><div className="mk3-status mk3-status-error">{error}</div></section>;
  }

  if (loading) {
    return (
      <section className="mk3-page">
        <div className="mk3-status">Loading event...</div>
      </section>
    );
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

  const hostLabel = eventItem.hostName || "Unassigned Host";
  const hostAvatarUrl = resolveProfileAvatarUrl(eventItem);
  const eventImageCandidates = [
    ...resolveListingImageCandidates(eventItem, "event"),
  ].filter((value, index, arr) => arr.indexOf(value) === index);
  const fallbackEventImage = buildPublicLocationImageUrl(eventItem)
    || "/images/marketing/venue-location-fallback.svg";
  const heroImage = eventImageCandidates[0] || fallbackEventImage;
  const listingGallery = eventImageCandidates.slice(0, 3);
  const cadenceBadges = extractCadenceBadges({
    recurringRule: eventItem.recurringRule,
    startsAtMs: eventItem.startsAtMs,
    max: 7,
  });
  const websiteUrl = String(eventItem.websiteUrl || "").trim();
  const bookingUrl = String(eventItem.bookingUrl || "").trim();
  const mapsUrl = String(eventItem?.externalSources?.google?.mapsUrl || "").trim()
    || buildGoogleMapsSearchUrl([
      eventItem?.address1,
      eventItem?.city,
      eventItem?.state,
      eventItem?.postalCode,
    ]);
  const phoneLabel = String(eventItem?.phone || "").trim();
  const phoneHref = toTelephoneHref(phoneLabel);
  const addressLabel = [
    eventItem?.address1,
    eventItem?.city,
    eventItem?.state,
    eventItem?.postalCode,
  ].filter(Boolean).join(", ");
  const eventExperienceSource = {
    ...eventItem,
    title: eventItem.title,
    hostName: hostLabel,
    venueName: eventItem.venueName || "",
    imageUrl: heroImage,
  };
  const eventIsBeauRocksPowered = isBeauRocksPoweredListing(eventExperienceSource);
  const eventBadgeLabel = getBeauRocksBadgeLabel({ ...eventExperienceSource, listingType: "event" });

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-listing-title-block">
          <div className="mk3-listing-chip-row">
            <div className="mk3-chip">event</div>
            {eventIsBeauRocksPowered && (
              <div className="mk3-chip mk3-chip-elevated">
                <img className="mk3-chip-icon" src={MARKETING_BRAND_BADGE_URL} alt="BeauRocks badge" loading="lazy" />
                <span>{eventBadgeLabel}</span>
              </div>
            )}
          </div>
          <h2>{eventItem.title}</h2>
          <div className="mk3-detail-meta">
            {formatDateTime(eventItem.startsAtMs)}
            {eventItem.endsAtMs ? ` -> ${formatDateTime(eventItem.endsAtMs)}` : ""}
          </div>
        </div>

        <div className="mk3-venue-stat-grid">
          <article>
            <span>Starts</span>
            <strong>{formatDateTime(eventItem.startsAtMs)}</strong>
          </article>
          <article>
            <span>Venue</span>
            <strong>{eventItem.venueName || "TBD"}</strong>
          </article>
          <article>
            <span>Area</span>
            <strong>{[eventItem?.city, eventItem?.state].filter(Boolean).join(", ") || "Unspecified"}</strong>
          </article>
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
          <strong>Schedule</strong>
          {!!cadenceBadges.length && (
            <div className="mk3-day-badge-row">
              {cadenceBadges.map((label) => (
                <span key={`event-day-${label}`} className="mk3-day-badge">{label}</span>
              ))}
            </div>
          )}
          {eventItem.recurringRule && <span className="mk3-info-note">{eventItem.recurringRule}</span>}
          {!cadenceBadges.length && !eventItem.recurringRule && (
            <span className="mk3-info-note">Schedule not listed yet.</span>
          )}
        </div>

        <div className="mk3-info-module">
          <strong>Details</strong>
          <div className="mk3-sub-list">
            {eventItem.venueName && (
              <div className="mk3-list-row static">
                <span>Venue</span>
                <span>{eventItem.venueName}</span>
              </div>
            )}
            {eventItem.hostName && !eventItem.hostUid && (
              <div className="mk3-list-row static">
                <span>Host</span>
                <span>{eventItem.hostName}</span>
              </div>
            )}
            {!!eventItem.hostUid && (
              <a
                className="mk3-list-row"
                href={buildHref ? buildHref("host", eventItem.hostUid) : "#"}
                onClick={(clickEvent) => {
                  clickEvent.preventDefault();
                  navigate("host", eventItem.hostUid);
                }}
              >
                <span>Host</span>
                <span>{eventItem.hostName || eventItem.hostUid}</span>
              </a>
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

        <div className="mk3-listing-hero">
          <img
            src={heroImage}
            alt={`${eventItem.title} listing visual`}
            loading="lazy"
            onError={(event) => applyImageFallback(event, fallbackEventImage)}
          />
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

        <p>{eventItem.description || "No event details yet."}</p>

        <DirectoryExperienceSpotlight
          entry={eventExperienceSource}
          title="What to expect"
          eyebrow="night details"
          showUpgradePrompt={false}
        />
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
