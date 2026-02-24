import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const ForPerformersPage = ({ navigate, session, authFlow }) => {
  const canUseDashboard = !!session?.uid && !session?.isAnonymous;
  return (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for performers</div>
      <h2>Find better nights, sing more, track the fun.</h2>
      <p>Follow hosts, RSVP fast, and keep your performance history in one place without spreadsheet energy.</p>
      <div className="mk3-actions-inline">
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "performer", cta: "find_events" });
            navigate("discover");
          }}
        >
          Find Nights
        </button>
        {canUseDashboard ? (
          <button
            type="button"
            onClick={() => {
              trackEvent("mk_persona_cta_click", { persona: "performer", cta: "open_dashboard" });
              navigate("profile");
            }}
          >
            Open Dashboard
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
            Create Account To Track History
          </button>
        )}
      </div>
    </article>
    <aside className="mk3-actions-card">
      <h4>Performer Path</h4>
      <ul className="mk3-plain-list">
        <li>Discover by city, timing, and vibe.</li>
        <li>RSVP and reminder flow for upcoming sessions.</li>
        <li>See recent songs plus your top venues and hosts.</li>
      </ul>
    </aside>
  </section>
  );
};

export default ForPerformersPage;

