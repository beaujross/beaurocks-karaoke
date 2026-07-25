import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import "./directoryOwnerPathway.css";

const DirectoryOwnerPathway = ({
  navigate,
  source = "public_directory",
  compact = false,
  venue = null,
}) => {
  const venueId = String(venue?.id || "").trim();
  const venueName = String(venue?.title || venue?.venueName || "").trim();
  const open = (page, params = {}) => {
    trackEvent("mk_directory_owner_path_opened", {
      source,
      destination: page,
      targetType: String(params.targetType || ""),
      venueId,
    });
    navigate?.(page, "", params);
  };

  const eventParams = {
    intent: "listing_submit",
    targetType: "event",
    venueId,
    venueName,
    city: String(venue?.city || ""),
    state: String(venue?.state || ""),
    address1: String(venue?.address1 || ""),
    timezone: String(venue?.timezone || ""),
  };

  return (
    <section
      className={`mk3-directory-owner-path ${compact ? "is-compact" : ""}`}
      data-feature-id="directory-owner-golden-path"
    >
      <div className="mk3-directory-owner-copy">
        <span>Run karaoke?</span>
        <h2>{venueName ? `Put a night at ${venueName} on the map.` : "List it. Keep it current. Run it your way."}</h2>
        <p>
          {compact
            ? "Publish the schedule, manage changes, or run the room with BeauRocks."
            : "List an existing venue or karaoke night for free. When you want the queue, TV, and guest phones working together, run it with BeauRocks."}
        </p>
      </div>
      <div className="mk3-directory-owner-actions">
        <button
          type="button"
          className="is-primary"
          data-feature-id="directory-owner-list-night"
          onClick={() => open("submit", eventParams)}
        >
          {venueName ? "Add a Night Here" : "List a Karaoke Night"}
        </button>
        {!venueName && !compact && (
          <button
            type="button"
            data-feature-id="directory-owner-add-venue"
            onClick={() => open("submit", { intent: "listing_submit", targetType: "venue" })}
          >
            Add a Venue
          </button>
        )}
        <button
          type="button"
          data-feature-id="directory-owner-manage"
          onClick={() => open("profile", { intent: "manage_listings" })}
        >
          Manage My Listings
        </button>
        <button
          type="button"
          className="is-brand"
          data-feature-id="directory-owner-run-beaurocks"
          onClick={() => open("for_hosts", { intent: "host_apply" })}
        >
          Run It With BeauRocks
        </button>
      </div>
    </section>
  );
};

export default DirectoryOwnerPathway;
