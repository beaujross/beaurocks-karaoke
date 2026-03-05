import React from "react";
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
  onJoinRoom = null,
}) => {
  const cardClasses = [
    "mk3-discover-card",
    isSelected ? "is-selected" : "",
    entry?.isOfficialBeauRocksRoom ? "is-elevated" : "",
  ].filter(Boolean).join(" ");
  const primaryAction = (() => {
    if (entry.listingType === "room_session" && entry.roomCode) {
      return {
        label: "Join room",
        onClick: () => onJoinRoom?.(entry),
        disabled: false,
      };
    }
    if (typeof onOpenDetails === "function") {
      return {
        label: "Open details",
        onClick: () => onOpenDetails?.(entry),
        disabled: false,
      };
    }
    return {
      label: isMobileViewport ? "Focus on map" : "Focus marker",
      onClick: () => onFocus?.(entry),
      disabled: !entry.location || !mapsLoaded,
    };
  })();
  return (
  <article
    key={entry.key}
    ref={(node) => registerCardRef?.(entry.key, node)}
    className={cardClasses}
  >
    <div className="mk3-discover-media">
      <img
        src={entry.imageUrl}
        alt={`${entry.title} venue visual`}
        loading="lazy"
        onError={(event) => onImageError?.(event, entry.imageFallbackUrls)}
      />
      <div className="mk3-discover-media-top">
        <div className="mk3-discover-chip-row">
          <div className="mk3-chip">{entry.typeLabel}</div>
          {entry.isOfficialBeauRocksRoom && <div className="mk3-chip mk3-chip-elevated">Official BeauRocks Room</div>}
        </div>
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
    {entry.hasBeauRocksHostAccount && (
      <div className="mk3-card-subtitle">
        BeauRocks host account{entry.beauRocksHostTier ? ` (${entry.beauRocksHostTier})` : ""}
      </div>
    )}
    {(entry.hostLeaderboardRank > 0
      || entry.venueLeaderboardRank > 0
      || (entry.venueAverageRating > 0 && entry.venueReviewCount > 0)
      || entry.venueCheckinCount > 0) && (
      <div className="mk3-leaderboard-row">
        {entry.hostLeaderboardRank > 0 && (
          <span className="mk3-leaderboard-pill">Host #{entry.hostLeaderboardRank}</span>
        )}
        {entry.venueLeaderboardRank > 0 && (
          <span className="mk3-leaderboard-pill">Venue #{entry.venueLeaderboardRank}</span>
        )}
        {entry.venueAverageRating > 0 && entry.venueReviewCount > 0 && (
          <span className="mk3-leaderboard-pill">
            {entry.venueAverageRating.toFixed(1)} stars ({entry.venueReviewCount})
          </span>
        )}
        {entry.venueCheckinCount > 0 && (
          <span className="mk3-leaderboard-pill">{entry.venueCheckinCount} check-ins</span>
        )}
      </div>
    )}
    {entry.virtualOnly && <div className="mk3-chip">Virtual</div>}
    <div className="mk3-actions-inline">
      <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
        {primaryAction.label}
      </button>
    </div>
  </article>
  );
};

export default DiscoverListingCard;
