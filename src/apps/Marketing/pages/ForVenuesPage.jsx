import React from "react";
import { trackEvent } from "../../../lib/firebase";

const ForVenuesPage = ({ navigate }) => (
  <section className="mk3-page mk3-two-col">
    <article className="mk3-detail-card">
      <div className="mk3-chip">for venues</div>
      <h2>Drive foot traffic with recurring karaoke nights.</h2>
      <p>Claim your venue profile, publish cadence, and convert followers into in-person attendance.</p>
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
        <button
          type="button"
          onClick={() => {
            trackEvent("mk_persona_cta_click", { persona: "venue_owner", cta: "submit_venue" });
            navigate("submit");
          }}
        >
          Submit New Venue
        </button>
      </div>
    </article>
    <aside className="mk3-actions-card">
      <h4>Venue Path</h4>
      <ul className="mk3-plain-list">
        <li>Claim ownership for direct publish privileges.</li>
        <li>Set recurring cadence and publish schedule updates.</li>
        <li>Monitor follows, RSVPs, and check-ins by listing.</li>
      </ul>
    </aside>
  </section>
);

export default ForVenuesPage;
