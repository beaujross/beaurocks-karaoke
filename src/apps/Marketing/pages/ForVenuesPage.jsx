import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import {
  PersonaClosingSection,
  PersonaFeatureSection,
  PersonaFlowSection,
  PersonaHeroScaffold,
  PersonaOutcomeSection,
  PersonaPageFrame,
  PersonaSurfaceMock,
  PersonaSignalSection,
} from "./PersonaMarketingBlocks";

const VENUE_BADGES = [
  "Claim your listing",
  "Publish a reliable schedule",
  "Grow repeat attendance",
];

const VENUE_STORY_POINTS = [
  "The best karaoke nights become part of someone's weekly routine.",
  "Clear listings and schedules help guests trust the plan.",
  "A venue page should answer the basics fast.",
  "Reliable discovery turns drop-ins into regulars.",
];

const VENUE_OUTCOME_POINTS = [
  "Verified ownership",
  "Published weekly schedule",
  "Clear host and venue details",
  "More repeat intent",
];

const VENUE_SIGNAL_CARDS = [
  {
    label: "Schedule",
    title: "Reliable nights beat random hype",
    copy: "Guests come back to nights they can count on.",
  },
  {
    label: "Trust",
    title: "A clear listing removes guesswork",
    copy: "Date, host, and venue details should all line up.",
  },
  {
    label: "Demand",
    title: "Repeat guests start with a clear plan",
    copy: "Reliable discovery turns drop-ins into regulars.",
  },
];

const VENUE_TRUST_SIGNALS = [
  {
    label: "Attendance",
    title: "Regular nights win over random nights",
    copy: "A clear recurring schedule gives guests a reason to come back on purpose.",
  },
  {
    label: "Trust",
    title: "A venue page should answer the basics fast",
    copy: "Date, host, room style, and venue details should line up without guesswork.",
  },
  {
    label: "Room feel",
    title: "A better screen flow makes the venue feel more organized",
    copy: "The TV, host deck, and audience join flow help the room feel intentional from the start.",
  },
];

const VENUE_SURFACE_STEPS = [
  {
    step: "01",
    title: "The TV tells the room where to look",
    copy: "A public join prompt and live room state make karaoke feel easier to understand in a busy venue.",
    visualType: "tv",
    visualLabel: "Public TV",
  },
  {
    step: "02",
    title: "Guest phones lower the friction",
    copy: "People join, react, and request without crowding the host stand or asking what to do next.",
    visualType: "audience",
    visualLabel: "Audience app",
  },
  {
    step: "03",
    title: "The host keeps the venue night moving",
    copy: "Search, queue, and TV controls stay in one place so the room keeps its pace.",
    visualType: "host",
    visualLabel: "Host deck",
  },
];

const VENUE_FINAL_PATHS = [
  {
    title: "Claim your venue",
    copy: "Start the venue ownership flow if you want to manage listing details and schedule visibility.",
    cta: "Claim Your Venue",
    action: "claim",
  },
  {
    title: "Browse live nights",
    copy: "See how current venue and room listings appear publicly in discovery.",
    cta: "Open Discover",
    action: "discover",
  },
  {
    title: "Watch the product story",
    copy: "Open the demo to see how host, TV, and audience work together across the room.",
    cta: "Open Demo",
    action: "demo_auto",
  },
];

