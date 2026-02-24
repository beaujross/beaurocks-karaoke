import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const ForFansPage = ({ navigate, session, authFlow }) => {
  const canUseDashboard = !!session?.uid && !session?.isAnonymous;
  return (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for fans</div>
      <h2>Find karaoke near you without the chaos.</h2>
      <p>Discover nearby nights, follow your favorite hosts, and get reminders before doors open.</p>
      <div className="mk3-actions-inline">
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "fan", cta: "start_discovering" });
            navigate("discover");
          }}
        >
          Start Discovering
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
      <h4>Fan Path</h4>
      <ul className="mk3-plain-list">
        <li>Follow venues and hosts to build your feed.</li>
        <li>RSVP to events and enroll in reminders.</li>
        <li>Check in and leave post-night reviews after attendance.</li>
      </ul>
    </aside>
  </section>
  );
};

export default ForFansPage;

