import React, { useMemo, useState } from "react";
import { trackEvent } from "../../../lib/firebase";
import { directoryActions } from "../api/directoryApi";
import { formatDateTime } from "./shared";

const ListingSubmissionPage = ({ session, navigate, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const [listingType, setListingType] = useState("venue");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    karaokeNightsLabel: "",
    recurringRule: "",
    city: "",
    state: "",
    region: "nationwide",
    address1: "",
    startsAtMs: "",
    endsAtMs: "",
    hostName: "",
    venueName: "",
    roomCode: "",
    visibility: "public",
  });

  const previewStart = useMemo(() => Number(form.startsAtMs || 0), [form.startsAtMs]);

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
      setStatus("Sign in with an upgraded account to submit listings.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const payload = {
        ...form,
        startsAtMs: Number(form.startsAtMs || 0) || 0,
        endsAtMs: Number(form.endsAtMs || 0) || 0,
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
            <label className="full">
              Karaoke Nights Label
              <textarea
                value={form.karaokeNightsLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, karaokeNightsLabel: e.target.value }))}
                placeholder="Mon 8pm-11pm | Thu 9pm-1am"
              />
            </label>
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
                Start (epoch ms)
                <input value={form.startsAtMs} onChange={(e) => setForm((prev) => ({ ...prev, startsAtMs: e.target.value }))} />
              </label>
              <label>
                End (epoch ms)
                <input value={form.endsAtMs} onChange={(e) => setForm((prev) => ({ ...prev, endsAtMs: e.target.value }))} />
              </label>
            </>
          )}
          {listingType === "event" && (
            <>
              <label className="full">
                Recurring Rule
                <input
                  value={form.recurringRule}
                  onChange={(e) => setForm((prev) => ({ ...prev, recurringRule: e.target.value }))}
                  placeholder="Weekly Thu-Sat"
                />
              </label>
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
