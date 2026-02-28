import React, { useState } from "react";
import { trackEvent, trackGoldenPathMilestone } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { fromDateTimeLocalInput } from "./shared";

const HOST_STACK_BADGES = [
  "Content-Agnostic Control Plane",
  "Bring Your Own Sources",
  "Works With Existing Host Software",
  "Built For Live Room Flow",
];

const HOST_FLOW_STEPS = [
  {
    title: "Set Your Night Blueprint",
    detail: "Room defaults, queue policy, moderation, and overlays all live in one host workspace.",
  },
  {
    title: "Run A Unified Queue",
    detail: "Blend local uploads, URLs, and connected music sources without rebuilding your stack.",
  },
  {
    title: "Keep Crowd Energy Up",
    detail: "TV, audience phones, and host controls stay in sync so transitions feel intentional.",
  },
  {
    title: "Close Strong + Recap",
    detail: "End the room cleanly with recap-ready data instead of ad-hoc cleanup.",
  },
];

const HOST_COMPATIBILITY = [
  {
    label: "Apple Music + YouTube + Local",
    status: "live now",
    note: "Already supported in mixed queue flows.",
  },
  {
    label: "Spotify + Amazon Playlist Intake",
    status: "next",
    note: "Source-aware import and search expansion.",
  },
  {
    label: "Karafun / Singa Mediation",
    status: "research spike",
    note: "Feasibility-first path before connector architecture lock.",
  },
];

const HOST_OUTCOMES = [
  "Less dead air between singers and game moments.",
  "Cleaner handoffs when multiple devices are involved.",
  "Higher guest participation through coordinated audience prompts.",
  "More repeatable host operations from room setup to closeout.",
];

const HOST_FAQ = [
  {
    question: "Do you provide licensed karaoke tracks?",
    answer: "No. BeauRocks is intentionally content-agnostic and operates as the orchestration layer.",
  },
  {
    question: "Can this work with my existing host flow?",
    answer: "Yes. The product is built to complement existing software and source stacks, not force a full replacement.",
  },
  {
    question: "Who handles rights compliance?",
    answer: "Hosts remain responsible for rights compliance when connecting and playing content.",
  },
];

