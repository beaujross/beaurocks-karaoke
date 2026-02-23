import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const ForPerformersPage = ({ navigate, session, authFlow }) => {
  const canUseDashboard = !!session?.uid && !session?.isAnonymous;
  return (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for performers</div>
      <h2>Find nights worth singing and track your history.</h2>
      <p>Follow hosts, RSVP to events, and keep your performance record in one profile.</p>
      <div className="mk3-actions-inline">
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "performer", cta: "find_events" });
            navigate("discover");
          }}
        >
          Find Events
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
        <li>Discover by city, date window, and vibe.</li>
        <li>RSVP and reminder flow for upcoming sessions.</li>
        <li>View recent songs and top venues/hosts by count.</li>
      </ul>
    </aside>
  </section>
  );
};

export default ForPerformersPage;