const VENUE_FLOW_STEPS = [
  {
    step: "01",
    title: "Claim the venue",
    copy: "Keep updates in the right hands.",
  },
  {
    step: "02",
    title: "Publish the schedule",
    copy: "Make the karaoke night easy to find.",
  },
  {
    step: "03",
    title: "Match the host details",
    copy: "Keep the listing, host, and venue aligned.",
  },
  {
    step: "04",
    title: "Grow repeat attendance",
    copy: "Turn discovery into return visits.",
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
    trackPersonaCta(canSubmit ? "primary_claim_venue" : "primary_claim_venue_auth_gate");
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
      <PersonaHeroScaffold
        theme="venue"
        className="mk3-venue-hero"
        railClassName="mk3-venue-hero-rail-wrap"
        proofClassName="mk3-venue-proof-strip"
        kicker="For venues"
        brandLine="Claim your venue, publish a clear schedule, and make the night easy to trust."
        title="Turn karaoke into a night guests plan around."
        subtitle="Reliable nights beat random hype. A clear listing, a better room flow, and consistent host details turn discovery into repeat attendance."
        actions={[
          {
            label: "Claim Your Venue",
            variant: "primary",
            onClick: openClaimFlow,
          },
          {
            label: "Browse Karaoke Nights",
            variant: "secondary",
            onClick: () => {
              trackPersonaCta("secondary_open_discover");
              navigate("discover");
            },
          },
        ]}
        badges={VENUE_BADGES}
        proofItems={VENUE_SIGNAL_CARDS.map((item) => ({ eyebrow: item.label, title: item.title, copy: item.copy }))}
        rightRail={(
          <div className="mk3-venue-hero-board">
            <article className="mk3-venue-hero-screen">
              <PersonaSurfaceMock
                type="tv"
                label="Venue night"
                title="Show the room code, stage prompt, and queue on one clean screen."
                copy="When the TV clearly says Stage Open and Scan to Sing, the room feels organized fast."
                className="mk3-venue-hero-mock"
              />
            </article>

            <div className="mk3-venue-hero-strip">
              <article className="mk3-venue-hero-note is-ownership">
                <span>Ownership</span>
                <strong>Claim the listing</strong>
                <p>Keep venue details and schedule updates in the right hands.</p>
              </article>
              <article className="mk3-venue-hero-card is-discovery">
                <PersonaSurfaceMock
                  type="schedule"
                  label="Schedule"
                  title="Publish a reliable weekly plan"
                  copy="Discovery should tell guests exactly when karaoke is happening and who is running it."
                />
              </article>
              <article className="mk3-venue-hero-card is-audience">
                <PersonaSurfaceMock
                  type="audience"
                  label="Audience"
                  title="Lower the friction on arrival"
                  copy="Guests join, react, and request without crowding the host stand."
                />
              </article>
              <article className="mk3-venue-hero-note is-host">
                <span>Host</span>
                <strong>Keep the pace in one deck</strong>
                <p>Search, queue, and TV controls stay together so the venue night keeps moving.</p>
              </article>
            </div>
          </div>
        )}
      />

      <PersonaSignalSection
        theme="venue"
        className="mk3-venue-signal-band"
        kicker="Why venues care"
        title="Better karaoke nights become part of a guest's routine."
        cards={VENUE_TRUST_SIGNALS}
      />

      <PersonaFeatureSection
        theme="venue"
        className="mk3-venue-feature-band"
        kicker="How the venue experience improves"
        title="The room gets easier to understand on every screen."
        steps={VENUE_SURFACE_STEPS}
      />

      <PersonaOutcomeSection
        theme="venue"
        className="mk3-venue-outcome-band"
        kicker="Venue outcomes"
        title="Each improvement removes one more source of guest confusion."
        aside={(
          <div className="mk3-rebuild-aside-copy">
            <span>Venue math</span>
            <strong>Trust compounds when the listing, host, and room all tell the same story.</strong>
            <p>Clear recurring schedules and visible room flow help guests decide to come back on purpose.</p>
          </div>
        )}
        items={VENUE_OUTCOME_POINTS.map((point, index) => ({
          label: `Outcome 0${index + 1}`,
          title: point,
          copy: VENUE_STORY_POINTS[index] || "One less question before a guest decides to show up.",
        }))}
      />

      <PersonaFlowSection
        theme="venue"
        className="mk3-venue-flow-band"
        title="How a karaoke night becomes part of someone's week"
        steps={VENUE_FLOW_STEPS}
      />

      <PersonaClosingSection
        theme="venue"
        className="mk3-venue-closing-band"
        kicker="Pick the next step"
        title="Start with venue ownership, discovery, or the product demo."
        cards={VENUE_FINAL_PATHS.map((item) => ({
          ...item,
          onClick: () => {
            trackPersonaCta(`closing_${item.action}`);
            if (item.action === "claim") {
              openClaimFlow();
              return;
            }
            navigate(item.action);
          },
        }))}
      />
    </PersonaPageFrame>
  );
};

export default ForVenuesPage;
