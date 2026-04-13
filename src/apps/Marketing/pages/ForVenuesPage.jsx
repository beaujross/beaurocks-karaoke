import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { PersonaPageFrame, PersonaSurfaceMock } from "./PersonaMarketingBlocks";

const VENUE_SIGNAL_CARDS = [
  {
    label: "Ownership",
    title: "Claim your listing",
    copy: "Update the venue page and the basic details.",
  },
  {
    label: "Schedule",
    title: "Post the real schedule",
    copy: "People should know when karaoke is actually happening.",
  },
  {
    label: "Trust",
    title: "Make the listing trustworthy",
    copy: "The host, venue, and schedule should match at a glance.",
  },
];

const ForVenuesPage = ({ navigate, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;

  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "venue_owner",
      page: "for_venues",
      cta: String(cta || ""),
    });
  };

  const openClaimFlow = () => {
    trackPersonaCta(canSubmit ? "hero_claim" : "hero_claim_gate");
    if (canSubmit) {
      navigate("submit");
      return;
    }
    authFlow?.requireFullAuth?.({
      intent: "listing_submit",
      targetType: "venue",
      targetId: "",
      returnRoute: { page: "submit", params: { intent: "listing_submit", targetType: "venue" } },
    });
  };

  return (
    <PersonaPageFrame theme="venue">
      <article className="mk3-persona-simple-hero mk3-persona-simple-hero-center">
        <div className="mk3-persona-simple-copy is-center">
          <div className="mk3-rebuild-kicker">For venues</div>
          <h1>Make karaoke night easy to find and easy to trust.</h1>
          <p>Claim the venue, post the schedule, and keep the listing current.</p>
          <div className="mk3-rebuild-action-row is-centered">
            <button type="button" className="mk3-rebuild-button is-primary" onClick={openClaimFlow}>
              Claim Your Venue
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
            title="The listing should tell people what the night is."
            copy="Clear details beat vague hype."
            className="mk3-persona-simple-surface-main"
          />
        </div>
      </article>

      <section className="mk3-persona-simple-band">
        <div className="mk3-rebuild-kicker">What good listings do</div>
        <div className="mk3-persona-simple-card-grid is-three">
          {VENUE_SIGNAL_CARDS.map((item) => (
            <article key={item.title} className="mk3-persona-simple-card">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-persona-simple-band mk3-persona-simple-band-tight">
        <div className="mk3-rebuild-kicker">Next step</div>
        <div className="mk3-persona-simple-cta-row">
          <button type="button" className="mk3-rebuild-button is-primary" onClick={openClaimFlow}>
            Claim Your Venue
          </button>
          <button
            type="button"
            className="mk3-rebuild-button is-secondary"
            onClick={() => {
              trackPersonaCta("closing_overview");
              navigate("for_fans");
            }}
          >
            Open Overview
          </button>
        </div>
      </section>
    </PersonaPageFrame>
  );
};

export default ForVenuesPage;
