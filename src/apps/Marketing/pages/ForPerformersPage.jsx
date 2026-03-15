import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

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
    imageUrl: "/images/marketing/bross-discovery.png",
  },
  {
    step: "02",
    title: "Join the room quickly from your phone",
    copy: "Name, emoji, and one obvious next step help the night start faster when you arrive.",
    imageUrl: "/images/marketing/audience-join-aahf-current.png",
  },
  {
    step: "03",
    title: "Follow the TV once the room is live",
    copy: "Queue prompts, join state, and stage context stay visible so the room feels easier to read.",
    imageUrl: "/images/marketing/tv-live-aahf-current.png",
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
    <section className="mk3-page mk3-persona-command is-performer">
      <article className="mk3-detail-card mk3-persona-hero mk3-zone mk3-performer-hero-shell">
        <div className="mk3-persona-hero-grid">
          <div className="mk3-persona-hero-copy">
            <div className="mk3-persona-kicker">for performers</div>
            <h1>Find karaoke nights worth making part of your week.</h1>
            <p>Skip the guesswork. Find rooms with a real crowd and a clear schedule.</p>
            <div className="mk3-persona-badge-row">
              {PERFORMER_BADGES.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
            <div className="mk3-persona-stat-row">
              <article className="mk3-persona-stat-card">
                <strong>Clearer room info</strong>
                <span>See which nights look organized before you go.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Better planning</strong>
                <span>Find nights that can become part of your week.</span>
              </article>
              <article className="mk3-persona-stat-card">
                <strong>Better fit</strong>
                <span>Bring your best songs to the right room.</span>
              </article>
            </div>
            <div className="mk3-actions-inline">
              <button
                type="button"
                onClick={() => {
                  trackPersonaCta("primary_find_spotlight_nights");
                  navigate("discover");
                }}
              >
                Open Discover Map
              </button>
              <button
                type="button"
                onClick={() => {
                  trackPersonaCta("secondary_open_fans");
                  navigate("for_fans");
                }}
              >
                See Audience Experience
              </button>
            </div>
          </div>
          <aside className="mk3-persona-hero-visual">
            <article className="mk3-persona-visual-stage is-performer">
              <img src="/images/marketing/audience-join-aahf-current.png" alt="BeauRocks audience room join screen" loading="lazy" />
              <div className="mk3-persona-visual-overlay">
                <div className="mk3-persona-kicker">for performers</div>
                <strong>Once you pick a room, getting in should be fast.</strong>
                <span>A clear join flow helps good rooms feel easy to come back to.</span>
              </div>
            </article>
            <div className="mk3-persona-signal-grid">
              {PERFORMER_SIGNAL_CARDS.map((card) => (
                <article key={card.title} className="mk3-persona-signal-card">
                  <span>{card.label}</span>
                  <strong>{card.title}</strong>
                  <p>{card.copy}</p>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </article>

      <section className="mk3-detail-card mk3-zone mk3-marketing-rich-band">
        <div>
          <div className="mk3-persona-kicker">why performers care</div>
          <h2>Better room information makes better karaoke habits.</h2>
        </div>
        <div className="mk3-marketing-signal-grid">
          {PERFORMER_TRUST_SIGNALS.map((item) => (
            <article key={item.title} className="mk3-marketing-signal-card">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-marketing-how-band">
        <div>
          <div className="mk3-persona-kicker">what the performer path looks like</div>
          <h2>Find the room, join quickly, and follow the live night clearly.</h2>
        </div>
        <div className="mk3-marketing-step-grid">
          {PERFORMER_SURFACE_STEPS.map((item) => (
            <article key={item.step} className="mk3-marketing-step-card">
              <img src={item.imageUrl} alt={item.title} loading="lazy" />
              <div>
                <span>{item.step}</span>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-marketing-outcome-band">
        <div>
          <div className="mk3-persona-kicker">what better discovery gives you</div>
          <h2>Less guesswork before you leave the house.</h2>
        </div>
        <div className="mk3-marketing-outcome-grid">
          {PERFORMER_PROOF_POINTS.map((point, index) => (
            <article key={point}>
              <span>{`Proof 0${index + 1}`}</span>
              <strong>{point}</strong>
              <p>{PERFORMER_STORY_POINTS[index] || "Clearer rooms are easier to come back to."}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-persona-flow">
        <h2>How performers turn discovery into a real routine</h2>
        <div className="mk3-persona-flow-grid">
          {PERFORMER_FLOW_STEPS.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk3-detail-card mk3-zone mk3-marketing-closing-band">
        <div>
          <div className="mk3-persona-kicker">pick the next step</div>
          <h2>Start with discovery, the audience overview, or the full product demo.</h2>
        </div>
        <div className="mk3-marketing-closing-grid">
          {PERFORMER_FINAL_PATHS.map((item) => (
            <article key={item.title} className="mk3-marketing-closing-card">
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
              <button
                type="button"
                onClick={() => {
                  trackPersonaCta(`closing_${item.route}`);
                  navigate(item.route);
                }}
              >
                {item.cta}
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
};

export default ForPerformersPage;
