import React, { useMemo, useState } from "react";
import { trackEvent } from "../../../lib/firebase";
import { directoryActions } from "../api/directoryApi";
import { formatDateTime, fromDateTimeLocalInput, toDateTimeLocalInput } from "./shared";
import {
  buildKaraokeNightsLabel,
  buildNextCadenceWindow,
  buildRecurringRule,
  createEmptyCadenceRows,
} from "./cadenceSchedule";
import WeeklyScheduleEditor from "./WeeklyScheduleEditor";

const ListingSubmissionPage = ({ session, navigate, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const [listingType, setListingType] = useState("venue");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "",
    state: "",
    region: "nationwide",
    address1: "",
    startsAtLocal: "",
    endsAtLocal: "",
    cadenceRows: createEmptyCadenceRows(),
    hostName: "",
    venueName: "",
    roomCode: "",
    visibility: "public",
  });

  const cadenceLabel = useMemo(() => buildKaraokeNightsLabel(form.cadenceRows), [form.cadenceRows]);
  const recurringRulePreview = useMemo(() => buildRecurringRule(form.cadenceRows), [form.cadenceRows]);
  const nextCadenceWindow = useMemo(() => buildNextCadenceWindow(form.cadenceRows), [form.cadenceRows]);
  const previewStart = useMemo(
    () => fromDateTimeLocalInput(form.startsAtLocal) || Number(nextCadenceWindow.startsAtMs || 0),
    [form.startsAtLocal, nextCadenceWindow.startsAtMs]
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "listing_submit",
        targetType: listingType,
        targetId: "",
        returnRoute: {
          page: "submit",
          params: {
            intent: "listing_submit",
            targetType: listingType,
          },
        },
      });
      setStatus("Create an account to submit listings.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      let startsAtMs = fromDateTimeLocalInput(form.startsAtLocal);
      let endsAtMs = fromDateTimeLocalInput(form.endsAtLocal);
      if (listingType === "event" && startsAtMs <= 0 && Number(nextCadenceWindow.startsAtMs || 0) > 0) {
        startsAtMs = Number(nextCadenceWindow.startsAtMs || 0);
      }
      if (listingType === "event" && endsAtMs <= 0 && Number(nextCadenceWindow.endsAtMs || 0) > 0) {
        endsAtMs = Number(nextCadenceWindow.endsAtMs || 0);
      }
      const payload = {
        title: form.title,
        description: form.description,
        city: form.city,
        state: form.state,
        region: form.region,
        address1: form.address1,
        startsAtMs: Number(startsAtMs || 0) || 0,
        endsAtMs: Number(endsAtMs || 0) || 0,
        karaokeNightsLabel: listingType === "venue" ? cadenceLabel : "",
        recurringRule: listingType === "event" ? recurringRulePreview : "",
        hostName: form.hostName,
        venueName: form.venueName,
        roomCode: form.roomCode,
        visibility: listingType === "room_session" ? form.visibility : "public",
      };
      const result = await directoryActions.submitDirectoryListing({
        listingType,
        payload,
      });
      setStatus(`Submitted for moderation. Submission ID: ${result?.submissionId || "pending"}`);
      trackEvent(`mk_listing_created_${listingType}`, {
        listingType,
        submissionId: result?.submissionId || "",
      });
    } catch (error) {
      setStatus(String(error?.message || "Submission failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">submit listing</div>
        <h2>Create Venue, Event, or Room Session</h2>
        <p>
          All submissions route through moderation. Browsing remains public; posting requires login.
        </p>
        {!canSubmit && (
          <div className="mk3-actions-block">
            <div className="mk3-status">Create an account to submit and manage listings.</div>
            <button
              type="button"
              onClick={() => authFlow?.requireFullAuth?.({
                intent: "listing_submit",
                targetType: listingType,
                targetId: "",
                returnRoute: {
                  page: "submit",
                  params: {
                    intent: "listing_submit",
                    targetType: listingType,
                  },
                },
              })}
            >
              Create Account To Submit
            </button>
          </div>
        )}
        {canSubmit && (
        <form className="mk3-form-grid" onSubmit={submit}>
          <label>
            Listing Type
            <select value={listingType} onChange={(e) => setListingType(e.target.value)}>
              <option value="venue">Venue</option>
              <option value="event">Event</option>
              <option value="room_session">Room Session</option>
            </select>
          </label>
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          </label>
          <label className="full">
            Description
            <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </label>
          {listingType === "venue" && (
            <div className="full mk3-cadence-field">
              <span>Weekly Karaoke Schedule</span>
              <WeeklyScheduleEditor
                value={form.cadenceRows}
                onChange={(cadenceRows) => setForm((prev) => ({ ...prev, cadenceRows }))}
              />
              {cadenceLabel && (
                <div className="mk3-status">
                  <strong>Cadence Preview</strong>
                  <span>{cadenceLabel}</span>
                </div>
              )}
            </div>
          )}
          <label>
            City
            <input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
          </label>
          <label>
            State
            <input value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} />
          </label>
          <label>
            Region Token
            <input value={form.region} onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))} />
          </label>
          <label className="full">
            Address
            <input value={form.address1} onChange={(e) => setForm((prev) => ({ ...prev, address1: e.target.value }))} />
          </label>
          {(listingType === "event" || listingType === "room_session") && (
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
            </>
          )}
          {listingType === "event" && (
            <>
              <div className="full mk3-cadence-field">
                <span>Recurring Weekly Schedule</span>
                <WeeklyScheduleEditor
                  value={form.cadenceRows}
                  onChange={(cadenceRows) => setForm((prev) => ({ ...prev, cadenceRows }))}
                />
                {recurringRulePreview && (
                  <div className="mk3-status">
                    <strong>Recurring Rule Preview</strong>
                    <span>{recurringRulePreview}</span>
                  </div>
                )}
              </div>
              {Number(nextCadenceWindow.startsAtMs || 0) > 0 && (
                <div className="mk3-actions-inline full">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      startsAtLocal: toDateTimeLocalInput(nextCadenceWindow.startsAtMs || 0),
                      endsAtLocal: toDateTimeLocalInput(nextCadenceWindow.endsAtMs || 0),
                    }))}
                  >
                    Use Next Cadence Slot
                  </button>
                </div>
              )}
              <label>
                Host Name
                <input value={form.hostName} onChange={(e) => setForm((prev) => ({ ...prev, hostName: e.target.value }))} />
              </label>
              <label>
                Venue Name
                <input value={form.venueName} onChange={(e) => setForm((prev) => ({ ...prev, venueName: e.target.value }))} />
              </label>
            </>
          )}
          {listingType === "room_session" && (
            <>
              <label>
                Room Code
                <input value={form.roomCode} onChange={(e) => setForm((prev) => ({ ...prev, roomCode: e.target.value.toUpperCase() }))} />
              </label>
              <label>
                Visibility
                <select value={form.visibility} onChange={(e) => setForm((prev) => ({ ...prev, visibility: e.target.value }))}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>
            </>
          )}
          <div className="mk3-actions-inline full">
            <button type="submit" disabled={busy}>{busy ? "Submitting..." : "Submit For Review"}</button>
            <button type="button" onClick={() => navigate("profile")}>Back To Dashboard</button>
          </div>
        </form>
        )}
        {status && <div className="mk3-status">{status}</div>}
      </article>

      <aside className="mk3-actions-card">
        <h4>Submission Notes</h4>
        <ul className="mk3-plain-list">
          <li>Moderation required before publish.</li>
          <li>Google/Yelp enrichment can be added by admins.</li>
          <li>Room sessions support public/private visibility.</li>
        </ul>
        {previewStart > 0 && (
          <div className="mk3-status">Start Preview: {formatDateTime(previewStart)}</div>
        )}
      </aside>
    </section>
  );
};

export default ListingSubmissionPage;
