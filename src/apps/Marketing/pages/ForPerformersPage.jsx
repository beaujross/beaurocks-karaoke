import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { PersonaPageFrame, PersonaSurfaceMock } from "./PersonaMarketingBlocks";

const PERFORMER_SIGNALS = [
  {
    label: "Find a night",
    title: "Know before you go",
    copy: "Check the venue, time, and host.",
  },
  {
    label: "Join the room",
    title: "Add your song",
    copy: "Scan the code, choose your emoji, and get in the queue.",
  },
  {
    label: "Make the chart",
    title: "Keep your scores",
    copy: "Sign in before you sing to save eligible results to your profile.",
  },
];

const ForPerformersPage = ({ navigate }) => {
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "performer",
      page: "for_performers",
      cta: String(cta || ""),
    });
  };

  return (
    <PersonaPageFrame theme="performer">
      <article className="mk3-persona-simple-hero mk3-persona-simple-hero-center">
        <div className="mk3-persona-simple-copy is-center">
          <div className="mk3-rebuild-kicker">For singers</div>
          <h1>Find a night. Pick a song. Sing.</h1>
          <p>See what is happening nearby, then join the room from your phone when you arrive.</p>
          <div className="mk3-rebuild-action-row is-centered">
            <button
              type="button"
              className="mk3-rebuild-button is-primary"
              onClick={() => {
                trackPersonaCta("hero_discover");
                navigate("discover");
              }}
            >
              Find Karaoke
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-secondary"
              onClick={() => {
                trackPersonaCta("hero_overview");
                navigate("charts");
              }}
            >
              See the Charts
            </button>
          </div>
        </div>

        <div className="mk3-persona-simple-surface is-centered">
          <PersonaSurfaceMock
            type="radar"
            label="Karaoke near you"
            title="See what is on tonight."
            copy="Venue, time, and host details in one place."
            className="mk3-persona-simple-surface-main"
          />
        </div>
      </article>

      <section className="mk3-persona-simple-band">
        <div className="mk3-rebuild-kicker">From search to stage</div>
        <div className="mk3-persona-simple-card-grid is-three">
          {PERFORMER_SIGNALS.map((item) => (
            <article key={item.title} className="mk3-persona-simple-card">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

    </PersonaPageFrame>
  );
};

export default ForPerformersPage;
