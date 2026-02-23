import React, { useState } from "react";
import { trackEvent } from "../../../lib/firebase";
import { directoryActions } from "../api/directoryApi";

const ForHostsPage = ({ navigate, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const [privateForm, setPrivateForm] = useState({
    title: "",
    roomCode: "",
    startsAtMs: "",
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
      setStatus("Sign in with a full account to create private sessions.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const payload = {
        title: privateForm.title || `Private Session ${privateForm.roomCode}`,
        roomCode: String(privateForm.roomCode || "").trim().toUpperCase(),
        startsAtMs: Number(privateForm.startsAtMs || 0) || 0,
        description: privateForm.description || "",
        visibility: "private",
      };
      const result = await directoryActions.submitDirectoryListing({
        listingType: "room_session",
        payload,
      });
      setStatus(`Private room-session submitted (${result?.submissionId || "pending"}).`);
      setNextStep({
        label: "Next: Open Join by Code",
        onClick: () => navigate("join", "", { intent: "join_private", targetType: "session", targetId: payload.roomCode }),
      });
      trackEvent("mk_listing_created_room_session", {
        listingType: "room_session",
        mode: "private",
        roomCode: payload.roomCode,
      });
    } catch (error) {
      setStatus(String(error?.message || "Private session creation failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">for hosts</div>
        <h2>Run private rooms or public discoverable events.</h2>
        <p>Create sessions, set cadence, and convert discovery into repeat attendance.</p>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackEvent("mk_persona_cta_click", { persona: "host", cta: "create_event_session" });
              navigate("submit");
            }}
          >
            Create Event / Session
          </button>
          <button
            type="button"
            onClick={() => {
              trackEvent("mk_persona_cta_click", { persona: "host", cta: "browse_discover" });
              navigate("discover");
            }}
          >
            Browse Active Listings
          </button>
        </div>
        <form className="mk3-actions-block" onSubmit={submitPrivateSession}>
          <h3>Private Host Quick Start</h3>
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
            Start (epoch ms, optional)
            <input
              value={privateForm.startsAtMs}
              onChange={(e) => setPrivateForm((prev) => ({ ...prev, startsAtMs: e.target.value }))}
              placeholder="1769961600000"
            />
          </label>
          <label>
            Session Notes
            <textarea
              value={privateForm.description}
              onChange={(e) => setPrivateForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Private invite-only room."
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Submitting..." : "Create Private Session"}
          </button>
          {!!status && <div className="mk3-status">{status}</div>}
          {!!nextStep && (
            <button type="button" className="mk3-inline-next" onClick={nextStep.onClick}>
              {nextStep.label}
            </button>
          )}
        </form>
      </article>
      <aside className="mk3-actions-card">
        <h4>Host Path</h4>
        <ul className="mk3-plain-list">
          <li>Choose private room code flow or public listing flow.</li>
          <li>Publish cadence directly when owner/host verified.</li>
          <li>Track follows, RSVPs, and check-ins from your dashboard.</li>
        </ul>
        {!canSubmit && (
          <div className="mk3-status">Sign in with a full account to create and manage listings.</div>
        )}
      </aside>
    </section>
  );
};

export default ForHostsPage;
