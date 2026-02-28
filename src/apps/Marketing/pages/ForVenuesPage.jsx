import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const ForVenuesPage = ({ navigate, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  return (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for venues</div>
      <h2>Turn your venue into the room everyone wants in.</h2>
      <p>Claim your venue, publish your recurring cadence, and become the trusted home base for premium karaoke nights.</p>
      <div className="mk3-actions-inline">
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "venue_owner", cta: "start_hosting" });
            navigate("for_hosts");
          }}
        >
          Start Hosting
        </button>
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "venue_owner", cta: "watch_demo" });
            navigate("demo");
          }}
        >
          Watch Demo
        </button>
        {canSubmit ? (
          <button
            type="button"
            onClick={() => {
              trackEvent("mk_persona_cta_click", { persona: "venue_owner", cta: "submit_venue_profile" });
              navigate("submit");
            }}
          >
            Claim Your Venue
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
            Claim Your Venue
          </button>
        )}
      </div>
    </article>
    <aside className="mk3-actions-card">
      <h4>Venue Prestige Path</h4>
      <ul className="mk3-plain-list">
        <li>Claim ownership for direct publishing authority.</li>
        <li>Keep schedule updates clean and reliable.</li>
        <li>Track follows, RSVPs, and check-ins from each listing.</li>
      </ul>
    </aside>
  </section>
  );
};

export default ForVenuesPage;