const ForHostsPage = ({ navigate, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "host",
      page: "for_hosts",
      cta: String(cta || ""),
    });
  };
  const [privateForm, setPrivateForm] = useState({
    title: "",
    roomCode: "",
    startsAtLocal: "",
    description: "",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [nextStep, setNextStep] = useState(null);

  const submitPrivateSession = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "private_session_create",
        targetType: "session",
        targetId: privateForm.roomCode || "",
        returnRoute: {
          page: "for_hosts",
          params: {
            intent: "private_session_create",
            targetType: "session",
            targetId: privateForm.roomCode || "",
          },
        },
      });
      setStatus("Create an account to spin up private sessions.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const payload = {
        title: privateForm.title || `Private Session ${privateForm.roomCode}`,
        roomCode: String(privateForm.roomCode || "").trim().toUpperCase(),
        startsAtMs: fromDateTimeLocalInput(privateForm.startsAtLocal),
        description: privateForm.description || "",
        visibility: "private",
      };
      const result = await directoryActions.submitDirectoryListing({
        listingType: "room_session",
        payload,
      });
      setStatus(`Private session submitted (${result?.submissionId || "pending"}).`);
      setNextStep({
        label: "Next: Open Join By Code",
        onClick: () => navigate("join", "", { intent: "join_private", targetType: "session", targetId: payload.roomCode }),
      });
      trackEvent("mk_listing_created_room_session", {
        listingType: "room_session",
        mode: "private",
        roomCode: payload.roomCode,
      });
      trackGoldenPathMilestone({
        pathId: "host_create_session",
        workstream: "host_growth",
        source: "for_hosts_private_quick_start",
      });
    } catch (error) {
      setStatus(String(error?.message || "Could not create that private session."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mk3-page mk3-host-command">
      <article className="mk3-detail-card mk3-host-hero mk3-zone">
        <div className="mk3-host-kicker">for hosts</div>
        <h1>Run the ultimate karaoke night with the tools you already use.</h1>
        <p>
          BeauRocks is your karaoke control plane: one orchestration layer for queue flow, crowd interaction,
          moderation, and cross-surface timing without forcing you into a locked music catalog.
        </p>
        <div className="mk3-status mk3-status-warning">
          <strong>Content-agnostic by design</strong>
          <span>Bring your own tracks and connected sources. Hosts remain responsible for music-rights compliance.</span>
        </div>
        <div className="mk3-host-badge-row">
          {HOST_STACK_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <div className="mk3-actions-inline">
          {canSubmit ? (
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("primary_start_hosting");
                navigate("submit");
              }}
            >
              Start Hosting
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("primary_start_hosting_auth_gate");
                authFlow?.requireFullAuth?.({
                  intent: "listing_submit",
                  targetType: "event",
                  targetId: "",
                  returnRoute: { page: "submit", params: { intent: "listing_submit", targetType: "event" } },
                });
              }}
            >
              Start Hosting
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("secondary_watch_demo");
              navigate("demo");
            }}
          >
            Watch Demo
          </button>
          {!canSubmit && (
            <button
              type="button"
              onClick={() => {
                trackPersonaCta("tertiary_create_account_to_launch");
                authFlow?.requireFullAuth?.({
                  intent: "private_session_create",
                  targetType: "session",
                  targetId: "",
                  returnRoute: {
                    page: "for_hosts",
                    params: {
                      intent: "private_session_create",
                      targetType: "session",
                    },
                  },
                });
              }}
            >
              Create Account To Launch
            </button>
          )}
        </div>
        <div className="mk3-host-proof-grid" aria-label="Host value proof points">
          <article>
            <span>Queue</span>
            <strong>Source-aware flow</strong>
            <p>Run one queue shape even when content comes from different providers.</p>
          </article>
          <article>
            <span>Operations</span>
            <strong>Faster setup</strong>
            <p>Host workspace controls reduce friction before the first singer starts.</p>
          </article>
          <article>
            <span>Engagement</span>
            <strong>Stronger participation</strong>
            <p>Audience prompts and host actions can stay coordinated with TV moments.</p>
          </article>
        </div>
      </article>

      <section className="mk3-detail-card mk3-host-flow mk3-zone" aria-label="Host flow overview">
        <h2>Host Flow Built For Real Nights</h2>
        <div className="mk3-host-flow-grid">
          {HOST_FLOW_STEPS.map((step, index) => (
            <article key={step.title}>
              <span>{`Step ${index + 1}`}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mk3-two-col mk3-host-late-grid">
        <article className="mk3-detail-card mk3-host-stack-card">
          <h2>Works With Your Current Stack</h2>
          <p>
            We are not trying to own karaoke catalogs. We are focused on becoming the mediation layer that
            makes host operations cleaner across whatever stack you already trust.
          </p>
          <div className="mk3-host-compat-grid">
            {HOST_COMPATIBILITY.map((item) => (
              <article key={item.label}>
                <span>{item.status}</span>
                <strong>{item.label}</strong>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
          <h3>Host Outcomes That Matter</h3>
          <ul className="mk3-plain-list">
            {HOST_OUTCOMES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="mk3-host-faq" aria-label="Host FAQ">
            {HOST_FAQ.map((entry) => (
              <article key={entry.question}>
                <strong>{entry.question}</strong>
                <span>{entry.answer}</span>
              </article>
            ))}
          </div>
        </article>

        <aside className="mk3-actions-card mk3-host-quick-card">
          <h4>Quick Room Launch</h4>
          <div className="mk3-status">
            <strong>Fast lane for active hosts</strong>
            <span>Create a private session, then jump to join-by-code flow for immediate testing.</span>
          </div>

          {canSubmit && (
            <form className="mk3-actions-block" onSubmit={submitPrivateSession}>
              <label>
                Room Code
                <input
                  value={privateForm.roomCode}
                  onChange={(e) => setPrivateForm((prev) => ({ ...prev, roomCode: String(e.target.value || "").toUpperCase() }))}
                  placeholder="VIP123"
                  required
                />
              </label>
              <label>
                Session Title
                <input
                  value={privateForm.title}
                  onChange={(e) => setPrivateForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Friends & Family Karaoke"
                />
              </label>
              <label>
                Start (optional)
                <input
                  type="datetime-local"
                  value={privateForm.startsAtLocal}
                  onChange={(e) => setPrivateForm((prev) => ({ ...prev, startsAtLocal: e.target.value }))}
                />
              </label>
              <label>
                Session Notes
                <textarea
                  value={privateForm.description}
                  onChange={(e) => setPrivateForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Invite-only room. Bring your loud friends."
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? "Creating..." : "Create Private Room"}
              </button>
              {!!status && <div className="mk3-status">{status}</div>}
              {!!nextStep && (
                <button type="button" className="mk3-inline-next" onClick={nextStep.onClick}>
                  {nextStep.label}
                </button>
              )}
            </form>
          )}

          {!canSubmit && (
            <div className="mk3-actions-block">
              <div className="mk3-status">Create an account to unlock room launch.</div>
              <button
                type="button"
                onClick={() => authFlow?.requireFullAuth?.({
                  intent: "private_session_create",
                  targetType: "session",
                  targetId: "",
                  returnRoute: {
                    page: "for_hosts",
                    params: {
                      intent: "private_session_create",
                      targetType: "session",
                    },
                  },
                })}
              >
                Create Account To Launch
              </button>
            </div>
          )}

          <div className="mk3-host-checklist">
            <strong>Host Readiness Checklist</strong>
            <span>Room identity defined</span>
            <span>Queue policy selected</span>
            <span>Audience join path tested</span>
            <span>TV surface open and visible</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForHostsPage;
