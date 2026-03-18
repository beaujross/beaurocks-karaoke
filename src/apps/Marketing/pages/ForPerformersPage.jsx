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

const PERFORMER_BADGES = [
  "Find better rooms faster",
  "Plan your next night out",
  "Build a weekly rotation",
];

const PERFORMER_STORY_POINTS = [
  "Find rooms you actually want to revisit.",
  "Reliable weekly nights beat random guesses.",
  "Good hosts and clear schedules make song choice easier.",
];

const PERFORMER_PROOF_POINTS = [
  "Hosts you can actually evaluate",
  "Schedules that stay current",
  "Rooms worth adding to your routine",
];

const PERFORMER_SIGNAL_CARDS = [
  {
    label: "Hosts",
    title: "See who is running the night",
    copy: "Know who is running the room before you go.",
  },
  {
    label: "Schedule",
    title: "Build a weekly rotation",
    copy: "Find nights worth building into your week.",
  },
  {
    label: "Fit",
    title: "Bring your best songs to the right room",
    copy: "Pick the room that fits your songs and your crowd.",
  },
];

const PERFORMER_TRUST_SIGNALS = [
  {
    label: "Discovery",
    title: "Know which rooms are worth your time",
    copy: "Clear host, venue, and schedule context make it easier to decide where to go next.",
  },
  {
    label: "Join flow",
    title: "A better room should be easier to enter",
    copy: "Good karaoke nights should not start with confusion once you arrive.",
  },
  {
    label: "Repeat value",
    title: "Weekly favorites beat random guesses",
    copy: "Performers come back to rooms that feel reliable, visible, and fun to join.",
  },
];

const PERFORMER_SURFACE_STEPS = [
  {
    step: "01",
    title: "Start with discovery that feels current",
    copy: "Browse real karaoke nights with clearer room context instead of guessing what a venue might be like.",
    visualType: "radar",
    visualLabel: "Discover radar",
  },
  {
    step: "02",
    title: "Join the room quickly from your phone",
    copy: "Name, emoji, and one obvious next step help the night start faster when you arrive.",
    visualType: "audience",
    visualLabel: "Audience app",
  },
  {
    step: "03",
    title: "Follow the TV once the room is live",
    copy: "Queue prompts, join state, and stage context stay visible so the room feels easier to read.",
    visualType: "tv",
    visualLabel: "Public TV",
  },
];

const PERFORMER_FINAL_PATHS = [
  {
    title: "Browse live nights",
    copy: "Open discovery if you want to find the next room worth trying.",
    cta: "Open Discover",
    route: "discover",
  },
  {
    title: "See the audience experience",
    copy: "Go to the main BeauRocks overview if you want the broader room story from the guest side.",
    cta: "Open Overview",
    route: "for_fans",
  },
  {
    title: "Watch the product demo",
    copy: "See how host, TV, and audience stay in sync during a live night.",
    cta: "Open Demo",
    route: "demo_auto",
  },
];

const PERFORMER_FLOW_STEPS = [
  {
    step: "01",
    title: "Browse the map",
    copy: "Start with current schedules and clear host info.",
  },
  {
    step: "02",
    title: "Check the schedule",
    copy: "Look for nights you can count on.",
  },
  {
    step: "03",
    title: "Pick the right fit",
    copy: "Choose the crowd and pace that fit your songs.",
  },
  {
    step: "04",
    title: "Come back on purpose",
    copy: "Build a short list worth repeating.",
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
      <PersonaHeroScaffold
        theme="performer"
        className="mk3-performer-hero"
        railClassName="mk3-performer-hero-rail-wrap"
        proofClassName="mk3-performer-proof-strip"
        kicker="For performers"
        brandLine="Skip the guesswork. Find rooms with a real crowd and a clear schedule."
        title="Find karaoke nights worth making part of your week."
        subtitle="Know who is running the night, plan your route faster, and bring your best songs to rooms that actually fit."
        actions={[
          {
            label: "Open Discover Map",
            variant: "primary",
            onClick: () => {
              trackPersonaCta("primary_find_spotlight_nights");
              navigate("discover");
            },
          },
          {
            label: "See Audience Experience",
            variant: "secondary",
            onClick: () => {
              trackPersonaCta("secondary_open_fans");
              navigate("for_fans");
            },
          },
        ]}
        badges={PERFORMER_BADGES}
        proofItems={PERFORMER_SIGNAL_CARDS.map((item) => ({ eyebrow: item.label, title: item.title, copy: item.copy }))}
        rightRail={(
          <div className="mk3-performer-hero-board">
            <article className="mk3-performer-hero-map">
              <PersonaSurfaceMock
                type="radar"
                label="Discover"
                title="Start with discovery that feels current instead of random guesswork."
                copy="Good performers come back to rooms that feel reliable, visible, and easy to join."
                className="mk3-performer-hero-mock"
              />
            </article>

            <div className="mk3-performer-hero-strip">
              <article className="mk3-performer-hero-card is-join">
                <PersonaSurfaceMock
                  type="audience"
                  label="Join"
                  title="Fast room entry"
                  copy="Name, emoji, and one clear next step get you into the room faster."
                />
              </article>
              <article className="mk3-performer-hero-card is-tv">
                <PersonaSurfaceMock
                  type="tv"
                  label="TV"
                  title="Read the room clearly"
                  copy="Queue prompts and stage context stay visible once the room is live."
                />
              </article>
              <article className="mk3-performer-hero-note">
                <span>Host</span>
                <strong>Know who is running it before you go.</strong>
                <p>Clear host context makes it easier to choose the right night and the right crowd.</p>
              </article>
            </div>
          </div>
        )}
      />

      <PersonaSignalSection
        theme="performer"
        className="mk3-performer-signal-band"
        kicker="Why performers care"
        title="Better room information makes better karaoke habits."
        cards={PERFORMER_TRUST_SIGNALS}
      />

      <PersonaFeatureSection
        theme="performer"
        className="mk3-performer-feature-band"
        kicker="What the performer path looks like"
        title="Find the room, join quickly, and follow the live night clearly."
        steps={PERFORMER_SURFACE_STEPS}
      />

      <PersonaOutcomeSection
        theme="performer"
        className="mk3-performer-outcome-band"
        kicker="What better discovery gives you"
        title="Less guesswork before you leave the house."
        aside={(
          <div className="mk3-rebuild-aside-copy">
            <span>Performer lens</span>
            <strong>Weekly favorites beat random guesses.</strong>
            <p>Clear host, venue, and schedule context make it easier to decide where to go next and where to come back.</p>
          </div>
        )}
        items={PERFORMER_PROOF_POINTS.map((point, index) => ({
          label: `Proof 0${index + 1}`,
          title: point,
          copy: PERFORMER_STORY_POINTS[index] || "Clearer rooms are easier to come back to.",
        }))}
      />

      <PersonaFlowSection
        theme="performer"
        className="mk3-performer-flow-band"
        title="How performers turn discovery into a real routine"
        steps={PERFORMER_FLOW_STEPS}
      />

      <PersonaClosingSection
        theme="performer"
        className="mk3-performer-closing-band"
        kicker="Pick the next step"
        title="Start with discovery, the audience overview, or the full product demo."
        cards={PERFORMER_FINAL_PATHS.map((item) => ({
          ...item,
          onClick: () => {
            trackPersonaCta(`closing_${item.route}`);
            navigate(item.route);
          },
        }))}
      />
    </PersonaPageFrame>
  );
};

export default ForPerformersPage;
