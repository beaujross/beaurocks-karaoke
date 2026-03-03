import React from "react";
import InlineConversionActions from "./InlineConversionActions";
import { getInitials } from "./shared";

const DiscoverListingCard = ({
  entry,
  isSelected = false,
  isMobileViewport = false,
  mapsLoaded = false,
  registerCardRef = null,
  onImageError = null,
  onFocus = null,
  onOpenDetails = null,
  onOpenHost = null,
  onJoinRoom = null,
  session = null,
  navigate = null,
  authFlow = null,
}) => (
  <article
    key={entry.key}
    ref={(node) => registerCardRef?.(entry.key, node)}
    className={isSelected ? "mk3-discover-card is-selected" : "mk3-discover-card"}
  >
    <div className="mk3-discover-media">
      <img
        src={entry.imageUrl}
        alt={`${entry.title} venue visual`}
        loading="lazy"
        onError={(event) => onImageError?.(event, entry.imageFallbackUrls)}
      />
      <div className="mk3-discover-media-top">
        <div className="mk3-chip">{entry.typeLabel}</div>
        <div className="mk3-discover-avatar" aria-hidden="true">
          {entry.avatarUrl
            ? <img src={entry.avatarUrl} alt={`${entry.avatarLabel} avatar`} loading="lazy" />
            : <span>{getInitials(entry.avatarLabel || entry.title)}</span>}
        </div>
      </div>
    </div>
    <h3>{entry.title}</h3>
    <div className="mk3-card-subtitle">{entry.subtitle}</div>
    {!!entry.distanceLabel && <div className="mk3-card-subtitle">{entry.distanceLabel}</div>}
    {entry.timeLabel && <div className="mk3-card-time">{entry.timeLabel}</div>}
    {!!entry.cadenceBadges?.length && (
      <div className="mk3-day-badge-row">
        {entry.cadenceBadges.map((badge) => (
          <span key={`${entry.key}_${badge}`} className="mk3-day-badge">{badge}</span>
        ))}
      </div>
    )}
    {entry.detailLine && <div className="mk3-card-subtitle">{entry.detailLine}</div>}
    {!!entry.hostName && <div className="mk3-card-subtitle">Host: {entry.hostName}</div>}
    {entry.isOfficialBeauRocksRoom && <div className="mk3-chip">Official BeauRocks Room</div>}
    {entry.virtualOnly && <div className="mk3-chip">Virtual</div>}
    <div className="mk3-actions-inline">
      <button
        type="button"
        onClick={() => onFocus?.(entry)}
        disabled={!entry.location || !mapsLoaded}
      >
        {isMobileViewport ? "Focus on map" : "Focus marker"}
      </button>
      <button type="button" onClick={() => onOpenDetails?.(entry)}>
        Open details
      </button>
      {!!entry.hostUid && (
        <button type="button" onClick={() => onOpenHost?.(entry)}>
          Host profile
        </button>
      )}
      {entry.listingType === "room_session" && !!entry.roomCode && (
        <button type="button" onClick={() => onJoinRoom?.(entry)}>
          Join room
        </button>
      )}
    </div>
    <InlineConversionActions
      entry={entry}
      session={session}
      navigate={navigate}
      authFlow={authFlow}
    />
  </article>
);

export default DiscoverListingCard;
