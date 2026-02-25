import React, { useEffect, useMemo, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { formatDateTime, fromDateTimeLocalInput, toDateTimeLocalInput } from "./shared";
import {
  buildKaraokeNightsLabel,
  buildRecurringRule,
  createEmptyCadenceRows,
  hasCadenceRows,
  parseCadenceTextToRows,
} from "./cadenceSchedule";
import WeeklyScheduleEditor from "./WeeklyScheduleEditor";

const routeForListing = (listingType = "", listingId = "") => {
  if (listingType === "venue") return { page: "venue", id: listingId };
  if (listingType === "event") return { page: "event", id: listingId };
  if (listingType === "room_session") return { page: "session", id: listingId };
  return { page: "discover", id: "" };
};

const CadenceUpdateCard = ({ listingType = "venue", listing = null, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const uid = session?.uid || "";
  const isOwner = !!listing && !!uid && (uid === listing.ownerUid || uid === listing.hostUid);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    karaokeNightsLabel: "",
    description: "",
    startsAtLocal: "",
    endsAtLocal: "",
    recurringRule: "",
    cadenceRows: createEmptyCadenceRows(),
    hostName: "",
    venueName: "",
  });

  useEffect(() => {
    if (!listing) return;
    setForm({
      karaokeNightsLabel: String(listing.karaokeNightsLabel || ""),
      description: String(listing.description || ""),
      startsAtLocal: toDateTimeLocalInput(listing.startsAtMs || 0),
      endsAtLocal: toDateTimeLocalInput(listing.endsAtMs || 0),
      recurringRule: String(listing.recurringRule || ""),
      cadenceRows: parseCadenceTextToRows(
        listingType === "venue"
          ? String(listing.karaokeNightsLabel || "")
          : String(listing.recurringRule || "")
      ),
      hostName: String(listing.hostName || ""),
      venueName: String(listing.venueName || ""),
    });
    setStatus("");
  }, [listing, listingType]);

  const cadencePreview = useMemo(() => {
    if (!listing) return "";
    if (listingType === "venue") {
      return String(listing.karaokeNightsLabel || "").trim() || "No cadence listed yet.";
    }
    const start = formatDateTime(Number(listing.startsAtMs || 0));
    const endMs = Number(listing.endsAtMs || 0);
    const recurringRule = String(listing.recurringRule || "").trim();
    const parts = [start];
    if (endMs > 0) parts.push(`until ${formatDateTime(endMs)}`);
    if (recurringRule) parts.push(recurringRule);
    return parts.join(" | ");
  }, [listing, listingType]);

  const cadenceLabelPreview = useMemo(
    () => buildKaraokeNightsLabel(form.cadenceRows),
    [form.cadenceRows]
  );
  const recurringRulePreview = useMemo(
    () => buildRecurringRule(form.cadenceRows),
    [form.cadenceRows]
  );
  const hasStructuredCadence = useMemo(
    () => hasCadenceRows(form.cadenceRows),
    [form.cadenceRows]
  );

  const submitCadenceUpdate = async (event) => {
    event.preventDefault();
    if (!listing?.id) {
      setStatus("Listing not loaded yet.");
      return;
    }
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "cadence",
        targetType: listingType,
        targetId: listing?.id || "",
        returnRoute: {
          ...routeForListing(listingType, listing?.id || ""),
          params: {
            intent: "cadence",
            targetType: listingType,
            targetId: listing?.id || "",
          },
        },
      });
      setStatus("Create an account to suggest or update cadence.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const payload = listingType === "venue"
        ? {
          karaokeNightsLabel: cadenceLabelPreview || form.karaokeNightsLabel,
          description: form.description,
        }
        : {
          startsAtMs: fromDateTimeLocalInput(form.startsAtLocal),
          endsAtMs: fromDateTimeLocalInput(form.endsAtLocal),
          recurringRule: recurringRulePreview || form.recurringRule,
          hostName: form.hostName,
          venueName: form.venueName,
          description: form.description,
        };
      const result = await directoryActions.updateDirectoryListing({
        listingType,
        listingId: listing.id,
        updateScope: "cadence",
        payload,
      });
      if (result?.mode === "owner_direct_update" || result?.mode === "direct_update") {
        setStatus("Cadence updated live.");
        trackEvent("mk_cadence_update_owner_direct_update", { listingType, listingId: listing.id });
      } else {
        setStatus(`Cadence update submitted for moderation (${result?.submissionId || "pending"}).`);
        trackEvent("mk_cadence_update_queued_for_review", {
          listingType,
          listingId: listing.id,
          submissionId: result?.submissionId || "",
        });
      }
    } catch (error) {
      setStatus(String(error?.message || "Could not update cadence."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="mk3-actions-card">
      <h4>Cadence Updates</h4>
      <p>
        {isOwner
          ? "You are listed as owner/host. Cadence updates publish immediately."
          : "Hosts and community members can submit cadence updates for moderation."}
      </p>
      <div className="mk3-status">
        <strong>Current cadence</strong>
        <span>{cadencePreview}</span>
      </div>
      {!canSubmit && (
        <div className="mk3-actions-block">
          <div className="mk3-status">Create an account to submit cadence updates.</div>
          <button
            type="button"
            onClick={() => authFlow?.requireFullAuth?.({
              intent: "cadence",
              targetType: listingType,
              targetId: listing?.id || "",
              returnRoute: {
                ...routeForListing(listingType, listing?.id || ""),
                params: {
                  intent: "cadence",
                  targetType: listingType,
                  targetId: listing?.id || "",
                },
              },
            })}
          >
            Create Account To Update
          </button>
        </div>
      )}
      {canSubmit && (
      <form className="mk3-actions-block" onSubmit={submitCadenceUpdate}>
        {listingType === "venue" ? (
          <div className="mk3-cadence-field">
            <span>Weekly Karaoke Schedule</span>
            <WeeklyScheduleEditor
              value={form.cadenceRows}
              onChange={(cadenceRows) => setForm((prev) => ({ ...prev, cadenceRows }))}
            />
            {!hasStructuredCadence && !!form.karaokeNightsLabel && (
              <div className="mk3-status mk3-status-warning">
                Existing cadence text will be preserved unless you set a structured schedule.
              </div>
            )}
          </div>
        ) : (
          <>
            <label>
              Start
              <input
                type="datetime-local"
                value={form.startsAtLocal}
                onChange={(e) => setForm((prev) => ({ ...prev, startsAtLocal: e.target.value }))}
              />
            </label>
            <label>
              End
              <input
                type="datetime-local"
                value={form.endsAtLocal}
                onChange={(e) => setForm((prev) => ({ ...prev, endsAtLocal: e.target.value }))}
              />
            </label>
            <div className="mk3-cadence-field">
              <span>Recurring Weekly Schedule</span>
              <WeeklyScheduleEditor
                value={form.cadenceRows}
                onChange={(cadenceRows) => setForm((prev) => ({ ...prev, cadenceRows }))}
              />
              {!hasStructuredCadence && !!form.recurringRule && (
                <div className="mk3-status mk3-status-warning">
                  Existing recurring rule will stay unchanged unless you set a structured schedule.
                </div>
              )}
            </div>
            <label>
              Host Name
              <input
                value={form.hostName}
                onChange={(e) => setForm((prev) => ({ ...prev, hostName: e.target.value }))}
                placeholder="Host / KJ"
              />
            </label>
            <label>
              Venue Name
              <input
                value={form.venueName}
                onChange={(e) => setForm((prev) => ({ ...prev, venueName: e.target.value }))}
                placeholder="Venue"
              />
            </label>
          </>
        )}
        {listingType === "venue" && !!cadenceLabelPreview && (
          <div className="mk3-status">
            <strong>Cadence Preview</strong>
            <span>{cadenceLabelPreview}</span>
          </div>
        )}
        {listingType !== "venue" && !!recurringRulePreview && (
          <div className="mk3-status">
            <strong>Recurring Rule Preview</strong>
            <span>{recurringRulePreview}</span>
          </div>
        )}
        <label>
          Notes
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Details about this cadence update"
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : isOwner ? "Save Cadence" : "Submit Cadence Update"}
        </button>
      </form>
      )}
      {status && <div className="mk3-status">{status}</div>}
    </aside>
  );
};

export default CadenceUpdateCard;

