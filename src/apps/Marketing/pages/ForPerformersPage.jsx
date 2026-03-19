import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { PersonaPageFrame, PersonaSurfaceMock } from "./PersonaMarketingBlocks";

const PERFORMER_SIGNALS = [
  {
    label: "Discovery",
    title: "See which rooms are worth trying",
    copy: "Host, schedule, and room fit should be obvious.",
  },
  {
    label: "Planning",
    title: "Build a weekly rotation",
    copy: "Good rooms should be easy to come back to.",
  },
  {
    label: "Join flow",
    title: "Get in fast once you arrive",
    copy: "Phone join should feel quick and current.",
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
          <div className="mk3-rebuild-kicker">For performers</div>
          <h1>Find karaoke nights worth making part of your week.</h1>
          <p>Skip the guesswork. Find rooms with a real crowd and a clear schedule.</p>
          <div className="mk3-rebuild-action-row is-centered">
            <button
              type="button"
              className="mk3-rebuild-button is-primary"
              onClick={() => {
                trackPersonaCta("hero_discover");
                navigate("discover");
              }}
            >
              Open Discover Map
            </button>
            <button
              type="button"
              className="mk3-rebuild-button is-secondary"
              onClick={() => {
                trackPersonaCta("hero_demo_auto");
                navigate("demo_auto");
              }}
            >
              Open Demo
            </button>
          </div>
        </div>

        <div className="mk3-persona-simple-surface is-centered">
          <PersonaSurfaceMock
            type="radar"
            label="Live radar"
            title="Start with discovery that feels current."
            copy="A better room should be easier to find."
            className="mk3-persona-simple-surface-main"
          />
        </div>
      </article>

      <section className="mk3-persona-simple-band">
        <div className="mk3-rebuild-kicker">What matters</div>
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

      <section className="mk3-persona-simple-band mk3-persona-simple-band-tight">
        <div className="mk3-rebuild-kicker">Next step</div>
        <div className="mk3-persona-simple-cta-row">
          <button
            type="button"
            className="mk3-rebuild-button is-primary"
            onClick={() => {
              trackPersonaCta("closing_discover");
              navigate("discover");
            }}
          >
            Open Discover
          </button>
          <button
            type="button"
            className="mk3-rebuild-button is-secondary"
            onClick={() => {
              trackPersonaCta("closing_for_fans");
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

export default ForPerformersPage;
