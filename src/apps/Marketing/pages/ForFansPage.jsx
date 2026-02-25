import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const ForFansPage = ({ navigate, session, authFlow }) => {
  const canUseDashboard = !!session?.uid && !session?.isAnonymous;
  return (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for fans</div>
      <h2>Karaoke has been awkward for way too long.</h2>
      <p>Find nearby nights fast, then use your phone to interact with the room instead of scrolling alone.</p>
      <div className="mk3-actions-inline">
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "fan", cta: "open_live_listings" });
            navigate("discover");
          }}
        >
          Open Live Listings
        </button>
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "fan", cta: "watch_demo" });
            navigate("demo");
          }}
        >
          Watch Demo
        </button>
        {canUseDashboard ? (
          <button
            type="button"
            onClick={() => {
              trackEvent("mk_persona_cta_click", { persona: "fan", cta: "open_dashboard" });
              navigate("profile");
            }}
          >
            Activity Dashboard
          </button>
        ) : (
          <button
            type="button"
            onClick={() => authFlow?.requireFullAuth?.({
              intent: "profile",
              targetType: "profile",
              targetId: "",
              returnRoute: { page: "profile" },
            })}
          >
            Create Account For Activity
          </button>
        )}
      </div>
    </article>
    <aside className="mk3-actions-card">
      <h4>Guest Path</h4>
      <ul className="mk3-plain-list">
        <li>Browse by host, venue, city, and timing.</li>
        <li>RSVP and reminder options reduce no-show chaos.</li>
        <li>Check in, react, and keep the room social in real time.</li>
      </ul>
    </aside>
  </section>
  );
};

export default ForFansPage;

