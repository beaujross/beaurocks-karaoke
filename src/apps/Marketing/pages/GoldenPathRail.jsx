import React from "react";
import { trackEvent } from "../../../lib/firebase";
import { MARKETING_ROUTE_PAGES } from "../routing";

const GoldenPathRail = ({ navigate }) => (
  <aside className="mk3-golden-rail" aria-label="Golden path entry points">
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "host", cta: "rail_for_hosts" });
        navigate(MARKETING_ROUTE_PAGES.forHosts);
      }}
    >
      Host
    </button>
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "venue_owner", cta: "rail_for_venues" });
        navigate(MARKETING_ROUTE_PAGES.forVenues);
      }}
    >
      Venue Owner
    </button>
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "performer", cta: "rail_for_performers" });
        navigate(MARKETING_ROUTE_PAGES.forPerformers);
      }}
    >
      Performer
    </button>
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "fan", cta: "rail_for_fans" });
        navigate(MARKETING_ROUTE_PAGES.forFans);
      }}
    >
      Fan
    </button>
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "host", cta: "rail_join_room_code" });
        navigate(MARKETING_ROUTE_PAGES.join);
      }}
    >
      Join by Code
    </button>
  </aside>
);

export default GoldenPathRail;

