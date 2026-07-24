import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { PersonaPageFrame, PersonaSurfaceMock } from "./PersonaMarketingBlocks";


const ForVenuesPage = ({ navigate, session, authFlow, onHostLogin }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;

  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "venue_owner",
      page: "for_venues",
      cta: String(cta || ""),
    });
  };

  const openIndependentListing = (targetType = "event", source = "hero") => {
    trackPersonaCta(source + "_" + targetType + "_" + (canSubmit ? "open" : "gate"));
    if (canSubmit) {
      navigate("submit", "", { intent: "listing_submit", targetType });
      return;
    }
    authFlow?.requireFullAuth?.({
      intent: "listing_submit",
      targetType,
      targetId: "",
      returnRoute: { page: "submit", params: { intent: "listing_submit", targetType } },
    });
  };

  return (
    <PersonaPageFrame theme="venue">
      <article className="mk3-persona-simple-hero mk3-persona-simple-hero-center">
        <div className="mk3-persona-simple-copy is-center">
          <div className="mk3-rebuild-kicker">For venues</div>
          <h1>Fill the room on karaoke night.</h1>
          <p>Publish the venue, schedule, and host so singers know where to go.</p>
          <div className="mk3-rebuild-action-row is-centered">
            <button
              type="button"
              className="mk3-rebuild-button is-primary"
              onClick={() => {
                trackPersonaCta("hero_use_beaurocks");
                onHostLogin?.();
              }}
            >
              Run It With BeauRocks
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-secondary"
              onClick={() => openIndependentListing("event", "hero")}
            >
              List a Karaoke Night
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-secondary"
              onClick={() => {
                trackPersonaCta("hero_discover");
                navigate("discover");
              }}
            >
              Browse Karaoke Nights
            </button>
          </div>
        </div>

        <div className="mk3-persona-simple-surface is-centered">
          <PersonaSurfaceMock
            type="schedule"
            label="Venue schedule"
            title="Show people when and where."
            copy="Venue. Schedule. Host."
            className="mk3-persona-simple-surface-main"
          />
        </div>
      </article>

      <section className="mk3-persona-simple-band">
        <div className="mk3-rebuild-kicker">Two ways to get on the map</div>
        <div className="mk3-persona-simple-card-grid">
          <article className="mk3-persona-simple-card">
            <span>Run with BeauRocks</span>
            <strong>Publish a public room</strong>
            <p>Add the venue and start time in Host setup. Private rooms stay private.</p>
          </article>
          <article className="mk3-persona-simple-card">
            <span>Already hosting karaoke</span>
            <strong>List an existing night</strong>
            <p>Add the venue and recurring schedule. We review it before it goes live.</p>
          </article>
        </div>
      </section>


    </PersonaPageFrame>
  );
};

export default ForVenuesPage;
