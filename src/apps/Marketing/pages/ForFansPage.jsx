import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const ForFansPage = ({ navigate, session, authFlow }) => {
  const canUseDashboard = !!session?.uid && !session?.isAnonymous;
  return (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for fans</div>
      <h2>Find the rooms everyone will be talking about tomorrow.</h2>
      <p>Skip random karaoke roulette. Find premium nights fast, then use your phone to join the energy instead of watching from the edge.</p>
      <div className="mk3-actions-inline">
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "fan", cta: "open_live_listings" });
            navigate("discover");
          }}
        >
          Find Premium Nights
        </button>
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "fan", cta: "watch_demo" });
            navigate("demo");
          }}
        >
          Watch Experience Demo
        </button>
        {canUseDashboard ? (
          <button
            type="button"
            onClick={() => {
              trackEvent("mk_persona_cta_click", { persona: "fan", cta: "open_dashboard" });
              navigate("profile");
            }}
          >
            Open Guest Dashboard
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
            Create Account For Guest Pass
          </button>
        )}
      </div>
    </article>
    <aside className="mk3-actions-card">
      <h4>Guest Prestige Path</h4>
      <ul className="mk3-plain-list">
        <li>Browse by host reputation, venue quality, city, and timing.</li>
        <li>RSVP and reminder flow gets you into the right room early.</li>
        <li>Check in, react, and help shape the night in real time.</li>
      </ul>
    </aside>
  </section>
  );
};

export default ForFansPage;

