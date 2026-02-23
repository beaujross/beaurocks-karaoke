import React, { useState } from "react";
import { trackEvent } from "../../../lib/firebase";
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

const ClaimOwnershipCard = ({ listingType = "venue", listingId = "", session, authFlow, navigate }) => {
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
      setStatus("Create an account to submit claim requests.");
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
        label: "Next: Set cadence",
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
        <h4>Claim This Listing</h4>
        <p>Create an account to submit ownership claims and unlock publish privileges.</p>
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
          Create Account To Claim
        </button>
      </aside>
    );
  }

  return (
    <aside className="mk3-actions-card">
      <h4>Claim This Listing</h4>
      <p>Verified owners/hosts get faster direct-publish cadence updates.</p>
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
        {busy ? "Submitting..." : "Submit Claim Request"}
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
