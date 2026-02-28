import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const FAN_BADGES = [
  "Find Better Nights Quickly",
  "Join Rooms With Real Energy",
  "Stay In The Loop",
  "From Spectator To Participant",
];

const FAN_FLOW = [
  {
    title: "Find The Right Room",
    detail: "Use location, timing, and host signal to avoid low-energy nights.",
  },
  {
    title: "Commit Early",
    detail: "RSVP and reminders improve your odds of getting into high-demand rooms.",
  },
  {
    title: "Participate Live",
    detail: "Use your phone as an audience surface to react and contribute in real time.",
  },
  {
    title: "Repeat What Works",
    detail: "Follow standout hosts and venues to build your own premium karaoke routine.",
  },
];

const FAN_PROOF = [
  {
    label: "Signal",
    title: "Faster room selection",
    note: "Find the right nights without trial-and-error across random listings.",
  },
  {
    label: "Experience",
    title: "More interactive nights",
    note: "Audience participation tools move you from passive watcher to active guest.",
  },
  {
    label: "Retention",
    title: "Better repeat behavior",
    note: "Following quality hosts and venues keeps your calendar strong.",
  },
];

const FAN_PLAYBOOK = [
  "Shortlist rooms by host consistency instead of proximity alone.",
  "Use reminders for your top rooms so good nights do not get missed.",
  "Track which venues consistently deliver the best audience energy.",
  "Invite friends into proven rooms to compound your best nights.",
];

const ForFansPage = ({ navigate, session, authFlow }) => {
  const canUseDashboard = !!session?.uid && !session?.isAnonymous;
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "fan",
      page: "for_fans",
      cta: String(cta || ""),
    });
  };

  return (
    <section className="mk3-page mk3-persona-command is-fan">
      <article className="mk3-detail-card mk3-persona-hero mk3-zone">
        <div className="mk3-persona-kicker">for guests</div>
        <h1>Find premium karaoke nights without the guesswork.</h1>
        <p>
          Skip karaoke roulette. Discover better rooms faster, show up prepared,
          and actually participate in the moments that make a night memorable.
        </p>
        <div className="mk3-persona-badge-row">
          {FAN_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("primary_find_premium_nights");
              navigate("discover");
            }}
          >
            Find Premium Nights
          </button>
          {canUseDashboard ? (
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("secondary_open_guest_dashboard");
                navigate("profile");
              }}
            >
              Open Guest Dashboard
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("secondary_create_guest_account");
                authFlow?.requireFullAuth?.({
                  intent: "profile",
                  targetType: "profile",
                  targetId: "",
                  returnRoute: { page: "profile" },
                });
              }}
            >
              Create Guest Account
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_watch_demo");
              navigate("demo");
            }}
          >
            Watch Demo
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_start_hosting");
              navigate("for_hosts");
            }}
          >
            Start Hosting
          </button>
        </div>
        <div className="mk3-persona-proof-grid" aria-label="Guest proof points">
          {FAN_PROOF.map((entry) => (
            <article key={entry.title}>
              <span>{entry.label}</span>
              <strong>{entry.title}</strong>
              <p>{entry.note}</p>
            </article>
          ))}
        </div>
      </article>

      <section className="mk3-detail-card mk3-persona-flow mk3-zone" aria-label="Guest flow overview">
        <h2>Guest Experience Loop</h2>
        <div className="mk3-persona-flow-grid">
          {FAN_FLOW.map((step, index) => (
            <article key={step.title}>
              <span>{`Step ${index + 1}`}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mk3-two-col mk3-persona-late-grid">
        <article className="mk3-detail-card mk3-persona-playbook">
          <h2>Guest Playbook</h2>
          <p>
            Great karaoke nights are predictable when you know what to look for.
            Build a repeatable plan and spend more time in strong rooms.
          </p>
          <ul className="mk3-plain-list">
            {FAN_PLAYBOOK.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>Guest Checklist</h4>
          <div className="mk3-status">
            <strong>Ready for tonight</strong>
            <span>Lock your target room and show up with a clear participation plan.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            <span>Room selected</span>
            <span>RSVP/reminder set</span>
            <span>Friends invited</span>
            <span>Audience app ready</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForFansPage;
