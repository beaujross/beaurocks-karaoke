import React, { useState } from "react";
import { trackEvent, trackGoldenPathMilestone } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { fromDateTimeLocalInput } from "./shared";

const HOST_STACK_BADGES = [
  "Content-Agnostic Control",
  "Works With Existing Tools",
  "Built For Live Flow",
];

const HOST_QUICK_STEPS = [
  {
    title: "Set room defaults",
    detail: "Configure queue, moderation, and overlays in one place.",
  },
  {
    title: "Run a unified queue",
    detail: "Use your current sources without changing your stack.",
  },
  {
    title: "Close with clean recap",
    detail: "Finish with consistent room data instead of manual cleanup.",
  },
];

const HOST_OUTCOMES = [
  "Less dead air between singers.",
  "Cleaner transitions across host, TV, and audience devices.",
  "More repeatable host operations night to night.",
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
        <h1>Run a stronger karaoke night with less setup noise.</h1>
        <p>
          BeauRocks is a control layer, not a catalog lock-in. Keep your existing content tools and run cleaner room
          flow across host, TV, and audience surfaces.
        </p>
        <div className="mk3-status mk3-status-warning">
          <strong>Content-agnostic by design</strong>
          <span>Hosts remain responsible for music-rights compliance.</span>
        </div>
        <div className="mk3-host-badge-row">
          {HOST_STACK_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta(canSubmit ? "primary_start_hosting" : "primary_start_hosting_auth_gate");
              if (canSubmit) {
                navigate("submit");
                return;
              }
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
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("secondary_watch_demo");
              navigate("demo");
            }}
          >
            Watch Demo
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_open_discover");
              navigate("discover");
            }}
          >
            Open Discover Map
          </button>
        </div>
      </article>

      <section className="mk3-detail-card mk3-host-flow mk3-zone" aria-label="Host flow overview">
        <h2>Host Flow In 3 Steps</h2>
        <div className="mk3-host-flow-grid">
          {HOST_QUICK_STEPS.map((step, index) => (
            <article key={step.title}>
              <span>{`Step ${index + 1}`}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mk3-two-col mk3-host-late-grid">
        <article className="mk3-detail-card">
          <h2>Why Hosts Use It</h2>
          <ul className="mk3-plain-list">
            {HOST_OUTCOMES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <aside className="mk3-actions-card mk3-host-quick-card">
          <h4>Quick Room Launch</h4>
          <div className="mk3-status">
            <strong>Fast lane</strong>
            <span>Create a private session and immediately jump to join-by-code.</span>
          </div>

          {canSubmit ? (
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
                Notes (optional)
                <textarea
                  value={privateForm.description}
                  onChange={(e) => setPrivateForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Invite-only room."
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
          ) : (
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
        </aside>
      </div>
    </section>
  );
};

export default ForHostsPage;
