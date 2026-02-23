import React from "react";
import { trackEvent } from "../../../lib/firebase";

const ForFansPage = ({ navigate }) => (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for fans</div>
      <h2>Browse nearby karaoke and lock in your next night out.</h2>
      <p>Discover public events, follow favorites, and get reminders before start time.</p>
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
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "fan", cta: "open_dashboard" });
            navigate("profile");
          }}
        >
          Activity Dashboard
        </button>
      </div>
    </article>
    <aside className="mk3-actions-card">
      <h4>Fan Path</h4>
      <ul className="mk3-plain-list">
        <li>Follow venues and hosts to build your feed.</li>
        <li>RSVP to events and enroll in reminders.</li>
        <li>Check in and leave karaoke-first reviews after attendance.</li>
      </ul>
    </aside>
  </section>
);

export default ForFansPage;
