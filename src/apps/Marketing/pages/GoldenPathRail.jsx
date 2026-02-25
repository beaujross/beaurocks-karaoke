import React from "react";
import { trackEvent, trackGoldenPathEntry } from "../lib/marketingAnalytics";
import { MARKETING_ROUTE_PAGES } from "../routing";

const GoldenPathRail = ({ navigate, muted = false }) => (
  <aside className={`mk3-golden-rail${muted ? " is-muted" : ""}`} aria-label="Golden path entry points">
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "host", cta: "rail_for_hosts" });
        trackGoldenPathEntry({ pathId: "host_entry", workstream: "host_growth", source: "golden_rail" });
        navigate(MARKETING_ROUTE_PAGES.forHosts);
      }}
    >
      Host Crown
    </button>
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "venue_owner", cta: "rail_for_venues" });
        trackGoldenPathEntry({ pathId: "venue_entry", workstream: "venue_growth", source: "golden_rail" });
        navigate(MARKETING_ROUTE_PAGES.forVenues);
      }}
    >
      Venue Prestige
    </button>
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "performer", cta: "rail_for_performers" });
        trackGoldenPathEntry({ pathId: "performer_entry", workstream: "performer_growth", source: "golden_rail" });
        navigate(MARKETING_ROUTE_PAGES.forPerformers);
      }}
    >
      Performer Spotlight
    </button>
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "fan", cta: "rail_for_fans" });
        trackGoldenPathEntry({ pathId: "fan_entry", workstream: "fan_growth", source: "golden_rail" });
        navigate(MARKETING_ROUTE_PAGES.forFans);
      }}
    >
      Guest Pass
    </button>
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "all", cta: "rail_try_demo" });
        trackGoldenPathEntry({ pathId: "demo_entry", workstream: "demo", source: "golden_rail" });
        navigate(MARKETING_ROUTE_PAGES.demo);
      }}
    >
      Live Demo
    </button>
    <button
      type="button"
      onClick={() => {
        trackEvent("mk_persona_cta_click", { persona: "host", cta: "rail_join_room_code" });
        trackGoldenPathEntry({ pathId: "host_join_entry", workstream: "host_growth", source: "golden_rail" });
        navigate(MARKETING_ROUTE_PAGES.join);
      }}
    >
      Invite Code
    </button>
  </aside>
);

export default GoldenPathRail;

