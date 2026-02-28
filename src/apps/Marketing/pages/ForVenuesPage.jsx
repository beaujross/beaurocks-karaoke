import React from "react";
import { trackEvent } from "../lib/marketingAnalytics";

const VENUE_BADGES = [
  "Recurring Night Infrastructure",
  "Claim + Control Your Listing",
  "Host Quality Signaling",
  "Cross-Surface Guest Experience",
];

const VENUE_FLOW = [
  {
    title: "Claim Ownership",
    detail: "Take control of venue profile data, branding, and publishing permissions.",
  },
  {
    title: "Publish Your Cadence",
    detail: "Set recurring schedules so guests know exactly when karaoke happens.",
  },
  {
    title: "Promote Better Hosts",
    detail: "Highlight reliable hosts and protect your room quality over time.",
  },
  {
    title: "Track Outcomes",
    detail: "Use follows, RSVPs, and check-ins to guide programming decisions.",
  },
];

const VENUE_PROOF = [
  {
    label: "Operations",
    title: "Cleaner listing management",
    note: "One place to keep room details accurate and up to date.",
  },
  {
    label: "Growth",
    title: "Higher return traffic",
    note: "Consistent cadence helps regulars build karaoke into their routine.",
  },
  {
    label: "Brand",
    title: "Stronger venue reputation",
    note: "Reliable nights build trust faster than ad-hoc event pages.",
  },
];

const VENUE_PLAYBOOK = [
  "Standardize one signature karaoke night and protect it from schedule drift.",
  "Promote hosts who keep queue flow and room energy consistent.",
  "Use listing metrics as the source of truth for programming changes.",
  "Convert high-performing nights into recurring brand assets.",
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

  return (
    <section className="mk3-page mk3-persona-command is-venue">
      <article className="mk3-detail-card mk3-persona-hero mk3-zone">
        <div className="mk3-persona-kicker">for venues</div>
        <h1>Turn karaoke into a dependable revenue night.</h1>
        <p>
          BeauRocks helps venue teams run repeatable karaoke experiences without replacing their existing host stack.
          Claim your venue, lock your cadence, and operate from a cleaner playbook.
        </p>
        <div className="mk3-persona-badge-row">
          {VENUE_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <div className="mk3-actions-inline">
          {canSubmit ? (
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("primary_claim_venue");
                navigate("submit");
              }}
            >
              Claim Your Venue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("primary_claim_venue_auth_gate");
                authFlow?.requireFullAuth?.({
                  intent: "listing_submit",
                  targetType: "venue",
                  targetId: "",
                  returnRoute: { page: "submit", params: { intent: "listing_submit", targetType: "venue" } },
                });
              }}
            >
              Claim Your Venue
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("secondary_view_host_system");
              navigate("for_hosts");
            }}
          >
            View Host System
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_watch_demo");
              navigate("demo");
            }}
          >
            Watch Demo
          </button>
        </div>
        <div className="mk3-persona-proof-grid" aria-label="Venue proof points">
          {VENUE_PROOF.map((entry) => (
            <article key={entry.title}>
              <span>{entry.label}</span>
              <strong>{entry.title}</strong>
              <p>{entry.note}</p>
            </article>
          ))}
        </div>
      </article>

      <section className="mk3-detail-card mk3-persona-flow mk3-zone" aria-label="Venue flow overview">
        <h2>Venue Operating Loop</h2>
        <div className="mk3-persona-flow-grid">
          {VENUE_FLOW.map((step, index) => (
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
          <h2>Venue Playbook</h2>
          <p>
            Treat karaoke as a product line. The venues winning long-term are the ones that run reliable nights,
            support their hosts, and keep guest expectations clear.
          </p>
          <ul className="mk3-plain-list">
            {VENUE_PLAYBOOK.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <aside className="mk3-actions-card mk3-persona-checklist">
          <h4>Venue Checklist</h4>
          <div className="mk3-status">
            <strong>Ship this before promotion</strong>
            <span>Publish only after ownership, cadence, and host operations are aligned.</span>
          </div>
          <div className="mk3-persona-checklist-list">
            <span>Ownership verified</span>
            <span>Recurring schedule published</span>
            <span>Host workflow confirmed</span>
            <span>Guest join flow tested</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForVenuesPage;
