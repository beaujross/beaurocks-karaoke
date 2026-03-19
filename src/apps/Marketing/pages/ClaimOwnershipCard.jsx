import React, { useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { marketingFlags } from "../featureFlags";

const routeForListing = (listingType = "", listingId = "") => {
  if (listingType === "venue") return { page: "venue", id: listingId };
  if (listingType === "host") return { page: "host", id: listingId };
  if (listingType === "event") return { page: "event", id: listingId };
  if (listingType === "room_session") return { page: "session", id: listingId };
  if (listingType === "performer") return { page: "performer", id: listingId };
  return { page: "discover", id: "" };
};

const ClaimOwnershipCard = ({
  listingType = "venue",
  listingId = "",
  session,
  authFlow,
  navigate,
  isModernized = false,
}) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const [role, setRole] = useState(listingType === "host" ? "host" : "owner");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [nextStep, setNextStep] = useState(null);

  const submitClaim = async () => {
    if (!marketingFlags.claimFlowEnabled) {
      setStatus("Claim flow is disabled.");
      return;
    }
    if (!listingId) {
      setStatus("Listing ID missing.");
      return;
    }
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "claim",
        targetType: listingType,
        targetId: listingId,
        returnRoute: {
          ...routeForListing(listingType, listingId),
          params: {
            intent: "claim",
            targetType: listingType,
            targetId: listingId,
          },
        },
      });
      setStatus("Create your BeauRocks account to submit claim requests.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const result = await directoryActions.submitDirectoryClaimRequest({
        listingType,
        listingId,
        role,
        evidence,
      });
      setStatus(`Claim request submitted (${result?.claimId || "pending"}).`);
      setNextStep({
        label: "Next: Update schedule",
        onClick: () => navigate?.(
          routeForListing(listingType, listingId).page,
          routeForListing(listingType, listingId).id,
          {
            intent: "cadence",
            targetType: listingType,
            targetId: listingId,
          }
        ),
      });
      trackEvent("mk_listing_claim_submit", { listingType, listingId });
      setEvidence("");
    } catch (error) {
      setStatus(String(error?.message || "Claim request failed."));
    } finally {
      setBusy(false);
    }
  };

  if (!marketingFlags.claimFlowEnabled) return null;

  if (!canSubmit) {
    return (
      <aside className="mk3-actions-card">
        <h4>{isModernized ? "Claim This Listing" : "Claim + Upgrade This Listing"}</h4>
        <p>
          {isModernized
            ? "Create your BeauRocks account to submit ownership claims and unlock publish privileges."
            : "Create your BeauRocks account to claim this listing and add live join, audience interaction, and recap-powered proof."}
        </p>
        <button
          type="button"
          onClick={() => authFlow?.requireFullAuth?.({
            intent: "claim",
            targetType: listingType,
            targetId: listingId,
            returnRoute: {
              ...routeForListing(listingType, listingId),
              params: { intent: "claim", targetType: listingType, targetId: listingId },
            },
          })}
        >
          Create BeauRocks Account
        </button>
      </aside>
    );
  }

  return (
    <aside className="mk3-actions-card">
      <h4>{isModernized ? "Claim This Listing" : "Claim + Upgrade This Listing"}</h4>
      <p>
        {isModernized
          ? "Verified owners and hosts can update listing details faster."
          : "Claim this listing to modernize the night with live join, audience app moments, smoother host flow, and recap-ready proof."}
      </p>
      {!isModernized && (
        <div className="mk3-status">
          <strong>Upgrade with BeauRocks</strong>
          <span>Show guests a more modern karaoke experience directly inside discovery.</span>
        </div>
      )}
      <label>
        Your Role
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="owner">Owner</option>
          <option value="host">Host / KJ</option>
          <option value="manager">Manager</option>
        </select>
      </label>
      <label>
        Evidence
        <textarea
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Website, socials, booking proof, or contact details."
        />
      </label>
      <button type="button" disabled={busy} onClick={submitClaim}>
        {busy ? "Submitting..." : isModernized ? "Submit Claim Request" : "Submit Claim + Upgrade Request"}
      </button>
      {status && <div className="mk3-status">{status}</div>}
      {!!nextStep && (
        <button type="button" className="mk3-inline-next" onClick={nextStep.onClick}>
          {nextStep.label}
        </button>
      )}
    </aside>
  );
};

export default ClaimOwnershipCard;

