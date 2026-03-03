import React, { useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { marketingFlags } from "../featureFlags";

const InlineConversionActions = ({ entry = {}, session, navigate, authFlow }) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [nextStep, setNextStep] = useState(null);
  const canAct = !!session?.uid && !session?.isAnonymous;

  const requireAuth = ({ intent = "", returnRoute = null, targetType = "", targetId = "" }) => {
    if (canAct) return true;
    return !!authFlow?.requireFullAuth?.({
      intent,
      targetType,
      targetId,
      returnRoute,
    });
  };

  const listingType = String(entry.listingType || "").trim().toLowerCase();
  const targetId = String(entry.id || "").trim();
  const routePage = String(entry.routePage || "").trim();
  const submitQuickRsvp = async () => {
    const targetType = listingType === "room_session" ? "session" : "event";
    if (!requireAuth({
      intent: "rsvp",
      targetType,
      targetId,
      returnRoute: { page: routePage, id: targetId, params: { intent: "rsvp", targetType, targetId } },
    })) {
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await directoryActions.setDirectoryRsvp({
        targetType,
        targetId,
        status: "going",
        reminderChannels: ["email"],
      });
      setStatus("RSVP saved.");
      setNextStep({
        label: "Next: Enable reminders",
        action: () => navigate(routePage, targetId, {
          intent: "reminders",
          targetType,
          targetId,
        }),
      });
      trackEvent("mk_rsvp_set", { targetType, targetId, source: "inline_card", status: "going" });
    } catch (error) {
      setStatus(String(error?.message || "RSVP failed."));
    } finally {
      setBusy(false);
    }
  };

  const submitQuickClaim = async () => {
    if (!marketingFlags.claimFlowEnabled) {
      setStatus("Claim flow is disabled.");
      return;
    }
    if (!requireAuth({
      intent: "claim",
      targetType: "venue",
      targetId,
      returnRoute: { page: "venue", id: targetId, params: { intent: "claim", targetType: "venue", targetId } },
    })) {
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await directoryActions.submitDirectoryClaimRequest({
        listingType: "venue",
        listingId: targetId,
        role: "owner",
        evidence: "Quick claim from discovery card.",
      });
      setStatus("Claim submitted.");
      setNextStep({
        label: "Next: Set cadence",
        action: () => navigate("venue", targetId, { intent: "cadence", targetType: "venue", targetId }),
      });
      trackEvent("mk_listing_claim_submit", { listingType: "venue", listingId: targetId, source: "inline_card" });
    } catch (error) {
      setStatus(String(error?.message || "Claim request failed."));
    } finally {
      setBusy(false);
    }
  };

  const followHost = async () => {
    const hostUid = String(entry.hostUid || "").trim();
    if (!hostUid) return;
    if (!requireAuth({
      intent: "follow",
      targetType: "host",
      targetId: hostUid,
      returnRoute: { page: routePage, id: targetId, params: { intent: "follow", targetType: "host", targetId: hostUid } },
    })) {
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await directoryActions.followDirectoryEntity({
        targetType: "host",
        targetId: hostUid,
      });
      setStatus("Host followed.");
      setNextStep({
        label: "Next: RSVP",
        action: () => navigate(routePage, targetId, {
          intent: "rsvp",
          targetType: listingType === "room_session" ? "session" : "event",
          targetId,
        }),
      });
      trackEvent("mk_follow_set", { targetType: "host", targetId: hostUid, source: "inline_card", mode: "follow" });
    } catch (error) {
      setStatus(String(error?.message || "Could not follow host."));
    } finally {
      setBusy(false);
    }
  };

  const followPerformer = async () => {
    const performerUid = String(entry.performerUid || "").trim();
    if (!performerUid) return;
    if (!requireAuth({
      intent: "follow",
      targetType: "performer",
      targetId: performerUid,
      returnRoute: { page: routePage, id: targetId, params: { intent: "follow", targetType: "performer", targetId: performerUid } },
    })) {
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await directoryActions.followDirectoryEntity({
        targetType: "performer",
        targetId: performerUid,
      });
      setStatus("Performer followed.");
      trackEvent("mk_follow_set", { targetType: "performer", targetId: performerUid, source: "inline_card", mode: "follow" });
    } catch (error) {
      setStatus(String(error?.message || "Could not follow performer."));
    } finally {
      setBusy(false);
    }
  };

  if (!canAct) {
    return null;
  }

  return (
    <div className="mk3-inline-conversions">
      {(listingType === "event" || listingType === "room_session") && (
        <button type="button" disabled={busy} onClick={submitQuickRsvp}>
          {busy ? "Saving..." : "Quick RSVP"}
        </button>
      )}
      {listingType === "venue" && (
        <button type="button" disabled={busy} onClick={submitQuickClaim}>
          {busy ? "Submitting..." : "Claim Venue"}
        </button>
      )}
      {!!entry.hostUid && (
        <button type="button" disabled={busy} onClick={followHost}>
          Follow Host
        </button>
      )}
      {!!entry.performerUid && (
        <button type="button" disabled={busy} onClick={followPerformer}>
          Follow Performer
        </button>
      )}
      {!!status && <div className="mk3-inline-status">{status}</div>}
      {!!nextStep && (
        <button type="button" className="mk3-inline-next" onClick={nextStep.action}>
          {nextStep.label}
        </button>
      )}
    </div>
  );
};

export default InlineConversionActions;

