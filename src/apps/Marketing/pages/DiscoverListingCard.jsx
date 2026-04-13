import React from "react";
import {
  MARKETING_BRAND_BADGE_URL,
  getBeauRocksBadgeLabel,
  getInitials,
  isBeauRocksPoweredListing,
} from "./shared";
import { deriveDirectoryExperience } from "../lib/directoryExperience";

const cleanText = (value = "") => String(value || "").trim();

const summarizeText = (value = "", maxLength = 110) => {
  const text = cleanText(value).replace(/\s+/g, " ");
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
};

const uniqueTexts = (values = []) => {
  const seen = new Set();
  return values.filter((value) => {
    const token = cleanText(value);
    if (!token) return false;
    const normalized = token.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const splitDetailTokens = (value = "") =>
  cleanText(value)
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean);

const DiscoverListingCard = ({
  entry,
  detailsHref = "#",
  isSelected = false,
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
  const isRoomSession = entry?.listingType === "room_session";
  const isJoinableRoomSession = isRoomSession && !!cleanText(entry?.roomCode);
  const roomSupportBadge = entry?.roomSupportBadge || null;
  const highlightBadges = Array.from(new Set([
    ...(Array.isArray(experience?.capabilityBadges) ? experience.capabilityBadges : []),
    ...(Array.isArray(experience?.funBadges) ? experience.funBadges : []),
    ...(Array.isArray(entry?.cadenceBadges) ? entry.cadenceBadges : []),
    ...(entry?.virtualOnly ? ["Virtual"] : []),
  ])).filter(Boolean).slice(0, 1);
  const roomCode = cleanText(entry?.roomCode);
  const subtitle = cleanText(entry?.subtitle);
  const hostName = cleanText(entry?.hostName);
  const timeLabel = cleanText(entry?.timeLabel);
  const distanceLabel = cleanText(entry?.distanceLabel);
  const storyLine = summarizeText(experience?.storyLine, 96);
  const detailTokens = splitDetailTokens(entry?.detailLine).filter((token) => {
    const normalized = token.toLowerCase();
    if (roomCode && normalized === roomCode.toLowerCase()) return false;
    if (hostName && normalized === hostName.toLowerCase()) return false;
    if (subtitle && normalized === subtitle.toLowerCase()) return false;
    return true;
  });
  const detailLine = summarizeText(detailTokens.join(" | "), 92);
  const metaLine = uniqueTexts([timeLabel, distanceLabel]).join(" | ");
  const supportLine = (() => {
    if (isRoomSession) {
      return summarizeText(uniqueTexts([
        hostName ? `Hosted by ${hostName}` : "",
        detailLine,
      ]).join(" | "), 92) || storyLine;
    }
    if (entry?.listingType === "venue") return storyLine || detailLine;
    return detailLine || storyLine;
  })();
  const cardClasses = [
    "mk3-discover-card",
    isRoomSession ? "is-room-session" : "",
    isSelected ? "is-selected" : "",
    isOfficialBeauRocks ? "is-elevated" : "",
    !isOfficialBeauRocks && isBeauRocksPowered ? "is-powered" : "",
  ].filter(Boolean).join(" ");
  const primaryAction = (() => {
    if (isJoinableRoomSession) {
      return {
        label: "Join room",
        onClick: () => onJoinRoom?.(entry),
        disabled: false,
      };
    }
    if (String(entry?.sourceType || "").trim().toLowerCase() === "official_registry") {
      return {
        label: "Show on map",
        onClick: () => onFocus?.(entry),
        disabled: !entry.location || !mapsLoaded,
      };
    }
    if (typeof onOpenDetails === "function") {
      const detailLabel = entry?.routePage === "event"
        ? "View event"
        : entry?.routePage === "venue"
          ? "View venue"
          : "View details";
      return {
        label: detailLabel,
        onClick: () => onOpenDetails?.(entry),
        disabled: false,
      };
    }
    return {
      label: "Show on map",
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
            {roomSupportBadge && (
              <div className="mk3-chip mk3-chip-powered">
                <i className={`fa-solid ${roomSupportBadge.icon || "fa-hand-holding-dollar"}`} aria-hidden="true"></i>
                <span>{roomSupportBadge.label}</span>
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
        {isRoomSession && (
          <div className="mk3-discover-room-kicker">
            <span>{isJoinableRoomSession ? "Live room" : "Room session"}</span>
            {roomCode && <strong>{roomCode}</strong>}
          </div>
        )}
        <h3>{entry.title}</h3>
        {subtitle && <div className="mk3-card-subtitle">{subtitle}</div>}
        {metaLine && <div className="mk3-discover-meta-row">{metaLine}</div>}
        {supportLine && <div className="mk3-discover-support">{supportLine}</div>}
        {!!highlightBadges.length && (
          <div className="mk3-day-badge-row">
            {highlightBadges.map((badge) => (
              <span key={`${entry.key}_${badge}`} className="mk3-day-badge">{badge}</span>
            ))}
          </div>
        )}
        <div className="mk3-actions-inline">
          {entry?.routePage === "session" ? (
            <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
              {primaryAction.label}
            </button>
          ) : (
            <a
              href={detailsHref}
              onClick={(event) => {
                event.preventDefault();
                if (!primaryAction.disabled) primaryAction.onClick?.();
              }}
              aria-disabled={primaryAction.disabled ? "true" : "false"}
              className={primaryAction.disabled ? "is-disabled" : ""}
            >
              {primaryAction.label}
            </a>
          )}
        </div>
      </div>
    </article>
  );
};

export default DiscoverListingCard;
