import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const ForVenuesPage = ({ navigate, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  return (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for venues</div>
      <h2>Turn karaoke night into a real repeat crowd.</h2>
      <p>Claim your venue, publish your cadence, and make it easy for regulars to find you again next week.</p>
      <div className="mk3-actions-inline">
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "venue_owner", cta: "find_venue" });
            navigate("discover");
          }}
        >
          Find Your Venue
        </button>
        {canSubmit ? (
          <button
            type="button"
            onClick={() => {
              trackEvent("mk_persona_cta_click", { persona: "venue_owner", cta: "submit_venue" });
              navigate("submit");
            }}
          >
            Submit New Venue
          </button>
        ) : (
          <button
            type="button"
            onClick={() => authFlow?.requireFullAuth?.({
              intent: "listing_submit",
              targetType: "venue",
              targetId: "",
              returnRoute: { page: "submit", params: { intent: "listing_submit", targetType: "venue" } },
            })}
          >
            Create Account To Submit
          </button>
        )}
      </div>
    </article>
    <aside className="mk3-actions-card">
      <h4>Venue Path</h4>
      <ul className="mk3-plain-list">
        <li>Claim ownership for direct publishing.</li>
        <li>Set recurring cadence and keep schedule updates current.</li>
        <li>Track follows, RSVPs, and check-ins by listing.</li>
      </ul>
    </aside>
  </section>
  );
};

export default ForVenuesPage;

