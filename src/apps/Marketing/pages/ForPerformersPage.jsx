import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const ForPerformersPage = ({ navigate, session, authFlow }) => {
  const canUseDashboard = !!session?.uid && !session?.isAnonymous;
  return (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for performers</div>
      <h2>Find high-energy rooms and build your legend.</h2>
      <p>Follow standout hosts, RSVP fast, and track your karaoke story in one place without the spreadsheet chaos.</p>
      <div className="mk3-actions-inline">
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "performer", cta: "start_hosting" });
            navigate("for_hosts");
          }}
        >
          Start Hosting
        </button>
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "performer", cta: "watch_demo" });
            navigate("demo");
          }}
        >
          Watch Demo
        </button>
        {canUseDashboard ? (
          <button
            type="button"
            onClick={() => {
              trackEvent("mk_persona_cta_click", { persona: "performer", cta: "find_events" });
              navigate("discover");
            }}
          >
            Find Spotlight Nights
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
            Find Spotlight Nights
          </button>
        )}
      </div>
    </article>
    <aside className="mk3-actions-card">
      <h4>Performer Spotlight Path</h4>
      <ul className="mk3-plain-list">
        <li>Discover rooms by city, timing, and host energy.</li>
        <li>Use RSVP and reminders to stay consistent.</li>
        <li>Track recent songs plus your top venues and hosts.</li>
      </ul>
    </aside>
  </section>
  );
};

export default ForPerformersPage;

