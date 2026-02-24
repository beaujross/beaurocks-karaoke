import React, { useState } from "react";
import { trackEvent, trackGoldenPathMilestone } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { fromDateTimeLocalInput } from "./shared";

const ForHostsPage = ({ navigate, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
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
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">for hosts</div>
        <h2>Turn karaoke nights into meaningful moments.</h2>
        <p>
          Home parties, venue nights, fundraisers, and community events all need the same thing: real connection.
          BeauRocks helps hosts run smoother rooms and create nights people remember.
        </p>
        <div className="mk3-actions-inline">
          {canSubmit ? (
            <button
              type="button"
              onClick={() => {
                trackEvent("mk_persona_cta_click", { persona: "host", cta: "create_event_session" });
                navigate("submit");
              }}
            >
              Create Event Or Session
            </button>
          ) : (
            <button
              type="button"
              onClick={() => authFlow?.requireFullAuth?.({
                intent: "listing_submit",
                targetType: "event",
                targetId: "",
                returnRoute: { page: "submit", params: { intent: "listing_submit", targetType: "event" } },
              })}
            >
              Create Account To Host
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              trackEvent("mk_persona_cta_click", { persona: "host", cta: "browse_discover" });
              navigate("discover");
            }}
          >
            Open Finder Mode
          </button>
        </div>
        {canSubmit && (
        <form className="mk3-actions-block" onSubmit={submitPrivateSession}>
          <h3>Host Quick Start</h3>
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
            {busy ? "Creating..." : "Create Private Session"}
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
            <div className="mk3-status">Create an account to unlock host quick start.</div>
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
              Create Account To Start A Private Session
            </button>
          </div>
        )}
      </article>
      <aside className="mk3-actions-card">
        <h4>Host Growth Path</h4>
        <ul className="mk3-plain-list">
          <li>Pick private-room pilots or public listing flow.</li>
          <li>Run nights with less dead air and clearer crowd participation.</li>
          <li>Turn one-off events into repeat community nights.</li>
        </ul>
        {!canSubmit && (
          <div className="mk3-status">Create an account to create and manage your nights.</div>
        )}
      </aside>
    </section>
  );
};

export default ForHostsPage;

