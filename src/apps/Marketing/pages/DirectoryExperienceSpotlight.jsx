import React from "react";
import { deriveDirectoryExperience } from "../lib/directoryExperience";

const renderBadgeGroup = (items = [], tone = "fun") => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className={`mk3-experience-pill-row is-${tone}`}>
      {items.map((item) => (
        <span key={`${tone}-${item}`} className={`mk3-experience-pill is-${tone}`}>{item}</span>
      ))}
    </div>
  );
};

const DirectoryExperienceSpotlight = ({
  entry = null,
  title = "Night Personality",
  eyebrow = "karaoke vibe",
  actionLabel = "",
  onAction = null,
  showUpgradePrompt = true,
}) => {
  if (!entry || typeof entry !== "object") return null;
  const experience = deriveDirectoryExperience(entry);
  return (
    <section className="mk3-detail-card mk3-experience-spotlight">
      <div className="mk3-chip">{eyebrow}</div>
      <h3>{title}</h3>
      <p className="mk3-experience-story">{experience.storyLine}</p>
      {renderBadgeGroup(experience.capabilityBadges.slice(0, 4), "modern")}
      {renderBadgeGroup(experience.funBadges.slice(0, 4), "fun")}
      {renderBadgeGroup(experience.trustBadges.slice(0, 3), "trust")}
      {!!experience.bestForBadges.length && (
        <div className="mk3-experience-best-for">
          <strong>Best for</strong>
          <div className="mk3-experience-pill-row is-best-for">
            {experience.bestForBadges.slice(0, 4).map((item) => (
              <span key={`best-for-${item}`} className="mk3-experience-pill is-best-for">{item}</span>
            ))}
          </div>
        </div>
      )}
      {!!experience.whyThisNightWorks.length && (
        <div className="mk3-experience-notes">
          {experience.whyThisNightWorks.slice(0, 3).map((item) => (
            <div key={item} className="mk3-experience-note">{item}</div>
          ))}
        </div>
      )}
      {showUpgradePrompt && !experience.isBeauRocksPowered && (
        <div className="mk3-experience-upgrade-callout">
          <strong>Modernize this karaoke night</strong>
          <span>{experience.upgradePitch}</span>
          {typeof onAction === "function" && actionLabel ? (
            <button type="button" onClick={onAction}>{actionLabel}</button>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default DirectoryExperienceSpotlight;
