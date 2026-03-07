import React, { useMemo, useState } from "react";
import { trackEvent, trackGoldenPathMilestone } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { formatDateTime, fromDateTimeLocalInput, toDateTimeLocalInput } from "./shared";
import {
  buildKaraokeNightsLabel,
  buildNextCadenceWindow,
  buildRecurringRule,
  createEmptyCadenceRows,
} from "./cadenceSchedule";
import WeeklyScheduleEditor from "./WeeklyScheduleEditor";

const splitTagInput = (value = "", max = 8) =>
  String(value || "")
    .split(/[,\n]/g)
    .map((entry) => entry.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""))
    .filter(Boolean)
    .filter((entry, index, array) => array.indexOf(entry) === index)
    .slice(0, Math.max(1, Number(max || 8)));

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
    experienceTagsInput: "",
    hostStyleTagsInput: "",
    crowdVibeTagsInput: "",
    bestForTagsInput: "",
    rotationEstimate: "",
    beginnerFriendly: "",
    duetFriendly: "",
    beauRocksCapabilitiesInput: "",
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
      setStatus("Create your BeauRocks account to submit listings.");
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
        experienceTags: splitTagInput(form.experienceTagsInput, 10),
        hostStyleTags: splitTagInput(form.hostStyleTagsInput, 6),
        crowdVibeTags: splitTagInput(form.crowdVibeTagsInput, 8),
        bestForTags: splitTagInput(form.bestForTagsInput, 6),
        rotationEstimate: String(form.rotationEstimate || "").trim().toLowerCase(),
        beginnerFriendly: String(form.beginnerFriendly || "").trim().toLowerCase(),
        duetFriendly: String(form.duetFriendly || "").trim().toLowerCase(),
        beauRocksCapabilities: splitTagInput(form.beauRocksCapabilitiesInput, 10),
        scheduleVerifiedAtMs: Date.now(),
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
      if (listingType === "venue") {
        trackGoldenPathMilestone({ pathId: "venue_submit_listing", workstream: "venue_growth", source: "listing_submit" });
      } else if (listingType === "event") {
        trackGoldenPathMilestone({ pathId: "host_publish_event", workstream: "host_growth", source: "listing_submit" });
      } else if (listingType === "room_session") {
        trackGoldenPathMilestone({ pathId: "host_create_session", workstream: "host_growth", source: "listing_submit" });
      }
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
            <div className="mk3-status">Create your BeauRocks account to submit and manage listings.</div>
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
              Create BeauRocks Account
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
          <label>
            Rotation
            <select value={form.rotationEstimate} onChange={(e) => setForm((prev) => ({ ...prev, rotationEstimate: e.target.value }))}>
              <option value="">Unknown</option>
              <option value="fast">Fast</option>
              <option value="medium">Steady</option>
              <option value="slow">Longer queue</option>
            </select>
          </label>
          <label>
            Beginner Friendly
            <select value={form.beginnerFriendly} onChange={(e) => setForm((prev) => ({ ...prev, beginnerFriendly: e.target.value }))}>
              <option value="">Unknown</option>
              <option value="high">High</option>
              <option value="medium">Mixed</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            Duet Friendly
            <select value={form.duetFriendly} onChange={(e) => setForm((prev) => ({ ...prev, duetFriendly: e.target.value }))}>
              <option value="">Unknown</option>
              <option value="high">High</option>
              <option value="medium">Mixed</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="full">
            Experience Tags
            <input
              value={form.experienceTagsInput}
              onChange={(e) => setForm((prev) => ({ ...prev, experienceTagsInput: e.target.value }))}
              placeholder="fast_rotation, singalong, strong_sound"
            />
          </label>
          <label className="full">
            Crowd Vibe Tags
            <input
              value={form.crowdVibeTagsInput}
              onChange={(e) => setForm((prev) => ({ ...prev, crowdVibeTagsInput: e.target.value }))}
              placeholder="welcoming, late_night, serious_singers"
            />
          </label>
          <label className="full">
            Best For
            <input
              value={form.bestForTagsInput}
              onChange={(e) => setForm((prev) => ({ ...prev, bestForTagsInput: e.target.value }))}
              placeholder="first_timers, friend_groups, regulars"
            />
          </label>
          <label className="full">
            Host Style Tags
            <input
              value={form.hostStyleTagsInput}
              onChange={(e) => setForm((prev) => ({ ...prev, hostStyleTagsInput: e.target.value }))}
              placeholder="hype, organized, playful"
            />
          </label>
          <label className="full">
            BeauRocks Capabilities
            <input
              value={form.beauRocksCapabilitiesInput}
              onChange={(e) => setForm((prev) => ({ ...prev, beauRocksCapabilitiesInput: e.target.value }))}
              placeholder="live_join, audience_app, interactive_tv, recap_ready"
            />
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
          <li>Experience tags drive discover badges and modern karaoke storytelling.</li>
        </ul>
        {previewStart > 0 && (
          <div className="mk3-status">Start Preview: {formatDateTime(previewStart)}</div>
        )}
      </aside>
    </section>
  );
};

export default ListingSubmissionPage;

