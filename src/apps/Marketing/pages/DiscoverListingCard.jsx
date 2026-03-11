import React from "react";
import {
  MARKETING_BRAND_BADGE_URL,
  getBeauRocksBadgeLabel,
  getInitials,
  isBeauRocksPoweredListing,
} from "./shared";
import { deriveDirectoryExperience } from "../lib/directoryExperience";

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
  const experience = entry?.experience || deriveDirectoryExperience(entry);
  const isBeauRocksPowered = isBeauRocksPoweredListing(entry) || !!experience?.isBeauRocksPowered;
  const isOfficialBeauRocks = !!entry?.isOfficialBeauRocksListing || !!entry?.isOfficialBeauRocksRoom || !!entry?.isBeauRocksElevated;
  const beauRocksBadgeLabel = getBeauRocksBadgeLabel(entry, { defaultLabel: "BeauRocks-powered" });
  const badgeImageUrl = entry?.officialBadgeImageUrl || MARKETING_BRAND_BADGE_URL;
  const cardClasses = [
    "mk3-discover-card",
    isSelected ? "is-selected" : "",
    isOfficialBeauRocks ? "is-elevated" : "",
    !isOfficialBeauRocks && isBeauRocksPowered ? "is-powered" : "",
  ].filter(Boolean).join(" ");
  const primaryAction = (() => {
    if (entry.listingType === "room_session" && entry.roomCode) {
      return {
        label: "Join room",
        onClick: () => onJoinRoom?.(entry),
        disabled: false,
      };
    }
    if (String(entry?.sourceType || "").trim().toLowerCase() === "official_registry") {
      return {
        label: isMobileViewport ? "Show on map" : "Focus feature",
        onClick: () => onFocus?.(entry),
        disabled: !entry.location || !mapsLoaded,
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
          {isBeauRocksPowered && (
            <div className={`mk3-chip ${isOfficialBeauRocks ? "mk3-chip-elevated" : "mk3-chip-powered"}`}>
              {badgeImageUrl && (
                <img
                  className="mk3-chip-icon"
                  src={badgeImageUrl}
                  alt="BeauRocks badge"
                  loading="lazy"
                />
              )}
              <span>{beauRocksBadgeLabel}</span>
            </div>
          )}
        </div>
        <div className="mk3-discover-avatar" aria-hidden="true">
          {entry.avatarUrl
            ? <img src={entry.avatarUrl} alt={`${entry.avatarLabel} avatar`} loading="lazy" />
            : <span>{getInitials(entry.avatarLabel || entry.title)}</span>}
        </div>
      </div>
    </div>
    <div className="mk3-discover-body">
      <h3>{entry.title}</h3>
      <div className="mk3-card-subtitle">{entry.subtitle}</div>
      {!!entry.distanceLabel && <div className="mk3-card-subtitle">{entry.distanceLabel}</div>}
      {entry.timeLabel && <div className="mk3-card-time">{entry.timeLabel}</div>}
      {entry.officialBeauRocksStatusLabel && (
        <div className="mk3-card-subtitle">Status: {entry.officialBeauRocksStatusLabel}</div>
      )}
      {experience.storyLine && <div className="mk3-card-story">{experience.storyLine}</div>}
      {!!experience.capabilityBadges?.length && (
        <div className="mk3-experience-pill-row is-modern">
          {experience.capabilityBadges.slice(0, 3).map((badge) => (
            <span key={`${entry.key}_${badge}`} className="mk3-experience-pill is-modern">{badge}</span>
          ))}
        </div>
      )}
      {!!experience.funBadges?.length && (
        <div className="mk3-experience-pill-row is-fun">
          {experience.funBadges.slice(0, 3).map((badge) => (
            <span key={`${entry.key}_fun_${badge}`} className="mk3-experience-pill is-fun">{badge}</span>
          ))}
        </div>
      )}
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
      {!isBeauRocksPowered && (
        <div className="mk3-card-upgrade-note">Static listing. Claim it to add live join, audience play, and recap proof.</div>
      )}
      <div className="mk3-actions-inline">
        <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
          {primaryAction.label}
        </button>
      </div>
    </div>
  </article>
  );
};

export default DiscoverListingCard;
